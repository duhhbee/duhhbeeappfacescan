import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateFaceQuality } from '../src/faceQuality.js';
import { mapLandmarksForCover } from '../src/landmarkDisplayMap.js';
import { readPose, poseInstruction } from '../src/guideGeometry.js';

globalThis.window = {};
// Camera pixels must not be sampled to decide whether a face is centered.
globalThis.document = { createElement() { throw new Error('Unexpected quality sampling'); } };
const face = (x = 0.5, y = 0.45, width = 0.3) => {
  const points = Array.from({ length: 468 }, () => ({ x, y, z: 0 }));
  points[234] = { x: x - width / 2, y, z: -0.5 };
  points[454] = { x: x + width / 2, y, z: 0.5 };
  return points;
};
for (const width of [0.08, 0.3, 0.9]) {
  test(`centered detected face passes without size, yaw, lighting or blur gates (width ${width})`, () => {
    const result = evaluateFaceQuality({ videoWidth: 640 }, face(0.5, 0.45, width), 390, 700);
    assert.equal(result.faceFound, true);
    assert.equal(result.position, true);
    assert.equal(result.qualityOk, true);
    assert.equal(result.rejectReason, null);
  });
}
for (const points of [[], null, Array(468).fill({ x: NaN, y: 0.45 }), Array(468).fill({x:0.5,y:0.45})]) {
  test(`missing or unusable face never becomes ready: ${JSON.stringify(points)?.slice(0, 30)}`, () => {
    const result = evaluateFaceQuality(null, points, 390, 700);
    assert.equal(result.faceFound, false);
    assert.equal(result.position, false);
    assert.equal(result.qualityOk, false);
    assert.equal(result.rejectReason, 'no_face');
  });
}
test('loose centering allows normal drift but rejects a face outside the guide', () => {
  assert.equal(evaluateFaceQuality(null, face(0.7, 0.5), 390, 700).position, true);
  const result = evaluateFaceQuality(null, face(0.95, 0.9), 390, 700);
  assert.equal(result.faceFound, true);
  assert.equal(result.position, false);
  assert.equal(result.qualityOk, false);
  assert.equal(result.rejectReason, 'position');
});
test('display mapping preserves centering on narrow and wide previews', () => {
  for (const [width, height] of [[390, 700], [780, 1400], [400, 300]]) {
    const raw = face(0.5, 0.45, 0.14);
    const mapped = mapLandmarksForCover(raw, 1280, 720, width, height);
    assert.equal(evaluateFaceQuality(null, mapped, width, height, raw).position, true);
  }
});
test('legacy side-pose instructions cannot reintroduce a left/right step', () => {
  for (const pose of ['left', 'right', 'center']) {
    window.__duhhPose = pose;
    assert.equal(readPose(), 'center');
    assert.equal(poseInstruction(pose).short, 'Front');
  }
});
