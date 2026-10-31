// RT-08 (content rules), attack 38: the sandbox link closes each module.
// SPEC.md 4 T16: "It is the last link of every module from M2 on"; 8.1 P6: "The sandbox link closes each
// module." The links block of every lesson is rendered by ModuleLinks.astro; at 69546f0 it rendered the
// order sandbox, atlas, next module, so where the next module is released the sandbox link came first.
// Read with JavaScript off from the built pages (hooks of P1-A4: data-anatomy="links", data-link).
import { expect, test } from '@playwright/test';

const LESSONS = ['m2-form', 'm3-classification', 'm4-numbers'];

test.describe('the sandbox link is the last link of the module', () => {
  test.use({ javaScriptEnabled: false });
  for (const slug of LESSONS) {
    // regression: P3-RT-08-06
    test(`/modules/${slug}/: last link of the links block is the sandbox`, async ({ page }) => {
      await page.goto(`modules/${slug}/`);
      const links = page.locator('main [data-anatomy="links"] a[data-link]');
      const kinds = await links.evaluateAll((as) => as.map((a) => a.getAttribute('data-link')));
      expect(kinds, `links of /modules/${slug}/ in order`).toContain('sandbox');
      // Observed at 69546f0: ["sandbox", "next"].
      expect(kinds[kinds.length - 1], `last link of /modules/${slug}/ (all: ${kinds.join(', ')})`).toBe('sandbox');
    });
  }
});
