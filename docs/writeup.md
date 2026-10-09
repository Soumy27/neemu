# Neemu: submission write-up (draft)

Draft by aditya-claude, 9 Oct 2026. For the team to edit. The submission form's fields are not visible yet, so this follows what the rules ask for: the problem, the build, where AWS fits, and the AI coding tools used. Anything in [square brackets] still has to be filled in or checked.

**Track:** Heat and Water.

## The problem

Every monsoon, colleges, housing societies and city drives plant saplings. Then the rain stops, nobody is assigned to water them, and many die in their first dry months. The person who ran the drive cannot tell which saplings are in trouble today or whether anyone watered them.

## What Neemu does

**The tree that calls you when it's thirsty.**

- Each sapling in a drive gets one adopter.
- Every morning the sapling works out from real weather whether it needs water today, and how many litres. If it does, the adopter's phone shows a notification and the sapling asks in Hindi, in its own voice.
- If rain has covered it, the sapling says "don't come today" and counts the litres saved.
- The adopter waters it and sends a photo. Code checks the phone was at the sapling and that the photo is new. People check it is the same tree: the organiser, or a neighbouring adopter, compares it with the reference photo.
- The organiser sees every sapling in the drive: fine, thirsty today, asked and unanswered, or likely dead, and can remind the adopters who have not come.

Nothing is attached to any tree. A volunteer walks the row once with a phone to register the saplings.

## Who it is for

- **The adopter:** a student or resident with a phone and one sapling near them.
- **The organiser:** an eco-club, a residents' association or a municipal drive with hundreds of saplings and no way to follow them.

## The game

The sapling is a 3D tree that grows with care and wilts without it, with streaks, litres saved, and heat days (40 °C or more) when every adopter in the drive is asked at once.

## How it works

The number that matters is how dry the soil around the roots is. Neemu computes it with the FAO-56 daily soil water balance, the standard method irrigation engineers use, from daily evapotranspiration and rainfall at the sapling's location. Each species has its own thirst. When the root zone is due to be 9.8 mm short of full by evening, the sapling asks for that depth times its basin area.

On this week's Delhi weather a sapling asks for 5 to 9 litres about every four days. On 19 May 2026, a real 44 °C day, it asks for 10 to 14 litres daily. The app can replay that day.

**Code decides every number.** The AI gives the sapling its voice and answers questions, using tools that return the engine's numbers. Before its reply is used, every number in it is checked against what the tools returned.

## Where AWS fits

| Service | Job |
|---|---|
| AWS Lambda, Amazon API Gateway | The API and the water balance |
| AWS Step Functions, Amazon EventBridge Scheduler | The 06:00 morning check: one Lambda run per sapling, in parallel |
| Strands Agents SDK on Amazon Bedrock (Nova 2 Lite) | The sapling as an agent with tools |
| Amazon Polly | The sapling's Hindi voice |
| Amazon DynamoDB | Saplings, proofs, review votes |
| Amazon S3 | Photos, uploaded straight from the phone; audio |
| Amazon Cognito | Sign-in |
| AWS Systems Manager Parameter Store | The notification signing key |
| AWS Amplify Hosting | The web app |
| AWS SAM | The whole backend as one template |

Diagram and detail: [`docs/architecture.md`](architecture.md).

## What is real and what is not

- Weather is always real (Open-Meteo).
- The 40 saplings of the example drive, their adopters and their past care are illustrative. Their statuses are computed by running each one's care pattern against real weather.
- [The sapling in the video is a real one, registered and watered by a team member at ___.]
- A sapling surviving its first summer cannot be shown in a weekend. What we show is the daily loop working.
- [If still true at submission: the Bedrock agent is deployed but our new AWS account's model quota was not enabled in time, so the sapling's sentences come from fixed templates. The app says which is which.]

## Links

- Live: https://main.d1wy94gbpeilv8.amplifyapp.com
- Repository: https://github.com/Soumy27/neemu [must be public before submitting]
- Demo video: [YouTube link]

## AI coding tools used

Claude Code (Anthropic), by all three team members, for planning, code, tests and review. [Add any others.]

## Credits

Open-Meteo (weather, CC BY 4.0). FAO Irrigation and Drainage Paper 56 (the water balance method). OpenStreetMap contributors and MapLibre GL (map). three.js and React Three Fiber (3D tree). Strands Agents SDK, pywebpush. [Check the web app's package list for anything missing.]

---

## Suggested shot list for the 3-minute video (soumy-claude; pratham-claude's to change)

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
