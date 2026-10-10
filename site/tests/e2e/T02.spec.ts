// P1-A6: T2, the Orbit Garden, against the built site (SPEC.md 4 T2, 4.0, 7.4, 7.5, 9.2). Each test
// reads only the hooks of SPEC 4.0 and the live region, and waits for data-hydrated="true" before
// acting.
//
// Hooks used (data-out): found, total, stopMessage, verdict (phase 2, P2-A7), layersGrown, layerChart
// (children carry data-layer, data-count, data-complete), vertex (data-position, data-layer), edge
// (data-label, data-from, data-to, data-rise in the positive view), rise (the numeral written on an
// edge off the finite types), tableRow (data-position, data-layer), chartRow (data-layer, data-count),
// strip (the strip of past positions), caption, notice, noscript (ToolFrame).
// Controls (data-control): grow, showTotal, growth, grows, positiveOnly, vertexLabels, picker, scrub
// (strip buttons with data-step, or the slider), jumpRow (a table row's jump button), undo, redo,
// reset, copyLink, downloadData (ToolFrame). Board hooks: data-node, data-board, data-value,
// data-can-act on node buttons; data-tool, data-moves, data-hydrated on the root; data-table-node on
// the table's node buttons; data-live on the live region.
// Properties beyond the common ones of 4.0 (id, board, coords, start, moves, linkTo, prediction,
// preset, caption, layers): grown, grows ('roots' | 'orbit'), growth ('follow' | 'explore'),
// positiveOnly, vertexLabels, boardChoices.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface LayerGrowth {
  label: string;
  cartan: number[][];
  root_populations_found: number;
  new_per_layer: number[];
  stop_at_2000: { positions: number; complete_layers: number };
}
const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { n_roots: number; positive_roots?: number[][] }>;
  layer_growth_examples: LayerGrowth[];
};
const growth = (label: string): LayerGrowth => GOLDEN.layer_growth_examples.find((g) => g.label === label)!;
const cLink = (cartan: number[][]): string => `c:${cartan.map((r) => r.join(',')).join(';')}`;
const TRIANGLE = growth('triangle');
const STAR5 = growth('star with five arms');

const out = (page: Page, name: string): Locator => page.locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => page.locator(`[data-control="${name}"]`);
const root = (page: Page): Locator => page.locator('[data-tool="garden"]');

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`tools/garden/${query}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

/** Presses "Grow one layer" until it is disabled; returns the number of presses. */
async function growAll(page: Page, limit = 60): Promise<number> {
  let presses = 0;
  const grow = control(page, 'grow');
  while (presses < limit && (await grow.isEnabled())) {
    await grow.click();
    presses++;
  }
  return presses;
}

async function boardValues(page: Page): Promise<string> {
  return (await page.locator('[data-node][data-board]').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')))).join(',');
}

async function mutateCity(page: Page, label: number): Promise<void> {
  await page.locator(`[data-node="${label}"][data-board]`).click();
}

test('explore on A3 reaches 12 and the total appears on request', async ({ page }) => {
  await open(page);
  await expect(out(page, 'found')).toHaveText('3');
  await growAll(page);
  await expect(control(page, 'grow')).toBeDisabled();
  await expect(out(page, 'found')).toHaveText(String(GOLDEN.types.A3!.n_roots));
  await expect(out(page, 'total')).toHaveText('');
  await control(page, 'showTotal').click();
  await expect(out(page, 'total')).toHaveText(String(GOLDEN.types.A3!.n_roots));
});

test('the triangle grows to 243 and says stopped after 40 layers', async ({ page }) => {
  await open(page, `?g=${cLink(TRIANGLE.cartan)}`);
  await expect(out(page, 'found')).toHaveText('3');
  const presses = await growAll(page);
  expect(presses).toBe(40);
  await expect(out(page, 'found')).toHaveText(String(TRIANGLE.root_populations_found));
  await expect(out(page, 'stopMessage')).toHaveText('stopped after 40 layers');
  await expect(control(page, 'grow')).toBeDisabled();
  const counts = await page.locator('[data-out="layerChart"] [data-layer]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-count'))));
  expect(counts).toEqual(TRIANGLE.new_per_layer);
  expect(await page.locator('body').textContent()).not.toContain('not of finite type');
  await expect(out(page, 'verdict')).toHaveCount(0);
});

test('the star with five arms stops at 2000 positions', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, `?g=${cLink(STAR5.cartan)}`);
  await growAll(page);
  await expect(out(page, 'found')).toHaveText(String(STAR5.stop_at_2000.positions));
  await expect(out(page, 'stopMessage')).toHaveText(`stopped after 2000 positions; layers 0 to ${STAR5.stop_at_2000.complete_layers} are complete`);
  const texts = await out(page, 'vertex').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
  expect(texts).toHaveLength(STAR5.stop_at_2000.positions);
  expect(texts.every((t) => t === '')).toBe(true);
  const incomplete = await page.locator('[data-out="layerChart"] [data-complete="false"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-layer')));
  expect(incomplete).toEqual([String(STAR5.stop_at_2000.complete_layers + 1)]);
});

test('follow adds a vertex per move', async ({ page }) => {
  await open(page, '?g=A2');
  await control(page, 'growth').click();
  await expect(out(page, 'found')).toHaveText('1');
  await mutateCity(page, 2);
  await expect(out(page, 'found')).toHaveText('2');
  await expect(page.locator('[data-out="edge"][data-label="2"]')).toHaveCount(1);
  await expect(page.locator('[data-out="edge"][data-label="2"]')).toContainText('2');
  await mutateCity(page, 2);
  await expect(out(page, 'found')).toHaveText('2');
  for (const label of [2, 1, 2, 1, 2, 1]) await mutateCity(page, label);
  await expect(out(page, 'found')).toHaveText(String(GOLDEN.types.A2!.n_roots));
});

test('positive roots only on G2 draws one triple line', async ({ page }) => {
  await open(page, '?g=G2');
  await growAll(page);
  await control(page, 'positiveOnly').click();
  await expect(out(page, 'vertex')).toHaveCount(GOLDEN.types.G2!.positive_roots!.length);
  await expect(out(page, 'edge')).toHaveCount(4);
  const three = page.locator('[data-out="edge"][data-rise="3"]');
  await expect(three).toHaveCount(1);
  await expect(three).toHaveAttribute('data-from', '0,1');
  await expect(three).toHaveAttribute('data-to', '3,1');
  await expect(three).toHaveAttribute('data-label', '1');
  await expect(three.locator('line')).toHaveCount(3);
  // A3: six vertices, every rise 1.
  await open(page);
  await growAll(page);
  await control(page, 'positiveOnly').click();
  await expect(out(page, 'vertex')).toHaveCount(GOLDEN.types.A3!.positive_roots!.length);
  const rises = await out(page, 'edge').evaluateAll((els) => els.map((e) => e.getAttribute('data-rise')));
  expect(rises.length).toBeGreaterThan(0);
  expect(rises.every((r) => r === '1')).toBe(true);
});

/** Walks the garden with the arrow keys from the focused vertex and returns every position reached. */
async function walk(page: Page): Promise<Set<string>> {
  const seen = new Set<string>();
  const here = async (): Promise<void> => {
    const p = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-position') ?? null);
    if (p !== null) seen.add(p);
  };
  await page.keyboard.press('Home');
  await here();
  for (let layer = 0; layer < 12; layer++) {
    for (let k = 0; k < 8; k++) {
      await page.keyboard.press('ArrowLeft');
      await here();
    }
    for (let k = 0; k < 8; k++) {
      await page.keyboard.press('ArrowRight');
      await here();
    }
    await page.keyboard.press('ArrowDown');
    await here();
  }
  return seen;
}

test('keyboard reaches every vertex', async ({ page }) => {
  await open(page);
  await growAll(page);
  await page.locator('[data-out="vertex"][tabindex="0"]').focus();
  const seen = await walk(page);
  const all = await out(page, 'vertex').evaluateAll((els) => els.map((e) => e.getAttribute('data-position')));
  expect(all).toHaveLength(GOLDEN.types.A3!.n_roots);
  expect([...seen].sort()).toEqual([...all].sort());
  // Enter on a vertex of layer 2 jumps: the board shows it and data-moves is its layer.
  const target = page.locator('[data-out="vertex"][data-layer="2"]').first();
  await target.focus();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await boardValues(page)).toBe(await target.getAttribute('data-position'));
  await expect(page.locator('[data-tool="garden"] [data-live]')).not.toBeEmpty({ timeout: 3000 });
});

test('hooks, no JavaScript, 320 pixels', async ({ browser, page }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  const nodes = page.locator('[data-node][data-board]');
  await expect(nodes).toHaveCount(3);
  for (const attr of ['data-node', 'data-board', 'data-value', 'data-can-act']) {
    const values = await nodes.evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), attr);
    expect(values.every((v) => v !== null && v !== '')).toBe(true);
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(`tools/garden/`);
  const r = nojs.locator('[data-tool="garden"]');
  await expect(r.locator('svg').first()).toBeAttached();
  await expect(nojs.locator('[data-out="found"]')).toHaveText('3');
  await expect(nojs.locator('[data-out="caption"]')).not.toBeEmpty();
  await expect(nojs.locator('[data-out="tableRow"]')).toHaveCount(3);
  const enabled = await r.locator('button, select, input').evaluateAll((els) => els.filter((e) => !(e as HTMLButtonElement).matches(':disabled')).length);
  expect(enabled).toBe(0);
  await context.close();
  // 320 pixels: the page does not scroll sideways, the garden box does (E8 has eight wide seeds).
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, '?g=E8');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const boxScrolls = await out(page, 'vertex').first().evaluate((el) => {
    for (let e: HTMLElement | null = el.parentElement; e; e = e.parentElement) {
      const style = getComputedStyle(e);
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && e.scrollWidth > e.clientWidth) return e.clientWidth <= 320;
    }
    return false;
  });
  expect(boxScrolls).toBe(true);
});

test('a link restores board and moves', async ({ page }) => {
  await open(page);
  await control(page, 'picker').selectOption('D4');
  await expect(page.locator('[data-node][data-board]')).toHaveCount(4);
  await control(page, 'grow').click();
  await control(page, 'grow').click();
  const target = page.locator('[data-out="vertex"][data-layer="2"]').first();
  const position = await target.getAttribute('data-position');
  await target.click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await page.waitForTimeout(800);
  expect(page.url()).toContain('g=D4');
  await page.reload();
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(page.locator('[data-node][data-board]')).toHaveCount(4);
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await boardValues(page)).toBe(position);
});

test("undo, redo, reset and the strip on the garden's board", async ({ page }) => {
  await open(page, '?g=A2');
  await control(page, 'growth').click();
  await mutateCity(page, 2);
  await mutateCity(page, 1);
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(out(page, 'found')).toHaveText('3');
  await control(page, 'undo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(out(page, 'found')).toHaveText('3');
  await control(page, 'redo').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await page.locator('[data-out="strip"] [data-step="1"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await mutateCity(page, 2);
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(page.locator('[data-out="strip"] [data-step]')).toHaveCount(3);
  expect(await boardValues(page)).toBe('1,0');
  await control(page, 'reset').click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(out(page, 'found')).toHaveText('1');
  // explore: reset returns to the configured grown, 0 layers: the three seeds.
  await open(page);
  await control(page, 'grow').click();
  await control(page, 'grow').click();
  await expect(out(page, 'found')).not.toHaveText('3');
  await control(page, 'reset').click();
  await expect(out(page, 'found')).toHaveText('3');
});

test('the table view lists the garden and jumps', async ({ page }) => {
  await open(page);
  await growAll(page);
  await out(page, 'tableRow').first().evaluate((el) => {
    (el.closest('details') as HTMLDetailsElement).open = true;
  });
  const rows = await out(page, 'tableRow').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-position')}@${e.getAttribute('data-layer')}`));
  const vertices = await out(page, 'vertex').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-position')}@${e.getAttribute('data-layer')}`));
  expect(rows).toHaveLength(GOLDEN.types.A3!.n_roots);
  expect([...rows].sort()).toEqual([...vertices].sort());
  await expect(page.locator('[data-table-node]')).toHaveCount(3);
  const row = page.locator('[data-out="tableRow"][data-layer="2"]').first();
  const position = await row.getAttribute('data-position');
  await row.locator('[data-control="jumpRow"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  expect(await boardValues(page)).toBe(position);
  // The triangle grown 40 layers: the table holds the chart's numbers.
  await open(page, `?g=${cLink(TRIANGLE.cartan)}`);
  await growAll(page);
  const chartRows = await out(page, 'chartRow').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-count'))));
  expect(chartRows).toEqual(TRIANGLE.new_per_layer);
});

test('labels toggle', async ({ page }) => {
  await open(page);
  await growAll(page);
  const texts = async (): Promise<string[]> => out(page, 'vertex').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
  expect((await texts()).every((t) => t !== '')).toBe(true);
  await control(page, 'vertexLabels').click();
  expect((await texts()).every((t) => t === '')).toBe(true);
  const edgeLabels = await out(page, 'edge').evaluateAll((els) => els.map((e) => [e.getAttribute('data-label'), e.textContent ?? '']));
  expect(edgeLabels.length).toBeGreaterThan(0);
  expect(edgeLabels.every(([label, text]) => label !== null && text.includes(label))).toBe(true);
  const boardLabels = await page.locator('[data-node][data-board]').count();
  expect(boardLabels).toBe(3);
  await control(page, 'vertexLabels').click();
  expect((await texts()).every((t) => t !== '')).toBe(true);
});

test('the rise is written on the edge of a custom board', async ({ page }) => {
  await open(page, '?g=c:2,-1;-2,2');
  await growAll(page);
  await control(page, 'positiveOnly').click();
  await expect(out(page, 'vertex')).toHaveCount(4);
  await expect(out(page, 'edge')).toHaveCount(2);
  const edges = await out(page, 'edge').evaluateAll((els) =>
    els.map((e) => [e.getAttribute('data-rise'), e.querySelector('[data-out="rise"]')?.textContent ?? null]),
  );
  expect(edges.map(([r]) => r).sort()).toEqual(['1', '2']);
  for (const [rise, text] of edges) expect(text).toContain(rise!);
});

test('above 300 only the focused and played edges are drawn', async ({ page }) => {
  test.setTimeout(120000);
  await open(page, `?g=${cLink(STAR5.cartan)}`);
  await growAll(page);
  await expect(out(page, 'found')).toHaveText('2000');
  await expect(out(page, 'edge')).toHaveCount(0);
  await page.locator('[data-out="vertex"][tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  const focused = await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute('data-position'));
  const ends = await out(page, 'edge').evaluateAll((els) => els.map((e) => [e.getAttribute('data-from'), e.getAttribute('data-to')]));
  expect(ends.length).toBeGreaterThan(0);
  expect(ends.every(([a, b]) => a === focused || b === focused)).toBe(true);
  await mutateCity(page, 2);
  await expect(out(page, 'edge')).toHaveCount(1);
  await expect(out(page, 'edge')).toHaveAttribute('data-label', '2');
});

async function targetsOk(page: Page): Promise<void> {
  const boxes = await out(page, 'vertex').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.w).toBeGreaterThanOrEqual(24);
    expect(b.h).toBeGreaterThanOrEqual(24);
  }
  for (let a = 0; a < boxes.length; a++) {
    for (let c = a + 1; c < boxes.length; c++) {
      const p = boxes[a]!;
      const q = boxes[c]!;
      const overlap = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
      expect(overlap).toBe(false);
    }
  }
}

test('vertex targets are at least 24 pixels and do not overlap', async ({ page }) => {
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    await growAll(page);
    await targetsOk(page);
    await open(page, `?g=${cLink(TRIANGLE.cartan)}`);
    await growAll(page);
    await targetsOk(page);
  }
});

test('the focused vertex shows a focus ring', async ({ page }) => {
  await open(page);
  await growAll(page);
  await page.locator('[data-out="vertex"][tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  const result = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { vertex: el.getAttribute('data-out'), outline: getComputedStyle(el).outlineStyle, visible: hit === el || el.contains(hit) };
  });
  expect(result.vertex).toBe('vertex');
  expect(result.outline).not.toBe('none');
  expect(result.visible).toBe(true);
});

test('the default state starts meaningful', async ({ browser, page }) => {
  const nA3 = String(GOLDEN.types.A3!.n_roots);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto('tools/garden/');
  for (const p of [nojs, page]) {
    if (p === page) await open(page);
    await expect(p.locator('[data-out="vertex"]')).toHaveCount(3);
    await expect(p.locator('[data-out="vertex"][data-layer="0"]')).toHaveCount(3);
    await expect(p.locator('[data-out="found"]')).toHaveText('3');
    await expect(p.locator('[data-out="layerChart"]')).toBeAttached();
    await expect(p.locator('[data-out="caption"]')).toContainText(nA3);
  }
  await context.close();
});

test('nothing grows by itself and reduced motion is instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.waitForTimeout(2000);
  await expect(out(page, 'found')).toHaveText('3');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await control(page, 'grow').click();
  await expect(page.locator('[data-out="vertex"][data-layer="1"]').first()).toBeAttached();
  const animations = await page.locator('[data-out="vertex"][data-layer="1"]').evaluateAll((els) => els.reduce((n, e) => n + e.getAnimations().length, 0));
  expect(animations).toBe(0);
});

test('no worker request on /tools/garden', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (/engine\.worker/.test(r.url())) requested.push(r.url());
  });
  page.on('worker', (w) => requested.push(w.url()));
  await open(page, `?g=${cLink(TRIANGLE.cartan)}`);
  await growAll(page);
  await control(page, 'showTotal').click();
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual([]);
});

test('axe on /tools/garden', async ({ page }) => {
  await open(page);
  await growAll(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5) }));
  expect(serious).toEqual([]);
});

test('download data holds the garden', async ({ page }) => {
  await open(page);
  await growAll(page);
  const [download] = await Promise.all([page.waitForEvent('download'), control(page, 'downloadData').click()]);
  const path = await download.path();
  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    tool: string;
    state: { board: string };
    derived: { positions: { entries: number[]; layer: number; word: number[] }[]; truncated: boolean; completeLayers: number; depthReached: number; edges: unknown[] };
  };
  expect(data.tool).toBe('garden');
  expect(data.state.board).toBe('A3');
  expect(data.derived.positions).toHaveLength(GOLDEN.types.A3!.n_roots);
  expect(data.derived.positions.every((p) => p.word.length === p.layer)).toBe(true);
  expect(data.derived.truncated).toBe(false);
  expect(typeof data.derived.completeLayers).toBe('number');
  expect(data.derived.depthReached).toBe(data.derived.completeLayers);
  expect(data.derived.edges.length).toBeGreaterThan(0);
});
