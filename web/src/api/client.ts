// Talks to the real API when VITE_API_URL is set, otherwise to the mock.

import * as mock from "./mock";
import type { ApiError, Buddy, Cover, Drive, NeemuSays, ProofResult, Review, Tree, TreeStatus } from "./types";

const BASE = import.meta.env.VITE_API_URL as string | undefined;
export const usingMock = !BASE;

export class SourceError extends Error {
  source: string;
  constructor(source: string, message: string) {
    super(message);
    this.source = source;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
    BASE ? call(`/trees/${id}`) : mock.getTree(id),

  adopt: (id: string, handle: string): Promise<Tree> =>
    BASE ? call(`/trees/${id}/adopt`, post({ handle })) : mock.adopt(id, handle),

  today: (id: string): Promise<NeemuSays> =>
    BASE ? call(`/trees/${id}/today`) : mock.today(id),

  talk: (id: string, text: string, lang: "hi" | "en"): Promise<NeemuSays> =>
    BASE ? call(`/trees/${id}/talk`, post({ text, lang })) : mock.talk(id, text),

  // The photo comes from the in-app camera; position and its accuracy go with it.
  async proof(id: string, file: File): Promise<ProofResult> {
    const pos = await new Promise<GeolocationPosition | null>((resolve) =>
      navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000 }) : resolve(null),
    );
    const lat = pos?.coords.latitude ?? null;
    const lng = pos?.coords.longitude ?? null;
    const accuracyM = pos?.coords.accuracy ?? null;
    if (!BASE) {
      // In demo mode the phone is not at DTU, so distance is left to the mock.
      return mock.proof(id, file, { distanceM: null, accuracyM: accuracyM && accuracyM <= 50 ? accuracyM : null });
    }
    const { uploadUrl, key } = await call<{ uploadUrl: string; key: string }>(`/trees/${id}/proof-url`, post({}));
    const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
    if (!put.ok) throw new SourceError("s3", `Photo upload failed (HTTP ${put.status})`);
    return call(`/trees/${id}/proof`, post({ key, takenAt: new Date().toISOString(), lat, lng, accuracyM }));
  },

  buddies: (id: string): Promise<Buddy[]> =>
    BASE ? call(`/trees/${id}/buddies`) : mock.buddies(id),

  cover: (id: string, toHandle: string): Promise<Cover> =>
    BASE ? call(`/trees/${id}/cover`, post({ toHandle })) : mock.cover(id, toHandle),

  reviews: (handle: string): Promise<Review[]> =>
    BASE ? call(`/reviews?for=${encodeURIComponent(handle)}`) : mock.reviews(handle),

  review: (proofId: string, verdict: "same" | "unsure" | "different"): Promise<{ review: ProofResult["review"] }> =>
    BASE ? call(`/proofs/${proofId}/review`, post({ verdict })) : mock.review(proofId, verdict),

  nearby: (driveId: string, lat: number, lng: number): Promise<(Tree & { distanceM: number })[]> =>
    BASE ? call(`/drives/${driveId}/nearby?lat=${lat}&lng=${lng}`) : mock.nearby(driveId, lat, lng),

  getDrive: (id: string): Promise<Drive> =>
    BASE ? call(`/drives/${id}`) : mock.getDrive(id),

  remind: (id: string, status: TreeStatus): Promise<{ reminded: number }> =>
    BASE ? call(`/drives/${id}/remind`, post({ status })) : mock.remind(id, status),
};
