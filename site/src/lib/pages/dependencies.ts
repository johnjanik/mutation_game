// The generated part of the credits page (SPEC.md 7.9, 9.3): every dependency named in the three
// package.json files of the repository (root, engine, site), with the version installed and the
// licence read from the installed package, and the notices KaTeX's fonts carry. Moved here from
// P0-A5's credits.astro (P1-A4) so that Page.astro renders it when a page's frontmatter says
// `generated: 'dependencies'`. Build time only (Node file system); never reaches the browser.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

/** The author field, or else the copyright line of the package's licence file, as found. */
function authorOf(pkg: PackageJson | null, dir: string | null): string | null {
  const a = pkg?.author;
  if (typeof a === 'string') return a.replace(/\s*<[^>]*>/, '').replace(/\s*\([^)]*\)/, '').trim();
  if (a && typeof a === 'object' && 'name' in a) return String((a as { name: unknown }).name);
  if (dir === null) return null;
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
    const file = join(dir, f);
    if (!existsSync(file)) continue;
    const line = readFileSync(file, 'utf8').split('\n').find((l) => /^\s*Copyright\b/.test(l) && !/\[yyyy\]|\{yyyy\}/.test(l));
    if (line) return line.trim();
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
};

/** Every dependency of the three package.json files, sorted by name. */
export function dependencyRows(root: string = findRoot(process.cwd())): DependencyRow[] {
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
