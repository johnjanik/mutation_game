// The `released` flag of SPEC.md 7.3 (P1-A4): "A link to a page that has not been released yet is
// left out by the build, driven by a `released` flag in each page's front matter." A page or tool
// with released: false is still built (its route exists and its tests run); no link to it is
// rendered anywhere and it is left out of the module index.
//
// One implementation: pure functions over plain lists (unit-tested without astro:content), and thin
// wrappers that read the site's files at build time. Build time only; never import this module from
// a .svelte file or anything that reaches the browser.
//
// For MDX prose (a lesson's map of the seven statements, the about page): call linkIfReleased in an
// MDX expression and render the text alone when it is null, for example
//   export const m1 = linkIfReleased({ kind: 'module', number: 1 });
//   {m1 ? <a href={m1}>Statement two</a> : 'Statement two'}
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { isReleaseBuild } from '../unverifiedRegistry';

/** Tool ids of SPEC.md section 4 with their numbers (the registry file is T{nn}.ts). */
export const TOOL_NUMBERS = {
  board: 1, garden: 2, form: 3, lab: 4, numbers: 5, mirror: 6, symbolic: 7, weyl: 8,
  kostant: 9, geometry: 10, fold: 11, rep: 12, satake: 13, atlas: 14, affine: 15, sandbox: 16,
} as const;
export type ToolId = keyof typeof TOOL_NUMBERS;

export type Target =
  | { kind: 'module'; slug: string }
  | { kind: 'module'; number: number }
  | { kind: 'page'; slug: string }
  | { kind: 'tool'; id: ToolId; query?: string }
  | { kind: 'atlas'; board: string }
  | { kind: 'static'; name: 'index' | 'modules' | 'sources' | 'open-items' };

export interface ModuleRecord {
  slug: string;
  module: number;
  released: boolean;
  title?: string;
  question?: string;
}
export interface PageRecord {
  slug: string;
  released: boolean;
}
export interface ToolRecord {
  id: string;
  /** The optional `released` field of a registry entry; only `false` withholds the tool. */
  released?: boolean;
}
/** What exists in the site, as plain data. */
export interface Inventory {
  modules: ModuleRecord[];
  pages: PageRecord[];
  tools: ToolRecord[];
  /** True when site/src/pages/atlas/[board].astro exists. */
  atlas: boolean;
  /** True in a release build (RELEASE set), when open-items is not built. */
  release: boolean;
}

/** Routes of static pages and route directories that a collection entry may never take as its slug. */
export const RESERVED_SLUGS = ['sources', 'open-items', 'modules', 'tools', 'atlas', 'embed', 'index', 'dev'] as const;

/** Joins the base and a route with exactly one slash; the route never begins with a slash. */
export function joinBase(base: string, route: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return b + route.replace(/^\/+/, '');
}

function findModule(target: { slug: string } | { number: number }, inv: Inventory): ModuleRecord | undefined {
  return 'slug' in target ? inv.modules.find((m) => m.slug === target.slug) : inv.modules.find((m) => m.module === target.number);
}

/** The route of a target (relative to the base), whether or not it is released; null when it does not exist. */
export function routeOf(target: Target, inv: Inventory): string | null {
  switch (target.kind) {
    case 'module': {
      const m = findModule(target, inv);
      return m ? `modules/${m.slug}/` : null;
    }
    case 'page':
      return inv.pages.some((p) => p.slug === target.slug) ? `${target.slug}/` : null;
    case 'tool':
      return inv.tools.some((t) => t.id === target.id) ? `tools/${target.id}/${target.query ? `?${target.query}` : ''}` : null;
    case 'atlas':
      return inv.atlas ? `atlas/${target.board}/` : null;
    case 'static':
      if (target.name === 'index') return '';
      return `${target.name}/`;
  }
}

/** Whether a target is released (the rules of the plan, P1-A4 5.12). */
export function isReleased(target: Target, inv: Inventory): boolean {
  switch (target.kind) {
    case 'module':
      return findModule(target, inv)?.released === true;
    case 'page':
      return inv.pages.find((p) => p.slug === target.slug)?.released === true;
    case 'tool': {
      const t = inv.tools.find((x) => x.id === target.id);
      return t !== undefined && t.released !== false;
    }
    case 'atlas':
      return inv.atlas;
    case 'static':
      return target.name === 'open-items' ? !inv.release : true;
  }
}

/** The link to a target under the base, or null when the target is absent or not released. */
export function linkFor(target: Target, inv: Inventory, base: string): string | null {
  if (!isReleased(target, inv)) return null;
  const route = routeOf(target, inv);
  return route === null ? null : joinBase(base, route);
}

/** Released modules in increasing `module` (the module index). */
export function releasedModules(inv: Inventory): ModuleRecord[] {
  return inv.modules.filter((m) => m.released).sort((a, b) => a.module - b.module || a.slug.localeCompare(b.slug));
}

/**
 * The next module of module n: the module numbered n + 1 when it exists and is released, else null.
 * Never a later module (a reader would skip one that is not yet published).
 */
export function nextModule(n: number, inv: Inventory): ModuleRecord | null {
  const m = inv.modules.find((x) => x.module === n + 1);
  return m && m.released ? m : null;
}

/**
 * Slugs that collide: a page slug equal to a reserved static route, a module slug used twice, or a
 * page slug used twice. Module routes live under modules/, so they never meet page routes.
 */
export function slugCollisions(pageSlugs: readonly string[], moduleSlugs: readonly string[]): string[] {
  const problems: string[] = [];
  const reserved = new Set<string>(RESERVED_SLUGS);
  const seen = new Set<string>();
  for (const s of pageSlugs) {
    if (reserved.has(s)) problems.push(`page "${s}" takes the route of a static page or route directory`);
    if (seen.has(s)) problems.push(`page "${s}" is defined twice`);
    seen.add(s);
  }
  const seenModules = new Set<string>();
  for (const s of moduleSlugs) {
    if (seenModules.has(s)) problems.push(`module "${s}" is defined twice`);
    seenModules.add(s);
  }
  return problems;
}

// ------------------------------------------------------------------------------------------------
// Build-time wrappers. The site's files are read with import.meta.glob (paths relative to this file,
// so they point at site/src whatever srcDir a fixture build uses); frontmatter is parsed with the
// parser of @astrojs/markdown-remark, a direct dependency of the site.
// ------------------------------------------------------------------------------------------------

const moduleFiles = import.meta.glob<string>('../../content/modules/*.mdx', { query: '?raw', import: 'default', eager: true });
const pageFiles = import.meta.glob<string>('../../content/pages/*.mdx', { query: '?raw', import: 'default', eager: true });
const toolFiles = import.meta.glob<string>('../../tools/registry/T*.ts', { query: '?raw', import: 'default', eager: true });
const atlasFiles = import.meta.glob<string>('../../pages/atlas/*.astro', { query: '?raw', import: 'default', eager: true });

function baseName(path: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file.replace(/\.[^.]+$/, '');
}

function frontmatterOf(raw: string): Record<string, unknown> {
  return parseFrontmatter(raw).frontmatter as Record<string, unknown>;
}

/** Module records from raw MDX files (path to text); exported for the unit test. */
export function modulesFromFiles(files: Record<string, string>): ModuleRecord[] {
  return Object.entries(files).map(([path, raw]) => {
    const fm = frontmatterOf(raw);
    return {
      slug: baseName(path),
      module: typeof fm.module === 'number' ? fm.module : Number.NaN,
      released: fm.released === true,
      ...(typeof fm.title === 'string' ? { title: fm.title } : {}),
      ...(typeof fm.question === 'string' ? { question: fm.question } : {}),
    };
  });
}

/** Page records from raw MDX files; exported for the unit test. */
export function pagesFromFiles(files: Record<string, string>): PageRecord[] {
  return Object.entries(files).map(([path, raw]) => ({ slug: baseName(path), released: frontmatterOf(raw).released === true }));
}

/** Tool records from the raw registry files T{nn}.ts; `released: false` in the entry withholds the tool. */
export function toolsFromFiles(files: Record<string, string>): ToolRecord[] {
  const byNumber = new Map<number, string>(Object.entries(TOOL_NUMBERS).map(([id, n]) => [n, id]));
  const out: ToolRecord[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const m = /^T(\d{2})$/.exec(baseName(path));
    const id = m ? byNumber.get(Number(m[1])) : undefined;
    if (!id) continue;
    out.push({ id, ...(/\breleased\s*:\s*false\b/.test(raw) ? { released: false } : {}) });
  }
  return out;
}

/** The inventory of the site as built now. */
export function siteInventory(): Inventory {
  return {
    modules: modulesFromFiles(moduleFiles),
    pages: pagesFromFiles(pageFiles),
    tools: toolsFromFiles(toolFiles),
    atlas: Object.keys(atlasFiles).some((p) => p.endsWith('/[board].astro')),
    release: isReleaseBuild(),
  };
}

/** The href of a target under the configured base, released or not; null when it does not exist. */
export function hrefFor(target: Target): string | null {
  const route = routeOf(target, siteInventory());
  return route === null ? null : joinBase(import.meta.env.BASE_URL, route);
}

/** The href of a target when it is released, else null. Nav, Footer, ModuleLinks and prose use this. */
export function linkIfReleased(target: Target): string | null {
  return linkFor(target, siteInventory(), import.meta.env.BASE_URL);
}
