"""Check sign-in against the live API with a throwaway Cognito user.

    python tests/smoke_auth.py https://<api> <table> <user pool id> <client id>
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

API, TABLE, POOL, CLIENT = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3], sys.argv[4]
DRIVE = "smoke-" + os.urandom(3).hex()
EMAIL = f"smoke-{os.urandom(4).hex()}@example.com"
PASSWORD = "t" + os.urandom(9).hex() + "9"
NAME = "smoke" + os.urandom(2).hex()
failures = []


def aws(*args):
    r = subprocess.run(["aws", *args, "--output", "json"], check=True, capture_output=True)
    return json.loads(r.stdout or "{}")


def call(method, path, body=None, token=None):
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    req = urllib.request.Request(API + path, method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
    if not ok:
        failures.append(name)


def sign_in():
    out = aws("cognito-idp", "admin-initiate-auth", "--user-pool-id", POOL, "--client-id", CLIENT,
              "--auth-flow", "ADMIN_USER_PASSWORD_AUTH", "--auth-parameters", f"USERNAME={EMAIL},PASSWORD={PASSWORD}")
    return out["AuthenticationResult"]["AccessToken"]


aws("cognito-idp", "admin-create-user", "--user-pool-id", POOL, "--username", EMAIL, "--message-action", "SUPPRESS")
aws("cognito-idp", "admin-set-user-password", "--user-pool-id", POOL, "--username", EMAIL, "--password", PASSWORD, "--permanent")
aws("dynamodb", "put-item", "--table-name", TABLE, "--item", json.dumps({
    "pk": {"S": f"DRIVE#{DRIVE}"}, "sk": {"S": "META"}, "id": {"S": DRIVE}, "name": {"S": "Auth smoke"},
    "organiser": {"S": "Smoke"}, "treeIds": {"L": []}}))
try:
    token = sign_in()
    st, e = call("POST", "/trees/dtu-gate3-017/adopt", {"handle": "x"}, token="not.a.token")
    check("a made-up token is refused", st == 401 and e["error"]["source"] == "cognito", str(st))

    st, tree = call("POST", f"/drives/{DRIVE}/trees", {"name": "Gamma", "lat": 26.2, "lng": 78.2, "accuracyM": 5, "soilDry": True}, token)
    check("signed in but unnamed cannot register", st == 409 and tree["error"]["code"] == "no_name", str(st))
    st, tree = call("POST", f"/drives/{DRIVE}/trees", {"name": "Gamma", "lat": 26.2, "lng": 78.2, "accuracyM": 5, "soilDry": True})
    tid = tree["id"]

    st, e = call("POST", f"/trees/{tid}/adopt", {"handle": "riya"}, token)
    check("an example adopter's name cannot be claimed", st == 409 and e["error"]["code"] == "name_taken", str(st))
    st, t = call("POST", f"/trees/{tid}/adopt", {"handle": NAME}, token)
    check("adopting claims a name", st == 200 and t["adopter"] == {"handle": NAME}, str(st))

    st, r = call("POST", "/proofs/nope/review", {"verdict": "same", "by": "organiser"}, token)
    check("a signed-in adopter cannot vote as the organiser", st == 403 and r["error"]["code"] == "organiser_only", str(st))

    st, mine = call("GET", "/reviews?for=riya", None, token)
    check("the review list is for the signed-in person, whatever the URL says", st == 200 and mine == [], str(st))

    aws("cognito-idp", "admin-add-user-to-group", "--user-pool-id", POOL, "--username", EMAIL, "--group-name", "organisers")
    token = sign_in()
    st, r = call("POST", "/proofs/nope/review", {"verdict": "same", "by": "organiser"}, token)
    check("once in the organisers group, the organiser vote reaches the route", st == 404 and r["error"]["code"] == "proof_not_found", str(st))
finally:
    aws("cognito-idp", "admin-delete-user", "--user-pool-id", POOL, "--username", EMAIL)
    removed = 0
    scan = aws("dynamodb", "scan", "--table-name", TABLE, "--projection-expression", "pk, sk, handle",
               "--filter-expression", "contains(pk, :d) OR contains(sk, :d) OR pk = :h OR handle = :n",
               "--expression-attribute-values", json.dumps({":d": {"S": DRIVE}, ":h": {"S": f"HANDLE#{NAME}"}, ":n": {"S": NAME}}))
    for item in scan["Items"]:
        aws("dynamodb", "delete-item", "--table-name", TABLE, "--key", json.dumps({"pk": item["pk"], "sk": item["sk"]}))
        removed += 1
    print(f"removed the test user and {removed} items")

print(f"\n{len(failures)} failed" if failures else "\nall passed")
sys.exit(1 if failures else 0)
