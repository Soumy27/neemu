// Talks to the real API when VITE_API_URL is set, otherwise to the mock.

import * as mock from "./mock";
import type { ApiError, Drive, NeemuSays, ProofResult, Tree } from "./types";

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

  async proof(id: string, file: File): Promise<ProofResult> {
    if (!BASE) return mock.proof(id, file);
    const { uploadUrl, key } = await call<{ uploadUrl: string; key: string }>(`/trees/${id}/proof-url`, post({}));
    const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
    if (!put.ok) throw new SourceError("s3", `Photo upload failed (HTTP ${put.status})`);
    const pos = await new Promise<GeolocationPosition | null>((resolve) =>
      navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 }) : resolve(null),
    );
    return call(`/trees/${id}/proof`, post({
      key,
      takenAt: new Date().toISOString(),
      lat: pos?.coords.latitude ?? null,
      lng: pos?.coords.longitude ?? null,
    }));
  },

  getDrive: (id: string): Promise<Drive> =>
    BASE ? call(`/drives/${id}`) : mock.getDrive(id),
};
