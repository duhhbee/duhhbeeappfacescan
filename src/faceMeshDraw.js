import {
  FACEMESH_FACE_OVAL,
  FACEMESH_LEFT_EYE,
  FACEMESH_RIGHT_EYE,
  FACEMESH_LIPS,
} from '@mediapipe/face_mesh';
import { drawConnectors } from '@mediapipe/drawing_utils';

const GOLD = '#F5C400';
const GOLD_SOFT = 'rgba(245, 196, 0, 0.55)';
const WHITE_SOFT = 'rgba(255, 255, 255, 0.35)';

const SMOOTH_FACTOR = 0.38;

/** EMA landmark smoothing — less jitter on mesh lines. */
export const smoothLandmarks = (prev, next) => {
  if (!next?.length) return prev;
  if (!prev || prev.length !== next.length) {
    return next.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  }
  return next.map((p, i) => ({
    x: prev[i].x + (p.x - prev[i].x) * SMOOTH_FACTOR,
    y: prev[i].y + (p.y - prev[i].y) * SMOOTH_FACTOR,
    z: p.z,
  }));
};

const faceBounds = (landmarks, w, h) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of landmarks) {
    const x = p.x * w;
    const y = p.y * h;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

/**
 * Clean scan UI: gold face contour, subtle features, soft scan band (no dense tesselation).
 */
export const drawFaceScanMesh = (ctx, landmarks, canvasW, canvasH, scanState) => {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.imageSmoothingEnabled = true;

  const { minX, minY, maxX, maxY, width, height } = faceBounds(landmarks, canvasW, canvasH);
  if (!Number.isFinite(width) || width < 8) return;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  ctx.save();

  // Soft face glow (ellipse behind contour)
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.52, height * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Feature lines — thin, not spider-web
  drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, {
    color: WHITE_SOFT,
    lineWidth: 1,
  });
  drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, {
    color: WHITE_SOFT,
    lineWidth: 1,
  });
  drawConnectors(ctx, landmarks, FACEMESH_LIPS, {
    color: 'rgba(255, 255, 255, 0.28)',
    lineWidth: 1,
  });

  // Main contour — matches app gold oval
  ctx.shadowColor = 'rgba(245, 196, 0, 0.85)';
  ctx.shadowBlur = 12;
  drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, {
    color: GOLD,
    lineWidth: 2.5,
  });
  ctx.shadowBlur = 0;
  drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, {
    color: GOLD_SOFT,
    lineWidth: 1.25,
  });

  // Scan band
  const { scanY, pulse } = scanState;
  const bandH = Math.max(28, height * 0.12);
  const padX = width * 0.08;
  const left = minX - padX;
  const bandW = width + padX * 2;
  const y0 = minY + scanY - bandH / 2;
  const y1 = minY + scanY + bandH / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, minY, bandW, height);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, y0, 0, y1);
  const peak = 0.22 + pulse * 0.18;
  grad.addColorStop(0, 'rgba(245, 196, 0, 0)');
  grad.addColorStop(0.42, `rgba(245, 196, 0, ${peak * 0.5})`);
  grad.addColorStop(0.5, `rgba(255, 255, 255, ${peak})`);
  grad.addColorStop(0.58, `rgba(245, 196, 0, ${peak * 0.5})`);
  grad.addColorStop(1, 'rgba(245, 196, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(left, y0, bandW, bandH);

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + pulse * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const lineY = minY + scanY;
  ctx.moveTo(left, lineY);
  ctx.lineTo(left + bandW, lineY);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
};

export const advanceScanState = (state, faceHeight) => {
  const h = Math.max(faceHeight, 40);
  let scanY = state.scanY + state.speed * state.direction;
  let direction = state.direction;
  if (scanY >= h) {
    scanY = h;
    direction = -1;
  } else if (scanY <= 0) {
    scanY = 0;
    direction = 1;
  }

  let pulse = state.pulse + state.pulseSpeed * state.pulseDir;
  let pulseDir = state.pulseDir;
  if (pulse >= 1) {
    pulse = 1;
    pulseDir = -1;
  } else if (pulse <= 0.15) {
    pulse = 0.15;
    pulseDir = 1;
  }

  return { ...state, scanY, direction, pulse, pulseDir };
};

export const createScanState = () => ({
  scanY: 0,
  direction: 1,
  speed: 1.05,
  pulse: 0.5,
  pulseDir: 1,
  pulseSpeed: 0.025,
});
