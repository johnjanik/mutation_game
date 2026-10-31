// P6-A3: the keyboard script of T13 (gate G6, "keyboard scripts for T1, T4, T13"; SPEC.md 7.5 A-1, A-4; 4 T13
// Decorate and Restricted board). Keyboard only: no click and no pointer. The focus is moved with Tab, Shift+Tab,
// the arrow keys, Home and End; Enter and Space act; `u` undoes and `r` redoes while the focus is inside a board.
// Hooks read: data-tool, data-hydrated, data-node, data-value, data-colour, data-control ("tau", "reset"),
// data-panel-tab, aria-selected, tabindex (roving), data-out ("decoration", "restricted-board", "black-nodes",
// "tau", "light-1" to "light-3", "verdict", "composite-length", "shadow-coordinates", "moveCounter") and the live
// region [data-live].
import { expect, test, type Locator, type Page } from '@playwright/test';
import { boardFromName, toPositions } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';

test.use({ reducedMotion: 'reduce' });

const ROUTE = 'tools/satake/';
const MINUS = '−';
const root = (page: Page): Locator => page.locator('[data-tool="satake"]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${ROUTE}?${query}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

/** Presses `key` until the focused element matches `selector` (inside the tool), at most `max` times. */
async function pressUntil(page: Page, key: string, selector: string, max = 120): Promise<void> {
  for (let k = 0; k < max; k++) {
    const hit = await page.evaluate((sel) => document.activeElement?.closest(sel) !== null && document.activeElement?.closest(sel) !== undefined, selector);
    if (hit) return;
    await page.keyboard.press(key);
  }
  throw new Error(`no focus on ${selector} after ${max} presses of ${key}`);
}

const focused = (page: Page, attr: string): Promise<string | null> => page.evaluate((a) => document.activeElement?.getAttribute(a) ?? null, attr);

/** A-1: each board is a group whose node buttons hold exactly one tab stop (roving tabindex). */
async function expectOneTabStop(page: Page, name: string): Promise<void> {
  const group = out(page, name).locator('[role="group"]');
  await expect(group, name).toHaveCount(1);
  const nodes = group.locator('button[data-node]');
  expect(await nodes.count(), name).toBeGreaterThan(1);
  await expect(group.locator('button[data-node][tabindex="0"]'), name).toHaveCount(1);
  await expect(group.locator('button[data-node]:not([tabindex="0"])'), name).toHaveCount((await nodes.count()) - 1);
}

test('keyboard only: paint nodes, choose tau and read the lights', async ({ page }) => {
  await open(page, 'g=A2&x=&t=1.2');
  // the decoration and the game board each hold one tab stop
  await expectOneTabStop(page, 'decoration');
  await expectOneTabStop(page, 'game-board');
  // Tab into the decoration: one tab stop, the lowest label
  await pressUntil(page, 'Tab', '[data-tool="satake"] [data-out="decoration"]');
  expect(await focused(page, 'data-node')).toBe('1');
  await page.keyboard.press('ArrowRight');
  expect(await focused(page, 'data-node')).toBe('2');
  await expectOneTabStop(page, 'decoration');
  await expect(out(page, 'decoration').locator('button[data-node="2"]')).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('ArrowLeft');
  expect(await focused(page, 'data-node')).toBe('1');
  // Enter paints node 1 black; the live region announces the three verdicts
  await page.keyboard.press('Enter');
  await expect(live(page)).toHaveText('Node 1 painted black. Condition 1 holds, condition 2 holds, condition 3 fails. Not admissible.');
  await expect(out(page, 'black-nodes')).toHaveText('1');
  await expect(out(page, 'light-3')).toHaveText('fails');
  // back to the tau picker (a radio group): the arrow key chooses the flip
  await pressUntil(page, 'Shift+Tab', '[data-tool="satake"] [data-control="tau"]');
  expect(await focused(page, 'data-tau')).toBe('1.2');
  await page.keyboard.press('ArrowRight');
  await expect(out(page, 'tau')).toHaveText('2.1');
  await expect(live(page)).toHaveText(/^τ exchanges 1 and 2\. Condition 1 fails, condition 2 fails, condition 3 holds\. Not admissible\.$/);
  // Tab back into the decoration: the focus returns to node 1, and Enter paints it white again
  await pressUntil(page, 'Tab', '[data-tool="satake"] [data-out="decoration"]');
  expect(await focused(page, 'data-node')).toBe('1');
  await page.keyboard.press('Enter');
  await expect(live(page)).toHaveText('Node 1 painted white. Condition 1 holds, condition 2 holds, condition 3 holds. Admissible.');
  for (const k of [1, 2, 3]) await expect(out(page, `light-${k}`)).toHaveText('holds');
  await expect(out(page, 'verdict')).toHaveText('admissible');
  await expect(out(page, 'decoration').locator('button[data-node="1"]')).toHaveAttribute('data-colour', 'white');
});

test('keyboard only: a restricted node plays its composite move and u undoes it', async ({ page }) => {
  await open(page, 'g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
  const board = boardFromName('E6') as Board<number>;
  // the default root alpha_6, in label order
  const start = [...board.labels].sort((a, b) => a - b).map((l) => (toPositions(board, [l])[0] === toPositions(board, [6])[0] ? '1' : '0'));
  // the panels are tabs with automatic activation: the arrow keys open the restricted board
  await pressUntil(page, 'Tab', '[data-tool="satake"] [role="tab"]');
  for (let k = 0; k < 6; k++) {
    if ((await focused(page, 'data-panel-tab')) === 'restricted') break;
    await page.keyboard.press('ArrowRight');
  }
  await expect(root(page).locator('[data-panel-tab="restricted"]')).toHaveAttribute('aria-selected', 'true');
  await pressUntil(page, 'Tab', '[data-tool="satake"] [data-out="restricted-board"]');
  expect(await focused(page, 'data-node')).toBe('1');
  await expectOneTabStop(page, 'decoration');
  await expectOneTabStop(page, 'game-board');
  await expectOneTabStop(page, 'restricted-board');
  await page.keyboard.press('ArrowRight');
  expect(await focused(page, 'data-node')).toBe('2');
  await expectOneTabStop(page, 'restricted-board');
  await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
  await page.keyboard.press('Enter');
  await expect(out(page, 'composite-length')).toHaveText('8');
  await expect(out(page, 'shadow-coordinates')).toHaveText(`(0, ${MINUS}1)`);
  await expect(out(page, 'moveCounter')).toHaveText('1');
  await expect(live(page)).toHaveText(/^Played the composite move of restricted node 2, \d+ mutations\. Shadow coordinates now 0, minus 1\. City \d+ now .*\. Move 1\.$/);
  // a second time: the reflection twice gives the shadow back
  await page.keyboard.press('Enter');
  await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
  await expect(out(page, 'moveCounter')).toHaveText('2');
  // u undoes, while the focus is inside the board
  await page.keyboard.press('u');
  await expect(out(page, 'moveCounter')).toHaveText('1');
  await expect(out(page, 'shadow-coordinates')).toHaveText(`(0, ${MINUS}1)`);
  await expect(live(page)).toHaveText(/^Undid move 2\. Populations now /);
  // A-1: undo, redo and reset come after the board that plays the moves: the next tab stop after the
  // restricted board is Undo, then Redo, then Reset
  await page.keyboard.press('Tab');
  expect(await focused(page, 'data-control')).toBe('undo');
  await page.keyboard.press('Tab');
  expect(await focused(page, 'data-control')).toBe('redo');
  await page.keyboard.press('Tab');
  expect(await focused(page, 'data-control')).toBe('reset');
  // reset, by keyboard: the root's starting population again
  await page.keyboard.press('Enter');
  await expect(out(page, 'moveCounter')).toHaveText('0');
  const values: string[] = [];
  for (const b of await out(page, 'game-board').locator('button[data-node]').all()) values[Number(await b.getAttribute('data-node')) - 1] = (await b.getAttribute('data-value')) ?? '';
  expect(values).toEqual(start);
  await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
});

test('keyboard only: after Play θ the next tab stops are undo, redo and reset (A-1)', async ({ page }) => {
  await open(page, 'g=A3&x=1.3&t=1.2.3');
  await pressUntil(page, 'Tab', '[data-tool="satake"] [role="tab"]');
  for (let k = 0; k < 6; k++) {
    if ((await focused(page, 'data-panel-tab')) === 'theta') break;
    await page.keyboard.press('ArrowRight');
  }
  await expect(root(page).locator('[data-panel-tab="theta"]')).toHaveAttribute('aria-selected', 'true');
  await pressUntil(page, 'Tab', '[data-tool="satake"] [data-control="theta-play"]');
  await page.keyboard.press('Enter');
  await expect(out(page, 'moveCounter')).toHaveText('3');
  await page.keyboard.press('Tab');
  expect(await focused(page, 'data-control')).toBe('undo');
  await page.keyboard.press('Enter');
  await expect(out(page, 'moveCounter')).toHaveText('2');
  await expect(live(page)).toHaveText(/^Undid move 3\. Populations now /);
});

// ---------------------------------------------------------------------------------------------
// Regressions of the phase 6 red-team round (RT-FIX P6, cluster t13). SPEC 7.5 A-1: "Home and End go to the
// first and last label; Enter or Space acts. ... the shortcuts u (undo) and r (redo) work only while focus is
// inside the board." Redo by its button and by r from the game board, and the table view's buttons, are in
// T13.spec.ts (regressions).
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // Adopted from the RT-11 lens (site/tests/e2e/redteam-RT-11-p6-T13-redo-home-end.spec.ts). It fails on the
  // lens's mutant S-T13-home-end-ignored (the decoration ignores Home and End).
  // regression: P6-RT-11-01
  test('T13: Home and End move the focus to the first and last label of the decoration (A-1)', async ({ page }) => {
    await page.goto('tools/satake/?g=A5&x=2.4&t=5.4.3.2.1');
    await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    const deco = out(page, 'decoration');
    await deco.locator('button[data-node="3"]').focus();
    expect(await focused(page, 'data-node')).toBe('3');
    await page.keyboard.press('End');
    expect(await focused(page, 'data-node')).toBe('5');
    await expect(deco.locator('button[data-node="5"]')).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('Home');
    expect(await focused(page, 'data-node')).toBe('1');
    await expect(deco.locator('button[data-node="1"]')).toHaveAttribute('tabindex', '0');
  });

  // The restricted board of the split form of E6 is E6 itself (six nodes, with a branch): from node 3, End goes
  // to node 6 and Home to node 1, by label, keyboard only.
  // regression: P6-RT-11-01
  test('keyboard only: Home and End move the focus to the first and last label of the restricted board (A-1)', async ({ page }) => {
    await open(page, 'g=E6&x=&t=1.2.3.4.5.6');
    await pressUntil(page, 'Tab', '[data-tool="satake"] [role="tab"]');
    for (let k = 0; k < 6; k++) {
      if ((await focused(page, 'data-panel-tab')) === 'restricted') break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(root(page).locator('[data-panel-tab="restricted"]')).toHaveAttribute('aria-selected', 'true');
    await pressUntil(page, 'Tab', '[data-tool="satake"] [data-out="restricted-board"]');
    const restricted = out(page, 'restricted-board');
    await expect(restricted.locator('button[data-node]')).toHaveCount(6);
    expect(await focused(page, 'data-node')).toBe('1');
    // in the row 1, 3, 4, 5, 6 of E6 the right of node 1 is node 3
    await page.keyboard.press('ArrowRight');
    expect(await focused(page, 'data-node')).toBe('3');
    await page.keyboard.press('End');
    expect(await focused(page, 'data-node')).toBe('6');
    await expect(restricted.locator('button[data-node="6"]')).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('Home');
    expect(await focused(page, 'data-node')).toBe('1');
    await expect(restricted.locator('button[data-node="1"]')).toHaveAttribute('tabindex', '0');
    await expectOneTabStop(page, 'restricted-board');
  });

  // The note on P6-RT-05-06 (dropped for a missing build step; its claim showed): the keyboard script did not
  // check that the focus stays on the node that acted. A build whose node buttons are made anew on each move
  // throws the focus to the page and still passed the script.
  // regression: P6-RT-11-01
  test('keyboard only: after Enter and Space on a decoration node the focus stays on that node (A-1)', async ({ page }) => {
    await open(page, 'g=A2&x=&t=1.2');
    await pressUntil(page, 'Tab', '[data-tool="satake"] [data-out="decoration"]');
    const at = (): Promise<string> =>
      page.evaluate(() => {
        const e = document.activeElement;
        return e === null || e === document.body ? 'body' : `${e.closest('[data-out="decoration"]') !== null ? 'decoration' : 'elsewhere'}:${e.getAttribute('data-node') ?? ''}`;
      });
    expect(await at()).toBe('decoration:1');
    await page.keyboard.press('Enter');
    await expect(out(page, 'black-nodes')).toHaveText('1');
    expect(await at(), 'after Enter painted node 1 black').toBe('decoration:1');
    await page.keyboard.press(' ');
    await expect(out(page, 'decoration').locator('button[data-node="1"]')).toHaveAttribute('data-colour', 'white');
    expect(await at(), 'after Space painted node 1 white').toBe('decoration:1');
  });

  // regression: P6-RT-11-01
  test('keyboard only: after Enter and Space on a restricted node the focus stays on that node, and u and r undo and redo there (A-1)', async ({ page }) => {
    await open(page, 'g=E6&x=2.3.4.5&t=1.2.3.4.5.6');
    await pressUntil(page, 'Tab', '[data-tool="satake"] [role="tab"]');
    for (let k = 0; k < 6; k++) {
      if ((await focused(page, 'data-panel-tab')) === 'restricted') break;
      await page.keyboard.press('ArrowRight');
    }
    await pressUntil(page, 'Tab', '[data-tool="satake"] [data-out="restricted-board"]');
    await page.keyboard.press('ArrowRight');
    const at = (): Promise<string> =>
      page.evaluate(() => {
        const e = document.activeElement;
        return e === null || e === document.body ? 'body' : `${e.closest('[data-out="restricted-board"]') !== null ? 'restricted' : 'elsewhere'}:${e.getAttribute('data-node') ?? ''}`;
      });
    expect(await at()).toBe('restricted:2');
    await page.keyboard.press('Enter');
    await expect(out(page, 'moveCounter')).toHaveText('1');
    await expect(out(page, 'shadow-coordinates')).toHaveText(`(0, ${MINUS}1)`);
    expect(await at(), 'after Enter played restricted node 2').toBe('restricted:2');
    await page.keyboard.press(' ');
    await expect(out(page, 'moveCounter')).toHaveText('2');
    await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
    expect(await at(), 'after Space played restricted node 2').toBe('restricted:2');
    // u and r while the focus is inside the restricted board
    await page.keyboard.press('u');
    await expect(out(page, 'moveCounter')).toHaveText('1');
    await expect(out(page, 'shadow-coordinates')).toHaveText(`(0, ${MINUS}1)`);
    await page.keyboard.press('r');
    await expect(out(page, 'moveCounter')).toHaveText('2');
    await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
    await expect(live(page)).toHaveText(/^Played the composite move of restricted node 2, \d+ mutations\. Shadow coordinates now 0, 1\. .*Move 2\.$/);
  });
});
