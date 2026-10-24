// The one KaTeX call of the site (CONTRACTS.md 4; SPEC.md 7.2 items 2 and 3, 7.3, 7.5 A-12).
// Build time only: imported from .astro frontmatter, the middleware and tests, never from a .svelte file
// or any script that reaches the browser (SPEC.md 7.6). The KaTeX resolved here is the one
// site/package.json pins, the same copy rehype-katex resolves (route (a), decisions/P0-A3.md).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import katex from 'katex';
import katexPackage from 'katex/package.json';

/** The installed KaTeX version, read from its package.json; the stylesheet path carries it. */
export const KATEX_VERSION: string = katexPackage.version;

/**
 * Typeset a formula at build time. MathML is included for assistive technology (A-12);
 * a malformed formula throws KaTeX's ParseError, which fails the build.
 */
export function renderTex(src: string, display: boolean): string {
  return katex.renderToString(src, {
    displayMode: display,
    output: 'htmlAndMathml',
    throwOnError: true,
    trust: false,
  });
}

/** The self-hosted stylesheet under the base path, joined with exactly one slash. */
export function katexStylesheetHref(base: string): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}katex/${KATEX_VERSION}/katex.min.css`;
}

// The fonts a page's KaTeX markup uses, preloaded from its head (SPEC.md 7.6 lab timings; RT-FIX
// P4-RT-07-03). The stylesheet requests a font only when the first layout meets text set in it, so
// without a preload the fonts arrive after the first paint and the whole page is laid out and painted
// again. Which font a class selects is read from the installed stylesheet itself: its @font-face rules
// (family, weight, style, woff2 file) and its rules that set a family, a weight or a style for KaTeX
// classes. A class that sets only a weight or a style is taken in KaTeX_Main, the family of `.katex`.

interface Face {
  family: string;
  weight: string;
  style: string;
  /** The woff2 file, relative to the stylesheet, as its url() names it ("fonts/KaTeX_Main-Regular.woff2"). */
  file: string;
}

interface ClassRule {
  /** The classes one element must carry (the last compound selector of the rule). */
  classes: string[];
  family: string;
  weight: string;
  style: string;
}

const declaration = (body: string, name: string): string | undefined => body.match(new RegExp(`(?:^|;)${name}:([^;]+)`))?.[1]?.trim();
const weightOf = (w: string | undefined): string => (w === undefined || w === 'normal' ? '400' : w === 'bold' ? '700' : w);
/** A family name as the stylesheet writes it, quoted or not. */
const familyOf = (value: string | undefined): string | undefined => value?.match(/KaTeX_\w+/)?.[0];

let installedStylesheet: string | null = null;
/** The installed stylesheet (the one scripts/katex-assets.mjs copies), resolved as `import katex` resolves. */
function stylesheet(): string {
  installedStylesheet ??= readFileSync(createRequire(import.meta.url).resolve('katex/dist/katex.min.css'), 'utf8');
  return installedStylesheet;
}

/** The faces and the class rules of a KaTeX stylesheet. */
export function katexFontRules(css: string): { faces: Face[]; rules: ClassRule[] } {
  const faces: Face[] = [];
  for (const m of css.matchAll(/@font-face\{([^}]*)\}/g)) {
    const body = m[1]!;
    const family = familyOf(declaration(body, 'font-family'));
    const file = body.match(/url\(["']?([^)"']+\.woff2)["']?\)/)?.[1];
    if (family && file) faces.push({ family, weight: weightOf(declaration(body, 'font-weight')), style: declaration(body, 'font-style') ?? 'normal', file });
  }
  const rules: ClassRule[] = [];
  for (const m of css.replace(/@font-face\{[^}]*\}/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2]!;
    const shorthand = declaration(body, 'font');
    const family = familyOf(declaration(body, 'font-family') ?? shorthand);
    const weight = declaration(body, 'font-weight');
    const style = declaration(body, 'font-style');
    if (family === undefined && weight === undefined && style === undefined) continue;
    for (const selector of m[1]!.split(',')) {
      const compounds = selector.trim().split(/[\s>+~]+/).filter((c) => c.includes('.'));
      const last = compounds.at(-1);
      if (last === undefined) continue;
      const classes = last.split('.').slice(1).map((c) => c.replace(/[:[].*$/, '')).filter((c) => c !== '');
      if (classes.length === 0) continue;
      rules.push({ classes, family: family ?? 'KaTeX_Main', weight: weightOf(weight), style: style ?? 'normal' });
    }
  }
  return { faces, rules };
}

/** The face a rule selects: the exact face of its family, or else the family's regular face. */
function faceOf(faces: Face[], rule: ClassRule): Face | undefined {
  return (
    faces.find((f) => f.family === rule.family && f.weight === rule.weight && f.style === rule.style) ??
    faces.find((f) => f.family === rule.family && f.weight === '400' && f.style === 'normal')
  );
}

/**
 * The font files (relative to the stylesheet) that the KaTeX markup of a page uses, in the order of the
 * stylesheet's @font-face rules; empty for a page without KaTeX markup (no element of class `katex`).
 */
export function katexFontFiles(html: string, css?: string): string[] {
  const lists = [...html.matchAll(/\sclass="([^"]*)"/g)].map((m) => new Set(m[1]!.split(/\s+/)));
  if (!lists.some((l) => l.has('katex'))) return [];
  const { faces, rules } = katexFontRules(css ?? stylesheet());
  const used = new Set<string>();
  for (const rule of rules) {
    if (!lists.some((l) => rule.classes.every((c) => l.has(c)))) continue;
    const face = faceOf(faces, rule);
    if (face) used.add(face.file);
  }
  return faces.map((f) => f.file).filter((file, k, all) => used.has(file) && all.indexOf(file) === k);
}

/** The <link rel="preload"> elements for the fonts a page's KaTeX markup uses, under the base path. */
export function katexFontPreloads(html: string, base: string): string {
  const dir = katexStylesheetHref(base).replace(/katex\.min\.css$/, '');
  return katexFontFiles(html)
    .map((file) => `<link rel="preload" href="${dir}${file}" as="font" type="font/woff2" crossorigin>`)
    .join('');
}

/**
 * A built page with the preloads of its KaTeX fonts placed just before the KaTeX stylesheet link
 * (Base.astro); a page without KaTeX markup, or without that link, is returned unchanged.
 */
export function withKatexFontPreloads(html: string, base: string): string {
  const preloads = katexFontPreloads(html, base);
  if (preloads === '') return html;
  const at = html.indexOf(`<link rel="stylesheet" href="${katexStylesheetHref(base)}"`);
  return at < 0 ? html : `${html.slice(0, at)}${preloads}${html.slice(at)}`;
}
