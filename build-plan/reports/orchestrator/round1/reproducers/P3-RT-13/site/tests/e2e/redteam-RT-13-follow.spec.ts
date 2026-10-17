// RT-13 (red team, reader-playtest), attack 9: M1 beat 1 says "the garden below it records each
// population the board reaches. There are exactly 6, and you can find them all" (SPEC 3 M1 table
// row 1: "T1, A2, populations, free play, p = (1, 0), with T2 beside it in "follow" mode counting the
// populations found (6)"). A reader at 360 by 800 plays on the board b1 (client:idle) and then
// scrolls to the garden b2 (client:visible, linkTo b1). Oracle: the orbit of (1, 0) on A2 under
// mutation has 6 populations, and the play 2, 1, 2, 1, 2, 1 visits all of them.
import { expect, test } from '@playwright/test';

test('M4 beat 5: playing b6 first, then scrolling to the garden b7, counts the 3 positions of the orbit of (1, 0)', async ({ page }) => {
  await page.goto('modules/m4-numbers/');
  const b6 = page.locator('[data-tool][data-instance="b6"]');
  await b6.scrollIntoViewIfNeeded();
  await expect(b6).toHaveAttribute('data-hydrated', 'true');
  await b6.locator('[data-control="predictShow"]').click();
  for (const l of [1, 2]) await b6.locator(`button[data-board="numbers"][data-node="${l}"]`).click(); // oracle: (1,0) -> (-1,1) -> (0,-1), the whole orbit
  const b7 = page.locator('[data-tool][data-instance="b7"]');
  await b7.scrollIntoViewIfNeeded();
  await expect(b7).toHaveAttribute('data-hydrated', 'true');
  await expect(b7.locator('[data-out="found"]')).toHaveText('3');
});

test('M5 beat 1: playing b1 first, then scrolling to the Weyl Explorer b2, marks the game as a path', async ({ page }) => {
  await page.goto('modules/m5-weyl/');
  const b1 = page.locator('[data-tool][data-instance="b1"]');
  await expect(b1).toHaveAttribute('data-hydrated', 'true');
  await b1.locator('[data-control="predictShow"]').click();
  for (const l of [1, 2, 1]) await b1.locator(`button[data-board="numbers"][data-node="${l}"]`).click(); // oracle: (1,1,1) -> (-1,2,1) -> (1,-2,3) -> (-1,-1,3)
  const b2 = page.locator('[data-tool][data-instance="b2"]');
  await b2.scrollIntoViewIfNeeded();
  await expect(b2).toHaveAttribute('data-hydrated', 'true');
  await expect(b2.locator('[data-out="vertex"][data-on-path="true"]')).toHaveCount(4);
});

for (const order of ['play first, then scroll to the garden', 'garden hydrated first, then play'] as const) {
  test(`M1 beat 1: ${order}: the garden counts the 6 populations the board visited`, async ({ page }) => {
    await page.goto('modules/m1-mutation/');
    const b1 = page.locator('[data-tool][data-instance="b1"]');
    const b2 = page.locator('[data-tool][data-instance="b2"]');
    await expect(b1).toHaveAttribute('data-hydrated', 'true');
    if (order === 'garden hydrated first, then play') {
      await b2.scrollIntoViewIfNeeded();
      await expect(b2).toHaveAttribute('data-hydrated', 'true');
      await b1.scrollIntoViewIfNeeded();
    }
    await b1.locator('[data-control="predictShow"]').click();
    for (const l of [2, 1, 2, 1, 2, 1]) await b1.locator(`button[data-board="populations"][data-node="${l}"]`).click();
    await expect(b1).toHaveAttribute('data-moves', '6');
    await b2.scrollIntoViewIfNeeded();
    await expect(b2).toHaveAttribute('data-hydrated', 'true');
    await expect(b2.locator('[data-out="found"]')).toHaveText('6');
  });
}
