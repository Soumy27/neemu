"""What Neemu says, and its voice.

The numbers and the decision come from the engine. This module only turns them into
sentences. These fixed templates are used whenever the agent cannot run, and the
response says so (spokenBy: "template").
"""
import hashlib
import os

from botocore.exceptions import BotoCoreError, ClientError

import aws
import engine

VOICE_ID = "Kajal"   # Polly neural voice that speaks Hindi


def _n(x: float) -> str:
    """12.0 -> '12', 6.5 -> '6.5'."""
    return f"{x:g}"


def facts_for(tree: dict, s: engine.DayState) -> list[dict]:
    return [
        {"label": "Max temperature today", "value": f"{_n(s.tmax_c)} °C"},
        {"label": "Water the soil loses today", "value": f"{_n(s.et0_mm)} mm"},
        {"label": "Rain in the last 48 h", "value": f"{_n(s.rain_48h_mm)} mm"},
        {"label": "Short of full", "value": f"{_n(round(s.depletion_due_mm, 1))} mm"},
        {"label": "Basin", "value": f"{_n(tree['basinM2'])} m²"},
    ]


def steps_for(tree: dict, s: engine.DayState) -> list[dict]:
    steps = [
        {"tool": "get_weather", "ok": True,
         "summary": f"Open-Meteo: {_n(s.tmax_c)} °C, {_n(s.et0_mm)} mm lost, {_n(s.rain_48h_mm)} mm rain in 48 h"},
        {"tool": "water_balance", "ok": True,
         "summary": f"{_n(round(engine.TAW_MM - s.depletion_due_mm, 1))} mm left, {_n(round(s.depletion_due_mm, 1))} mm short of full"},
    ]
    if s.ask == "water":
        steps.append({"tool": "litres_needed", "ok": True,
                      "summary": f"{_n(round(s.depletion_due_mm, 1))} mm × {_n(tree['basinM2'])} m² ≈ {_n(s.litres_asked)} L"})
    if s.tmax_c >= engine.HEAT_DAY_C:
        steps.append({"tool": "heat_check", "ok": True,
                      "summary": f"Forecast max {_n(s.tmax_c)} °C ≥ {_n(engine.HEAT_DAY_C)} °C: heat day"})
    return steps


def template(tree: dict, s: engine.DayState, next_ask_in: int | None) -> tuple[str, str]:
    """(Hindi, English) for the morning check."""
    name, place = tree["name"], tree["location"].get("spot") or tree["location"]["label"]
    name_hi, place_hi = tree.get("nameHi") or name, tree["location"].get("spotHi") or place
    litres, waited = _n(s.litres_asked), s.unanswered_asks
    lost = _n(round(s.et0_mm, 1))

    if s.dead:
        return (f"मैं {name_hi} हूँ। कई दिनों से मुझे पानी नहीं मिला और मेरी मिट्टी पूरी सूख चुकी है। शायद अब बहुत देर हो गई है, पर एक बार आकर देख लो।",
                f"I'm {name}. I have had no water for many days and my soil is completely dry. It may be too late, but please come and look.")

    if s.ask == "water" and s.litres_given > 0:
        return (f"धन्यवाद! आज मुझे {litres} लीटर पानी मिल गया। मेरी मिट्टी फिर से भर गई है।",
                f"Thank you! I got my {litres} litres today. My soil is full again.")

    if s.ask == "water" and s.tmax_c >= engine.HEAT_DAY_C:
        return (f"आज {_n(s.tmax_c)} डिग्री है! मेरी मिट्टी आज {lost} मिलीमीटर पानी खो देगी। आज शाम तक मुझे {litres} लीटर पानी चाहिए।",
                f"It's {_n(s.tmax_c)} degrees today! My soil will lose {lost} mm of water. I need {litres} litres by this evening.")

    if s.ask == "water":
        since_hi = f"{waited} दिन से मैं पानी माँग रहा हूँ और " if waited > 1 else ""
        since_en = f"I have been asking for {waited} days and " if waited > 1 else ""
        return (f"नमस्ते, मैं {name_hi} हूँ, {place_hi} वाला। {since_hi}मेरी मिट्टी सूख रही है। आज शाम {litres} लीटर पानी दोगे?",
                f"Hi, I'm {name} from {place}. {since_en}my soil is drying out. Could you give me {litres} litres this evening?".replace(". my", ". My"))

    if s.ask == "skip":
        return (f"पिछले दो दिन में {_n(s.rain_48h_mm)} मिलीमीटर बारिश हुई, मेरी मिट्टी में पानी है। आज मत आना, पानी बचाओ। तुम्हारी स्ट्रीक बनी रहेगी।",
                f"{_n(s.rain_48h_mm)} mm of rain in the last two days, so my soil has water. Don't come today, save the water. Your streak is safe.")

    left = _n(round(engine.TAW_MM - s.depletion_due_mm, 1))
    if next_ask_in:
        return (f"आज मैं ठीक हूँ, मेरी मिट्टी में अभी {left} मिलीमीटर पानी बचा है। लगभग {next_ask_in} दिन बाद पानी चाहिए होगा।",
                f"I'm fine today, there is still {left} mm of water in my soil. I'll need water in about {next_ask_in} day{'s' if next_ask_in > 1 else ''}.")
    return (f"आज मैं ठीक हूँ, मेरी मिट्टी में अभी {left} मिलीमीटर पानी बचा है। आज पानी की ज़रूरत नहीं।",
            f"I'm fine today, there is still {left} mm of water in my soil. No water needed today.")


def audio_url(text_hi: str) -> str | None:
    """Speak the Hindi line with Polly, keep the MP3 in S3, return a short-lived link.

    Returns None if Polly or S3 fails: the text still reaches the user, and the web
    app falls back to the browser's own voice.
    """
    bucket = os.environ.get("MEDIA_BUCKET")
    if not bucket or not text_hi:
        return None
    try:
        s3 = aws.s3()
        key = f"audio/{hashlib.sha256((VOICE_ID + text_hi).encode()).hexdigest()[:32]}.mp3"
        try:
            s3.head_object(Bucket=bucket, Key=key)
        except ClientError:
            speech = aws.client("polly").synthesize_speech(
                Text=text_hi, VoiceId=VOICE_ID, Engine="neural", LanguageCode="hi-IN", OutputFormat="mp3")
            s3.put_object(Bucket=bucket, Key=key, Body=speech["AudioStream"].read(), ContentType="audio/mpeg")
        return s3.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=3600)
    except (BotoCoreError, ClientError):
        return None
