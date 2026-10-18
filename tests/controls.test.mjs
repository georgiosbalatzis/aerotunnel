import test from 'node:test';
import assert from 'node:assert/strict';
import { parseControlNumber, formatControlNumber, geometryIssue, sessionIssue } from '../src/controls/validation.js';

test('numeric commits reject incomplete, nonfinite and out-of-range drafts', () => {
  for (const text of ['', ' ', '-', 'NaN', 'Infinity', '1e999', '-1', '4']) assert(parseControlNumber(text, 0, 3).error, text);
  assert.deepEqual(parseControlNumber('0', 0, 3), { value: 0 });
  assert.deepEqual(parseControlNumber('3', 0, 3), { value: 3 });
});
test('precise historical/default values are not rounded to slider increments', () => {
  assert.deepEqual(parseControlNumber('0.15', 0, 3), { value: .15 });
  assert.deepEqual(parseControlNumber('67.5', 4, 131), { value: 67.5 });
  assert.deepEqual(parseControlNumber('60.75', 5, 94.5), { value: 60.75 });
});
test('invalid profiles are rejected without replacing a valid polygon', () => {
  assert.equal(geometryIssue([[0, 0], [1, 0], [1, 1]]), null);
  assert.equal(geometryIssue([]), 'geom-points');
  assert.equal(geometryIssue([[0, 0], [1, Infinity], [1, 1]]), 'geom-nonfinite');
  assert.equal(geometryIssue([[0, 0], [null, 1], [1, 1]]), 'geom-nonfinite');
  assert.equal(geometryIssue([[0, 0], [0, 1], [0, 2]]), 'geom-area');
});
test('legacy sessions retain valid precision and desktop particle counts on mobile', () => {
  assert.equal(sessionIssue({ app: 'aerolab', version: 2, solver: { turb: .15, nu: .015 }, display: { pCount: 2000 }, geometry: { cy: 67.5 } }), null);
  assert.equal(sessionIssue({ app: 'aerolab', version: 1, solver: { vel: .123456 } }), null);
  assert(sessionIssue({ app: 'other', version: 2 }));
  assert(sessionIssue({ app: 'aerolab', version: 2, solver: { nu: null } }));
  assert(sessionIssue({ app: 'aerolab', version: 2, geometry: { poly: [[0, 0]] } }));
});

test('presentation removes floating-point noise without modifying source values', () => {
  const stored = 104 * .45;
  assert.equal(formatControlNumber(stored), '46.8');
  assert.equal(stored, 46.800000000000004);
  assert.equal(formatControlNumber(.015), '0.015');
});

test('count and generator commits follow their existing discrete increments', () => {
  assert(parseControlNumber('2.5', 1, 8, 1).error);
  assert(parseControlNumber('25', 0, 900, 10).error);
  assert(parseControlNumber('25', 10, 90, 10).error);
  assert.deepEqual(parseControlNumber('3', 1, 8, 1), { value: 3 });
  assert.deepEqual(parseControlNumber('0', 0, 900, 10), { value: 0 });
});

test('collinear profiles fail while self-intersecting outlines retain their warning-only contract', () => {
  assert.equal(geometryIssue([[0, 0], [.5, .5], [1, 1]]), 'geom-area');
  assert.equal(geometryIssue([[0, 0], [1e-14, 0], [1, 0], [1, 1], [0, 1]]), null);
  assert.equal(geometryIssue([[0, 0], [1, 1], [0, 1], [1, 0]]), null);
});
