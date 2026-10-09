// Notifications from a sapling to its adopter's phone (Web Push).
// Call enablePush() from a tap: browsers only show the permission prompt on a user action.

import { authHeaders } from "./auth";

const API = import.meta.env.VITE_API_URL as string | undefined;

export type PushResult =
  | "enabled" // subscribed; the sapling has just sent a hello notification
  | "denied" // the person said no, or blocked notifications for this site
  | "unsupported" // this browser cannot do it (or there is no live API)
  | "needs-install" // iPhone or iPad: add the app to the home screen first, then try again
  | "failed"; // something else went wrong; safe to offer the button again

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function pushSupported(): boolean {
  return !!API && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(treeId: string, handle: string): Promise<PushResult> {
  if (isIos() && !installed()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const { publicKey } = await fetch(`${API}/push/key`).then((r) => r.json());
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));

    const res = await fetch(`${API}/trees/${treeId}/subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ subscription: subscription.toJSON(), handle }),
    });
    return res.ok ? "enabled" : "failed";
  } catch {
    return "failed";
  }
}
