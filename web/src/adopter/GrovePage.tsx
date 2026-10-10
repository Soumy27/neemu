// The grove (हरा वन): the whole drive as a 3D forest in a wide arch, today,
// or five years on if every sapling survives (a projection, labelled as one).

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Drive, TreeStatus } from "../api/types";
import { Arch, Rule } from "../shell/Ornament";
import { Shell } from "../shell/Shell";
import { nameHi, statusWords } from "../shell/words";
import "./adopter.css";
import { GroveScene } from "./GroveScene";

const order: TreeStatus[] = ["fine", "thirsty", "no_proof", "likely_dead"];

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
      <div className="grove-head">
        <div>
          <h1>{drive?.name ?? "The grove"}</h1>
          <span className="hi-display">हरा वन · every sapling at its place, as tall as it has grown</span>
        </div>
        <div className="seg" role="group" aria-label="When">
          <button className={!future ? "on" : ""} onClick={() => setFuture(false)}>Today <span className="hi">· आज</span></button>
          <button className={future ? "on" : ""} onClick={() => setFuture(true)}>Five years on <span className="hi">· 5 साल बाद</span></button>
        </div>
      </div>

      {drive && (
        <div className="census">
          {order.map((s) => (
            <div key={s}>
              <span className={`mark ${s}`}>{statusWords[s].en} <span className="hi">· {statusWords[s].hi}</span></span>
              <strong className="num">{drive.counts[s]}</strong>
            </div>
          ))}
        </div>
      )}

      <Arch className="grove-arch">
        {!drive ? (
          <div className="tree-loading"><span className="ms">forest</span><span>{error ?? "Planting the grove…"}</span></div>
        ) : (
          <GroveScene trees={drive.trees} future={future} selected={picked} onPick={(id) => setPicked(id || null)} />
        )}
        {future && drive && <div className="grove-note">A projection: every sapling grown and healthy. Today, {alive} of {drive.trees.length} are alive.</div>}
        {tree && (
          <div className="grove-picked rise">
            <div className="hi-display" style={{ fontSize: "1.6rem", color: "var(--emerald)" }}>{nameHi(tree.name)}</div>
            <h3>{tree.name} <span className="tree-id num">№ {tree.id.split("-").pop()}</span></h3>
            <p className={`mark ${tree.status}`}>{statusWords[tree.status].en}</p>
            <p className="muted small">Vitality <span className="num">{tree.health}</span>/100 · growth {tree.growthStage} of 5 · {tree.adopter ? `with ${tree.adopter.handle}` : "needs a guardian"}</p>
            <a className="button primary block" href={`?tree=${encodeURIComponent(tree.id)}`}>Visit {tree.name}</a>
          </div>
        )}
      </Arch>

      <div className="legend">
        <span>Drag to walk around · tap a tree</span>
        <span>Height is growth stage</span>
        <span>Leaf colour is health</span>
        <span>The ring under each tree is its status</span>
      </div>
      <Rule />
    </Shell>
  );
}
