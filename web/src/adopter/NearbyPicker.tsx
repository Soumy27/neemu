// What the drive link (WhatsApp group or the one poster at the gate) opens:
// saplings near you, unadopted first, nearest first. Tap one to adopt it.

import { useEffect, useState } from "react";
import { api, usingMock } from "../api/client";
import type { Tree } from "../api/types";

const statusDot: Record<Tree["status"], string> = { fine: "🟢", thirsty: "🟠", no_proof: "🔴", likely_dead: "⚫" };

// Demo stand-in when the phone isn't at the drive: DTU, Gate 3.
const DEMO_POS = { lat: 28.7501, lng: 77.1177 };

export function NearbyPicker({ driveId }: { driveId: string }) {
  const [trees, setTrees] = useState<(Tree & { distanceM: number })[] | null>(null);
  const [where, setWhere] = useState<string>("Finding where you are…");

  useEffect(() => {
    const load = (lat: number, lng: number, label: string) => {
      setWhere(label);
      api.nearby(driveId, lat, lng).then(setTrees).catch(() => setWhere("Couldn't load the saplings. Check your connection."));
    };
    if (usingMock) return load(DEMO_POS.lat, DEMO_POS.lng, "Demo: showing saplings as if you were standing at DTU, Gate 3.");
    navigator.geolocation?.getCurrentPosition(
      (p) => load(p.coords.latitude, p.coords.longitude, `Your location, ±${Math.round(p.coords.accuracy)} m`),
      () => setWhere("Allow location so we can show the saplings around you."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [driveId]);

  const free = trees?.filter((t) => !t.adopter) ?? [];
  const taken = trees?.filter((t) => t.adopter) ?? [];

  return (
    <div className="adopter">
      <section className="card">
        <h1>Saplings near you</h1>
        <p className="muted">Pick the one in front of you. It will tell you when it's thirsty, and when it isn't.</p>
        <p className="muted small">{where}</p>
      </section>

      {trees && (
        <section className="card">
          <h2>Need someone ({free.length})</h2>
          {free.length === 0 && <p className="muted">Every sapling here has someone. Ask the organiser about the next drive.</p>}
          <ul className="buddies">
            {free.map((t) => (
              <li key={t.id}>
                <span>{statusDot[t.status]} <strong>{t.name}</strong> · {t.species.split(" (")[0]} · {t.distanceM} m</span>
                <a className="button primary" href={`?tree=${encodeURIComponent(t.id)}`}>This one</a>
              </li>
            ))}
          </ul>
          {taken.length > 0 && <p className="muted small">{taken.length} more nearby already have an adopter.</p>}
        </section>
      )}
    </div>
  );
}
