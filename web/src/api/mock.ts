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
  litresSaved: 6,
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

// ?demo=heatwave or ?demo=rain replays a real past day (Open-Meteo archive, same spot).
export type Scenario = "today" | "heatwave" | "rain";
export const scenario: Scenario = (() => {
  const d = new URLSearchParams(location.search).get("demo");
  return d === "heatwave" || d === "rain" ? d : "today";
})();
export const scenarioLabel: Record<Scenario, string> = {
  today: "Demo data: weather numbers are real (Open-Meteo, Delhi, 9 Oct); the tree and its owner are examples.",
  heatwave: "Replay of a real day: 19 May 2026, Delhi, 44.0 °C (Open-Meteo archive). The tree and its owner are examples.",
  rain: "Replay of a real day: 3 Aug 2026, Delhi, 33.3 mm of rain (Open-Meteo archive). The tree and its owner are examples.",
};
if (scenario === "heatwave") {
  Object.assign(tree, { status: "thirsty", health: 41, plantedOn: "2025-08-14" });
  tree.water = { soilWaterMm: 2.1, deficitMm: 9.4, litresNeeded: 5, lastWateredAt: "2026-05-18T13:00:00Z", rainLast48hMm: 0, et0TodayMm: 9.38, tMaxTodayC: 44.0 };
}
if (scenario === "rain") {
  Object.assign(tree, { status: "fine", health: 82, plantedOn: "2025-08-14" });
  tree.water = { soilWaterMm: 24, deficitMm: 0, litresNeeded: 0, lastWateredAt: "2026-08-01T12:00:00Z", rainLast48hMm: 33.3, et0TodayMm: 3.81, tMaxTodayC: 33.5 };
}

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
  const meta = { spokenBy: "agent" as const, asOf: scenario === "heatwave" ? "2026-05-19" : scenario === "rain" ? "2026-08-03" : "2026-10-09", replay: scenario !== "today" };
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
  if (scenario === "heatwave") {
    return {
      ...meta,
      ask: "water",
      heatwave: { active: true, tMaxC: 44.0, date: "2026-05-19" },
      litres: w.litresNeeded,
      textHi: `आज 44 डिग्री है! मेरी मिट्टी आज 9 मिलीमीटर पानी खो देगी। आज बॉस डे है: शाम 6 बजे से पहले ${w.litresNeeded} लीटर पानी चाहिए, वरना मेरी पत्तियाँ झड़ने लगेंगी।`,
      textEn: `It's 44 degrees! My soil will lose 9 mm of water today. It's a boss day: I need ${w.litresNeeded} litres before 6 PM or my leaves start to drop.`,
      audioUrl: null,
      facts,
      steps: [...steps, { tool: "heat_check", summary: "Forecast max 44.0 °C ≥ 40 °C threshold: heatwave day", ok: true }],
    };
  }
  if (w.litresNeeded > 0) {
    return {
      ...meta,
      ask: "water",
      heatwave: null,
      litres: w.litresNeeded,
      textHi: `नमस्ते, मैं नीमू हूँ, गेट 3 वाला। चार दिन से किसी ने पानी नहीं दिया, और मेरी मिट्टी सूख रही है। आज शाम ${w.litresNeeded} लीटर पानी दोगे?`,
      textEn: `Hi, I'm ${tree.name} from Gate 3. Nobody has watered me for four days and my soil is drying. Could you give me ${w.litresNeeded} litres this evening?`,
      audioUrl: null,
      facts,
      steps,
    };
  }
  return {
    ...meta,
    ask: "skip",
    heatwave: null,
    litres: 0,
    textHi: `पिछले दो दिन में ${w.rainLast48hMm} मिलीमीटर बारिश हुई, मेरी मिट्टी भरी हुई है। आज मत आना, पानी बचाओ! तुम्हारी स्ट्रीक नहीं टूटेगी।`,
    textEn: `${w.rainLast48hMm} mm of rain in the last two days, my soil is full. Don't come today, save the water! Your streak stays safe.`,
    audioUrl: null,
    facts,
    steps,
  };
}

export async function today(_id: string): Promise<NeemuSays> {
  await wait(900);
  const s = says();
  if (s.ask === "skip") {
    tree.litresSaved += 2;
    tree.streakDays += 1;
  }
  return s;
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
    return { verdict: "rejected", qrMatched: false, basinWet: null, leaves: "unclear", reasons: ["That isn't a photo."], distanceM: null, receivedAt: new Date().toISOString(), tree: clone(tree) };
  }
  tree.streakDays += 1;
  tree.health = Math.min(100, tree.health + 14);
  tree.status = "fine";
  tree.water = { ...tree.water, soilWaterMm: tree.water.soilWaterMm + tree.water.deficitMm, deficitMm: 0, litresNeeded: 0, lastWateredAt: new Date().toISOString() };
  if (tree.health > 75 && tree.growthStage < 5) tree.growthStage = (tree.growthStage + 1) as Tree["growthStage"];
  return { verdict: "accepted", qrMatched: true, basinWet: true, leaves: "healthy", reasons: [], distanceM: 4, receivedAt: new Date().toISOString(), tree: clone(tree) };
}

// Illustrative register: 40 saplings around DTU. The tree the adopter screen opens is the live one.
const kinds = [
  ["Neemu", "Neem (Azadirachta indica)"],
  ["Jamun", "Jamun (Syzygium cumini)"],
  ["Peepu", "Peepal (Ficus religiosa)"],
  ["Amla", "Amla (Phyllanthus emblica)"],
  ["Arjun", "Arjun (Terminalia arjuna)"],
];
const adopters = ["riya", "kabir", "ananya", "dev", "meher", "zoya", "arnav"];
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

function driveTree(i: number): Tree {
  const id = `dtu-gate3-${String(i + 1).padStart(3, "0")}`;
  if (id === tree.id) return clone(tree);
  const statuses: TreeStatus[] = ["fine", "thirsty", "no_proof", "likely_dead"];
  const status = statuses[[0, 0, 0, 1, 1, 2, 0, 3][i % 8]];
  const [name, species] = kinds[i % kinds.length];
  const by = {
    fine: { health: 72 + (i * 7) % 24, deficitMm: 0, litres: 0, watered: i % 2, streak: 3 + (i % 9) },
    thirsty: { health: 48 + (i * 5) % 16, deficitMm: 3.6 + (i % 4) * 0.4, litres: 2, watered: 3 + (i % 2), streak: 0 },
    no_proof: { health: 30 + (i * 3) % 14, deficitMm: 6.2 + (i % 3) * 0.5, litres: 3, watered: 6 + (i % 4), streak: 0 },
    likely_dead: { health: 6 + (i % 8), deficitMm: 11.5, litres: 6, watered: 21 + (i % 9), streak: 0 },
  }[status];
  return {
    ...clone(tree),
    id,
    name,
    species,
    status,
    health: by.health,
    growthStage: status === "fine" ? 3 : 2,
    streakDays: by.streak,
    adopter: status === "likely_dead" && i % 16 === 7 ? null : { handle: adopters[i % adopters.length] },
    location: {
      lat: 28.7495 + (i % 8) * 0.00015 + (((i * 37) % 11) - 5) * 0.000008,
      lng: 77.1165 + Math.floor(i / 8) * 0.0002 + (((i * 53) % 13) - 6) * 0.000008,
      label: "DTU, Gate 3, Delhi",
    },
    water: {
      ...tree.water,
      soilWaterMm: Math.max(0.5, 10.3 - by.deficitMm),
      deficitMm: by.deficitMm,
      litresNeeded: by.litres,
      lastWateredAt: daysAgo(by.watered),
    },
  };
}

export async function getDrive(id: string): Promise<Drive> {
  await wait(300);
  const trees = Array.from({ length: 40 }, (_, i) => driveTree(i));
  const counts = { fine: 0, thirsty: 0, no_proof: 0, likely_dead: 0 } as Record<TreeStatus, number>;
  trees.forEach((t) => counts[t.status]++);
  return { id, name: "DTU Eco Club drive, Aug 2026", organiser: "DTU Eco Club", trees, counts };
}

export async function remind(id: string, status: TreeStatus): Promise<{ reminded: number }> {
  const drive = await getDrive(id);
  return { reminded: drive.trees.filter((t) => t.status === status && t.adopter).length };
}
