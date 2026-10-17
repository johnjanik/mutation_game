// P1-A8: lesson M0, "Start here: two games, one board", against the built site (SPEC.md 3 M0, 8.2,
// 8.4, 9.2, 4.0, 7.4, 7.5, 7.6; build-plan/agents/P1-A8-lesson-m0.md 5.13). Run after `npm run build`
// against `astro preview`, one Playwright run at a time. This file is the pattern later lessons copy:
// its helpers (open, tool, values, live, prose words, the numbers-in-prose call) are kept readable.
//
// Hooks read, and where they come from:
//   tool roots (P1-A2 ToolFrame): data-tool="board", data-instance (b1 to b7), data-moves,
//     data-hydrated="true", data-live (the polite live region)
//   node buttons (P0-A5 Board, P1-A5): data-node, data-board (populations | numbers), data-value,
//     data-can-act
//   data-out (registry site/src/tools/registry/T01.ts, T01_OUTS): caption, noscript, mode,
//     bridgeSentence, goal, goalMet, predictResult, predictReveal
//   data-control (P1-A5 Predict.svelte): predictAnswer, predictCheck, predictShow
//   data-prediction (P1-A5 Predict.svelte): the prediction block, holding its <details> without JavaScript
//   lesson anatomy (P1-A4 Lesson.astro and site/src/components/lesson): data-anatomy = title,
//     question, draft, beat, figure, seen, lie-theory, links, sources; data-beat; data-provenance;
//     data-challenge, data-met, data-challenge-result (text "Goal reached."); data-link
//   this lesson's own markup: data-statements (the list of beat 5), data-module-link,
//     data-bridge-prose (the prose copy of the bridge sentence), data-seen-statement,
//     data-view-word (populations | numbers: the name of a view in prose, with its icon and underline)
//
// Word-counting rule (test 4; later lessons reuse it): the words of the <article> after removing
// every tool root ([data-tool]), every <details> (prediction reveals, challenge explanations, the
// tables of A-10), every live or status region, the draft mark and the list of sources entries; each
// KaTeX formula counts as one word. A word is a run of characters other than white space.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanSource } from '../../../scripts/numbers-in-prose.mjs';
import { distDir } from './routes';

const ROUTE = 'modules/m0-start/';
const LESSON = fileURLToPath(new URL('../../src/content/modules/m0-start.mdx', import.meta.url));
const GOLDEN = fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url));
const BUILT = `${distDir()}/modules/m0-start/index.html`;
const TOOL_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const;
const BRIDGE = 'The number on node i is the amount by which a mutation would lower city i.';
/** The modules whose frontmatter says released: true (MERGE, P4 wave 4.3: read from the content files,
 *  so that each phase's release no longer needs this test edited). */
const MODULES_DIR = fileURLToPath(new URL('../../src/content/modules/', import.meta.url));
const RELEASED_SLUGS = new Set(
  readdirSync(MODULES_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .filter((f) => /^released:\s*true\s*$/m.test(readFileSync(MODULES_DIR + f, 'utf8').split(/^---\s*$/m)[1] ?? ''))
    .map((f) => f.replace(/\.mdx$/, '')),
);

type BoardName = 'populations' | 'numbers';

interface A3Golden {
  highest_root: number[];
  longest_word: number[];
}
const A3 = (JSON.parse(readFileSync(GOLDEN, 'utf8')) as { types: { A3: A3Golden } }).types.A3;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool][data-instance="${id}"]`);
const out = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-out="${name}"]`);
const control = (page: Page, id: string, name: string): Locator => tool(page, id).locator(`[data-control="${name}"]`);
const node = (page: Page, id: string, board: BoardName, label: number): Locator =>
  tool(page, id).locator(`button[data-board="${board}"][data-node="${label}"]`);
const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** The values of one board of a tool, in label order, as data-value text. */
async function values(page: Page, id: string, board: BoardName): Promise<string[]> {
  return tool(page, id)
    .locator(`button[data-board="${board}"][data-node]`)
    .evaluateAll((els) =>
      els
        .map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value') ?? ''] as const)
        .sort((a, b) => a[0] - b[0])
        .map((p) => p[1]),
    );
}

/** Scrolls a tool into view (its island is client:visible) and waits for hydration. */
async function hydrate(page: Page, id: string): Promise<void> {
  await tool(page, id).scrollIntoViewIfNeeded();
  await expect(tool(page, id)).toHaveAttribute('data-hydrated', 'true');
}

/** The challenge that watches a tool, and waits until its island has hydrated. */
async function challengeFor(page: Page, id: string): Promise<Locator> {
  // The island's props name the instance it watches (Astro serialises them in the attribute props).
  const islands = page.locator('astro-island[component-export="Challenge"]');
  const k = await islands.evaluateAll((els, want) => els.findIndex((e) => (e.getAttribute('props') ?? '').includes(`"${want}"`)), id);
  expect(k, `a Challenge watches ${id}`).toBeGreaterThanOrEqual(0);
  const target = islands.nth(k);
  // astro-island is display: contents, so the challenge box itself is scrolled into view.
  await target.locator('[data-challenge]').scrollIntoViewIfNeeded();
  await expect(target).not.toHaveAttribute('ssr', '');
  return target.locator('[data-challenge]');
}

/** The text of a tool's live region, once it has settled on `text`. */
async function expectLive(page: Page, id: string, text: string): Promise<void> {
  await expect.poll(async () => norm(await tool(page, id).locator('[data-live]').textContent()), { timeout: 5000 }).toBe(text);
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

// ---------------------------------------------------------------------------------------------
// Without JavaScript
// ---------------------------------------------------------------------------------------------

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the five figures are present', async ({ page }) => {
    const response = await page.goto(ROUTE);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-tool="board"]')).toHaveCount(TOOL_IDS.length);
    for (const id of TOOL_IDS) {
      const root = tool(page, id);
      await expect(root, id).toHaveCount(1);
      await expect(root.locator('svg').first(), `${id} svg`).toBeVisible();
      expect(await root.locator('button[data-node]').count(), `${id} node buttons`).toBeGreaterThanOrEqual(3);
      expect(norm(await out(page, id, 'caption').textContent()), `${id} caption`).not.toBe('');
      await expect(out(page, id, 'noscript'), `${id} noscript line`).toHaveText('Interactive when scripts are allowed.');
      const enabled = await root.locator('button, input, select, textarea').evaluateAll((els) => els.filter((e) => !(e as HTMLButtonElement).disabled).length);
      expect(enabled, `${id} controls disabled`).toBe(0);
    }
    // Beat 1: one Martian in the middle city, populations only.
    await expect(tool(page, 'b1').locator('button[data-node][data-board="numbers"]')).toHaveCount(0);
    expect(await values(page, 'b1', 'populations')).toEqual(['0', '1', '0']);
    // Beat 2: the start of the prediction.
    expect(await values(page, 'b2', 'populations')).toEqual(['1', '1', '0']);
    // Beat 3: numbers only.
    await expect(tool(page, 'b3').locator('button[data-node][data-board="populations"]')).toHaveCount(0);
    expect(await values(page, 'b3', 'numbers')).toEqual(['0', '1', '0']);
    // Beat 4: both boards and the bridge sentence.
    expect(await values(page, 'b4', 'populations')).toEqual(['0', '1', '0']);
    expect(await values(page, 'b4', 'numbers')).toEqual(['-1', '2', '-1']);
    expect(norm(await out(page, 'b4', 'bridgeSentence').textContent())).toBe(BRIDGE);
    // Beat 5: the static list of seven statements, with an accessible name.
    const list = page.locator('[data-beat="5"] [data-statements]');
    await expect(list).toHaveAttribute('aria-label', /seven statements/);
    await expect(list.locator(':scope > li')).toHaveCount(7);
    await expect(page.locator('[data-beat="5"] figcaption')).not.toHaveText('');
    // Prose is there.
    expect(await proseWords(page)).toBeGreaterThan(800);
  });

  test('the prediction has a details fallback', async ({ page }) => {
    await page.goto(ROUTE);
    const predictions = page.locator('[data-prediction]');
    expect(await predictions.count()).toBeGreaterThanOrEqual(2);
    const expected: Record<string, RegExp> = { b2: /^0$/, b4: /^-1$|^−1$/ };
    for (const [id, answer] of Object.entries(expected)) {
      const block = tool(page, id).locator('[data-prediction]');
      await expect(block, id).toHaveCount(1);
      const details = block.locator('details');
      await expect(details, `${id} details`).toHaveCount(1);
      // The question comes before the details element.
      const order = await block.evaluate((el) => {
        const q = el.querySelector('.question');
        const d = el.querySelector('details');
        return !!q && !!d && (q.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      });
      expect(order, `${id}: question then details`).toBe(true);
      expect(norm(await details.locator('.answer-text').textContent())).toMatch(answer);
      expect(norm(await details.textContent()).length, `${id}: the reveal`).toBeGreaterThan(20);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// With JavaScript
// ---------------------------------------------------------------------------------------------

test('the prediction freezes the board until answered', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b2');
  for (const label of [1, 2, 3]) await expect(node(page, 'b2', 'populations', label)).toHaveAttribute('data-can-act', 'false');
  // A click on a frozen board does nothing.
  await node(page, 'b2', 'populations', 2).click({ force: true });
  await expect(tool(page, 'b2')).toHaveAttribute('data-moves', '0');
  expect(await values(page, 'b2', 'populations')).toEqual(['1', '1', '0']);
  // Answer 0 and check.
  await control(page, 'b2', 'predictAnswer').fill('0');
  await control(page, 'b2', 'predictCheck').click();
  await expect(out(page, 'b2', 'predictResult')).toHaveText(/^Right/);
  await expect(out(page, 'b2', 'predictReveal')).not.toHaveText('');
  for (const label of [1, 2, 3]) await expect(node(page, 'b2', 'populations', label)).toHaveAttribute('data-can-act', 'true');
  await node(page, 'b2', 'populations', 2).click();
  await expect(tool(page, 'b2')).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'b2', 'populations')).toEqual(['1', '0', '0']);
});

test('the second prediction freezes beat 4 until "show me"', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b4');
  for (const board of ['populations', 'numbers'] as const) {
    for (const label of [1, 2, 3]) await expect(node(page, 'b4', board, label)).toHaveAttribute('data-can-act', 'false');
  }
  await control(page, 'b4', 'predictShow').click();
  await expect(out(page, 'b4', 'predictResult')).toHaveText(/answer is (-|−)1/);
  await expect(node(page, 'b4', 'populations', 2)).toHaveAttribute('data-can-act', 'true');
});

test('word count between 800 and 1800', async ({ page }) => {
  await page.goto(ROUTE);
  const words = await proseWords(page);
  console.info(`M0 prose words: ${words}`);
  expect(words).toBeGreaterThanOrEqual(800);
  expect(words).toBeLessThanOrEqual(1800);
});

test('no em-dash in the built text', async ({ page }) => {
  const html = readFileSync(BUILT, 'utf8');
  expect(html.includes('\u2014'), 'U+2014 in the built HTML').toBe(false);
  await page.goto(ROUTE);
  const text = await page.locator('main').innerText();
  expect(text.includes('\u2014'), 'U+2014 in the text').toBe(false);
  expect(text.includes('\u2013'), 'U+2013 in the text').toBe(false);
});

test('numbers-in-prose finds no prose number in m0-start.mdx', () => {
  const findings = scanSource(readFileSync(LESSON, 'utf8'), 'site/src/content/modules/m0-start.mdx');
  // Reading of "empty" (decisions/P1-A8.md): no finding in either section. Every formula with a
  // digit goes through <Tex>, every golden number through <G>, <Tex> {{path}} or resolveGoldenPath.
  expect(findings.filter((f) => f.kind === 'prose')).toEqual([]);
  expect(findings.filter((f) => f.kind === 'formula')).toEqual([]);
});

test('beat 1: mutating city 1 meets the goal', async ({ page }) => {
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  await expect(out(page, 'b1', 'goal')).toHaveText('Goal: mutate city 1.');
  await expect(out(page, 'b1', 'goalMet')).toHaveText('');
  await node(page, 'b1', 'populations', 1).click();
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'b1', 'populations')).toEqual(['1', '1', '0']);
  await expect(out(page, 'b1', 'goalMet')).toHaveText('Goal reached.');
  // A-4 template; T1 appends the goal sentence to the move that meets the goal (decisions/P1-A5.md).
  await expectLive(page, 'b1', 'Mutated city 1. Populations now 1, 1, 0. Move 1. Goal reached.');
});

test('beat 3: firing node 2 gives (1,-1,1)', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b3');
  await expect(out(page, 'b3', 'mode')).toHaveText('free play');
  await node(page, 'b3', 'numbers', 2).click();
  await expect(tool(page, 'b3')).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'b3', 'numbers')).toEqual(['1', '-1', '1']);
  await expectLive(page, 'b3', 'Fired node 2. Numbers now 1, minus 1, 1. Move 1.');
});

test('beat 4: the linked view shows (-1,2,-1) and mutating city 2 lowers it by 2', async ({ page }) => {
  await page.goto(ROUTE);
  await hydrate(page, 'b4');
  expect(await values(page, 'b4', 'populations')).toEqual(['0', '1', '0']);
  expect(await values(page, 'b4', 'numbers')).toEqual(['-1', '2', '-1']);
  expect(norm(await out(page, 'b4', 'bridgeSentence').textContent())).toBe(BRIDGE);
  await control(page, 'b4', 'predictAnswer').fill('-1');
  await control(page, 'b4', 'predictCheck').click();
  await expect(out(page, 'b4', 'predictResult')).toHaveText(/^Right/);
  await node(page, 'b4', 'populations', 2).click();
  await expect(tool(page, 'b4')).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'b4', 'populations')).toEqual(['0', '-1', '0']);
  expect(await values(page, 'b4', 'numbers')).toEqual(['1', '-2', '1']);
  await expectLive(page, 'b4', 'Mutated city 2 and fired node 2. Populations now 0, minus 1, 0; numbers now 1, minus 2, 1. Move 1.');
});

test('bridge sentence in the prose matches', async ({ page }) => {
  await page.goto(ROUTE);
  const t1 = norm(await out(page, 'b4', 'bridgeSentence').textContent());
  expect(t1).toBe(BRIDGE);
  // The prose copy sits in beat 4, beside the linked figure, and reads exactly as T1's.
  const prose = page.locator('[data-beat="4"] [data-bridge-prose]');
  await expect(prose).toHaveCount(1);
  expect(norm(await prose.textContent())).toBe(t1);
  // Every copy of the sentence on the page has the same wording (SPEC 2.4(a) [D]).
  const text = norm(await page.locator('article').textContent());
  const copies = text.split('The number on node').length - 1;
  expect(copies).toBeGreaterThanOrEqual(3);
  const exact = text.split(BRIDGE).length - 1;
  expect(exact).toBe(copies);
});

test('beat 5: seven statements, links only to released modules', async ({ page, request }) => {
  await page.goto(ROUTE);
  const list = page.locator('[data-statements]');
  await expect(list.locator(':scope > li')).toHaveCount(7);
  const hrefs = await list.locator('a').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  const base = new URL(page.url()).pathname.replace(/modules\/m0-start\/?$/, '');
  for (const href of hrefs) {
    expect(href.startsWith('/') ? href.startsWith(base) : true, `${href} respects the base ${base}`).toBe(true);
    // A link to a module must name a released one (the frontmatter flag), whichever phase is built.
    const slug = /modules\/(m\d+-[a-z0-9-]+)\/?/.exec(href)?.[1];
    if (slug !== undefined) expect(RELEASED_SLUGS.has(slug), `${href} targets an unreleased module`).toBe(true);
    const res = await request.get(new URL(href, page.url()).toString());
    expect(res.status(), href).toBe(200);
  }
});

test('anatomy', async ({ page }) => {
  await page.goto(ROUTE);
  const article = page.locator('article');
  await expect(article.locator('[data-anatomy="title"]')).toHaveText('Start here: two games, one board');
  await expect(article.locator('[data-anatomy="question"]')).toHaveText('What can you learn from the simplest possible moves on a small graph?');
  await expect(article.locator('[data-anatomy="draft"]'), 'draft mark (D17)').toHaveCount(1);
  await expect(article.locator('[data-anatomy="beat"]')).toHaveCount(5);
  await expect(article.locator('[data-anatomy="seen"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="lie-theory"]')).toHaveCount(1);
  expect(await article.locator('[data-challenge]').count()).toBeGreaterThanOrEqual(3);
  await expect(article.locator('[data-anatomy="links"]')).toHaveCount(1);
  await expect(article.locator('[data-anatomy="sources"]')).toHaveCount(1);
  // The order of 8.2: title, question, draft mark, first figure (b1 in beat 1), beats 1 to 5, Seen,
  // Lie theory, challenges, links, sources.
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
  // The first tool on the page is b1, and every beat of 1 to 4 holds one tool in its figure slot.
  await expect(page.locator('[data-tool]').first()).toHaveAttribute('data-instance', 'b1');
  for (const [beat, id] of [[1, 'b1'], [2, 'b2'], [3, 'b3'], [4, 'b4']] as const) {
    await expect(page.locator(`[data-beat="${beat}"] [data-anatomy="figure"] [data-tool]`)).toHaveAttribute('data-instance', id);
  }
  // Every statement of "What we have seen" carries its provenance: a citation or the words
  // "verified by computation"; the box names its provenance too.
  const seen = article.locator('[data-anatomy="seen"]');
  const statements = seen.locator('[data-seen-statement]');
  expect(await statements.count()).toBeGreaterThanOrEqual(3);
  for (let k = 0; k < (await statements.count()); k++) {
    const s = statements.nth(k);
    const cited = await s.locator('a.cite').count();
    const computed = /verified by computation/.test(norm(await s.textContent()));
    expect(cited > 0 || computed, `Seen statement ${k + 1} has a provenance`).toBe(true);
  }
  expect(await seen.locator('[data-provenance]').count()).toBeGreaterThanOrEqual(1);
  // Sources: every key of the frontmatter is listed.
  for (const key of ['W20', 'W-MS', 'Moz90', 'Pro84', 'Eri92']) await expect(article.locator(`[data-anatomy="sources"] [data-source="${key}"]`)).toHaveCount(1);
});

test('challenge: reach the highest root population from one Martian in city 2', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b5');
  await expect(challenge).toHaveAttribute('data-kind', 'reach');
  await hydrate(page, 'b5');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await node(page, 'b5', 'populations', 1).click();
  await expect(tool(page, 'b5')).toHaveAttribute('data-moves', '1');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  await node(page, 'b5', 'populations', 3).click();
  expect(await values(page, 'b5', 'populations')).toEqual(A3.highest_root.map(String));
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
  await expect(challenge).toHaveAttribute('data-met', 'true');
});

test('challenge: from the numbers (1, 1, 1) reach (-1, -1, -1)', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b6');
  await hydrate(page, 'b6');
  expect(await values(page, 'b6', 'numbers')).toEqual(['1', '1', '1']);
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  // A complete legal play from all ones; every node fired has a positive number (free play allows it).
  const word = A3.longest_word;
  for (const [k, label] of word.entries()) {
    await node(page, 'b6', 'numbers', label).click();
    await expect(tool(page, 'b6')).toHaveAttribute('data-moves', String(k + 1));
    if (k < word.length - 1) await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  }
  expect(await values(page, 'b6', 'numbers')).toEqual(['-1', '-1', '-1']);
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('challenge: reach a population at which no number is positive', async ({ page }) => {
  await page.goto(ROUTE);
  const challenge = await challengeFor(page, 'b7');
  await expect(challenge).toHaveAttribute('data-kind', 'out');
  await hydrate(page, 'b7');
  await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
  for (const label of [2, 1]) {
    await node(page, 'b7', 'populations', label).click();
    await expect(challenge.locator('[data-challenge-result]')).toHaveCount(0);
    await expect(out(page, 'b7', 'goalMet')).toHaveText('');
  }
  await node(page, 'b7', 'populations', 3).click();
  expect(await values(page, 'b7', 'populations')).toEqual(['-1', '-1', '-1']);
  const numbers = await values(page, 'b7', 'numbers');
  expect(numbers.every((v) => !/^[1-9]/.test(v))).toBe(true);
  await expect(out(page, 'b7', 'goalMet')).toHaveText('Goal reached.');
  await expect(challenge.locator('[data-challenge-result]')).toHaveText('Goal reached.');
});

test('islands: the first tool is idle, the others visible', () => {
  const html = readFileSync(BUILT, 'utf8');
  const islands = html.match(/<astro-island\b[^>]*>/g) ?? [];
  // Seven tools and three challenges.
  expect(islands.length).toBe(TOOL_IDS.length + 3);
  expect(islands[0]).toMatch(/\sclient="idle"/);
  expect(islands[0]).toMatch(/component-url="[^"]*T01GameBoard/);
  expect(islands[0]).toMatch(/&quot;b1&quot;/);
  for (const island of islands.slice(1)) expect(island).toMatch(/\sclient="visible"/);
});

test('no forbidden statement', async ({ page }) => {
  await page.goto(ROUTE);
  const text = norm(await page.locator('main').innerText());
  const forbidden = [
    /mutates the graph/i,
    /mutation (?:changes|reverses|toggles) (?:the )?(?:graph|roads|edges|arrows)/i,
    /acts? on the weight lattice/i,
    /populations (?:are|lie|live) (?:in|on) the weight lattice/i,
    /the two games are the same/i,
    /games (?:coincide|are identical)/i,
    /combinatorial shadow/i,
    /\b2003\b/,
    /not of finite type/i,
  ];
  for (const re of forbidden) expect(text, String(re)).not.toMatch(re);
});

test('axe: no serious or critical violations on the lesson at 360 pixels', async ({ page }) => {
  // a11y.spec.ts (P0-A5) lists its routes by name and does not include lessons yet; this repeats its
  // rule for M0, with the tags of T01.spec.ts. A display formula wider than the column fails here
  // (scrollable-region-focusable), so display formulas are kept narrow.
  await page.goto(ROUTE);
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
});

test('instance prefix: b3.w=2 opens beat 3 with node 2 fired', async ({ page }) => {
  await page.goto(`${ROUTE}?b3.w=2`);
  await hydrate(page, 'b3');
  await expect(tool(page, 'b3')).toHaveAttribute('data-moves', '1');
  expect(await values(page, 'b3', 'numbers')).toEqual(['1', '-1', '1']);
  // Other instances keep their own state.
  await expect(tool(page, 'b1')).toHaveAttribute('data-hydrated', 'true');
  await expect(tool(page, 'b1')).toHaveAttribute('data-moves', '0');
});

// ---------------------------------------------------------------------------------------------
// Regressions (red team round 1, phases 0 to 3), adopted from the lens branches for M0 only:
// the other lessons that the same findings name are checked by their own files.
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // RT-13 attack 13: a term met before it is taught. SPEC 8.4 "Define every term on first use and
  // link later uses to a glossary entry"; 1.2. M0 opens the reader's path M0 to M5, so a term first
  // used here is first used on the path. A block is a prose paragraph or list item, or a figure's
  // visible caption and outputs, in document order; the first block that uses the term must define
  // it (that block or the next), or link the glossary.
  const TERMS: { term: string; use: RegExp; definition: RegExp }[] = [
    { term: 'finite (finite type)', use: /\bfinite type\b/, definition: /closes up when it has finitely many root populations/ },
    { term: 'affine', use: /\baffine\b/, definition: /the site calls them affine/ },
    { term: 'highest root', use: /\bhighest root\b/, definition: /This end is the highest root of the board/ },
  ];

  interface Block { text: string; glossary: boolean }

  /** The blocks of the lesson; the seven statements of beat 5 are left out unless `statements`. */
  async function termBlocks(page: Page, statements: boolean): Promise<Block[]> {
    await page.goto(ROUTE);
    return page.evaluate((statements) => {
      const out: { text: string; glossary: boolean }[] = [];
      const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('details:not([open])');
      const text = (el: Element) => { const c = el.cloneNode(true) as Element; c.querySelectorAll('.katex-mathml, details, [data-live], .visually-hidden').forEach((x) => x.remove()); return (c.textContent ?? '').replace(/\s+/g, ' ').trim(); };
      const skip = statements ? '[data-anatomy="lie-theory"], [data-anatomy="sources"]' : '[data-anatomy="lie-theory"], [data-anatomy="sources"], [data-statements]';
      for (const el of document.querySelectorAll('article p, article li, article figcaption, article [data-out]')) {
        if (!visible(el)) continue;
        if (el.matches('p, li') && el.querySelector('p, li')) continue;
        if (el.closest(skip)) continue; // beat 5 says its statements use names a later module explains
        const t = text(el);
        if (t) out.push({ text: t, glossary: !!el.querySelector('a[href*="glossary"]') });
      }
      return out;
    }, statements);
  }

  function undefinedTerms(all: Block[]): string[] {
    const problems: string[] = [];
    for (const { term, use, definition } of TERMS) {
      const first = all.findIndex((b) => use.test(b.text));
      const def = all.findIndex((b) => definition.test(b.text));
      if (first < 0) continue;
      const ok = all[first]!.glossary || def === first || def === first + 1;
      if (!ok) problems.push(`${term}: first used on /${ROUTE} in "${all[first]!.text.slice(0, 160)}"; ${def < 0 ? 'not defined in M0' : `defined in "${all[def]!.text.slice(0, 100)}"`}`);
    }
    return problems;
  }

  // regression: P3-RT-13-06
  test('finite type and highest root are defined or linked at their first occurrence in M0', async ({ page }) => {
    const problems = undefinedTerms(await termBlocks(page, false));
    expect(problems, problems.join('\n')).toEqual([]);
  });

  // The same rule with the seven statements of beat 5 read too: their list of names that a later
  // module explains does not name "affine", so its first use, in statement five, needs the link.
  // regression: P3-RT-13-06 (sibling)
  test('affine is linked at its first occurrence in M0, in the seven statements', async ({ page }) => {
    const problems = undefinedTerms(await termBlocks(page, true));
    expect(problems, problems.join('\n')).toEqual([]);
  });

  // RT-13 attack 27: SPEC 8.1 P8 ("Populations and Numbers have fixed colours and icons in prose,
  // figures and formulas"); 8.3 ("They mark the borders and icons of panels and the underlines of the
  // two words"; "Icons: a small city for Populations, a small numbered disc for Numbers, used wherever
  // the view is named"). Light theme.
  async function load(page: Page): Promise<void> {
    await page.goto(ROUTE);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-tool]')].every((t) => t.getAttribute('data-hydrated') === 'true'), null, { timeout: 60000 });
  }

  // regression: P3-RT-13-08
  test('the words Populations and Numbers in the prose of M0 carry the accent underline and the icon of their view', async ({ page }) => {
    test.setTimeout(120000);
    const problems: string[] = [];
    for (const word of ['Numbers', 'Populations']) {
      await load(page);
      const found = await page.evaluate((word) => {
        const res: { text: string; underline: string; colour: string; icon: boolean }[] = [];
        const walker = document.createTreeWalker(document.querySelector('article')!, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement!;
          if (el.closest('[data-tool], details, .katex')) continue;
          if (!new RegExp(`\\b${word}\\b`).test(n.textContent ?? '')) continue;
          const cs = getComputedStyle(el);
          const icon = !!(el.querySelector('svg') || el.previousElementSibling?.matches('svg, img') || el.closest('[data-view-word]')?.querySelector('svg'));
          res.push({ text: (n.textContent ?? '').trim().slice(0, 60), underline: cs.textDecorationLine, colour: cs.textDecorationColor, icon });
        }
        return res;
      }, word);
      const accent = word === 'Populations' ? 'rgb(0, 158, 115)' : 'rgb(204, 121, 167)';
      if (found.length === 0) problems.push(`${ROUTE}: the word ${word} not found in prose`);
      for (const f of found) if (!f.underline.includes('underline') || f.colour !== accent || !f.icon) problems.push(`${ROUTE}: "${f.text}" underline=${f.underline} colour=${f.colour} icon=${f.icon}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
