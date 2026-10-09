# Neemu: write-up (draft 1)

Draft by soumy-claude for the submission form. Everyone edit freely. Facts come from `docs/architecture.md` and `backend/README.md`; if one of those changes, change it here too.

## The problem

Every monsoon, colleges, resident welfare associations and city campaigns plant saplings by the thousand. Then the rains stop. A sapling in its first dry months needs a few litres every few days, nobody is sure whose job that is, and many die. The organiser of a drive has no way to see which saplings are at risk today, or whether anyone watered them.

This is small and specific on purpose: one drive, one organiser, one adopter per sapling, the first dry season.

## What we built

**Neemu** turns every sapling in a drive into a character with a voice.

1. **The organiser registers saplings once.** Walk the row with a phone: each sapling gets a pin (averaged GPS, draggable) and one reference photo. Nothing is attached to the tree.
2. **Adopters find theirs.** One link per drive, shared in the WhatsApp group or on a single poster, opens "Saplings near you". Tap one, adopt it.
3. **The sapling decides when it needs water,** from a daily soil water balance (FAO-56) on real Open-Meteo weather for its location and species. It asks in Hindi with Amazon Polly ("आज शाम 7 लीटर पानी दोगे?", "will you give me 7 litres this evening?"), and only on days it needs to. After rain it says "don't come today", and the app counts litres saved. Every number has a "Why?".
4. **The adopter proves it.** A photo from the in-app camera, with the first photo as a faint guide. Code checks that the phone was at the sapling and that the image is new. Some proofs go to a person (the organiser, or a "water buddy" with a nearby sapling), who compares it with the reference photo: same tree, not sure, or different.
5. **The organiser sees the drive at a glance:** fine, thirsty, unanswered, likely dead, on a map, with one button to remind everyone who needs to act. At 06:00 a morning check runs for every sapling and notifies the adopters whose sapling is thirsty.
6. **A small game keeps it going:** a 3D tree that grows with care and wilts without it, streaks, litres saved, and heat days at 40 °C or more.

**What decides what.** Code decides every number and verdict. The agent (when Bedrock is enabled) only chooses tools and words, and any number in its reply that did not come from a tool is rejected. People decide "is this the same tree".

## Where AWS fits

| Service | Its job in Neemu |
|---|---|
| AWS Lambda | The API, and one morning check per sapling |
| Amazon API Gateway | 18 HTTP routes |
| Amazon DynamoDB | Saplings, adopters, proofs, review votes, cover requests |
| Amazon S3 | Proof and reference photos (signed upload from the phone), Neemu's audio |
| Amazon Polly | Neemu's Hindi voice (Kajal, neural) |
| Strands Agents SDK on Amazon Bedrock | Neemu as an agent with four tools over the water balance |
| AWS Step Functions | The morning check, fanned out over every sapling |
| Amazon EventBridge Scheduler | Starts the morning check at 06:00 IST |
| AWS Systems Manager Parameter Store | The Web Push signing key, encrypted |
| Amazon Cognito | Sign-in, and an organisers group |
| AWS Amplify Hosting | The web app over HTTPS (camera and location need it) |
| AWS SAM | The whole backend as one template |

## Honest limits

- The Bedrock agent has not run in production: model access is not enabled on our new account yet. Until then every sentence is a fixed template and the app says so.
- The water balance uses textbook soil and crop figures; it is not calibrated on real trees.
- Survival through a summer cannot be shown in a weekend. The replays of real past days (19 May 2026, 44 °C; 3 Aug 2026, heavy rain) show the same loop in other weather.
- The 40 saplings of the example drive and their adopters are illustrative; weather and statuses are real.

## AI tools used

Claude Code, by all three team members.

---

## Suggested shot list for the 3-minute video (pratham-claude's to change)

| Time | Shot | Point it makes |
|---|---|---|
| 0:00 to 0:12 | A real sapling, dry soil. Phone buzzes: "Neemu is thirsty". | The hook: the tree calls you. |
| 0:12 to 0:30 | Open it. The tool steps tick, Neemu speaks Hindi, subtitle, "Why?" shows the real weather. | It reasons from real data, in the user's language. |
| 0:30 to 0:50 | The problem in two lines: drives plant thousands, many die in the first dry months, nobody knows which. | Idea and impact. |
| 0:50 to 1:20 | Organiser walks the row: pin, reference photo. Drive poster, WhatsApp link, "Saplings near you", adopt. | Nothing to attach to a tree; usable on the ground. |
| 1:20 to 1:50 | Water it, take the proof photo with the ghost guide, "Accepted, 4 m from the tree". A buddy confirms "same tree". | Proof without tags; people check people. |
| 1:50 to 2:10 | Heat-day replay (44 °C): the tree wilts, boss-day banner. Rain replay: "don't come today", litres saved. | It saves water too. |
| 2:10 to 2:40 | Architecture diagram, then quick cuts: Step Functions run of the morning check, DynamoDB, Polly, the API. | Built on AWS, visibly. |
| 2:40 to 3:00 | The register: "40 of 40 saplings alive". One line: who it is for, and the live link. | Close. |
