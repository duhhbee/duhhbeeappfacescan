import { isFaceInGuideOval } from './guideGeometry.js';

/** Normalized display-space face width, used only to reject an empty/degenerate mesh. */
export const faceWidthNorm = (landmarks) => {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of landmarks) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  return maxX - minX;
};

/** Retained diagnostic utility. Head angle does not gate capture. */
export const estimateYawDeg = (landmarks) => {
  const left = landmarks[234] ?? landmarks[0];
  const right = landmarks[454] ?? landmarks[0];
  if (!left || !right) return 0;
  const dx = right.x - left.x;
  const dz = right.z - left.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return 0;
  return Math.max(-90, Math.min(90, Math.atan2(dz, Math.max(0.000001, dx)) * (180 / Math.PI)));
};

export const isCenteredInFrameForPose = (landmarks, _pose, canvasWidth, canvasHeight) => {
  const centerX = landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length;
  const centerY = landmarks.reduce((sum, p) => sum + p.y, 0) / landmarks.length;
  return isFaceInGuideOval(centerX, centerY, 'center', canvasWidth, canvasHeight);
};

/** One front photo: presence plus loose guide centering, independent of camera pixels.
 * Legacy quality flags remain permissive for older native bridge consumers.
 */
export const evaluateFaceQuality = (_video, landmarks, canvasWidth, canvasHeight) => {
  const usableMesh = Array.isArray(landmarks) && landmarks.length >= 10 &&
    landmarks.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const widthNorm = usableMesh ? faceWidthNorm(landmarks) : 0;
  const faceFound = usableMesh && widthNorm > 0.04;
  const position = faceFound && isCenteredInFrameForPose(landmarks, 'center', canvasWidth, canvasHeight);
  return {
    faceFound,
    position,
    lighting: true,
    faceClear: true,
    qualityOk: faceFound && position,
    rejectReason: !faceFound ? 'no_face' : !position ? 'position' : null,
    metrics: { faceWidthNorm: Number(widthNorm.toFixed(3)), pose: 'center' },
  };
};
