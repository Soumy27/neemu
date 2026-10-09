import { useEffect, useRef, useState } from "react";
import { usingMock } from "../api/client";
import type { Tree } from "../api/types";
import { errorText, organiserApi } from "./organiserApi";
import { PinMap } from "./PinMap";
import type { LatLng } from "./PinMap";
import "./organiser.css";

const SPECIES = [
  "Neem (Azadirachta indica)",
  "Jamun (Syzygium cumini)",
  "Peepal (Ficus religiosa)",
  "Amla (Phyllanthus emblica)",
  "Arjun (Terminalia arjuna)",
];

const LISTEN_MS = 6000;
const WORST_ACCURACY_M = 50;

// "gps": averaged phone position, accuracyM is the best reading. "hand": tapped or dragged on the map.
type Pin = LatLng & { accuracyM: number | null; by: "gps" | "hand"; readings: number };

// Shrink the photo before upload; a reference photo does not need full camera resolution.
async function shrink(file: File, maxSide = 1280): Promise<Blob> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that photo."))), "image/jpeg", 0.8),
  );
}

export default function AddSaplings({ driveId }: { driveId: string }) {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [driveName, setDriveName] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState(SPECIES[0]);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<Tree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const watch = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    organiserApi.getRegister(driveId)
      .then(({ drive }) => {
        setTrees(drive.trees);
        setDriveName(drive.name);
      })
      .catch((e) => setError(errorText(e)));
  }, [driveId]);

  function stopListening() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (timer.current) clearTimeout(timer.current);
    watch.current = null;
    timer.current = null;
    setLocating(false);
  }

  useEffect(() => stopListening, []);

  // Listen for a few seconds and average, weighting the sharper readings more.
  function locate() {
    if (!navigator.geolocation) {
      setGeoNote("This browser has no location. Tap the map where the sapling stands.");
      return;
    }
    stopListening();
    setGeoNote(null);
    setLocating(true);
    let sumW = 0, sumLat = 0, sumLng = 0, best = Infinity, readings = 0;
    watch.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (coords.accuracy > WORST_ACCURACY_M) {
          setGeoNote(`GPS is only accurate to ${Math.round(coords.accuracy)} m here. Waiting for a better reading; you can also tap the map.`);
          return;
        }
        const w = 1 / (coords.accuracy * coords.accuracy);
        sumW += w;
        sumLat += coords.latitude * w;
        sumLng += coords.longitude * w;
        best = Math.min(best, coords.accuracy);
        readings += 1;
        setGeoNote(null);
        setPin({ lat: sumLat / sumW, lng: sumLng / sumW, accuracyM: Math.round(best), by: "gps", readings });
      },
      (e) => {
        stopListening();
        setGeoNote(`Could not get your position (${e.message}). Tap the map where the sapling stands.`);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
    timer.current = setTimeout(stopListening, LISTEN_MS);
  }

  function placeByHand(at: LatLng) {
    stopListening();
    setPin({ ...at, accuracyM: null, by: "hand", readings: 0 });
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const small = await shrink(file);
      if (preview) URL.revokeObjectURL(preview);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function save() {
    if (!pin || !photo) return;
    setSaving(true);
    setError(null);
    try {
      const tree = await organiserApi.addSapling(driveId, {
        name: name.trim() || species.split(" (")[0],
        species,
        lat: pin.lat,
        lng: pin.lng,
        accuracyM: pin.accuracyM,
        photo,
      });
      setAdded((a) => [tree, ...a]);
      setTrees((t) => [...t, tree]);
      setPin(null);
      setName("");
      setPhoto(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="organiser">
      {usingMock && <div className="banner">Demo mode: saplings you add are kept in this browser tab only.</div>}

      <header className="org-head">
        <div>
          <h1>Add saplings</h1>
          <p className="muted">{driveName} · {trees.length} on the register · nothing to print or attach to the tree</p>
        </div>
        <a className="button" href={`?view=organiser&drive=${encodeURIComponent(driveId)}`}>Back to register</a>
      </header>

      <div className="org-main">
        <section className="map-col">
          <PinMap trees={trees} pin={pin} onPlace={placeByHand} />
        </section>

        <section className="add-col">
          <div className="card step">
            <h2>1. Stand next to the sapling</h2>
            <div className="row wrap">
              <button className="primary" disabled={locating} onClick={locate}>{locating ? "Reading your position…" : pin ? "Read my position again" : "Use my position"}</button>
              <span className="muted small">or tap the map</span>
            </div>
            {pin && (
              <p className="pin-line">
                {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                <span className="muted small">
                  {pin.by === "gps" ? ` · GPS accurate to ${pin.accuracyM} m, ${pin.readings} readings averaged` : " · placed by hand"}
                </span>
              </p>
            )}
            {pin && <p className="muted small">Not quite right? Drag the red pin onto the tree.</p>}
            {geoNote && <p className="muted small" role="status">{geoNote}</p>}
          </div>

          <div className="card step">
            <h2>2. Take its reference photo</h2>
            <p className="muted small">The whole sapling and its guard, with whatever is behind it. Every watering photo is checked against this one.</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()}>{photo ? "Retake photo" : "📷 Take photo"}</button>
            {preview && <img className="ref-preview" src={preview} alt="Reference photo preview" />}
          </div>

          <div className="card step">
            <h2>3. Name it</h2>
            <div className="row wrap">
              <select value={species} onChange={(e) => setSpecies(e.target.value)} aria-label="Species">
                {SPECIES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Name (${species.split(" (")[0]})`} aria-label="Name" />
            </div>
            <button className="primary save" disabled={!pin || !photo || saving} onClick={save}>
              {saving ? "Saving…" : "Add to the register"}
            </button>
            {(!pin || !photo) && <p className="muted small">Needs {[!pin && "a position", !photo && "a photo"].filter(Boolean).join(" and ")}.</p>}
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          {added.length > 0 && (
            <div className="card">
              <h2>Added just now ({added.length})</h2>
              <ul className="added">
                {added.map((t) => (
                  <li key={t.id}><strong>{t.name}</strong> <code>{t.id}</code> <span className="muted small">{t.location.lat.toFixed(5)}, {t.location.lng.toFixed(5)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
