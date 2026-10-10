// Saplings Near You (पास के पौधे): what the drive link opens.
// A map, filter chips, and a card per sapling, nearest first. Tap one to adopt it.

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { api, usingMock } from "../api/client";
import type { Tree } from "../api/types";
import { Shell } from "../shell/Shell";
import { daysSince, nameHi, speciesLatin, speciesShort, statusWords } from "../shell/words";
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
    navigator.geolocation?.getCurrentPosition(
      (p) => load(p.coords.latitude, p.coords.longitude, "Your location", p.coords.accuracy),
      () => setWhere({ text: "Allow location so we can show the saplings around you.", accuracy: null }),
      { enableHighAccuracy: true, timeout: 10000 },
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
  const ordered = selected ? [...shown].sort((a, b) => Number(b.id === selected) - Number(a.id === selected)) : shown;

  const chips: { id: Filter; en: string; hi: string }[] = [
    { id: "all", en: "All", hi: "सभी" },
    { id: "free", en: "Needs adopter", hi: "पालक की तलाश" },
    { id: "thirsty", en: "Thirsty now", hi: "प्यासे" },
    { id: "taken", en: "Adopted", hi: "सुरक्षित" },
  ];

  return (
    <Shell tab="near" driveId={driveId}>
      <div className="near-head">
        <div>
          <span className="pill mint"><span className="ms outline">explore</span>Location-based discovery</span>
          <h1 className="near-title" style={{ marginTop: 8 }}><span className="hi">पास के पौधे</span> · Saplings Near You</h1>
          <p className="muted"><span className="hi">अपने सामने खड़े पौधे को चुनें</span> (pick the one right in front of you)</p>
        </div>
        <div className="gps-pill">
          <span className="gps-dot" />
          <div>
            <strong>{where.accuracy != null ? "GPS active" : "Location"}</strong>{where.accuracy != null && <span className="sky-text"> ±{Math.round(where.accuracy)} m</span>}
            <div className="muted">{where.text}</div>
          </div>
        </div>
      </div>

      <section className="card map-card">
        <Suspense fallback={<div className="map-box loading">Loading the map…</div>}>
          {trees && trees.length > 0 ? <RegisterMap trees={shown} selectedId={selected} onSelect={setSelected} /> : <div className="map-box loading">{trees ? "No saplings in this drive yet." : "Loading saplings…"}</div>}
        </Suspense>
        <div className="filters">
          {chips.map((c) => (
            <button key={c.id} className={filter === c.id ? "on" : ""} onClick={() => setFilter(c.id)}>
              {c.en} · <span className="hi">{c.hi}</span> ({counts[c.id]})
            </button>
          ))}
        </div>
      </section>

      <div className="row" style={{ margin: "26px 0 14px" }}>
        <h2 style={{ margin: 0 }}><span className="ms outline">forest</span> <span className="hi">प्रतीक्षारत पौधे</span> · Nearby saplings</h2>
        <span style={{ flex: 1 }} />
        <span className="pill mint">Nearest first</span>
      </div>

      <div className="sapling-grid">
        {ordered.map((t) => {
          const s = statusWords[t.status];
          const litres = Math.round(t.water.litresNeeded);
          const dry = t.water.deficitMm > 8;
          return (
            <section key={t.id} className={`card sapling-card ${t.adopter ? "taken" : ""} ${t.id === selected ? "picked" : ""}`}>
              <div className="sapling-top">
                <span className="pill sky"><span className="ms">near_me</span>{t.distanceM} m away</span>
                {t.adopter
                  ? <span className="pill mint"><span className="ms">verified</span>Adopted by {t.adopter.handle} · {s.en}</span>
                  : litres > 0 ? <span className="pill amber"><span className="ms">water_drop</span>Needs {litres} L today</span>
                    : <span className="pill"><span className="ms">favorite</span>Needs an adopter</span>}
              </div>
              <div className="sapling-body">
                <SaplingArt stage={t.growthStage} health={t.health} photo={t.referencePhotoUrl} />
                <div>
                  <div className="sapling-name"><span className="hi">{nameHi(t.name)}</span> #{t.id.split("-").pop()}<span className="en-name">{t.name}</span></div>
                  <div className="muted small"><em>{speciesLatin(t.species)}</em> · {speciesShort(t.species)}</div>
                  <ul className="sapling-meta">
                    <li><span className="ms outline">calendar_month</span>Planted {daysSince(t.plantedOn)} days ago</li>
                    <li><span className="ms outline">location_on</span>{t.location.label}</li>
                    <li><span className="ms outline">eco</span>Health {t.health}/100 · stage {t.growthStage} of 5</li>
                  </ul>
                </div>
              </div>
              <div className="metric-row">
                <div>Soil water<strong className={dry ? "dry" : ""}>{dry ? `${t.water.deficitMm} mm short` : "Fine"}</strong></div>
                <div>Today<strong>{litres > 0 ? `${litres} L` : "No water"}</strong></div>
                <div>Adoption<strong>{t.adopter ? "Taken" : "Available"}</strong></div>
              </div>
              {t.adopter ? (
                <a className="button block" href={`?tree=${encodeURIComponent(t.id)}`}><span className="ms outline">visibility</span>Say hello · <span className="hi">देखें</span></a>
              ) : (
                <a className="button primary block" href={`?tree=${encodeURIComponent(t.id)}`}><span className="ms">favorite</span>This one · <span className="hi">यह पौधा मेरा है</span></a>
              )}
            </section>
          );
        })}
      </div>

      <div className="help-strip">
        <span className="ms outline big-icon green-text">help</span>
        <div>
          <strong><span className="hi">पौधा खोजने में समस्या?</span> Having trouble finding it?</strong>
          <div className="muted small">Step out from under trees or buildings so the GPS settles, then reload. The map shows each sapling's pin from the day it was registered.</div>
        </div>
        <span style={{ flex: 1 }} />
        <button onClick={() => location.reload()}><span className="ms">my_location</span>Refresh location</button>
      </div>
    </Shell>
  );
}
