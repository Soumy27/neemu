# Neemu

**The tree that calls you when it's thirsty.** Environmental Hacks 2026 (WeMakeDevs x AWS), Heat and Water track.

Every monsoon, plantation drives plant thousands of saplings, and many die in the first dry months because nobody waters them. Neemu turns each sapling into an AI agent with a voice: it works out from real weather when its tree needs water, asks its adopter in Hindi, checks the proof photo, and gives the drive's organiser a live survival register.

Work in progress. Built during the event, 8 to 11 Oct 2026.

## Layout

- `web/` adopter app: 3D tree, Neemu's voice, proof photo (React, three.js)
- `backend/` API, water-balance engine, agent (AWS SAM, Lambda, Strands Agents SDK, Bedrock)
- `docs/api-contract.md` the shapes the web app and backend agree on

## Team

Soumy, Aditya, Pratham.
