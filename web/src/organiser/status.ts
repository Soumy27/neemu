import type { TreeStatus } from "../api/types";

// Worst first: the order an organiser needs to act in.
export const statusOrder: TreeStatus[] = ["likely_dead", "no_proof", "thirsty", "fine"];

export const statusLabel: Record<TreeStatus, string> = {
  fine: "Fine",
  thirsty: "Thirsty today",
  no_proof: "No proof",
  likely_dead: "Likely dead",
};

export const statusHint: Record<TreeStatus, string> = {
  fine: "Watered, or the rain did it",
  thirsty: "Needs water today",
  no_proof: "Asked, but no photo came back",
  likely_dead: "No care for weeks",
};

// Map paint needs literal colours; these match --green, --amber, --red in index.css.
export const statusColor: Record<TreeStatus, string> = {
  fine: "#2f7d3a",
  thirsty: "#b7791f",
  no_proof: "#b23a2a",
  likely_dead: "#7a7f78",
};

export function daysSince(iso: string | null): string {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}
