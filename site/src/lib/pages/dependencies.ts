// The generated part of the credits page (SPEC.md 7.9, 9.3): every dependency named in the three
// package.json files of the repository (root, engine, site), and every other package whose code the
// build bundles into the scripts it ships to the reader (shippedPackages.ts; RT-FIX P4-RT-08-04), with
// the version installed and the licence read from the installed package, and the notices KaTeX's fonts
// carry. Moved here from P0-A5's credits.astro (P1-A4) so that Page.astro renders it when a page's
// frontmatter says `generated: 'dependencies'`. Build time only (Node file system); never reaches the browser.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readShippedPackages, shippedPackagesFile, type ShippedPackage } from './shippedPackages';

interface PackageJson {
  name?: string;
  version?: string;
  license?: unknown;
  licenses?: unknown;
  author?: unknown;
  homepage?: unknown;
  repository?: unknown;
  workspaces?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DependencyRow {
  name: string;
  pinned: string;
  version: string;
  licence: string | null;
  author: string | null;
  source: string | null;
  usedIn: string[];
  shipped: string | null;
}

export interface FontNotice {
  version: string;
  source: string | null;
  licenceTitle: string;
  copyright: string;
  /** A separate notice file for the fonts, when the package carries one. */
  fontNotice: string | null;
}

const readJson = (file: string): PackageJson => JSON.parse(readFileSync(file, 'utf8')) as PackageJson;

/** The repository root: the nearest directory above `from` whose package.json has workspaces. */
export function findRoot(from: string): string {
  let dir = resolve(from);
  for (;;) {
    const file = join(dir, 'package.json');
    if (existsSync(file) && readJson(file).workspaces) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error(`credits: no workspace root above ${from}`);
    dir = up;
  }
}

/** The installed package.json of a dependency, looked up as Node resolves it from that workspace. */
function installed(name: string, fromDir: string, root: string): { pkg: PackageJson; dir: string } | null {
  let dir = fromDir;
  for (;;) {
    const file = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(file)) return { pkg: readJson(file), dir: dirname(file) };
    if (dir === root) return null;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function licenceOf(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  if (typeof pkg.license === 'string' && pkg.license.trim() !== '') return pkg.license.trim();
  if (pkg.license && typeof pkg.license === 'object' && 'type' in pkg.license) return String((pkg.license as { type: unknown }).type);
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => (typeof l === 'string' ? l : String((l as { type?: unknown }).type))).join(' OR ');
  return null;
}

/**
 * A line read from a package as plain text for a table cell: a Markdown link [text](url) becomes its
 * text, an autolink <url> its address, and **bold** or *emphasis* markers are dropped. A licence file
 * may be Markdown (svelte's LICENSE.md: "Copyright (c) 2016-2025 [Svelte Contributors](https://...)").
 */
export function plainText(s: string): string {
  return s
    .replace(/\[([^\]]*)\]\([^)\s]*\)/g, '$1')
    .replace(/<(https?:\/\/[^>\s]*)>/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_\s][^*_]*)[*_](?=[\s.,;:]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The author field, or else the copyright line of the package's licence file, as found, as plain text. */
function authorOf(pkg: PackageJson | null, dir: string | null): string | null {
  const a = pkg?.author;
  if (typeof a === 'string') return plainText(a.replace(/\s*<[^>]*>/, '').replace(/\s*\([^)]*\)/, ''));
  if (a && typeof a === 'object' && 'name' in a) return plainText(String((a as { name: unknown }).name));
  if (dir === null) return null;
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
    const file = join(dir, f);
    if (!existsSync(file)) continue;
    const line = readFileSync(file, 'utf8').split('\n').find((l) => /^\s*Copyright\b/.test(l) && !/\[yyyy\]|\{yyyy\}/.test(l));
    if (line) return plainText(line);
  }
  return null;
}

function sourceOf(pkg: PackageJson | null): string | null {
  const r = pkg?.repository;
  let url: string | null = null;
  if (typeof r === 'string') url = r;
  else if (r && typeof r === 'object' && 'url' in r) url = String((r as { url: unknown }).url);
  if (url === null) return typeof pkg?.homepage === 'string' ? pkg.homepage : null;
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  return url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
}

/** What reaches the reader's browser (SPEC.md 7.6, 7.9): everything else is used only by the build. */
const SHIPPED: Record<string, string> = {
  astro: 'the island loader inlined in each page with a tool',
  '@astrojs/svelte': 'the client renderer of the islands',
  svelte: 'the runtime of the islands',
  katex: 'the stylesheet and fonts (no script)',
  nanostores: 'the highlight store and the state map of the islands',
};

/**
 * The packages the last build bundled into the reader's scripts (shippedPackages.ts). `required`: a
 * production build must have written the list before it generates the credits page; without it the
 * page would omit bundled libraries, so the build fails.
 */
export function bundledPackages(root: string, required: boolean): ShippedPackage[] {
  const file = shippedPackagesFile(join(root, 'site'));
  const list = readShippedPackages(file);
  if (list === null && required) throw new Error(`credits: ${file} was not written by the client build`);
  return list ?? [];
}

/** The packages that import a bundled package, other than the site itself. */
const importersOf = (p: ShippedPackage): string[] => p.importedBy.filter((n) => n !== 'the site');

/** The "Used" column of a package whose code the build bundles. */
function bundledUse(p: ShippedPackage): string {
  const by = importersOf(p);
  return `its code is bundled into the scripts of the pages${by.length > 0 ? ` (imported by ${by.join(', ')})` : ''}`;
}

/**
 * Every dependency of the three package.json files, and every package of `bundled` (the packages whose
 * code the build ships) that none of them names, sorted by name.
 */
export function dependencyRows(root: string = findRoot(process.cwd()), bundled: ShippedPackage[] = bundledPackages(root, false)): DependencyRow[] {
  const manifests = [
    { where: 'root', dir: root },
    { where: 'engine', dir: join(root, 'packages', 'engine') },
    { where: 'site', dir: join(root, 'site') },
  ];
  const rows = new Map<string, DependencyRow>();
  for (const m of manifests) {
    const pkg = readJson(join(m.dir, 'package.json'));
    for (const [field, kind] of [
      ['dependencies', 'dependency'],
      ['devDependencies', 'development dependency'],
    ] as const) {
      for (const [name, pinned] of Object.entries(pkg[field] ?? {})) {
        const found = installed(name, m.dir, root);
        const inst = found?.pkg ?? null;
        const row = rows.get(name) ?? {
          name,
          pinned,
          version: inst?.version ?? 'not installed',
          licence: licenceOf(inst),
          author: authorOf(inst, found?.dir ?? null),
          source: sourceOf(inst),
          usedIn: [],
          shipped: SHIPPED[name] ?? null,
        };
        row.usedIn.push(`${m.where} (${kind})`);
        rows.set(name, row);
      }
    }
  }
  for (const p of bundled) {
    const named = rows.get(p.name);
    if (named) {
      named.shipped ??= bundledUse(p);
      continue;
    }
    const found = p.dir !== null && existsSync(join(p.dir, 'package.json')) ? { pkg: readJson(join(p.dir, 'package.json')), dir: p.dir } : installed(p.name, join(root, 'site'), root);
    const inst = found?.pkg ?? null;
    rows.set(p.name, {
      name: p.name,
      pinned: inst?.version ?? 'not installed',
      version: inst?.version ?? 'not installed',
      licence: licenceOf(inst),
      author: authorOf(inst, found?.dir ?? null),
      source: sourceOf(inst),
      usedIn: [importersOf(p).length > 0 ? `a dependency of ${importersOf(p).join(', ')}` : 'added by the bundler'],
      shipped: bundledUse(p),
    });
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The licence notices found inside the installed katex package, which ships the fonts. */
export function katexFontNotice(root: string = findRoot(process.cwd())): FontNotice {
  const siteCopy = join(root, 'site', 'node_modules', 'katex');
  const home = existsSync(join(siteCopy, 'package.json')) ? siteCopy : join(root, 'node_modules', 'katex');
  const pkg = readJson(join(home, 'package.json'));
  const text = readFileSync(join(home, 'LICENSE'), 'utf8');
  return {
    version: pkg.version ?? 'unknown',
    source: sourceOf(pkg),
    licenceTitle: text.split('\n')[0]!.trim(),
    copyright: text.split('\n').find((l) => l.startsWith('Copyright'))?.trim() ?? 'no copyright line found',
    fontNotice: ['OFL.txt', 'fonts/LICENSE', 'dist/fonts/LICENSE', 'dist/fonts/OFL.txt'].find((f) => existsSync(join(home, f))) ?? null,
  };
}
