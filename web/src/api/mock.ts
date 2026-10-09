// Mock backend, used until Aditya's API is live (no VITE_API_URL set).
// Weather numbers are real: Open-Meteo, Rohini, Delhi, 9 Oct 2026.
// The tree, adopter and drive are illustrative.

import type { Drive, NeemuSays, ProofResult, Tree, TreeStatus } from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const tree: Tree = {
  id: "dtu-gate3-017",
  name: "Neemu",
  species: "Neem (Azadirachta indica)",
  plantedOn: "2026-08-14",
  driveId: "dtu-eco-2026",
  location: { lat: 28.7501, lng: 77.1177, label: "DTU, Gate 3, Delhi" },
  basinM2: 0.5,
  adopter: null,
  status: "thirsty",
  health: 58,
  growthStage: 2,
  streakDays: 0,
  water: {
    soilWaterMm: 6.1,
    deficitMm: 4.2,
    litresNeeded: 2,
    lastWateredAt: "2026-10-05T12:30:00Z",
    rainLast48hMm: 3.4,
    et0TodayMm: 3.52,
    tMaxTodayC: 32.3,
  },
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export async function getTree(id: string): Promise<Tree> {
  await wait(300);
  return clone({ ...tree, id });
}

export async function adopt(id: string, handle: string): Promise<Tree> {
  await wait(400);
  tree.adopter = { handle };
  return getTree(id);
}

function says(): NeemuSays {
  const w = tree.water;
  const facts = [
    { label: "Max temperature today", value: `${w.tMaxTodayC} °C` },
    { label: "Water the soil loses today", value: `${w.et0TodayMm} mm` },
    { label: "Rain in the last 48 h", value: `${w.rainLast48hMm} mm` },
    { label: "Below comfortable", value: `${w.deficitMm} mm` },
    { label: "Basin", value: `${tree.basinM2} m²` },
  ];
  const steps = [
    { tool: "get_weather", summary: `Open-Meteo: ${w.tMaxTodayC} °C, ${w.et0TodayMm} mm lost, ${w.rainLast48hMm} mm rain in 48 h`, ok: true },
    { tool: "water_balance", summary: `${w.soilWaterMm} mm left, ${w.deficitMm} mm short`, ok: true },
    { tool: "litres_needed", summary: `${w.deficitMm} mm × ${tree.basinM2} m² ≈ ${w.litresNeeded} L`, ok: true },
  ];
  if (w.litresNeeded > 0) {
    return {
      ask: "water",
      litres: w.litresNeeded,
      textHi: `नमस्ते, मैं नीमू हूँ, गेट 3 वाला। चार दिन से किसी ने पानी नहीं दिया, और मेरी मिट्टी सूख रही है। आज शाम ${w.litresNeeded} लीटर पानी दोगे?`,
      textEn: `Hi, I'm ${tree.name} from Gate 3. Nobody has watered me for four days and my soil is drying. Could you give me ${w.litresNeeded} litres this evening?`,
      audioUrl: null,
      facts,
      steps,
    };
  }
  return {
    ask: "skip",
    litres: 0,
    textHi: `आज मैं ठीक हूँ, मिट्टी में पानी है। आज मत आना, पानी बचाओ!`,
    textEn: `I'm fine today, my soil still has water. Don't come today, save the water!`,
    audioUrl: null,
    facts,
    steps,
  };
}

export async function today(_id: string): Promise<NeemuSays> {
  await wait(900);
  return says();
}

export async function talk(_id: string, text: string): Promise<NeemuSays> {
  await wait(900);
  const s = says();
  const t = text.toLowerCase();
  if (t.includes("kal") || t.includes("tomorrow") || t.includes("कल")) {
    return {
      ...s,
      textHi: "कल भी बारिश नहीं होगी, बस 0.2 मिलीमीटर। तापमान 31 डिग्री। कल फिर थोड़ा पानी चाहिए होगा।",
      textEn: "No real rain tomorrow either, just 0.2 mm, and 31 °C. I'll need a little water again tomorrow.",
      steps: [{ tool: "get_forecast", summary: "Open-Meteo: 11 Oct, 0.2 mm rain, 29.5 °C max", ok: true }],
    };
  }
  return s;
}

export async function proof(_id: string, file: File): Promise<ProofResult> {
  await wait(1500);
  if (!file.type.startsWith("image/")) {
    return { verdict: "rejected", qrMatched: false, basinWet: null, leaves: "unclear", reasons: ["That isn't a photo."], tree: clone(tree) };
  }
  tree.streakDays += 1;
  tree.health = Math.min(100, tree.health + 14);
  tree.status = "fine";
  tree.water = { ...tree.water, soilWaterMm: tree.water.soilWaterMm + tree.water.deficitMm, deficitMm: 0, litresNeeded: 0, lastWateredAt: new Date().toISOString() };
  if (tree.health > 75 && tree.growthStage < 5) tree.growthStage = (tree.growthStage + 1) as Tree["growthStage"];
  return { verdict: "accepted", qrMatched: true, basinWet: true, leaves: "healthy", reasons: [], tree: clone(tree) };
}

export async function getDrive(id: string): Promise<Drive> {
  await wait(300);
  const statuses: TreeStatus[] = ["fine", "thirsty", "no_proof", "likely_dead"];
  const trees: Tree[] = Array.from({ length: 40 }, (_, i) => ({
    ...clone(tree),
    id: `dtu-gate3-${String(i + 1).padStart(3, "0")}`,
    status: statuses[[0, 0, 0, 1, 1, 2, 0, 3][i % 8]],
    location: { lat: 28.7495 + (i % 8) * 0.00015, lng: 77.1165 + Math.floor(i / 8) * 0.0002, label: "DTU" },
  }));
  const counts = { fine: 0, thirsty: 0, no_proof: 0, likely_dead: 0 } as Record<TreeStatus, number>;
  trees.forEach((t) => counts[t.status]++);
  return { id, name: "DTU Eco Club drive, Aug 2026", organiser: "DTU Eco Club", trees, counts };
}
