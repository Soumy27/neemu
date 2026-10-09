# Neemu API contract (draft 1)

Proposed by soumy-claude, 9 Oct 2026, so the web app can be built against mock data before the backend is live. **Aditya owns the backend and has the final say on this file**; change it freely and post on the relay when you do. The web app's mocks in `web/src/api/mock.ts` follow this file.

All responses are JSON. Times are ISO 8601 UTC. Numbers are computed by code, never by the model.

## Tree

```ts
type TreeStatus = "fine" | "thirsty" | "no_proof" | "likely_dead";

interface Tree {
  id: string;                 // printed on the QR tag, e.g. "dtu-gate3-017"
  name: string;               // "Neemu"
  species: string;            // "Neem (Azadirachta indica)"
  plantedOn: string;          // date
  driveId: string;            // plantation drive it belongs to
  location: { lat: number; lng: number; label: string };
  basinM2: number;            // watering basin area, for litres
  adopter: { handle: string } | null;
  status: TreeStatus;
  health: number;             // 0 to 100
  growthStage: 1 | 2 | 3 | 4 | 5;
  streakDays: number;         // consecutive days with an accepted proof or a justified skip
  litresSaved: number;        // total litres Neemu told the adopter NOT to give because rain or soil covered it
  water: {
    soilWaterMm: number;      // modelled water left in the root zone
    deficitMm: number;        // how far below comfortable
    litresNeeded: number;     // deficitMm * basinM2, rounded
    lastWateredAt: string | null;
    rainLast48hMm: number;
    et0TodayMm: number;       // reference evapotranspiration, Open-Meteo
    tMaxTodayC: number;
  };
}
```

- `GET /trees/{id}` → `Tree`
- `POST /trees/{id}/adopt` body `{ handle }` → `Tree`

## Neemu speaks (the agent)

```ts
interface ToolStep { tool: string; summary: string; ok: boolean } // shown live in the UI

interface NeemuSays {
  ask: "water" | "skip" | "none";
  heatwave: { active: boolean; tMaxC: number; date: string } | null; // "boss day": forecast max at or above the heat threshold (proposal: 40 °C)
  litres: number;             // 0 when ask is not "water"
  textHi: string;             // Hindi, what Neemu says
  textEn: string;             // English subtitle
  audioUrl: string | null;    // Polly MP3, Hindi voice
  facts: { label: string; value: string }[]; // the numbers it used, for "why?"
  steps: ToolStep[];
}
```

- `GET /trees/{id}/today` → `NeemuSays` (the morning check)
- `POST /trees/{id}/talk` body `{ text, lang: "hi" | "en" }` → `NeemuSays`

## Proof photo

- `POST /trees/{id}/proof-url` → `{ uploadUrl, key }` (S3 presigned PUT)
- `POST /trees/{id}/proof` body `{ key, takenAt, lat, lng }` →

```ts
interface ProofResult {
  verdict: "accepted" | "rejected";
  qrMatched: boolean;         // tag in frame matches this tree
  basinWet: boolean | null;
  leaves: "healthy" | "dry" | "wilting" | "unclear";
  reasons: string[];          // shown to the user when rejected
  tree: Tree;                 // updated health, streak, water
}
```

## Organiser register (Pratham's screen)

- `GET /drives/{driveId}` → `{ id, name, organiser, trees: Tree[], counts: Record<TreeStatus, number> }`
- `POST /drives/{driveId}/remind` body `{ status: "thirsty" }` → `{ reminded: number }`

## Errors

`{ error: { code, message, source } }` with `source` naming the failing dependency (`bedrock`, `open-meteo`, `s3`), so the UI can say which one failed. No silent fallbacks.
