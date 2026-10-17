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
// data-out names (every one T10 renders; the registry's `outs`):
//   caption, notice, noscript, exportNotice (ToolFrame);
//   snapshot (the SVG of the view; the build-time snapshot without JavaScript), boardName, polytopeName
//   (MathML names), summary, vertexCount, edgeCount (edges of the graph shown), pointCount (with the short
//   roots), pointsDrawn, edgesDrawn (the last canvas draw), fVector, faceTable, ringSizes (innermost
//   first; radii in data-radii), distinctDots, sharedEdges, graph, projection (the j value), turn (the
//   three angles), uniform, edgeLengths (distinct squared base-edge lengths; data-count), shortRoots,
//   limitMessage, refused, busy, source ("preset" | "computed"), drawMs, edits (ring and board edits; see
//   the decisions fragment on data-moves), legend
// data-control names: picker, rootPolytope, ringUp, ringDown, shortRoots, uniform, graphPolytope,
//   graphMoves, viewCoxeter, viewXyz, axis1 to axis3, turnGroup, turnUp, turnDown, turnLeft, turnRight,
//   turnCounter, turnClock, planeGroup, planeA, planeB, rotatePlus, rotateMinus, rotateReset, drawOrbit;
//   undo, redo, reset, copyLink, downloadData (ToolFrame); data-export="svg" | "png" (ToolFrame)
//
// Properties of T10 beyond the common ones of 4.0 Configuration (id, board, prediction, preset, caption):
// rings, projection, graph. linkTo, coords, start, moves and layers are accepted and ignored.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAPS } from '../../../packages/engine/src/index';

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
  await expect(live(page)).toContainText('Turn now');
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
    await open(page, link);
    await expect(out(page, 'vertexCount'), link).toHaveText(String(sizes[ringed]));
    await expect(out(page, 'faceTable')).toHaveCount(1);
    const edges = Number(await out(page, 'edgeCount').innerText());
    if (edges > CAPS.edgesAtRest) await expect(out(page, 'limitMessage'), link).toContainText(String(edges));
    else await expect(out(page, 'limitMessage'), link).toHaveText('');
    await page.waitForLoadState('networkidle');
    expect(seen.worker, link).toEqual([]);
    page.removeAllListeners('request');
    page.removeAllListeners('worker');
  }
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

test('no long task on E8 loads and the graph switch', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __longtasks: { start: number; duration: number }[] };
    w.__longtasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__longtasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  });
  const tasksAfterHydration = async (): Promise<{ start: number; duration: number }[]> =>
    page.evaluate(() => {
      const w = window as unknown as { __longtasks: { start: number; duration: number }[]; __hydratedAt?: number };
      return w.__longtasks.filter((t) => t.start >= (w.__hydratedAt ?? 0));
    });
  const markHydrated = async (): Promise<void> => {
    await page.evaluate(() => {
      (window as unknown as { __hydratedAt: number }).__hydratedAt = performance.now();
    });
  };
  // The refusal: counts and face table only. The tool's own work after hydration: nothing long.
  await open(page, 'g=E8&r=0.0.1.0.0.0.0.0');
  await markHydrated();
  await page.waitForTimeout(300);
  expect(await tasksAfterHydration()).toEqual([]);
  // The showpiece, then the switch to the move graph (its 456 edges derived on the main thread).
  await open(page, 'g=E8&r=0.0.0.0.0.0.0.1&j=coxeter');
  await markHydrated();
  await control(page, 'graphMoves').click();
  await expect(out(page, 'graph')).toHaveText('moves');
  await expect(out(page, 'edgesDrawn')).not.toHaveText(String(record('E8', [0, 0, 0, 0, 0, 0, 0, 1]).f_vector[1]));
  await page.waitForTimeout(800);
  const tasks = await tasksAfterHydration();
  console.info(`T10 long tasks after hydration: ${JSON.stringify(tasks)}`);
  expect(tasks).toEqual([]);
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
  await expect(live(page)).toContainText('Node 3 ring 1.');
  await expect(live(page)).toContainText(`${big.f_vector[0]} vertices, ${big.f_vector[1]} edges`);
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
