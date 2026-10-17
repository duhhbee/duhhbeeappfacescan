import { useEffect, useId, useState } from 'react';
import { readGuideGeom, readPose } from '../guideGeometry';

const GOLD = '#F5C400';

export const FaceScanOverlay = ({ width, height, ready = false }) => {
  const uid = useId().replace(/:/g, '');
  const [pose, setPose] = useState('center');

  useEffect(() => {
    const sync = () => setPose(readPose());
    sync();
    const id = setInterval(sync, 150);
    return () => clearInterval(id);
  }, []);

  const { w, h, cx, cy, rx, ry } = readGuideGeom(width, height);
  const maskId = `mask-${uid}`;
  const glowId = `oval-glow-${uid}`;

  const outerStroke = ready ? GOLD : 'rgba(245, 196, 0, 0.72)';
  const innerStroke = ready ? 'rgba(245, 196, 0, 0.45)' : 'rgba(255, 255, 255, 0.28)';

  const poseHint =
    pose === 'left'
      ? { label: '←', opacity: 1 }
      : pose === 'right'
        ? { label: '→', opacity: 1 }
        : { label: '•', opacity: 0.85 };

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
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={ready ? 3 : 1.5} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={w} height={h} fill="rgba(0,0,0,0.48)" mask={`url(#${maskId})`} />

      <ellipse
        cx={cx}
        cy={cy}
        rx={rx * 1.02}
        ry={ry * 1.02}
        fill="none"
        stroke={innerStroke}
        strokeWidth={1}
        strokeDasharray="5 7"
      />

      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={outerStroke}
        strokeWidth={ready ? 3.5 : 2.5}
        filter={ready ? `url(#${glowId})` : undefined}
        strokeLinecap="round"
      />

      <line
        x1={cx - rx * 0.55}
        y1={cy}
        x2={cx + rx * 0.55}
        y2={cy}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />
      <line
        x1={cx}
        y1={cy - ry * 0.55}
        x2={cx}
        y2={cy + ry * 0.55}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />

      <text
        x={cx}
        y={cy + ry + 28}
        textAnchor="middle"
        fill={ready ? GOLD : 'rgba(255,255,255,0.7)'}
        fontSize={22}
        fontWeight="700"
        opacity={poseHint.opacity}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {poseHint.label}
      </text>
    </svg>
  );
};
