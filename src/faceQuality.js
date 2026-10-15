/** MediaPipe Face Mesh landmark indices (subset). */
const LM = {
  noseTip: 1,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
};

export const QUALITY_THRESHOLDS = {
  minFaceWidthNorm: 0.26,
  minFaceWidthNormSide: 0.22,
  maxFaceWidthNorm: 0.82,
  maxYawDegCenter: 22,
  minSideYawDeg: 8,
  maxYawDegSide: 52,
  minMeanLuma: 45,
  maxMeanLuma: 220,
  maxLightAsymmetryRatio: 1.45,
  maxLightAsymmetryRatioSide: 2.0,
  minBlurVariance: 90,
  minBlurVarianceSide: 55,
};

const YAW_SMOOTH_FRAMES = 6;
const yawHistory = [];
let yawSmoothPose = 'center';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const landmark = (landmarks, index) => landmarks[index] ?? landmarks[0];

/** Normalized face bbox width (0–1). */
export const faceWidthNorm = (landmarks) => {
  let minX = 1;
  let maxX = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  return maxX - minX;
};

/** Approximate head yaw in degrees (+ = turned to camera-right). */
export const estimateYawDeg = (landmarks) => {
  const nose = landmark(landmarks, LM.noseTip);
  const left = landmark(landmarks, LM.leftCheek);
  const right = landmark(landmarks, LM.rightCheek);
  const midX = (left.x + right.x) / 2;
  const halfFace = Math.max(0.05, (right.x - left.x) / 2);
  const offset = (nose.x - midX) / halfFace;
  return clamp(Math.asin(clamp(offset, -1, 1)) * (180 / Math.PI), -90, 90);
};

const smoothYawDeg = (rawYaw, pose) => {
  if (pose !== yawSmoothPose) {
    yawSmoothPose = pose;
    yawHistory.length = 0;
  }
  yawHistory.push(rawYaw);
  if (yawHistory.length > YAW_SMOOTH_FRAMES) yawHistory.shift();
  return yawHistory.reduce((sum, v) => sum + v, 0) / yawHistory.length;
};

export const isCenteredInFrame = (landmarks, loose = false) => {
  const centerX = landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length;
  const centerY = landmarks.reduce((sum, p) => sum + p.y, 0) / landmarks.length;
  if (loose) {
    return centerX > 0.22 && centerX < 0.78 && centerY > 0.22 && centerY < 0.78;
  }
  return centerX > 0.28 && centerX < 0.72 && centerY > 0.34 && centerY < 0.78;
};

/** Side poses: allow face centroid to shift toward the turn direction. */
export const isCenteredInFrameForPose = (landmarks, pose) => {
  if (pose === 'center') return isCenteredInFrame(landmarks, false);

  const centerX = landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length;
  const centerY = landmarks.reduce((sum, p) => sum + p.y, 0) / landmarks.length;
  const shift = pose === 'left' ? 0.06 : pose === 'right' ? -0.06 : 0;
  const adjX = centerX - shift;

  return adjX > 0.18 && adjX < 0.82 && centerY > 0.2 && centerY < 0.82;
};

/** Selfie preview is mirrored — user "left" matches positive yaw here. */
const poseYawOk = (pose, yawDeg, t) => {
  const y = yawDeg;
  if (pose === 'center') return Math.abs(y) <= t.maxYawDegCenter;
  if (pose === 'left') return y >= t.minSideYawDeg && Math.abs(y) <= t.maxYawDegSide;
  if (pose === 'right') return y <= -t.minSideYawDeg && Math.abs(y) <= t.maxYawDegSide;
  return Math.abs(y) <= t.maxYawDegCenter;
};

let sampleCanvas = null;
let sampleCtx = null;

const getSampleContext = () => {
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 160;
    sampleCanvas.height = 120;
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return { canvas: sampleCanvas, ctx: sampleCtx };
};

/** Mean luma + left/right cheek brightness from video frame. */
export const sampleFaceLighting = (video, landmarks, canvasWidth, canvasHeight) => {
  if (!video?.videoWidth) return { meanLuma: 0, leftLuma: 0, rightLuma: 0, asymmetryRatio: 1 };

  const left = landmark(landmarks, LM.leftCheek);
  const right = landmark(landmarks, LM.rightCheek);
  const nose = landmark(landmarks, LM.noseTip);
  const patch = 0.06;

  const toPx = (p) => ({
    x: p.x * canvasWidth,
    y: p.y * canvasHeight,
  });

  const { ctx, canvas } = getSampleContext();
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const readPatch = (px, py) => {
    const x = clamp(Math.round(px - (patch * canvasWidth) / 2), 0, canvas.width - 4);
    const y = clamp(Math.round(py - (patch * canvasHeight) / 2), 0, canvas.height - 4);
    const w = clamp(Math.round(patch * canvasWidth), 4, canvas.width - x);
    const h = clamp(Math.round(patch * canvasHeight), 4, canvas.height - y);
    const data = ctx.getImageData(x, y, w, h).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (data.length / 4);
  };

  const lPx = toPx(left);
  const rPx = toPx(right);
  const nPx = toPx(nose);
  const leftLuma = readPatch(lPx.x, lPx.y);
  const rightLuma = readPatch(rPx.x, rPx.y);
  const meanLuma = readPatch(nPx.x, nPx.y);
  const bright = Math.max(leftLuma, rightLuma, 1);
  const dim = Math.max(1, Math.min(leftLuma, rightLuma));
  const asymmetryRatio = bright / dim;

  return { meanLuma, leftLuma, rightLuma, asymmetryRatio };
};

/** Laplacian variance — higher = sharper. */
export const estimateBlurVariance = (video) => {
  if (!video?.videoWidth) return 0;

  const { ctx, canvas } = getSampleContext();
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - width] +
        gray[i + width];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
};

const readPose = () => {
  const p = typeof window !== 'undefined' ? window.__duhhPose : undefined;
  if (p === 'left' || p === 'right' || p === 'center') return p;
  return 'center';
};

const isSidePose = (pose) => pose === 'left' || pose === 'right';

/**
 * @returns {{
 *   lighting: boolean,
 *   position: boolean,
 *   faceFound: boolean,
 *   qualityOk: boolean,
 *   rejectReason: string | null,
 *   metrics: object,
 * }}
 */
export const evaluateFaceQuality = (video, landmarks, canvasWidth, canvasHeight) => {
  const t = QUALITY_THRESHOLDS;
  const widthNorm = faceWidthNorm(landmarks);
  const pose = readPose();
  const side = isSidePose(pose);
  const rawYaw = estimateYawDeg(landmarks);
  const yawDeg = smoothYawDeg(rawYaw, pose);
  const { meanLuma, asymmetryRatio } = sampleFaceLighting(video, landmarks, canvasWidth, canvasHeight);
  const blurVariance = estimateBlurVariance(video);

  const minWidth = side ? t.minFaceWidthNormSide : t.minFaceWidthNorm;
  const maxAsymmetry = side ? t.maxLightAsymmetryRatioSide : t.maxLightAsymmetryRatio;
  const minBlur = side ? t.minBlurVarianceSide : t.minBlurVariance;

  let rejectReason = null;

  if (widthNorm < minWidth) rejectReason = 'too_far';
  else if (widthNorm > t.maxFaceWidthNorm) rejectReason = 'too_close';
  else if (meanLuma < t.minMeanLuma) rejectReason = 'too_dark';
  else if (meanLuma > t.maxMeanLuma) rejectReason = 'too_bright';
  else if (asymmetryRatio > maxAsymmetry) rejectReason = 'uneven_light';
  else if (blurVariance < minBlur) rejectReason = 'blurry';
  else if (!poseYawOk(pose, yawDeg, t)) rejectReason = 'head_angle';

  const lighting =
    meanLuma >= t.minMeanLuma &&
    meanLuma <= t.maxMeanLuma &&
    asymmetryRatio <= maxAsymmetry;

  const qualityOk = rejectReason === null;
  const inFrame = isCenteredInFrameForPose(landmarks, pose);
  const position = inFrame && qualityOk;

  const faceFound =
    !!landmarks?.length &&
    widthNorm >= minWidth * 0.75 &&
    meanLuma >= t.minMeanLuma * 0.65;

  return {
    lighting,
    position,
    faceFound,
    faceClear: true,
    qualityOk,
    rejectReason,
    metrics: {
      faceWidthNorm: Number(widthNorm.toFixed(3)),
      yawDeg: Number(yawDeg.toFixed(1)),
      rawYawDeg: Number(rawYaw.toFixed(1)),
      meanLuma: Number(meanLuma.toFixed(1)),
      lightAsymmetry: Number(asymmetryRatio.toFixed(2)),
      blurVariance: Number(blurVariance.toFixed(1)),
      pose,
    },
  };
};
