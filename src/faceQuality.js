/** MediaPipe Face Mesh landmark indices (subset). */
const LM = {
  noseTip: 1,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
};

export const QUALITY_THRESHOLDS = {
  minFaceWidthNorm: 0.26,
  maxFaceWidthNorm: 0.82,
  maxYawDegCenter: 15,
  maxYawDegSide: 38,
  minMeanLuma: 45,
  maxMeanLuma: 220,
  maxLightAsymmetryRatio: 1.45,
  minBlurVariance: 85,
};

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

export const isCenteredInFrame = (landmarks) => {
  const centerX = landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length;
  const centerY = landmarks.reduce((sum, p) => sum + p.y, 0) / landmarks.length;
  return centerX > 0.3 && centerX < 0.7 && centerY > 0.28 && centerY < 0.72;
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
  const yawDeg = estimateYawDeg(landmarks);
  const centered = isCenteredInFrame(landmarks);
  const { meanLuma, asymmetryRatio } = sampleFaceLighting(video, landmarks, canvasWidth, canvasHeight);
  const blurVariance = estimateBlurVariance(video);
  const pose = readPose();

  let rejectReason = null;

  if (widthNorm < t.minFaceWidthNorm) rejectReason = 'too_far';
  else if (widthNorm > t.maxFaceWidthNorm) rejectReason = 'too_close';
  else if (meanLuma < t.minMeanLuma) rejectReason = 'too_dark';
  else if (meanLuma > t.maxMeanLuma) rejectReason = 'too_bright';
  else if (asymmetryRatio > t.maxLightAsymmetryRatio) rejectReason = 'uneven_light';
  else if (blurVariance < t.minBlurVariance) rejectReason = 'blurry';
  else if (pose === 'center' && Math.abs(yawDeg) > t.maxYawDegCenter) rejectReason = 'head_angle';
  else if (pose === 'left' && yawDeg > -8) rejectReason = 'head_angle';
  else if (pose === 'right' && yawDeg < 8) rejectReason = 'head_angle';
  else if (Math.abs(yawDeg) > t.maxYawDegSide) rejectReason = 'head_angle';

  const lighting =
    meanLuma >= t.minMeanLuma &&
    meanLuma <= t.maxMeanLuma &&
    asymmetryRatio <= t.maxLightAsymmetryRatio;

  const qualityOk = rejectReason === null;
  const position = pose === 'center' ? centered && qualityOk : qualityOk;

  const faceFound =
    !!landmarks?.length &&
    widthNorm >= t.minFaceWidthNorm * 0.75 &&
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
      meanLuma: Number(meanLuma.toFixed(1)),
      lightAsymmetry: Number(asymmetryRatio.toFixed(2)),
      blurVariance: Number(blurVariance.toFixed(1)),
      pose,
    },
  };
};
