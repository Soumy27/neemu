// The drive as a 3D grove: every sapling at its real position, sized by growth
// stage, leaves by health. A few template trees are generated and cloned, so
// 40+ saplings stay fast. "future" shows every sapling grown and healthy.

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";
import type { Tree } from "../api/types";
import { buildTree, heightFor } from "../three/neemTree";

const statusRing: Record<Tree["status"], string> = { fine: "#43a047", thirsty: "#f59e0b", no_proof: "#ea580c", likely_dead: "#6b7280" };

type Placed = { tree: Tree; x: number; z: number; stage: number; health: number };

function place(trees: Tree[], future: boolean): Placed[] {
  if (!trees.length) return [];
  const lat0 = trees.reduce((s, t) => s + t.location.lat, 0) / trees.length;
  const lng0 = trees.reduce((s, t) => s + t.location.lng, 0) / trees.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const pts = trees.map((t) => ({ tree: t, x: (t.location.lng - lng0) * 111_320 * k, z: -(t.location.lat - lat0) * 111_320 }));
  // A real drive is far wider than its saplings are tall, so they would be specks.
  // Keep the arrangement, shrink the distances to a walkable grove.
  const far = Math.max(1, ...pts.map((p) => Math.hypot(p.x, p.z)));
  const fit = (future ? 4.5 : 3.2) * Math.sqrt(trees.length) / far;
  pts.forEach((p) => { p.x *= fit; p.z *= fit; });
  // Keep real positions, but never let two trees overlap.
  const min = future ? 4.4 : 2.4;
  for (let pass = 0; pass < 6; pass++) {
    for (const a of pts) for (const b of pts) {
      if (a === b) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01;
      if (d < min) { const push = (min - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
    }
  }
  return pts.map((p) => ({ ...p, stage: future ? 5 : p.tree.growthStage, health: future ? 95 : p.tree.health }));
}

function useTemplates(placed: Placed[]) {
  return useMemo(() => {
    const cache = new Map<string, ReturnType<typeof buildTree>>();
    const objects = placed.map((p) => {
      const hb = Math.round(p.health / 25) * 25;
      const key = `${p.stage}-${hb}-${p.tree.species.split(" ")[0]}`;
      if (!cache.has(key)) cache.set(key, buildTree({ seed: key, stage: p.stage, health: hb }, "forest"));
      const t = cache.get(key)!;
      // Copy the meshes (geometry and materials are shared), not the Tree itself.
      const g = new THREE.Group();
      t.children.forEach((c) => g.add(c.clone()));
      g.scale.copy(t.scale);
      g.position.copy(t.position);
      g.rotation.y = (p.x * 13 + p.z * 7) % (Math.PI * 2);
      return g;
    });
    return { objects, templates: [...cache.values()] };
  }, [placed]);
}

function Grove({ placed, selected, onPick }: { placed: Placed[]; selected: string | null; onPick: (id: string) => void }) {
  const { objects, templates } = useTemplates(placed);
  const [hover, setHover] = useState<string | null>(null);
  // Wind lives in the shared materials, so moving the templates moves every copy.
  useFrame(({ clock }) => templates.forEach((t) => t.update(clock.elapsedTime)));
  return (
    <group>
      {placed.map((p, i) => {
        const on = p.tree.id === selected || p.tree.id === hover;
        return (
          <group
            key={p.tree.id}
            position={[p.x, 0, p.z]}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(p.tree.id); }}
            onPointerOver={(e) => { e.stopPropagation(); setHover(p.tree.id); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { setHover(null); document.body.style.cursor = ""; }}
          >
            <primitive object={objects[i]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[0.55, on ? 0.8 : 0.7, 32]} />
              <meshBasicMaterial color={statusRing[p.tree.status]} transparent opacity={on ? 0.95 : 0.6} />
            </mesh>
            {on && (
              <Html position={[0, heightFor(p.stage) + 0.4, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
                <div className="pill dark" style={{ whiteSpace: "nowrap" }}>{p.tree.name} #{p.tree.id.split("-").pop()}</div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function GroveScene({ trees, future, selected, onPick }: { trees: Tree[]; future: boolean; selected: string | null; onPick: (id: string) => void }) {
  const placed = useMemo(() => place(trees, future), [trees, future]);
  const span = Math.max(8, ...placed.map((p) => Math.hypot(p.x, p.z)));
  return (
    <Canvas shadows gl={{ alpha: true }} camera={{ position: [span * 0.75, span * 0.55, span * 0.95], fov: 40 }} dpr={[1, 1.75]}>
      <fog attach="fog" args={["#e9f4e2", span * 1.6, span * 3.2]} />
      <hemisphereLight args={["#fff8e7", "#6d8a4f", 1]} />
      <directionalLight position={[30, 40, 20]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={() => onPick("")}>
        <circleGeometry args={[span * 4, 64]} />
        <meshStandardMaterial color="#a7c77c" roughness={1} />
      </mesh>
      <Grove placed={placed} selected={selected} onPick={onPick} />
      <ContactShadows position={[0, 0.03, 0]} opacity={0.35} scale={span * 3} blur={2} far={6} />
      <OrbitControls enablePan maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={span * 3.5} target={[0, 1, 0]} />
    </Canvas>
  );
}
