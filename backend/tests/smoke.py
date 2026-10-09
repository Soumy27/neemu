"""End-to-end check of the live API: register, adopt, proof, review, buddies, cover.

Runs against a throwaway drive so the example drive is not touched.
    python tests/smoke.py https://<api> <dynamodb table>
"""
import io
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

from PIL import Image

API, TABLE = sys.argv[1].rstrip("/"), sys.argv[2]
DRIVE = "smoke-" + os.urandom(3).hex()
LAT, LNG = 26.2183, 78.1828
failures = []


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, headers={"content-type": "application/json"},
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


def photo(_n):
    img = Image.frombytes("RGB", (320, 240), os.urandom(320 * 240 * 3))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=80)
    return buf.getvalue()


def upload(url_path, data):
    _, u = call("POST", url_path, {})
    req = urllib.request.Request(u["uploadUrl"], data=data, method="PUT", headers={"content-type": "image/jpeg"})
    with urllib.request.urlopen(req, timeout=40) as r:
        assert r.status == 200
    return u["key"]


def ddb(*args):
    subprocess.run(["aws", "dynamodb", *args, "--table-name", TABLE], check=True, capture_output=True)


ddb("put-item", "--item", json.dumps({"pk": {"S": f"DRIVE#{DRIVE}"}, "sk": {"S": "META"}, "id": {"S": DRIVE},
    "name": {"S": "Smoke test drive"}, "organiser": {"S": "Smoke"}, "treeIds": {"L": []}}))

# register two saplings 20 m apart, the first with a reference photo and dry soil
ref = upload(f"/drives/{DRIVE}/photo-url", photo(1))
st, a = call("POST", f"/drives/{DRIVE}/trees", {"name": "Alpha", "species": "Neem", "lat": LAT, "lng": LNG,
                                                "accuracyM": 6, "referencePhotoKey": ref, "soilDry": True})
check("register with reference photo", st == 200 and a["referencePhotoUrl"] and a["adopter"] is None, f"{st} {a.get('id')}")
st, b = call("POST", f"/drives/{DRIVE}/trees", {"name": "Beta", "species": "Jamun", "lat": LAT + 0.00018, "lng": LNG, "accuracyM": None})
check("register without photo or accuracy", st == 200 and b["referencePhotoUrl"] is None, str(st))
st, e = call("POST", f"/drives/{DRIVE}/trees", {"name": "", "lat": LAT, "lng": LNG})
check("register rejects an empty name", st == 400, e.get("error", {}).get("code"))

st, near = call("GET", f"/drives/{DRIVE}/nearby?lat={LAT}&lng={LNG}")
check("nearby lists both, nearest first", st == 200 and [t["id"] for t in near] == [a["id"], b["id"]] and near[0]["distanceM"] < 1,
      str([(t["name"], t["distanceM"]) for t in near]))

st, t = call("POST", f"/trees/{a['id']}/adopt", {"handle": "asha"})
check("adopt", st == 200 and t["adopter"] == {"handle": "asha"}, str(st))
st, e = call("POST", f"/trees/{a['id']}/adopt", {"handle": "someone"})
check("second adopter is refused", st == 409, e.get("error", {}).get("code"))
call("POST", f"/trees/{b['id']}/adopt", {"handle": "bilal"})

st, says = call("GET", f"/trees/{a['id']}/today")
check("dry sapling asks for water today", st == 200 and says["ask"] == "water" and says["litres"] > 0 and says["audioUrl"],
      f"{says.get('ask')} {says.get('litres')} L, {says.get('spokenBy')}")
st, says2 = call("POST", f"/trees/{a['id']}/talk", {"text": "kal kya hoga?", "lang": "hi"})
check("talk answers about tomorrow from the forecast", st == 200 and says2["steps"][0]["tool"] == "get_forecast", says2.get("textEn", "")[:70])

# proofs
k_far = upload(f"/trees/{a['id']}/proof-url", photo(2))
st, p = call("POST", f"/trees/{a['id']}/proof", {"key": k_far, "takenAt": "x", "lat": LAT + 0.01, "lng": LNG, "accuracyM": 8})
check("proof from 1 km away is rejected", st == 200 and p["verdict"] == "rejected" and p["distanceM"] > 1000, str(p.get("reasons")))
k_vague = upload(f"/trees/{a['id']}/proof-url", photo(3))
st, p = call("POST", f"/trees/{a['id']}/proof", {"key": k_vague, "lat": LAT, "lng": LNG, "accuracyM": 80})
check("proof with an 80 m fix is rejected", p["verdict"] == "rejected", str(p.get("reasons")))
k_nopos = upload(f"/trees/{a['id']}/proof-url", photo(4))
st, p = call("POST", f"/trees/{a['id']}/proof", {"key": k_nopos, "lat": None, "lng": None, "accuracyM": None})
check("proof with no position is rejected", p["verdict"] == "rejected", str(p.get("reasons")))

good = photo(5)
k_good = upload(f"/trees/{a['id']}/proof-url", good)
st, p = call("POST", f"/trees/{a['id']}/proof", {"key": k_good, "lat": LAT + 0.00003, "lng": LNG, "accuracyM": 9})
check("proof at the tree is accepted and the first one goes to review",
      p["verdict"] == "accepted" and p["review"] == "pending" and p["tree"]["status"] == "fine" and p["tree"]["streakDays"] == 1,
      f"{p.get('verdict')} review={p.get('review')} {p.get('distanceM')} m, status {p['tree']['status']}, streak {p['tree']['streakDays']}")
proof_id = p["proofId"]
k_again = upload(f"/trees/{a['id']}/proof-url", good)
st, p2 = call("POST", f"/trees/{a['id']}/proof", {"key": k_again, "lat": LAT, "lng": LNG, "accuracyM": 9})
check("the same photo again is rejected", p2["verdict"] == "rejected" and p2["reusedPhoto"], str(p2.get("reasons")))
st, e = call("POST", f"/trees/{b['id']}/proof", {"key": k_good, "lat": LAT, "lng": LNG, "accuracyM": 9})
check("a key from another sapling is refused", st == 400, e.get("error", {}).get("code"))

st, says = call("GET", f"/trees/{a['id']}/today")
check("after the proof Neemu says thanks, not an ask", says["ask"] == "none" and says["litres"] == 0, says["textEn"][:60])

# review
st, q = call("GET", f"/drives/{DRIVE}/reviews")
check("organiser queue shows the proof beside the reference", len(q) == 1 and q[0]["proofId"] == proof_id and q[0]["referencePhotoUrl"], str(len(q)))
st, mine = call("GET", "/reviews?for=bilal")
check("buddy with a nearby sapling sees it", [r["proofId"] for r in mine] == [proof_id], str(len(mine)))
st, own = call("GET", "/reviews?for=asha")
check("the sender does not review their own proof", own == [], str(len(own)))
st, e = call("POST", f"/proofs/{proof_id}/review", {"verdict": "same", "by": "asha"})
check("voting on your own proof is refused", st == 403, e.get("error", {}).get("code"))
st, e = call("POST", f"/proofs/{proof_id}/review", {"verdict": "same", "by": "stranger"})
check("a stranger cannot vote", st == 403, e.get("error", {}).get("code"))
st, r = call("POST", f"/proofs/{proof_id}/review", {"verdict": "different", "by": "bilal"})
check("one buddy vote leaves it pending", r == {"proofId": proof_id, "review": "pending"}, str(r))
st, r = call("POST", f"/proofs/{proof_id}/review", {"verdict": "different", "by": "organiser"})
check("organiser says different: rejected", r["review"] == "rejected", str(r))
st, t = call("GET", f"/trees/{a['id']}")
check("a rejected proof no longer waters the tree", t["status"] != "fine" and t["water"]["litresNeeded"] > 0, f"{t['status']} {t['water']['litresNeeded']} L")
st, q = call("GET", f"/drives/{DRIVE}/reviews")
check("queue is empty again", q == [], str(len(q)))

# buddies and cover
st, bs = call("GET", f"/trees/{a['id']}/buddies")
check("buddies lists the neighbour", [x["handle"] for x in bs] == ["bilal"], str(bs))
st, c = call("POST", f"/trees/{a['id']}/cover", {"toHandle": "bilal"})
check("ask a buddy to cover", st == 200 and c["status"] == "asked", str(c.get("status")))
k_cover = upload(f"/trees/{a['id']}/proof-url", photo(6))
st, p = call("POST", f"/trees/{a['id']}/proof", {"key": k_cover, "lat": LAT, "lng": LNG, "accuracyM": 9, "handle": "bilal"})
check("buddy's proof before accepting is rejected", p["verdict"] == "rejected", str(p.get("reasons")))
st, c = call("POST", f"/covers/{c['id']}/accept", {})
check("buddy accepts", c["status"] == "accepted", str(c))
k_cover2 = upload(f"/trees/{a['id']}/proof-url", photo(7))
st, p = call("POST", f"/trees/{a['id']}/proof", {"key": k_cover2, "lat": LAT, "lng": LNG, "accuracyM": 9, "handle": "bilal"})
check("buddy's proof after accepting counts for the tree", p["verdict"] == "accepted" and p["coverFor"] == a["id"] and p["tree"]["status"] == "fine",
      f"{p.get('verdict')} coverFor={p.get('coverFor')}")

st, d = call("GET", f"/drives/{DRIVE}")
alpha = next(t for t in d["trees"] if t["id"] == a["id"])
check("register shows the last proof photo", st == 200 and alpha["lastProof"] and alpha["lastProof"]["photoUrl"], str(d["counts"]))

st, e = call("POST", f"/proofs/{proof_id}/review", {"verdict": "same"})
check("a vote with no name is refused", st == 400, e.get("error", {}).get("code"))

# tidy up: remove everything this run wrote to the table
def keys(pk):
    out = subprocess.run(["aws", "dynamodb", "query", "--table-name", TABLE, "--key-condition-expression", "pk = :p",
                          "--expression-attribute-values", json.dumps({":p": {"S": pk}}),
                          "--projection-expression", "pk, sk", "--output", "json"], check=True, capture_output=True)
    return json.loads(out.stdout)["Items"]

removed = 0
for pk in [f"DRIVE#{DRIVE}", f"REVIEWQ#{DRIVE}", f"TREE#{a['id']}", f"TREE#{b['id']}", "ADOPTER#asha", "ADOPTER#bilal"]:
    for k in keys(pk):
        if pk.startswith("ADOPTER#") and k["sk"]["S"] not in (a["id"], b["id"]):
            continue
        ddb("delete-item", "--key", json.dumps(k))
        removed += 1
print(f"removed {removed} test items")

print(f"\n{len(failures)} failed" if failures else "\nall passed")
sys.exit(1 if failures else 0)
