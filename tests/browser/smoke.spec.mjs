import { test, expect } from '@playwright/test';
import { openApp, selectPreset, download, assertNoOverflow, assertPausedPreserved, freezeFields } from './helpers.mjs';
import { fileURLToPath } from 'node:url';
const fixture = fileURLToPath(new URL('../fixtures/controls/session.json', import.meta.url));

for (const wasm of [true, false]) test(`startup, Run/Pause, modes, reset (${wasm ? 'WASM' : 'JS fallback'})`, async ({ page }) => {
  const errors = await openApp(page, { wasm });
  await selectPreset(page, 'Cylinder');
  await page.getByRole('button', { name: 'Start Simulation', exact: false }).click();
  await expect.poll(() => page.evaluate(() => Math.max(...window.__qa.solver.current.spd))).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await freezeFields(page);
  for (const field of ['Pressure', 'Streamlines', 'Vorticity', 'Vectors', 'Schlieren', 'Velocity']) {
    const button = page.getByRole('button', { name: `Switch visualization mode to ${field}`, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.stage-canvas')).toBeVisible();
  }
  await assertPausedPreserved(page);
  const old = await page.evaluate(() => { window.__qa.beforeReset = window.__qa.solver.current; return window.__qa.params.current.poly; });
  await page.getByRole('button', { name: 'Reset simulation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.solver.current !== window.__qa.beforeReset)).toBe(true);
  expect(await page.evaluate(() => window.__qa.params.current.poly)).toEqual(old);
  await expect(page.getByRole('button', { name: 'Run simulation', exact: true })).toBeVisible();
  await expect(page.locator('.workspace-metrics dd')).toHaveText(['—', '—', '—', '—']);
  expect(errors).toEqual([]);
});

test('navigation, theme persistence, keyboard and live solver continuity', async ({ page }) => {
  const errors = await openApp(page);
  await page.getByRole('button', { name: 'Start Simulation', exact: false }).click();
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('button', { name: 'Dark theme', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Pause simulation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await freezeFields(page);
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Open About view', exact: true }).click();
  await expect(page.locator('.about-view')).toBeVisible();
  await page.getByRole('button', { name: 'Open simulation view', exact: true }).click();
  await assertPausedPreserved(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('f1stories-theme'))).toBe('dark');
  expect(errors).toEqual([]);
});

test('legacy JSON import, precise exports, malformed input and gallery restoration', async ({ page }) => {
  const errors = await openApp(page);
  await page.getByRole('button', { name: 'Share & Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Load Session', exact: true }).click();
  await page.locator('input[aria-label="Load AeroTunnel session file"]').setInputFiles(fixture);
  await expect(page.getByRole('button', { name: 'Switch visualization mode to Pressure', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const json = await download(page, () => dialog.getByRole('button', { name: 'Save Simulation Session (JSON)', exact: true }).click());
  const data = JSON.parse(json.bytes);
  expect(data.app).toBe('aerolab'); expect(data.version).toBe(2);
  expect(data.geometry.aoa).toBe(7); expect(data.solver.vel).toBe(.095); expect(data.display.mode).toBe('pressure');
  await page.locator('input[aria-label="Load AeroTunnel session file"]').setInputFiles({ name: json.name, mimeType: 'application/json', buffer: json.bytes });
  await expect.poll(() => page.evaluate(() => window.__qa.params.current.vel)).toBe(.095);
  const stl = await download(page, () => dialog.getByRole('button', { name: 'Export STL', exact: true }).click());
  expect(stl.bytes.length).toBe(84 + stl.bytes.readUInt32LE(80) * 50);
  const image = await download(page, () => dialog.getByRole('button', { name: 'Save Image', exact: true }).click());
  expect(image.bytes.subarray(1, 4).toString()).toBe('PNG'); expect(image.bytes.readUInt32BE(16)).toBe(2400);
  expect(await page.evaluate(async encoded => { const image = new Image(); image.src = 'data:image/png;base64,' + encoded; await image.decode(); return image.naturalWidth; }, image.bytes.toString('base64'))).toBe(2400);
  if (process.env.QA_CAPTURE) { const fs = await import('node:fs/promises'); await fs.writeFile('docs/redesign/exports/phase-10-publication.png', image.bytes); }
  await page.locator('input[aria-label="Load AeroTunnel session file"]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(dialog.getByRole('alert')).toContainText(/failed/i);
  expect(await page.evaluate(() => window.__qa.params.current.aoa)).toBe(7);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await page.getByLabel('Session name').fill('Regression fixture');
  await page.getByRole('button', { name: 'Save current session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load Regression fixture', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await page.getByRole('button', { name: 'Load Regression fixture', exact: true }).click();
  await expect(page.locator('.report-setup')).toContainText('0.095');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('aerolab-sessions'))).toContain('Regression fixture');
  expect(errors).toEqual([]);
});

test('recorded CSV keeps values and recording produces a ZIP', async ({ page }) => {
  const history = [{ t: 1700000000000, cl: 0, cd: .008, re: 6000, maxV: 1 }, { t: 1700000000500, cl: .1234567, cd: .0145678, re: 6100, maxV: 1.234567 }];
  await openApp(page, { seed: { version: 2, mode: 'velocity', preset: 'f1car', history } });
  await page.getByRole('button', { name: 'Share & Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const csv = await download(page, () => dialog.getByRole('button', { name: 'Export Data (CSV)', exact: true }).click());
  expect(csv.bytes.toString()).toBe('timestamp,cl,cd,re,maxV\n' + history.map(row => `${new Date(row.t).toISOString()},${row.cl},${row.cd},${row.re},${row.maxV}`).join('\n'));
  await dialog.getByRole('button', { name: /Record PNG frames/i }).click();
  await expect(dialog.getByText('Recording the 2D canvas.', { exact: true })).toBeVisible();
  await page.waitForTimeout(700); // Existing recording counter/encoding publishes every 500ms.
  const zip = await download(page, async () => {
    await dialog.getByRole('button', { name: /Stop.*(?:export|record)/i }).click();
    // Stop retains late encodings. Exercise the documented retry when none completed yet.
    if (await dialog.getByText('No completed PNG frames yet. Wait briefly, then retry Export captured frames.', { exact: true }).isVisible()) {
      await page.waitForFunction(() => {
        const element = document.querySelector('.lab-shell');
        let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
        for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook && 'memoizedState' in hook; hook = hook.next) {
          if (Array.isArray(hook.memoizedState?.current) && hook.memoizedState.current.some(value => value instanceof Blob)) return true;
        }
        return false;
      });
      await dialog.getByRole('button', { name: /Export captured frames/i }).click();
    }
  });
  expect(zip.bytes.readUInt32LE(0)).toBe(0x04034b50);
  expect(zip.bytes.readUInt16LE(8)).toBe(0); // Existing store-only ZIP, no alternate codec.
  const offset = 30 + zip.bytes.readUInt16LE(26) + zip.bytes.readUInt16LE(28);
  expect(zip.bytes.subarray(offset + 1, offset + 4).toString()).toBe('PNG');
});

for (const width of [320, 375, 768, 1024, 1440]) for (const theme of ['light', 'dark']) test(`${width}px ${theme}: first visit, active, drawer, analysis and publishing fit`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  const errors = await openApp(page, { theme });
  await assertNoOverflow(page);
  await expect(page.locator('.stage-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Start Simulation', exact: false }).click();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await freezeFields(page);
  await assertNoOverflow(page);
  if (process.env.QA_CAPTURE) await page.screenshot({ path: `docs/redesign/screenshots/phase-10-${width}-${theme}.png` });
  await page.getByRole('button', { name: 'Toggle Flow controls', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Flow', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('spinbutton', { name: /Inlet velocity/i })).toBeVisible();
  await page.getByRole('tab', { name: 'Flow', exact: true }).focus();
  await page.keyboard.press('Escape');
  if (width < 1024) {
    await expect(page.getByRole('button', { name: 'Toggle Flow controls', exact: true })).toBeFocused();
    await expect(page.locator('.professional-controls')).toHaveAttribute('inert', '');
  }
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
  await assertNoOverflow(page);
  await page.getByRole('button', { name: 'Share & Export', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open About view', exact: true }).click();
  await expect(page.locator('.about-title')).toBeVisible();
  await assertNoOverflow(page);
  await page.getByRole('button', { name: 'Open simulation view', exact: true }).click();
  await assertPausedPreserved(page);
  expect(errors).toEqual([]);
});

test('comparison, canvas resizing and keyboard fullscreen preserve paused state', async ({ page }) => {
  const errors = await openApp(page);
  await selectPreset(page, 'Front Wing');
  await page.getByRole('button', { name: 'Compare fields', exact: true }).click();
  await page.getByRole('combobox', { name: 'Comparison field A' }).selectOption('velocity');
  await page.getByRole('combobox', { name: 'Comparison field B' }).selectOption('pressure');
  await expect(page.locator('.compare-bar')).toBeVisible();
  await page.evaluate(() => { document.activeElement.blur(); });
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.setViewportSize({ width: 768, height: 900 });
  await assertNoOverflow(page);
  await assertPausedPreserved(page);
  expect(errors).toEqual([]);
});

test('mobile menu, skip link, drawer focus, numeric drafts and error recovery', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await openApp(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Skip/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const menu = page.getByRole('button', { name: 'F1 Stories menu', exact: true });
  await menu.focus(); await page.keyboard.press('Space');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await page.getByRole('button', { name: 'Toggle Flow controls', exact: true }).click();
  const input = page.getByRole('spinbutton', { name: 'Inlet velocity value', exact: true });
  await input.fill('0.095123');
  await page.getByRole('tab', { name: 'Geometry', exact: true }).click();
  await page.getByRole('tab', { name: 'Flow', exact: true }).click();
  await expect(input).toHaveValue('0.095123');
  await input.fill('99'); await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await input.press('Escape');
  await expect(input).toHaveValue('0.095123');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Toggle Flow controls', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Dark theme' }).focus();
  expect(await page.getByRole('button', { name: 'Dark theme' }).evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
});

test('3D loads, captures and disposes when navigating away', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = await openApp(page);
  await selectPreset(page, 'Rear Wing');
  await page.getByRole('button', { name: 'Switch visualization mode to 3D View', exact: true }).click();
  await expect(page.locator('.view-3d-stage canvas').first()).toBeVisible();
  await expect.poll(() => page.locator('.view-3d-stage canvas').count()).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Share & Export', exact: true }).click();
  const image = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Save Image', exact: true }).click());
  expect(image.bytes.readUInt32BE(16)).toBe(2400);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await expect(page.locator('.view-3d-stage canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open simulation view', exact: true }).click();
  await expect(page.locator('.view-3d-stage canvas').first()).toBeVisible();
  await assertPausedPreserved(page);
  expect(errors).toEqual([]);
});

test('embed exposes no editor or saved local sessions', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => localStorage.setItem('aerolab-session', JSON.stringify({ version: 2, preset: 'private-profile', vel: .09 })));
  await page.goto('./?embed=1');
  await expect(page.locator('.site-masthead')).toHaveCount(0);
  await expect(page.locator('.professional-controls')).toBeHidden();
  await expect(page.locator('.professional-controls')).toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'Start Simulation', exact: true })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Visualization modes' }).getByRole('button')).toHaveCount(7);
  await assertNoOverflow(page);
  expect(await page.locator('body').innerText()).not.toContain('private-profile');
});

test('parameter sweep retains raw CSV and cancellation restores its parameter', async ({ page }) => {
  await openApp(page);
  await selectPreset(page, 'Cylinder');
  await page.getByRole('button', { name: 'Toggle Geometry controls', exact: true }).click();
  await page.getByText('Transform geometry', { exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Angle of attack value', exact: true }).fill('7');
  await page.getByRole('spinbutton', { name: 'Angle of attack value', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await page.getByLabel('Start (°)', { exact: true }).fill('0');
  await page.getByLabel('End (°)', { exact: true }).fill('2');
  await page.getByLabel('Points', { exact: true }).fill('3');
  const automatic = await download(page, () => page.getByRole('button', { name: 'Run sweep', exact: true }).click());
  expect(automatic.bytes.toString()).toMatch(/^aoa,cl,cd,ld_ratio,regime\n/);
  const manual = await download(page, () => page.getByRole('button', { name: 'Download sweep CSV', exact: true }).click());
  expect(manual.bytes).toEqual(automatic.bytes);
  await page.getByLabel('Points', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Run sweep', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.params.current.aoa)).not.toBe(7);
  await page.getByRole('button', { name: 'Cancel sweep', exact: true }).click();
  await expect(page.locator('#analysis-sweep .report-status')).toHaveText('Cancelled');
  await expect.poll(() => page.evaluate(() => window.__qa.params.current.aoa)).toBe(7);
});

test('geometry file formats, error retention, drop, Undo and Redo remain usable', async ({ page }) => {
  const errors = await openApp(page);
  await selectPreset(page, 'Front Wing');
  await page.getByRole('button', { name: 'Toggle Geometry controls', exact: true }).click();
  for (const [source, name] of [['SVG', 'profile.svg'], ['STL', 'profile-ascii.stl'], ['STL', 'profile-binary.stl'], ['DXF', 'profile.dxf'], ['Image', 'profile.png'], ['Image', 'profile.jpg']]) {
    await page.getByRole('button', { name: source, exact: true }).click();
    await page.evaluate(() => { window.__qa.previousPoly = window.__qa.params.current.poly; });
    await page.locator('.profile-import input[type=file]').setInputFiles(fileURLToPath(new URL(`../fixtures/controls/${name}`, import.meta.url)));
    await expect.poll(() => page.evaluate(() => window.__qa.params.current.poly !== window.__qa.previousPoly)).toBe(true);
    expect(await page.evaluate(() => window.__qa.params.current.poly.every(point => point.every(Number.isFinite)))).toBe(true);
  }
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  await page.evaluate(() => { window.__qa.previousPoly = window.__qa.params.current.poly; });
  await page.locator('.profile-import input[type=file]').setInputFiles(fileURLToPath(new URL('../fixtures/controls/invalid.svg', import.meta.url)));
  await expect(page.locator('.control-import-error')).toBeVisible();
  expect(await page.evaluate(() => window.__qa.params.current.poly === window.__qa.previousPoly)).toBe(true);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const dropped = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify({ app: 'aerolab', version: 2, geometry: { poly: [[0,0],[1,0],[1,1],[0,1]], preset: 'custom', aoa: 9 }, solver: { vel: .1 } })], 'drop.json', { type: 'application/json' }));
    return transfer;
  });
  await page.locator('.lab-shell').dispatchEvent('drop', { dataTransfer: dropped });
  await expect.poll(() => page.evaluate(() => window.__qa.params.current.aoa)).toBe(9);
  await selectPreset(page, 'Rear Wing');
  await page.getByRole('button', { name: 'Undo shape change', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.params.current.preset)).toBe('custom');
  await page.getByRole('button', { name: 'Redo shape change', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.params.current.preset)).toBe('rearwing');
  expect(errors).toEqual([]);
});

test('unavailable 3D resources give a recoverable 2D path', async ({ page }) => {
  await page.route('https://cdnjs.cloudflare.com/**', route => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await openApp(page);
  await page.getByRole('button', { name: 'Switch visualization mode to 3D View', exact: true }).click();
  await expect(page.locator('.scene-message')).toContainText(/could not load/i);
  await page.getByRole('button', { name: 'Return to 2D', exact: true }).click();
  await expect(page.locator('.stage-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch visualization mode to Velocity', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('NACA, F1 tuner and resized sketch preserve editable geometry', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);
  await page.getByRole('button', { name: 'Toggle Geometry controls', exact: true }).click();
  await page.getByRole('button', { name: 'NACA', exact: true }).click();
  const naca = page.locator('.preset-btn').filter({ has: page.locator('.preset-btn__name', { hasText: /^NACA 2412$/ }) });
  await naca.click(); await expect(naca).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'F1 Tuner', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Front Wing Angle value', exact: true }).fill('18');
  await page.getByRole('spinbutton', { name: 'Front Wing Angle value', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'NACA', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Max Camber (M) value', exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'F1 Tuner', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Front Wing Angle value', exact: true })).toHaveValue('18');
  await page.getByRole('button', { name: 'Sketch', exact: true }).click();
  const sketch = page.getByRole('img', { name: 'Sketch aerodynamic profile', exact: true });
  await sketch.scrollIntoViewIfNeeded();
  const box = await sketch.boundingBox();
  await page.mouse.move(box.x + box.width * .15, box.y + box.height * .5); await page.mouse.down();
  for (const [x, y] of [[.5,.2],[.85,.5],[.5,.8],[.15,.5]]) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__qa.params.current.poly.length)).toBeGreaterThan(5);
  expect(await page.evaluate(() => window.__qa.params.current.poly.every(point => point.every(Number.isFinite)))).toBe(true);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await page.getByLabel('Session name').fill('Δοκιμή αεροδυναμικής — ' + 'μεγάλη ονομασία '.repeat(18));
  await page.getByRole('button', { name: 'Save current session', exact: true }).click();
  await assertNoOverflow(page);
});

test('car-reference decoder workers are released across repeated 3D visits', async ({ page, context }) => {
  test.setTimeout(90_000);
  await openApp(page);
  const client = await context.newCDPSession(page);
  const workerCount = async () => (await client.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker' && target.url.startsWith('blob:http://127.0.0.1:5180/')).length;
  for (let visit = 0; visit < 2; visit++) {
    await page.getByRole('button', { name: 'Switch visualization mode to 3D View', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Car reference', exact: true }).check();
    await page.waitForFunction(() => {
      const element = document.querySelector('.view-3d-stage');
      let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook && 'memoizedState' in hook; hook = hook.next) {
        if (hook.memoizedState?.current?.f1ModelGroup?.visible) return true;
      }
      return false;
    });
    await page.getByRole('button', { name: 'Switch visualization mode to Velocity', exact: true }).click();
    await expect.poll(workerCount).toBe(0);
    await expect(page.locator('.view-3d-stage canvas')).toHaveCount(0);
  }
});

test('leaving 3D during delayed model or decoder loading releases late workers', async ({ page, context }) => {
  test.setTimeout(90_000);
  await openApp(page);
  const client = await context.newCDPSession(page);
  for (const pattern of ['**/f1car.glb', '**/draco_wasm_wrapper.js']) {
    let arrived, release;
    const requested = new Promise(resolve => { arrived = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    const handler = async route => { const response = await route.fetch(); arrived(); await held; await route.fulfill({ response }); };
    await page.route(pattern, handler);
    try {
      await page.getByRole('button', { name: 'Switch visualization mode to 3D View', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Car reference', exact: true }).check();
      let timeout;
      await Promise.race([requested, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Expected delayed resource request')), 15000); })]).finally(() => clearTimeout(timeout));
      await page.getByRole('button', { name: 'Switch visualization mode to Velocity', exact: true }).click();
      release();
      await page.waitForLoadState('networkidle');
      await expect.poll(async () => (await client.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker' && target.url.startsWith('blob:http://127.0.0.1:5180/')).length).toBe(0);
      await expect(page.locator('.view-3d-stage canvas')).toHaveCount(0);
    } finally { release(); await page.unroute(pattern, handler); }
  }
});
