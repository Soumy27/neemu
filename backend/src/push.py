"""Notifications that reach the adopter's phone: Web Push.

When Neemu needs water, the browser's own push service (Google's, Apple's, Mozilla's)
delivers a notification even if the app is closed. No phone number, no SMS.
The signing key lives in SSM Parameter Store, never in the code.
"""
import hashlib
import json
from urllib.parse import urlparse

from botocore.exceptions import BotoCoreError, ClientError

import aws
import store
from common import handle_of, tree_or_404
from errors import BadRequest, SourceError

CONTACT = "mailto:neemu@users.noreply.github.com"
# We only ever send to the real push services, never to an address a caller made up.
PUSH_HOSTS = ("fcm.googleapis.com", ".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com")

_keys: dict = {}


def _key(name: str, secret: bool = False) -> str:
    if name not in _keys:
        try:
            _keys[name] = aws.client("ssm").get_parameter(Name=f"/neemu/{name}", WithDecryption=secret)["Parameter"]["Value"]
        except (ClientError, BotoCoreError) as e:
            raise SourceError("ssm", "push_key_unavailable", f"Could not read the notification key: {type(e).__name__}")
    return _keys[name]


def public_key(_id, query, body):
    return {"publicKey": _key("vapid-public")}


def _allowed(endpoint: str) -> bool:
    u = urlparse(endpoint)
    host = u.hostname or ""
    return u.scheme == "https" and any(host == h or (h.startswith(".") and host.endswith(h)) for h in PUSH_HOSTS)


def subscribe(tree_id, query, body):
    """Remember where to reach this sapling's adopter, and say hello so they see it work."""
    meta = tree_or_404(tree_id)
    sub = body.get("subscription")
    keys = sub.get("keys") if isinstance(sub, dict) else None
    if not isinstance(sub, dict) or not isinstance(sub.get("endpoint"), str) or not isinstance(keys, dict) \
            or not isinstance(keys.get("p256dh"), str) or not isinstance(keys.get("auth"), str) or len(json.dumps(sub)) > 2000:
        raise BadRequest("bad_subscription", "That is not a push subscription.")
    if not _allowed(sub["endpoint"]):
        raise BadRequest("bad_push_service", "That push service is not one we send to.")
    handle = handle_of(body["handle"]) if body.get("handle") else (meta.get("adopter") or {}).get("handle")
    if not meta.get("adopter") or handle != meta["adopter"]["handle"]:
        raise BadRequest("not_adopter", "Only this sapling's adopter can turn on its notifications.", 403)

    clean = {"endpoint": sub["endpoint"], "keys": {"p256dh": keys["p256dh"], "auth": keys["auth"]}}
    sk = "PUSH#" + hashlib.sha256(sub["endpoint"].encode()).hexdigest()[:24]
    store.put_item(f"TREE#{tree_id}", sk, {"subscription": clean, "handle": handle})
    sent = send(meta, f"{meta['name']} can reach you now",
                "I'll tell you when I'm thirsty, and when the rain has done it for you.")
    return {"subscribed": True, "sent": sent}


def send(meta: dict, title: str, text: str) -> int:
    """Notify every phone subscribed to this sapling. Returns how many accepted it. Never raises."""
    subs = store.query(f"TREE#{meta['id']}", "PUSH#")
    if not subs:
        return 0
    try:
        from pywebpush import WebPushException, webpush
        private = _key("vapid-private", secret=True)
    except (ImportError, SourceError) as e:
        print(f"PUSH unavailable: {e}")
        return 0

    payload = json.dumps({"title": title, "body": text, "url": f"/?tree={meta['id']}", "tag": meta["id"]}, ensure_ascii=False)
    delivered = 0
    for item in subs:
        try:
            webpush(subscription_info=item["subscription"], data=payload, vapid_private_key=private,
                    vapid_claims={"sub": CONTACT}, ttl=12 * 3600, timeout=8)
            delivered += 1
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):          # the phone unsubscribed or the browser was reset
                store.delete_item(item["pk"], item["sk"])
            print(f"PUSH failed for {meta['id']}: HTTP {status}")
        except Exception as e:
            print(f"PUSH failed for {meta['id']}: {type(e).__name__}")
    return delivered
