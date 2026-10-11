# Neemu: 3-minute video script (new design)

For one person to record in about an hour. Under 3:00 in total. Upload to YouTube as **Unlisted**, then open the link in a private window to check it plays.

**Site:** https://main.d1wy94gbpeilv8.amplifyapp.com once the new design is live. Until then the same design is at https://preview.d1wy94gbpeilv8.amplifyapp.com (sign-in does not work there; nothing in this script needs it).

**Before recording**
- Chrome, window about 1280 wide, zoom 100%. Close other tabs. Light mode (or dark for a dusk look; pick one and keep it).
- Mac: press **Cmd + Shift + 5**, choose "Record Selected Portion" over the browser, and record your voice with the built-in mic. Or record silent and add the voice after.
- Open each link once before recording, so the 3D trees are already cached and appear fast.
- Speak slowly. Hindi lines are optional; the subtitles on screen already carry them.

## Shots

| Time | On screen | Say |
|---|---|---|
| **0:00 – 0:15** | `/?tree=dtu-gate3-017`. The tree in its arch. Press the round **▶ Hear Neemu** button and let the Hindi play. | Nothing. Let the tree speak. |
| **0:15 – 0:35** | Stay on the page. Drag the 3D tree a little to turn it. | "Every monsoon, drives plant thousands of saplings. Then the rain stops, nobody is assigned to water them, and many die in their first dry months. Neemu gives every sapling a voice, and one person to look after it." |
| **0:35 – 0:55** | Scroll to **How Neemu decided today**. Click **See every number**. | "It isn't guessing. This is today's real weather for that spot, run through FAO-56, the soil water balance irrigation engineers use. It asks for exactly the water the soil has lost, and nothing on days it doesn't need it." |
| **0:55 – 1:15** | Change the address to `/?tree=dtu-gate3-017&demo=heatwave`. Then `/?tree=dtu-gate3-017&demo=rain`. | "On a real 44-degree day last May, it asks for more, before 6 PM. After real rain in August it says: don't come today, save the water." |
| **1:15 – 1:40** | Click the **Near you** tab: the map and the list. Then the **Watering** tab: the camera inside the arch. | "Nothing is attached to any tree. A volunteer walks the row once with a phone. You pick the sapling in front of you, water it, and send a photo. Code checks you were there and the photo is new; a neighbour confirms it's the same tree." |
| **1:40 – 2:05** | Click **The grove**. Let the 3D forest load, drag around. Press **Five years on**. | "This is the whole drive: every sapling at its place, as tall as it has grown, as green as it is healthy. And this is what it becomes in five years, if every one survives." |
| **2:05 – 2:20** | Click **Drive**: the counts and **Remind their adopters**. | "The organiser sees who is thriving, who is thirsty, who was asked and not watered, and reminds them in one tap." |
| **2:20 – 2:50** | **AWS, shown, not just named.** Option A or B below. | "All of it runs on AWS. Every morning at six, EventBridge starts a Step Functions run that checks every sapling in parallel on Lambda. DynamoDB keeps the saplings and proofs, S3 the photos, and Amazon Polly is the tree's Hindi voice. The site is on Amplify." |
| **2:50 – 3:00** | Back to `/?tree=dtu-gate3-017`, the tree in its arch. | "Neemu. The tree that calls you when it's thirsty. The link is in the description." |

### The AWS shot (2:20 – 2:50)

The rules say the video must show AWS in use. Pick one.

**Option A, best: 30 seconds from the AWS console (needs Aditya).** Ask Aditya to screen-record his AWS console, region **us-west-2 (Oregon)**, and send you the clip:
1. **Step Functions** → state machine **MorningCheck** → *Start execution* → open the graph and let the parallel sapling checks turn green.
2. **DynamoDB** → the Neemu table → *Explore items* (a few rows).
3. **S3** → the bucket → the `audio/` folder (Neemu's Polly voice files).
Drop that clip into this slot.

**Option B, no console needed (you can do it alone):**
1. Open https://uzrl7xynp7.execute-api.us-west-2.amazonaws.com/trees/dtu-gate3-017/today in a new tab: the live JSON from **API Gateway + Lambda** (point at `amazonaws.com` in the address bar and at `"audioUrl"`).
2. Copy the `audioUrl` value into a new tab and press play: Neemu's voice from **Amazon Polly**, served from **S3**.
3. Open https://github.com/Soumy27/neemu/blob/main/docs/architecture.md: the diagram of all twelve services renders on GitHub. Scroll the "Where AWS fits" table slowly.

## Upload

- Title: **Neemu: the tree that calls you when it's thirsty · Environmental Hacks 2026**
- Description: one line on the problem, then the live link and https://github.com/Soumy27/neemu
- Visibility: **Unlisted**. Check the link in a signed-out/private window.
- Paste the link into `docs/writeup.md` (the "Demo video" line) and into the submission form.
