/** Shared oval guide geometry (overlay + quality checks). */

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
      : 0.52;
  return {
    topPad: Number.isFinite(topPad) ? topPad : 0.11,
    bottomPad: Number.isFinite(bottomPad) ? bottomPad : 0.3,
    bandCenter: Number.isFinite(bandCenter) ? bandCenter : 0.52,
  };
};

/** Face oval in pixel space for given viewport size. */
export const computeGuideGeom = (width, height) => {
  const w = width || 360;
  const h = height || 640;
  const cx = w / 2;
  const { topPad, bottomPad, bandCenter } = readGuidePads();
  const bandTop = h * topPad;
  const bandH = h * (1 - topPad - bottomPad);
  const cy = bandTop + bandH * bandCenter;
  const rx = w * 0.36;
  const ry = Math.max(bandH * 0.44, h * 0.24);
  return { w, h, cx, cy, rx, ry };
};

/** Normalized landmark (0–1) inside oval with optional slack (1 = exact, 1.08 = slightly loose). */
export const isLandmarkInOval = (nx, ny, canvasWidth, canvasHeight, slack = 1) => {
  const { cx, cy, rx, ry } = computeGuideGeom(canvasWidth, canvasHeight);
  const lx = nx * canvasWidth;
  const ly = ny * canvasHeight;
  const dx = (lx - cx) / (rx * slack);
  const dy = (ly - cy) / (ry * slack);
  return dx * dx + dy * dy <= 1;
};

/** Nose + chin + cheeks should sit in the oval for the current pose. */
export const isFaceInOvalGuide = (landmarks, canvasWidth, canvasHeight, pose = 'center') => {
  if (!landmarks?.length) return false;
  const slack = pose === 'center' ? 1.05 : 1.12;
  const indices = [1, 152, 10, 234, 454, 168, 397];
  let inside = 0;
  for (const i of indices) {
    const p = landmarks[i] ?? landmarks[0];
    if (isLandmarkInOval(p.x, p.y, canvasWidth, canvasHeight, slack)) inside += 1;
  }
  const minHits = pose === 'center' ? 5 : 4;
  if (inside < minHits) return false;

  const centerX = landmarks.reduce((s, p) => s + p.x, 0) / landmarks.length;
  const centerY = landmarks.reduce((s, p) => s + p.y, 0) / landmarks.length;
  const shift = pose === 'left' ? 0.04 : pose === 'right' ? -0.04 : 0;
  return isLandmarkInOval(centerX - shift, centerY, canvasWidth, canvasHeight, slack);
};
