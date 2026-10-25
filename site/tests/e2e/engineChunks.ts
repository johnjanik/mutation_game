// P6-size: which chunks of the built site hold engine code. The engine is no longer one chunk
// (_astro/src.*.js): each route's chunks hold the engine modules its own code uses (lib/worker.ts
// provide, astro.config.mjs moduleSideEffects), so a spec that measures or instruments engine code
// finds its chunks by content. A chunk holds engine code when it contains a string literal of an
// engine module (24 characters or more, without quotes, braces, dollar signs or backslashes) that no
// file of site/src holds; error messages are such literals, and the minifier keeps them.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distDir } from './routes';

const ENGINE_SRC = fileURLToPath(new URL('../../../packages/engine/src/', import.meta.url));
const SITE_SRC = fileURLToPath(new URL('../../src/', import.meta.url));

function filesUnder(dir: string, test: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name), test) : test.test(e.name) ? [join(dir, e.name)] : [],
  );
}

/** The literals of each engine module that mark its code in a chunk (module file name to literals). */
export function engineMarkers(): Map<string, string[]> {
  const site = filesUnder(SITE_SRC, /\.(ts|svelte|js|mjs|astro)$/).map((f) => readFileSync(f, 'utf8')).join('\n');
  const out = new Map<string, string[]>();
  for (const name of readdirSync(ENGINE_SRC).filter((f) => f.endsWith('.ts')).sort()) {
    const code = readFileSync(join(ENGINE_SRC, name), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n');
    const pieces = [
      ...[...code.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]!),
      ...[...code.matchAll(/`([^`\\]*)`/g)].flatMap((m) => m[1]!.split(/\$\{[^}]*\}/)),
    ];
    const marks = [...new Set(pieces.filter((p) => p.length >= 24 && !/["'`${}]/.test(p) && !site.includes(p)))];
    if (marks.length > 0) out.set(name, marks);
  }
  return out;
}

/** The file names (under _astro/) of the page chunks that hold engine code; the worker's script is left out. */
export function engineChunks(dir: string = distDir()): Set<string> {
  const marks = [...engineMarkers().values()].flat();
  const astro = join(dir, '_astro');
  return new Set(
    readdirSync(astro).filter((f) => f.endsWith('.js') && !/^engine\.worker/.test(f) && marks.some((m) => readFileSync(join(astro, f), 'utf8').includes(m))),
  );
}
