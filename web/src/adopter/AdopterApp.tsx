import { useEffect, useState } from "react";
import { api, partlyLive, SourceError, usingMock } from "../api/client";
import { scenarioLabel, scenario } from "../api/mock";
import { shareCard } from "./shareCard";
import type { NeemuSays, ProofResult, Tree } from "../api/types";
import { Buddies } from "./Buddies";
import { Camera } from "./Camera";
import { Tree3D } from "./Tree3D";
import { listen, speak } from "./voice";

const statusLabel: Record<Tree["status"], string> = {
  fine: "Happy",
  thirsty: "Thirsty",
  no_proof: "Waiting for proof",
  likely_dead: "In danger",
};

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
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ProofResult | null>(null);
  const [watering, setWatering] = useState(false);
  const [handle, setHandle] = useState("");
  const [question, setQuestion] = useState("");
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const [listening, setListening] = useState(false);
  const [camera, setCamera] = useState(false);

  useEffect(() => {
    api.getTree(treeId).then(setTree).catch((e) => setError(errorText(e)));
  }, [treeId]);

  // Reveal the agent's tool steps one by one, then Neemu speaks.
  useEffect(() => {
    if (!says) return;
    setShownSteps(0);
    const timers = says.steps.map((_, i) => setTimeout(() => setShownSteps(i + 1), 450 * (i + 1)));
    const talk = setTimeout(() => setVoiceVia(speak(says.textHi, says.audioUrl).via), 450 * (says.steps.length + 1));
    return () => [...timers, talk].forEach(clearTimeout);
  }, [says]);

  async function run(p: Promise<NeemuSays>) {
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
      run(api.today(treeId));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function onPhoto(file: File) {
    setCamera(false);
    setChecking(true);
    setResult(null);
    setError(null);
    try {
      const r = await api.proof(treeId, file, tree?.adopter?.handle ?? "");
      setResult(r);
      setTree(r.tree);
      if (r.verdict === "accepted") {
        setWatering(true);
        setTimeout(() => setWatering(false), 3500);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setChecking(false);
    }
  }

  function onAsk(text = question) {
    if (!text.trim()) return;
    setQuestion("");
    run(api.talk(treeId, text, lang));
  }

  function onMic() {
    const ok = listen(lang, (t) => onAsk(t), () => setListening(false));
    if (ok) setListening(true);
    else setError("This browser can't listen. Type your question instead.");
  }

  if (!tree) return <div className="loading">{error ?? "Finding your tree…"}</div>;

  const wetness = Math.min(1, tree.water.soilWaterMm / (tree.water.soilWaterMm + tree.water.deficitMm || 1));

  return (
    <div className="adopter">
      {usingMock && <div className="banner">{partlyLive ? (scenario === "today" ? "Live: weather, water and Neemu's voice come from the Neemu API on AWS. Some screens still use examples." : scenarioLabel[scenario].replace("The tree and its owner are examples.", "Live from the Neemu API.")) : scenarioLabel[scenario]}</div>}
      {says?.heatwave?.active && (
        <div className="boss" role="status">
          <strong>🔥 Heat day boss · {says.heatwave.tMaxC} °C</strong>
          <span>Every tree in the drive needs water before 6 PM. Beat the heat, keep your streak.</span>
        </div>
      )}

      <section className="stage">
        <Tree3D seed={tree.id} stage={tree.growthStage} health={tree.health} wetness={wetness} watering={watering} />
        <div className={`status status-${tree.status}`}>{statusLabel[tree.status]}</div>
      </section>

      <section className="card">
        <div className="name-row">
          <div>
            <h1>{tree.name}</h1>
            <p className="muted">{tree.species} · planted {tree.plantedOn} · {tree.location.label}</p>
          </div>
          <div className="stats">
            <div className="streak" title="Days in a row">🔥 {tree.streakDays}</div>
            <div className="saved" title="Litres Neemu told you not to give, because rain covered it">💧 {tree.litresSaved} L saved</div>
          </div>
        </div>
        <div className="meter" aria-label={`Health ${tree.health} of 100`}>
          <div className="meter-fill" style={{ width: `${tree.health}%` }} />
        </div>
        <p className="muted small">Health {tree.health}/100 · growth stage {tree.growthStage} of 5</p>
      </section>

      {!tree.adopter ? (
        <section className="card">
          <h2>Adopt {tree.name}</h2>
          <p>{tree.name} needs one person to look after it. It will tell you when it's thirsty, and when it isn't.</p>
          <div className="row">
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your name" onKeyDown={(e) => e.key === "Enter" && onAdopt()} />
            <button className="primary" onClick={onAdopt}>Adopt</button>
          </div>
        </section>
      ) : (
        <>
          <section className="card speech">
            {!says && !thinking && <button className="primary" onClick={() => run(api.today(treeId))}>Ask {tree.name} how it's doing</button>}

            {(thinking || says) && (
              <ol className="steps">
                {thinking && <li className="step pending">{tree.name} is checking the weather…</li>}
                {says?.steps.slice(0, shownSteps).map((s, i) => (
                  <li key={i} className={`step ${s.ok ? "ok" : "bad"}`}><code>{s.tool}</code> {s.summary}</li>
                ))}
              </ol>
            )}

            {says && shownSteps >= says.steps.length && (
              <>
                {says.replay && <p className="muted small">Replay of {says.asOf}, real weather for that day.</p>}
                <blockquote lang="hi">{says.textHi}</blockquote>
                <p className="muted">{says.textEn}</p>
                <div className="row wrap">
                  <button onClick={() => setVoiceVia(speak(says.textHi, says.audioUrl).via)}>▶ Hear {tree.name}</button>
                  <button onClick={() => setShowWhy((v) => !v)}>{showWhy ? "Hide" : "Why?"}</button>
                  <button onClick={() => shareCard(tree, says)}>Share</button>
                  {says.spokenBy === "template" && <span className="muted small">The AI is offline, so {tree.name} is using a fixed sentence. The numbers are still computed.</span>}
                  {voiceVia === "browser" && <span className="muted small">Browser voice stands in for Amazon Polly in demo mode.</span>}
                </div>
                {showWhy && (
                  <table className="facts">
                    <tbody>
                      {says.facts.map((f) => (
                        <tr key={f.label}><td>{f.label}</td><td>{f.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>

          {says?.ask === "water" && (
            <section className="card">
              <h2>Watered it? Show {tree.name}.</h2>
              <p>Stand next to {tree.name} and take the photo from the same spot as its first photo. Your location is checked, and sometimes a buddy confirms it's the same tree.</p>
              {camera ? (
                <Camera referenceUrl={tree.referencePhotoUrl} onShot={onPhoto} onCancel={() => setCamera(false)} />
              ) : (
                <button className="primary" disabled={checking} onClick={() => setCamera(true)}>
                  {checking ? "Checking the photo…" : `📷 I gave ${says.litres} L, send proof`}
                </button>
              )}
              {result && (
                <div className={`result ${result.verdict}`}>
                  {result.verdict === "accepted" ? (
                    <p>
                      Accepted. Location checked{result.distanceM != null && `: ${Math.round(result.distanceM)} m from the tree`}{result.accuracyM != null && ` (±${Math.round(result.accuracyM)} m)`}. Streak now {tree.streakDays}.
                      {result.review === "pending" && <><br />A water buddy will confirm it's the same tree.</>}
                    </p>
                  ) : (
                    <ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  )}
                </div>
              )}
            </section>
          )}

          <Buddies treeId={tree.id} treeName={tree.name} me={tree.adopter.handle} />

          <section className="card">
            <h2>Talk to {tree.name}</h2>
            <div className="row">
              <select value={lang} onChange={(e) => setLang(e.target.value as "hi" | "en")} aria-label="Language">
                <option value="hi">हिंदी</option>
                <option value="en">English</option>
              </select>
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={lang === "hi" ? "कल क्या होगा?" : "What about tomorrow?"} onKeyDown={(e) => e.key === "Enter" && onAsk()} />
              <button onClick={onMic} disabled={listening} aria-label="Speak">{listening ? "…" : "🎤"}</button>
              <button className="primary" onClick={() => onAsk()}>Ask</button>
            </div>
          </section>
        </>
      )}

      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
