// P3-A8: lesson M4, "The numbers game and the duality", against the built site (SPEC.md 3 M4, 2.3,
// 2.4, 2.7, 2.12, 8.2, 8.4, 8.5, 9.2, 4.0, 7.3, 7.4, 7.6; build-plan/agents/P3-A8-lesson-m4.md 5.15).
// Run after `npm run build` against `astro preview`, one Playwright run at a time. The helpers follow
// M0.spec.ts and M3.spec.ts. Every number with a golden value is read from
// reference/golden_data.json; the positions along a play come from SPEC Appendix A or are computed
// here by the engine in Node, never read from the page.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("board", "numbers", "mirror", "garden", "affine"),
//     data-instance (b1 to b12), data-moves, data-hydrated="true"; [data-live] (the polite live region)
//   node buttons (P0-A5 Board): data-node, data-board ("populations" | "numbers"), data-value,
//     data-can-act; T15 and T5 nodes inside [data-board-group]
//   T1, registry site/src/tools/registry/T01.ts (T01_OUTS): data-out caption, noscript, gameOver,
//     bridgeSentence, predictResult; data-control reset, playToEnd, predictAnswer, predictCheck
//   T5, registry site/src/tools/registry/T05.ts (T05_OUTS): data-out caption, noscript, sortedA,
//     sortedB, tapesAgree, movesA, movesB
//   T6, registry site/src/tools/registry/T06.ts (T06_OUTS): data-out caption, noscript, numbers
//     (data-value), population (data-value), bridge
//   T2, registry site/src/tools/registry/T02.ts: data-out caption, noscript, found
//   T15, registry site/src/tools/registry/T15.ts (T15_OUTS): data-out caption, noscript, level
//     (data-value), levelSign, fate, firstVisit, fateSentence, predictResult; data-control playOn,
//     startField, predictAnswer, predictCheck
//   Predict (P1-A5 Predict.svelte): data-prediction, .question, details, .answer-text
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title,
//     question, draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance;
//     data-challenge, data-met, data-challenge-result (text "Goal reached."); data-source;
//     data-unverified and a.unverified-mark (P0-A4 Unverified)
//   this lesson's own markup: data-bridge-prose, data-seen-statement, data-fate-table
//
// Word-counting rule (as M0.spec.ts and M3.spec.ts): the words of the <article> after removing every
// tool root ([data-tool]), every <details>, every live or status region, the draft mark and the list
// of sources entries; each KaTeX formula counts as one word; a word is a run of non-space characters.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAPS, boardFromName, playFate } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { distDir } from './routes';

const ROUTE = 'modules/m4-numbers/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m4-numbers.mdx', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m4-numbers/index.html`;
/** SPEC 2.4(a), verbatim [D]. */
const BRIDGE = 'The number on node i is the amount by which a mutation would lower city i.';
/** SPEC 2.12, the row of level zero, verbatim. */
const ROW_ZERO = 'the game never ends and visits only finitely many positions (it loops)';

/** New items of Appendix E proposed by this lesson (equal to proposedUnverifiedItems of the report). */
const PROPOSED_ITEMS: string[] = [];

type Kind = 'board' | 'numbers' | 'mirror' | 'garden' | 'affine';
/** The tool instances of the seven beats and the challenges, in reading order, with their tool ids. */
const TOOLS: [string, Kind][] = [
  ['b1', 'board'],
  ['b2', 'board'],
  ['b3', 'numbers'],
  ['b4', 'board'],
  ['b5', 'mirror'],
  ['b6', 'board'],
  ['b7', 'garden'],
  ['b8', 'affine'],
  ['b9', 'affine'],
  ['b10', 'board'],
  ['b11', 'mirror'],
  ['b12', 'affine'],
];
const BEAT_OF: Record<string, number> = { b1: 1, b2: 2, b3: 2, b4: 3, b5: 4, b6: 5, b7: 5, b8: 6, b9: 7 };
const CHALLENGES = 3;

interface Golden {
  types: Record<
    string,
    { cartan: number[][]; n_positive_roots: number; longest_word: number[]; fired_values: number[]; fundamental_orbit_sizes: number[]; det_cartan: number }
  >;
  pentagon_example: { start: number[]; start_olympiad_convention: number[]; level: number; moves: number; complete_games: number };
  affine: Record<string, { comarks: number[] }>;
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const A2 = GOLDEN.types.A2!;
const A3 = GOLDEN.types.A3!;
const P = GOLDEN.pentagon_example;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const node = (page: Page, id: string, board: 'populations' | 'numbers', label: number): Locator =>
  tool(page, id).locator(`button[data-board="${board}"][data-node="${label}"]`);
/** A node of T15 or T5 game A, whatever its data-board. */
const groupNode = (page: Page, id: string, label: number): Locator => tool(page, id).locator(`[data-board-group] button[data-node="${label}"]`).first();
const live = (page: Page, id: string): Locator => tool(page, id).locator('[data-live]');
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** The values of one board of a tool, in label order, as data-value text. */
async function values(page: Page, id: string, board: 'populations' | 'numbers'): Promise<string[]> {
  return tool(page, id)
    .locator(`button[data-board="${board}"][data-node]`)
    .evaluateAll((els) =>
      els
        .map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value') ?? ''] as const)
        .sort((a, b) => a[0] - b[0])
        .map((p) => p[1]),
    );
}

/** The values of the first board group of a tool (T15), in label order. */
async function groupValues(page: Page, id: string): Promise<string[]> {
  return tool(page, id)
    .locator('[data-board-group]')
    .first()
    .locator('button[data-node]')
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

/** Answers a choice prediction of a tool with option k and checks it. */
async function answerChoice(page: Page, id: string, k: number): Promise<void> {
  await control(page, id, 'predictAnswer').nth(k).check();
  await control(page, id, 'predictCheck').click();
  await expect(out(page, id, 'predictResult')).toHaveText(/^Right/);
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

/** The prose sentences (tools, live regions and source entries removed), formulas as their TeX source. */
async function proseSentences(page: Page, scope = 'article', keep = ''): Promise<string[]> {
  const text = await page.locator(scope).first().evaluate((root, keepSel) => {
    const copy = root.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) {
      const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? 'formula';
      k.replaceWith(document.createTextNode(` ${tex.replace(/\s+/g, '')} `));
    }
    const drop = ['[data-tool]', '[role="status"]', '[aria-live]', '[data-anatomy="sources"] ul', 'script', 'style', 'noscript', 'svg'];
    if (keepSel !== '') drop.push(keepSel);
    for (const el of copy.querySelectorAll(drop.join(', '))) el.remove();
    for (const el of copy.querySelectorAll('p, li, h1, h2, h3, summary, figcaption, td, th, caption')) el.append(document.createTextNode(' . '));
    return copy.textContent ?? '';
  }, keep);
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.?!])(?<!\b[A-Z]\.)(?<!\bp\.)(?<!\bpp\.)(?<!\bc\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** C p with C from the golden Cartan matrix of the board, as decimal text. */
function cTimes(cartan: number[][], p: number[]): string[] {
  return cartan.map((row) => String(row.reduce((s, c, j) => s + c * p[j]!, 0)));
}

// ---------------------------------------------------------------------------------------------
// Without JavaScript
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the seven figures are present', async ({ page }) => {
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
    // Beat 1: A2 from (1, 1) in legal play.
    expect(await values(page, 'b1', 'numbers')).toEqual(['1', '1']);
    // Beat 3: the population (1, 1, 0) and its numbers (1, 1, -1), which are C p.
    expect(await values(page, 'b4', 'populations')).toEqual(['1', '1', '0']);
    expect(await values(page, 'b4', 'numbers')).toEqual(cTimes(A3.cartan, [1, 1, 0]));
    expect(await values(page, 'b4', 'numbers')).toEqual(['1', '1', '-1']);
    // Beat 4: the point at a = (1, 1), whose population on A2 is (1, 1).
    await expect(out(page, 'b5', 'numbers')).toHaveAttribute('data-value', '1,1');
    await expect(out(page, 'b5', 'population')).toHaveAttribute('data-value', '1,1');
    // Beat 5: the position (1, 0) on A2 is the population (2/3, 1/3) (SPEC 4 T1 acceptance).
    expect(await values(page, 'b6', 'numbers')).toEqual(['1', '0']);
    expect(await values(page, 'b6', 'populations')).toEqual(['2/3', '1/3']);
    // Beat 2: the two compared games, played at build time, agree once sorted.
    const sorted = [...A3.fired_values].sort((a, b) => a - b).join(', ');
    await expect(out(page, 'b3', 'sortedA')).toHaveText(sorted);
    await expect(out(page, 'b3', 'sortedB')).toHaveText(sorted);
    await expect(out(page, 'b3', 'tapesAgree')).toHaveCount(1);
    // Beat 6: the Olympiad form of the example start.
    expect(await groupValues(page, 'b8')).toEqual(P.start_olympiad_convention.map(String));
    // The fate table of 2.12 is in the prose, all three rows.
    await expect(page.locator('[data-beat="7"] table[data-fate-table] tbody tr')).toHaveCount(3);
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('every prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    const expected: Record<string, string> = {
      b2: 'Nothing: the same end after the same number of moves',
      b6: String(A2.fundamental_orbit_sizes[0]),
      b8: 'Yes',
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
    // The reveal of beat 2 states the length from the golden file and the end (-1, -1, -1).
    const reveal = norm(await tool(page, 'b2').locator('[data-prediction] details').textContent());
    expect(reveal).toContain(`${A3.n_positive_roots} moves`);
    expect(reveal).toContain('(−1, −1, −1)');
  });
});

// ---------------------------------------------------------------------------------------------
// With JavaScript
// ---------------------------------------------------------------------------------------------

test('a prediction freezes the board until answered', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b2');
  for (const label of [1, 2, 3]) await expect(node(page, 'b2', 'numbers', label)).toHaveAttribute('data-can-act', 'false');
  await node(page, 'b2', 'numbers', 1).click({ force: true });
  await expect(tool(page, 'b2')).toHaveAttribute('data-moves', '0');
  await expect(control(page, 'b2', 'playToEnd')).toBeDisabled();
  await answerChoice(page, 'b2', 0);
  for (const label of [1, 2, 3]) await expect(node(page, 'b2', 'numbers', label)).toHaveAttribute('data-can-act', 'true');
  // The other predictions freeze their boards too.
  await hydrate(page, 'b6');
  for (const label of [1, 2]) await expect(node(page, 'b6', 'numbers', label)).toHaveAttribute('data-can-act', 'false');
  await hydrate(page, 'b8');
  await expect(control(page, 'b8', 'playOn')).toBeDisabled();
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M4 prose words: ${words}`);
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
  expect(readFileSync(LESSON_PATH, 'utf8').includes('—'), 'U+2014 in the source').toBe(false);
});

test('numbers-in-prose report lists only the allowed numbers', () => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const findings = scanSource(source, 'site/src/content/modules/m4-numbers.mdx');
  // Both sections empty: every allowed number is in <Tex>, a prop or a brace string (decisions/P3-A8.md).
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

test('bridge sentence', async ({ page }) => {
  await page.goto(ROUTE);
  // The prose of beat 3, word for word as SPEC 2.4(a).
  const prose = page.locator('[data-beat="3"] [data-bridge-prose]');
  await expect(prose).toHaveCount(1);
  expect(norm(await prose.textContent())).toBe(BRIDGE);
  // The two linked boards and the kaleidoscope render it in their own markup.
  for (const id of ['b4', 'b6']) await expect(out(page, id, 'bridgeSentence'), id).toHaveText(BRIDGE);
  await expect(out(page, 'b5', 'bridge')).toHaveText(BRIDGE);
  // It is in the Seen box too.
  expect(norm(await page.locator('[data-anatomy="seen"]').textContent())).toContain(BRIDGE);
});

test('beat 1 plays three moves on A2', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  // SPEC Appendix A.1: firing 1, 2, 1 from (1, 1).
  const after = [
    ['-1', '2'],
    ['1', '-2'],
    ['-1', '-1'],
  ];
  for (const [k, label] of A2.longest_word.entries()) {
    await node(page, 'b1', 'numbers', label).click();
    await expect(tool(page, 'b1')).toHaveAttribute('data-moves', String(k + 1));
    expect(await values(page, 'b1', 'numbers')).toEqual(after[k]);
  }
  await expect(out(page, 'b1', 'gameOver')).toHaveText(new RegExp(`^Game over after ${A2.n_positive_roots} moves\\.$`, 'i'));
  for (const label of [1, 2]) await expect(node(page, 'b1', 'numbers', label)).toHaveAttribute('data-can-act', 'false');
  await control(page, 'b1', 'reset').click();
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '0');
  await page.waitForTimeout(700);
  await node(page, 'b1', 'numbers', 2).click();
  await expect(live(page, 'b1')).toHaveText('Fired node 2. Numbers now 2, minus 1. Move 1.');
});

test('beat 2 ends after six moves in any order', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b2');
  await answerChoice(page, 'b2', 0);
  // The lowest-node rule of play to the end.
  await control(page, 'b2', 'playToEnd').click();
  await expect(tool(page, 'b2')).toHaveAttribute('data-moves', String(A3.n_positive_roots));
  expect(await values(page, 'b2', 'numbers')).toEqual(['-1', '-1', '-1']);
  // Another order, by hand: the highest positive node each time (3, 2, 3, 1, 2, 3).
  await control(page, 'b2', 'reset').click();
  await expect(tool(page, 'b2')).toHaveAttribute('data-moves', '0');
  let moves = 0;
  for (;;) {
    const vs = (await values(page, 'b2', 'numbers')).map(Number);
    const legal = vs.map((v, i) => (v > 0 ? i + 1 : 0)).filter((l) => l > 0);
    if (legal.length === 0) break;
    await node(page, 'b2', 'numbers', legal[legal.length - 1]!).click();
    moves++;
    await expect(tool(page, 'b2')).toHaveAttribute('data-moves', String(moves));
  }
  expect(moves).toBe(A3.n_positive_roots);
  expect(await values(page, 'b2', 'numbers')).toEqual(['-1', '-1', '-1']);
  await expect(out(page, 'b2', 'gameOver')).toHaveText(`Game over after ${A3.n_positive_roots} moves.`);
  // T5 beside it: both games ended, the sorted tapes agree.
  await hydrate(page, 'b3');
  const sortedA = norm(await out(page, 'b3', 'sortedA').textContent());
  expect(sortedA).toBe([...A3.fired_values].sort((a, b) => a - b).join(', '));
  expect(norm(await out(page, 'b3', 'sortedB').textContent())).toBe(sortedA);
  await expect(out(page, 'b3', 'tapesAgree')).toHaveCount(1);
  await expect(out(page, 'b3', 'movesA')).toHaveText(String(A3.n_positive_roots));
  await expect(out(page, 'b3', 'movesB')).toHaveText(String(A3.n_positive_roots));
});

test('beat 3 shows (1,1,-1) and keeps a = Cp', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b4');
  expect(await values(page, 'b4', 'numbers')).toEqual(['1', '1', '-1']);
  // Three moves, alternating the board acted on; after each the numbers are C times the populations.
  const plays: ['populations' | 'numbers', number][] = [
    ['populations', 1],
    ['numbers', 3],
    ['populations', 2],
  ];
  for (const [k, [board, label]] of plays.entries()) {
    const before = (await values(page, 'b4', 'populations')).map(Number);
    const drop = Number((await values(page, 'b4', 'numbers'))[label - 1]);
    await node(page, 'b4', board, label).click();
    await expect(tool(page, 'b4')).toHaveAttribute('data-moves', String(k + 1));
    const p = (await values(page, 'b4', 'populations')).map(Number);
    // The bridge sentence: the city fell by its number, and nothing else changed.
    expect(p[label - 1]).toBe(before[label - 1]! - drop);
    expect(p.filter((_, i) => i !== label - 1)).toEqual(before.filter((_, i) => i !== label - 1));
    expect(await values(page, 'b4', 'numbers')).toEqual(cTimes(A3.cartan, p));
  }
});

test('beat 4 kaleidoscope', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b5');
  await expect(out(page, 'b5', 'numbers')).toHaveAttribute('data-value', '1,1');
  await expect(out(page, 'b5', 'population')).toHaveAttribute('data-value', '1,1');
  await node(page, 'b5', 'numbers', 1).click();
  await expect(tool(page, 'b5')).toHaveAttribute('data-moves', '1');
  await expect(out(page, 'b5', 'numbers')).toHaveAttribute('data-value', '-1,2');
  await expect(out(page, 'b5', 'population')).toHaveAttribute('data-value', '0,1');
});

test('beat 5 orbit of three', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b6');
  await hydrate(page, 'b7');
  await expect(out(page, 'b7', 'found')).toHaveText('1');
  await control(page, 'b6', 'predictAnswer').fill(String(A2.fundamental_orbit_sizes[0]));
  await control(page, 'b6', 'predictCheck').click();
  await expect(out(page, 'b6', 'predictResult')).toHaveText(/^Right/);
  const seen = [await values(page, 'b6', 'numbers')];
  for (const [k, label] of [1, 2].entries()) {
    await node(page, 'b6', 'numbers', label).click();
    await expect(tool(page, 'b6')).toHaveAttribute('data-moves', String(k + 1));
    seen.push(await values(page, 'b6', 'numbers'));
  }
  // The orbit of verify.py section 19: (1, 0), (-1, 1), (0, -1).
  expect(seen).toEqual([
    ['1', '0'],
    ['-1', '1'],
    ['0', '-1'],
  ]);
  for (const v of seen.flat()) expect(['-1', '0', '1']).toContain(v);
  await expect(out(page, 'b7', 'found')).toHaveText(String(A2.fundamental_orbit_sizes[0]));
  // A further move finds nothing new.
  await node(page, 'b6', 'numbers', 1).click();
  await expect(tool(page, 'b6')).toHaveAttribute('data-moves', '3');
  await expect(out(page, 'b7', 'found')).toHaveText(String(A2.fundamental_orbit_sizes[0]));
});

test('beat 6 pentagon', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b8');
  expect(await groupValues(page, 'b8')).toEqual(P.start_olympiad_convention.map(String));
  await expect(out(page, 'b8', 'level')).toHaveAttribute('data-value', String(P.level));
  await answerChoice(page, 'b8', 0);
  await control(page, 'b8', 'playOn').click();
  await expect(out(page, 'b8', 'fate')).toHaveText(`ended after ${P.moves} moves`, { timeout: 30000 });
  await expect(tool(page, 'b8')).toHaveAttribute('data-moves', String(P.moves));
});

test('beat 7 three fates', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b9');
  expect(await groupValues(page, 'b9')).toEqual(P.start.map(String));
  await expect(out(page, 'b9', 'levelSign')).toHaveText('negative');
  // Raise node 5 by one: the level becomes zero with a nonzero position.
  const start = [...P.start];
  start[4] = start[4]! + 1;
  expect(start.reduce((s, x, i) => s + x * GOLDEN.affine.A4!.comarks[i]!, 0)).toBe(0);
  await control(page, 'b9', 'startField').nth(4).fill(String(start[4]));
  await expect(out(page, 'b9', 'levelSign')).toHaveText('zero');
  await expect(out(page, 'b9', 'level')).toHaveAttribute('data-value', '0');
  await expect(out(page, 'b9', 'fateSentence')).toContainText(ROW_ZERO);
  const r = playFate(boardFromName('pentagon') as Board<bigint>, start.map(BigInt), undefined, CAPS.playMoves);
  expect(r.status).toBe('looped');
  await control(page, 'b9', 'playOn').click();
  await expect(out(page, 'b9', 'fate')).toHaveText(`returned to an earlier position after ${r.moves} moves`, { timeout: 30000 });
  await expect(out(page, 'b9', 'firstVisit')).toHaveCount(1);
});

test('anatomy', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('The numbers game and the duality');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('What does the same move look like from the other side?');
  await expect(article.locator('[data-anatomy="draft"]'), 'draft mark (D17)').toHaveCount(1);
  await expect(article.locator('[data-anatomy="beat"]')).toHaveCount(7);
  await expect(article.locator('[data-anatomy="seen"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="lie-theory"]')).toHaveCount(1);
  const challenges = await article.locator('[data-challenge]').count();
  expect(challenges).toBe(CHALLENGES);
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
  expect(await statements.count()).toBeGreaterThanOrEqual(5);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation/.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  // Strong convergence is credited to Donnelly's Theorem 2.1 and Eriksson's Definition 1.1.
  const f3 = norm(await statements.nth(1).textContent());
  expect(f3).toContain('Theorem 2.1');
  expect(f3).toContain('Definition 1.1');
  for (const key of ['Moz90', 'Eri95b', 'Don08', 'GSS12', 'W-MS', 'W03c', 'IMO86', 'Pro84']) {
    await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`), key).toHaveCount(1);
  }
  // The links: the sandbox with A3 (the next module and the Atlas are dropped while unreleased).
  const sandbox = article.locator('[data-anatomy="links"] a[data-link="sandbox"]');
  if ((await sandbox.count()) > 0) expect(await sandbox.getAttribute('href')).toMatch(/g=A3$/);
});

test('wrapped items', async ({ page }) => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const items = JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { items?: { id: string }[] } | { id: string }[];
  const known = new Set((Array.isArray(items) ? items : (items.items ?? [])).map((i) => i.id));
  const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
  expect(wraps.length).toBe(2);
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
  const prose = (sel: string): Locator => page.locator(`article ${sel}`).filter({ hasNot: page.locator('[data-tool]') });
  await expect(page.locator('[data-beat="6"] [data-unverified="E2"]')).toHaveCount(1);
  await expect(page.locator('[data-beat="7"] > p [data-unverified="E6"]')).toHaveCount(1);
  expect(await prose('[data-unverified]').count()).toBeGreaterThanOrEqual(2);
  const e2 = norm(await page.locator('[data-beat="6"] [data-unverified="E2"]').textContent());
  expect(e2).toContain('Mozes introduced his game in 1990');
  expect(e2).toContain('firing negative numbers');
  const e6 = norm(await page.locator('[data-beat="7"] > p [data-unverified="E6"]').textContent());
  expect(e6).toContain('multiple roads');
  // Every prose sentence that names Mozes with a convention, a sign, a theorem, a matrix or the
  // Olympiad lies inside the E2 span.
  const outside = await proseSentences(page, 'article', '[data-unverified]');
  const mozes = outside.filter((s) => /Mozes/.test(s));
  expect(mozes.length).toBeGreaterThanOrEqual(2);
  for (const s of mozes) expect(s, s).not.toMatch(/negative|positive|convention|Theorem \d|Proposition \d|matrix|Olympiad|puzzle|pentagon|1990|introduc/);
  // Nothing outside the E6 span extends the table to boards with multiple roads or twisted boards.
  for (const s of outside) expect(s, s).not.toMatch(/(multiple roads|twisted).*(table|fate)|(table|fate).*(multiple roads|twisted)/i);
  // Every open-item mark in the prose links to an item of the open-items page.
  const marks = page.locator('article a.unverified-mark').filter({ hasNot: page.locator('[data-tool]') });
  const hrefs = await page.locator('article a.unverified-mark').evaluateAll((els) => els.filter((e) => !e.closest('[data-tool]')).map((e) => e.getAttribute('href') ?? ''));
  expect(hrefs.length).toBe(wraps.length);
  expect(await marks.count()).toBeGreaterThanOrEqual(wraps.length);
  for (const href of hrefs) {
    const url = new URL(href, page.url());
    const listing = await page.request.get(url.toString().replace(/#.*$/, ''));
    expect(listing.status(), href).toBe(200);
    expect(await listing.text(), `${url.hash} on open-items`).toMatch(new RegExp(`id="${url.hash.slice(1)}"`));
  }
});

test('no forbidden statement', async ({ page }) => {
  await page.goto(ROUTE);
  const text = norm(await page.locator('main').innerText());
  // The games are never said to coincide; the end is never "minus the start" in general; the
  // proposer of the Olympiad problem is not named (E11); q = -Cp is never the site's convention.
  for (const re of [/same game/i, /games (?:are|coincide) (?:the same|identical)/i, /always minus the start/i, /proposed by/i, /proposer/i, /not of finite type/i]) {
    expect(text, String(re)).not.toMatch(re);
  }
  // P8: no sentence of the prose names both a node and a city, except the bridge sentence of 2.4(a).
  const both = (await proseSentences(page)).filter((s) => /\bnodes?\b/i.test(s) && /\bcit(?:y|ies)\b/i.test(s) && !s.includes('is the amount by which a mutation would lower city'));
  expect(both).toEqual([]);
  // The site's sign convention is stated in beat 1, and the Olympiad's convention where it is quoted.
  expect(norm(await page.locator('[data-beat="1"]').innerText())).toMatch(/fires positive numbers/);
  expect(norm(await page.locator('[data-beat="6"]').innerText())).toMatch(/fires a negative number/);
  // A cap is not a proof (2.12).
  expect(norm(await page.locator('[data-beat="7"]').innerText())).toMatch(/cannot be seen by playing/);
});

test('challenge: reach (3, -1, -1) by legal moves', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b10');
  await hydrate(page, 'b10');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // The lowest-node game never passes the target.
  await control(page, 'b10', 'playToEnd').click();
  await expect(tool(page, 'b10')).toHaveAttribute('data-moves', String(A3.n_positive_roots));
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await control(page, 'b10', 'reset').click();
  await expect(tool(page, 'b10')).toHaveAttribute('data-moves', '0');
  for (const [k, label] of [3, 2, 3].entries()) {
    if (k > 0) await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await node(page, 'b10', 'numbers', label).click();
    await expect(tool(page, 'b10')).toHaveAttribute('data-moves', String(k + 1));
  }
  expect(await values(page, 'b10', 'numbers')).toEqual(['3', '-1', '-1']);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: the population (1, 0) on the kaleidoscope', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Firing node 1 goes elsewhere: not met.
  await node(page, 'b11', 'numbers', 1).click();
  await expect(tool(page, 'b11')).toHaveAttribute('data-moves', '1');
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await control(page, 'b11', 'undo').click();
  await expect(tool(page, 'b11')).toHaveAttribute('data-moves', '0');
  await node(page, 'b11', 'numbers', 2).click();
  // The population of the target is (1, 0): the first column of C (a = Cp).
  await expect(out(page, 'b11', 'population')).toHaveAttribute('data-value', '1,0');
  await expect(out(page, 'b11', 'numbers')).toHaveAttribute('data-value', A2.cartan.map((row) => row[0]).join(','));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: a pentagon start that loops', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b12');
  await hydrate(page, 'b12');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // The example start has negative level: play on ends, which is not the goal.
  await control(page, 'b12', 'playOn').click();
  await expect(out(page, 'b12', 'fate')).toHaveText(`ended after ${P.moves} moves`, { timeout: 30000 });
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // Level zero: node 5 raised by one.
  await control(page, 'b12', 'startField').nth(4).fill(String(P.start[4]! + 1));
  await expect(out(page, 'b12', 'levelSign')).toHaveText('zero');
  await control(page, 'b12', 'playOn').click();
  await expect(out(page, 'b12', 'fate')).toHaveText(/^returned to an earlier position after \d+ moves$/, { timeout: 30000 });
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  expect(islands.length).toBe(TOOLS.length + CHALLENGES);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T01GameBoard/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(ROUTE);
  for (const [id] of TOOLS) await hydrate(page, id);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});
