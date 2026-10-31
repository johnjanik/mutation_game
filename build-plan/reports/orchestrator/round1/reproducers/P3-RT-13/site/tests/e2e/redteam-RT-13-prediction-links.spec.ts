// RT-13 (red team, reader-playtest), attacks 6 and 31: a shared link on a prediction instance.
// SPEC 4.0 Predict ("the correct answer computed by the engine"; "The board is frozen until the
// reader has answered or pressed "show me""); 7.4 ("Positions are never part of the state; they are
// recomputed"). Links from site/tests/unit/redteam-RT-13-states.test.ts (encodeState, prefix b2).
import { expect, test } from '@playwright/test';

const MOVED = 'modules/m0-start/?b2.z=1&b2.g=A3&b2.v=p&b2.m=f&b2.c=p&b2.s=1,1,0&b2.w=2';
const OTHER_START = 'modules/m0-start/?b2.z=1&b2.g=A3&b2.v=p&b2.m=f&b2.c=p&b2.s=2,1,0&b2.w=';

async function values(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator('[data-tool][data-instance="b2"] button[data-board="populations"][data-node]').evaluateAll((els) =>
    (els as HTMLElement[]).sort((a, b) => Number(a.dataset.node) - Number(b.dataset.node)).map((e) => e.dataset.value ?? ''));
}

test('attack 6: a link that carries the predicted move does not load b2 past it with the prediction open', async ({ page }) => {
  await page.goto(MOVED);
  const t = page.locator('[data-tool][data-instance="b2"]');
  await t.scrollIntoViewIfNeeded();
  await expect(t).toHaveAttribute('data-hydrated', 'true');
  const open = (await t.locator('[data-control="predictCheck"]').count()) > 0 && (await t.locator('[data-control="predictCheck"]').isEnabled());
  const moved = (await t.getAttribute('data-moves')) !== '0';
  expect({ open, moved, values: await values(page) }, 'the board shows the answer while the question is still open').not.toMatchObject({ open: true, moved: true });
});

test('attack 31: a link that changes the start of b2 does not grade the configured answer against another board', async ({ page }) => {
  await page.goto(OTHER_START);
  const t = page.locator('[data-tool][data-instance="b2"]');
  await t.scrollIntoViewIfNeeded();
  await expect(t).toHaveAttribute('data-hydrated', 'true');
  const shown = await values(page);
  const hasPrediction = (await t.locator('[data-prediction] [data-control="predictCheck"]').count()) > 0;
  test.info().annotations.push({ type: 'observed', description: `board ${shown.join(',')}, prediction present ${hasPrediction}` });
  if (!hasPrediction || shown.join(',') === '1,1,0') return; // the tool ignored the link or dropped the prediction: allowed
  // the board shows (2, 1, 0): mutating city 2 gives 1 there (oracle mutate(A3, (2,1,0), city 2) = (2,1,0))
  await t.locator('[data-control="predictAnswer"]').fill('0');
  await t.locator('[data-control="predictCheck"]').click();
  await expect(t.locator('[data-out="predictResult"]'), 'answer 0 is wrong for the board shown').not.toHaveText(/^Right/);
});
