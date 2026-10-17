// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-09.
// Predict.svelte disables "Check" and "Show me" (and the answer field) as soon as the prediction is
// resolved, while the pressed button still has the focus; the browser then drops the focus to
// <body>. A reader who answers by keyboard is left on the document itself after every prediction
// (A-1 "Every tool is fully operable from the keyboard"; WCAG 2.4.3 Focus Order, cited by A-1).
// Run: npx playwright test -c redteam/redteam-RT-05-playwright.config.ts redteam-RT-05-predict-focus
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('modules/m0-start/');
  await page.locator('[data-instance="b2"]').scrollIntoViewIfNeeded();
  await page.locator('[data-instance="b2"][data-hydrated="true"]').waitFor();
}
const active = (page: Page) => page.evaluate(() => document.activeElement?.tagName ?? null);

test('focus is kept after answering a prediction with Check (M0 b2)', async ({ page }) => {
  await open(page);
  await page.locator('[data-instance="b2"] input[data-control="predictAnswer"]').focus();
  await page.keyboard.type('0');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.control)).toBe('predictCheck');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-instance="b2"] [data-out="predictResult"]')).not.toBeEmpty();
  expect(await active(page), '/modules/m0-start/ b2: document.activeElement after Enter on "Check"').not.toBe('BODY');
});

test('focus is kept after "Show me" (M0 b2)', async ({ page }) => {
  await open(page);
  await page.locator('[data-instance="b2"] [data-control="predictShow"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-instance="b2"] [data-out="predictResult"]')).not.toBeEmpty();
  expect(await active(page), '/modules/m0-start/ b2: document.activeElement after Enter on "Show me"').not.toBe('BODY');
});
