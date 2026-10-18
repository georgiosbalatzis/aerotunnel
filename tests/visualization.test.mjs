import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_STYLES, paletteGradient, formatFieldValue, comparisonAvailable } from '../src/visualization/fields.js';
import { sceneProfile, profileCacheKey } from '../src/visualization/profile.js';
import { TURBO, COOLWARM } from '../src/engine/lut.js';
import { genPreset, simplPoly, xformPoly } from '../src/engine/geometry.js';

test('scalar legends use their actual field LUT and preserve every color stop', () => {
  for (const [mode, lut] of [['velocity', TURBO], ['pressure', COOLWARM], ['vorticity', TURBO]]) {
    const gradient = FIELD_STYLES[mode].bars[0].gradient;
    assert.equal(gradient, paletteGradient(lut));
    assert.equal((gradient.match(/rgb\(/g) || []).length, 256);
    for (const i of [0, 64, 128, 255]) {
      const c = lut[i];
      assert(gradient.includes(`rgb(${c & 255},${c >>> 8 & 255},${c >>> 16 & 255})`));
    }
  }
  assert.notEqual(FIELD_STYLES.pressure.bars[0].gradient, FIELD_STYLES.velocity.bars[0].gradient);
});
test('vectors distinguish arrow colors and dimmed background; schlieren runs from light to dark', () => {
  assert.deepEqual(FIELD_STYLES.vectors.bars.map(bar => bar.label), ['Arrows', 'Background']);
  assert.equal(FIELD_STYLES.vectors.bars[1].gradient, paletteGradient(TURBO, .3));
  assert.match(FIELD_STYLES.schlieren.bars[0].gradient, /rgb\(240,230,200\),rgb\(40,25,15\)/);
  assert(!FIELD_STYLES.streamlines && !FIELD_STYLES['3d']);
});
test('legend values distinguish small float32 density differences and signed quantities', () => {
  const values = [Math.fround(.99999994), 1, Math.fround(1.00000012)].map(formatFieldValue);
  assert.equal(new Set(values).size, 3);
  assert.equal(formatFieldValue(-.002), '-0.002');
  assert.equal(formatFieldValue(NaN), '—');
});
test('comparison eligibility matches the existing scalar renderer', () => {
  for (const mode of ['velocity', 'pressure', 'vorticity', 'schlieren']) assert(comparisonAvailable(mode));
  for (const mode of ['streamlines', 'vectors', '3d']) assert(!comparisonAvailable(mode));
});
test('3D profile preserves the actual 2D transform with one scale and Y-up conversion', () => {
  for (const preset of ['f1car', 'frontwing', 'rearwing', 'cylinder']) for (const aoa of [-20, 17]) {
    const poly = genPreset(preset), config = { sx: 75, sy: 35, aoa, simplify: 0 };
    const expected = xformPoly(poly, 0, 0, config.sx, config.sy, aoa);
    const actual = sceneProfile(poly, config);
    let scale;
    for (let i = 0; i < expected.length; i++) for (let axis = 0; axis < 2; axis++) {
      const v = expected[i][axis];
      if (Math.abs(v) < 1e-8) continue;
      const ratio = actual[i][axis] / (axis ? -v : v);
      scale ??= ratio;
      assert(Math.abs(ratio - scale) < 1e-10, `${preset} ${aoa} axis ${axis}`);
    }
  }
});
test('3D contours follow the same active simplification as the 2D solid, without mutating input', () => {
  const poly = genPreset('frontwing'), before = JSON.stringify(poly), config = { sx: 60, sy: 30, aoa: 8, simplify: 8 };
  assert.equal(sceneProfile(poly, config).length, simplPoly(poly, .04).length);
  assert.equal(JSON.stringify(poly), before);
  assert.equal(sceneProfile(null, config), null);
});

test('profile cache keys distinguish sub-thousandth coordinate changes and every displayed transform', () => {
  const config = { poly: [[0, 0], [1, 0], [1, 1]], sx: 75, sy: 60, aoa: 0, simplify: 0 };
  const key = profileCacheKey(config);
  assert.notEqual(key, profileCacheKey({ ...config, poly: [[0, 0], [1, .00001], [1, 1]] }));
  for (const field of ['sx', 'sy', 'aoa', 'simplify']) assert.notEqual(key, profileCacheKey({ ...config, [field]: config[field] + 1 }));
});
