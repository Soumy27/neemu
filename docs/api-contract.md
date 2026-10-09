# Neemu API contract

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
- `POST /trees/{id}/proof` body `{ key, takenAt, lat, lng, accuracyM, handle? }` →. `handle` is who is sending; leave it out and the proof is taken as the adopter's. A buddy covering must send their own.

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
- Status thresholds, fixed in `backend/src/engine.py`: `thirsty` = Neemu asked today and has not been watered; `no_proof` = three asks in a row unanswered; `likely_dead` = health at 5 or below for three days in a row; otherwise `fine`.
- The ask: Neemu asks when the root zone is due to be 9.8 mm or more short of full by evening, and asks for that depth times the basin area, rounded up to half a litre. On this week's Delhi weather that is 5 to 9 L about every four days; in a May heat spell, 10 to 14 L daily.

## Finding and registering trees

- `GET /drives/{driveId}/nearby?lat=&lng=` → `(Tree & { distanceM: number })[]`, unadopted first, nearest first.
- `POST /drives/{driveId}/photo-url` → `{ uploadUrl, key }` for the reference photo.
- `POST /drives/{driveId}/trees` body `{ name, species, lat, lng, accuracyM, referencePhotoKey }` → `Tree`. Used by the organiser's "register saplings" screen (walk the row once with a phone). `accuracyM` and `referencePhotoKey` may be null. Optional: `soilDry: boolean` (the soil looks dry now, so Neemu asks today; default false), `basinM2` (default 0.5), `plantedOn`, `label`, `addedBy`.
- A registered sapling has no known past, so its water balance starts on the day it is registered.

## Manual review

```ts
interface Review { proofId: string; treeId: string; treeName: string; proofPhotoUrl: string; referencePhotoUrl: string | null; takenAt: string; distanceM: number | null; accuracyM: number | null }
```

- `GET /reviews?for=<handle>` → `Review[]` a water buddy can review: pending proofs for saplings within 150 m of one of theirs, never their own, not yet voted on.
- `GET /drives/{driveId}/reviews` → `Review[]`, everything pending in the drive (the organiser's queue).
- `POST /proofs/{proofId}/review` body `{ verdict: "same" | "unsure" | "different", by }` → `{ proofId, review }`. **`by` is required**: the reviewer's handle, or `"organiser"`. One organiser vote decides; buddies need two that agree. A proof that is not pending returns its state unchanged.
- Which proofs go to review is decided by code: every sapling's first proof, any fix vaguer than 30 m, and one in five of the rest chosen by a hash of the proof id.

## Water buddies (adopters cover for each other)

```ts
interface Cover { id: string; treeId: string; from: string; to: string; date: string; distanceM: number; status: "asked" | "accepted" | "declined" | "done" }
```

- `GET /trees/{id}/buddies` → `{ handle: string; treeId: string; treeName: string; distanceM: number }[]`, adopters of nearby trees, nearest first.
- `POST /trees/{id}/cover` body `{ toHandle }` → `Cover` (status `asked`).
- `POST /covers/{coverId}/accept` | `/decline` → `Cover`. An accepted cover lets that buddy send today's proof for this tree; the streak counts.

## Organiser register (Pratham's screen)

- `GET /drives/{driveId}` → `{ id, name, organiser, asOf, replay, trees: Tree[], counts: Record<TreeStatus, number> }`. Takes `?date=` like `/today`. On this endpoint only, each tree also has `lastRemindedAt: string | null` and `lastProof: { at, photoUrl } | null` (a signed link good for an hour; fetch it fresh, do not store it).
- `POST /drives/{driveId}/remind` body `{ status: "thirsty" | "no_proof" | "needs_water" }` → `{ reminded, notified, at }`. `needs_water` is both: every adopted sapling that has asked and not been watered. It stamps `lastRemindedAt` on each matching sapling that has an adopter. Nothing is sent to a phone yet.

## Notifications (Web Push)

- `GET /push/key` → `{ publicKey }`, the key the browser subscribes with.
- `POST /trees/{id}/subscribe` body `{ subscription, handle }` → `{ subscribed: true, sent: number }`. `subscription` is `PushSubscription.toJSON()`. Only the sapling's adopter can subscribe it. `sent` is how many phones accepted the hello notification Neemu sends straight away.
- The web app does both through `enablePush(treeId, handle)` in `web/src/api/push.ts`, which returns `"enabled" | "denied" | "unsupported" | "needs-install" | "failed"`. Call it from a tap.
- A notification goes out when the 06:00 morning check finds the sapling needs water, and when the organiser presses remind. `remind` now also returns `notified`, the number of phones reached.
- iPhone and iPad: the site must be added to the home screen first (`"needs-install"`).

## Sign-in

- Reads are open. Writes are: adopt, proof-url, proof, cover, accept and decline a cover, remind, photo-url, register a sapling, review.
- A signed-in person claims one name, the first time they adopt. One name per person, one person per name; the example adopters' names are reserved.
- Organiser actions (`by: "organiser"` on a review, and `remind` once sign-in is required) need the Cognito group `organisers`.
- Error codes: `sign_in` (401, no token), `sign_in_expired` (401), `organiser_only` (403), `no_name` (409, signed in but has not adopted yet), `name_taken` (409).

## Errors

`{ error: { code, message, source } }` with `source` naming the failing dependency (`bedrock`, `open-meteo`, `s3`, `cognito`, or `api` for a bad request), so the UI can say which one failed. No silent fallbacks.

## What is live

Base URL: `https://uzrl7xynp7.execute-api.us-west-2.amazonaws.com`. Every route in this file answers. `backend/tests/smoke.py` runs the whole flow against the live API.

Not live yet, and what you get instead:

| Thing | Until it lands |
|---|---|
| The agent (Bedrock) | `spokenBy: "template"`. Numbers, ask and steps are the same; only the sentence is fixed text. `talk` answers three kinds of question: tomorrow, why, and anything else gets today's line. |
| AI look at the photo | `sameTree: null`, `basinWet: null`, `leaves: "unclear"`. |
| Sign-in (Cognito) | Built and deployed, switched off (`REQUIRE_AUTH=off`). A request with no token is believed, as before. A request with a Cognito access token in `Authorization: Bearer` is checked with Cognito, and the caller's claimed name replaces `handle`, `by` and `addedBy`. When it is switched on, every write returns 401 with `source: "cognito"` unless signed in, and the web client then sends the person to the sign-in page (`web/src/api/auth.ts`). |
| Reminders reaching a phone | Live for adopters who turned notifications on (see Notifications). Others only get `lastRemindedAt` stamped. |
