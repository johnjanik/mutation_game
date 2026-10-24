#!/usr/bin/env node
// The internal-link check of SPEC.md 7.7 (Links row: "internal links checked by the build") and the
// rule of 7.3 ("A link to a page that has not been released yet is left out by the build, driven by a
// `released` flag in each page's front matter"). Run after every `npm run build` (the root postbuild
// script, so a preview build, a release build and the BASE_PATH=/sub/path/ build of e2e:basepath all
// run it) and by hand as `npm run postbuild` (OUT_DIR, BASE_PATH and SITE_URL are read as by the
// build, through site/src/lib/siteAndBase.mjs, whose functions site/astro.config.mjs uses; plain
// JavaScript, so that plain Node 22.12 to 22.17, which loads no .ts module by default, runs this
// script, RT-FIX P4-RT-12-03). It reads the built directory only: every URL attribute of
// every built page that points into the site must lie under the base, name a file of the build, and
// not name a page whose source says it is not released. Exit 1 on any problem.
// In a release build (RELEASE set) this check is the last step of the build: while it runs, the
// open-items report that the Astro build marked complete is marked incomplete, and it is marked
// complete again only when the check passes, so that npm run report never presents the report of a
// release build that failed here (RT-FIX P4-RT-12-04; site/src/lib/openItemsReport.mjs).
// External links are not followed here; links.yml checks them weekly (SPEC.md 7.7). No dependency.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { holdForLinkCheck, settleLinkCheck } from '../site/src/lib/openItemsReport.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_DIR = join(ROOT, 'site');

/** Attributes that carry a URL into the site; `data` counts on <object> only. */
const URL_ATTRIBUTES = new Set(['href', 'src', 'srcset', 'poster', 'action', 'xlink:href', 'component-url', 'renderer-url', 'before-hydration-url']);

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

/** Decodes the character references an attribute value may hold. */
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * Every URL-bearing attribute of the elements of a page, found by scanning tags. The contents of
 * script and style elements and of comments are not markup and are skipped.
 * @param {string} html
 * @returns {{ tag: string; attribute: string; value: string }[]}
 */
export function linksOf(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, '<script$1>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '<style>');
  const tag = /<([a-zA-Z][\w:.-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
  const attr = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  /** @type {{ tag: string; attribute: string; value: string }[]} */
  const out = [];
  for (const m of stripped.matchAll(tag)) {
    const name = m[1].toLowerCase();
    for (const a of (m[2] ?? '').matchAll(attr)) {
      const attribute = a[1].toLowerCase();
      if (!URL_ATTRIBUTES.has(attribute) && !(attribute === 'data' && name === 'object')) continue;
      const raw = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '').trim();
      const values = attribute === 'srcset' ? raw.split(',').map((c) => c.trim().split(/\s+/)[0] ?? '') : [raw];
      for (const value of values) if (value !== '') out.push({ tag: name, attribute, value });
    }
  }
  return out;
}

/** The route of a built file: index.html is /, about/index.html is /about/, 404.html is /404. */
export function routeOfFile(rel) {
  const r = rel.split(sep).join('/');
  if (r === 'index.html') return '/';
  if (r.endsWith('/index.html')) return '/' + r.slice(0, -'index.html'.length);
  return '/' + r.replace(/\.html$/, '');
}

/** Every file under a directory, as paths relative to it with forward slashes. */
function filesUnder(dir) {
  /** @type {string[]} */
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** The `released` value of a Markdown or MDX front matter: true, false, or undefined when absent. */
export function releasedFlag(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!fm) return undefined;
  const m = /^released:\s*(true|false)\s*(?:#.*)?$/m.exec(fm[1]);
  return m ? m[1] === 'true' : undefined;
}

/**
 * The routes of pages that are built but not released, from the sources (the rules of
 * site/src/lib/pages/released.ts): a lesson of src/content/modules or a page of src/content/pages
 * unless its front matter says `released: true`; a tool whose registry entry says `released: false`
 * (its /tools/ and /embed/ routes); a Markdown or MDX page of src/pages whose front matter says
 * `released: false`.
 * @param {string} siteDir
 * @returns {Map<string, string>} route (such as /dev/math-check/) to the source file that withholds it
 */
export function unreleasedRoutes(siteDir = SITE_DIR) {
  /** @type {Map<string, string>} */
  const out = new Map();
  const src = join(siteDir, 'src');
  const list = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((n) => re.test(n)).sort() : []);
  for (const [dir, prefix] of [[join(src, 'content', 'modules'), '/modules/'], [join(src, 'content', 'pages'), '/']]) {
    for (const name of list(dir, /\.mdx?$/)) {
      if (releasedFlag(readFileSync(join(dir, name), 'utf8')) !== true) out.set(`${prefix}${name.replace(/\.mdx?$/, '')}/`, relative(siteDir, join(dir, name)).split(sep).join('/'));
    }
  }
  const registry = join(src, 'tools', 'registry');
  for (const name of list(registry, /^T\d{2}\.ts$/)) {
    const text = readFileSync(join(registry, name), 'utf8');
    const id = /^\s*id:\s*['"]([a-z-]+)['"]/m.exec(text)?.[1];
    if (id && /\breleased\s*:\s*false\b/.test(text)) {
      for (const route of [`/tools/${id}/`, `/embed/${id}/`]) out.set(route, `src/tools/registry/${name}`);
    }
  }
  const pages = join(src, 'pages');
  if (existsSync(pages)) {
    for (const rel of filesUnder(pages).filter((f) => /\.mdx?$/.test(f))) {
      if (releasedFlag(readFileSync(join(pages, rel), 'utf8')) !== false) continue;
      const stem = rel.replace(/\.mdx?$/, '');
      const route = stem === 'index' ? '/' : stem.endsWith('/index') ? `/${stem.slice(0, -'index'.length)}` : `/${stem}/`;
      out.set(route, `src/pages/${rel}`);
    }
  }
  return out;
}

/**
 * @typedef {{ route: string; url: string; reason: string }} LinkProblem
 * @typedef {{ pages: number; links: number; problems: LinkProblem[] }} LinkResult
 */

/**
 * Checks every internal link of every built page.
 * @param {{ distDir: string; base: string; site?: string; unreleased?: ReadonlyMap<string, string> }} opts
 *   base begins and ends with /; site is the configured site URL (its origin counts as internal)
 * @returns {LinkResult}
 */
export function checkLinks({ distDir, base, site = 'http://localhost', unreleased = new Map() }) {
  const origin = new URL(site).origin;
  const files = filesUnder(distDir);
  const fileSet = new Set(files);
  /** @type {LinkProblem[]} */
  const problems = [];
  let links = 0;
  const pages = files.filter((f) => f.endsWith('.html'));
  for (const file of pages) {
    const route = routeOfFile(file);
    const pageUrl = new URL(base + route.replace(/^\//, ''), origin);
    for (const { value } of linksOf(readFileSync(join(distDir, file), 'utf8'))) {
      if (value.startsWith('#')) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) continue; // mailto:, tel:, data:, javascript:
      let target;
      try {
        target = new URL(value, pageUrl);
      } catch {
        problems.push({ route, url: value, reason: 'not a valid URL' });
        continue;
      }
      if (target.origin !== origin) continue; // external: links.yml
      links++;
      if (!target.pathname.startsWith(base)) {
        problems.push({ route, url: value, reason: `resolves to ${target.pathname}, outside the base ${base} (a link typed with a leading slash?)` });
        continue;
      }
      let rel;
      try {
        rel = decodeURIComponent(target.pathname.slice(base.length));
      } catch {
        problems.push({ route, url: value, reason: 'not a valid URL' });
        continue;
      }
      const candidates = rel === '' || rel.endsWith('/') ? [`${rel}index.html`] : [rel, `${rel}.html`, `${rel}/index.html`];
      const hit = candidates.find((c) => fileSet.has(c));
      if (hit === undefined) {
        problems.push({ route, url: value, reason: 'no such page or file in the build (a dead internal link)' });
        continue;
      }
      if (!hit.endsWith('.html')) continue;
      const targetRoute = routeOfFile(hit);
      const source = unreleased.get(targetRoute);
      if (source !== undefined && targetRoute !== route) {
        problems.push({ route, url: value, reason: `links to ${targetRoute}, a page that has not been released (${source}); the build must leave the link out` });
      }
    }
  }
  return { pages: pages.length, links, problems };
}

/** The lines the command prints. */
export function formatResult(result, distLabel) {
  const lines = result.problems.map((p) => `  ${p.route}: ${p.url}: ${p.reason}`);
  lines.push(`links: ${result.links} internal links on ${result.pages} pages of ${distLabel} checked, ${result.problems.length} problems`);
  return lines.join('\n');
}

async function main() {
  // First, before anything that can fail: a release report stays incomplete until the check passes.
  holdForLinkCheck();
  const config = await import(pathToFileURL(join(SITE_DIR, 'src', 'lib', 'siteAndBase.mjs')).href);
  const { site, base } = config.siteAndBase(process.env);
  const distDir = resolve(SITE_DIR, config.outDirFrom(process.env));
  if (!existsSync(distDir)) {
    console.error(`links: no built directory at ${relative(ROOT, distDir)}; run npm run build first`);
    process.exit(1);
  }
  const result = checkLinks({ distDir, base, site, unreleased: unreleasedRoutes(SITE_DIR) });
  const text = formatResult(result, relative(ROOT, distDir).split(sep).join('/'));
  settleLinkCheck(result.problems.length === 0);
  if (result.problems.length > 0) console.error(text);
  else console.log(text);
  process.exit(result.problems.length > 0 ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`links: ${err instanceof Error ? err.message : err}`); process.exit(1); });
}
