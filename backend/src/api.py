"""HTTP API for Neemu. Shapes follow docs/api-contract.md.

One Lambda behind an API Gateway HTTP API. Every number in a response comes from
engine.py; nothing here asks a model for a figure.
"""
import json

import drives
import engine
import proofs
import speak
import store
import views
import weather
from common import as_of as _as_of, drive_or_404, handle_of, now_iso, tree_or_404 as _tree_or_404
from errors import BadRequest, SourceError


# ---- trees ---------------------------------------------------------------

def get_tree(tree_id, query, body):
    meta = _tree_or_404(tree_id)
    as_of, replay = _as_of(query)
    tree, _, _ = views.tree_view(meta, store.proofs(tree_id), as_of, replay)
    return tree


def adopt(tree_id, query, body):
    meta = _tree_or_404(tree_id)
    handle = handle_of((body or {}).get("handle"))
    if meta.get("adopter") and meta["adopter"]["handle"] != handle:
        raise BadRequest("already_adopted", f"{meta['name']} already has an adopter.", 409)
    if not meta.get("adoptedOn"):
        store.update_tree(tree_id, adopter={"handle": handle}, adoptedOn=weather.today_ist().isoformat())
        store.put_item(f"ADOPTER#{handle}", tree_id, {"driveId": meta["driveId"]})
        meta = store.get_tree(tree_id)
    tree, _, _ = views.tree_view(meta, store.proofs(tree_id), weather.today_ist(), False)
    return tree


def says_for(meta: dict, as_of, replay: bool, audio: bool = True) -> dict:
    tree, states, ahead = views.tree_view(meta, store.proofs(meta["id"]), as_of, replay)
    s = states[-1]
    text_hi, text_en = speak.template(meta, s, views.days_until_next_ask(ahead))
    needs = s.ask == "water" and s.litres_given <= 0
    return {
        "ask": s.ask if (s.ask != "water" or needs) else "none",
        "heatwave": engine.heat_day(s),
        "spokenBy": "template",
        "asOf": as_of.isoformat(),
        "replay": replay,
        "litres": s.litres_asked if needs else 0,
        "textHi": text_hi,
        "textEn": text_en,
        "audioUrl": speak.audio_url(text_hi) if audio else None,
        "facts": speak.facts_for(meta, s),
        "steps": speak.steps_for(meta, s),
    }


def today(tree_id, query, body):
    meta = _tree_or_404(tree_id)
    as_of, replay = _as_of(query)
    return says_for(meta, as_of, replay)


TOMORROW = ("tomorrow", "kal", "कल")
WHY = ("why", "kyun", "kyon", "क्यों", "क्यूँ")


def talk(tree_id, query, body):
    """Answer a question. Until the agent can run, three fixed kinds of answer, all from the engine."""
    meta = _tree_or_404(tree_id)
    text = body.get("text")
    if not isinstance(text, str) or not (1 <= len(text.strip()) <= 300):
        raise BadRequest("bad_text", "Ask Neemu something in 1 to 300 characters.")
    as_of, replay = _as_of(query)
    says = says_for(meta, as_of, replay, audio=False)
    t = text.lower()
    _, states, ahead = views.tree_view(meta, store.proofs(tree_id), as_of, replay)
    if any(k in t for k in TOMORROW) and ahead:
        n = ahead[0]
        rain, tmax = speak._n(n.rain_mm), speak._n(n.tmax_c)
        need_hi = f"कल मुझे {speak._n(n.litres_asked)} लीटर पानी चाहिए होगा।" if n.ask == "water" else "कल पानी की ज़रूरत नहीं पड़ेगी।"
        need_en = f"I'll need {speak._n(n.litres_asked)} litres tomorrow." if n.ask == "water" else "I won't need water tomorrow."
        says["textHi"] = f"कल {tmax} डिग्री तक जाएगा और {rain} मिलीमीटर बारिश का अनुमान है। {need_hi}"
        says["textEn"] = f"Tomorrow goes up to {tmax} °C with {rain} mm of rain forecast. {need_en}"
        says["steps"] = [{"tool": "get_forecast", "ok": True,
                          "summary": f"Open-Meteo: {n.day.isoformat()}, {rain} mm rain, {tmax} °C max"}]
    elif any(k in t for k in WHY):
        s = states[-1]
        says["textHi"] = (f"आज मेरी मिट्टी {speak._n(round(s.et0_mm, 1))} मिलीमीटर पानी खोएगी और पिछले दो दिन में "
                          f"{speak._n(s.rain_48h_mm)} मिलीमीटर बारिश हुई। मेरी जड़ों के पास {speak._n(round(s.depletion_due_mm, 1))} मिलीमीटर पानी कम है।")
        says["textEn"] = (f"My soil loses {speak._n(round(s.et0_mm, 1))} mm today and {speak._n(s.rain_48h_mm)} mm of rain fell in the "
                          f"last two days. My roots are {speak._n(round(s.depletion_due_mm, 1))} mm short of full.")
    says["audioUrl"] = speak.audio_url(says["textHi"])
    return says


# ---- drives --------------------------------------------------------------

def get_drive(drive_id, query, body):
    drive = drive_or_404(drive_id)
    as_of, replay = _as_of(query)
    trees = []
    for meta in store.get_trees(drive["treeIds"]):
        tree_proofs = store.proofs(meta["id"])
        tree, _, _ = views.tree_view(meta, tree_proofs, as_of, replay)
        good = sorted((p for p in tree_proofs if views.counts(p)), key=lambda p: p["receivedAt"])
        tree["lastRemindedAt"] = meta.get("lastRemindedAt")
        tree["lastProof"] = {"at": good[-1]["receivedAt"], "photoUrl": views.signed_get(good[-1]["key"])} if good and not replay else None
        trees.append(tree)
    counts = {k: 0 for k in ("fine", "thirsty", "no_proof", "likely_dead")}
    for t in trees:
        counts[t["status"]] += 1
    return {"id": drive["id"], "name": drive["name"], "organiser": drive["organiser"],
            "asOf": as_of.isoformat(), "replay": replay, "trees": trees, "counts": counts}


def remind(drive_id, query, body):
    status = (body or {}).get("status")
    if status not in ("thirsty", "no_proof"):
        raise BadRequest("bad_status", "Reminders go to saplings that are thirsty or have no proof.")
    drive = get_drive(drive_id, None, None)
    stamp = now_iso()
    reminded = 0
    for t in drive["trees"]:
        if t["status"] == status and t["adopter"]:
            store.update_tree(t["id"], lastRemindedAt=stamp)
            reminded += 1
    return {"reminded": reminded, "at": stamp}


# ---- router --------------------------------------------------------------

ROUTES = {
    "GET /trees/{id}": get_tree,
    "POST /trees/{id}/adopt": adopt,
    "GET /trees/{id}/today": today,
    "POST /trees/{id}/talk": talk,
    "POST /trees/{id}/proof-url": proofs.proof_url,
    "POST /trees/{id}/proof": proofs.submit,
    "GET /trees/{id}/buddies": drives.buddies,
    "POST /trees/{id}/cover": drives.cover,
    "POST /covers/{id}/accept": drives.accept,
    "POST /covers/{id}/decline": drives.decline,
    "GET /drives/{id}": get_drive,
    "POST /drives/{id}/remind": remind,
    "GET /drives/{id}/nearby": drives.nearby,
    "POST /drives/{id}/photo-url": drives.photo_url,
    "POST /drives/{id}/trees": drives.register,
    "GET /drives/{id}/reviews": proofs.drive_reviews,
    "GET /reviews": proofs.my_reviews,
    "POST /proofs/{id}/review": proofs.review,
}


def _reply(status: int, body: dict) -> dict:
    return {"statusCode": status, "headers": {"content-type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


def handler(event, context):
    route = event.get("routeKey", "")
    fn = ROUTES.get(route)
    try:
        if not fn:
            raise BadRequest("not_found", "No such route.", 404)
        raw = event.get("body") or ""
        if len(raw) > 20_000:
            raise BadRequest("too_large", "Request body is too large.", 413)
        try:
            body = json.loads(raw) if raw else {}
        except ValueError:
            raise BadRequest("bad_json", "Request body is not valid JSON.")
        if not isinstance(body, dict):
            raise BadRequest("bad_json", "Request body must be a JSON object.")
        result = fn((event.get("pathParameters") or {}).get("id", ""), event.get("queryStringParameters") or {}, body)
        return _reply(200, result)
    except SourceError as e:
        return _reply(e.status, {"error": {"code": e.code, "message": e.message, "source": e.source}})
    except Exception as e:  # last resort: still name a source, never leak a stack trace
        print(f"UNHANDLED {route}: {type(e).__name__}: {e}")
        return _reply(500, {"error": {"code": "internal", "message": "Something went wrong on our side.", "source": "api"}})
