import { useId, useMemo } from 'react';

const GOLD = '#F5C400';

/** Mockup-style guide: yellow corners, dashed oval, crosshair. */
export const FaceScanOverlay = ({ width, height, ready = false }) => {
  const uid = useId().replace(/:/g, '');

  const geom = useMemo(() => {
    const w = width || 360;
    const h = height || 640;
    const cx = w / 2;
    const cy = h * 0.42;
    const boxW = w * 0.82;
    const boxH = h * 0.54;
    const x = cx - boxW / 2;
    const y = cy - boxH / 2;
    const r = Math.min(boxW, boxH) * 0.1;
    const arm = Math.min(w, h) * 0.065;
    const rx = boxW * 0.36;
    const ry = boxH * 0.42;
    return { w, h, cx, cy, x, y, boxW, boxH, r, arm, rx, ry, ready };
  }, [width, height, ready]);

  const { w, h, cx, cy, x, y, boxW, boxH, r, arm, rx, ry } = geom;
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
