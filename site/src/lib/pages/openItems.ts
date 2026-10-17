// The pages that use each open item (P1-A4; SPEC.md 7.3, the open-items page). The registry of
// P0-A4 fills only while pages render, and the open-items page may render first, so usages are
// found statically: the raw sources of src/content/**/*.mdx are scanned for <Unverified item="...">
// and each file is mapped to its route. Build time only.

export interface Usage {
  item: string;
  /** Routes relative to the base, for example "modules/m0-start/". */
  pages: string[];
}

/** The route of a content file, from its path (…/content/modules/x.mdx or …/content/pages/x.mdx). */
export function routeOfContentFile(path: string): string | null {
  const m = /content\/(modules|pages)\/([^/]+)\.mdx$/.exec(path);
  if (!m) return null;
  return m[1] === 'modules' ? `modules/${m[2]}/` : `${m[2]}/`;
}

const USE = /<Unverified\b[^>]*?\bitem\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["']([^"']*)["']\s*\})/g;

/** Item id to the sorted routes of the files that use it. */
export function usagesFromFiles(files: Record<string, string>): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const [path, raw] of Object.entries(files)) {
    const route = routeOfContentFile(path);
    if (route === null) continue;
    for (const m of raw.matchAll(USE)) {
      const item = m[1] ?? m[2] ?? m[3] ?? '';
      const set = map.get(item) ?? new Set<string>();
      set.add(route);
      map.set(item, set);
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v].sort()]));
}

const contentFiles = import.meta.glob<string>('../../content/**/*.mdx', { query: '?raw', import: 'default', eager: true });

/** The usages in the site's content as built now. */
export function siteUsages(): Map<string, string[]> {
  return usagesFromFiles(contentFiles);
}
