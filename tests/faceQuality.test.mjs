import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  evaluateFaceQuality, sampleFaceLighting, faceWidthNorm, estimateYawDeg,
  isCenteredInFrameForPose, QUALITY_THRESHOLDS,
} from '../src/faceQuality.js';
import { mapLandmarksForCover } from '../src/landmarkDisplayMap.js';

// Synthetic grayscale pixels only: no camera, customer image or model inference.
// This adapter implements the canvas operations used by the real evaluator,
// including downsampling the whole camera frame and reading bounded RGBA patches.
let reads = [];
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    const canvas = { width: 0, height: 0 };
    let frame;
    canvas.getContext = () => ({
      drawImage(video, x, y, width, height) {
        assert.deepEqual([x, y, width, height], [0, 0, 160, 120]);
        frame = video;
      },
      getImageData(x, y, width, height) {
        assert.ok(x >= 0 && y >= 0 && x + width <= canvas.width && y + height <= canvas.height);
        reads.push({ x, y, width, height });
        const data = new Uint8ClampedArray(width * height * 4);
        for (let row = 0; row < height; row++) {
          for (let col = 0; col < width; col++) {
            const luma = frame.pixel((x + col + 0.5) / canvas.width, (y + row + 0.5) / canvas.height);
            const i = (row * width + col) * 4;
            data.set([luma, luma, luma, 255], i);
          }
        }
        return { data, width, height };
      },
    });
    return canvas;
  },
};
globalThis.window = {};

function fixture(pose, cropped, lighting = 'good') {
  const left = cropped ? 0.43 : 0.3;
  const right = cropped ? 0.57 : 0.7;
  const half = (right - left) / 2;
  const sign = pose === 'left' ? 1 : pose === 'right' ? -1 : 0;
  const raw = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.45, z: 0 }));
  // A real side pose has cheek-depth separation, not only a displaced nose.
  const depth = sign * half * Math.tan(17.5 * Math.PI / 180);
  raw[234] = { x: left, y: 0.45, z: -depth };
  raw[454] = { x: right, y: 0.45, z: depth };
  raw[50] = { ...raw[234] };
  raw[280] = { ...raw[454] };
  raw[1] = { x: 0.5 + sign * half * 0.3, y: 0.45, z: 0 };
  const video = {
    videoWidth: cropped ? 1280 : 640,
    videoHeight: cropped ? 720 : 480,
    pixel(x, y) {
      if (y > 0.65) return 5; // dark clothing/lower background
      if (x < left - 0.04) return 5;
      if (x > right + 0.04) return 15;
      if (lighting === 'dark') return 15;
      const texture = (Math.floor(x * 160) + Math.floor(y * 120)) % 2 ? 15 : -15;
      if (lighting === 'uneven' && x < left + 0.035) return 30 + texture;
      return (lighting === 'bright' ? 240 : 130) + texture;
    },
  };
  return { raw, video };
}

function evaluate(pose, width, height, cropped, lighting = 'good', omitRaw = false) {
  window.__duhhPose = pose;
  const { raw, video } = fixture(pose, cropped, lighting);
  const display = mapLandmarksForCover(raw, video.videoWidth, video.videoHeight, width, height);
  reads = [];
  const result = omitRaw
    ? evaluateFaceQuality(video, display, width, height)
    : evaluateFaceQuality(video, display, width, height, raw);
  // Size and oval use display coordinates; 3D yaw uses raw camera coordinates.
  assert.equal(result.metrics.faceWidthNorm, Number(faceWidthNorm(display).toFixed(3)));
  assert.equal(result.metrics.rawYawDeg, Number(estimateYawDeg(omitRaw ? display : raw).toFixed(1)));
  assert.equal(result.position, isCenteredInFrameForPose(display, pose, width, height));
  assert.equal(result.faceFound, true);
  return { result, raw, video, display };
}

for (const pose of ['center', 'left', 'right']) {
  for (const [width, height, cropped] of [[390, 700, true], [780, 1400, true], [400, 300, false]]) {
    test(`${pose}: textured lit face over dark background is accepted at ${width}x${height}`, () => {
      const { result } = evaluate(pose, width, height, cropped);
      assert.equal(result.rejectReason, null, JSON.stringify(result));
      assert.equal(result.qualityOk, true);
      assert.equal(result.lighting, true);
      assert.equal(result.position, true);
      assert.ok(Math.abs(result.metrics.meanLuma - 130) < 1);
      assert.ok(result.metrics.blurVariance >= QUALITY_THRESHOLDS.minBlurVariance);
    });
  }
  for (const [lighting, reason] of [['dark', 'too_dark'], ['uneven', 'uneven_light'], ['bright', 'too_bright']]) {
    test(`${pose}: cropped ${lighting} face still rejects as ${reason}`, () => {
      const { result } = evaluate(pose, 390, 700, true, lighting);
      assert.equal(result.rejectReason, reason, JSON.stringify(result));
      assert.equal(result.qualityOk, false);
      assert.equal(result.lighting, false);
    });
  }
}

test('sampling centers and patch sizes use 160x120 camera space, never display pixels', () => {
  const { raw, video } = fixture('center', false);
  reads = [];
  const lighting = sampleFaceLighting(video, raw, 390, 700);
  assert.deepEqual(reads, [
    { x: 43, y: 50, width: 10, height: 7 },
    { x: 107, y: 50, width: 10, height: 7 },
    { x: 75, y: 50, width: 10, height: 7 },
  ]);
  for (const key of ['meanLuma', 'leftLuma', 'rightLuma']) assert.ok(Math.abs(lighting[key] - 130) < 1);
});

test('legacy four-argument evaluator still supports uncropped normalized landmarks', () => {
  const { result } = evaluate('center', 400, 300, false, 'good', true);
  assert.equal(result.rejectReason, null);
  assert.equal(result.qualityOk, true);
});

test('cropping changes display width but lighting must stay in raw camera coordinates', () => {
  const { result, display, raw } = evaluate('left', 390, 700, true);
  assert.notEqual(display[234].x, raw[234].x);
  assert.ok(result.metrics.faceWidthNorm > faceWidthNorm(raw));
  assert.equal(result.metrics.rawYawDeg, 17.5);
  assert.equal(result.metrics.yawDeg, 17.5);
  assert.equal(result.rejectReason, null);
  assert.deepEqual(reads.slice(0, 2), [
    { x: 64, y: 50, width: 10, height: 7 },
    { x: 86, y: 50, width: 10, height: 7 },
  ]);
});

test('lighting samples cheek skin rather than the dark temple/ear boundary', () => {
  const {raw,video}=fixture('center',false);
  raw[50]={x:0.4,y:0.45,z:0};raw[280]={x:0.6,y:0.45,z:0};
  video.pixel=(x,y)=> x<0.35 ? 15 : 130;
  const lighting=sampleFaceLighting(video,raw);
  assert.ok(Math.abs(lighting.leftLuma-130)<1,JSON.stringify(lighting));
  assert.ok(Math.abs(lighting.rightLuma-130)<1,JSON.stringify(lighting));
  assert.ok(lighting.asymmetryRatio<1.1);
});

test('side poses still reject frontal, wrong-direction and excessive turns', () => {
  const {raw,video}=fixture('center',false);
  for (const pose of ['left','right']) {
    for (const degrees of [0, pose === 'left' ? -25 : 25, pose === 'left' ? 65 : -65]) {
      const angle=degrees*Math.PI/180;
      raw[234]={x:0.3,y:0.45,z:-0.2*Math.tan(angle)};
      raw[454]={x:0.7,y:0.45,z:0.2*Math.tan(angle)};
      // Reset smoothing, then fill its full six-frame window with this pose.
      window.__duhhPose='center';evaluateFaceQuality(video,raw,400,300,raw);
      window.__duhhPose=pose;
      let result;
      for(let i=0;i<6;i++) result=evaluateFaceQuality(video,raw,400,300,raw);
      assert.equal(result.rejectReason,'head_angle',JSON.stringify({pose,degrees,result}));
      assert.equal(result.lighting,true);
    }
  }
});

test('FaceMesh passes raw camera landmarks separately while rendering mapped landmarks', () => {
  const source = readFileSync('/project/src/components/FaceMesh.jsx', 'utf8');
  assert.match(source, /const rawLandmarks = results\.multiFaceLandmarks\[0\]/);
  assert.match(source, /const landmarks = mapLandmarksForCover\(rawLandmarks, vw, vh, cw, ch\)/);
  assert.match(source, /drawFaceMesh\(canvasCtx, landmarks\)/);
  assert.match(source, /evaluateFaceQuality\(\s*videoElement,\s*landmarks,\s*cw,\s*ch,\s*rawLandmarks,?\s*\)/);
});
