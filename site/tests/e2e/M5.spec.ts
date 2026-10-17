// P3-A9: lesson M5, "The Weyl group inside the games", against the built site (SPEC.md 3 M5, 2.6, 2.7
// F4 to F9 and F12, 8.2, 8.4, 8.5, 9.2, 4.0, 7.3, 7.4, 7.6; build-plan/agents/P3-A9-lesson-m5.md 5.15).
// Run after `npm run build` against `astro preview`, one Playwright run at a time. The helpers follow
// M0.spec.ts and M3.spec.ts. Every expected number with a golden value is read from
// reference/golden_data.json; numbers with no golden key (positions along a play, the tapes of the
// dimension calculator, the size of a heap of a partial play) are computed here with the engine.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("board", "weyl", "symbolic", "numbers"), data-instance
//     (b1 to b15), data-moves, data-hydrated="true"; data-out caption, noscript
//   node buttons (P0-A5 Board): data-node, data-board ("numbers"), data-value, data-can-act
//   T1, registry site/src/tools/registry/T01.ts (T01_OUTS): caption, noscript, predictResult;
//     data-control predictAnswer, predictCheck, predictShow (Predict)
//   T8, registry site/src/tools/registry/T08.ts (T08_OUTS): vertex (data-position, data-layer,
//     data-on-path), vertexWord (data-word), separatingRoots (children data-root), gameCount, brick
//     (data-node, data-level), heapCount, groupOrder, linkStatus (data-linked); data-control picker,
//     loadPlay (data-play)
//   T7, registry site/src/tools/registry/T07.ts (T07_OUTS): rootTable, rootRow (data-root, data-used)
//   T5, registry site/src/tools/registry/T05.ts (T05_OUTS): exponents, exponentProduct, groupOrder,
//     gameOver, waveRounds, coxeterNumber, tapeRho, tapeLambdaRho, dimension, predictResult;
//     data-control step, playToEnd, lambda (data-lambda-node), predictAnswer, predictCheck, predictShow
//   Predict (P1-A5 Predict.svelte): data-prediction, .question, details, .answer-text
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title,
//     question, draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance;
//     data-challenge, data-met, data-challenge-result (text "Goal reached."); data-source;
//     data-unverified and a.unverified-mark (P0-A4 Unverified)
//   this lesson's own markup: data-seen-statement, data-seen-scope
//   the figure of each tool root (role figure; its aria-label is the text alternative of A-10, which
//     names the board the figure opens on), read by the regressions at the end of this file
//
// No linked view (both boards of T1 at once) is placed on this page, so the bridge sentence of 2.4(a)
// has no test here (instruction 5.15 item 14).
//
// Word-counting rule (as M0.spec.ts and M3.spec.ts): the words of the <article> after removing every
// tool root ([data-tool]), every <details>, every live or status region, the draft mark and the list
// of sources entries; each KaTeX formula counts as one word; a word is a run of non-space characters.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { boardFromName, commutationClassSize, fire, fromAdjacency, heapKey, play, symbolicPlay, toPositions } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';
import { distDir } from './routes';

const ROUTE = 'modules/m5-weyl/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m5-weyl.mdx', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m5-weyl/index.html`;

/** New items of Appendix E proposed by this lesson (equal to proposedUnverifiedItems of the report). */
const PROPOSED_ITEMS: string[] = [];

type Kind = 'board' | 'weyl' | 'symbolic' | 'numbers';
/** The tool instances of the eight beats and the four challenges, in reading order. */
const TOOLS: [string, Kind][] = [
  ['b1', 'board'],
  ['b2', 'weyl'],
  ['b3', 'weyl'],
  ['b4', 'weyl'],
  ['b5', 'weyl'],
  ['b6', 'symbolic'],
  ['b7', 'numbers'],
  ['b8', 'numbers'],
  ['b9', 'numbers'],
  ['b10', 'numbers'],
  ['b11', 'numbers'],
  ['b12', 'board'],
  ['b13', 'weyl'],
  ['b14', 'numbers'],
  ['b15', 'numbers'],
];
const BEAT_OF: Record<string, number> = { b1: 1, b2: 1, b3: 2, b4: 3, b5: 4, b6: 5, b7: 6, b8: 6, b9: 7, b10: 7, b11: 8 };
const COUNTER_BOARDS = ['A2', 'A3', 'A4', 'B3', 'D4'];
/** The board of the tally challenge b15: one with single roads, since multiple roads arrive in M6 (SPEC 8.1 P4). */
const TALLY_BOARD = 'D4';

interface TypeRecord {
  weyl_order: number;
  n_positive_roots: number;
  longest_word: number[];
  fired_tally: Record<string, number>;
  exponents: number[];
  coxeter_number: number;
  length_distribution?: number[];
  n_reduced_words_w0?: number;
  positive_roots: number[][];
}
interface Golden {
  types: Record<string, TypeRecord>;
  heaps: Record<string, { complete_games: number; distinct_heaps: number; games_per_heap: number[] }>;
  weyl_dimension: { type: string; highest_weight: number[]; dimension: number }[];
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const T = (name: string): TypeRecord => GOLDEN.types[name]!;
/** The value at a dotted golden path of plain keys (site/src/lib/golden.ts imports the JSON without the
 * import attribute Playwright's loader needs, so the regressions walk the parsed file here). */
const goldenAt = (path: string): unknown => path.split('.').reduce<unknown>((v, key) => (v as Record<string, unknown>)[key], GOLDEN);
const dimensionOf = (type: string, hw: number[]): number => GOLDEN.weyl_dimension.find((r) => r.type === type && r.highest_weight.join(',') === hw.join(','))!.dimension;

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
const digits = (s: string | null): string => (s ?? '').replace(/[^\d,-]/g, '').replace(/−/g, '-');

/** The numbers of a T1 or T5 board, in label order, as data-value text with ASCII minus signs. */
async function values(page: Page, id: string): Promise<string[]> {
  return tool(page, id)
    .locator('button[data-board="numbers"][data-node]')
    .evaluateAll((els) =>
      els
        .map((e) => [Number(e.getAttribute('data-node')), (e.getAttribute('data-value') ?? '').replace(/−/g, '-')] as const)
        .sort((a, b) => a[0] - b[0])
        .map((p) => p[1]),
    );
}

/** Scrolls a tool into view (client:visible) and waits for hydration. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true');
}

/** Clicks the nodes of a play, one by one, waiting for each move to register. */
async function playWord(page: Page, id: string, word: readonly number[]): Promise<void> {
  const before = Number(await tool(page, id).getAttribute('data-moves'));
  for (const [k, label] of word.entries()) {
    await node(page, id, label).click();
    await expect(tool(page, id)).toHaveAttribute('data-moves', String(before + k + 1));
  }
}

/** The positions along a play from all ones (engine), in label order as comma-joined text. */
function positionsAlong(boardName: string, word: readonly number[]): string[] {
  const board = boardFromName(boardName) as Board<number>;
  const labels = [...board.labels].sort((a, b) => a - b);
  const order = toPositions(board, labels);
  let a = board.labels.map(() => 1);
  const show = (v: number[]): string => order.map((p) => String(v[p])).join(',');
  const outList = [show(a)];
  for (const label of word) {
    a = fire(board, a, toPositions(board, [label])[0]!);
    outList.push(show(a));
  }
  return outList;
}

/** The numbers fired along a word from a start given in label order (engine). */
function tapeAlong(boardName: string, start: number[], word: readonly number[]): number[] {
  const board = boardFromName(boardName) as Board<number>;
  const order = toPositions(board, [...board.labels].sort((a, b) => a - b));
  let a: number[] = board.labels.map(() => 0);
  order.forEach((p, k) => (a[p] = start[k]!));
  const tape: number[] = [];
  for (const label of word) {
    const p = toPositions(board, [label])[0]!;
    tape.push(a[p]!);
    a = fire(board, a, p);
  }
  return tape;
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

/** The prose text of a part of the page, with tools and live regions removed. */
async function proseText(page: Page, scope: string): Promise<string> {
  return page.locator(scope).first().evaluate((root) => {
    const copy = root.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-tool], [role="status"], [aria-live], script, style, noscript')) el.remove();
    return copy.textContent ?? '';
  });
}

// ---------------------------------------------------------------------------------------------
// Without JavaScript
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the eight figures are present', async ({ page }) => {
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
    // Beats 1 and 2: the A3 graph of every position, in its layers.
    for (const id of ['b2', 'b3']) {
      await expect(out(page, id, 'groupOrder'), id).toHaveText(String(T('A3').weyl_order));
      await expect(out(page, id, 'vertex'), id).toHaveCount(T('A3').weyl_order);
      const layers = await out(page, id, 'layerSizes').locator('[data-layer]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-count'))));
      expect(layers, id).toEqual(T('A3').length_distribution);
    }
    // Beat 1: at build time islands cannot talk, so the linked explorer shows no board and no path.
    await expect(tool(page, 'b2').locator('button[data-node]')).toHaveCount(0);
    await expect(tool(page, 'b2').locator('[data-out="vertex"][data-on-path="true"]')).toHaveCount(1);
    // Beat 3: the counter on A3.
    await expect(out(page, 'b4', 'gameCount')).toHaveText(String(T('A3').n_reduced_words_w0));
    // Beat 5: the finished symbolic game, every root used.
    await expect(out(page, 'b6', 'rootRow')).toHaveCount(T('A3').n_positive_roots);
    await expect(tool(page, 'b6').locator('[data-out="rootRow"][data-used="true"]')).toHaveCount(T('A3').n_positive_roots);
    // Beat 8: the dimension of the adjoint representation of A2.
    await expect(out(page, 'b11', 'dimension')).toHaveText(String(dimensionOf('A2', [1, 1])));
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('every prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    const expected: Record<string, string> = {
      b1: String(T('A3').n_positive_roots),
      b9: String(T('A3').coxeter_number),
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
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  for (const label of [1, 2, 3]) await expect(node(page, 'b1', label)).toHaveAttribute('data-can-act', 'false');
  await node(page, 'b1', 1).click({ force: true });
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '0');
  await control(page, 'b1', 'predictAnswer').fill(String(T('A3').n_positive_roots));
  await control(page, 'b1', 'predictCheck').click();
  await expect(out(page, 'b1', 'predictResult')).toHaveText(/^Right/);
  for (const label of [1, 2, 3]) await expect(node(page, 'b1', label)).toHaveAttribute('data-can-act', 'true');
  // Beat 7: the wave waits for its answer too.
  await hydrate(page, 'b9');
  await expect(control(page, 'b9', 'playToEnd')).toBeDisabled();
  await expect(control(page, 'b9', 'step')).toBeDisabled();
  for (const label of [1, 2, 3]) await expect(node(page, 'b9', label)).toHaveAttribute('data-can-act', 'false');
  await control(page, 'b9', 'predictShow').click();
  await expect(control(page, 'b9', 'playToEnd')).toBeEnabled();
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M5 prose words: ${words}`);
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

test('numbers-in-prose report lists only the typed numbers', () => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const findings = scanSource(source, 'site/src/content/modules/m5-weyl.mdx');
  // Both sections empty: every typed number is in <Tex>, a prop or a brace string (decisions/P3-A9.md).
  expect(findings.filter((f) => f.kind === 'prose')).toEqual([]);
  expect(findings.filter((f) => f.kind === 'formula')).toEqual([]);
  // The E8 order and its largest exponent are never typed as digits in the lesson.
  expect(source.includes(String(T('E8').weyl_order))).toBe(false);
  expect(source).not.toMatch(new RegExp(`(?<![\\w.])${T('E8').exponents[7]}(?![\\w])`));
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

test('T1 drives T8', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  await control(page, 'b1', 'predictShow').click();
  const word = [1, 3, 2];
  await playWord(page, 'b1', word);
  await hydrate(page, 'b2');
  // T8 follows the board: no board of its own, the path through the four positions of the play.
  await expect(tool(page, 'b2').locator('button[data-node]')).toHaveCount(0);
  await expect(out(page, 'b2', 'linkStatus')).toHaveAttribute('data-linked', 'true');
  const onPath = tool(page, 'b2').locator('[data-out="vertex"][data-on-path="true"]');
  await expect(onPath).toHaveCount(word.length + 1);
  const along = positionsAlong('A3', word);
  expect((await onPath.evaluateAll((els) => els.map((e) => e.getAttribute('data-position') ?? ''))).sort()).toEqual([...along].sort());
  expect(await values(page, 'b1')).toEqual(along[along.length - 1]!.split(','));
  await expect(tool(page, 'b2')).toHaveAttribute('data-moves', String(word.length));
  // Focusing the last vertex of the path shows the word of the play.
  const last = tool(page, 'b2').locator(`[data-out="vertex"][data-position="${along[along.length - 1]}"]`);
  await last.focus();
  await expect(out(page, 'b2', 'vertexWord')).toHaveAttribute('data-word', word.join(','));
  // One more move on the board extends the path.
  await node(page, 'b1', 1).click();
  await expect(onPath).toHaveCount(word.length + 2);
});

test('hovering a vertex shows a shortest word and the separating mirrors', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b3');
  const target = positionsAlong('A3', [1, 3, 2])[3]!;
  const vertex = out(page, 'b3', 'vertex').and(page.locator(`[data-position="${target}"]`));
  await expect(vertex).toHaveCount(1);
  await expect(vertex).toHaveAttribute('data-layer', '3');
  await vertex.focus();
  const w = (await out(page, 'b3', 'vertexWord').getAttribute('data-word')) ?? '';
  expect(w.split(',').length).toBe(3);
  // The word reaches the position (engine replay).
  expect(positionsAlong('A3', w.split(',').map(Number))[3]).toBe(target);
  const roots = await out(page, 'b3', 'separatingRoots').locator('[data-root]').evaluateAll((els) => els.map((e) => e.getAttribute('data-root')));
  const R = T('A3').positive_roots;
  expect(roots).toEqual([R[1]!, R[3]!, R[4]!].map((r) => r.join(',')));
  // Hovering works too.
  const top = out(page, 'b3', 'vertex').and(page.locator('[data-layer="0"]'));
  await top.hover();
  await expect(out(page, 'b3', 'separatingRoots').locator('[data-root]')).toHaveCount(0);
});

test('the counter shows the five counts', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b4');
  const options = await control(page, 'b4', 'picker').locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(options).toEqual(COUNTER_BOARDS);
  await expect(out(page, 'b4', 'gameCount')).toHaveText(String(T('A3').n_reduced_words_w0));
  for (const name of COUNTER_BOARDS) {
    await control(page, 'b4', 'picker').selectOption(name);
    await expect(out(page, 'b4', 'gameCount'), name).toHaveText(String(T(name).n_reduced_words_w0));
  }
  const beat3 = plain(await proseText(page, '[data-beat="3"]'));
  for (const name of COUNTER_BOARDS) expect(beat3, name).toContain(String(T(name).n_reduced_words_w0));
});

test('the heap view: 1,3,2 and 3,1,2 give the same stack', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b5');
  const bricks = async (): Promise<string[]> =>
    (await out(page, 'b5', 'brick').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-node')}@${e.getAttribute('data-level')}`))).sort();
  const A3 = boardFromName('A3') as Board<number>;
  const p = (w: number[]): number[] => toPositions(A3, w);
  expect(heapKey(A3, p([1, 3, 2]))).toBe(heapKey(A3, p([3, 1, 2])));
  const size = String(commutationClassSize(A3, p([1, 3, 2])));
  await control(page, 'b5', 'loadPlay').and(page.locator('[data-play="1,3,2"]')).click();
  await expect(tool(page, 'b5')).toHaveAttribute('data-moves', '3');
  await expect(out(page, 'b5', 'heapCount')).toHaveText(size);
  const first = await bricks();
  expect(first).toHaveLength(3);
  await control(page, 'b5', 'loadPlay').and(page.locator('[data-play="3,1,2"]')).click();
  await expect(out(page, 'b5', 'heapCount')).toHaveText(size);
  expect(await bricks()).toEqual(first);
  const beat4 = plain(await proseText(page, '[data-beat="4"]'));
  expect(beat4).toContain(`${GOLDEN.heaps.A3!.complete_games} complete games`);
  expect(beat4).toContain(`${GOLDEN.heaps.A3!.distinct_heaps} different heaps`);
  expect(beat4).toContain('frame');
});

test('T7 on A3 fires one form per positive root', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b6');
  await expect(tool(page, 'b6')).toHaveAttribute('data-moves', String(T('A3').longest_word.length));
  const rows = out(page, 'b6', 'rootRow');
  await expect(rows).toHaveCount(T('A3').n_positive_roots);
  const read = await rows.evaluateAll((els) => els.map((e) => [e.getAttribute('data-root'), e.getAttribute('data-used')]));
  for (const [, used] of read) expect(used).toBe('true');
  expect(read.map(([r]) => r).sort()).toEqual(T('A3').positive_roots.map((r) => r.join(',')).sort());
});

test('the tally: A3 by hand and E8 to the end', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b7');
  await expect(out(page, 'b7', 'exponents')).toHaveCount(0);
  await playWord(page, 'b7', T('A3').longest_word);
  await expect(out(page, 'b7', 'exponents')).toHaveText(T('A3').exponents.join(', '));
  await expect(out(page, 'b7', 'groupOrder')).toHaveText(String(T('A3').weyl_order));
  await hydrate(page, 'b8');
  await control(page, 'b8', 'playToEnd').click();
  await expect(tool(page, 'b8')).toHaveAttribute('data-moves', String(T('E8').n_positive_roots));
  await expect(out(page, 'b8', 'exponents')).toHaveText(T('E8').exponents.join(', '));
  expect(digits(await out(page, 'b8', 'exponentProduct').textContent()).replace(/,/g, '')).toBe(String(T('E8').weyl_order));
  expect(digits(await out(page, 'b8', 'groupOrder').textContent()).replace(/,/g, '')).toBe(String(T('E8').weyl_order));
  // The prose states the E8 tally, the exponents and the order through <G>.
  const beat6 = plain(await proseText(page, '[data-beat="6"]'));
  expect(beat6).toContain(T('E8').exponents.join(', '));
  expect(beat6).toContain(`that is, ${T('E8').weyl_order}`);
  expect(beat6).toContain(`fired ${T('E8').fired_tally['1']} times and the value ${T('E8').exponents[7]} ${T('E8').fired_tally['29']} time`);
  expect(beat6).toContain('heights of coroots');
});

test('the wave takes h rounds', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id, name] of [['b9', 'A3'], ['b10', 'E8']] as const) {
    await hydrate(page, id);
    if (id === 'b9') await control(page, id, 'predictShow').click();
    await expect(out(page, id, 'coxeterNumber')).toHaveText(String(T(name).coxeter_number));
    await expect(out(page, id, 'waveRounds')).toHaveText('0');
    await control(page, id, 'playToEnd').click();
    await expect(tool(page, id)).toHaveAttribute('data-moves', String(T(name).n_positive_roots));
    await expect(out(page, id, 'waveRounds'), name).toHaveText(String(T(name).coxeter_number));
  }
  const beat7 = plain(await proseText(page, '[data-beat="7"]'));
  expect(beat7).toContain(`${T('A3').coxeter_number} rounds and ${T('A3').n_positive_roots} moves`);
  expect(beat7).toContain(`takes ${T('E8').coxeter_number} rounds`);
});

test('the dimension calculator gives 8', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b11');
  await expect(out(page, 'b11', 'dimension')).toHaveText(String(dimensionOf('A2', [1, 1])));
  const word = T('A2').longest_word;
  expect(digits(await out(page, 'b11', 'tapeRho').textContent())).toBe(tapeAlong('A2', [1, 1], word).join(','));
  expect(digits(await out(page, 'b11', 'tapeLambdaRho').textContent())).toBe(tapeAlong('A2', [2, 2], word).join(','));
  expect(plain(await proseText(page, '[data-beat="8"]'))).toContain(`The quotient is ${dimensionOf('A2', [1, 1])}`);
});

test('anatomy', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('The Weyl group inside the games');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('What is being counted when a game always lasts the same number of moves?');
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
  const ids = await page.locator('[data-tool]').evaluateAll((els) => els.map((e) => e.getAttribute('data-instance')));
  expect(ids).toEqual(TOOLS.map(([id]) => id));
  // "What we have seen" carries its provenance, and so does each of its statements.
  const seen = article.locator('[data-anatomy="seen"]');
  expect(await seen.locator('[data-provenance]').count()).toBeGreaterThanOrEqual(1);
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBeGreaterThanOrEqual(6);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation/.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  // The links block offers the sandbox with A3 (the module's board).
  const sandbox = article.locator('[data-anatomy="links"] a[data-link="sandbox"]');
  if ((await sandbox.count()) > 0) expect((await sandbox.getAttribute('href')) ?? '').toMatch(/g=A3$/);
  const source = readFileSync(LESSON_PATH, 'utf8');
  const front = /^---\n([\s\S]*?)\n---/.exec(source)![1]!;
  const keys = JSON.parse(/^sources:\s*(\[.*\])\s*$/m.exec(front)![1]!) as string[];
  for (const key of keys) await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`), key).toHaveCount(1);
  for (const k of new Set([...source.matchAll(/<Cite k="([^"]+)"/g)].map((m) => m[1]!))) expect(keys, k).toContain(k);
});

test('unverified wraps', async ({ page }) => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const items = JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { items?: { id: string }[] } | { id: string }[];
  const known = new Set((Array.isArray(items) ? items : (items.items ?? [])).map((i) => i.id));
  const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
  expect(wraps.length).toBeGreaterThanOrEqual(2);
  for (const attrs of wraps) {
    const item = /\bitem="([^"]*)"/.exec(attrs)?.[1] ?? '';
    expect(item, attrs).toMatch(/^E\d+$/);
    expect(Number(item.slice(1)) <= 17 ? known.has(item) : PROPOSED_ITEMS.includes(item), `${item} is known or proposed`).toBe(true);
    expect((/\bfallback="([^"]*)"/.exec(attrs)?.[1] ?? '').trim(), `${item} fallback`).not.toBe('');
  }
  await page.goto(ROUTE);
  await expect(page.locator('[data-unverified="E3"]')).toHaveCount(1);
  await expect(page.locator('[data-unverified="E16"]')).toHaveCount(1);
  const e3 = norm(await page.locator('[data-unverified="E3"]').textContent());
  const e16 = norm(await page.locator('[data-unverified="E16"]').textContent());
  expect(e3).toContain('4.3.1');
  expect(e16).toContain('Stanley');
  // Outside the wraps, no sentence names the theorem number or Stanley.
  const outside = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const el of copy.querySelectorAll('[data-unverified], [data-anatomy="sources"] ul, [data-tool], script, style')) el.remove();
    return copy.textContent ?? '';
  });
  expect(outside).not.toContain('4.3.1');
  expect(outside).not.toMatch(/\bStanley\b/);
  // Every open-item mark links to its item on the open-items page.
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

test('wording: heights of coroots, node not city, the board never changes', async ({ page }) => {
  await page.goto(ROUTE);
  const text = norm(await proseText(page, 'article'));
  expect(text).toContain('heights of coroots');
  expect(text).not.toMatch(/heights of (?:the )?(?:positive )?roots/i);
  // P8: this is a numbers-game module, so it says node, never city.
  expect(text).not.toMatch(/\bcit(?:y|ies)\b/i);
  // F6: "one form for each positive root" only with the reversed board named.
  expect(text).toContain('reversed board');
});

test('challenge: reach (-2, 1, -2) by legal play', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b12');
  await hydrate(page, 'b12');
  const word = [1, 3, 2, 1, 3];
  const along = positionsAlong('A3', word);
  for (const [k, label] of word.entries()) {
    await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await node(page, 'b12', label).click();
    await expect(tool(page, 'b12')).toHaveAttribute('data-moves', String(k + 1));
  }
  expect(await values(page, 'b12')).toEqual(along[along.length - 1]!.split(','));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: a heap shared by four plays', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b13');
  await hydrate(page, 'b13');
  await expect(tool(page, 'b13')).toHaveAttribute('data-moves', '0');
  const target = String(Math.max(...GOLDEN.heaps.A3!.games_per_heap));
  const A3 = boardFromName('A3') as Board<number>;
  const word = [1, 3, 2, 1, 3];
  for (const [k, label] of word.entries()) {
    await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await node(page, 'b13', label).click();
    await expect(tool(page, 'b13')).toHaveAttribute('data-moves', String(k + 1));
    await expect(out(page, 'b13', 'heapCount')).toHaveText(String(commutationClassSize(A3, toPositions(A3, word.slice(0, k + 1)))));
  }
  await expect(out(page, 'b13', 'heapCount')).toHaveText(target);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: a heap of two plays does not meet the four-play goal', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b13');
  await hydrate(page, 'b13');
  await playWord(page, 'b13', [1, 3, 2, 1]);
  await expect(out(page, 'b13', 'heapCount')).not.toHaveText(String(Math.max(...GOLDEN.heaps.A3!.games_per_heap)));
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
});

test('challenge: a lambda of dimension 10 on A2', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b14');
  await hydrate(page, 'b14');
  await expect(out(page, 'b14', 'dimension')).toHaveText(String(dimensionOf('A2', [1, 1])));
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  const field = (label: number): Locator => control(page, 'b14', 'lambda').and(page.locator(`[data-lambda-node="${label}"]`));
  // (2, 0) has another dimension: not yet.
  await field(1).fill('2');
  await field(2).fill('0');
  await expect(out(page, 'b14', 'dimension')).toHaveText(String(dimensionOf('A2', [2, 0])));
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await field(1).fill('3');
  await expect(out(page, 'b14', 'dimension')).toHaveText(String(dimensionOf('A2', [3, 0])));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test(`challenge: the exponents of ${TALLY_BOARD}`, async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b15');
  await hydrate(page, 'b15');
  const n = T(TALLY_BOARD).n_positive_roots;
  await playWord(page, 'b15', T(TALLY_BOARD).longest_word.slice(0, n - 1));
  await expect(out(page, 'b15', 'exponents')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await control(page, 'b15', 'step').click();
  await expect(tool(page, 'b15')).toHaveAttribute('data-moves', String(n));
  await expect(out(page, 'b15', 'exponents')).toHaveText(T(TALLY_BOARD).exponents.join(', '));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  // Fifteen tools and four challenges.
  expect(islands.length).toBe(TOOLS.length + 4);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T01GameBoard/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  // The scan of this page (about 8500 elements, fifteen tools) took 19 to 24 s alone on the build
  // machine, close to the default 30 s; two parallel workers pushed it over (decisions/P3-A9.md).
  test.setTimeout(120_000);
  await page.goto(ROUTE);
  for (const [id] of TOOLS) await hydrate(page, id);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// Regressions: red team round 1, findings confirmed on this lesson and fixed by RT-FIX P3 lesson-m5
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // Adopted from site/tests/unit/redteam-RT-09-02-m5-finite-type-dropped.test.ts (lens RT-09). The two
  // counterexamples are kept as the reproducer computes them, with the values it observed (the oracle
  // agrees: wave_play(board_from_name('A3~')[0], (1,1,1,1), 0, cap=500) raises OverflowError, still
  // running; play([[2,0],[-1,2]], (1,1)) gives word [0,1]; symbolic_play gives [(1,0),(1,1)]), and the
  // assertion is the finding's expected: the lesson states F6 and F8 only for boards of finite type
  // (SPEC 2.7 opening), in the beats and in the Seen box.
  const WAVE = 'On a board with at least two nodes every firing of this <Term a="wave">wave</Term>';
  const WAVE_TEXT = 'On a board with at least two nodes every firing of this **wave** is legal, and the game ends after the same number of rounds whichever colour starts';
  const FORMS = 'On any board the forms fired are the positive root populations of the **reversed board**';
  const sentences = (text: string): string[] => norm(text).split(/(?<=\.)\s+/);
  /** Each statement of the Seen box, preceded by the box's scope line when it has one. */
  const seenStatements = async (page: Page): Promise<string[]> => {
    const seen = page.locator('[data-anatomy="seen"]');
    const scope = (await seen.locator('[data-seen-scope]').allTextContents()).map(norm).join(' ');
    return (await seen.locator('[data-seen-statement]').allTextContents()).map((s) => norm(`${scope} ${s}`));
  };

  // regression: P3-RT-09-02
  test('M5 states F6 and F8 for every board, dropping the finite-type hypothesis of section 2.7', async ({ page }) => {
    // F8 off the finite types: on the square (the affine board A3~, colour classes {0, 2} and {1, 3} by
    // position) the wave from all ones fires legally and never ends.
    const square = boardFromName('square') as Board<unknown>;
    const { arith } = square;
    const classes = [[0, 2], [1, 3]];
    let a: unknown[] = [1, 1, 1, 1].map((x) => arith.fromInt(x));
    let rounds = 0;
    let illegal = 0;
    while (a.some((x) => arith.sign(x) > 0) && rounds < 1000) {
      for (const i of classes[rounds % 2]!) {
        if (arith.sign(a[i]) <= 0) illegal += 1;
        a = fire(square, a, i);
      }
      rounds += 1;
    }
    expect(illegal, 'every firing of the wave was legal here').toBe(0);
    expect(a.some((x) => arith.sign(x) > 0), `after ${rounds} rounds the wave on the square still has a positive number`).toBe(true);
    // F6 off the finite types: on the one-way road (C = [[2,0],[-1,2]], SPEC 2.11) the complete game from
    // (1, 1) fires the forms x1 and x1 + x2 only, never the simple root (0, 1) of the reversed board.
    const oneWay = fromAdjacency([
      [0, 1],
      [0, 0],
    ]) as Board<unknown>;
    const g = play(oneWay, [1, 1].map((x) => oneWay.arith.fromInt(x)));
    expect(g.status).toBe('ended');
    expect(g.word).toEqual([0, 1]);
    const forms = symbolicPlay(oneWay, g.word).map((f) => f.join(','));
    expect(forms).toEqual(['1,0', '1,1']);
    expect(forms).not.toContain('0,1');
    // So the lesson may state F6 and F8 only with the hypothesis of SPEC 2.7.
    const source = readFileSync(LESSON_PATH, 'utf8');
    expect(source.includes(WAVE_TEXT) || source.includes(WAVE), `M5 beat 7 states F8 for every board: "${WAVE_TEXT}"`).toBe(false);
    expect(source, `M5 beat 5 states F6 for every board: "${FORMS}"`).not.toContain(FORMS);
    await page.goto(ROUTE);
    const f6 = sentences(await proseText(page, '[data-beat="5"]')).filter((s) => /forms fired/.test(s) && /reversed board/.test(s));
    const f8 = sentences(await proseText(page, '[data-beat="7"]')).filter((s) => /every firing of this wave is legal/.test(s));
    expect(f6.length, 'beat 5 states F6').toBeGreaterThanOrEqual(1);
    expect(f8.length, 'beat 7 states F8').toBeGreaterThanOrEqual(1);
    for (const s of [...f6, ...f8]) expect(s, 'a statement of F6 or F8 in the beats').toMatch(/\bfinite type\b/);
    // In the Seen box a statement carries the hypothesis itself or under the box's scope line
    // (data-seen-scope, this lesson's markup), which the reader meets before the list.
    const scoped = await seenStatements(page);
    const seenF6 = scoped.filter((s) => /reversed board/.test(s));
    const seenF8 = scoped.filter((s) => /\bwave\b/.test(s));
    expect(seenF6.length, 'the Seen box states F6').toBe(1);
    expect(seenF8.length, 'the Seen box states F8').toBe(1);
    for (const s of [...seenF6, ...seenF8]) expect(s, 'a statement of F6 or F8 in the Seen box').toMatch(/\bfinite type\b/);
  });

  // regression: P3-RT-09-02 (sibling)
  test('the other facts of section 2.7 in the Seen box, and the claims of computation, name the finite type', async ({ page }) => {
    await page.goto(ROUTE);
    const scoped = await seenStatements(page);
    // Every statement but the one on heaps (Stembridge's, true for every board) is a fact of SPEC 2.7.
    const facts = scoped.filter((s) => !/\bheap\b/.test(s));
    expect(facts.length).toBe(scoped.length - 1);
    for (const s of facts) expect(s, 'a statement of SPEC 2.7 in the Seen box').toMatch(/\bfinite type\b/);
    // verify.py checks the types of rank at most 8 (SPEC 2.7), not every board of that rank.
    const text = norm(await proseText(page, 'article'));
    expect(text).not.toMatch(/every board of rank at most/);
  });

  // Adopted from site/tests/unit/redteam-RT-08-number-words.test.ts (lens RT-08), the cases of this lesson;
  // the cases of M2 and M3 belong to those lessons.
  const NUMBER_WORDS = [
    // M5 beat 5, prose: the number of moves of a complete game on A3 = the number of positive roots.
    { phrase: 'The six moves fire', path: 'types.A3.n_positive_roots', value: 6 },
    // M5 beat 6, prose: "the value 1 <G k="types.A3.fired_tally.1"/> times, 2 twice, 3 once".
    { phrase: '<Tex src="2"/> twice', path: 'types.A3.fired_tally.2', value: 2 },
    { phrase: '<Tex src="3"/> once', path: 'types.A3.fired_tally.3', value: 1 },
  ];
  for (const c of NUMBER_WORDS) {
    // regression: P3-RT-08-05
    test(`m5-weyl.mdx: "${c.phrase}" states ${c.path} as a typed word`, () => {
      expect(goldenAt(c.path), `${c.path} is the quantity the phrase states`).toBe(c.value);
      expect(readFileSync(LESSON_PATH, 'utf8').includes(c.phrase), `m5-weyl.mdx types ${c.path} as a word`).toBe(false);
    });
  }

  // regression: P3-RT-08-05 (sibling)
  test('m5-weyl.mdx: the heap goal "four different plays" states the largest of heaps.A3.games_per_heap as a typed word', () => {
    expect(Math.max(...(goldenAt('heaps.A3.games_per_heap') as number[])), 'the value the check of b13 compares with').toBe(4);
    expect(readFileSync(LESSON_PATH, 'utf8').includes('shared by four different plays'), 'm5-weyl.mdx types the goal of b13 as a word').toBe(false);
  });

  // regression: P3-RT-08-09
  test('no fallback of M5 carries TeX notation that a release build prints raw', () => {
    // Adopted from site/tests/unit/redteam-RT-08-fallbacks.test.ts (lens RT-08), the part of this lesson;
    // the E4 fallback of the open-problem page belongs to that page. Unverified.astro prints a fallback as
    // plain text in a release build (SPEC 7.3), so TeX in it reaches the reader raw.
    const fallbacks = [...readFileSync(LESSON_PATH, 'utf8').matchAll(/<Unverified item="(E\d+)" fallback="([^"]*)"/g)].map((m) => ({ item: m[1], text: m[2]! }));
    expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    const raw = fallbacks.filter((f) => /[_^\\$]/.test(f.text)).map((f) => `modules/m5-weyl.mdx ${f.item}: ${f.text}`);
    // Observed at 69546f0: modules/m5-weyl.mdx E16 "... each count on A_n equals ...".
    expect(raw).toEqual([]);
  });

  // regression: P3-RT-08-08
  test("four M5 tool captions give an instruction or a description and state no result, including the first figure's", async ({ page }) => {
    // Adopted from redteam/redteam-RT-08-captions.mjs (lens RT-08), which printed these captions for a
    // reader. SPEC 8.1 P1, CONTRACTS 7: a caption states the result its tool demonstrates; 8.2 item 2:
    // the first figure's caption is one sentence.
    const OBSERVED: Record<string, string> = {
      b1: 'Legal play on A3 from (1, 1, 1): fire any node whose number is positive, until none is.',
      b12: 'Legal play on A3 from (1, 1, 1); the challenge above names the position to reach.',
      b13: 'The heap view on A3, from no moves: fire nodes on the board and watch the heap and its count of plays.',
      b15: 'The tally game on B3 from all ones, before the first move.',
    };
    // The result each caption states, with its golden value where it has one.
    const RESULT: Record<string, RegExp[]> = {
      b1: [/ends at \(−1, −1, −1\)/, /every order/, /same number of moves/],
      b12: [new RegExp(`reaches each of the ${T('A3').weyl_order} positions`)],
      b13: [/same heap/],
      b15: [/tally read sideways gives the exponents/, new RegExp(`multiply to ${T(TALLY_BOARD).weyl_order}\\b`)],
    };
    await page.goto(ROUTE);
    for (const [id, observed] of Object.entries(OBSERVED)) {
      const caption = norm(await out(page, id, 'caption').textContent());
      expect(caption, `${id} caption`).not.toBe(observed);
      for (const re of RESULT[id]!) expect(caption, `${id} caption states its result`).toMatch(re);
    }
    const first = norm(await out(page, 'b1', 'caption').textContent());
    expect(first.split(/(?<=\.)\s+/), 'the first figure has a one-sentence caption').toHaveLength(1);
  });

  // regression: P3-RT-13-07
  test('/modules/m5-weyl/: no figure opens on a multiply laced board', async ({ page }) => {
    // Adopted from site/tests/e2e/redteam-RT-13-one-mechanic.spec.ts (lens RT-13), the case of this
    // lesson. SPEC 8.1 P4: multiple roads arrive in M6. The figure's text alternative names its board.
    await page.goto(ROUTE);
    const roots = page.locator('[data-tool]');
    const found: { id: string | null; tool: string | null; label: string }[] = [];
    for (let k = 0; k < (await roots.count()); k++) {
      const root = roots.nth(k);
      const label = norm(await root.getByRole('figure').first().getAttribute('aria-label'));
      if (/\b[BCFG][2-8]\b/.test(label)) found.push({ id: await root.getAttribute('data-instance'), tool: await root.getAttribute('data-tool'), label });
    }
    expect(found, JSON.stringify(found)).toEqual([]);
  });
});
