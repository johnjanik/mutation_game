// A prediction's negative answer is written with the true minus sign and spoken "minus" (SPEC.md 7.5 A-4 "with
// negative numbers spoken as 'minus'"; 6.3 "with a true minus sign"; CONTRACTS 4 `speak`). Adopted from the RT-05
// phase 6 reproducer of P6-RT-05-04 (attacks 1 and 9): M9 is the first lesson whose position predictions have
// negative answers (b6: where θ sends (0, 0, 1) on su(1,3); b7: the restricted coordinates after two composite
// moves). Predict.svelte wrote the answer with predictionAnswerText (`(${a.value.join(', ')})`), so the result line
// showed "(-1, -1, 0)" with the ASCII hyphen-minus and the live region said "Shown. The answer is (-1, -1, 0). ..."
// instead of reading the numbers through speak ("minus 1"), while the reveal beside it, written by the lesson,
// prints "(0, −1)" with U+2212. The same template on b7 and on a number answer (M0 b4), on the paths "show me"
// and a wrong answer, is checked against the answer the tool itself holds in its <details> (.answer-text, the
// engine's digits with an ASCII hyphen, read before the answer is given).
// Hooks read: data-tool, data-instance, data-hydrated, data-control predictShow, predictAnswer and predictCheck,
// data-out predictResult and predictReveal, data-live, and Predict's .answer-text.
import { expect, test, type Locator, type Page } from '@playwright/test';

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

// regression: P6-RT-05-04
test('M9 b6: "Show me" by keys announces the negative answer with "minus" and shows it with U+2212', async ({ page }) => {
  await page.goto('modules/m9-real-forms/');
  const root = page.locator('[data-tool="satake"][data-instance="b6"]');
  await root.scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  await root.locator('[data-control="predictShow"]').focus();
  await page.keyboard.press('Enter');
  await expect(root.locator('[data-out="predictReveal"]')).toBeVisible();
  await page.waitForTimeout(800);
  const said = await root.locator('[data-live]').textContent();
  const shown = await root.locator('[data-out="predictResult"]').textContent();
  expect.soft(shown, `/modules/m9-real-forms/ b6, after "Show me": the result line`).toBe('The answer is (−1, −1, 0).');
  expect(said?.startsWith('Shown. The answer is (minus 1, minus 1, 0).'), `/modules/m9-real-forms/ b6, after "Show me": the live region said "${said}"`).toBe(true);
});

/** The tool root of a lesson instance, scrolled into view and hydrated. */
async function hydrated(page: Page, route: string, tool: string, id: string): Promise<Locator> {
  await page.goto(route);
  const root = page.locator(`[data-tool="${tool}"][data-instance="${id}"]`);
  await root.scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  return root;
}

/** The answer the tool holds, written with U+2212 and spoken with "minus", from its digits with an ASCII hyphen. */
function forms(digits: string): { shown: string; spoken: string } {
  return { shown: digits.replace(/-(?=\d)/g, '−'), spoken: digits.replace(/-(?=\d)/g, 'minus ') };
}

for (const [route, tool, id] of [
  ['modules/m9-real-forms/', 'satake', 'b7'],
  ['modules/m0-start/', 'board', 'b4'],
] as const) {
  // regression: P6-RT-05-04
  test(`${route} ${id}: "Show me" shows a negative answer with U+2212 and announces it with "minus"`, async ({ page }) => {
    const root = await hydrated(page, route, tool, id);
    const digits = ((await root.locator('.answer-text').textContent()) ?? '').trim();
    expect(digits, `${id}: the answer has a negative number`).toMatch(/-\d/);
    const { shown, spoken } = forms(digits);
    await root.locator('[data-control="predictShow"]').focus();
    await page.keyboard.press('Enter');
    await expect(root.locator('[data-out="predictResult"]')).toHaveText(`The answer is ${shown}.`);
    await expect(root.locator('[data-live]')).toContainText(`Shown. The answer is ${spoken}. `);
    expect(await root.locator('[data-live]').textContent(), `${id}: the live region`).not.toMatch(/^Shown\. The answer is [^.]*-\d/);
  });
}

// regression: P6-RT-05-04
test('modules/m0-start/ b4: a wrong answer shows the negative answer with U+2212 and announces it with "minus"', async ({ page }) => {
  const root = await hydrated(page, 'modules/m0-start/', 'board', 'b4');
  const digits = ((await root.locator('.answer-text').textContent()) ?? '').trim();
  const { shown, spoken } = forms(digits);
  await root.locator('[data-control="predictAnswer"]').fill('0');
  await root.locator('[data-control="predictCheck"]').focus();
  await page.keyboard.press('Enter');
  await expect(root.locator('[data-out="predictResult"]')).toHaveText(`Not quite: the answer is ${shown}.`);
  await expect(root.locator('[data-live]')).toContainText(`Not quite. The answer is ${spoken}. `);
});
