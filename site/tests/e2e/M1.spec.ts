// P1-A9: lesson M1, "The mutation game", against the built site (SPEC.md 3 M1, 8.2, 8.4, 8.5, 9.2,
// 4.0, 7.3, 7.4, 7.5, 7.6; build-plan/agents/P1-A9-lesson-m1.md 5.13). Run after `npm run build`
// against `astro preview`, one Playwright run at a time. The helpers follow M0.spec.ts (P1-A8).
// Every number with a golden value is read from reference/golden_data.json, never typed.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool ("board", "garden", "kostant"), data-instance (b1 to
//     b11), data-moves, data-hydrated="true", data-live (the polite live region)
//   node buttons (P0-A5 Board, P1-A5): data-node, data-board ("populations"), data-value, data-can-act
//   T1, registry site/src/tools/registry/T01.ts (T01_OUTS): data-out caption, noscript, goal,
//     goalMet, goalNote, predictResult, predictReveal; data-control predictAnswer, predictCheck,
//     predictShow (P1-A5 Predict.svelte); data-prediction (the prediction block and its <details>)
//   T2, registry site/src/tools/registry/T02.ts (outs): data-out caption, noscript, found,
//     stopMessage
//   T9, registry site/src/tools/registry/T09.ts (T09_OUTS): data-out caption, noscript,
//     bridgeSentence, endName, moveCount, predictResult; data-control step, playToEnd, startCity,
//     picker, predictShow
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title,
//     question, draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance;
//     data-challenge, data-kind, data-met, data-challenge-result (text "Goal reached."); data-source;
//     data-unverified and a.unverified-mark (P0-A4 Unverified); data-item on the open-items page
//   this lesson's own markup: data-seen-statement
//
// Word-counting rule (test 4, as M0.spec.ts): the words of the <article> after removing every tool
// root ([data-tool]), every <details>, every live or status region, the draft mark and the list of
// sources entries; each KaTeX formula counts as one word; a word is a run of non-space characters.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { distDir } from './routes';

const ROUTE = 'modules/m1-mutation/';
const LESSON_PATH = fileURLToPath(new URL('../../src/content/modules/m1-mutation.mdx', import.meta.url));
const UNVERIFIED_PATH = fileURLToPath(new URL('../../src/content/unverified.json', import.meta.url));
const GOLDEN_PATH = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m1-mutation/index.html`;
const BRIDGE = 'The number on node i is the amount by which a mutation would lower city i.';

/** New items of Appendix E proposed by this lesson (equal to proposedUnverifiedItems of the report). */
const PROPOSED_ITEMS: string[] = [];

/** The tool instances of the five beats and the challenges, in reading order, with their tool ids. */
const TOOLS: [string, 'board' | 'garden' | 'kostant'][] = [
  ['b1', 'board'],
  ['b2', 'garden'],
  ['b3', 'board'],
  ['b4', 'board'],
  ['b5', 'kostant'],
  ['b6', 'garden'],
  ['b7', 'garden'],
  ['b8', 'garden'],
  ['b9', 'board'],
  ['b10', 'kostant'],
  ['b11', 'board'],
];
const FIGURE_TOOLS = TOOLS.slice(0, 8);

interface TypeRecord {
  n_roots: number;
  n_positive_roots: number;
  highest_root: number[];
  coxeter_number: number;
}
interface KostantRecord {
  end_from_node: number[][];
  moves_from_node: number[];
}
interface Golden {
  types: Record<string, TypeRecord>;
  kostant: Record<string, KostantRecord>;
  layer_growth_examples: { label: string; layers: number; root_populations_found: number; new_per_layer: number[] }[];
  affine: Record<string, { marks: number[] }>;
}
const GOLDEN = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
const TRIANGLE = GOLDEN.layer_growth_examples.find((r) => r.label === 'triangle')!;
const FROZEN = GOLDEN.affine.A2!.marks;

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

const signs = (vs: string[]): { pos: boolean; neg: boolean } => ({
  pos: vs.some((v) => /^[1-9]/.test(v)),
  neg: vs.some((v) => /^[-−][1-9]/.test(v)),
});

/** Scrolls a tool into view (client:visible) and waits for hydration. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true');
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

/** The prose sentences of the lesson (tools, details, live regions and source titles removed). */
async function proseSentences(page: Page): Promise<string[]> {
  const text = await page.locator('article').evaluate((article) => {
    const copy = article.cloneNode(true) as HTMLElement;
    for (const k of copy.querySelectorAll('.katex')) k.replaceWith(document.createTextNode(' formula '));
    for (const el of copy.querySelectorAll('[data-tool], [role="status"], [aria-live], [data-anatomy="sources"] ul, script, style, noscript')) el.remove();
    for (const el of copy.querySelectorAll('p, li, h1, h2, h3, summary')) el.append(document.createTextNode(' . '));
    return copy.textContent ?? '';
  });
  return text
    .replace(/\s+/g, ' ')
    // A full stop after a lone capital (an initial, N. J. Wildberger) does not end a sentence.
    .split(/(?<=[.?!])(?<!\b[A-Z]\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** Answers a tool's prediction with "show me", so that the board is free. */
async function showMe(page: Page, id: string): Promise<void> {
  await control(page, id, 'predictShow').click();
  await expect(out(page, id, 'predictResult')).toHaveText(/^The answer is/);
}

// ---------------------------------------------------------------------------------------------
// Without JavaScript
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the five figures are present', async ({ page }) => {
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
    // Every figure of the five beats sits in its beat's figure slot.
    const beats: Record<string, number> = { b1: 1, b2: 1, b3: 2, b4: 2, b5: 3, b6: 4, b7: 4, b8: 5 };
    for (const [id] of FIGURE_TOOLS) {
      await expect(page.locator(`[data-beat="${beats[id]}"] [data-anatomy="figure"] [data-tool][data-instance="${id}"]`), id).toHaveCount(1);
    }
    // The boards show their starts: one Martian in city 1.
    expect(await values(page, 'b1')).toEqual(['1', '0']);
    expect(await values(page, 'b3')).toEqual(['1', '0', '0']);
    expect(await values(page, 'b4')).toEqual(['1', '0', '0', '0']);
    expect(await values(page, 'b5')).toEqual(['1', '0', '0']);
    // Beat 4: the explore garden starts from the three single Martians; the poset is grown in full.
    await expect(out(page, 'b6', 'found')).toHaveText('3');
    await expect(out(page, 'b7', 'found')).toHaveText(String(GOLDEN.types.A3!.n_roots));
    await expect(tool(page, 'b7').locator('[data-out="vertex"]')).toHaveCount(GOLDEN.types.A3!.n_positive_roots);
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('the triangle garden shows 243 and stopped after 40 layers without JavaScript', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(out(page, 'b8', 'found')).toHaveText(String(TRIANGLE.root_populations_found));
    await expect(out(page, 'b8', 'stopMessage')).toHaveText(`stopped after ${TRIANGLE.layers} layers`);
  });

  test('every prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const blocks = page.locator('[data-prediction]');
    expect(await blocks.count()).toBeGreaterThanOrEqual(2);
    const expected: Record<string, string> = {
      b1: String(GOLDEN.types.A2!.n_roots),
      b5: 'No, every start ends at the same population.',
      b11: `(${FROZEN.join(', ')})`,
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
  for (const label of [1, 2]) await expect(node(page, 'b1', label)).toHaveAttribute('data-can-act', 'false');
  await node(page, 'b1', 2).click({ force: true });
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '0');
  await control(page, 'b1', 'predictAnswer').fill(String(GOLDEN.types.A2!.n_roots));
  await control(page, 'b1', 'predictCheck').click();
  await expect(out(page, 'b1', 'predictResult')).toHaveText(/^Right/);
  for (const label of [1, 2]) await expect(node(page, 'b1', label)).toHaveAttribute('data-can-act', 'true');
  // Beat 3: the T9 board, its step control and its chooser wait for the answer too.
  await hydrate(page, 'b5');
  for (const label of [1, 2, 3]) await expect(node(page, 'b5', label)).toHaveAttribute('data-can-act', 'false');
  await expect(control(page, 'b5', 'step')).toBeDisabled();
  await expect(control(page, 'b5', 'picker')).toBeDisabled();
  await tool(page, 'b5').locator('[data-control="predictAnswer"]').nth(1).check();
  await control(page, 'b5', 'predictCheck').click();
  await expect(out(page, 'b5', 'predictResult')).toHaveText(/^Right/);
  await expect(control(page, 'b5', 'step')).toBeEnabled();
  await expect(node(page, 'b5', 2)).toHaveAttribute('data-can-act', 'true');
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M1 prose words: ${words}`);
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

test('numbers-in-prose report for this file is empty', () => {
  const findings = scanSource(readFileSync(LESSON_PATH, 'utf8'), 'site/src/content/modules/m1-mutation.mdx');
  // Both sections empty (the reading of decisions/P1-A8.md and P1-A9.md).
  expect(findings.filter((f) => f.kind === 'prose')).toEqual([]);
  expect(findings.filter((f) => f.kind === 'formula')).toEqual([]);
  // The scan is not vacuous: a number added at the end of any prose line is found. (An apostrophe
  // inside an MDX comment once hid the rest of a lesson from the scanner.)
  const source = readFileSync(LESSON_PATH, 'utf8');
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

test('the garden follows the board in beat 1', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  await hydrate(page, 'b2');
  await expect(out(page, 'b2', 'found')).toHaveText('1');
  await control(page, 'b1', 'predictAnswer').fill(String(GOLDEN.types.A2!.n_roots));
  await control(page, 'b1', 'predictCheck').click();
  // From (1, 0): cities 2, 1, 2, 1, 2 visit the six root populations of A2.
  const word = [2, 1, 2, 1, 2];
  const seen = new Set<string>([(await values(page, 'b1')).join(',')]);
  for (const [k, label] of word.entries()) {
    await node(page, 'b1', label).click();
    await expect(tool(page, 'b1')).toHaveAttribute('data-moves', String(k + 1));
    seen.add((await values(page, 'b1')).join(','));
    await expect(out(page, 'b2', 'found')).toHaveText(String(seen.size));
  }
  expect(seen.size).toBe(GOLDEN.types.A2!.n_roots);
  await expect(out(page, 'b2', 'found')).toHaveText(String(GOLDEN.types.A2!.n_roots));
});

test('the goal of beat 2 cannot be met and the caption appears after 20 moves', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id, n] of [['b3', 3], ['b4', 4]] as const) {
    await hydrate(page, id);
    await expect(out(page, id, 'goal')).toHaveText('Goal: make one city negative while another is positive.');
    for (let k = 0; k < 20; k++) {
      // A different city each time, round the board, so the play wanders far from the start.
      await node(page, id, ((k * 2) % n) + 1).click();
      await expect(tool(page, id)).toHaveAttribute('data-moves', String(k + 1));
      const s = signs(await values(page, id));
      expect(s.pos && s.neg, `${id} move ${k + 1}: mixed signs`).toBe(false);
      await expect(out(page, id, 'goalMet')).toHaveText('');
      if (k < 19) await expect(out(page, id, 'goalNote'), `${id} after ${k + 1} moves`).toHaveText('');
    }
    await expect(out(page, id, 'goalNote')).toHaveText(/cannot be met on this board/);
    await expect(out(page, id, 'goalNote')).toHaveText(/verified by computation/);
  }
});

test("Kostant's game ends as stated", async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b5');
  await showMe(page, 'b5');
  const play = async (type: string, startIndex: number): Promise<void> => {
    const g = GOLDEN.kostant[type]!;
    await control(page, 'b5', 'playToEnd').click();
    expect(await values(page, 'b5'), `${type} from city ${startIndex + 1}`).toEqual(g.end_from_node[startIndex]!.map(String));
    await expect(out(page, 'b5', 'moveCount')).toHaveText(String(g.moves_from_node[startIndex]));
    await expect(tool(page, 'b5')).toHaveAttribute('data-moves', String(g.moves_from_node[startIndex]));
    await expect(out(page, 'b5', 'endName')).toHaveText(/highest root/);
  };
  await play('A3', 0);
  await control(page, 'b5', 'picker').selectOption('D4');
  await expect(tool(page, 'b5')).toHaveAttribute('data-moves', '0');
  await play('D4', 0);
  await control(page, 'b5', 'picker').selectOption('E8');
  expect(await values(page, 'b5')).toEqual(['1', '0', '0', '0', '0', '0', '0', '0']);
  await play('E8', 0);
  for (const city of [4, 8]) {
    await control(page, 'b5', 'startCity').selectOption(String(city));
    await expect(tool(page, 'b5')).toHaveAttribute('data-moves', '0');
    await play('E8', city - 1);
  }
});

test('challenge: all 12 root populations of A3', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b9');
  await expect(challenge).toHaveAttribute('data-kind', 'distinct');
  await hydrate(page, 'b9');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // A play from (1, 0, 0) that visits every root population of A3 (found by search, not golden).
  const word = [1, 2, 1, 2, 1, 3, 1, 2, 3, 2, 1];
  const seen = new Set<string>([(await values(page, 'b9')).join(',')]);
  for (const [k, label] of word.entries()) {
    await node(page, 'b9', label).click();
    await expect(tool(page, 'b9')).toHaveAttribute('data-moves', String(k + 1));
    seen.add((await values(page, 'b9')).join(','));
    if (seen.size < GOLDEN.types.A3!.n_roots) await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  }
  expect(seen.size).toBe(GOLDEN.types.A3!.n_roots);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: highest root of E6 by raising moves', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b10');
  await hydrate(page, 'b10');
  const moves = GOLDEN.kostant.E6!.moves_from_node[0]!;
  const theta = GOLDEN.types.E6!.highest_root.map(String);
  for (let k = 0; k < moves - 1; k++) {
    await control(page, 'b10', 'step').click();
    await expect(tool(page, 'b10')).toHaveAttribute('data-moves', String(k + 1));
    await expect(challenge.locator('[data-challenge-result]'), `after ${k + 1} raising moves`).toHaveCount(0);
  }
  expect(await values(page, 'b10')).not.toEqual(theta);
  await control(page, 'b10', 'step').click();
  await expect(tool(page, 'b10')).toHaveAttribute('data-moves', String(moves));
  expect(await values(page, 'b10')).toEqual(theta);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: E6 is not met by a play started at the highest root', async ({ page }) => {
  const theta = GOLDEN.types.E6!.highest_root;
  await page.goto(`${ROUTE}?b10.c=p&b10.s=${theta.join(',')}`);
  const challenge = await challengeFor(page, 'b10');
  await hydrate(page, 'b10');
  expect(await values(page, 'b10')).toEqual(theta.map(String));
  await expect(tool(page, 'b10')).toHaveAttribute('data-moves', '0');
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
});

test('challenge: a population no mutation changes', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  const boxes = control(page, 'b11', 'predictAnswer');
  await expect(boxes).toHaveCount(FROZEN.length);
  for (const [k, v] of FROZEN.entries()) await boxes.nth(k).fill(String(v));
  await control(page, 'b11', 'predictCheck').click();
  await expect(out(page, 'b11', 'predictResult')).toHaveText(/^Right/);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: a wrong population is not accepted', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b11');
  await hydrate(page, 'b11');
  const boxes = control(page, 'b11', 'predictAnswer');
  const wrong = FROZEN.map((v, k) => (k === 0 ? v : 0));
  for (const [k, v] of wrong.entries()) await boxes.nth(k).fill(String(v));
  await control(page, 'b11', 'predictCheck').click();
  await expect(out(page, 'b11', 'predictResult')).toHaveText(/^Not quite/);
  await page.waitForTimeout(300);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
});

test('anatomy', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('The mutation game');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('Starting from one Martian, which populations can ever occur?');
  await expect(article.locator('[data-anatomy="draft"]'), 'draft mark (D17)').toHaveCount(1);
  await expect(article.locator('[data-anatomy="beat"]')).toHaveCount(5);
  await expect(article.locator('[data-anatomy="seen"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="lie-theory"]')).toHaveCount(1);
  expect(await article.locator('[data-challenge]').count()).toBeGreaterThanOrEqual(3);
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
  // Instance ids in reading order; the first tool is b1.
  const ids = await page.locator('[data-tool]').evaluateAll((els) => els.map((e) => e.getAttribute('data-instance')));
  expect(ids).toEqual(TOOLS.map(([id]) => id));
  // "What we have seen" carries its provenance, and so does each of its statements.
  const seen = article.locator('[data-anatomy="seen"]');
  expect(await seen.locator('[data-provenance]').count()).toBeGreaterThanOrEqual(1);
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBeGreaterThanOrEqual(3);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation/.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  for (const key of ['W20', 'W03a', 'W-MS', 'Ele16', 'Che17']) await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`)).toHaveCount(1);
});

test('no forbidden statement', async ({ page }) => {
  await page.goto(ROUTE);
  const text = norm(await page.locator('main').innerText());
  for (const re of [/not of finite type/i, /mutates the (?:graph|board)/i, /mutation (?:changes|reverses) (?:the )?(?:graph|roads|edges)/i, /\binfinite type\b/i]) {
    expect(text, String(re)).not.toMatch(re);
  }
  // Beat 5 and its figure: no inference from the cap.
  const beat5 = norm(await page.locator('[data-beat="5"]').innerText());
  expect(beat5).not.toMatch(/infinite|not of finite type|never stops|affine/i);
  expect(beat5).toContain(`stopped after ${TRIANGLE.layers} layers`);
  // The bridge sentence: T9 renders it in SPEC's words; any other copy on the page reads the same.
  for (const id of ['b5', 'b10']) expect(norm(await out(page, id, 'bridgeSentence').textContent())).toBe(BRIDGE);
  // textContent, not innerText: T9 writes the i as MathML, which innerText renders as a math letter.
  const all = norm(await page.locator('article').textContent());
  const copies = all.split('The number on node').length - 1;
  const exact = all.split(BRIDGE).length - 1;
  expect(copies).toBeGreaterThanOrEqual(2);
  expect(exact).toBe(copies);
  expect(all).not.toMatch(/The number on a node/);
});

test('provenance and open-item wraps', async ({ page }) => {
  const source = readFileSync(LESSON_PATH, 'utf8');
  const items = (JSON.parse(readFileSync(UNVERIFIED_PATH, 'utf8')) as { items?: { id: string }[] } | { id: string }[]);
  const known = new Set((Array.isArray(items) ? items : (items.items ?? [])).map((i) => i.id));
  expect(known.has('E4')).toBe(true);
  // (a) and (b): every wrap names an item and carries a fallback.
  const wraps = [...source.matchAll(/<Unverified\b([^>]*)>/g)].map((m) => m[1]!);
  expect(wraps.length).toBeGreaterThanOrEqual(1);
  for (const attrs of wraps) {
    const item = /\bitem="([^"]*)"/.exec(attrs)?.[1] ?? '';
    expect(item, attrs).toMatch(/^E\d+$/);
    const n = Number(item.slice(1));
    expect(n <= 17 ? known.has(item) : PROPOSED_ITEMS.includes(item), `${item} is known or proposed`).toBe(true);
    const fallback = /\bfallback="([^"]*)"/.exec(attrs)?.[1] ?? '';
    expect(fallback.trim(), `${item} fallback`).not.toBe('');
  }
  // (c): every cited key is in the frontmatter's sources.
  const front = /^---\n([\s\S]*?)\n---/.exec(source)![1]!;
  const sources = JSON.parse(/^sources:\s*(\[.*\])\s*$/m.exec(front)![1]!) as string[];
  const cited = new Set([...source.matchAll(/<Cite k="([^"]+)"/g)].map((m) => m[1]!));
  expect(cited.size).toBeGreaterThan(0);
  for (const k of cited) expect(sources, k).toContain(k);
  // (d): the Seen box has a non-empty provenance.
  const seenProv = /<Seen provenance=\{([^}]*)\}>/.exec(source)?.[1] ?? '';
  expect(seenProv.replace(/[[\]'"\s,]/g, '')).not.toBe('');
  // (e): beat 4 writes its three counts through <G>, and the page shows the golden values.
  const beat4Source = /<Beat n=\{4\}>([\s\S]*?)<\/Beat>/.exec(source)![1]!;
  for (const t of ['A3', 'D4', 'E8']) expect(beat4Source, t).toContain(`<G k="types.${t}.n_roots"/>`);
  await page.goto(ROUTE);
  const beat4 = page.locator('[data-beat="4"]');
  for (const t of ['A3', 'D4', 'E8']) {
    await expect(beat4.locator(`p [data-golden="types.${t}.n_roots"]`).first()).toHaveText(String(GOLDEN.types[t]!.n_roots));
  }
  // (f): every open-item mark links to an item of the open-items page.
  const marks = page.locator('a.unverified-mark');
  expect(await marks.count()).toBe(wraps.length);
  const hrefs = await marks.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    const url = new URL(href, page.url());
    const id = url.hash.slice(1);
    const listing = await page.request.get(url.toString().replace(/#.*$/, ''));
    expect(listing.status(), href).toBe(200);
    const body = await listing.text();
    expect(body, `${id} on open-items`).toMatch(new RegExp(`id="${id}"`));
  }
});

test('writing rules that can be checked mechanically', async ({ page }) => {
  await page.goto(ROUTE);
  const text = norm(await page.locator('article').innerText());
  // (a) Kostant's game is "attributed to Kostant" (8.4).
  if (/Kostant's game/i.test(text)) expect(text).toContain('attributed to Kostant');
  // (b) The mutation game is credited to Wildberger.
  const sentences = await proseSentences(page);
  expect(sentences.some((s) => /Wildberger/.test(s) && /mutation game/i.test(s))).toBe(true);
  // (c) No sentence of the prose names both a node and a city (P8).
  const both = sentences.filter((s) => /\bnodes?\b/i.test(s) && /\bcit(?:y|ies)\b/i.test(s));
  expect(both).toEqual([]);
  // (d) Where the Lie theory paragraph writes the reflection with C, it states the convention.
  const tex = await page
    .locator('[data-anatomy="lie-theory"] annotation[encoding="application/x-tex"]')
    .evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, '')));
  if (tex.some((t) => t.includes('C_{ij}p_j'))) {
    expect(tex).toContain('C_{ij}=\\langle\\alpha_i^\\vee,\\alpha_j\\rangle');
    expect(norm(await page.locator('[data-anatomy="lie-theory"]').innerText())).toMatch(/Bourbaki prints its transpose/);
  }
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  // Eleven tools and three challenges.
  expect(islands.length).toBe(TOOLS.length + 3);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T01GameBoard/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  await page.goto(ROUTE);
  for (const [id] of TOOLS) await hydrate(page, id);
  // Excluded, with a request to P1-A6 (decisions/P1-A9.md): T2's layer chart is a scrolling box
  // with no focusable content (scrollable-region-focusable); it is drawn only off the finite types,
  // so /tools/garden does not show it and only b8 has it on this page. Everything else is scanned.
  const results = await new AxeBuilder({ page }).exclude('[data-instance="b8"] .chart-box').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});
