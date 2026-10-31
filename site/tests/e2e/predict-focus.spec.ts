// Focus after answering a prediction (SPEC.md 7.5 A-1, WCAG 2.4.3 cited there; 4.0 Predict). Adopted
// from the RT-05 reproducer of round 1. Predict.svelte disabled "Check" and "Show me" (and the
// answer field) as soon as the prediction was resolved, while the pressed button still had the focus;
// the browser then dropped the focus to <body>. A reader who answers by keyboard is left on the document itself after every prediction
// (A-1 "Every tool is fully operable from the keyboard"; WCAG 2.4.3 Focus Order, cited by A-1).
// Hooks read: data-instance, data-hydrated, data-control predictAnswer, predictCheck, predictShow,
// data-out predictResult.
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('modules/m0-start/');
  await page.locator('[data-instance="b2"]').scrollIntoViewIfNeeded();
  await page.locator('[data-instance="b2"][data-hydrated="true"]').waitFor();
}
const active = (page: Page) => page.evaluate(() => document.activeElement?.tagName ?? null);

// regression: P3-RT-05-09
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

// regression: P3-RT-05-09
test('focus is kept after "Show me" (M0 b2)', async ({ page }) => {
  await open(page);
  await page.locator('[data-instance="b2"] [data-control="predictShow"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-instance="b2"] [data-out="predictResult"]')).not.toBeEmpty();
  expect(await active(page), '/modules/m0-start/ b2: document.activeElement after Enter on "Show me"').not.toBe('BODY');
});
