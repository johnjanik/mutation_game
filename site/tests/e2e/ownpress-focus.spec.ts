// A control that its own press makes inactive keeps the keyboard focus (SPEC 7.5 A-1 with WCAG 2.4.3;
// decisions RT-FIX-P3-follow-predict "after hydration a control that its own press makes inactive keeps the
// focus: it carries aria-disabled instead of the HTML disabled attribute"). Adopted from the RT-05 phase 4
// reproducer (P4-RT-05-01, retest of P3-RT-05-09): these controls still took the HTML `disabled` attribute
// (or left the page) when their own press made them inactive, so the browser dropped the focus to <body>:
//   T2 "Show total" (disabled={totalShown}) and "Grow one layer" (disabled={!growable}) at the last layer;
//   T7's table button "Fire node k" (disabled when the node can no longer act, i.e. after almost every move);
//   T5's "Play to the end B" (disabled at game over B); the board editor's "Add node" at 12 and "Remove
//   node" at the minimum (T4, T16); the Challenge input and its Check once the answer is accepted.
// The reproducer's two T10 cases ("No rotation", "Draw the orbit") belong to the T10 fixer of the round and
// are adopted there. The siblings of the same cause in T5 follow: "Start the wave from all ones" and "Use
// this start" leave the page under their own press, so the focus moves to an element inside the tool.
// Hooks read: data-tool, data-instance, data-hydrated, data-moves, data-control (showTotal, grow, playToEndB,
// resetB, addNode, removeNode, tab, startWave, startKind, customStart), data-tab, data-table-node,
// data-challenge, data-kind, data-met; the summary "Show as table" of ToolFrame (A-10).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { hydrateEveryIsland } from './hydrate';

async function focusAfter(page: Page): Promise<string> {
  return page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    if (!e || e === document.body) return 'BODY';
    return `${e.tagName.toLowerCase()}[${e.dataset.control ?? e.dataset.tableNode ?? e.dataset.node ?? ''}]`;
  });
}

async function pressUntilInactive(page: Page, control: Locator, max: number): Promise<void> {
  for (let i = 0; i < max; i++) {
    if ((await control.count()) === 0 || (await control.isDisabled())) return;
    await control.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
}

// regression: P4-RT-05-01
test('T2 "Show total" keeps the focus (/tools/garden/)', async ({ page }) => {
  await page.goto('tools/garden/');
  await page.locator('[data-tool="garden"][data-hydrated="true"]').waitFor();
  const show = page.locator('[data-control="showTotal"]');
  await expect(show).toBeEnabled();
  await show.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  expect(await focusAfter(page), '/tools/garden/: document.activeElement after Enter on "Show total"').not.toBe('BODY');
});

// regression: P4-RT-05-01
test('T2 "Grow one layer" keeps the focus at the last layer (/tools/garden/)', async ({ page }) => {
  await page.goto('tools/garden/');
  await page.locator('[data-tool="garden"][data-hydrated="true"]').waitFor();
  const grow = page.locator('[data-control="grow"]');
  await pressUntilInactive(page, grow, 40);
  await expect(grow, 'the garden is complete').toBeDisabled();
  expect(await focusAfter(page), '/tools/garden/: document.activeElement after the last Enter on "Grow one layer"').not.toBe('BODY');
});

// regression: P4-RT-05-01
test('T7 table view: "Fire node 1" keeps the focus (/tools/symbolic/)', async ({ page }) => {
  await page.goto('tools/symbolic/');
  await page.locator('[data-tool="symbolic"][data-hydrated="true"]').waitFor();
  await page.locator('[data-tool="symbolic"] summary', { hasText: 'Show as table' }).focus();
  await page.keyboard.press('Enter');
  const fire = page.locator('[data-tool="symbolic"] [data-table-node="1"]');
  await expect(fire).toBeEnabled();
  await fire.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tool="symbolic"]')).toHaveAttribute('data-moves', '1');
  expect(await focusAfter(page), '/tools/symbolic/: document.activeElement after Enter on the table button "Fire node 1"').not.toBe('BODY');
});

// regression: P4-RT-05-01
test('T5 "Play to the end B" keeps the focus (/modules/m4-numbers/ b3)', async ({ page }) => {
  await page.goto('modules/m4-numbers/');
  const tool = page.locator('[data-tool="numbers"][data-instance="b3"]');
  await tool.scrollIntoViewIfNeeded();
  await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
  // The preset shows game B at its end; Reset B first.
  await tool.locator('[data-control="resetB"]').focus();
  await page.keyboard.press('Enter');
  const play = tool.locator('[data-control="playToEndB"]');
  await expect(play).toBeEnabled();
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(play).toBeDisabled();
  expect(await focusAfter(page), '/modules/m4-numbers/ b3: document.activeElement after Enter on "Play to the end B"').not.toBe('BODY');
});

// regression: P4-RT-05-01
test('board editor: "Add node" at the largest board and "Remove node" at the smallest keep the focus (/tools/sandbox/)', async ({ page }) => {
  await page.goto('tools/sandbox/');
  await page.locator('[data-tool="sandbox"][data-hydrated="true"]').waitFor();
  const add = page.locator('[data-control="addNode"]').first();
  await pressUntilInactive(page, add, 14);
  await expect(add).toBeDisabled();
  expect(await focusAfter(page), '/tools/sandbox/: document.activeElement after the last Enter on "Add node"').not.toBe('BODY');
  const remove = page.locator('[data-control="removeNode"]').first();
  await pressUntilInactive(page, remove, 14);
  await expect(remove).toBeDisabled();
  expect(await focusAfter(page), '/tools/sandbox/: document.activeElement after the last Enter on "Remove node"').not.toBe('BODY');
});

// regression: P4-RT-05-01
test('Challenge: an accepted answer typed and sent with Enter keeps the focus (/modules/m1-mutation/, the input challenge)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('modules/m1-mutation/');
  await hydrateEveryIsland(page);
  const challenge = page.locator('[data-challenge][data-kind="input"]').first();
  const input = challenge.locator('input[type="text"]');
  await expect(input).toBeEnabled();
  await input.focus();
  await page.keyboard.type('1, 1, 1');
  await page.keyboard.press('Enter');
  await expect(challenge).toHaveAttribute('data-met', 'true');
  expect(await focusAfter(page), '/modules/m1-mutation/: document.activeElement after the accepted answer').not.toBe('BODY');
});

/** Whether the focus is on an element inside the tool, not on the page. */
async function focusInTool(root: Locator): Promise<boolean> {
  return root.evaluate((r) => document.activeElement !== null && document.activeElement !== document.body && r.contains(document.activeElement));
}

// regression: P4-RT-05-01 (sibling: T5 "Start the wave from all ones" leaves the page under its own press)
test('T5 "Start the wave from all ones" hands the focus to the wave panel (/tools/numbers/?g=A3&c=n&s=2,1,1)', async ({ page }) => {
  await page.goto('tools/numbers/?g=A3&c=n&s=2,1,1');
  const root = page.locator('[data-tool="numbers"]').first();
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  await root.locator('[data-tab="wave"]').click();
  const start = root.locator('[data-control="startWave"]');
  await expect(start).toBeEnabled();
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(start, 'the wave can start, so the button is gone').toHaveCount(0);
  await page.waitForTimeout(250);
  expect(await focusInTool(root), 'document.activeElement after Enter on "Start the wave from all ones"').toBe(true);
});

// regression: P4-RT-05-01 (sibling: T5 "Use this start" leaves the page when the start is all ones)
test('T5 "Use this start" with all ones hands the focus to the start chooser (/tools/numbers/?g=A3)', async ({ page }) => {
  await page.goto('tools/numbers/?g=A3');
  const root = page.locator('[data-tool="numbers"]').first();
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  await root.locator('[data-control="startKind"]').selectOption('custom');
  const use = root.locator('[data-control="customStart"]');
  await expect(use).toBeEnabled();
  await use.focus();
  await page.keyboard.press('Enter');
  await expect(use, 'the start is all ones, so the custom fields are gone').toHaveCount(0);
  await page.waitForTimeout(250);
  expect(await focusInTool(root), 'document.activeElement after Enter on "Use this start"').toBe(true);
  expect(await focusAfter(page)).toBe('select[startKind]');
});
