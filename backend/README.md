# Neemu backend

The API, the water-balance engine, the morning check, the agent, the voice, notifications and sign-in, as one AWS SAM stack.

Live API: `https://uzrl7xynp7.execute-api.us-west-2.amazonaws.com`

## What runs where

| Piece | AWS service | Job | Code |
|---|---|---|---|
| API | API Gateway HTTP API, Lambda | The routes in [`docs/api-contract.md`](../docs/api-contract.md) | `src/api.py`, `drives.py`, `proofs.py` |
| Water balance | Lambda | FAO-56 daily soil water balance on real Open-Meteo weather. Every number a person sees comes from here. | `src/engine.py`, `weather.py`, `views.py` |
| Morning check | EventBridge Scheduler, Step Functions, Lambda | 06:00 IST every day: one Lambda run per sapling, in parallel | `src/daily.py` |
| The agent | Strands Agents SDK on Amazon Bedrock | Neemu's voice and answers, with tools over the engine and a check on every number it says | `src/agent.py` |
| Voice | Amazon Polly (Kajal, neural, Hindi) | Speaks Neemu's line; MP3 kept in S3 | `src/speak.py` |
| Notifications | Web Push, key in SSM Parameter Store | "Neemu is thirsty" on the adopter's phone | `src/push.py` |
| Sign-in | Amazon Cognito | Hosted sign-in page; the API checks each token with Cognito | `src/auth.py` |
| Data | DynamoDB | Saplings, adopters, proofs, review votes, drives | `src/store.py` |
| Media | S3 (private, short-lived signed links) | Proof and reference photos, audio | `src/proofs.py` |

## Run the tests

No AWS account needed.

```bash
cd backend
uv run --with pytest --with boto3 pytest -q tests
```

26 tests: the water balance on weather simple enough to check by hand, the proof and review rules, and the check that stops the agent saying a number no tool gave it.

## Deploy to your own AWS account

Needs the AWS CLI signed in, the SAM CLI, and [uv](https://docs.astral.sh/uv/).

```bash
cd backend

# 1. Once per account: the Web Push signing key, straight into SSM Parameter Store.
uv run --with cryptography python scripts/make_push_keys.py

# 2. The stack. The sign-in address must be unique in the region, so pick your own prefix.
sam build
sam deploy --parameter-overrides SignInDomainPrefix=<your-prefix>

# 3. Once: load the example drive (40 saplings at DTU). Safe to run again; it never overwrites.
aws lambda invoke --function-name <SeedFunction from the stack outputs> /dev/stdout

# 4. The web app, built against that API and published on Amplify Hosting.
./deploy-web.sh
```

Then check everything end to end against what you deployed:

```bash
python tests/smoke.py <ApiUrl> <Table>                               # 36 checks: register, adopt, proofs, review, buddies, cover, notifications
python tests/smoke_auth.py <ApiUrl> <Table> <UserPoolId> <WebClientId>   # 7 checks on sign-in, with a throwaway user
```

Both need Pillow and cryptography in your Python, and both clean up after themselves.

**Settings**

| Setting | Default | What it does |
|---|---|---|
| `RequireAuth` (stack parameter) | `off` | `on`: every write needs a Cognito sign-in. `off`: a request with no token is believed. |
| `/neemu/agent-fallback-key` (Parameter Store, SecureString) | absent | If Bedrock refuses the call and this key is present, the same agent runs on a second model provider. |
| Cognito group `organisers` | empty | People in it can vote as the organiser and send reminders once sign-in is required. |

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
unanswered. `likely_dead` = health has fallen to 5 or below, which takes about two to three
weeks of unanswered asks. Health rises 3 a day while water is readily available and falls
1 to 8 a day while it is not, more the drier the soil.

These are textbook figures, not measurements of any one tree. The model is approximate.

## What is example data

The 40 saplings of `dtu-eco-2026`, their adopters and their past care are illustrative.
Each has a care profile, and the engine runs that profile against real weather, so the
statuses in the register are computed. Weather is always real.

## What is not done

- **The agent has not spoken in production.** Bedrock model access was not enabled on this
  two-week-old account in time (every Nova quota is 0; five quota requests are open). The agent,
  its tools and its number check are deployed and unit-tested, but no live model has answered.
  Until one does, every sentence is a fixed template and the response says so.
- **Sign-in is optional** (`RequireAuth=off`). The sign-in checks pass against the live API, but
  nobody has yet completed the hosted page's round trip on a phone, so it was left off rather
  than risk locking people out. With it off, the API believes the name in a request.
- **No model looks at the photo.** `sameTree`, `basinWet` and `leaves` are returned empty.
  Whether it is the same tree is decided by people, through the review queue.
- **Uploads are open.** Anyone can ask for an upload link. Photos are private, capped at 10 MB
  when read, and deleted after 30 days.
