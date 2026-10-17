// P2-A9: lesson M3, "Finite, affine, wild", against the built site (SPEC.md 3 M3, 2.11, 2.12, 8.2,
// 8.4, 8.5, 9.2, 4.0, 7.3, 7.4, 7.6; build-plan/agents/P2-A9-lesson-m3.md 5.15). Run after
// `npm run build` against `astro preview`, one Playwright run at a time. The helpers follow
// M0.spec.ts and M1.spec.ts. Every number with a golden value is read from
// reference/golden_data.json, never typed; the D4 play of Appendix A.4 is read from the golden end.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("lab", "form", "affine", "board", "garden", "kostant"),
//     data-instance (b1 to b13), data-moves, data-hydrated="true"
//   node buttons (P0-A5 Board, P2-A3 BoardEditor): data-node, data-board ("populations"),
//     data-value, data-can-act; aria-label (the A-3 name, for "mutation would change nothing")
//   T4, registry site/src/tools/registry/T04.ts (T04_OUTS): data-out nodeCount, verdictClass,
//     verdictName (data-name), spectralRadius, rootCount, stopMessage, hunterResult (data-population,
//     data-moves, data-word), caption, noscript; data-control picker, loadPreset, addNode,
//     roadsOther, roadsOut, roadsBack; editor root [data-editor] with data-road-style
//   T3, registry site/src/tools/registry/T03.ts: data-out smallValue, smallVerdict, caption, noscript
//   T15, registry site/src/tools/registry/T15.ts: data-out verdict, moods, predictResult, caption,
//     noscript; data-control predictAnswer, predictCheck; nodes inside [data-board-group]
//   T1, registry site/src/tools/registry/T01.ts (T01_OUTS): data-out caption, noscript
//   T2, registry site/src/tools/registry/T02.ts: data-out found, stopMessage, verdict, caption, noscript
//   T9, registry site/src/tools/registry/T09.ts (T09_OUTS): data-out moveCount, finalNumbers, marked,
//     affineBoard (data-name), predictResult, caption, noscript; data-control playToEnd, step,
//     predictAnswer, predictCheck, openLab (href)
//   Predict (P1-A5 Predict.svelte): data-prediction, .question, details, .answer-text
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title,
//     question, draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance;
//     data-challenge, data-met, data-challenge-result (text "Goal reached."); data-source;
//     data-unverified and a.unverified-mark (P0-A4 Unverified)
//   this lesson's own markup: data-seen-statement, data-static-figure, data-open-problem-link
//
// Word-counting rule (as M0.spec.ts and M1.spec.ts): the words of the <article> after removing every
// tool root ([data-tool]), every <details>, every live or status region, the draft mark and the list
// of sources entries; each KaTeX formula counts as one word; a word is a run of non-space characters.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { boardFromName, classify, highestRoot, kostantPlay, play } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';
import { distDir } from './routes';

const ROUTE = 'modules/m3-classification/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m3-classification.mdx', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m3-classification/index.html`;
const ONE_WAY_SENTENCE = 'has a one-way road: the theory does not apply';

/** New items of Appendix E proposed by this lesson (equal to proposedUnverifiedItems of the report). */
const PROPOSED_ITEMS: string[] = [];

type Kind = 'lab' | 'form' | 'affine' | 'board' | 'garden' | 'kostant';
/** The tool instances of the seven beats and the challenges, in reading order, with their tool ids. */
const TOOLS: [string, Kind][] = [
  ['b1', 'lab'],
  ['b2', 'lab'],
  ['b3', 'form'],
  ['b4', 'affine'],
  ['b5', 'affine'],
  ['b6', 'board'],
  ['b7', 'garden'],
  ['b8', 'kostant'],
  ['b9', 'lab'],
  ['b10', 'lab'],
  ['b11', 'lab'],
  ['b12', 'board'],
  ['b13', 'lab'],
];
const BEAT_OF: Record<string, number> = { b1: 1, b2: 2, b3: 2, b4: 3, b5: 3, b6: 4, b7: 4, b8: 5, b9: 6 };

interface Golden {
  types: Record<string, { n_roots: number; highest_root: number[]; numbers_of_highest_root: number[]; cartan: number[][] }>;
  kostant: Record<string, { end_from_node: number[][]; moves_from_node: number[]; final_numbers_from_node: number[][]; affine_board_from_node: string[] }>;
  layer_growth_examples: { label: string; layers: number; root_populations_found: number; new_per_layer: number[] }[];
  affine: Record<string, { name: string; marks: number[] }>;
  classification_tests: { label: string; spectral_radius_4_decimals: string | null }[];
  one_way_counterexample: { cartan: number[][]; start: number[]; moves: number[]; result: number[] };
  pentagon_example: { start: number[]; moves: number; level: number };
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const growth = (label: string): Golden['layer_growth_examples'][number] => GOLDEN.layer_growth_examples.find((r) => r.label === label)!;
const TRIANGLE = growth('triangle');
const STAR = growth('star with four arms');
const SQUARE_RADIUS = GOLDEN.classification_tests.find((r) => r.label === 'square (the 4-cycle)')!.spectral_radius_4_decimals!;
const ONE_WAY = GOLDEN.one_way_counterexample;
const MARKS_SQUARE = GOLDEN.affine.A3!.marks;
const MARKS_STAR = GOLDEN.affine.D4!.marks;
/** The frozen population of the star plus one Martian in city 0 (labels 0 to 4, node 0 first). */
const FROZEN_PLUS_ONE = MARKS_STAR.map((m, i) => (i === 0 ? m + 1 : m));
const KOSTANT_D4 = GOLDEN.kostant.D4!;
const minus = (x: number): string => (x < 0 ? `−${-x}` : String(x));

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const node = (page: Page, id: string, label: number): Locator => tool(page, id).locator(`button[data-board="populations"][data-node="${label}"]`);
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** The populations of a tool, in label order, as data-value text. */
async function values(page: Page, id: string): Promise<string[]> {
  return tool(page, id)
    .locator('button[data-board="populations"][data-node]')
    .evaluateAll((els) =>
      els
        .map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value') ?? ''] as const)
        .sort((a, b) => a[0] - b[0])
        .map((p) => p[1]),
    );
}

/** Scrolls a tool into view (client:visible) and waits for hydration. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true');
}

/** Loads a picker entry of a T4 instance by its id through the select and the Load button. */
async function pick(page: Page, id: string, preset: string): Promise<void> {
  await control(page, id, 'picker').selectOption(preset);
  await control(page, id, 'loadPreset').click();
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

/**
 * The prose sentences of the lesson (tools, live regions and source entries removed). Each formula is
 * replaced by its TeX source, so that a sentence can be searched for A_n, D_n and E_8.
 */
async function proseSentences(page: Page, scope = 'article'): Promise<string[]> {
  const text = await page.locator(scope).first().evaluate((root) => {
    const copy = root.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) {
      const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? 'formula';
      k.replaceWith(document.createTextNode(` ${tex.replace(/\s+/g, '')} `));
    }
    for (const el of copy.querySelectorAll('[data-tool], [role="status"], [aria-live], [data-anatomy="sources"] ul, script, style, noscript, svg')) el.remove();
    for (const el of copy.querySelectorAll('p, li, h1, h2, h3, summary, figcaption')) el.append(document.createTextNode(' . '));
    return copy.textContent ?? '';
  });
  return text
    .replace(/\s+/g, ' ')
    // A full stop after a lone capital (an initial, J. H. Smith) or inside "p." does not end a sentence.
    .split(/(?<=[.?!])(?<!\b[A-Z]\.)(?<!\bp\.)(?<!\bc\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

// ---------------------------------------------------------------------------------------------
// Without JavaScript
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the figures are present', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tool]')).toHaveCount(TOOLS.length);
    for (const [id, kind] of TOOLS) {
      const root = tool(page, id);
      await expect(root, id).toHaveCount(1);
      await expect(root, id).toHaveAttribute('data-tool', kind);
      expect(norm(await out(page, id, 'caption').textContent()), `${id} caption`).not.toBe('');
      await expect(out(page, id, 'noscript'), `${id} noscript line`).toHaveText('Interactive when scripts are allowed.');
      const enabled = await root.locator('button, input, select, textarea').evaluateAll((els) => els.filter((e) => !e.matches(':disabled')).length);
      expect(enabled, `${id} controls disabled`).toBe(0);
    }
    for (const [id, beat] of Object.entries(BEAT_OF)) {
      await expect(page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] [data-tool][data-instance="${id}"]`), id).toHaveCount(1);
    }
    // Beat 7: a static figure with a caption and no island.
    const fig = page.locator('[data-beat="7"] [data-anatomy="figure"] figure[data-static-figure]');
    await expect(fig).toHaveCount(1);
    expect(norm(await fig.locator('figcaption').textContent())).toMatch(/three special trees/);
    await expect(fig.locator('svg[role="img"] title')).toHaveCount(1);
    await expect(page.locator('[data-beat="7"] astro-island, [data-beat="7"] [data-tool]')).toHaveCount(0);
    // Beat 1: the count on A3 is complete at build time.
    await expect(out(page, 'b1', 'rootCount')).toHaveText(String(GOLDEN.types.A3!.n_roots));
    await expect(out(page, 'b1', 'stopMessage')).toHaveCount(0);
    // Beat 3: the two frozen populations, in label order.
    expect(await values(page, 'b4')).toEqual(MARKS_SQUARE.map(String));
    expect(await values(page, 'b5')).toEqual(MARKS_STAR.map(String));
    // Beat 4: the plan start and the capped garden with its verdict.
    expect(await values(page, 'b6')).toEqual(FROZEN_PLUS_ONE.map(String));
    await expect(out(page, 'b7', 'found')).toHaveText(String(STAR.root_populations_found));
    await expect(out(page, 'b7', 'stopMessage')).toHaveText(`stopped after ${STAR.layers} layers`);
    await expect(out(page, 'b7', 'verdict')).toHaveText('affine');
    // Beat 6: the mixed population on the one-way road.
    await expect(out(page, 'b9', 'hunterResult')).toHaveAttribute('data-population', ONE_WAY.result.join(','));
    await expect(out(page, 'b9', 'hunterResult')).toContainText(`(${ONE_WAY.result.map(minus).join(', ')})`);
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('every prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    const positive = KOSTANT_D4.final_numbers_from_node[0]!.findIndex((x) => x > 0);
    const expected: Record<string, string> = {
      b4: String(MARKS_SQUARE[0]),
      b8: `city ${positive + 1}`,
    };
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
  await hydrate(page, 'b4');
  for (const label of [1, 2, 3, 4]) await expect(node(page, 'b4', label)).toHaveAttribute('data-can-act', 'false');
  await node(page, 'b4', 1).click({ force: true });
  await expect(tool(page, 'b4')).toHaveAttribute('data-moves', '0');
  await control(page, 'b4', 'predictAnswer').fill(String(MARKS_SQUARE[0]));
  await control(page, 'b4', 'predictCheck').click();
  await expect(out(page, 'b4', 'predictResult')).toHaveText(/^Right/);
  for (const label of [1, 2, 3, 4]) await expect(node(page, 'b4', label)).toHaveAttribute('data-can-act', 'true');
  // Beat 5: the T9 board and its step control wait for the answer too.
  await hydrate(page, 'b8');
  await expect(control(page, 'b8', 'step')).toBeDisabled();
  for (const label of [1, 2, 3, 4]) await expect(node(page, 'b8', label)).toHaveAttribute('data-can-act', 'false');
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M3 prose words: ${words}`);
  expect(words).toBeGreaterThanOrEqual(800);
  expect(words).toBeLessThanOrEqual(1800);
});

test('no em-dash in the built text', async ({ page }) => {
  const html = readFileSync(BUILT, 'utf8');
  expect(html.includes('—'), 'U+2014 in the built HTML').toBe(false);
  await page.goto(ROUTE);
  const text = await page.locator('main').innerText();
  expect(text.includes('—'), 'U+2014 in the text').toBe(false);
  expect(text.includes('–'), 'U+2013 in the text').toBe(false);
});

test('numbers-in-prose report lists only the allowed numbers', () => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const findings = scanSource(source, 'site/src/content/modules/m3-classification.mdx');
  // Both sections empty: every allowed number is in <Tex>, a prop or a brace string (decisions/P2-A9.md).
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
  expect(probed).toBeGreaterThan(15);
});

test('beat 1 counts on A3, D4, E6 and stops on the triangle', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  await expect(out(page, 'b1', 'verdictName')).toHaveAttribute('data-name', 'A3');
  await expect(out(page, 'b1', 'rootCount')).toHaveText(String(GOLDEN.types.A3!.n_roots));
  for (const t of ['D4', 'E6']) {
    await pick(page, 'b1', t);
    await expect(out(page, 'b1', 'verdictName')).toHaveAttribute('data-name', t);
    await expect(out(page, 'b1', 'rootCount')).toHaveText(String(GOLDEN.types[t]!.n_roots));
    await expect(out(page, 'b1', 'stopMessage')).toHaveCount(0);
  }
  await pick(page, 'b1', 'A2~');
  await expect(out(page, 'b1', 'stopMessage')).toHaveText(`stopped after ${TRIANGLE.layers} layers`);
  await expect(out(page, 'b1', 'rootCount')).toHaveText(String(TRIANGLE.root_populations_found));
  await pick(page, 'b1', 'D4~');
  await expect(out(page, 'b1', 'verdictName')).toHaveAttribute('data-name', 'D4~');
  await expect(out(page, 'b1', 'stopMessage')).toHaveText(`stopped after ${TRIANGLE.layers} layers`);
  // The words "not of finite type" never appear: only classify may say them, and it says affine.
  expect(norm(await page.locator('main').innerText())).not.toMatch(/not of finite type/i);
});

test('beat 2 verdicts', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b2');
  await expect(out(page, 'b2', 'verdictClass')).toHaveText('finite');
  expect(Number(await out(page, 'b2', 'spectralRadius').textContent())).toBeLessThan(2);
  for (const affine of ['A2~', 'D4~']) {
    await pick(page, 'b2', affine);
    await expect(out(page, 'b2', 'verdictClass')).toHaveText('affine');
    await expect(out(page, 'b2', 'spectralRadius')).toHaveText(SQUARE_RADIUS);
  }
  // T3 beside it: the first row is a single Martian on A3, form value 2, a root population.
  await hydrate(page, 'b3');
  await expect(out(page, 'b3', 'smallValue').first()).toHaveText('2');
  await expect(out(page, 'b3', 'smallVerdict').first()).toHaveText('root population');
});

test('beat 3 frozen populations', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id, marks] of [['b4', MARKS_SQUARE], ['b5', MARKS_STAR]] as const) {
    await hydrate(page, id);
    await expect(out(page, id, 'verdict')).toContainText('affine');
    await expect(out(page, id, 'moods')).toHaveText(/Every city is happy/);
    const buttons = tool(page, id).locator('[data-board-group] button[data-node]');
    await expect(buttons).toHaveCount(marks.length);
    for (const name of await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))) {
      expect(name, id).toMatch(/mutation would change nothing$/);
    }
    if (id === 'b4') {
      await control(page, id, 'predictAnswer').fill(String(marks[0]));
      await control(page, id, 'predictCheck').click();
    }
    const before = await values(page, id);
    expect(before).toEqual(marks.map(String));
    const first = Number(await buttons.first().getAttribute('data-node'));
    await node(page, id, first).click();
    await expect(tool(page, id)).toHaveAttribute('data-moves', '1');
    expect(await values(page, id)).toEqual(before);
  }
});

test('beat 4 runaway', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b6');
  expect(await values(page, 'b6')).toEqual(FROZEN_PLUS_ONE.map(String));
  await node(page, 'b6', 0).click();
  await expect(tool(page, 'b6')).toHaveAttribute('data-moves', '1');
  const once = await values(page, 'b6');
  expect(once).not.toEqual(FROZEN_PLUS_ONE.map(String));
  await node(page, 'b6', 2).click();
  await expect(tool(page, 'b6')).toHaveAttribute('data-moves', '2');
  expect(await values(page, 'b6')).not.toEqual(once);
  await hydrate(page, 'b7');
  await expect(out(page, 'b7', 'stopMessage')).toHaveText(`stopped after ${STAR.layers} layers`);
  await expect(out(page, 'b7', 'verdict')).toHaveText('affine');
  await expect(out(page, 'b7', 'found')).toHaveText(String(STAR.root_populations_found));
});

test('beat 5 Kostant on D4', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b8');
  expect(await values(page, 'b8')).toEqual(['1', '0', '0', '0']);
  const positive = KOSTANT_D4.final_numbers_from_node[0]!.findIndex((x) => x > 0);
  await control(page, 'b8', 'predictAnswer').nth(positive).check();
  await control(page, 'b8', 'predictCheck').click();
  await expect(out(page, 'b8', 'predictResult')).toHaveText(/^Right/);
  await control(page, 'b8', 'playToEnd').click();
  await expect(out(page, 'b8', 'moveCount')).toHaveText(String(KOSTANT_D4.moves_from_node[0]));
  expect(await values(page, 'b8')).toEqual(KOSTANT_D4.end_from_node[0]!.map(String));
  await expect(out(page, 'b8', 'finalNumbers')).toHaveText(KOSTANT_D4.final_numbers_from_node[0]!.map(minus).join(', '));
  await expect(out(page, 'b8', 'marked')).toHaveText(String(positive + 1));
  await expect(out(page, 'b8', 'affineBoard')).toHaveAttribute('data-name', KOSTANT_D4.affine_board_from_node[0]!);
  const href = await control(page, 'b8', 'openLab').getAttribute('href');
  expect(href ?? '').toMatch(/tools\/lab\?g=D4~$/);
});

test('beat 6 hunter on the one-way road', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b9');
  await expect(tool(page, 'b9').locator('[data-editor]')).toHaveAttribute('data-road-style', 'roads');
  await expect(out(page, 'b9', 'verdictClass')).toHaveText(ONE_WAY_SENTENCE);
  await expect(out(page, 'b9', 'spectralRadius')).toHaveCount(0);
  const h = out(page, 'b9', 'hunterResult');
  await expect(h).toHaveAttribute('data-population', ONE_WAY.result.join(','));
  await expect(h).toHaveAttribute('data-moves', String(ONE_WAY.moves.length));
  await expect(h).toHaveAttribute('data-word', ONE_WAY.moves.join(','));
});

test('anatomy', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('Finite, affine, wild');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('On which boards does the game close up?');
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
  expect(await statements.count()).toBeGreaterThanOrEqual(4);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation/.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  // The theorem of beat 2 is credited to W20 Theorems 4.1 and 8.8 in the box.
  expect(norm(await statements.first().textContent())).toContain('Theorems 4.1 and 8.8');
  await expect(statements.first().locator('a.cite')).toHaveCount(1);
  for (const key of ['W20', 'W03a', 'W-MS', 'DE08', 'Pro93', 'HHSV77', 'BrH']) await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`)).toHaveCount(1);
});

test('wrapped items', async ({ page }) => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const items = JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { items?: { id: string }[] } | { id: string }[];
  const known = new Set((Array.isArray(items) ? items : (items.items ?? [])).map((i) => i.id));
  // Every wrap names a known (or proposed) item and carries a fallback.
  const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
  expect(wraps.length).toBeGreaterThanOrEqual(2);
  for (const attrs of wraps) {
    const item = /\bitem="([^"]*)"/.exec(attrs)?.[1] ?? '';
    expect(item, attrs).toMatch(/^E\d+$/);
    expect(Number(item.slice(1)) <= 17 ? known.has(item) : PROPOSED_ITEMS.includes(item), `${item} is known or proposed`).toBe(true);
    expect((/\bfallback="([^"]*)"/.exec(attrs)?.[1] ?? '').trim(), `${item} fallback`).not.toBe('');
  }
  // Every cited key is in the frontmatter's sources.
  const front = /^---\n([\s\S]*?)\n---/.exec(source)![1]!;
  const sources = JSON.parse(/^sources:\s*(\[.*\])\s*$/m.exec(front)![1]!) as string[];
  for (const k of new Set([...source.matchAll(/<Cite k="([^"]+)"/g)].map((m) => m[1]!))) expect(sources, k).toContain(k);
  await page.goto(ROUTE);
  await expect(page.locator('[data-unverified="E4"]')).toHaveCount(1);
  await expect(page.locator('[data-unverified="E10"]')).toHaveCount(1);
  // Every sentence of the prose that names Kac or Smith lies inside the span of its item.
  const e4 = norm(await page.locator('[data-unverified="E4"]').textContent());
  const e10 = norm(await page.locator('[data-unverified="E10"]').textContent());
  expect(e4).toContain('Kac-Moody algebra');
  expect(e4).toMatch(/Kac['’]s theory/);
  expect(e10).toContain('J. H. Smith');
  const outside = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-unverified], [data-anatomy="sources"] ul, [data-tool], script, style')) el.remove();
    return copy.textContent ?? '';
  });
  expect(outside).not.toMatch(/\bKac\b|Kac's|Kac90/);
  expect(outside).not.toMatch(/\bSmith\b/);
  // Every open-item mark links to an item of the open-items page.
  const marks = page.locator('article a.unverified-mark');
  expect(await marks.count()).toBe(wraps.length);
  for (const href of await marks.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))) {
    const url = new URL(href, page.url());
    const listing = await page.request.get(url.toString().replace(/#.*$/, ''));
    expect(listing.status(), href).toBe(200);
    expect(await listing.text(), `${url.hash} on open-items`).toMatch(new RegExp(`id="${url.hash.slice(1)}"`));
  }
});

test('the A-D-E list is for simple graphs', async ({ page }) => {
  await page.goto(ROUTE);
  const sentences = await proseSentences(page);
  const listing = sentences.filter((s) => s.includes('A_n') && s.includes('D_n') && s.includes('E_8'));
  // Beat 2, beat 7 and the Seen box state the list; each says "simple graph".
  expect(listing.length).toBeGreaterThanOrEqual(3);
  for (const s of listing) expect(s, s).toMatch(/simple graph/);
  // The boards with multiple roads are named beside the list, so positive definiteness is not tied to A-D-E alone.
  const beat2 = (await proseSentences(page, '[data-beat="2"]')).join(' ');
  expect(beat2).toMatch(/B_n.*C_n.*F_4.*G_2.*positive definite/);
});

test('no forbidden statement', async ({ page }) => {
  await page.goto(ROUTE);
  const text = norm(await page.locator('main').innerText());
  for (const re of [/not of finite type/i, /\binfinite type\b/i, /mutates the (?:graph|board)/i, /hunter (?:proves|shows that)/i, /same list as Kac/i]) {
    expect(text, String(re)).not.toMatch(re);
  }
  // P8: no sentence of the prose names both a node and a city.
  const both = (await proseSentences(page)).filter((s) => /\bnodes?\b/i.test(s) && /\bcit(?:y|ies)\b/i.test(s));
  expect(both).toEqual([]);
  // Kostant's game is attributed to Kostant (8.4).
  expect(text).toContain('attributed to Kostant');
});

test('challenge: close the path A5 into a ring', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b10');
  await hydrate(page, 'b10');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await control(page, 'b10', 'addNode').click();
  await expect(out(page, 'b10', 'nodeCount')).toHaveText('6');
  // The new node 6 is the subject: one road each way to node 1, then to node 5.
  for (const end of ['1', '5']) {
    await control(page, 'b10', 'roadsOther').selectOption({ label: end });
    await control(page, 'b10', 'roadsOut').selectOption('1');
    if (end === '5') await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await control(page, 'b10', 'roadsBack').selectOption('1');
  }
  await expect(out(page, 'b10', 'verdictName')).toHaveAttribute('data-name', GOLDEN.affine.A5!.name);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: a board and a play with Martians and anti-Martians together', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  await expect(out(page, 'b11', 'hunterResult')).toHaveText(/^none among/);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Node 1 is the subject and node 2 the other end; take away the road from 2 back to 1.
  await control(page, 'b11', 'roadsBack').selectOption('0');
  await expect(out(page, 'b11', 'verdictClass')).toHaveText(ONE_WAY_SENTENCE);
  await expect(out(page, 'b11', 'hunterResult')).toHaveAttribute('data-population', ONE_WAY.result.join(','));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: the reverse one-way road is not this goal', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  // The road from 1 to 2 taken away instead: a mixed population exists, but not the play asked for.
  await control(page, 'b11', 'roadsOut').selectOption('0');
  await expect(out(page, 'b11', 'verdictClass')).toHaveText(ONE_WAY_SENTENCE);
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
});

test('challenge: reach the frozen population plus one Martian', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b12');
  await hydrate(page, 'b12');
  expect(await values(page, 'b12')).toEqual(['1', '0', '0', '0', '0']);
  // A play from one Martian in city 0 to the target, found by a breadth-first search (not golden).
  const word = [2, 0, 1, 3, 4, 2, 0];
  for (const [k, label] of word.entries()) {
    if (k > 0) await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await node(page, 'b12', label).click();
    await expect(tool(page, 'b12')).toHaveAttribute('data-moves', String(k + 1));
  }
  expect(await values(page, 'b12')).toEqual(FROZEN_PLUS_ONE.map(String));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: the affine board of E6 by the recipe', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b13');
  await hydrate(page, 'b13');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  const numbers = GOLDEN.types.E6!.numbers_of_highest_root;
  const city = numbers.findIndex((x) => x > 0) + 1;
  await control(page, 'b13', 'addNode').click();
  await control(page, 'b13', 'roadsOther').selectOption({ label: String(city) });
  await control(page, 'b13', 'roadsOut').selectOption('1');
  await control(page, 'b13', 'roadsBack').selectOption('1');
  await expect(out(page, 'b13', 'verdictName')).toHaveAttribute('data-name', GOLDEN.affine.E6!.name);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: a new city in the wrong place does not meet the E6 goal', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b13');
  await hydrate(page, 'b13');
  await control(page, 'b13', 'addNode').click();
  await control(page, 'b13', 'roadsOther').selectOption({ label: '1' });
  await control(page, 'b13', 'roadsOut').selectOption('1');
  await control(page, 'b13', 'roadsBack').selectOption('1');
  await expect(out(page, 'b13', 'verdictName')).not.toHaveAttribute('data-name', GOLDEN.affine.E6!.name);
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
});

test('open-problem link', async ({ page }) => {
  await page.goto(ROUTE);
  const link = page.locator('[data-beat="6"] a[data-open-problem-link]');
  await expect(link).toHaveCount(1);
  const href = (await link.getAttribute('href')) ?? '';
  expect(href).toMatch(/open-problem\/?$/);
  const target = new URL(href, page.url());
  expect(target.pathname.startsWith(new URL(page.url()).pathname.replace(/modules\/m3-classification\/$/, ''))).toBe(true);
  const response = await page.request.get(target.toString());
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('The Mutation Conjecture');
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  // Thirteen tools and four challenges.
  expect(islands.length).toBe(TOOLS.length + 4);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T04ClassificationLab/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id] of TOOLS) await hydrate(page, id);
  // The whole page is scanned, T2's layer chart on b7 included (it is focusable since stage 2.2).
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Regressions (RT-FIX, red team round 1). Each test is a lens reproducer adopted here; where a
// finding also names another lesson, only the M3 part is adopted (the other parts are other fixes).
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // Adopted from site/tests/unit/redteam-RT-09-01-m3-numbers-game-ends.test.ts (lens RT-09). The
  // reproducer held the page's sentence against the engine on the pentagon; here the engine's
  // pentagon game is the counterexample, and the sentence must carry the hypotheses of [DE08]
  // Theorem 2.1 that exclude it (SOURCES.md [DE08]: "a connected integer-weighted graph has a
  // terminating game from some nonzero dominant start exactly when it is a Dynkin diagram of finite
  // type"; a dominant start has no negative number, SPEC 2.9 row [DE08], Appendix C).
  // regression: P3-RT-09-01
  test("M3 beat 7 quotes Donnelly and Eriksson's theorem with its hypothesis", async ({ page }) => {
    // oracle: play_fate(board_from_name('A4~')[0], (1,-2,3,-4,1)) ends after 14 moves (golden pentagon_example).
    const pentagon = boardFromName('pentagon') as Board<unknown>;
    const record = classify(pentagon);
    expect(record.length, 'the pentagon is one connected component').toBe(1);
    expect(record[0]!.class).toBe('affine');
    const start = GOLDEN.pentagon_example.start;
    expect(start).toEqual([1, -2, 3, -4, 1]);
    const r = play(pentagon, start.map((x) => pentagon.arith.fromInt(x)));
    expect(r.status).toBe('ended');
    expect(r.moves).toBe(GOLDEN.pentagon_example.moves);
    // A game from all zeros ends at once on every board, the pentagon included.
    const zero = play(pentagon, start.map(() => pentagon.arith.fromInt(0)));
    expect(zero.status).toBe('ended');
    expect(zero.moves).toBe(0);
    // So the sentence must exclude a start with a negative number and the start of all zeros, and
    // speak of boards with roads both ways, as [DE08] does.
    expect(start.some((x) => x < 0), 'the counterexample start has a negative number').toBe(true);
    const source = readFileSync(LESSON_PATH, 'utf8');
    const beat7 = /<Beat n=\{7\}>([\s\S]*?)<\/Beat>/.exec(source)![1]!;
    const quoted = beat7.split(/(?<=\.)\s+/).filter((s) => s.includes('<Cite k="DE08"/>'));
    expect(quoted.length, 'beat 7 cites [DE08]').toBe(1);
    const sentence = quoted[0]!;
    expect(sentence, 'M3 beat 7 must not quote [DE08] with "a suitable start"').not.toMatch(/suitable start/);
    expect(sentence, `M3 beat 7: "${sentence}" must name a start with no negative number`).toMatch(/no negative number/);
    expect(sentence, `M3 beat 7: "${sentence}" must exclude the start of all zeros`).toMatch(/not all zeros/);
    expect(sentence, `M3 beat 7: "${sentence}" must speak of boards with roads both ways`).toMatch(/connected board with roads both ways/);
    expect(sentence).toMatch(/finite type/);
    // The built page prints the same hypotheses.
    await page.goto(ROUTE);
    const printed = (await proseSentences(page, '[data-beat="7"]')).filter((s) => s.includes('Donnelly and Eriksson'));
    expect(printed.length).toBe(1);
    expect(printed[0]).toMatch(/connected board with roads both ways .*no negative number and is not all zeros/);
  });

  // Adopted from site/tests/unit/redteam-RT-08-computation-range.test.ts (lens RT-08), M3 part (the
  // open-problem page and M1 are other fixes).
  // regression: P3-RT-08-01
  test('"verified by computation" is never stated over every board of finite type without a range', () => {
    // The check behind Kostant's game and its affine recipe (golden key kostant) covers the named types
    // of rank at most 8.
    const kostant = Object.keys(GOLDEN.kostant);
    expect(kostant.length).toBe(32);
    expect(kostant).not.toContain('A9');
    const source = readFileSync(LESSON_PATH, 'utf8');
    // "verified by computation" followed by "every board" or "every such board" with no rank,
    // group-size or named-board limit.
    const OVERCLAIM = /verified by computation (for|on) every (such )?board(?! of finite type of rank)(?! whose group)(?! of rank)(?! the site offers)[^.;'`]*/g;
    const hits = [...source.matchAll(OVERCLAIM)].map((m) => m[0]);
    expect(hits, 'm3-classification.mdx claims a computation on every board').toEqual([]);
    // Beat 5: the recipe sentence does not claim every board of finite type.
    expect(source).not.toMatch(/from every board of finite type and every starting city, as verified by computation/);
    // The E4 fallback: the computed check is not stated for every board of finite type.
    expect(source, 'm3 E4 fallback').not.toMatch(/that the script checking this site has tried, no root population mixes Martians and anti-Martians: every board of finite type,/);
    const e4 = /<Unverified item="E4" fallback="([^"]*)"/.exec(source)?.[1] ?? '';
    expect(e4, 'the E4 fallback names the range of the finite types checked').toMatch(/every board of finite type of rank at most 8/);
    // Beat 5: every clause that gives a provenance by computation states the range checked.
    const beat5 = /<Beat n=\{5\}>([\s\S]*?)<\/Beat>/.exec(source)![1]!;
    const clauses = beat5.split(/(?<=[.;])\s+/).filter((s) => /verified by computation/.test(s));
    expect(clauses.length).toBeGreaterThan(0);
    for (const clause of clauses) {
      expect(clause, `M3 beat 5 prints "${clause}"; the checks cover rank at most 8`).toMatch(/rank at most/);
      expect(clause).toMatch(/every starting city/);
    }
  });

  // Adopted from site/tests/unit/redteam-RT-09-07-kostant-range.test.ts (lens RT-09), M3 part.
  // regression: P3-RT-09-07
  test("M3 states the range of the Kostant's game checks as checked", () => {
    const ranks = Object.keys(GOLDEN.kostant).map((t) => GOLDEN.types[t]!.cartan.length);
    expect(Object.keys(GOLDEN.kostant).length).toBe(32);
    expect(Math.max(...ranks)).toBe(8);
    // SEEN_KOSTANT, the provenance of the Kostant recipe in the Seen box.
    const value = /export const SEEN_KOSTANT = '([^']*)'/.exec(readFileSync(LESSON_PATH, 'utf8'))?.[1] ?? '';
    expect(value).toMatch(/^verified by computation/);
    expect(value, `m3-classification.mdx prints "${value}"; the checks cover the types of rank at most 8 (SPEC 2.7, golden kostant)`).toMatch(/rank at most/);
    expect(value).toMatch(/every starting city/);
  });

  // Adopted from site/tests/unit/redteam-RT-09-03-lie-theory-kostant.test.ts (lens RT-09), M3 part.
  // The reproducer held the page's sentence against the engine on B3; here the engine's B3 play is
  // the counterexample, and the sentence must carry the hypotheses of F13 that exclude it.
  // regression: P3-RT-09-03
  test("the Lie theory paragraph states Kostant's game with the hypotheses of F13", () => {
    // oracle: kostant_play(cartan('B',3), 2) ends at (1,1,1); highest_root(cartan('B',3)) is (1,2,2);
    // golden kostant.B3.affine_board_from_node[2] is D4^(2), a twisted board (SPEC 2.7 F13, 2.12).
    const B3 = boardFromName('B3') as Board<unknown>;
    const r = kostantPlay(B3, 2); // from one Martian in city 3, the short node
    const end = r.position.map((x) => Number(B3.arith.toBig(x)));
    const theta = highestRoot(B3).map((x) => Number(B3.arith.toBig(x)));
    expect(theta).toEqual([1, 2, 2]);
    expect(end).toEqual(GOLDEN.kostant.B3!.end_from_node[2]);
    expect(end, 'on B3 from city 3 the play ends at the highest short root, not at theta').not.toEqual(theta);
    expect(GOLDEN.kostant.B3!.affine_board_from_node[2]).toBe('D4^(2)');
    const lie = /<LieTheory>([\s\S]*?)<\/LieTheory>/.exec(readFileSync(LESSON_PATH, 'utf8'))?.[1] ?? '';
    const sentences = lie.split(/(?<=\.)\s+/).filter((s) => /Kostant's game/.test(s));
    expect(sentences.length, "the Lie theory paragraph names Kostant's game").toBeGreaterThan(0);
    for (const s of sentences) {
      expect(s, `M3 Lie theory: "${s}" (SPEC 2.7 F13: the highest root on simply laced boards of finite type)`).toMatch(/simply laced/);
      expect(s).toMatch(/finite type/);
    }
  });

  // Adopted from site/tests/unit/redteam-RT-08-fallback-weaker.test.ts (lens RT-08, attack 15). SPEC
  // 7.3: "A fallback is a weaker sentence that stays true however the item turns out". Of [BrH] only
  // the section title and page were read (SOURCES.md 11.5), so the E10 fallback may say nothing about
  // what the book contains.
  // regression: P3-RT-08-07
  test('the E10 fallback does not assert what the unread book contains', () => {
    const SOURCES = readFileSync(fileURLToPath(new URL('../../../SOURCES.md', import.meta.url)), 'utf8');
    expect(SOURCES).toMatch(/\*\*\[BrH\]\*\*[^\n]*\[S, section title and page\]\. The underlying theorem is due to J\. H\. Smith \(1970\); that citation is \[U\]\./);
    const fb = (readFileSync(LESSON_PATH, 'utf8').match(/<Unverified item="E10" fallback="([^"]*)"/) ?? [])[1] ?? '';
    expect(fb.trim(), 'E10 has a fallback').not.toBe('');
    // Observed at 69546f0: "their book names the original source of that list, which this site has not yet checked."
    expect(fb).not.toMatch(/book names the original source/);
    // Nor any other statement about the book or its authors.
    expect(fb).not.toMatch(/\bbook\b|\btheir\b|Brouwer|Haemers/i);
  });
});
