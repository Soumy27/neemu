"""The water balance, checked on weather simple enough to work out by hand."""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import engine as e

D0 = date(2026, 10, 1)


def dry(n, et0=5.0, tmax=33.0):
    return [e.Weather(D0 + timedelta(days=i), et0, 0.0, tmax) for i in range(n)]


def never(day, asked):
    return 0.0


def always(day, asked):
    return asked


def test_storage_matches_soil_figures():
    assert e.TAW_MM == 28.0
    assert round(e.RAW_MM, 1) == 9.8


def test_first_dry_day_loses_crop_factor_times_et0():
    s = e.simulate(dry(1), 0.5, never)[0]
    assert s.depletion_start_mm == 4.9          # starts half way to the ask threshold
    assert s.depletion_due_mm == 8.4            # 4.9 + 0.7 * 5.0
    assert s.ask == "none"


def test_asks_once_depletion_passes_threshold_and_litres_are_depth_times_basin():
    s = e.simulate(dry(2), 0.5, never)[1]
    assert s.depletion_due_mm == 11.9           # 8.4 + 3.5
    assert s.ask == "water"
    assert s.litres_asked == 6.0                # 11.9 mm * 0.5 m2 = 5.95 L, rounded up to the half litre


def test_watering_refills_and_the_ask_stops():
    days = e.simulate(dry(4), 0.5, always)
    assert days[1].litres_given == 6.0 and days[1].depletion_end_mm < 0.1
    assert days[2].ask == "none"


def test_depletion_never_passes_wilting_point():
    last = e.simulate(dry(60, et0=9.0), 0.5, never)[-1]
    assert last.depletion_end_mm <= e.TAW_MM


def test_light_rain_does_not_count_but_real_rain_does():
    assert e.effective_rain(1.9) == 0.0
    assert e.effective_rain(2.0) == 2.0


def test_rain_turns_an_ask_into_a_skip_and_counts_litres_saved():
    w = dry(3)
    w[2] = e.Weather(w[2].day, 5.0, 12.0, 30.0)
    s = e.simulate(w, 0.5, never)[2]
    assert s.ask == "skip"
    assert s.litres_saved == 1.8                # min(12 mm rain, 0.7 * 5.0 mm demand) * 0.5 m2 = 1.75 L


def test_unanswered_asks_become_no_proof_then_the_tree_dies():
    days = e.simulate(dry(40, et0=8.0), 0.5, never)
    third_ask = next(d for d in days if d.unanswered_asks == e.NO_PROOF_AFTER_DAYS)
    assert e.status_of(third_ask) == "no_proof"
    assert e.status_of(days[-1]) == "likely_dead" and days[-1].health == 0.0


def test_health_falls_every_day_an_ask_goes_unanswered():
    days = e.simulate(dry(12), 0.5, never)
    asking = [d for d in days if d.unanswered_asks > 0]
    assert all(b.health < a.health for a, b in zip(asking, asking[1:]))
    assert asking[5].health < 90        # six days of asking is visibly worse than healthy


def test_cared_for_tree_stays_healthy_and_keeps_its_streak():
    days = e.simulate(dry(30), 0.5, always, streak_from=D0)
    assert e.status_of(days[-1]) == "fine"
    assert days[-1].health == 100.0
    assert days[-1].streak_days == 30


def test_a_missed_ask_breaks_the_streak():
    days = e.simulate(dry(6), 0.5, never, streak_from=D0)
    assert days[0].streak_days == 1 and days[-1].streak_days == 0


def test_heat_day_is_forty_degrees_or_more():
    hot = e.simulate(dry(1, tmax=40.0), 0.5, never)[0]
    mild = e.simulate(dry(1, tmax=39.9), 0.5, never)[0]
    assert e.heat_day(hot)["tMaxC"] == 40.0 and e.heat_day(mild) is None
