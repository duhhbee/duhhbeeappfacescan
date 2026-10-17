/** Shared oval guide — must match RN CameraScanning inject (__duhhGuide*). */

export const readGuidePads = () => {
  const topPad =
    typeof window !== 'undefined' && window.__duhhGuideTopPad != null
      ? Number(window.__duhhGuideTopPad)
      : 0.11;
  const bottomPad =
    typeof window !== 'undefined' && window.__duhhGuideBottomPad != null
      ? Number(window.__duhhGuideBottomPad)
      : 0.3;
  const bandCenter =
    typeof window !== 'undefined' && window.__duhhGuideBandCenter != null
      ? Number(window.__duhhGuideBandCenter)
      : 0.58;
  return {
    topPad: Number.isFinite(topPad) ? topPad : 0.11,
    bottomPad: Number.isFinite(bottomPad) ? bottomPad : 0.3,
    bandCenter: Number.isFinite(bandCenter) ? bandCenter : 0.58,
  };
};

export const readPose = () => {
  const p = typeof window !== 'undefined' ? window.__duhhPose : undefined;
  if (p === 'left' || p === 'right' || p === 'center') return p;
  return 'center';
};

/** On-screen + app copy — “your left” = user’s own left side toward camera (selfie mirror). */
export const POSE_INSTRUCTIONS = {
  center: {
    title: 'CENTER YOUR FACE',
    detail: 'Look straight at the camera and keep both cheeks visible.',
    short: 'Center',
  },
  left: {
    title: 'TURN YOUR FACE LEFT',
    detail: 'Slowly turn your face to the left.',
    short: 'Left',
  },
  right: {
    title: 'TURN YOUR FACE RIGHT',
    detail: 'Slowly turn your face to the right.',
    short: 'Right',
  },
};

export const poseInstruction = (pose) =>
  POSE_INSTRUCTIONS[pose] ?? POSE_INSTRUCTIONS.center;

/**
 * Oval guide in pixel space (canvas / overlay dimensions).
 */
export const readGuideGeom = (width, height) => {
  const w = width || 360;
  const h = height || 640;
  const cx = w / 2;
  const { topPad, bottomPad, bandCenter } = readGuidePads();
  const bandTop = h * topPad;
  const bandH = h * (1 - topPad - bottomPad);
  const cy = bandTop + bandH * bandCenter;
  const boxW = w * 0.88;
  const boxH = Math.max(bandH * 0.88, h * 0.32);
  const rx = boxW * 0.42;
  const ry = boxH * 0.46;
  return { w, h, cx, cy, rx, ry, boxW, boxH };
};

/** Normalized ellipse (0–1 coords) for quality checks. */
export const readGuideEllipseNorm = () => {
  const { w, h, cx, cy, rx, ry } = readGuideGeom(
    typeof window !== 'undefined' ? window.innerWidth : 360,
    typeof window !== 'undefined' ? window.innerHeight : 640,
  );
  return {
    cx: cx / w,
    cy: cy / h,
    rx: rx / w,
    ry: ry / h,
  };
};

/** Pose-aware horizontal shift (mirrored selfie: user left = positive yaw). */
const poseCenterShiftNorm = (pose) => {
  if (pose === 'left') return 0.04;
  if (pose === 'right') return -0.04;
  return 0;
};

/**
 * Face centroid inside oval (with small pose shift).
 * @param {number} centerX - normalized 0–1
 * @param {number} centerY - normalized 0–1
 */
export const isFaceInGuideOval = (centerX, centerY, pose, canvasWidth, canvasHeight) => {
  const { cx, cy, rx, ry } = readGuideGeom(canvasWidth, canvasHeight);
  const shiftPx = poseCenterShiftNorm(pose) * canvasWidth;
  const nx = (centerX * canvasWidth - (cx + shiftPx)) / rx;
  const ny = (centerY * canvasHeight - cy) / ry;
  const dist = nx * nx + ny * ny;
  const margin = pose === 'center' ? 1.08 : 1.14;
  return dist <= margin * margin;
};
