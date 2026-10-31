// RT-13 (red team, reader-playtest), attack 13: a term met before it is taught, along the reader's
// path M0 to M5 in order (the modules index order). SPEC 8.4 "Define every term on first use and link
// later uses to a glossary entry"; 1.2 "The primary reader sets the level of the prose". The terms
// are of Appendix C (finite, affine, level) and of the lens's mechanics (highest root). A block is a
// prose paragraph or list item, or a figure's visible caption and outputs, in document order; the
// first block that uses the term must define it (that block or the next), or link the glossary.
import { expect, test, type Page } from '@playwright/test';

const PATH = ['m0-start', 'm1-mutation', 'm2-form', 'm3-classification', 'm4-numbers', 'm5-weyl'];
const TERMS: { term: string; use: RegExp; definition: RegExp }[] = [
  { term: 'finite (finite type)', use: /\bfinite type\b/, definition: /closes up when it has finitely many root populations/ },
  { term: 'affine', use: /\baffine\b/, definition: /the site calls them affine/ },
  { term: 'highest root', use: /\bhighest root\b/, definition: /This end is the highest root of the board/ },
];

interface Block { route: string; text: string; glossary: boolean }

async function blocks(page: Page, route: string): Promise<Block[]> {
  await page.goto(`modules/${route}/`);
  return page.evaluate((route) => {
    const out: { route: string; text: string; glossary: boolean }[] = [];
    const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('details:not([open])');
    const text = (el: Element) => { const c = el.cloneNode(true) as Element; c.querySelectorAll('.katex-mathml, details, [data-live], .visually-hidden').forEach((x) => x.remove()); return (c.textContent ?? '').replace(/\s+/g, ' ').trim(); };
    const els = document.querySelectorAll('article p, article li, article figcaption, article [data-out]');
    for (const el of els) {
      if (!visible(el)) continue;
      if (el.matches('p, li') && el.querySelector('p, li')) continue;
      if (el.closest('[data-anatomy="lie-theory"], [data-anatomy="sources"], [data-statements]')) continue; // M0 beat 5 says its statements use names a later module explains
      const t = text(el);
      if (t) out.push({ route, text: t, glossary: !!el.querySelector('a[href*="glossary"]') });
    }
    return out;
  }, route);
}

test('every term is defined or linked at its first occurrence on the path M0 to M5', async ({ page }) => {
  test.setTimeout(120000);
  const all: Block[] = [];
  for (const r of PATH) all.push(...(await blocks(page, r)));
  const problems: string[] = [];
  for (const { term, use, definition } of TERMS) {
    const first = all.findIndex((b) => use.test(b.text));
    const def = all.findIndex((b) => definition.test(b.text));
    if (first < 0) continue;
    const ok = all[first].glossary || def === first || def === first + 1;
    if (!ok) problems.push(`${term}: first used on /modules/${all[first].route}/ in "${all[first].text.slice(0, 160)}"; defined ${def < 0 ? 'nowhere on the path' : `on /modules/${all[def].route}/ in "${all[def].text.slice(0, 100)}"`}`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
