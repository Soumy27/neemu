// Watering (पानी और फोटो): take the proof photo for your tree inside its arch, and
// help neighbours by checking theirs. Code checks place and freshness; people
// check "same tree".

import { useEffect, useState } from "react";
import { api, SourceError } from "../api/client";
import type { ProofResult, Tree } from "../api/types";
import { Arch, Rule } from "../shell/Ornament";
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
  const accepted = result?.verdict === "accepted";

  return (
    <Shell tab="proof" treeId={treeId} driveId={tree?.driveId}>
      <div className="page-head">
        <div>
          <h1>Proof of watering</h1>
          <span className="hi-display">पानी का प्रमाण, और पड़ोसियों की जांच</span>
        </div>
        {tree && <span className="mark plain num">{tree.streakDays} days in a row</span>}
      </div>
      <Rule left />

      <div className="proof-court">
        <div>
          <Arch className="camera-arch">
            {!tree ? (
              <div className="no-camera"><p>{error ?? "Finding your tree…"}</p></div>
            ) : !tree.adopter ? (
              <div className="accepted-court">
                <span className="ms">volunteer_activism</span>
                <h2>Only its guardian sends proof</h2>
                <p>Adopt {tree.name} first, then come back after watering.</p>
                <a className="button gold" href={`?tree=${encodeURIComponent(tree.id)}`}>Open {tree.name}</a>
              </div>
            ) : checking ? (
              <div className="checking">
                <span className="ms">water_drop</span>
                <h2 style={{ color: "inherit" }}>Checking the photo…</h2>
                <p>Where you were, and whether this photo is new.</p>
              </div>
            ) : accepted ? (
              <div className="accepted-court rise">
                <span className="ms">verified</span>
                <h2>Accepted <span className="hi-display">· स्वीकार</span></h2>
                <p>
                  {result.distanceM != null ? <>You were <span className="num">{Math.round(result.distanceM)}</span> m from {tree.name}{result.accuracyM != null && <> (±<span className="num">{Math.round(result.accuracyM)}</span> m)</>}. </> : null}
                  {tree.streakDays} days in a row.
                  {result.review === "pending" && <> A water buddy will confirm it's the same tree.</>}
                </p>
                <a className="button gold" href={`?tree=${encodeURIComponent(tree.id)}`}>Back to {tree.name}</a>
              </div>
            ) : (
              <Camera
                referenceUrl={tree.referencePhotoUrl}
                onShot={onShot}
                top={<><span><span className="ms">water_drop</span> {Math.round(tree.water.litresNeeded)} L asked today</span><span><span className="ms">layers</span> {tree.referencePhotoUrl ? "first photo shown faintly" : "no first photo yet"}</span></>}
              />
            )}
          </Arch>
          {result?.verdict === "rejected" && (
            <div className="result rejected rise"><ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
          )}
          <div className="tips">
            <span><span className="ms">wb_sunny</span> Keep the sun behind you</span>
            <span><span className="ms">water</span> Show the wet basin</span>
            <span><span className="ms">fence</span> Frame the whole guard</span>
          </div>
        </div>

        <div className="proof-side">
          {tree && (
            <div className="proof-tree">
              <div className="tree-hi hi-display">{nameHi(tree.name)}</div>
              <h2>{tree.name} <span className="tree-id num">№ {tree.id.split("-").pop()}</span></h2>
              <p className="tree-meta"><em>{speciesLatin(tree.species)}</em> · {tree.location.label}</p>
            </div>
          )}
          <Rule left />
          {me ? <BuddyReviews me={me} /> : (
            <section className="section">
              <div className="section-title"><h2>Is it the same tree?</h2><span className="hi-display">सामुदायिक जांच</span></div>
              <p className="muted">Adopt a sapling to help confirm your neighbours' watering photos.</p>
            </section>
          )}
          <Rule left />
          <section className="section">
            <div className="section-title"><h3>How a proof is checked</h3></div>
            <ol className="how">
              <li>Code checks you were within reach of the sapling, and that the photo has not been sent before.</li>
              <li>Some proofs go to a neighbour or the organiser, who compares them with the tree's first photo.</li>
              <li>Two "different" votes, or one from the organiser, undo the credit.</li>
            </ol>
          </section>
        </div>
      </div>
      {error && tree && <div className="error" role="alert">{error}</div>}
    </Shell>
  );
}
