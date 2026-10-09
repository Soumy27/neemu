"""Neemu's water balance: how dry a sapling's root zone is, day by day, from real weather.

This is the FAO-56 daily soil water balance (Allen et al., 1998, ch. 8) with one soil
layer and no runoff or capillary rise. Depletion D is how many millimetres of water the
root zone is short of full. Each day:

    D_end = D_start + Ks * Kc * ET0  -  effective rain  -  watering

and D is held between 0 (full; extra water drains away) and TAW (wilting point).
1 mm over 1 m2 is 1 litre, so depletion times basin area is the litres to pour.

Everything a person sees (the ask, the litres, health, status, streak) is computed here.
The model that gives Neemu its voice never produces a number.

The soil and sapling values below are textbook figures for a first-year sapling in loam.
They are approximate and are stated as such wherever the result is shown.
"""
from dataclasses import dataclass
from datetime import date
from math import ceil
from typing import Callable, Optional

ROOT_DEPTH_M = 0.20        # first-year sapling
FIELD_CAPACITY = 0.28      # loam, m3 of water per m3 of soil
WILTING_POINT = 0.14
CROP_FACTOR = 0.7          # Kc: young tree in a mostly bare basin
DEPLETION_FRACTION = 0.35  # p: share of available water a sapling can lose before stress
MIN_EFFECTIVE_RAIN_MM = 2.0  # lighter showers wet the surface and evaporate

TAW_MM = 1000 * (FIELD_CAPACITY - WILTING_POINT) * ROOT_DEPTH_M  # total available water: 28 mm
RAW_MM = DEPLETION_FRACTION * TAW_MM                             # readily available: 9.8 mm

HEAT_DAY_C = 40.0          # IMD's plains threshold. A "heat day", not a declared heatwave.

START_HEALTH = 70.0
HEALTH_GAIN = 3.0          # per day with no stress
HEALTH_LOSS = 15.0         # per day at full stress, before the gain
DEAD_HEALTH = 5.0
DEAD_AFTER_DAYS = 7        # this many days in a row at or below DEAD_HEALTH
NO_PROOF_AFTER_DAYS = 3    # asks in a row with no accepted proof


@dataclass(frozen=True)
class Weather:
    day: date
    et0_mm: float
    rain_mm: float
    tmax_c: float


@dataclass(frozen=True)
class DayState:
    day: date
    et0_mm: float
    rain_mm: float
    tmax_c: float
    rain_48h_mm: float        # effective rain today and yesterday
    depletion_start_mm: float
    depletion_due_mm: float   # where depletion is heading by evening if nobody waters
    ask: str                  # "water" | "skip" | "none"
    litres_asked: float
    litres_given: float
    depletion_end_mm: float
    health: float
    unanswered_asks: int      # asks in a row, up to and including today, with no watering
    streak_days: int
    litres_saved: float       # running total
    dead: bool


def effective_rain(rain_mm: float) -> float:
    return rain_mm if rain_mm >= MIN_EFFECTIVE_RAIN_MM else 0.0


def stress_factor(depletion_mm: float) -> float:
    """Ks: 1 while water is readily available, falling to 0 at wilting point."""
    if depletion_mm <= RAW_MM:
        return 1.0
    return max(0.0, (TAW_MM - depletion_mm) / (TAW_MM - RAW_MM))


def litres_for(depletion_mm: float, basin_m2: float) -> float:
    """Litres to refill the root zone, rounded up to the next half litre."""
    return ceil(depletion_mm * basin_m2 * 2) / 2


def simulate(
    weather: list[Weather],
    basin_m2: float,
    watered: Callable[[date, float], float],
    streak_from: Optional[date] = None,
) -> list[DayState]:
    """Run the balance over consecutive days.

    watered(day, litres_asked) returns the litres actually poured that day (0 if none).
    streak_from is the first day that counts towards the streak (the adoption day).
    """
    depletion = RAW_MM / 2
    health = START_HEALTH
    unanswered = 0
    streak = 0
    saved = 0.0
    low_days = 0
    dead = False
    prev_rain = 0.0
    out = []

    for w in weather:
        rain = effective_rain(w.rain_mm)
        rain_48h = rain + prev_rain
        demand = stress_factor(depletion) * CROP_FACTOR * w.et0_mm
        due = min(TAW_MM, max(0.0, depletion + demand - rain))

        if due >= RAW_MM:
            ask, asked = "water", litres_for(due, basin_m2)
        elif rain_48h > 0 and due + rain_48h >= RAW_MM:
            ask, asked = "skip", 0.0      # rain is the reason it does not need water
        else:
            ask, asked = "none", 0.0

        given = max(0.0, watered(w.day, asked))
        end = min(TAW_MM, max(0.0, due - given / basin_m2))

        if ask == "skip":
            saved += min(rain_48h, CROP_FACTOR * w.et0_mm) * basin_m2

        unanswered = unanswered + 1 if ask == "water" and given <= 0 else 0

        counts = streak_from is not None and w.day >= streak_from
        if ask == "water" and given <= 0:
            streak = 0
        elif counts:
            streak += 1

        stress = 1.0 - stress_factor(end)
        health = min(100.0, max(0.0, health + HEALTH_GAIN - HEALTH_LOSS * stress))
        low_days = low_days + 1 if health <= DEAD_HEALTH else 0
        dead = dead or low_days >= DEAD_AFTER_DAYS
        if dead:
            health = 0.0

        out.append(DayState(
            day=w.day, et0_mm=w.et0_mm, rain_mm=w.rain_mm, tmax_c=w.tmax_c,
            rain_48h_mm=round(rain_48h, 1),
            depletion_start_mm=round(depletion, 2), depletion_due_mm=round(due, 2),
            ask=ask, litres_asked=asked, litres_given=given,
            depletion_end_mm=round(end, 2), health=round(health, 1),
            unanswered_asks=unanswered, streak_days=streak,
            litres_saved=round(saved, 1), dead=dead,
        ))
        depletion = end
        prev_rain = rain

    return out


def status_of(s: DayState) -> str:
    if s.dead:
        return "likely_dead"
    if s.unanswered_asks >= NO_PROOF_AFTER_DAYS:
        return "no_proof"
    if s.ask == "water" and s.litres_given <= 0:
        return "thirsty"
    return "fine"


def growth_stage(planted: date, today: date, health: float) -> int:
    age = (today - planted).days
    stage = 1 if age < 60 else 2 if age < 180 else 3 if age < 365 else 4 if age < 730 else 5
    return max(1, stage - 1) if health < 40 else stage


def heat_day(s: DayState) -> Optional[dict]:
    if s.tmax_c >= HEAT_DAY_C:
        return {"active": True, "tMaxC": s.tmax_c, "date": s.day.isoformat()}
    return None
