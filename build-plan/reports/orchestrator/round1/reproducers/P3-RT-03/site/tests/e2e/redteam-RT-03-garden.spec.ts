// RT-03 attacks 9, 10, 11, 35 on the Orbit Garden (SPEC.md 4 T2 "Size" and "Interactions", 4.0 "Stated
// limits" and "Growth off the finite types has two bounds", 5.5, 5.6 row "Positions held by the Orbit
// Garden"). Expected values were computed with reference/lie_games.py orbit_graph_capped.
// Hooks (from the header of T02.spec.ts): data-out found, total, stopMessage, vertex, edge; data-control
// grow, showTotal; data-hydrated on the root.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { cartan: number[][] }>;
  layer_growth_examples: { label: string; cartan: number[][] }[];
};
const growth = (label: string): number[][] => GOLDEN.layer_growth_examples.find((g) => g.label === label)!.cartan;
const cLink = (cartan: number[][]): string => `c:${cartan.map((r) => r.join(',')).join(';')}`;

const out = (page: Page, name: string): Locator => page.locator(`[data-tool="garden"] [data-out="${name}"]`);
const control = (page: Page, name: string): Locator => page.locator(`[data-tool="garden"] [data-control="${name}"]`);

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`tools/garden/${query}`);
  await expect(page.locator('[data-tool="garden"]')).toHaveAttribute('data-hydrated', 'true');
}
async function growTimes(page: Page, times: number): Promise<number> {
  let presses = 0;
  const grow = control(page, 'grow');
  while (presses < times && (await grow.isEnabled())) {
    await grow.click();
    presses++;
  }
  return presses;
}
async function stopText(page: Page): Promise<string> {
  const loc = out(page, 'stopMessage');
  return (await loc.count()) === 0 ? '' : ((await loc.first().textContent()) ?? '').trim();
}

test.describe('attack 9: stop messages in roots mode on the boards of layer_growth_examples', () => {
  for (const [label, found, message] of [
    ['triangle', '243', 'stopped after 40 layers'],
    ['three roads each way', '162', 'stopped after 40 layers'],
    ['star with four arms', '389', 'stopped after 40 layers'],
    ['star with five arms', '2000', 'stopped after 2000 positions; layers 0 to 10 are complete'],
  ] as const) {
    test(label, async ({ page }) => {
      test.setTimeout(180_000);
      await open(page, `?g=${cLink(growth(label))}`);
      await growTimes(page, 60);
      await expect(out(page, 'found')).toHaveText(found);
      expect(await stopText(page)).toBe(message);
    });
  }
});

test.describe('attack 10: the layers bound only off the finite types', () => {
  test('named E7 from node 6 and B8 from node 5: whole orbit, no stop message', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, '?g=E7&c=n&s=0,0,0,0,0,1,0');
    await growTimes(page, 80);
    await expect(out(page, 'found')).toHaveText('756');
    expect(await stopText(page)).toBe('');
    await open(page, '?g=B8&c=n&s=0,0,0,0,1,0,0,0');
    await growTimes(page, 80);
    await expect(out(page, 'found')).toHaveText('1792');
    expect(await stopText(page)).toBe('');
  });
  test('custom E7 (a matrix) from node 6: 756 and no stop message from phase 2', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, `?g=${cLink(GOLDEN.types.E7!.cartan)}&c=n&s=0,0,0,0,0,1,0`);
    await growTimes(page, 80);
    await expect(out(page, 'found')).toHaveText('756');
    expect(await stopText(page)).toBe('');
  });
});

test.describe('attack 11: the counter at a truncated orbit (phase 3: the exact size from orbitSize)', () => {
  for (const [name, start, total, complete] of [
    ['E7', '0,0,1,0,0,0,0', '2016', 41],
    ['E8', '1,1,1,1,1,1,1,1', '696729600', 5],
  ] as const) {
    test(`${name} from ${start}`, async ({ page }) => {
      test.setTimeout(180_000);
      await open(page, `?g=${name}&c=n&s=${start}`);
      await growTimes(page, 80);
      await expect(out(page, 'found')).toHaveText('2000');
      expect(await stopText(page)).toBe(`stopped after 2000 positions; layers 0 to ${complete} are complete`);
      await control(page, 'showTotal').click();
      // SPEC 4 T2 Interactions: "from phase 3 on a finite-type board it gives the exact size from orbitSize".
      await expect(out(page, 'total')).toHaveText(total);
    });
  }
});

test.describe('attack 35: the drawing cap of 300', () => {
  test('star with four arms at 30 and 31 layers', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, `?g=${cLink(growth('star with four arms'))}`);
    await growTimes(page, 30);
    await expect(out(page, 'found')).toHaveText('293');
    const labels30 = await out(page, 'vertex').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
    expect(labels30).toHaveLength(293);
    expect(labels30.filter((t) => t === '')).toHaveLength(0);
    await expect(out(page, 'edge')).toHaveCount(540);
    await growTimes(page, 1);
    await expect(out(page, 'found')).toHaveText('302');
    const labels31 = await out(page, 'vertex').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()));
    expect(labels31).toHaveLength(302);
    expect(labels31.filter((t) => t !== '')).toHaveLength(0);
    expect(await out(page, 'edge').count()).toBeLessThan(553);
  });
});

test.describe('attack 12: long numbers in the garden at 12 and 13 digits', () => {
  test('three roads each way: 225851433717 in full at depth 27, 1548008755920 shortened at depth 29', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, `?g=${cLink(growth('three roads each way'))}`);
    await growTimes(page, 60);
    const read = (layer: number) =>
      page
        .locator(`[data-tool="garden"] [data-out="vertex"][data-layer="${layer}"]`)
        .evaluateAll((els) => els.map((e) => [e.getAttribute('data-position') ?? '', (e.textContent ?? '').trim()]));
    const t27 = await read(27);
    expect(t27.some(([pos, text]) => pos.includes('225851433717') && text.includes('225851433717'))).toBe(true);
    const long = (await read(29)).find(([pos]) => pos.includes('1548008755920'));
    expect(long).toBeDefined();
    expect(long![1]).toContain('1.5480... x 10^12 (13 digits)');
    expect(long![1]).not.toContain('1548008755920');
  });
});
