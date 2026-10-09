"""Small helpers shared by the route modules."""
import math
import re
from datetime import date, datetime, timezone

import store
import weather
from errors import BadRequest

TREE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,40}$")
HANDLE = re.compile(r"^[A-Za-z0-9_.-]{2,24}$")
ORGANISER = "organiser"   # until sign-in exists, the organiser's screens send this as their name


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def tree_or_404(tree_id: str) -> dict:
    if not TREE_ID.match(tree_id or ""):
        raise BadRequest("bad_tree_id", "That is not a valid tree id.")
    meta = store.get_tree(tree_id)
    if not meta:
        raise BadRequest("tree_not_found", f"No sapling with the id {tree_id}.", 404)
    return meta


def drive_or_404(drive_id: str) -> dict:
    if not TREE_ID.match(drive_id or ""):
        raise BadRequest("bad_drive_id", "That is not a valid drive id.")
    drive = store.get_drive(drive_id)
    if not drive:
        raise BadRequest("drive_not_found", f"No plantation drive with the id {drive_id}.", 404)
    return drive


def as_of(query: dict) -> tuple[date, bool]:
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


def handle_of(value, what: str = "name") -> str:
    if not isinstance(value, str) or not HANDLE.match(value):
        raise BadRequest("bad_handle", f"A {what} needs 2 to 24 letters, numbers, dots, dashes or underscores.")
    return value


def number(value, name: str, lo: float, hi: float, optional: bool = False):
    if value is None and optional:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not (lo <= value <= hi):
        raise BadRequest("bad_number", f"{name} must be a number between {lo:g} and {hi:g}.")
    return float(value)


def coords(src: dict) -> tuple[float, float]:
    def one(key, lo, hi):
        raw = src.get(key)
        try:
            return number(float(raw), key, lo, hi)
        except (TypeError, ValueError):
            raise BadRequest("bad_position", "lat and lng are needed, as numbers.")
    return one("lat", -90, 90), one("lng", -180, 180)


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres (haversine)."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
