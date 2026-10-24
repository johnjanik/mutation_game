// RT-FIX P4-RT-07-03: the KaTeX fonts a page uses are preloaded from its head. Without a preload the
// stylesheet (font-display: block) requests a font only when the first layout meets text set in it, the
// fonts arrive after the first paint, and the whole lesson is laid out and painted again (M7: Total
// Blocking Time about 420 ms against about 200 ms with the three preloads, at four times slowdown;
// SPEC.md 7.6). lib/katex.ts reads which font a KaTeX class selects from the installed stylesheet; the
// middleware (site/src/middleware.ts) adds the preloads to every generated page with KaTeX markup.
// The browser check on the built site is site/tests/e2e/katex-font-preload.spec.ts.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KATEX_VERSION, katexFontFiles, katexFontPreloads, katexFontRules, katexStylesheetHref, renderTex, withKatexFontPreloads } from '../../src/lib/katex';

const requireFromSite = createRequire(new URL('../../package.json', import.meta.url));
const cssFile = requireFromSite.resolve('katex/dist/katex.min.css');
const css = readFileSync(cssFile, 'utf8');
const page = (base: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><link rel="stylesheet" href="${katexStylesheetHref(base)}"></head><body>${body}</body></html>`;

describe('KaTeX font preloads', () => {
  it('the stylesheet gives every face a woff2 file that the installed package ships', () => {
    const { faces } = katexFontRules(css);
    expect(faces.length).toBeGreaterThan(15);
    for (const f of faces) expect(existsSync(join(dirname(cssFile), f.file)), f.file).toBe(true);
  });

  it('the classes of ordinary formulas select Main, Math italic and SansSerif', () => {
    const { rules } = katexFontRules(css);
    const of = (cls: string) => rules.find((r) => r.classes.length === 1 && r.classes[0] === cls);
    expect(of('katex')).toMatchObject({ family: 'KaTeX_Main', weight: '400', style: 'normal' });
    expect(of('mathnormal')).toMatchObject({ family: 'KaTeX_Math', weight: '400', style: 'italic' });
    expect(of('mathsf')).toMatchObject({ family: 'KaTeX_SansSerif', weight: '400', style: 'normal' });
    expect(of('textbf')).toMatchObject({ family: 'KaTeX_Main', weight: '700' });
  });

  // regression: P4-RT-07-03
  it('a page preloads exactly the fonts its KaTeX markup uses', () => {
    expect(katexFontFiles(renderTex('x_1 + 2', false), css)).toEqual(['fonts/KaTeX_Main-Regular.woff2', 'fonts/KaTeX_Math-Italic.woff2']);
    expect(katexFontFiles(renderTex('\\mathsf{A}_3', false), css)).toEqual(['fonts/KaTeX_Main-Regular.woff2', 'fonts/KaTeX_SansSerif-Regular.woff2']);
    expect(katexFontFiles(renderTex('\\mathfrak{g} = 1', false), css)).toEqual(['fonts/KaTeX_Fraktur-Regular.woff2', 'fonts/KaTeX_Main-Regular.woff2']);
    expect(katexFontFiles('<p class="question">No mathematics here.</p>', css)).toEqual([]);
  });

  // regression: P4-RT-07-03
  it('the preloads sit before the KaTeX stylesheet, under the base path, and match its font requests', () => {
    const body = renderTex('a = Cp', false);
    for (const base of ['/', '/sub/path/']) {
      const html = withKatexFontPreloads(page(base, body), base);
      const dir = `${base}katex/${KATEX_VERSION}/fonts/`;
      const links = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/g)].map((m) => m[1]);
      expect(links).toEqual([`${dir}KaTeX_Main-Regular.woff2`, `${dir}KaTeX_Math-Italic.woff2`]);
      expect(html.indexOf(links[0]!)).toBeLessThan(html.indexOf(katexStylesheetHref(base)));
      expect(katexFontPreloads(page(base, body), base)).toBe(html.slice(html.indexOf('<link rel="preload"'), html.indexOf('<link rel="stylesheet"')));
    }
  });

  it('a page without KaTeX markup is left as it is', () => {
    const html = page('/', '<p>Text only.</p>');
    expect(withKatexFontPreloads(html, '/')).toBe(html);
  });
});
