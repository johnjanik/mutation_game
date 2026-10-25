// P6-A3: the keyboard script of T13 (gate G6, "keyboard scripts for T1, T4, T13"; SPEC.md 7.5 A-1, A-4; 4 T13
// Decorate and Restricted board). Keyboard only: no click and no pointer. The focus is moved with Tab, Shift+Tab
// and the arrow keys; Enter acts; `u` undoes while the focus is inside a board. Hooks read: data-tool,
// data-hydrated, data-node, data-value, data-colour, data-control ("tau", "reset"), data-panel-tab, aria-selected,
// data-out ("decoration", "restricted-board", "black-nodes", "tau", "light-1" to "light-3", "verdict",
// "composite-length", "shadow-coordinates", "moveCounter") and the live region [data-live].
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

test('keyboard only: paint nodes, choose tau and read the lights', async ({ page }) => {
  await open(page, 'g=A2&x=&t=1.2');
  // Tab into the decoration: one tab stop, the lowest label
  await pressUntil(page, 'Tab', '[data-tool="satake"] [data-out="decoration"]');
  expect(await focused(page, 'data-node')).toBe('1');
  await page.keyboard.press('ArrowRight');
  expect(await focused(page, 'data-node')).toBe('2');
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
  await page.keyboard.press('ArrowRight');
  expect(await focused(page, 'data-node')).toBe('2');
  await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
  await page.keyboard.press('Enter');
  await expect(out(page, 'composite-length')).toHaveText('8');
  await expect(out(page, 'shadow-coordinates')).toHaveText(`(0, ${MINUS}1)`);
  await expect(out(page, 'moveCounter')).toHaveText('1');
  await expect(live(page)).toHaveText('Played the composite move of restricted node 2, 32 mutations. Shadow coordinates now 0, minus 1.');
  // a second time: the reflection twice gives the shadow back
  await page.keyboard.press('Enter');
  await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
  await expect(out(page, 'moveCounter')).toHaveText('2');
  // u undoes, while the focus is inside the board
  await page.keyboard.press('u');
  await expect(out(page, 'moveCounter')).toHaveText('1');
  await expect(out(page, 'shadow-coordinates')).toHaveText(`(0, ${MINUS}1)`);
  await expect(live(page)).toHaveText(/^Undid move 2\. Populations now /);
  // reset, by keyboard: the root's starting population again
  await pressUntil(page, 'Shift+Tab', '[data-tool="satake"] [data-control="reset"]');
  await page.keyboard.press('Enter');
  await expect(out(page, 'moveCounter')).toHaveText('0');
  const values: string[] = [];
  for (const b of await out(page, 'game-board').locator('button[data-node]').all()) values[Number(await b.getAttribute('data-node')) - 1] = (await b.getAttribute('data-value')) ?? '';
  expect(values).toEqual(start);
  await expect(out(page, 'shadow-coordinates')).toHaveText('(0, 1)');
});
