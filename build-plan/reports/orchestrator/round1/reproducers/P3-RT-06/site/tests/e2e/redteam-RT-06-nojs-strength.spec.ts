// RT-06 attacks 1, 9 and 21 against the gate's own check (red team, no-js-and-no-worker): what nojs.spec.ts
// proves. SPEC.md 7.4 "A Playwright run with JavaScript disabled checks, for every lesson, that the text,
// every default figure and every table are present"; 4.0 "the default figure"; 4.0 Predict "a <details>
// element holding the answer and the reveal". nojs.spec.ts accepts as "the default figure" any <svg> of
// the root with one child element, and as a prediction's fallback any <details>, and it reads no data-value.
// This test blanks the default state on a built page with scripts off (it removes every node of the
// drawing, every data-value hook and the board's own <svg>, and empties each prediction's <details>), then
// applies nojs.spec.ts's per-root predicate, copied unchanged, and expects it to reject the blank page.
// It does not: an icon <svg> (the panel titles of T1) and the <figure>'s aria-labelledby satisfy it.
// Run: PLAYWRIGHT_BROWSERS_PATH=<browsers> npx playwright test -c redteam/redteam-RT-06-playwright.config.ts \
//        site/tests/e2e/redteam-RT-06-nojs-strength.spec.ts
import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

for (const route of ['tools/board/', 'modules/m0-start/']) {
  test(`nojs.spec.ts rejects a blank default figure: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Blank the default state: no node, no value, no board drawing; predictions without answer or reveal.
    await page.evaluate(() => {
      for (const r of document.querySelectorAll('[data-tool]')) {
        for (const b of r.querySelectorAll('[data-board-group], svg.drawing, [data-node]')) b.remove();
      }
      for (const d of document.querySelectorAll('[data-prediction] details')) d.replaceChildren(document.createElement('summary'));
    });
    const left = await page.$$eval('[data-tool] [data-value]', (es) => es.length);
    expect(left, 'the page is blank: no data-value hook left').toBe(0);
    // nojs.spec.ts lines 70 to 106 (the per-root report) and its prediction check, unchanged.
    const accepted = await page.$$eval('[data-tool]', (roots) =>
      roots.map((root) => {
        const svg = [...root.querySelectorAll('svg')].find((s) => s.childElementCount > 0) ?? null;
        const img = root.querySelector('img');
        const figureEl = svg ?? img;
        const named = (el: Element | null): boolean =>
          !!el && ((el.getAttribute('aria-label') ?? '').trim() !== '' || (el.getAttribute('aria-labelledby') ?? '').trim() !== '');
        const figure = figureEl?.closest('figure') ?? null;
        const textAlternative =
          named(svg) ||
          !!svg?.querySelector(':scope > title') ||
          (!!img && (img.getAttribute('alt') ?? '').trim() !== '') ||
          named(figure) ||
          !!figure?.querySelector(':scope > figcaption') ||
          [...root.querySelectorAll('[role="group"], [role="img"]')].some((g) => named(g));
        return { tool: `${root.getAttribute('data-tool')} ${root.getAttribute('data-instance')}`, figure: svg ? 'svg' : img ? 'img' : null, textAlternative };
      }),
    );
    const predictionsAccepted = await page.$$eval('[data-prediction]', (ps) =>
      ps.map((el) => el.querySelector('details') !== null || el.nextElementSibling?.tagName === 'DETAILS'),
    );
    const passing = accepted.filter((a) => a.figure !== null && a.textAlternative).map((a) => a.tool);
    expect.soft(passing, `${route}: roots whose blank figure nojs.spec.ts accepts as "the default figure"`).toEqual([]);
    expect.soft(predictionsAccepted.filter(Boolean).length, `${route}: emptied predictions nojs.spec.ts accepts`).toBe(0);
  });
}
