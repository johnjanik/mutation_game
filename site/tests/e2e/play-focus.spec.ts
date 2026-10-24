// Focus after a play control acts (SPEC.md 7.5 A-1 "Every tool is fully operable from the keyboard",
// with WCAG 2.4.3 Focus Order among its criteria; 7.4: controls are disabled until hydration). The
// siblings of P3-RT-05-09 in the tools' play controls: "Step", "Play to the end" and "Play on" took the
// HTML disabled attribute when their own press ended the game or started a play in the worker (busy),
// while they held the focus, so the browser dropped the focus to the page. Each case below presses the
// control by keyboard and, once the play is over, reads where the focus is. The pentagon cases run in
// the worker (playFate, E-9 rule 2), so the control is busy while the play runs.
//
// Since then such a control carries aria-disabled="true" and keeps the focus, so Enter, Space and a click
// still reach it: an aria-disabled control must ignore them (no move, nothing changed, nothing written to
// the live region). T7's Step at the end of the game still announced "Game over after 6 moves.", and T15's
// Play on at the end of the pentagon game was not even aria-disabled and announced "Played 0 moves to the
// end." (RT-FIX residual of P3-RT-05-09). The second half of this file presses every element of a tool
// that carries aria-disabled="true" in each state that sets it and is reachable on the site: the end of
// the game (T1, T5, T7, T8, T9, T15), a play running in the worker (T1, T15; the worker's script is held
// back so the state lasts), a count running (T4 keep counting), a board frozen by an open prediction
// (Board.svelte, one lesson instance of each tool that takes a prediction), and an answered prediction
// (Predict's Check and Show me). T8's graph frozen by a prediction and T9's play on in the worker are on
// no page of the site (no T8 takes a prediction, T9 offers only finite boards); their handlers return
// in that state (WeylGraph `if (!disabled)`, T9 `if (frozen || busy || atEnd)`), read by hand.
// Hooks read: data-tool, data-instance, data-hydrated, data-moves, data-control step, playToEnd, playOn,
// keepCounting, predictShow, predictCheck, showTotal, grow, stepB, playToEndB, addNode, removeNode, data-tab,
// data-node, data-table-node, data-value, data-out (every name, as text), aria-disabled, [data-live].
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  pentagon_example: { start: number[]; moves: number };
};
const PENTAGON = golden.pentagon_example;
const WORKER = /engine\.worker/;

interface Case {
  what: string;
  route: string;
  tool: string;
  control: string;
  /** A tab to open first (T15). */
  tab?: string;
  /** The move count when the play is over; without it, the control is inactive when the play is over. */
  moves?: number;
  /** The play controls that are aria-disabled at the end of the game. */
  ended: string[];
}

const CASES: Case[] = [
  { what: 'T1 play to the end, A3 legal from (1, 1, 1)', route: 'tools/board/?z=1&g=A3&v=n&m=l&c=n&s=1,1,1', tool: 'board', control: 'playToEnd', ended: ['step', 'playToEnd'] },
  { what: 'T1 step that ends the game, A2 legal from (1, 1) after 1, 2', route: 'tools/board/?z=1&g=A2&v=n&m=l&c=n&s=1,1&w=1.2', tool: 'board', control: 'step', ended: ['step', 'playToEnd'] },
  {
    what: 'T1 play on the pentagon (in the worker)',
    route: `tools/board/?z=1&g=pentagon&v=n&m=l&c=n&s=${PENTAGON.start.join(',')}`,
    tool: 'board',
    control: 'playToEnd',
    moves: PENTAGON.moves,
    ended: ['step', 'playToEnd'],
  },
  { what: 'T5 play to the end, A3', route: 'tools/numbers/?g=A3', tool: 'numbers', control: 'playToEnd', ended: ['step', 'playToEnd'] },
  { what: 'T7 play to the end', route: 'tools/symbolic/', tool: 'symbolic', control: 'playToEnd', ended: ['step', 'playToEnd'] },
  { what: 'T8 play to the end', route: 'tools/weyl/', tool: 'weyl', control: 'playToEnd', ended: ['step', 'playToEnd'] },
  { what: 'T9 play to the end', route: 'tools/kostant/', tool: 'kostant', control: 'playToEnd', ended: ['step', 'playToEnd'] },
  { what: 'T15 play on the pentagon (in the worker)', route: 'tools/affine/', tool: 'affine', control: 'playOn', tab: 'pentagon', moves: PENTAGON.moves, ended: ['step', 'playOn'] },
];

async function focusAfter(root: Locator): Promise<{ tag: string | null; control: string | null; inTool: boolean }> {
  return root.evaluate((r) => {
    const a = document.activeElement as HTMLElement | null;
    return { tag: a?.tagName ?? null, control: a?.dataset.control ?? null, inTool: a !== null && r.contains(a) };
  });
}

/** Opens a case and presses its control by keyboard; returns once the play is over. */
async function playCase(page: Page, c: Case): Promise<{ root: Locator; control: Locator }> {
  await page.goto(c.route);
  const root = page.locator(`[data-tool="${c.tool}"]`).first();
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  if (c.tab !== undefined) await root.locator(`[data-tab="${c.tab}"]`).click();
  const control = root.locator(`[data-control="${c.control}"]`);
  await control.focus();
  await page.keyboard.press('Enter');
  if (c.moves !== undefined) await expect(root).toHaveAttribute('data-moves', String(c.moves), { timeout: 30000 });
  else await expect(control).toBeDisabled();
  return { root, control };
}

for (const c of CASES) {
  // regression: P3-RT-05-09
  test(`${c.what}: the pressed control keeps the focus`, async ({ page }) => {
    const { root } = await playCase(page, c);
    await page.waitForTimeout(200);
    expect(await focusAfter(root), `${c.route}: document.activeElement after Enter on ${c.control}`).toEqual({ tag: 'BUTTON', control: c.control, inTool: true });
  });
}

// ---------------------------------------------------------------------------------------------
// An aria-disabled control ignores a press: nothing changes, nothing is said
// ---------------------------------------------------------------------------------------------

/** What a press may not change: the address (every state is a link, 6.6), the move count, every node's value, every data-out line. */
async function stateOf(page: Page, root: Locator): Promise<{ url: string; moves: string | null; values: string[]; outs: string[] }> {
  return {
    url: page.url(),
    moves: await root.getAttribute('data-moves'),
    values: await root.locator('[data-value]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-node') ?? e.tagName}=${e.getAttribute('data-value')}`)),
    outs: await root.locator('[data-out]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-out')}=${(e.textContent ?? '').replace(/\s+/g, ' ').trim()}`)),
  };
}

/** Counts every change of the tool's live region from now on (a write of the same text is a change too: the announcer clears the region first). */
async function watchLive(root: Locator): Promise<() => Promise<number>> {
  const region = root.locator('[data-live]').first();
  await region.evaluate((el) => {
    const host = el as HTMLElement & { __writes?: number };
    host.__writes = 0;
    new MutationObserver((records) => {
      host.__writes = (host.__writes ?? 0) + records.length;
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  return () => region.evaluate((el) => (el as HTMLElement & { __writes?: number }).__writes ?? 0);
}

/** A readable name of an element: its control, its node, its table button, or its tag. */
const nameOf = (el: Element): string =>
  el.getAttribute('data-control') ??
  (el.hasAttribute('data-node')
    ? `node ${el.getAttribute('data-node')}`
    : el.hasAttribute('data-table-node')
      ? `table node ${el.getAttribute('data-table-node')}`
      : (el.getAttribute('data-out') ?? el.tagName));

/**
 * Presses every element of the tool that carries aria-disabled="true" with Enter, with Space and with a
 * click (forced: Playwright's actionability check counts aria-disabled as disabled), waits past the
 * coalescing window of the live region (A-4, 500 ms), and checks that nothing changed and nothing was
 * written. `expected` names elements that must be among those pressed, so the check is never empty.
 */
async function pressesAreIgnored(page: Page, root: Locator, expected: string[], where: string): Promise<void> {
  // Anything said before the presses has been written.
  await page.waitForTimeout(700);
  const before = await stateOf(page, root);
  const writes = await watchLive(root);
  const targets = root.locator('[aria-disabled="true"]');
  const n = await targets.count();
  const pressed: string[] = [];
  for (let k = 0; k < n; k++) {
    const t = targets.nth(k);
    pressed.push(await t.evaluate(nameOf));
    await t.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await t.click({ force: true });
  }
  for (const name of expected) expect(pressed, `${where}: aria-disabled elements pressed`).toContain(name);
  await page.waitForTimeout(1000);
  expect(await writes(), `${where}: live-region writes after pressing ${pressed.join(', ')}`).toBe(0);
  expect(await stateOf(page, root), `${where}: the state after pressing ${pressed.join(', ')}`).toEqual(before);
}

for (const c of CASES) {
  // regression: residual of P3-RT-05-09 (T7 Step at the end announced "Game over"; T15 Play on at the end)
  test(`${c.what}: at the end every aria-disabled control ignores Enter, Space and a click`, async ({ page }) => {
    const { root } = await playCase(page, c);
    for (const name of c.ended) await expect(root.locator(`[data-control="${name}"]`), `${c.what}: ${name} at the end`).toHaveAttribute('aria-disabled', 'true');
    await pressesAreIgnored(page, root, c.ended, c.what);
  });
}

/** Holds back the worker's script until `release` is called, so that a call in the worker stays pending (busy). */
async function holdWorker(page: Page): Promise<() => void> {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(WORKER, async (route) => {
    await gate;
    await route.continue().catch(() => undefined);
  });
  return release;
}

const BUSY: { what: string; route: string; tool: string; control: string; tab?: string; busy: string[] }[] = [
  { what: 'T1 play on the pentagon', route: `tools/board/?z=1&g=pentagon&v=n&m=l&c=n&s=${PENTAGON.start.join(',')}`, tool: 'board', control: 'playToEnd', busy: ['step', 'playToEnd'] },
  { what: 'T15 play on the pentagon', route: 'tools/affine/', tool: 'affine', control: 'playOn', tab: 'pentagon', busy: ['step', 'playOn'] },
];

for (const b of BUSY) {
  // regression: residual of P3-RT-05-09
  test(`${b.what}: while the play runs in the worker every aria-disabled control ignores a press`, async ({ page }) => {
    const release = await holdWorker(page);
    await page.goto(b.route);
    const root = page.locator(`[data-tool="${b.tool}"]`).first();
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    if (b.tab !== undefined) await root.locator(`[data-tab="${b.tab}"]`).click();
    await root.locator(`[data-control="${b.control}"]`).focus();
    await page.keyboard.press('Enter');
    for (const name of b.busy) await expect(root.locator(`[data-control="${name}"]`), `${b.what}: ${name} while busy`).toHaveAttribute('aria-disabled', 'true');
    await expect(root).toHaveAttribute('data-moves', '0');
    await pressesAreIgnored(page, root, b.busy, `${b.what}, busy`);
    // Released, the one play runs to its end: the presses started no second one.
    release();
    await expect(root).toHaveAttribute('data-moves', String(PENTAGON.moves), { timeout: 30000 });
  });
}

// regression: residual of P3-RT-05-09 (T4 keep counting while it counts)
test('T4 keep counting: while the count runs in the worker the button ignores a press', async ({ page }) => {
  const release = await holdWorker(page);
  // The star with five arms (centre 1 joined to 2 to 6, SPEC 6.6 `c:`), as T04.spec.ts.
  const C = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => (i === j ? 2 : i === 0 || j === 0 ? -1 : 0)));
  await page.goto(`tools/lab/?z=1&g=c:${C.map((r) => r.join(',')).join(';')}`);
  const root = page.locator('[data-tool="lab"]').first();
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  await root.locator('[data-control="keepCounting"]').focus();
  await page.keyboard.press('Enter');
  await expect(root.locator('[data-out="counterStatus"]')).toBeVisible();
  await expect(root.locator('[data-control="keepCounting"]')).toHaveAttribute('aria-disabled', 'true');
  await pressesAreIgnored(page, root, ['keepCounting'], 'T4 counting');
  release();
  await expect(root.locator('[data-control="keepCounting"]')).toHaveCount(0, { timeout: 60000 });
});

// One lesson instance of each tool that takes a prediction: while it is open the board is frozen (its node
// buttons aria-disabled, Board.svelte); once answered, Check and Show me are aria-disabled (Predict.svelte).
const PREDICTIONS: { what: string; route: string; id: string; frozen: string[] }[] = [
  { what: 'T1, M0 beat 2', route: 'modules/m0-start/', id: 'b2', frozen: ['node 1', 'node 2', 'node 3'] },
  { what: 'T3, M2 beat 5', route: 'modules/m2-form/', id: 'b5', frozen: [] },
  { what: 'T5, M5 beat 9', route: 'modules/m5-weyl/', id: 'b9', frozen: ['node 1', 'node 2', 'node 3'] },
  { what: 'T9, M1 beat 5', route: 'modules/m1-mutation/', id: 'b5', frozen: ['node 1', 'node 2', 'node 3'] },
  { what: 'T10, M7 beat 4', route: 'modules/m7-geometry/', id: 'b4', frozen: ['node 1', 'node 2', 'node 3'] },
  { what: 'T11, M6 beat 7', route: 'modules/m6-multiple-edges/', id: 'b7', frozen: ['node 1', 'node 2', 'node 3'] },
  { what: 'T15, M3 beat 4', route: 'modules/m3-classification/', id: 'b4', frozen: ['node 1', 'node 2', 'node 3', 'node 4'] },
];

for (const p of PREDICTIONS) {
  // regression: residual of P3-RT-05-09 (Predict's Check and Show me; the frozen board)
  test(`${p.what}: before and after the prediction every aria-disabled control ignores a press`, async ({ page }) => {
    await page.goto(p.route);
    const root = page.locator(`[data-tool][data-instance="${p.id}"]`);
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
    await expect(root.locator('[data-prediction]')).toHaveCount(1);
    if (p.frozen.length > 0) await pressesAreIgnored(page, root, p.frozen, `${p.what}, frozen`);
    await root.locator('[data-control="predictShow"]').click();
    await expect(root.locator('[data-out="predictResult"]')).not.toBeEmpty();
    for (const name of ['predictCheck', 'predictShow']) await expect(root.locator(`[data-control="${name}"]`)).toHaveAttribute('aria-disabled', 'true');
    await pressesAreIgnored(page, root, ['predictCheck', 'predictShow'], `${p.what}, answered`);
  });
}

// The controls that P4-RT-05-01 made aria-disabled (ownpress-focus.spec.ts checks their focus) ignore a press
// in the state that sets the attribute: T2's Show total once shown and Grow one layer at the last layer; T7's
// table button of a node that cannot be fired; T5's Step B and Play B to the end at the end of game B; the
// board editor's Add node at the largest board and Remove node at the smallest.
const OWN_PRESS: { what: string; route: string; tool: string; instance?: string; reach: (page: Page, root: Locator) => Promise<void>; expected: string[] }[] = [
  {
    what: 'T2 Show total once shown',
    route: 'tools/garden/',
    tool: 'garden',
    reach: async (_page, root) => {
      await root.locator('[data-control="showTotal"]').click();
    },
    expected: ['showTotal'],
  },
  {
    what: 'T2 Grow one layer at the last layer',
    route: 'tools/garden/',
    tool: 'garden',
    reach: async (_page, root) => {
      const grow = root.locator('[data-control="grow"]');
      for (let k = 0; k < 40 && (await grow.getAttribute('aria-disabled')) !== 'true'; k++) await grow.click();
    },
    expected: ['grow'],
  },
  {
    what: 'T7 table button of a node that cannot be fired',
    route: 'tools/symbolic/',
    tool: 'symbolic',
    reach: async (_page, root) => {
      await root.locator('summary', { hasText: 'Show as table' }).click();
      await root.locator('[data-table-node="1"]').click();
      await expect(root).toHaveAttribute('data-moves', '1');
    },
    expected: ['table node 1'],
  },
  {
    what: 'T5 Step B and Play B to the end at the end of game B (M4 beat 3)',
    route: 'modules/m4-numbers/',
    tool: 'numbers',
    instance: 'b3',
    reach: async () => {},
    expected: ['stepB', 'playToEndB'],
  },
  {
    what: 'the board editor at the largest board',
    route: 'tools/sandbox/',
    tool: 'sandbox',
    reach: async (_page, root) => {
      const add = root.locator('[data-control="addNode"]');
      for (let k = 0; k < 14 && (await add.getAttribute('aria-disabled')) !== 'true'; k++) await add.click();
    },
    expected: ['addNode'],
  },
  {
    what: 'the board editor at the smallest board',
    route: 'tools/sandbox/',
    tool: 'sandbox',
    reach: async (_page, root) => {
      const remove = root.locator('[data-control="removeNode"]');
      for (let k = 0; k < 14 && (await remove.getAttribute('aria-disabled')) !== 'true'; k++) await remove.click();
    },
    expected: ['removeNode'],
  },
];

for (const o of OWN_PRESS) {
  // regression: P4-RT-05-01 (an aria-disabled control ignores a press, RT-FIX-P3-residual-tools)
  test(`${o.what}: every aria-disabled control ignores Enter, Space and a click`, async ({ page }) => {
    await page.goto(o.route);
    const root = page.locator(o.instance === undefined ? `[data-tool="${o.tool}"]` : `[data-tool="${o.tool}"][data-instance="${o.instance}"]`).first();
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    await o.reach(page, root);
    await pressesAreIgnored(page, root, o.expected, o.what);
  });
}
