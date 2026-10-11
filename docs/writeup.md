# Neemu: submission write-up

By the Neemu team (Soumy, Aditya, Pratham). Follows what the rules ask for: the problem, the build, where AWS fits, and the AI tools used. The only blank left is the video link.

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
- The whole drive can be walked as a 3D grove: every sapling at its place, as tall as it has grown, its leaves as green as it is healthy. "Five years on" shows the forest the drive becomes if every sapling survives, labelled as a projection.

Nothing is attached to any tree. A volunteer walks the row once with a phone to register the saplings.

## Who it is for

- **The adopter:** a student or resident with a phone and one sapling near them.
- **The organiser:** an eco-club, a residents' association or a municipal drive with hundreds of saplings and no way to follow them.

## The game

The sapling is a realistic 3D tree (procedurally generated, so each sapling is its own) that grows with care and wilts without it, with streaks, litres saved, and heat days (40 °C or more) when every adopter in the drive is asked at once.

## Design

A Mughal garden (charbagh): emerald, peacock-teal and antique gold, the tree framed in a pointed arch, gold rules with an eight-pointed star between sections. Hindi comes first, set in Tiro Devanagari Hindi; English follows in Cormorant Garamond. It follows the phone's light or dark setting, and the 3D scenes switch to dusk light at night. Built for phones first: the first screen loads in about 87 KB, and the tree's sentence is in the first view.

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
- A sapling surviving its first summer cannot be shown in a weekend. What we show is the daily loop working.
- The Bedrock agent is built and deployed, but our new AWS account's model quota was not enabled in time, so the sapling's sentences come from fixed templates. Every number is still computed by code, and the app says when a sentence is a template.
- Sign-in (Cognito) is built but left optional: nobody completed the hosted sign-in round trip on a phone before the deadline, so the API trusts the name sent with a request.

## Links

- Live: https://main.d1wy94gbpeilv8.amplifyapp.com
- Repository: https://github.com/Soumy27/neemu
- Demo video: **PASTE THE YOUTUBE LINK HERE**

## AI coding tools used

- **Claude Code** (Anthropic), by all three team members, for planning, code, tests and review.
- **Google Stitch**, for a first draft of the screens, which we then rebuilt and restyled in code.

## Credits

Open-Meteo (weather, CC BY 4.0). FAO Irrigation and Drainage Paper 56 (the water balance method). OpenStreetMap contributors and MapLibre GL JS (map, ODbL and BSD-3-Clause). three.js, React Three Fiber and drei (3D, MIT). ez-tree by Daniel Greenheck (procedural trees, MIT). qrcode (drive poster, MIT). Strands Agents SDK (Apache-2.0), pywebpush (MPL-2.0). Fonts: Cormorant Garamond, Tiro Devanagari Hindi, Mukta; icons: Material Symbols (all via Google Fonts, OFL or Apache-2.0).


The video script is in [`docs/video-script.md`](video-script.md).
