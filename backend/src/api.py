"""HTTP API for Neemu. Shapes follow docs/api-contract.md.

One Lambda behind an API Gateway HTTP API. Every number in a response comes from
engine.py; nothing here asks a model for a figure.
"""
import json
import os
import re
import uuid
from datetime import date, datetime, timezone

import aws
import engine
import speak
import store
import views
import weather
from errors import BadRequest, SourceError

TREE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,40}$")
HANDLE = re.compile(r"^[A-Za-z0-9_.-]{2,24}$")
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _tree_or_404(tree_id: str) -> dict:
    if not TREE_ID.match(tree_id or ""):
        raise BadRequest("bad_tree_id", "That is not a valid tree id.")
    meta = store.get_tree(tree_id)
    if not meta:
        raise BadRequest("tree_not_found", f"No sapling with the id {tree_id}.", 404)
    return meta


def _as_of(query: dict) -> tuple[date, bool]:
    raw = (query or {}).get("date")
    if not raw:
        return weather.today_ist(), False
    try:
        day = date.fromisoformat(raw)
    except ValueError:
        raise BadRequest("bad_date", "date must look like 2026-05-19.")
    if day > weather.today_ist():
        raise BadRequest("future_date", "A replay date cannot be in the future.")
    if day < date(2022, 1, 1):
        raise BadRequest("old_date", "Replays go back to 2022.")
    return day, day != weather.today_ist()


def _public(tree: dict) -> dict:
    return tree


# ---- trees ---------------------------------------------------------------

def get_tree(tree_id, query, body):
    meta = _tree_or_404(tree_id)
    as_of, replay = _as_of(query)
    tree, _, _ = views.tree_view(meta, store.proofs(tree_id), as_of, replay)
    return _public(tree)


def adopt(tree_id, query, body):
    meta = _tree_or_404(tree_id)
    handle = (body or {}).get("handle", "")
    if not isinstance(handle, str) or not HANDLE.match(handle):
        raise BadRequest("bad_handle", "A name needs 2 to 24 letters, numbers, dots, dashes or underscores.")
    if meta.get("adopter") and meta["adopter"]["handle"] != handle:
        raise BadRequest("already_adopted", f"{meta['name']} already has an adopter.", 409)
    if not meta.get("adoptedOn"):
        store.update_tree(tree_id, adopter={"handle": handle}, adoptedOn=weather.today_ist().isoformat())
        meta = store.get_tree(tree_id)
    tree, _, _ = views.tree_view(meta, store.proofs(tree_id), weather.today_ist(), False)
    return _public(tree)


def says_for(meta: dict, as_of: date, replay: bool) -> dict:
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
        "audioUrl": speak.audio_url(text_hi),
        "facts": speak.facts_for(meta, s),
        "steps": speak.steps_for(meta, s),
    }


def today(tree_id, query, body):
    meta = _tree_or_404(tree_id)
    as_of, replay = _as_of(query)
    return says_for(meta, as_of, replay)


# ---- drives --------------------------------------------------------------

def get_drive(drive_id, query, body):
    drive = store.get_drive(drive_id)
    if not drive:
        raise BadRequest("drive_not_found", f"No plantation drive with the id {drive_id}.", 404)
    as_of, replay = _as_of(query)
    metas = store.get_trees(drive["treeIds"])
    trees = []
    for meta in metas:
        tree, _, _ = views.tree_view(meta, store.proofs(meta["id"]), as_of, replay)
        tree["lastRemindedAt"] = meta.get("lastRemindedAt")
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
    "GET /drives/{id}": get_drive,
    "POST /drives/{id}/remind": remind,
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
