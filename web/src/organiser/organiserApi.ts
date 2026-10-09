// Organiser-only calls: registering saplings and the same-tree review queue.
// Shapes follow docs/api-contract.md; the one path marked "assumed" is not in it yet.

import { api, SourceError, usingMock } from "../api/client";
import type { ApiError, Drive, Tree, TreeStatus } from "../api/types";

const BASE = import.meta.env.VITE_API_URL as string | undefined;

export interface NewSapling {
  name: string;
  species: string;
  lat: number;
  lng: number;
  accuracyM: number | null; // null when the pin was placed or corrected by hand
  photo: Blob;
}

export interface Review {
  proofId: string;
  treeId: string;
  treeName: string;
  proofPhotoUrl: string;
  referencePhotoUrl: string | null;
  takenAt: string;
  distanceM: number | null;
  accuracyM: number | null;
}

export type ReviewVerdict = "same" | "unsure" | "different";
export type ReviewState = "none" | "pending" | "confirmed" | "rejected";

export interface Register {
  drive: Drive;
  referencePhotos: Record<string, string>; // tree id → reference photo
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

export function errorText(e: unknown) {
  return e instanceof SourceError ? `${e.source} failed: ${e.message}` : String(e);
}

export const organiserApi = {
  async getRegister(driveId: string): Promise<Register> {
    const drive = await api.getDrive(driveId);
    if (usingMock) return mockRegister(drive);
    const referencePhotos: Record<string, string> = {};
    for (const t of drive.trees) {
      if (t.referencePhotoUrl) referencePhotos[t.id] = t.referencePhotoUrl;
    }
    return { drive, referencePhotos };
  },

  async addSapling(driveId: string, s: NewSapling): Promise<Tree> {
    if (usingMock) return mockAddSapling(driveId, s);
    // Assumed: an upload URL for reference photos, like the proof one.
    const { uploadUrl, key } = await call<{ uploadUrl: string; key: string }>(`/drives/${driveId}/photo-url`, post({}));
    const put = await fetch(uploadUrl, { method: "PUT", body: s.photo, headers: { "content-type": s.photo.type } });
    if (!put.ok) throw new SourceError("s3", `Photo upload failed (HTTP ${put.status})`);
    return call(`/drives/${driveId}/trees`, post({
      name: s.name, species: s.species, lat: s.lat, lng: s.lng, accuracyM: s.accuracyM, referencePhotoKey: key,
    }));
  },

  // The organiser reviews under the drive's organiser name, as the contract's `for` handle.
  getReviews: (drive: Drive): Promise<Review[]> =>
    usingMock ? mockReviews(drive.id) : call(`/reviews?for=${encodeURIComponent(drive.organiser)}`),

  review: (proofId: string, verdict: ReviewVerdict): Promise<{ review: ReviewState }> =>
    usingMock ? mockReview(proofId, verdict) : call(`/proofs/${proofId}/review`, post({ verdict })),
};

// ---- Mock, used until the API is live. Added saplings live in this browser tab only. ----

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STORE = "neemu.mock.addedSaplings";

interface Added { tree: Tree; photo: string }

function readAdded(): Added[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
}

function mockRegister(drive: Drive): Register {
  const added = readAdded().filter((a) => a.tree.driveId === drive.id);
  const trees = [...drive.trees, ...added.map((a) => a.tree)];
  const counts = { fine: 0, thirsty: 0, no_proof: 0, likely_dead: 0 } as Record<TreeStatus, number>;
  trees.forEach((t) => counts[t.status]++);
  return {
    drive: { ...drive, trees, counts },
    referencePhotos: Object.fromEntries(added.map((a) => [a.tree.id, a.photo])),
  };
}

const toDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(b);
});

async function mockAddSapling(driveId: string, s: NewSapling): Promise<Tree> {
  await wait(600);
  const drive = await api.getDrive(driveId);
  const added = readAdded();
  const n = drive.trees.length + added.length + 1;
  const photo = await toDataUrl(s.photo);
  const tree: Tree = {
    ...drive.trees[0],
    referencePhotoUrl: photo,
    id: `${driveId}-${String(n).padStart(3, "0")}`,
    name: s.name,
    species: s.species,
    plantedOn: new Date().toISOString().slice(0, 10),
    driveId,
    location: { lat: s.lat, lng: s.lng, label: drive.trees[0].location.label },
    adopter: null,
    status: "fine",
    health: 70,
    growthStage: 1,
    streakDays: 0,
    litresSaved: 0,
    water: { ...drive.trees[0].water, deficitMm: 0, litresNeeded: 0, lastWateredAt: null },
  };
  added.push({ tree, photo });
  try {
    sessionStorage.setItem(STORE, JSON.stringify(added));
  } catch {
    throw new SourceError("browser storage", "No room left to keep demo saplings in this tab.");
  }
  return tree;
}

// Drawn stand-ins for photos, so the queue has something to compare in demo mode.
function sketch(hue: number, wet: boolean, lean: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
<rect width="320" height="240" fill="#cfe3ee"/><rect y="150" width="320" height="90" fill="#b9a680"/>
<rect x="0" y="70" width="320" height="80" fill="hsl(${hue} 30% 62%)"/><rect x="${40 + hue}" y="84" width="46" height="66" fill="hsl(${hue} 35% 42%)"/>
<ellipse cx="160" cy="196" rx="62" ry="18" fill="${wet ? "#5b4630" : "#a08a62"}"/>
<path d="M160 196 Q${160 + lean} 150 ${160 + lean * 2} 112" stroke="#5a3d22" stroke-width="6" fill="none"/>
<circle cx="${160 + lean * 2}" cy="100" r="26" fill="#3f8a3c"/><circle cx="${140 + lean * 2}" cy="112" r="16" fill="#4c9a47"/>
<g stroke="#222" stroke-width="3"><path d="M118 200V120M202 200V120M118 150H202M118 180H202"/></g>
<text x="8" y="232" font-family="sans-serif" font-size="11" fill="#333">example drawing, not a photo</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

let queue: Review[] | null = null;

async function mockReviews(driveId: string): Promise<Review[]> {
  await wait(300);
  if (!queue) {
    const { trees } = await api.getDrive(driveId);
    const pick = trees.filter((t) => t.adopter).slice(0, 3);
    const cases = [
      { hue: 20, proofHue: 20, lean: 6, distanceM: 4, accuracyM: 8, mins: 35 },
      { hue: 200, proofHue: 200, lean: -8, distanceM: 21, accuracyM: 38, mins: 95 },
      { hue: 120, proofHue: 300, lean: 4, distanceM: 9, accuracyM: 12, mins: 180 },
    ];
    queue = pick.map((t, i) => ({
      proofId: `proof-${t.id}`,
      treeId: t.id,
      treeName: t.name,
      referencePhotoUrl: sketch(cases[i].hue, false, cases[i].lean),
      proofPhotoUrl: sketch(cases[i].proofHue, true, cases[i].lean),
      takenAt: new Date(Date.now() - cases[i].mins * 60_000).toISOString(),
      distanceM: cases[i].distanceM,
      accuracyM: cases[i].accuracyM,
    }));
  }
  return [...queue];
}

async function mockReview(proofId: string, verdict: ReviewVerdict) {
  await wait(300);
  queue = (queue ?? []).filter((r) => r.proofId !== proofId);
  // The organiser's vote settles it either way; "not sure" leaves it for a water buddy.
  const review: ReviewState = verdict === "same" ? "confirmed" : verdict === "different" ? "rejected" : "pending";
  return { review };
}
