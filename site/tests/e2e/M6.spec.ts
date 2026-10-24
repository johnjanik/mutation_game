// P4-A5: lesson M6, "Multiple edges: B, C, F, G and folding", against the built site (SPEC.md 3 M6,
// 2.1, 2.2, 2.4, 2.5, 2.8, 2.10, 2.13, 8.2, 8.4, 8.5, 9.2, 4.0, 7.3, 7.4, 7.6, Appendix F;
// build-plan/agents/P4-A5-lesson-m6.md 5.15). Run after `npm run build` against `astro preview`, one
// Playwright run at a time. The pattern is that of M5.spec.ts. Every expected number with a golden value
// is read from reference/golden_data.json; positions along a play are computed here with the engine.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("board", "garden", "form", "symbolic", "fold"),
//     data-instance (b1 to b14), data-moves, data-hydrated="true"; data-out caption, noscript
//   node buttons (P0-A5 Board): data-node, data-board ("populations", "numbers"), data-value, data-can-act;
//     data-road-style on the roads of a board (P1-A3 Roads.svelte)
//   T1, registry site/src/tools/registry/T01.ts: roundCounter, scriptCaption, formValue, lengths,
//     predictResult; data-control next, predictAnswer, predictCheck, predictShow; data-view (linked check)
//   T2, registry site/src/tools/registry/T02.ts: found, total, stopMessage, layersGrown, vertex;
//     data-control showTotal
//   T3, registry site/src/tools/registry/T03.ts (T03_OUTS): testVerdict, meterNote; data-control weightField
//     (data-weight, data-weight-index), test, picker (absent on b13, which follows b11); data-table-value;
//     data-board-name and data-part (the part a preset brings to the front comes first)
//   T7, registry site/src/tools/registry/T07.ts (T07_OUTS): firedForms (li data-form), rootRow
//     (data-root, data-used)
//   T11, registry site/src/tools/registry/T11.ts (T11_OUTS): big-board, folded-board, folded-name
//     (data-name), folded-name-note, averaged-name (data-name), orbits (li data-orbit,
//     data-folded-label), construction; data-control picker, tab (data-tab), predictShow
//   Predict (P1-A5 Predict.svelte): data-prediction, .question, details, .answer-text
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title, question,
//     draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance; data-challenge,
//     data-met, data-challenge-result (text "Goal reached."); data-source; data-link;
//     data-unverified and a.unverified-mark (P0-A4 Unverified)
//   this lesson's own markup: #wildberger-names with data-table ("names", "misprints"), data-name-row,
//     data-misprint, data-warning-line; data-figure="roots-compared" with data-row and data-differs
//     (each root of B2 in the row of its own coroot); data-seen-statement
//
// Golden values are read from reference/golden_data.json, never typed, except the literals that
// build-plan/agents/P4-A5-lesson-m6.md 5.15 names (the names B2, G2, F4, B3, C3 of test 8 and the row
// text and misprint tokens of test 6), which are pinned beside the value read so that a change of the
// golden file shows here.
//
// No linked view of T1 is placed on this page, so the bridge sentence of 2.4(a) is not repeated; the
// test "no linked view" checks that this stays true (instruction 5.15 item 13).
//
// Word-counting rule (as M5.spec.ts): the words of the <article> after removing every tool root
// ([data-tool]), every <details>, every live or status region, the draft mark and the list of sources
// entries; each KaTeX formula counts as one word; a word is a run of non-space characters. The static
// tables of beats 4 and 7 are counted.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { boardFromName, fire, mutate, symbolicPlay, toPositions } from '../../../packages/engine/src/index';
import type { Board, Game } from '../../../packages/engine/src/index';
import { discoverRoutes, distDir } from './routes';

const ROUTE = 'modules/m6-multiple-edges/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m6-multiple-edges.mdx', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m6-multiple-edges/index.html`;

/** New items of Appendix E proposed by this lesson (equal to proposedUnverifiedItems of the report). */
const PROPOSED_ITEMS: string[] = [];

type Kind = 'board' | 'garden' | 'form' | 'symbolic' | 'fold';
/** The tool instances of the seven beats and the four challenges, in reading order. */
const TOOLS: [string, Kind][] = [
  ['b1', 'board'],
  ['b2', 'garden'],
  ['b3', 'board'],
  ['b4', 'board'],
  ['b5', 'form'],
  ['b6', 'symbolic'],
  ['b7', 'fold'],
  ['b8', 'fold'],
  ['b9', 'fold'],
  ['b10', 'fold'],
  ['b11', 'board'],
  ['b12', 'board'],
  ['b13', 'form'],
  ['b14', 'fold'],
];
/** The figures of the beats (beat 7's figure is the static box, checked on its own). */
const BEAT_OF: Record<string, number> = { b1: 1, b2: 1, b3: 2, b4: 2, b5: 3, b6: 4, b7: 5, b8: 5, b9: 5, b10: 6 };

interface TypeRecord {
  cartan: number[][];
  n_roots: number;
  n_positive_roots: number;
  positive_roots: number[][];
  highest_root: number[];
  highest_short_root?: number[];
  n_long_positive?: number;
  n_short_positive?: number;
  symmetrizer: number[];
  long_to_short_ratio?: number;
  highest_root_of_reversed_board: number[];
  longest_word: number[];
  adjacency: number[][];
}
interface FoldingRow {
  type: string;
  symmetry: number[];
  folds_to: string | null;
  averaged_roots_type: string;
  folded_orbits_in_bourbaki_order: number[][] | null;
}
interface Golden {
  types: Record<string, TypeRecord>;
  folding: FoldingRow[];
  wildberger_lists: {
    names: Record<string, string>;
    misprints_in_paper_and_manuscript: Record<string, [string[], string[]]>;
    misprints_in_manuscript_only: Record<string, [string[], string[]]>;
  };
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const T = (name: string): TypeRecord => GOLDEN.types[name]!;
const fold = (type: string, symmetry: number[]): FoldingRow => {
  const hits = GOLDEN.folding.filter((r) => r.type === type && r.symmetry.join(',') === symmetry.join(','));
  if (hits.length !== 1) throw new Error(`${hits.length} folding rows for ${type} ${symmetry.join(',')}`);
  return hits[0]!;
};
const A3F = fold('A3', [3, 2, 1]);
const A5F = fold('A5', [5, 4, 3, 2, 1]);
const A4F = fold('A4', [4, 3, 2, 1]);
const D4R = fold('D4', [3, 2, 4, 1]);
const D4S = fold('D4', [1, 2, 4, 3]);
const E6F = fold('E6', [6, 2, 5, 4, 3, 1]);
const MP = GOLDEN.wildberger_lists.misprints_in_paper_and_manuscript;
const MM = GOLDEN.wildberger_lists.misprints_in_manuscript_only;

/** The invariant form (p, p) = p^T D C p of SPEC 2.5, from the golden Cartan matrix and symmetrizer. */
function formValue(name: string, p: readonly number[]): number {
  const { cartan, symmetrizer } = T(name);
  return p.reduce((s, pi, i) => s + pi * symmetrizer[i]! * p.reduce((t, pj, j) => t + cartan[i]![j]! * pj, 0), 0);
}
/** The coroot of a root in the simple coroots: coordinates b_i d_i / ((beta, beta) / 2) (SPEC 2.5, Coroots). */
function corootOf(name: string, root: readonly number[]): number[] {
  const half = formValue(name, root) / 2;
  return root.map((b, i) => (b * T(name).symmetrizer[i]!) / half);
}
/**
 * The coefficients of a linear form written in TeX as x_1, 2x_1+x_2 and so on, in the order of the
 * board's labels (sorted). The index of x_k is the place of the label k in that list, never k - 1:
 * labels are converted only through the board (E-7), and an affine board starts at label 0.
 */
function coefficients(tex: string, name: string): number[] {
  const labels = [...boardFromName(name).labels].sort((a, b) => a - b);
  const out: number[] = new Array(labels.length).fill(0);
  for (const m of tex.replace(/\s+/g, '').matchAll(/(\d*)x_\{?(\d+)\}?/g)) {
    const k = labels.indexOf(Number(m[2]));
    if (k < 0) throw new Error(`x_${m[2]} is not a node of ${name} (labels ${labels.join(', ')})`);
    out[k] = m[1] === '' ? 1 : Number(m[1]);
  }
  return out;
}
/** Small counts as words, for captions that state a count in words. */
const NUMBER_WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

// ---------------------------------------------------------------------------------------------
// The engine, for positions with no golden value
// ---------------------------------------------------------------------------------------------

/** Plays a word of labels from a start in label order and returns every position, in label order. */
function along(name: string, game: Game, start: readonly number[], word: readonly number[]): number[][] {
  const board = boardFromName(name) as Board<number>;
  const order = toPositions(board, [...board.labels].sort((a, b) => a - b));
  const v: number[] = new Array(board.n);
  order.forEach((p, k) => (v[p] = start[k]!));
  const show = (x: number[]): number[] => order.map((p) => x[p]!);
  const out = [show(v)];
  let cur = v;
  for (const label of word) {
    const p = toPositions(board, [label])[0]!;
    cur = game === 'mutation' ? mutate(board, cur, p) : fire(board, cur, p);
    out.push(show(cur));
  }
  return out;
}
const alternation = (n: number): number[] => Array.from({ length: n }, (_, k) => (k % 2) + 1);
const text = (v: readonly number[]): string[] => v.map(String);

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const node = (page: Page, id: string, board: 'populations' | 'numbers', label: number): Locator =>
  tool(page, id).locator(`button[data-board="${board}"][data-node="${label}"]`).first();
const foldNode = (page: Page, id: string, which: 'big-board' | 'folded-board', label: number): Locator =>
  out(page, id, which).locator(`button[data-node="${label}"]`);
const weightField = (page: Page, id: string, kind: 'city' | 'road', index: number): Locator =>
  tool(page, id).locator(`[data-control="weightField"][data-weight="${kind}"][data-weight-index="${index}"]`);
/** Types city and road weights into a T3 builder and presses Test. */
async function testWeights(page: Page, id: string, city: readonly number[], road: readonly number[]): Promise<void> {
  for (const [k, w] of city.entries()) await weightField(page, id, 'city', k).fill(String(w));
  for (const [k, w] of road.entries()) await weightField(page, id, 'road', k).fill(String(w));
  for (const [k, w] of city.entries()) await expect(weightField(page, id, 'city', k)).toHaveValue(String(w));
  for (const [k, w] of road.entries()) await expect(weightField(page, id, 'road', k)).toHaveValue(String(w));
  await control(page, id, 'test').click();
}
/** The weights that pass on a board of rank two by SPEC 4 T3: w_i = 2 d_i and w_12 = 2 d_1 A_21, from the golden file. */
function passingWeights(name: string): { city: number[]; road: number[] } {
  const d = T(name).symmetrizer;
  return { city: d.map((x) => 2 * x), road: [2 * d[0]! * T(name).adjacency[1]![0]!] };
}
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
/** <G> output: grouping spaces U+202F and true minus signs U+2212 normalised away. */
const plain = (s: string | null): string => norm((s ?? '').replace(/\u202f/g, '').replace(/\u2212/g, '-'));
const tuple = (v: readonly number[]): string => `(${v.join(', ')})`;

/** The values shown on one board of a tool, in label order, with ASCII minus signs. */
async function values(scope: Locator, board?: string): Promise<string[]> {
  const sel = board === undefined ? 'button[data-node]' : `button[data-board="${board}"][data-node]`;
  return scope.locator(sel).evaluateAll((els) =>
    els
      .map((e) => [Number(e.getAttribute('data-node')), (e.getAttribute('data-value') ?? '').replace(/−/g, '-')] as const)
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

/** The text of a part of the page with tools removed and every formula replaced by its TeX source. */
async function proseText(page: Page, scope: string): Promise<string> {
  return page.locator(scope).first().evaluate((root) => {
    const copy = root.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) {
      const tex = k.querySelector('annotation')?.textContent ?? '';
      k.replaceWith(document.createTextNode(tex));
    }
    for (const el of copy.querySelectorAll('[data-tool], [role="status"], [aria-live], script, style, noscript')) el.remove();
    for (const el of copy.querySelectorAll('p, li, td, th, h1, h2, h3, figcaption')) el.append(document.createTextNode(' '));
    return (copy.textContent ?? '').replace(/[\u2018\u2019]/g, "'");
  });
}
const sentences = (t: string): string[] => norm(t).split(/(?<=[.!?])\s+/);

// ---------------------------------------------------------------------------------------------
// Without JavaScript
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the seven figures are present', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tool]')).toHaveCount(TOOLS.length);
    for (const [id, kind] of TOOLS) {
      const root = tool(page, id);
      await expect(root, id).toHaveCount(1);
      await expect(root, id).toHaveAttribute('data-tool', kind);
      await expect(root.locator('svg').first(), `${id} draws its figure`).toBeAttached();
      expect(norm(await out(page, id, 'caption').textContent()), `${id} caption`).not.toBe('');
      await expect(out(page, id, 'noscript'), `${id} noscript line`).toHaveText('Interactive when scripts are allowed.');
      const enabled = await root.locator('button, input, select, textarea').evaluateAll((els) => els.filter((e) => !e.matches(':disabled')).length);
      expect(enabled, `${id} controls disabled`).toBe(0);
    }
    for (const [id, beat] of Object.entries(BEAT_OF)) {
      await expect(page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] [data-tool][data-instance="${id}"]`), id).toHaveCount(1);
    }
    // Beat 1: one Martian in city 1 of B2, and the garden of all root populations.
    expect(await values(tool(page, 'b1'), 'populations')).toEqual(['1', '0']);
    await expect(out(page, 'b2', 'found')).toHaveText(String(T('B2').n_roots));
    await expect(out(page, 'b2', 'vertex')).toHaveCount(T('B2').n_roots);
    // Beat 2: the two scripted boards at their starts, with the round counter.
    expect(await values(tool(page, 'b3'), 'populations')).toEqual(['2', '1']);
    expect(await values(tool(page, 'b4'), 'populations')).toEqual(['1', '2']);
    await expect(out(page, 'b3', 'roundCounter')).toHaveText('Round 0');
    // Beat 4: the finished symbolic game on B2 and the static table beside it.
    await expect(tool(page, 'b6').locator('[data-out="rootRow"][data-used="true"]')).toHaveCount(T('B2').n_positive_roots);
    const table = page.locator('[data-beat="4"] [data-figure="roots-compared"]');
    await expect(table.locator('tbody tr')).toHaveCount(T('B2').n_positive_roots);
    await expect(table.locator('figcaption')).not.toHaveText('');
    // Beats 5 and 6: the names of the folded boards and of the averaged roots, at build time.
    await expect(out(page, 'b7', 'folded-name')).toHaveAttribute('data-name', A3F.folds_to!);
    await expect(out(page, 'b8', 'folded-name')).toHaveAttribute('data-name', D4R.folds_to!);
    await expect(out(page, 'b9', 'folded-name')).toHaveAttribute('data-name', E6F.folds_to!);
    await expect(out(page, 'b10', 'averaged-name')).toHaveAttribute('data-name', A5F.averaged_roots_type);
    // Beat 7: the static box with both tables.
    const box = page.locator('[data-beat="7"] #wildberger-names');
    await expect(box).toHaveCount(1);
    await expect(box.locator('table[data-table="names"] tbody tr')).toHaveCount(7);
    await expect(box.locator('table[data-table="misprints"] tbody tr')).toHaveCount(7);
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('every prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    const g2Back = along('G2', 'mutation', [1, 2], alternation(8)).at(-1)!.join(',') === '1,2';
    const expected: Record<string, string> = {
      b1: String(along('B2', 'mutation', [1, 0], [2]).at(-1)![1]),
      b4: g2Back ? 'Yes, after 4 rounds' : 'No',
      b7: String(along('A3', 'firing', [1, 1, 1], [1, 3]).at(-1)![1]),
    };
    expect(expected.b1).toBe(String(T('B2').highest_root[1]));
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

test('a prediction freezes the board until answered', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  for (const label of [1, 2]) await expect(node(page, 'b1', 'populations', label)).toHaveAttribute('data-can-act', 'false');
  await node(page, 'b1', 'populations', 2).click({ force: true });
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '0');
  await control(page, 'b1', 'predictAnswer').fill(String(T('B2').highest_root[1]));
  await control(page, 'b1', 'predictCheck').click();
  await expect(out(page, 'b1', 'predictResult')).toHaveText(/^Right/);
  for (const label of [1, 2]) await expect(node(page, 'b1', 'populations', label)).toHaveAttribute('data-can-act', 'true');
  await node(page, 'b1', 'populations', 2).click();
  expect(await values(tool(page, 'b1'), 'populations')).toEqual(text(T('B2').highest_root));
  // Beat 2: Next waits for the answer on G2.
  await hydrate(page, 'b4');
  await expect(control(page, 'b4', 'next')).toBeDisabled();
  await control(page, 'b4', 'predictShow').click();
  await expect(control(page, 'b4', 'next')).toBeEnabled();
  // Beat 5: the Folding Bench waits too.
  await hydrate(page, 'b7');
  for (const label of [1, 2, 3]) await expect(foldNode(page, 'b7', 'big-board', label)).toHaveAttribute('data-can-act', 'false');
  await control(page, 'b7', 'predictShow').click();
  for (const label of [1, 2, 3]) await expect(foldNode(page, 'b7', 'big-board', label)).toHaveAttribute('data-can-act', 'true');
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M6 prose words: ${words}`);
  expect(words).toBeGreaterThanOrEqual(800);
  expect(words).toBeLessThanOrEqual(1800);
  // The budget of the wave 4.5 polish (decisions/P4-A5.md): at most 1748 words, the length of the page
  // before the wave 4.4 polish, counted with the links block as it now stands (sandbox and M7). The
  // Atlas line adds five words to that block when the Atlas is released (phase 6).
  expect(words, 'the budget of 1748 words').toBeLessThanOrEqual(1748);
});

test('no em-dash in the built text', async ({ page }) => {
  const html = readFileSync(BUILT, 'utf8');
  expect(html.includes('\u2014'), 'U+2014 in the built HTML').toBe(false);
  const source = readFileSync(LESSON_PATH, 'utf8');
  expect(source.includes('\u2014'), 'U+2014 in the lesson source').toBe(false);
  expect(source.includes('\u2013'), 'U+2013 in the lesson source').toBe(false);
  await page.goto(ROUTE);
  const t = await page.locator('main').innerText();
  expect(t.includes('\u2014'), 'U+2014 in the text').toBe(false);
  expect(t.includes('\u2013'), 'U+2013 in the text').toBe(false);
});

test('numbers-in-prose report is empty apart from the allowed list', () => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const findings = scanSource(source, 'site/src/content/modules/m6-multiple-edges.mdx');
  // Both sections empty: every typed digit is in <Tex>, a property or a brace string (decisions/P4-A5.md).
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

test('the warning box on names is present', async ({ page }) => {
  await page.goto(ROUTE);
  const box = page.locator('#wildberger-names');
  await expect(box).toHaveCount(1);
  await expect(box.locator('h2')).toHaveText(/Warning/);
  const t = norm(await proseText(page, '#wildberger-names'));
  expect(t).toContain('This site uses Bourbaki');
  expect(t).toContain('So for rank at least 3 the letters B and C are exchanged relative to Bourbaki');
  expect(t).toContain(GOLDEN.wildberger_lists.names.B3!);
  expect(GOLDEN.wildberger_lists.names.B3).toBe('C3 with the node order reversed');
  // The names table: every row of the first table of 2.10.
  const rows = box.locator('table[data-table="names"] tbody tr');
  const rowText = async (sel: string): Promise<string> => norm(await proseText(page, `#wildberger-names ${sel}`));
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-name-row')))).toEqual(['B2C2', 'Bn', 'Cn', 'F4', 'G2', 'Dn', 'En']);
  expect(await rowText('[data-name-row="B2C2"]')).toContain(`${GOLDEN.wildberger_lists.names.B2}, ${GOLDEN.wildberger_lists.names.C2} with the same numbering`);
  expect(await rowText('[data-name-row="Bn"]')).toMatch(/B_n.*two roads from vertex 1 to vertex 2.*C_n with the node order reversed \(his vertex k is node n\+1-k\)/);
  expect(await rowText('[data-name-row="Cn"]')).toMatch(/C_n.*two roads from vertex 2 to vertex 1.*B_n with the node order reversed/);
  expect(await rowText('[data-name-row="F4"]')).toContain('highest root printed as 2432');
  expect(await rowText('[data-name-row="F4"]')).toContain(`${GOLDEN.wildberger_lists.names.F4}; his vertices 3, 4 are long`);
  expect(await rowText('[data-name-row="G2"]')).toContain(`${GOLDEN.wildberger_lists.names.G2}, same numbering (vertex 1 short)`);
  expect(await rowText('[data-name-row="Dn"]')).toMatch(/with vertex 0 joined to vertex 2.*his vertex k equal to node n-k and his 0 equal to node n/);
  expect(await rowText('[data-name-row="En"]')).toMatch(/with vertex 0 joined to vertex 3.*equal to nodes 1,3,4,\\dots and his 0 equal to node 2/);
  // The applet and the package (2.10, Appendix F).
  const applet = await rowText('[data-warning-line="applet"]');
  expect(applet).toContain('with an extra vertex 0 joined to vertex 2 or 3');
  expect(applet).toContain("states that it follows Wildberger's convention for B and C, but its B_3 is Bourbaki's B_3");
  // The misprints table: every row of the second table of 2.10, tokens from the golden file.
  const mis = box.locator('table[data-table="misprints"] tbody tr');
  expect(await mis.evaluateAll((els) => els.map((e) => e.getAttribute('data-misprint')))).toEqual(['C4', 'G2', 'example', 'A4', 'D5', 'E6', 'E6-diagram']);
  const cells = async (key: string): Promise<string[]> =>
    page.locator(`#wildberger-names [data-misprint="${key}"] td`).evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
  expect(MP.C4).toEqual([['1211'], ['2211']]);
  expect(MP.G2).toEqual([['12'], ['21']]);
  for (const [key, pair, where] of [
    ['C4', MP.C4!, 'both texts'],
    ['G2', MP.G2!, 'both texts'],
    ['A4', MM.A4!, 'manuscript only'],
    ['D5', MM.D5!, 'manuscript only'],
    ['E6', MM.E6!, 'manuscript only'],
  ] as const) {
    const [w, printed, should] = await cells(key);
    expect(w, key).toContain(where);
    expect(printed!.startsWith(pair[0].join(', ')), `${key} printed`).toBe(true);
    expect(should!.startsWith(pair[1].join(', ')), `${key} should read`).toBe(true);
  }
  expect(await rowText('[data-misprint="example"]')).toMatch(/\\beta_\{41\}=60 and the term -60p_4p_1 .*\\beta_\{42\} and -60p_4p_2: the fourth edge joins x_4 to x_2, and only the corrected form is invariant/);
  expect(await rowText('[data-misprint="D5"]')).toContain('each printed twice');
  expect(await rowText('[data-misprint="D5"]')).toContain('in place of the first copies');
  expect(await rowText('[data-misprint="E6-diagram"]')).toMatch(/vertex 0 drawn above vertex 2 .*above vertex 3, as the root lists on the same page require/);
  const prov = await rowText('[data-warning-line="provenance"]');
  expect(prov).toContain('The paper corrects the A_4, D_5, E_6 lists');
  expect(prov).toContain('Verified by computation');
  expect(prov).toContain('page image');
});

test('beat 2 returns to the start after 4 and 6 rounds', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id, name, start, moves, rounds] of [
    ['b3', 'B2', [2, 1], 8, 4],
    ['b4', 'G2', [1, 2], 12, 6],
  ] as const) {
    await hydrate(page, id);
    if (id === 'b4') await control(page, id, 'predictShow').click();
    const expected = along(name, 'mutation', start, alternation(moves));
    for (let k = 1; k <= moves; k++) {
      await control(page, id, 'next').click();
      await expect(tool(page, id)).toHaveAttribute('data-moves', String(k));
      expect(await values(tool(page, id), 'populations'), `${name} after ${k} moves`).toEqual(text(expected[k]!));
      // Every move changes the board and the start comes back only at the end.
      expect(expected[k]!.join(',') === start.join(','), `${name} back at the start after ${k} moves`).toBe(k === moves);
      await expect(out(page, id, 'roundCounter')).toHaveText(`Round ${Math.floor(k / 2)}`);
    }
    expect(await values(tool(page, id), 'populations')).toEqual(text(start));
    await expect(tool(page, id)).toHaveAttribute('data-moves', String(moves));
    await expect(out(page, id, 'roundCounter')).toHaveText(`Round ${rounds}`);
    await expect(control(page, id, 'next')).toBeDisabled();
    await expect(out(page, id, 'scriptCaption')).toHaveText('End of the script.');
  }
  const beat2 = norm(await proseText(page, '[data-beat="2"]'));
  expect(beat2).toContain('after eight moves');
  expect(beat2).toContain('twelve moves');
  expect(beat2).toContain('Theorem 5.1');
});

test('the folding figures name B2, G2, F4', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id, row] of [
    ['b7', A3F],
    ['b8', D4R],
    ['b9', E6F],
  ] as const) {
    await hydrate(page, id);
    await expect(out(page, id, 'construction')).toHaveText('Folding the board (orbit sums)');
    await expect(out(page, id, 'folded-name')).toHaveAttribute('data-name', row.folds_to!);
    // The folded board is drawn in Bourbaki order: folded node k is the k-th orbit of the golden row.
    const legend = await out(page, id, 'orbits')
      .locator('li[data-orbit]')
      .evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-folded-label')), e.getAttribute('data-orbit')] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]));
    expect(legend, id).toEqual(row.folded_orbits_in_bourbaki_order!.map((o) => o.join(',')));
  }
  expect([A3F.folds_to, D4R.folds_to, E6F.folds_to]).toEqual(['B2', 'G2', 'F4']);
  await expect(out(page, 'b7', 'folded-name-note')).toHaveText('B2 = C2');
  // A symmetric move on A3 gives the same numbers on the folded board.
  await control(page, 'b7', 'predictShow').click();
  await foldNode(page, 'b7', 'big-board', 1).click();
  await expect(tool(page, 'b7')).toHaveAttribute('data-moves', '1');
  expect(await values(out(page, 'b7', 'big-board'))).toEqual(text(along('A3', 'firing', [1, 1, 1], [1, 3]).at(-1)!));
  expect(await values(out(page, 'b7', 'folded-board'))).toEqual(text(along('B2', 'firing', [1, 1], [1]).at(-1)!));
  const beat5 = norm(await proseText(page, '[data-beat="5"]'));
  expect(beat5).toContain('folding the board, by orbit sums');
  for (const row of [A3F, D4R, E6F]) expect(beat5).toContain(row.folds_to!);
});

test('the A5 average tab names B3 and C3', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b10');
  expect([A5F.folds_to, A5F.averaged_roots_type]).toEqual(['B3', 'C3']);
  // The preset opens the average tab; switch to the fold tab and back by the tab control.
  await expect(tool(page, 'b10').locator('[data-tab="average"]')).toHaveAttribute('aria-selected', 'true');
  await tool(page, 'b10').locator('[data-tab="fold"]').click();
  await expect(out(page, 'b10', 'construction')).toHaveText('Folding the board (orbit sums)');
  await expect(out(page, 'b10', 'folded-name')).toHaveAttribute('data-name', A5F.folds_to!);
  await expect(out(page, 'b10', 'averaged-name')).toHaveCount(0);
  await tool(page, 'b10').locator('[data-tab="average"]').click();
  await expect(out(page, 'b10', 'construction')).toHaveText('Restricting the roots (orbit averages)');
  await expect(out(page, 'b10', 'averaged-name')).toHaveAttribute('data-name', A5F.averaged_roots_type);
  await expect(out(page, 'b10', 'folded-name')).toHaveAttribute('data-name', A5F.folds_to!);
  const beat6 = norm(await proseText(page, '[data-beat="6"]'));
  expect(beat6).toContain(`folding gives ${A5F.folds_to}, averaging ${A5F.averaged_roots_type}`);
  expect(beat6).toContain(`non-reduced system ${A4F.averaged_roots_type}`);
  expect(beat6).toContain('restricting the roots, by orbit averages');
  expect(beat6).toContain('Module nine');
  // Module nine is named, never linked by hand (it is not released).
  await expect(page.locator('[data-beat="6"] a[href*="m9"]')).toHaveCount(0);
});

test('the first figure is B2 in roads style with (1,0)', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(node(page, 'b1', 'populations', 1)).toHaveAttribute('data-value', '1');
  await expect(node(page, 'b1', 'populations', 2)).toHaveAttribute('data-value', '0');
  await expect(tool(page, 'b1').locator('button[data-node]')).toHaveCount(2);
  await expect(tool(page, 'b1').locator('button[data-board="numbers"]')).toHaveCount(0);
  const roads = tool(page, 'b1').locator('[data-road-style]');
  await expect(roads).toHaveAttribute('data-road-style', 'roads');
  const roadCount = T('B2').adjacency.flat().reduce((s, x) => s + x, 0);
  await expect(roads.locator('path')).toHaveCount(roadCount);
  // The panels show the form value of the long root population (1, 0) and the long and short nodes,
  // both from the golden Cartan matrix and symmetrizer.
  await expect(out(page, 'b1', 'formValue')).toHaveAttribute('data-value', String(formValue('B2', [1, 0])));
  const d = T('B2').symmetrizer;
  const labels = [...boardFromName('B2').labels].sort((a, b) => a - b);
  for (const [k, label] of labels.entries()) {
    await expect(out(page, 'b1', 'lengths').locator(`[data-label="${label}"]`)).toHaveAttribute('data-length', d[k] === Math.max(...d) ? 'long' : 'short');
  }
  // SPEC 8.2 item 2: the first figure has a one-sentence caption.
  const caption = norm(await out(page, 'b1', 'caption').textContent());
  expect(sentences(caption), caption).toHaveLength(1);
  expect(caption).toContain('B2');
  expect(caption).toContain(tuple(T('B2').highest_root));
  // The garden beside it: roots, explore, two layers grown, 8 found on load and no stop message.
  await expect(out(page, 'b2', 'found')).toHaveText(String(T('B2').n_roots));
  await expect(out(page, 'b2', 'stopMessage')).toHaveCount(0);
  await expect(out(page, 'b2', 'layersGrown')).toHaveCount(1);
  await hydrate(page, 'b2');
  await control(page, 'b2', 'showTotal').click();
  await expect(out(page, 'b2', 'total')).toHaveText(String(T('B2').n_roots));
  await expect(out(page, 'b2', 'found')).toHaveText(String(T('B2').n_roots));
  const positions = await out(page, 'b2', 'vertex').evaluateAll((els) => els.map((e) => (e.getAttribute('data-position') ?? '').replace(/−/g, '-')).sort());
  const roots = T('B2').positive_roots.flatMap((r) => [r.join(','), r.map((x) => -x).join(',')]).sort();
  expect(positions).toEqual(roots);
  const beat1 = plain(await proseText(page, '[data-beat="1"]'));
  expect(beat1).toContain(`finds ${T('B2').n_roots} root populations`);
  expect(beat1).toContain(`the highest being ${tuple(T('B2').highest_root)}`);
  expect(beat1).toContain(`So ${T('B2').n_long_positive} positive ones are long, ${T('B2').n_short_positive} short, and the highest short one is ${tuple(T('B2').highest_short_root!)}`);
  expect(beat1).toContain("Wildberger's rule");
});

test('beat 3: the builder on B2 passes for city weights in the ratio of the symmetrizer', async ({ page }) => {
  // SPEC 3 M6 row 3: the T3 builder on B2, passing exactly for city weights in the ratio 2:1.
  await page.goto(ROUTE);
  await hydrate(page, 'b5');
  await expect(tool(page, 'b5').locator('[data-board-name]')).toHaveAttribute('data-board-name', 'B2');
  await expect(control(page, 'b5', 'picker')).toHaveValue('B2');
  await expect(tool(page, 'b5').locator('[data-part]').first(), 'the builder preset brings the builder to the front').toHaveAttribute('data-part', 'builder');
  await expect(tool(page, 'b5').locator('button[data-board="populations"][data-node]')).toHaveCount(T('B2').cartan.length);
  // The starting weights are equal, as on A2, and fail.
  const start = await tool(page, 'b5').locator('[data-control="weightField"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(new Set(start).size, `equal starting weights ${start.join(', ')}`).toBe(1);
  await control(page, 'b5', 'test').click();
  await expect(out(page, 'b5', 'testVerdict')).toHaveAttribute('data-invariant', 'false');
  // w_i = 2 d_i and w_12 = 2 d_1 A_21 (SPEC 4 T3) from the golden symmetrizer pass, and so do half of them.
  const { city, road } = passingWeights('B2');
  await testWeights(page, 'b5', city, road);
  await expect(out(page, 'b5', 'testVerdict')).toHaveAttribute('data-invariant', 'true');
  await expect(out(page, 'b5', 'testVerdict')).toHaveText('Passes: every mutation preserves this form.');
  await testWeights(page, 'b5', city.map((w) => w / 2), road.map((w) => w / 2));
  await expect(out(page, 'b5', 'testVerdict')).toHaveAttribute('data-invariant', 'true');
  // The city weights exchanged (the ratio the other way) fail.
  await testWeights(page, 'b5', [...city].reverse(), road);
  await expect(out(page, 'b5', 'testVerdict')).toHaveAttribute('data-invariant', 'false');
  // The prose names the passing weights and the starting ones.
  const beat3 = norm(await proseText(page, '[data-beat="3"]'));
  expect(beat3).toContain([...city, ...road].join(','));
  expect(beat3).toContain(start.join(','));
});

test('balanced boards: a form with positive city weights, and the one-way remark is the site\'s', async ({ page }) => {
  // SPEC 2.5: the invariant form has positive weights d_i; Wildberger's cycle condition counts a lone
  // one-way road as balanced, which is this site's remark, not a statement of [W20] Corollary 8.5.
  await page.goto(ROUTE);
  const seen = sentences(await proseText(page, '[data-anatomy="seen"]')).filter((s) => s.includes('no mutation changes'));
  expect(seen, 'one Seen statement on invariant forms').toHaveLength(1);
  expect(seen[0]).toContain('Exactly the balanced boards have a form with positive city weights that no mutation changes');
  expect(seen[0]).toContain('[W20]');
  const beat3 = sentences(await proseText(page, '[data-beat="3"]'));
  const forms = beat3.filter((s) => s.includes('no mutation changes'));
  expect(forms).toHaveLength(1);
  expect(forms[0]).toContain('Exactly the balanced boards have a form with positive city weights that no mutation changes');
  // SPEC 2.5: on a connected board the form is the only one up to a constant ([W20] Theorems 8.4, 8.7).
  const unique = beat3.filter((s) => /\bunique\b/.test(s));
  expect(unique, 'one sentence on uniqueness').toHaveLength(1);
  expect(unique[0], 'uniqueness is stated for a connected board').toMatch(/unique up to a factor on a connected board/);
  expect(unique[0]).toMatch(/\[W20\] \(Theorems 8\.4, 8\.7\)/);
  const oneWay = beat3.filter((s) => /one-way/.test(s));
  expect(oneWay, 'one sentence on the one-way road').toHaveLength(1);
  expect(oneWay[0], 'the one-way remark carries no citation').not.toMatch(/\[W20\]|Corollary/);
  // It meets Wildberger's condition on cycles but has no positive weights, so is not balanced here.
  expect(oneWay[0]).toMatch(/lacking positive weights/);
  expect(oneWay[0]).toMatch(/balanced only in his sense/);
  const corollary = beat3.filter((s) => s.includes('Corollary 8.5'));
  expect(corollary).toHaveLength(1);
  expect(corollary[0], 'Corollary 8.5 is not cited for the one-way road').not.toMatch(/one-way/);
});

test('beat 4: the symbolic game on B2 fires the roots of the reversed board', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b6');
  const B2 = boardFromName('B2') as Board<number>;
  const forms = symbolicPlay(B2, toPositions(B2, T('B2').longest_word)).map((f) => f.join(','));
  expect(await out(page, 'b6', 'firedForms').locator('li').evaluateAll((els) => els.map((e) => e.getAttribute('data-form')))).toEqual(forms);
  const rows = await out(page, 'b6', 'rootRow').evaluateAll((els) => els.map((e) => [e.getAttribute('data-root'), e.getAttribute('data-used')] as const));
  expect(rows.map((r) => r[0]).sort()).toEqual(T('C2').positive_roots.map((r) => r.join(',')).sort());
  for (const [, used] of rows) expect(used).toBe('true');
  expect(rows.map((r) => r[0]).sort()).not.toEqual(T('B2').positive_roots.map((r) => r.join(',')).sort());
  // The static table pairs each positive root of B2 with its own coroot (SPEC 2.5, Coroots): the form
  // fired and the same coefficients as a root of C2. The coroots are the forms T7 fires.
  const table = page.locator('[data-figure="roots-compared"] tbody tr');
  await expect(table).toHaveCount(T('B2').n_positive_roots);
  const coroots: string[] = [];
  for (const [k, root] of T('B2').positive_roots.entries()) {
    const coroot = corootOf('B2', root);
    coroots.push(coroot.join(','));
    const tds = await table.nth(k).locator('td').evaluateAll((els) =>
      els.map((e) => ({ text: (e.textContent ?? '').replace(/\u202f/g, ''), tex: e.querySelector('annotation')?.textContent ?? '' })),
    );
    expect(tds[0]!.text, `row ${k}: the root`).toContain(tuple(root));
    expect(coefficients(tds[1]!.tex, 'B2'), `row ${k}: the form fired is the coroot of ${tuple(root)}`).toEqual(coroot);
    expect(tds[2]!.text, `row ${k}: the coroot as a root of C2`).toContain(tuple(coroot));
    expect(await table.nth(k).getAttribute('data-differs'), `row ${k}`).toBe(root.join() === coroot.join() ? null : 'true');
  }
  expect([...coroots].sort()).toEqual(T('C2').positive_roots.map((r) => r.join(',')).sort());
  expect([...coroots].sort()).toEqual([...forms].sort());
  // SPEC 8.2 and P1: the caption states the table's result, in one sentence: the coroots of B2 are the
  // roots of C2, and the number of rows in which a coroot differs from its root (counted here from the
  // golden roots and the coroots computed above).
  const differing = T('B2').positive_roots.filter((r) => corootOf('B2', r).join() !== r.join()).length;
  expect(differing).toBeGreaterThan(0);
  const caption = norm(await proseText(page, '[data-figure="roots-compared"] figcaption'));
  expect(sentences(caption), caption).toHaveLength(1);
  expect(caption).toContain('The coroots of B_2 are the roots of C_2');
  expect(caption).toContain(`${NUMBER_WORDS[differing]} differ from their roots`);
  const beat4 = plain(await proseText(page, '[data-beat="4"]'));
  expect(beat4).toContain('heights of coroots');
  expect(beat4).toContain(`whose highest root is ${tuple(T('B2').highest_root_of_reversed_board)} where B_2 has ${tuple(T('B2').highest_root)}`);
  expect(beat4).toContain('B_2=C_2');
  expect(beat4).toMatch(/Mozes.*Proctor's earlier use of the same process.*Eriksson's development/);
});

test('the coefficient reader places each x_k through the board labels', () => {
  // E-7: a label becomes an index only through the board. On B2 the labels are 1, 2; on the affine
  // board C2~ they are 0, 1, 2, where a reader that subtracted 1 from the label would misplace every
  // coefficient.
  expect(coefficients('2x_1+x_2', 'B2')).toEqual([2, 1]);
  expect(coefficients('x_2', 'B2')).toEqual([0, 1]);
  const labels = [...boardFromName('C2~').labels].sort((a, b) => a - b);
  expect(labels[0]).toBe(0);
  expect(coefficients(labels.map((l, k) => `${k + 1}x_${l}`).join('+'), 'C2~')).toEqual(labels.map((_, k) => k + 1));
  expect(() => coefficients('x_3', 'B2')).toThrow(/not a node of B2/);
});

test('the lesson leaves the form, the coroots and the squared lengths to the engine', () => {
  // CLAUDE.md, Rules: mathematics lives only in packages/engine, and the pages call it. The lesson reads
  // golden values and calls the engine (coroot, formValue); it writes no invariant form, coroot or
  // squared length of its own (adversarial review of wave 4.4).
  const source = readFileSync(LESSON_PATH, 'utf8');
  const exports = source.split('\n').filter((l) => l.startsWith('export const '));
  // The invariant form p^T D C p written by hand is a double sum.
  for (const l of exports) expect(l, 'a sum written in the lesson').not.toMatch(/\.reduce\(/);
  // The board's matrices are the engine's (boardFromName): the lesson reads no golden Cartan matrix or
  // adjacency to compute with.
  expect(source.match(/(?:gv|resolveGoldenPath)\('types\.\w+\.(?:cartan|adjacency)'\)/g) ?? []).toEqual([]);
  // The weights d_i are printed, never multiplied or divided: (alpha_i, alpha_i) = 2 d_i is formValue's.
  expect(source).not.toMatch(/gv\('types\.\w+\.symmetrizer'\)(?:\[\d+\])?\s*[*/]/);
  const weights = [...source.matchAll(/^export const (\w+) = gv\('types\.\w+\.symmetrizer'\);$/gm)].map((m) => m[1]!);
  for (const w of weights) {
    expect(source, `the weights ${w} in a product or a quotient`).not.toMatch(new RegExp(`[*/]\\s*${w}\\b|\\b${w}(?:\\[\\d+\\])?\\s*[*/]`));
  }
  // The coroots of the table of beat 4 come from the engine's coroot, the squared lengths of the G2
  // challenge from its formValue.
  const engineImport = /^import \{([^}]*)\} from '@engine';$/m.exec(source)?.[1] ?? '';
  expect(engineImport.split(',').map((s) => s.trim())).toEqual(expect.arrayContaining(['coroot', 'formValue']));
  const definition = (name: string): string => exports.find((l) => l.startsWith(`export const ${name} =`)) ?? '';
  expect(definition('COROOTS'), 'the coroot table').toMatch(/\bcoroot\(/);
  // The exports that rest on formValue, directly or through another export; the b13 explanation uses one.
  const names = exports.map((l) => /^export const (\w+)/.exec(l)![1]!);
  const fromForm = new Set<string>();
  for (let grown = true; grown; ) {
    grown = false;
    for (const name of names) {
      if (fromForm.has(name)) continue;
      const body = definition(name).replace(/^export const \w+ =/, '');
      if (/\bformValue\(/.test(body) || [...fromForm].some((f) => new RegExp(`\\b${f}\\b`).test(body))) {
        fromForm.add(name);
        grown = true;
      }
    }
  }
  const b13 = /<Challenge\b[^\n]*\bfor="b13"[^\n]*\bexplanation=\{`([^`]*)`\}/.exec(source)?.[1] ?? '';
  expect([...fromForm].filter((name) => new RegExp(`\\$\\{${name}\\b`).test(b13)), 'the squared lengths of the G2 challenge').not.toEqual([]);
});

test('anatomy', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('Multiple edges: B, C, F, G and folding');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('What changes when two cities are joined by more roads one way than the other?');
  await expect(article.locator('[data-anatomy="draft"]'), 'draft mark (D17)').toHaveCount(1);
  await expect(article.locator('[data-anatomy="beat"]')).toHaveCount(7);
  await expect(article.locator('[data-anatomy="seen"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="lie-theory"]')).toHaveCount(1);
  const challenges = await article.locator('[data-challenge]').count();
  expect(challenges).toBeGreaterThanOrEqual(3);
  expect(challenges).toBeLessThanOrEqual(5);
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
      q('[data-beat="6"]'),
      q('[data-beat="7"]'),
      q('#wildberger-names'),
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
  const ids = await page.locator('[data-tool]').evaluateAll((els) => els.map((e) => e.getAttribute('data-instance')));
  expect(ids).toEqual(TOOLS.map(([id]) => id));
  // "What we have seen" carries its provenance, and so does each of its statements.
  const seen = article.locator('[data-anatomy="seen"]');
  expect(await seen.locator('[data-provenance]').count()).toBeGreaterThanOrEqual(1);
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBeGreaterThanOrEqual(5);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation/i.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  // The links block offers the sandbox with B2 (the module's board) when the sandbox is released.
  const sandbox = article.locator('[data-anatomy="links"] a[data-link="sandbox"]');
  if ((await sandbox.count()) > 0) expect((await sandbox.getAttribute('href')) ?? '').toMatch(/g=B2$/);
  const source = readFileSync(LESSON_PATH, 'utf8');
  const front = /^---\n([\s\S]*?)\n---/.exec(source)![1]!;
  expect(front).toMatch(/^draft: true$/m);
  expect(front).toMatch(/^released: true$/m);
  expect(front).toMatch(/^outcomes: \["LO6"\]$/m);
  const keys = JSON.parse(/^sources:\s*(\[.*\])\s*$/m.exec(front)![1]!) as string[];
  for (const key of ['W20', 'Ste08', 'FSS96']) expect(keys, key).toContain(key);
  for (const key of keys) await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`), key).toHaveCount(1);
  for (const k of new Set([...source.matchAll(/<Cite k="([^"]+)"/g)].map((m) => m[1]!))) expect(keys, k).toContain(k);
});

test('no forbidden statement', async ({ page }) => {
  await page.goto(ROUTE);
  const all = await proseText(page, 'article');
  const list = sentences(all);
  // Appendix F: the manuscript is never dated 2003.
  expect(all).not.toMatch(/2003/);
  expect(norm(await proseText(page, '[data-anatomy="sources"]'))).toContain('unpublished and undated (circulated c. 2001 to 2004)');
  // Appendix F: positive definiteness is not special to A, D, E.
  expect(all).not.toMatch(/\bA\s*-\s*D\s*-\s*E\b|\bADE\b/);
  for (const s of list) expect(s, s).not.toMatch(/positive[- ]definite.*\b(only|exactly)\b|\b(only|exactly)\b.*positive[- ]definite/i);
  // Appendix F: a mutation (a population) never acts "on the weight lattice".
  for (const s of list.filter((x) => /weight lattice/i.test(x))) expect(s, s).not.toMatch(/mutat|population/i);
  expect(all).not.toMatch(/on the weight lattice/i);
  // Appendix F: the package's claim about B and C is reported with its correction, never as fact.
  const pkg = list.filter((x) => x.includes('mutation-game'));
  expect(pkg.length).toBeGreaterThanOrEqual(1);
  for (const s of pkg) expect(s, s).toMatch(/states that .* but its B_3 is Bourbaki's B_3/);
  expect(all).not.toMatch(/swapped relative to Bourbaki/i);
  // SOURCES.md 11.5: heights of coroots, never heights of the roots.
  expect(all).toContain('heights of coroots');
  expect(all).toContain('heights of positive coroots');
  expect(all).not.toMatch(/heights of (?:the )?(?:positive )?roots/i);
  // P8: node and city are never both used for a label in one sentence.
  for (const s of list) expect(/\bcit(?:y|ies) \d/.test(s) && /\bnodes? \d/.test(s), s).toBe(false);
  // 2.13: each construction is named where it is shown.
  expect(all).toContain('folding the board, by orbit sums');
  expect(all).toContain('restricting the roots, by orbit averages');
  // 2.5: balanced on this site means that the weights exist; Wildberger's cycle condition is named beside it.
  expect(norm(all)).toMatch(/A board with positive weights such that .+? is a balanced board/);
  expect(all).toContain("Wildberger's definition, a condition on cycles");
  expect(all).toContain('balanced only in his sense');
});

test('no linked view, so no bridge sentence to repeat', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.locator('[data-tool="board"] [data-view="linked"]')).toHaveCount(0);
  await expect(page.locator('[data-out="bridgeSentence"]')).toHaveCount(0);
  await expect(page.locator('[data-tool="board"] [data-view="populations"]')).toHaveCount(5);
});

test('unverified wraps', async ({ page }) => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const items = JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { items?: { id: string }[] } | { id: string }[];
  const known = new Set((Array.isArray(items) ? items : (items.items ?? [])).map((i) => i.id));
  const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
  expect(wraps.length).toBeGreaterThanOrEqual(1);
  for (const attrs of wraps) {
    const item = /\bitem="([^"]*)"/.exec(attrs)?.[1] ?? '';
    expect(item, attrs).toMatch(/^E\d+$/);
    expect(Number(item.slice(1)) <= 17 ? known.has(item) : PROPOSED_ITEMS.includes(item), `${item} is known or proposed`).toBe(true);
    expect((/\bfallback="([^"]*)"/.exec(attrs)?.[1] ?? '').trim(), `${item} fallback`).not.toBe('');
  }
  await page.goto(ROUTE);
  const e16 = page.locator('[data-unverified="E16"]');
  await expect(e16).toHaveCount(1);
  expect(norm(await e16.textContent())).toContain('using only part of');
  expect(norm(await proseText(page, '[data-anatomy="lie-theory"]'))).toContain('the roots of the fixed subalgebra');
  // Outside the wrap, no sentence names so(2n+1).
  const outside = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-unverified], [data-anatomy="sources"] ul, [data-tool], script, style')) el.remove();
    return copy.textContent ?? '';
  });
  expect(outside).not.toContain('so(2n+1)');
  expect(outside).not.toContain('\\mathfrak{so}');
  const marks = page.locator('article a.unverified-mark');
  expect(await marks.count()).toBe(wraps.length);
  for (const href of await marks.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))) {
    const url = new URL(href, page.url());
    expect(url.pathname).toMatch(/open-items\/?$/);
    const listing = await page.request.get(url.toString().replace(/#.*$/, ''));
    expect(listing.status(), href).toBe(200);
    expect(await listing.text(), `${url.hash} on open-items`).toMatch(new RegExp(`id="${url.hash.slice(1)}"`));
  }
});

test('the fixed-subalgebra sentence names its four patterns', async ({ page }) => {
  // SPEC 2.13: the averaged roots are the roots of the fixed subalgebra for A_{2n-1}, D_{n+1}, E_6 and
  // D_4 with its rotation ([FSS96]); for A_{2n} this fails (E16, wrapped). Beat 6 lists the patterns in
  // another order (A_{2n} third), so an ordinal such as "the first four patterns" would read wrongly
  // (repair of wave 4.3): the sentence names the four.
  await page.goto(ROUTE);
  const lie = sentences(await proseText(page, '[data-anatomy="lie-theory"]'));
  const fixed = lie.filter((s) => s.includes('the roots of the fixed subalgebra'));
  expect(fixed, 'one sentence on the fixed subalgebra outside the wrap').toHaveLength(1);
  const s = fixed[0]!;
  for (const name of ['A_{2n-1}', 'D_{n+1}', 'E_6', 'D_4']) expect(s, name).toContain(name);
  expect(s.replaceAll('A_{2n-1}', ''), 'A with an even index is not among them').not.toContain('A_{2n}');
  expect(s).not.toMatch(/\b(?:first|last|other) (?:two|three|four|five) patterns\b/i);
  expect(norm(await proseText(page, '[data-anatomy="lie-theory"]'))).not.toMatch(/\b(?:first|last) (?:two|three|four|five) patterns\b/i);
  // The A_{2n} sentence stays inside the E16 wrap.
  expect(norm(await page.locator('[data-anatomy="lie-theory"] [data-unverified="E16"]').evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
    return copy.textContent ?? '';
  }))).toContain('A_{2n}');
});

test('challenge: reach the highest root of G2 from city 2', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  const word = [1, 2];
  const steps = along('G2', 'mutation', [0, 1], word);
  expect(steps.at(-1)).toEqual(T('G2').highest_root);
  for (const [k, label] of word.entries()) {
    await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await node(page, 'b11', 'populations', label).click();
    await expect(tool(page, 'b11')).toHaveAttribute('data-moves', String(k + 1));
    expect(await values(tool(page, 'b11'), 'populations')).toEqual(text(steps[k + 1]!));
  }
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: find the four short root populations of B2', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b12');
  await hydrate(page, 'b12');
  const target = 2 * T('B2').n_short_positive!;
  const word = [1, 1, 2, 1];
  const steps = along('B2', 'mutation', [0, 1], word);
  const seen = new Set([steps[0]!.join(',')]);
  for (const [k, label] of word.entries()) {
    expect(seen.size).toBeLessThan(target);
    await page.waitForTimeout(200);
    await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await node(page, 'b12', 'populations', label).click();
    await expect(tool(page, 'b12')).toHaveAttribute('data-moves', String(k + 1));
    seen.add(steps[k + 1]!.join(','));
  }
  expect(seen.size).toBe(target);
  // The populations met are the short root populations and their negatives: the least form value,
  // 2 min d_i, with the form B = DC of SPEC 2.5 from the golden Cartan matrix and symmetrizer.
  const shortValue = 2 * Math.min(...T('B2').symmetrizer);
  const shorts = T('B2').positive_roots.filter((r) => formValue('B2', r) === shortValue);
  expect(shorts).toHaveLength(T('B2').n_short_positive!);
  expect([...seen].sort()).toEqual(shorts.flatMap((r) => [r.join(','), r.map((x) => -x).join(',')]).sort());
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: weights on G2 that the builder accepts', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b13');
  await hydrate(page, 'b13');
  const field = (kind: 'city' | 'road', index: number): Locator => weightField(page, 'b13', kind, index);
  const set = (city: number[], road: number[]): Promise<void> => testWeights(page, 'b13', city, road);
  // The check reads only the verdict, so the builder must stay on G2 (repair of wave 4.3: with a board
  // picker, A2 and its starting weights 1, 1, 1 passed and reported the goal). The reader can reach no
  // other board: b13 has no picker, and its meter follows b11, the G2 board of the first challenge,
  // which has none either.
  await expect(tool(page, 'b13').locator('select, [data-control="picker"]')).toHaveCount(0);
  await expect(tool(page, 'b11').locator('select, [data-control="picker"]')).toHaveCount(0);
  await expect(tool(page, 'b11').locator('button[data-board="populations"][data-node]')).toHaveCount(T('G2').cartan.length);
  // The starting weights, every weight 1, are those that pass on A2: here they fail.
  for (const k of [0, 1]) await expect(field('city', k)).toHaveValue('1');
  await expect(field('road', 0)).toHaveValue('1');
  await control(page, 'b13', 'test').click();
  await expect(out(page, 'b13', 'testVerdict')).toHaveText('Fails: some mutation changes this form.');
  await page.waitForTimeout(200);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Equal weights, as on a board with single roads, fail.
  await set([2, 2], [2]);
  await expect(out(page, 'b13', 'testVerdict')).toHaveText('Fails: some mutation changes this form.');
  await page.waitForTimeout(200);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // w_i = 2 d_i and w_12 = 2 d_1 A_21 (SPEC 4 T3) with d from the golden symmetrizer.
  const { city, road } = passingWeights('G2');
  await set(city, road);
  await expect(out(page, 'b13', 'testVerdict')).toHaveText('Passes: every mutation preserves this form.');
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  // The explanation names the same weights, the symmetrizer and the ratio of squared lengths.
  const d = T('G2').symmetrizer;
  const explanation = plain(await challenge.locator('details').textContent());
  expect(explanation).toContain(`squared length ${2 * Math.max(...d)}, ${T('G2').long_to_short_ratio} times that of the short city`);
  expect(explanation).toContain(`in the ratio ${d.join(' to ')}`);
  expect(explanation).toContain(`${city.join(', ')} and ${road.join(', ')}, or ${d.join(', ')} and ${road.map((w) => w / 2).join(', ')}`);
  // The caption's claim: the meter of b13 reads b11. After a move on b11, the table of b13 shows its population.
  await expect(out(page, 'b13', 'meterNote')).toHaveCount(1);
  await hydrate(page, 'b11');
  await node(page, 'b11', 'populations', 1).click();
  await expect(tool(page, 'b11')).toHaveAttribute('data-moves', '1');
  await expect(tool(page, 'b13').locator('[data-table-value="population"]')).toHaveText(text(along('G2', 'mutation', [0, 1], [1]).at(-1)!));
});

test('the explanation of the G2 builder challenge is written from the golden file', () => {
  // SPEC 8.4 and 7.3: a number with a golden value is never typed. In the explanation of b13 every
  // number is an expression (the symmetrizer and the ratio of squared lengths from the golden file,
  // the squared lengths, which are the city weights, from the engine's formValue); only city labels
  // are typed.
  const source = readFileSync(LESSON_PATH, 'utf8');
  const m = /<Challenge\b[^\n]*\bfor="b13"[^\n]*\bexplanation=\{`([^`]*)`\}/.exec(source);
  expect(m, 'the b13 challenge and its explanation').not.toBeNull();
  const typed = m![1]!.replace(/\$\{[^}]*\}/g, ' ').replace(/\bcity \d\b/gi, ' ');
  expect(typed.match(/\d+/g) ?? [], typed).toEqual([]);
});

test(`challenge: a board and a symmetry that fold to ${D4S.folds_to}`, async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b14');
  await hydrate(page, 'b14');
  await expect(out(page, 'b14', 'folded-name')).toHaveAttribute('data-name', A3F.folds_to!);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // D5 with its default swap folds to C4: not yet.
  await control(page, 'b14', 'picker').selectOption('D5');
  await expect(out(page, 'b14', 'folded-name')).toHaveAttribute('data-name', fold('D5', [1, 2, 3, 5, 4]).folds_to!);
  await page.waitForTimeout(200);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await control(page, 'b14', 'picker').selectOption('D4');
  await expect(out(page, 'b14', 'symmetry')).toBeAttached();
  await expect(out(page, 'b14', 'folded-name')).toHaveAttribute('data-name', D4S.folds_to!);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('static content fits a 320-pixel screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(ROUTE);
  await expect(page.locator('#wildberger-names table')).toHaveCount(2);
  await expect(page.locator('[data-figure="roots-compared"] table')).toHaveCount(1);
  const wide = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('#wildberger-names, #wildberger-names table, [data-figure="roots-compared"], [data-figure="roots-compared"] table')) {
      const h = el as HTMLElement;
      const r = h.getBoundingClientRect();
      if (h.scrollWidth > h.clientWidth || r.right > document.documentElement.clientWidth || r.left < 0) out.push(`${el.tagName}${el.id ? `#${el.id}` : ''}`);
    }
    return out;
  });
  expect(wide).toEqual([]);
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  // Fourteen tools and four challenges.
  expect(islands.length).toBe(TOOLS.length + 4);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T01GameBoard/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  // A lesson of fourteen tools takes 20 s or more to scan (M5.spec.ts, decisions/P3-A9.md).
  test.setTimeout(150_000);
  await page.goto(ROUTE);
  for (const [id] of TOOLS) await hydrate(page, id);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Regressions of the red team (phase 4 round)
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // regression: P4-RT-13-03
  test('M6 draws multiple roads as a double or triple line with an arrow and tells the primary reader how to read it', async ({ page }) => {
    // Adopted from redteam/rt13-lo6-arrow.mjs with its reading pass redteam/rt13-read.mjs (lens RT-13,
    // attacks 35 and 26). SPEC 1.3 LO6 "read a multiple edge with an arrow as long and short roots";
    // 2.1: "(2,1) and (3,1) are a double and a triple line with an arrowhead pointing from i to j, the
    // direction in which the extra roads run". The prose of M0 to M6 outside the Lie theory paragraphs
    // (each formula read as its TeX, the captions of the tools included) is searched for a sentence on
    // how a board is drawn, and among those for one that explains a double or triple line with an
    // arrow; the road styles of the M6 figures are read from the built page.
    const routes = discoverRoutes().filter((r) => /^modules\/m[0-6]-/.test(r.path));
    expect(routes.length, 'the lessons M0 to M6').toBe(7);
    const prose: { route: string; section: string; text: string }[] = [];
    for (const route of routes) {
      await page.goto(route.path);
      const blocks = await page.locator('article').evaluate((article) => {
        const tex = (el: Element): string => {
          const copy = el.cloneNode(true) as HTMLElement;
          for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(`$${k.querySelector('annotation')?.textContent ?? ''}$`));
          for (const e of copy.querySelectorAll('script, style, template, svg, .visually-hidden')) e.remove();
          return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
        };
        const out: { section: string; text: string }[] = [];
        for (const el of article.querySelectorAll('p, li, td, th, figcaption, h2, h3')) {
          if (el.closest('[data-tool]') || el.parentElement?.closest('p, li, td, th, figcaption')) continue;
          out.push({ section: el.closest('[data-anatomy="lie-theory"]') ? 'lie-theory' : 'prose', text: tex(el) });
        }
        for (const el of article.querySelectorAll('[data-tool] [data-out="caption"]')) out.push({ section: 'caption', text: tex(el) });
        return out;
      });
      for (const b of blocks) prose.push({ route: route.path, ...b });
    }
    const drawingRules = prose.filter((q) => /\bline\b.*\broad|\bdrawn\b|\barrow(head)?\b/i.test(q.text));
    const primary = drawingRules.filter((q) => q.section !== 'lie-theory' && /(double|triple|two|three) lines?|arrowhead|arrow (points|runs|gives)|line with an arrow/i.test(q.text));
    const html = readFileSync(BUILT, 'utf8');
    const styles: Record<string, string | null> = {};
    for (const id of ['b1', 'b3', 'b4', 'b11', 'b12']) {
      const i = html.indexOf(`data-instance="${id}"`);
      expect(i, id).toBeGreaterThanOrEqual(0);
      styles[id] = /data-road-style="([a-z]+)"/.exec(html.slice(i))?.[1] ?? null;
    }
    const dynkin = Object.values(styles).filter((s) => s === 'dynkin').length;
    expect(
      dynkin === 0 || primary.length > 0,
      `${dynkin} M6 figures draw a multiple road as a double or triple line with an arrow (${JSON.stringify(styles)}), and no primary-reader sentence says how to read it; the drawing sentences of M0 to M6: ${JSON.stringify(drawingRules.map((q) => `${q.route} [${q.section}] ${q.text.slice(0, 160)}`))}`,
    ).toBe(true);
    // LO6: the arrow is read as long and short. A primary-reader sentence of M6 ties the arrowhead to
    // the long and the short city.
    const lo6 = prose.filter((q) => q.route.includes('m6-') && q.section === 'prose' && /arrowhead/i.test(q.text) && /\blong\b/.test(q.text) && /\bshort\b/.test(q.text));
    expect(lo6.length, 'a sentence of M6 reads the arrowhead as long and short').toBeGreaterThan(0);
  });
});
