// P2-A2: tool T3, the Form Finder, against the built site (SPEC.md 4 T3, 4.0, 2.5, 5.6, 6.6, 7.4, 7.5;
// SPEC 3 M2 rows 1, 2, 5 and M6 row 3). Cases are opened by bare query parameters on /tools/form/
// (6.6: every state is a link). Tests read only the hooks of 4.0 and the live region (and, for the
// export check, the downloaded file).
//
// Hooks read:
//   root:     data-tool="form", data-moves, data-hydrated="true"
//   buttons:  data-node, data-board ("populations"), data-value, data-can-act; tabindex (roving)
//   parts:    data-part ("meter", "builder", "small-values")
//   controls: data-control = test, weightSlider, weightField (with data-weight "city" | "road" and
//             data-weight-index: the position of the city, or the index of the joined pair), entry
//             (with data-row and data-city), addRow, picker, undo, redo, reset, copyLink,
//             downloadData (regressions); data-export="svg"
//   live:     [data-live] (ToolFrame's polite live region)
// data-out names (every one T3 renders; the registry's `outs`):
//   formValue (data-value), meterNote, testVerdict (data-invariant), witness (data-city,
//   data-population, data-after), smallValue (data-row, data-value), smallVerdict (data-row),
//   digitNotice, moveCounter, historyStrip, historyCounter, predictResult, predictReveal, caption,
//   notice, noscript, exportNotice
//
// Properties of T3 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// linkTo, prediction, preset, caption, layers):
//   cityWeights: number[]                                   initial city weights, in label order
//   roadWeights: { pair: [number, number]; weight: number }[]  initial road weights, by labels
//   populations: (number | string)[][]                      initial rows of small values, label order
// preset is one of default, meter, builder, small-values; coords must be populations; layers is
// accepted and has no effect (T3 grows no set).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ssrLoader } from '../unit/_svelteSsr';
import { copiedLink, downloadData, openForExport, safeAsStrings, unsafeNumbers } from './exportIntegers';

const ROUTE = 'tools/form/';
const PASS = 'Passes: every mutation preserves this form.';
const FAIL = 'Fails: some mutation changes this form.';

const root = (page: Page): Locator => page.locator('[data-tool="form"]');
const node = (page: Page, label: number): Locator => root(page).locator(`button[data-board="populations"][data-node="${label}"]`);
const nodes = (page: Page): Locator => root(page).locator('button[data-board="populations"][data-node]');
const out = (page: Page, name: string): Locator => root(page).locator(`[data-out="${name}"]`);
const control = (page: Page, name: string): Locator => root(page).locator(`[data-control="${name}"]`);
const live = (page: Page): Locator => root(page).locator('[data-live]');
const field = (page: Page, kind: 'city' | 'road', index: number): Locator =>
  root(page).locator(`[data-control="weightField"][data-weight="${kind}"][data-weight-index="${index}"]`);
const slider = (page: Page, kind: 'city' | 'road', index: number): Locator =>
  root(page).locator(`[data-control="weightSlider"][data-weight="${kind}"][data-weight-index="${index}"]`);
const entry = (page: Page, row: number, city: number): Locator => root(page).locator(`[data-control="entry"][data-row="${row}"][data-city="${city}"]`);
const smallValue = (page: Page, row: number): Locator => root(page).locator(`[data-out="smallValue"][data-row="${row}"]`);
const smallVerdict = (page: Page, row: number): Locator => root(page).locator(`[data-out="smallVerdict"][data-row="${row}"]`);

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`${ROUTE}${query ? `?${query}` : ''}`);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
  await expect(control(page, 'test')).toBeEnabled();
}

/** Sets the weights (cities by position, then roads in the order of the joined pairs) and presses Test. */
async function testWeights(page: Page, city: number[], road: number[]): Promise<void> {
  for (const [k, w] of city.entries()) await field(page, 'city', k).fill(String(w));
  for (const [k, w] of road.entries()) await field(page, 'road', k).fill(String(w));
  for (const [k, w] of city.entries()) await expect(field(page, 'city', k)).toHaveValue(String(w));
  await control(page, 'test').click();
}

async function typeRow(page: Page, row: number, labels: number[], values: string[]): Promise<void> {
  for (const [k, l] of labels.entries()) await entry(page, row, l).fill(values[k]!);
}

// ---------------------------------------------------------------------------------------------
// The builder (SPEC 4 T3; M2 row 2; M6 row 3)
// ---------------------------------------------------------------------------------------------

test('the A2 builder passes exactly when all three weights are equal', async ({ page }) => {
  await open(page, 'g=A2');
  await expect(nodes(page)).toHaveCount(2);
  // Three sliders, each with its number field: two city weights and one road weight.
  await expect(root(page).locator('[data-control="weightSlider"]')).toHaveCount(3);
  await expect(out(page, 'testVerdict')).toHaveText('Press Test to ask the engine about these weights.');
  await testWeights(page, [2, 2], [2]);
  await expect(out(page, 'testVerdict')).toHaveText(PASS);
  await expect(out(page, 'witness')).toHaveText('');
  await expect(live(page)).toHaveText(PASS);
  await testWeights(page, [3, 3], [3]);
  await expect(out(page, 'testVerdict')).toHaveText(PASS);
  for (const [city, road] of [
    [[2, 2], [3]],
    [[2, 3], [2]],
  ] as const) {
    await testWeights(page, [...city], [...road]);
    await expect(out(page, 'testVerdict')).toHaveText(FAIL);
    // The witness names a city of the board and a population of one or two Martians.
    await expect(out(page, 'witness')).toHaveAttribute('data-city', /^[12]$/);
    await expect(out(page, 'witness')).toHaveAttribute('data-population', /^(1,0|0,1|1,1)$/);
    await expect(out(page, 'witness')).toHaveAttribute('data-after', /^-?\d+,-?\d+$/);
    await expect(out(page, 'witness')).toContainText(/mutating city [12] takes the population \([01], [01]\)/);
  }
  // A change of weight clears the last verdict; nothing is tested until Test is pressed.
  await field(page, 'city', 0).fill('5');
  await expect(out(page, 'testVerdict')).toHaveText('Press Test to ask the engine about these weights.');
});

test('the B2 builder passes exactly for city weights in the ratio 2 to 1', async ({ page }) => {
  await open(page, 'g=B2');
  await testWeights(page, [4, 2], [4]);
  await expect(out(page, 'testVerdict')).toHaveText(PASS);
  await testWeights(page, [2, 1], [2]);
  await expect(out(page, 'testVerdict')).toHaveText(PASS);
  await testWeights(page, [2, 2], [2]);
  await expect(out(page, 'testVerdict')).toHaveText(FAIL);
  await expect(out(page, 'witness')).toHaveAttribute('data-city', /^[12]$/);
  // The defaults (every weight 1) fail on B2 too.
  await page.reload();
  await expect(control(page, 'test')).toBeEnabled();
  await control(page, 'test').click();
  await expect(out(page, 'testVerdict')).toHaveText(FAIL);
});

test('the builder refuses a city weight of 0 and a negative road weight', async ({ page }) => {
  await open(page, 'g=A2');
  await field(page, 'city', 0).fill('3');
  await field(page, 'city', 0).fill('0');
  await field(page, 'city', 0).blur();
  await expect(field(page, 'city', 0)).toHaveValue('3');
  await field(page, 'road', 0).fill('-1');
  await field(page, 'road', 0).blur();
  await expect(field(page, 'road', 0)).toHaveValue('1');
  await field(page, 'road', 0).fill('0');
  await expect(field(page, 'road', 0)).toHaveValue('0');
});

// ---------------------------------------------------------------------------------------------
// Small values (SPEC 4 T3; M2 row 5; 5.6)
// ---------------------------------------------------------------------------------------------

test('a typed root population of A3 reads 2 and root population', async ({ page }) => {
  await open(page);
  await typeRow(page, 0, [1, 2, 3], ['1', '1', '0']);
  await expect(smallValue(page, 0)).toHaveText('2');
  await expect(smallVerdict(page, 0)).toHaveText('root population');
  await typeRow(page, 0, [1, 2, 3], ['1', '0', '1']);
  await expect(smallValue(page, 0)).toHaveText('4');
  await expect(smallVerdict(page, 0)).toHaveText('not a root population');
  // A row with both signs is judged at once; an added row starts empty.
  await control(page, 'addRow').click();
  await expect(entry(page, 3, 1)).toHaveValue('');
  await typeRow(page, 3, [1, 2, 3], ['-1', '-1', '0']);
  await expect(smallValue(page, 3)).toHaveText('2');
  await expect(smallVerdict(page, 3)).toHaveText('root population');
});

test('the digit cap', async ({ page }) => {
  await open(page);
  const f = entry(page, 0, 2);
  await f.fill('');
  await f.pressSequentially('1234567');
  await expect(f).toHaveValue('123456');
  await expect(out(page, 'digitNotice')).toContainText('at most 6 digits');
  // A leading minus sign is not a digit.
  await f.fill('-');
  await f.pressSequentially('654321');
  await expect(f).toHaveValue('-654321');
  // A pasted seven-digit string is refused whole; the field keeps its last accepted value.
  await f.fill('7654321');
  await expect(f).toHaveValue('-654321');
  await expect(out(page, 'digitNotice')).toContainText('keeps');
  // Letters are refused.
  await f.pressSequentially('x');
  await expect(f).toHaveValue('-654321');
});

test('small values on the triangle: labels from 0 and too large to test here', async ({ page }) => {
  await open(page, 'g=A2~');
  await expect(entry(page, 0, 0)).toBeVisible();
  await expect(entry(page, 0, 3)).toHaveCount(0);
  await typeRow(page, 0, [0, 1, 2], ['9001', '9000', '9000']);
  await expect(smallValue(page, 0)).toHaveText('2');
  await expect(smallVerdict(page, 0)).toHaveText('root population');
  await typeRow(page, 0, [0, 1, 2], ['11001', '11000', '11000']);
  await expect(smallValue(page, 0)).toHaveText('2');
  await expect(smallVerdict(page, 0)).toHaveText('too large to test here');
  // The frozen population (1, 1, 1) has form value 0.
  await typeRow(page, 1, [0, 1, 2], ['1', '1', '1']);
  await expect(smallValue(page, 1)).toHaveText('0');
});

test('a board with a one-way road has no invariant form', async ({ page }) => {
  await open(page, 'g=c:2,0;-1,2');
  await expect(out(page, 'formValue')).toHaveText('This board has no invariant form.');
  await expect(smallVerdict(page, 0)).toHaveText('the test needs two-way roads');
  await control(page, 'test').click();
  await expect(out(page, 'testVerdict')).toHaveText(FAIL);
  await expect(out(page, 'witness')).toHaveAttribute('data-city', /^[12]$/);
});

// ---------------------------------------------------------------------------------------------
// The meter (SPEC 4 T3; M2 row 1)
// ---------------------------------------------------------------------------------------------

test('the meter does not move along a play', async ({ page }) => {
  await open(page, 'g=A3&c=p&s=1,0,0');
  await expect(out(page, 'formValue')).toHaveText('2');
  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await expect(live(page)).toHaveText('Mutated city 1. Populations now minus 1, 0, 0. Move 1.');
  await expect(out(page, 'formValue')).toHaveText('2');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(out(page, 'formValue')).toHaveText('2');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '3');
  await expect(out(page, 'formValue')).toHaveText('2');
  await expect(node(page, 3)).toHaveAttribute('data-value', '-1');
});

// ---------------------------------------------------------------------------------------------
// Presets (CONTRACTS 5.2 and 6)
// ---------------------------------------------------------------------------------------------

test("each preset's link opens and shows its first output", async ({ page }) => {
  const loader = await ssrLoader();
  let links: Record<string, string>;
  try {
    const { FORM_PRESETS } = await loader.load<{ FORM_PRESETS: Record<string, { state: Record<string, unknown> }> }>('/src/components/tools/t03/presets.ts');
    const { encodeState } = await loader.load<{ encodeState: (s: unknown) => string }>('/src/lib/urlCodec.ts');
    links = Object.fromEntries(['meter', 'builder', 'small-values'].map((id) => [id, encodeState(FORM_PRESETS[id]!.state)]));
  } finally {
    await loader.close();
  }
  await open(page, links.meter);
  await expect(out(page, 'formValue')).toHaveText('2');
  await expect(nodes(page)).toHaveCount(3);
  await open(page, links.builder);
  await expect(nodes(page)).toHaveCount(2);
  await expect(root(page).locator('[data-control="weightField"]')).toHaveCount(3);
  await expect(control(page, 'test')).toHaveText('Test');
  await open(page, links['small-values']);
  await expect(smallValue(page, 0)).toHaveText('2');
  await expect(out(page, 'notice')).toHaveCount(0);
  // A link with numbers coordinates is unreadable for this tool: the default state and the notice.
  await open(page, 'g=A2&c=n&s=1,0');
  await expect(out(page, 'notice')).toHaveText('The link could not be read, so the tool shows its default state.');
  await expect(nodes(page)).toHaveCount(3);
});

// ---------------------------------------------------------------------------------------------
// Hooks, keyboard, export, no JavaScript
// ---------------------------------------------------------------------------------------------

test('hooks and keyboard', async ({ page }) => {
  await open(page);
  for (const b of await nodes(page).all()) {
    for (const a of ['data-node', 'data-board', 'data-value', 'data-can-act']) expect(await b.getAttribute(a), a).not.toBeNull();
    await expect(b).toHaveAttribute('data-board', 'populations');
    await expect(b).toHaveAttribute('data-can-act', 'true');
  }
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(node(page, 1)).toHaveAttribute('aria-label', 'City 1, population 1, mutation would lower it');
  // One tab stop for the board: Tab from the page start reaches one node button.
  await expect(root(page).locator('button[data-node][tabindex="0"]')).toHaveCount(1);
  await page.locator('body').focus();
  let reached = false;
  for (let k = 0; k < 40 && !reached; k++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => document.activeElement?.hasAttribute('data-node') ?? false);
  }
  expect(reached).toBe(true);
  await expect(node(page, 1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  // u undoes only while focus is inside the board.
  await control(page, 'test').focus();
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await node(page, 1).focus();
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await page.keyboard.press('r');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  // Weights by keyboard: arrow keys on a slider, typing in a field; Test by Enter.
  await slider(page, 'city', 0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(field(page, 'city', 0)).toHaveValue('2');
  await page.keyboard.press('ArrowLeft');
  await expect(field(page, 'city', 0)).toHaveValue('1');
  await field(page, 'road', 1).focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('2');
  await expect(field(page, 'road', 1)).toHaveValue('2');
  await control(page, 'test').focus();
  await page.keyboard.press('Enter');
  await expect(out(page, 'testVerdict')).toHaveText(FAIL);
  // A small-values field by keyboard.
  await entry(page, 2, 3).focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('0');
  await expect(smallValue(page, 2)).toHaveText('2');
  // The table view acts too (A-10).
  await root(page).locator('summary').click();
  await root(page).locator('[data-table-node="2"]').click();
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(out(page, 'formValue')).toHaveText('2');
  // Export SVG of the board renders: a non-empty svg with the city labels.
  const download = page.waitForEvent('download');
  await root(page).locator('[data-export="svg"]').click();
  const file = await (await download).path();
  const svg = readFileSync(file, 'utf8');
  expect(svg).toMatch(/^<\?xml[\s\S]*<svg|^<svg/);
  expect(svg).toContain('</svg>');
  await expect(out(page, 'exportNotice')).toHaveText('');
  // 320 pixels: no sideways scroll of the page.
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, 'g=E8');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('the tool renders without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(root(page).locator('svg').first()).toBeVisible();
  await expect(nodes(page)).toHaveCount(3);
  await expect(out(page, 'formValue')).toHaveText('2');
  await expect(root(page).locator('[data-out="smallValue"]')).toHaveText(['2', '2', '4']);
  await expect(root(page).locator('[data-out="smallVerdict"]')).toHaveText(['root population', 'root population', 'not a root population']);
  await expect(out(page, 'caption')).toContainText('A3');
  await expect(out(page, 'noscript')).toBeVisible();
  const controls = await root(page).locator('button, select, input').all();
  expect(controls.length).toBeGreaterThan(20);
  for (const el of controls) await expect(el).toBeDisabled();
  await context.close();
});

// ---------------------------------------------------------------------------------------------
// Regressions
// ---------------------------------------------------------------------------------------------

test.describe('regressions', () => {
  // SPEC 7.4: a follower extends the play it keeps by the moves of each new state. The meter's
  // subscription must not track the play it extends: inside its effect it would depend on what it
  // writes and run again on every move until Svelte stops it (effect_update_depth_exceeded).
  // regression: P3-RT-04-04
  test('the linked meter on M2 follows moves of the board above without a page error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('modules/m2-form/');
    const leader = page.locator('[data-tool][data-instance="b1"]').first();
    const meter = page.locator('[data-tool][data-instance="b2"]');
    await meter.scrollIntoViewIfNeeded();
    await expect(meter).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    await leader.scrollIntoViewIfNeeded();
    await expect(leader).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
    const show = leader.locator('[data-control="predictShow"]');
    if (await show.count()) await show.click();
    for (const node of [2, 3, 1]) await leader.locator(`button[data-board="populations"][data-node="${node}"]`).click();
    await expect(leader).toHaveAttribute('data-moves', '3');
    // The meter reads the leader's population after the three moves (its table view lists it).
    const leaderValues = await leader.locator('button[data-board="populations"][data-node]').evaluateAll((els) =>
      els.map((e) => [Number(e.getAttribute('data-node')), e.getAttribute('data-value')] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]),
    );
    expect(leaderValues).toEqual(['0', '1', '1']);
    await expect(meter.locator('[data-table-value="population"]')).toHaveText(leaderValues as string[]);
    await expect(meter.locator('[data-out="formValue"]')).toHaveAttribute('data-value', '2');
    expect(errors).toEqual([]);
  });

  // regression: P3-RT-04-05
  test('export of the default state: integer rule, engine version, commit, state agrees with Copy link', async ({ page }) => {
    await openForExport(page, 'tools/form/');
    const { raw, doc } = await downloadData(page);
    expect(typeof doc.engineVersion).toBe('string');
    expect(doc.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(unsafeNumbers(raw)).toEqual([]);
    expect(safeAsStrings(doc.derived, 'derived')).toEqual([]);
    expect(Object.keys(doc.derived ?? {}).length).toBeGreaterThan(0);
    const q = await copiedLink(page);
    if (doc.state.board !== undefined && typeof doc.state.board === 'string' && q.has('g')) expect(q.get('g')).toBe(doc.state.board);
    if (doc.state.moves !== undefined && q.has('w')) expect(q.get('w')).toBe(doc.state.moves.join('.'));
    if (doc.state.start !== undefined && q.has('s')) expect(q.get('s')).toBe(doc.state.start.join(','));
  });
});
