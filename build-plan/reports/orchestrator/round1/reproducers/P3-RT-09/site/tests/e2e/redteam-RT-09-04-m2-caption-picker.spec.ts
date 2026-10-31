// RT-09 finding P3-RT-09-04 (attacks 1 and 35): M2 beat 4's Kaleidoscope (instance b4) offers A2, B2, C2
// and G2 in its picker (no boardChoices), while its caption states the simply laced fact for every board:
// "Joined cities are vectors of the same length at 120 degrees: the picture of A2 with its six roots, which
// you can play on." On B2 the same figure draws the joined simple roots with lengths in the ratio sqrt 2 at
// 135 degrees, on G2 in the ratio sqrt 3 at 150 degrees (SPEC 2.14, SPEC 4 T6; oracle cholesky_basis(cartan('B',2))
// columns (2, 0) and (-1, 1): lengths 2 and sqrt 2, angle 135 degrees; cholesky_basis(cartan('G',2)): lengths
// sqrt 2 and sqrt 6, angle 150 degrees). The lens file (attack 35) names exactly this sentence: "on a page
// that also shows B2 or G2 it must not be stated for all boards".
// Run (preview build): npm run build, then
//   npx playwright test -c <copy of playwright.config.ts> site/tests/e2e/redteam-RT-09-04-m2-caption-picker.spec.ts
import { expect, test, type Locator, type Page } from '@playwright/test';

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const CAPTION = 'Joined cities are vectors of the same length at 120 degrees';

/** Length ratio |alpha_1| / |alpha_2| and the angle between the two simple-root arrows, in degrees. */
async function simpleRoots(root: Locator): Promise<{ ratio: number; angle: number }> {
  return root.evaluate((el) => {
    const o = el.querySelector('circle.origin')!;
    const ox = Number(o.getAttribute('cx'));
    const oy = Number(o.getAttribute('cy'));
    const v = [...el.querySelectorAll('[data-out="simpleRoot"]')]
      .sort((a, b) => Number(a.getAttribute('data-node')) - Number(b.getAttribute('data-node')))
      .map((g) => {
        const tip = g.querySelector('polygon')!.getAttribute('points')!.split(' ')[0]!.split(',').map(Number);
        return [tip[0]! - ox, -(tip[1]! - oy)] as [number, number];
      });
    const len = v.map(([x, y]) => Math.hypot(x, y));
    const cos = (v[0]![0] * v[1]![0] + v[0]![1] * v[1]![1]) / (len[0]! * len[1]!);
    return { ratio: len[0]! / len[1]!, angle: (Math.acos(cos) * 180) / Math.PI };
  });
}

test('P3-RT-09-04: every board the M2 beat 4 figure offers satisfies its caption', async ({ page }) => {
  await page.goto('modules/m2-form/');
  const b4 = tool(page, 'b4');
  await b4.scrollIntoViewIfNeeded();
  await expect(b4).toHaveAttribute('data-hydrated', 'true');
  await expect(b4.locator('[data-out="caption"]')).toContainText(CAPTION);
  const picker = b4.locator('select[data-control="picker"]');
  const offered = await picker.locator('option').allTextContents();
  expect(offered).toEqual(['A2', 'B2', 'C2', 'G2']);
  for (const name of offered) {
    await picker.selectOption(name);
    await expect(b4.locator('[data-out="boardName"]')).toHaveAttribute('data-name', name);
    const { ratio, angle } = await simpleRoots(b4);
    expect.soft(Math.abs(ratio - 1), `${name}: caption "${CAPTION}", but |alpha_1|/|alpha_2| = ${ratio.toFixed(4)}`).toBeLessThan(0.01);
    expect.soft(Math.abs(angle - 120), `${name}: caption "${CAPTION}", but the angle is ${angle.toFixed(2)} degrees`).toBeLessThan(0.5);
  }
});
