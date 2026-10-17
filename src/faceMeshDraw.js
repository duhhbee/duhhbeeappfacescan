import { FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
import { drawConnectors } from '@mediapipe/drawing_utils';

const SMOOTH_FACTOR = 0.35;

/** Optional EMA — purana mesh look, thoda kam jitter. */
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
  return { minX, minY, maxX, maxY };
};

/** Classic MediaPipe-style wire mesh + teal scan line (oval overlay stays in FaceScanOverlay). */
export const drawFaceScanMesh = (ctx, landmarks, canvasW, canvasH, scanState) => {
  ctx.clearRect(0, 0, canvasW, canvasH);

  drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {
    color: 'rgba(255, 255, 255, 0.10)',
    lineWidth: 1,
  });

  landmarks.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x * canvasW, point.y * canvasH, 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
  });

  const { minX, minY, maxX, maxY } = faceBounds(landmarks, canvasW, canvasH);
  const faceHeight = maxY - minY;
  if (!Number.isFinite(faceHeight) || faceHeight < 8) return;

  const currentScanY = minY + scanState.scanY;
  if (currentScanY >= minY && currentScanY <= maxY) {
    ctx.save();
    const lineWidth = (maxX - minX) * 1.15;
    const left = minX - (lineWidth - (maxX - minX)) / 2;
    ctx.globalAlpha = 0.5 + scanState.opacity * 0.4;
    ctx.strokeStyle = '#2EE6D6';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#2EE6D6';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(left, currentScanY);
    ctx.lineTo(left + lineWidth, currentScanY);
    ctx.stroke();
    ctx.restore();
  }
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

  let opacity = state.opacity + state.opacitySpeed * state.opacityDir;
  let opacityDir = state.opacityDir;
  if (opacity >= 1) {
    opacity = 1;
    opacityDir = -1;
  } else if (opacity <= 0.8) {
    opacity = 0.8;
    opacityDir = 1;
  }

  return { ...state, scanY, direction, opacity, opacityDir };
};

export const createScanState = () => ({
  scanY: 0,
  direction: 1,
  speed: 1.5,
  opacity: 0.8,
  opacityDir: 1,
  opacitySpeed: 0.03,
});
