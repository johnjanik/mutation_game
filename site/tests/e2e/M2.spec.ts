// P2-A8: lesson M2, "The form behind the game", against the built site (SPEC.md 3 M2, 2.5, 2.7 F2,
// 8.1, 8.2, 8.4, 8.5, 9.2, 4.0, 7.3, 7.4, 7.5, 7.6; build-plan/agents/P2-A8-lesson-m2.md 5.13). Run
// after `npm run build` against `astro preview`, one Playwright run at a time. The helpers follow
// M0.spec.ts (P1-A8) and M1.spec.ts (P1-A9). Every number with a golden value is read from
// reference/golden_data.json, never typed; the populations typed below have no golden key.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("board", "form"), data-instance (b1, b2, b3, b5 to b9),
//     data-moves, data-hydrated="true", data-live (the polite live region)
//   node buttons (P0-A5 Board, P1-A5): data-node, data-board ("populations"), data-value, data-can-act
//   T1, registry site/src/tools/registry/T01.ts (T01_OUTS): data-out caption, noscript,
//     predictResult, formValue (the form panel of P2-A7); data-control predictAnswer, predictCheck,
//     predictShow (P1-A5 Predict.svelte); data-prediction (the prediction block and its <details>)
//   T3, registry site/src/tools/registry/T03.ts (T03_OUTS): data-out caption, noscript, formValue
//     (data-value), meterNote, testVerdict, witness (data-city, data-population), smallValue
//     (data-row, data-value), smallVerdict (data-row), predictResult; data-control weightField
//     (data-weight, data-weight-index), test, entry (data-row, data-city), predictAnswer,
//     predictCheck; data-part ("meter", "builder", "small-values")
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title,
//     question, draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance;
//     data-challenge, data-kind, data-met, data-challenge-result (text "Goal reached."); data-source
//   this lesson's own markup: data-figure ("m2-matrix-a3", "m2-roots-a2"), data-figure-text (the
//     text alternative of each static figure), data-root (one per arrow of the roots figure),
//     data-seen-statement
//
// Word-counting rule (as M0.spec.ts and M1.spec.ts): the words of the <article> after removing every
// tool root ([data-tool]), every <details>, every live or status region, the draft mark and the list
// of sources entries; each KaTeX formula counts as one word; a word is a run of non-space characters.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { distDir } from './routes';

const ROUTE = 'modules/m2-form/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m2-form.mdx', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m2-form/index.html`;
const PASS = 'Passes: every mutation preserves this form.';
const FAIL = 'Fails: some mutation changes this form.';
const ROOT = 'root population';
const NOT_ROOT = 'not a root population';

/** The counterexample of beat 5 on the triangle with a tail: reference/verify.py line 1516 (no golden key). */
const COUNTEREXAMPLE = [1, 1, 1, 0, 1];
/** A population of A3 that is not a root population (form value 4; the engine judges it, no golden key). */
const NOT_A_ROOT = [1, 0, 1];

/** The tool instances in reading order (b4 is reserved for the Kaleidoscope of phase 3). */
const TOOLS: [string, 'board' | 'form'][] = [
  ['b1', 'board'],
  ['b2', 'form'],
  ['b3', 'form'],
  ['b5', 'form'],
  ['b6', 'form'],
  ['b7', 'form'],
  ['b8', 'board'],
  ['b9', 'form'],
];
const FIGURE_TOOLS: Record<string, number> = { b1: 1, b2: 1, b3: 2, b5: 5, b6: 5 };

interface TypeRecord {
  cartan: number[][];
  symmetrizer: number[];
  n_roots: number;
  highest_root: number[];
  positive_roots: number[][];
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as { types: Record<string, TypeRecord> };
const A2 = GOLDEN.types.A2!;
const A3 = GOLDEN.types.A3!;
/** The form value of one Martian on a board with single roads, (e_1, e_1) = 2 d_1 (SPEC 2.5). */
const ROOT_VALUE = String(2 * A3.symmetrizer[0]!);

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const node = (page: Page, id: string, label: number): Locator => tool(page, id).locator(`button[data-board="populations"][data-node="${label}"]`);
const field = (page: Page, id: string, kind: 'city' | 'road', index: number): Locator =>
  tool(page, id).locator(`[data-control="weightField"][data-weight="${kind}"][data-weight-index="${index}"]`);
const entry = (page: Page, id: string, row: number, city: number): Locator => tool(page, id).locator(`[data-control="entry"][data-row="${row}"][data-city="${city}"]`);
const smallValue = (page: Page, id: string, row: number): Locator => tool(page, id).locator(`[data-out="smallValue"][data-row="${row}"]`);
const smallVerdict = (page: Page, id: string, row: number): Locator => tool(page, id).locator(`[data-out="smallVerdict"][data-row="${row}"]`);
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
const minus = (s: string): string => s.replace(/−/g, '-');
const tuple = (v: readonly number[]): string => `(${v.join(', ')})`;

/** The populations of a tool, in label order, as data-value text. */
async function values(page: Page, id: string): Promise<string[]> {
  return tool(page, id)
    .locator('button[data-board="populations"][data-node]')
    .evaluateAll((els) =>
      els
        .map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value') ?? ''] as const)
        .sort((a, b) => a[0] - b[0])
        .map((p) => p[1]),
    );
}

/** Scrolls a tool into view (client:visible) and waits for hydration. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true');
}

/** The challenge that watches a tool, once its island has hydrated. */
async function challengeFor(page: Page, id: string): Promise<Locator> {
  const islands = page.locator('astro-island[component-export="Challenge"]');
  const k = await islands.evaluateAll((els, want) => els.findIndex((e) => (e.getAttribute('props') ?? '').includes(`"${want}"`)), id);
  expect(k, `a Challenge watches ${id}`).toBeGreaterThanOrEqual(0);
  const target = islands.nth(k);
  await target.locator('[data-challenge]').scrollIntoViewIfNeeded();
  await expect(target).not.toHaveAttribute('ssr', '');
  return target.locator('[data-challenge]');
}

/** The text of a tool's live region, once it has settled on `text`. */
async function expectLive(page: Page, id: string, text: string): Promise<void> {
  await expect.poll(async () => norm(await tool(page, id).locator('[data-live]').textContent()), { timeout: 5000 }).toBe(text);
}

/** Sets the builder's weights (cities by position, roads in the order of the joined pairs) and presses Test. */
async function testWeights(page: Page, id: string, city: number[], road: number[]): Promise<void> {
  for (const [k, w] of city.entries()) await field(page, id, 'city', k).fill(String(w));
  for (const [k, w] of road.entries()) await field(page, id, 'road', k).fill(String(w));
  for (const [k, w] of city.entries()) await expect(field(page, id, 'city', k)).toHaveValue(String(w));
  for (const [k, w] of road.entries()) await expect(field(page, id, 'road', k)).toHaveValue(String(w));
  await control(page, id, 'test').click();
}

/** Types a population into a row of small values (labels 1..n). */
async function typeRow(page: Page, id: string, row: number, p: readonly number[]): Promise<void> {
  for (const [k, v] of p.entries()) await entry(page, id, row, k + 1).fill(String(v));
}

/** The prose words of the lesson by the counting rule at the top of this file. */
async function proseWords(page: Page): Promise<number> {
  return page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(' formula '));
    const drop = '[data-tool], details, [role="status"], [aria-live], [data-anatomy="draft"], [data-anatomy="sources"] ul, script, style, noscript';
    for (const el of copy.querySelectorAll(drop)) el.remove();
    return (copy.textContent ?? '').split(/\s+/).filter((w) => w !== '').length;
  });
}

/** The TeX sources of the formulas inside an element, whitespace removed. */
async function texOf(locator: Locator): Promise<string[]> {
  return locator.locator('annotation[encoding="application/x-tex"]').evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, '')));
}

// ---------------------------------------------------------------------------------------------
// Without JavaScript
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the figures are present', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tool]')).toHaveCount(TOOLS.length);
    for (const [id, kind] of TOOLS) {
      const root = tool(page, id);
      await expect(root, id).toHaveCount(1);
      await expect(root, id).toHaveAttribute('data-tool', kind);
      expect(norm(await out(page, id, 'caption').textContent()), `${id} caption`).not.toBe('');
      await expect(out(page, id, 'noscript'), `${id} noscript line`).toHaveText('Interactive when scripts are allowed.');
      const enabled = await root.locator('button, input, select, textarea').evaluateAll((els) => els.filter((e) => !e.matches(':disabled')).length);
      expect(enabled, `${id} controls disabled`).toBe(0);
    }
    for (const [id, beat] of Object.entries(FIGURE_TOOLS)) {
      await expect(page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] [data-tool][data-instance="${id}"]`), id).toHaveCount(1);
    }
    // The two static figures of beats 3 and 4, each with a caption and a text alternative.
    for (const [name, beat] of [['m2-matrix-a3', 3], ['m2-roots-a2', 4]] as const) {
      const fig = page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] figure[data-figure="${name}"]`);
      await expect(fig, name).toHaveCount(1);
      expect(norm(await fig.locator('figcaption').textContent()), `${name} caption`).not.toBe('');
      expect(norm(await fig.locator('[data-figure-text]').first().textContent()).length, `${name} text alternative`).toBeGreaterThan(20);
      for (const svg of await fig.locator(':scope > svg').all()) {
        await expect(svg).toHaveAttribute('role', 'img');
        expect((await svg.getAttribute('aria-label')) ?? '', `${name} svg label`).not.toBe('');
      }
      await expect(fig.locator('button, input, select, textarea')).toHaveCount(0);
    }
    // b1 starts from one Martian in city 1; b2 follows it and draws no board of its own.
    expect(await values(page, 'b1')).toEqual(['1', '0', '0']);
    await expect(tool(page, 'b2').locator('button[data-node]')).toHaveCount(0);
    await expect(out(page, 'b2', 'meterNote')).toHaveCount(1);
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('the meter reads the form value without JavaScript', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(out(page, 'b2', 'formValue')).toHaveAttribute('data-value', ROOT_VALUE);
    await expect(out(page, 'b2', 'formValue')).toHaveText(ROOT_VALUE);
  });

  test('the counterexample row reads 2 and not a root population without JavaScript', async ({ page }) => {
    await page.goto(ROUTE);
    const inputs = tool(page, 'b6').locator('[data-control="entry"][data-row="0"]');
    expect(await inputs.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(COUNTEREXAMPLE.map(String));
    await expect(smallValue(page, 'b6', 0)).toHaveAttribute('data-value', ROOT_VALUE);
    await expect(smallVerdict(page, 'b6', 0)).toHaveText(NOT_ROOT);
    // The board is the triangle with a tail: five cities.
    await expect(tool(page, 'b6').locator('button[data-node]')).toHaveCount(COUNTEREXAMPLE.length);
  });

  test('every prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    const expected: Record<string, string> = {
      b1: ROOT_VALUE,
      b5: 'No, it is not a root population.',
    };
    for (const [id, answer] of Object.entries(expected)) {
      const block = tool(page, id).locator('[data-prediction]');
      await expect(block, id).toHaveCount(1);
      const details = block.locator('details');
      await expect(details, `${id} details`).toHaveCount(1);
      const order = await block.evaluate((el) => {
        const q = el.querySelector('.question');
        const d = el.querySelector('details');
        return !!q && !!d && (q.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      });
      expect(order, `${id}: question then details`).toBe(true);
      expect(norm(await details.locator('.answer-text').textContent()), id).toBe(answer);
      expect(norm(await details.textContent()).length, `${id}: the reveal`).toBeGreaterThan(40);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// With JavaScript
// ---------------------------------------------------------------------------------------------

test('the meter reads the form value and does not move', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  await hydrate(page, 'b2');
  await expect(out(page, 'b2', 'formValue')).toHaveAttribute('data-value', ROOT_VALUE);
  // Answer the prediction of b1 first: the board is frozen until then.
  await control(page, 'b1', 'predictAnswer').fill(ROOT_VALUE);
  await control(page, 'b1', 'predictCheck').click();
  await expect(out(page, 'b1', 'predictResult')).toHaveText(/^Right/);
  // Three mutations by keyboard: city 2, then city 3, then city 1.
  await node(page, 'b1', 2).focus();
  await page.keyboard.press('Enter');
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '1');
  await expectLive(page, 'b1', 'Mutated city 2. Populations now 1, 1, 0. Move 1.');
  await expect(out(page, 'b2', 'formValue')).toHaveAttribute('data-value', ROOT_VALUE);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '2');
  expect(await values(page, 'b1')).toEqual(A3.highest_root.map(String));
  await expect(out(page, 'b2', 'formValue')).toHaveAttribute('data-value', ROOT_VALUE);
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '3');
  expect(await values(page, 'b1')).toEqual(['0', '1', '1']);
  await expect(out(page, 'b2', 'formValue')).toHaveAttribute('data-value', ROOT_VALUE);
  await expect(out(page, 'b2', 'formValue')).toHaveText(ROOT_VALUE);
  // The meter follows b1 and draws no board of its own.
  await expect(tool(page, 'b2').locator('button[data-node]')).toHaveCount(0);
  await expect(tool(page, 'b2').locator('[data-part="meter"] [data-out="meterNote"]')).toHaveCount(1);
});

test('the A2 builder passes exactly when all three weights are equal', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b3');
  await expect(tool(page, 'b3').locator('button[data-node]')).toHaveCount(A2.cartan.length);
  await expect(tool(page, 'b3').locator('[data-control="weightField"]')).toHaveCount(3);
  // The starting weights fail.
  await control(page, 'b3', 'test').click();
  await expect(out(page, 'b3', 'testVerdict')).toHaveText(FAIL);
  for (const [city, road] of [[[2, 2], [2]], [[3, 3], [3]]] as const) {
    await testWeights(page, 'b3', [...city], [...road]);
    await expect(out(page, 'b3', 'testVerdict'), `${city} ${road}`).toHaveText(PASS);
    await expect(out(page, 'b3', 'witness')).toHaveText('');
  }
  for (const [city, road] of [[[2, 2], [3]], [[2, 3], [2]]] as const) {
    await testWeights(page, 'b3', [...city], [...road]);
    await expect(out(page, 'b3', 'testVerdict'), `${city} ${road}`).toHaveText(FAIL);
    const witness = out(page, 'b3', 'witness');
    await expect(witness).toHaveAttribute('data-city', /^[12]$/);
    await expect(witness).toHaveAttribute('data-population', /^-?\d+,-?\d+$/);
    await expect(witness).toHaveText(/^Witness: mutating city [12] takes the population/);
  }
});

test('small values judge the rows', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b5');
  // A root population of A3 that is not among the default rows.
  const root = A3.positive_roots[4]!;
  await typeRow(page, 'b5', 0, root);
  await expect(smallValue(page, 'b5', 0)).toHaveAttribute('data-value', ROOT_VALUE);
  await expect(smallVerdict(page, 'b5', 0)).toHaveText(ROOT);
  await typeRow(page, 'b5', 1, NOT_A_ROOT);
  await expect(smallValue(page, 'b5', 1)).toHaveAttribute('data-value', String(2 * Number(ROOT_VALUE)));
  await expect(smallVerdict(page, 'b5', 1)).toHaveText(NOT_ROOT);
  // Every positive root population of A3 reads 2 and root population.
  for (const r of A3.positive_roots) {
    await typeRow(page, 'b5', 2, r);
    await expect(smallValue(page, 'b5', 2), tuple(r)).toHaveAttribute('data-value', ROOT_VALUE);
    await expect(smallVerdict(page, 'b5', 2), tuple(r)).toHaveText(ROOT);
  }
});

test('a prediction freezes the board until answered', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  for (const label of [1, 2, 3]) await expect(node(page, 'b1', label)).toHaveAttribute('data-can-act', 'false');
  await node(page, 'b1', 2).click({ force: true });
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '0');
  await control(page, 'b1', 'predictShow').click();
  await expect(out(page, 'b1', 'predictResult')).toHaveText(`The answer is ${ROOT_VALUE}.`);
  for (const label of [1, 2, 3]) await expect(node(page, 'b1', label)).toHaveAttribute('data-can-act', 'true');
  // The choice on b5: the right option is "No".
  await hydrate(page, 'b5');
  await tool(page, 'b5').locator('[data-control="predictAnswer"]').nth(1).check();
  await control(page, 'b5', 'predictCheck').click();
  await expect(out(page, 'b5', 'predictResult')).toHaveText(/^Right/);
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M2 prose words: ${words}`);
  expect(words).toBeGreaterThanOrEqual(800);
  expect(words).toBeLessThanOrEqual(1800);
});

test('no em-dash in the built text', async ({ page }) => {
  const html = readFileSync(BUILT, 'utf8');
  expect(html.includes('—'), 'U+2014 in the built HTML').toBe(false);
  await page.goto(ROUTE);
  const text = await page.locator('main').innerText();
  expect(text.includes('—'), 'U+2014 in the text').toBe(false);
  expect(text.includes('–'), 'U+2013 in the text').toBe(false);
});

test('numbers-in-prose report for this file is empty', () => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const findings = scanSource(source, 'site/src/content/modules/m2-form.mdx');
  expect(findings.filter((f) => f.kind === 'prose')).toEqual([]);
  expect(findings.filter((f) => f.kind === 'formula')).toEqual([]);
  // The scan is not vacuous: a number added at the end of any prose line is found.
  const lines = source.split('\n');
  let probed = 0;
  for (const [k, line] of lines.entries()) {
    if (!/^[A-Z]/.test(line)) continue;
    const copy = [...lines];
    copy[k] = `${line} 987654`;
    const seen = scanSource(copy.join('\n'), 'probe').some((f) => f.kind === 'prose' && f.number === '987654');
    expect(seen, `a number on line ${k + 1} is seen by the scanner`).toBe(true);
    probed++;
  }
  expect(probed).toBeGreaterThan(12);
});

test('one view only', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id] of TOOLS) await hydrate(page, id);
  await expect(page.locator('[data-board="numbers"]')).toHaveCount(0);
  const text = norm(await page.locator('main').textContent());
  expect(text).not.toContain('is the amount by which a mutation would lower city');
  expect(text).not.toMatch(/The number on (?:node|a node)/);
  // M3's words stay out of the prose (the tools' own verdicts are not prose, and neither is the
  // closing navigation, whose "Next" link carries M3's own title once M3 is released).
  const prose = await page.locator('article').evaluate((article) => {
    const c = article.cloneNode(true) as HTMLElement;
    c.querySelectorAll('[data-tool], .katex, [data-anatomy="links"]').forEach((t) => t.remove());
    return c.textContent ?? '';
  });
  expect(prose).not.toMatch(/\b(?:affine|indefinite|frozen population|spectral|one-way)\b/i);
});

test('F2 is stated with its restriction', async ({ page }) => {
  await page.goto(ROUTE);
  const seen = page.locator('[data-anatomy="seen"]');
  expect(norm(await seen.textContent())).toContain('finite type');
  // The counterexample's population sits in the same Seen statement as the restriction.
  const statements = seen.locator('[data-seen-statement]');
  const n = await statements.count();
  let found = false;
  for (let k = 0; k < n; k++) {
    const s = statements.nth(k);
    const words = norm(await s.textContent());
    if (!/finite type/.test(words)) continue;
    if ((await texOf(s)).includes(`(${COUNTEREXAMPLE.join(',')})`)) {
      found = true;
      expect(words).toMatch(/restriction to finite type is needed/);
      expect(words).toMatch(/not a root population/);
      expect(await s.locator('a.cite').count()).toBeGreaterThan(0);
      expect(words).toMatch(/verified by computation/);
    }
  }
  expect(found, 'a Seen statement names finite type and the counterexample').toBe(true);
  // Beat 5 states the restriction in the prose too, beside the counterexample.
  const beat5 = page.locator('[data-beat="5"]');
  expect(norm(await beat5.textContent())).toContain('The statement is for boards of finite type only');
  expect(await texOf(beat5)).toContain(`(${COUNTEREXAMPLE.join(',')})`);
});

test('the matrix figure shows 2I minus A for A3', async ({ page }) => {
  await page.goto(ROUTE);
  const fig = page.locator('figure[data-figure="m2-matrix-a3"]');
  const alt = minus(norm(await fig.locator('[data-figure-text]').textContent()));
  for (const row of A3.cartan) expect(alt, tuple(row)).toContain(tuple(row));
  // The displayed formula holds the three rows from the golden file, through {{path}}.
  const tex = (await texOf(fig)).join(' ');
  expect(tex).toContain('2I-A');
  for (const row of A3.cartan) expect(tex, tuple(row)).toContain(`(${row.join(',')})`);
  // The roots figure: one arrow per root population of A2, with the positive ones named in the legend.
  const roots = page.locator('figure[data-figure="m2-roots-a2"]');
  await expect(roots.locator('[data-root]')).toHaveCount(A2.n_roots);
  const legend = minus(norm(await roots.locator('[data-figure-text]').textContent()));
  for (const r of A2.positive_roots) expect(legend, tuple(r)).toContain(tuple(r));
  const arrows = await roots.locator('[data-root]').evaluateAll((els) => els.map((e) => e.getAttribute('data-root')));
  const expected = [...A2.positive_roots, ...A2.positive_roots.map((r) => r.map((x) => -x))].map((r) => r.join(',')).sort();
  expect([...arrows].sort()).toEqual(expected);
  // The prose names the Kaleidoscope; since T6 was released (stage 3.2) the name is a link to it
  // (MERGE: before that, the test asserted that no such link existed).
  await expect(page.locator('a[data-tool-link="mirror"][href*="tools/mirror"]')).toHaveCount(1);
});

test('challenge: build the form on D4', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b7');
  await expect(challenge).toHaveAttribute('data-kind', 'out');
  await hydrate(page, 'b7');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // The starting weights fail, and the challenge stays unmet.
  await control(page, 'b7', 'test').click();
  await expect(out(page, 'b7', 'testVerdict')).toHaveText(FAIL);
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Equal weights everywhere pass.
  const pairs = await tool(page, 'b7').locator('[data-control="weightField"][data-weight="road"]').count();
  await testWeights(page, 'b7', [2, 2, 2, 2], Array.from({ length: pairs }, () => 2));
  await expect(out(page, 'b7', 'testVerdict')).toHaveText(PASS);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: the negative of the highest root of A3', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b8');
  await expect(challenge).toHaveAttribute('data-kind', 'reach');
  await hydrate(page, 'b8');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await expect(out(page, 'b8', 'formValue')).toHaveAttribute('data-value', ROOT_VALUE);
  const target = A3.highest_root.map((x) => String(-x));
  // City 1, city 2, city 3 (found by search; the explanation of the challenge gives the same route).
  const word = [1, 2, 3];
  for (const [k, label] of word.entries()) {
    if (k > 0) await expect(challenge.locator('[data-challenge-result]'), `after ${k} moves`).toHaveCount(0);
    await node(page, 'b8', label).click();
    await expect(tool(page, 'b8')).toHaveAttribute('data-moves', String(k + 1));
    await expect(out(page, 'b8', 'formValue')).toHaveAttribute('data-value', ROOT_VALUE);
  }
  expect(await values(page, 'b8')).toEqual(target);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: the highest root itself does not meet the goal', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b8');
  await hydrate(page, 'b8');
  for (const [k, label] of [2, 3].entries()) {
    await node(page, 'b8', label).click();
    await expect(tool(page, 'b8')).toHaveAttribute('data-moves', String(k + 1));
  }
  expect(await values(page, 'b8')).toEqual(A3.highest_root.map(String));
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
});

test('challenge: build the form on the triangle with a tail', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b9');
  await hydrate(page, 'b9');
  await expect(tool(page, 'b9').locator('button[data-node]')).toHaveCount(COUNTEREXAMPLE.length);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await control(page, 'b9', 'test').click();
  await expect(out(page, 'b9', 'testVerdict')).toHaveText(FAIL);
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // One unequal weight still fails.
  const pairs = await tool(page, 'b9').locator('[data-control="weightField"][data-weight="road"]').count();
  await testWeights(page, 'b9', [2, 2, 2, 2, 2], Array.from({ length: pairs }, (_, k) => (k === 0 ? 1 : 2)));
  await expect(out(page, 'b9', 'testVerdict')).toHaveText(FAIL);
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await testWeights(page, 'b9', [2, 2, 2, 2, 2], Array.from({ length: pairs }, () => 2));
  await expect(out(page, 'b9', 'testVerdict')).toHaveText(PASS);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('anatomy', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('The form behind the game');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('Is anything conserved when a city mutates?');
  await expect(article.locator('[data-anatomy="draft"]'), 'draft mark (D17)').toHaveCount(1);
  await expect(article.locator('[data-anatomy="beat"]')).toHaveCount(5);
  await expect(article.locator('[data-anatomy="seen"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="lie-theory"]')).toHaveCount(1);
  expect(await article.locator('[data-challenge]').count()).toBeGreaterThanOrEqual(3);
  await expect(article.locator('[data-anatomy="links"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="sources"]')).toHaveCount(1);
  const order = await article.evaluate((el) => {
    const q = (s: string): Element | null => el.querySelector(s);
    const seq = [
      q('[data-anatomy="title"]'),
      q('[data-anatomy="question"]'),
      q('[data-anatomy="draft"]'),
      q('[data-beat="1"]'),
      q('[data-tool][data-instance="b1"]'),
      q('[data-beat="2"]'),
      q('[data-beat="3"]'),
      q('[data-beat="4"]'),
      q('[data-beat="5"]'),
      q('[data-anatomy="seen"]'),
      q('[data-anatomy="lie-theory"]'),
      q('[data-challenge]'),
      q('[data-anatomy="links"]'),
      q('[data-anatomy="sources"]'),
    ];
    if (seq.some((x) => x === null)) return 'missing';
    for (let k = 1; k < seq.length; k++) {
      if ((seq[k - 1]!.compareDocumentPosition(seq[k]!) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) return `out of order at ${k}`;
    }
    return 'ok';
  });
  expect(order).toBe('ok');
  // Instance ids in reading order; the first tool is b1; b4 is reserved.
  const ids = await page.locator('[data-tool]').evaluateAll((els) => els.map((e) => e.getAttribute('data-instance')));
  expect(ids).toEqual(TOOLS.map(([id]) => id));
  // "What we have seen" carries its provenance, and so does each of its statements.
  const seen = article.locator('[data-anatomy="seen"]');
  expect(await seen.locator('[data-provenance]').count()).toBeGreaterThanOrEqual(1);
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBeGreaterThanOrEqual(4);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation/.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  // The links block: the sandbox with A3 when the sandbox is released (ModuleLinks leaves it out otherwise).
  const links = article.locator('[data-anatomy="links"]');
  const sandbox = links.locator('a[data-link="sandbox"]');
  if ((await sandbox.count()) > 0) await expect(sandbox).toHaveAttribute('href', /tools\/sandbox\/\?g=A3$/);
  for (const key of ['W20', 'W03a']) await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`)).toHaveCount(1);
  // The Lie theory paragraph names the standard terms and states the convention of C.
  const lie = article.locator('[data-anatomy="lie-theory"]');
  const lieText = norm(await lie.innerText());
  expect(lieText).toContain('Tits form');
  expect(lieText).toContain('Killing form');
  expect(lieText).toMatch(/Bourbaki prints its transpose/);
  expect(await texOf(lie)).toContain('C_{ij}=\\langle\\alpha_i^\\vee,\\alpha_j\\rangle');
});

test('writing rules that can be checked mechanically', async ({ page }) => {
  await page.goto(ROUTE);
  const text = norm(await page.locator('article').innerText());
  // The mutation game is credited to Wildberger (8.4).
  expect(text).toMatch(/mutation game, N\. J\. Wildberger['’]s game/);
  // The standard names appear only in the Lie theory paragraph (8.4).
  const outside = await page.locator('article').evaluate((article) => {
    const c = article.cloneNode(true) as HTMLElement;
    c.querySelectorAll('[data-anatomy="lie-theory"], [data-anatomy="sources"], [data-tool], .katex, script, style').forEach((t) => t.remove());
    return c.textContent ?? '';
  });
  expect(outside).not.toMatch(/Tits form|Killing form|bilinear form/);
  // City throughout, never node and city in one sentence (P8): the prose says no "node".
  expect(outside).not.toMatch(/\bnodes?\b/i);
  // The beat-1 sum runs over joined pairs, each pair once (decisions/P2-A8.md).
  const beat1 = await texOf(page.locator('[data-beat="1"]'));
  expect(beat1.some((t) => t.includes('\\text{joinedpairs}'))).toBe(true);
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  // Eight tools and three challenges.
  expect(islands.length).toBe(TOOLS.length + 3);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T01GameBoard/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id] of TOOLS) await hydrate(page, id);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});
