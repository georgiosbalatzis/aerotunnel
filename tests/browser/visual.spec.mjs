import { test, expect } from '@playwright/test';
import { openApp } from './helpers.mjs';

for (const width of [375, 1440]) for (const theme of ['light', 'dark']) test(`representative ${width}px ${theme} interface`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  await openApp(page, { theme });
  // Static suite identity; avoid stochastic particle/CFD pixels and telemetry clocks.
  await expect(page.locator('.site-masthead')).toHaveScreenshot(`masthead-${width}-${theme}.png`);
  await page.getByRole('button', { name: 'Open analysis view', exact: true }).click();
  await expect(page.locator('#analysis-metrics')).toHaveScreenshot(`analysis-empty-${width}-${theme}.png`);
  await page.getByRole('button', { name: 'Share & Export', exact: true }).click();
  await expect(page.getByRole('dialog').locator('#publishing-image')).toHaveScreenshot(`publishing-${width}-${theme}.png`);
});
