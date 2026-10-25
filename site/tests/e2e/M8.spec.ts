// P5-A3: lesson M8, "From games to Lie algebras", and the page not-quiver-mutation, against the built site
// (SPEC.md 2.16, 2.18, 3 M8, 4 T12, 4.0, 6.6, 7.3, 7.4, 7.6, 8.2, 8.4, 8.5, 9.2, Appendix C, D, E items 10
// and 13, F; build-plan/agents/P5-A3-lesson-m8-and-not-quiver-page.md 5.14). Run after `npm run build`
// against `astro preview`, one Playwright run at a time. The pattern is that of M7.spec.ts. Every expected
// number with a golden value is read from reference/golden_data.json or computed here in Node with the
// engine; the test types no dimension of the figure table.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("rep"), data-instance (b1 to b12), data-hydrated="true";
//     data-out caption, noscript, notice; the "Show as table" tables data-table="orbit" and "board"
//   T12, the data-out names listed in site/tests/e2e/T12.spec.ts (decisions/P5-A2.md): dimension, orbit-size,
//     minuscule (data-minuscule), explanation, all-relations, relation-verdict (data-holds), relation-left,
//     relation-right, matrix-e, matrix-f, matrix-h, move-matrix, signed-move (MatrixView: data-format,
//     data-rows, data-cols, and data-row, data-col, data-value on its cells, 1-based), string-position
//     (data-value comma-joined, data-in-orbit), string-length; data-panel; data-control picker, node,
//     relation, relation-i, relation-j, start-entry (data-entry), set-start; the string viewer's node
//     buttons data-node, data-board ("numbers"), data-value; the waiting lines of class "waiting"
//   Predict (P1-A5): data-prediction, .question, details; data-control predictAnswer, predictCheck,
//     predictShow; data-out predictResult
//   lesson anatomy (P1-A4): data-anatomy = title, question, draft, beat, figure, seen, lie-theory, links,
//     sources; data-beat; data-provenance; data-challenge, data-met, data-challenge-result; data-source;
//     data-link; data-unverified and a.unverified-mark (P0-A4 Unverified); data-golden (P0-A4 G)
//   this lesson's own markup: data-static-figure="e8-roots"; aside data-sidebar ("quivers",
//     "not-quiver"); table data-table="mutation-compared" with tr data-row; data-seen-statement;
//     data-released="false" inside beat 7 (the placeholder of phase 7, as in M7 beat 8)
//   the page's own markup: data-static-figure="smallest-illustration"; ul data-confusions with li
//     data-confusion; the same comparison table
//   T10 (the target of the link of beat 6): data-tool="geometry", data-out vertexCount, projection
//
// Word-counting rule (as M5.spec.ts to M7.spec.ts): the words of the <article> after removing every tool
// root ([data-tool]), every <details>, every live or status region, the draft mark and the list of sources
// entries; each KaTeX formula counts as one word; a word is a run of non-space characters. The static
// figure, its caption and the tables of beat 8 are counted.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import {
  CAPS,
  boardFromName,
  fire,
  fromAdjacency,
  minusculeMatrices,
  mutate,
  positiveRoots,
  raisingNodes,
  signedMoves,
  stringThrough,
  toPositions,
} from '../../../packages/engine/src/index';
import type { AnyBoard, Board, SparseMatrix } from '../../../packages/engine/src/index';
import { distDir } from './routes';

const ROUTE = 'modules/m8-lie-algebras/';
const PAGE_ROUTE = 'not-quiver-mutation/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m8-lie-algebras.mdx', import.meta.url));
const PAGE_PATH = fileURLToPath(new URL('../../src/content/pages/not-quiver-mutation.mdx', import.meta.url));
const SPEC_PATH = fileURLToPath(import.meta.url);
const FRAGMENT_PATH = fileURLToPath(new URL('../../../decisions/P5-A3.md', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const SPEC_MD = fileURLToPath(new URL('../../../SPEC.md', import.meta.url));
const SOURCES_MD = fileURLToPath(new URL('../../../SOURCES.md', import.meta.url));
const BUILT = `${distDir()}/modules/m8-lie-algebras/index.html`;
const PAGE_BUILT = `${distDir()}/not-quiver-mutation/index.html`;
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const WORKER = /engine\.worker/;

interface MinusculeRecord {
  type: string;
  node: number;
  dimension: number;
  weights_dynkin_labels: number[][] | null;
}
interface TypeRecord {
  cartan: number[][];
  n_roots: number;
  det_cartan: number;
  simply_laced: boolean;
  positive_roots: number[][];
  fundamental_orbit_sizes: number[];
  minuscule_nodes: number[];
  numbers_of_highest_root: number[];
}
interface Golden {
  types: Record<string, TypeRecord>;
  minuscule_representations: MinusculeRecord[];
  orbit_plus_zero_representations: { type: string; highest_weight: number[]; dimension: number }[];
  satake: { dynkin_type: string; real_form: string; dim_g: number; rank: number }[];
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const T = (name: string): TypeRecord => GOLDEN.types[name]!;
const MR = (type: string, node: number): MinusculeRecord => {
  const hits = GOLDEN.minuscule_representations.filter((r) => r.type === type && r.node === node);
  if (hits.length !== 1) throw new Error(`${hits.length} minuscule_representations records for ${type} node ${node}`);
  return hits[0]!;
};
const dim = (type: string, node: number): number => MR(type, node).dimension;
const wt = (type: string, node: number, k: number): number[] => MR(type, node).weights_dynkin_labels![k]!;
const E8_SPLIT = GOLDEN.satake.find((s) => s.dynkin_type === 'E8' && s.real_form === 'e8(8)')!;
/** The number of positions of the orbit of the fundamental position of a node, from the golden file. */
const orbitOf = (type: string, node: number): number => T(type).fundamental_orbit_sizes[node - 1]!;

// ---------------------------------------------------------------------------------------------
// The figures and challenge tools of the lesson (SPEC 3 M8 figure table; instruction 5.3 and 5.9)
// ---------------------------------------------------------------------------------------------

type Tool = { id: string; beat: number; board: string; node: number; start?: number[] };
/** The eight figures of beats 1 to 5 (beat 1 split into b1 and b2, decisions/P5-A3.md). */
const FIGURES: Tool[] = [
  { id: 'b1', beat: 1, board: 'A2', node: 1, start: [2, 0] },
  { id: 'b2', beat: 1, board: 'A2', node: 1, start: wt('A2', 1, 0) },
  { id: 'b3', beat: 2, board: 'A1', node: 1 },
  { id: 'b4', beat: 3, board: 'A2', node: 1 },
  { id: 'b5', beat: 4, board: 'D4', node: 1 },
  { id: 'b6', beat: 4, board: 'E6', node: 1 },
  { id: 'b7', beat: 4, board: 'E7', node: 7 },
  { id: 'b8', beat: 5, board: 'A2', node: 1 },
];
/** The tools of the four challenges, each after its challenge. */
const CHALLENGE_TOOLS: Tool[] = [
  { id: 'b9', beat: 0, board: 'A2', node: 1, start: [2, 0] },
  { id: 'b10', beat: 0, board: 'D4', node: 4 },
  { id: 'b11', beat: 0, board: 'A2', node: 2 },
  { id: 'b12', beat: 0, board: 'A3', node: 1 },
];
const TOOLS = [...FIGURES, ...CHALLENGE_TOOLS];

// The engine, for what the figures show (computed here, never typed).
const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
const A2 = B('A2');
/** The string through (2, 0) at node 1 of A2 (the viewer's start in b1; SPEC 3 M8 row 1, verify.py section 14). */
const STRING_TWO = stringThrough(A2, [2, 0], 0);
/** The prediction of b1: fire node 1, then node 2, from (2, 0). */
const AFTER_ONE = fire(A2, [2, 0], 0);
const AFTER_TWO = fire(A2, AFTER_ONE, 1);
const AFTER_TWO_LENGTH = stringThrough(A2, AFTER_TWO, 0).length;
/** The position the string challenge is met with: number 3 on node 1 (instruction 5.9, mu_i = 3). */
const MU_THREE = [3, 0];
const FOUR = stringThrough(A2, MU_THREE, 0).length;
const key = (v: readonly (number | bigint)[]): string => v.map(String).join(',');

/** The matrices of a minuscule representation, from the engine, with node k a position (E-7). */
function matrices(name: string, node: number) {
  const board = B(name);
  const m = minusculeMatrices(board, toPositions(board, [node])[0]!)!;
  return { board, ...m, signed: signedMoves(m.basis, m.E, m.F) };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool="rep"][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const stringNode = (page: Page, id: string, label: number): Locator => tool(page, id).locator(`[data-panel="string"] button[data-node="${label}"]`);
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
/** <G> and fmt output: grouping spaces U+202F and true minus signs U+2212 normalised away. */
const plain = (s: string | null): string => norm((s ?? '').replace(/\u202f/g, '').replace(/−/g, '-'));
const tuple = (v: readonly number[]): string => `(${v.join(', ')})`;

/** Scrolls a tool into view (client:visible), waits for hydration and until every piece is drawn. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  await settled(page, id);
}
/** T12 draws a pick one piece per task; a waiting piece has class "waiting", a pick in progress "building". */
async function settled(page: Page, id: string): Promise<void> {
  await expect(tool(page, id).locator('[data-table="board"]')).toBeAttached({ timeout: 30000 });
  await expect(tool(page, id).locator('.waiting, .building')).toHaveCount(0, { timeout: 30000 });
}

/** The nonzero entries of a MatrixView (grid or list) as "row,column" (0-based) to decimal text. */
async function entriesOf(view: Locator): Promise<Record<string, string>> {
  const cells = await view.locator('[data-row][data-col]').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-row')), Number(e.getAttribute('data-col')), e.getAttribute('data-value') ?? ''] as const));
  const outMap: Record<string, string> = {};
  for (const [r, c, v] of cells) if (v !== '0') outMap[`${r - 1},${c - 1}`] = v;
  return outMap;
}
const sparseText = (m: SparseMatrix): Record<string, string> => Object.fromEntries([...m.entries()].filter(([, v]) => v !== 0n).map(([k, v]) => [k, String(v)]));

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

type ChallengeProps = { for: string; goal: string; explanation: string; check: { kind: string; name?: string; equals?: string } };
/** Astro's serialised island props ([0, value] for a plain value or an object, [1, items] for an array), decoded. */
function decodeProps(value: unknown): unknown {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number') return value;
  const [kind, inner] = value as [number, unknown];
  if (kind === 1 && Array.isArray(inner)) return inner.map(decodeProps);
  if (kind === 0 && inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
    return Object.fromEntries(Object.entries(inner as Record<string, unknown>).map(([k, v]) => [k, decodeProps(v)]));
  }
  return inner;
}
async function challengeProps(page: Page): Promise<ChallengeProps[]> {
  const raw = await page.locator('astro-island[component-export="Challenge"]').evaluateAll((els) => els.map((e) => e.getAttribute('props') ?? '{}'));
  return raw.map((p) => decodeProps([0, JSON.parse(p)]) as ChallengeProps);
}

/** The prose words of an article by the counting rule at the top of this file. */
async function proseWords(page: Page): Promise<number> {
  return page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(' formula '));
    // The module links block is navigation the build adds as targets are released (SPEC 8.2 item 7), not
    // prose of the lesson; it is left out as proseText leaves it out (MERGE, on P6-A7's request: M9's
    // release added a next link and took the count past 1800).
    const drop = '[data-tool], details, [role="status"], [aria-live], [data-anatomy="draft"], [data-anatomy="sources"] ul, [data-anatomy="links"], script, style, noscript';
    for (const el of copy.querySelectorAll(drop)) el.remove();
    return (copy.textContent ?? '').split(/\s+/).filter((w) => w !== '').length;
  });
}

/**
 * The text of a part of the page with tools, challenges, the list of sources and the module links removed
 * and every formula replaced by its TeX source (or by a space with `math: false`).
 */
async function proseText(page: Page, scope: string, opts: { math?: boolean; keep?: string } = {}): Promise<string> {
  return page.locator(scope).first().evaluate(
    (root, { math, keep }) => {
      const copy = root.cloneNode(true) as HTMLElement;
      for (const k of copy.querySelectorAll('.katex')) {
        const tex = math ? (k.querySelector('annotation')?.textContent ?? '') : ' ';
        k.replaceWith(document.createTextNode(` ${tex} `));
      }
      const drop = ['[data-tool]', '[role="status"]', '[aria-live]', 'script', 'style', 'noscript', '[data-anatomy="sources"]', '[data-anatomy="links"]', '[data-challenge]', 'svg'].filter((s) => s !== keep);
      for (const el of copy.querySelectorAll(drop.join(', '))) el.remove();
      for (const el of copy.querySelectorAll('p, li, td, th, h1, h2, h3, figcaption, caption, dd, dt')) el.append(document.createTextNode(' '));
      return (copy.textContent ?? '').replace(/[‘’]/g, "'");
    },
    { math: opts.math !== false, keep: opts.keep ?? '' },
  );
}
const sentences = (t: string): string[] => norm(t).split(/(?<=[.!?])\s+/);

// ---------------------------------------------------------------------------------------------
// Without JavaScript (7.4)
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('M8 renders without JavaScript', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tool]')).toHaveCount(TOOLS.length);
    for (const { id, board, node } of TOOLS) {
      const root = tool(page, id);
      await expect(root, id).toHaveCount(1);
      expect(norm(await out(page, id, 'caption').textContent()), `${id} caption`).not.toBe('');
      await expect(out(page, id, 'noscript'), `${id} noscript line`).toHaveText('Interactive when scripts are allowed.');
      const enabled = await root.locator('button, input, select, textarea').evaluateAll((els) => els.filter((e) => !e.matches(':disabled')).length);
      expect(enabled, `${id} controls disabled`).toBe(0);
      // The table view of A-10: the orbit, with the board and the node named, and the string viewer's board.
      await expect(root.locator('table[data-table="orbit"] caption'), id).toHaveText(`The orbit of e${node} on ${board}: ${orbitOf(board, node)} positions`);
      await expect(root.locator('table[data-table="board"]'), id).toHaveCount(1);
      await expect(out(page, id, 'dimension'), id).toHaveText(String(orbitOf(board, node)));
      // The matrices are HTML tables (MatrixView) without JavaScript.
      await expect(out(page, id, 'matrix-e'), id).toHaveCount(1);
    }
    for (const { id, beat } of FIGURES) {
      await expect(page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] [data-tool][data-instance="${id}"]`), id).toHaveCount(1);
    }
    // The static figure of beat 6: an SVG with a title and a description, no island and no script.
    const figure = page.locator('[data-beat="6"] [data-anatomy="figure"] figure[data-static-figure="e8-roots"]');
    await expect(figure).toHaveCount(1);
    const svg = figure.locator('svg');
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg.locator('title')).toHaveText(`The ${T('E8').n_roots} roots of E8 in its Coxeter plane, with the zero position at the centre`);
    expect(plain(await svg.locator('desc').textContent())).toContain(`counted ${E8_SPLIT.rank} times; together they are the ${E8_SPLIT.dim_g} positions`);
    // One dot per root, then the ring at the centre and the two marks of the legend.
    await expect(svg.locator('g').first().locator('circle')).toHaveCount(T('E8').n_roots);
    await expect(figure.locator('astro-island, script')).toHaveCount(0);
    // The caption prints 240, 8 and 248 through <G> and a golden formula (never typed).
    const caption = figure.locator('figcaption');
    await expect(caption.locator('[data-golden="types.E8.n_roots"]')).toHaveText(String(T('E8').n_roots));
    await expect(caption.locator('[data-golden="satake[dynkin_type=E8;real_form=e8(8)].rank"]')).toHaveText(String(E8_SPLIT.rank));
    expect(await caption.locator('annotation').allTextContents()).toContain(`${E8_SPLIT.dim_g}=${T('E8').n_roots}+${E8_SPLIT.rank}`);
    expect(E8_SPLIT.dim_g).toBe(T('E8').n_roots + T('E8').cartan.length);
    // The comparison table of 2.16 in the second sidebar of beat 8: seven rows, three columns.
    const table = page.locator('[data-beat="8"] aside[data-sidebar="not-quiver"] table[data-table="mutation-compared"]');
    await expect(table.locator('thead tr > *')).toHaveCount(3);
    await expect(table.locator('tbody tr')).toHaveCount(7);
    for (const row of await table.locator('tbody tr').all()) await expect(row.locator('th, td')).toHaveCount(3);
    await expect(table.locator('caption')).not.toHaveText('');
    await expect(table.locator('tr[data-row="hold"] td').first()).toHaveText('the population of each city');
    await expect(table.locator('tr[data-row="changes"] td').first()).toHaveText('the population of one city');
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('predictions show a details fallback without JavaScript', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBe(2);
    const answers: Record<string, string> = { b1: String(AFTER_TWO_LENGTH), b5: String(dim('D4', 3)) };
    for (const [id, answer] of Object.entries(answers)) {
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
      const paragraphs = await details.locator('p').evaluateAll((ps) => ps.map((p) => (p.textContent ?? '').replace(/\s+/g, ' ').trim()));
      expect(paragraphs[0], `${id} answer`).toBe(answer);
      expect((paragraphs[1] ?? '').length, `${id}: the reveal`).toBeGreaterThan(40);
    }
  });

  test('not-quiver page renders without JavaScript', async ({ page }) => {
    const response = await page.goto(PAGE_ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveText('What mutation does not mean');
    const table = page.locator('article table[data-table="mutation-compared"]');
    await expect(table).toHaveCount(1);
    await expect(table.locator('caption')).not.toHaveText('');
    await expect(table.locator('thead tr > *')).toHaveCount(3);
    await expect(table.locator('thead th[scope="col"]')).toHaveText([/^Wildberger['’]s mutation$/, 'Fomin-Zelevinsky mutation']);
    await expect(table.locator('tbody tr')).toHaveCount(7);
    for (const row of await table.locator('tbody tr').all()) await expect(row.locator('th, td')).toHaveCount(3);
    await expect(table.locator('tbody th[scope="row"]')).toHaveText(['What you hold', 'What a move changes', 'The diagram', 'Rule', 'The moves generate', 'Finite when', 'What gets enumerated']);
    await expect(table.locator('tr[data-row="changes"] strong')).toHaveText('and the quiver');
    // Wildberger's column speaks of populations, the site's word (review finding 9; Appendix C, P8).
    await expect(table.locator('tr[data-row="hold"] td').first()).toHaveText('the population of each city');
    await expect(table.locator('tr[data-row="changes"] td').first()).toHaveText('the population of one city');
    // The smallest illustration: two drawings, each with a title and a description, and a caption.
    const figure = page.locator('figure[data-static-figure="smallest-illustration"]');
    await expect(figure.locator('svg[role="img"]')).toHaveCount(2);
    for (const s of await figure.locator('svg').all()) {
      expect(norm(await s.locator('title').textContent())).not.toBe('');
      expect(norm(await s.locator('desc').textContent())).not.toBe('');
    }
    // The quiver drawing has arrowheads, two arrows before and three after; the board drawing has none.
    await expect(figure.locator('svg').first().locator('line[marker-end]')).toHaveCount(5);
    await expect(figure.locator('svg').nth(1).locator('line[marker-end]')).toHaveCount(0);
    await expect(figure.locator('figcaption')).not.toHaveText('');
    await expect(page.locator('article [data-confusion]')).toHaveCount(4);
    await expect(page.locator('article [data-anatomy="sources"] [data-source]')).not.toHaveCount(0);
    for (const k of ['W20', 'BKR16', 'FZ02', 'FZ03a', 'BGP73', 'Ele16', 'Che17', 'W03a']) await expect(page.locator(`article [data-anatomy="sources"] [data-source="${k}"]`), k).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------------------------
// With JavaScript
// ---------------------------------------------------------------------------------------------

test('every figure states its expected result', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(ROUTE);
  // Beat 1, b1: the string through (2, 0) at node 1 has three positions, the middle one outside the orbit.
  await hydrate(page, 'b1');
  const line = out(page, 'b1', 'string-position');
  await expect(line).toHaveCount(STRING_TWO.length);
  expect(await line.evaluateAll((els) => els.map((e) => e.getAttribute('data-value')))).toEqual(STRING_TWO.map(key));
  expect(await line.evaluateAll((els) => els.map((e) => e.getAttribute('data-in-orbit')))).toEqual(['true', 'false', 'true']);
  expect(STRING_TWO[1]).toEqual(wt('A2', 2, 1));
  await expect(out(page, 'b1', 'string-length')).toHaveText(String(STRING_TWO.length));
  expect(plain(await out(page, 'b1', 'caption').textContent())).toContain(`has three positions, (2, 0), ${tuple(wt('A2', 2, 1))} and (-2, 2)`);
  expect(STRING_TWO.length).toBe(['one', 'two', 'three'].indexOf('three') + 1);
  // Beat 1, b2: the string through (1, 0) has two positions, both in the orbit.
  await hydrate(page, 'b2');
  const short = stringThrough(A2, wt('A2', 1, 0), 0);
  expect(short.map(key)).toEqual([key(wt('A2', 1, 0)), key(wt('A2', 1, 2))]);
  await expect(out(page, 'b2', 'string-position')).toHaveCount(short.length);
  expect(await out(page, 'b2', 'string-position').evaluateAll((els) => els.map((e) => [e.getAttribute('data-value'), e.getAttribute('data-in-orbit')]))).toEqual(short.map((v) => [key(v), 'true']));
  // Beat 2, b3: A1, H1 = diag(1, -1), F1 from the first position to the second and E1 back.
  await hydrate(page, 'b3');
  await expect(out(page, 'b3', 'dimension')).toHaveText(String(dim('A1', 1)));
  const a1 = matrices('A1', 1);
  expect(a1.basis.map(key)).toEqual(MR('A1', 1).weights_dynkin_labels!.map(key));
  expect(await entriesOf(out(page, 'b3', 'matrix-h'))).toEqual(sparseText(a1.H[0]!));
  expect(await entriesOf(out(page, 'b3', 'matrix-h'))).toEqual({ '0,0': '1', '1,1': '-1' });
  expect(await entriesOf(out(page, 'b3', 'matrix-f'))).toEqual(sparseText(a1.F[0]!));
  expect(await entriesOf(out(page, 'b3', 'matrix-e'))).toEqual(sparseText(a1.E[0]!));
  // Beat 3, b4: [E1, F1] = H1 holds with both sides shown; then [E1, F2] = 0 holds, both sides zero.
  await hydrate(page, 'b4');
  const a2 = matrices('A2', 1);
  expect(a2.basis.map(key)).toEqual(MR('A2', 1).weights_dynkin_labels!.map(key));
  await expect(out(page, 'b4', 'dimension')).toHaveText(String(dim('A2', 1)));
  await expect(out(page, 'b4', 'matrix-e')).toHaveAttribute('data-rows', String(dim('A2', 1)));
  await expect(control(page, 'b4', 'relation')).toHaveValue('ef');
  await expect(control(page, 'b4', 'relation-i')).toHaveValue('1');
  await expect(control(page, 'b4', 'relation-j')).toHaveValue('1');
  await expect(out(page, 'b4', 'relation-verdict')).toHaveAttribute('data-holds', 'true');
  expect(await entriesOf(out(page, 'b4', 'relation-left'))).toEqual(sparseText(a2.H[0]!));
  expect(await entriesOf(out(page, 'b4', 'relation-right'))).toEqual(sparseText(a2.H[0]!));
  await control(page, 'b4', 'relation-j').selectOption('2');
  await expect(out(page, 'b4', 'relation-verdict')).toHaveAttribute('data-holds', 'true');
  await expect(out(page, 'b4', 'relation-formula')).toBeVisible();
  expect(await entriesOf(out(page, 'b4', 'relation-left'))).toEqual({});
  expect(await entriesOf(out(page, 'b4', 'relation-right'))).toEqual({});
  // Beat 4, b5 to b7: D4 node 1, E6 node 1, E7 node 7; every relation holds; grids up to 27, lists above.
  for (const { id, board, node } of FIGURES.filter((f) => f.beat === 4)) {
    await hydrate(page, id);
    const d = dim(board, node);
    await expect(out(page, id, 'dimension'), id).toHaveText(String(d));
    await expect(out(page, id, 'minuscule'), id).toHaveAttribute('data-minuscule', 'true');
    await expect(out(page, id, 'all-relations'), id).toHaveText(/^All \d+ relations hold\.$/);
    await expect(out(page, id, 'relation-verdict'), id).toHaveAttribute('data-holds', 'true');
    await expect(out(page, id, 'matrix-e'), id).toHaveAttribute('data-format', d <= CAPS.matrixGridDim ? 'grid' : 'list');
    await expect(out(page, id, 'matrix-e'), id).toHaveAttribute('data-rows', String(d));
  }
  await expect(out(page, 'b6', 'matrix-e')).toHaveAttribute('data-format', 'grid');
  await expect(out(page, 'b7', 'matrix-e')).toHaveAttribute('data-format', 'list');
  expect(norm(await out(page, 'b7', 'caption').textContent())).toContain('lists of their nonzero entries');
  expect(norm(await out(page, 'b6', 'caption').textContent())).toContain('drawn as grids');
  // Beat 5, b8: the move of node 1 beside its signed version; one sign changed in each exchanged pair.
  await hydrate(page, 'b8');
  const moveShown = await entriesOf(out(page, 'b8', 'move-matrix'));
  const signedShown = await entriesOf(out(page, 'b8', 'signed-move'));
  expect(moveShown).toEqual(sparseText(a2.moves[0]!));
  expect(signedShown).toEqual(sparseText(a2.signed[0]!));
  const negated = Object.entries(signedShown).filter(([, v]) => v === '-1').map(([k]) => k);
  expect(negated).toEqual(Object.keys(sparseText(a2.F[0]!)));
  for (const [k, v] of Object.entries(moveShown)) expect(Math.abs(Number(signedShown[k])), k).toBe(Number(v));
});

test('a prediction freezes its board until answered', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  await hydrate(page, 'b1');
  await expect(control(page, 'b1', 'predictAnswer')).toBeVisible();
  for (const label of [1, 2]) await expect(stringNode(page, 'b1', label), `node ${label} frozen`).toBeDisabled();
  await expect(control(page, 'b1', 'set-start')).toBeDisabled();
  await expect(control(page, 'b1', 'picker')).toBeDisabled();
  await control(page, 'b1', 'predictAnswer').fill(String(AFTER_TWO_LENGTH));
  await control(page, 'b1', 'predictCheck').click();
  await expect(out(page, 'b1', 'predictResult')).toHaveText(`Right: ${AFTER_TWO_LENGTH}.`);
  for (const label of [1, 2]) await expect(stringNode(page, 'b1', label)).toBeEnabled();
  await stringNode(page, 'b1', 1).click();
  await stringNode(page, 'b1', 2).click();
  await expect(out(page, 'b1', 'string-length')).toHaveText(String(AFTER_TWO_LENGTH));
  await expect(out(page, 'b1', 'string-position')).toHaveCount(AFTER_TWO_LENGTH);
  await expect(out(page, 'b1', 'string-position').first()).toHaveAttribute('data-value', key(AFTER_TWO));
  // Beat 4: the node list of D4 waits too, until "show me"; then node 3 has as many positions as node 1.
  await hydrate(page, 'b5');
  await expect(control(page, 'b5', 'predictShow')).toBeVisible();
  await expect(control(page, 'b5', 'node')).toBeDisabled();
  await control(page, 'b5', 'predictShow').click();
  await expect(out(page, 'b5', 'predictResult')).toHaveText(`The answer is ${dim('D4', 3)}.`);
  await expect(control(page, 'b5', 'node')).toBeEnabled();
  await control(page, 'b5', 'node').selectOption('3');
  await settled(page, 'b5');
  await expect(out(page, 'b5', 'dimension')).toHaveText(String(dim('D4', 3)));
  await expect(out(page, 'b5', 'minuscule')).toHaveAttribute('data-minuscule', 'true');
});

test('a prediction asks about what is not yet on screen', async ({ page }) => {
  await page.goto(ROUTE);
  // Exactly these two predictions (8.1 P5; P3-RT-13-01: no answer readable before the reader commits).
  const asked = await page.locator('[data-tool]').evaluateAll((els) => els.filter((e) => e.querySelector('[data-prediction]') !== null).map((e) => e.getAttribute('data-instance')));
  expect(asked).toEqual(['b1', 'b5']);
  // b1 asks how long the string at node 1 is after two firings. The prose above names the orbit of (2, 0),
  // which holds that position, but no sentence above gives the string of that position, says which
  // position two firings reach, or says that a number 0 gives a string of one position.
  const before = await tool(page, 'b1').evaluate((el) => {
    const range = document.createRange();
    range.setStart(document.querySelector('article')!, 0);
    range.setEndBefore(el);
    const copy = range.cloneContents();
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
    for (const b of copy.querySelectorAll('p, li, h1, h2, figcaption')) b.append(document.createTextNode(' '));
    return copy.textContent ?? '';
  });
  const afterTwo = key(AFTER_TWO);
  for (const s of sentences(plain(before))) {
    const compact = s.replace(/\s/g, '');
    if (compact.includes(`(${afterTwo})`)) expect(s, s).not.toMatch(/string|fir(?:e|ing)|reach/i);
    expect(s, s).not.toMatch(/position alone|one position|number 0|is 0\b/i);
  }
  // Its figure shows the string through (2, 0) until the reader has answered.
  expect(await out(page, 'b1', 'string-position').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')))).toEqual(STRING_TWO.map(key));
  // b5 asks about node 3 of D4: no sentence of the prose above it, nor its caption, names node 3 together
  // with a number of positions (beat 4 lists node 3 among the checked minuscule nodes, without its size).
  const aboveB5 = await tool(page, 'b5').evaluate((el) => {
    const range = document.createRange();
    range.setStart(document.querySelector('article')!, 0);
    range.setEndBefore(el);
    const copy = range.cloneContents();
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
    for (const t of copy.querySelectorAll('[data-tool], script, style')) t.remove();
    for (const b of copy.querySelectorAll('p, li, h1, h2, figcaption')) b.append(document.createTextNode(' '));
    return `${copy.textContent ?? ''} ${el.querySelector('[data-out="caption"]')?.textContent ?? ''}`;
  });
  const sizeOfThree = new RegExp(`positions|dimension|\\b${dim('D4', 3)}\\b`);
  const namesThree = sentences(plain(aboveB5)).filter((s) => /node 3\b|nodes 1, 3|ω3|e3\b|e_3/.test(s));
  for (const s of namesThree) expect(s, s).not.toMatch(sizeOfThree);
  await expect(tool(page, 'b5').locator('table[data-table="orbit"] caption')).toHaveText(`The orbit of e1 on D4: ${orbitOf('D4', 1)} positions`);
});

test('no default state starts the worker', async ({ page, context }) => {
  test.setTimeout(180_000);
  const requested: string[] = [];
  await context.route(WORKER, async (r) => {
    requested.push(r.request().url());
    await r.abort();
  });
  page.on('worker', (w) => requested.push(`worker started: ${w.url()}`));
  await page.goto(ROUTE);
  for (const { id, board, node } of TOOLS) {
    await hydrate(page, id);
    await expect(out(page, id, 'dimension'), id).toHaveText(String(orbitOf(board, node)));
    await expect(out(page, id, 'all-relations'), id).toHaveText(/^All \d+ relations hold\.$/);
  }
  // The largest default, the 56 of E7, is below the cap; the server ships a digest of its relations (P5-A2
  // repair), so hydration computes no relation list.
  expect(dim('E7', 7)).toBeLessThanOrEqual(CAPS.repOrbit);
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual([]);
});

test('anatomy of 8.2', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('From games to Lie algebras');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('If a move is a whole reflection, what is half a move?');
  await expect(article.locator('[data-anatomy="draft"]'), 'draft mark (D17)').toHaveCount(1);
  await expect(article.locator('[data-anatomy="beat"]')).toHaveCount(8);
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
      q('[data-static-figure="e8-roots"]'),
      q('[data-beat="7"]'),
      q('[data-beat="8"]'),
      q('[data-sidebar="quivers"]'),
      q('[data-sidebar="not-quiver"]'),
      q('[data-anatomy="seen"]'),
      q('[data-anatomy="lie-theory"]'),
      q('[data-challenge]'),
      q('[data-anatomy="links"]'),
      q('[data-anatomy="sources"]'),
    ];
    if (seq.some((x) => x === null)) return `missing ${seq.findIndex((x) => x === null)}`;
    for (let k = 1; k < seq.length; k++) {
      if ((seq[k - 1]!.compareDocumentPosition(seq[k]!) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) return `out of order at ${k}`;
    }
    return 'ok';
  });
  expect(order).toBe('ok');
  // The first figure is the first thing drawn on the page, with its caption (8.2 item 2).
  const ids = await page.locator('[data-tool]').evaluateAll((els) => els.map((e) => e.getAttribute('data-instance')));
  expect(ids).toEqual(TOOLS.map(({ id }) => id));
  // Beat 7 is the released:false placeholder: one or two sentences, no tool, no figure, no link.
  const beat7 = article.locator('[data-beat="7"]');
  const marker = beat7.locator('[data-released="false"]');
  await expect(marker).toHaveCount(1);
  const text7 = norm(await proseText(page, '[data-beat="7"] [data-released="false"]'));
  const count7 = sentences(text7).filter((s) => s !== '').length;
  expect(count7).toBeGreaterThanOrEqual(1);
  expect(count7).toBeLessThanOrEqual(2);
  expect(plain(text7)).toContain(`the ${GOLDEN.orbit_plus_zero_representations.find((r) => r.type === 'G2')!.dimension}-dimensional representation of G_2`);
  await expect(beat7.locator('[data-tool], svg, a, [data-anatomy="figure"]')).toHaveCount(0);
  await expect(page.locator('a[href*="one-zero-weight"]')).toHaveCount(0);
  // No link to the confusions page; the sandbox loads A2, the board of the first figure (SPEC 8.2 item 7;
  // RT-FIX-P4 lesson M7). The Atlas is released in phase 6 (P6-A4): the block carries the Atlas page of A2,
  // the only Atlas link on the page (MERGE, on P6-A4's request). M9 is released in phase 6 (P6-A7): the
  // block carries exactly one next link, to M9 under the base, the only link to M9 on the page (MERGE, on
  // P6-A7's request).
  await expect(article.locator('a[href*="confusions"]')).toHaveCount(0);
  const atlasBase = new URL(page.url()).pathname.replace(/modules\/m8-lie-algebras\/$/, '');
  const nextLink = article.locator('[data-anatomy="links"] a[data-link="next"]');
  await expect(nextLink).toHaveCount(1);
  await expect(nextLink).toHaveAttribute('href', `${atlasBase}modules/m9-real-forms/`);
  await expect(article.locator('a[href*="m9"]')).toHaveCount(1);
  await expect(article.locator('a[href*="atlas/"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="links"] a[data-link="atlas"]')).toHaveAttribute('href', `${atlasBase}atlas/A2/`);
  const sandbox = article.locator('[data-anatomy="links"] a[data-link="sandbox"]');
  await expect(sandbox).toHaveCount(1);
  expect((await sandbox.getAttribute('href')) ?? '').toMatch(/tools\/sandbox\/\?g=A2$/);
  expect(FIGURES[0]!.board).toBe('A2');
  // "What we have seen" carries its provenance, and so does each of its statements.
  const seen = article.locator('[data-anatomy="seen"]');
  await expect(seen.locator('[data-provenance="verified by computation"]')).toHaveCount(1);
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBe(3);
  for (let k = 0; k < (await statements.count()); k++) {
    const t = norm(await statements.nth(k).textContent());
    expect(/verified by computation|standard fact of Lie theory/i.test(t), `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  // Statement 1 is scoped to what its provenance covers (review finding 12): the 18 records, verified by
  // computation, and the minuscule nodes of simply laced boards, Wildberger's construction.
  const first = plain(await statements.nth(0).textContent());
  expect(first).toMatch(new RegExp(`^For the ${GOLDEN.minuscule_representations.length} representations listed in beat 4, [^.]*: verified by computation\\.`));
  expect(first).toContain('At every minuscule node of a simply laced board this is Wildberger');
  expect(first).not.toMatch(/^On the orbit of the fundamental position of a minuscule node/);
  // The frontmatter of CONTRACTS 7 with the values of instruction 5.1.
  const source = readFileSync(LESSON_PATH, 'utf8');
  const front = /^---\n([\s\S]*?)\n---/.exec(source)![1]!;
  expect(front).toMatch(/^title: "From games to Lie algebras"$/m);
  expect(front).toMatch(/^draft: true$/m);
  expect(front).toMatch(/^released: true$/m);
  expect(front).toMatch(/^module: 8$/m);
  expect(front).toMatch(/^phase: 5$/m);
  expect(front).toMatch(/^outcomes: \["LO8"\]$/m);
  const keys = JSON.parse(/^sources:\s*(\[.*\])\s*$/m.exec(front)![1]!) as string[];
  for (const k of ['W03a', 'W03c', 'Gre13', 'vE', 'BGP73', 'FZ02']) expect(keys, k).toContain(k);
  for (const k of keys) await expect(article.locator(`[data-anatomy="sources"] [data-source="${k}"]`), k).toHaveCount(1);
  for (const k of new Set([...source.matchAll(/<Cite k="([^"]+)"/g)].map((m) => m[1]!))) expect(keys, k).toContain(k);
  for (const k of keys) expect(source, `[${k}] is cited in the text`).toMatch(new RegExp(`<Cite k="${k.replace('+', '\\+')}"`));
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  expect(islands.length).toBe(TOOLS.length + 4);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T12RepresentationBuilder/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
  // All tools share one T12 chunk; no T10 island on the page (beat 6 is a static figure and a link).
  expect(new Set(islands.filter((i) => /T12RepresentationBuilder/.test(i)).map((i) => /component-url="([^"]*)"/.exec(i)![1])).size).toBe(1);
  expect(html).not.toMatch(/component-url="[^"]*T10GeometryStudio/);
});

test('E10 is wrapped', async ({ page }) => {
  const items = JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { id: string; status: string }[];
  for (const id of ['E10', 'E13']) expect(items.find((i) => i.id === id)?.status, id).toBe('open');
  for (const path of [LESSON_PATH, PAGE_PATH]) {
    const source = readFileSync(path, 'utf8');
    const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
    for (const attrs of wraps) {
      expect(attrs, 'an E10 or E13 wrap').toMatch(/\bitem="E1[03]"/);
      const fallback = /\bfallback="([^"]*)"/.exec(attrs)?.[1] ?? '';
      // A fallback stays true however the item turns out: no number, no section, no word on its status.
      expect(fallback, attrs).not.toMatch(/\d|checked|unverified|open item/i);
    }
    if (path === LESSON_PATH) expect(wraps.map((a) => /\bitem="([^"]*)"/.exec(a)?.[1])).toEqual(['E10', 'E10']);
  }
  await page.goto(ROUTE);
  const wrapped = page.locator('article [data-unverified="E10"]');
  await expect(wrapped).toHaveCount(2);
  for (const w of await wrapped.all()) {
    expect(norm(await w.textContent())).toContain('Hum72');
    expect(norm(await w.textContent())).toMatch(/sections 9\.4 and 21\.3/);
  }
  // Every section number of [Hum72] sits inside a wrap (SOURCES.md 11.5 lists 9.4, 24.3, 14.3, 21.2, 21.3, 13.13).
  const outside = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-unverified], [data-anatomy="sources"] ul, [data-tool], script, style')) el.remove();
    return copy.textContent ?? '';
  });
  expect(outside).not.toMatch(/\b(?:9\.4|24\.3|14\.3|21\.2|21\.3|13\.13)\b/);
  for (const s of sentences(outside).filter((x) => x.includes('Hum72'))) expect(s, s).not.toMatch(/section|\d+\.\d+/i);
  const marks = page.locator('article a.unverified-mark');
  expect(await marks.count()).toBe(2);
  for (const href of await marks.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))) {
    const url = new URL(href, page.url());
    expect(url.pathname).toMatch(/open-items\/?$/);
    expect(url.hash).toBe('#E10');
  }
  // The page names Kostant only as "attributed to Kostant" (8.4), so it needs no E13 wrap; any other
  // sentence naming him would have to sit inside one (checked in "writing rules of 8.4").
  await page.goto(PAGE_ROUTE);
  await expect(page.locator('article [data-unverified]')).toHaveCount(0);
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M8 prose words: ${words}`);
  expect(words).toBeGreaterThanOrEqual(800);
  expect(words).toBeLessThanOrEqual(1800);
});

// The two dashes, named by their code points so that this file holds neither (D14; COMMON 4.4).
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

test('no em-dash in the built text', async ({ page }) => {
  for (const [what, path] of [
    ['the built lesson', BUILT],
    ['the built page', PAGE_BUILT],
    ['the lesson source', LESSON_PATH],
    ['the page source', PAGE_PATH],
    ['this test file', SPEC_PATH],
    ['the decisions fragment', FRAGMENT_PATH],
  ] as const) {
    const text = readFileSync(path, 'utf8');
    expect(text.includes(EM_DASH), `U+2014 in ${what}`).toBe(false);
    expect(text.includes(EN_DASH), `U+2013 in ${what}`).toBe(false);
  }
  for (const route of [ROUTE, PAGE_ROUTE]) {
    await page.goto(route);
    const t = await page.locator('main').innerText();
    expect(t.includes(EM_DASH), `U+2014 in ${route}`).toBe(false);
    expect(t.includes(EN_DASH), `U+2013 in ${route}`).toBe(false);
  }
});

// ---------------------------------------------------------------------------------------------
// Numbers (8.4, 9.2; instruction 5.8). Method (plan): every typed number of the two sources is found by
// scripts/numbers-in-prose.mjs (prose, $...$ formulas, fallbacks), or sits in a <Tex> formula (golden
// paths removed) or a brace string {'...'}. Each such occurrence must match an entry of ALLOWED: its text
// and a pattern for the words around it (the 48 characters before and after it in the source), so that a
// number typed in an allowed sense passes and the same digits in a golden sense fail. Each entry carries
// its reason (the categories of instruction 5.8) and must be used at least once.
// ---------------------------------------------------------------------------------------------

type Allowed = { text: string; around: RegExp; reason: string };
/** Names, not numbers: board names (A_2, E_8), subscripted names of a node (e_1, F_1, \omega_i). */
const NAME = /^(?:[A-H]_\d|[A-H]_\{?n\}?|[eEFHPs]_\d|\\omega_[i\d])$/;
const ALLOWED_M8: Allowed[] = [
  // Positions with no golden record (instruction 5.8, "M8, beats 1 to 6").
  { text: '(2,0)', around: /string through|orbit of|orbit holds/, reason: 'the start (2, 0) of the string of beat 1, which is not a minuscule orbit' },
  { text: '(-2,2)', around: /STRING_TWO\[1\]\)\} and <Tex src="\(-2,2\)"|holds <Tex src="\(2,0\)"\/>, <Tex src="\(-2,2\)"/, reason: 'the fired end of the string through (2, 0), in its orbit' },
  { text: '(0,-2)', around: /<Tex src="\(-2,2\)"\/> and <Tex src="\(0,-2\)"\/> only/, reason: 'the third position of the orbit of (2, 0)' },
  // The zero vector, and a matrix entry 1.
  { text: '0', around: /leave the orbit gives|every other case gives|sends it to|on node \$k\$ is|sends the others to/, reason: 'the zero vector, or the number 0 of the projection P^0' },
  { text: '1', around: /holds a single <Tex src="1"\/> in each column/, reason: 'a matrix entry of a permutation matrix' },
  // Constants of the recipe and of the formulas of 2.18 (instruction 5.8: matrix entries 0, 1, -1).
  { text: 'H_1=\\operatorname{diag}(1,-1)', around: /<Tex src="E_1"\/> sends it back/, reason: 'the diagonal entries of H1, typed as matrix entries (instruction 5.8)' },
  { text: '\\mu_k=1', around: /reaches if|exactly when/, reason: 'the condition of F_k in the recipe of 2.18' },
  { text: '\\mu_k=-1', around: /that position if/, reason: 'the condition of E_k in the recipe of 2.18' },
  { text: '-1', around: /fundamental position(?:<\/Term>)? is|raised to its number/, reason: 'a number of a minuscule orbit; the base of (-1)^H' },
  { text: '0', around: /<Tex src="-1"\/>, <Tex src="0"\/> or/, reason: 'a number of a minuscule orbit (F11)' },
  { text: '1', around: /<Tex src="0"\/> or <Tex src="1"\/>, so a string/, reason: 'a number of a minuscule orbit (F11)' },
  { text: '2', around: /size at least|contains a number/, reason: 'a number 2 in an orbit that is not minuscule (instruction 5.8)' },
  { text: '\\det C-1', around: /A connected board of finite type has/, reason: 'the count of minuscule nodes, a formula of F11' },
  { text: '[H_i,H_j]=0,\\quad [H_i,E_j]=C_{ij}E_j,\\quad [H_i,F_j]=-C_{ij}F_j,\\quad [E_i,F_j]=\\delta_{ij}H_i,', around: /display/, reason: 'the Chevalley-Serre relations of 2.18, verbatim' },
  { text: '\\operatorname{ad}(E_i)^{1-C_{ij}}E_j=0,\\qquad \\operatorname{ad}(F_i)^{1-C_{ij}}F_j=0\\quad(i\\ne j),', around: /display/, reason: 'the Serre relations of 2.18 (1 - C_ij), verbatim' },
  { text: '[E_1,F_1]=H_1', around: /both sides of/, reason: 'a relation, with the node labels 1' },
  { text: '[E_1,F_2]=0', around: /both sides of/, reason: 'a relation, with node labels 1 and 2 and the zero matrix' },
  { text: 'E_k+F_k+P_k^0', around: /it is|move of node/, reason: 'the move matrix of 2.18 (P^0, the projection on numbers 0)' },
  { text: 'P_k^0', around: /where/, reason: 'the projection of 2.18' },
  { text: '\\exp(E_k)\\exp(-F_k)\\exp(E_k)=E_k-F_k+P_k^0', around: /and here/, reason: 'the signed move of 2.18' },
  { text: 'E_k-F_k+P_k^0', around: /is <Tex/, reason: 'the signed move of 2.18' },
  { text: '(-1)^{H_k}', around: /square/, reason: 'the square of the signed move, (-1)^H of 2.18' },
  { text: '2N', around: /all <Tex/, reason: 'the comparison table of 2.16' },
  { text: '-2', around: /entries from/, reason: 'the entries of the basis of [W03c] range from -2 to 2 (8.4 credit line)' },
  { text: '2', around: /entries from <Tex src="-2"\/> to/, reason: 'the entries of the basis of [W03c] range from -2 to 2 (8.4 credit line)' },
  // Locators of the sources (instruction 5.8, "Both pages, citations").
  { text: '9.4 and 21.3', around: /Hum72"\/>, sections/, reason: 'the sections of [Hum72], inside the E10 wrap' },
  { text: 'Theorem 1.1', around: /BGP73/, reason: 'a theorem of [BGP73]' },
  { text: 'Theorem 3.1', around: /BGP73/, reason: 'a theorem of [BGP73]' },
  { text: 'Definition 4.2', around: /FZ02/, reason: 'a definition of [FZ02]' },
  { text: 'Theorems 1.4 and 1.9', around: /FZ03a/, reason: 'theorems of [FZ03a]' },
  { text: '4.1', around: /whose Theorem/, reason: 'Theorem 4.1 of [W03a], stated without proof' },
  // Node labels and beat numbers.
  { text: '1', around: /at node \{'1'\}|from node \{'1'\}|Firing node \{'1'\}/, reason: 'node label 1' },
  { text: '2', around: /node \$j\$ to \{'2'\}|Node \{'2'\} of|At node \{'2'\} of/, reason: 'node label 2' },
  { text: '7', around: /from node \{'7'\}/, reason: 'node label 7 of E7' },
  { text: '3', around: /from node \{'3'\} the orbit has/, reason: 'node label 3 of D4, in the answer of the prediction of b5 stated after it (P5-RT-13-01)' },
  { text: '3', around: /beat \{'3'\}/, reason: 'beat number' },
  { text: '4', around: /beat \{'4'\}/, reason: 'beat number' },
  { text: '7', around: /beat \{'7'\}/, reason: 'beat number' },
  // Numbers with no golden value (instruction 5.8). The 26 of F4 has one and is a <G> (P5-RT-08-02).
  { text: '2', around: /rank at least \{'2'\}/, reason: 'rank at least 2 (adjoint representations out of reach)' },
];
const ALLOWED_PAGE: Allowed[] = [
  { text: 'a_i<0', around: /unhappy when/, reason: 'the mood unhappy (2.16)' },
  { text: 'a_i=0', around: /happy when/, reason: 'the mood happy (2.16)' },
  { text: 'a_i>0', around: /excited, when/, reason: 'the mood manic or excited (2.16)' },
  // The argument for the Hasse diagram (RT-FIX P5-A3 review finding 7): the form value 2 of F2 ([W03a]
  // Proposition 3.5) and the changes of the form value when one Martian is added or removed.
  { text: '2', around: /form value <Tex src="2"\/> <Cite k="W03a"/, reason: 'the form value 2 of a root population on a simply laced board (F2)' },
  { text: 'Proposition 3.5', around: /W03a/, reason: 'a proposition of [W03a] (F2)' },
  { text: '2a_i+2', around: /adds <Tex/, reason: 'the change of the form value when one Martian is added to city i' },
  { text: 'a_i=-1', around: /exactly when <Tex/, reason: 'the number on node i of a population one Martian below another' },
  { text: '2-2a_i', around: /adds <Tex src="2-2a_i"\/> instead/, reason: 'the change of the form value when one Martian is removed from city i' },
  { text: 'p_i>0', around: /some city with/, reason: 'a city with Martians' },
  { text: 'a_i\\ge1', around: /has <Tex/, reason: 'a positive number on that node' },
  { text: 'a_i=1', around: /positive definite, <Tex/, reason: 'the number on that node, forced by positive definiteness' },
  { text: '(1,1,0)', around: /turns <Tex/, reason: 'the triangle example of 2.16' },
  { text: '(1,1,2)', around: /into <Tex/, reason: 'the triangle example of 2.16' },
  { text: '1', around: /every number fired equals|site's numbers equal to/, reason: 'the minuscule situation: every number fired is 1 (2.16; [BKR16] in this site convention)' },
  { text: '-1', around: /numbers equal to <Tex src="-1"/, reason: 'the number -1 of the convention of [BKR16]' },
  { text: 'v=1-u', around: /change of variables/, reason: 'the substitution of [BKR16] Remark 4.11' },
  { text: '2N', around: /all <Tex/, reason: 'the comparison table of 2.16' },
  { text: '1\\to2\\to3', around: /the quiver/, reason: 'the smallest illustration of 2.16 (vertex labels)' },
  { text: '3', around: /mutating city \{'3'\}/, reason: 'city label 3 of the triangle' },
  { text: '2', around: /vertex \{'2'\}|city \{'2'\}/, reason: 'vertex label 2 and city label 2' },
  { text: '1', around: /vertex \{'1'\}/, reason: 'vertex label 1' },
  { text: '3', around: /vertex \{'3'\}/, reason: 'vertex label 3' },
  { text: 'Theorem 5.1', around: /W20/, reason: 'a theorem of [W20]' },
  { text: 'Remark 4.11', around: /BKR16/, reason: 'a remark of [BKR16]' },
  { text: 'Theorem 1.1', around: /BGP73/, reason: 'a theorem of [BGP73]' },
  { text: 'Theorem 3.1', around: /BGP73/, reason: 'a theorem of [BGP73]' },
  { text: 'Definition 4.2', around: /FZ02/, reason: 'a definition of [FZ02]' },
  { text: 'Theorems 1.4 and 1.9', around: /FZ03a/, reason: 'theorems of [FZ03a]' },
  { text: 'sections 2 and 5', around: /W20/, reason: 'the sections of [W20], provenance of the fixed board (Appendix D main correction 1)' },
  { text: 'Quiver mutation at vertex 2', around: /<title/, reason: 'the title of the drawing (vertex label)' },
  { text: 'The board A3 when city 2 mutates', around: /<title/, reason: 'the title of the drawing (board name and city label)' },
  { text: 'Before: the path 1 to 2 to 3, with arrows from 1 to 2 and from 2 to 3. After: a triangle, with arrows from 2 to 1, from 3 to 2 and a new arrow from 1 to 3.', around: /<desc/, reason: 'the description of the quiver drawing (vertex labels)' },
  { text: 'Before and after: the same path of three cities, 1, 2 and 3, joined by single roads with no arrowheads. Only the population of city 2 changes.', around: /<desc/, reason: 'the description of the board drawing (city labels)' },
];

/**
 * The formula findings of scripts/numbers-in-prose.mjs (numbers inside $...$), each allowed by its number
 * and a pattern for its context (the line around it, as the script reports it).
 */
type AllowedFinding = { number: string; context: RegExp; reason: string };
const FORMULAS_M8: AllowedFinding[] = [];
const FORMULAS_PAGE: AllowedFinding[] = [];

/** Every <Tex> source (golden paths removed) and brace string of a source that holds a digit, with its index. */
function typedOccurrences(source: string): { text: string; index: number }[] {
  const found: { text: string; index: number }[] = [];
  for (const m of source.matchAll(/<Tex\b[^>]*?\bsrc="([^"]*)"/g)) {
    const tex = m[1]!.replace(/\{\{[^}]*\}\}/g, '');
    if (/\d/.test(tex) && !NAME.test(tex)) found.push({ text: tex, index: m.index! });
  }
  for (const m of source.matchAll(/\{'([^']*)'\}/g)) if (/\d/.test(m[1]!)) found.push({ text: m[1]!, index: m.index! });
  return found;
}

function checkTyped(source: string, file: string, allowed: Allowed[], formulas: AllowedFinding[]): void {
  const findings = scanSource(source, file);
  // Nothing typed in prose or in a fallback: every typed number sits in a formula, a <Tex> or a brace string.
  expect(findings.filter((f) => f.kind !== 'formula'), `${file}: numbers in prose or fallbacks`).toEqual([]);
  const usedFormulas = new Set<AllowedFinding>();
  const strayFormulas: string[] = [];
  for (const f of findings.filter((x) => x.kind === 'formula')) {
    const hit = formulas.find((a) => a.number === f.number.replace('−', '-') && a.context.test(f.context));
    if (hit) usedFormulas.add(hit);
    else strayFormulas.push(`${f.number} in ${f.context}`);
  }
  expect(strayFormulas, `${file}: numbers in $...$ outside the allowlist`).toEqual([]);
  expect(formulas.filter((a) => !usedFormulas.has(a)).map((a) => a.number), `${file}: formula entries not used`).toEqual([]);
  const used = new Set<Allowed>();
  const unexplained: string[] = [];
  for (const { text, index } of typedOccurrences(source)) {
    const around = source.slice(Math.max(0, index - 48), index + text.length + 60);
    const hit = allowed.find((a) => a.text === text && a.around.test(around));
    if (hit) used.add(hit);
    else unexplained.push(`${text} in ...${around.replace(/\s+/g, ' ')}...`);
  }
  expect(unexplained, `${file}: typed numbers outside the allowlist`).toEqual([]);
  expect(allowed.filter((a) => !used.has(a)).map((a) => a.text), `${file}: allowlist entries not used`).toEqual([]);
}

test('numbers in prose', () => {
  const lesson = readFileSync(LESSON_PATH, 'utf8');
  const pageSource = readFileSync(PAGE_PATH, 'utf8');
  checkTyped(lesson, 'site/src/content/modules/m8-lie-algebras.mdx', ALLOWED_M8, FORMULAS_M8);
  checkTyped(pageSource, 'site/src/content/pages/not-quiver-mutation.mdx', ALLOWED_PAGE, FORMULAS_PAGE);
  // The scan is not vacuous: a number added at the end of a prose line is found.
  for (const [what, source] of [['lesson', lesson], ['page', pageSource]] as const) {
    const lines = source.split('\n');
    let probed = 0;
    for (const [k, l] of lines.entries()) {
      if (!/^[A-Z]/.test(l)) continue;
      const copy = [...lines];
      copy[k] = `${l} 987654`;
      expect(scanSource(copy.join('\n'), 'probe').some((f) => f.kind === 'prose' && f.number === '987654'), `${what} line ${k + 1}`).toBe(true);
      probed++;
    }
    expect(probed, what).toBeGreaterThan(8);
  }
  // Deny list (instruction 5.14 test 9): the MDX source of M8 outside <G> attributes and {{path}} types none
  // of these golden values or positions.
  const outsideGolden = lesson.replace(/<G\b[^>]*\/>/g, ' ').replace(/\{\{[^}]*\}\}/g, ' ').replace(/^export .*$/gm, ' ');
  const deny: [RegExp, string][] = [
    [/3\s*(?:×|\\times)\s*3/, 'a typed size 3 by 3'],
    [/\b(2|3|6|8|27|56) by \1\b/, 'a typed matrix size'],
    [/\(\s*1\s*,\s*0\s*\)|\(\s*0\s*,\s*-\s*1\s*\)|\(\s*-\s*1\s*,\s*1\s*\)|\(\s*0\s*,\s*1\s*\)|\(\s*[−-]1\s*,\s*1\s*\)|\(\s*0\s*,\s*[−-]1\s*\)/, 'a golden position of A2 typed'],
    [/\(\s*[−-]?1\s*\)(?!\^)/, 'a golden position of A1 typed (the formula (-1)^H is not one)'],
    [/\b8 zeros\b|\b240 roots\b|\b248-dimensional\b|\b248\b|\b240\b/, 'the counts of E8'],
    [/\b(?:27|56|24)\b(?!\.)/, 'a dimension or orbit size of the figure table'],
    [/\b6\b(?:\s*(?:×|by|positions))/, 'the dimension of A3 node 2'],
  ];
  for (const [re, what] of deny) expect(outsideGolden, what).not.toMatch(re);
  // "two positions" and "three positions" only where they are lengths of strings (beat 1, b1, b2, the
  // remark that a string of a minuscule orbit has at most two positions, and the goal of the string challenge).
  for (const m of outsideGolden.matchAll(/\b(?:two|three|four) positions\b/g)) {
    const around = outsideGolden.slice(Math.max(0, m.index! - 70), m.index! + 20);
    expect(around, `"${m[0]}" is a length of a string`).toMatch(/string|has (?:two|three)|at most two|whose string/);
  }
});

/**
 * The literal text the lesson source gives to the captions, questions, reveals, goals and explanations of
 * its tools and challenges (string and template literals, with every ${...} interpolation removed), by
 * instance id and property.
 */
function literalTexts(source: string): { where: string; text: string }[] {
  const found: { where: string; text: string }[] = [];
  for (const tag of source.matchAll(/<(T12RepresentationBuilder|Challenge)\b[\s\S]*?\/>/g)) {
    const t = tag[0];
    const id = /\b(?:id|for)="(b\d+)"/.exec(t)?.[1] ?? '?';
    const props = [
      ...[...t.matchAll(/\b(caption|goal|explanation)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]),
      ...[...t.matchAll(/\b(caption|goal|explanation)=\{`([^`]*)`\}/g)].map((m) => [m[1]!, m[2]!]),
      ...[...t.matchAll(/\b(question|reveal): '([^']*)'/g)].map((m) => [m[1]!, m[2]!]),
      ...[...t.matchAll(/\b(question|reveal): `([^`]*)`/g)].map((m) => [m[1]!, m[2]!]),
    ];
    for (const [prop, text] of props) found.push({ where: `${id} ${prop}`, text: text.replace(/\$\{[^}]*\}/g, ' ') });
  }
  return found;
}

/**
 * What a literal may type besides names, labels and the positions of beat 1 (instruction 5.8): matrix
 * entries 1 and -1 (b3), the number 0 on node 1 after two firings (b1 reveal), mu_i = 3 and the numbers 2,
 * 0, -2 of the orbit of (2, 0) (string challenge), the number 2 in the orbit of node 2 of D4 (D4 challenge).
 */
const LITERAL_ALLOWED: Record<string, string[]> = {
  'b3 caption': ['1', '-1'],
  'b1 reveal': ['0'],
  'b9 explanation': ['3', '2', '0', '-2'],
  'b10 explanation': ['2'],
};
/** Names and labels: board names, names with a node label, node labels, beat numbers, columns, relations. */
function withoutNamesAndLabels(text: string): string {
  return text
    .replace(/−/g, '-')
    .replace(/\[E1, F[12]\] = (?:H1|0)/g, ' ')
    .replace(/\b[A-H]\d\b/g, ' ')
    .replace(/(?<![\w])(?:[eEFH]\d|ω\d)(?![\w])/g, ' ')
    .replace(/\b[Nn]odes? \d+(?:(?:,| and) \d+)*/g, ' ')
    .replace(/\bbeat \d\b/g, ' ')
    .replace(/\bnode [ij] is \d\b/g, ' ')
    .replace(/\bcolumn \d of C\b/g, ' ');
}

test('numbers typed in captions, questions, reveals, goals and explanations', () => {
  const texts = literalTexts(readFileSync(LESSON_PATH, 'utf8'));
  // Every caption of the twelve tools, both predictions and the four challenges are read.
  expect(texts.filter((t) => t.where.endsWith('caption')).length).toBe(TOOLS.length - CHALLENGE_TOOLS.filter((c) => c.id !== 'b9').length);
  expect(texts.filter((t) => /question|reveal/.test(t.where)).length).toBe(4);
  expect(texts.filter((t) => /goal|explanation/.test(t.where)).length).toBe(2 * CHALLENGE_TOOLS.length);
  const typedTuples = new Set(['2,0', '-2,2', '0,-2']);
  const unexplained: string[] = [];
  for (const { where, text } of texts) {
    const rest = withoutNamesAndLabels(text).replace(/\(([^()]*\d[^()]*)\)/g, (m, inner: string) => {
      if (!typedTuples.has(inner.replace(/\s+/g, ''))) unexplained.push(`${where}: ${m}`);
      return ' ';
    });
    for (const v of rest.match(/-?\d+/g) ?? []) if (!(LITERAL_ALLOWED[where] ?? []).includes(v)) unexplained.push(`${where}: ${v} in ${text}`);
  }
  expect(unexplained).toEqual([]);
});

test('numbers in captions, questions, reveals, goals and explanations are golden or allowed', async ({ page }) => {
  await page.goto(ROUTE);
  const texts: { where: string; board: string; text: string }[] = [];
  for (const { id, board } of TOOLS) {
    texts.push({ where: `${id} caption`, board, text: norm(await out(page, id, 'caption').textContent()) });
    const block = tool(page, id).locator('[data-prediction]');
    if ((await block.count()) > 0) {
      texts.push({ where: `${id} question`, board, text: norm(await block.locator('.question').textContent()) });
      texts.push({ where: `${id} reveal`, board, text: norm(await block.locator('details p').nth(1).textContent()) });
    }
  }
  const challenges = await challengeProps(page);
  const boardOf = new Map(TOOLS.map((t) => [t.id, t.board]));
  for (const c of challenges) {
    texts.push({ where: `${c.for} goal`, board: boardOf.get(c.for)!, text: c.goal });
    texts.push({ where: `${c.for} explanation`, board: boardOf.get(c.for)!, text: c.explanation });
  }
  // The golden values a text may print: dimensions and positions of the minuscule records, the orbit sizes
  // of the fundamental positions, for every board; the positions of the string of beat 1 (no golden
  // record, instruction 5.8).
  const goldenNumbers = new Set<number>([...GOLDEN.minuscule_representations.map((r) => r.dimension), ...Object.values(GOLDEN.types).flatMap((t) => t.fundamental_orbit_sizes)]);
  const goldenTuples = new Set<string>(GOLDEN.minuscule_representations.flatMap((r) => (r.weights_dynkin_labels ?? []).map((w) => w.join(','))));
  const typedTuples = new Set(['2,0', '-2,2', '0,-2', ...[AFTER_ONE, AFTER_TWO].map(key)]);
  // Typed numbers allowed in these texts, with the reason (instruction 5.8): matrix entries 1 and -1 (b3),
  // the number 0 on node 1 after two firings (b1 reveal), mu_i = 3 and the numbers 2, 0, -2 of the orbit
  // of (2, 0) (string challenge), the number 2 in the orbit of D4 node 2 (D4 challenge).
  const allowed: Record<string, string[]> = {
    'b3 caption': ['1', '-1'],
    'b1 reveal': ['0'],
    'b9 explanation': ['3', '2', '0', '-2'],
    'b10 explanation': ['2'],
  };
  // The challenge tools carry T12's own caption, which follows the state so that the checks can read the
  // board and node; it prints the number of Chevalley-Serre relation instances the engine checks, 6n^2 - 2n
  // on a board of rank n (as T12.spec.ts counts them), computed, not typed.
  for (const { id, board } of CHALLENGE_TOOLS) {
    const n = T(board).cartan.length;
    (allowed[`${id} caption`] ??= []).push(String(6 * n * n - 2 * n));
  }
  const unexplained: string[] = [];
  for (const { where, text } of texts) {
    let rest = text.replace(/(?<=\d)\u202f(?=\d)/g, '').replace(/−/g, '-');
    // Board names, node labels (node 1, nodes 1, 3 and 4, e1, ω1, E1, F2, H1), beat numbers, sentence-level names.
    // The relations of beat 3 by name ([E1, F2] = 0 holds the zero matrix), then board names, names with a
    // node label (e1, ω1, E1, F2, H1), node labels (node 1, nodes 1, 3 and 4), beat numbers and columns.
    rest = rest.replace(/\[E1, F[12]\] = (?:H1|0)/g, ' ');
    rest = rest.replace(/\b[A-H]\d\b/g, ' ').replace(/(?<![\w])(?:[eEFH]\d|ω\d)(?![\w])/g, ' ').replace(/\b[Nn]odes? \d+(?:(?:,| and) \d+)*/g, ' ').replace(/\bbeat \d\b/g, ' ').replace(/\bnode [ij] is \d\b/g, ' ').replace(/\bcolumn \d of C\b/g, ' ');
    rest = rest.replace(/\(([^()]*\d[^()]*)\)/g, (m, inner: string) => {
      const k = inner.replace(/\s+/g, '');
      if (goldenTuples.has(k) || typedTuples.has(k)) return ' ';
      unexplained.push(`${where}: ${m}`);
      return ' ';
    });
    for (const v of rest.match(/-?\d+/g) ?? []) if (!goldenNumbers.has(Number(v)) && !(allowed[where] ?? []).includes(v)) unexplained.push(`${where}: ${v} in ${text}`);
  }
  expect(unexplained).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// The two pages together
// ---------------------------------------------------------------------------------------------

test('at least two predictions and three challenges', async ({ page }) => {
  await page.goto(ROUTE);
  expect(await page.locator('[data-tool] [data-prediction]').count()).toBeGreaterThanOrEqual(2);
  const challenges = page.locator('[data-challenge]');
  expect(await challenges.count()).toBeGreaterThanOrEqual(3);
  for (let k = 0; k < (await challenges.count()); k++) {
    await expect(challenges.nth(k).locator('.goal')).not.toHaveText('');
    await expect(challenges.nth(k).locator('details')).toHaveCount(1);
  }
  const props = await challengeProps(page);
  expect(props.map((c) => c.for)).toEqual(CHALLENGE_TOOLS.map(({ id }) => id));
});

test('challenges report success on their goal and not before', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(ROUTE);
  const props = await challengeProps(page);
  // b9: a string with four positions, by typing a position whose number on node 1 is 3.
  const strings = await challengeFor(page, 'b9');
  await hydrate(page, 'b9');
  await expect(strings.locator('[data-challenge-result]')).toHaveCount(0);
  for (const [k, v] of MU_THREE.entries()) await control(page, 'b9', 'start-entry').and(tool(page, 'b9').locator(`[data-entry="${k + 1}"]`)).fill(String(v));
  await control(page, 'b9', 'set-start').click();
  await expect(out(page, 'b9', 'string-length')).toHaveText(String(FOUR));
  await expect(strings.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  // b10, b11, b12: a node of a board, reached with the tool's pickers; met only there. The wrong steps are
  // the tempting ones: for b10 a failing node of another board (D4 node 2) and a failing node of E6 with a
  // larger orbit (node 3); for b11 the minuscule node that beat 4 lists (node 5) and a failing node (node 2).
  const cases: { id: string; board: string; node: number; steps: { board?: string; node?: number }[] }[] = [
    { id: 'b10', board: 'E6', node: 2, steps: [{ node: 2 }, { board: 'E6' }, { node: 3 }, { node: 2 }] },
    { id: 'b11', board: 'D5', node: 4, steps: [{ board: 'D5' }, { node: 5 }, { node: 2 }, { node: 4 }] },
    { id: 'b12', board: 'A3', node: 2, steps: [{ node: 3 }, { node: 2 }] },
  ];
  for (const c of cases) {
    const challenge = await challengeFor(page, c.id);
    await hydrate(page, c.id);
    const check = props.find((p) => p.for === c.id)!.check;
    expect(check.kind, c.id).toBe('out');
    expect(check.name, c.id).toBe('caption');
    // The check reads the caption, which names the board and the node: the goal's board is the one read.
    expect(check.equals, c.id).toMatch(new RegExp(`^On ${c.board}[ ,]`));
    expect(check.equals, c.id).toMatch(new RegExp(`node ${c.node}\\b|\\be${c.node}\\b`));
    expect(props.find((p) => p.for === c.id)!.goal, c.id).toContain(c.board);
    for (const [k, step] of c.steps.entries()) {
      await expect(challenge.locator('[data-challenge-result]'), `${c.id} before step ${k + 1}`).toHaveCount(0);
      if (step.board) await control(page, c.id, 'picker').selectOption(step.board);
      if (step.node) await control(page, c.id, 'node').selectOption(String(step.node));
      await settled(page, c.id);
    }
    await expect(tool(page, c.id).locator('table[data-table="orbit"] caption')).toHaveText(`The orbit of e${c.node} on ${c.board}: ${orbitOf(c.board, c.node)} positions`);
    await expect(out(page, c.id, 'orbit-size')).toHaveText(String(orbitOf(c.board, c.node)));
    await expect(challenge.locator('[data-challenge-result]'), c.id).toHaveText('Goal reached.', { timeout: 20000 });
  }
  // The E6 node: not minuscule, a failing relation, and the smallest orbit among the failing nodes of E6;
  // the D5 node minuscule and not one of the 18 records listed in beat 4 (golden file).
  await expect(out(page, 'b10', 'minuscule')).toHaveAttribute('data-minuscule', 'false');
  await expect(out(page, 'b10', 'explanation')).toContainText('some number in the orbit is 2');
  const failingE6 = T('E6').fundamental_orbit_sizes.map((size, k) => ({ node: k + 1, size })).filter(({ node }) => !T('E6').minuscule_nodes.includes(node));
  expect(failingE6.map(({ node }) => node)).toContain(2);
  for (const { node, size } of failingE6) if (node !== 2) expect(size, `E6 node ${node}`).toBeGreaterThan(orbitOf('E6', 2));
  await expect(out(page, 'b11', 'minuscule')).toHaveAttribute('data-minuscule', 'true');
  expect(T('D5').minuscule_nodes).toContain(4);
  expect(GOLDEN.minuscule_representations.filter((r) => r.type === 'D5').map((r) => r.node)).not.toContain(4);
  expect(dim('A3', 2)).toBeGreaterThan(orbitOf('A3', 1));
  expect(orbitOf('A3', 3)).toBe(orbitOf('A3', 1));
  // The explanation of b10 says what fails (review finding 10): firing a number 2 moves a position by two
  // single steps, so no single step is that firing.
  const b10 = props.find((p) => p.for === 'b10')!.explanation;
  expect(b10).toContain('moves a position by two steps, which no single step gives');
  expect(b10).not.toMatch(/a single step there is no firing/);
});

/**
 * The answers of the challenges are not printed in the prose (review finding 10; RT-FIX-P3-lesson-m5).
 * The prose is the article with tools, challenges, the sources and the links removed, formulas as TeX.
 */
function nodesNamed(text: string, tex: string): Set<number> {
  const esc = tex.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  const found = new Set<number>();
  for (const m of text.matchAll(new RegExp(`\\b[Nn]odes? ((?:\\d+, )*\\d+(?: and \\d+)?) of ${esc}(?!\\w)`, 'g'))) for (const l of m[1]!.split(/, | and /)) found.add(Number(l));
  for (const m of text.matchAll(new RegExp(`${esc} from node (\\d+)`, 'g'))) found.add(Number(m[1]));
  return found;
}

test('the prose does not print the answers of the challenges', async ({ page }) => {
  await page.goto(ROUTE);
  const prose = norm(await proseText(page, 'article'));
  // Not vacuous: the list of beat 4 names nodes 1 and 6 of E6, node 2 of D4 is named, and so on.
  expect([...nodesNamed(prose, 'E_6')].sort()).toEqual([1, 6]);
  expect(nodesNamed(prose, 'D_4').has(2)).toBe(true);
  const props = await challengeProps(page);
  for (const c of props.filter((p) => p.check.kind === 'out' && p.check.name === 'caption')) {
    const target = /^On ([A-H]\d)[ ,][^]*?(?:node (\d+)|\be(\d+))/.exec(c.check.equals ?? '');
    expect(target, c.for).not.toBeNull();
    const board = target![1]!;
    const node = Number(target![2] ?? target![3]);
    const tex = `${board[0]}_${board.slice(1)}`;
    if (c.for === 'b12') {
      // The list of beat 4 names node 2 of A3 as checked, but no sentence compares the sizes of the nodes
      // of A3, which is what the challenge asks.
      for (const s of sentences(prose).filter((x) => x.includes(tex))) expect(s, s).not.toMatch(/largest|positions|dimension|matri/i);
      continue;
    }
    expect([...nodesNamed(prose, tex)], `${c.for}: node ${node} of ${board} is named in the prose`).not.toContain(node);
  }
});

test('not-quiver page makes no reference to the project note', async ({ page }) => {
  for (const route of [PAGE_ROUTE, ROUTE]) {
    await page.goto(route);
    const t = (await page.locator('main').textContent()) ?? '';
    expect(t, route).not.toMatch(/algebraic data/i);
    expect(t, route).not.toMatch(/project note/i);
    expect(t, route).not.toMatch(/mutation-game|Cortis|\bnote\b/i);
  }
  for (const path of [LESSON_PATH, PAGE_PATH]) expect(readFileSync(path, 'utf8')).not.toMatch(/algebraic data|project note/i);
});

// ---------------------------------------------------------------------------------------------
// Hypotheses, provenance and words (the findings of the P5 stage 5.3 review of P5-A3, one assertion or
// more for each; each fails on the text the review read)
// ---------------------------------------------------------------------------------------------

test('the corrections of the page are introduced as corrections', async ({ page }) => {
  // Finding 1: the bold headlines of the list are the correct statements, so the list is introduced as
  // a list of corrections, not as a list of wrong statements.
  await page.goto(PAGE_ROUTE);
  const intro = norm(await page.locator('article ul[data-confusions]').evaluate((el) => el.previousElementSibling?.textContent ?? ''));
  expect(intro).toBe('Each item below corrects a statement about the mutation game that is sometimes made.');
  expect(intro).not.toMatch(/wrong/i);
  for (const headline of await page.locator('article [data-confusion] > strong').allTextContents()) expect(headline, headline).not.toMatch(/\?$/);
});

test('the two meanings of arrow are kept apart', async ({ page }) => {
  // Finding 2 (2.16; 2.1): a line between joined nodes is one road each way, so a quiver keeps one road of
  // each line; an arrowhead sits on a double or triple line, never on a road.
  for (const route of [ROUTE, PAGE_ROUTE]) {
    await page.goto(route);
    const scope = route === ROUTE ? 'aside[data-sidebar="quivers"]' : 'article';
    const list = sentences(await proseText(page, scope));
    for (const s of list) expect(s, `${route}: ${s}`).not.toMatch(/\beach road\b[^.]*\bdirection|\bdirection\b[^.]*\beach road\b/i);
    for (const s of list) expect(s, `${route}: ${s}`).not.toMatch(/\b(?:double|triple) road\b/i);
    const defining = list.filter((s) => /the result is a quiver/.test(s));
    expect(defining, route).toHaveLength(1);
    // (The sentence follows a heading, which has no full stop, so it is read as a substring.)
    expect(defining[0]).toContain('Keep one of the two roads of each line of a simply laced board (choose a direction for each line), and the result is a quiver');
  }
  await page.goto(ROUTE);
  expect(norm(await proseText(page, 'aside[data-sidebar="quivers"]'))).toContain('An arrowhead on a double or triple line of this site says something else');
});

test('statements of M8 carry their hypotheses and their provenance', async ({ page }) => {
  await page.goto(ROUTE);
  const list = sentences(await proseText(page, 'article'));
  // Finding 3 (F11): the count det C - 1 is a fact about connected boards of finite type, with its range.
  const count = list.filter((s) => s.includes('\\det C-1'));
  expect(count).toHaveLength(1);
  expect(count[0]).toMatch(/^A connected board of finite type has \\det C-1 minuscule nodes, verified by computation for every such board of rank at most eight\.$/);
  // Finding 4 (2.18): the move matrix E + F + P0 is a statement about a minuscule orbit.
  const beat5 = sentences(await proseText(page, '[data-beat="5"]'));
  expect(beat5[0]).toMatch(/^On a minuscule orbit, firing node k permutes the positions, so its matrix/);
  // Finding 5 ([BGP73] Theorem 1.1): the hypothesis of the reflection functor.
  const functor = list.filter((s) => /changes exactly as the population of a city changes/.test(s));
  expect(functor).toHaveLength(1);
  expect(functor[0]).toMatch(/^For an indecomposable representation (?:of the quiver )?other than the simple one at that vertex/);
  // Finding 11: the site shows the positions of one such representation, those of E8 in the figure; no
  // sentence says that the site shows the positions of the 26 of F4 or of every adjoint representation.
  const beat6 = sentences(await proseText(page, '[data-beat="6"]'));
  for (const s of beat6) expect(s, s).not.toMatch(/site shows/i);
  expect(beat6).toContain('The figure draws these positions.');
  expect(beat6.findIndex((s) => s === 'The figure draws these positions.') - 1).toBe(beat6.findIndex((s) => /on its own Lie algebra, of dimension/.test(s)));
  // Finding 12 (1): a statement that a representation of E8 is the smallest is marked as standard.
  const smallest = list.filter((s) => /smallest (?:nontrivial )?representation/.test(s));
  expect(smallest.length).toBeGreaterThanOrEqual(2);
  for (const s of smallest) expect(s, s).toMatch(/standard fact/);
  // The text alternative of the figure claims nothing more than the beat.
  expect(norm(await page.locator('[data-static-figure="e8-roots"] svg desc').textContent())).not.toMatch(/smallest/);
  // Finding 12 (3): the run of a string consists of the positions of the representation, not of every
  // point of the lattice on that line (beat 1 and the third statement of "What we have seen").
  const runs = list.filter((s) => /unbroken run/.test(s));
  expect(runs).toHaveLength(2);
  for (const s of runs) expect(s, s).toMatch(/its positions on the line through one of them, \\?mu ?, in the direction of \\alpha_i form an unbroken run/);
});

test('statements of the page carry their hypotheses and their provenance', async ({ page }) => {
  await page.goto(PAGE_ROUTE);
  const text = await proseText(page, 'article');
  const list = sentences(text);
  // Finding 5 ([BGP73] Theorem 1.1), as on M8.
  const functor = list.filter((s) => /changes exactly as the population of a city changes/.test(s));
  expect(functor).toHaveLength(1);
  expect(functor[0]).toMatch(/^For an indecomposable representation of the quiver other than the simple one at that vertex, which has dimension one there and zero elsewhere,/);
  // Finding 6 (2.9 row [BKR16]): a sign and a transpose.
  const bkr = list.filter((s) => /fires negative numbers/.test(s));
  expect(bkr).toHaveLength(1);
  expect(bkr[0]).toMatch(/writes the transpose of C ?: negate every number and transpose its matrix to read it in this site's convention/);
  // Finding 7 (0.3): every "verified by computation" names its range, and only checks of verify.py are
  // called verified; the form value is that of the population p with a = Cp.
  const verified = list.filter((s) => /verified/i.test(s));
  expect(verified.length).toBeGreaterThanOrEqual(2);
  for (const s of verified) expect(s, s).toMatch(/verified by computation for every (?:simply laced )?board of finite type of rank at most eight/);
  expect(norm(text)).not.toMatch(/All three statements/i);
  const keeps = list.filter((s) => /What every move keeps/.test(s));
  expect(keeps).toHaveLength(1);
  expect(keeps[0]).toMatch(/^What every move keeps is the form value of the population p with a=Cp ,? ?whose entries may be fractions, verified by computation for every board of finite type of rank at most eight\.$/);
  // The Hasse diagram is stated with its argument, not as verified: the form value 2 of [W03a] Proposition
  // 3.5 and the changes of the form value when one Martian is added or removed.
  const hasse = list.filter((s) => /Hasse diagram/.test(s));
  expect(hasse).toHaveLength(1);
  expect(hasse[0]).not.toMatch(/verified/);
  expect(norm(text)).toMatch(/The argument uses the form value\. On such a board the positive root populations are exactly the populations with no negative entry and form value 2 \[W03a\] \(Proposition 3\.5\)/);
  expect(norm(text)).toMatch(/2a_i\+2/);
  expect(norm(text)).toMatch(/every positive root population is met from some starting city/);
  // The identities of the third confusion with their one-line argument in place of "verified".
  const third = norm(await proseText(page, '[data-confusion="simply-laced"]'));
  expect(third).toContain('Both follow from writing the moves as matrices, S_i=I-e_ie_i^{\\mathsf T}C and R_i=I-Ce_ie_i^{\\mathsf T}');
  expect(third).not.toMatch(/verified/);
  // Finding 8 (2.4(c)): two different matrices only at a node joined to another (on A1, S_1 = R_1).
  expect(third).toMatch(/two different matrices at any node joined to another\./);
  // Kostant's game and its moods cite [Ele16] and [Che17] (2.9; SOURCES 11.3), as M1 does.
  const kostant = sentences(norm(await page.locator('article h2', { hasText: /^Kostant.s game$/ }).evaluate((h) => {
    let t = '';
    for (let el = h.nextElementSibling; el && el.tagName !== 'H2'; el = el.nextElementSibling) t += ` ${el.textContent ?? ''}`;
    return t;
  })));
  expect(kostant[0]).toMatch(/^Kostant['’]s game is attributed to Kostant; \[Ele16\] and \[Che17\] describe it and its moods\.$/);
  for (const k of ['Ele16', 'Che17', 'W03a']) await expect(page.locator(`article a.cite[data-cite="${k}"]`).first(), k).toBeAttached();
});

test('links resolve', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  const base = new URL(page.url()).pathname.replace(/modules\/m8-lie-algebras\/$/, '');
  // Beat 6: the T10 showpiece of E8 (6.6: r dot-separated, j=coxeter), with bare keys.
  const studio = page.locator('[data-static-figure="e8-roots"] a[data-link="geometry"]');
  await expect(studio).toHaveCount(1);
  const studioHref = (await studio.getAttribute('href')) ?? '';
  expect(studioHref).toBe(`${base}tools/geometry/?z=1&g=E8&r=${T('E8').numbers_of_highest_root.join('.')}&j=coxeter`);
  // Beat 8: the page of 2.16.
  const nq = page.locator('aside[data-sidebar="not-quiver"] a[data-link="not-quiver-mutation"]');
  await expect(nq).toHaveCount(1);
  expect(await nq.getAttribute('href')).toBe(`${base}not-quiver-mutation/`);
  // Glossary links point into the base too.
  for (const h of await page.locator('article a[href*="glossary"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))) expect(h.startsWith(`${base}glossary/#`) || h.startsWith(`${base}glossary#`), h).toBe(true);
  await page.goto(studioHref);
  const geometry = page.locator('[data-tool="geometry"]');
  await expect(geometry).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  await expect(geometry.locator('[data-out="vertexCount"]')).toHaveText(String(T('E8').n_roots));
  await expect(geometry.locator('[data-out="projection"]')).toHaveText('coxeter');
  expect(norm(await page.locator('main').innerText())).not.toContain(NOTICE);
  await page.goto(`${base}not-quiver-mutation/`);
  await expect(page.locator('main h1')).toHaveText('What mutation does not mean');
  // Back to M8 from the page.
  const back = page.locator('article a[data-link="m8"]');
  await expect(back).toHaveCount(1);
  expect(await back.getAttribute('href')).toBe(`${base}modules/m8-lie-algebras/`);
  await back.click();
  await expect(page.locator('[data-anatomy="title"]')).toHaveText('From games to Lie algebras');
  expect(norm(await page.locator('main').innerText())).not.toContain(NOTICE);
});

test('not-quiver page loads no script', async ({ page }) => {
  // Its budget is that of a page with no tool (7.6): no script beyond the shell's, read from /about/.
  const srcs = async (route: string): Promise<string[]> => {
    await page.goto(route);
    return page.locator('script[src]').evaluateAll((els) => els.map((e) => new URL((e as HTMLScriptElement).src).pathname).sort());
  };
  const shell = await srcs('about/');
  const own = await srcs(PAGE_ROUTE);
  expect(own.filter((s) => !shell.includes(s))).toEqual([]);
  await expect(page.locator('astro-island')).toHaveCount(0);
  const html = readFileSync(PAGE_BUILT, 'utf8');
  expect((html.match(/<script\b/g) ?? []).length).toBe((readFileSync(`${distDir()}/about/index.html`, 'utf8').match(/<script\b/g) ?? []).length);
});

// ---------------------------------------------------------------------------------------------
// Writing rules of 8.4 (method plan; instruction 5.14 test 15)
// ---------------------------------------------------------------------------------------------

/** (e) Stock contrasts and filler, case-insensitive (plan list; D14 "no stock rhetorical contrasts or fashionable filler words"). */
const FILLER = ['not just', 'not only', 'more than just', "isn't just", "it's not about", 'simply put', 'delve', 'journey', 'tapestry', 'landscape', 'unlock', 'game-changer', 'crucial', 'remarkable', 'fascinating', 'beautiful', 'elegant', 'powerful', 'deep dive', 'in a nutshell'];

/** (f) Strings SPEC requires verbatim, with their SPEC location; removed before the overlap check. */
const VERBATIM: [string, string][] = [
  ['the number on node i is the amount by which a mutation would lower city i', 'the bridge sentence, 2.4(a)'],
  ['attributed to kostant', '8.4 credit line'],
  ['stated without proof', '2.18 and SOURCES.md 11.1 on [W03a] Theorem 4.1'],
  ['and the quiver', 'the bold cell of the table of 2.16'],
];

/** The words of a text, lower case, formulas removed (TeX between dollars in the Markdown sources). */
function words(text: string): string[] {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/[^a-z' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w !== '' && w !== "'");
}
function section(text: string, from: RegExp, to: RegExp): string {
  const a = text.search(from);
  expect(a, String(from)).toBeGreaterThanOrEqual(0);
  const rest = text.slice(a);
  const b = rest.slice(1).search(to);
  return b < 0 ? rest : rest.slice(0, b + 1);
}
function sourceEntry(text: string, k: string): string {
  const a = text.indexOf(`**[${k}]**`);
  expect(a, k).toBeGreaterThanOrEqual(0);
  const rest = text.slice(a + 4);
  const b = rest.search(/\n\*\*\[|\n#|\*\*\[/);
  return text.slice(a, a + 4 + (b < 0 ? rest.length : b));
}

test('writing rules of 8.4', async ({ page }) => {
  test.setTimeout(120_000);
  const spec = readFileSync(SPEC_MD, 'utf8');
  const sources = readFileSync(SOURCES_MD, 'utf8');
  const reference = [section(spec, /^### 2\.16 /m, /^### 2\.17 /m), section(spec, /^### 2\.18 /m, /^## 3\. /m), section(spec, /^### M8\. /m, /^### M9\. /m)];
  const grams = new Set<string>();
  const addGrams = (ws: string[]): void => {
    for (let k = 0; k + 12 <= ws.length; k++) grams.add(ws.slice(k, k + 12).join(' '));
  };
  for (const route of [ROUTE, PAGE_ROUTE]) {
    await page.goto(route);
    const cited = await page.locator('article a.cite').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-cite') ?? ''))]);
    for (const k of cited) reference.push(sourceEntry(sources, k));
  }
  for (const r of reference) addGrams(words(r));
  expect(grams.size).toBeGreaterThan(1000);
  for (const route of [ROUTE, PAGE_ROUTE]) {
    await page.goto(route);
    const all = await proseText(page, 'article');
    const allNoMath = await proseText(page, 'article', { math: false });
    const list = sentences(all);
    // (a) Credit lines.
    if (route === ROUTE) {
      expect(all).toContain('Wildberger');
      await expect(page.locator('article a.cite[data-cite="W03a"]').first()).toBeAttached();
      await expect(page.locator('article a.cite[data-cite="Gre13"]').first()).toBeAttached();
      expect(norm(all)).toMatch(/Theorem 4\.1 is stated without proof/);
      expect(norm(all)).not.toMatch(/W03a\][^.]*\bprove[sd]?\b|proved (?:in|by) \[W03a\]/);
    } else {
      expect(all).toContain('attributed to Kostant');
      // Any other sentence naming Kostant sits inside an E13 wrap (the name of the game is a name).
      for (const s of list.filter((x) => /Kostant/.test(x.replace(/Kostant's game/g, '')))) expect(s, s).toMatch(/attributed to Kostant/);
      await expect(page.locator('article a.cite[data-cite="W20"]').first()).toBeAttached();
      expect(norm(all)).toMatch(/A mutation at a city changes the population of that city and leaves the other cities and every road as they were \[W20\] \(sections 2 and 5\)/);
    }
    if (/numbers game/i.test(all)) for (const name of ['Mozes', 'Proctor', 'Eriksson']) expect(all, `${route}: ${name}`).toContain(name);
    // (b) The site's words.
    if (route === ROUTE) {
      const beats = (await Promise.all([1, 2, 3, 4, 5, 6].map((n) => proseText(page, `[data-beat="${n}"]`)))).join(' ');
      expect(beats).toContain('minuscule node');
      expect(beats).not.toMatch(/\bvertex|\bvertices/i);
      expect(beats).not.toMatch(/\bcit(?:y|ies)\b/i);
    } else {
      // A node is never called a vertex: "vertex" only beside quiver words.
      for (const s of list.filter((x) => /\bvert(?:ex|ices)\b/i.test(x))) expect(s, s).toMatch(/quiver|arrow|Fomin|cluster|triangle|vertex \d/i);
    }
    // (c) No statement of Appendix F.
    expect(all).not.toMatch(/orthogonal group/i);
    expect(all).not.toMatch(/positive definite(?:ness)? (?:occurs )?exactly/i);
    expect(all).not.toMatch(/factor of (?:2|two)\b/i);
    for (const s of list) expect(/reflection/i.test(s) && /on the weight lattice/i.test(s), s).toBe(false);
    expect(all).not.toMatch(/follows? Wildberger/i);
    // (d) Plain declarative sentences: no question or exclamation in the prose (tools, challenges and the
    // module question are left out by proseText and the selector).
    const declarative = await page.locator('article').evaluate((article) => {
      const copy = article.cloneNode(true) as HTMLElement;
      for (const el of copy.querySelectorAll('.katex, [data-tool], [data-challenge], [data-anatomy="question"], [data-anatomy="sources"], script, style')) el.remove();
      return copy.textContent ?? '';
    });
    for (const s of sentences(declarative)) expect(s, s).not.toMatch(/[?!]$/);
    // (e) No stock contrasts or filler.
    for (const f of FILLER) expect(allNoMath.toLowerCase(), `${route}: "${f}"`).not.toContain(f);
    // (f) No run of twelve words equals a run of SPEC 2.16, 2.18, 3 M8 or a cited entry of SOURCES.md. Left
    // out, as SPEC fixes their words: the module question (3 M8, verbatim), the comparison table of 2.16
    // with the line of its sources (instruction 5.12 item 4 names every row and cell), and the strings
    // of VERBATIM.
    let prose = (
      await page.locator('article').evaluate((article) => {
        const copy = article.cloneNode(true) as HTMLElement;
        for (const el of copy.querySelectorAll('.katex, svg, [data-tool], [data-challenge], [data-anatomy="question"], [data-anatomy="sources"], [data-anatomy="links"], table[data-table="mutation-compared"], [data-table-sources], script, style')) el.remove();
        for (const el of copy.querySelectorAll('p, li, td, th, h1, h2, h3, figcaption, caption')) el.append(document.createTextNode(' . '));
        return copy.textContent ?? '';
      })
    )
      .toLowerCase()
      .replace(/[‘’]/g, "'");
    for (const [v] of VERBATIM) prose = prose.split(v).join(' . ');
    const ws = words(prose);
    const copied: string[] = [];
    for (let k = 0; k + 12 <= ws.length; k++) {
      const g = ws.slice(k, k + 12).join(' ');
      if (grams.has(g)) copied.push(g);
    }
    expect(copied, `${route}: runs of twelve words found in SPEC or SOURCES`).toEqual([]);
  }
});

// ---------------------------------------------------------------------------------------------
// Glossary (8.4 bullet 1; method plan, instruction 5.14 test 16)
// ---------------------------------------------------------------------------------------------

/**
 * Glossary terms whose words these pages use in another sense, with the reason; their uses are not counted.
 *   arrows: the glossary's arrows are those of a Satake diagram (the involution); here they are quiver
 *     arrows or arrowheads of double roads.
 */
const OTHER_SENSE: Record<string, string> = {
  arrows: 'quiver arrows and arrowheads on roads, not the arrows of a Satake diagram',
};

test('later uses of a term link to the glossary', async ({ page }) => {
  await page.goto('glossary/');
  const terms = await page.locator('article dfn[id]').evaluateAll((els) =>
    els.map((e) => {
      const copy = e.cloneNode(true) as HTMLElement;
      for (const k of copy.querySelectorAll('.katex')) k.remove();
      return { id: e.id, term: (copy.textContent ?? '').replace(/\s+/g, ' ').trim() };
    }),
  );
  expect(terms.map((t) => t.id)).toContain('minuscule-node');
  const anchors = new Set(terms.map((t) => t.id));
  for (const route of [ROUTE, PAGE_ROUTE]) {
    await page.goto(route);
    // The prose as text with each glossary link marked \u0001<k>\u0002 text \u0003, k the index of its anchor in
    // the list returned beside it (so that no anchor's letters enter the text searched).
    const { marked, links } = await page.locator('article').evaluate((article) => {
      const copy = article.cloneNode(true) as HTMLElement;
      for (const el of copy.querySelectorAll('.katex, [data-tool], table, [data-anatomy="sources"], [data-anatomy="links"], [data-challenge], h1, h2, h3, script, style')) el.remove();
      const found: string[] = [];
      for (const a of copy.querySelectorAll('a[href*="glossary"]')) {
        const href = a.getAttribute('href') ?? '';
        found.push(href.slice(href.indexOf('#') + 1));
        a.replaceWith(document.createTextNode(`\u0001${found.length - 1}\u0002${a.textContent ?? ''}\u0003`));
      }
      return { marked: (copy.textContent ?? '').replace(/[‘’]/g, "'").replace(/\s+/g, ' '), links: found };
    });
    // Every glossary link resolves to an entry.
    for (const anchor of links) expect(anchors.has(anchor), `${route}: glossary#${anchor}`).toBe(true);
    const missing: string[] = [];
    for (const { id, term } of terms) {
      if (OTHER_SENSE[term] !== undefined) continue;
      const re = new RegExp(`(?<![\\w'])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![\\w-])`, 'gi');
      const hits = [...marked.matchAll(re)].map((m) => m.index!);
      if (hits.length < 2) continue;
      const linked = hits.slice(1).some((at) => {
        const open = marked.lastIndexOf('\u0001', at);
        const close = marked.lastIndexOf('\u0003', at);
        return open > close && links[Number(marked.slice(open + 1, marked.indexOf('\u0002', open)))] === id;
      });
      if (!linked) missing.push(`${term} (${hits.length} uses: ${hits.map((at) => `"...${marked.slice(Math.max(0, at - 30), at + term.length + 10).replace(/[\u0001-\u0003]/g, '|')}..."`).join(', ')})`);
    }
    expect(missing, `${route}: terms used twice or more with no later use linked to the glossary`).toEqual([]);
  }
  // Not vacuous: the link of the second use of "minuscule node" on M8 is what satisfies its term.
  await page.goto(ROUTE);
  await expect(page.locator('article a[href$="glossary/#minuscule-node"], article a[href$="glossary#minuscule-node"]').first()).toBeAttached();
});

// ---------------------------------------------------------------------------------------------
// The statements of the page, recomputed with the engine (2.16; F13). The page calls verified only what
// reference/verify.py checks (every raising move adds one Martian; every population met is a positive
// root); it gives the Hasse diagram with its argument. This test is a check of the engine against both.
// ---------------------------------------------------------------------------------------------

test("Kostant's game climbs the Hasse diagram of the positive roots on every simply laced board of finite type", () => {
  const simplyLaced = Object.entries(GOLDEN.types).filter(([, t]) => t.simply_laced).map(([name]) => name);
  expect(simplyLaced).toEqual(expect.arrayContaining(['A1', 'A8', 'D4', 'D8', 'E6', 'E7', 'E8']));
  for (const name of simplyLaced) {
    const board = B(name);
    const order = toPositions(board, [...board.labels].sort((a, b) => a - b));
    const inLabels = (p: readonly number[]): number[] => order.map((q) => p[q]!);
    // The positive root populations from the engine, checked against the golden file (the whole list where
    // the file stores it, the count everywhere).
    const roots = positiveRoots(board).map((r) => inLabels(r as number[]));
    expect(roots.length, name).toBe((T(name) as unknown as { n_positive_roots: number }).n_positive_roots);
    if (T(name).positive_roots) expect(roots.map((r) => r.join(',')).sort(), name).toEqual(T(name).positive_roots.map((r) => r.join(',')).sort());
    const positive = new Set(roots.map((r) => r.join(',')));
    // The Hasse diagram: pairs of positive root populations that differ by one Martian in one city.
    const hasse = new Set<string>();
    for (const r of roots) {
      for (let k = 0; k < r.length; k++) {
        const up = r.map((x, j) => (j === k ? x + 1 : x));
        if (positive.has(up.join(','))) hasse.add(`${r.join(',')}>${up.join(',')}`);
      }
    }
    // The state graph of Kostant's game over all starting cities: raising moves only.
    const edges = new Set<string>();
    const seen = new Set<string>();
    const queue: number[][] = order.map((q) => board.labels.map((_, j) => (j === q ? 1 : 0)));
    while (queue.length > 0) {
      const p = queue.shift()!;
      const k0 = inLabels(p).join(',');
      if (seen.has(k0)) continue;
      seen.add(k0);
      expect(positive.has(k0), `${name}: ${k0} is a positive root population`).toBe(true);
      for (const i of raisingNodes(board, p)) {
        const q = mutate(board, p, i);
        const rise = q[i]! - p[i]!;
        expect(rise, `${name}: a raising move raises by one`).toBe(1);
        edges.add(`${k0}>${inLabels(q).join(',')}`);
        queue.push(q);
      }
    }
    expect([...seen].sort(), name).toEqual([...positive].sort());
    expect([...edges].sort(), name).toEqual([...hasse].sort());
  }
  // Off the finite types: on the triangle (three cities, single roads) raising moves from one Martian reach
  // (1, 1, 0), and mutating city 3 there raises it by two, to (1, 1, 2).
  const triangle = fromAdjacency([
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ]) as AnyBoard;
  const big = (v: number[]): bigint[] => v.map(BigInt);
  const t = triangle as Board<bigint>;
  expect(raisingNodes(t, big([1, 0, 0]))).toContain(1);
  expect(mutate(t, big([1, 0, 0]), 1).map(Number)).toEqual([1, 1, 0]);
  expect(raisingNodes(t, big([1, 1, 0]))).toContain(2);
  expect(mutate(t, big([1, 1, 0]), 2).map(Number)).toEqual([1, 1, 2]);
});

// ---------------------------------------------------------------------------------------------
// Regressions of the phase 5 red-team round (build-plan/red-team/RT-FIX.md 5.3)
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    // RT-13, attack 8 (P2), from the script redteam/rt13-p5-reveal-only.mjs of the lens branch, which read a
    // reading log of the release build without JavaScript and found the answers of b1 and b5 "stated outside
    // the reveal in: nowhere" (SPEC 8.1 P2: "Results are stated in the prose."; 4.0 Starts meaningful). The
    // script removed the prediction blocks and looked for each answer, with the patterns below, in every
    // other block of the page (prose, captions and the tools' own text), formulas as $TeX$. Oracle: b1, A2
    // from (2, 0), firing node 1 then node 2 gives (0, -2), whose string at node 1 has 1 position; b5, the
    // orbit of node 3 of D4 has 8 positions (python3 redteam/rt13-p5-oracle-m8.py on the lens branch).
    // Adoption: the same patterns on the same page without JavaScript, read from the built page; the stating
    // text must also follow its prediction block, as the held class P3-RT-13-01 asks (no answer readable
    // before the reader commits).
    // regression: P5-RT-13-01
    test('the answers of M8 predictions b1 and b5 are stated outside their reveals, after the prediction block', async ({ page }) => {
      await page.goto(ROUTE);
      const answers = [
        { id: 'b1', stated: /\(0, ?(−|-)2\)[^.]*(one position|1 position|alone|single position)|(one position|alone)[^.]*\(0, ?(−|-)2\)/ },
        { id: 'b5', stated: /node 3[^.]*\b8\b[^.]*position|\b8\b positions[^.]*node 3|nodes? 1(, 3)? and 3[^.]*\b8\b|orbit of (e|ω)3[^.]*\b8\b/i },
      ];
      expect(String(AFTER_TWO_LENGTH)).toBe('1');
      expect(key(AFTER_TWO)).toBe('0,-2');
      expect(dim('D4', 3)).toBe(8);
      const texts = await page.locator('article').evaluate((article) => {
        const blocks = [...article.querySelectorAll('p, li, figcaption, td, th, [data-out="caption"]')].filter((el) => el.closest('[data-prediction], details') === null);
        const predictions = [...article.querySelectorAll('[data-tool] [data-prediction]')];
        return blocks.map((el) => {
          const copy = el.cloneNode(true) as HTMLElement;
          for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(`$${k.querySelector('annotation')?.textContent ?? ''}$`));
          for (const d of copy.querySelectorAll('[data-prediction], details, script, style')) d.remove();
          const after = predictions.filter((p) => (p.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).map((p) => p.closest('[data-tool]')?.getAttribute('data-instance') ?? '');
          return { text: (copy.textContent ?? '').replace(/\s+/g, ' ').trim(), after };
        });
      });
      expect(texts.length).toBeGreaterThan(40);
      const report = answers.map(({ id, stated }) => {
        const hits = texts.filter((t) => stated.test(t.text));
        return { id, after: hits.filter((h) => h.after.includes(id)).length, before: hits.filter((h) => !h.after.includes(id)).map((h) => `${id}: ${h.text}`) };
      });
      expect(report.filter((r) => r.after === 0).map((r) => `${r.id}: stated outside the reveal, after the prediction block, in: nowhere`)).toEqual([]);
      expect(report.flatMap((r) => r.before), 'stated before the prediction block').toEqual([]);
    });

    // Adopted from site/tests/e2e/redteam-RT-08-p5-omega.spec.ts (RT-08, phase 5 round, attack 30 (a)); the
    // same cause as P5-RT-13-02 (RT-13 attack 13, redteam/rt13-p5-omega.mjs). SPEC 8.4: "Use the site's
    // words consistently ... Give the standard term once, in the Lie theory paragraph"; Appendix C: the site's
    // word is "fundamental position e_i", the Lie theory column "fundamental weight omega_i". M8's prose and
    // captions write e1, as M7 does (decision P4-A6, tested in M7.spec.ts), but T12 wrote omega_i in its own
    // text on all twelve instances (rep.ts omegaName: the explanation, the panel title, "Layer 0 is ...", the
    // orbit table's caption, and repCaption, which M8 uses as the captions of b10 to b12).
    // regression: P5-RT-08-01
    test('M8: no omega outside the Lie theory paragraph, as on M7', async ({ page }) => {
      await page.goto(ROUTE);
      const found = await page.locator('article').evaluate((article) => {
        const copy = article.cloneNode(true) as HTMLElement;
        for (const el of copy.querySelectorAll('[data-anatomy="lie-theory"], [data-anatomy="sources"], .katex-mathml, annotation')) el.remove();
        const out: string[] = [];
        for (const el of copy.querySelectorAll('p, li, figcaption, caption, span, div')) {
          if (el.querySelector('p, li, figcaption, caption, span, div')) continue;
          const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (t.includes('ω')) out.push(`${el.closest('[data-tool]')?.getAttribute('data-instance') ?? 'prose'}: ${t.slice(0, 120)}`);
        }
        return out;
      });
      // Observed at 006f50d: dozens of omega in the T12 instances, among them the captions of b10 to b12
      // ("On D4 the 8 positions of the orbit of ω4 give 8 by 8 matrices E, F and H ...") and in b3 to b8
      // ("Node 1 is minuscule: every number in the orbit of ω1 is −1, 0 or 1, and all the relations hold.").
      expect(found, 'omega_i outside the Lie theory paragraph of M8').toEqual([]);
      // The lesson's own captions use the site's name for the same object.
      await expect(page.locator('[data-tool][data-instance="b5"] [data-out="caption"]').first()).toContainText('the orbit of e1');
    });
  });
});
