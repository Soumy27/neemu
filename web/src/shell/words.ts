// Bilingual names: Hindi first, English under it (the Living Grove lockup).

const treeNamesHi: Record<string, string> = {
  Neemu: "नीमू",
  Jamun: "जामुन",
  Peepu: "पीपू",
  Amla: "आंवला",
  Arjun: "अर्जुन",
};

const speciesHi: Record<string, string> = {
  Neem: "नीम",
  Jamun: "जामुन",
  Peepal: "पीपल",
  Amla: "आंवला",
  Arjun: "अर्जुन",
};

export const nameHi = (name: string) => treeNamesHi[name] ?? name;
export const speciesShort = (species: string) => species.split(" (")[0];
export const speciesLatin = (species: string) => species.match(/\(([^)]+)\)/)?.[1] ?? "";
export const speciesHiOf = (species: string) => speciesHi[speciesShort(species)] ?? "";

export const statusWords = {
  fine: { hi: "प्रसन्न", en: "Happy", tone: "mint", icon: "eco" },
  thirsty: { hi: "प्यासा", en: "Thirsty", tone: "amber", icon: "water_drop" },
  no_proof: { hi: "इंतज़ार में", en: "Asked, not watered", tone: "amber", icon: "hourglass_top" },
  likely_dead: { hi: "संकट में", en: "In danger", tone: "rose", icon: "warning" },
} as const;

export const daysSince = (date: string) => Math.max(0, Math.round((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000));

export const plantedLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const initials = (handle: string) => handle.slice(0, 2).toUpperCase();
