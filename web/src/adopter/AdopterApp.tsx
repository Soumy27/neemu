// My tree (मेरा पौधा): the sapling as a living character, framed in a Mughal arch.
// Beside it: its name, what it says today, and the one thing to do. Below: how it
// decided, its vital signs, and the people around it.

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api, partlyLive, SourceError, usingMock } from "../api/client";
import { scenario, scenarioLabel } from "../api/mock";
import type { NeemuSays, Tree } from "../api/types";
import { Arch, Rule } from "../shell/Ornament";
import { rememberTree, Shell } from "../shell/Shell";
import { daysSince, nameHi, plantedLabel, speciesHiOf, speciesLatin, speciesShort, statusWords } from "../shell/words";
import "./adopter.css";
import { BuddyList } from "./Buddies";
import { CallMe } from "./CallMe";
import { shareCard } from "./shareCard";
import type { Weather } from "./Tree3D";

// The 3D tree (and its ~3 MB library) loads after the words, so Neemu speaks first.
const Tree3D = lazy(() => import("./Tree3D").then((m) => ({ default: m.Tree3D })));
import { listen, speak } from "./voice";

const stepInfo: Record<string, { en: string; hi: string; icon: string }> = {
  get_weather: { en: "Today's weather", hi: "आज का मौसम", icon: "partly_cloudy_day" },
  get_forecast: { en: "The forecast", hi: "पूर्वानुमान", icon: "cloud" },
  water_balance: { en: "Water in the soil", hi: "मिट्टी में पानी", icon: "water_drop" },
  litres_needed: { en: "What it needs", hi: "कितना पानी", icon: "water_full" },
  heat_check: { en: "The heat", hi: "गर्मी", icon: "local_fire_department" },
};

const suggestions = [
  { text: "कैसा लग रहा है?", en: "How are you?", lang: "hi" as const },
  { text: "कल बारिश होगी क्या?", en: "Rain tomorrow?", lang: "hi" as const },
  { text: "What about tomorrow?", en: "", lang: "en" as const },
];

function errorText(e: unknown) {
  return e instanceof SourceError ? `${e.source} failed: ${e.message}` : String(e);
}

export function AdopterApp({ treeId }: { treeId: string }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [says, setSays] = useState<NeemuSays | null>(null);
  const [shownSteps, setShownSteps] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceVia, setVoiceVia] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [handle, setHandle] = useState("");
  const [question, setQuestion] = useState("");
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const [listening, setListening] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  // Neemu speaks aloud only after a tap; on page load the line is shown, with a play button.
  const voiceOn = useRef(false);

  useEffect(() => {
    rememberTree(treeId);
    // Everyone sees today's line straight away, adopted or not: it's the first thing a visitor should meet.
    api.getTree(treeId).then((t) => { setTree(t); run(api.today(treeId), false); }).catch((e) => setError(errorText(e)));
  }, [treeId]);

  // Reveal the reasoning steps one by one, then Neemu speaks.
  useEffect(() => {
    if (!says) return;
    setShownSteps(0);
    const timers = says.steps.map((_, i) => setTimeout(() => setShownSteps(i + 1), 380 * (i + 1)));
    const talk = setTimeout(() => voiceOn.current && play(says), 380 * (says.steps.length + 1));
    return () => [...timers, talk].forEach(clearTimeout);
  }, [says]);

  function play(s: NeemuSays) {
    const v = speak(s.textHi, s.audioUrl);
    setVoiceVia(v.via);
    setPlaying(true);
    setTimeout(() => setPlaying(false), 4200);
  }

  async function run(p: Promise<NeemuSays>, voice = true) {
    voiceOn.current = voice;
    setThinking(true);
    setError(null);
    setShowWhy(false);
    try {
      setSays(await p);
      setTree(await api.getTree(treeId));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setThinking(false);
    }
  }

  async function onAdopt() {
    if (!handle.trim()) return;
    try {
      setTree(await api.adopt(treeId, handle.trim()));
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3200);
      run(api.today(treeId));
    } catch (e) {
      setError(errorText(e));
    }
  }

  function onAsk(text = question, l = lang) {
    if (!text.trim()) return;
    setQuestion("");
    run(api.talk(treeId, text, l));
  }

  function onMic() {
    const ok = listen(lang, (t) => onAsk(t), () => setListening(false));
    if (ok) setListening(true);
    else setError("This browser can't listen. Type your question instead.");
  }

  if (!tree) {
    return (
      <Shell tab="home" treeId={treeId}>
        <div className="loading">{error ?? "Finding your tree…"}</div>
      </Shell>
    );
  }

  const w = tree.water;
  const wetness = Math.min(1, w.soilWaterMm / (w.soilWaterMm + w.deficitMm || 1));
  const heat = says?.heatwave?.active ? says.heatwave : null;
  const weather: Weather = heat ? "hot" : w.rainLast48hMm >= 10 ? "rain" : "clear";
  const litres = Math.round(says?.ask === "water" ? says.litres : w.litresNeeded);
  const status = statusWords[tree.status];
  const id = tree.id.split("-").pop();

  const strip = heat
    ? { tone: "hot" as const, text: <><span className="ms">local_fire_department</span> <span className="hi">आज गर्मी का दिन, {heat.tMaxC}°C · शाम 6 बजे से पहले पानी दें</span> · Heat day: water before 6 PM</> }
    : weather === "rain"
      ? { tone: "rain" as const, text: <><span className="ms">rainy</span> <span className="hi">पिछले दो दिन में {w.rainLast48hMm} mm बारिश</span> · Rain covered today's water</> }
      : null;

  return (
    <Shell tab="home" treeId={tree.id} driveId={tree.driveId} strip={strip} weather={`${Math.round(w.tMaxTodayC)}°C, ${tree.location.label.split(",")[0]}`}>
      {usingMock && (
        <div className="banner"><span className="ms">info</span>
          {partlyLive
            ? scenario === "today" ? "Live weather and voice from the Neemu API on AWS; some screens still use examples." : scenarioLabel[scenario].replace("The tree and its owner are examples.", "Live from the Neemu API.")
            : scenarioLabel[scenario]}
        </div>
      )}

      <div className="court">
        <div className="court-tree">
          <Arch className={`tree-arch ${weather}`}>
            <Suspense fallback={<div className="tree-loading"><span className="ms">potted_plant</span><span>Growing the tree…</span></div>}>
              <Tree3D seed={tree.id} stage={tree.growthStage} health={tree.health} wetness={wetness} watering={celebrate} weather={weather} />
            </Suspense>
          </Arch>
          <div className="plaque">
            <span className={`mark ${tree.adopter ? tree.status : litres > 0 ? "thirsty" : "plain"}`}>
              {tree.adopter ? <><span className="hi">{status.hi}</span> · {status.en}</> : <><span className="hi">पालक चाहिए</span> · Needs an adopter</>}
            </span>
            <span className="plaque-sep" />
            <span><span className="ms">thermostat</span> {w.tMaxTodayC}°C</span>
            <span className="plaque-sep" />
            <span><span className="ms">water_drop</span> soil {Math.round(wetness * 100)}% full</span>
          </div>
        </div>

        <div className="court-words">
          <div className="title-block">
            <div className="tree-hi hi-display">{nameHi(tree.name)}</div>
            <h1 className="tree-en">{tree.name} <span className="tree-id num">№ {id}</span></h1>
            <p className="tree-meta">
              <em>{speciesLatin(tree.species)}</em> · <span className="hi">{speciesHiOf(tree.species) || speciesShort(tree.species)}</span> · {tree.location.label}
            </p>
          </div>

          <figure className="voice">
            {thinking && !says && <p className="muted">{tree.name} is reading today's weather…</p>}
            {says && (
              <>
                {says.replay && <p className="replay"><span className="ms">history</span> A replay of {says.asOf}, with that day's real weather</p>}
                <blockquote lang="hi" className={`inscription ${shownSteps >= says.steps.length ? "shown" : ""}`}>{says.textHi}</blockquote>
                <figcaption className="translation">{says.textEn}</figcaption>
                <div className="row voice-actions">
                  <button className={`listen ${playing ? "playing" : ""}`} onClick={() => play(says)} aria-label={`Hear ${tree.name}`}>
                    <span className="ms fill">{playing ? "graphic_eq" : "play_arrow"}</span>
                  </button>
                  <span className="listen-label"><span className="hi">सुनें</span> · Hear {tree.name}</span>
                  {says.spokenBy === "agent" && <span className="mark fine tiny">Written live by AI</span>}
                </div>
              </>
            )}
          </figure>

          {!tree.adopter ? (
            <section className="panel act">
              <h2>Adopt {tree.name} <span className="hi-display">· {nameHi(tree.name)} को गोद लें</span></h2>
              <p className="muted">It needs one guardian. It will tell you when it's thirsty, and when it isn't.</p>
              <div className="adopt-row">
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your name · आपका नाम" aria-label="Your name" onKeyDown={(e) => e.key === "Enter" && onAdopt()} />
                <button className="gold" onClick={onAdopt}>Become its guardian</button>
              </div>
            </section>
          ) : says?.ask === "water" ? (
            <section className="panel act">
              <p className="act-kicker"><span className="hi">आज का कार्य</span> · Today, before 6 PM</p>
              <h2><span className="num act-big">{litres}</span> litres <span className="hi-display">· आज {litres} लीटर</span></h2>
              <p className="muted">Pour slowly around the basin so it soaks in. Then take one photo from the spot of the first one.</p>
              <div className="row wrap">
                <a className="button gold" href={`?view=proof&tree=${encodeURIComponent(tree.id)}`}><span className="ms">photo_camera</span>I gave {litres} L, send proof</a>
                <button className="on-panel" onClick={() => shareCard(tree, says)}><span className="ms">ios_share</span>Share</button>
              </div>
            </section>
          ) : (
            <section className="panel act calm">
              <p className="act-kicker"><span className="hi">आज आराम</span> · Nothing to do today</p>
              <h2>{tree.name} has water enough.</h2>
              <p className="muted">The soil still holds what it needs. It will ask when it needs you.</p>
              {says && <button className="on-panel" onClick={() => shareCard(tree, says)}><span className="ms">ios_share</span>Share</button>}
            </section>
          )}
        </div>
      </div>

      {says && (
        <>
          <Rule />
          <section className="section reckoning">
            <div className="section-title">
              <h2>How {tree.name} decided today</h2>
              <span className="hi-display">नीमू की गणना</span>
              <span className="grow" />
              <button className="link" onClick={() => setShowWhy((v) => !v)}>{showWhy ? "Hide the numbers" : "See every number"}</button>
            </div>
            <ol className="steps-line">
              {says.steps.map((s, i) => {
                const info = stepInfo[s.tool] ?? { en: s.tool, hi: "", icon: "calculate" };
                return (
                  <li key={i} className={`${i < shownSteps ? "shown" : ""} ${s.ok ? "" : "bad"}`}>
                    <span className="step-num num">{i + 1}</span>
                    <div>
                      <h3><span className="ms">{info.icon}</span> {info.en}</h3>
                      <p className="hi small step-hi">{info.hi}</p>
                      <p className="step-sum">{s.summary}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {showWhy && (
              <table className="facts rise">
                <tbody>{says.facts.map((f) => <tr key={f.label}><td>{f.label}</td><td>{f.value}</td></tr>)}</tbody>
              </table>
            )}
            <p className="fine-print">
              {says.spokenBy === "template"
                ? "Today's sentence is a fixed template while the AI is offline. Every number above is computed from Open-Meteo weather by the water-balance engine."
                : "Every number comes from the water-balance engine on real Open-Meteo weather; the AI only chooses the words."}
              {voiceVia === "browser" && " In demo mode the browser's voice stands in for Amazon Polly."}
            </p>
          </section>
        </>
      )}

      <Rule />

      <section className="vitals">
        <div className="vital wide">
          <div className="vital-label">Vitality <span className="hi">· स्वास्थ्य</span></div>
          <div className="vital-num num">{tree.health}<small>/100</small></div>
          <div className="vine"><div className="vine-fill" style={{ width: `${tree.health}%` }} /></div>
        </div>
        <div className="vital">
          <div className="vital-label">Days in a row <span className="hi">· निरंतरता</span></div>
          <div className="vital-num num">{tree.streakDays}</div>
        </div>
        <div className="vital">
          <div className="vital-label">Litres saved by rain <span className="hi">· बचाया</span></div>
          <div className="vital-num num">{Math.round(tree.litresSaved)}</div>
        </div>
        <div className="vital">
          <div className="vital-label">Planted <span className="hi">· रोपण</span></div>
          <div className="vital-num small-num">{plantedLabel(tree.plantedOn)}</div>
          <div className="muted tiny">{daysSince(tree.plantedOn)} days ago · growth {tree.growthStage} of 5</div>
        </div>
      </section>

      <Rule />

      <div className="garden-cols">
        <div>
          {tree.adopter ? <BuddyList treeId={tree.id} treeName={tree.name} me={tree.adopter.handle} /> : (
            <section className="section">
              <div className="section-title"><h2>The drive</h2><span className="hi-display">अभियान</span></div>
              <p className="muted">{tree.name} is one of the saplings planted at {tree.location.label}. See them all as a grove.</p>
              <a className="button" href={`?view=grove&drive=${encodeURIComponent(tree.driveId)}`}><span className="ms">forest</span>Walk through the grove</a>
            </section>
          )}
          {tree.adopter && <CallMe treeId={tree.id} treeName={tree.name} handle={tree.adopter.handle} />}
        </div>

        <section className="section talk">
          <div className="section-title">
            <h2>Speak with {tree.name}</h2>
            <span className="hi-display">बात करें</span>
            <span className="grow" />
            <div className="lang" role="group" aria-label="Language">
              <button className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")}>हिंदी</button>
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
            </div>
          </div>
          <div className="prompts">
            {suggestions.map((s) => (
              <button key={s.text} className="prompt" onClick={() => onAsk(s.text, s.lang)}>
                <span className={s.lang === "hi" ? "hi" : ""}>{s.text}</span>{s.en && <span className="muted"> {s.en}</span>}
              </button>
            ))}
          </div>
          <div className="ask">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={lang === "hi" ? "कुछ पूछें…" : "Ask something…"} aria-label="Your question" onKeyDown={(e) => e.key === "Enter" && onAsk()} />
            <button className="round" onClick={onMic} disabled={listening} aria-label="Speak your question"><span className="ms">{listening ? "graphic_eq" : "mic"}</span></button>
            <button className="round primary" onClick={() => onAsk()} aria-label="Ask"><span className="ms">arrow_upward</span></button>
          </div>
        </section>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
    </Shell>
  );
}
