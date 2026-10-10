// The hero tree. A realistic procedural sapling (ez-tree) whose size follows
// growthStage and whose leaves follow health, in a small scene: soil that
// darkens when wet, a tree guard, rain when watered, and a sky for the weather.

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildTree, heightFor, mistColour, prefersDark } from "../three/neemTree";

export type Weather = "clear" | "hot" | "rain";

function Sapling({ seed, stage, health }: { seed: string; stage: number; health: number }) {
  // Rebuild only when the look changes in a visible way.
  const bucket = Math.round(health / 10) * 10;
  const tree = useMemo(() => buildTree({ seed, stage, health: bucket }), [seed, stage, bucket]);
  useEffect(() => () => tree.traverse((m) => (m as THREE.Mesh).geometry?.dispose()), [tree]);
  useFrame(({ clock }) => tree.update(clock.elapsedTime));
  return <primitive object={tree} />;
}

function Rain({ height }: { height: number }) {
  const drops = useMemo(() => Array.from({ length: 70 }, () => [Math.random() - 0.5, Math.random() * height, Math.random() - 0.5] as const), [height]);
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    ref.current?.children.forEach((c) => {
      c.position.y -= dt * 3;
      if (c.position.y < 0) c.position.y = height;
    });
  });
  return (
    <group ref={ref}>
      {drops.map((d, i) => (
        <mesh key={i} position={[d[0] * 1.6, d[1], d[2] * 1.6]}>
          <capsuleGeometry args={[0.012, 0.06, 2, 4]} />
          <meshStandardMaterial color="#7cc4f5" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Ground({ wetness, dusk }: { wetness: number; dusk: boolean }) {
  const soil = new THREE.Color(dusk ? "#8a7356" : "#d2b48a").lerp(new THREE.Color("#4a3320"), wetness);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color={dusk ? "#4f6b3e" : "#9fbf72"} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.6, 48]} />
        <meshStandardMaterial color={soil} roughness={1} />
      </mesh>
      {/* bamboo tree guard */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.5, 0.35, Math.sin(a) * 0.5]} castShadow>
            <cylinderGeometry args={[0.02, 0.022, 0.7, 6]} />
            <meshStandardMaterial color="#b08a52" roughness={0.8} />
          </mesh>
        );
      })}
      {[0.2, 0.6].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.014, 6, 40]} />
          <meshStandardMaterial color="#9c7643" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function Tree3D({ seed, stage, health, wetness, watering, weather = "clear" }: { seed: string; stage: number; health: number; wetness: number; watering: boolean; weather?: Weather }) {
  const [ready, setReady] = useState(false);
  const dusk = prefersDark();
  const h = heightFor(stage);
  const sun: [number, number, number] = weather === "hot" ? [3, 6, 2] : weather === "rain" ? [2, 2, -4] : [4, 4, 3];
  return (
    <>
      {!ready && (
        <div className="tree-loading">
          <span className="ms">potted_plant</span>
          <span>Growing the tree…</span>
        </div>
      )}
      <Canvas onCreated={() => setReady(true)} shadows gl={{ alpha: true }} camera={{ position: [h * 1.3, h * 0.75, h * 1.6], fov: 38 }} dpr={[1, 2]}>
        {/* the sky is the CSS gradient behind a transparent canvas; mist hides the ground's edge */}
        <fog attach="fog" args={[mistColour(weather), h * 2.2, h * 5]} />
        {/* by night the garden is lit low and warm, like the last of the evening */}
        <hemisphereLight args={[dusk ? "#9fb4d6" : "#fff8e7", dusk ? "#2e3f2a" : "#6d8a4f", dusk ? 0.55 : weather === "rain" ? 0.7 : 1]} />
        <directionalLight position={dusk ? [4, 2.2, 3] : sun} color={dusk ? "#ffcf8a" : "#ffffff"} intensity={dusk ? 1.3 : weather === "hot" ? 2.4 : weather === "rain" ? 0.8 : 1.8} castShadow shadow-mapSize={[2048, 2048]} />
        <Sapling seed={seed} stage={stage} health={health} />
        <Ground wetness={wetness} dusk={dusk} />
        {(watering || weather === "rain") && <Rain height={h + 1} />}
        <ContactShadows position={[0, 0.02, 0]} opacity={0.4} scale={5} blur={2.4} far={3} />
        <OrbitControls enablePan={false} minDistance={h * 0.9} maxDistance={h * 4} maxPolarAngle={Math.PI / 2.05} target={[0, h * 0.45, 0]} />
      </Canvas>
    </>
  );
}
