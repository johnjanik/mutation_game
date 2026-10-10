// P1-A2: the run with JavaScript disabled (SPEC.md 7.4 "Without JavaScript", 4.0 "Works before and
// without JavaScript", 7.7, 9.1 G1: "the run without JavaScript passes on M0, M1, the tool routes and
// the pages"). Every route of the built site is discovered from site/dist, so lessons, tool routes
// and pages are covered as they appear. P0-A5's nojs-phase0.spec.ts stays; this is the general one.
//
// Hooks read: data-tool (tool roots), data-frame (ToolFrame tools), data-out="caption",
// data-out="noscript", data-node, data-prediction (lessons, plan); the <noscript> line, <figure>,
// <figcaption>, <details>, <table>; KaTeX's .katex and its <math> (A-12, plan addition).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { discoverRoutes } from './routes';

test.use({ javaScriptEnabled: false });

const routes = discoverRoutes();

test('routes are discovered from the built site', () => {
  const paths = routes.map((r) => r.path);
  for (const page of ['./', 'about/', 'credits/']) expect(paths).toContain(page);
});

/** What the check of one tool root found; computed in the page, without page scripts. */
interface ToolReport {
  tool: string;
  frame: boolean;
  figure: 'svg' | 'img' | null;
  textAlternative: boolean;
  caption: string;
  enabledControls: string[];
  noscript: string;
  noscriptShown: boolean;
  nodes: number;
  table: boolean;
  tableButtons: number;
}

for (const route of routes) {
  test(`every route renders without JavaScript: ${route.path}`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.ok(), `status of ${route.path}`).toBe(true);

    // Text in main. The phase-0 spike page dev/math-check/ has no <main> (P0-A3's; reported to MERGE):
    // a page without the landmark is read from its body, so that the text check still applies.
    const mains = await page.locator('main').count();
    expect(mains, 'at most one main').toBeLessThanOrEqual(1);
    const text = mains === 1 ? await page.locator('main').innerText() : await page.locator('body').innerText();
    expect(text.trim().length, 'text in main').toBeGreaterThan(0);

    // Mathematics rendered at build time is present as MathML (A-12): every KaTeX formula holds <math>.
    const katex = await page.locator('.katex').count();
    const katexWithMath = await page.locator('.katex:has(math)').count();
    expect(katexWithMath, 'KaTeX formulas carrying MathML').toBe(katex);

    // Every table of the page's own HTML is present, and every prediction has its <details>.
    const html = readFileSync(route.file, 'utf8');
    const tablesInHtml = (html.match(/<table\b/g) ?? []).length;
    await expect(page.locator('table')).toHaveCount(tablesInHtml);
    const predictions = page.locator('[data-prediction]');
    for (let k = 0; k < (await predictions.count()); k++) {
      const hasDetails = await predictions.nth(k).evaluate((el) => el.querySelector('details') !== null || el.nextElementSibling?.tagName === 'DETAILS');
      expect(hasDetails, `prediction ${k} is followed by its <details>`).toBe(true);
    }

    // Every tool: default figure, text alternative, caption, disabled controls, the noscript line;
    // a ToolFrame tool also its A-10 table with one button per node.
    const tools = page.locator('[data-tool]');
    const n = await tools.count();
    for (let k = 0; k < n; k++) {
      const report: ToolReport = await tools.nth(k).evaluate((root) => {
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
        const captionEl = root.querySelector('[data-out="caption"]') ?? root.closest('figure')?.querySelector(':scope > figcaption') ?? figure?.querySelector(':scope > figcaption') ?? null;
        const controls = [...root.querySelectorAll('button, input, select, textarea')];
        const enabledControls = controls.filter((c) => !c.matches(':disabled')).map((c) => c.outerHTML.slice(0, 120));
        const noscripts = [...root.querySelectorAll('noscript')];
        const noscript = noscripts.map((x) => x.textContent ?? '').join(' ').trim();
        const noscriptShown = noscripts.some((x) => {
          const box = (x.parentElement ?? x).getBoundingClientRect();
          return box.height > 0 && (x.textContent ?? '').trim() !== '';
        });
        const nodes = new Set([...root.querySelectorAll('[data-node]')].map((b) => b.getAttribute('data-node'))).size;
        const details = [...root.querySelectorAll('details')].find((d) => d.querySelector('table')) ?? null;
        return {
          tool: root.getAttribute('data-tool') ?? '',
          frame: root.hasAttribute('data-frame'),
          figure: svg ? 'svg' : img ? 'img' : null,
          textAlternative,
          caption: (captionEl?.textContent ?? '').trim(),
          enabledControls,
          noscript,
          noscriptShown,
          nodes,
          table: details !== null,
          tableButtons: details ? details.querySelectorAll('table button').length : 0,
        } satisfies ToolReport;
      });
      const what = `${route.path} tool ${k} (${report.tool})`;
      expect(report.figure, `${what}: default figure`).not.toBeNull();
      expect(report.textAlternative, `${what}: text alternative of the figure`).toBe(true);
      expect(report.caption, `${what}: caption`).not.toBe('');
      expect(report.enabledControls, `${what}: controls disabled before hydration`).toEqual([]);
      expect(report.noscript, `${what}: noscript line`).not.toBe('');
      expect(report.noscriptShown, `${what}: noscript line shown`).toBe(true);
      if (report.frame) {
        expect(report.table, `${what}: the table of A-10 inside <details>`).toBe(true);
        expect(report.tableButtons, `${what}: a button per node in the table`).toBeGreaterThanOrEqual(Math.max(1, report.nodes));
      }
    }
  });
}
