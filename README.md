# Neemu

**The tree that calls you when it's thirsty.** Environmental Hacks 2026 (WeMakeDevs x AWS), Heat and Water track.

**Live:** https://main.d1wy94gbpeilv8.amplifyapp.com · **API:** https://uzrl7xynp7.execute-api.us-west-2.amazonaws.com

## The problem

Every monsoon, colleges, colonies and city drives plant thousands of saplings. Then the rains stop, nobody waters them, and many die in their first dry months. The organiser has no way to know which saplings are at risk today, or whether anyone watered them.

## What Neemu does

Each sapling in a drive becomes a character with a voice. It works out from real weather when it needs water, asks the one person who adopted it, and gives the organiser a live survival register.

- **It asks only when it needs to.** A daily soil water balance (FAO-56) on real Open-Meteo weather decides. On a dry day: *"नमस्ते, मैं नीमू हूँ… आज शाम 7 लीटर पानी दोगे?"* ("Hello, I'm Neemu… will you give me 7 litres this evening?"). After rain: *"Don't come today, save the water."* Every number has a "Why?".
- **It speaks Hindi**, with Amazon Polly, and can reach the adopter's phone with a notification at 06:00 on days it is thirsty.
- **Nothing is attached to the trees.** The organiser walks the row once and pins each sapling with a phone and one photo. Adopters find theirs under "Saplings near you". A proof photo is accepted when the phone was at the sapling and the image is new. Some proofs then go to a person (the organiser or a neighbouring adopter, a "water buddy"), who checks the photo is the same tree.
- **A small game:** the 3D tree grows with care and wilts without it, with streaks, litres saved and heat days (40 °C or more).
- **The organiser's register:** how many saplings are fine, thirsty, unanswered or likely dead, on a map, with one button to remind the adopters who need to act.

## Try it

| Who | Link |
|---|---|
| A sapling (the hook) | [/?tree=dtu-gate3-017](https://main.d1wy94gbpeilv8.amplifyapp.com/?tree=dtu-gate3-017) |
| A real 44 °C day, replayed | [/?tree=dtu-gate3-017&demo=heatwave](https://main.d1wy94gbpeilv8.amplifyapp.com/?tree=dtu-gate3-017&demo=heatwave) |
| Saplings near you (the drive link) | [/?drive=dtu-eco-2026](https://main.d1wy94gbpeilv8.amplifyapp.com/?drive=dtu-eco-2026) |
| Organiser register | [/?view=organiser&drive=dtu-eco-2026](https://main.d1wy94gbpeilv8.amplifyapp.com/?view=organiser&drive=dtu-eco-2026) |
| Add saplings | [/?view=add&drive=dtu-eco-2026](https://main.d1wy94gbpeilv8.amplifyapp.com/?view=add&drive=dtu-eco-2026) |

The 40 saplings of the example drive at DTU, their adopters and their past care are illustrative; the weather and every computed status are real. A proof for those saplings is only accepted at DTU, so to try the whole loop, add a sapling where you are.

## Built on AWS

Twelve services, each with a job: AWS Lambda, Amazon API Gateway, Amazon DynamoDB, Amazon S3, Amazon Polly, Strands Agents SDK on Amazon Bedrock, AWS Step Functions, Amazon EventBridge Scheduler, AWS Systems Manager Parameter Store, Amazon Cognito, AWS Amplify Hosting, AWS SAM. What each does, the diagram, and what code, the agent and people each decide: [`docs/architecture.md`](docs/architecture.md).

## Run it locally

```bash
cd web
npm install
npm run dev          # http://localhost:5173, against mock data
```

To use the live API, put `VITE_API_URL=https://uzrl7xynp7.execute-api.us-west-2.amazonaws.com` in `web/.env.local`. Backend tests and deploy: [`backend/README.md`](backend/README.md). API shapes: [`docs/api-contract.md`](docs/api-contract.md).

## Honest limits

- The Bedrock agent has not spoken in production yet: model access is not enabled on our new AWS account. Until then every sentence is a fixed template, and the app says so. Numbers are always computed by code.
- The water balance is a textbook model, not calibrated on any real tree.
- A sapling surviving its first summer cannot be shown in a weekend; the daily loop on real weather is what runs.
- Phone position can be faked, and GPS cannot tell apart saplings two metres apart. That is why a person checks "same tree".
- Sign-in (Cognito) is built; until it is switched on, the API trusts the name sent with a request.

## Credits

**Data:** weather from [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL). Water balance after Allen et al., 1998, *FAO Irrigation and Drainage Paper 56*.

**Libraries:** React, three.js, @react-three/fiber, @react-three/drei, qrcode (MIT); MapLibre GL JS (BSD-3-Clause); Strands Agents SDK (Apache-2.0); pywebpush (MPL-2.0).

**AI coding tools:** Claude Code, used by all three of us.

**Team:** Soumy, Aditya, Pratham. Built during the event, 8 to 11 Oct 2026.
