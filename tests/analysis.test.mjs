import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisSource, chartDomain, chartPosition, convergenceState, csvIssue, formatMetric, formatRatio, proxyRatio, sameSetup, seriesSegments, sweepCSV, validateSweep, savedSessionIssue } from '../src/analysis/presentation.js';

test('unmeasured, restored and stale samples have explicit provenance', () => {
  const setup = { poly: [[0, 0]], vel: .12 };
  assert.equal(analysisSource(null, [], setup).available, false);
  assert.equal(analysisSource(null, [{ cl: 0 }], setup).source, 'Latest recorded sample');
  assert.equal(analysisSource(null, [null], setup).values, null);
  const sample = { values: { cl: 0 }, setup };
  assert.equal(analysisSource(sample, [], setup).stale, false);
  assert.equal(analysisSource(sample, [], { ...setup, vel: .13 }).stale, true);
  assert.equal(sameSetup(setup, { ...setup, poly: [[0, 0]] }), false);
  assert.equal(convergenceState(1, false), 'Not sampled for this setup');
  assert.equal(convergenceState(NaN, true), 'Unavailable result');
});
test('valid zero remains visible; unavailable ratios never become Infinity or NaN', () => {
  assert.equal(formatMetric(0), '0'); assert.equal(formatRatio(proxyRatio({ cl: 0, cd: .008 })), '0.00');
  for (const cd of [0, -.1, null, NaN, Infinity]) assert.equal(proxyRatio({ cl: 1, cd }), null);
  assert.equal(proxyRatio({ cl: Number.MAX_VALUE, cd: Number.MIN_VALUE }), null);
  for (const value of [null, undefined, NaN, Infinity, '0']) assert.equal(formatMetric(value), '—');
});
test('plots preserve original positions, negative values and missing-value gaps', () => {
  const rows = [{ cl: 0 }, null, { cl: -2 }, { cl: Infinity }, { cl: 3 }];
  assert.deepEqual(seriesSegments(rows, 'cl').map(s => s.map(p => [p.x,p.y])), [[[0,0]], [[2,-2]], [[4,3]]]);
  assert.deepEqual(rows, [{ cl: 0 }, null, { cl: -2 }, { cl: Infinity }, { cl: 3 }]);
  for (const values of [[], [0], [-2,-1], [2,3], [-Number.MAX_VALUE,Number.MAX_VALUE]]) {
    const domain = chartDomain(values); assert.ok(Number.isFinite(domain.min)); assert.ok(Number.isFinite(domain.max));
    assert.ok(domain.min <= 0 && domain.max >= 0 && domain.max > domain.min);
    for (const v of values) assert.ok(Number.isFinite(chartPosition(v, domain)));
  }
});
test('CSV eligibility rejects bad time without deleting or rewriting history', () => {
  const rows = [{ t: 0, cl: 0, cd: null }]; assert.equal(csvIssue(rows), '');
  for (const row of [null, {}, { t: null }, { t: '' }, { t: 'bad' }, { t: Infinity }]) assert.ok(csvIssue([row]));
  assert.deepEqual(rows, [{ t: 0, cl: 0, cd: null }]);
});
test('sweep validation supports original endpoints and rejects fractional points', () => {
  assert.equal(validateSweep({ param: 'aoa', min: 20, max: -10, steps: 31 }), '');
  assert.equal(validateSweep({ param: 'velocity', min: .12, max: .12, steps: 2 }), '');
  for (const steps of [2.5, 1, 101, '', Infinity]) assert.ok(validateSweep({ param: 'aoa', min: 0, max: 5, steps }));
  assert.ok(validateSweep({ param: 'aoa', min: -Number.MAX_VALUE, max: Number.MAX_VALUE, steps: 2 }));
  assert.ok(validateSweep({ param: 'aoa', min: '', max: 5, steps: 2 }));
});
test('manual sweep CSV preserves the legacy raw schema, ordering and values', () => {
  assert.equal(sweepCSV({ param: 'aoa', results: [{ value: 0, cl: 0, cd: .008, ld: 0, regime: 'turbulent' }, { value: 2, cl: .013, cd: .018, ld: .72, regime: 'turbulent' }] }), 'aoa,cl,cd,ld_ratio,regime\n0,0,0.008,0,turbulent\n2,0.013,0.018,0.72,turbulent');
});

test('unavailable live fields and invalid gallery geometry stay separate from raw data', () => {
  const values = { cl: 0, cd: 0, re: 6000, maxV: 0 };
  const source = analysisSource({ values, fluidCells: 0 }, [], {});
  assert.equal(source.values.cl, null); assert.equal(source.values.re, 6000);
  assert.deepEqual(values, { cl: 0, cd: 0, re: 6000, maxV: 0 });
  assert.ok(savedSessionIssue({ poly: 'bad' }));
  assert.equal(savedSessionIssue({ poly: [[0,0],[1,0],[0,1]], vel: .123456789 }), '');
  const domain = chartDomain([2,2], false);
  assert.ok(domain.min < 2 && domain.max > 2);
  assert.ok(Math.abs(chartPosition(2, domain) - .5) < 1e-12);
});
