import { expect } from '@playwright/test';
import fs from 'node:fs/promises';

export async function openApp(page, { theme = 'light', wasm = true, seed } = {}) {
  await page.addInitScript(({ theme, seed }) => {
    if (!localStorage.getItem('f1stories-theme')) localStorage.setItem('f1stories-theme', theme);
    if (seed) localStorage.setItem('aerolab-session', JSON.stringify(seed));
  }, { theme, seed });
  if (!wasm) await page.route('**/*.wasm', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'AEROTUNNEL.' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(expected => {
    const element = document.querySelector('.lab-shell');
    let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    let solver, params, pool;
    for (; fiber; fiber = fiber.return) {
      for (let hook = fiber.memoizedState; hook && 'memoizedState' in hook; hook = hook.next) {
        const ref = hook.memoizedState;
        if (ref?.current?.rho && typeof ref.current.step === 'function') solver = ref;
        if (ref?.current && 'running' in Object(ref.current) && 'vel' in Object(ref.current)) params = ref;
        if (Array.isArray(ref?.current) && ref.current[0]?.tx instanceof Float32Array) pool = ref;
      }
    }
    if (!solver || !params || !pool || (expected && !solver.current._inner)) return false;
    // Read-only inspection of actual lifecycle identities; no production test hooks.
    window.__qa = { solver, params, pool, initial: { solver: solver.current, pool: pool.current, canvas: document.querySelector('.stage-canvas') } };
    return true;
  }, wasm);
  return errors;
}

export async function selectPreset(page, name) {
  if (await page.locator('.professional-controls').evaluate(element => element.inert)) {
    await page.getByRole('button', { name: 'Toggle Geometry controls', exact: true }).click();
  } else await page.getByRole('tab', { name: 'Geometry', exact: true }).click();
  await page.getByRole('button', { name: 'Presets', exact: true }).click();
  await page.locator('.preset-btn').filter({ has: page.locator('.preset-btn__name', { hasText: new RegExp(`^${name}$`) }) }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

export async function download(page, action) {
  const pending = page.waitForEvent('download');
  await action();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  return { name: file.suggestedFilename(), bytes: await fs.readFile(await file.path()) };
}

export async function assertNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

export async function assertPausedPreserved(page) {
  expect(await page.evaluate(() => {
    const { solver, pool, initial } = window.__qa;
    if (window.__qa.fields && !Object.entries(window.__qa.fields).every(([key, values]) => values.every((value, index) => Object.is(value, solver.current[key][index])))) throw Error('Paused numerical fields changed');
    return { solver: solver.current === initial.solver, pool: pool.current === initial.pool, canvas: document.querySelector('.stage-canvas') === initial.canvas, running: window.__qa.params.current.running };
  })).toEqual({ solver: true, pool: true, canvas: true, running: false });
}

export async function freezeFields(page) {
  await page.evaluate(() => { window.__qa.fields = Object.fromEntries(["ux", "uy", "rho", "spd", "curl", "solid"].map(key => [key, window.__qa.solver.current[key].slice()])); });
}
