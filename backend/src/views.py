"""Turn a stored sapling plus real weather into the shapes in docs/api-contract.md."""
from datetime import date, datetime, timedelta

import engine
import weather
from weather import IST


def _ist_day(iso: str) -> date:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(IST).date()


def run_balance(meta: dict, proofs: list[dict], as_of: date, replay: bool):
    """Return (states up to as_of, forecast states after it, planted date used)."""
    days = weather.daily(meta["location"]["lat"], meta["location"]["lng"], as_of)

    planted = date.fromisoformat(meta["plantedOn"])
    while planted > as_of:              # a replay of a day before planting: treat it as a year-old sapling
        planted = planted.replace(year=planted.year - 1)

    adopted = date.fromisoformat(meta["adoptedOn"]) if meta.get("adoptedOn") and not replay else None
    real = {} if replay else {_ist_day(p["receivedAt"]) for p in proofs if p.get("verdict") == "accepted"}
    profile = meta.get("profile") or {"delay": 0, "stopped": 9999}
    anchor = adopted or as_of           # example care stops where a real adopter takes over
    stopped = profile["stopped"]
    quiet_from = anchor - timedelta(days=stopped) if stopped is not None else anchor

    waiting = {"n": 0}

    def watered(day: date, asked: float) -> float:
        if day in real:
            waiting["n"] = 0
            return asked if asked > 0 else 2.0
        if asked <= 0:
            waiting["n"] = 0
            return 0.0
        example_day = day < anchor and day < quiet_from
        if example_day and waiting["n"] >= profile["delay"]:
            waiting["n"] = 0
            return asked
        waiting["n"] += 1
        return 0.0

    streak_from = adopted or (days[0].day if meta.get("adopter") else None)
    states = engine.simulate(days, meta["basinM2"], watered, streak_from)
    upto = [s for s in states if s.day <= as_of]
    ahead = [s for s in states if s.day > as_of]
    return upto, ahead, planted


def last_watered(states, proofs: list[dict], replay: bool):
    """Time of the last watering: a real proof if there is one, else the example history."""
    if not replay:
        real = sorted(p["receivedAt"] for p in proofs if p.get("verdict") == "accepted")
        if real:
            return real[-1]
    for s in reversed(states):
        if s.litres_given > 0:
            return f"{s.day.isoformat()}T12:30:00Z"   # 6 PM IST, the hour Neemu asks for
    return None


def tree_view(meta: dict, proofs: list[dict], as_of: date, replay: bool):
    states, ahead, planted = run_balance(meta, proofs, as_of, replay)
    s = states[-1]
    needs = s.ask == "water" and s.litres_given <= 0
    tree = {
        "id": meta["id"],
        "name": meta["name"],
        "species": meta["species"],
        "plantedOn": planted.isoformat(),
        "driveId": meta["driveId"],
        "location": {k: meta["location"][k] for k in ("lat", "lng", "label")},
        "basinM2": meta["basinM2"],
        "adopter": meta.get("adopter"),
        "status": engine.status_of(s),
        "health": round(s.health),
        "growthStage": engine.growth_stage(planted, as_of, s.health),
        "streakDays": s.streak_days,
        "litresSaved": s.litres_saved,
        "water": {
            "soilWaterMm": round(engine.TAW_MM - s.depletion_end_mm, 1),
            "deficitMm": round(s.depletion_end_mm, 1),
            "litresNeeded": s.litres_asked if needs else 0,
            "lastWateredAt": last_watered(states, proofs, replay),
            "rainLast48hMm": s.rain_48h_mm,
            "et0TodayMm": s.et0_mm,
            "tMaxTodayC": s.tmax_c,
        },
    }
    return tree, states, ahead


def days_until_next_ask(ahead) -> int | None:
    for i, s in enumerate(ahead, start=1):
        if s.ask == "water":
            return i
    return None
