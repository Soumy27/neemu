// The frame every screen sits in: weather strip, brand, the pill tab bar,
// sign-in, and the footer. Links carry the tree and drive along.

import type { ReactNode } from "react";
import { signedIn, signIn, signInAvailable, signOut } from "../api/auth";

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
  strip?: { tone: "hot" | "rain" | "plain"; text: ReactNode } | null;
  weather?: string | null;
  children: ReactNode;
}) {
  const tree = treeId ?? lastTree() ?? "dtu-gate3-017";
  const d = encodeURIComponent(driveId);
  const t = encodeURIComponent(tree);
  const tabs: { id: Tab; href: string; en: string; hi: string; icon: string }[] = [
    { id: "home", href: `?tree=${t}`, en: "Tree Home", hi: "मेरा पौधा", icon: "potted_plant" },
    { id: "near", href: `?drive=${d}`, en: "Saplings Near You", hi: "पास के पौधे", icon: "near_me" },
    { id: "proof", href: `?view=proof&tree=${t}`, en: "Watering & Proof", hi: "पानी और फोटो", icon: "photo_camera" },
    { id: "grove", href: `?view=grove&drive=${d}`, en: "Living Grove", hi: "हरा वन", icon: "forest" },
    { id: "drive", href: `?view=organiser&drive=${d}`, en: "Drive Mission Control", hi: "अभियान केंद्र", icon: "monitoring" },
  ];
  const inNow = signedIn();

  return (
    <div className="shell">
      {strip && <div className={`alert-strip ${strip.tone}`}>{strip.text}</div>}
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={`?tree=${t}`}>
            <img className="brand-mark" src="/icon-192.png" alt="" />
            <div>
              <div className="brand-name">Neemu<span className="hi">नीमू</span></div>
              <div className="brand-sub"><span className="hi">हर पौधा एक साथी</span> · Every sapling, a living friend</div>
            </div>
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
            {weather && <span className="pill mint weather"><span className="ms">partly_cloudy_day</span>{weather}</span>}
            {signInAvailable && (inNow ? (
              <button onClick={() => { signOut(); location.reload(); }}><span className="ms">logout</span>Sign out</button>
            ) : (
              <button className="primary" style={{ minHeight: 40, padding: "8px 16px" }} onClick={() => signIn()}><span className="ms">login</span>Sign in</button>
            ))}
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <span><span className="ms">eco</span> Neemu · <span className="hi">हरित भविष्य के लिए जनभागीदारी</span></span>
          <span>Weather: Open-Meteo · Map © OpenStreetMap contributors · Built on AWS</span>
        </div>
      </footer>
    </div>
  );
}
