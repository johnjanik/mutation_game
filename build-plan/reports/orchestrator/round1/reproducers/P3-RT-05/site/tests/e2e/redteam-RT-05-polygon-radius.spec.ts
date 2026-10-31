// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-06.
// SPEC 6.1: "A polygon layout is inscribed in a circle of radius (min(W,360)-60)/2", and below 400
// pixels W is the viewport width; at 320 the radius is 130. Board.svelte draws every circle layout
// at the reference width 360 (radius 150) and scales the whole drawing to the box min(100cqw, 360),
// so the radius becomes 150 * W / 360 = 133.33 at W = 320. P1-A5 recorded this ("at W = 320 the
// radius is 133 rather than the formula's 130; plan, recorded") and MERGE accepted it as a deviation
// (DECISIONS.md, P1 stage 1.2), but it contradicts the formula of 6.1 [D]; the owner decides.
// Run: npx playwright test -c redteam/redteam-RT-05-playwright.config.ts redteam-RT-05-polygon-radius
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 320, height: 800 } });

for (const g of ['A3~', 'A5~', 'pentagon', 'square']) {
  test(`polygon radius at 320 on /tools/board/?g=${g}`, async ({ page }) => {
    await page.goto(`tools/board/?z=1&g=${encodeURIComponent(g)}&v=n&m=f&c=n`);
    await page.locator('[data-tool][data-hydrated="true"]').waitFor();
    const m = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('[data-board-group] button[data-node]')].map((b) => b.getBoundingClientRect());
      const cs = bs.map((r) => [r.left + r.width / 2, r.top + r.height / 2] as const);
      const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length;
      const cy = cs.reduce((s, c) => s + c[1], 0) / cs.length;
      const box = (document.querySelector('[data-board-group]')!.closest('.board') as HTMLElement).getBoundingClientRect();
      return { W: box.width, radii: cs.map((c) => Math.hypot(c[0] - cx, c[1] - cy)) };
    });
    const expected = (Math.min(320, 360) - 60) / 2; // 130
    for (const r of m.radii) {
      expect(Math.abs(r - expected), `g=${g} at 320x800 (box ${m.W}): corner distance ${r.toFixed(2)} from the centre, expected ${expected} +- 0.5`).toBeLessThanOrEqual(0.5);
    }
  });
}
