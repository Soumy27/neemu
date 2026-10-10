// Tree looks shared by 2D and 3D: no 3D library here, so cheap to import anywhere.

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t) as RGB;

// Tints multiply the leaf texture, so they are lighter than the colour you see.
const green = hex("#b9f58a");
const yellow = hex("#f2d27a");
const brown = hex("#b08a5a");

// Leaf colour for a health from 0 to 100, as a number (0xRRGGBB); `shade` darkens it for flat drawings.
export function leafTint(health: number, shade = 1) {
  const h = Math.max(0, Math.min(1, health / 100));
  const c = h > 0.5 ? mix(yellow, green, (h - 0.5) * 2) : mix(brown, yellow, h * 2);
  const [r, g, b] = c.map((v) => Math.round(v * shade));
  return (r << 16) | (g << 8) | b;
}
export const cssHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

// Height of the finished tree in scene units (1 unit is about 1 metre).
export const heightFor = (stage: number) => 0.9 + stage * 0.55;

export const prefersDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

// The mist at the horizon matches the arch's sky in light and dark themes.
export function mistColour(weather: "clear" | "hot" | "rain" = "clear") {
  if (prefersDark()) return weather === "hot" ? "#5e5233" : weather === "rain" ? "#3f5452" : "#3d5a4c";
  return weather === "hot" ? "#f3e6cf" : weather === "rain" ? "#d3e0e0" : "#dceee3";
}
