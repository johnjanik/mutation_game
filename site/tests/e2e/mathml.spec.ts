// P3-A5: the [U] check of SPEC.md 7.3: "LinearForm.svelte ... written as MathML (<math> with <mi>,
// <mn>, <mo>, <msub>), which the three browser engines render natively [U: MathML Core in Chromium
// since version 109, from memory; check in phase 3, and if one engine fails, use HTML spans with an
// aria-label]". One test per engine, against the built site on the configured baseURL. The repository's
// Playwright project is Chromium only (playwright.config.ts belongs to P0-A6, then MERGE and GATE), so
// each test launches its own browser with the `chromium`, `webkit` and `firefox` launchers that
// @playwright/test exports (decisions/P3-A5.md; a request to MERGE asks for Firefox and WebKit in CI).
// A browser that is not installed makes its test fail; no engine is ever skipped.
//
// Checks per engine, on /tools/symbolic: the server-rendered forms x1, x2, x3 (JavaScript off) and a
// form created by the client after a move (B2, "play to the end": 2x1 + x2, a coefficient, a plus and
// two subscripts) are <math> elements in the MathML namespace with an aria-label and a box of non-zero
// size; in each <msub> the subscript is set smaller than the base and lower than it, which a browser
// without MathML layout does not do (the subscript would sit on the baseline at full size). When
// LinearForm's switch is set to the span fallback (data-form-render="spans"), the same checks read the
// <sub> of each term instead. Hooks read: data-tool, data-hydrated, data-out="symbolicBoard",
// data-out="firedForms", data-entry, data-form, data-form-render, data-control="playToEnd".
import { chromium, expect, firefox, test, webkit, type BrowserType, type Locator, type Page } from '@playwright/test';

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

interface FormReport {
  render: string | null;
  namespace: string | null;
  label: string | null;
  width: number;
  height: number;
  subs: { baseSize: number; subSize: number; baseTop: number; subTop: number; baseBottom: number; subBottom: number }[];
  text: string;
}

/** Reads one LinearForm (math or span fallback) inside `scope`. */
async function readForm(scope: Locator): Promise<FormReport> {
  return scope.locator('[data-form-render]').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const render = el.getAttribute('data-form-render');
    const subs: FormReport['subs'] = [];
    const pairs: [Element, Element][] =
      render === 'mathml'
        ? [...el.querySelectorAll('msub')].map((m) => [m.children[0]!, m.children[1]!] as [Element, Element])
        : [...el.querySelectorAll('sub')].map((s) => [s.previousElementSibling!, s] as [Element, Element]);
    for (const [base, sub] of pairs) {
      const b = base.getBoundingClientRect();
      const s = sub.getBoundingClientRect();
      subs.push({
        baseSize: parseFloat(getComputedStyle(base).fontSize),
        subSize: parseFloat(getComputedStyle(sub).fontSize),
        baseTop: b.top,
        subTop: s.top,
        baseBottom: b.bottom,
        subBottom: s.bottom,
      });
    }
    return { render, namespace: el.namespaceURI, label: el.getAttribute('aria-label'), width: r.width, height: r.height, subs, text: el.textContent ?? '' };
  });
}

function checkForm(f: FormReport, label: string, subscripts: number): void {
  expect(f.label, 'aria-label').toBe(label);
  expect(f.width, 'width').toBeGreaterThan(0);
  expect(f.height, 'height').toBeGreaterThan(0);
  if (f.render === 'mathml') expect(f.namespace).toBe(MATHML_NS);
  else expect(f.render).toBe('spans');
  expect(f.subs).toHaveLength(subscripts);
  for (const s of f.subs) {
    expect(s.subSize, 'the subscript is smaller than its base').toBeLessThan(s.baseSize);
    expect(s.subTop, 'the subscript starts lower than its base').toBeGreaterThan(s.baseTop);
    expect(s.subBottom, 'the subscript reaches below its base').toBeGreaterThan(s.baseBottom);
  }
}

const ENGINES: [string, BrowserType][] = [
  ['Chromium', chromium],
  ['WebKit', webkit],
  ['Firefox', firefox],
];

for (const [name, engine] of ENGINES) {
  test(`LinearForm renders in ${name}`, async ({ baseURL }) => {
    test.setTimeout(120000);
    const browser = await engine.launch();
    try {
      process.stdout.write(`mathml.spec.ts: ${name} ${browser.version()}\n`);
      // Server-rendered markup, JavaScript off: the default right board shows x1, x2, x3.
      const off = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
      const p0: Page = await off.newPage();
      await p0.goto('tools/symbolic/');
      const board0 = p0.locator('[data-tool="symbolic"] [data-out="symbolicBoard"]');
      for (const l of [1, 2, 3]) checkForm(await readForm(board0.locator(`[data-entry="${l}"]`)), `x ${l}`, 1);
      await off.close();

      // Forms created by the client after hydration: B2 played to the end fires 2x1 + x2 (Appendix A.1).
      const on = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
      const page = await on.newPage();
      await page.goto('tools/symbolic/?z=1&g=B2&c=n&s=1,1');
      const tool = page.locator('[data-tool="symbolic"]');
      await expect(tool).toHaveAttribute('data-hydrated', 'true');
      await tool.locator('[data-control="playToEnd"]').click();
      await expect(tool).toHaveAttribute('data-moves', '4');
      const item = tool.locator('[data-out="firedForms"] [data-form="2,1"]');
      await expect(item).toHaveCount(1);
      const f = await readForm(item);
      checkForm(f, '2 x 1 plus x 2', 2);
      if (f.render === 'mathml') {
        const tags = await item.locator('math').evaluate((m) => [...m.querySelectorAll('*')].map((e) => `${e.localName}:${e.namespaceURI === 'http://www.w3.org/1998/Math/MathML' ? 'm' : 'h'}`));
        expect(tags).toEqual(['mn:m', 'msub:m', 'mi:m', 'mn:m', 'mo:m', 'msub:m', 'mi:m', 'mn:m']);
      }
      expect(f.text.replace(/\s+/g, '')).toBe('2x1+x2');
      await on.close();
    } finally {
      await browser.close();
    }
  });
}
