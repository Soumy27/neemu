// Mughal garden ornaments: the eight-pointed star (khatim), a gold rule,
// the arch that frames the tree, and the arch-and-sapling mark.

import type { ReactNode } from "react";

export const Star = ({ className = "star" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1l2.9 5.2L20.5 4 18.8 9.7 23 12l-4.2 2.3 1.7 5.7-5.6-2.2L12 23l-2.9-5.2-5.6 2.2 1.7-5.7L1 12l4.2-2.3L3.5 4l5.6 2.2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
  </svg>
);

export const Rule = ({ left = false }: { left?: boolean }) => (
  <div className={`rule ${left ? "left" : ""}`} role="separator"><Star /></div>
);

// A pointed Mughal arch. The same path clips the content and draws the gold outline,
// so the frame stays aligned at any size.
const ARCH = "M0,100 L0,30 C0,17 20,9 36,5.5 C44,3.8 48,2.2 50,0 C52,2.2 56,3.8 64,5.5 C80,9 100,17 100,30 L100,100 Z";

export const archMask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${ARCH}' fill='black'/></svg>`)}")`;

export function Arch({ children, className = "" }: { children: ReactNode; className?: string }) {
  const mask = { WebkitMaskImage: archMask, maskImage: archMask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" };
  return (
    <div className={`arch ${className}`}>
      <div className="arch-clip" style={mask}>{children}</div>
      <svg className="arch-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={ARCH} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <svg className="arch-line inner" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={ARCH} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
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
