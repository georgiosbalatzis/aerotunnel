import { test, expect } from '@playwright/test';
import { openApp, assertNoOverflow } from './helpers.mjs';

for (const theme of ['light', 'dark']) test(`${theme}: named controls, focus, contrast, reduced motion and modal keyboard containment`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page, { theme });
  const missingNames = await page.evaluate(() => [...document.querySelectorAll('button,input,select,textarea')].filter(element => element.checkVisibility() && !element.closest('[inert]') && element.type !== 'hidden').filter(element => ![element.getAttribute('aria-label'), element.getAttribute('aria-labelledby'), element.textContent.trim(), ...[...(element.labels || [])].map(label => label.textContent.trim())].some(Boolean)).map(element => element.outerHTML));
  expect(missingNames).toEqual([]);
  const pairs = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const rgb = name => style.getPropertyValue(name).trim().match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255);
    const light = values => values.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const ratio = (foreground, background) => { const a = light(rgb(foreground)), b = light(rgb(background)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    return { primary: ratio('--text-primary', '--bg-base'), secondary: ratio('--text-secondary', '--bg-surface'), accent: ratio('--accent', '--bg-surface'), filled: ratio('--accent-contrast', '--accent') };
  });
  for (const ratio of Object.values(pairs)) expect(ratio).toBeGreaterThanOrEqual(4.5);
  const toggle = page.getByRole('button', { name: 'Dark theme', exact: true });
  await toggle.focus();
  const focus = await toggle.evaluate(element => { const style = getComputedStyle(element), box = element.getBoundingClientRect(); return { width: box.width, height: box.height, style: style.outlineStyle, outline: parseFloat(style.outlineWidth), animation: style.animationName, transition: parseFloat(style.transitionDuration) }; });
  expect(focus.width).toBeGreaterThanOrEqual(44); expect(focus.height).toBeGreaterThanOrEqual(44);
  expect(focus.style).toBe('solid'); expect(focus.outline).toBeGreaterThanOrEqual(2);
  expect(focus.animation).toBe('none'); expect(focus.transition).toBeLessThanOrEqual(.00001);
  await page.getByRole('button', { name: 'Share & Export', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const buttons = dialog.getByRole('button');
  await buttons.last().focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await assertNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Share & Export', exact: true })).toBeFocused();
});
