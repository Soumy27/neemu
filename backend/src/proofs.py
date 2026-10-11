"""Proof photos and the manual same-tree review.

Nothing is attached to a tree. A proof is accepted on two checks made in code:
the phone was at the tree (position gate) and the image has not been sent before
(hash). Whether it is the same tree is then decided by people, through the review queue.
"""
import hashlib
import os
import uuid

from botocore.exceptions import ClientError

import aws
import store
import views
import weather
from common import ORGANISER, distance_m, handle_of, now_iso, number, tree_or_404, drive_or_404
from errors import BadRequest, SourceError

MAX_PHOTO_BYTES = 10 * 1024 * 1024
GATE_MIN_M = 15.0          # accept within max(15 m, the phone's own accuracy)
GATE_MAX_ACCURACY_M = 50.0 # a fix vaguer than this proves nothing
SOFT_ACCURACY_M = 30.0     # accepted, but always sent for review
REVIEW_ONE_IN = 5
BUDDY_RADIUS_M = 150.0
VOTES_TO_DECIDE = 2


def _bucket() -> str:
    return os.environ["MEDIA_BUCKET"]


def _is_image(head: bytes) -> bool:
    return head[:3] == b"\xff\xd8\xff" or head[:8] == b"\x89PNG\r\n\x1a\n" or (head[:4] == b"RIFF" and head[8:12] == b"WEBP")


def upload_url(prefix: str) -> dict:
    key = f"{prefix}/{uuid.uuid4().hex}"
    try:
        url = aws.s3().generate_presigned_url("put_object", Params={"Bucket": _bucket(), "Key": key}, ExpiresIn=300)
    except ClientError as e:
        raise SourceError("s3", "upload_url_failed", f"Could not prepare the photo upload: {e.response['Error']['Code']}")
    return {"uploadUrl": url, "key": key}


def read_photo(key: str) -> bytes:
    """Fetch an uploaded photo, refusing anything that is not a reasonably sized image."""
    try:
        head = aws.s3().head_object(Bucket=_bucket(), Key=key)
    except ClientError:
        raise BadRequest("photo_missing", "The photo did not arrive. Please take it again.")
    if head["ContentLength"] > MAX_PHOTO_BYTES:
        raise BadRequest("photo_too_large", "That photo is larger than 10 MB.", 413)
    try:
        data = aws.s3().get_object(Bucket=_bucket(), Key=key)["Body"].read()
    except ClientError as e:
        raise SourceError("s3", "photo_read_failed", f"Could not read the photo: {e.response['Error']['Code']}")
    if len(data) < 1024 or not _is_image(data[:16]):
        raise BadRequest("not_a_photo", "That isn't a photo.")
    return data


def proof_url(tree_id, query, body):
    tree_or_404(tree_id)
    return upload_url(f"proofs/{tree_id}")


def position_problem(distance_m_: float | None, accuracy_m: float | None) -> str | None:
    """Why this position does not show the person was at the sapling, or None if it does."""
    if distance_m_ is None or accuracy_m is None:
        return "Your phone did not share its position. Allow location and try again."
    if accuracy_m > GATE_MAX_ACCURACY_M:
        return f"Your phone's position is only good to {accuracy_m:.0f} m. Step into the open and try again."
    if distance_m_ > max(GATE_MIN_M, accuracy_m):
        return f"You are about {distance_m_:.0f} m from this sapling. Stand next to it."
    return None


def needs_review(proof_id: str, first: bool, accuracy_m: float) -> bool:
    """Every first proof, every vague fix, and one in five of the rest, chosen by the proof's own id."""
    if first or accuracy_m > SOFT_ACCURACY_M:
        return True
    return int(hashlib.sha256(proof_id.encode()).hexdigest(), 16) % REVIEW_ONE_IN == 0


def submit(tree_id, query, body):
    meta = tree_or_404(tree_id)
    key = body.get("key")
    if not isinstance(key, str) or not key.startswith(f"proofs/{tree_id}/"):
        raise BadRequest("bad_key", "That upload does not belong to this sapling.")
    lat = number(body.get("lat"), "lat", -90, 90, optional=True)
    lng = number(body.get("lng"), "lng", -180, 180, optional=True)
    accuracy = number(body.get("accuracyM"), "accuracyM", 0, 100000, optional=True)
    sender = handle_of(body["handle"]) if body.get("handle") else (meta.get("adopter") or {}).get("handle")

    received = now_iso()
    today = weather.today_ist().isoformat()
    proof_id = uuid.uuid4().hex[:12]
    data = read_photo(key)
    digest = hashlib.sha256(data).hexdigest()

    reasons = []
    cover_for = None
    if not meta.get("adopter"):
        reasons.append("This sapling has no adopter yet. Adopt it first.")
    elif sender != meta["adopter"]["handle"]:
        cover = store.get_item(f"TREE#{tree_id}", f"COVER#{today}#{sender}")
        if cover and cover.get("status") == "accepted":
            cover_for = tree_id
        else:
            reasons.append("Only this sapling's adopter, or a buddy who agreed to cover today, can send its proof.")

    distance = None
    if lat is not None and lng is not None:
        distance = round(distance_m(lat, lng, meta["location"]["lat"], meta["location"]["lng"]), 1)
    problem = position_problem(distance, accuracy)
    if problem:
        reasons.append(problem)

    # Only an accepted proof claims its image, so a photo refused for a vague fix can be sent again.
    reused = store.get_item(f"HASH#{digest}") is not None
    if not reused and not reasons:
        reused = not store.put_item(f"HASH#{digest}", "META", {"treeId": tree_id, "proofId": proof_id, "at": received}, only_if_new=True)
    if reused:
        reasons.append("This exact photo was sent before. Take a new one.")

    verdict = "rejected" if reasons else "accepted"
    review = "none"
    if verdict == "accepted":
        first = not any(views.counts(p) for p in store.proofs(tree_id))
        if needs_review(proof_id, first, accuracy):
            review = "pending"

    record = {
        "proofId": proof_id, "treeId": tree_id, "driveId": meta["driveId"], "key": key, "sha256": digest,
        "verdict": verdict, "review": review, "reasons": reasons, "by": sender, "coverFor": cover_for,
        "distanceM": distance, "accuracyM": accuracy, "lat": lat, "lng": lng,
        "takenAt": body.get("takenAt") if isinstance(body.get("takenAt"), str) else None,
        "receivedAt": received, "votes": [],
    }
    store.put_proof(tree_id, received, record)
    store.put_item(f"PROOF#{proof_id}", "META", {"treeId": tree_id, "receivedAt": received})
    if review == "pending":
        store.put_item(f"REVIEWQ#{meta['driveId']}", proof_id, {"treeId": tree_id, "receivedAt": received})
    if cover_for:
        store.put_item(f"TREE#{tree_id}", f"COVER#{today}#{sender}", {**cover, "status": "done"})

    tree, _, _ = views.tree_view(meta, store.proofs(tree_id), weather.today_ist(), False)
    return {
        "verdict": verdict, "proofId": proof_id, "review": review,
        "sameTree": None,            # the AI hint; null until a model can look
        "reusedPhoto": reused, "accuracyM": accuracy, "coverFor": cover_for,
        "basinWet": None, "leaves": "unclear",
        "reasons": reasons, "distanceM": distance, "receivedAt": received, "tree": tree,
    }


# ---- review queue ----------------------------------------------------------

def _load(proof_id: str):
    if not isinstance(proof_id, str) or not proof_id.isalnum() or len(proof_id) > 32:
        raise BadRequest("bad_proof_id", "That is not a valid proof id.")
    ref = store.get_item(f"PROOF#{proof_id}")
    proof = store.get_item(f"TREE#{ref['treeId']}", f"PROOF#{ref['receivedAt']}") if ref else None
    if not proof:
        raise BadRequest("proof_not_found", "No such proof.", 404)
    return proof


def _review_card(proof: dict, tree: dict) -> dict:
    return {
        "proofId": proof["proofId"], "treeId": tree["id"], "treeName": tree["name"],
        "proofPhotoUrl": views.signed_get(proof["key"]),
        "referencePhotoUrl": views.signed_get(tree.get("referencePhotoKey")),
        "takenAt": proof["receivedAt"], "distanceM": proof.get("distanceM"), "accuracyM": proof.get("accuracyM"),
    }


def _pending(drive_id: str) -> list[tuple[dict, dict]]:
    out = []
    for q in store.query(f"REVIEWQ#{drive_id}"):
        proof = store.get_item(f"TREE#{q['treeId']}", f"PROOF#{q['receivedAt']}")
        tree = store.get_tree(q["treeId"])
        if proof and tree and proof.get("review") == "pending":
            out.append((proof, tree))
    return sorted(out, key=lambda pt: pt[0]["receivedAt"])


def _buddy_tree(handle: str, near: dict, drive: dict):
    """The tree `handle` adopted in this drive, if it stands within buddy range of `near`."""
    for t in store.get_trees(drive["treeIds"]):
        if (t.get("adopter") or {}).get("handle") == handle and t["id"] != near["id"]:
            d = distance_m(t["location"]["lat"], t["location"]["lng"], near["location"]["lat"], near["location"]["lng"])
            if d <= BUDDY_RADIUS_M:
                return t
    return None


def drive_reviews(drive_id, query, body):
    """Everything waiting in a drive: the organiser's queue."""
    drive_or_404(drive_id)
    return [_review_card(p, t) for p, t in _pending(drive_id)]


def my_reviews(_id, query, body):
    """Proofs a water buddy can review: nearby trees, never their own proof, not yet voted on."""
    handle = handle_of((query or {}).get("for"), "handle")
    mine = [t for t in store.query(f"ADOPTER#{handle}")]
    out = []
    for drive_id in sorted({m["driveId"] for m in mine}):
        drive = store.get_drive(drive_id)
        for proof, tree in _pending(drive_id):
            if proof.get("by") == handle or any(v["by"] == handle for v in proof.get("votes", [])):
                continue
            if _buddy_tree(handle, tree, drive):
                out.append(_review_card(proof, tree))
    return out


def review(proof_id, query, body):
    verdict = body.get("verdict")
    if verdict not in ("same", "unsure", "different"):
        raise BadRequest("bad_verdict", "verdict must be same, unsure or different.")
    by = body.get("by")
    if by != ORGANISER:
        handle_of(by, "reviewer name")   # "by" is required: a missing name must never count as the organiser
    proof = _load(proof_id)
    tree = store.get_tree(proof["treeId"])
    if proof.get("review") != "pending":
        return {"proofId": proof_id, "review": proof.get("review", "none")}

    if by != ORGANISER:
        if by == proof.get("by"):
            raise BadRequest("own_proof", "You cannot review your own proof.", 403)
        if not _buddy_tree(by, tree, store.get_drive(proof["driveId"])):
            raise BadRequest("not_a_buddy", "Only the organiser or the adopter of a nearby sapling can review this.", 403)

    votes = [v for v in proof.get("votes", []) if v["by"] != by] + [{"by": by, "verdict": verdict, "at": now_iso()}]
    buddy = lambda kind: sum(1 for v in votes if v["verdict"] == kind and v["by"] != ORGANISER)
    organiser = next((v["verdict"] for v in votes if v["by"] == ORGANISER), None)

    state = "pending"
    if organiser == "different" or buddy("different") >= VOTES_TO_DECIDE:
        state = "rejected"
    elif organiser == "same" or buddy("same") >= VOTES_TO_DECIDE:
        state = "confirmed"

    store.update_proof(proof["treeId"], proof["receivedAt"], votes=votes, review=state)
    if state != "pending":
        store.delete_item(f"REVIEWQ#{proof['driveId']}", proof_id)
    return {"proofId": proof_id, "review": state}
