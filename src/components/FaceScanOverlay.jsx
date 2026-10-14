import { useEffect, useId, useMemo, useState } from 'react';

const ACCENT = '#F5C400';
const LINE = 'rgba(255, 255, 255, 0.88)';

/** Minimal modern scanner frame — thin lines, soft vignette. */
export const FaceScanOverlay = ({ width, height, ready = false }) => {
  const uid = useId().replace(/:/g, '');
  const [scanT, setScanT] = useState(0);

  useEffect(() => {
    let frame;
    let t = 0;
    const tick = () => {
      t += 0.006;
      setScanT(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const geom = useMemo(() => {
    const w = width || 360;
    const h = height || 640;
    const cx = w / 2;
    const cy = h * 0.4;
    const rx = Math.min(w * 0.34, h * 0.24);
    const ry = h * 0.285;
    const scanY = cy - ry + (Math.sin(scanT) * 0.5 + 0.5) * (ry * 2);
    const tick = Math.min(w, h) * 0.055;
    return { w, h, cx, cy, rx, ry, scanY, tick };
  }, [width, height, scanT]);

  const { w, h, cx, cy, rx, ry, scanY, tick } = geom;
  const maskId = `hole-${uid}`;
  const clipId = `clip-${uid}`;
  const stroke = ready ? ACCENT : LINE;

  const corners = [
    { x: cx - rx, y: cy - ry, sx: 1, sy: 1 },
    { x: cx + rx, y: cy - ry, sx: -1, sy: 1 },
    { x: cx - rx, y: cy + ry, sx: 1, sy: -1 },
    { x: cx + rx, y: cy + ry, sx: -1, sy: -1 },
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
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
        </mask>
        <linearGradient id={`beam-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0" />
          <stop offset="50%" stopColor={ACCENT} stopOpacity="0.75" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <ellipse cx={cx} cy={cy} rx={rx - 1} ry={ry - 1} />
        </clipPath>
      </defs>

      <rect width={w} height={h} fill="rgba(0,0,0,0.5)" mask={`url(#${maskId})`} />

      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        opacity={ready ? 1 : 0.75}
      />

      <g clipPath={`url(#${clipId})`} opacity={0.85}>
        <line
          x1={cx - rx}
          x2={cx + rx}
          y1={scanY}
          y2={scanY}
          stroke={`url(#beam-${uid})`}
          strokeWidth={1.5}
        />
      </g>

      {corners.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}>
          <path
            d={`M 0 0 L 0 ${tick} M 0 0 L ${tick} 0`}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
};
