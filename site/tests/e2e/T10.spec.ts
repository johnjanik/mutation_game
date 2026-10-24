// P4-A3: tool T10, the Geometry Studio, against the built site (SPEC.md 4 T10; 2.14; 3 M7; 4.0; 5.6; 6.6;
// 7.4 to 7.6; E-9). Cases are opened by bare query parameters on /tools/geometry/ (6.6: every state is a
// link) or through the tool's controls. Tests read only the hooks of 4.0 and the live region (and, where a
// criterion is about the address bar or the network, those). Expected values are read from
// reference/golden_data.json or computed by the engine; the only constants typed are SPEC's own acceptance
// statements (the hexagon of A2: six edges in each graph, four shared, 2.14) and the caps, read from CAPS.
//
// One case per kind of board offered (CONTRACTS 5.2): rank 2 flat (A2: two graphs on the hexagon), rank 3
// wireframe simply laced (A3: turning, clicking rings, the Coxeter plane view), two root lengths (B3: make
// uniform, the face table, the short roots), rank 8 projection (E8: the showpiece, the limits, the shells).
//
// Hooks read:
//   root:     data-tool="geometry", data-moves, data-hydrated="true"
//   buttons:  data-node, data-board ("numbers"), data-value, data-can-act (the ring board)
//   table:    data-table-node (the A-10 table's buttons), data-table-ring (its number inputs),
//             data-table="vertices" | "edges" | "rings"
//   live:     [data-live] (ToolFrame's polite live region)
//   regressions (RT-FIX phase 4): data-instance (a lesson's T10 root), data-board-group (the ring board's
//             group, A-1), data-ring (Board.svelte's second "may act here" ring), aria-disabled, the title of
//             data-out="edgeLengths" (the tooltip of a long number), data-prediction, data-measured
// data-out names (every one T10 renders; the registry's `outs`):
//   caption, notice, noscript, exportNotice (ToolFrame);
//   snapshot (the SVG of the view; the build-time snapshot without JavaScript), boardName, polytopeName
//   (MathML names), summary, vertexCount, edgeCount (edges of the graph shown), pointCount (with the short
//   roots), pointsDrawn, edgesDrawn (the last canvas draw), fVector, faceTable, ringSizes (innermost
//   first; radii in data-radii), distinctDots, sharedEdges, graph, projection (the j value), turn (the
//   three angles), uniform, edgeLengths (distinct squared base-edge lengths; data-count), shortRoots,
//   limitMessage, refused, busy, source ("preset" | "computed"), drawMs, edits (ring and board edits; see
//   the decisions fragment on data-moves), legend, ringLimit (the cap of the rings in words, beside the
//   ring fields of the table view, and the sentence when a ring asked for is held to it); predictResult,
//   predictReveal (Predict.svelte, only with a prediction: lesson instances, registry-outs.spec.ts)
// data-control names: picker, rootPolytope, ringUp, ringDown, shortRoots, uniform, graphPolytope,
//   graphMoves, viewCoxeter, viewXyz, axis1 to axis3, turnGroup, turnUp, turnDown, turnLeft, turnRight,
//   turnCounter, turnClock, planeGroup, planeA, planeB, rotatePlus, rotateMinus, rotateReset, drawOrbit;
//   undo, redo, reset, copyLink, downloadData (ToolFrame); data-export="svg" | "png" (ToolFrame);
//   predictAnswer, predictCheck, predictShow (Predict.svelte's form, and the same form of T10's server markup
//   until Predict.svelte arrives)
//
// Properties of T10 beyond the common ones of 4.0 Configuration (id, board, prediction, preset, caption):
// rings, projection, graph. linkTo, coords, start, moves and layers are accepted and ignored.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAPS, boardFromName, toPositions, wythoffFVector } from '../../../packages/engine/src/index';
import type { AnyBoard } from '../../../packages/engine/src/index';
import { RING_MAX } from '../../src/components/tools/t10/scene';
import { shortValue } from '../../src/components/tools/t01/longNumber';
import { hydrateEveryIsland } from './hydrate';

interface WythoffRecord {
  type: string;
  rings: number[];
  f_vector: number[];
  edges_enumerated: boolean;
}
interface TypeRecord {
  numbers_of_highest_root: number[];
  coxeter_plane?: { rings: [number, number][]; distinct_points: number };
  fundamental_orbit_sizes: number[];
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  wythoff: WythoffRecord[];
  types: Record<string, TypeRecord>;
};
const record = (type: string, rings: number[]): WythoffRecord => {
  const hits = golden.wythoff.filter((r) => r.type === type && r.rings.join('.') === rings.join('.'));
  if (hits.length !== 1) throw new Error(`${hits.length} wythoff records for ${type} ${rings.join('.')}`);
  return hits[0]!;
};
const ringCounts = (type: string): number[] => golden.types[type]!.coxeter_plane!.rings.map(([, c]) => c);
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
/** A vector in label order (the rings of a link) as the engine takes it, in positions (E-7: through toPositions). */
const inPositions = (board: AnyBoard, v: readonly number[]): number[] => {
  const p = new Array<number>(board.n).fill(0);
  [...board.labels].sort((a, b) => a - b).forEach((label, k) => {
    p[toPositions(board, [label])[0]!] = v[k]!;
  });
  return p;
};

const ROUTE = 'tools/geometry/';
const NOTICE = 'The link could not be read, so the tool shows its default state.';
const WORKER = /engine\.worker/;
const PRESET_FILE = /presets\/T10\/(?!index\.json)[^/?]+\.json/;

const root = (page: Page): Locator => page.locator('[data-tool="geometry"]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const node = (page: Page, label: number): Locator => root(page).locator(`button[data-node="${label}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');

/** Records requests of the worker script and of the preset data files. */
function watch(page: Page): { worker: string[]; presets: string[] } {
  const seen = { worker: [] as string[], presets: [] as string[] };
  page.on('request', (r) => {
    if (WORKER.test(r.url())) seen.worker.push(r.url());
    if (PRESET_FILE.test(r.url())) seen.presets.push(r.url());
  });
  page.on('worker', (w) => seen.worker.push(`worker started: ${w.url()}`));
  return seen;
}

/** Opens the route with a query and waits until the island has hydrated and the canvas has drawn once. */
async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(out(page, 'drawMs')).not.toHaveText('', { timeout: 15000 });
}

async function valuesOf(page: Page): Promise<string[]> {
  const pairs: [number, string][] = [];
  for (const b of await root(page).locator('button[data-node]').all()) pairs.push([Number(await b.getAttribute('data-node')), (await b.getAttribute('data-value')) ?? '']);
  return pairs.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const turnOf = async (page: Page): Promise<number[]> => (await out(page, 'turn').innerText()).split(',').map((x) => Number(x.trim()));

// ---------------------------------------------------------------------------------------------
// The showpiece (4 T10 Showpiece; 7.6)
// ---------------------------------------------------------------------------------------------

test('showpiece from the preset file, no worker', async ({ page }) => {
  const seen = watch(page);
  const r = record('E8', [0, 0, 0, 0, 0, 0, 0, 1]);
  await open(page, 'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter');
  await expect(out(page, 'source')).toHaveText('preset');
  await expect(out(page, 'vertexCount')).toHaveText(String(r.f_vector[0]));
  await expect(out(page, 'edgeCount')).toHaveText(String(r.f_vector[1]));
  await expect(out(page, 'edgesDrawn')).toHaveText(String(r.f_vector[1]));
  await expect(out(page, 'pointsDrawn')).toHaveText(String(r.f_vector[0]));
  await expect(out(page, 'ringSizes')).toHaveText(ringCounts('E8').join(', '));
  await expect(out(page, 'distinctDots')).toHaveText('');
  await expect(out(page, 'projection')).toHaveText('coxeter');
  expect(seen.presets.some((u) => u.includes('E8-r0.0.0.0.0.0.0.1.json'))).toBe(true);
  await page.waitForLoadState('networkidle');
  expect(seen.worker).toEqual([]);
});

test('the showpiece draws in under 100 ms', async ({ page }) => {
  const r = record('E8', [0, 0, 0, 0, 0, 0, 0, 1]);
  await open(page, 'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter');
  await expect(out(page, 'edgesDrawn')).toHaveText(String(r.f_vector[1]));
  const ms = Number(await out(page, 'drawMs').innerText());
  test.info().annotations.push({ type: 'drawMs', description: String(ms) });
  console.info(`T10 showpiece drawMs ${ms}`);
  expect(ms).toBeGreaterThan(0);
  expect(ms).toBeLessThan(100);
});

// ---------------------------------------------------------------------------------------------
// Projection, turning, motion (4 T10 Projection; 6.6 j; A-8, A-9)
// ---------------------------------------------------------------------------------------------

test('turning by keys and buttons', async ({ page }) => {
  await open(page, 'g=A3&r=1.0.1');
  const t0 = await turnOf(page);
  await control(page, 'turnRight').click();
  const t1 = await turnOf(page);
  const step = t1[1]! - t0[1]!;
  expect(step).toBeGreaterThan(0);
  expect([t1[0], t1[2]]).toEqual([t0[0], t0[2]]);
  // The key equivalent, while the turning group has focus: the same step.
  await control(page, 'turnRight').focus();
  await page.keyboard.press('ArrowRight');
  await expect(out(page, 'turn')).toHaveText([t1[0], t1[1]! + step, t1[2]].join(', '));
  await page.keyboard.press('ArrowUp');
  await expect(out(page, 'turn')).toHaveText([(t1[0]! + step) % 360, t1[1]! + step, t1[2]].join(', '));
  await control(page, 'turnUp').click();
  await expect(out(page, 'turn')).toHaveText([(t1[0]! + 2 * step) % 360, t1[1]! + step, t1[2]].join(', '));
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(out(page, 'turn')).toHaveText([(t1[0]! + 2 * step) % 360, t1[1]! + step, (t1[2]! + step) % 360].join(', '));
  // The link carries the three angles (replaceState after the burst; Copy link encodes the same state).
  const turn = (await turnOf(page)).join(',');
  await expect.poll(() => decodeURIComponent(page.url())).toContain(`j=xyz:1,2,3@${turn}`);
  // The whole sentence of the last turn (within half a second only the last is said, A-4), its three
  // angles computed above from the step (RT-FIX residual, the P3-RT-11-08 sibling in phase 4).
  const last = [(t1[0]! + 2 * step) % 360, t1[1]! + step, (t1[2]! + step) % 360];
  await expect(live(page)).toHaveText(`Turn now ${last.join(', ')} degrees.`);
  // Keys act only inside the group: an arrow on the ring board moves the focus, not the picture.
  await node(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(out(page, 'turn')).toHaveText(turn.split(',').join(', '));
});

test('no motion starts by itself; spin has a pause control', async ({ page }) => {
  for (const reduced of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion: reduced });
    await open(page, 'g=A3&r=1.0.1');
    const turn = await out(page, 'turn').innerText();
    const ms = await out(page, 'drawMs').innerText();
    await page.waitForTimeout(1000);
    await expect(out(page, 'turn')).toHaveText(turn);
    await expect(out(page, 'drawMs')).toHaveText(ms);
    // There is no continuous rotation at all, so no spin control (and no pause control is needed).
    await expect(root(page).locator('[data-control*="spin" i], [data-control*="pause" i]')).toHaveCount(0);
  }
});

test('rank 3 offers the Coxeter plane and states distinct dots on A3 and B3', async ({ page }) => {
  await open(page, 'g=A3&r=1.0.1');
  await control(page, 'viewCoxeter').click();
  await expect(out(page, 'projection')).toHaveText('coxeter');
  const a3 = golden.types.A3!.coxeter_plane!;
  await expect(out(page, 'distinctDots')).toHaveText(`${a3.distinct_points} distinct dots for ${sum(ringCounts('A3'))} points`);
  await expect(out(page, 'ringSizes')).toHaveText(ringCounts('A3').join(', '));
  // B3: the root polytope with the short roots as a second set of points.
  await open(page, 'g=B3');
  await control(page, 'rootPolytope').click();
  await control(page, 'shortRoots').check();
  await control(page, 'viewCoxeter').click();
  const b3 = golden.types.B3!.coxeter_plane!;
  await expect(out(page, 'pointCount')).toHaveText(String(sum(ringCounts('B3'))));
  await expect(out(page, 'distinctDots')).toHaveText(`${b3.distinct_points} distinct dots for ${sum(ringCounts('B3'))} points`);
});

test('D4 in the Coxeter plane shows 12 dots for 24 roots', async ({ page }) => {
  await open(page, 'g=D4&r=0.1.0.0&j=coxeter');
  const d4 = golden.types.D4!.coxeter_plane!;
  await expect(out(page, 'distinctDots')).toHaveText(`${d4.distinct_points} distinct dots for ${sum(ringCounts('D4'))} points`);
  await expect(out(page, 'source')).toHaveText('preset');
});

// ---------------------------------------------------------------------------------------------
// Graphs, faces, uniform, short roots (4 T10 Switch, Output, Make uniform, Input)
// ---------------------------------------------------------------------------------------------

test('two graphs on the hexagon', async ({ page }) => {
  await open(page, 'g=A2&r=1.1');
  await expect(out(page, 'graph')).toHaveText('polytope');
  await expect(out(page, 'edgeCount')).toHaveText('6');
  // The switch from the keyboard.
  await control(page, 'graphMoves').focus();
  await page.keyboard.press('Enter');
  await expect(out(page, 'graph')).toHaveText('moves');
  await expect(out(page, 'edgeCount')).toHaveText('6');
  await expect(out(page, 'sharedEdges')).toHaveText('4');
  await expect(out(page, 'edgesDrawn')).toHaveText('6');
  await expect(out(page, 'legend')).toContainText('node 1');
  await expect(out(page, 'legend')).toContainText('node 2');
  // Every coloured edge carries its label in the SVG of the view (export), after the reader's change.
  await expect.poll(async () => out(page, 'snapshot').locator('text[data-edge-label]').count(), { timeout: 5000 }).toBe(6);
  await expect.poll(() => decodeURIComponent(page.url())).toContain('e=m');
});

test('face table of B3 (1,0,1)', async ({ page }) => {
  await open(page, 'g=B3&r=1.0.1');
  await expect(out(page, 'fVector')).toHaveText(record('B3', [1, 0, 1]).f_vector.join(', '));
  for (const [d, total] of record('B3', [1, 0, 1]).f_vector.entries()) {
    await expect(out(page, 'faceTable').locator(`[data-total="${d}"]`)).toHaveText(String(total));
  }
});

test('make uniform on B3 (0,1,1)', async ({ page }) => {
  const r = record('B3', [0, 1, 1]);
  await open(page, 'g=B3&r=0.1.1');
  await expect(out(page, 'uniform')).toHaveText('off');
  await expect(out(page, 'edgeLengths')).toHaveAttribute('data-count', '2');
  await control(page, 'uniform').check();
  await expect(out(page, 'uniform')).toHaveText('on');
  await expect(out(page, 'edgeLengths')).toHaveAttribute('data-count', '1');
  await expect(out(page, 'vertexCount')).toHaveText(String(r.f_vector[0]));
  await expect(out(page, 'edgeCount')).toHaveText(String(r.f_vector[1]));
  await expect(out(page, 'edgesDrawn')).toHaveText(String(r.f_vector[1]));
  // Not a link field: the address keeps no trace of it.
  await page.waitForTimeout(700);
  expect(decodeURIComponent(page.url())).not.toContain('uniform');
});

test('root polytope shortcut and the second set of points', async ({ page }) => {
  await open(page, 'g=B3&r=1.0.1');
  await control(page, 'rootPolytope').click();
  expect(await valuesOf(page)).toEqual(golden.types.B3!.numbers_of_highest_root.map(String));
  await expect(control(page, 'shortRoots')).toHaveCount(1);
  await control(page, 'shortRoots').check();
  await expect(out(page, 'pointCount')).toHaveText(String(sum(ringCounts('B3'))));
  await open(page, 'g=A3');
  await expect(control(page, 'shortRoots')).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// Limits (5.6, 5.9) and the shells of M7 beat 7 (E-9)
// ---------------------------------------------------------------------------------------------

test('1_42 shows vertices only with the message', async ({ page }) => {
  const r = record('E8', [0, 1, 0, 0, 0, 0, 0, 0]);
  const seen = watch(page);
  await open(page, 'g=E8&r=0.1.0.0.0.0.0.0');
  await expect(out(page, 'limitMessage')).toContainText(String(r.f_vector[1]));
  await expect(out(page, 'limitMessage')).toContainText(String(CAPS.edgesAtRest));
  await expect(out(page, 'vertexCount')).toHaveText(String(r.f_vector[0]));
  await expect(out(page, 'edgesDrawn')).toHaveText('0');
  expect(seen.worker).toEqual([]);
  // The reader asks for the drawing: the vertices come from the worker, never an edge.
  await control(page, 'drawOrbit').click();
  await expect(out(page, 'pointsDrawn')).toHaveText(String(r.f_vector[0]), { timeout: 60000 });
  await expect(out(page, 'edgesDrawn')).toHaveText('0');
  expect(seen.worker.length).toBeGreaterThan(0);
});

test('an orbit above 20000 vertices is refused with its size', async ({ page }) => {
  const seen = watch(page);
  const size = golden.types.E8!.fundamental_orbit_sizes[2]!;
  expect(size).toBeGreaterThan(CAPS.verticesDrawn);
  await open(page, 'g=E8&r=0.0.1.0.0.0.0.0');
  await expect(out(page, 'refused')).toContainText(String(size));
  await expect(out(page, 'refused')).toContainText(String(CAPS.verticesDrawn));
  await expect(out(page, 'pointsDrawn')).toHaveText('0');
  await expect(control(page, 'drawOrbit')).toHaveCount(0);
  await expect(out(page, 'faceTable').locator('[data-total="0"]')).toHaveText(String(size));
  await page.waitForLoadState('networkidle');
  expect(seen.worker).toEqual([]);
  expect(seen.presets).toEqual([]);
});

test('the four-shell links of M7 beat 7 open without the worker', async ({ page }) => {
  test.setTimeout(180000);
  const sizes = golden.types.E8!.fundamental_orbit_sizes;
  const E8 = boardFromName('E8');
  const sides = new Set<boolean>();
  for (const link of [
    'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter',
    'g=E8&r=1.0.0.0.0.0.0.0&j=coxeter',
    'g=E8&r=0.0.0.0.0.0.1.0&j=coxeter',
    'g=E8&r=0.1.0.0.0.0.0.0&j=coxeter',
    'g=E8&r=0.0.0.0.0.0.0.2&j=coxeter',
  ]) {
    const seen = watch(page);
    const rings = /r=([\d.]+)/.exec(link)![1]!.split('.').map(Number);
    const ringed = rings.findIndex((x) => x !== 0);
    // The edges of the polytope from the engine, never from the page: whether the limit message must appear
    // is decided by the exact count (5.9), and the page must show that count.
    const edges = wythoffFVector(E8, inPositions(E8, rings))[1]!;
    const above = edges > BigInt(CAPS.edgesAtRest);
    sides.add(above);
    await open(page, link);
    await expect(out(page, 'vertexCount'), link).toHaveText(String(sizes[ringed]));
    await expect(out(page, 'edgeCount'), link).toHaveText(String(edges));
    await expect(out(page, 'faceTable')).toHaveCount(1);
    if (above) await expect(out(page, 'limitMessage'), link).toContainText(String(edges));
    else await expect(out(page, 'limitMessage'), link).toHaveText('');
    await page.waitForLoadState('networkidle');
    expect(seen.worker, link).toEqual([]);
    page.removeAllListeners('request');
    page.removeAllListeners('worker');
  }
  // The shells cover both sides of the cap: some with every edge, some vertices only.
  expect([...sides].sort()).toEqual([false, true]);
  // 2_41: the reader presses "Draw the orbit"; the worker draws every edge at rest, with no limit message.
  const r = record('E8', [1, 0, 0, 0, 0, 0, 0, 0]);
  const seen = watch(page);
  await open(page, 'g=E8&r=1.0.0.0.0.0.0.0&j=coxeter');
  await control(page, 'drawOrbit').click();
  await expect(out(page, 'edgesDrawn')).toHaveText(String(r.f_vector[1]), { timeout: 120000 });
  await expect(out(page, 'edgeCount')).toHaveText(String(r.f_vector[1]));
  await expect(out(page, 'limitMessage')).toHaveText('');
  await expect(out(page, 'source')).toHaveText('computed');
  expect(seen.worker.length).toBeGreaterThan(0);
});

test('no preset or default requests the worker', async ({ page, context }) => {
  test.setTimeout(120000);
  const requested: string[] = [];
  await context.route(WORKER, async (r) => {
    requested.push(r.request().url());
    await r.abort();
  });
  for (const query of [
    '',
    'g=A2&r=1.1',
    'g=A3&r=1.0.1',
    'g=D4&r=0.1.0.0',
    'g=A3&r=1.0.0',
    'g=B3&r=1.0.1',
    'g=B3&r=0.1.1',
    'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter',
    'g=D4&r=0.1.0.0&j=coxeter',
  ]) {
    const seen = watch(page);
    await open(page, query);
    await expect(out(page, 'source'), query).toHaveText('preset');
    expect(seen.presets.length, query).toBeGreaterThan(0);
    page.removeAllListeners('request');
    page.removeAllListeners('worker');
  }
  // The graph switch on A2 and make uniform on B3 need no further call.
  await open(page, 'g=A2&r=1.1');
  await control(page, 'graphMoves').click();
  await expect(out(page, 'sharedEdges')).toHaveText('4');
  await open(page, 'g=B3&r=0.1.1');
  await control(page, 'uniform').check();
  await expect(out(page, 'uniform')).toHaveText('on');
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Without JavaScript (7.4), the table view and text alternatives (A-10), mathematics (A-12)
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the default projection ships as an SVG snapshot without JavaScript', async ({ page }) => {
    const r = record('A3', [1, 0, 1]);
    await page.goto(ROUTE);
    const svg = out(page, 'snapshot').locator('svg').first();
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg.locator('circle')).toHaveCount(r.f_vector[0]!);
    const d = await svg.locator('g[id$="-segments"] path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d') ?? '').join(''));
    expect((d.match(/M/g) ?? []).length).toBe(r.f_vector[1]);
    await expect(svg.locator('title')).toContainText('A3');
    await expect(out(page, 'caption')).not.toHaveText('');
    await expect(out(page, 'faceTable').locator('table')).toHaveCount(1);
    await expect(out(page, 'fVector')).toHaveText(r.f_vector.join(', '));
    await expect(root(page).locator('button[data-node]')).toHaveCount(3);
    const enabled = await root(page)
      .locator('button, input, select')
      .evaluateAll((els) => els.filter((e) => !(e as HTMLInputElement).matches(':disabled')).map((e) => e.outerHTML.slice(0, 80)));
    expect(enabled).toEqual([]);
    await expect(out(page, 'noscript')).toHaveCount(1);
    await expect(root(page).locator('noscript')).toHaveCount(1);
  });

  test('mathematics is MathML without JavaScript', async ({ page }) => {
    await page.goto(`${ROUTE}?g=E8&r=0.0.0.0.0.0.0.1&j=coxeter`);
    // Without JavaScript the configured default is shown: its board name is MathML.
    await expect(out(page, 'boardName').locator('math')).toHaveCount(1);
    const text = await root(page).innerText();
    for (const raw of ['4_21', 'E_8', '$']) expect(text).not.toContain(raw);
  });
});

test('show as table and the text alternative', async ({ page }) => {
  await open(page, 'g=B3&r=1.0.1');
  const r = record('B3', [1, 0, 1]);
  await root(page).locator('summary', { hasText: 'Show as table' }).click();
  const before = await node(page, 2).getAttribute('data-value');
  expect(before).toBe('0');
  await root(page).locator('[data-table-node="2"]').click();
  await expect(node(page, 2)).toHaveAttribute('data-value', '1');
  await root(page).locator('[data-table-node="2"]').click();
  await expect(node(page, 2)).toHaveAttribute('data-value', '0');
  // Any non-negative integer from the keyboard: the number field of a node.
  await root(page).locator('[data-table-ring="3"]').fill('2');
  await root(page).locator('[data-table-ring="3"]').press('Enter');
  await root(page).locator('[data-table-ring="3"]').blur();
  await expect(node(page, 3)).toHaveAttribute('data-value', '2');
  await control(page, 'undo').click();
  await expect(node(page, 3)).toHaveAttribute('data-value', '1');
  const vertices = root(page).locator('[data-table="vertices"]');
  await expect(vertices.locator('caption')).toContainText(`Vertices: ${r.f_vector[0]}`);
  await expect(vertices.locator('tbody tr')).toHaveCount(r.f_vector[0]!);
  await expect(root(page).locator('[data-table="edges"] tbody tr')).toHaveCount(r.f_vector[1]!);
  await expect(out(page, 'faceTable')).toHaveCount(1);
  // The text alternative of the canvas names the board, the rings and the counts.
  const label = (await root(page).locator('[data-figure="canvas"]').getAttribute('aria-label')) ?? '';
  expect(label).toContain('B3');
  expect(label).toContain('rings 1, 0, 1');
  expect(label).toContain(`${r.f_vector[0]} vertices`);
  expect(label).toContain(`${r.f_vector[1]} edges`);
});

test('mathematics is MathML and no KaTeX script loads', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(r.url());
  });
  for (const query of ['g=E8&r=0.0.0.0.0.0.0.1&j=coxeter', 'g=B3&r=0.1.1']) {
    await open(page, query);
    await expect(out(page, 'boardName').locator('math')).toHaveCount(1);
    const name = out(page, 'polytopeName');
    if (query.startsWith('g=E8')) await expect(name.locator('math')).not.toHaveCount(0);
    else await expect(name).toHaveText('truncated cube');
    const text = await root(page).innerText();
    for (const raw of ['4_21', 'E_8', '$']) expect(text, query).not.toContain(raw);
  }
  expect(scripts.filter((u) => /katex/i.test(u))).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Main-thread work (7.6; smoke check on an unthrottled runner, the phone verdict is GATE's lab run)
// ---------------------------------------------------------------------------------------------

// The long tasks of a page, recorded from navigation on (an observer installed before any script of the
// page runs), and the time the island finished hydrating (Astro's astro:hydrate event on the island).
// While a measurement runs the test waits with page.waitForFunction, never with expect: an expect that
// retries computes an accessibility snapshot of the page on the main thread, which is not the tool's work.
async function recordLongTasks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __longtasks: { start: number; duration: number }[]; __hydratedAt: number | null };
    w.__longtasks = [];
    w.__hydratedAt = null;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__longtasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
    document.addEventListener(
      'astro:hydrate',
      (e) => {
        if ((e.target as Element | null)?.querySelector?.('[data-tool="geometry"]')) w.__hydratedAt = Math.round(performance.now());
      },
      { capture: true },
    );
  });
}
const longTasks = async (page: Page, from = 0): Promise<{ start: number; duration: number }[]> =>
  page.evaluate((t0) => (window as unknown as { __longtasks: { start: number; duration: number }[] }).__longtasks.filter((t) => t.start + t.duration > t0), from);
const now = async (page: Page): Promise<number> => page.evaluate(() => performance.now());
const settle = async (page: Page, condition: string): Promise<void> => {
  await page.waitForFunction(
    (c) => {
      const tool = document.querySelector('[data-tool="geometry"]');
      const text = (name: string): string => tool?.querySelector(`[data-out="${name}"]`)?.textContent ?? '';
      const [name, value] = c.split('=');
      return tool?.getAttribute('data-hydrated') === 'true' && (value === undefined ? text(name!) !== '' : text(name!) === value);
    },
    condition,
    { polling: 50, timeout: 30000 },
  );
};

test('no long task on E8 loads and the graph switch', async ({ page }) => {
  await recordLongTasks(page);
  const showpiece = record('E8', [0, 0, 0, 0, 0, 0, 0, 1]);
  // A first visit compiles the route's scripts (the browser's work, the same for every link; GATE's lab run
  // measures the cold load on the phone profile). The loads below are measured whole, from navigation on:
  // parsing, hydration, the link's counts and face table, the data file and the drawing.
  await page.goto(ROUTE);
  await settle(page, 'drawMs');
  const loads: [string, string][] = [
    ['g=E8&r=0.0.1.0.0.0.0.0', 'refused'], // the refusal: counts and face table only
    ['g=E8&r=0.0.0.0.0.0.0.1&j=coxeter', `edgesDrawn=${showpiece.f_vector[1]}`], // the showpiece, from its data file
  ];
  for (const [query, condition] of loads) {
    await page.goto(`${ROUTE}?${query}`);
    await settle(page, condition);
    await page.waitForTimeout(500);
    const hydratedAt = await page.evaluate(() => (window as unknown as { __hydratedAt: number | null }).__hydratedAt);
    const tasks = await longTasks(page);
    console.info(`T10 long tasks on the load of ${query} (hydrated at ${hydratedAt} ms): ${JSON.stringify(tasks)}`);
    expect(hydratedAt, query).not.toBeNull();
    expect(tasks, query).toEqual([]);
  }
  // The switch to the move graph of the showpiece (its edges from the data file, each with its label).
  const t0 = await now(page);
  await control(page, 'graphMoves').click();
  await page.waitForFunction(
    (polytopeEdges) => {
      const out = (name: string): string => document.querySelector(`[data-tool="geometry"] [data-out="${name}"]`)?.textContent ?? '';
      return out('graph') === 'moves' && out('edgesDrawn') !== '' && out('edgesDrawn') !== polytopeEdges;
    },
    String(showpiece.f_vector[1]),
    { polling: 50, timeout: 30000 },
  );
  await page.waitForTimeout(800);
  const tasks = await longTasks(page, t0);
  console.info(`T10 long tasks after the graph switch: ${JSON.stringify(tasks)}`);
  expect(tasks).toEqual([]);
});

test('no long task after a ring click on the largest main-thread configuration', async ({ page }) => {
  // The configuration with the most vertices and edges that the tool still enumerates on the main thread
  // (at most CAPS.mainThreadItems of each, E-9), over the 32 types with one ringed node, found by the engine.
  let best: { type: string; label: number; vertices: number; edges: number } | null = null;
  for (const type of Object.keys(golden.types)) {
    const board = boardFromName(type);
    for (let label = 1; label <= board.n; label++) {
      const rings = new Array<number>(board.n).fill(0);
      rings[toPositions(board, [label])[0]!] = 1; // the engine takes positions (E-7)
      const f = wythoffFVector(board, rings);
      const vertices = Number(f[0]);
      const edges = Number(f[1]);
      if (vertices > CAPS.mainThreadItems || edges > CAPS.mainThreadItems) continue;
      if (best === null || vertices + edges > best.vertices + best.edges) best = { type, label, vertices, edges };
    }
  }
  expect(best).not.toBeNull();
  const { type, label, edges } = best!;
  await recordLongTasks(page);
  const zeros = Array.from({ length: boardFromName(type).n }, () => 0).join('.');
  await page.goto(`${ROUTE}?g=${type}&r=${zeros}`);
  await settle(page, 'drawMs');
  await page.waitForTimeout(500);
  const t0 = await now(page);
  await node(page, label).click();
  await settle(page, `edgesDrawn=${edges}`);
  await page.waitForTimeout(800);
  const tasks = await longTasks(page, t0);
  console.info(`T10 long tasks after ringing node ${label} of ${type} (${best!.vertices} vertices, ${edges} edges): ${JSON.stringify(tasks)}`);
  expect(tasks).toEqual([]);
  await expect(out(page, 'vertexCount')).toHaveText(String(best!.vertices));
  await expect(out(page, 'sharedEdges')).not.toHaveText('');
});

// ---------------------------------------------------------------------------------------------
// Targets, rings, history, links, hooks (A-7; 5.3; 4.0; 6.6)
// ---------------------------------------------------------------------------------------------

test('targets are at least 24 pixels at 320 wide', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const query of ['g=A3&r=1.0.1', 'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter', 'g=B3&r=0.1.1']) {
    await open(page, query);
    const boxes = await root(page)
      .locator('button[data-node], [data-control]:is(button, select, input), [data-export], [data-control="copyLink"], [data-control="downloadData"]')
      .evaluateAll((els) =>
        els
          .map((e) => {
            const r = e.getBoundingClientRect();
            return { what: e.getAttribute('data-control') ?? e.getAttribute('data-node') ?? e.tagName, x: r.x, y: r.y, w: r.width, h: r.height };
          })
          .filter((b) => b.w > 0 && b.h > 0),
      );
    expect(boxes.length).toBeGreaterThan(10);
    for (const b of boxes) {
      expect(b.w, `${query} ${b.what} width`).toBeGreaterThanOrEqual(24);
      expect(b.h, `${query} ${b.what} height`).toBeGreaterThanOrEqual(24);
      expect(b.x + b.w, `${query} ${b.what} inside the viewport`).toBeLessThanOrEqual(320 + 0.5);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const c = boxes[j]!;
        const overlap = a.x < c.x + c.w - 0.5 && c.x < a.x + a.w - 0.5 && a.y < c.y + c.h - 0.5 && c.y < a.y + a.h - 0.5;
        expect(overlap, `${query}: ${a.what} and ${c.what} overlap`).toBe(false);
      }
    }
    // Buttons of the tool reach 44 by 44 where the layout allows (A-7): every control button here does.
    for (const b of boxes.filter((x) => x.what.startsWith('turn') || x.what.startsWith('graph') || x.what.startsWith('view') || x.what === 'rootPolytope')) {
      expect(Math.min(b.w, b.h), `${query} ${b.what}`).toBeGreaterThanOrEqual(44);
    }
  }
});

test('clicking rings a node, announces, and undo restores', async ({ page }) => {
  const small = record('A3', [1, 0, 0]);
  const big = record('A3', [1, 0, 1]);
  await open(page, 'g=A3&r=1.0.0');
  await expect(out(page, 'vertexCount')).toHaveText(String(small.f_vector[0]));
  await node(page, 3).click();
  await expect(node(page, 3)).toHaveAttribute('data-value', '1');
  await expect(out(page, 'vertexCount')).toHaveText(String(big.f_vector[0]));
  await expect(out(page, 'edgeCount')).toHaveText(String(big.f_vector[1]));
  await expect(out(page, 'edgesDrawn')).toHaveText(String(big.f_vector[1]));
  // The whole sentence: the edit, then the counts of the new orbit from the golden f-vector (RT-FIX
  // residual, the P3-RT-11-08 sibling in phase 4).
  await expect(live(page)).toHaveText(`Node 3 ring 1. ${big.f_vector[0]} vertices, ${big.f_vector[1]} edges; faces by dimension ${big.f_vector.join(', ')}.`);
  await expect(out(page, 'edits')).toHaveText('1');
  await expect(root(page)).toHaveAttribute('data-moves', /^\d+$/);
  await expect(node(page, 3)).toHaveAttribute('aria-label', 'Node 3, value 1, ringed');
  await expect(node(page, 2)).toHaveAttribute('aria-label', 'Node 2, value 0, not ringed');
  await control(page, 'undo').click();
  expect(await valuesOf(page)).toEqual(['1', '0', '0']);
  await expect(out(page, 'vertexCount')).toHaveText(String(small.f_vector[0]));
  await expect(out(page, 'edits')).toHaveText('0');
  await control(page, 'redo').click();
  expect(await valuesOf(page)).toEqual(['1', '0', '1']);
  // The ring buttons reach every non-negative integer without a mouse.
  await node(page, 2).focus();
  await control(page, 'ringUp').click();
  await control(page, 'ringUp').click();
  await expect(node(page, 2)).toHaveAttribute('data-value', '2');
  await control(page, 'ringDown').click();
  await expect(node(page, 2)).toHaveAttribute('data-value', '1');
  // Reset returns to the configured state (on this route the default: the root polytope of A3).
  await control(page, 'reset').click();
  expect(await valuesOf(page)).toEqual(golden.types.A3!.numbers_of_highest_root.map(String));
  await expect(out(page, 'edits')).toHaveText('0');
});

test('picker resets rings; unsupported boards and projections load the default with the notice', async ({ page }) => {
  await open(page, 'g=A3&r=1.0.0');
  await control(page, 'picker').selectOption('E8');
  expect(await valuesOf(page)).toEqual(golden.types.E8!.numbers_of_highest_root.map(String));
  await expect(out(page, 'projection')).toHaveText('coxeter');
  await expect(out(page, 'source')).toHaveText('preset');
  await expect.poll(() => decodeURIComponent(page.url())).toContain(`g=E8&r=${golden.types.E8!.numbers_of_highest_root.join('.')}`);
  for (const query of ['g=A4~', 'g=A3&j=xyz:1,2,5', 'g=pentagon', 'g=B3&r=1.0']) {
    await open(page, query);
    await expect(out(page, 'notice'), query).toHaveText(NOTICE);
    expect(await valuesOf(page), query).toEqual(golden.types.A3!.numbers_of_highest_root.map(String));
    await expect(root(page).locator('button[data-node]')).toHaveCount(3);
  }
});

test('the ring cap is stated beside the ring fields, and a ring held to it is said', async ({ page }) => {
  await open(page, 'g=A3&r=1.0.0');
  await root(page).locator('summary', { hasText: 'Show as table' }).click();
  const field = root(page).locator('[data-table-ring="3"]');
  const limit = out(page, 'ringLimit');
  // Stated in words beside the fields, with the number; each field is described by that line.
  await expect(limit).toBeVisible();
  await expect(limit).toContainText(`0 to ${RING_MAX}`);
  await expect(field).toHaveAttribute('max', String(RING_MAX));
  const described = await field.getAttribute('aria-describedby');
  expect(described).toBeTruthy();
  await expect(limit).toHaveAttribute('id', described!);
  // A typed value above the cap: the ring is held to it, the field shows the ring, and both the line
  // beside the fields and the live region say so.
  await field.fill(String(RING_MAX + 1));
  await field.press('Enter');
  await field.blur();
  await expect(node(page, 3)).toHaveAttribute('data-value', String(RING_MAX));
  await expect(field).toHaveValue(String(RING_MAX));
  await expect(limit).toContainText(`Node 3 held at ${RING_MAX}`);
  // Whole sentences in the live region (RT-FIX residual, the P3-RT-11-08 sibling in phase 4): the ring
  // held to the cap, then, since the rings changed, the counts of the orbit with nodes 1 and 3 ringed
  // (the golden f-vector of A3 with rings 1, 0, 1; the counts do not depend on the size of a ring).
  const held = `Node 3 held at ${RING_MAX}: a ring is a whole number from 0 to ${RING_MAX}, the largest the studio takes.`;
  const r101 = record('A3', [1, 0, 1]);
  await expect(live(page)).toHaveText(`${held} ${r101.f_vector[0]} vertices, ${r101.f_vector[1]} edges; faces by dimension ${r101.f_vector.join(', ')}.`);
  await expect(out(page, 'edits')).toHaveText('1');
  // A ring inside the range clears the sentence.
  await field.fill('2');
  await field.press('Enter');
  await field.blur();
  await expect(node(page, 3)).toHaveAttribute('data-value', '2');
  await expect(limit).not.toContainText('held at');
  // Typed above the cap while the ring is the cap already: nothing changes, the field shows the ring
  // (not the typed value), and the sentence is said again.
  await field.fill(String(RING_MAX));
  await field.press('Enter');
  await field.blur();
  await expect(node(page, 3)).toHaveAttribute('data-value', String(RING_MAX));
  await field.fill(String(RING_MAX + 5));
  await field.press('Enter');
  await field.blur();
  await expect(field).toHaveValue(String(RING_MAX));
  await expect(limit).toContainText(`Node 3 held at ${RING_MAX}`);
  // Nothing changed, so the held sentence alone.
  await expect(live(page)).toHaveText(held);
  await expect(out(page, 'edits')).toHaveText('3');
});

test('a link with a ring above the cap loads the default and says why', async ({ page }) => {
  await open(page, `g=A3&r=1.0.${RING_MAX + 1}`);
  const notice = out(page, 'notice');
  await expect(notice).toContainText(NOTICE);
  await expect(notice).toContainText(String(RING_MAX + 1));
  await expect(notice).toContainText(String(RING_MAX));
  expect(await valuesOf(page)).toEqual(golden.types.A3!.numbers_of_highest_root.map(String));
  // At the cap itself the link is read.
  await open(page, `g=A3&r=1.0.${RING_MAX}`);
  await expect(out(page, 'notice')).toHaveCount(0);
  expect(await valuesOf(page)).toEqual(['1', '0', String(RING_MAX)]);
});

test('hooks are present', async ({ page }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-tool', 'geometry');
  await expect(root(page)).toHaveAttribute('data-moves', /^\d+$/);
  const nodes = root(page).locator('button[data-node]');
  await expect(nodes).toHaveCount(3);
  for (const b of await nodes.all()) {
    await expect(b).toHaveAttribute('data-board', 'numbers');
    await expect(b).toHaveAttribute('data-value', /^\d+$/);
    await expect(b).toHaveAttribute('data-can-act', 'true');
  }
  const registry = readFileSync(fileURLToPath(new URL('../../src/components/tools/t10/config.ts', import.meta.url)), 'utf8');
  const outs = [...registry.slice(registry.indexOf('T10_OUTS')).matchAll(/^\s+'([A-Za-z]+)',$/gm)].map((m) => m[1]!);
  expect(outs.length).toBeGreaterThan(20);
  for (const name of outs) {
    if (name === 'notice' || name === 'noscript') continue; // a bad link; JavaScript off (tested above)
    // Rendered only with a prediction (lesson instances; registry-outs.spec.ts checks them on M7).
    if (name === 'predictResult' || name === 'predictReveal') continue;
    await expect(out(page, name), name).toHaveCount(1);
  }
});

test('no serious or critical axe violations on the studio', async ({ page }) => {
  for (const query of ['', 'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter', 'g=A2&r=1.1&e=m']) {
    await open(page, query);
    await root(page).locator('summary', { hasText: 'Show as table' }).click();
    const results = await new AxeBuilder({ page }).include('[data-tool="geometry"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
    expect(serious, query).toEqual([]);
  }
});

// ---------------------------------------------------------------------------------------------
// Regressions (RT-FIX, phase 4 red-team round)
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  const M7 = 'modules/m7-geometry/';
  const instance = (page: Page, id: string): Locator => page.locator(`[data-tool="geometry"][data-instance="${id}"]`);
  /** The KaTeX fonts, aborted where a box is measured, so that their swap (a cause of its own) does not enter it. */
  const KATEX_FONTS = /\/katex\/[^/]+\/fonts\//;

  /** document.activeElement after a key press, as tag[data-control or data-node], or BODY when the focus fell to the page. */
  async function focusAfter(page: Page): Promise<string> {
    return page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return 'BODY';
      return `${e.tagName.toLowerCase()}[${e.dataset.control ?? e.dataset.tableNode ?? e.dataset.node ?? ''}]`;
    });
  }

  /** Opens a route with "Copy link" and the history calls recorded, and waits until the first tool has hydrated. */
  async function openRecorded(page: Page, path: string): Promise<Locator> {
    await page.addInitScript(() => {
      const w = window as unknown as { __copied: string[] };
      w.__copied = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied.push(t); } } });
    });
    await page.goto(path);
    const t = page.locator('[data-tool]').first();
    await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await page.waitForTimeout(1500);
    return t;
  }

  /** Download data of the first tool, parsed. */
  async function downloaded(page: Page): Promise<{ derived: Record<string, unknown> }> {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-tool] [data-control="downloadData"]').first().click()]);
    return JSON.parse(readFileSync((await dl.path())!, 'utf8')) as { derived: Record<string, unknown> };
  }

  /** Safe integers written as strings, anywhere in the derived tables. */
  function safeAsStrings(doc: unknown, path = ''): string[] {
    const found: string[] = [];
    if (typeof doc === 'string') {
      if (/^-?\d+$/.test(doc) && Number.isSafeInteger(Number(doc))) found.push(`${path}=${JSON.stringify(doc)}`);
    } else if (Array.isArray(doc)) doc.forEach((v, k) => found.push(...safeAsStrings(v, `${path}[${k}]`)));
    else if (doc && typeof doc === 'object') for (const [k, v] of Object.entries(doc)) found.push(...safeAsStrings(v, `${path}.${k}`));
    return found;
  }

  /** Every data-out of each T10 root, outside <noscript>, a measured one by its presence (as nojs.spec.ts compares them). */
  async function outsOfRoots(page: Page): Promise<{ instance: string; outs: string[] }[]> {
    return page.locator('[data-tool="geometry"]').evaluateAll((roots) =>
      roots.map((r) => ({
        instance: r.getAttribute('data-instance') ?? '',
        outs: [...r.querySelectorAll('[data-out]')]
          .filter((o) => o.closest('noscript') === null)
          .map((o) => (o.hasAttribute('data-measured') ? `${o.getAttribute('data-out')} (measured)` : `${o.getAttribute('data-out')}=${(o.textContent ?? '').replace(/\s+/g, ' ').trim()}`)),
      })),
    );
  }

  /** The height of each T10 root whose island has not hydrated yet (astro-island[ssr]), by instance. */
  async function serverHeights(page: Page): Promise<Record<string, number>> {
    return page.locator('[data-tool="geometry"]').evaluateAll((roots) =>
      Object.fromEntries(roots.filter((r) => r.closest('astro-island[ssr]') !== null).map((r) => [r.getAttribute('data-instance') ?? '', r.getBoundingClientRect().height])),
    );
  }

  /** Cumulative Layout Shift as the largest session window (P3-A7 5.6; the gap of 1 s and the window of 5 s). */
  function clsOf(shifts: { t: number; v: number }[]): number {
    let best = 0;
    let cur = 0;
    let first = -Infinity;
    let prev = -Infinity;
    for (const s of [...shifts].sort((a, b) => a.t - b.t)) {
      if (s.t - prev < 1000 && s.t - first < 5000) cur += s.v;
      else {
        cur = s.v;
        first = s.t;
      }
      prev = s.t;
      best = Math.max(best, cur);
    }
    return best;
  }

  /**
   * The layout shifts of the 8 s after M7 opens at a reading position 300 px above an element of one T10
   * instance (set when the document is parsed, before its island hydrates, as scroll restoration or a link to a
   * beat leaves it), with the processor slowed four times and the KaTeX fonts aborted (SPEC 7.6 Lab timings).
   */
  async function clsAtReadingPosition(page: Page, id: string, target: string): Promise<number> {
    await page.route(KATEX_FONTS, (r) => r.abort());
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(
      ({ id, target }) => {
        const w = window as unknown as { __shifts: { t: number; v: number }[] };
        w.__shifts = [];
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__shifts.push({ t: e.startTime, v: e.value });
        }).observe({ type: 'layout-shift', buffered: true });
        document.addEventListener('DOMContentLoaded', () => {
          const el = document.querySelector(`[data-tool="geometry"][data-instance="${id}"] ${target}`)!;
          window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 300);
        });
      },
      { id, target },
    );
    await page.goto(M7, { waitUntil: 'load' });
    await page.waitForTimeout(8000);
    await expect(instance(page, id)).toHaveAttribute('data-hydrated', 'true');
    const shifts = await page.evaluate(() => (window as unknown as { __shifts: { t: number; v: number }[] }).__shifts);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return clsOf(shifts);
  }

  // SPEC 4 T10 Limits: "while it is being turned at most 8000 are drawn"; 5.6 "Edges drawn (T10) | 70000 at rest;
  // 8000 while turning". On E8 with a ring on node 1 (2_41, 69120 edges, drawn after "Draw the orbit"), a drag
  // holds the picture in the turning state; data-out edgesDrawn (the last canvas draw) reads CAPS.edgesTurning
  // while the pointer is down, and every edge again at rest.
  // regression: P4-RT-10-01
  test('while 2_41 is being turned at most 8000 edges are drawn, and all of them at rest', async ({ page }) => {
    test.setTimeout(240000);
    const edges = golden.wythoff.find((w) => w.type === 'E8' && w.rings.join('.') === '1.0.0.0.0.0.0.0')!.f_vector[1]!;
    expect(edges).toBeGreaterThan(CAPS.edgesTurning);
    expect(edges).toBeLessThanOrEqual(CAPS.edgesAtRest);
    await page.goto(`${ROUTE}?g=E8&r=1.0.0.0.0.0.0.0&j=coxeter`);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    await control(page, 'drawOrbit').click();
    await expect(out(page, 'edgesDrawn')).toHaveText(String(edges), { timeout: 180000 });
    const canvas = root(page).locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 10, { steps: 4 });
    // Still turning (the pointer is down): the last draw is the turning subset.
    await expect(out(page, 'edgesDrawn')).toHaveText(String(CAPS.edgesTurning));
    await page.mouse.up();
    await page.mouse.move(x + 41, y + 10);
    // At rest again: every edge.
    await expect(out(page, 'edgesDrawn')).toHaveText(String(edges), { timeout: 10000 });
  });

  // SPEC 4 T10 Make uniform: the start is replaced by a_i = c / sqrt(d_i) on the ringed nodes and the words are
  // replayed in floating point; 3 M7 beat 5: on B3 (0,1,1) the uniform picture has one edge length. The drawn
  // points themselves (the Euclidean coordinates y of every vertex, in Download data) are measured.
  // regression: P4-RT-10-02
  test('make uniform changes the drawn points: one edge length on B3 (0,1,1)', async ({ page }) => {
    interface Exported {
      derived: { vertices: { y: number[] }[]; edges: { a: number; b: number }[]; uniform: boolean };
    }
    const exported = async (): Promise<Exported> => (await downloaded(page)) as unknown as Exported;
    const lengths = (d: Exported): number[] => {
      const seen = new Set<string>();
      for (const { a, b } of d.derived.edges) {
        const ya = d.derived.vertices[a]!.y;
        const yb = d.derived.vertices[b]!.y;
        seen.add(ya.reduce((s, x, k) => s + (x - yb[k]!) ** 2, 0).toFixed(6));
      }
      return [...seen].map(Number).sort((x, y) => x - y);
    };
    await page.goto(`${ROUTE}?g=B3&r=0.1.1`);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    await expect(out(page, 'drawMs')).not.toHaveText('', { timeout: 15000 });
    const before = await exported();
    expect(before.derived.uniform).toBe(false);
    expect(lengths(before)).toHaveLength(2);
    await control(page, 'uniform').check();
    await expect(out(page, 'uniform')).toHaveText('on');
    const after = await exported();
    expect(after.derived.uniform).toBe(true);
    expect(after.derived.edges).toHaveLength(before.derived.edges.length);
    expect(lengths(after), 'squared lengths of the drawn edges with make uniform on').toHaveLength(1);
  });

  // SPEC 7.5 A-1: "the shortcuts u (undo) and r (redo) work only while focus is inside the board"; T10's undo
  // and redo act on the ring edits (decisions/P4-A3.md "history semantics and the picker").
  // regression: P4-RT-05-03
  test('u and r on a ring node of T10 undo and redo the ring edit (/tools/geometry/, A3)', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    const edits = out(page, 'edits');
    const node1 = root(page).locator('[data-board-group] button[data-node="1"]');
    await expect(node1).toHaveAttribute('aria-label', 'Node 1, value 1, ringed');
    await node1.focus();
    await page.keyboard.press('Enter');
    await expect(node1, 'Enter on node 1 unrings it').toHaveAttribute('aria-label', 'Node 1, value 0, not ringed');
    await expect(edits).toHaveText('1');
    // Focus is still on node 1, inside the board group: u must undo the edit (A-1).
    await expect(node1).toBeFocused();
    await page.keyboard.press('u');
    await expect(node1, 'u with the focus on ring node 1 of /tools/geometry/ (A3) must undo the ring edit').toHaveAttribute('aria-label', 'Node 1, value 1, ringed', { timeout: 3000 });
    await expect(edits).toHaveText('0');
    await page.keyboard.press('r');
    await expect(node1, 'r with the focus on ring node 1 must redo the ring edit').toHaveAttribute('aria-label', 'Node 1, value 0, not ringed', { timeout: 3000 });
  });

  // SPEC 6.3 ("May act here ... is shown by a second ring"), 4.0 Predict ("The board is frozen until the reader
  // has answered or pressed show me") and 4.0 Test hooks (data-can-act): a frozen ring board shows no node as
  // able to act (data-ring is Board.svelte's hook of the second ring).
  for (const id of ['b4', 'b7']) {
    // regression: P4-RT-05-06
    test(`the frozen ring board of M7 ${id} shows no node as able to act`, async ({ page }) => {
      await page.goto(M7);
      const tool = instance(page, id);
      await tool.scrollIntoViewIfNeeded();
      await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
      const nodes = tool.locator('[data-board-group] button[data-node]');
      await expect(nodes.first()).toHaveAttribute('aria-disabled', 'true');
      const rows = await nodes.evaluateAll((bs) =>
        bs.map((b) => `node ${(b as HTMLElement).dataset.node}: aria-disabled=${b.getAttribute('aria-disabled')} data-can-act=${(b as HTMLElement).dataset.canAct} data-ring=${(b as HTMLElement).dataset.ring}`),
      );
      expect(rows.length).toBe(3);
      for (const r of rows) expect(r, `/modules/m7-geometry/ ${id} before the prediction is answered`).toMatch(/aria-disabled=true data-can-act=false data-ring=false$/);
    });
  }

  // DECISIONS.md RT-FIX-P3-follow-predict: "after hydration a control that its own press makes inactive keeps the
  // focus"; SPEC 7.5 A-1 (WCAG 2.4.3). The T10 controls of the finding (the other tools' are another cluster's).
  // regression: P4-RT-05-01
  test('T10 "No rotation" keeps the focus (/tools/geometry/?g=D4)', async ({ page }) => {
    await page.goto(`${ROUTE}?g=D4`);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    const plus = control(page, 'rotatePlus');
    await expect(plus).toBeEnabled();
    await plus.focus();
    await page.keyboard.press('Enter');
    const none = control(page, 'rotateReset');
    await expect(none).toBeEnabled();
    await none.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    expect(await focusAfter(page), '/tools/geometry/?g=D4: document.activeElement after Enter on "No rotation"').not.toBe('BODY');
  });
  // regression: P4-RT-05-01
  test('T10 "Draw the orbit" keeps the focus in the tool (/tools/geometry/?g=E8&r=0.1.0.0.0.0.0.0)', async ({ page }) => {
    await page.goto(`${ROUTE}?g=E8&r=0.1.0.0.0.0.0.0`);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    const draw = control(page, 'drawOrbit');
    await draw.waitFor();
    await draw.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    expect(await focusAfter(page), 'document.activeElement after Enter on "Draw the orbit"').not.toBe('BODY');
  });

  // SPEC 7.5 target WCAG 2.2 AA, criterion 2.5.3 Label in Name: the accessible name of a control with a visible
  // text label contains that text.
  // regression: P4-RT-05-07
  test('every labelled control of tools/geometry/ has its visible text in its name (WCAG 2.5.3)', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    await page.waitForTimeout(500);
    const rows = await page.evaluate(() => {
      const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();
      return [...document.querySelectorAll('[data-tool="geometry"] button[aria-label][data-control]')].map((b) => ({
        control: (b as HTMLElement).dataset.control!,
        visible: norm((b as HTMLElement).innerText),
        name: norm(b.getAttribute('aria-label')!),
      }));
    });
    expect(rows.length, 'controls with an aria-label found').toBeGreaterThan(0);
    const bad = rows.filter((r) => r.visible !== '' && !r.name.includes(r.visible)).map((r) => `${r.control}: shows "${r.visible}", named "${r.name}"`);
    expect(bad, 'tools/geometry/: accessible names that do not contain the visible label').toEqual([]);
  });

  // SPEC 2.14 [V]: the squared length of the base edge at a ringed node i is 2 d_i a_i^2, an integer; with equal
  // rings on a simply laced board, one length. 4.0 Long numbers: above 12 digits the value is shown shortened,
  // with the exact digits in the tooltip and in the export.
  // regression: P4-RT-04-04
  test('A3 r=1306.1306.1306: one squared length, 3411272', async ({ page }) => {
    await openRecorded(page, `${ROUTE}?r=1306.1306.1306`);
    const l = out(page, 'edgeLengths');
    await expect(l).toHaveAttribute('data-count', '1');
    await expect(l).toHaveText('3411272');
  });
  // regression: P4-RT-04-04
  test('A3 r=999999.999999.999999: one squared length, 1999996000002, shown shortened with the exact digits in the tooltip and the export', async ({ page }) => {
    await openRecorded(page, `${ROUTE}?r=999999.999999.999999`);
    const l = out(page, 'edgeLengths');
    await expect(l).toHaveAttribute('data-count', '1');
    await expect(l).toHaveAttribute('title', '1999996000002');
    await expect(l).toHaveText(shortValue('1999996000002'));
    const doc = await downloaded(page);
    expect(doc.derived.edgeLengthsSquared).toEqual([1, 2, 3].map((node) => ({ node, squared: 1999996000002 })));
  });

  // SPEC 6.6 Data export: "all integers as JSON numbers when safe and as decimal strings otherwise".
  for (const path of [ROUTE, `${ROUTE}?g=G2&r=1.1&j=coxeter`]) {
    // regression: P4-RT-04-02
    test(`${path}: no safe integer is written as a string in Download data`, async ({ page }) => {
      await openRecorded(page, path);
      const doc = await downloaded(page);
      expect(safeAsStrings(doc.derived, 'derived')).toEqual([]);
    });
  }

  // SPEC 6.6: j is "followed by @ and three whole numbers of degrees"; a link that decodes with no notice shows
  // what it names, and the link the tool writes back (address bar, Copy link) reads back.
  // regression: P4-RT-04-01
  test('j=xyz:1,2,3@9007199254740993,0,0 turns the picture by 33 degrees (2^53 + 1 mod 360), or gives the notice', async ({ page }) => {
    await openRecorded(page, `${ROUTE}?j=xyz:1,2,3@9007199254740993,0,0`);
    const notice = await out(page, 'notice').count();
    if (notice === 0) expect(await out(page, 'turn').innerText()).toBe('33, 0, 0');
  });
  // regression: P4-RT-04-01
  test('j=xyz:1,2,3@<400 digits>,0,0: the link the tool writes back (address bar, Copy link) is readable', async ({ page }) => {
    await openRecorded(page, `${ROUTE}?j=xyz:1,2,3@${'9'.repeat(400)},0,0`);
    const bar = await page.evaluate(() => location.search);
    await control(page, 'copyLink').click();
    await page.waitForTimeout(200);
    const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1) ?? '');
    expect(bar).not.toContain('NaN');
    expect(copied).not.toContain('NaN');
    // Following the copied link gives no notice.
    const page2 = await page.context().newPage();
    await openRecorded(page2, new URL(copied).pathname.slice(1) + new URL(copied).search);
    expect(await page2.locator('[data-tool] [data-out="notice"]').count(), 'notice on the copied link').toBe(0);
  });

  // SPEC 7.6: "Tools reserve their box size in the HTML so that hydration does not shift the page." A T10 with a
  // prediction keeps its box when Predict.svelte arrives and replaces the question of the server markup.
  for (const width of [360, 320]) {
    // regression: P4-RT-07-02
    test(`M7 b4 and b7 (with a prediction) keep their height when they hydrate, at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.route(KATEX_FONTS, (r) => r.abort());
      await page.goto(M7, { waitUntil: 'load' });
      const before = await serverHeights(page);
      for (const id of ['b4', 'b7']) {
        expect(before[id], `${id} has not hydrated yet`).toBeGreaterThan(0);
        const tool = instance(page, id);
        await tool.scrollIntoViewIfNeeded();
        await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
        // Predict.svelte has arrived and shows its answer form.
        await expect(tool.locator('[data-prediction] [data-control="predictCheck"]')).toBeEnabled({ timeout: 15000 });
        const after = await tool.evaluate((r) => r.getBoundingClientRect().height);
        expect(Math.abs(after - before[id]!), `${id}: height ${before[id]} before hydration, ${after} after`).toBeLessThanOrEqual(1);
      }
    });
  }

  // SPEC 7.6: the hydrated tool shows the lines of its server markup while the orbit's data file is on its way;
  // no output line is emptied and filled again, and no box changes.
  // regression: P4-RT-07-01
  test('M7: hydration keeps every output line of the server markup while the data files load', async ({ page, browser }) => {
    test.setTimeout(180000);
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
    const server = await (async () => {
      const p = await nojs.newPage();
      await p.goto(M7);
      return outsOfRoots(p);
    })();
    await nojs.close();
    // The data files are held until every island has hydrated: each orbit stays pending meanwhile.
    const held: (() => Promise<void>)[] = [];
    await page.route(PRESET_FILE, (r) => {
      held.push(() => r.continue());
    });
    await page.route(KATEX_FONTS, (r) => r.abort());
    await page.goto(M7, { waitUntil: 'load' });
    const before = await serverHeights(page);
    await hydrateEveryIsland(page);
    const roots = page.locator('[data-tool="geometry"]');
    for (let k = 0; k < (await roots.count()); k++) await expect(roots.nth(k)).toHaveAttribute('data-hydrated', 'true');
    await page.waitForTimeout(1000);
    expect(held.length, 'data files requested and held').toBeGreaterThan(0);
    expect(await outsOfRoots(page), 'hydrated, data files held: the lines of the server markup').toEqual(server);
    const pending = await roots.evaluateAll((rs) => Object.fromEntries(rs.map((r) => [r.getAttribute('data-instance') ?? '', r.getBoundingClientRect().height])));
    for (const [id, h] of Object.entries(before)) expect(Math.abs(pending[id]! - h), `${id}: height ${h} before hydration, ${pending[id]} after`).toBeLessThanOrEqual(1);
    // Released: each orbit completes from its file and shows the same lines.
    for (const go of held.splice(0)) await go();
    for (let k = 0; k < (await roots.count()); k++) await expect(roots.nth(k).locator('[data-out="source"]')).not.toHaveText('', { timeout: 30000 });
    await expect.poll(() => outsOfRoots(page), { message: 'loaded: the lines of the server markup' }).toEqual(server);
    // Drawn: the canvas has replaced each snapshot and the drawing time is shown; still no box has changed.
    for (let k = 0; k < (await roots.count()); k++) await expect(roots.nth(k).locator('[data-out="drawMs"]')).not.toHaveText('', { timeout: 30000 });
    const drawn = await roots.evaluateAll((rs) => Object.fromEntries(rs.map((r) => [r.getAttribute('data-instance') ?? '', r.getBoundingClientRect().height])));
    for (const [id, h] of Object.entries(before)) expect(Math.abs(drawn[id]! - h), `${id}: height ${h} before hydration, ${drawn[id]} once drawn`).toBeLessThanOrEqual(1);
  });
  // regression: P4-RT-07-01
  // regression: P4-RT-07-02
  test('M7: Cumulative Layout Shift at most 0.1 at the reading positions of b4, b5, b7, b11 and b12', async ({ browser }) => {
    test.setTimeout(240000);
    for (const [id, target] of [
      ['b4', '[data-prediction]'],
      ['b5', '[data-out="summary"]'],
      ['b7', '[data-prediction]'],
      ['b11', '[data-out="summary"]'],
      ['b12', '[data-out="summary"]'],
    ] as const) {
      const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
      try {
        const cls = await clsAtReadingPosition(await context.newPage(), id, target);
        expect(cls, `M7 ${id}: CLS at the reading position 300 px above ${target}`).toBeLessThanOrEqual(0.1);
      } finally {
        await context.close();
      }
    }
  });
});
