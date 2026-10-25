// P6-A7: lesson M9, "Real forms and Satake diagrams", against the built site (SPEC.md 2.13 (b), 2.15, 3 M9,
// 4 T13, 4.0, 6.4, 6.6, 7.3, 7.4, 7.6, 8.2, 8.4, 8.5, 9.2, Appendix A.5, B, C, E items 1, 8, 15;
// build-plan/agents/P6-A7-lesson-m9.md 5.17). Run after `npm run build` against `astro preview`, one
// Playwright run at a time. The pattern is that of M8.spec.ts. Every expected number with a golden value is
// read from reference/golden_data.json or computed here in Node with the engine (or with the pure functions
// of the Satake Studio, which call only the engine); the only values typed are the worked rows of Appendix
// A.5 and the A.5 header.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("satake"), data-instance (b1 to b12), data-hydrated="true",
//     data-moves; data-out caption, noscript; the live region [data-live]
//   T13, the data-out names of site/src/tools/registry/T13.ts (T13_OUTS in t13/config.ts), listed in the
//     header of site/tests/e2e/T13.spec.ts: decoration, black-nodes, tau, arrows, game-board, light-1,
//     light-2, light-3, reason-3, verdict, failure-note, examples, data-pending, real-form (data-name),
//     restricted-type, real-rank, multiplicities, multiplicity-classes, dim-k, dim-p, character, theta-word,
//     theta-stage, shadow, shadow-coordinates, shadow-table, restricted-board, restricted-name,
//     composite-word, composite-length, catalogue-row (data-name), same-form; History: moveCounter;
//     Predict: predictResult. Extra hooks of T13 (decisions/P6-A3.md): data-colour on the paint buttons,
//     data-board="decoration" and "restricted", data-arrow and data-black-arrow on the drawing,
//     data-panel-tab, data-control picker, tau (data-tau), toggle, root, theta-next, example
//     (data-example); Predict: data-prediction, .question, details, data-control predictAnswer,
//     predictCheck, predictShow
//   lesson anatomy (P1-A4): data-anatomy = title, question, draft, beat, figure, seen, lie-theory, links,
//     sources; data-beat; data-provenance; data-challenge, data-challenge-result; data-source; data-link;
//     data-unverified and a.unverified-mark (P0-A4 Unverified); data-golden (P0-A4 G)
//   this lesson's own markup: table#su12-shadows (data-row); ol[data-conditions] (data-condition);
//     aside[data-sidebar="vogan"] with figure[data-static-figure="vogan"]; data-seen-statement
//
// Word-counting rule (as M5.spec.ts to M8.spec.ts): the words of the <article> after removing every tool
// root ([data-tool]), every <details>, every live or status region, the draft mark and the list of sources
// entries; each KaTeX formula counts as one word; a word is a run of non-space characters.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { altOfRealForm, texOfRealForm } from '../../../scripts/names.mjs';
import { admissibility, boardFromName, mutate, positiveRoots, shadow2, theta, toLabels, toPositions } from '../../../packages/engine/src/index';
import type { Board, SatakeDiagram } from '../../../packages/engine/src/index';
import { assembleData, coordinatesInBourbaki, defaultRoot, halfText, inLabelOrder, involutions, rootsOffered } from '../../src/components/tools/t13/model';
import { computeNow } from '../../src/components/tools/t13/load';
import { distDir } from './routes';

const ROUTE = 'modules/m9-real-forms/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m9-real-forms.mdx', import.meta.url));
const SPEC_PATH = fileURLToPath(import.meta.url);
const FRAGMENT_PATH = fileURLToPath(new URL('../../../decisions/P6-A7.md', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m9-real-forms/index.html`;
const WORKER = /engine\.worker/;
const MINUS = '−';

interface SatakeRecord {
  dynkin_type: string;
  real_form: string;
  cartan_label: string;
  black_nodes: number[];
  tau: number[];
  arrows: number[][];
  tau_moves_black_nodes: boolean;
  rank: number;
  real_rank: number;
  restricted_type_display: string | null;
  multiplicities: { class: string; roots: number; mult: number }[];
  dim_k: number;
  dim_p: number;
  character: number;
  roots_compact_imaginary: number;
  w_X_word: number[];
  restricted_simple_orbits: number[][];
  restricted_simple_multiplicities: [number, number][];
  restricted_board: string | null;
  restricted_orbits_in_bourbaki_order: number[][] | null;
  restricted_reflection_word_lengths: number[];
}
interface Example {
  type: string;
  black_nodes: number[];
  tau: number[];
  condition_1: boolean;
  condition_2: boolean;
  condition_3: boolean;
  admissible: boolean;
  real_forms: string[];
}
interface Golden {
  types: Record<string, { cartan: number[][]; n_roots: number; n_positive_roots: number; positive_roots: number[][] }>;
  satake: SatakeRecord[];
  satake_examples: Example[];
  admissible_counts: Record<string, { real_forms_including_compact: number; catalogue_records: number }>;
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const TYPES = Object.keys(GOLDEN.types);
const record = (type: string, form: string): SatakeRecord => {
  const hits = GOLDEN.satake.filter((r) => r.dynkin_type === type && r.real_form === form);
  if (hits.length !== 1) throw new Error(`${hits.length} satake records for ${type} ${form}`);
  return hits[0]!;
};
const SU4 = record('A3', 'su*(4)');
const SU12 = record('A2', 'su(1,2)');
const SU13 = record('A3', 'su(1,3)');
const E626 = record('E6', 'e6(-26)');
const SU15 = record('A5', 'su(1,5)');
const SO26 = record('D4', 'so(2,6)');
const SO8STAR = record('D4', 'so*(8)');
const SO10 = record('D5', 'so*(10)');
const E614 = record('E6', 'e6(-14)');

// ---------------------------------------------------------------------------------------------
// The figures and challenge tools of the lesson (SPEC 3 M9 figure table; instruction 5.2 to 5.11)
// ---------------------------------------------------------------------------------------------

type Tool = { id: string; beat: number; board: string; black: number[]; tau: number[]; panel: string };
const ident = (n: number): number[] => Array.from({ length: n }, (_, k) => k + 1);
/** The nine figures of beats 1 to 8 (beat 4 has two: A2 with free decoration, then A3 with the examples). */
const FIGURES: Tool[] = [
  { id: 'b1', beat: 1, board: 'A1', black: [], tau: [1], panel: 'data' },
  { id: 'b2', beat: 2, board: 'A3', black: SU4.black_nodes, tau: SU4.tau, panel: 'theta' },
  { id: 'b3', beat: 3, board: 'A2', black: SU12.black_nodes, tau: SU12.tau, panel: 'shadows' },
  { id: 'b4', beat: 4, board: 'A2', black: [], tau: ident(2), panel: 'lights' },
  { id: 'b5', beat: 4, board: 'A3', black: [], tau: ident(3), panel: 'lights' },
  { id: 'b6', beat: 5, board: 'A3', black: SU13.black_nodes, tau: SU13.tau, panel: 'data' },
  { id: 'b7', beat: 6, board: 'E6', black: E626.black_nodes, tau: E626.tau, panel: 'restricted' },
  { id: 'b8', beat: 7, board: 'D4', black: [], tau: ident(4), panel: 'catalogue' },
  { id: 'b9', beat: 8, board: 'A5', black: SU15.black_nodes, tau: SU15.tau, panel: 'data' },
];
/** The tools of the three challenges, each right after its challenge. */
const CHALLENGE_TOOLS: Tool[] = [
  { id: 'b10', beat: 0, board: 'D5', black: SO10.black_nodes, tau: ident(5), panel: 'data' },
  { id: 'b11', beat: 0, board: 'E6', black: [], tau: ident(6), panel: 'data' },
  { id: 'b12', beat: 0, board: 'E6', black: E626.black_nodes, tau: E626.tau, panel: 'restricted' },
];
const TOOLS = [...FIGURES, ...CHALLENGE_TOOLS];

// The engine, for what the figures show (computed here, never typed).
const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
/** A diagram from labels (E-7: toPositions only). */
function diagram(type: string, black: readonly number[], tau: readonly number[]): SatakeDiagram {
  const board = B(type);
  const t: number[] = new Array(board.n);
  [...board.labels].sort((a, b) => a - b).forEach((l, k) => {
    t[toPositions(board, [l])[0]!] = toPositions(board, [tau[k]!])[0]!;
  });
  return { board, black: toPositions(board, [...black]), tau: t };
}
const inLabels = (d: SatakeDiagram, v: readonly number[]): number[] => inLabelOrder(d.board as Board<number>, [...v]);
const fromLabels = (d: SatakeDiagram, v: readonly number[]): number[] => {
  const out: number[] = new Array(d.board.n).fill(0);
  [...d.board.labels].sort((a, b) => a - b).forEach((l, k) => {
    out[toPositions(d.board, [l])[0]!] = v[k]!;
  });
  return out;
};
/** The text of T13's data-out "shadow": the shadow at half, in label order (t13/model.ts halfText). */
const shadowText = (d: SatakeDiagram, p: readonly number[]): string => `(${inLabels(d, shadow2(d, [...p])).map(halfText).join(', ')})`;
/** theta of a population given in labels, in labels. */
const thetaOf = (d: SatakeDiagram, v: readonly number[]): number[] => inLabels(d, theta(d, fromLabels(d, v)));
/** One composite move on the coordinates: a mutation of the drawn restricted board at a label. */
const restrictedMove = (name: string, c: readonly number[], label: number): number[] => {
  const b = B(name);
  return mutate(b, [...c], toPositions(b, [label])[0]!);
};
const A3_ROOT_TWO = GOLDEN.types.A3.positive_roots[1]!;
const A3_ROOT_ONE = GOLDEN.types.A3.positive_roots[0]!;
const D_SU4 = diagram('A3', SU4.black_nodes, SU4.tau);
const D_SU13 = diagram('A3', SU13.black_nodes, SU13.tau);
const D_E626 = diagram('E6', E626.black_nodes, E626.tau);
/** The prediction of b6: theta of su(1,3) on (0, 0, 1). */
const THETA13 = thetaOf(D_SU13, A3_ROOT_ONE);
const tuple = (v: readonly number[]): string => `(${v.join(', ')})`;
const minusTuple = (v: readonly number[]): string => `(${v.map((x) => (x < 0 ? `${MINUS}${-x}` : String(x))).join(', ')})`;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool="satake"][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const deco = (page: Page, id: string, label: number): Locator => out(page, id, 'decoration').locator(`button[data-node="${label}"]`);
const gameNodes = (page: Page, id: string): Locator => out(page, id, 'game-board').locator('button[data-node]');
const restrictedNode = (page: Page, id: string, label: number): Locator => out(page, id, 'restricted-board').locator(`button[data-node="${label}"]`);
const tab = (page: Page, id: string, panel: string): Locator => tool(page, id).locator(`[data-panel-tab="${panel}"]`);
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
/** <G> output and tool text: grouping spaces U+202F and true minus signs U+2212 normalised away. */
const plain = (s: string | null): string => norm((s ?? '').replace(/ /g, '').replace(/−/g, '-'));
const word = (b: boolean): string => (b ? 'holds' : 'fails');

test.use({ reducedMotion: 'reduce' });

/** Scrolls a tool into view (client:visible), waits for hydration and for the data of its decoration. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  await expect(out(page, id, 'data-pending')).toHaveCount(0, { timeout: 30000 });
}
async function openPanel(page: Page, id: string, panel: string): Promise<void> {
  await tab(page, id, panel).click();
  await expect(tab(page, id, panel)).toHaveAttribute('aria-selected', 'true');
}
/** The values of a board's buttons in label order. */
async function valuesOf(nodes: Locator): Promise<string[]> {
  const pairs: [number, string][] = [];
  for (const b of await nodes.all()) pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  return pairs.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}
/** "Show me" on a prediction, so that its board is free. */
async function showMe(page: Page, id: string): Promise<void> {
  await control(page, id, 'predictShow').click();
  await expect(out(page, id, 'predictResult')).toContainText('The answer is');
}

/** The challenge that watches a tool, once its island has hydrated. */
async function challengeFor(page: Page, id: string): Promise<Locator> {
  const islands = page.locator('astro-island[component-export="Challenge"]');
  const k = await islands.evaluateAll((els, want) => els.findIndex((e) => (e.getAttribute('props') ?? '').includes(`"${want}"`)), id);
  expect(k, `a Challenge watches ${id}`).toBeGreaterThanOrEqual(0);
  const target = islands.nth(k);
  await target.locator('[data-challenge]').scrollIntoViewIfNeeded();
  await expect(target).not.toHaveAttribute('ssr', '', { timeout: 30000 });
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
    const drop = '[data-tool], details, [role="status"], [aria-live], [data-anatomy="draft"], [data-anatomy="sources"] ul, script, style, noscript';
    for (const el of copy.querySelectorAll(drop)) el.remove();
    return (copy.textContent ?? '').split(/\s+/).filter((w) => w !== '').length;
  });
}

/**
 * The text of a part of the page with tools, challenges, the list of sources and the module links removed
 * and every formula replaced by its TeX source (or by a space with `math: false`).
 */
async function proseText(page: Page, scope: string, opts: { math?: boolean } = {}): Promise<string> {
  return page.locator(scope).first().evaluate(
    (root, { math }) => {
      const copy = root.cloneNode(true) as HTMLElement;
      for (const k of copy.querySelectorAll('.katex')) {
        const tex = math ? (k.querySelector('annotation')?.textContent ?? '') : ' ';
        k.replaceWith(document.createTextNode(` ${tex} `));
      }
      for (const el of copy.querySelectorAll('[data-tool], [role="status"], [aria-live], script, style, noscript, [data-anatomy="sources"], [data-anatomy="links"], [data-challenge], svg')) el.remove();
      for (const el of copy.querySelectorAll('p, li, td, th, h1, h2, h3, figcaption, caption, dd, dt')) el.append(document.createTextNode(' '));
      return (copy.textContent ?? '').replace(/[‘’]/g, "'");
    },
    { math: opts.math !== false },
  );
}
const sentences = (t: string): string[] => norm(t).split(/(?<=[.!?])\s+/);

// ---------------------------------------------------------------------------------------------
// Without JavaScript (7.4)
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('M9 renders without JavaScript', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tool]')).toHaveCount(TOOLS.length);
    await expect(page.locator('[data-tool="satake"]')).toHaveCount(TOOLS.length);
    for (const { id, board, black, tau, panel } of TOOLS) {
      const root = tool(page, id);
      await expect(root, id).toHaveCount(1);
      await expect(root, id).not.toHaveAttribute('data-hydrated', 'true');
      expect(norm(await out(page, id, 'caption').textContent()), `${id} caption`).not.toBe('');
      await expect(out(page, id, 'noscript'), `${id} noscript line`).toHaveText('Interactive when scripts are allowed.');
      const enabled = await root.locator('button, input, select, textarea').evaluateAll((els) => els.filter((e) => !e.matches(':disabled')).length);
      expect(enabled, `${id} controls disabled`).toBe(0);
      // The default figure: the drawing of the decoration and the game board, with their values (7.4).
      const n = B(board).n;
      await expect(out(page, id, 'decoration').locator('svg').first(), id).toBeAttached();
      await expect(out(page, id, 'decoration').locator('button[data-node]'), id).toHaveCount(n);
      await expect(gameNodes(page, id), id).toHaveCount(n);
      for (const v of await valuesOf(gameNodes(page, id))) expect(v, id).toMatch(/^-?\d+$/);
      for (const l of ident(n)) await expect(deco(page, id, l), `${id} node ${l}`).toHaveAttribute('data-colour', black.includes(l) ? 'black' : 'white');
      await expect(out(page, id, 'black-nodes'), id).toHaveText(black.join('.'));
      await expect(out(page, id, 'tau'), id).toHaveText(tau.join('.'));
      await expect(tab(page, id, panel), `${id} panel`).toHaveAttribute('aria-selected', 'true');
      // The table view of A-10 is in the markup.
      await expect(root.locator('details table[data-table="decoration"]'), id).toHaveCount(1);
    }
    for (const { id, beat } of FIGURES) {
      await expect(page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] [data-tool][data-instance="${id}"]`), id).toHaveCount(1);
    }
    // The data shown before any script: su(1,3) in beat 5, e6(-26) in beat 6, the D4 catalogue in beat 7.
    await expect(out(page, 'b6', 'real-form')).toHaveAttribute('data-name', SU13.real_form);
    await expect(out(page, 'b7', 'restricted-name')).toHaveText(E626.restricted_board!);
    await expect(out(page, 'b8', 'catalogue-row')).toHaveCount(GOLDEN.admissible_counts.D4!.catalogue_records);
    // The table of Appendix A.5 for su(1,2): three columns, two rows (A.5 typed; counts golden).
    const table = page.locator('[data-beat="3"] table#su12-shadows');
    await expect(table).toHaveCount(1);
    await expect(table.locator('caption')).not.toHaveText('');
    await expect(table.locator('thead th')).toHaveCount(3);
    expect(plain(await table.locator('thead th').nth(0).textContent())).toMatch(/^shadow/);
    expect(plain(await table.locator('thead th').nth(1).textContent())).toBe('number of positive roots above it');
    expect(plain(await table.locator('thead th').nth(2).textContent())).toMatch(/^positive roots .* with /);
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) await expect(row.locator('th, td')).toHaveCount(3);
    await expect(rows.nth(0).locator('th')).toHaveText('(1/2, 1/2)');
    await expect(rows.nth(0).locator('td').nth(0)).toHaveText(String(SU12.multiplicities[0]!.mult));
    expect(plain(await rows.nth(0).locator('td').nth(1).textContent())).toBe('(0, 1) ↦ (-1, 0); (1, 0) ↦ (0, -1)');
    await expect(rows.nth(1).locator('th')).toHaveText('(1, 1)');
    await expect(rows.nth(1).locator('td').nth(0)).toHaveText(String(SU12.multiplicities[1]!.mult));
    expect(plain(await rows.nth(1).locator('td').nth(1).textContent())).toBe('(1, 1) ↦ (-1, -1)');
    expect([SU12.multiplicities[0]!.mult, SU12.multiplicities[1]!.mult]).toEqual([2, 1]);
    // The static sidebar of beat 9: an SVG with a title and a description, a caption, no island, no script.
    const figure = page.locator('[data-beat="9"] aside[data-sidebar="vogan"] figure[data-static-figure="vogan"]');
    await expect(figure).toHaveCount(1);
    const svg = figure.locator('svg');
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg.locator('title')).not.toHaveText('');
    await expect(svg.locator('desc')).not.toHaveText('');
    await expect(svg.locator('circle')).toHaveCount(4);
    await expect(figure.locator('astro-island, script')).toHaveCount(0);
    const cap = norm(await proseText(page, '[data-static-figure="vogan"] figcaption'));
    expect(cap).toContain('Satake diagram');
    expect(cap).toContain('Vogan diagram');
    expect(cap).toContain(texOfRealForm('sl(3,R)'));
    expect(cap).toContain(texOfRealForm('su(3)'));
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('every prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    // b7: the coordinates of the default shadow, then node 2, then node 1, as mutations of the restricted board.
    const start = plain(await out(page, 'b7', 'shadow-coordinates').textContent()).replace(/[()]/g, '').split(', ').map(Number);
    const afterTwo = restrictedMove(E626.restricted_board!, start, 2);
    const afterOne = restrictedMove(E626.restricted_board!, afterTwo, 1);
    const answers: Record<string, string> = { b6: tuple(THETA13), b7: tuple(afterOne) };
    expect(Object.keys(answers)).toEqual(await page.locator('[data-tool]').evaluateAll((els) => els.filter((e) => e.querySelector('[data-prediction]') !== null).map((e) => e.getAttribute('data-instance'))));
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
    expect(THETA13).toEqual([-1, -1, 0]);
  });
});

// ---------------------------------------------------------------------------------------------
// Predictions (4.0 Predict; 8.1 P5)
// ---------------------------------------------------------------------------------------------

test('a prediction freezes its board until answered', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(ROUTE);
  // b6: the decoration, the pickers and the stages wait for the answer.
  await hydrate(page, 'b6');
  await expect(control(page, 'b6', 'predictAnswer')).toHaveCount(3);
  for (const l of [1, 2, 3]) await expect(deco(page, 'b6', l)).toHaveAttribute('data-can-act', 'false');
  await expect(control(page, 'b6', 'picker')).toBeDisabled();
  for (const r of await control(page, 'b6', 'tau').all()) await expect(r).toBeDisabled();
  await expect(control(page, 'b6', 'root')).toBeDisabled();
  // A click on a frozen node (aria-disabled, so Playwright is told to click anyway) changes nothing.
  await deco(page, 'b6', 1).click({ force: true });
  await page.waitForTimeout(300);
  await expect(out(page, 'b6', 'black-nodes')).toHaveText(SU13.black_nodes.join('.'));
  for (const [k, v] of THETA13.entries()) await control(page, 'b6', 'predictAnswer').nth(k).fill(String(v));
  await control(page, 'b6', 'predictCheck').click();
  await expect(out(page, 'b6', 'predictResult')).toHaveText(/^Right: /);
  for (const l of [1, 2, 3]) await expect(deco(page, 'b6', l)).toHaveAttribute('data-can-act', 'true');
  await openPanel(page, 'b6', 'theta');
  await control(page, 'b6', 'theta-play').click();
  expect(await valuesOf(gameNodes(page, 'b6'))).toEqual(THETA13.map(String));
  await deco(page, 'b6', 1).click();
  await expect(out(page, 'b6', 'black-nodes')).toHaveText([1, ...SU13.black_nodes].sort().join('.'));
  // b7: the restricted board waits too, until "show me".
  await hydrate(page, 'b7');
  await expect(restrictedNode(page, 'b7', 2)).toHaveAttribute('data-can-act', 'false');
  await restrictedNode(page, 'b7', 2).click({ force: true });
  await page.waitForTimeout(300);
  await expect(out(page, 'b7', 'composite-word')).toHaveCount(0);
  await expect(out(page, 'b7', 'moveCounter')).toHaveText('0');
  await showMe(page, 'b7');
  await expect(restrictedNode(page, 'b7', 2)).toHaveAttribute('data-can-act', 'true');
  await restrictedNode(page, 'b7', 2).click();
  await expect(out(page, 'b7', 'composite-word')).toHaveCount(1);
});

test('a prediction asks about what is not yet on screen', async ({ page }) => {
  await page.goto(ROUTE);
  // The answers are not in the prose above their tools, nor in their captions (P3-RT-13-01).
  const start = plain(await out(page, 'b7', 'shadow-coordinates').textContent()).replace(/[()]/g, '').split(', ').map(Number);
  const b7Answer = restrictedMove(E626.restricted_board!, restrictedMove(E626.restricted_board!, start, 2), 1);
  for (const [id, want] of [['b6', THETA13], ['b7', b7Answer]] as const) {
    const before = await tool(page, id).evaluate((el) => {
      const range = document.createRange();
      range.setStart(document.querySelector('article')!, 0);
      range.setEndBefore(el);
      const copy = range.cloneContents();
      for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
      for (const t of copy.querySelectorAll('[data-tool], script, style')) t.remove();
      return `${copy.textContent ?? ''} ${el.querySelector('[data-out="caption"]')?.textContent ?? ''}`;
    });
    // b6 asks for a population of A3, b7 for coordinates on the restricted board: no sentence above them
    // about that kind of object holds the answer (the A2 table of beat 3 holds (-1, -1) as theta of (1, 1)).
    const about = id === 'b6' ? /\\theta|stage|population/ : /coordinate/;
    const about_ = sentences(plain(before)).filter((x) => about.test(x));
    expect(about_.length, id).toBeGreaterThan(0);
    for (const s of about_) expect(s.replace(/\s/g, ''), `${id}: ${s}`).not.toContain(`(${want.join(',')})`);
  }
  expect(plain(await proseText(page, 'article')).replace(/\s/g, '')).not.toContain(`(${THETA13.join(',')})`);
  // b6 opens on the data panel: theta of the root is not shown until the reader plays it.
  const panel = norm(await tool(page, 'b6').locator('[data-panel]').textContent());
  expect(plain(panel).replace(/\s/g, '')).not.toContain(`(${THETA13.join(',')})`);
});

// ---------------------------------------------------------------------------------------------
// The beats (instruction 5.17 tests 8 to 15)
// ---------------------------------------------------------------------------------------------

test('beat 1: A1 white is sl(2,R), painted black is su(2)', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b1');
  const white = record('A1', 'sl(2,R)');
  const black = record('A1', 'su(2)');
  await expect(out(page, 'b1', 'real-form')).toHaveAttribute('data-name', white.real_form);
  await expect(out(page, 'b1', 'real-rank')).toHaveText(String(white.real_rank));
  await expect(out(page, 'b1', 'dim-k')).toHaveText(String(white.dim_k));
  await expect(deco(page, 'b1', 1)).toHaveAttribute('data-colour', 'white');
  await deco(page, 'b1', 1).click();
  await expect(deco(page, 'b1', 1)).toHaveAttribute('data-colour', 'black');
  await expect(out(page, 'b1', 'verdict')).toHaveText('admissible');
  await expect(out(page, 'b1', 'real-form')).toHaveAttribute('data-name', black.real_form);
  await expect(out(page, 'b1', 'real-rank')).toHaveText(String(black.real_rank));
  await expect(out(page, 'b1', 'dim-k')).toHaveText(String(black.dim_k));
  expect(GOLDEN.admissible_counts.A1!.real_forms_including_compact).toBe(2);
  // theta on the population (1): white sends it to (-1), black fixes it (prose of beat 1).
  expect(thetaOf(diagram('A1', [], [1]), [1])).toEqual([-1]);
  expect(thetaOf(diagram('A1', [1], [1]), [1])).toEqual([1]);
});

test('beat 2: play theta on (0,1,0)', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b2');
  await expect(out(page, 'b2', 'real-form')).toHaveCount(0);
  await expect(out(page, 'b2', 'theta-word')).toHaveText(SU4.w_X_word.join(' '));
  expect(await valuesOf(gameNodes(page, 'b2'))).toEqual(A3_ROOT_TWO.map(String));
  // The reader controls time (P9): nothing advances by itself.
  await page.waitForTimeout(1000);
  await expect(out(page, 'b2', 'theta-stage')).toHaveText('0');
  await expect(out(page, 'b2', 'moveCounter')).toHaveText('0');
  // Stage 1: tau is the identity. Stage 2: the word of w_X, letter by letter. Stage 3: every sign.
  const d = D_SU4;
  let p = fromLabels(d, A3_ROOT_TWO);
  const afterLetters: number[][] = [];
  for (const i of toPositions(d.board, SU4.w_X_word)) {
    p = mutate(d.board as Board<number>, p, i);
    afterLetters.push(inLabels(d, p));
  }
  await control(page, 'b2', 'theta-next').click();
  await expect(out(page, 'b2', 'theta-stage')).toHaveText('1');
  expect(await valuesOf(gameNodes(page, 'b2'))).toEqual(A3_ROOT_TWO.map(String));
  await expect(out(page, 'b2', 'theta-stages')).toContainText(afterLetters.map(minusTuple).join(', '));
  await control(page, 'b2', 'theta-next').click();
  await expect(out(page, 'b2', 'theta-stage')).toHaveText('2');
  expect(await valuesOf(gameNodes(page, 'b2'))).toEqual(afterLetters[afterLetters.length - 1]!.map(String));
  await control(page, 'b2', 'theta-next').click();
  await expect(out(page, 'b2', 'theta-stage')).toHaveText('3');
  const end = thetaOf(d, A3_ROOT_TWO);
  expect(await valuesOf(gameNodes(page, 'b2'))).toEqual(end.map(String));
  await expect(out(page, 'b2', 'moveCounter')).toHaveText('3');
  // verify.py section 19: (0,1,0) goes to (-1,-1,-1); the word of w_X gives (1,1,0) then (1,1,1).
  expect(afterLetters).toEqual([[1, 1, 0], [1, 1, 1]]);
  expect(end).toEqual([-1, -1, -1]);
});

test('beat 3: su(1,2) shadows', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b3');
  await expect(out(page, 'b3', 'shadow-table')).toHaveCount(1);
  const rows = out(page, 'b3', 'shadow-table').locator('tbody tr');
  await expect(rows).toHaveCount(SU12.multiplicities.length);
  // The roots above each shadow are the multiplicities of the record (short, then long).
  for (const [k, m] of SU12.multiplicities.entries()) await expect(rows.nth(k).locator('td').first()).toHaveText(String(m.mult));
  await expect(rows.nth(0).locator('th')).toHaveText('(1/2, 1/2)');
  await expect(rows.nth(1).locator('th')).toHaveText('(1, 1)');
  // The picture: lambda with multiplicity 2 and its double with multiplicity 1.
  const pic = out(page, 'b3', 'shadow-picture');
  await expect(pic.locator('[data-point="1"]')).toHaveAttribute('data-mult', String(SU12.multiplicities[0]!.mult));
  await expect(pic.locator('[data-point="2"]')).toHaveAttribute('data-mult', String(SU12.multiplicities[1]!.mult));
  await expect(pic.locator('[data-point="2"]')).toHaveAttribute('data-double', 'true');
  // The static table of A.5 agrees with the engine: the shadows of the three positive roots.
  const d = diagram('A2', SU12.black_nodes, SU12.tau);
  const shadows = GOLDEN.types.A2.positive_roots.map((r) => shadowText(d, fromLabels(d, r)));
  expect(shadows).toEqual(['(1/2, 1/2)', '(1/2, 1/2)', '(1, 1)']);
  const static_ = page.locator('table#su12-shadows tbody tr');
  await expect(static_.nth(0).locator('th')).toHaveText(shadows[0]!);
  await expect(static_.nth(1).locator('th')).toHaveText(shadows[2]!);
  // The images of theta in the static table are those of the engine.
  const images = GOLDEN.types.A2.positive_roots.map((r) => tuple(thetaOf(d, r)));
  expect(plain(await static_.nth(0).locator('td').nth(1).textContent())).toBe(`(0, 1) ↦ ${images[0]}; (1, 0) ↦ ${images[1]}`);
  expect(plain(await static_.nth(1).locator('td').nth(1).textContent())).toBe(`(1, 1) ↦ ${images[2]}`);
});

test('beat 4: the third light fails on A2 with node 1 black', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b4');
  for (const k of [1, 2, 3]) await expect(out(page, 'b4', `light-${k}`)).toHaveText('holds');
  await deco(page, 'b4', 1).click();
  const e = GOLDEN.satake_examples.find((x) => x.type === 'A2' && x.black_nodes.join() === '1' && x.tau.join() === '1,2')!;
  await expect(out(page, 'b4', 'light-1')).toHaveText(word(e.condition_1));
  await expect(out(page, 'b4', 'light-2')).toHaveText(word(e.condition_2));
  await expect(out(page, 'b4', 'light-3')).toHaveText(word(e.condition_3));
  await expect(out(page, 'b4', 'light-3')).toHaveText('fails');
  expect(plain(await out(page, 'b4', 'reason-3').textContent())).toContain('-1/2');
  expect(plain(await out(page, 'b4', 'reason-3').textContent())).toMatch(/node 2\b/);
  await expect(out(page, 'b4', 'verdict')).toHaveText('not admissible');
  for (const panel of ['data', 'shadows', 'restricted']) {
    await openPanel(page, 'b4', panel);
    for (const name of ['real-form', 'real-rank', 'dim-k', 'shadow', 'shadow-table', 'restricted-board']) await expect(out(page, 'b4', name), `${panel}: ${name}`).toHaveCount(0);
  }
});

test('the A3 examples show the recorded verdicts', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  await hydrate(page, 'b5');
  const rows = GOLDEN.satake_examples.filter((x) => x.type === 'A3');
  expect(rows).toHaveLength(5);
  const buttons = out(page, 'b5', 'examples').locator('[data-control="example"]');
  const seen = new Set<string>();
  const total = await buttons.count();
  expect(total).toBeGreaterThanOrEqual(rows.length);
  for (let k = 0; k < total; k++) {
    await openPanel(page, 'b5', 'lights');
    const state = async (): Promise<string> => `${norm(await out(page, 'b5', 'black-nodes').textContent())}|${norm(await out(page, 'b5', 'tau').textContent())}`;
    const previous = await state();
    await buttons.nth(k).click();
    // Consecutive rows of the table differ, so the loaded state differs from the one before.
    await expect.poll(state).not.toBe(previous);
    const [black, tau] = (await state()).split('|') as [string, string];
    const board = B('A3').n === tau.split('.').length ? 'A3' : 'A2';
    const e = GOLDEN.satake_examples.find((x) => x.type === board && x.black_nodes.join('.') === black && x.tau.join('.') === tau);
    expect(e, `example ${k}: ${board} ${black} ${tau}`).toBeDefined();
    if (board !== 'A3') continue;
    seen.add(`${black}|${tau}`);
    await expect(out(page, 'b5', 'light-1')).toHaveText(word(e!.condition_1));
    await expect(out(page, 'b5', 'light-2')).toHaveText(word(e!.condition_2));
    await expect(out(page, 'b5', 'light-3')).toHaveText(word(e!.condition_3));
    await expect(out(page, 'b5', 'verdict')).toHaveText(e!.admissible ? 'admissible' : 'not admissible');
    await openPanel(page, 'b5', 'data');
    const names = out(page, 'b5', 'real-form');
    await expect(names).toHaveCount(e!.real_forms.length);
    for (const [j, f] of e!.real_forms.entries()) await expect(names.nth(j)).toHaveAttribute('data-name', f);
  }
  expect([...seen].sort()).toEqual(rows.map((x) => `${x.black_nodes.join('.')}|${x.tau.join('.')}`).sort());
  // The prose names the two admissible rows by their golden names.
  const beat4 = plain(await proseText(page, '[data-beat="4"]'));
  for (const x of rows.filter((r) => r.admissible)) expect(beat4).toContain(x.real_forms[0]!);
});

test('beat 5: su(1,3) data', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b6');
  const r = SU13;
  await expect(out(page, 'b6', 'real-form')).toHaveAttribute('data-name', r.real_form);
  await expect(out(page, 'b6', 'real-rank')).toHaveText(String(r.real_rank));
  await expect(out(page, 'b6', 'restricted-type')).toHaveText(r.restricted_type_display!);
  await expect(out(page, 'b6', 'multiplicities')).toHaveText(`1: (${r.restricted_simple_multiplicities[0]!.join(', ')})`);
  await expect(out(page, 'b6', 'dim-k')).toHaveText(String(r.dim_k));
  await expect(out(page, 'b6', 'dim-p')).toHaveText(String(r.dim_p));
  expect(plain(await out(page, 'b6', 'character').textContent())).toBe(String(r.character));
  // The read-off rules of 2.15 on the record: dim k, dim p and the character from n, r, |Phi| and |Phi_X|.
  const n = r.rank;
  const rr = r.real_rank;
  const phi = GOLDEN.types.A3.n_roots;
  const phiX = r.roots_compact_imaginary;
  expect(n - rr + (phi + phiX) / 2).toBe(r.dim_k);
  expect(rr + (phi - phiX) / 2).toBe(r.dim_p);
  expect(2 * rr - n - phiX).toBe(r.character);
  // The prose prints the same numbers through <G> and golden formulas.
  const beat5 = plain(await proseText(page, '[data-beat="5"]'));
  expect(beat5).toContain(`\\dim\\mathfrak k=${r.dim_k}`);
  expect(beat5).toContain(`\\dim\\mathfrak p=${r.dim_p}`);
  expect(beat5).toContain(`the character is ${r.character}`);
});

test('beat 6: e6(-26) restricted board', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  await hydrate(page, 'b7');
  const r = E626;
  await expect(out(page, 'b7', 'restricted-name')).toHaveText(r.restricted_board!);
  await showMe(page, 'b7');
  // Every shadow has multiplicity 8: the pair at each node of the restricted board (the data panel).
  await openPanel(page, 'b7', 'data');
  await expect(out(page, 'b7', 'multiplicities')).toHaveText(r.restricted_orbits_in_bourbaki_order!.map((o, k) => `${k + 1}: (${r.restricted_simple_multiplicities[r.restricted_simple_orbits.findIndex((x) => x.join() === o.join())]!.join(', ')})`).join('; '));
  expect(r.multiplicities).toHaveLength(1);
  expect(r.multiplicities[0]!.mult).toBe(8);
  await openPanel(page, 'b7', 'restricted');
  await expect(out(page, 'b7', 'restricted-name')).toHaveText(r.restricted_board!);
  const before = plain(await out(page, 'b7', 'shadow-coordinates').textContent()).replace(/[()]/g, '').split(', ').map(Number);
  const populationBefore = await valuesOf(gameNodes(page, 'b7'));
  const moves = Number(norm(await out(page, 'b7', 'moveCounter').textContent()));
  await restrictedNode(page, 'b7', 2).click();
  // The composite word plays in steps; under reduced motion at once. Wait until it has finished.
  await expect(out(page, 'b7', 'composite-word')).toHaveCount(1);
  await expect.poll(async () => (await valuesOf(gameNodes(page, 'b7'))).join(','), { timeout: 20000 }).not.toBe(populationBefore.join(','));
  let last = '';
  await expect
    .poll(async () => {
      const now = (await valuesOf(gameNodes(page, 'b7'))).join(',');
      const stable = now === last;
      last = now;
      return stable;
    }, { intervals: [400, 400, 400, 800], timeout: 20000 })
    .toBe(true);
  // One step of the History for the whole composite move; its word has the letters of w_X, then those of the
  // longest word of X u O (here a sub-board of type D5): 32 letters for a move of reduced length 8.
  await expect(out(page, 'b7', 'moveCounter')).toHaveText(String(moves + 1));
  const orbit = r.restricted_orbits_in_bourbaki_order![1]!;
  const s = r.restricted_simple_orbits.findIndex((o) => o.join() === orbit.join());
  const letters = norm(await out(page, 'b7', 'composite-word').textContent()).split(' ');
  expect(letters.length).toBe(r.w_X_word.length + GOLDEN.types.D5.n_positive_roots);
  expect(letters.length).toBe(32);
  expect(letters.slice(0, r.w_X_word.length).map(Number)).toEqual(r.w_X_word);
  await expect(out(page, 'b7', 'composite-length')).toHaveText(String(r.restricted_reflection_word_lengths[s]));
  // The shadow is reflected: the coordinates change as a mutation of the restricted board at node 2.
  const after = restrictedMove(r.restricted_board!, before, 2);
  expect(plain(await out(page, 'b7', 'shadow-coordinates').textContent())).toBe(tuple(after));
  expect(after).not.toEqual(before);
  // The population reached is a root of E6.
  const roots = new Set([...positiveRoots(B('E6')), ...positiveRoots(B('E6')).map((v) => v.map((x) => (x === 0 ? 0 : -x)))].map((v) => inLabels(D_E626, v).join(',')));
  expect(roots.has((await valuesOf(gameNodes(page, 'b7'))).join(','))).toBe(true);
  // Then node 1: the answer of the prediction.
  await restrictedNode(page, 'b7', 1).click();
  await expect(out(page, 'b7', 'moveCounter')).toHaveText(String(moves + 2));
  await expect(out(page, 'b7', 'shadow-coordinates')).toHaveText(minusTuple(restrictedMove(r.restricted_board!, after, 1)));
});

test('beat 7: D4 catalogue', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b8');
  const expected = GOLDEN.satake.filter((x) => x.dynkin_type === 'D4').map((x) => x.real_form);
  const rows = out(page, 'b8', 'catalogue-row');
  await expect(rows).toHaveCount(GOLDEN.admissible_counts.D4!.catalogue_records);
  expect(expected.length).toBe(GOLDEN.admissible_counts.D4!.catalogue_records);
  for (const [k, f] of expected.entries()) await expect(rows.nth(k)).toHaveAttribute('data-name', f);
  await expect(out(page, 'b8', 'same-form')).toHaveCount(2);
  for (const [a, b] of [[SO26.real_form, SO8STAR.real_form], [SO8STAR.real_form, SO26.real_form]]) {
    expect(norm(await tool(page, 'b8').locator(`[data-out="catalogue-row"][data-name="${a}"] [data-out="same-form"]`).textContent())).toContain(b);
  }
  expect(GOLDEN.admissible_counts.D4!.real_forms_including_compact).toBe(GOLDEN.admissible_counts.D4!.catalogue_records - 1);
  // Black nodes 3 and 4 show both names, each with its own restricted type.
  await control(page, 'b8', 'picker').scrollIntoViewIfNeeded();
  await deco(page, 'b8', 3).click();
  await deco(page, 'b8', 4).click();
  await openPanel(page, 'b8', 'data');
  const names = out(page, 'b8', 'real-form');
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toHaveAttribute('data-name', SO26.real_form);
  await expect(names.nth(1)).toHaveAttribute('data-name', SO8STAR.real_form);
  await expect(names.nth(0).locator('[data-out="restricted-type"]')).toHaveText(SO26.restricted_type_display!);
  await expect(names.nth(1).locator('[data-out="restricted-type"]')).toHaveText(SO8STAR.restricted_type_display!);
});

test('beat 7: the multiplicities of so*(8) and su*(4) sit inside the E1 wrap', async ({ page }) => {
  await page.goto(ROUTE);
  const wrapped = page.locator('article [data-beat="7"] [data-unverified="E1"]');
  await expect(wrapped).toHaveCount(1);
  const inside = plain(await wrapped.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
    return copy.textContent ?? '';
  }));
  expect(inside).toContain(texOfRealForm(SO8STAR.real_form));
  expect(inside).toContain(`is ${SO8STAR.multiplicities[0]!.mult} on the short shadows and ${SO8STAR.multiplicities[1]!.mult} on the long ones`);
  // Every other sentence of the prose that names so*(8) or su*(4) states no multiplicity.
  const outside = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-unverified], [data-tool], [data-anatomy="sources"], script, style')) el.remove();
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(` ${k.querySelector('annotation')?.textContent ?? ''} `));
    for (const b of copy.querySelectorAll('p, li, td, th, figcaption, caption')) b.append(document.createTextNode(' '));
    return copy.textContent ?? '';
  });
  const named = sentences(outside).filter((s) => [SO8STAR.real_form, SU4.real_form, texOfRealForm(SO8STAR.real_form), texOfRealForm(SU4.real_form)].some((n) => s.includes(n)));
  expect(named.length).toBeGreaterThan(0);
  for (const s of named) expect(s, s).not.toMatch(/multiplicit|\(m_\\lambda|m_\{2\\lambda\}|\(\d+, \d+\)/);
  // So do the captions, questions and reveals of the tools (the lesson's own sentences).
  const props = await challengeProps(page);
  for (const c of props) for (const t of [c.goal, c.explanation]) if (/so\*\(8\)|su\*\(4\)/.test(t)) expect(t).not.toMatch(/multiplicit/);
  for (const id of ['b2', 'b5', 'b8']) {
    const caption = norm(await out(page, id, 'caption').textContent());
    expect(caption, id).toMatch(/so\*\(8\)|su\*\(4\)/);
    expect(caption, id).not.toMatch(/multiplicit|\(\d+, \d+\)/);
  }
});

test('beat 8: su(1,5) toggle', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b9');
  const r = SU15;
  await expect(out(page, 'b9', 'real-form')).toHaveAttribute('data-name', r.real_form);
  expect(r.tau_moves_black_nodes).toBe(true);
  expect(r.arrows).toEqual([[1, 5]]);
  const drawing = out(page, 'b9', 'decoration');
  // The preset opens with the toggle on: the hidden exchange of black nodes 2 and 4 is drawn.
  await expect(control(page, 'b9', 'toggle')).toBeChecked();
  await expect(drawing.locator('[data-black-arrow="2-4"]')).toHaveCount(1);
  await control(page, 'b9', 'toggle').uncheck();
  // Off: the drawing as printed tables show it, one arrow between nodes 1 and 5.
  await expect(drawing.locator('[data-black-arrow]')).toHaveCount(0);
  await expect(drawing.locator('[data-arrow]')).toHaveCount(r.arrows.length);
  await expect(drawing.locator(`[data-arrow="${r.arrows[0]!.join('-')}"]`)).toHaveCount(1);
  await control(page, 'b9', 'toggle').check();
  await expect(drawing.locator('[data-black-arrow]')).toHaveCount(1);
  await expect(drawing.locator('[data-black-arrow="2-4"]')).toHaveCount(1);
  // tau moves the black nodes 2 and 4: the prose says it, since the toggle needs JavaScript (P2).
  const d = diagram('A5', r.black_nodes, r.tau);
  const moved = r.black_nodes.filter((l) => r.tau[l - 1] !== l);
  expect(moved).toEqual([2, 4]);
  expect(d.black.length).toBe(3);
  expect(plain(await proseText(page, '[data-beat="8"]'))).toMatch(/exchanges the black nodes 2 and 4/);
  await openPanel(page, 'b9', 'theta');
  await expect(out(page, 'b9', 'theta-word')).toHaveText(r.w_X_word.join(' '));
});

// ---------------------------------------------------------------------------------------------
// Wording (instruction 5.17 tests 6, 7, 16, 17)
// ---------------------------------------------------------------------------------------------

/** The forbidden statement about a failed condition 3 (roster acceptance; SPEC 3 M9 beat 4). */
const NOT_AN_INVOLUTION = [/(θ|\\theta|theta)\s+(is|was)\s+not\s+(really\s+)?an\s+involution/i, /not\s+(really\s+)?an\s+involution/i, /fails?\s+to\s+be\s+an\s+involution/i, /no\s+longer\s+an\s+involution/i];

test('never says theta is not an involution', async ({ page }) => {
  // Not vacuous: the patterns catch the sentences they guard against, in both spellings of theta.
  for (const s of ['θ is not an involution', '\\theta is not an involution', 'then theta fails to be an involution']) expect(NOT_AN_INVOLUTION.some((re) => re.test(s)), s).toBe(true);
  await page.goto(ROUTE);
  const texts = [
    await page.locator('main').innerText(),
    (await page.locator('main .katex annotation').allTextContents()).join(' '),
    await proseText(page, 'article'),
    readFileSync(LESSON_PATH, 'utf8'),
    readFileSync(BUILT, 'utf8'),
  ];
  const props = await challengeProps(page);
  texts.push(...props.flatMap((c) => [c.goal, c.explanation]));
  for (const t of texts) for (const re of NOT_AN_INVOLUTION) expect(t).not.toMatch(re);
});

test('careful wording on a failed condition 3', async ({ page }) => {
  await page.goto(ROUTE);
  const list = sentences(await proseText(page, '[data-beat="4"]'));
  // (a) conditions 1 and 2 hold, and theta is an involution that permutes the roots.
  const a = list.filter((s) => /Conditions 1 and 2 hold/.test(s));
  expect(a).toHaveLength(1);
  expect(a[0]).toMatch(/Conditions 1 and 2 hold, and \\theta=-s_1 is an involution that permutes the roots/);
  // (b) no involution of the Lie algebra acts as this theta: the candidate has order 4.
  const b = list.filter((s) => /no involution of the Lie algebra/.test(s));
  expect(b).toHaveLength(1);
  expect(b[0]).toMatch(/fixes the root vectors of node 1/);
  expect(b[0]).toMatch(/has order 4/);
  // (c) the formula of beat 5 would give dim k = 5, against 3, 4 and 8 for the real forms of A2.
  const dims = ['sl(3,R)', 'su(1,2)', 'su(3)'].map((f) => record('A2', f).dim_k);
  expect(b[0]).toContain(`equal to ${5}, while the real forms of A_2 have ${dims[0]}, ${dims[1]} and ${dims[2]}`);
  expect(dims).not.toContain(5);
  const A2 = GOLDEN.types.A2;
  expect(A2.cartan.length - 1 + (A2.n_roots + GOLDEN.types.A1.n_roots) / 2).toBe(5);
  // (d) not the Satake diagram of any real form; no data.
  expect(list.filter((s) => /^So this decoration is not the Satake diagram of any real form, and the Studio shows no data for it\.$/.test(s))).toHaveLength(1);
  // (e) the statement about sl(3,R) and Vogan diagrams sits inside the E15 wrap, in beat 4.
  const e15 = page.locator('[data-beat="4"] [data-unverified="E15"]');
  await expect(e15).toHaveCount(1);
  const wrapped = plain(await e15.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(k.querySelector('annotation')?.textContent ?? ''));
    return copy.textContent ?? '';
  }));
  expect(wrapped).toContain('maximally compact Cartan subalgebra');
  expect(wrapped).toContain('Vogan diagrams');
  expect(wrapped).toContain(texOfRealForm('sl(3,R)'));
  const outsideE15 = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-unverified="E15"], [data-tool], script, style')) el.remove();
    return copy.textContent ?? '';
  });
  expect(outsideE15).not.toMatch(/imaginary and non-compact/);
  // The light's reason and the lesson give the same number at node 2.
  expect(list.join(' ')).toMatch(/at node 2 the number is -1\/2/);
});

test('no claim of novelty', async ({ page }) => {
  await page.goto(ROUTE);
  const t = `${await page.locator('main').innerText()} ${readFileSync(LESSON_PATH, 'utf8')}`.toLowerCase();
  for (const phrase of ['novel', 'for the first time', 'has not been done', 'new connection', 'first to', 'unexplored', 'never been', 'original idea', 'no one has', 'nobody has']) expect(t, phrase).not.toContain(phrase);
  await expect(page.locator('[data-unverified="E8"]')).toHaveCount(0);
});

test('the character formula is presented as derived', async ({ page }) => {
  await page.goto(ROUTE);
  for (const scope of ['[data-beat="5"]', '[data-anatomy="seen"]']) {
    const paragraphs = await page.locator(`${scope} p, ${scope} li`).evaluateAll((els) =>
      els
        .filter((el) => [...el.querySelectorAll('annotation')].some((a) => (a.textContent ?? '').includes('2r-n-|\\Phi_X|')))
        .map((el) => {
          const copy = el.cloneNode(true) as HTMLElement;
          for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(` ${k.querySelector('annotation')?.textContent ?? ''} `));
          for (const c of copy.querySelectorAll('a.cite')) c.replaceWith(document.createTextNode(' CITATION '));
          return (copy.textContent ?? '').replace(/\s+/g, ' ');
        }),
    );
    expect(paragraphs.length, scope).toBe(1);
    const sentence = sentences(paragraphs[0]!).filter((s) => s.includes('2r-n-|\\Phi_X|'));
    expect(sentence).toHaveLength(1);
    expect(sentence[0]).toMatch(/derived on this site/);
    expect(sentence[0]).toMatch(/verified by computation/);
    expect(sentence[0]).not.toContain('CITATION');
    expect(sentence[0]).not.toMatch(/Helgason|Knapp|Kolb|Araki|Hel01|Kna02|Kol14/);
  }
});

// ---------------------------------------------------------------------------------------------
// The page as a whole
// ---------------------------------------------------------------------------------------------

test('anatomy of 8.2', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('Real forms and Satake diagrams');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('The same board describes several different real Lie algebras. What tells them apart?');
  await expect(article.locator('[data-anatomy="draft"]'), 'draft mark (D17)').toHaveCount(1);
  await expect(article.locator('[data-anatomy="beat"]')).toHaveCount(9);
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
      q('#su12-shadows'),
      q('[data-beat="4"]'),
      q('[data-beat="5"]'),
      q('[data-beat="6"]'),
      q('[data-beat="7"]'),
      q('[data-beat="8"]'),
      q('[data-beat="9"]'),
      q('[data-static-figure="vogan"]'),
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
  // Instance ids in reading order; the first figure is the first thing drawn on the page.
  const ids = await page.locator('[data-tool]').evaluateAll((els) => els.map((e) => e.getAttribute('data-instance')));
  expect(ids).toEqual(TOOLS.map(({ id }) => id));
  // The links: the Atlas page of A3, the next module M10 (released with P6-A8; MERGE, on its merge), the
  // sandbox with A3 last.
  const base = new URL(page.url()).pathname.replace(/modules\/m9-real-forms\/$/, '');
  await expect(article.locator('[data-anatomy="links"] a[data-link="atlas"]')).toHaveAttribute('href', `${base}atlas/A3/`);
  const links = await article.locator('[data-anatomy="links"] a').evaluateAll((els) => els.map((e) => e.getAttribute('data-link')));
  expect(links[links.length - 1]).toBe('sandbox');
  expect((await article.locator('[data-anatomy="links"] a[data-link="sandbox"]').getAttribute('href')) ?? '').toMatch(/tools\/sandbox\/\?g=A3$/);
  const next = article.locator('[data-anatomy="links"] a[data-link="next"]');
  await expect(next).toHaveCount(1);
  await expect(next).toHaveAttribute('href', `${base}modules/m10-atlas/`);
  await expect(article.locator('a[href*="m10"]')).toHaveCount(1);
  // "What we have seen" carries its provenance, and so does each statement.
  const seen = article.locator('[data-anatomy="seen"]');
  for (const p of ['Kol14', 'DK19', 'verified by computation']) await expect(seen.locator(`[data-provenance="${p}"]`), p).toHaveCount(1);
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBe(4);
  for (let k = 0; k < (await statements.count()); k++) expect(norm(await statements.nth(k).textContent()), `statement ${k + 1}`).toMatch(/verified by computation/);
  // The frontmatter of CONTRACTS 7 with the values of instruction 5.1; every source key cited in the text.
  const source = readFileSync(LESSON_PATH, 'utf8');
  const front = /^---\n([\s\S]*?)\n---/.exec(source)![1]!;
  expect(front).toMatch(/^title: "Real forms and Satake diagrams"$/m);
  expect(front).toMatch(/^module: 9$/m);
  expect(front).toMatch(/^phase: 6$/m);
  expect(front).toMatch(/^released: true$/m);
  expect(front).toMatch(/^draft: true$/m);
  expect(front).toMatch(/^outcomes: \["LO9"\]$/m);
  const keys = JSON.parse(/^sources:\s*(\[.*\])\s*$/m.exec(front)![1]!) as string[];
  for (const k of ['Sat60', 'Ara62', 'Hel01', 'Kol14', 'DK19', 'Kna02']) expect(keys, k).toContain(k);
  for (const k of keys) await expect(article.locator(`[data-anatomy="sources"] [data-source="${k}"]`), k).toHaveCount(1);
  for (const k of new Set([...source.matchAll(/<Cite k="([^"]+)"/g)].map((m) => m[1]!))) expect(keys, k).toContain(k);
  for (const k of keys) expect(source, `[${k}] is cited in the text`).toMatch(new RegExp(`<Cite k="${k}"`));
  // The defined terms in bold on first use (8.4), for the glossary (Appendix C rows).
  const bold = await article.locator('[data-anatomy="beat"] strong').allTextContents();
  for (const term of ['real form', 'involution', 'white', 'black', 'compact', 'Satake diagram', 'arrow', 'shadow', 'multiplicity', 'admissible', 'real rank', 'character', 'composite move', 'restricted board', 'split form', 'quasi-split form']) expect(bold, term).toContain(term);
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  const tools = islands.filter((i) => /T13SatakeStudio/.test(i));
  expect(tools.length).toBe(TOOLS.length);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/T13SatakeStudio/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
  expect(islands.length).toBe(TOOLS.length + CHALLENGE_TOOLS.length);
  // One T13 chunk for all twelve instances; no E7 or E8 board on the page (E-9: their data need the worker).
  expect(new Set(tools.map((i) => /component-url="([^"]*)"/.exec(i)![1])).size).toBe(1);
  for (const t of TOOLS) expect(['E7', 'E8']).not.toContain(t.board);
});

test('no default state starts the worker', async ({ page, context }) => {
  test.setTimeout(240_000);
  const requested: string[] = [];
  await context.route(WORKER, async (r) => {
    requested.push(r.request().url());
    await r.abort();
  });
  page.on('worker', (w) => requested.push(`worker started: ${w.url()}`));
  await page.goto(ROUTE);
  for (const { id, black, tau } of TOOLS) {
    await hydrate(page, id);
    await expect(out(page, id, 'black-nodes'), id).toHaveText(black.join('.'));
    await expect(out(page, id, 'tau'), id).toHaveText(tau.join('.'));
  }
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual([]);
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M9 prose words: ${words}`);
  expect(words).toBeGreaterThanOrEqual(800);
  expect(words).toBeLessThanOrEqual(1800);
});

// The two dashes, named by their code points so that this file holds neither (D14; COMMON 4.4).
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

test('no em-dash in the built text', async ({ page }) => {
  for (const [what, path] of [
    ['the built lesson', BUILT],
    ['the lesson source', LESSON_PATH],
    ['this test file', SPEC_PATH],
    ['the decisions fragment', FRAGMENT_PATH],
  ] as const) {
    const text = readFileSync(path, 'utf8');
    expect(text.includes(EM_DASH), `U+2014 in ${what}`).toBe(false);
    expect(text.includes(EN_DASH), `U+2013 in ${what}`).toBe(false);
  }
  await page.goto(ROUTE);
  const t = await page.locator('main').innerText();
  expect(t.includes(EM_DASH)).toBe(false);
  expect(t.includes(EN_DASH)).toBe(false);
});

// ---------------------------------------------------------------------------------------------
// Numbers (8.4, 9.2; instruction 5.15). Method (as M8.spec.ts): every typed number of the source is found by
// scripts/numbers-in-prose.mjs (prose, $...$ formulas, fallbacks), or sits in a <Tex> formula (golden paths
// removed) or a brace string {'...'}. Each such occurrence must match an entry of ALLOWED: its text and a
// pattern for the words around it, with its reason (instruction 5.15); every entry must be used.
// ---------------------------------------------------------------------------------------------

type Allowed = { text: string | RegExp; around: RegExp; reason: string };
/** Names, not numbers: board names (A_2, E_6), real forms as scripts/names.mjs typesets them, s_1 and the like. */
const BOARD = /^[A-H]_\d$/;
const REAL_FORM_TEX = new Set(GOLDEN.satake.flatMap((r) => [texOfRealForm(r.real_form), altOfRealForm(r.real_form)?.tex].filter((x): x is string => typeof x === 'string')));
const ALLOWED: Allowed[] = [
  // Constants of the formulas of 2.15 and of the conditions of [Kol14].
  { text: '\\tau^2=1', around: /symmetry \$\\tau\$ of the board with|data-condition="1">/, reason: 'condition 1 of 2.15: tau squared is the identity' },
  { text: '\\bar\\alpha=\\tfrac12(\\alpha-\\theta\\alpha)', around: /casts a \*\*shadow\*\*/, reason: 'the shadow of 2.15' },
  { text: '\\theta(p_1,p_2)=-(p_2,p_1)', around: /exchanging the two nodes/, reason: 'theta of su(1,2), A.5 (subscripts are names)' },
  { text: '(m_\\lambda,m_{2\\lambda})', around: /each with a pair/, reason: 'the name of the pair of multiplicities (2 lambda)' },
  { text: '(m_\\lambda,m_{2\\lambda})=', around: /the pair is <Tex/, reason: 'the name of the pair of multiplicities (2 lambda), before its golden value' },
  { text: '\\theta=-s_1', around: /Conditions \{'1'\} and \{'2'\} hold/, reason: 'theta = -s_1 on A2 with node 1 black (2.15; s_1 is a name)' },
  { text: '4', around: /has order <Tex src="4"\/>/, reason: 'the order 4 of the candidate, no golden key (2.15, a 3 by 3 matrix computation)' },
  { text: '\\dim\\mathfrak k=(n-r)+\\tfrac12(|\\Phi|+|\\Phi_X|),\\qquad \\dim\\mathfrak p=r+\\tfrac12(|\\Phi|-|\\Phi_X|).', around: /display/, reason: 'the read-off rules of 2.15, verbatim' },
  { text: '\\dim\\mathfrak p-\\dim\\mathfrak k=2r-n-|\\Phi_X|', around: /\*\*character\*\*/, reason: 'the derived character formula of 2.15' },
  { text: '2r-n-|\\Phi_X|', around: /The character/, reason: 'the derived character formula of 2.15' },
  { text: '\\bar C_{OO\'}=2(\\bar\\alpha_O,\\bar\\alpha_{O\'})/(\\bar\\alpha_O,\\bar\\alpha_O)', around: /Cartan matrix/, reason: 'the Cartan matrix of the restricted board, 2.15' },
  { text: '\\theta=-1', around: /split form/, reason: 'theta = -1 on the split form (2.15 special shapes)' },
  { text: 'r=1', around: /<Tex src="A_1"\/> when <Tex src="r=1"\/>/, reason: 'the restricted board A1 of BC1, real rank r = 1 (2.15)' },
  { text: 'q-p\\ge3', around: /whenever/, reason: 'the family su(p,q) with q - p >= 3 (2.15)' },
  { text: 'p\\le n-2', around: /with <Tex/, reason: 'the family so(p,2n-p) with p <= n - 2 (2.15)' },
  { text: 'n\\ge2', around: /compact forms of/, reason: 'the compact forms of A_n, n >= 2 (2.15)' },
  { text: '\\mathfrak{so}(p,2n-p)', around: /no arrow is drawn, for/, reason: 'a family name of 2.15' },
  { text: '\\mathfrak{sl}(3)', around: /the Lie algebra/, reason: 'the complex Lie algebra sl(3), a name' },
  // Node labels, condition and beat numbers, written as brace strings.
  { text: /^[1-6]$/, around: /(?:[Nn]odes?|city|[Cc]onditions?|[Bb]eat|exchanging) (?:\{'[1-6]'\}(?:, | and ))*\{'[1-6]'\}$/, reason: 'a node label, a condition number or a beat number' },
  // Locators of the sources.
  { text: 'Definition 2.3', around: /Kol14/, reason: 'Definition 2.3 of [Kol14]' },
  { text: 'equation (2.8) and Theorem 2.4', around: /DK19/, reason: 'equation (2.8) and Theorem 2.4 of [DK19]' },
  { text: 'pp. 532-534', around: /Hel01/, reason: 'the pages of the table of [Hel01] (S2)' },
  { text: 'pp. 32-33', around: /Ara62/, reason: 'the pages of the table of [Ara62] (S2)' },
  { text: 'section VI.8', around: /Kna02/, reason: 'section VI.8 of [Kna02] (S)' },
  { text: 'The undecorated diagram A2, drawn twice', around: /<title/, reason: 'the title of the static drawing (a board name)' },
];

/** Every <Tex> source (golden paths removed) and brace string of the source that holds a digit, with its index. */
function typedOccurrences(source: string): { text: string; index: number }[] {
  const found: { text: string; index: number }[] = [];
  for (const m of source.matchAll(/<Tex\b[^>]*?\bsrc="([^"]*)"/g)) {
    const tex = m[1]!.replace(/\{\{[^}]*\}\}/g, '');
    if (/\d/.test(tex) && !BOARD.test(tex) && !REAL_FORM_TEX.has(tex)) found.push({ text: tex, index: m.index! });
  }
  for (const m of source.matchAll(/\{'([^']*)'\}/g)) if (/\d/.test(m[1]!)) found.push({ text: m[1]!, index: m.index! });
  return found;
}

test('numbers in prose', () => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const findings = scanSource(source, 'site/src/content/modules/m9-real-forms.mdx');
  // Nothing typed in prose, in a $...$ formula or in a fallback.
  expect(findings).toEqual([]);
  const used = new Set<Allowed>();
  const unexplained: string[] = [];
  for (const { text, index } of typedOccurrences(source)) {
    const before = source.slice(Math.max(0, index - 60), index + 2 + text.length + 2);
    const around = source.slice(Math.max(0, index - 60), index + text.length + 60);
    const hit = ALLOWED.find((a) => (typeof a.text === 'string' ? a.text === text && a.around.test(around) : a.text.test(text) && a.around.test(before)));
    if (hit) used.add(hit);
    else unexplained.push(`${text} in ...${around.replace(/\s+/g, ' ')}...`);
  }
  expect(unexplained, 'typed numbers outside the allowlist').toEqual([]);
  expect(ALLOWED.filter((a) => !used.has(a)).map((a) => String(a.text)), 'allowlist entries not used').toEqual([]);
  // The scan is not vacuous: a number added at the end of a prose line is found.
  const lines = source.split('\n');
  let probed = 0;
  for (const [k, l] of lines.entries()) {
    if (!/^[A-Z]/.test(l)) continue;
    const copy = [...lines];
    copy[k] = `${l} 987654`;
    expect(scanSource(copy.join('\n'), 'probe').some((f) => f.kind === 'prose' && f.number === '987654'), `line ${k + 1}`).toBe(true);
    probed++;
  }
  expect(probed).toBeGreaterThan(10);
  // Deny list: outside <G>, {{path}}, the exports, the drawing of beat 9, the real-form names, quoted strings
  // and template literals (labels and interpolations, checked below), the source types none of these values.
  let outsideGolden = source
    .replace(/<G\b[^>]*\/>/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/^export .*$/gm, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/'[^'\n]*'/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
  for (const name of REAL_FORM_TEX) outsideGolden = outsideGolden.split(name).join(' ');
  const deny: [RegExp, string][] = [
    [/\b(?:167|166|135)\b/, 'a count of the catalogue'],
    [/\(\s*0\s*,\s*1\s*,\s*0\s*\)|\(\s*0\s*,\s*0\s*,\s*1\s*\)|\(\s*1\s*,\s*1\s*,\s*1\s*\)|\(\s*1\s*,\s*1\s*,\s*0\s*\)/, 'a root of A3 typed'],
    [/\b(?:52|26|78)\b/, 'a dimension or the character of e6(-26)'],
    [/\b(?:32|20|12)\b/, 'a length of a word of e6(-26)'],
    [/\(\s*[248]\s*,\s*[01]\s*\)/, 'a pair of multiplicities typed'],
    [/\bdim[^0-9<]{0,20}\b(?:9|10|16)\b/, 'a dimension of su(1,3), su*(4) or so*(8) typed'],
  ];
  for (const [re, what] of deny) expect(outsideGolden, what).not.toMatch(re);
});

/**
 * The literal text the lesson source gives to the captions, questions, reveals, goals and explanations of its
 * tools and challenges (string and template literals, with every ${...} interpolation removed), by instance id
 * and property.
 */
function literalTexts(source: string): { where: string; text: string }[] {
  const found: { where: string; text: string }[] = [];
  for (const tag of source.matchAll(/<(T13SatakeStudio|Challenge)\b[\s\S]*?\/>\n/g)) {
    const t = tag[0];
    const id = /\b(?:id|for)="(b\d+)"/.exec(t)?.[1] ?? '?';
    const props = [
      ...[...t.matchAll(/\b(caption|goal|explanation)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]),
      ...[...t.matchAll(/\b(caption|goal|explanation)=\{`((?:[^`$]|\$\{(?:[^{}]|\{[^{}]*\})*\})*)`\}/g)].map((m) => [m[1]!, m[2]!]),
      ...[...t.matchAll(/\b(question|reveal): `((?:[^`$]|\$\{(?:[^{}]|\{[^{}]*\})*\})*)`/g)].map((m) => [m[1]!, m[2]!]),
    ];
    for (const [prop, text] of props) found.push({ where: `${id} ${prop}`, text: text.replace(/\$\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, ' ') });
  }
  return found;
}
/** Names and labels: board names, node labels, conditions, stages, the restricted node of a click. */
function withoutNamesAndLabels(text: string): string {
  return text
    .replace(/\b[A-H]\d\b/g, ' ')
    .replace(/\b(?:[Nn]odes?|[Cc]onditions?|stage|exchanging|between nodes)\s+\d+(?:(?:,| and)\s+\d+)*/g, ' ')
    .replace(/\b(?:node|nodes)\s+\d+\b/g, ' ');
}

test('numbers typed in captions, questions, reveals, goals and explanations', () => {
  const texts = literalTexts(readFileSync(LESSON_PATH, 'utf8'));
  expect(texts.filter((t) => t.where.endsWith('caption')).length).toBe(TOOLS.length);
  expect(texts.filter((t) => /question|reveal/.test(t.where)).length).toBe(4);
  expect(texts.filter((t) => /goal|explanation/.test(t.where)).length).toBe(2 * CHALLENGE_TOOLS.length);
  const unexplained: string[] = [];
  for (const { where, text } of texts) for (const v of withoutNamesAndLabels(text).match(/\d+/g) ?? []) unexplained.push(`${where}: ${v} in ${text}`);
  expect(unexplained).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Challenges (8.2 item 6, 8.5, 9.2): each check reports success exactly when its goal is met
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
  for (const c of props) {
    expect(c.check.kind).toBe('out');
    expect(c.check.name).toBe('shadow');
  }
});

/**
 * Every state the reader can reach in T13: a named type, a decoration (any black set, any symmetry of order at
 * most 2) and, when it is admissible, any root on the game board (the root picker offers every root; theta and
 * the composite moves send roots to roots). For each, the text of data-out="shadow" (t13/model.ts), absent when
 * the decoration is not admissible.
 */
function allShadowTexts(): Map<string, Set<string>> {
  const texts = new Map<string, Set<string>>();
  for (const type of TYPES) {
    const board = B(type);
    for (let mask = 0; mask < 1 << board.n; mask++) {
      const black: number[] = [];
      for (let i = 0; i < board.n; i++) if (mask & (1 << i)) black.push(i);
      for (const tau of involutions(board)) {
        const d: SatakeDiagram = { board, black, tau };
        if (!admissibility(d).admissible) continue;
        const key = `${type}|${toLabels(board, black).sort((a, b) => a - b).join('.')}|${inLabels(d, tau.map((t) => toLabels(board, [t])[0]!)).join('.')}`;
        for (const r of rootsOffered(board)) {
          const t = shadowText(d, r);
          if (!texts.has(t)) texts.set(t, new Set());
          texts.get(t)!.add(key);
        }
      }
    }
  }
  return texts;
}

test('each challenge check is met exactly by the decorations of its goal (all boards, all roots)', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(ROUTE);
  const props = await challengeProps(page);
  const check = (id: string): string => props.find((p) => p.for === id)!.check.equals!;
  const texts = allShadowTexts();
  const keyOf = (type: string, black: number[], tau: number[]): string => `${type}|${[...black].sort((a, b) => a - b).join('.')}|${tau.join('.')}`;
  const admissibleOn = (type: string): { black: number[]; tau: number[]; d: SatakeDiagram }[] => {
    const board = B(type);
    const list: { black: number[]; tau: number[]; d: SatakeDiagram }[] = [];
    for (let mask = 0; mask < 1 << board.n; mask++) {
      const blackP: number[] = [];
      for (let i = 0; i < board.n; i++) if (mask & (1 << i)) blackP.push(i);
      for (const tauP of involutions(board)) {
        const d: SatakeDiagram = { board, black: blackP, tau: tauP };
        if (!admissibility(d).admissible) continue;
        list.push({ black: toLabels(board, blackP), tau: inLabels(d, tauP.map((t) => toLabels(board, [t])[0]!)), d });
      }
    }
    return list;
  };
  // b10: on D5 with nodes 1 and 3 black, the tau that turns all three lights green.
  const goal10 = admissibleOn('D5').filter((x) => [...x.black].sort().join() === '1,3');
  expect(goal10.map((x) => keyOf('D5', x.black, x.tau))).toEqual([keyOf('D5', SO10.black_nodes, SO10.tau)]);
  expect([...texts.get(check('b10'))!]).toEqual(goal10.map((x) => keyOf('D5', x.black, x.tau)));
  expect(check('b10')).toBe(shadowText(goal10[0]!.d, defaultRoot(goal10[0]!.d)));
  // b11: on E6, a decoration with a black node and an arrow that all three lights accept.
  const goal11 = admissibleOn('E6').filter((x) => x.black.length > 0 && x.tau.some((t, k) => t !== k + 1 && !x.black.includes(k + 1)));
  expect(goal11.map((x) => keyOf('E6', x.black, x.tau))).toEqual([keyOf('E6', E614.black_nodes, E614.tau)]);
  expect([...texts.get(check('b11'))!]).toEqual(goal11.map((x) => keyOf('E6', x.black, x.tau)));
  expect(check('b11')).toBe(shadowText(goal11[0]!.d, defaultRoot(goal11[0]!.d)));
  // b12: on e6(-26), the shadow at the coordinates the goal names; only there, and only for those roots.
  const goal = props.find((p) => p.for === 'b12')!.goal;
  const want = /\(([^()]*)\)\.?$/.exec(goal)![1]!.replace(/−/g, '-').split(', ').map(Number);
  expect([...texts.get(check('b12'))!]).toEqual([keyOf('E6', E626.black_nodes, E626.tau)]);
  const now = computeNow(D_E626, admissibility(D_E626))!;
  const data = assembleData(now.sat, now.rb, now.records, D_E626);
  for (const r of rootsOffered(D_E626.board as Board<number>)) {
    const c = coordinatesInBourbaki(D_E626, data, shadow2(D_E626, r))!;
    expect(shadowText(D_E626, r) === check('b12'), `root ${r}`).toBe(c.join() === want.join());
  }
  // The goal is three composite moves away from the start (0, 1): not the start, and not one or two moves away.
  const start = coordinatesInBourbaki(D_E626, data, shadow2(D_E626, defaultRoot(D_E626)))!;
  const near = new Set<string>([start.join()]);
  for (const a of [1, 2]) {
    const one = restrictedMove(E626.restricted_board!, start, a);
    near.add(one.join());
    for (const b of [1, 2]) near.add(restrictedMove(E626.restricted_board!, one, b).join());
  }
  expect(near.has(want.join())).toBe(false);
});

test('challenge: on D5 with nodes 1 and 3 black, find tau', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b10');
  await hydrate(page, 'b10');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await expect(out(page, 'b10', 'verdict')).toHaveText('not admissible');
  // A wrong step: node 1 white (an admissible-looking change that is not the goal).
  await deco(page, 'b10', 1).click();
  await expect(out(page, 'b10', 'black-nodes')).toHaveText('3');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await deco(page, 'b10', 1).click();
  await expect(out(page, 'b10', 'black-nodes')).toHaveText(SO10.black_nodes.join('.'));
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await tool(page, 'b10').locator(`[data-control="tau"][data-tau="${SO10.tau.join('.')}"]`).check();
  await expect(out(page, 'b10', 'verdict')).toHaveText('admissible');
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.', { timeout: 20000 });
  await expect(out(page, 'b10', 'real-form')).toHaveAttribute('data-name', SO10.real_form);
});

test('challenge: on E6, a decoration with a black node and an arrow', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Wrong steps: e6(-26) has black nodes but no arrow; nodes 3, 4, 5 black with tau the identity is not admissible.
  for (const l of E626.black_nodes) await deco(page, 'b11', l).click();
  await expect(out(page, 'b11', 'verdict')).toHaveText('admissible');
  await expect(out(page, 'b11', 'real-form')).toHaveAttribute('data-name', E626.real_form);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await deco(page, 'b11', 2).click();
  await expect(out(page, 'b11', 'black-nodes')).toHaveText(E614.black_nodes.join('.'));
  await expect(out(page, 'b11', 'verdict')).toHaveText('not admissible');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await tool(page, 'b11').locator(`[data-control="tau"][data-tau="${E614.tau.join('.')}"]`).check();
  await expect(out(page, 'b11', 'verdict')).toHaveText('admissible');
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.', { timeout: 20000 });
  await expect(out(page, 'b11', 'real-form')).toHaveAttribute('data-name', E614.real_form);
});

test('challenge: on e6(-26), bring the shadow to the coordinates of the goal', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b12');
  await hydrate(page, 'b12');
  const props = await challengeProps(page);
  const goal = props.find((p) => p.for === 'b12')!.goal;
  const want = /\(([^()]*)\)\.?$/.exec(goal)![1]!.replace(/−/g, '-').split(', ').map(Number);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Play the restricted game, choosing each node by the engine, until the coordinates are those of the goal.
  let c = plain(await out(page, 'b12', 'shadow-coordinates').textContent()).replace(/[()]/g, '').split(', ').map(Number);
  const search = (from: number[], depth: number): number[] | null => {
    if (depth === 0) return from.join() === want.join() ? [] : null;
    for (const l of [1, 2]) {
      const rest = search(restrictedMove(E626.restricted_board!, from, l), depth - 1);
      if (rest) return [l, ...rest];
    }
    return null;
  };
  // The shortest play, by iterative deepening.
  let path: number[] | null = null;
  for (let depth = 0; depth <= 4 && path === null; depth++) path = search(c, depth);
  expect(path).not.toBeNull();
  expect(path!.length).toBe(3);
  for (const [k, l] of path!.entries()) {
    await restrictedNode(page, 'b12', l).click();
    c = restrictedMove(E626.restricted_board!, c, l);
    await expect(out(page, 'b12', 'shadow-coordinates')).toHaveText(minusTuple(c));
    if (k < path!.length - 1) await expect(challenge.locator('[data-challenge-result]'), `after move ${k + 1}`).toHaveCount(0);
  }
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.', { timeout: 20000 });
});

test('the prose does not print the answers of the challenges', async ({ page }) => {
  await page.goto(ROUTE);
  const prose = norm(await proseText(page, 'article'));
  expect(prose).not.toContain(texOfRealForm(SO10.real_form));
  for (const s of sentences(prose).filter((x) => x.includes('D_5'))) expect(s, s).not.toMatch(/exchang|swap|\\tau/);
  for (const s of sentences(prose).filter((x) => x.includes('E_6'))) expect(s, s).not.toMatch(/nodes 3, 4 and 5/);
  const props = await challengeProps(page);
  const goal = props.find((p) => p.for === 'b12')!.goal;
  const want = /\(([^()]*)\)\.?$/.exec(goal)![1]!.replace(/−/g, '-').split(', ').map(Number);
  // (The A.5 table holds (-1, 0) as theta of a root of A2, which is not a coordinate on a restricted board.)
  const aboutCoordinates = sentences(plain(prose)).filter((s) => /coordinate/.test(s));
  expect(aboutCoordinates.length).toBeGreaterThan(0);
  for (const s of aboutCoordinates) expect(s.replace(/\s/g, ''), s).not.toContain(`(${want.join(',')})`);
});

// ---------------------------------------------------------------------------------------------
// Items of Appendix E, links
// ---------------------------------------------------------------------------------------------

test('E1 and E15 are wrapped, with fallbacks that stay true', async ({ page }) => {
  const items = JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { id: string; status: string }[];
  for (const id of ['E1', 'E15']) expect(items.find((i) => i.id === id)?.status, id).toBe('open');
  const source = readFileSync(LESSON_PATH, 'utf8');
  const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
  expect(wraps.map((a) => /\bitem="([^"]*)"/.exec(a)?.[1])).toEqual(['E15', 'E1']);
  for (const attrs of wraps) {
    const fallback = /\bfallback="([^"]*)"/.exec(attrs)?.[1] ?? '';
    expect(fallback, attrs).not.toBe('');
    // No number, no word on the status of the item, no claim about a book.
    expect(fallback, attrs).not.toMatch(/\d|checked|unverified|open item|Helgason|Araki|Knapp/i);
  }
  // The [U] statements of SOURCES.md 11.4 and Appendix F that E17 covers are not used.
  for (const phrase of ['Table VI', 'Chapter X', 'CoReLG', 'GPL', 'no interactive', 'Wikipedia', 'inner']) expect(source, phrase).not.toContain(phrase);
  await page.goto(ROUTE);
  for (const id of ['E1', 'E15']) {
    const marks = page.locator(`article [data-unverified="${id}"] a.unverified-mark`);
    await expect(marks, id).toHaveCount(1);
    const url = new URL((await marks.getAttribute('href')) ?? '', page.url());
    expect(url.pathname).toMatch(/open-items\/?$/);
    expect(url.hash).toBe(`#${id}`);
  }
});

test('links resolve', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  const base = new URL(page.url()).pathname.replace(/modules\/m9-real-forms\/$/, '');
  // The hand-written link of beat 7: module six, where the averaged roots are built.
  const m6 = page.locator('[data-beat="7"] a[data-link="m6"]');
  await expect(m6).toHaveCount(1);
  expect(await m6.getAttribute('href')).toBe(`${base}modules/m6-multiple-edges/`);
  const hrefs = await page.locator('article a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  const internal = [...new Set(hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//')).map((h) => h.split('#')[0]!))];
  expect(internal.length).toBeGreaterThan(3);
  for (const h of internal) {
    expect(h.startsWith(base), h).toBe(true);
    const r = await page.request.get(h);
    expect(r.status(), h).toBe(200);
  }
  for (const h of hrefs.filter((x) => x.includes('glossary'))) expect(h.startsWith(`${base}glossary/#`) || h.startsWith(`${base}glossary#`), h).toBe(true);
  await page.goto(`${base}modules/m6-multiple-edges/`);
  await expect(page.locator('[data-anatomy="title"]')).not.toHaveText('');
});
