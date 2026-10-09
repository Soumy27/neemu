"""The check that stops the agent saying a number no tool gave it."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import agent

META = {"name": "Neemu", "location": {"label": "DTU, Gate 3, Delhi", "spot": "Gate 3"}}
TOOLS = [{"ask": "water", "litres": 8.0, "mm_short_of_full": 15.4, "days_i_have_been_asking": 4},
         {"max_temperature_c": 32.3, "soil_loses_today_mm": 3.5, "rain_last_48h_mm": 3.0}]


def test_reply_using_only_tool_numbers_passes():
    agent.check_grounded({"hi": "आज शाम 8 लीटर पानी दोगे? 4 दिन से माँग रहा हूँ।", "en": "Could I have 8 litres this evening? I've asked for 4 days."}, TOOLS, META)


def test_devanagari_digits_are_read_as_numbers():
    agent.check_grounded({"hi": "मुझे ८ लीटर पानी चाहिए।", "en": "I need 8 litres."}, TOOLS, META)
    with pytest.raises(agent.NotGrounded):
        agent.check_grounded({"hi": "मुझे १२ लीटर पानी चाहिए।", "en": "I need 8 litres."}, TOOLS, META)


def test_an_invented_number_is_rejected():
    with pytest.raises(agent.NotGrounded, match="10"):
        agent.check_grounded({"hi": "8 लीटर", "en": "Give me 10 litres, it's 32.3 degrees."}, TOOLS, META)


def test_the_gate_number_in_the_trees_own_address_is_allowed():
    agent.check_grounded({"hi": "मैं गेट 3 वाला नीमू हूँ।", "en": "I'm Neemu from Gate 3."}, TOOLS, META)


def test_rounded_forms_of_a_tool_number_are_allowed():
    agent.check_grounded({"hi": "32 डिग्री", "en": "It is 32 degrees and I am 15.4 mm short."}, TOOLS, META)


def test_reply_must_be_the_json_asked_for():
    assert agent.parse_reply('Sure! {"hi": "नमस्ते", "en": "Hello"} ') == {"hi": "नमस्ते", "en": "Hello"}
    for bad in ("Hello there", '{"hi": "नमस्ते"}', '{"hi": "", "en": "x"}'):
        with pytest.raises(agent.NotGrounded):
            agent.parse_reply(bad)
