// P6-tikz: "Export LaTeX" writes the orbit garden of T2 as a tikz-graph and the projection of T10 as
// tikz-points (SPEC.md 6.7 "Orbit graphs and projections are exported as plain TikZ coordinates"; 4.0 Share
// and export, Long numbers; 7.5 A-4; the forms and the .tex file of decisions/P6-A5.md). Each test exports
// what the tool draws after hydration and compares the file with the drawing's own hooks.
// RT-FIX-P6-latex (P6-RT-10-01): the graph of positions of T8 and the orbit of T12, both drawn in layers, are
// orbit graphs too, and are written as T2's garden is (t08/latex.ts, t12/latex.ts).
//
// Samples for the owner's compile check at gate G6 (SPEC 6.7, 9.1): when the environment variable
// LATEX_SAMPLES_DIR is set, the downloads are saved there as dynkin.tex (the board's diagram, the
// default export of export.ts, on /tools/board/?z=1&g=E6), tikz-graph.tex (T2), tikz-points.tex (T10),
// tikz-graph-weyl.tex (T8 on A3) and tikz-graph-rep.tex (T12 on E6, node 1);
// when it is not set nothing is saved. The gate chain sets it to reports/gate-G6/latex/, for example
//   LATEX_SAMPLES_DIR=reports/gate-G6/latex/ npx playwright test site/tests/e2e/latex-export.spec.ts
//
// Hooks read: data-tool, data-hydrated, data-instance (tool roots); data-control="grow", "latex",
// "shortRoots", "step"; data-out="vertex" (data-position, data-layer), "edge" (data-from, data-to), "found",
// "exportNotice" (T2, T8 and ToolFrame); data-out="pointsDrawn", "edgesDrawn", "drawMs", "shortRoots" (T10);
// data-out="groupOrder", "edgeMode" (T8); data-out="orbit-graph" (data-drawn, data-positions), data-vertex
// (data-layer, data-value), data-edge (data-edge-from, data-edge-to) (T12); the live region [data-live].
import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { distDir } from './routes';

/** The largest side of an exported picture, cm (t02/latex.ts MAX_WIDTH_CM, t10/latex.ts MAX_ACROSS_CM). */
const MAX_CM = 16;
const MINUS_SIGN = '−';

/** Saves a downloaded file as a G6 sample when LATEX_SAMPLES_DIR is set; does nothing otherwise. */
function saveSample(name: string, text: string): void {
  const dir = process.env.LATEX_SAMPLES_DIR;
  if (dir === undefined || dir === '') return;
  const at = resolve(dir);
  mkdirSync(at, { recursive: true });
  writeFileSync(join(at, name), text);
}

/** Clicks Export LaTeX in `root` and returns the downloaded text and its file name. */
async function exportLatex(page: Page, root: Locator): Promise<{ text: string; file: string }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), root.locator('[data-control="latex"]').click()]);
  return { text: readFileSync((await dl.path())!, 'utf8'), file: dl.suggestedFilename() };
}

/** The header of the .tex file (decisions/P6-A5.md): the link, the package, then the picture. */
function checkTikzFile(text: string, path: RegExp): string[] {
  const lines = text.split('\n');
  expect(lines[0]!.startsWith('% ')).toBe(true);
  expect(new URL(lines[0]!.slice(2)).pathname).toMatch(path);
  expect(lines[1]).toBe('% needs \\usepackage{tikz}');
  expect(lines[2]).toBe('\\begin{tikzpicture}');
  expect(lines.at(-2)).toBe('\\end{tikzpicture}');
  expect(lines.at(-1)).toBe('');
  // pdflatex cannot set U+2212 in math mode: every minus is the ASCII hyphen-minus.
  expect(text).not.toContain(MINUS_SIGN);
  return lines.slice(3, -2);
}

const NODE = /^ {2}\\node\[circle,draw,inner sep=1pt\] \(n(\d+)\) at \((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\) \{(.*)\};$/;
const GRAPH_EDGE = /^ {2}\\draw \(n(\d+)\) -- \(n(\d+)\);$/;
const POINT = /^ {2}\\fill \((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\) circle \(1pt\);$/;
const POINTS_EDGE = /^ {2}\\draw \((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\) -- \((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\);$/;

/** The vertices and edges a garden root draws, from its hooks, in the drawn order. */
async function gardenHooks(root: Locator): Promise<{ positions: string[]; layers: number[]; edges: [string, string][] }> {
  const positions = await root.locator('[data-out="vertex"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-position') ?? ''));
  const layers = await root.locator('[data-out="vertex"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-layer'))));
  const edges = await root.locator('[data-out="edge"]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-from') ?? '', e.getAttribute('data-to') ?? ''] as [string, string]));
  return { positions, layers, edges };
}

/**
 * Checks a tikz-graph file against the garden's hooks: one \node per vertex drawn, in the drawn order,
 * labelled with its position (entries with ASCII hyphen-minus and commas) when `labelled`; one \draw per
 * edge drawn, in the drawn order, joining the same two vertices; y up (layer 0 on top); at most 16 cm wide.
 */
async function checkGarden(root: Locator, text: string, path: RegExp, labelled: boolean): Promise<{ vertices: number; edges: number }> {
  const hooks = await gardenHooks(root);
  const body = checkTikzFile(text, path);
  const nodes = body.filter((l) => l.includes('\\node'));
  const draws = body.filter((l) => l.includes('\\draw'));
  expect(nodes.length + draws.length).toBe(body.length);
  expect(nodes).toHaveLength(hooks.positions.length);
  expect(draws).toHaveLength(hooks.edges.length);
  const xs: number[] = [];
  const yOfLayer = new Map<number, Set<number>>();
  nodes.forEach((line, k) => {
    const m = NODE.exec(line);
    expect(m, line).not.toBeNull();
    expect(Number(m![1])).toBe(k);
    const x = Number(m![2]);
    const y = Number(m![3]);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    xs.push(x);
    const layer = hooks.layers[k]!;
    if (!yOfLayer.has(layer)) yOfLayer.set(layer, new Set());
    yOfLayer.get(layer)!.add(y);
    expect(m![4]).toBe(labelled ? `$${hooks.positions[k]}$` : '');
  });
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_CM);
  // y up: one height per layer, layer 0 the highest (the drawing puts it at the top).
  const layers = [...yOfLayer.keys()].sort((a, b) => a - b);
  for (const l of layers) expect(yOfLayer.get(l)!.size).toBe(1);
  for (let k = 1; k < layers.length; k++) expect([...yOfLayer.get(layers[k]!)!][0]!).toBeLessThan([...yOfLayer.get(layers[k - 1]!)!][0]!);
  draws.forEach((line, k) => {
    const m = GRAPH_EDGE.exec(line);
    expect(m, line).not.toBeNull();
    const ends = [hooks.positions[Number(m![1])], hooks.positions[Number(m![2])]];
    expect(ends).toEqual(hooks.edges[k]);
  });
  return { vertices: nodes.length, edges: draws.length };
}

/** Checks a tikz-points file against T10's drawn counts; returns the numbers of points and edges written. */
function checkPoints(text: string, path: RegExp, points: number, edges: number): void {
  const body = checkTikzFile(text, path);
  const fills = body.filter((l) => l.startsWith('  \\fill '));
  const draws = body.filter((l) => l.startsWith('  \\draw '));
  expect(fills.length + draws.length).toBe(body.length);
  expect(fills).toHaveLength(points);
  expect(draws).toHaveLength(edges);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const line of fills) {
    const m = POINT.exec(line);
    expect(m, line).not.toBeNull();
    xs.push(Number(m![1]));
    ys.push(Number(m![2]));
  }
  for (const v of [...xs, ...ys]) expect(Number.isFinite(v)).toBe(true);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_CM);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(MAX_CM);
  // Every edge joins two of the points written.
  const at = new Set(fills.map((l) => POINT.exec(l)!.slice(1, 3).join(',')));
  for (const line of draws) {
    const m = POINTS_EDGE.exec(line);
    expect(m, line).not.toBeNull();
    expect(at.has(`${m![1]},${m![2]}`) && at.has(`${m![3]},${m![4]}`), line).toBe(true);
  }
}

const garden = (page: Page): Locator => page.locator('[data-tool="garden"]').first();
const geometry = (page: Page): Locator => page.locator('[data-tool="geometry"]').first();

test.describe('Export LaTeX writes TikZ for T2 and T10', () => {
  test('the orbit garden as drawn, a tikz-graph (/tools/garden/)', async ({ page }) => {
    await page.goto('tools/garden/');
    const root = garden(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    // Grow the garden of A3 to the end, so that the picture has edges.
    const grow = root.locator('[data-control="grow"]');
    for (let k = 0; k < 40 && (await grow.isEnabled()) && (await grow.getAttribute('aria-disabled')) !== 'true'; k++) await grow.click();
    await expect(root.locator('[data-out="found"]')).toHaveText(String(await root.locator('[data-out="vertex"]').count()));
    const { text, file } = await exportLatex(page, root);
    expect(file).toBe('garden-A3.tex');
    const n = await checkGarden(root, text, /\/tools\/garden\/$/, true);
    expect(n.vertices).toBeGreaterThan(3);
    expect(n.edges).toBeGreaterThan(0);
    await expect(root.locator('[data-out="exportNotice"]')).toHaveText('');
    await expect(root.locator('[data-live]')).toHaveText(`Downloaded ${file}.`);
    saveSample('tikz-graph.tex', text);
  });

  test('a lesson instance of T2: the triangle grown 40 layers on M1, negative entries with hyphen-minus', async ({ page }) => {
    await page.goto('modules/m1-mutation/');
    const root = page.locator('[data-tool="garden"][data-instance="b8"]');
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
    const { text, file } = await exportLatex(page, root);
    expect(file).toBe('garden-custom-board.tex');
    const n = await checkGarden(root, text, /\/modules\/m1-mutation\/$/, true);
    expect(n.vertices).toBe(Number(await root.locator('[data-out="found"]').textContent()));
    expect(n.edges).toBeGreaterThan(0);
    // Root populations of the triangle have negative entries: written with the ASCII hyphen-minus.
    expect(text).toMatch(/\{\$-?\d+(,-?\d+)*\$\}/);
    expect(text).toMatch(/\{\$[^$]*-\d[^$]*\$\}/);
    await expect(root.locator('[data-live]')).toHaveText(`Downloaded ${file}.`);
  });

  test('the projection as drawn, tikz-points (/tools/geometry/)', async ({ page }) => {
    await page.goto('tools/geometry/');
    const root = geometry(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await expect(root.locator('[data-out="drawMs"]')).not.toHaveText('', { timeout: 15000 });
    const points = Number(await root.locator('[data-out="pointsDrawn"]').textContent());
    const edges = Number(await root.locator('[data-out="edgesDrawn"]').textContent());
    expect(points).toBeGreaterThan(0);
    expect(edges).toBeGreaterThan(0);
    const { text, file } = await exportLatex(page, root);
    expect(file).toBe('geometry-A3.tex');
    checkPoints(text, /\/tools\/geometry\/$/, points, edges);
    await expect(root.locator('[data-out="exportNotice"]')).toHaveText('');
    await expect(root.locator('[data-live]')).toHaveText(`Downloaded ${file}.`);
    saveSample('tikz-points.tex', text);
  });

  test('the projection follows the view: the move graph of A2, and B3 with its short roots', async ({ page }) => {
    await page.goto('tools/geometry/?g=A2&r=1.1&e=m');
    let root = geometry(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await expect(root.locator('[data-out="drawMs"]')).not.toHaveText('', { timeout: 15000 });
    await expect(root.locator('[data-out="graph"]')).toHaveText('moves');
    await expect(root.locator('[data-out="edgesDrawn"]')).toHaveText(await root.locator('[data-out="edgeCount"]').innerText());
    let { text } = await exportLatex(page, root);
    checkPoints(text, /\/tools\/geometry\/$/, Number(await root.locator('[data-out="pointsDrawn"]').textContent()), Number(await root.locator('[data-out="edgesDrawn"]').textContent()));

    await page.goto('tools/geometry/?g=B3&r=0.1.0');
    root = geometry(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    await expect(root.locator('[data-out="drawMs"]')).not.toHaveText('', { timeout: 15000 });
    const vertices = Number(await root.locator('[data-out="pointsDrawn"]').textContent());
    await root.locator('[data-control="shortRoots"]').click();
    await expect(root.locator('[data-out="shortRoots"]')).toContainText('shown');
    await expect(root.locator('[data-out="pointsDrawn"]')).not.toHaveText(String(vertices));
    const points = Number(await root.locator('[data-out="pointsDrawn"]').textContent());
    expect(points).toBeGreaterThan(vertices);
    ({ text } = await exportLatex(page, root));
    checkPoints(text, /\/tools\/geometry\/$/, points, Number(await root.locator('[data-out="edgesDrawn"]').textContent()));
  });

  test('the board diagram, the default export of a named finite board (dynkin)', async ({ page }) => {
    await page.goto('tools/board/?z=1&g=E6');
    const root = page.locator('[data-tool="board"]').first();
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    const { text, file } = await exportLatex(page, root);
    expect(file).toBe('board-E6.tex');
    const lines = text.split('\n');
    expect(lines.slice(1)).toEqual(['% needs \\usepackage{dynkin-diagrams}', '\\dynkin E{oooooo}', '']);
    saveSample('dynkin.tex', text);
  });
});

const weyl = (page: Page): Locator => page.locator('[data-tool="weyl"]').first();
const rep = (page: Page): Locator => page.locator('[data-tool="rep"]').first();

/** T12's orbit as drawn, from its hooks, in the drawn order, once every vertex and edge is drawn. */
async function orbitHooks(root: Locator): Promise<{ index: string[]; value: string[]; layers: number[]; edges: [string, string][] }> {
  const graph = root.locator('[data-out="orbit-graph"]');
  await expect(graph).toHaveAttribute('data-drawn', 'true');
  const size = Number(await graph.getAttribute('data-positions'));
  const vertices = graph.locator('[data-vertex]');
  await expect(vertices).toHaveCount(size);
  const value = await vertices.evaluateAll((els) => els.map((e) => e.getAttribute('data-value') ?? ''));
  // One edge leaves each vertex at each node whose number is positive (t12/rep.ts orbitLayers), so the
  // drawing is complete when that many edges are drawn (the tool draws its layers one per task).
  const edgeCount = value.reduce((n, v) => n + v.split(',').filter((x) => Number(x) > 0).length, 0);
  await expect(graph.locator('[data-edge]')).toHaveCount(edgeCount);
  const index = await vertices.evaluateAll((els) => els.map((e) => e.getAttribute('data-vertex') ?? ''));
  const layers = await vertices.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-layer'))));
  const edges = await graph.locator('[data-edge]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-edge-from') ?? '', e.getAttribute('data-edge-to') ?? ''] as [string, string]));
  return { index, value, layers, edges };
}

/**
 * Checks a tikz-graph file against T12's orbit hooks: one \node per vertex, in the drawn order, labelled with
 * its position (data-value: entries with ASCII hyphen-minus and commas); one \draw per edge, in the drawn
 * order, joining the same two vertices (basis indices); y up, layer 0 on top; at most 16 cm wide.
 */
function checkOrbit(hooks: Awaited<ReturnType<typeof orbitHooks>>, text: string, path: RegExp): { vertices: number; edges: number } {
  const body = checkTikzFile(text, path);
  const nodes = body.filter((l) => l.includes('\\node'));
  const draws = body.filter((l) => l.includes('\\draw'));
  expect(nodes.length + draws.length).toBe(body.length);
  expect(nodes).toHaveLength(hooks.index.length);
  expect(draws).toHaveLength(hooks.edges.length);
  const xs: number[] = [];
  const yOfLayer = new Map<number, Set<number>>();
  nodes.forEach((line, k) => {
    const m = NODE.exec(line);
    expect(m, line).not.toBeNull();
    expect(Number(m![1])).toBe(k);
    xs.push(Number(m![2]));
    const layer = hooks.layers[k]!;
    if (!yOfLayer.has(layer)) yOfLayer.set(layer, new Set());
    yOfLayer.get(layer)!.add(Number(m![3]));
    expect(m![4]).toBe(`$${hooks.value[k]}$`);
  });
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_CM);
  const layers = [...yOfLayer.keys()].sort((a, b) => a - b);
  for (const l of layers) expect(yOfLayer.get(l)!.size).toBe(1);
  for (let k = 1; k < layers.length; k++) expect([...yOfLayer.get(layers[k]!)!][0]!).toBeLessThan([...yOfLayer.get(layers[k - 1]!)!][0]!);
  draws.forEach((line, k) => {
    const m = GRAPH_EDGE.exec(line);
    expect(m, line).not.toBeNull();
    expect([hooks.index[Number(m![1])], hooks.index[Number(m![2])]]).toEqual(hooks.edges[k]);
  });
  return { vertices: nodes.length, edges: draws.length };
}

test.describe('Export LaTeX writes TikZ for T8 and T12 (RT-FIX-P6-latex)', () => {
  test('the graph of positions of T8 as drawn, a tikz-graph (/tools/weyl/?z=1&g=A3)', async ({ page }) => {
    await page.goto('tools/weyl/?z=1&g=A3');
    const root = weyl(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    await root.locator('[data-control="step"]').click();
    const { text, file } = await exportLatex(page, root);
    expect(file).toBe('weyl-A3.tex');
    // The dots carry no label, so no \node does.
    const n = await checkGarden(root, text, /\/tools\/weyl\/$/, false);
    expect(n.vertices).toBe(Number(await root.locator('[data-out="groupOrder"]').textContent()));
    expect(n.edges).toBeGreaterThan(0);
    await expect(root.locator('[data-out="exportNotice"]')).toHaveText('');
    await expect(root.locator('[data-live]')).toHaveText(`Downloaded ${file}.`);
    saveSample('tikz-graph-weyl.tex', text);
  });

  test('above 192 elements, every dot and the edges drawn on the canvas (/tools/weyl/?z=1&g=B4)', async ({ page }) => {
    await page.goto('tools/weyl/?z=1&g=B4');
    const root = weyl(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    await expect(root.locator('[data-out="edgeMode"]')).toHaveText('game-and-focus');
    await root.locator('[data-control="step"]').click();
    await root.locator('[data-control="step"]').click();
    // The snapshot under the canvas mirrors the edges drawn (along the game: two moves).
    await expect(root.locator('[data-out="edge"]')).toHaveCount(2);
    const { text } = await exportLatex(page, root);
    const body = checkTikzFile(text, /\/tools\/weyl\/$/);
    const nodes = body.filter((l) => NODE.test(l));
    const draws = body.filter((l) => GRAPH_EDGE.test(l));
    expect(nodes.length + draws.length).toBe(body.length);
    expect(nodes).toHaveLength(Number(await root.locator('[data-out="groupOrder"]').textContent()));
    expect(draws).toHaveLength(2);
    const xs = nodes.map((l) => Number(NODE.exec(l)![2]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(MAX_CM);
  });

  test('the orbit of T12 as drawn, a tikz-graph with negative entries in hyphen-minus (/tools/rep/?z=1&g=E6&k=1)', async ({ page }) => {
    await page.goto('tools/rep/?z=1&g=E6&k=1');
    const root = rep(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    const hooks = await orbitHooks(root);
    const { text, file } = await exportLatex(page, root);
    expect(file).toBe('rep-E6.tex');
    const n = checkOrbit(hooks, text, /\/tools\/rep\/$/);
    expect(n.vertices).toBe(27);
    expect(n.edges).toBeGreaterThan(0);
    expect(text).toMatch(/\{\$[^$]*-\d[^$]*\$\}/);
    await expect(root.locator('[data-out="exportNotice"]')).toHaveText('');
    await expect(root.locator('[data-live]')).toHaveText(`Downloaded ${file}.`);
    saveSample('tikz-graph-rep.tex', text);
  });

  test('the writers of T8 and T12, like export.ts, are fetched on the click of Export LaTeX and not before (7.6)', async ({ page, baseURL }) => {
    const base = new URL(baseURL!).pathname;
    // The fetched scripts that write TikZ (export.ts and the tools' writers), read from the build.
    const tikzScripts = (urls: string[]): string[] =>
      [...new Set(urls)].filter((u) => {
        const path = new URL(u).pathname;
        const file = join(distDir(), path.startsWith(base) ? path.slice(base.length) : path);
        return existsSync(file) && readFileSync(file, 'utf8').includes('tikz-graph');
      });
    for (const [query, tool] of [['tools/weyl/?z=1&g=A3', 'weyl'], ['tools/rep/?z=1&g=A2&k=1', 'rep']] as const) {
      const urls: string[] = [];
      const onRequest = (r: { url: () => string }): void => {
        if (new URL(r.url()).pathname.endsWith('.js')) urls.push(r.url());
      };
      page.on('request', onRequest);
      await page.goto(query);
      const root = page.locator(`[data-tool="${tool}"]`).first();
      await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
      await page.waitForLoadState('networkidle');
      expect(urls.length, query).toBeGreaterThan(0);
      expect(tikzScripts(urls), query).toEqual([]);
      const { text } = await exportLatex(page, root);
      expect(text).toContain('\\begin{tikzpicture}');
      expect(tikzScripts(urls).length, query).toBeGreaterThan(0);
      page.off('request', onRequest);
    }
  });

  test('T12 with no orbit drawn (more than 300 positions) shows the notice and downloads nothing (/tools/rep/?z=1&g=E7&k=2)', async ({ page }) => {
    await page.goto('tools/rep/?z=1&g=E7&k=2');
    const root = rep(page);
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    await expect(root.locator('[data-out="orbit-graph"]')).toHaveAttribute('data-drawn', 'false', { timeout: 30000 });
    let downloaded = false;
    page.on('download', () => {
      downloaded = true;
    });
    await root.locator('[data-control="latex"]').click();
    await expect(root.locator('[data-out="exportNotice"]')).toHaveText('nothing to export as LaTeX');
    await expect(root.locator('[data-live]')).toHaveText('nothing to export as LaTeX');
    expect(downloaded).toBe(false);
  });
});

test.describe('regressions', () => {
  // Adopted from the RT-10 lens of the phase 6 round (redteam-RT-10-p6-latex-scope.spec.ts); the logging of the
  // downloaded text is left out, the assertions are the lens's.
  async function latexOf(page: Page, tool: string, query: string): Promise<string> {
    await page.goto(`tools/${tool}/?${query}`);
    const root = page.locator(`[data-tool="${tool}"]`).first();
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), root.locator('[data-control="latex"]').click()]);
    return readFileSync((await dl.path())!, 'utf8');
  }

  test.use({ reducedMotion: 'reduce' });

  // regression: P6-RT-10-01
  test('the Weyl Explorer (T8) exports its orbit graph as TikZ coordinates (6.7)', async ({ page }) => {
    const text = await latexOf(page, 'weyl', 'z=1&g=A3');
    expect(text, 'the layered graph of the 24 positions of A3, as a tikzpicture').toContain('\\begin{tikzpicture}');
  });

  // regression: P6-RT-10-01
  test('the Representation Builder (T12) exports its orbit graph as TikZ coordinates (6.7)', async ({ page }) => {
    const text = await latexOf(page, 'rep', 'z=1&g=A2&k=1');
    expect(text, 'the orbit of omega_1 drawn in layers, as a tikzpicture').toContain('\\begin{tikzpicture}');
  });

  test('(control) the Orbit Garden (T2) exports its orbit graph as TikZ coordinates', async ({ page }) => {
    const text = await latexOf(page, 'garden', 'z=1&g=A3');
    expect(text).toContain('\\begin{tikzpicture}');
  });
});
