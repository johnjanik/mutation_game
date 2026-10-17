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
// (compared with the hydrated default), data-hydrated, and the prediction's .answer-text.
import { expect, test } from '@playwright/test';
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
  figure: 'board' | 'drawing' | 'img' | null;
  textAlternative: boolean;
  /** Labels of the node buttons of a game board that lack a value or a hook of SPEC 4.0. */
  nodesWithoutValue: string[];
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
 * Every node button of a game board shows its value: the four hooks of 4.0, data-value not empty.
 * The board editor's nodes (inside data-editor) show no value and are left out of that check.
 */
function toolReport(root: Element): ToolReport {
  const outside = (el: Element): boolean => el.closest('details, noscript') === null;
  const named = (el: Element | null): boolean =>
    !!el && ((el.getAttribute('aria-label') ?? '').trim() !== '' || (el.getAttribute('aria-labelledby') ?? '').trim() !== '');
  const boards = [...root.querySelectorAll('[data-board-group]')]
    .filter(outside)
    .filter((g) => g.querySelector('[data-node]') !== null && [...(g.parentElement?.children ?? [])].some((c) => c.tagName.toLowerCase() === 'svg' && c.childElementCount > 0));
  const drawings = [...root.querySelectorAll('[role="img"]')]
    .filter(outside)
    .filter((d) => d.childElementCount > 0 && (named(d) || d.querySelector(':scope > title') !== null));
  const imgs = [...root.querySelectorAll('img')].filter(
    (i) => i.closest('noscript') === null && (i.getAttribute('src') ?? '').trim() !== '' && (i.getAttribute('alt') ?? '').trim() !== '',
  );
  const kind = boards.length > 0 ? 'board' : drawings.length > 0 ? 'drawing' : imgs.length > 0 ? 'img' : null;
  const figureEl = boards[0] ?? drawings[0] ?? imgs[0] ?? null;
  const figure = figureEl?.closest('figure') ?? null;
  // A drawing and a snapshot are named by construction; a board by its group or by its <figure>.
  const textAlternative =
    kind === 'drawing' || kind === 'img' || (kind === 'board' && (boards.some((g) => named(g)) || named(figure) || !!figure?.querySelector(':scope > figcaption')));
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
  /** name=text of every data-out, on a ToolFrame tool (data-frame). */
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
      ? [...root.querySelectorAll('[data-out]')].filter(outside).map((o) => `${o.getAttribute('data-out') ?? ''}=${text(o)}`)
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
