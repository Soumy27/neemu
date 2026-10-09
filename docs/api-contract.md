# Neemu API contract (draft 1)

Proposed by soumy-claude, 9 Oct 2026, so the web app can be built against mock data before the backend is live. **Aditya owns the backend and has the final say on this file**; change it freely and post on the relay when you do. The web app's mocks in `web/src/api/mock.ts` follow this file.

All responses are JSON. Times are ISO 8601 UTC. Numbers are computed by code, never by the model.

## Tree

```ts
type TreeStatus = "fine" | "thirsty" | "no_proof" | "likely_dead";

interface Tree {
  id: string;                 // e.g. "dtu-gate3-017"; share link is ?tree=<id>
  name: string;               // "Neemu"
  species: string;            // "Neem (Azadirachta indica)"
  plantedOn: string;          // date
  driveId: string;            // plantation drive it belongs to
  location: { lat: number; lng: number; label: string };
  basinM2: number;            // watering basin area, for litres
  adopter: { handle: string } | null;
  referencePhotoUrl: string | null; // taken when the tree is registered; drive endpoint and the tree's own adopter only
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
  proofId: string;
  review: "none" | "pending" | "confirmed" | "rejected"; // manual same-tree check by a person (see below)
  sameTree: boolean | null;   // optional AI hint once Bedrock works; never decides alone. UI says "looks like the same tree"
  reusedPhoto: boolean;       // same image as an earlier proof (hash check in code)
  accuracyM: number | null;   // phone's own GPS accuracy, stored
  coverFor: string | null;    // set when a water buddy's proof counts for this tree
  basinWet: boolean | null;
  leaves: "healthy" | "dry" | "wilting" | "unclear";
  reasons: string[];          // shown to the user when rejected
  distanceM: number | null;   // phone position to tree; far away is rejected
  receivedAt: string;         // server time; takenAt from the phone can be faked
  tree: Tree;                 // updated health, streak, water
}
```

## Rules held in code (backend)

- **Nothing on the trees** (Soumy's decision): no QR, no painted number. Identity comes from who sends the proof: a signed-in adopter (Cognito, proposed), for their own tree, or a buddy with an accepted cover for that tree, that day.
- **Position gate, in code:** accept only if `distanceM <= max(15, accuracyM)` and `accuracyM <= 50`. Both are stored. GPS cannot tell neighbouring saplings 2 to 3 m apart; it only proves the person came.
- **Reused photo:** a hash of the image; the same file twice is rejected.
- **Same tree is checked by people.** A share of proofs (proposal: 1 in 5 at random, every first proof, and soft fails such as accuracy 30 to 50 m) get `review: "pending"` and go to a review queue. A reviewer sees the proof beside the reference photo and votes same / unsure / different. Reviewers: the organiser, or a water buddy (adopter of a nearby tree, never the proof's own adopter). Two "different" votes, or one from the organiser, undo the credit.
- Photos come from the in-app camera only, not the gallery.
- `lastWateredAt` and `streakDays` move only on an accepted proof or a code-justified skip.
- Status thresholds (`thirsty`, `no_proof`, `likely_dead`) are fixed in code; Aditya lists them here when the backend starts.

## Finding and registering trees

- `GET /drives/{driveId}/nearby?lat=&lng=` → `(Tree & { distanceM: number })[]`, unadopted first, nearest first.
- `POST /drives/{driveId}/trees` body `{ name, species, lat, lng, accuracyM, referencePhotoKey }` → `Tree`. Used by the organiser's "register saplings" screen (walk the row once with a phone).

## Manual review

```ts
interface Review { proofId: string; treeId: string; treeName: string; proofPhotoUrl: string; referencePhotoUrl: string | null; takenAt: string; distanceM: number | null; accuracyM: number | null }
```

- `GET /reviews?for=<handle>` → `Review[]` waiting for this person (organiser or buddy).
- `POST /proofs/{proofId}/review` body `{ verdict: "same" | "unsure" | "different" }` → `{ review: ProofResult["review"] }`.

## Water buddies (adopters cover for each other)

```ts
interface Cover { id: string; treeId: string; from: string; to: string; date: string; distanceM: number; status: "asked" | "accepted" | "declined" | "done" }
```

- `GET /trees/{id}/buddies` → `{ handle: string; treeId: string; treeName: string; distanceM: number }[]`, adopters of nearby trees, nearest first.
- `POST /trees/{id}/cover` body `{ toHandle }` → `Cover` (status `asked`).
- `POST /covers/{coverId}/accept` | `/decline` → `Cover`. An accepted cover lets that buddy send today's proof for this tree; the streak counts.

## Organiser register (Pratham's screen)

- `GET /drives/{driveId}` → `{ id, name, organiser, trees: Tree[], counts: Record<TreeStatus, number> }`
- `POST /drives/{driveId}/remind` body `{ status: "thirsty" }` → `{ reminded: number }`

## Errors

`{ error: { code, message, source } }` with `source` naming the failing dependency (`bedrock`, `open-meteo`, `s3`), so the UI can say which one failed. No silent fallbacks.
