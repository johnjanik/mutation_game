// P1-A2: route discovery for nojs.spec.ts and worker-on-demand.spec.ts. Every .html file of the built
// site is a route, so new lessons, tools and pages are covered without editing the specs; no route is
// skipped by name. The paths are relative to Playwright's baseURL (which carries the base path).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../../', import.meta.url));

/** The built site: OUT_DIR when set (as astro.config.mjs reads it), otherwise site/dist. */
export function distDir(): string {
  const out = process.env.OUT_DIR;
  return out ? resolve(SITE, out) : join(SITE, 'dist');
}

export interface Route {
  /** Relative to baseURL: './' for the index, 'about/' for about/index.html, '404.html' for a file. */
  path: string;
  /** The HTML file in the built site. */
  file: string;
}

export function discoverRoutes(dir: string = distDir()): Route[] {
  if (!existsSync(dir)) throw new Error(`no built site at ${dir}: run npm run build first`);
  const out: Route[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name === '_astro' || name === 'katex') continue; // assets, not pages
        walk(p);
      } else if (name.endsWith('.html')) {
        const rel = relative(dir, p).split(sep).join('/');
        let path: string;
        if (rel === 'index.html') path = './';
        else if (rel.endsWith('/index.html')) path = rel.slice(0, -'index.html'.length);
        else path = rel;
        out.push({ path, file: p });
      }
    }
  };
  walk(dir);
  return out;
}
