// RT-13 (red team, reader-playtest), attack 14: one new mechanic at a time. SPEC 8.1 P4 ("M0 shows
// both views once, as a preview. M1 to M3 then use one game and one view; the second view returns in
// M4; multiple roads arrive in M6"). No figure of M1 to M5 opens on a multiply laced board (B, C, F,
// G); the one place SPEC 3 itself names one before M6 is the T8 counter's picker in M5 beat 3, which
// opens on A3. No figure of M1 to M3 shows a Numbers board or the linked view (T6 in M2 beat 4 is
// prescribed by SPEC 3 M2 row 4 and is exempt).
import { expect, test } from '@playwright/test';

const MODULES = ['m1-mutation', 'm2-form', 'm3-classification', 'm4-numbers', 'm5-weyl'];

for (const m of MODULES) {
  test(`/modules/${m}/: no figure opens on a multiply laced board`, async ({ page }) => {
    await page.goto(`modules/${m}/`);
    const found = await page.locator('[data-tool]').evaluateAll((tools) => tools.map((t) => {
      const fig = t.querySelector('figure');
      const label = fig?.getAttribute('aria-label') ?? ''; // the board the figure opens on (A-10 text alternative)
      return { id: (t as HTMLElement).dataset.instance, tool: (t as HTMLElement).dataset.tool, label: label.replace(/\s+/g, ' ').trim() };
    }).filter((x) => /\b[BCFG][2-8]\b/.test(x.label)));
    expect(found, JSON.stringify(found)).toEqual([]);
  });
}

for (const m of ['m1-mutation', 'm2-form', 'm3-classification']) {
  test(`/modules/${m}/: one view only (no Numbers board, no linked view) outside the exempt T6`, async ({ page }) => {
    await page.goto(`modules/${m}/`);
    const found = await page.locator('[data-tool]:not([data-tool="mirror"])').evaluateAll((tools) => tools
      .filter((t) => t.querySelector('[data-board="numbers"]') || t.querySelector('[data-view="linked"]'))
      .map((t) => (t as HTMLElement).dataset.instance));
    expect(found).toEqual([]);
  });
}
