import { useEffect, useId, useState } from 'react';
import { readGuideGeom, readPose, poseInstruction } from '../guideGeometry';

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
  const copy = poseInstruction(pose);
  const maskId = `mask-${uid}`;
  const glowId = `oval-glow-${uid}`;

  const outerStroke = ready ? GOLD : 'rgba(245, 196, 0, 0.72)';
  const innerStroke = ready ? 'rgba(245, 196, 0, 0.45)' : 'rgba(255, 255, 255, 0.28)';

  const bannerW = Math.min(w * 0.92, 340);
  const bannerH = 56;
  const bannerX = cx - bannerW / 2;
  const bannerY = Math.max(12, cy - ry - bannerH - 20);

  const turnArrow =
    pose === 'left'
      ? { x1: cx + rx * 0.55, y1: cy, x2: cx - rx * 0.35, y2: cy, head: 'left' }
      : pose === 'right'
        ? { x1: cx - rx * 0.55, y1: cy, x2: cx + rx * 0.35, y2: cy, head: 'right' }
        : null;

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

      <rect
        x={bannerX}
        y={bannerY}
        width={bannerW}
        height={bannerH}
        rx={14}
        fill="rgba(8, 8, 8, 0.72)"
        stroke={ready ? GOLD : 'rgba(245, 196, 0, 0.55)'}
        strokeWidth={2}
      />
      <text
        x={cx}
        y={bannerY + 22}
        textAnchor="middle"
        fill={ready ? GOLD : '#FFFFFF'}
        fontSize={13}
        fontWeight="800"
        letterSpacing="0.06em"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {copy.title}
      </text>
      <text
        x={cx}
        y={bannerY + 42}
        textAnchor="middle"
        fill="rgba(255,255,255,0.88)"
        fontSize={11}
        fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {copy.detail}
      </text>

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

      {turnArrow ? (
        <g stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
          <line x1={turnArrow.x1} y1={turnArrow.y1} x2={turnArrow.x2} y2={turnArrow.y2} />
          {turnArrow.head === 'left' ? (
            <path
              d={`M ${turnArrow.x2} ${turnArrow.y2} L ${turnArrow.x2 + 12} ${turnArrow.y2 - 8} M ${turnArrow.x2} ${turnArrow.y2} L ${turnArrow.x2 + 12} ${turnArrow.y2 + 8}`}
              fill="none"
            />
          ) : (
            <path
              d={`M ${turnArrow.x2} ${turnArrow.y2} L ${turnArrow.x2 - 12} ${turnArrow.y2 - 8} M ${turnArrow.x2} ${turnArrow.y2} L ${turnArrow.x2 - 12} ${turnArrow.y2 + 8}`}
              fill="none"
            />
          )}
        </g>
      ) : (
        <>
          <line
            x1={cx - rx * 0.4}
            y1={cy}
            x2={cx + rx * 0.4}
            y2={cy}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
          />
          <line
            x1={cx}
            y1={cy - ry * 0.4}
            x2={cx}
            y2={cy + ry * 0.4}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1}
          />
        </>
      )}
    </svg>
  );
};
