// RT-03 attacks 13, 15 and 30 on the Sandbox (SPEC.md 4 T16 acceptance, E-2, 6.6 "Data export", 5.6 rows
// "Nodes of a custom board" and "Roads between two nodes", 6.2 `roads` style). Expected values from the
// golden file and reference/lie_games.py.
// Hooks (from the header of T16.spec.ts): data-tool="sandbox", data-moves, data-hydrated; game buttons
// [data-game] button[data-board][data-node] with data-value; data-out importStatus, verdict; data-control
// importText, importBoard.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  bigint_test: {
    cartan: number[][];
    population_start: number[];
    mutation_nodes: number[];
    population_end: string[];
    numbers_start: number[];
    firing_nodes: number[];
    numbers_end: string[];
  };
};
const BT = golden.bigint_test;
const cartanParam = (C: number[][]): string => `c:${C.map((r) => r.join(',')).join(';')}`;
const root = (page: Page): Locator => page.locator('[data-tool="sandbox"]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const gameNode = (page: Page, board: 'populations' | 'numbers', label: number): Locator =>
  root(page).locator(`[data-game] button[data-board="${board}"][data-node="${label}"]`);

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`tools/sandbox/${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}
async function vals(page: Page, board: 'populations' | 'numbers'): Promise<string[]> {
  return [await gameNode(page, board, 1).getAttribute('data-value'), await gameNode(page, board, 2).getAttribute('data-value')].map(String);
}

/** The oracle's positions after moves 37, 38, 39 (lie_games.mutate and fire on the bigint_test board). */
const AFTER_MUTATIONS: Record<number, string[]> = {
  37: ['1304969544928657', '3416454622906707'],
  38: ['8944394323791464', '3416454622906707'],
  39: ['8944394323791464', '23416728348467685'],
};

test.describe('attack 13: the sandbox crosses 2^53 exactly, by clicks', () => {
  test('mutations of bigint_test, clicked one by one', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, `g=${cartanParam(BT.cartan)}&v=p&m=f&c=p&s=${BT.population_start.join(',')}`);
    for (let k = 0; k < BT.mutation_nodes.length; k++) {
      await gameNode(page, 'populations', BT.mutation_nodes[k]!).click();
      await expect(root(page)).toHaveAttribute('data-moves', String(k + 1));
      const want = AFTER_MUTATIONS[k + 1];
      if (want !== undefined) expect(await vals(page, 'populations'), `after move ${k + 1}`).toEqual(want);
    }
    expect(await vals(page, 'populations')).toEqual(BT.population_end);
  });
  test('firings of bigint_test, clicked one by one', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, `g=${cartanParam(BT.cartan)}&v=n&m=f&c=n&s=${BT.numbers_start.join(',')}`);
    for (let k = 0; k < BT.firing_nodes.length; k++) {
      await gameNode(page, 'numbers', BT.firing_nodes[k]!).click();
    }
    await expect(root(page)).toHaveAttribute('data-moves', String(BT.firing_nodes.length));
    expect(await vals(page, 'numbers')).toEqual(BT.numbers_end);
  });
});

test.describe('attack 15 and 30: imports at the caps of the editor', () => {
  test('13 nodes and an entry beyond 2^53 are refused', async ({ page }) => {
    await open(page);
    const n13 = Array.from({ length: 13 }, (_, i) => Array.from({ length: 13 }, (_, j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0)));
    await control(page, 'importText').fill(JSON.stringify({ cartan: n13 }));
    await control(page, 'importBoard').click();
    await expect(out(page, 'importStatus')).toContainText('could not be read');
    await control(page, 'importText').fill('{"cartan": [[2, -9007199254740993], [-1, 2]]}');
    await control(page, 'importBoard').click();
    await expect(out(page, 'importStatus')).toContainText('could not be read');
  });

  // SPEC 5.6: "Roads between two nodes, each way (editor only; the engine accepts any count) | 4 | editor
  // refuses more"; 6.2: on a one-way board every road is drawn as its own arrow. An import is not
  // refused above 4 roads, so the count reaches the drawing. A count of 2^53 - 1 must not hang the page.
  test('a one-way board with 9007199254740991 roads from an import does not hang the page', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page);
    await control(page, 'importText').fill('{"cartan": [[2, -9007199254740991], [0, 2]]}');
    const t0 = Date.now();
    await control(page, 'importBoard').click({ timeout: 20_000 });
    // Either refused, or imported and drawn: the page must answer within 20 seconds.
    await expect(out(page, 'importStatus')).not.toBeEmpty({ timeout: 20_000 });
    const answered = await Promise.race([
      page.evaluate(() => document.querySelectorAll('[data-tool="sandbox"] svg *').length).then((n) => ({ n })),
      new Promise<{ n: number }>((resolve) => setTimeout(() => resolve({ n: -1 }), 20_000)),
    ]);
    expect(answered.n, `page answered after ${Date.now() - t0} ms`).toBeGreaterThan(0);
  });
});
