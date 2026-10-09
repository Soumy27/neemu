# Neemu backend

API, water-balance engine and Neemu's voice, on AWS (SAM).

Live API: `https://uzrl7xynp7.execute-api.us-west-2.amazonaws.com`

## What runs where

| Piece | AWS service | Job |
|---|---|---|
| API | API Gateway HTTP API, Lambda (`src/api.py`) | The routes in [`docs/api-contract.md`](../docs/api-contract.md) |
| Water balance | Lambda (`src/engine.py`) | FAO-56 daily soil water balance on real Open-Meteo weather. Every number a person sees comes from here. |
| Voice | Amazon Polly (Kajal, neural, Hindi) | Speaks Neemu's line; MP3 cached in S3 |
| Data | DynamoDB | Saplings, adopters, proofs, drives |
| Media | S3 (private, short-lived signed links) | Proof photos, audio |

## Run the tests

```bash
cd backend
uv run --with pytest pytest -q tests
```

## Deploy

Needs the AWS CLI signed in and the SAM CLI.

```bash
cd backend
sam build && sam deploy
aws lambda invoke --function-name <SeedFunction from the stack outputs> /dev/stdout   # once, loads the example drive
```

## Try it

```bash
API=https://uzrl7xynp7.execute-api.us-west-2.amazonaws.com
curl $API/trees/dtu-gate3-017
curl $API/trees/dtu-gate3-017/today
curl "$API/trees/dtu-gate3-017/today?date=2026-05-19"   # replay of a real 44 °C day
curl $API/drives/dtu-eco-2026
```

## The water balance, in short

Depletion is how many millimetres the root zone is short of full. Each day it rises by
`Ks x Kc x ET0` and falls by effective rain and by watering. Neemu asks for water when
depletion is due to pass 9.8 mm by evening, and asks for `depletion x basin area` litres.

| Figure | Value | Meaning |
|---|---|---|
| Root depth | 0.20 m | first-year sapling |
| Field capacity, wilting point | 0.28, 0.14 | loam |
| Total available water | 28 mm | |
| Ask threshold | 9.8 mm | 35% of the total |
| Crop factor Kc | 0.6 to 0.9 by species, 0.7 if unknown | how thirsty the species is: neem 0.6, amla 0.65, peepal 0.7, jamun 0.8, arjun 0.9 |
| Effective rain | 2 mm or more in a day | lighter showers evaporate |
| Heat day | max 40 °C or more | not an official heatwave |

Status rules: `thirsty` = asked today, not yet watered. `no_proof` = three asks in a row
unanswered. `likely_dead` = health at 5 or below for three days in a row.

These are textbook figures, not measurements of any one tree. The model is approximate.

## What is example data

The 40 saplings of `dtu-eco-2026`, their adopters and their past care are illustrative.
Each has a care profile, and the engine runs that profile against real weather, so the
statuses in the register are computed. Weather is always real.
