// P0-A5: the keyboard script of gate G0 on the phase-0 board (SPEC.md 7.5 A-1 to A-4, A-7, A-9;
// 4.0 History, Signs, Test hooks; 6.1; 6.3; 7.4; 7.6).
//
// Hooks read (SPEC.md 4.0 Test hooks):
//   root:    data-tool="board", data-moves, data-hydrated="true" (plan: set once the island hydrates)
//   buttons: data-node, data-board, data-value, data-can-act
//   data-out names rendered: moveCounter, historyStrip, historyCounter
//   drawing hooks (plan, for the sign and motion checks): data-disc, data-numeral, data-label
//   the live region: [role="status"] inside the root
// The Undo and Reset buttons are found by their accessible names.
// Island properties of BoardSeed beyond the common set of 4.0 Configuration (id, board, coords,
// start, moves, linkTo, prediction): boardName (stands in for board), name (the group's name).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { boardFromName, mutate } from '../../../packages/engine/src/index';
import type { Board } from '../../../packages/engine/src/index';

const INDEX = './';
const A2 = boardFromName('A2') as Board<number>;
const START = [1, 0];
const show = (p: readonly number[]): string[] => p.map((v) => A2.arith.show(v));

const root = (page: Page): Locator => page.locator('[data-tool="board"]');
const node = (page: Page, label: number): Locator => root(page).locator(`button[data-node="${label}"]`);
const region = (page: Page): Locator => root(page).locator('[role="status"]');
const strip = (page: Page): Locator => root(page).locator('[data-out="historyStrip"]');

async function open(page: Page): Promise<void> {
  await page.goto(INDEX);
  await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
}

async function values(page: Page): Promise<string[]> {
  return [await node(page, 1).getAttribute('data-value'), await node(page, 2).getAttribute('data-value')] as string[];
}

async function focusedNode(page: Page): Promise<string | null> {
  return page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-node') ?? null);
}

test('Tab reaches exactly one node button, then the History buttons', async ({ page }) => {
  await open(page);
  const seen: { node: string | null; text: string }[] = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return { node: el?.getAttribute('data-node') ?? null, text: (el?.textContent ?? '').trim() };
    });
    seen.push(f);
    if (f.text === 'Undo') break;
  }
  const nodeStops = seen.filter((s) => s.node !== null);
  expect(nodeStops.map((s) => s.node)).toEqual(['1']);
  const k = seen.findIndex((s) => s.node !== null);
  expect(seen[k + 1]?.text).toBe('Undo');
  // Undo is enabled before any move and does nothing there.
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page)).toEqual(['1', '0']);
});

test('Right and Left move between the two nodes and stop at the ends', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  expect(await focusedNode(page)).toBe('2');
  await page.keyboard.press('ArrowRight');
  expect(await focusedNode(page)).toBe('2');
  await page.keyboard.press('ArrowLeft');
  expect(await focusedNode(page)).toBe('1');
  await page.keyboard.press('ArrowLeft');
  expect(await focusedNode(page)).toBe('1');
  // The roving tab stop follows the focus: exactly one node is in the tab order.
  await page.keyboard.press('ArrowRight');
  await expect(node(page, 2)).toHaveAttribute('tabindex', '0');
  await expect(node(page, 1)).toHaveAttribute('tabindex', '-1');
});

test('Down and Up fall back to the next and previous label', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('ArrowDown');
  expect(await focusedNode(page)).toBe('2');
  await page.keyboard.press('ArrowUp');
  expect(await focusedNode(page)).toBe('1');
  await page.keyboard.press('ArrowUp');
  expect(await focusedNode(page)).toBe('1');
});

test('Home and End go to the first and last label', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('End');
  expect(await focusedNode(page)).toBe('2');
  await page.keyboard.press('End');
  expect(await focusedNode(page)).toBe('2');
  await page.keyboard.press('Home');
  expect(await focusedNode(page)).toBe('1');
  await page.keyboard.press('Home');
  expect(await focusedNode(page)).toBe('1');
});

test('Enter on city 1 mutates and announces the template string', async ({ page }) => {
  await open(page);
  const after = mutate(A2, START, 0);
  expect(after).toEqual([-1, 0]); // the engine, checked against the oracle's mutate on [[2,-1],[-1,2]]
  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await expect(region(page)).toHaveText('Mutated city 1. Populations now minus 1, 0. Move 1.');
  await expect(node(page, 1)).toHaveAttribute('data-value', show(after)[0]!);
  await expect(node(page, 1)).toHaveAttribute('data-value', '-1');
  await expect(node(page, 2)).toHaveAttribute('data-value', '0');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await expect(root(page).locator('[data-out="moveCounter"]')).toHaveText('1');
  expect(await focusedNode(page)).toBe('1'); // focus stays on the acted node
});

test('Space on city 2 mutates and announces the template string', async ({ page }) => {
  await open(page);
  expect(mutate(A2, START, 1)).toEqual([1, 1]);
  await node(page, 2).focus();
  await page.keyboard.press('Space');
  await expect(region(page)).toHaveText('Mutated city 2. Populations now 1, 1. Move 1.');
  expect(await values(page)).toEqual(['1', '1']);
});

test('node names follow the A-3 template and update after a move', async ({ page }) => {
  await open(page);
  await expect(node(page, 1)).toHaveAttribute('aria-label', 'City 1, population 1, mutation would lower it');
  await expect(node(page, 2)).toHaveAttribute('aria-label', 'City 2, population 0, mutation would raise it');
  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await expect(node(page, 1)).toHaveAttribute('aria-label', 'City 1, population minus 1, mutation would raise it');
  await expect(root(page).locator('[role="group"][aria-label]').first()).toHaveAttribute('aria-label', 'Board A2, Populations view');
});

test('the live region is present and empty before the first move', async ({ page }) => {
  await open(page);
  await expect(region(page)).toHaveCount(1);
  await expect(region(page)).toHaveAttribute('aria-live', 'polite');
  await expect(region(page)).toHaveText('');
  // It is in the server HTML, not created on hydration.
  const html = await (await page.request.get(INDEX)).text();
  expect(html).toMatch(/<div[^>]*role="status"[^>]*aria-live="polite"[^>]*><\/div>/);
});

test('a burst of moves announces only the last state', async ({ page }) => {
  await open(page);
  await region(page).evaluate((el) => {
    const w = window as unknown as { __texts: string[] };
    w.__texts = [];
    new MutationObserver(() => {
      const t = el.textContent ?? '';
      if (t !== '') w.__texts.push(t);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(region(page)).toHaveText('Mutated city 1. Populations now 1, 0. Move 2.');
  await page.waitForTimeout(800);
  const texts = await page.evaluate(() => (window as unknown as { __texts: string[] }).__texts);
  expect(texts).toEqual(['Mutated city 1. Populations now 1, 0. Move 2.']);
});

test('u undoes only while focus is inside the board; r redoes; reset empties the list', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  await page.keyboard.press('u');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  expect(await values(page)).toEqual(['1', '0']);
  await expect(region(page)).toHaveText('Undid move 1. Populations now 1, 0.');
  await page.keyboard.press('r');
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page)).toEqual(['-1', '0']);
  await expect(region(page)).toHaveText('Mutated city 1. Populations now minus 1, 0. Move 1.');

  // u with focus on the Undo button does nothing.
  await page.getByRole('button', { name: 'Undo' }).focus();
  await page.keyboard.press('u');
  await page.waitForTimeout(100);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  // u with focus on the page body does nothing.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('u');
  await page.waitForTimeout(100);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page)).toEqual(['-1', '0']);

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  await expect(strip(page).locator('button')).toHaveCount(1);
  expect(await values(page)).toEqual(['1', '0']);
});

test('scrubbing the strip moves the cursor and acting from an earlier position discards later moves', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await node(page, 2).focus();
  await page.keyboard.press('Space');
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(strip(page).locator('button')).toHaveCount(3);

  await strip(page).locator('button').nth(1).click();
  await expect(root(page)).toHaveAttribute('data-moves', '1');
  expect(await values(page)).toEqual(['-1', '0']);

  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  expect(await values(page)).toEqual(['1', '0']);
  await expect(root(page)).toHaveAttribute('data-moves', '2');
  await expect(strip(page).locator('button')).toHaveCount(3);
  await page.keyboard.press('r');
  await page.waitForTimeout(100);
  await expect(root(page)).toHaveAttribute('data-moves', '2');
});

test('a strip of more than 50 positions becomes a slider with a counter', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  for (let i = 0; i < 49; i++) await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '49');
  await expect(strip(page).locator('button')).toHaveCount(50);
  await expect(strip(page).locator('input[type="range"]')).toHaveCount(0);

  await page.keyboard.press('Enter');
  await expect(root(page)).toHaveAttribute('data-moves', '50');
  const range = strip(page).locator('input[type="range"]');
  await expect(range).toHaveCount(1);
  await expect(range).toHaveAttribute('max', '50');
  await expect(range).toHaveValue('50');
  await expect(strip(page).locator('button')).toHaveCount(0);
  const counter = root(page).locator('[data-out="historyCounter"]');
  await expect(counter).toBeVisible();
  await expect(counter).toContainText('50');

  await range.fill('10');
  await expect(root(page)).toHaveAttribute('data-moves', '10');
  await expect(counter).toContainText('10');
});

test('the focus ring is visible on the focused node', async ({ page }) => {
  await open(page);
  await node(page, 1).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  const ring = await node(page, 1).evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow };
  });
  const outlined = ring.style !== 'none' && ring.width > 0;
  expect(outlined || ring.shadow !== 'none').toBe(true);
});

test('every node button carries the four hooks with the engine\'s values', async ({ page }) => {
  await open(page);
  await expect(root(page)).toHaveAttribute('data-tool', 'board');
  await expect(root(page)).toHaveAttribute('data-moves', '0');
  const buttons = root(page).locator('button[data-node]');
  await expect(buttons).toHaveCount(2);
  const expected = show(START);
  for (let k = 0; k < 2; k++) {
    const b = buttons.nth(k);
    expect(['1', '2']).toContain(await b.getAttribute('data-node'));
    const label = Number(await b.getAttribute('data-node'));
    await expect(b).toHaveAttribute('data-board', 'populations');
    await expect(b).toHaveAttribute('data-value', expected[A2.labels.indexOf(label)]!);
    await expect(b).toHaveAttribute('data-can-act', 'true');
  }
  // After a move the hooks carry the engine's new values.
  await node(page, 2).focus();
  await page.keyboard.press('Enter');
  const after = show(mutate(A2, START, 1));
  await expect(node(page, 1)).toHaveAttribute('data-value', after[0]!);
  await expect(node(page, 2)).toHaveAttribute('data-value', after[1]!);
  await expect(root(page)).toHaveAttribute('data-moves', '1');
});

test('the hit area is 44 by 44 at 360 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  const a = await node(page, 1).boundingBox();
  const b = await node(page, 2).boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  for (const box of [a!, b!]) {
    expect(Math.round(box.width)).toBe(44);
    expect(Math.round(box.height)).toBe(44);
  }
  const overlap = a!.x < b!.x + b!.width && b!.x < a!.x + a!.width && a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
  expect(overlap).toBe(false);
});

test('a negative value is outlined with a true minus; a positive is filled', async ({ page }) => {
  await open(page);
  const disc = (label: number): Locator => root(page).locator(`[data-disc="${label}"]`);
  const paint = (label: number) =>
    disc(label).evaluate((el) => {
      const s = getComputedStyle(el);
      return { fill: s.fill, stroke: s.stroke };
    });
  const token = (name: string) =>
    page.evaluate((n) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${n})`;
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    }, name);

  const pos = await token('--sign-pos-fill');
  const neg = await token('--sign-neg-outline');
  const zero = await token('--sign-zero-outline');
  expect(pos).toBe('rgb(0, 114, 178)');
  expect(neg).toBe('rgb(213, 94, 0)');
  expect(zero).toBe('rgb(118, 118, 118)');

  expect((await paint(1)).fill).toBe(pos);
  expect((await paint(2)).stroke).toBe(zero);
  expect((await paint(2)).fill).toBe('none');

  await node(page, 1).focus();
  await page.keyboard.press('Enter');
  await expect(node(page, 1)).toHaveAttribute('data-value', '-1');
  await expect(root(page).locator('[data-numeral="1"]')).toHaveText('−1');
  await expect(root(page).locator('[data-numeral="1"]')).not.toContainText('-');
  await expect.poll(async () => (await paint(1)).stroke).toBe(neg);
  expect((await paint(1)).fill).toBe('none');
  expect((await paint(2)).stroke).toBe(zero);
  expect((await paint(2)).fill).toBe('none');
});

test('reduced motion disables transitions', async ({ browser, baseURL }) => {
  const durationIn = async (reducedMotion: 'reduce' | 'no-preference'): Promise<string> => {
    const context = await browser.newContext({ baseURL, reducedMotion, viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    await open(page);
    const d = await root(page)
      .locator('[data-disc="1"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    await context.close();
    return d;
  };
  const normal = await durationIn('no-preference');
  expect(normal.split(',').some((d) => parseFloat(d) > 0)).toBe(true);
  const reduced = await durationIn('reduce');
  expect(reduced.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
});

test('hydration does not change the reserved box size', async ({ browser, baseURL }) => {
  const measure = async (javaScriptEnabled: boolean) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    await page.goto(INDEX);
    if (javaScriptEnabled) await expect(root(page)).toHaveAttribute('data-hydrated', 'true');
    const box = await root(page).boundingBox();
    const caption = await page.locator('figure figcaption').boundingBox();
    // The size is written in CSS in the server HTML: a stylesheet rule matching the root sets its
    // height, and its inline style carries the grid extent the rule reads.
    const css = await root(page).evaluate((el) => {
      let height = '';
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSStyleRule && el.matches(rule.selectorText) && rule.style.height) height = rule.style.height;
        }
      }
      return { height, inline: el.getAttribute('style') ?? '' };
    });
    await context.close();
    return { box: box!, caption: caption!, css };
  };
  const nojs = await measure(false);
  const js = await measure(true);
  expect(nojs.css.height).not.toBe('');
  expect(nojs.css.inline).toContain('--k');
  expect(Math.abs(nojs.box.width - js.box.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(nojs.box.height - js.box.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(nojs.caption.y - js.caption.y)).toBeLessThanOrEqual(1);
  expect(nojs.box.height).toBeGreaterThan(100);
});

test('node buttons are enabled after hydration', async ({ page }) => {
  await open(page);
  const buttons = root(page).locator('button[data-node]');
  await expect(buttons).toHaveCount(2);
  for (let k = 0; k < 2; k++) await expect(buttons.nth(k)).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeEnabled();
});
