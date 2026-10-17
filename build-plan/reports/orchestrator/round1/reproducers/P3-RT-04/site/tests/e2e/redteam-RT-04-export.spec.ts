// RT-04 (codec-attacker), attacks 8, 33 and 40: "Download data" on every tool route of phases 1 to 3.
// SPEC 6.6 Data export: "JSON with the state, the engine version, the site's git commit, and the
// derived tables shown on screen ..., all integers as JSON numbers when safe and as decimal strings
// otherwise". Checks the integer rule on the raw text, the agreement of the exported state with
// "Copy link", and lists the derived keys per tool (printed for the coverage report).
// Run (after npm run build): PLAYWRIGHT_BROWSERS_PATH=<browsers> npx playwright test
//   -c redteam/RT-04/playwright.config.ts redteam-RT-04-export.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8'));

async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied.push(t); } } });
  });
  await page.goto(path);
  const t = page.locator('[data-tool]').first();
  await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  await page.waitForTimeout(300);
}

async function download(page: Page): Promise<{ raw: string; doc: Record<string, any> }> {
  const t = page.locator('[data-tool]').first();
  const [dl] = await Promise.all([page.waitForEvent('download'), t.locator('[data-control="downloadData"]').click()]);
  const raw = readFileSync((await dl.path())!, 'utf8');
  return { raw, doc: JSON.parse(raw) };
}

async function copied(page: Page): Promise<URLSearchParams> {
  await page.locator('[data-tool]').first().locator('[data-control="copyLink"]').click();
  const text = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1) ?? '');
  return new URL(text).searchParams;
}

/** Unsafe integers written as JSON numbers (a run of 16 or more digits outside quotes). */
function unsafeNumbers(raw: string): string[] {
  const noStrings = raw.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return (noStrings.match(/-?\d{16,}/g) ?? []).filter((t) => !Number.isSafeInteger(Number(t)));
}

/** Safe integers written as strings, anywhere in the export except the commit and the version. */
function safeAsStrings(doc: unknown, path = ''): string[] {
  const out: string[] = [];
  if (typeof doc === 'string') {
    if (/^-?\d+$/.test(doc) && Number.isSafeInteger(Number(doc)) && !/commit|engineVersion/.test(path)) out.push(`${path}=${doc}`);
  } else if (Array.isArray(doc)) doc.forEach((v, k) => out.push(...safeAsStrings(v, `${path}[${k}]`)));
  else if (doc && typeof doc === 'object') for (const [k, v] of Object.entries(doc)) out.push(...safeAsStrings(v, `${path}.${k}`));
  return out;
}

const ROUTES = ['board', 'garden', 'kostant', 'form', 'lab', 'affine', 'sandbox', 'numbers', 'mirror', 'symbolic', 'weyl'];

for (const r of ROUTES) {
  test(`33: export of /tools/${r}/ (default state): integer rule, engine version, commit, state agrees with Copy link`, async ({ page }) => {
    await open(page, `tools/${r}/`);
    const { raw, doc } = await download(page);
    console.log(`${r}: top keys ${Object.keys(doc).join(',')}; derived keys ${Object.keys(doc.derived ?? {}).join(',')}; commit ${doc.commit}; engine ${doc.engineVersion}`);
    expect(typeof doc.engineVersion).toBe('string');
    expect(doc.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(unsafeNumbers(raw)).toEqual([]);
    expect(safeAsStrings(doc.derived, 'derived')).toEqual([]);
    expect(Object.keys(doc.derived ?? {}).length).toBeGreaterThan(0);
    const q = await copied(page);
    if (doc.state.board !== undefined && typeof doc.state.board === 'string' && q.has('g')) expect(q.get('g')).toBe(doc.state.board);
    if (doc.state.moves !== undefined && q.has('w')) expect(q.get('w')).toBe(doc.state.moves.join('.'));
    if (doc.state.start !== undefined && q.has('s')) expect(q.get('s')).toBe(doc.state.start.join(','));
  });
}

test('8, 33: a start beyond 2^53 on E8: exact numbers on the board and in the export', async ({ page }) => {
  await open(page, 'tools/board/?g=E8&v=n&m=f&c=n&s=9007199254740993,1,1,1,1,1,1,1&w=1');
  const values = await page.locator('[data-tool] button[data-node][data-board="numbers"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')));
  // Oracle fire(cartan('E',8), a, 0): a1 -> -a1; a3 -> a3 + a1 (node 3 is joined to node 1).
  expect(values).toEqual(['-9007199254740993', '1', '9007199254740994', '1', '1', '1', '1', '1']);
  const { raw, doc } = await download(page);
  expect(unsafeNumbers(raw)).toEqual([]);
  expect(doc.state.start).toEqual(['9007199254740993', 1, 1, 1, 1, 1, 1, 1]);
  const last = doc.derived.positions.at(-1);
  expect(last.numbers).toEqual(['-9007199254740993', 1, '9007199254740994', 1, 1, 1, 1, 1]);
});

test('33: the bigint_test link on /tools/board/ and /tools/sandbox/ exports numbers_end exactly', async ({ page }) => {
  const b = GOLDEN.bigint_test;
  for (const route of ['board', 'sandbox']) {
    await open(page, `tools/${route}/?g=c:2,-3;-3,2&v=n&m=f&c=n&s=1,0&w=${b.firing_nodes.join('.')}`);
    await expect(page.locator('[data-tool]').first()).toHaveAttribute('data-moves', '200');
    const { raw, doc } = await download(page);
    expect(unsafeNumbers(raw), route).toEqual([]);
    const last = doc.derived.positions.at(-1);
    expect(last.numbers, route).toEqual(b.numbers_end);
    const k = b.first_move_after_which_an_entry_exceeds_2_to_53;
    const pos = doc.derived.positions;
    expect(pos[k - 1].numbers.every((x: unknown) => typeof x === 'number'), route).toBe(true);
    expect(pos[k].numbers.some((x: unknown) => typeof x === 'string'), route).toBe(true);
  }
});

test('33 (P3-RT-04-02): T1 linked view, numbers start (1,1) on A2: the integral population is exported as numbers', async ({ page }) => {
  await open(page, 'tools/board/?g=A2&v=l&m=f&c=n&s=1,1');
  const pops = await page.locator('[data-tool] button[data-node][data-board="populations"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')));
  expect(pops).toEqual(['1', '1']);
  const { doc } = await download(page);
  console.log('derived.positions[0]:', JSON.stringify(doc.derived.positions[0]));
  expect(doc.derived.positions[0].populations).toEqual([1, 1]);
});

test('33 (P3-RT-04-02): T6 default point a = (1,1) on A2: population (1,1) exported as numbers', async ({ page }) => {
  await open(page, 'tools/mirror/');
  const { doc } = await download(page);
  console.log('derived.population:', JSON.stringify(doc.derived.population));
  expect(doc.derived.population).toEqual([1, 1]);
});
