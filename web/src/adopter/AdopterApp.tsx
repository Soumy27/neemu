import { useEffect, useRef, useState } from "react";
import { api, SourceError, usingMock } from "../api/client";
import type { NeemuSays, ProofResult, Tree } from "../api/types";
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
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setChecking(true);
    setResult(null);
    setError(null);
    try {
      const r = await api.proof(treeId, file);
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
      if (fileRef.current) fileRef.current.value = "";
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
      {usingMock && <div className="banner">Demo data: weather numbers are real (Open-Meteo, Delhi, 9 Oct); the tree and its owner are examples.</div>}

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
          <div className="streak" title="Days in a row">🔥 {tree.streakDays}</div>
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
                <blockquote lang="hi">{says.textHi}</blockquote>
                <p className="muted">{says.textEn}</p>
                <div className="row wrap">
                  <button onClick={() => setVoiceVia(speak(says.textHi, says.audioUrl).via)}>▶ Hear {tree.name}</button>
                  <button onClick={() => setShowWhy((v) => !v)}>{showWhy ? "Hide" : "Why?"}</button>
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
              <p>Take a photo with the <strong>QR tag on the tree guard</strong> in the frame. No tag, no credit.</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
              <button className="primary" disabled={checking} onClick={() => fileRef.current?.click()}>
                {checking ? "Checking the photo…" : `📷 I gave ${says.litres} L, send proof`}
              </button>
              {result && (
                <div className={`result ${result.verdict}`}>
                  {result.verdict === "accepted" ? (
                    <p>Accepted. Tag matched, basin wet, leaves {result.leaves}. Streak now {tree.streakDays}.</p>
                  ) : (
                    <ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  )}
                </div>
              )}
            </section>
          )}

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
