// The third-party packages whose code the build bundles into the scripts the reader's browser fetches
// (SPEC.md 7.9: the credits page lists "the licences of bundled libraries"; RT-FIX P4-RT-08-04). A
// library can reach the reader without being named in any package.json of the repository: the Svelte
// runtime imports clsx, and the bundler adds Vite's preload helper. So the list is read from the build's
// own output: at the end of the client build (and of each worker bundle) a Vite plugin records every
// npm package one of whose modules has code in an emitted chunk, and writes the list to
// site/src/generated/shipped-packages.json. Astro generates the pages after the client build, so the
// credits page (lib/pages/dependencies.ts) reads the list of the same build. Build time only (Node);
// never imported by a .svelte file or anything that reaches the browser.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { Plugin } from 'vite';

/** Where the build writes the list, from the site directory: src/generated/ (produced by the build, not committed). */
export const shippedPackagesFile = (siteDir: string): string => join(siteDir, 'src', 'generated', 'shipped-packages.json');

/** A package whose code the build ships: where it is installed, the chunks that carry it, who imports it. */
export interface ShippedPackage {
  name: string;
  /** The installed directory (the module's node_modules path), or null for a module the bundler makes. */
  dir: string | null;
  chunks: string[];
  /** The packages whose modules import it ('the site' for the site's own code). */
  importedBy: string[];
  /** The length of its code in the emitted chunks, before compression (the sum over chunks of rendered modules). */
  bytes: number;
}

/**
 * The npm package a bundled module belongs to, or null for the site's own code (site/, packages/).
 * An id is a path, possibly marked as virtual by a leading NUL and followed by a query; the bundler's own
 * modules are named after their package (`vite/preload-helper.js`, `rolldown/runtime.js`).
 */
export function packageOfModule(id: string): { name: string; dir: string | null } | null {
  const path = id.replace(/^\0+/, '').replace(/[?#].*$/, '').replace(/\\/g, '/');
  const at = path.lastIndexOf('/node_modules/');
  if (at >= 0) {
    const rest = path.slice(at + '/node_modules/'.length).split('/');
    const name = rest[0]!.startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]!;
    return { name, dir: `${path.slice(0, at)}/node_modules/${name}` };
  }
  const bundler = path.match(/^(vite|rolldown|astro)[/:]/);
  return bundler ? { name: bundler[1]!, dir: null } : null;
}

const found = new Map<string, { dir: string | null; chunks: Set<string>; importedBy: Set<string>; bytes: number }>();

interface ChunkLike {
  type: string;
  fileName: string;
  modules?: Record<string, { renderedLength: number }>;
}

/** Records the packages of the chunks of one bundle and writes the whole list so far to `file`. */
function record(file: string, bundle: Record<string, unknown>, importersOf: (id: string) => readonly string[]): void {
  for (const item of Object.values(bundle) as ChunkLike[]) {
    if (item.type !== 'chunk' || !item.modules) continue;
    for (const [id, mod] of Object.entries(item.modules)) {
      if (mod.renderedLength <= 0) continue;
      const pkg = packageOfModule(id);
      if (pkg === null) continue;
      const entry = found.get(pkg.name) ?? { dir: pkg.dir, chunks: new Set<string>(), importedBy: new Set<string>(), bytes: 0 };
      entry.dir ??= pkg.dir;
      entry.chunks.add(item.fileName);
      entry.bytes += mod.renderedLength;
      for (const importer of importersOf(id)) {
        const by = packageOfModule(importer)?.name ?? 'the site';
        if (by !== pkg.name) entry.importedBy.add(by);
      }
      found.set(pkg.name, entry);
    }
  }
  const list: ShippedPackage[] = [...found]
    .map(([name, e]) => ({ name, dir: e.dir, chunks: [...e.chunks].sort(), importedBy: [...e.importedBy].sort(), bytes: e.bytes }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(list, null, 2)}\n`);
}

/** The Vite plugin: the client environment's chunks, or (worker) every chunk of a worker bundle. */
function shippedPackagesPlugin(file: string, worker: boolean): Plugin {
  return {
    name: worker ? 'two-games:shipped-packages-worker' : 'two-games:shipped-packages',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (!worker && this.environment?.name !== 'client') return;
      record(file, bundle as unknown as Record<string, unknown>, (id) => this.getModuleInfo(id)?.importers ?? []);
    },
  };
}

/** The integration that installs the plugin and removes the list of an earlier build when a build starts. */
export function shippedPackagesIntegration(): AstroIntegration {
  let file = '';
  return {
    name: 'shipped-packages',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        file = shippedPackagesFile(fileURLToPath(config.root));
        updateConfig({ vite: { plugins: [shippedPackagesPlugin(file, false)], worker: { plugins: () => [shippedPackagesPlugin(file, true)] } } });
      },
      'astro:build:start': () => {
        found.clear();
        rmSync(file, { force: true });
      },
    },
  };
}

/** The list the last build wrote into `file`, or null when there is none (no build yet, or a unit test). */
export function readShippedPackages(file: string): ShippedPackage[] | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as ShippedPackage[];
}
