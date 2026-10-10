// The one KaTeX call of the site (CONTRACTS.md 4; SPEC.md 7.2 items 2 and 3, 7.3, 7.5 A-12).
// Build time only: imported from .astro frontmatter and from tests, never from a .svelte file
// or any script that reaches the browser (SPEC.md 7.6). The KaTeX resolved here is the one
// site/package.json pins, the same copy rehype-katex resolves (route (a), decisions/P0-A3.md).
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
