// Tree Home (मेरा पौधा): the sapling as a living character.
// Left: the 3D tree and what Neemu says (with its reasoning). Right: the tree's
// card, today's mission, notifications and a way to talk to it.

import { useEffect, useRef, useState } from "react";
import { api, partlyLive, SourceError, usingMock } from "../api/client";
import { scenario, scenarioLabel } from "../api/mock";
import type { NeemuSays, Tree } from "../api/types";
import { rememberTree, Shell } from "../shell/Shell";
import { daysSince, nameHi, plantedLabel, speciesHiOf, speciesLatin, speciesShort, statusWords } from "../shell/words";
import "./adopter.css";
import { BuddyList } from "./Buddies";
import { CallMe } from "./CallMe";
import { shareCard } from "./shareCard";
import { Tree3D, type Weather } from "./Tree3D";
import { listen, speak } from "./voice";

const stepInfo: Record<string, { en: string; hi: string; icon: string }> = {
  get_weather: { en: "Weather", hi: "मौसम", icon: "partly_cloudy_day" },
  get_forecast: { en: "Forecast", hi: "पूर्वानुमान", icon: "cloud" },
  water_balance: { en: "Soil water", hi: "मिट्टी का पानी", icon: "water_drop" },
  litres_needed: { en: "Litres", hi: "लीटर", icon: "water_full" },
  heat_check: { en: "Heat", hi: "गर्मी", icon: "local_fire_department" },
};

const suggestions = [
  { text: "कैसा लग रहा है?", en: "How are you feeling?", lang: "hi" as const },
  { text: "कल बारिश होगी क्या?", en: "Will it rain tomorrow?", lang: "hi" as const },
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
    const timers = says.steps.map((_, i) => setTimeout(() => setShownSteps(i + 1), 450 * (i + 1)));
    const talk = setTimeout(() => voiceOn.current && setVoiceVia(speak(says.textHi, says.audioUrl).via), 450 * (says.steps.length + 1));
    return () => [...timers, talk].forEach(clearTimeout);
  }, [says]);

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
  const status = tree.adopter ? statusWords[tree.status] : null;
  const vitalityTone = tree.health < 30 ? "amber" : tree.health < 60 ? "sky" : "green";

  const strip = heat
    ? { tone: "hot" as const, text: <><span className="ms">local_fire_department</span> <span className="hi">आज गर्मी का दिन: {heat.tMaxC}°C · शाम 6 बजे से पहले पानी दें</span> · Heat day: water before 6 PM</> }
    : weather === "rain"
      ? { tone: "rain" as const, text: <><span className="ms">rainy</span> <span className="hi">बारिश हुई · {w.rainLast48hMm} mm</span> · Rain covered today's water</> }
      : null;

  return (
    <Shell tab="home" treeId={tree.id} driveId={tree.driveId} strip={strip} weather={`${Math.round(w.tMaxTodayC)}°C · ${tree.location.label.split(",")[0]}`}>
      {usingMock && (
        <div className="banner">
          {partlyLive
            ? scenario === "today" ? "Live: weather, water and Neemu's voice come from the Neemu API on AWS. Some screens still use examples." : scenarioLabel[scenario].replace("The tree and its owner are examples.", "Live from the Neemu API.")
            : scenarioLabel[scenario]}
        </div>
      )}

      {heat && (
        <div className="heat-banner rise">
          <span className="heat-icon"><span className="ms">local_fire_department</span></span>
          <div>
            <div className="heat-title">Heat Day · {heat.tMaxC}°C <span className="pill amber hi">धूप बहुत तेज है</span></div>
            <p>Every tree in the drive needs water before 6:00 PM. <span className="hi">सभी पौधों को शाम 6 बजे से पहले पानी दें।</span></p>
          </div>
        </div>
      )}

      <div className="home-grid">
        <div className="col">
          <section className="card hero">
            <div className={`stage ${weather}`}>
              <Tree3D seed={tree.id} stage={tree.growthStage} health={tree.health} wetness={wetness} watering={celebrate} weather={weather} />
              <div className="overlay tl">
                {status ? (
                  <span className={`pill ${status.tone}`}><span className="ms">{status.icon}</span><span className="hi">{status.hi}</span> · {status.en}{litres > 0 && tree.status !== "fine" ? ` (${litres} L today)` : ""}</span>
                ) : (
                  <span className="pill amber"><span className="ms">volunteer_activism</span><span className="hi">पालक चाहिए</span> · Needs an adopter{litres > 0 ? ` · ${litres} L today` : ""}</span>
                )}
              </div>
              <div className="overlay tr">
                <span className="pill dark"><span className="ms">{heat ? "sunny" : weather === "rain" ? "rainy" : "partly_cloudy_day"}</span>{w.tMaxTodayC}°C</span>
                <span className="pill dark"><span className="ms">water_drop</span>Soil {Math.round(wetness * 100)}%</span>
              </div>
              <div className="overlay bl">
                <span className="pill dark"><span className="ms">location_on</span>{tree.location.label}</span>
              </div>
              <div className="overlay br">
                {says && <button className="pill-btn" onClick={() => setVoiceVia(speak(says.textHi, says.audioUrl).via)}><span className="ms">volume_up</span><span className="hi">आवाज़ सुनें</span></button>}
              </div>
            </div>

            <div className="speaks inner">
              <div className="row speaks-head">
                <span className="eyebrow"><span className="ms">eco</span>{tree.name} speaks · <span className="hi">{nameHi(tree.name)} की बात</span></span>
                {says?.spokenBy === "agent" && <span className="pill mint">Live AI</span>}
                <span style={{ flex: 1 }} />
                {says && <button className="primary small-btn" onClick={() => setVoiceVia(speak(says.textHi, says.audioUrl).via)}><span className="ms">play_circle</span>Play voice · <span className="hi">सुनें</span></button>}
              </div>

              {thinking && !says && <p className="muted">{tree.name} is checking the weather…</p>}
              {says && shownSteps >= says.steps.length ? (
                <div className="rise">
                  {says.replay && <span className="pill sky"><span className="ms">history</span>Replay of {says.asOf} · real weather</span>}
                  <blockquote lang="hi" className="hi">“{says.textHi}”</blockquote>
                  <p className="en-line">“{says.textEn}”</p>
                </div>
              ) : says ? <p className="muted">{tree.name} is thinking…</p> : null}

              {says && (
                <div className="reasoning">
                  <div className="row">
                    <span className="eyebrow muted-eyebrow">How {tree.name} worked it out · <span className="hi">नीमू की गणना</span></span>
                    <span style={{ flex: 1 }} />
                    <button className="link" onClick={() => setShowWhy((v) => !v)}>{showWhy ? "Hide numbers" : <>Why? <span className="hi">आंकड़े देखें</span></>}</button>
                  </div>
                  <ol className="step-chips">
                    {says.steps.map((s, i) => {
                      const info = stepInfo[s.tool] ?? { en: s.tool, hi: "", icon: "calculate" };
                      return (
                        <li key={i} className={`step-chip ${i < shownSteps ? "shown" : ""} ${s.ok ? "" : "bad"}`}>
                          <span className="ms">{info.icon}</span>
                          <div>
                            <div className="step-title">Step {i + 1}: {info.en}</div>
                            <div className="step-sum">{s.summary}</div>
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
                    <span className="ms">auto_awesome</span>
                    {says.spokenBy === "template"
                      ? <> Today's sentence is a fixed template because the AI is offline. Every number is computed from Open-Meteo weather by the water-balance engine.</>
                      : <> Numbers come from the water-balance engine on real Open-Meteo weather; the AI only chooses the words.</>}
                    {voiceVia === "browser" && " Browser voice stands in for Amazon Polly in demo mode."}
                  </p>
                </div>
              )}
            </div>
          </section>

          {tree.adopter && <BuddyList treeId={tree.id} treeName={tree.name} me={tree.adopter.handle} />}
        </div>

        <div className="col">
          <section className="card tree-card">
            <div className="name-row">
              <div>
                <h1 className="tree-name">{tree.name} · <span className="hi">{nameHi(tree.name)}</span> <span className="pill id">#{tree.id.split("-").pop()}</span></h1>
                <p className="latin"><em>{speciesLatin(tree.species)}</em> <span className="hi">({speciesHiOf(tree.species) || speciesShort(tree.species)})</span></p>
                <p className="muted small"><span className="ms outline">location_on</span> {tree.location.label}</p>
              </div>
              {tree.adopter ? <span className="pill mint"><span className="ms">verified</span>Adopted</span> : <span className="pill amber"><span className="ms">favorite</span>Free to adopt</span>}
            </div>

            <div className="vitality">
              <div className="row">
                <span className="vit-label"><span className="ms outline">eco</span> Vitality · <span className="hi">स्वास्थ्य स्तर</span></span>
                <span style={{ flex: 1 }} />
                <span className={`vit-value ${vitalityTone}`}>{tree.health}%</span>
              </div>
              <div className="vit-track"><div className={`vit-fill ${vitalityTone}`} style={{ width: `${tree.health}%` }} /></div>
              <div className="row small muted">
                <span>Planted {plantedLabel(tree.plantedOn)} · {daysSince(tree.plantedOn)} days ago</span>
                <span style={{ flex: 1 }} />
                <span>Growth stage {tree.growthStage} of 5</span>
              </div>
            </div>

            <div className="stat-tiles">
              <div className="stat-tile">
                <span className="eyebrow amber-eyebrow"><span className="ms">local_fire_department</span>Streak · <span className="hi">निरंतरता</span></span>
                <div className="stat-num">{tree.streakDays} <small>{tree.streakDays === 1 ? "day" : "days"}</small></div>
                <span className="muted small">Days in a row it was cared for</span>
              </div>
              <div className="stat-tile">
                <span className="eyebrow sky-eyebrow"><span className="ms">water_drop</span>Saved · <span className="hi">बचाया</span></span>
                <div className="stat-num">{Math.round(tree.litresSaved)} <small>litres</small></div>
                <span className="muted small">Not poured, because rain did it</span>
              </div>
            </div>
          </section>

          {!tree.adopter ? (
            <section className="card hero-green mission">
              <span className="pill mission-tag">Become its guardian · <span className="hi">पालक बनें</span></span>
              <h2 className="mission-title">Adopt {tree.name} · <span className="hi">{nameHi(tree.name)} को गोद लें</span></h2>
              <p className="muted">It needs one person. It will tell you when it's thirsty, and when it isn't.</p>
              <div className="adopt-row">
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your name · आपका नाम" onKeyDown={(e) => e.key === "Enter" && onAdopt()} />
                <button className="white" onClick={onAdopt}><span className="ms">favorite</span>Adopt</button>
              </div>
            </section>
          ) : says?.ask === "water" ? (
            <section className="card hero-green mission">
              <div className="row"><span className="pill mission-tag">Today's mission · <span className="hi">आज का कार्य</span></span><span className="muted small">Due by 6:00 PM</span></div>
              <h2 className="mission-title">{litres} litres needed today <span className="hi">(आज {litres} लीटर)</span></h2>
              <p className="muted">Pour slowly around the basin so it soaks in. Then snap one photo from the same spot as the first one.</p>
              <a className="button white block" href={`?view=proof&tree=${encodeURIComponent(tree.id)}`}><span className="ms">photo_camera</span>I gave {litres} L, send proof · <span className="hi">फोटो भेजें</span></a>
              <button className="ghost-light block" onClick={() => shareCard(tree, says)}><span className="ms">share</span>Share {tree.name}'s story · <span className="hi">शेयर करें</span></button>
            </section>
          ) : (
            <section className="card mint rest">
              <span className="eyebrow"><span className="ms">self_care</span>Nothing to do today · <span className="hi">आज आराम</span></span>
              <h2>{tree.name} is fine today.</h2>
              <p className="muted">The soil still holds water. Neemu will ask when it needs you.</p>
              {says && <button onClick={() => shareCard(tree, says)}><span className="ms">share</span>Share</button>}
            </section>
          )}

          {tree.adopter && <CallMe treeId={tree.id} treeName={tree.name} handle={tree.adopter.handle} />}

          <section className="card talk">
            <div className="row">
              <h2><span className="ms outline">forum</span> Talk to {tree.name} · <span className="hi">बात करें</span></h2>
              <span style={{ flex: 1 }} />
              <button className="lang" onClick={() => setLang((l) => (l === "hi" ? "en" : "hi"))} aria-label="Switch language">
                <b className={lang === "hi" ? "on" : ""}>हिं</b> / <b className={lang === "en" ? "on" : ""}>EN</b>
              </button>
            </div>
            <div className="chips">
              {suggestions.map((s) => (
                <button key={s.text} className="chip" onClick={() => onAsk(s.text, s.lang)}>
                  <span className={s.lang === "hi" ? "hi" : ""}>{s.text}</span>{s.en && <span className="muted"> ({s.en})</span>}
                </button>
              ))}
            </div>
            <div className="ask-box">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={lang === "hi" ? "कुछ पूछें… (कल क्या होगा?)" : "Ask something… (what about tomorrow?)"} onKeyDown={(e) => e.key === "Enter" && onAsk()} />
              <button className="round" onClick={onMic} disabled={listening} aria-label="Speak"><span className="ms">{listening ? "graphic_eq" : "mic"}</span></button>
              <button className="round primary send" onClick={() => onAsk()} aria-label="Ask"><span className="ms">send</span></button>
            </div>
          </section>
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
    </Shell>
  );
}
