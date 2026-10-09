"""Who is asking.

Sign-in is Amazon Cognito. The browser sends the Cognito access token; we ask Cognito
whether it is valid (GetUser), so no token is trusted on its own word. A signed-in
person claims one name, once, and from then on the API uses that name whatever the
request body says.

REQUIRE_AUTH=off (the default while the web app is being wired up) keeps the old
behaviour for requests with no token: the name in the request is believed.
"""
import base64
import json
import os

from botocore.exceptions import BotoCoreError, ClientError

import aws
import store
from common import ORGANISER, handle_of
from errors import BadRequest, SourceError

REQUIRED = os.environ.get("REQUIRE_AUTH", "off") == "on"
ORGANISER_GROUP = "organisers"

# Routes that change something. Reads stay open: anyone can open a tree and hear it.
WRITES = {
    "POST /trees/{id}/adopt", "POST /trees/{id}/proof-url", "POST /trees/{id}/proof", "POST /trees/{id}/cover",
    "POST /trees/{id}/subscribe",
    "POST /covers/{id}/accept", "POST /covers/{id}/decline", "POST /drives/{id}/remind",
    "POST /drives/{id}/photo-url", "POST /drives/{id}/trees", "POST /proofs/{id}/review",
}
ORGANISER_ONLY = {"POST /drives/{id}/remind"}


def _groups(token: str) -> list[str]:
    """Groups from the token body. Only read after Cognito has confirmed the token."""
    try:
        part = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))).get("cognito:groups", [])
    except (IndexError, ValueError):
        return []


def who(event: dict) -> dict | None:
    """-> {sub, organiser, handle} for a valid token, None when no token was sent."""
    header = (event.get("headers") or {}).get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    try:
        user = aws.client("cognito-idp").get_user(AccessToken=token)
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NotAuthorizedException", "UserNotFoundException", "InvalidParameterException"):
            raise SourceError("cognito", "sign_in_expired", "Your sign-in has expired. Please sign in again.", 401)
        raise SourceError("cognito", "sign_in_unavailable", "Could not check your sign-in with Cognito.")
    except BotoCoreError:
        raise SourceError("cognito", "sign_in_unavailable", "Could not check your sign-in with Cognito.")
    sub = next(a["Value"] for a in user["UserAttributes"] if a["Name"] == "sub")
    record = store.get_item(f"USER#{sub}")
    return {"sub": sub, "organiser": ORGANISER_GROUP in _groups(token), "handle": (record or {}).get("handle")}


def claim(person: dict, wanted) -> str:
    """Give a signed-in person their name. One name per person, one person per name."""
    if person["handle"]:
        return person["handle"]
    handle = handle_of(wanted)
    if handle.lower() == ORGANISER:
        raise BadRequest("name_taken", "That name is taken. Choose another.", 409)
    if not store.put_item(f"HANDLE#{handle.lower()}", "META", {"sub": person["sub"]}, only_if_new=True):
        owner = store.get_item(f"HANDLE#{handle.lower()}")
        if (owner or {}).get("sub") != person["sub"]:
            raise BadRequest("name_taken", f"The name {handle} is taken. Choose another.", 409)
    store.put_item(f"USER#{person['sub']}", "META", {"handle": handle})
    person["handle"] = handle
    return handle


def apply(route: str, event: dict, query: dict, body: dict):
    """Check sign-in for this request and put the caller's real name into it."""
    person = who(event)
    if person is None:
        if REQUIRED and route in WRITES:
            raise SourceError("cognito", "sign_in", "Please sign in to do that.", 401)
        return

    if route in ORGANISER_ONLY and REQUIRED and not person["organiser"]:
        raise SourceError("cognito", "organiser_only", "Only the drive's organiser can do that.", 403)

    if route == "POST /proofs/{id}/review" and body.get("by") == ORGANISER:
        if not person["organiser"]:
            raise SourceError("cognito", "organiser_only", "Only the drive's organiser can vote as the organiser.", 403)
        return
    if route == "POST /trees/{id}/adopt":
        body["handle"] = claim(person, body.get("handle"))
        return
    if route == "GET /reviews":
        if person["handle"]:
            query["for"] = person["handle"]
        return
    if route in WRITES:
        if not person["handle"]:
            if person["organiser"]:
                return
            raise BadRequest("no_name", "Adopt a sapling first, so we know what to call you.", 409)
        for key in ("handle", "by", "addedBy"):
            if key in body or route in ("POST /trees/{id}/proof", "POST /proofs/{id}/review", "POST /trees/{id}/subscribe") and key != "addedBy":
                body[key] = person["handle"]
