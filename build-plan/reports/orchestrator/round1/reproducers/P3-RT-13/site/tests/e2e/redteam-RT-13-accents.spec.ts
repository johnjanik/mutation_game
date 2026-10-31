// RT-13 (red team, reader-playtest), attack 27: the colours and icons of the two views. SPEC 8.1 P8
// ("Populations and Numbers have fixed colours and icons in prose, figures and formulas"); 8.3 ("They
// mark the borders and icons of panels and the underlines of the two words, never text and never the
// fill of a node"; "Icons: a small city for Populations, a small numbered disc for Numbers, used
// wherever the view is named"). Light and dark themes.
import { expect, test, type Page } from '@playwright/test';

const ACCENTS = ['rgb(0, 158, 115)', 'rgb(204, 121, 167)'];
const ROUTES = ['modules/m0-start/', 'modules/m1-mutation/', 'modules/m2-form/', 'modules/m3-classification/', 'modules/m4-numbers/', 'modules/m5-weyl/',
  'tools/board/', 'tools/garden/', 'tools/kostant/', 'tools/form/', 'tools/lab/', 'tools/numbers/', 'tools/mirror/', 'tools/symbolic/', 'tools/weyl/', 'tools/affine/', 'tools/sandbox/', ''];

async function load(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-tool]')].every((t) => t.getAttribute('data-hydrated') === 'true'), null, { timeout: 60000 });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: no text and no node fill in an accent colour on any route of phases 0 to 3`, async ({ page }) => {
    test.setTimeout(300000);
    await page.emulateMedia({ colorScheme: scheme });
    const bad: string[] = [];
    for (const route of ROUTES) {
      await load(page, route);
      const found = await page.evaluate((accents) => {
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent?.trim()) continue;
          const el = n.parentElement!;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || el.getClientRects().length === 0) continue;
          if (el instanceof SVGElement ? accents.includes(cs.fill) : accents.includes(cs.color)) out.push(`text "${n.textContent.trim().slice(0, 40)}" color ${cs.color} fill ${cs.fill}`);
        }
        document.querySelectorAll('[data-node] circle, svg circle').forEach((c) => { const f = getComputedStyle(c).fill; if (accents.includes(f)) out.push(`node fill ${f}`); });
        return out;
      }, ACCENTS);
      bad.push(...found.map((f) => `/${route}: ${f}`));
    }
    expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
  });
}

test('the words Populations and Numbers in lesson prose carry the accent underline and the icon of their view', async ({ page }) => {
  test.setTimeout(120000);
  const cases: [string, string][] = [['modules/m0-start/', 'Numbers'], ['modules/m0-start/', 'Populations'], ['modules/m4-numbers/', 'Numbers'], ['modules/m4-numbers/', 'Populations']];
  const problems: string[] = [];
  for (const [route, word] of cases) {
    await load(page, route);
    const found = await page.evaluate((word) => {
      const res: { text: string; underline: string; colour: string; icon: boolean }[] = [];
      const walker = document.createTreeWalker(document.querySelector('article')!, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement!;
        if (el.closest('[data-tool], details, .katex')) continue;
        if (!new RegExp(`\\b${word}\\b`).test(n.textContent ?? '')) continue;
        const cs = getComputedStyle(el);
        const icon = !!(el.querySelector('svg') || el.previousElementSibling?.matches('svg, img') || el.closest('[data-view-word]')?.querySelector('svg'));
        res.push({ text: (n.textContent ?? '').trim().slice(0, 60), underline: cs.textDecorationLine, colour: cs.textDecorationColor, icon });
      }
      return res;
    }, word);
    const accent = word === 'Populations' ? 'rgb(0, 158, 115)' : 'rgb(204, 121, 167)';
    if (found.length === 0) problems.push(`${route}: the word ${word} not found in prose`);
    for (const f of found) if (!f.underline.includes('underline') || f.colour !== accent || !f.icon) problems.push(`${route}: "${f.text}" underline=${f.underline} colour=${f.colour} icon=${f.icon}`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
