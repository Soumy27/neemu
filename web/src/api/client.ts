// Talks to the real API when VITE_API_URL is set, otherwise to the mock.

import * as mock from "./mock";
import type { ApiError, Buddy, Cover, Drive, NeemuSays, ProofResult, Review, Tree, TreeStatus } from "./types";

const API = import.meta.env.VITE_API_URL as string | undefined;
// VITE_API_LIVE lists the calls the backend already serves (comma-separated, e.g. "getTree,today,getDrive");
// the rest stay on the mock. Unset means every call goes to the API.
const LIVE = (import.meta.env.VITE_API_LIVE as string | undefined)?.split(",").map((x) => x.trim());
const live = (name: string) => !!API && (!LIVE || LIVE.includes(name));
export const usingMock = !API || !!LIVE;
export const partlyLive = !!API && !!LIVE;
const replayDate = ({ heatwave: "2026-05-19", rain: "2026-08-03", today: null } as const)[mock.scenario];

export class SourceError extends Error {
  source: string;
  constructor(source: string, message: string) {
    super(message);
    this.source = source;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (body as ApiError | null)?.error;
    throw new SourceError(e?.source ?? "api", e?.message ?? `HTTP ${res.status}`);
  }
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  getTree: (id: string): Promise<Tree> =>
    live('getTree') ? call(`/trees/${id}`) : mock.getTree(id),

  adopt: (id: string, handle: string): Promise<Tree> =>
    live('adopt') ? call(`/trees/${id}/adopt`, post({ handle })) : mock.adopt(id, handle),

  today: (id: string): Promise<NeemuSays> =>
    live('today') ? call(`/trees/${id}/today${replayDate ? `?date=${replayDate}` : ""}`) : mock.today(id),

  talk: (id: string, text: string, lang: "hi" | "en"): Promise<NeemuSays> =>
    live('talk') ? call(`/trees/${id}/talk`, post({ text, lang })) : mock.talk(id, text),

  // The photo comes from the in-app camera; position and its accuracy go with it.
  // handle = who is sending it: the adopter, or a buddy covering today.
  async proof(id: string, file: File, handle: string): Promise<ProofResult> {
    const pos = await new Promise<GeolocationPosition | null>((resolve) =>
      navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000 }) : resolve(null),
    );
    const lat = pos?.coords.latitude ?? null;
    const lng = pos?.coords.longitude ?? null;
    const accuracyM = pos?.coords.accuracy ?? null;
    if (!live("proof")) {
      // In demo mode the phone is not at DTU, so distance is left to the mock.
      return mock.proof(id, file, { distanceM: null, accuracyM: accuracyM && accuracyM <= 50 ? accuracyM : null });
    }
    const { uploadUrl, key } = await call<{ uploadUrl: string; key: string }>(`/trees/${id}/proof-url`, post({}));
    const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
    if (!put.ok) throw new SourceError("s3", `Photo upload failed (HTTP ${put.status})`);
    return call(`/trees/${id}/proof`, post({ key, takenAt: new Date().toISOString(), lat, lng, accuracyM, handle }));
  },

  buddies: (id: string): Promise<Buddy[]> =>
    live('buddies') ? call(`/trees/${id}/buddies`) : mock.buddies(id),

  cover: (id: string, toHandle: string): Promise<Cover> =>
    live('cover') ? call(`/trees/${id}/cover`, post({ toHandle })) : mock.cover(id, toHandle),

  reviews: (handle: string): Promise<Review[]> =>
    live('reviews') ? call(`/reviews?for=${encodeURIComponent(handle)}`) : mock.reviews(handle),

  // by = the reviewer's handle; the backend refuses a vote without it so it can never count as the organiser.
  review: (proofId: string, verdict: "same" | "unsure" | "different", by: string): Promise<{ review: ProofResult["review"] }> =>
    live('review') ? call(`/proofs/${proofId}/review`, post({ verdict, by })) : mock.review(proofId, verdict),

  nearby: (driveId: string, lat: number, lng: number): Promise<(Tree & { distanceM: number })[]> =>
    live('nearby') ? call(`/drives/${driveId}/nearby?lat=${lat}&lng=${lng}`) : mock.nearby(driveId, lat, lng),

  getDrive: (id: string): Promise<Drive> =>
    live('getDrive') ? call(`/drives/${id}`) : mock.getDrive(id),

  remind: (id: string, status: TreeStatus): Promise<{ reminded: number }> =>
    live('remind') ? call(`/drives/${id}/remind`, post({ status })) : mock.remind(id, status),
};
