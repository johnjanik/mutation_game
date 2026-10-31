// P1-A2: the run with JavaScript disabled (SPEC.md 7.4 "Without JavaScript", 4.0 "Works before and
// without JavaScript", 7.7, 9.1 G1: "the run without JavaScript passes on M0, M1, the tool routes and
// the pages"). Every route of the built site is discovered from site/dist, so lessons, tool routes
// and pages are covered as they appear. P0-A5's nojs-phase0.spec.ts stays; this is the general one.
//
// Hooks read: data-tool (tool roots), data-frame (ToolFrame tools), data-out="caption",
// data-out="noscript", data-node, data-prediction (lessons, plan); the <noscript> line, <figure>,
// <figcaption>, <details>, <table>; KaTeX's .katex and its <math> (A-12, plan addition). RT-FIX
// P3-RT-06-03 adds: data-board-group and the drawing beside it, role="img", <img alt>, the node hooks
// data-board, data-value, data-can-act, data-editor (the board editor), every data-out and data-moves
// (compared with the hydrated default), data-hydrated, and the prediction's .answer-text. RT-FIX
// P4-MERGE-04 adds data-measured: a data-out whose text measures the reader's machine (T10's drawMs) is
// compared by its presence, not its value. RT-FIX P4-RT-06-02 adds data-out="snapshot" (the SVG snapshot of a
// canvas tool, 7.4) and reads whether a figure is visible. RT-FIX P5-RT-06-01 adds data-out="orbit-graph" with
// data-drawn, data-positions, data-vertex, data-edge and data-layer-count, and a matrix's data-format,
// data-rows, data-cols and its cells' data-row and data-col (T12's figure). RT-FIX P6-RT-06-01 adds T13's
// data-out="shadow-picture" with its data-point, "restricted-board" and "restricted-name", the role tabpanel,
// and the marks of a drawing (its SVG shapes and text).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { hydrateEveryIsland } from './hydrate';
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
  instance: string;
  frame: boolean;
  /** The kind of the tool's own default figure (see toolReport), or null when there is none. */
  figure: 'snapshot' | 'board' | 'drawing' | 'img' | null;
  textAlternative: boolean;
  /** Labels of the node buttons of a game board that lack a value or a hook of SPEC 4.0. */
  nodesWithoutValue: string[];
  /** The data-out of each orbit drawing or matrix of the root that lacks its content (see toolReport). */
  blankParts: string[];
  caption: string;
  enabledControls: string[];
  noscript: string;
  noscriptShown: boolean;
  nodes: number;
  table: boolean;
  tableButtons: number;
}

/**
 * The report of one tool root. Runs in the page (handed to evaluate), so it uses nothing from outside.
 * The default figure (SPEC 7.4: "the SVG board with its values"; RT-FIX P3-RT-06-03) is the tool's own
 * drawing, never any <svg> of the root (a decorative icon has content too), and never one inside the
 * table view's <details> or a <noscript>:
 * - a board: a group of node buttons (data-board-group, A-1) holding at least one data-node, drawn by
 *   an <svg> with content beside it;
 * - a drawing with its own name: an element of role img with content and an aria-label,
 *   aria-labelledby or <title> (the meter, the kaleidoscope's plane, the Weyl graph, a chart);
 * - a snapshot: an <img> with a source and an alt text (7.4: T10, and T8 on its larger boards).
 * A tool that draws on a canvas ships the SVG snapshot of its default view (7.4; data-out="snapshot", on the
 * <svg> or around it), and that snapshot is then its default figure: visible, named, holding at least one point
 * or segment; its other drawings (a board that sets its input, the canvas box hidden until the first canvas draw)
 * do not stand for it (RT-FIX P4-RT-06-02). A figure that is not shown (hidden, display none) is none.
 * Every node button of a game board shows its value: the four hooks of 4.0, data-value not empty.
 * The board editor's nodes (inside data-editor) show no value and are left out of that check.
 * The other parts of a figure hold their content (RT-FIX P5-RT-06-01; SPEC 4 T12: "the orbit drawn in layers
 * ...; the matrices E_k, F_k, H_k shown as grids", a T12 root being accepted as "board" through its string
 * viewer): an orbit drawing (data-out="orbit-graph") holds a vertex per position (data-positions) and at least
 * one edge into each vertex below layer 0, or, when it is not drawn (above 300 positions), layer counts that
 * add up to them; a matrix (data-format, data-rows, data-cols) holds every cell of a grid, and a value cell in
 * each row of a list (or its one row "no nonzero entries").
 * A figure holds content by its marks, not by its elements (RT-FIX P6-RT-06-01; a T14 drawing whose roads and
 * nodes are gone keeps its empty <g> groups): an SVG drawing holds a circle, ellipse, line, path, polyline,
 * polygon or text outside its definitions, title and description; an HTML drawing of role img (a chart of bars,
 * a fraction) holds an element, as before. Every board group and every named drawing that is shown, not only the
 * first, holds its content (a board group its nodes and a drawing beside it with marks), else it is a blank part.
 * The panel a T13 instance is configured to show is the only one rendered (decisions/P6-A3.md) and its figure holds
 * its content (SPEC 4 T13 "Shadows: ... a picture", "Restricted board: drawn in Bourbaki order"): the shadow
 * picture (data-out="shadow-picture") a point (data-point) drawn by a mark, the restricted board
 * (data-out="restricted-board") a board, and a panel that names its restricted board (data-out="restricted-name")
 * draws it.
 */
function toolReport(root: Element): ToolReport {
  const outside = (el: Element): boolean => el.closest('details, noscript') === null;
  const visible = (el: Element): boolean => (el as HTMLElement).checkVisibility?.() ?? true;
  const named = (el: Element | null): boolean =>
    !!el && ((el.getAttribute('aria-label') ?? '').trim() !== '' || (el.getAttribute('aria-labelledby') ?? '').trim() !== '');
  const marked = (el: Element): boolean =>
    [...el.querySelectorAll('circle, ellipse, line, path, polyline, polygon, text')].some((m) => m.closest('defs, marker, title, desc, clipPath, mask, pattern, symbol') === null);
  const hasMarks = (d: Element): boolean =>
    d.tagName.toLowerCase() === 'svg' || d.querySelector('svg') !== null ? marked(d) : d.childElementCount > 0;
  const groups = [...root.querySelectorAll('[data-board-group]')].filter(outside).filter(visible);
  const boards = groups.filter(
    (g) => g.querySelector('[data-node]') !== null && [...(g.parentElement?.children ?? [])].some((c) => c.tagName.toLowerCase() === 'svg' && marked(c)),
  );
  const namedDrawings = [...root.querySelectorAll('[role="img"]')]
    .filter(outside)
    .filter(visible)
    .filter((d) => named(d) || d.querySelector(':scope > title') !== null);
  const drawings = namedDrawings.filter(hasMarks);
  const imgs = [...root.querySelectorAll('img')].filter(
    (i) => i.closest('noscript') === null && visible(i) && (i.getAttribute('src') ?? '').trim() !== '' && (i.getAttribute('alt') ?? '').trim() !== '',
  );
  const snapshotHooks = [...root.querySelectorAll('[data-out="snapshot"]')].filter(outside);
  const snapshots = snapshotHooks
    .map((s) => (s.tagName.toLowerCase() === 'svg' ? s : s.querySelector('svg')))
    .filter((s): s is Element => s !== null && visible(s) && (named(s) || s.querySelector(':scope > title') !== null))
    .filter((s) => s.querySelector('circle, ellipse, line, path, polyline, polygon') !== null);
  const kind =
    snapshotHooks.length > 0
      ? snapshots.length > 0
        ? 'snapshot'
        : null
      : boards.length > 0
        ? 'board'
        : drawings.length > 0
          ? 'drawing'
          : imgs.length > 0
            ? 'img'
            : null;
  const figureEl = snapshotHooks.length > 0 ? (snapshots[0] ?? null) : (boards[0] ?? drawings[0] ?? imgs[0] ?? null);
  const figure = figureEl?.closest('figure') ?? null;
  // A drawing and a snapshot are named by construction; a board by its group or by its <figure>.
  const textAlternative =
    kind === 'snapshot' ||
    kind === 'drawing' ||
    kind === 'img' ||
    (kind === 'board' && (boards.some((g) => named(g)) || named(figure) || !!figure?.querySelector(':scope > figcaption')));
  const gameNodes = boards.filter((g) => g.closest('[data-editor]') === null).flatMap((g) => [...g.querySelectorAll('[data-node]')]);
  const nodesWithoutValue = gameNodes
    .filter(
      (b) =>
        (b.getAttribute('data-node') ?? '').trim() === '' ||
        (b.getAttribute('data-board') ?? '').trim() === '' ||
        (b.getAttribute('data-value') ?? '').trim() === '' ||
        !['true', 'false'].includes(b.getAttribute('data-can-act') ?? ''),
    )
    .map((b) => `${b.getAttribute('data-board') ?? '?'} ${b.getAttribute('data-node') ?? '?'}`);
  const blankParts: string[] = [];
  for (const g of groups.filter((x) => !boards.includes(x))) blankParts.push(`board "${g.getAttribute('aria-label') ?? ''}"`);
  for (const d of namedDrawings.filter((x) => !drawings.includes(x))) blankParts.push(`drawing "${(d.getAttribute('aria-label') ?? d.querySelector(':scope > title')?.textContent ?? '').slice(0, 40)}"`);
  for (const p of [...root.querySelectorAll('[data-out="shadow-picture"]')].filter(outside)) {
    if (![...p.querySelectorAll('[data-point]')].some(marked)) blankParts.push('shadow-picture');
  }
  for (const p of [...root.querySelectorAll('[data-out="restricted-board"]')].filter(outside)) {
    if (!boards.some((b) => p.contains(b))) blankParts.push('restricted-board');
  }
  for (const panel of [...root.querySelectorAll('[role="tabpanel"]')].filter(outside)) {
    if (panel.querySelector('[data-out="restricted-name"]') !== null && panel.querySelector('[data-out="restricted-board"]') === null) blankParts.push('restricted-board');
  }
  for (const g of [...root.querySelectorAll('[data-out="orbit-graph"]')].filter(outside)) {
    const n = Number(g.getAttribute('data-positions'));
    const full =
      g.getAttribute('data-drawn') === 'true'
        ? g.querySelectorAll('[data-vertex]').length === n && g.querySelectorAll('[data-edge]').length >= n - 1
        : [...g.querySelectorAll('[data-layer-count]')].reduce((s, l) => s + Number(l.getAttribute('data-layer-count')), 0) === n;
    if (!(n > 0 && full)) blankParts.push('orbit-graph');
  }
  for (const m of [...root.querySelectorAll('[data-format][data-rows][data-cols]')].filter(outside)) {
    const cells = m.querySelectorAll('[data-row][data-col]').length;
    const full =
      m.getAttribute('data-format') === 'grid'
        ? cells === Number(m.getAttribute('data-rows')) * Number(m.getAttribute('data-cols'))
        : cells === m.querySelectorAll('tbody tr').length || (cells === 0 && m.querySelector('tbody td[colspan]') !== null);
    if (!full) blankParts.push(m.getAttribute('data-out') ?? 'a matrix');
  }
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
    instance: root.getAttribute('data-instance') ?? '',
    frame: root.hasAttribute('data-frame'),
    figure: kind,
    textAlternative,
    nodesWithoutValue,
    blankParts,
    caption: (captionEl?.textContent ?? '').trim(),
    enabledControls,
    noscript,
    noscriptShown,
    nodes,
    table: details !== null,
    tableButtons: details ? details.querySelectorAll('table button').length : 0,
  } satisfies ToolReport;
}

/** The checks of the default figure that a tool root fails, by name; empty when the figure is accepted. */
function figureProblems(report: ToolReport): string[] {
  const problems: string[] = [];
  if (report.figure === null) problems.push('default figure');
  if (!report.textAlternative) problems.push('text alternative of the figure');
  if (report.nodesWithoutValue.length > 0) problems.push(`values of the nodes ${report.nodesWithoutValue.join(', ')}`);
  if (report.blankParts.length > 0) problems.push(`content of ${report.blankParts.join(', ')}`);
  return problems;
}

/** What the check of one prediction found; computed in the page. */
interface PredictionReport {
  details: boolean;
  answer: string;
  reveal: string;
}

/**
 * SPEC 4.0 Predict: "Without JavaScript the question is followed by a <details> element holding the
 * answer and the reveal" (RT-FIX P3-RT-06-03). The answer is the .answer-text of Predict.svelte (the
 * lesson specs read it too); the reveal is the text of the <details> outside its <summary> and the answer.
 */
function predictionReport(el: Element): PredictionReport {
  const details = el.querySelector('details') ?? (el.nextElementSibling?.tagName === 'DETAILS' ? el.nextElementSibling : null);
  const text = (n: Element | null | undefined): string => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const answerEl = details?.querySelector('.answer-text') ?? null;
  const rest = details ? [...details.children].filter((c) => c.tagName !== 'SUMMARY' && c !== answerEl && !c.contains(answerEl)) : [];
  return { details: details !== null, answer: text(answerEl), reveal: rest.map((c) => text(c)).join(' ').trim() };
}

/** The checks of a prediction's fallback that it fails, by name; empty when it is accepted. */
function predictionProblems(report: PredictionReport): string[] {
  if (!report.details) return ['<details>'];
  const problems: string[] = [];
  if (report.answer === '') problems.push('the answer in the <details>');
  if (report.reveal === '') problems.push('the reveal in the <details>');
  return problems;
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
      const problems = predictionProblems(await predictions.nth(k).evaluate(predictionReport));
      expect(problems, `prediction ${k} is followed by its <details> with the answer and the reveal`).toEqual([]);
    }

    // Every tool: default figure, text alternative, caption, disabled controls, the noscript line;
    // a ToolFrame tool also its A-10 table with one button per node.
    const tools = page.locator('[data-tool]');
    const n = await tools.count();
    for (let k = 0; k < n; k++) {
      const report: ToolReport = await tools.nth(k).evaluate(toolReport);
      const what = `${route.path} tool ${k} (${report.tool})`;
      expect(figureProblems(report), `${what}: default figure and its text alternative`).toEqual([]);
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

/** The hooks of SPEC 4.0 that hold a tool's state, outside <noscript>. */
interface StateHooks {
  tool: string;
  moves: string | null;
  /** data-node, data-board, data-value and data-can-act of every element carrying data-node. */
  nodes: string[];
  caption: string;
  /**
   * name=text of every data-out, on a ToolFrame tool (data-frame). An output that measures the reader's
   * machine (a drawing time) carries the attribute data-measured (RT-FIX P4-MERGE-04): it is not part of the
   * default state, so it is listed as "name (measured)", which still requires the element, and the
   * attribute, on both sides.
   */
  outs: string[];
}

/** The state hooks of one tool root. Runs in the page (handed to evaluate), so it uses nothing from outside. */
function stateHooks(root: Element): StateHooks {
  const outside = (el: Element): boolean => el.closest('noscript') === null;
  const text = (n: Element | null | undefined): string => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return {
    tool: `${root.getAttribute('data-tool') ?? ''} ${root.getAttribute('data-instance') ?? ''}`,
    moves: root.getAttribute('data-moves'),
    nodes: [...root.querySelectorAll('[data-node]')]
      .filter(outside)
      .map((b) => ['data-node', 'data-board', 'data-value', 'data-can-act'].map((a) => `${a}=${b.getAttribute(a) ?? '-'}`).join(' ')),
    caption: text(root.querySelector('[data-out="caption"]') ?? root.closest('figure')?.querySelector(':scope > figcaption')),
    outs: root.hasAttribute('data-frame')
      ? [...root.querySelectorAll('[data-out]')]
          .filter(outside)
          .map((o) => (o.hasAttribute('data-measured') ? `${o.getAttribute('data-out') ?? ''} (measured)` : `${o.getAttribute('data-out') ?? ''}=${text(o)}`))
      : [],
  };
}

// The values of the default state (SPEC 4.0: "The default state of every tool is rendered to HTML and
// SVG at build time, with its caption"; 7.4; RT-FIX P3-RT-06-03): the server markup read without
// JavaScript shows what the hydrated tool shows in its default state, with every island hydrated by
// scrolling it into view and nothing clicked (hydrate.ts). The outputs (data-out) are compared on the
// tools of ToolFrame; a root outside it is compared by its node hooks, data-moves and caption (the
// drawing-time probe of dev/draw-time fills its timings only when it hydrates).
for (const route of routes) {
  test(`the server markup shows the default state's values: ${route.path}`, async ({ page, browser }) => {
    await page.goto(route.path);
    const roots = page.locator('[data-tool]');
    const server: StateHooks[] = [];
    for (let k = 0; k < (await roots.count()); k++) server.push(await roots.nth(k).evaluate(stateHooks));

    const context = await browser.newContext({ javaScriptEnabled: true, viewport: { width: 360, height: 800 } });
    try {
      const live = await context.newPage();
      await live.goto(route.path);
      await hydrateEveryIsland(live);
      await expect(live.locator('astro-island[ssr]'), `islands not hydrated on ${route.path}`).toHaveCount(0);
      const hydratedTools = live.locator('astro-island [data-tool]');
      for (let k = 0; k < (await hydratedTools.count()); k++) await expect(hydratedTools.nth(k)).toHaveAttribute('data-hydrated', 'true');
      const liveRoots = live.locator('[data-tool]');
      await expect(liveRoots, `tool roots on ${route.path}`).toHaveCount(server.length);
      for (let k = 0; k < server.length; k++) {
        await expect
          .poll(() => liveRoots.nth(k).evaluate(stateHooks), { message: `${route.path} root ${k} (${server[k]?.tool}): hydrated default against the server markup` })
          .toEqual(server[k]);
      }
    } finally {
      await context.close();
    }
  });
}

for (const route of ['tools/board/', 'modules/m0-start/']) {
  // regression: P3-RT-06-03
  test(`nojs.spec.ts rejects a blank default figure: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Blank the default state: no node, no value, no board drawing; predictions without answer or reveal.
    await page.evaluate(() => {
      for (const r of document.querySelectorAll('[data-tool]')) {
        for (const b of r.querySelectorAll('[data-board-group], svg.drawing, [data-node]')) b.remove();
      }
      for (const d of document.querySelectorAll('[data-prediction] details')) d.replaceChildren(document.createElement('summary'));
    });
    const left = await page.$$eval('[data-tool] [data-value]', (es) => es.length);
    expect(left, 'the page is blank: no data-value hook left').toBe(0);
    // The per-root report and the prediction check of the sweep above, through the same functions.
    const tools = page.locator('[data-tool]');
    const passing: string[] = [];
    for (let k = 0; k < (await tools.count()); k++) {
      const report = await tools.nth(k).evaluate(toolReport);
      if (figureProblems(report).length === 0) passing.push(`${report.tool} ${report.instance}`);
    }
    const predictions = page.locator('[data-prediction]');
    let predictionsAccepted = 0;
    for (let k = 0; k < (await predictions.count()); k++) {
      if (predictionProblems(await predictions.nth(k).evaluate(predictionReport)).length === 0) predictionsAccepted++;
    }
    expect.soft(passing, `${route}: roots whose blank figure nojs.spec.ts accepts as "the default figure"`).toEqual([]);
    expect.soft(predictionsAccepted, `${route}: emptied predictions nojs.spec.ts accepts`).toBe(0);
  });
}

// regression: P4-MERGE-01
test('M6 b10 (T11 on the Average preset, A5) has a default figure and a text alternative in its server markup', async ({ page }) => {
  await page.goto('modules/m6-multiple-edges/');
  const root = page.locator('[data-tool="fold"][data-instance="b10"]');
  await expect(root).toHaveCount(1);
  await expect(root.locator('[data-tab="average"]')).toHaveAttribute('aria-selected', 'true');
  const report = await root.evaluate(toolReport);
  expect(figureProblems(report), 'the Average tab: default figure and its text alternative').toEqual([]);
  expect(report.figure).toBe('board');
});

// regression: P4-MERGE-02
test('M7 prediction 0 has an answer (.answer-text) inside the <details> that follows it without JavaScript', async ({ page }) => {
  await page.goto('modules/m7-geometry/');
  const predictions = page.locator('[data-prediction]');
  const n = await predictions.count();
  expect(n, 'predictions on M7').toBeGreaterThan(0);
  for (let k = 0; k < n; k++) {
    const report = await predictions.nth(k).evaluate(predictionReport);
    expect(predictionProblems(report), `prediction ${k}`).toEqual([]);
  }
});

// regression: P4-MERGE-02
test('M7 T10 predictions: the server markup holds the empty result line (data-out predictResult) of the hydrated prediction', async ({ page }) => {
  await page.goto('modules/m7-geometry/');
  const predictions = page.locator('[data-tool="geometry"] [data-prediction]');
  const n = await predictions.count();
  expect(n, 'T10 predictions on M7').toBeGreaterThan(0);
  for (let k = 0; k < n; k++) {
    const result = predictions.nth(k).locator('[data-out="predictResult"]');
    await expect(result, `prediction ${k}: the result line`).toHaveCount(1);
    await expect(result, `prediction ${k}: empty before an answer`).toHaveText('');
  }
});

/** The text of the named data-out of the first root of a tool on a page, '' when absent. */
async function outText(page: Page, tool: string, name: string): Promise<string> {
  return page
    .locator(`[data-tool="${tool}"]`)
    .first()
    .evaluate((root, n) => (root.querySelector(`[data-out="${n}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), name);
}

// regression: P4-MERGE-03
test('T10 server markup shows data-out source and sharedEdges as the hydrated default fills them', async ({ page, browser }) => {
  for (const route of ['modules/m7-geometry/', 'tools/geometry/']) {
    await page.goto(route);
    const server = { source: await outText(page, 'geometry', 'source'), sharedEdges: await outText(page, 'geometry', 'sharedEdges') };
    const context = await browser.newContext({ javaScriptEnabled: true, viewport: { width: 360, height: 800 } });
    try {
      const live = await context.newPage();
      await live.goto(route);
      await hydrateEveryIsland(live);
      await expect(live.locator('[data-tool="geometry"]').first()).toHaveAttribute('data-hydrated', 'true');
      // The hydrated default fills both once the orbit has loaded.
      await expect.poll(() => outText(live, 'geometry', 'source'), { message: `${route}: hydrated source` }).not.toBe('');
      await expect.poll(() => outText(live, 'geometry', 'sharedEdges'), { message: `${route}: hydrated sharedEdges` }).not.toBe('');
      const hydrated = { source: await outText(live, 'geometry', 'source'), sharedEdges: await outText(live, 'geometry', 'sharedEdges') };
      expect(server, `${route}: the server markup against the hydrated default`).toEqual(hydrated);
    } finally {
      await context.close();
    }
  }
});

// regression: P4-MERGE-04
test('T10 drawMs is a measured time: present in the server markup and marked data-measured, so the default-state comparison reads its presence, not its value', async ({ page, browser }) => {
  for (const route of ['modules/m7-geometry/', 'tools/geometry/']) {
    await page.goto(route);
    const roots = await page.locator('[data-tool="geometry"]').count();
    expect(roots, `${route}: T10 roots`).toBeGreaterThan(0);
    // Every T10 root has its drawMs element in the server markup, marked as a measurement.
    await expect(page.locator('[data-tool="geometry"] [data-out="drawMs"]')).toHaveCount(roots);
    await expect(page.locator('[data-tool="geometry"] [data-out="drawMs"][data-measured]')).toHaveCount(roots);
    const server = await page.locator('[data-tool="geometry"]').first().evaluate(stateHooks);
    expect(server.outs).toContain('drawMs (measured)');
    const context = await browser.newContext({ javaScriptEnabled: true, viewport: { width: 360, height: 800 } });
    try {
      const live = await context.newPage();
      await live.goto(route);
      await hydrateEveryIsland(live);
      // Hydrated, the element holds the time of this machine, still marked; the comparison sees its name only.
      const first = live.locator('[data-tool="geometry"]').first();
      await expect(first.locator('[data-out="drawMs"][data-measured]')).toHaveText(/^\d+\.\d$/);
      expect((await first.evaluate(stateHooks)).outs).toContain('drawMs (measured)');
    } finally {
      await context.close();
    }
  }
});

// SPEC 7.4: "Tools that draw on a canvas (T10, ...) ship an SVG snapshot of their default view"; 4 T10: "Without
// JavaScript the default projection is shown as an SVG image produced at build time". T10's default figure is
// its snapshot (data-out="snapshot"), not the ring board that sets the rings nor the canvas box hidden until the
// first canvas draw: a snapshot with every point and segment removed (its <svg>, <title> and <desc> kept) is
// rejected by the figure check of the sweep, through the same functions.
for (const [route, alsoRingBoard] of [
  ['modules/m7-geometry/', false],
  ['tools/geometry/', false],
  ['modules/m7-geometry/', true],
] as const) {
  // regression: P4-RT-06-02
  test(`nojs.spec.ts rejects a T10 snapshot with no point and no segment: ${route}${alsoRingBoard ? ', ring board removed too' : ''}`, async ({ page }) => {
    await page.goto(route);
    const roots = page.locator('[data-tool="geometry"]');
    const n = await roots.count();
    expect(n, `T10 roots on ${route}`).toBeGreaterThan(0);
    // Blank every snapshot: no circle, no segment path; the <svg> with its title and description stays.
    const removed = await page.evaluate((ringBoard) => {
      let k = 0;
      if (ringBoard) for (const g of document.querySelectorAll('[data-tool="geometry"] [data-board-group]')) g.remove();
      for (const s of document.querySelectorAll('[data-tool="geometry"] [data-out="snapshot"] svg')) {
        for (const e of s.querySelectorAll('circle, path, line, polyline, rect:not([id$="-page"])')) {
          e.remove();
          k++;
        }
      }
      return k;
    }, alsoRingBoard);
    expect(removed, 'points and segments removed').toBeGreaterThan(0);
    const accepted: string[] = [];
    for (let k = 0; k < n; k++) {
      const report = await roots.nth(k).evaluate(toolReport);
      if (figureProblems(report).length === 0) accepted.push(`${report.instance || '(tool route)'} as "${report.figure}"`);
    }
    expect(accepted, `${route}: T10 roots whose blank snapshot nojs.spec.ts accepts as the default figure`).toEqual([]);
  });
}

// SPEC 4.0 "Works before and without JavaScript" and 8.1 P1; RT-FIX-P3-nojs-phase4: the measured drawing time is
// empty in the server markup, so no sentence states a drawing time without a number ("in ms").
for (const route of ['tools/geometry/', 'modules/m7-geometry/']) {
  // regression: P4-RT-06-03
  test(`T10 shows no time sentence without a time before hydration: ${route}`, async ({ page }) => {
    await page.goto(route);
    const texts = await page.locator('[data-tool="geometry"]').evaluateAll((roots) =>
      roots.map((r) => `${r.getAttribute('data-instance') || '(tool route)'}: ${(r as HTMLElement).innerText.replace(/\s+/g, ' ').trim()}`),
    );
    expect(texts.length).toBeGreaterThan(0);
    const dangling = texts.filter((l) => /\bin\s+ms\b/.test(l)).map((l) => l.slice(0, l.indexOf(':')));
    expect(dangling, `${route}: T10 roots that state a drawing time with no number`).toEqual([]);
  });
}

/** Blanks the parts of T12's figure that no run without JavaScript read: the orbit's vertices and edges, the matrix cells. */
function blankT12Figure(root: Element): { vertices: number; edges: number; cells: number } {
  const vertices = [...root.querySelectorAll('[data-out="orbit-graph"] [data-vertex]')];
  const edges = [...root.querySelectorAll('[data-out="orbit-graph"] [data-edge]')];
  const cells = [...root.querySelectorAll('[data-row][data-col]')];
  for (const e of [...vertices, ...edges, ...cells]) e.remove();
  return { vertices: vertices.length, edges: edges.length, cells: cells.length };
}

// SPEC 7.4 "checks, for every lesson, that the text, every default figure and every table are present" and
// 4 T12 (the orbit drawn in layers; the matrices as grids or lists): a T12 root whose orbit drawing and
// matrices are blanked is rejected by the figure check of the sweep, through the same functions, as are the
// per-instance checks of M8.spec.ts shown to miss it.
for (const route of ['modules/m8-lie-algebras/']) {
  // regression: P5-RT-06-01
  test(`nojs.spec.ts rejects a T12 root whose orbit drawing and matrices are blank: ${route}`, async ({ page }) => {
    await page.goto(route);
    const roots = page.locator('[data-tool="rep"]');
    const n = await roots.count();
    expect(n, `T12 roots on ${route}`).toBeGreaterThan(0);
    // Before the blanking: every root has an orbit with vertices and matrices with cells (the build is sound).
    const removed = await roots.evaluateAll((rs, fn) => rs.map((r) => new Function(`return (${fn})`)()(r)), blankT12Figure.toString());
    for (const [k, x] of removed.entries()) expect(x.vertices > 0 && x.cells > 0, `root ${k} had an orbit and matrices to blank: ${JSON.stringify(x)}`).toBe(true);
    // After it, nothing of T12's orbit or matrices is left.
    expect(await page.locator('[data-tool="rep"] [data-vertex], [data-tool="rep"] [data-row][data-col]').count()).toBe(0);
    // The per-instance checks of M8.spec.ts that read the figure still pass on the blank roots.
    for (let k = 0; k < n; k++) {
      const root = roots.nth(k);
      await expect(root.locator('[data-out="matrix-e"]')).toHaveCount(1);
      await expect(root.locator('table[data-table="orbit"] caption')).toHaveCount(1);
      await expect(root.locator('[data-out="dimension"]')).not.toHaveText('');
    }
    // This file's predicate.
    const reports = await page.$$eval('[data-tool="rep"]', (rs, fn) => rs.map((r) => new Function(`return (${fn})`)()(r)), toolReport.toString());
    const accepted = (reports as ToolReport[]).filter((r) => figureProblems(r).length === 0).map((r) => `${r.instance || '(tool route)'} as ${r.figure}`);
    expect(accepted, `${route}: T12 roots with a blank orbit and blank matrices that nojs.spec.ts accepts as having their default figure`).toEqual([]);
  });
}

/** Blanks the configured panel's figure of a T13 root: the shadow picture's marks, the restricted board's drawing and buttons. */
function blankT13Panel(root: Element): { points: number; restrictedShapes: number; restrictedNodes: number } {
  const points = [...root.querySelectorAll('[data-out="shadow-picture"] svg *')];
  const shapes = [...root.querySelectorAll('[data-out="restricted-board"] svg *')];
  const nodes = [...root.querySelectorAll('[data-out="restricted-board"] [data-node]')];
  for (const e of [...points, ...shapes, ...nodes]) e.remove();
  return { points: points.length, restrictedShapes: shapes.length, restrictedNodes: nodes.length };
}

// Adopted from the RT-06 phase 6 reproducer of P6-RT-06-01 (attacks 1 and 10), the retest of P5-RT-06-01 on its
// sibling T13: a T13 root was accepted as "board" through its game board (the first data-board-group), and the panel
// the instance is configured to show, the figure each M9 beat is about, was never read: the shadow picture of b3
// (preset "shadows", SPEC 4 T13 "Shadows"), the restricted board of b7 and b12 (preset "restricted", "Restricted
// board"). With scripts off, the points of b3's shadow picture and the drawing and node buttons of the restricted
// board of b7 and b12 are removed; the figure check of the sweep rejects the three roots, through the same
// functions, as the per-instance checks of M9.spec.ts shown to miss it do not. SPEC.md 7.4: "A Playwright run with
// JavaScript disabled checks, for every lesson, that the text, every default figure and every table are present."
// regression: P6-RT-06-01
test('retest P5-RT-06-01 on T13: a blank shadow picture or restricted board passes the runs without JavaScript (M9 b3, b7, b12)', async ({ page }) => {
  const ROUTE = 'modules/m9-real-forms/';
  await page.goto(ROUTE);
  const ids = ['b3', 'b7', 'b12'];
  // Before the blanking: the build is sound, each root holds the figure of its panel.
  for (const id of ids) {
    const root = page.locator(`[data-tool="satake"][data-instance="${id}"]`);
    await expect(root, id).toHaveCount(1);
    const removed = await root.evaluate((r, fn) => new Function(`return (${fn})`)()(r), blankT13Panel.toString());
    if (id === 'b3') expect(removed.points, `${id}: points of the shadow picture before the blanking`).toBeGreaterThan(0);
    else expect(removed.restrictedShapes > 0 && removed.restrictedNodes > 0, `${id}: restricted board before the blanking ${JSON.stringify(removed)}`).toBe(true);
  }
  // After it, nothing of the panels' figures is left.
  expect(await page.locator('[data-out="shadow-picture"] svg *, [data-out="restricted-board"] svg *, [data-out="restricted-board"] [data-node]').count()).toBe(0);

  // M9.spec.ts's per-instance checks without JavaScript still pass on the blank roots.
  for (const id of ids) {
    const root = page.locator(`[data-tool="satake"][data-instance="${id}"]`);
    await expect(root.locator('[data-out="decoration"] svg').first(), id).toBeAttached();
    expect(await root.locator('[data-out="game-board"] button[data-node]').count(), id).toBeGreaterThan(0);
    await expect(root.locator('details table[data-table="decoration"]'), id).toHaveCount(1);
  }
  await expect(page.locator('[data-instance="b7"] [data-out="restricted-name"]')).not.toHaveText('');

  // This file's predicate: the three roots are rejected.
  const reports = await page.$$eval('[data-tool="satake"]', (rs, fn) => rs.map((r) => new Function(`return (${fn})`)()(r)), toolReport.toString());
  const accepted = (reports as ToolReport[]).filter((r) => ids.includes(r.instance) && figureProblems(r).length === 0).map((r) => `${r.instance} as ${r.figure}`);
  expect(accepted, `${ROUTE}: T13 roots whose blank panel figure nojs.spec.ts accepts as their default figure`).toEqual([]);
});

// The same cause on T14: the Atlas page's default figure is the drawing of the board (role img, inside the data-tool
// root), and the picker's figures are the 32 drawings. A role-img element with any child element counted as a
// drawing, so a drawing whose roads and nodes are all removed (its empty <g> groups kept) was still accepted; a
// drawing now holds marks.
for (const route of ['atlas/B3/', 'tools/atlas/']) {
  // regression: P6-RT-06-01
  test(`same cause on T14: a blank drawing passes the runs without JavaScript (${route})`, async ({ page }) => {
    await page.goto(route);
    const removed = await page.evaluate(() => {
      let k = 0;
      for (const s of document.querySelectorAll('[data-tool="atlas"] svg[role="img"]')) {
        for (const e of s.querySelectorAll('line, path, polygon, circle, ellipse, rect, text')) {
          e.remove();
          k++;
        }
      }
      return k;
    });
    expect(removed, `${route}: marks of the drawings before the blanking`).toBeGreaterThan(0);
    // T14.spec.ts's checks of the drawing without JavaScript still pass.
    const drawing = page.locator('[data-tool="atlas"] svg[role="img"]').first();
    await expect(drawing).toBeVisible();
    expect((await drawing.getAttribute('aria-label')) ?? '').not.toBe('');
    // This file's predicate.
    const reports = await page.$$eval('[data-tool="atlas"]', (rs, fn) => rs.map((r) => new Function(`return (${fn})`)()(r)), toolReport.toString());
    const accepted = (reports as ToolReport[]).filter((r) => figureProblems(r).length === 0).map((r) => `${r.tool} ${r.instance || '(page)'} as ${r.figure}`);
    expect(accepted, `${route}: Atlas roots whose blank drawing nojs.spec.ts accepts as their default figure`).toEqual([]);
  });
}

// The figure of the panel a T13 instance is configured to show is read, not only its markup: a restricted board
// removed whole while its panel still names it, and a shadow picture whose points lose their marks while their
// data-point groups stay, are rejected too (the same cause as P6-RT-06-01, with the containers kept or removed).
// regression: P6-RT-06-01
test('a T13 panel that names its restricted board without drawing it, or a shadow picture with empty points, is rejected without JavaScript (M9 b3, b7)', async ({ page }) => {
  await page.goto('modules/m9-real-forms/');
  const removed = await page.evaluate(() => {
    const b7 = document.querySelector('[data-tool="satake"][data-instance="b7"] [data-out="restricted-board"]');
    b7?.remove();
    let marks = 0;
    for (const m of document.querySelectorAll('[data-tool="satake"][data-instance="b3"] [data-out="shadow-picture"] [data-point] > *')) {
      m.remove();
      marks++;
    }
    return { board: b7 !== null, marks };
  });
  expect(removed.board && removed.marks > 0, `the build holds both figures: ${JSON.stringify(removed)}`).toBe(true);
  await expect(page.locator('[data-instance="b3"] [data-out="shadow-picture"] [data-point]').first()).toBeAttached();
  const reports = await page.$$eval('[data-tool="satake"]', (rs, fn) => rs.map((r) => new Function(`return (${fn})`)()(r)), toolReport.toString());
  const problems = Object.fromEntries((reports as ToolReport[]).filter((r) => ['b3', 'b7'].includes(r.instance)).map((r) => [r.instance, figureProblems(r)]));
  expect((problems.b3 ?? []).join('; '), 'b3: the shadow picture without marks').toMatch(/^content of .*\bshadow-picture\b/);
  expect((problems.b7 ?? []).join('; '), 'b7: the restricted board removed').toMatch(/^content of .*\brestricted-board\b/);
});
