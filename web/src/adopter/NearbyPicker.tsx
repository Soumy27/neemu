// Near you (पास के पौधे): what the drive link opens.
// The drive's map in a gold frame, beside a ledger of saplings, nearest first.

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { api, usingMock } from "../api/client";
import type { Tree } from "../api/types";
import { Rule } from "../shell/Ornament";
import { Shell } from "../shell/Shell";
import { daysSince, nameHi, speciesShort, statusWords } from "../shell/words";
import "./adopter.css";
import { SaplingArt } from "./SaplingArt";

const RegisterMap = lazy(() => import("../organiser/RegisterMap").then((m) => ({ default: m.RegisterMap })));

// Demo stand-in when the phone isn't at the drive: DTU, Gate 3.
const DEMO_POS = { lat: 28.7501, lng: 77.1177 };

type Filter = "all" | "free" | "thirsty" | "taken";
type Near = Tree & { distanceM: number };

export function NearbyPicker({ driveId }: { driveId: string }) {
  const [trees, setTrees] = useState<Near[] | null>(null);
  const [where, setWhere] = useState<{ text: string; accuracy: number | null }>({ text: "Finding where you are…", accuracy: null });
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const load = (lat: number, lng: number, text: string, accuracy: number | null) => {
      setWhere({ text, accuracy });
      api.nearby(driveId, lat, lng).then(setTrees).catch(() => setWhere({ text: "Couldn't load the saplings. Check your connection.", accuracy: null }));
    };
    if (usingMock) return load(DEMO_POS.lat, DEMO_POS.lng, "Demo: as if standing at DTU, Gate 3", null);
    // No location (blocked, or a laptop): still show the drive, sorted from its middle, and say so.
    const fromMiddle = () =>
      api.getDrive(driveId).then((d) => {
        const n = d.trees.length || 1;
        const lat = d.trees.reduce((s, t) => s + t.location.lat, 0) / n;
        const lng = d.trees.reduce((s, t) => s + t.location.lng, 0) / n;
        load(lat, lng, "Location is off, so these are sorted from the middle of the drive. Allow location to sort from where you stand.", null);
      }).catch(() => setWhere({ text: "Couldn't load the saplings. Check your connection.", accuracy: null }));
    if (!navigator.geolocation) return void fromMiddle();
    navigator.geolocation.getCurrentPosition(
      (p) => load(p.coords.latitude, p.coords.longitude, "Your location", p.coords.accuracy),
      () => fromMiddle(),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [driveId]);

  const counts = useMemo(() => ({
    all: trees?.length ?? 0,
    free: trees?.filter((t) => !t.adopter).length ?? 0,
    thirsty: trees?.filter((t) => t.water.litresNeeded > 0 && t.status !== "fine").length ?? 0,
    taken: trees?.filter((t) => t.adopter).length ?? 0,
  }), [trees]);

  const shown = (trees ?? []).filter((t) =>
    filter === "free" ? !t.adopter : filter === "thirsty" ? t.water.litresNeeded > 0 && t.status !== "fine" : filter === "taken" ? !!t.adopter : true,
  );
  const ordered = shown;

  // A pin tapped on the map brings its row into view.
  useEffect(() => {
    if (selected) document.getElementById(`row-${selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const chips: { id: Filter; en: string; hi: string }[] = [
    { id: "all", en: "All", hi: "सभी" },
    { id: "free", en: "Needs adopter", hi: "पालक की तलाश" },
    { id: "thirsty", en: "Thirsty now", hi: "प्यासे" },
    { id: "taken", en: "Adopted", hi: "सुरक्षित" },
  ];

  return (
    <Shell tab="near" driveId={driveId}>
      <div className="page-head">
        <div>
          <h1>Saplings near you</h1>
          <span className="hi-display">पास के पौधे · अपने सामने खड़े पौधे को चुनें</span>
        </div>
        <div className="locator">
          <span className="ms">{where.accuracy != null ? "my_location" : "location_searching"}</span>
          <span>{where.text}{where.accuracy != null && <> (±<span className="num">{Math.round(where.accuracy)}</span> m)</>}</span>
        </div>
      </div>
      <Rule left />

      <div className="near-court">
        <div className="map-frame">
          <Suspense fallback={<div className="map-box loading">Unrolling the map…</div>}>
            {trees && trees.length > 0
              ? <RegisterMap trees={shown} selectedId={selected} onSelect={setSelected} />
              : <div className="map-box loading">{trees ? "No saplings in this drive yet." : "Finding the saplings…"}</div>}
          </Suspense>
        </div>

        <div>
          <div className="filters" role="tablist" aria-label="Show">
            {chips.map((c) => (
              <button key={c.id} role="tab" aria-selected={filter === c.id} className={filter === c.id ? "on" : ""} onClick={() => setFilter(c.id)}>
                {c.en} <span className="hi tiny">{c.hi}</span> <span className="num tiny">{counts[c.id]}</span>
              </button>
            ))}
          </div>
          <ul className="sapling-list">
            {ordered.map((t) => {
              const s = statusWords[t.status];
              const litres = Math.round(t.water.litresNeeded);
              return (
                <li key={t.id} id={`row-${t.id}`} className={`sapling-row ${t.adopter ? "taken" : ""} ${t.id === selected ? "picked" : ""}`}>
                  <SaplingArt stage={t.growthStage} health={t.health} photo={t.referencePhotoUrl} />
                  <div>
                    <div className="sapling-name">{t.name}<span className="hi-display">{nameHi(t.name)}</span> <span className="tree-id num">№ {t.id.split("-").pop()}</span></div>
                    <div className="sapling-sub">
                      <span>{speciesShort(t.species)}</span>
                      <span>planted {daysSince(t.plantedOn)} days ago</span>
                      {t.adopter
                        ? <span className={`mark ${t.status}`}>{s.en}, with {t.adopter.handle}</span>
                        : litres > 0 ? <span className="mark thirsty">needs {litres} L today</span> : <span className="mark plain">needs a guardian</span>}
                    </div>
                  </div>
                  <div className="dist num">{Math.round(t.distanceM)}<small>metres</small></div>
                  <div className="row-actions">
                    {t.adopter
                      ? <a className="button quiet" href={`?tree=${encodeURIComponent(t.id)}`}>Visit {t.name}</a>
                      : <a className="button claim" href={`?tree=${encodeURIComponent(t.id)}`}>This one is mine <span className="hi">· यह मेरा है</span><span className="ms">arrow_forward</span></a>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="muted small" style={{ marginTop: 14 }}>
            Can't find it? Step out from under trees or buildings so the GPS settles, then <button className="link" onClick={() => location.reload()}>look again</button>.
          </p>
        </div>
      </div>
    </Shell>
  );
}
