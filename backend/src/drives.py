"""Finding, registering and sharing the care of saplings in a drive."""
import uuid

import proofs
import store
import views
import weather
from common import coords, distance_m, drive_or_404, handle_of, number, tree_or_404
from errors import BadRequest

MAX_NEARBY = 30


def _views(drive: dict, as_of, replay: bool) -> list[tuple[dict, dict]]:
    out = []
    for meta in store.get_trees(drive["treeIds"]):
        tree, _, _ = views.tree_view(meta, store.proofs(meta["id"]), as_of, replay)
        out.append((meta, tree))
    return out


def nearby(drive_id, query, body):
    """Saplings in a drive by distance from the phone: unadopted first, then nearest first."""
    drive = drive_or_404(drive_id)
    lat, lng = coords(query or {})
    out = []
    for meta, tree in _views(drive, weather.today_ist(), False):
        d = distance_m(lat, lng, tree["location"]["lat"], tree["location"]["lng"])
        out.append({**tree, "distanceM": round(d, 1)})
    out.sort(key=lambda t: (t["adopter"] is not None, t["distanceM"]))
    return out[:MAX_NEARBY]


def photo_url(drive_id, query, body):
    drive_or_404(drive_id)
    return proofs.upload_url(f"refs/{drive_id}")


def register(drive_id, query, body):
    """Add a sapling: stand next to it, pin it, take one reference photo. Nothing goes on the tree."""
    drive = drive_or_404(drive_id)
    name = body.get("name")
    species = body.get("species") or "Sapling"
    if not isinstance(name, str) or not (1 <= len(name.strip()) <= 30):
        raise BadRequest("bad_name", "A sapling needs a name of 1 to 30 characters.")
    if not isinstance(species, str) or len(species) > 80:
        raise BadRequest("bad_species", "Species must be 80 characters or fewer.")
    lat = number(body.get("lat"), "lat", -90, 90)
    lng = number(body.get("lng"), "lng", -180, 180)
    accuracy = number(body.get("accuracyM"), "accuracyM", 0, 100000, optional=True)
    basin = number(body.get("basinM2", 0.5), "basinM2", 0.1, 4)
    key = body.get("referencePhotoKey")
    if key is not None:
        if not isinstance(key, str) or not key.startswith(f"refs/{drive_id}/"):
            raise BadRequest("bad_key", "That reference photo does not belong to this drive.")
        proofs.read_photo(key)
    label = body.get("label") if isinstance(body.get("label"), str) and len(body["label"]) <= 80 else drive["name"]
    added_by = handle_of(body["addedBy"]) if body.get("addedBy") else "organiser"

    today = weather.today_ist().isoformat()
    meta = {
        "id": f"{drive_id}-{uuid.uuid4().hex[:6]}",
        "name": name.strip(), "species": species.strip(),
        "plantedOn": body.get("plantedOn") if _is_date(body.get("plantedOn")) else today,
        "driveId": drive_id,
        "location": {"lat": round(lat, 6), "lng": round(lng, 6), "label": label},
        "basinM2": basin, "adopter": None, "adoptedOn": None,
        "registeredOn": today, "registeredAccuracyM": accuracy,
        "soilDry": bool(body.get("soilDry")),
        "referencePhotoKey": key, "addedBy": added_by,
        "profile": None, "example": False,
    }
    store.put_tree(meta)
    store.add_tree_to_drive(drive_id, meta["id"])
    tree, _, _ = views.tree_view(meta, [], weather.today_ist(), False)
    return tree


def _is_date(x) -> bool:
    from datetime import date
    try:
        return isinstance(x, str) and date.fromisoformat(x) <= weather.today_ist()
    except ValueError:
        return False


# ---- water buddies ---------------------------------------------------------

def buddies(tree_id, query, body):
    """Adopters of nearby saplings in the same drive, nearest first."""
    meta = tree_or_404(tree_id)
    drive = store.get_drive(meta["driveId"])
    own = (meta.get("adopter") or {}).get("handle")
    out = {}
    for t in store.get_trees(drive["treeIds"]):
        h = (t.get("adopter") or {}).get("handle")
        if not h or h == own or t["id"] == tree_id:
            continue
        d = distance_m(meta["location"]["lat"], meta["location"]["lng"], t["location"]["lat"], t["location"]["lng"])
        if d <= proofs.BUDDY_RADIUS_M and (h not in out or d < out[h]["distanceM"]):
            out[h] = {"handle": h, "treeId": t["id"], "treeName": t["name"], "distanceM": round(d, 1)}
    return sorted(out.values(), key=lambda b: b["distanceM"])[:10]


def cover(tree_id, query, body):
    """Ask a buddy to water this sapling today."""
    meta = tree_or_404(tree_id)
    if not meta.get("adopter"):
        raise BadRequest("no_adopter", "Only an adopted sapling can ask for cover.", 409)
    to = handle_of(body.get("toHandle"), "buddy name")
    match = next((b for b in buddies(tree_id, None, None) if b["handle"] == to), None)
    if not match:
        raise BadRequest("not_a_buddy", f"{to} has no sapling near this one.", 404)
    today = weather.today_ist().isoformat()
    item = {"id": uuid.uuid4().hex[:12], "treeId": tree_id, "from": meta["adopter"]["handle"], "to": to,
            "date": today, "distanceM": match["distanceM"], "status": "asked"}
    store.put_item(f"TREE#{tree_id}", f"COVER#{today}#{to}", item)
    store.put_item(f"COVER#{item['id']}", "META", {"treeId": tree_id, "sk2": f"COVER#{today}#{to}"})
    return item


def _answer(cover_id: str, status: str):
    if not isinstance(cover_id, str) or not cover_id.isalnum() or len(cover_id) > 32:
        raise BadRequest("bad_cover_id", "That is not a valid cover request.")
    ref = store.get_item(f"COVER#{cover_id}")
    item = store.get_item(f"TREE#{ref['treeId']}", ref["sk2"]) if ref else None
    if not item:
        raise BadRequest("cover_not_found", "No such cover request.", 404)
    if item["status"] == "asked":
        item["status"] = status
        store.put_item(f"TREE#{ref['treeId']}", ref["sk2"], item)
    return {k: item[k] for k in ("id", "treeId", "from", "to", "date", "distanceM", "status")}


def accept(cover_id, query, body):
    return _answer(cover_id, "accepted")


def decline(cover_id, query, body):
    return _answer(cover_id, "declined")
