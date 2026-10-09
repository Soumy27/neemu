// A square card to share Neemu's day (WhatsApp, Instagram). Drawn on a canvas, no server.

import type { NeemuSays, Tree } from "../api/types";

export async function shareCard(tree: Tree, says: NeemuSays) {
  const c = document.createElement("canvas");
  c.width = c.height = 1080;
  const g = c.getContext("2d")!;
  g.fillStyle = says.heatwave?.active ? "#7a1f14" : "#1f4d2a";
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = "#ffffff";
  g.font = "bold 92px system-ui, sans-serif";
  g.fillText(`${tree.name} 🌳`, 80, 190);
  g.font = "40px system-ui, sans-serif";
  g.globalAlpha = 0.85;
  g.fillText(`${tree.species} · ${tree.location.label}`, 80, 260);
  g.globalAlpha = 1;
  g.font = "bold 150px system-ui, sans-serif";
  g.fillText(`🔥 ${tree.streakDays}`, 80, 520);
  g.font = "44px system-ui, sans-serif";
  g.fillText("days in a row looking after a real tree", 80, 590);
  g.font = "bold 80px system-ui, sans-serif";
  g.fillText(`💧 ${tree.litresSaved} L saved`, 80, 760);
  g.font = "40px system-ui, sans-serif";
  g.fillText("because it rained and Neemu said 'don't come'", 80, 820);
  g.globalAlpha = 0.7;
  g.fillText("Neemu · the tree that calls you when it's thirsty", 80, 1000);

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) return;
  const file = new File([blob], `neemu-${tree.id}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: tree.name }).catch(() => {});
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(a.href);
}
