import { useId, useMemo } from 'react';

const GOLD = '#F5C400';
const GOLD_DIM = 'rgba(245, 196, 0, 0.55)';

/** Crisp rounded face guide — no blur, no CSS filters. */
export const FaceScanOverlay = ({ width, height, ready = false }) => {
  const uid = useId().replace(/:/g, '');

  const geom = useMemo(() => {
    const w = width || 360;
    const h = height || 640;
    const cx = w / 2;
    const cy = h * 0.42;
    const boxW = w * 0.78;
    const boxH = h * 0.52;
    const x = cx - boxW / 2;
    const y = cy - boxH / 2;
    const r = Math.min(boxW, boxH) * 0.08;
    const arm = Math.min(w, h) * 0.07;
    const stroke = ready ? GOLD : GOLD_DIM;
    return { w, h, x, y, boxW, boxH, r, arm, stroke };
  }, [width, height, ready]);

  const { w, h, x, y, boxW, boxH, r, arm, stroke } = geom;
  const maskId = `mask-${uid}`;
  const framePath = `M ${x + r} ${y} H ${x + boxW - r} A ${r} ${r} 0 0 1 ${x + boxW} ${y + r} V ${y + boxH - r} A ${r} ${r} 0 0 1 ${x + boxW - r} ${y + boxH} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + boxH - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;

  const corners = [
    { x: x, y: y, sx: 1, sy: 1 },
    { x: x + boxW, y: y, sx: -1, sy: 1 },
    { x: x, y: y + boxH, sx: 1, sy: -1 },
    { x: x + boxW, y: y + boxH, sx: -1, sy: -1 },
  ];

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

      <rect width={w} height={h} fill="rgba(0,0,0,0.38)" mask={`url(#${maskId})`} />

      <path
        d={framePath}
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        shapeRendering="crispEdges"
      />

      {corners.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}>
          <path
            d={`M 0 0 L 0 ${arm} M 0 0 L ${arm} 0`}
            fill="none"
            stroke={GOLD}
            strokeWidth={4}
            strokeLinecap="square"
            vectorEffect="non-scaling-stroke"
            shapeRendering="crispEdges"
          />
        </g>
      ))}
    </svg>
  );
};
