// Mughal garden ornaments: the eight-pointed star (khatim), a gold rule,
// the arch that frames the tree, and the arch-and-sapling mark.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const Star = ({ className = "star" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1l2.9 5.2L20.5 4 18.8 9.7 23 12l-4.2 2.3 1.7 5.7-5.6-2.2L12 23l-2.9-5.2-5.6 2.2 1.7-5.7L1 12l4.2-2.3L3.5 4l5.6 2.2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
  </svg>
);

export const Rule = ({ left = false }: { left?: boolean }) => (
  <div className={`rule ${left ? "left" : ""}`} role="separator"><Star /></div>
);

// A pointed Mughal arch, drawn from the frame's real size so the curve keeps its
// proportion at any width (the shoulder follows the width, not the height).
// The same path clips the content and draws the two gold lines.
function archPath(w: number, h: number, x = 0, y = 0) {
  const s = Math.min(w * 0.46, h * 0.5);
  const X = (f: number) => (x + w * f).toFixed(1);
  const Y = (f: number) => (y + s * f).toFixed(1);
  return `M${X(0)},${(y + h).toFixed(1)} L${X(0)},${Y(1)} C${X(0)},${Y(0.57)} ${X(0.2)},${Y(0.3)} ${X(0.36)},${Y(0.183)} C${X(0.44)},${Y(0.127)} ${X(0.48)},${Y(0.073)} ${X(0.5)},${Y(0)} C${X(0.52)},${Y(0.073)} ${X(0.56)},${Y(0.127)} ${X(0.64)},${Y(0.183)} C${X(0.8)},${Y(0.3)} ${X(1)},${Y(0.57)} ${X(1)},${Y(1)} L${X(1)},${(y + h).toFixed(1)} Z`;
}

export function Arch({ children, className = "" }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const outer = size ? archPath(size.w, size.h) : "";
  const inner = size ? archPath(size.w - 18, size.h - 18, 9, 9 + Math.min(size.w * 0.46, size.h * 0.5) * 0.04) : "";
  return (
    <div ref={box} className={`arch ${className}`}>
      <div className="arch-clip" style={size ? { clipPath: `path("${outer}")` } : { visibility: "hidden" }}>{children}</div>
      {size && (
        <svg className="arch-line" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <path d={outer} fill="none" />
          <path className="inner" d={inner} fill="none" />
        </svg>
      )}
      <Star className="arch-finial" />
    </div>
  );
}

export const BrandMark = ({ className = "brand-mark" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 34 40" aria-hidden="true">
    <path d="M2 39V13C2 8 9 5 13.5 3.8 15.6 3.2 16.4 2.2 17 1c.6 1.2 1.4 2.2 3.5 2.8C25 5 32 8 32 13v26z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M17 34V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17 23c-5 0-8-3.4-8-8.6 5.4 0 8 3.4 8 8.6z" fill="currentColor" opacity="0.55" />
    <path d="M17 21c4.6 0 7.4-3 7.4-7.8-5 0-7.4 3-7.4 7.8z" fill="currentColor" />
    <path d="M9 34h16" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
