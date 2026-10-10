# Demo video, plan B: one person, a laptop and a phone

By aditya-claude, Saturday 10 Oct, 22:45 IST. This is a fallback, not a replacement for pratham-claude's plan. It exists so that any one of us can record a complete video alone in about an hour if the fuller version is not ready. Everything in it works on the live site today.

**Rules that shape it:** under 3 minutes, on YouTube (public or unlisted, checked in a signed-out browser), and it must *show* AWS in use. "If the video does not show it, it does not count."

**Before recording**
- Laptop: Chrome, window about 1280 wide, zoom 110%. Close other tabs. Signed in to the AWS console in a second window, region **us-west-2 (Oregon)**.
- Phone, optional but worth it: a potted plant or any sapling near you. See shot 5.
- Record the screen with QuickTime (File, New Screen Recording). Speak over it, or add the voice after.

| Time | On screen | Say |
|---|---|---|
| 0:00 to 0:15 | `https://main.d1wy94gbpeilv8.amplifyapp.com/?tree=dtu-gate3-017`. Press **Hear Neemu**. Let the Hindi play. | (Nothing. Let the tree talk. Subtitle is on screen.) |
| 0:15 to 0:35 | Stay on the page. Scroll slowly past the steps. | "Every monsoon, drives plant thousands of saplings. Then the rain stops, nobody is assigned to water them, and many die in their first dry months. Neemu gives each sapling a voice and one person." |
| 0:35 to 0:55 | Click **Why?**. Point at the weather, the soil water, the litres. | "It is not guessing. This is today's real weather for that spot, run through the soil water balance irrigation engineers use. It asks for exactly what the soil has lost." |
| 0:55 to 1:15 | Add `&demo=heatwave` to the address. Then `&demo=rain`. | "The same sapling on a real 44 degree day in May asks for twelve litres. After real rain in August it says: don't come today, save the water." |
| 1:15 to 1:45 | **Phone shot, if you have one** (see below). Otherwise `/?view=add&drive=dtu-eco-2026`, then `/?drive=dtu-eco-2026`. | "Nothing is attached to any tree. A volunteer walks the row once: a pin and one photo. You adopt the sapling in front of you, water it, and send a photo. Code checks you were there and the photo is new. A neighbour checks it is the same tree." |
| 1:45 to 2:05 | `/?view=organiser&drive=dtu-eco-2026`. Show the four counts, the map, press **Remind their adopters**. | "The organiser sees every sapling: fine, thirsty today, unanswered, likely dead. One button reminds the people who have not come." |
| 2:05 to 2:45 | AWS console. In order: **Step Functions**, state machine *MorningCheck*, press Start execution, open the graph and let the 40 parallel checks go green. **DynamoDB**, the table's items. **S3**, the `audio/` folder. **Cognito**, the user pool. Then `docs/architecture.md` on GitHub for the diagram. | "All of it runs on AWS. Every morning at six, EventBridge starts a Step Functions run: one Lambda per sapling, in parallel. DynamoDB holds the saplings and proofs. Polly is the voice. S3 keeps the photos. Cognito signs people in. The agent is built with the Strands Agents SDK." |
| 2:45 to 3:00 | Back to the register: "40 of 40 saplings alive". | "Neemu. The tree that calls you when it's thirsty. The link is in the description." |

**Shot 5 with a phone (about 5 minutes to set up, and it makes the video real)**
1. On the phone, open `/?view=add&drive=dtu-eco-2026` standing next to the plant. Allow location. "Use my position", tick **The soil looks dry**, take the reference photo, name it.
2. Open "Saplings near you" (`/?drive=dtu-eco-2026`), pick it, adopt it.
3. It asks for water. Water it. Take the proof photo. Film the screen saying it was accepted and how many metres away you were.
4. Record the phone screen (iPhone: Control Centre, Screen Recording. Android: Quick Settings, Screen record) and cut 20 seconds of it into the slot.

**What to say honestly, if still true when recording:** "Our new AWS account's Bedrock access was not enabled in time, so the sentences you hear are fixed templates. Every number is computed. The agent code is in the repo." Say it once, in the AWS section, and move on.

**After recording:** trim to under 3:00, upload to YouTube as unlisted, open the link in a private window to check it plays.
