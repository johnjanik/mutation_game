// P4-A6: lesson M7, "Geometry: mirrors, polytopes and the E8 picture", against the built site (SPEC.md 3 M7,
// 2.14, 2.17, 4 T10, 4.0, 6.6, 7.3, 7.4, 7.6, 8.2, 8.4, 8.5, 9.2, Appendix C, E items 7 and 9, F;
// build-plan/agents/P4-A6-lesson-m7.md 5.14). Run after `npm run build` against `astro preview`, one
// Playwright run at a time. The pattern is that of M5.spec.ts and M6.spec.ts. Every expected number with a
// golden value is read from reference/golden_data.json; the hexagon counts, which have none, are computed
// here with the engine (the only constants typed are the statements of 2.14 about that hexagon).
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("geometry"), data-instance (b1 to b13), data-moves,
//     data-hydrated="true"; data-out caption, notice, noscript; the "Show as table" tables
//   node buttons (P0-A5 Board, the ring board of T10): data-node, data-board ("numbers"), data-value,
//     data-can-act, and the disabled attribute while a prediction is open
//   T10, site/src/components/tools/t10/config.ts T10_OUTS (listed in site/tests/e2e/T10.spec.ts):
//     snapshot (the build-time SVG: circle per point, path segments in g[id$="-segments"]), vertexCount,
//     edgeCount, fVector, faceTable ([data-total]), ringSizes, distinctDots, sharedEdges, graph,
//     projection, uniform, edgeLengths (data-count), polytopeName, source, pointsDrawn, edgesDrawn,
//     limitMessage, refused, drawMs; data-control graphMoves, viewCoxeter, uniform, drawOrbit
//   Predict (P1-A5 Predict.svelte, loaded by T10 where a prediction is configured): data-prediction,
//     .question, details; data-control predictAnswer, predictCheck, predictShow; data-out predictResult
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title, question,
//     draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance; data-challenge,
//     data-met, data-challenge-result (text "Goal reached."); data-source; data-link;
//     data-unverified and a.unverified-mark (P0-A4 Unverified); data-golden (P0-A4 G)
//   this lesson's own markup: table[data-table="solids"] with tr[data-solid]; figure[data-figure="shells"]
//     with table[data-table="shells"], tr[data-shell] and a[data-shell-link]; data-seen-statement;
//     data-released="false" inside beat 8 (the placeholder, decisions/P4-A6.md)
//
// Word-counting rule (as M5.spec.ts and M6.spec.ts): the words of the <article> after removing every tool
// root ([data-tool]), every <details>, every live or status region, the draft mark and the list of sources
// entries; each KaTeX formula counts as one word; a word is a run of non-space characters. The static
// tables of beats 2 and 7 are counted.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { boardFromName, fire, orbit, wythoffEdges } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';
import { distDir } from './routes';

const ROUTE = 'modules/m7-geometry/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m7-geometry.mdx', import.meta.url));
const SPEC_PATH = fileURLToPath(import.meta.url);
const FRAGMENT_PATH = fileURLToPath(new URL('../../../decisions/P4-A6.md', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m7-geometry/index.html`;
const GLOSSARY_BUILT = `${distDir()}/glossary/index.html`;
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const WORKER = /engine\.worker/;

interface WythoffRecord {
  type: string;
  rings: number[];
  name: string;
  f_vector: number[];
  edges_enumerated: boolean;
}
interface TypeRecord {
  n_roots: number;
  numbers_of_highest_root: number[];
  coxeter_number: number;
  det_cartan: number;
  symmetrizer: number[];
  weyl_order: number;
  exponents: number[];
  fundamental_orbit_sizes: number[];
  highest_root: number[];
  coxeter_plane?: { rings: [number, number][]; distinct_points: number; h_points_on_every_ring: boolean };
}
interface Golden {
  types: Record<string, TypeRecord>;
  wythoff: WythoffRecord[];
  wythoff_hull_checks: number;
  coxeter_plane_types_with_coincident_points: string[];
  e8: {
    fundamental_weights_in_root_coordinates: number[][];
    neighbours_at_inner_product_1: number;
    h4_projection: { exponents_kept: number[]; shell_sizes: number[] };
  };
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const T = (name: string): TypeRecord => GOLDEN.types[name]!;
const W = (type: string, rings: number[]): WythoffRecord => {
  const hits = GOLDEN.wythoff.filter((r) => r.type === type && r.rings.join(',') === rings.join(','));
  if (hits.length !== 1) throw new Error(`${hits.length} wythoff records for ${type} ${rings.join(',')}`);
  return hits[0]!;
};
const E8 = T('E8');
const E8_ROOT = [0, 0, 0, 0, 0, 0, 0, 1];
const ringCounts = (type: string): number[] => T(type).coxeter_plane!.rings.map(([, c]) => c);
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

type Figure = { id: string; beat: number; board: string; rings: number[] };
/** The nine figures of beats 1 to 6 (SPEC 3 M7 figure table, instruction 5.3). */
const FIGURES: Figure[] = [
  { id: 'b1', beat: 1, board: 'A2', rings: T('A2').numbers_of_highest_root },
  { id: 'b2', beat: 1, board: 'A3', rings: T('A3').numbers_of_highest_root },
  { id: 'b3', beat: 1, board: 'D4', rings: T('D4').numbers_of_highest_root },
  { id: 'b4', beat: 2, board: 'A3', rings: [1, 0, 0] },
  { id: 'b5', beat: 3, board: 'B3', rings: [1, 0, 1] },
  { id: 'b6', beat: 4, board: 'A2', rings: [1, 1] },
  { id: 'b7', beat: 5, board: 'B3', rings: [0, 1, 1] },
  { id: 'b8', beat: 6, board: 'E8', rings: E8.numbers_of_highest_root },
  { id: 'b9', beat: 6, board: 'D4', rings: T('D4').numbers_of_highest_root },
];
/** The tools of the four challenges, each after its challenge, with their starting configurations. */
const CHALLENGE_TOOLS: Figure[] = [
  { id: 'b10', beat: 0, board: 'A3', rings: [1, 0, 0] },
  { id: 'b11', beat: 0, board: 'B3', rings: [1, 0, 1] },
  { id: 'b12', beat: 0, board: 'B3', rings: [0, 1, 1] },
  { id: 'b13', beat: 0, board: 'A3', rings: [1, 0, 1] },
];
const TOOLS = [...FIGURES, ...CHALLENGE_TOOLS];

// ---------------------------------------------------------------------------------------------
// The engine, for the hexagon (2.14: "each graph has six edges, four are shared and two differ")
// ---------------------------------------------------------------------------------------------

function hexagonGraphs(): { vertices: number; polytope: number; moves: number; shared: number } {
  const b = boardFromName('A2') as Board<number>;
  const key = (v: readonly number[]): string => v.join(',');
  const pair = (u: readonly number[], v: readonly number[]): string => [key(u), key(v)].sort().join('|');
  const start = [1, 1];
  const vertices = orbit(b, [start], 'firing', 100).items;
  const polytope = new Set(wythoffEdges(b, start, 100).items.map(([u, v]) => pair(u, v)));
  const moves = new Set(vertices.flatMap((v) => v.map((_, i) => pair(v, fire(b, v, i)))));
  return { vertices: vertices.length, polytope: polytope.size, moves: moves.size, shared: [...moves].filter((e) => polytope.has(e)).length };
}
const HEX = hexagonGraphs();

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const node = (page: Page, id: string, label: number): Locator => tool(page, id).locator(`button[data-board="numbers"][data-node="${label}"]`).first();
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
/** <G> output: grouping spaces U+202F and true minus signs U+2212 normalised away. */
const plain = (s: string | null): string => norm((s ?? '').replace(/ /g, '').replace(/−/g, '-'));
const tuple = (v: readonly number[]): string => `(${v.join(', ')})`;

/** The values on the ring board of a tool, in label order. */
async function rings(scope: Locator): Promise<string[]> {
  return scope.locator('button[data-board="numbers"][data-node]').evaluateAll((els) =>
    els
      .map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value') ?? ''] as const)
      .sort((a, b) => a[0] - b[0])
      .map((p) => p[1]),
  );
}

/** Scrolls a tool into view (client:visible), waits for hydration and for its first drawing. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true', { timeout: 20000 });
  await expect(out(page, id, 'drawMs')).not.toHaveText('', { timeout: 20000 });
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
    for (const el of copy.querySelectorAll('p, li, td, th, h1, h2, h3, figcaption, caption')) el.append(document.createTextNode(' '));
    return (copy.textContent ?? '').replace(/[‘’]/g, "'");
  });
}
const sentences = (t: string): string[] => norm(t).split(/(?<=[.!?])\s+/);

/** The distinct centres of the points of a tool's build-time snapshot. */
async function snapshotCentres(page: Page, id: string): Promise<{ circles: number; distinct: number }> {
  return out(page, id, 'snapshot')
    .locator('svg circle')
    .evaluateAll((els) => ({ circles: els.length, distinct: new Set(els.map((e) => `${e.getAttribute('cx')},${e.getAttribute('cy')}`)).size }));
}
/** The number of segments of a tool's build-time snapshot (one M per segment). */
async function snapshotSegments(page: Page, id: string): Promise<number> {
  const d = await out(page, id, 'snapshot')
    .locator('svg g[id$="-segments"] path')
    .evaluateAll((ps) => ps.map((p) => p.getAttribute('d') ?? '').join(''));
  return (d.match(/M/g) ?? []).length;
}

// ---------------------------------------------------------------------------------------------
// Without JavaScript (7.4)
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('renders without JavaScript with every figure, caption and table', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tool]')).toHaveCount(TOOLS.length);
    for (const { id, board, rings: want } of TOOLS) {
      const root = tool(page, id);
      await expect(root, id).toHaveCount(1);
      await expect(root, id).toHaveAttribute('data-tool', 'geometry');
      await expect(out(page, id, 'snapshot').locator('svg'), `${id} draws its figure`).toHaveCount(1);
      await expect(out(page, id, 'snapshot').locator('svg'), id).toHaveAttribute('role', 'img');
      expect(norm(await out(page, id, 'caption').textContent()), `${id} caption`).not.toBe('');
      await expect(out(page, id, 'noscript'), `${id} noscript line`).toHaveText('Interactive when scripts are allowed.');
      const enabled = await root.locator('button, input, select, textarea').evaluateAll((els) => els.filter((e) => !e.matches(':disabled')).length);
      expect(enabled, `${id} controls disabled`).toBe(0);
      // The table of A-10 (ToolFrame's "Show as table") and the face table are in the HTML.
      await expect(root.locator('table[data-table="rings"]'), `${id} table view`).toHaveCount(1);
      await expect(out(page, id, 'faceTable').locator('table'), `${id} face table`).toHaveCount(1);
      // The configured board and rings, and the counts of the golden record where there is one.
      expect(await rings(root), `${id} rings`).toEqual(want.map(String));
      await expect(out(page, id, 'snapshot').locator('svg title'), id).toContainText(board);
      const record = GOLDEN.wythoff.find((r) => r.type === board && r.rings.join(',') === want.join(','));
      if (record) await expect(out(page, id, 'fVector'), `${id} f-vector`).toHaveText(record.f_vector.join(', '));
    }
    for (const { id, beat } of FIGURES) {
      await expect(page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] [data-tool][data-instance="${id}"]`), id).toHaveCount(1);
    }
    // The static tables: the twelve solids of beat 2 and the four shells of beat 7.
    await expect(page.locator('[data-beat="2"] table[data-table="solids"] tbody tr[data-solid]')).toHaveCount(12);
    const shells = page.locator('[data-beat="7"] [data-figure="shells"] table[data-table="shells"]');
    await expect(shells.locator('tbody tr')).toHaveCount(4);
    await expect(shells.locator('caption')).not.toHaveText('');
    await expect(shells.locator('a[data-shell-link]')).toHaveCount(5);
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('E8 showpiece ships an SVG snapshot without JavaScript', async ({ page }) => {
    await page.goto(ROUTE);
    const r = W('E8', E8_ROOT);
    const svg = out(page, 'b8', 'snapshot').locator('svg');
    await expect(svg).toHaveCount(1);
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg.locator('title')).toContainText('E8');
    const centres = await snapshotCentres(page, 'b8');
    expect(centres.circles).toBe(r.f_vector[0]);
    expect(centres.distinct, 'all E8 points distinct').toBe(E8.coxeter_plane!.distinct_points);
    expect(await snapshotSegments(page, 'b8')).toBe(r.f_vector[1]);
    await expect(out(page, 'b8', 'projection')).toHaveText('coxeter');
    const caption = plain(await out(page, 'b8', 'caption').textContent());
    expect(caption).toContain(`${E8.n_roots} roots of E8`);
    expect(caption).toContain(`${E8.coxeter_plane!.rings.length} circles of ${E8.coxeter_number} points, all distinct`);
    expect(caption).toContain(`${GOLDEN.e8.neighbours_at_inner_product_1} nearest neighbours`);
    expect(caption).toContain(`${r.f_vector[1]} edges`);
    // D4 coincides in its Coxeter plane (b9) but not on three coordinates (b3), so no caption is false.
    const d4 = await snapshotCentres(page, 'b9');
    expect(d4).toEqual({ circles: T('D4').n_roots, distinct: T('D4').coxeter_plane!.distinct_points });
    const d4xyz = await snapshotCentres(page, 'b3');
    expect(d4xyz).toEqual({ circles: T('D4').n_roots, distinct: T('D4').n_roots });
  });

  test('predictions show a details fallback without JavaScript', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    const expected: Record<string, string> = {
      b4: String(W('A3', [1, 0, 1]).f_vector[0]),
      b6: HEX.shared === HEX.polytope && HEX.moves === HEX.polytope ? 'Yes, the same edges' : 'No, some edges differ',
    };
    expect(expected.b6).toBe('No, some edges differ');
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
      const paragraphs = await details.locator('p').evaluateAll((ps) => ps.map((p) => (p.textContent ?? '').replace(/\s+/g, ' ').trim()));
      expect(paragraphs[0], `${id} answer`).toBe(answer);
      expect((paragraphs[1] ?? '').length, `${id}: the reveal`).toBeGreaterThan(40);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// With JavaScript
// ---------------------------------------------------------------------------------------------

test('a prediction freezes its board until answered', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b4');
  await expect(control(page, 'b4', 'predictAnswer')).toBeVisible();
  for (const label of [1, 2, 3]) await expect(node(page, 'b4', label), `node ${label} frozen`).toBeDisabled();
  await expect(control(page, 'b4', 'ringUp')).toBeDisabled();
  await expect(control(page, 'b4', 'picker')).toBeDisabled();
  const cuboctahedron = W('A3', [1, 0, 1]);
  await control(page, 'b4', 'predictAnswer').fill(String(cuboctahedron.f_vector[0]));
  await control(page, 'b4', 'predictCheck').click();
  await expect(out(page, 'b4', 'predictResult')).toHaveText(/^Right/);
  for (const label of [1, 2, 3]) await expect(node(page, 'b4', label)).toBeEnabled();
  await node(page, 'b4', 3).click();
  await expect(out(page, 'b4', 'vertexCount')).toHaveText(String(cuboctahedron.f_vector[0]));
  await expect(out(page, 'b4', 'fVector')).toHaveText(cuboctahedron.f_vector.join(', '));
  // Beat 4: the hexagon waits too, until "show me".
  await hydrate(page, 'b6');
  await expect(control(page, 'b6', 'predictShow')).toBeVisible();
  for (const label of [1, 2]) await expect(node(page, 'b6', label)).toBeDisabled();
  await control(page, 'b6', 'predictShow').click();
  await expect(out(page, 'b6', 'predictResult')).toHaveText('The answer is No, some edges differ.');
  for (const label of [1, 2]) await expect(node(page, 'b6', label)).toBeEnabled();
});

test('every figure states its expected result', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  for (const { id, board, rings: want } of FIGURES) {
    await hydrate(page, id);
    await expect(out(page, id, 'source'), `${id} drawn from its preset file`).toHaveText('preset');
    const record = GOLDEN.wythoff.find((r) => r.type === board && r.rings.join(',') === want.join(','));
    if (record) {
      await expect(out(page, id, 'vertexCount'), id).toHaveText(String(record.f_vector[0]));
      await expect(out(page, id, 'edgeCount'), id).toHaveText(String(record.f_vector[1]));
      await expect(out(page, id, 'edgesDrawn'), id).toHaveText(String(record.f_vector[1]));
      await expect(out(page, id, 'fVector'), id).toHaveText(record.f_vector.join(', '));
    }
  }
  // Beat 1: the hexagon of A2 (both nodes ringed, so as many vertices as the group has elements).
  await expect(out(page, 'b1', 'vertexCount')).toHaveText(String(T('A2').weyl_order));
  await expect(out(page, 'b1', 'vertexCount')).toHaveText(String(T('A2').n_roots));
  await expect(out(page, 'b1', 'distinctDots')).toHaveText('');
  expect(plain(await out(page, 'b2', 'caption').textContent())).toContain(`a cuboctahedron with ${W('A3', [1, 0, 1]).f_vector.slice(0, 2).join(' vertices, ')} edges and ${W('A3', [1, 0, 1]).f_vector[2]} faces`);
  // Beat 3: the face table of B3 (1,0,1): 24, 48, 26.
  const rh = W('B3', [1, 0, 1]);
  for (const [d, total] of rh.f_vector.entries()) await expect(out(page, 'b5', 'faceTable').locator(`[data-total="${d}"]`)).toHaveText(String(total));
  expect(plain(await out(page, 'b5', 'caption').textContent())).toContain(`${rh.f_vector[0]} vertices, ${rh.f_vector[1]} edges and ${rh.f_vector[2]} faces`);
  // Beat 4: six edges in each graph, four shared (2.14; computed here with the engine).
  expect([HEX.vertices, HEX.polytope, HEX.moves, HEX.shared]).toEqual([6, 6, 6, 4]);
  await control(page, 'b6', 'predictShow').click();
  await control(page, 'b6', 'graphMoves').click();
  await expect(out(page, 'b6', 'graph')).toHaveText('moves');
  await expect(out(page, 'b6', 'edgeCount')).toHaveText(String(HEX.moves));
  await expect(out(page, 'b6', 'sharedEdges')).toHaveText(String(HEX.shared));
  // Beat 5: two edge lengths, squared 2 d_i a_i^2 = 4 and 2 from the golden weights; make uniform gives one.
  const d = T('B3').symmetrizer;
  const squares = [2 * d[1]!, 2 * d[2]!];
  expect(squares).toEqual([4, 2]);
  await expect(out(page, 'b7', 'uniform')).toHaveText('off');
  await expect(out(page, 'b7', 'edgeLengths')).toHaveAttribute('data-count', '2');
  for (const s of squares) await expect(out(page, 'b7', 'edgeLengths')).toContainText(String(s));
  await control(page, 'b7', 'uniform').check();
  await expect(out(page, 'b7', 'uniform')).toHaveText('on');
  await expect(out(page, 'b7', 'edgeLengths')).toHaveAttribute('data-count', '1');
  await expect(out(page, 'b7', 'vertexCount')).toHaveText(String(W('B3', [0, 1, 1]).f_vector[0]));
  // Beat 6: E8 in its Coxeter plane, 240 points on 8 rings of 30, all distinct, 6720 edges drawn.
  const r = W('E8', E8_ROOT);
  await expect(out(page, 'b8', 'pointsDrawn')).toHaveText(String(r.f_vector[0]));
  await expect(out(page, 'b8', 'edgesDrawn')).toHaveText(String(r.f_vector[1]));
  await expect(out(page, 'b8', 'ringSizes')).toHaveText(ringCounts('E8').join(', '));
  expect(ringCounts('E8')).toEqual(new Array(E8.coxeter_plane!.rings.length).fill(E8.coxeter_number));
  await expect(out(page, 'b8', 'distinctDots')).toHaveText('');
  await expect(out(page, 'b8', 'limitMessage')).toHaveText('');
  // Beat 6: D4 in its Coxeter plane states 12 distinct dots for 24 points.
  await expect(out(page, 'b9', 'distinctDots')).toHaveText(`${T('D4').coxeter_plane!.distinct_points} distinct dots for ${sum(ringCounts('D4'))} points`);
  await expect(out(page, 'b9', 'ringSizes')).toHaveText(ringCounts('D4').join(', '));
  // Beat 1: D4 on three coordinates is not a plane picture, so it states no coincidence.
  await expect(out(page, 'b3', 'distinctDots')).toHaveText('');
});

test('no default state on the page needs the worker', async ({ page, context }) => {
  test.setTimeout(120_000);
  const requested: string[] = [];
  await context.route(WORKER, async (r) => {
    requested.push(r.request().url());
    await r.abort();
  });
  page.on('worker', (w) => requested.push(`worker started: ${w.url()}`));
  await page.goto(ROUTE);
  for (const { id } of TOOLS) {
    await hydrate(page, id);
    await expect(out(page, id, 'source'), id).toHaveText('preset');
  }
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual([]);
});

test('shell table links decode', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  const base = new URL(page.url()).pathname.replace(/modules\/m7-geometry\/$/, '');
  const links = page.locator('[data-table="shells"] a[data-shell-link]');
  const hrefs = await links.evaluateAll((els) => els.map((e) => [e.getAttribute('data-shell-link') ?? '', e.getAttribute('href') ?? ''] as const));
  expect(hrefs.map(([k]) => k)).toEqual(['8', '1', '7', '2', 'doubled']);
  const sizes = E8.fundamental_orbit_sizes;
  const expected: Record<string, { rings: string; vertices: number }> = {
    '8': { rings: '0.0.0.0.0.0.0.1', vertices: sizes[7]! },
    '1': { rings: '1.0.0.0.0.0.0.0', vertices: sizes[0]! },
    '7': { rings: '0.0.0.0.0.0.1.0', vertices: sizes[6]! },
    '2': { rings: '0.1.0.0.0.0.0.0', vertices: sizes[1]! },
    doubled: { rings: '0.0.0.0.0.0.0.2', vertices: E8.n_roots },
  };
  for (const [k, href] of hrefs) {
    const want = expected[k]!;
    expect(href, k).toBe(`${base}tools/geometry/?z=1&g=E8&r=${want.rings}&j=coxeter`);
    const seen: string[] = [];
    const onRequest = (rq: { url(): string }): void => {
      if (WORKER.test(rq.url())) seen.push(rq.url());
    };
    page.on('request', onRequest);
    await page.goto(href);
    const root = page.locator('[data-tool="geometry"]');
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 20000 });
    await expect(root.locator('[data-out="vertexCount"]'), k).toHaveText(String(want.vertices));
    await expect(root.locator('[data-out="projection"]'), k).toHaveText('coxeter');
    expect(await rings(root), k).toEqual(want.rings.split('.'));
    // ToolFrame renders the notice only for a link it could not read.
    const notice = root.locator('[data-out="notice"]');
    if ((await notice.count()) > 0) await expect(notice, k).not.toHaveText(NOTICE);
    expect(norm(await page.locator('main').innerText()), k).not.toContain(NOTICE);
    // The links the reader follows may compute in the worker, but only after the button; never at load.
    await page.waitForLoadState('networkidle');
    expect(seen, k).toEqual([]);
    page.off('request', onRequest);
  }
  // 2_41 draws all its edges (below the limit at rest); 1_42 shows its vertices only, with the message.
  await page.goto(hrefs.find(([k]) => k === '2')![1]);
  await expect(page.locator('[data-tool="geometry"] [data-out="limitMessage"]')).toContainText(String(W('E8', [0, 1, 0, 0, 0, 0, 0, 0]).f_vector[1]));
  await page.goto(hrefs.find(([k]) => k === '1')![1]);
  await expect(page.locator('[data-tool="geometry"] [data-out="edgeCount"]')).toHaveText(String(W('E8', [1, 0, 0, 0, 0, 0, 0, 0]).f_vector[1]));
  await expect(page.locator('[data-tool="geometry"] [data-out="limitMessage"]')).toHaveText('');
});

test('the shell table holds the golden populations, sizes and shells', async ({ page }) => {
  await page.goto(ROUTE);
  const rows = page.locator('[data-table="shells"] tbody tr');
  const nodes = [8, 1, 7, 2];
  const formValues = [2, 4, 6, 8];
  const polytopes = ['4_{21}', '2_{41}', 'rectified 4_{21}', '1_{42}'];
  // The fourth shell is typed once (it has no golden value): the orbit of e_2 and the doubled roots.
  expect(E8.fundamental_orbit_sizes[1]! + E8.n_roots).toBe(17520);
  expect(GOLDEN.e8.fundamental_weights_in_root_coordinates[7]).toEqual(E8.highest_root);
  for (const [k, label] of nodes.entries()) {
    const cells = await rows.nth(k).locator('td').evaluateAll((els) =>
      els.map((td) => {
        const copy = td.cloneNode(true) as HTMLElement;
        for (const x of copy.querySelectorAll('.katex')) x.replaceWith(document.createTextNode(x.querySelector('annotation')?.textContent ?? ''));
        for (const x of copy.querySelectorAll('a.unverified-mark')) x.remove();
        return (copy.textContent ?? '').replace(/ /g, '').replace(/\\,/g, '').replace(/\s+/g, ' ').trim();
      }),
    );
    expect(cells[0], `row ${k}`).toBe(String(label));
    expect(cells[1], `row ${k}`).toBe(tuple(GOLDEN.e8.fundamental_weights_in_root_coordinates[label - 1]!));
    expect(cells[2], `row ${k}`).toBe(String(formValues[k]));
    expect(cells[3], `row ${k}`).toBe(String(E8.fundamental_orbit_sizes[label - 1]));
    expect(cells[4], `row ${k}`).toBe(polytopes[k]);
    expect(cells[5], `row ${k}`).toMatch(/^orbit of e_\d/);
  }
  // The form values: (p, p) = p^T C p on E8 (simply laced, all weights 1), from the golden Cartan matrix.
  const cartan = (GOLDEN.types.E8 as unknown as { cartan: number[][] }).cartan;
  const form = (p: number[]): number => p.reduce((s, pi, i) => s + pi * p.reduce((t, pj, j) => t + cartan[i]![j]! * pj, 0), 0);
  expect(nodes.map((l) => form(GOLDEN.e8.fundamental_weights_in_root_coordinates[l - 1]!))).toEqual(formValues);
  const beat7 = plain(await proseText(page, '[data-beat="7"]')).replace(/\\,/g, '');
  expect(beat7).toContain('the sequence of shell sizes is in the OEIS');
  expect(beat7).toContain(`${E8.n_roots}, ${E8.fundamental_orbit_sizes[0]}, ${E8.fundamental_orbit_sizes[6]} and ${E8.fundamental_orbit_sizes[1]}+${E8.n_roots}=17520 vectors`);
  expect(beat7).toContain('the fourth is the orbit of e_2 together with the doubled roots');
  expect(beat7).toContain(`2_{41} has ${W('E8', [1, 0, 0, 0, 0, 0, 0, 0]).f_vector[1]} edges, within the studio's limit`);
  expect(beat7).toContain(`1_{42} has ${W('E8', [0, 1, 0, 0, 0, 0, 0, 0]).f_vector[1]}, beyond it, and the studio shows its vertices only`);
});

test('E7 and E9 are wrapped', async ({ page }) => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const items = JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { items?: { id: string; status: string }[] } | { id: string; status: string }[];
  const list = Array.isArray(items) ? items : (items.items ?? []);
  for (const id of ['E7', 'E9']) expect(list.find((i) => i.id === id)?.status, id).toBe('open');
  const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
  expect(wraps.map((a) => /\bitem="([^"]*)"/.exec(a)?.[1]).sort()).toEqual(['E7', 'E7', 'E9']);
  // The fallbacks are attributes, so they hold no <G>; none names a count with a golden value.
  for (const attrs of wraps) {
    const fallback = /\bfallback="([^"]*)"/.exec(attrs)?.[1];
    if (fallback !== undefined) expect(fallback, attrs).not.toMatch(/\b(240|2160|6720|17280|17520|48|26)\b/);
  }
  await page.goto(ROUTE);
  // E7: the attribution clause sits in "What we have seen", the "published" clause in beat 3.
  await expect(page.locator('[data-anatomy="seen"] [data-unverified="E7"]')).toHaveCount(1);
  expect(norm(await page.locator('[data-anatomy="seen"] [data-unverified="E7"]').textContent())).toContain('CKPS95');
  await expect(page.locator('[data-beat="3"] [data-unverified="E7"]')).toHaveCount(1);
  // E9: the name of the orbit of e_7 in the shell table.
  const e9 = page.locator('[data-table="shells"] [data-unverified="E9"]');
  await expect(e9).toHaveCount(1);
  expect(norm(await e9.textContent())).toContain('rectified');
  // The words "published" and "rectified" occur only inside the wraps; so do the names CKPS95 gives no rule to.
  const outside = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-unverified], [data-anatomy="sources"], [data-tool], script, style')) el.remove();
    return copy.textContent ?? '';
  });
  expect(outside).not.toMatch(/published/i);
  expect(outside).not.toMatch(/rectified/i);
  // The rule is never attributed outside the wrap.
  for (const s of sentences(outside)) expect(s, s).not.toMatch(/(Coxeter|Wythoff|Champagne|CKPS95)['’]s? (face[- ]counting )?rule|rule (is|was) (due to|found by|from) /i);
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

test('anatomy of 8.2', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('Geometry: mirrors, polytopes and the E8 picture');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('What shapes do the positions make?');
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
      q('[data-beat="7"]'),
      q('[data-figure="shells"]'),
      q('[data-beat="8"]'),
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
  // The first figure is the first thing drawn on the page, with its caption (8.2 item 2).
  const firstTool = await article.evaluate((el) => el.querySelector('[data-tool]')?.getAttribute('data-instance'));
  expect(firstTool).toBe('b1');
  const ids = await page.locator('[data-tool]').evaluateAll((els) => els.map((e) => e.getAttribute('data-instance')));
  expect(ids).toEqual(TOOLS.map(({ id }) => id));
  // "What we have seen" carries its provenance, and so does each of its statements.
  const seen = article.locator('[data-anatomy="seen"]');
  await expect(seen.locator('[data-provenance="verified by computation"]')).toHaveCount(1);
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBe(5);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation|in the OEIS/i.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  // The face-counting rule is presented as verified by computation.
  expect(norm(await statements.nth(2).textContent())).toMatch(/verified by computation against exact convex hulls of \S+ polytopes/);
  // No link to the golden tab of T11, to M8 or to the Atlas (unreleased in phase 4); the sandbox loads B3.
  await expect(article.locator('a[href*="tools/fold"]')).toHaveCount(0);
  await expect(article.locator('a[href*="m8"], a[href*="atlas/"]')).toHaveCount(0);
  await expect(article.locator('[data-anatomy="links"] a[data-link="atlas"], [data-anatomy="links"] a[data-link="next"]')).toHaveCount(0);
  const sandbox = article.locator('[data-anatomy="links"] a[data-link="sandbox"]');
  await expect(sandbox).toHaveCount(1);
  expect((await sandbox.getAttribute('href')) ?? '').toMatch(/tools\/sandbox\/\?g=B3$/);
  const source = readFileSync(LESSON_PATH, 'utf8');
  const front = /^---\n([\s\S]*?)\n---/.exec(source)![1]!;
  expect(front).toMatch(/^draft: true$/m);
  expect(front).toMatch(/^released: true$/m);
  expect(front).toMatch(/^module: 7$/m);
  expect(front).toMatch(/^phase: 4$/m);
  expect(front).toMatch(/^outcomes: \["LO7"\]$/m);
  const keys = JSON.parse(/^sources:\s*(\[.*\])\s*$/m.exec(front)![1]!) as string[];
  for (const key of ['Cox35', 'Cox73', 'CKPS95', 'Cas17', 'Ste59']) expect(keys, key).toContain(key);
  for (const key of keys) await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`), key).toHaveCount(1);
  for (const k of new Set([...source.matchAll(/<Cite k="([^"]+)"/g)].map((m) => m[1]!))) expect(keys, k).toContain(k);
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M7 prose words: ${words}`);
  expect(words).toBeGreaterThanOrEqual(800);
  expect(words).toBeLessThanOrEqual(1800);
});

// The two dashes, named by their code points so that this file holds neither (D14; COMMON 4.4).
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

test('no em-dash in the built text', async ({ page }) => {
  const html = readFileSync(BUILT, 'utf8');
  expect(html.includes(EM_DASH), 'U+2014 in the built HTML').toBe(false);
  expect(html.includes(EN_DASH), 'U+2013 in the built HTML').toBe(false);
  for (const [what, path] of [
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
  expect(t.includes(EM_DASH), 'U+2014 in the text').toBe(false);
  expect(t.includes(EN_DASH), 'U+2013 in the text').toBe(false);
});

// The numbers typed in the lesson, outside <G> and the golden paths of <Tex>, with the reason for each
// (instruction 5.7; decisions/P4-A6.md). Board names (A_2, E_8), polytope symbols (4_{21}) and the names
// of fundamental positions and weights by their node label (e_7, \omega_8) are names, not numbers, and are
// left out of the list by the pattern NAMES.
const NAMES = /^(?:[A-H]_\d|\d_\{\d\d\}|e_\d|\\omega_\d)$/;
const TYPED: Record<string, string> = {
  // Formulas of the recipe and of the rules (2.14), with their exponents and coefficients.
  'D^{1/2}CD^{-1/2}': 'the symmetric matrix of the recipe for E',
  'y=EC^{-1}a': 'where a position is drawn',
  'C^{-1}': 'the inverse of the Cartan matrix (beat 7)',
  'a_i^2(\\alpha_i,\\alpha_i)=2d_ia_i^2': 'the squared length of a base edge',
  '2\\pi/h': 'the angle of the rotation of the Coxeter plane',
  'e^{2\\pi i m_j/h}': 'the eigenvalues of a Coxeter element (Lie theory paragraph)',
  'h-1': 'the exponent of the Coxeter plane (Lie theory paragraph)',
  '\\det C=1': 'the reason the root lattice of E8 is its weight lattice (Lie theory paragraph)',
  '4\\cos^2(\\pi/m)': 'the products of road weights on a Coxeter graph (beat 8 preview, 2.17)',
  'm=5': 'the label whose weight is the golden ratio (beat 8 preview, 2.17)',
  // Positions and rings given as starts (configurations, not results).
  '(1,1)': 'the start of the hexagon of A2 (beat 4)',
  '(1,1,0)': 'the rings of the uniform truncated octahedron of B3 (beat 5)',
  '(0,1,1)': 'the rings of the truncated cube of B3 (beat 5)',
  '(0,1,\\sqrt2)': 'the real numbers of the uniform truncated cube (beat 5)',
  // Small values with no golden key.
  '0': 'the entries of a fundamental position off its node (beat 7)',
  '1': 'the entry of a fundamental position, the inner product of neighbours, the exponent 1',
  '2': 'the form value of a root; the squared length of a short edge of the truncated cube',
  '4': 'the form value of e_1; the squared length of a long edge of the truncated cube (2 d_i a_i^2)',
  '6': 'the form value of e_7',
  '8': 'the form value of e_2',
  '2,4,6,8': 'the four form values (What we have seen)',
  '+=17\\,520': 'the fourth shell, 17280 + 240, both parts golden (beat 7)',
  '17\\,520': 'the fourth term of the theta series (Lie theory paragraph)',
};
const BRACED: Record<string, string> = {
  '24-cell': 'the name of the D4 root polytope',
  '600-cells': 'the name of the H4 polytopes (beat 8 preview)',
  '1': 'a node label; the first term of the theta series',
  '2': 'a node label',
  '3': 'a node label',
  '7': 'a node label (shell table)',
  '8': 'a node label (shell table)',
  'section 2': 'a locator of [Don08]',
  'Proposition 3.7, Theorem 3.11': 'locators of [Cas17] (SOURCES.md 11.5, read)',
  'Proposition 3.7 and Theorem 3.11': 'locators of [Cas17] (SOURCES.md 11.5, read)',
};

test('numbers in prose', () => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const findings = scanSource(source, 'site/src/content/modules/m7-geometry.mdx');
  // Both sections of the report are empty: every typed digit is in <Tex>, a property or a brace string.
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
  // The typed numbers inside <Tex> (golden paths removed) and brace strings are exactly the allowlist.
  const tex = new Set(
    [...source.matchAll(/<Tex\b[^>]*?\bsrc="([^"]*)"/g)]
      .map((m) => m[1]!.replace(/\{\{[^}]*\}\}/g, ''))
      .filter((s) => /\d/.test(s) && !NAMES.test(s)),
  );
  expect([...tex].sort()).toEqual(Object.keys(TYPED).sort());
  const braced = new Set([...source.matchAll(/\{'([^']*)'\}/g)].map((m) => m[1]!).filter((s) => /\d/.test(s)));
  expect([...braced].sort()).toEqual(Object.keys(BRACED).sort());
  // No number with a golden value of this page is typed, in Tex or anywhere in the prose.
  // Names such as the 24-cell carry their number in the name and are left out here.
  const names = new Set(['24-cell', '600-cells']);
  for (const golden of ['240', '2160', '6720', '17280', '69120', '483840', '56', '30', '12', '24', '48', '26', '36', '120']) {
    for (const s of [...tex, ...braced].filter((x) => !names.has(x))) expect(s.split(/[^\d]+/), `${golden} typed in ${s}`).not.toContain(golden);
  }
});

test('at least two predictions and three challenges', async ({ page }) => {
  await page.goto(ROUTE);
  expect(await page.locator('[data-tool] [data-prediction]').count()).toBeGreaterThanOrEqual(2);
  const challenges = page.locator('[data-challenge]');
  expect(await challenges.count()).toBeGreaterThanOrEqual(3);
  for (let k = 0; k < (await challenges.count()); k++) {
    await expect(challenges.nth(k).locator('.goal')).not.toHaveText('');
    await expect(challenges.nth(k).locator('details')).toHaveCount(1);
  }
  const islands = await page.locator('astro-island[component-export="Challenge"]').evaluateAll((els) => els.map((e) => e.getAttribute('props') ?? ''));
  for (const id of ['b10', 'b11', 'b12', 'b13']) expect(islands.some((p) => p.includes(`"${id}"`)), id).toBe(true);
});

test('glossary links resolve', async ({ page }) => {
  await page.goto(ROUTE);
  const hrefs = await page.locator('article a[href*="glossary"]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  const anchors = hrefs.map((h) => new URL(h, page.url()).hash.slice(1));
  for (const want of ['ring', 'fundamental-position', 'form-value']) expect(anchors, want).toContain(want);
  const glossary = readFileSync(GLOSSARY_BUILT, 'utf8');
  for (const a of anchors) expect(glossary, `glossary#${a}`).toMatch(new RegExp(`id="${a}"`));
  for (const h of hrefs) expect(new URL(h, page.url()).pathname).toMatch(/glossary\/?$/);
  // The fundamental weight is named only in the Lie theory paragraph (Appendix C; 8.4).
  const outsideLie = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-anatomy="lie-theory"], [data-anatomy="sources"]')) el.remove();
    return copy.textContent ?? '';
  });
  expect(outsideLie).not.toContain('ω');
  expect(outsideLie).not.toContain('\\omega');
  expect(await page.locator('[data-anatomy="lie-theory"]').textContent()).toContain('ω');
  expect(norm(await proseText(page, '[data-anatomy="lie-theory"]'))).toContain('The fundamental position e_i is the fundamental weight \\omega_i, and the form value is the norm');
});

test('beat 8 is a released:false placeholder', async ({ page }) => {
  await page.goto(ROUTE);
  const beat = page.locator('[data-beat="8"]');
  await expect(beat).toHaveCount(1);
  const marker = beat.locator('[data-released="false"]');
  await expect(marker).toHaveCount(1);
  const text = norm(await proseText(page, '[data-beat="8"] [data-released="false"]'));
  const count = sentences(text).filter((s) => s !== '').length;
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(2);
  expect(plain(text)).toContain(`two 600-cells of ${GOLDEN.e8.h4_projection.shell_sizes[0]} points each`);
  expect(GOLDEN.e8.h4_projection.shell_sizes).toEqual([GOLDEN.e8.h4_projection.shell_sizes[0], GOLDEN.e8.h4_projection.shell_sizes[0]]);
  await expect(beat.locator('[data-tool]')).toHaveCount(0);
  await expect(beat.locator('svg')).toHaveCount(0);
  await expect(beat.locator('[data-anatomy="figure"]')).toHaveCount(0);
  await expect(beat.locator('a[href*="tools/fold"]')).toHaveCount(0);
  // No attribution of the golden folding (E9) is stated.
  expect(text).not.toMatch(/Lusztig|Shcherbak|Moody|Patera/);
});

test('beats state their ideas in the site words', async ({ page }) => {
  await page.goto(ROUTE);
  const all = await proseText(page, 'article');
  const list = sentences(all);
  // Beat 2: vertices of a polytope against nodes of a board, said once.
  expect(norm(await proseText(page, '[data-beat="2"]'))).toContain('The corners of a polytope are its vertices, the places of a board are its nodes');
  // Beat 2: the twelve solids, names and face counts from the golden records.
  const solids = page.locator('table[data-table="solids"] tbody tr[data-solid]');
  const expectedSolids = GOLDEN.wythoff.filter((r) => r.type === 'A3' || r.type === 'B3').map((r) => `${r.type}:${r.rings.join(',')}`);
  expect(await solids.evaluateAll((els) => els.map((e) => e.getAttribute('data-solid')))).toEqual(expectedSolids);
  for (let k = 0; k < expectedSolids.length; k++) {
    const [type, ringsText] = expectedSolids[k]!.split(':');
    const r = W(type!, ringsText!.split(',').map(Number));
    await expect(solids.nth(k).locator('xpath=ancestor::tbody')).toHaveAttribute('data-board', type!);
    const cells = await solids.nth(k).locator('td').evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
    expect(cells[0]).toBe(tuple(r.rings));
    expect(cells[1]).toBe(r.name);
    expect(cells[2]).toBe(tuple(r.f_vector));
  }
  // Beat 3: the rule, its counts on B3, and its two verifications.
  const beat3 = plain(await proseText(page, '[data-beat="3"]'));
  expect(beat3).toContain(`${W('B3', [1, 0, 1]).f_vector[0]} vertices, ${W('B3', [1, 0, 1]).f_vector[1]} edges and ${W('B3', [1, 0, 1]).f_vector[2]} faces`);
  expect(beat3).toContain(`For ${GOLDEN.wythoff_hull_checks} polytopes`);
  expect(beat3).toContain(`with those of ${GOLDEN.wythoff.length} well-known polytopes`);
  expect(beat3).toContain('The rule was verified by computation twice over');
  // Beat 4: the two graphs, with the switch as the site's choice.
  const beat4 = norm(await proseText(page, '[data-beat="4"]'));
  expect(beat4).toContain('each graph has six edges, and four of the edges are shared');
  expect(beat4).toContain("Showing both, with a switch, is the site's choice");
  // Beat 5: make uniform is a display option, never an orbit of the game.
  const beat5 = norm(await proseText(page, '[data-beat="5"]'));
  expect(beat5).toContain('is a display option only');
  expect(beat5).toContain('its picture is not an orbit of the game');
  expect(beat5).toMatch(/nodes 1 and 2 are long and node 3 is short/);
  // Beat 6: rotation by 2 pi / h, multiples of h, E8 and D4 with golden numbers.
  const beat6 = plain(await proseText(page, '[data-beat="6"]'));
  expect(beat6).toContain(`the ${E8.n_roots} roots lie on ${E8.coxeter_plane!.rings.length} circles of ${E8.coxeter_number}, and all ${E8.coxeter_plane!.distinct_points} points are distinct`);
  expect(beat6).toContain(`Each root is joined to the ${GOLDEN.e8.neighbours_at_inner_product_1} roots that have inner product 1 with it`);
  expect(beat6).toContain(`make only ${T('D4').coxeter_plane!.distinct_points} dots`);
  expect(GOLDEN.coxeter_plane_types_with_coincident_points).toContain('D4');
  expect(beat6).toContain('the studio says so whenever dots are fewer than points');
  expect(beat6).toContain('Proposition 3.7, Theorem 3.11');
  // Appendix F: nothing about W(E8) and an orthogonal group; SOURCES.md: no statement number for [Ste59].
  expect(all).not.toMatch(/orthogonal group/i);
  for (const s of list.filter((x) => x.includes('[Ste59]'))) expect(s, s).not.toMatch(/Ste59\]\s*\(?\s*\d/);
  // The plan's rule for this page: node, never city.
  expect(all).not.toMatch(/\bcit(?:y|ies)\b/i);
  // Rings are numbers on nodes, never populations.
  expect(all).not.toMatch(/positive population/i);
});

test('challenge: the cuboctahedron on A3', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b10');
  await hydrate(page, 'b10');
  const target = W('A3', [1, 0, 1]);
  // Ringing node 2 as well gives the truncated tetrahedron: not yet.
  await node(page, 'b10', 2).click();
  await expect(out(page, 'b10', 'fVector')).toHaveText(W('A3', [1, 1, 0]).f_vector.join(', '));
  await page.waitForTimeout(200);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await node(page, 'b10', 2).click();
  await node(page, 'b10', 3).click();
  await expect(out(page, 'b10', 'fVector')).toHaveText(target.f_vector.join(', '));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: the cube on B3', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Node 1 alone is the octahedron: not yet.
  await node(page, 'b11', 3).click();
  await expect(out(page, 'b11', 'fVector')).toHaveText(W('B3', [1, 0, 0]).f_vector.join(', '));
  await page.waitForTimeout(200);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await node(page, 'b11', 3).click();
  await node(page, 'b11', 1).click();
  await expect(out(page, 'b11', 'fVector')).toHaveText(W('B3', [0, 0, 1]).f_vector.join(', '));
  expect(W('B3', [0, 0, 1]).name).toBe('cube');
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: the other choice of rings with the counts of the truncated cube', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b12');
  await hydrate(page, 'b12');
  const cube = W('B3', [0, 1, 1]);
  const octahedron = W('B3', [1, 1, 0]);
  expect(octahedron.f_vector.slice(0, 2)).toEqual(cube.f_vector.slice(0, 2));
  // The start already has those counts, and is not the goal.
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // All three nodes: the truncated cuboctahedron, not yet.
  await node(page, 'b12', 1).click();
  await expect(out(page, 'b12', 'fVector')).toHaveText(W('B3', [1, 1, 1]).f_vector.join(', '));
  await page.waitForTimeout(200);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await node(page, 'b12', 3).click();
  await expect(out(page, 'b12', 'vertexCount')).toHaveText(String(octahedron.f_vector[0]));
  await expect(out(page, 'b12', 'polytopeName')).toHaveText(octahedron.name);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: twenty-four vertices with three neighbours each on A3', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b13');
  await hydrate(page, 'b13');
  const all = W('A3', [1, 1, 1]);
  expect((2 * all.f_vector[1]!) / all.f_vector[0]!).toBe(3);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await node(page, 'b13', 2).click();
  await expect(out(page, 'b13', 'fVector')).toHaveText(all.f_vector.join(', '));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('static content fits a 320-pixel screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(ROUTE);
  // The table of solids reflows within the prose column; the shell table, two-dimensional with six
  // columns, scrolls inside its own focusable region (A-11), which itself stays within the screen.
  const wide = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('table[data-table="solids"], [data-figure="shells"], [data-anatomy="seen"], [data-anatomy="lie-theory"]')) {
      const h = el as HTMLElement;
      const r = h.getBoundingClientRect();
      const scrolls = h.matches('[data-figure="shells"]') && getComputedStyle(h).overflowX === 'auto';
      if ((!scrolls && h.scrollWidth > h.clientWidth + 1) || r.right > document.documentElement.clientWidth + 1 || r.left < -1) out.push(`${el.tagName}[${h.getAttribute('data-table') ?? h.getAttribute('data-figure') ?? h.getAttribute('data-anatomy')}]`);
    }
    return out;
  });
  expect(wide).toEqual([]);
  const region = page.locator('[data-figure="shells"]');
  await expect(region).toHaveAttribute('role', 'region');
  await expect(region).toHaveAttribute('tabindex', '0');
  await expect(region).toHaveAttribute('aria-labelledby', 'm7-shells-caption');
  // Every column of the shell table can be reached: scrolled to the end, the last column is in view.
  await region.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  const last = await page.locator('[data-table="shells"] tbody tr').first().locator('td').last().boundingBox();
  expect(last).not.toBeNull();
  expect(last!.x + last!.width).toBeLessThanOrEqual(320 + 1);
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  // Thirteen tools and four challenges.
  expect(islands.length).toBe(TOOLS.length + 4);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T10GeometryStudio/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  // A lesson of thirteen tools takes a while to scan (M5.spec.ts, decisions/P3-A9.md).
  test.setTimeout(180_000);
  await page.goto(ROUTE);
  for (const { id } of TOOLS) await hydrate(page, id);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});
