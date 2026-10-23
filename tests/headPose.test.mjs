import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateYawDeg } from '../src/faceQuality.js';

// Real MediaPipe output on the public LearnOpenCV HeadPose/headPose.jpg fixture,
// horizontally mirrored to face camera-right (the subject's own left).
function observedLeft() {
  const points = Array.from({length:468}, () => ({x:0.55,y:0.45,z:0}));
  points[1] = {x:0.696847677230835,y:0.48450595140457153,z:-0.05490053817629814};
  points[234] = {x:0.4629790186882019,y:0.45053717494010925,z:0.035926416516304016};
  points[454] = {x:0.7115820050239563,y:0.44897499680519104,z:0.1878749281167984};
  return points;
}

test('a real three-quarter left face is accepted by the existing side angle range', () => {
  const yaw=estimateYawDeg(observedLeft());
  assert.ok(yaw >= 8 && yaw <= 52, `normal left turn incorrectly measured as ${yaw}`);
});

test('nose protrusion cannot inflate the same cheek-plane turn', () => {
  const points=observedLeft();const baseline=estimateYawDeg(points);
  points[1]={...points[1],x:points[454].x+0.08};
  assert.equal(estimateYawDeg(points),baseline);
});

for (const degrees of [-65,-40,-20,0,20,40,65]) {
  test(`3D cheek plane yields ${degrees} degrees without arcsine saturation`, () => {
    const angle=degrees*Math.PI/180,points=observedLeft();
    points[234]={x:0.5-0.15*Math.cos(angle),y:0.45,z:-0.15*Math.sin(angle)};
    points[454]={x:0.5+0.15*Math.cos(angle),y:0.45,z:0.15*Math.sin(angle)};
    assert.ok(Math.abs(estimateYawDeg(points)-degrees)<1e-8);
  });
}
