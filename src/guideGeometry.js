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

// Front-only capture, including when an older bridge injects a side pose.
export const readPose = () => 'center';

export const POSE_INSTRUCTIONS = {
  center: {
    title: 'CENTER YOUR FACE',
    detail: 'Look at the camera for one front photo.',
    short: 'Front',
  },
};

export const poseInstruction = () => POSE_INSTRUCTIONS.center;

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

/** Loose face-centroid alignment. No angle, size, lighting or blur gates. */
export const isFaceInGuideOval = (centerX, centerY, _pose, canvasWidth, canvasHeight) => {
  const { w, h, cx, cy, rx, ry } = readGuideGeom(canvasWidth, canvasHeight);
  const nx = (centerX * w - cx) / rx;
  const ny = (centerY * h - cy) / ry;
  return nx * nx + ny * ny <= 1.2 * 1.2;
};