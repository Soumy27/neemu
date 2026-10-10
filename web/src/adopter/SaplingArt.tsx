// A small drawn sapling for cards: height from growth stage, leaf colour from health.

import { leafTint } from "../three/neemTree";

export function SaplingArt({ stage, health, photo }: { stage: number; health: number; photo?: string | null }) {
  if (photo) return <div className="sapling-art"><img src={photo} alt="" /></div>;
  const c = `#${leafTint(health).multiplyScalar(0.72).getHexString()}`;
  const top = 92 - stage * 11;
  const r = 10 + stage * 3.5;
  return (
    <div className="sapling-art" aria-hidden="true">
      <svg viewBox="0 0 130 130" width="130" height="130">
        <ellipse cx="65" cy="112" rx="34" ry="8" fill="#b08a5a" opacity="0.55" />
        <path d={`M65 112 C64 ${top + 30}, 66 ${top + 14}, 65 ${top}`} stroke="#6b4a2b" strokeWidth={3 + stage * 0.6} fill="none" strokeLinecap="round" />
        <circle cx={65} cy={top} r={r} fill={c} />
        <circle cx={65 - r * 0.8} cy={top + r * 0.5} r={r * 0.7} fill={c} opacity="0.92" />
        <circle cx={65 + r * 0.8} cy={top + r * 0.45} r={r * 0.72} fill={c} opacity="0.9" />
        {[40, 50, 60, 70, 80, 90].map((x) => <line key={x} x1={x} y1={88} x2={x} y2={112} stroke="#5a4630" strokeWidth="2" opacity="0.7" />)}
        <line x1="38" y1="96" x2="92" y2="96" stroke="#5a4630" strokeWidth="2" opacity="0.6" />
      </svg>
    </div>
  );
}
