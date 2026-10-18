import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) test(`${theme}: preference resolved before React paints`, async ({ page }) => {
  await page.addInitScript(theme => localStorage.setItem('f1stories-theme', theme), theme);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/index-*.js', async route => { await held; await route.continue(); });
  try {
    await page.goto('./', { waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.locator('#root').evaluate(element => element.childElementCount)).toBe(0);
    expect(await page.locator('html').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(theme === 'light' ? 'rgb(242, 238, 228)' : 'rgb(27, 26, 25)');
  } finally { release(); }
  await expect(page.getByRole('heading', { name: 'AEROTUNNEL.' })).toBeVisible();
});

test('storage failure follows OS until explicit choice; keyboard toggle stays usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark theme', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});
