// The 3D tree. Its shape comes from growthStage, its colour and droop from health.
// Same tree id always grows the same tree (seeded random).

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

function seeded(seedText: string) {
  let s = 0;
  for (const c of seedText) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface Branch { start: THREE.Vector3; end: THREE.Vector3; radius: number; depth: number }

function grow(seed: string, stage: number) {
  const rand = seeded(seed);
  const branches: Branch[] = [];
  const tips: THREE.Vector3[] = [];
  const maxDepth = stage + 1;
  const walk = (start: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, depth: number) => {
    const end = start.clone().add(dir.clone().multiplyScalar(length));
    branches.push({ start, end, radius, depth });
    if (depth >= maxDepth) {
      tips.push(end);
      return;
    }
    const kids = depth === 0 ? 3 : 2 + Math.floor(rand() * 2);
    for (let k = 0; k < kids; k++) {
      const spin = (k / kids) * Math.PI * 2 + rand() * 0.8;
      const tilt = 0.45 + rand() * 0.45;
      const d = dir.clone()
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt * Math.cos(spin))
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt * Math.sin(spin))
        .normalize();
      walk(end, d, length * (0.68 + rand() * 0.12), radius * 0.62, depth + 1);
    }
  };
  walk(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.55 + stage * 0.12, 0.05 + stage * 0.012, 0);
  return { branches, tips, rand };
}

const healthy = new THREE.Color("#3f9b4a");
const dry = new THREE.Color("#b59a45");
const dead = new THREE.Color("#7a5a3a");

function leafColour(health: number) {
  const h = health / 100;
  return h > 0.5 ? dry.clone().lerp(healthy, (h - 0.5) * 2) : dead.clone().lerp(dry, h * 2);
}

function Plant({ seed, stage, health, watering }: { seed: string; stage: number; health: number; watering: boolean }) {
  const { branches, tips, rand } = useMemo(() => grow(seed, stage), [seed, stage]);
  const leaves = useMemo(
    () =>
      tips.flatMap((tip) =>
        Array.from({ length: 5 }, () => ({
          pos: tip.clone().add(new THREE.Vector3(rand() - 0.5, rand() * 0.4 - 0.1, rand() - 0.5).multiplyScalar(0.35)),
          scale: 0.09 + rand() * 0.07,
          phase: rand() * Math.PI * 2,
        })),
      ),
    [tips, rand],
  );
  const group = useRef<THREE.Group>(null);
  const colour = leafColour(health);
  const droop = (1 - health / 100) * 0.35;
  // Low health drops leaves evenly across the crown, not from one side.
  const keep = Math.max(0.15, health / 100);
  const shown = leaves.filter((_, i) => ((i * 0.618) % 1) < keep);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.015 + droop * 0.2;
  });

  return (
    <group ref={group}>
      {branches.map((b, i) => {
        const mid = b.start.clone().add(b.end).multiplyScalar(0.5);
        const len = b.start.distanceTo(b.end);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.end.clone().sub(b.start).normalize());
        return (
          <mesh key={i} position={mid} quaternion={q} castShadow>
            <cylinderGeometry args={[b.radius * 0.7, b.radius, len, 7]} />
            <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
          </mesh>
        );
      })}
      {shown.map((l, i) => (
        <Leaf key={i} pos={l.pos} scale={l.scale} phase={l.phase} colour={colour} droop={droop} />
      ))}
      {watering && <Rain />}
    </group>
  );
}

function Leaf({ pos, scale, phase, colour, droop }: { pos: THREE.Vector3; scale: number; phase: number; colour: THREE.Color; droop: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = pos.y - droop * 0.25 + Math.sin(clock.elapsedTime * 1.4 + phase) * 0.01;
  });
  return (
    <mesh ref={ref} position={pos} scale={scale} castShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={colour} roughness={0.7} flatShading />
    </mesh>
  );
}

function Rain() {
  const drops = useMemo(() => Array.from({ length: 40 }, () => [Math.random() - 0.5, Math.random() * 2.5, Math.random() - 0.5] as const), []);
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    ref.current?.children.forEach((c) => {
      c.position.y -= dt * 2.2;
      if (c.position.y < 0) c.position.y = 2.5;
    });
  });
  return (
    <group ref={ref}>
      {drops.map((d, i) => (
        <mesh key={i} position={[d[0] * 0.8, d[1], d[2] * 0.8]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#6ec3ff" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Ground({ wetness }: { wetness: number }) {
  const soil = new THREE.Color("#c9a26b").lerp(new THREE.Color("#6b4a2b"), wetness);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3, 48]} />
        <meshStandardMaterial color="#9cbf73" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color={soil} roughness={1} />
      </mesh>
      {/* tree guard */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.6, 0.35, Math.sin(a) * 0.6]}>
            <cylinderGeometry args={[0.012, 0.012, 0.7, 6]} />
            <meshStandardMaterial color="#3d3d3d" metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Tree3D({ seed, stage, health, wetness, watering }: { seed: string; stage: number; health: number; wetness: number; watering: boolean }) {
  const [ready, setReady] = useState(false);
  return (
    <>
    {!ready && <div className="tree-loading">Growing the tree…</div>}
    <Canvas onCreated={() => setReady(true)} shadows camera={{ position: [2.4, 1.8, 2.8], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={["#e9f3e1"]} />
      <hemisphereLight args={["#fff8e7", "#7d9b6a", 0.9]} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <Plant seed={seed} stage={stage} health={health} watering={watering} />
      <Ground wetness={wetness} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={4} blur={2.5} far={2} />
      <OrbitControls enablePan={false} minDistance={2} maxDistance={6} maxPolarAngle={Math.PI / 2.1} target={[0, 0.9, 0]} />
    </Canvas>
    </>
  );
}
