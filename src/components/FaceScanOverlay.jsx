import { useEffect, useId, useState } from 'react';

const GOLD = '#F5C400';

/** Mockup-style guide: yellow corners, dashed oval, crosshair. */
const readGuideGeom = (width, height, _guideTick = 0) => {
    const w = width || 360;
    const h = height || 640;
    const cx = w / 2;
    const topPad =
      typeof window !== 'undefined' && window.__duhhGuideTopPad != null
        ? Number(window.__duhhGuideTopPad)
        : 0.11;
    const bottomPad =
      typeof window !== 'undefined' && window.__duhhGuideBottomPad != null
        ? Number(window.__duhhGuideBottomPad)
        : 0.3;
    const bandTop = h * (Number.isFinite(topPad) ? topPad : 0.11);
    const bandH = h * (1 - (topPad || 0.11) - (bottomPad || 0.3));
    const bandCenter =
      typeof window !== 'undefined' && window.__duhhGuideBandCenter != null
        ? Number(window.__duhhGuideBandCenter)
        : 0.58;
    const cy = bandTop + bandH * (Number.isFinite(bandCenter) ? bandCenter : 0.58);
    const boxW = w * 0.88;
    const boxH = Math.max(bandH * 0.88, h * 0.32);
    const x = cx - boxW / 2;
    const y = cy - boxH / 2;
    const r = Math.min(boxW, boxH) * 0.1;
    const arm = Math.min(w, h) * 0.065;
    const rx = boxW * 0.36;
    const ry = boxH * 0.42;
    return { w, h, cx, cy, x, y, boxW, boxH, r, arm, rx, ry };
};

export const FaceScanOverlay = ({ width, height, ready = false }) => {
  const uid = useId().replace(/:/g, '');
  const [guideTick, setGuideTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setGuideTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, []);

  const { w, h, cx, cy, x, y, boxW, boxH, r, arm, rx, ry } = readGuideGeom(width, height, guideTick);
  const maskId = `mask-${uid}`;
  const framePath = `M ${x + r} ${y} H ${x + boxW - r} A ${r} ${r} 0 0 1 ${x + boxW} ${y + r} V ${y + boxH - r} A ${r} ${r} 0 0 1 ${x + boxW - r} ${y + boxH} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + boxH - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;

  const corners = [
    { x, y, sx: 1, sy: 1 },
    { x: x + boxW, y, sx: -1, sy: 1 },
    { x, y: y + boxH, sx: 1, sy: -1 },
    { x: x + boxW, y: y + boxH, sx: -1, sy: -1 },
  ];

  const frameStroke = ready ? GOLD : 'rgba(245, 196, 0, 0.65)';

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect width={w} height={h} fill="white" />
          <path d={framePath} fill="black" />
        </mask>
      </defs>

      <rect width={w} height={h} fill="rgba(0,0,0,0.42)" mask={`url(#${maskId})`} />

      <path d={framePath} fill="none" stroke={frameStroke} strokeWidth={2.5} />

      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.5}
        strokeDasharray="6 8"
      />

      <line x1={cx - rx * 0.85} y1={cy} x2={cx + rx * 0.85} y2={cy} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 6" />
      <line x1={cx} y1={cy - ry * 0.85} x2={cx} y2={cy + ry * 0.85} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 6" />

      {corners.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}>
          <path
            d={`M 0 0 L 0 ${arm} M 0 0 L ${arm} 0`}
            fill="none"
            stroke={GOLD}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
};
