// Focus after a play control acts (SPEC.md 7.5 A-1 "Every tool is fully operable from the keyboard",
// with WCAG 2.4.3 Focus Order among its criteria; 7.4: controls are disabled until hydration). The
// siblings of P3-RT-05-09 in the tools' play controls: "Step", "Play to the end" and "Play on" took the
// HTML disabled attribute when their own press ended the game or started a play in the worker (busy),
// while they held the focus, so the browser dropped the focus to the page. Each case below presses the
// control by keyboard and, once the play is over, reads where the focus is. The pentagon cases run in
// the worker (playFate, E-9 rule 2), so the control is busy while the play runs.
// Hooks read: data-tool, data-hydrated, data-moves, data-control step, playToEnd, playOn, data-tab.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  pentagon_example: { start: number[]; moves: number };
};
const PENTAGON = golden.pentagon_example;

interface Case {
  what: string;
  route: string;
  tool: string;
  control: string;
  /** A tab to open first (T15). */
  tab?: string;
  /** The move count when the play is over; without it, the control is inactive when the play is over. */
  moves?: number;
}

const CASES: Case[] = [
  { what: 'T1 play to the end, A3 legal from (1, 1, 1)', route: 'tools/board/?z=1&g=A3&v=n&m=l&c=n&s=1,1,1', tool: 'board', control: 'playToEnd' },
  { what: 'T1 step that ends the game, A2 legal from (1, 1) after 1, 2', route: 'tools/board/?z=1&g=A2&v=n&m=l&c=n&s=1,1&w=1.2', tool: 'board', control: 'step' },
  {
    what: 'T1 play on the pentagon (in the worker)',
    route: `tools/board/?z=1&g=pentagon&v=n&m=l&c=n&s=${PENTAGON.start.join(',')}`,
    tool: 'board',
    control: 'playToEnd',
    moves: PENTAGON.moves,
  },
  { what: 'T5 play to the end, A3', route: 'tools/numbers/?g=A3', tool: 'numbers', control: 'playToEnd' },
  { what: 'T7 play to the end', route: 'tools/symbolic/', tool: 'symbolic', control: 'playToEnd' },
  { what: 'T8 play to the end', route: 'tools/weyl/', tool: 'weyl', control: 'playToEnd' },
  { what: 'T9 play to the end', route: 'tools/kostant/', tool: 'kostant', control: 'playToEnd' },
  { what: 'T15 play on the pentagon (in the worker)', route: 'tools/affine/', tool: 'affine', control: 'playOn', tab: 'pentagon', moves: PENTAGON.moves },
];

async function focusAfter(page: Page, root: Locator): Promise<{ tag: string | null; control: string | null; inTool: boolean }> {
  return root.evaluate((r) => {
    const a = document.activeElement as HTMLElement | null;
    return { tag: a?.tagName ?? null, control: a?.dataset.control ?? null, inTool: a !== null && r.contains(a) };
  });
}

for (const c of CASES) {
  // regression: P3-RT-05-09
  test(`${c.what}: the pressed control keeps the focus`, async ({ page }) => {
    await page.goto(c.route);
    const root = page.locator(`[data-tool="${c.tool}"]`).first();
    await expect(root).toHaveAttribute('data-hydrated', 'true');
    if (c.tab !== undefined) await root.locator(`[data-tab="${c.tab}"]`).click();
    const control = root.locator(`[data-control="${c.control}"]`);
    await control.focus();
    await page.keyboard.press('Enter');
    if (c.moves !== undefined) await expect(root).toHaveAttribute('data-moves', String(c.moves), { timeout: 30000 });
    else await expect(control).toBeDisabled();
    await page.waitForTimeout(200);
    expect(await focusAfter(page, root), `${c.route}: document.activeElement after Enter on ${c.control}`).toEqual({ tag: 'BUTTON', control: c.control, inTool: true });
  });
}
