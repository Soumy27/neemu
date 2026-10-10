// Realistic procedural trees from ez-tree (MIT, github.com/dgreenheck/ez-tree).
// One function builds a tree for a sapling: its size comes from growthStage,
// its leaves (count and colour) from health. Same id, same tree.

import { Tree } from "@dgreenheck/ez-tree";
import * as THREE from "three";

export interface TreeLook {
  seed: string;
  stage: number; // 1 to 5
  health: number; // 0 to 100
}

function seedOf(text: string) {
  let s = 7;
  for (const c of text) s = (s * 31 + c.charCodeAt(0)) % 100000;
  return s;
}

// Tints multiply the leaf texture, so they are lighter than the colour you see.
const green = new THREE.Color("#b9f58a");
const yellow = new THREE.Color("#f2d27a");
const brown = new THREE.Color("#b08a5a");

export function leafTint(health: number) {
  const h = Math.max(0, Math.min(1, health / 100));
  return h > 0.5 ? yellow.clone().lerp(green, (h - 0.5) * 2) : brown.clone().lerp(yellow, h * 2);
}

// Height of the finished tree in scene units (1 unit is about 1 metre).
export const heightFor = (stage: number) => 0.9 + stage * 0.55;

export function buildTree({ seed, stage, health }: TreeLook, quality: "hero" | "forest" = "hero"): Tree {
  const t = new Tree();
  t.loadPreset("Ash Small");
  const o = t.options;
  o.seed = seedOf(seed);
  // Young saplings: fewer branch levels and children; it fills out as it grows.
  o.branch.levels = 3;
  o.branch.children[0] = 4 + stage;
  o.branch.children[1] = 3 + Math.ceil(stage / 2);
  o.branch.children[2] = 3;
  if (quality === "forest") {
    o.branch.sections[0] = 6;
    o.branch.sections[1] = 5;
    o.branch.sections[2] = 4;
    o.branch.segments[0] = 5;
  }
  // Leaves thin out and lose colour as health falls.
  const keep = Math.max(0.12, health / 100);
  o.leaves.count = Math.max(2, Math.round(o.leaves.count * 1.4 * keep * (quality === "forest" ? 0.6 : 1)));
  o.leaves.size *= 1.25;
  o.leaves.tint = leafTint(health).getHex();
  o.bark.tint = 0xc9b8a0;
  t.generate();

  // Scale to a sapling-sized height, base on the ground.
  const box = new THREE.Box3().setFromObject(t);
  const h = box.max.y - box.min.y || 1;
  const s = heightFor(stage) / h;
  t.scale.setScalar(s);
  t.position.y = -box.min.y * s;
  t.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return t;
}
