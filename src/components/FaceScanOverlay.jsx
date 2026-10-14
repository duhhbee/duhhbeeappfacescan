import { useEffect, useId, useMemo, useState } from 'react';

const GOLD = '#F5C400';

/**
 * Face scanner frame — 100% frontend (WebView). Not from backend.
 * Vignette + oval + corner brackets; sizes track the video container.
 */
export const FaceScanOverlay = ({ width, height }) => {
  const uid = useId().replace(/:/g, '');
  const [scanT, setScanT] = useState(0);

  useEffect(() => {
    let frame;
    let t = 0;
    const tick = () => {
      t += 0.008;
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
    const cy = h * 0.42;
    const rx = Math.min(w * 0.38, h * 0.26);
    const ry = h * 0.3;
    const cornerLen = Math.min(w, h) * 0.07;
    const cornerStroke = Math.max(3, Math.min(w, h) * 0.008);

    const scanY = cy - ry + (Math.sin(scanT) * 0.5 + 0.5) * (ry * 2);

    return { w, h, cx, cy, rx, ry, cornerLen, cornerStroke, scanY };
  }, [width, height, scanT]);

  const { w, h, cx, cy, rx, ry, cornerLen, cornerStroke, scanY } = geom;
  const maskId = `faceHole-${uid}`;
  const clipId = `ovalClip-${uid}`;

  const corners = [
    { x: cx - rx, y: cy - ry, sx: 1, sy: 1 },
    { x: cx + rx, y: cy - ry, sx: -1, sy: 1 },
    { x: cx - rx, y: cy + ry, sx: 1, sy: -1 },
    { x: cx + rx, y: cy + ry, sx: -1, sy: -1 },
  ];

  const bracket = (len, sw) =>
    `M 0 0 L 0 ${len} L ${sw} ${len} L ${sw} ${sw} L ${len} ${sw} L ${len} 0 Z`;

  return (
    <>
      <style>{`
        @keyframes scannerPulse-${uid} {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        .scanner-oval-${uid} {
          animation: scannerPulse-${uid} 2.4s ease-in-out infinite;
        }
      `}</style>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        <defs>
          <mask id={maskId}>
            <rect width={w} height={h} fill="white" />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
          </mask>
          <linearGradient id={`scanBeam-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
            <stop offset="50%" stopColor={GOLD} stopOpacity="0.55" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}>
            <ellipse cx={cx} cy={cy} rx={rx - 2} ry={ry - 2} />
          </clipPath>
          <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={w} height={h} fill="rgba(0,0,0,0.48)" mask={`url(#${maskId})`} />

        <ellipse
          className={`scanner-oval-${uid}`}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={GOLD}
          strokeWidth={2}
          opacity={0.95}
        />

        <g clipPath={`url(#${clipId})`} opacity={0.55}>
          <line
            x1={cx - rx}
            x2={cx + rx}
            y1={scanY}
            y2={scanY}
            stroke={`url(#scanBeam-${uid})`}
            strokeWidth={2}
          />
        </g>

        {corners.map((c, i) => (
          <g
            key={i}
            transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}
            filter={`url(#glow-${uid})`}
          >
            <path d={bracket(cornerLen, cornerStroke)} fill={GOLD} />
          </g>
        ))}
      </svg>
    </>
  );
};
