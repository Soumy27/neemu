// Shapes from docs/api-contract.md. Keep the two in step.

export type TreeStatus = "fine" | "thirsty" | "no_proof" | "likely_dead";

export interface Tree {
  id: string;
  name: string;
  species: string;
  plantedOn: string;
  driveId: string;
  location: { lat: number; lng: number; label: string };
  basinM2: number;
  adopter: { handle: string } | null;
  referencePhotoUrl: string | null;
  status: TreeStatus;
  health: number;
  growthStage: 1 | 2 | 3 | 4 | 5;
  streakDays: number;
  litresSaved: number;
  water: {
    soilWaterMm: number;
    deficitMm: number;
    litresNeeded: number;
    lastWateredAt: string | null;
    rainLast48hMm: number;
    et0TodayMm: number;
    tMaxTodayC: number;
  };
}

export interface ToolStep {
  tool: string;
  summary: string;
  ok: boolean;
}

export interface NeemuSays {
  ask: "water" | "skip" | "none";
  heatwave: { active: boolean; tMaxC: number; date: string } | null;
  spokenBy: "agent" | "template";
  asOf: string;
  replay: boolean;
  litres: number;
  textHi: string;
  textEn: string;
  audioUrl: string | null;
  facts: { label: string; value: string }[];
  steps: ToolStep[];
}

export interface ProofResult {
  verdict: "accepted" | "rejected";
  proofId: string;
  review: "none" | "pending" | "confirmed" | "rejected";
  sameTree: boolean | null;
  reusedPhoto: boolean;
  accuracyM: number | null;
  coverFor: string | null;
  basinWet: boolean | null;
  leaves: "healthy" | "dry" | "wilting" | "unclear";
  reasons: string[];
  distanceM: number | null;
  receivedAt: string;
  tree: Tree;
}

export interface Drive {
  id: string;
  name: string;
  organiser: string;
  trees: Tree[];
  counts: Record<TreeStatus, number>;
}

export interface ApiError {
  error: { code: string; message: string; source: string };
}

export interface Buddy {
  handle: string;
  treeId: string;
  treeName: string;
  distanceM: number;
}

export interface Cover {
  id: string;
  treeId: string;
  from: string;
  to: string;
  date: string;
  distanceM: number;
  status: "asked" | "accepted" | "declined" | "done";
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
