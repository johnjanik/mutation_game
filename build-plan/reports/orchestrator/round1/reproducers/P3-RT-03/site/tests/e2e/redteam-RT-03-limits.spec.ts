// RT-03 attacks 12, 14, 19, 24, 25, 30 in the browser: long numbers in T5's dimension calculator, the
// root test of T3 at its step cap and its digit cap, the fates of T15, the group-order bounds of T8, and
// the editor's node cap. Expected values from reference/lie_games.py (weyl_dimension, play_fate) and the
// engine in Node.
// Hooks: T5 data-out dimension, data-tab, data-control lambda (T05.spec.ts); T3 data-control entry
// (data-row, data-city), data-out smallVerdict, digitNotice (T03.spec.ts); T15 data-tab, data-control
// picker, startField, playOn, data-out fate, firstVisit (T15.spec.ts); T8 data-out edgeMode, gameCount,
// data-control picker (T08.spec.ts); T4 data-control addNode, data-nodes on [data-editor] (T04.spec.ts).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { boardFromName, legalNodes, fire, playFate } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';

const tool = (page: Page, id: string): Locator => page.locator(`[data-tool="${id}"]`);
async function open(page: Page, route: string, id: string): Promise<Locator> {
  await page.goto(route);
  const r = tool(page, id);
  await expect(r).toHaveAttribute('data-hydrated', 'true');
  return r;
}
const out = (r: Locator, name: string): Locator => r.locator(`[data-out="${name}"]`);
const control = (r: Locator, name: string): Locator => r.locator(`[data-control="${name}"]`);

test.describe('attack 12 and 25: T5 dimension calculator beyond 12 digits', () => {
  // weyl_dimension(E8, (9, ..., 9)) = 10^120 (121 digits); weyl_dimension(E8, (1, ..., 1)) has 37 digits.
  const E8_NINES = '1' + '0'.repeat(120);
  const E8_ONES = '1329227995784915872903807060280344576';
  for (const [lambda, exact] of [
    ['9,9,9,9,9,9,9,9', E8_NINES],
    ['1,1,1,1,1,1,1,1', E8_ONES],
  ] as const) {
    test(`E8 lambda ${lambda}: the dimension is shown shortened, exact elsewhere`, async ({ page }) => {
      const r = await open(page, `tools/numbers/?g=E8&d=${lambda}`, 'numbers');
      await r.locator('[data-tab="dimension"]').click();
      const shown = ((await out(r, 'dimension').textContent()) ?? '').trim();
      // The exact digits are in the table view (attack 25: they equal the oracle's weyl_dimension)...
      await expect(r.locator('table.values tr', { hasText: 'M / D' }).locator('td')).toHaveText(exact);
      // ...and SPEC 4.0 "Long numbers": a value of more than 12 digits is shown shortened.
      expect(shown).toBe(`${exact[0]}.${exact.slice(1, 5)}... x 10^${exact.length - 1} (${exact.length} digits)`);
    });
  }
});

test.describe('attack 14 and 30: T3 small values', () => {
  test('the triangle: too large to test here, not a root, the digit cap', async ({ page }) => {
    const r = await open(page, 'tools/form/?g=c:2,-1,-1;-1,2,-1;-1,-1,2', 'form');
    const entry = (row: number, city: number): Locator => r.locator(`[data-control="entry"][data-row="${row}"][data-city="${city}"]`);
    for (const [k, v] of ['333334', '333333', '333333'].entries()) await entry(0, k + 1).fill(v);
    await expect(r.locator('[data-out="smallVerdict"][data-row="0"]')).toHaveText('too large to test here');
    for (const [k, v] of ['999999', '999999', '999999'].entries()) await entry(0, k + 1).fill(v);
    await expect(r.locator('[data-out="smallVerdict"][data-row="0"]')).toHaveText('not a root population');
    await entry(0, 1).fill('');
    await entry(0, 1).pressSequentially('1234567');
    await expect(entry(0, 1)).toHaveValue('123456');
    await entry(0, 1).fill('-999999');
    await expect(entry(0, 1)).toHaveValue('-999999');
  });
});

test.describe('attack 19: T15 fates', () => {
  test('pentagon: returned after 5, ended after 0', async ({ page }) => {
    test.setTimeout(120_000);
    const r = await open(page, 'tools/affine/', 'affine');
    await r.locator('[data-tab="three-fates"]').click();
    await control(r, 'picker').selectOption('pentagon');
    const setStart = async (v: string[]): Promise<void> => {
      for (let k = 0; k < v.length; k++) await control(r, 'startField').nth(k).fill(v[k]!);
    };
    await setStart(['1', '-1', '0', '0', '0']);
    await control(r, 'playOn').click();
    await expect(out(r, 'fate')).toHaveText('returned to an earlier position after 5 moves');
    await setStart(['0', '0', '0', '0', '0']);
    await control(r, 'playOn').click();
    await expect(out(r, 'fate')).toHaveText('ended after 0 moves');
  });

  test('pentagon: one move by hand, then play on, stops at the first repeat (play_fate)', async ({ page }) => {
    test.setTimeout(120_000);
    const pent = boardFromName('pentagon') as Board<bigint>;
    const start = [1n, -1n, 0n, 0n, 0n];
    // The oracle's and the engine's play_fate with the same first move: looped at move 5, first visit 0.
    const whole = playFate(pent, start);
    expect([whole.status, whole.moves, whole.firstVisit]).toEqual(['looped', 5, 0]);
    const r = await open(page, 'tools/affine/', 'affine');
    await r.locator('[data-tab="three-fates"]').click();
    await control(r, 'picker').selectOption('pentagon');
    for (const [k, v] of ['1', '-1', '0', '0', '0'].entries()) await control(r, 'startField').nth(k).fill(v);
    const first = legalNodes(pent, start)[0]!; // position; labels are 1..5 on the pentagon
    expect(first).toBe(whole.word[0]);
    await r.locator(`[data-board-group] button[data-node="${pent.labels[first]}"]`).click();
    await expect(r).toHaveAttribute('data-moves', '1');
    void fire;
    await control(r, 'playOn').click();
    // SPEC 5.5 "Fates": stop with `looped` at the first repeat. The position after move 5 is the start.
    await expect(out(r, 'fate')).toHaveText('returned to an earlier position after 5 moves');
  });
});

test.describe('attack 24: T8 group-order bounds', () => {
  test('picker offers F4 (1152) and not D5 (1920); D4 draws every edge; B4 the game and the focus', async ({ page }) => {
    const r = await open(page, 'tools/weyl/?g=D4', 'weyl');
    const options = await control(r, 'picker').locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
    expect(options).toContain('F4');
    expect(options).not.toContain('D5');
    expect(options).not.toContain('E6');
    // At exactly 192 elements every edge is drawn ("Above 192 group elements, edges are drawn only along
    // the current game and around the focused vertex").
    await expect(out(r, 'edgeMode')).toHaveText('all');
    const b4 = await open(page, 'tools/weyl/?g=B4', 'weyl');
    await expect(out(b4, 'edgeMode')).not.toHaveText('all');
    const f4 = await open(page, 'tools/weyl/?g=F4', 'weyl');
    await expect(out(f4, 'edgeMode')).not.toHaveText('all');
  });
});

test.describe('attack 30: the editor refuses a 13th node', () => {
  test('T4 on A12: the button and the + key', async ({ page }) => {
    const r = await open(page, 'tools/lab/?g=A12', 'lab');
    const editor = r.locator('[data-editor]');
    await expect(editor).toHaveAttribute('data-nodes', '12');
    const add = control(r, 'addNode');
    if (await add.isEnabled()) await add.click();
    await expect(editor).toHaveAttribute('data-nodes', '12');
    await r.locator('[data-board-group] button[data-node="1"]').first().focus();
    await page.keyboard.press('+');
    await expect(editor).toHaveAttribute('data-nodes', '12');
  });
});

test.describe('attack 37: -0 never reaches the reader', () => {
  test('T1 free play: fire a node whose number is 0', async ({ page }) => {
    const r = await open(page, 'tools/board/?g=A2&v=n&m=f&c=n&s=0,1', 'board');
    await r.locator('[data-board="numbers"][data-node="1"]').click();
    await expect(r).toHaveAttribute('data-moves', '1');
    const values = await r.locator('[data-board="numbers"][data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')));
    expect(values).toEqual(['0', '1']);
    await page.waitForTimeout(700);
    const said = (await r.locator('[data-live]').textContent()) ?? '';
    expect(said).not.toContain('minus 0');
  });
});
