// "Let Neemu call you": turns on phone notifications for this tree (Web Push).
// The permission prompt has to come from a tap, so this is a switch the person flips.

import { useState } from "react";
import { enablePush, pushSupported, type PushResult } from "../api/push";

const said: Record<PushResult, string> = {
  enabled: "Done. Neemu just sent you a hello. It will call you when it's thirsty.",
  "needs-install": "On iPhone, first tap Share ⬆︎ then \"Add to Home Screen\", open Neemu from there, and flip this again.",
  denied: "Notifications are blocked for this site. Turn them on in your browser's site settings, then try again.",
  unsupported: "This browser can't show notifications.",
  failed: "That didn't work. Try again in a moment.",
};

// An iPhone browser reports no push support until the app is on the home screen,
// so show the switch there too: enablePush() answers "needs-install" and we explain.
const iosNotInstalled = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

export function CallMe({ treeId, treeName, handle }: { treeId: string; treeName: string; handle: string }) {
  const [result, setResult] = useState<PushResult | null>(null);
  const [busy, setBusy] = useState(false);
  if (!pushSupported() && !iosNotInstalled()) return null;
  const on = result === "enabled";

  async function tap() {
    if (on) return;
    setBusy(true);
    try {
      setResult(await enablePush(treeId, handle));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card callme">
      <div className="row">
        <span className="bell"><span className="ms">notifications_active</span></span>
        <div>
          <h2 style={{ margin: 0 }}>Let {treeName} call you</h2>
          <div className="muted small hi">नीमू आपको याद दिलाएगा</div>
        </div>
        <span style={{ flex: 1 }} />
        <button role="switch" aria-checked={on} aria-label="Turn on notifications" className={`switch ${on ? "on" : ""}`} onClick={tap} disabled={busy}><span /></button>
      </div>
      <div className="inner row small">
        <span><span className="ms outline">schedule</span> Morning check</span>
        <span style={{ flex: 1 }} />
        <strong className="green-text">6:00 AM</strong>
      </div>
      <p className="muted small">A notification only on days it needs water. Nothing on days it doesn't.</p>
      {result && <p className={on ? "green-text small" : "muted small"}>{said[result]}</p>}
    </section>
  );
}
