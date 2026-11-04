// FIX-ci-e2e: a tool island hydrates even when the page never has an idle period. On GitHub's runner,
// 1 to 7 tool islands per run never set data-hydrated, with nothing in the browser console of the
// failed test (no failed request, no hydration error, no page error). The same signature is
// reproduced by keeping the page busy with a message loop: Astro 7.3.8's client:idle waits on
// requestIdleCallback with no timeout, so the island never starts. The tool islands now pass a
// timeout (src/tools/hydration.ts); this file fails if one loses it. Not a tool test: it reads the
// data-hydrated hook only.
import { expect, test } from '@playwright/test';

/** Every tool route (the HYDRATED table of src/tools/ToolIsland.astro). */
const TOOLS = ['affine', 'atlas', 'board', 'fold', 'form', 'garden', 'geometry', 'kostant', 'lab', 'mirror', 'numbers', 'rep', 'sandbox', 'satake', 'symbolic', 'weyl'];

/** Keeps the page's main thread from ever being idle: a message loop that works 2 ms per turn. */
const BUSY = `(() => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => { const t = performance.now(); while (performance.now() - t < 2) {} ch.port2.postMessage(0); };
  ch.port2.postMessage(0);
})();`;

for (const tool of TOOLS) {
  test(`tools/${tool}/ hydrates on a page that is never idle`, async ({ page }) => {
    await page.addInitScript(BUSY);
    await page.goto(`tools/${tool}/`);
    await expect(page.locator('astro-island [data-tool]').first()).toHaveAttribute('data-hydrated', 'true');
  });
}

test('embed/board/ hydrates on a page that is never idle', async ({ page }) => {
  await page.addInitScript(BUSY);
  await page.goto('embed/board/');
  await expect(page.locator('astro-island [data-tool]').first()).toHaveAttribute('data-hydrated', 'true');
});
