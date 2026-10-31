// A copied link of a prediction instance (SPEC.md 4.0 Predict: the answer is computed for the configured
// state, and "The board is frozen until the reader has answered or pressed "show me""; 4.0 Share: "Copy
// link"; 6.6: a link changes only what it names). The siblings of P3-RT-13-03 (RT-13 attacks 6 and 31) in
// every tool that takes a prediction: on each lesson, for each instance with a prediction, the reader
// presses "show me", makes one move, and the address bar's link (what "Copy link" copies) is opened in a
// new page. There the instance must not show the moved state under an open question: it may ignore the
// link or withdraw the prediction (the tools withdraw it; decisions/RT-FIX-P3-follow-predict.md).
// Hooks read: data-tool, data-instance, data-hydrated, data-moves, data-prediction, data-control
// predictShow and predictCheck, and data-node, data-board, data-value, data-can-act on the node buttons, and
// data-control="paint", data-paint, data-colour, data-can-act on the paint controls of T13's decoration.
import { expect, test, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { discoverRoutes } from './routes';

/** The lessons whose built page holds a prediction. */
const LESSONS = discoverRoutes()
  .filter((r) => /^modules\/m\d+-[^/]+\/$/.test(r.path) && readFileSync(r.file, 'utf8').includes('data-prediction'))
  .map((r) => r.path);

/** The instance's moves, the value of every node button and the colour of every paint control of T13's
 * decoration (its buttons are controls, not node buttons: decisions/RT-FIX-P6-t13-followup.md): the state
 * the figure shows. */
function shown(t: Locator): Promise<string> {
  return t.evaluate((root) => {
    const nodes = [...root.querySelectorAll('button[data-node]')] as HTMLElement[];
    const paint = [...root.querySelectorAll('button[data-control="paint"]')] as HTMLElement[];
    return `${root.getAttribute('data-moves')}|${nodes.map((b) => `${b.dataset.board}:${b.dataset.node}=${b.dataset.value}`).join(' ')}|${paint.map((b) => `${b.dataset.paint}=${b.dataset.colour}`).join(' ')}`;
  });
}

/** The first thing the reader can press that makes a move or a change the link records: a node button, or a
 * paint control of T13's decoration (T13 keeps its moves out of the link and records the decoration). */
const firstAct = (t: Locator): Locator => t.locator('button[data-node][data-can-act="true"], button[data-control="paint"][data-can-act="true"]').first();

async function questionOpen(t: Locator): Promise<boolean> {
  const check = t.locator('[data-prediction] [data-control="predictCheck"]');
  return (await check.count()) > 0 && (await check.first().isEnabled());
}

test('the lessons are found', () => {
  expect(LESSONS.length).toBeGreaterThan(5);
});

for (const route of LESSONS) {
  // regression: P3-RT-13-03
  test(`${route}: a copied link of a prediction instance never shows another state under the open question`, async ({ page }) => {
    test.setTimeout(240000);
    await page.goto(route);
    const ids = await page.locator('[data-tool]:has([data-prediction])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.instance ?? ''));
    expect(ids.length, `${route}: instances with a prediction`).toBeGreaterThan(0);
    const checked: string[] = [];
    for (const id of ids) {
      await page.goto(route);
      const t = page.locator(`[data-tool][data-instance="${id}"]`);
      await t.scrollIntoViewIfNeeded();
      await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
      const configured = await shown(t);
      await t.locator('[data-control="predictShow"]').click();
      const node = firstAct(t);
      if ((await node.count()) === 0) continue; // nothing to play here, so no link of a moved state
      await node.click();
      await expect.poll(() => new URL(page.url()).search.includes(`${id}.`), { timeout: 10000 }).toBe(true);
      const link = page.url();
      const other = await page.context().newPage();
      await other.goto(link);
      const t2 = other.locator(`[data-tool][data-instance="${id}"]`);
      await t2.scrollIntoViewIfNeeded();
      await expect(t2).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
      await other.waitForTimeout(1000); // T10 reads its link in a task of its own; T15 checks it asynchronously
      const result = { id, open: await questionOpen(t2), moved: (await shown(t2)) !== configured };
      await other.close();
      expect.soft(result, `${route} ${id}: the link ${link} shows another state under the open question`).not.toMatchObject({ open: true, moved: true });
      checked.push(id);
    }
    test.info().annotations.push({ type: 'checked', description: checked.join(', ') });
    expect(checked.length, `${route}: prediction instances with a link checked`).toBeGreaterThan(0);
  });
}
