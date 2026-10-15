import { useEffect, useId, useState } from 'react';
import { computeGuideGeom } from '../faceGuideGeom';

const GOLD = '#F5C400';
const GOLD_SOFT = 'rgba(245, 196, 0, 0.55)';

const POSE_UI = {
  center: { title: 'CENTER', width: 132 },
  left: { title: 'TURN LEFT', width: 158 },
  right: { title: 'TURN RIGHT', width: 168 },
};

const readPose = () => {
  const p = typeof window !== 'undefined' ? window.__duhhPose : undefined;
  if (p === 'left' || p === 'right' || p === 'center') return p;
  return 'center';
};

export const FaceScanOverlay = ({ width, height, ready = false }) => {
  const uid = useId().replace(/:/g, '');
  const [dashOffset, setDashOffset] = useState(0);
  const [pose, setPose] = useState('center');

  useEffect(() => {
    const poseId = setInterval(() => setPose(readPose()), 400);
    return () => clearInterval(poseId);
  }, []);

  useEffect(() => {
    if (ready) return undefined;
    let frame;
    const tick = () => {
      setDashOffset((v) => (v + 0.8) % 40);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const { w, h, cx, cy, rx, ry } = computeGuideGeom(width, height);
  const maskId = `oval-mask-${uid}`;
  const glowId = `oval-glow-${uid}`;

  const outerStroke = ready ? GOLD : GOLD_SOFT;
  const innerStroke = ready ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)';
  const pillCopy = POSE_UI[pose] ?? POSE_UI.center;
  const pillW = pillCopy.width;
  const pillH = 40;
  const pillX = cx - pillW / 2;
  const pillY = Math.min(cy + ry + 20, h - pillH - 14);
  const chevronY = pillY + pillH / 2;
  const chevronLeftX = pillX + 18;
  const chevronRightX = pillX + pillW - 18;

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
          <feDropShadow dx="0" dy="0" stdDeviation={ready ? 5 : 2} floodColor={GOLD} floodOpacity={ready ? 0.65 : 0.25} />
        </filter>
        <filter id={`pose-pill-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <rect width={w} height={h} fill="rgba(0,0,0,0.48)" mask={`url(#${maskId})`} />

      <g filter={`url(#${glowId})`}>
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={outerStroke}
          strokeWidth={ready ? 3.5 : 2.5}
          strokeDasharray={ready ? undefined : '10 14'}
          strokeDashoffset={ready ? 0 : dashOffset}
        />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx * 0.92}
          ry={ry * 0.92}
          fill="none"
          stroke={innerStroke}
          strokeWidth={1.25}
        />
      </g>

      <g aria-label={pillCopy.title} filter={`url(#pose-pill-shadow-${uid})`}>
        <rect
          x={pillX}
          y={pillY}
          width={pillW}
          height={pillH}
          rx={pillH / 2}
          fill="rgba(12, 12, 12, 0.62)"
          stroke={ready ? GOLD : GOLD_SOFT}
          strokeWidth={2}
        />
        {pose === 'left' ? (
          <path
            d={`M ${chevronLeftX + 6} ${chevronY - 7} L ${chevronLeftX - 4} ${chevronY} L ${chevronLeftX + 6} ${chevronY + 7}`}
            fill="none"
            stroke={GOLD}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {pose === 'right' ? (
          <path
            d={`M ${chevronRightX - 6} ${chevronY - 7} L ${chevronRightX + 4} ${chevronY} L ${chevronRightX - 6} ${chevronY + 7}`}
            fill="none"
            stroke={GOLD}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <text
          x={cx + (pose === 'left' ? 6 : pose === 'right' ? -6 : 0)}
          y={pillY + pillH / 2 + 5}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={12}
          fontWeight="700"
          letterSpacing="0.12em"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        >
          {pillCopy.title}
        </text>
      </g>
    </svg>
  );
};
