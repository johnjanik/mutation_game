// The result line of a prediction (SPEC.md 4.0 Predict: the reveal states the answer; 8.4 plain
// sentences). A choice whose option is itself a sentence ends with one full stop, never two, on every
// path: right, not quite, shown, and the sentence spoken by the live region. Adopted from the RT-13
// reproducer of round 1 (attacks 4 and 29), with the other two paths of the same template added.
// Hooks read: data-instance, data-hydrated, data-control predictAnswer and predictCheck and
// predictShow, data-out predictResult, data-live.
import { expect, test, type Locator, type Page } from '@playwright/test';

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
async function open(page: Page, route: string, id: string): Promise<Locator> {
  await page.goto(route);
  const t = tool(page, id);
  await t.scrollIntoViewIfNeeded();
  await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  return t;
}

// attack 4 and 29 (minor): the result line repeats a choice that already ends with a full stop.
for (const [route, id, option] of [['modules/m1-mutation/', 'b5', 'No, every start ends at the same population.'], ['modules/m2-form/', 'b5', 'No, it is not a root population.']] as const) {
  // regression: P3-RT-13-10
  test(`${route} ${id}: the result line of a right choice reads as one sentence`, async ({ page }) => {
    const t = await open(page, route, id);
    await t.getByLabel(option, { exact: true }).check();
    await t.locator('[data-control="predictCheck"]').click();
    await expect(t.locator('[data-out="predictResult"]')).toHaveText(`Right: ${option}`);
  });
}

// The same template on the other paths: a wrong choice, "show me", and the live region's sentence.
// M1 b5 offers "Yes, the end depends on the starting city." (wrong) and the right option above.
// regression: P3-RT-13-10
test('modules/m1-mutation/ b5: the wrong-choice line, the shown line and the spoken sentence have one full stop', async ({ page }) => {
  const right = 'No, every start ends at the same population.';
  let t = await open(page, 'modules/m1-mutation/', 'b5');
  await t.getByLabel('Yes, the end depends on the starting city.', { exact: true }).check();
  await t.locator('[data-control="predictCheck"]').click();
  await expect(t.locator('[data-out="predictResult"]')).toHaveText(`Not quite: the answer is ${right}`);
  await expect(t.locator('[data-live]')).toContainText(`Not quite. The answer is ${right} `);
  await expect(t.locator('[data-live]')).not.toContainText('..');
  t = await open(page, 'modules/m1-mutation/', 'b5');
  await t.locator('[data-control="predictShow"]').click();
  await expect(t.locator('[data-out="predictResult"]')).toHaveText(`The answer is ${right}`);
  await expect(t.locator('[data-live]')).toContainText(`Shown. The answer is ${right} `);
  await expect(t.locator('[data-live]')).not.toContainText('..');
});
