/** Yellow corner frame only — center guide, no edge bars or full border box. */
const GOLD = '#F5C400';

export const FaceScanOverlay = () => (
  <svg
    viewBox="0 0 320 480"
    preserveAspectRatio="xMidYMid meet"
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '78%',
      height: 'auto',
      maxHeight: '62vh',
      pointerEvents: 'none',
    }}
    aria-hidden
  >
    <defs>
      <filter id="cornerGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="rgba(245, 196, 0, 0.45)" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {[
      { x: 32, y: 48, sx: 1, sy: 1 },
      { x: 288, y: 48, sx: -1, sy: 1 },
      { x: 32, y: 432, sx: 1, sy: -1 },
      { x: 288, y: 432, sx: -1, sy: -1 },
    ].map((c, i) => (
      <g
        key={i}
        transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}
        filter="url(#cornerGlow)"
      >
        <path d="M 0 0 L 0 48 L 12 48 L 12 12 L 48 12 L 48 0 Z" fill={GOLD} />
      </g>
    ))}
  </svg>
);
