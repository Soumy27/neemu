// "Let Neemu call you": turns on phone notifications for this tree (Web Push).
// The permission prompt has to come from a tap, so this is a switch the person flips.

import { useState } from "react";
import { enablePush, pushSupported, type PushResult } from "../api/push";

const said: Record<PushResult, string> = {
  enabled: "Done. Neemu has just sent you a hello, and will call you when it's thirsty.",
  "needs-install": "On iPhone, tap Share, then \"Add to Home Screen\". Open Neemu from there and flip this again.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then try again.",
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
    <section className="section callme">
      <div className="row">
        <div className="grow">
          <h3>Let {treeName} call you <span className="hi muted small">· नीमू आपको याद दिलाएगा</span></h3>
          <p className="muted small">A notification at 6 AM, only on days it needs water.</p>
        </div>
        <button role="switch" aria-checked={on} aria-label={`Notifications from ${treeName}`} className={`switch ${on ? "on" : ""}`} onClick={tap} disabled={busy}><span /></button>
      </div>
      {result && <p className={on ? "mark fine" : "muted small"}>{said[result]}</p>}
    </section>
  );
}
