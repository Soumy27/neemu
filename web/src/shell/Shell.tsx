// The frame every screen sits in: an optional weather strip, the arch mark and
// wordmark, text tabs with a gold underline, sign-in, and a jali footer.

import type { ReactNode } from "react";
import { signedIn, signIn, signInAvailable, signOut } from "../api/auth";
import { BrandMark } from "./Ornament";

export type Tab = "home" | "near" | "proof" | "grove" | "drive";

const lastTreeKey = "neemu.lastTree";
export function rememberTree(id: string) {
  try { localStorage.setItem(lastTreeKey, id); } catch { /* private mode */ }
}
function lastTree() {
  try { return localStorage.getItem(lastTreeKey); } catch { return null; }
}

export function Shell({ tab, treeId, driveId = "dtu-eco-2026", strip, weather, children }: {
  tab: Tab;
  treeId?: string;
  driveId?: string;
  strip?: { tone: "hot" | "rain"; text: ReactNode } | null;
  weather?: string | null;
  children: ReactNode;
}) {
  const tree = treeId ?? lastTree() ?? "dtu-gate3-017";
  const d = encodeURIComponent(driveId);
  const t = encodeURIComponent(tree);
  const tabs: { id: Tab; href: string; en: string; hi: string; icon: string }[] = [
    { id: "home", href: `?tree=${t}`, en: "My tree", hi: "मेरा पौधा", icon: "potted_plant" },
    { id: "near", href: `?drive=${d}`, en: "Near you", hi: "पास के पौधे", icon: "near_me" },
    { id: "proof", href: `?view=proof&tree=${t}`, en: "Watering", hi: "पानी और फोटो", icon: "photo_camera" },
    { id: "grove", href: `?view=grove&drive=${d}`, en: "The grove", hi: "हरा वन", icon: "forest" },
    { id: "drive", href: `?view=organiser&drive=${d}`, en: "Drive", hi: "अभियान", icon: "monitoring" },
  ];
  const inNow = signedIn();

  return (
    <div className="shell">
      {strip && <div className={`alert-strip ${strip.tone}`} role="status">{strip.text}</div>}
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={`?tree=${t}`} aria-label="Neemu, home">
            <BrandMark />
            <span className="brand-word">Neemu<span className="hi-display">नीमू</span></span>
          </a>
          <nav className="nav" aria-label="Sections">
            {tabs.map((x) => (
              <a key={x.id} href={x.href} className={x.id === tab ? "on" : ""} aria-current={x.id === tab ? "page" : undefined}>
                <span className="ms">{x.icon}</span>
                <span className="nav-label"><span>{x.en}</span><span className="hi">{x.hi}</span></span>
              </a>
            ))}
          </nav>
          <div className="top-right">
            {weather && <span className="weather"><span className="ms">partly_cloudy_day</span> {weather}</span>}
            {signInAvailable && (inNow
              ? <button className="quiet" onClick={() => { signOut(); location.reload(); }}>Sign out</button>
              : <button className="primary" style={{ minHeight: 40, padding: "8px 16px" }} onClick={() => signIn()}>Sign in</button>)}
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <span className="row"><BrandMark className="brand-mark small-mark" /><span className="brand-word">Neemu</span><span className="hi">हर पौधा एक साथी · every sapling, a living friend</span></span>
          <span>Weather by Open-Meteo · Map © OpenStreetMap contributors · Built on AWS</span>
        </div>
      </footer>
    </div>
  );
}
