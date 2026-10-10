"""Neemu as an agent: a Strands agent on Amazon Bedrock that speaks for one sapling.

The agent chooses which tools to call and writes the sentences. It decides nothing
about water: the ask and the litres come back from the water_balance tool, which is
the engine. Before a reply is used, every number in it is checked against what the
tools returned. If a number is not there, the reply is thrown away and the fixed
sentence is used instead.

Models, in order:
  1. Amazon Bedrock (Nova 2 Lite).
  2. A fall-back provider, used only when Bedrock refuses the call and a key for it
     has been put in SSM Parameter Store (/neemu/agent-fallback-key). Same agent,
     same tools, same number check; only the model behind it differs.
The response says which model spoke (spokenWith).

If no model can be reached, AgentUnavailable is raised and the caller falls back to
the template, marking the response spokenBy: "template".
"""
import json
import os
import re
import time

import engine
import speak

MODEL_ID = os.environ.get("AGENT_MODEL", "us.amazon.nova-2-lite-v1:0")
FALLBACK_MODEL_ID = os.environ.get("AGENT_FALLBACK_MODEL", "gemini-2.5-flash")
RETRY_AFTER_SECONDS = 300

_down_until = {"bedrock": 0.0, "fallback": 0.0}
_fallback_key: dict = {}

SYSTEM = """You are {name}, a young {species} sapling at {place}. You are talking to the person who adopted you.

How you work:
- Before you say anything about water, call water_balance. It tells you whether to ask for water and how many litres. You never decide that yourself.
- For a question about tomorrow or the coming days, call get_forecast. For when you were last watered, call last_watering. For today's weather, call get_weather.
- Every number you say must be copied exactly from a tool result. Never estimate, round differently, convert or add numbers.
- If water_balance says ask is "skip" or "none", tell them not to water today.
- If you cannot answer from the tools, say you do not know.

How you speak: first person, warm, a little playful, two short sentences. No emojis.

Reply with JSON only, nothing before or after it:
{{"hi": "<your reply in Hindi, Devanagari script>", "en": "<the same reply in English>"}}"""

_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
_NUMBER = re.compile(r"\d+(?:\.\d+)?")


class AgentUnavailable(Exception):
    """Bedrock could not be called. The caller uses the template."""


class NotGrounded(Exception):
    """The reply contained a number no tool returned, or was not the JSON asked for."""


def _numbers(text: str) -> set[str]:
    return {f"{float(x):g}" for x in _NUMBER.findall(text.translate(_DEVANAGARI_DIGITS))}


def _collect(value, into: set[str]):
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)):
        into.add(f"{float(value):g}")
        into.add(f"{round(float(value), 1):g}")
        into.add(f"{round(float(value)):g}")
    elif isinstance(value, str):
        into |= _numbers(value)
    elif isinstance(value, dict):
        for v in value.values():
            _collect(v, into)
    elif isinstance(value, (list, tuple)):
        for v in value:
            _collect(v, into)


def check_grounded(reply: dict, tool_results: list, meta: dict):
    """Raise NotGrounded unless every number in the reply came from a tool or the tree's own name and place."""
    allowed: set[str] = set()
    _collect(tool_results, allowed)
    _collect([meta.get("name"), meta["location"].get("label"), meta["location"].get("spot")], allowed)
    said = _numbers(reply["hi"]) | _numbers(reply["en"])
    extra = sorted(said - allowed)
    if extra:
        raise NotGrounded(f"said {', '.join(extra)}, which no tool returned")


def parse_reply(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    try:
        reply = json.loads(text[start:end + 1])
        hi, en = reply["hi"].strip(), reply["en"].strip()
    except (ValueError, KeyError, AttributeError, TypeError):
        raise NotGrounded("did not reply in the JSON form asked for")
    if not hi or not en or len(hi) > 600 or len(en) > 600:
        raise NotGrounded("reply was empty or too long")
    return {"hi": hi, "en": en}


def run(meta: dict, states: list, ahead: list, question: str | None = None) -> tuple[str, str, list[dict], str]:
    """Return (Hindi, English, tool steps, model label). Raises AgentUnavailable or NotGrounded."""
    try:
        from botocore.exceptions import BotoCoreError, ClientError
        from strands import Agent, tool
    except ImportError as e:
        raise AgentUnavailable(f"Strands is not installed: {e}")

    s = states[-1]
    steps: list[dict] = []
    results: list = []

    def done(name: str, summary: str, result: dict) -> dict:
        steps.append({"tool": name, "summary": summary, "ok": True})
        results.append(result)
        return result

    @tool
    def get_weather() -> dict:
        """Today's real weather where I stand: max temperature in °C, millimetres of water my soil loses today, millimetres of rain in the last 48 hours."""
        return done("get_weather", speak.steps_for(meta, s)[0]["summary"],
                    {"max_temperature_c": s.tmax_c, "soil_loses_today_mm": round(s.et0_mm, 1), "rain_last_48h_mm": s.rain_48h_mm,
                     "heat_day": s.tmax_c >= engine.HEAT_DAY_C})

    @tool
    def water_balance() -> dict:
        """How much water is in my root zone, whether I should ask for water today, and exactly how many litres. Always call this before talking about water."""
        needs = s.ask == "water" and s.litres_given <= 0
        result = {
            "ask": "none" if s.ask == "water" and not needs else s.ask,
            "litres": s.litres_asked if needs else 0,
            "already_watered_today": s.litres_given > 0,
            "mm_short_of_full": round(s.depletion_due_mm, 1),
            "mm_of_water_left": round(engine.TAW_MM - s.depletion_due_mm, 1),
            "days_i_have_been_asking": s.unanswered_asks,
            "probably_dead": s.dead,
        }
        summary = f"{speak._n(result['mm_of_water_left'])} mm left, {speak._n(result['mm_short_of_full'])} mm short of full"
        if needs:
            summary += f": ask for {speak._n(s.litres_asked)} L"
        return done("water_balance", summary, result)

    @tool
    def get_forecast(days_ahead: int) -> dict:
        """The forecast for a coming day (1 = tomorrow, 2 = the day after): rain, max temperature, and whether I will need water that day."""
        if not 1 <= days_ahead <= len(ahead):
            steps.append({"tool": "get_forecast", "summary": f"No forecast {days_ahead} days ahead", "ok": False})
            return {"error": f"I only have a forecast for the next {len(ahead)} days."}
        n = ahead[days_ahead - 1]
        return done("get_forecast", f"Open-Meteo: {n.day.isoformat()}, {speak._n(n.rain_mm)} mm rain, {speak._n(n.tmax_c)} °C max",
                    {"date": n.day.isoformat(), "rain_mm": n.rain_mm, "max_temperature_c": n.tmax_c,
                     "will_need_water": n.ask == "water", "litres_then": n.litres_asked})

    @tool
    def last_watering() -> dict:
        """When I was last watered and how many days ago."""
        for back, st in enumerate(reversed(states)):
            if st.litres_given > 0:
                return done("last_watering", f"Last watered {back} day(s) ago, {speak._n(st.litres_given)} L",
                            {"days_ago": back, "litres": st.litres_given, "date": st.day.isoformat()})
        return done("last_watering", "No watering on record", {"days_ago": None})

    place = meta["location"].get("spot") or meta["location"]["label"]
    prompt = question or "It is morning. Do your check and tell me what you need today."
    system = SYSTEM.format(name=meta["name"], species=meta["species"], place=place)
    tools = [get_weather, water_balance, get_forecast, last_watering]

    last_error = "no model is configured"
    for provider in ("bedrock", "fallback"):
        if time.time() < _down_until[provider]:
            last_error = f"{provider} was unavailable a moment ago"
            continue
        try:
            model, label = _model(provider)
        except AgentUnavailable as e:
            last_error = str(e)
            continue
        del steps[:], results[:]
        try:
            result = Agent(model=model, tools=tools, system_prompt=system, callback_handler=None)(prompt)
        except (ClientError, BotoCoreError) as e:
            _down_until[provider] = time.time() + RETRY_AFTER_SECONDS
            last_error = f"{provider}: {e}"
            continue
        except Exception as e:            # Strands wraps provider errors in its own types
            if any(k in str(e) for k in _OUTAGE_WORDS):
                _down_until[provider] = time.time() + RETRY_AFTER_SECONDS
                last_error = f"{provider}: {str(e)[:160]}"
                continue
            raise NotGrounded(f"agent run failed on {provider}: {type(e).__name__}: {str(e)[:120]}")

        if not any(st["tool"] == "water_balance" for st in steps) and not question:
            raise NotGrounded("spoke about water without calling water_balance")
        reply = parse_reply(str(result))
        check_grounded(reply, results, meta)
        return reply["hi"], reply["en"], list(steps), label

    raise AgentUnavailable(last_error)


_OUTAGE_WORDS = ("Operation not allowed", "AccessDenied", "Throttling", "Too many tokens", "ValidationException",
                 "API key", "PERMISSION_DENIED", "RESOURCE_EXHAUSTED", "UNAUTHENTICATED", "quota", "429", "503")


def _model(provider: str):
    """-> (Strands model, label shown to the user). Raises AgentUnavailable if it cannot be built."""
    if provider == "bedrock":
        from strands.models import BedrockModel
        return BedrockModel(model_id=MODEL_ID, temperature=0.4, max_tokens=400), f"Amazon Bedrock · {MODEL_ID.split('.', 1)[-1]}"

    key = _fallback_api_key()
    if not key:
        raise AgentUnavailable("no fall-back key in Parameter Store")
    try:
        from strands.models.gemini import GeminiModel
    except ImportError as e:
        raise AgentUnavailable(f"fall-back provider not installed: {e}")
    model = GeminiModel(client_args={"api_key": key}, model_id=FALLBACK_MODEL_ID,
                        params={"temperature": 0.4, "max_output_tokens": 600})
    return model, f"Google Gemini · {FALLBACK_MODEL_ID} (Bedrock not enabled on this account)"


def _fallback_api_key() -> str | None:
    """Read the fall-back key from Parameter Store, at most once every five minutes. Never logged."""
    now = time.time()
    if now - _fallback_key.get("at", 0) < RETRY_AFTER_SECONDS:
        return _fallback_key.get("value")
    value = None
    try:
        import aws
        value = aws.client("ssm").get_parameter(Name="/neemu/agent-fallback-key", WithDecryption=True)["Parameter"]["Value"].strip() or None
    except Exception:
        value = None
    _fallback_key.update(at=now, value=value)
    return value
