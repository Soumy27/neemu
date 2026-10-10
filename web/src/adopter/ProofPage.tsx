// Watering & Proof (पानी और फोटो): take the proof photo for your tree, and
// help neighbours by checking theirs. Code checks place and freshness; people
// check "same tree".

import { useEffect, useState } from "react";
import { api, SourceError } from "../api/client";
import type { ProofResult, Tree } from "../api/types";
import { rememberTree, Shell } from "../shell/Shell";
import { nameHi, speciesLatin } from "../shell/words";
import "./adopter.css";
import { BuddyReviews } from "./Buddies";
import { Camera } from "./Camera";

export function ProofPage({ treeId }: { treeId: string }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ProofResult | null>(null);

  useEffect(() => {
    rememberTree(treeId);
    api.getTree(treeId).then(setTree).catch((e) => setError(e instanceof SourceError ? `${e.source} failed: ${e.message}` : String(e)));
  }, [treeId]);

  async function onShot(file: File) {
    setChecking(true);
    setResult(null);
    setError(null);
    try {
      const r = await api.proof(treeId, file, tree?.adopter?.handle ?? "");
      setResult(r);
      setTree(r.tree);
    } catch (e) {
      setError(e instanceof SourceError ? `${e.source} failed: ${e.message}` : String(e));
    } finally {
      setChecking(false);
    }
  }

  const me = tree?.adopter?.handle ?? "";

  return (
    <Shell tab="proof" treeId={treeId} driveId={tree?.driveId}>
      <div className="sync-head">
        <span className="live-dot" />
        <div>
          <h1>Watering proof & community check</h1>
          <div className="muted small"><span className="hi">पानी का प्रमाण और सामुदायिक जांच</span></div>
        </div>
        <span style={{ flex: 1 }} />
        {tree && <span className="pill"><span className="ms outline">local_fire_department</span>Streak: {tree.streakDays} days</span>}
      </div>

      <div className="proof-grid">
        <div className="col">
          <section className="card">
            {!tree ? (
              <p className="muted">{error ?? "Finding your tree…"}</p>
            ) : (
              <>
                <div className="name-row">
                  <div>
                    <h2 style={{ margin: 0 }}><span className="pill id">#{tree.id.split("-").pop()}</span> {tree.name} · <span className="hi">{nameHi(tree.name)}</span></h2>
                    <p className="muted small"><em>{speciesLatin(tree.species)}</em> · {tree.location.label}</p>
                  </div>
                  <span className={`pill ${tree.referencePhotoUrl ? "mint" : ""}`}><span className="ms outline">layers</span>Ghost overlay: {tree.referencePhotoUrl ? "on" : "no first photo"}</span>
                </div>

                {!tree.adopter ? (
                  <div className="inner" style={{ marginTop: 12 }}>
                    <p>Only {tree.name}'s adopter can send its watering proof.</p>
                    <a className="button primary" href={`?tree=${encodeURIComponent(tree.id)}`}>Open {tree.name} to adopt it</a>
                  </div>
                ) : checking ? (
                  <div className="checking">
                    <span className="ms">water_drop</span>
                    <strong>Checking the photo…</strong>
                    <span className="muted small">Where you were, and whether this photo is new.</span>
                  </div>
                ) : result?.verdict === "accepted" ? (
                  <div className="result accepted rise" style={{ padding: 20 }}>
                    <h2 style={{ margin: 0 }}><span className="ms">check_circle</span> Accepted · <span className="hi">स्वीकार</span></h2>
                    <p>
                      Location checked{result.distanceM != null && `: ${Math.round(result.distanceM)} m from the tree`}{result.accuracyM != null && ` (±${Math.round(result.accuracyM)} m)`}. Streak now {tree.streakDays}.
                      {result.review === "pending" && <> A water buddy will confirm it's the same tree.</>}
                    </p>
                    <a className="button primary" href={`?tree=${encodeURIComponent(tree.id)}`}><span className="ms">potted_plant</span>Back to {tree.name}</a>
                  </div>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <Camera
                      referenceUrl={tree.referencePhotoUrl}
                      onShot={onShot}
                      top={<><span className="pill dark"><span className="ms">photo_camera</span>Proof photo</span><span className="pill dark"><span className="ms">water_drop</span>{Math.round(tree.water.litresNeeded)} L asked</span></>}
                    />
                    {result?.verdict === "rejected" && (
                      <div className="result rejected rise">
                        <ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                      </div>
                    )}
                    <div className="inner row small" style={{ marginTop: 12 }}>
                      <span className="ms outline green-text">task_alt</span>
                      <span><strong>Ready to capture proof</strong> · <span className="hi">प्रमाण लेने के लिए तैयार</span><br /><span className="muted">Your location and the server's time go with the photo.</span></span>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="tips">
            <div className="tip"><span className="ms">wb_sunny</span><span><strong>Good light</strong>Keep the sun behind you</span></div>
            <div className="tip"><span className="ms">water</span><span><strong>Show the wet ring</strong>The soaked basin around it</span></div>
            <div className="tip"><span className="ms">fence</span><span><strong>Frame the guard</strong>Whole guard and what's behind</span></div>
          </div>
        </div>

        <div className="col">
          {me ? <BuddyReviews me={me} /> : (
            <section className="card verify">
              <h2><span className="ms outline">groups</span> Community Verification</h2>
              <div className="verify-hi hi">सामुदायिक जांच</div>
              <p className="muted">Adopt a sapling to help check your neighbours' watering photos.</p>
            </section>
          )}
          <section className="card sand">
            <span className="eyebrow"><span className="ms">info</span>How proof works · <span className="hi">कैसे काम करता है</span></span>
            <ol className="how">
              <li>Code checks you were within reach of the sapling, and that the photo has not been sent before.</li>
              <li>Some proofs go to a neighbour or the organiser, who compares them with the first photo.</li>
              <li>Two "different" votes, or one from the organiser, undo the credit.</li>
            </ol>
          </section>
        </div>
      </div>
      {error && tree && <div className="error" role="alert">{error}</div>}
    </Shell>
  );
}
