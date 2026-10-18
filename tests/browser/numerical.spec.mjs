import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openApp, selectPreset } from './helpers.mjs';
const reference = JSON.parse(fs.readFileSync(new URL('../fixtures/solver-reference.json', import.meta.url)));

for (const fixture of reference.cases) test(`${fixture.backend} ${fixture.width}px: unchanged fields after 30 controlled steps`, async ({ page }) => {
  await page.setViewportSize({ width: fixture.width, height: fixture.width === 375 ? 812 : 900 });
  const errors = await openApp(page, { wasm: fixture.backend === 'WASM' });
  await selectPreset(page, 'Cylinder');
  const actual = await page.evaluate(async () => {
    const solver = window.__qa.solver.current;
    let seed = 12345;
    const random = Math.random;
    // Seed only the test's controlled steps, then restore the native RNG.
    Math.random = () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    try { for (let step = 0; step < 30; step++) solver.step(.12, 0); }
    finally { Math.random = random; }
    const arrays = {};
    for (const key of ['ux', 'uy', 'rho', 'spd', 'curl', 'solid']) {
      const digest = await crypto.subtle.digest('SHA-256', solver[key].slice().buffer);
      arrays[key] = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    }
    return { N: solver.N, backend: solver._inner ? 'WASM' : 'JS', arrays };
  });
  expect(actual).toEqual({ N: fixture.N, backend: fixture.backend, arrays: fixture.arrays });
  expect(errors).toEqual([]);
});
