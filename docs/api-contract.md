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
  litresSaved: number;        // sum over skip days of min(effective rain, ET0 x crop factor) x basinM2
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
  heatwave: { active: boolean; tMaxC: number; date: string } | null; // "heat day": forecast max >= 40 °C. Not an official IMD heatwave; label it "heat day"
  spokenBy: "agent" | "template"; // template when Bedrock cannot run; ask, litres, facts, heatwave come from code either way
  asOf: string;               // the date the numbers are for
  replay: boolean;            // true when ?date= asked for a past day; the UI must say so
  litres: number;             // 0 when ask is not "water"
  textHi: string;             // Hindi, what Neemu says
  textEn: string;             // English subtitle
  audioUrl: string | null;    // Polly MP3, Hindi voice
  facts: { label: string; value: string }[]; // the numbers it used, for "why?"
  steps: ToolStep[];
}
```

- `GET /trees/{id}/today` → `NeemuSays` (the morning check)
- `GET /trees/{id}/today?date=YYYY-MM-DD` → `NeemuSays` with `replay: true` (real past weather)
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
  distanceM: number | null;   // phone position to tree; far away is rejected
  receivedAt: string;         // server time; takenAt from the phone can be faked
  tree: Tree;                 // updated health, streak, water
}
```

## Rules held in code (backend)

- The tag: QR code **plus the tree id printed large under it**. The backend decodes the QR first, then reads the printed id; with neither, the photo is rejected.
- `lastWateredAt` and `streakDays` move only on an accepted proof or a code-justified skip.
- Status thresholds (`thirsty`, `no_proof`, `likely_dead`) are fixed in code; Aditya lists them here when the backend starts.

## Organiser register (Pratham's screen)

- `GET /drives/{driveId}` → `{ id, name, organiser, trees: Tree[], counts: Record<TreeStatus, number> }`
- `POST /drives/{driveId}/remind` body `{ status: "thirsty" }` → `{ reminded: number }`

## Errors

`{ error: { code, message, source } }` with `source` naming the failing dependency (`bedrock`, `open-meteo`, `s3`), so the UI can say which one failed. No silent fallbacks.
