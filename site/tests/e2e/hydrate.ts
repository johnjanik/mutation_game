// The procedure by which a browser spec brings a route to its hydrated default state with JavaScript on
// and without a click or a key (RT-FIX P3-RT-06-02). SPEC.md 7.6: the first tool of a page hydrates when
// the browser is idle (client:idle) and the others when scrolled into view (client:visible); E-9 and 7.6:
// "No tool may need the worker for its default state", which covers every tool of the page, not only
// the tools of the first screen. So each island still waiting is scrolled into view, in document order,
// and waited for; a scripted scroll is not the reader's first interaction (it shows the default state
// of the island and acts on nothing). Astro keeps the attribute ssr on an <astro-island> until it has
// hydrated it; an island has no box of its own (display: contents), and client:visible observes its
// children, so the first child with a box is what is scrolled into view. The caller asserts that no
// island is left waiting (astro-island[ssr]) and reads its hooks.
import type { Page } from '@playwright/test';

/** Time allowed for one island to hydrate once it is in view. */
const PER_ISLAND_MS = 15_000;

export async function hydrateEveryIsland(page: Page): Promise<void> {
  const islands = page.locator('astro-island');
  const n = await islands.count();
  for (let k = 0; k < n; k++) {
    const island = await islands.nth(k).elementHandle();
    if (island === null) continue;
    const waiting = await island.evaluate((el) => {
      if (!el.isConnected || !el.hasAttribute('ssr')) return false;
      const target = [...el.children].find((c) => {
        const r = c.getBoundingClientRect();
        return r.width > 0 || r.height > 0;
      });
      (target ?? el.firstElementChild ?? el).scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    });
    // A timeout is not an error here: the island is then still waiting, and the caller's assertion
    // names it.
    if (waiting) await page.waitForFunction((el) => !el.isConnected || !el.hasAttribute('ssr'), island, { timeout: PER_ISLAND_MS }).catch(() => undefined);
    await island.dispose();
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}
