import { useEffect, useMemo, useState } from "react";
import { api, SourceError, usingMock } from "../api/client";
import type { Drive, Tree, TreeStatus } from "../api/types";
import { RegisterMap } from "./RegisterMap";
import { daysSince, statusHint, statusLabel, statusOrder } from "./status";
import "./organiser.css";

function errorText(e: unknown) {
  return e instanceof SourceError ? `${e.source} failed: ${e.message}` : String(e);
}

export default function OrganiserApp({ driveId }: { driveId: string }) {
  const [drive, setDrive] = useState<Drive | null>(null);
  const [filter, setFilter] = useState<TreeStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDrive(driveId).then(setDrive).catch((e) => setError(errorText(e)));
  }, [driveId]);

  const rows = useMemo(() => {
    if (!drive) return [];
    const shown = filter ? drive.trees.filter((t) => t.status === filter) : drive.trees;
    return [...shown].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) || a.health - b.health);
  }, [drive, filter]);

  async function onRemind() {
    setReminding(true);
    setError(null);
    try {
      setReminded((await api.remind(driveId, "thirsty")).reminded);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setReminding(false);
    }
  }

  function onSelect(id: string) {
    setSelectedId(id);
    document.getElementById(`row-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  if (!drive) return <div className="loading">{error ?? "Opening the register…"}</div>;

  const total = drive.trees.length;
  const alive = total - drive.counts.likely_dead;
  const selected: Tree | undefined = drive.trees.find((t) => t.id === selectedId);

  return (
    <div className="organiser">
      {usingMock && <div className="banner">Demo data: these saplings and adopters are examples. Weather numbers are real (Open-Meteo, Delhi).</div>}

      <header className="org-head">
        <div>
          <h1>{drive.name}</h1>
          <p className="muted">{drive.organiser} · survival register · {alive} of {total} saplings alive</p>
        </div>
        <a className="button" href={`?view=tags&drive=${encodeURIComponent(driveId)}`}>Print QR tags</a>
      </header>

      <div className="tiles">
        {statusOrder.map((s) => (
          <button key={s} className={`tile tile-${s}`} aria-pressed={filter === s} onClick={() => setFilter(filter === s ? null : s)}>
            <span className="tile-count">{drive.counts[s]}</span>
            <span className="tile-label"><i className={`dot dot-${s}`} />{statusLabel[s]}</span>
            <span className="muted small">{statusHint[s]}</span>
          </button>
        ))}
      </div>

      <section className="card remind">
        <div>
          <h2>{drive.counts.thirsty} saplings need water today</h2>
          <p className="muted">Each one works this out from today's weather and its last confirmed watering.</p>
        </div>
        <button className="primary" disabled={reminding || drive.counts.thirsty === 0} onClick={onRemind}>
          {reminding ? "Sending…" : "Remind their adopters"}
        </button>
        {reminded !== null && <p className="result accepted" role="status">Reminder sent to {reminded} adopters.</p>}
      </section>

      <div className="org-main">
        <section className="map-col">
          <RegisterMap trees={rows} selectedId={selectedId} onSelect={onSelect} />
          {selected && (
            <div className="card picked">
              <div className="name-row">
                <div>
                  <h2>{selected.name} <span className="muted small">{selected.id}</span></h2>
                  <p className="muted">{selected.species} · planted {selected.plantedOn}</p>
                </div>
                <span className={`pill pill-${selected.status}`}>{statusLabel[selected.status]}</span>
              </div>
              <table className="facts">
                <tbody>
                  <tr><td>Adopter</td><td>{selected.adopter?.handle ?? "nobody yet"}</td></tr>
                  <tr><td>Last confirmed watering</td><td>{daysSince(selected.water.lastWateredAt)}</td></tr>
                  <tr><td>Water needed now</td><td>{selected.water.litresNeeded} L</td></tr>
                  <tr><td>Health</td><td>{selected.health}/100</td></tr>
                </tbody>
              </table>
              <p><a href={`?tree=${encodeURIComponent(selected.id)}`}>Open this tree</a></p>
            </div>
          )}
        </section>

        <section className="card table-col">
          <div className="name-row">
            <h2>{filter ? statusLabel[filter] : "All saplings"} ({rows.length})</h2>
            {filter && <button onClick={() => setFilter(null)}>Show all</button>}
          </div>
          <div className="table-scroll">
            <table className="register">
              <thead>
                <tr><th>Tag</th><th>Sapling</th><th>Adopter</th><th>Status</th><th className="num">Health</th><th className="num">Needs</th><th>Last watered</th></tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} id={`row-${t.id}`} className={t.id === selectedId ? "is-selected" : undefined} onClick={() => setSelectedId(t.id)}>
                    <td><code>{t.id}</code></td>
                    <td>{t.name}</td>
                    <td>{t.adopter?.handle ?? <span className="muted">nobody yet</span>}</td>
                    <td><span className={`pill pill-${t.status}`}>{statusLabel[t.status]}</span></td>
                    <td className="num">{t.health}</td>
                    <td className="num">{t.water.litresNeeded} L</td>
                    <td>{daysSince(t.water.lastWateredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
