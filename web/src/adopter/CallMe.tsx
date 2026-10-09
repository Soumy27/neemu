// "Let Neemu call you": turns on phone notifications for this tree (Web Push).
// The permission prompt has to come from a tap, so this is a button, not automatic.

import { useState } from "react";
import { enablePush, pushSupported, type PushResult } from "../api/push";

const said: Record<PushResult, string> = {
  enabled: "Done. Neemu just sent you a hello. It will call you when it's thirsty.",
  "needs-install": "On iPhone, first tap Share ⬆︎ then \"Add to Home Screen\", open Neemu from there, and tap this again.",
  denied: "Notifications are blocked for this site. Turn them on in your browser's site settings, then tap again.",
  unsupported: "This browser can't show notifications.",
  failed: "That didn't work. Try again in a moment.",
};

// An iPhone browser reports no push support until the app is on the home screen,
// so show the button there too: enablePush() answers "needs-install" and we explain.
const iosNotInstalled = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

export function CallMe({ treeId, treeName, handle }: { treeId: string; treeName: string; handle: string }) {
  const [result, setResult] = useState<PushResult | null>(null);
  const [busy, setBusy] = useState(false);
  if (!pushSupported() && !iosNotInstalled()) return null;

  async function tap() {
    setBusy(true);
    try {
      setResult(await enablePush(treeId, handle));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>📞 Let {treeName} call you</h2>
      <p className="muted">Get a notification on hot, dry days. Nothing on days it doesn't need you.</p>
      {result !== "enabled" && (
        <button className="primary" onClick={tap} disabled={busy}>{busy ? "Asking…" : "Turn on notifications"}</button>
      )}
      {result && <p className={result === "enabled" ? "" : "muted small"}>{said[result]}</p>}
    </section>
  );
}
