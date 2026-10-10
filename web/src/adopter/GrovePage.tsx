// Living Grove (हरा वन): the whole drive as a 3D forest, today, or five years on
// if every sapling survives (a projection, labelled as one).

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Drive, TreeStatus } from "../api/types";
import { Shell } from "../shell/Shell";
import { nameHi, statusWords } from "../shell/words";
import "./adopter.css";
import { GroveScene } from "./GroveScene";

const dot: Record<TreeStatus, string> = { fine: "#43a047", thirsty: "#f59e0b", no_proof: "#ea580c", likely_dead: "#6b7280" };

export function GrovePage({ driveId }: { driveId: string }) {
  const [drive, setDrive] = useState<Drive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [future, setFuture] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    api.getDrive(driveId).then(setDrive).catch((e) => setError(String(e)));
  }, [driveId]);

  const tree = drive?.trees.find((t) => t.id === picked) ?? null;
  const alive = drive ? drive.trees.length - drive.counts.likely_dead : 0;

  return (
    <Shell tab="grove" driveId={driveId}>
      <div className="near-head">
        <div>
          <span className="pill mint"><span className="ms outline">forest</span>Living Grove · 3D</span>
          <h1 className="near-title" style={{ marginTop: 8 }}><span className="hi">हरा वन</span> · {drive?.name ?? "The drive"}</h1>
          <p className="muted">Every sapling at its real spot, as tall as it has grown, as green as it is healthy. Drag to walk around, tap a tree.</p>
        </div>
        <div className="row wrap">
          <button className={!future ? "primary" : ""} onClick={() => setFuture(false)}><span className="ms">today</span>Today · <span className="hi">आज</span></button>
          <button className={future ? "primary" : ""} onClick={() => setFuture(true)}><span className="ms">update</span>5 years later · <span className="hi">5 साल बाद</span></button>
        </div>
      </div>

      {drive && (
        <div className="grove-summary">
          {(["fine", "thirsty", "no_proof", "likely_dead"] as TreeStatus[]).map((s) => (
            <div key={s} className="stat-tile">
              <span className="eyebrow" style={{ color: dot[s] }}><span className="ms">{statusWords[s].icon}</span>{statusWords[s].en} · <span className="hi">{statusWords[s].hi}</span></span>
              <strong>{drive.counts[s]}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="grove-stage">
        {!drive ? (
          <div className="tree-loading"><span className="ms">forest</span><span>{error ?? "Planting the grove…"}</span></div>
        ) : (
          <GroveScene trees={drive.trees} future={future} selected={picked} onPick={(id) => setPicked(id || null)} />
        )}
        {future && <div className="grove-tip pill sky"><span className="ms">info</span>Projection: every sapling grown and healthy. Today, {alive} of {drive?.trees.length ?? 0} are alive.</div>}
        {tree && (
          <section className="card grove-picked rise">
            <div className="name-row">
              <div>
                <h2 style={{ margin: 0 }}>{tree.name} · <span className="hi">{nameHi(tree.name)}</span></h2>
                <p className="muted small">#{tree.id.split("-").pop()} · {tree.species.split(" (")[0]}</p>
              </div>
              <span className="pill" style={{ background: dot[tree.status], color: "#fff" }}>{statusWords[tree.status].en}</span>
            </div>
            <p className="small">Health {tree.health}/100 · stage {tree.growthStage} of 5{tree.adopter ? ` · cared for by ${tree.adopter.handle}` : " · needs an adopter"}</p>
            <a className="button primary block" href={`?tree=${encodeURIComponent(tree.id)}`}><span className="ms">potted_plant</span>Open {tree.name}</a>
          </section>
        )}
      </div>

      <div className="grove-legend" style={{ marginTop: 14 }}>
        {(["fine", "thirsty", "no_proof", "likely_dead"] as TreeStatus[]).map((s) => (
          <span key={s} className="pill"><span className="dot" style={{ background: dot[s] }} />{statusWords[s].en}</span>
        ))}
        <span className="pill"><span className="ms outline">height</span>Height = growth stage</span>
        <span className="pill"><span className="ms outline">eco</span>Leaf colour = health</span>
      </div>
    </Shell>
  );
}
