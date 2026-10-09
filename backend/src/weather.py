"""Real daily weather for a tree's location, from Open-Meteo (free, no key).

Recent days come from the forecast endpoint, older replays from the archive.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

from engine import Weather
from errors import SourceError

WARMUP_DAYS = 45   # the balance needs a run-up; with 28 mm of storage, 45 days is ample
LOOKAHEAD_DAYS = 2
DAILY = "et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max"
IST = timezone(timedelta(hours=5, minutes=30))

_cache: dict = {}
_CACHE_SECONDS = 1800


def today_ist() -> date:
    return datetime.now(IST).date()


def _get(url: str) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return json.load(r)
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise SourceError("open-meteo", "weather_unavailable", f"Could not read the weather from Open-Meteo: {e}")


def daily(lat: float, lng: float, as_of: date) -> list[Weather]:
    """Days from as_of - WARMUP_DAYS to as_of + LOOKAHEAD_DAYS, oldest first, gaps dropped."""
    key = (round(lat, 2), round(lng, 2), as_of, today_ist())
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < _CACHE_SECONDS:
        return hit[1]

    start, end = as_of - timedelta(days=WARMUP_DAYS), as_of + timedelta(days=LOOKAHEAD_DAYS)
    q = {"latitude": key[0], "longitude": key[1], "daily": DAILY, "timezone": "Asia/Kolkata"}
    if as_of >= today_ist() - timedelta(days=10):
        q.update({"past_days": WARMUP_DAYS + 12, "forecast_days": LOOKAHEAD_DAYS + 1})
        url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(q)
    else:
        q.update({"start_date": start.isoformat(), "end_date": end.isoformat()})
        url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(q)

    d = _get(url).get("daily")
    if not d:
        raise SourceError("open-meteo", "weather_empty", "Open-Meteo returned no daily data for this place and date.")

    days = []
    for t, et0, rain, tmax in zip(d["time"], d["et0_fao_evapotranspiration"], d["precipitation_sum"], d["temperature_2m_max"]):
        day = date.fromisoformat(t)
        if et0 is None or rain is None or tmax is None or not (start <= day <= end):
            continue
        days.append(Weather(day, float(et0), float(rain), float(tmax)))

    if not any(w.day == as_of for w in days):
        raise SourceError("open-meteo", "weather_no_day", f"Open-Meteo has no data for {as_of.isoformat()} at this place.")
    _cache[key] = (time.time(), days)
    return days
