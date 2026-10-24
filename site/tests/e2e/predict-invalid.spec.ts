// An answer that Check cannot read is named in words (SPEC 7.5 target WCAG 2.2 AA, criterion 3.3.1 Error
// Identification (A) and 4.1.3 Status Messages; 4.0 Keyboard and screen reader "a polite live region announces
// each result"). Adopted from the RT-05 phase 4 reproducer (P4-RT-05-05, attack 9): Predict.svelte's Check
// read the answer field, and when the text was not a whole number (empty, "two", "1.5", "+3") read() returned
// null and check() returned without a word: no text in data-out="predictResult", none in the tool's live
// region, nothing near the field. The component is shared by every prediction (T1, T3, T5 to T11, T15); the
// adopted cases are phase 4's, and a choice question checked with no choice made is the sibling.
// Hooks read: data-tool, data-instance, data-hydrated, data-control predictAnswer and predictCheck, data-out
// predictResult, aria-invalid, the live regions of the page.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __ann: string[] }).__ann = [];
    new MutationObserver((recs) => {
      for (const r of recs) {
        const el = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
        const region = el?.closest('[aria-live], [role="status"]');
        if (region && region.textContent) (window as unknown as { __ann: string[] }).__ann.push(region.textContent);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
});

for (const [route, inst, typed] of [
  ['modules/m6-multiple-edges/', 'b7', 'two'],
  ['modules/m7-geometry/', 'b4', '1.5'],
  ['modules/m7-geometry/', 'b4', ''],
] as const) {
  // regression: P4-RT-05-05
  test(`Check with the answer "${typed}" says why nothing happened (${route} ${inst})`, async ({ page }) => {
    await page.goto(route);
    const tool = page.locator(`[data-instance="${inst}"][data-tool]`);
    await tool.scrollIntoViewIfNeeded();
    await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    const field = tool.locator('input[data-control="predictAnswer"]').first();
    await expect(field).toBeEnabled();
    await field.focus();
    if (typed) await page.keyboard.type(typed);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-control', 'predictCheck');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const said = await page.evaluate(() => (window as unknown as { __ann: string[] }).__ann);
    const result = (await tool.locator('[data-out="predictResult"]').first().textContent())?.trim() ?? '';
    const invalid = await field.getAttribute('aria-invalid');
    expect({ said, result, invalid }, `${route} ${inst}: Check with "${typed}" must identify the error in text (WCAG 3.3.1)`).not.toEqual({ said: [], result: '', invalid: null });
  });
}

// regression: P4-RT-05-05
test('the sentence, the mark on the field, and their end (modules/m7-geometry/ b4, a number question)', async ({ page }) => {
  await page.goto('modules/m7-geometry/');
  const tool = page.locator('[data-instance="b4"][data-tool]');
  await tool.scrollIntoViewIfNeeded();
  await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  const field = tool.locator('input[data-control="predictAnswer"]').first();
  const result = tool.locator('[data-out="predictResult"]').first();
  await field.fill('two');
  await tool.locator('[data-control="predictCheck"]').click();
  await expect(result).toHaveText('Type a whole number.');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription('Type a whole number.');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ann: string[] }).__ann)).toContain('Type a whole number.');
  // The board stays frozen: Check did not answer the prediction.
  await expect(tool.locator('[data-control="predictCheck"]')).not.toHaveAttribute('aria-disabled', 'true');
  // Editing the field takes the mark and the sentence away.
  await field.fill('3');
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  await expect(result).toHaveText('');
});

// regression: P4-RT-05-05 (sibling: a choice question checked with no choice made said nothing either)
test('Check with no choice made says why nothing happened (modules/m1-mutation/ b5, a choice question)', async ({ page }) => {
  await page.goto('modules/m1-mutation/');
  const tool = page.locator('[data-instance="b5"][data-tool]');
  await tool.scrollIntoViewIfNeeded();
  await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  const check = tool.locator('[data-control="predictCheck"]');
  await check.focus();
  await page.keyboard.press('Enter');
  const result = tool.locator('[data-out="predictResult"]').first();
  await expect(result).toHaveText('Choose one of the answers.');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ann: string[] }).__ann)).toContain('Choose one of the answers.');
  // Each radio button is described by the sentence (a radio button takes no aria-invalid).
  const radios = tool.locator('input[data-control="predictAnswer"]');
  for (const r of await radios.all()) await expect(r).toHaveAccessibleDescription('Choose one of the answers.');
  // Choosing an answer takes the sentence away.
  await radios.first().check();
  for (const r of await radios.all()) await expect(r).toHaveAccessibleDescription('');
  await expect(result).toHaveText('');
});
