// RT-13 (red team, reader-playtest), attack 11: challenges report success exactly when the goal is
// met, by every route a reader takes (shortest play, undo and redo, acting from an earlier position,
// a link that loads the goal state), and never on a near miss. SPEC 8.2 item 6 ("each with a check
// that reports success"), 8.5, 9.2. Reads data-met on [data-challenge] and the tool hooks of 4.0.
import { expect, test, type Locator, type Page } from '@playwright/test';

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const challengeFor = (page: Page, n: number): Locator => page.locator('[data-challenge]').nth(n);
async function open(page: Page, url: string, id: string): Promise<Locator> {
  await page.goto(url);
  const t = tool(page, id);
  await t.scrollIntoViewIfNeeded();
  await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  await page.locator('[data-challenge]').first().scrollIntoViewIfNeeded();
  return t;
}
const click = (t: Locator, board: string, l: number) => t.locator(`button[data-board="${board}"][data-node="${l}"]`).click();

test('M0 challenge 1 (b5): reached by mutating 1 then 3', async ({ page }) => {
  const t = await open(page, 'modules/m0-start/', 'b5');
  await click(t, 'populations', 1); await click(t, 'populations', 3);
  await expect(challengeFor(page, 0)).toHaveAttribute('data-met', 'true');
});

test('M0 challenge 1 (b5): reached after undo and redo', async ({ page }) => {
  const t = await open(page, 'modules/m0-start/', 'b5');
  await click(t, 'populations', 1); await click(t, 'populations', 3);
  await t.locator('[data-control="undo"]').click();
  await t.locator('[data-control="redo"]').click();
  await expect(t).toHaveAttribute('data-moves', '2');
  await expect(challengeFor(page, 0)).toHaveAttribute('data-met', 'true');
});

test('M0 challenge 1 (b5): a link that loads the goal state reports success', async ({ page }) => {
  const t = await open(page, 'modules/m0-start/?b5.z=1&b5.g=A3&b5.v=p&b5.m=f&b5.c=p&b5.s=0,1,0&b5.w=1.3', 'b5');
  await expect(t).toHaveAttribute('data-moves', '2');
  await expect(challengeFor(page, 0)).toHaveAttribute('data-met', 'true');
});

test('M4 challenge 1 (b10): the mirror image (-1, -1, 3) of the target is not accepted, the target is', async ({ page }) => {
  const t = await open(page, 'modules/m4-numbers/', 'b10');
  for (const l of [1, 2, 1]) await click(t, 'numbers', l);
  await expect(challengeFor(page, 0)).not.toHaveAttribute('data-met', 'true');
  await t.locator('[data-control="reset"]').click();
  for (const l of [3, 2, 3]) await click(t, 'numbers', l);
  await expect(challengeFor(page, 0)).toHaveAttribute('data-met', 'true');
});

test('M5 challenge 2 (b13): the play 1, 3, 2, 1, 3 has a heap shared by four plays', async ({ page }) => {
  const t = await open(page, 'modules/m5-weyl/', 'b13');
  for (const l of [1, 3, 2, 1, 3]) await click(t, 'numbers', l).catch(async () => { await t.locator(`[data-node="${l}"]`).first().click(); });
  await expect(t.locator('[data-out="heapCount"]')).toHaveText('4');
  await expect(challengeFor(page, 1)).toHaveAttribute('data-met', 'true');
});

test('M1 challenge 3 (b11): after one wrong try the reader can still type (1, 1, 1) and meet the goal', async ({ page }) => {
  const t = await open(page, 'modules/m1-mutation/', 'b11');
  const fields = t.locator('[data-control="predictAnswer"]');
  for (const [k, v] of ['1', '1', '0'].entries()) await fields.nth(k).fill(v);
  await t.locator('[data-control="predictCheck"]').click();
  await expect(t.locator('[data-out="predictResult"]')).toContainText('Not quite');
  await expect(challengeFor(page, 2)).not.toHaveAttribute('data-met', 'true');
  // the goal asks the reader to type the population; try again with the right one
  await expect(fields.nth(0)).toBeEnabled({ timeout: 2000 });
  for (const [k, v] of ['1', '1', '1'].entries()) await fields.nth(k).fill(v);
  await t.locator('[data-control="predictCheck"]').click();
  await expect(challengeFor(page, 2)).toHaveAttribute('data-met', 'true');
});
