// Typesets the names with a fixed spelling and writes site/src/generated/names.json (SPEC.md 7.3).
// Phase 0 skeleton (P0-A3): the 32 finite type names of reference/golden_data.json, in file order.
// P6-A2 extends texOfName to the rest of the catalogue. The KaTeX call has the four options of
// renderTex in site/src/lib/katex.ts, with the same KaTeX resolved from site/.
// Run from any directory: node scripts/names.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const siteDir = fileURLToPath(new URL('../site/', import.meta.url));
const goldenFile = fileURLToPath(new URL('../reference/golden_data.json', import.meta.url));

/** The installed KaTeX and its version, resolved exactly as the site resolves them. */
function installedKatex() {
  const requireFromSite = createRequire(join(siteDir, 'package.json'));
  const packageJson = join(dirname(dirname(requireFromSite.resolve('katex/dist/katex.min.css'))), 'package.json');
  return { version: JSON.parse(readFileSync(packageJson, 'utf8')).version, katex: requireFromSite('katex') };
}

/**
 * The TeX source of a name. Finite names (one letter, then the rank) give `<letter>_{<rank>}`.
 * Any other spelling throws, so that an unported name fails the build loudly.
 * @param {string} name
 * @returns {string}
 */
export function texOfName(name) {
  const finite = /^([A-G])([1-9][0-9]*)$/.exec(name);
  if (finite) return `${finite[1]}_{${finite[2]}}`;
  throw new Error(`names.mjs: no typeset form for the name "${name}"`);
}

/** The same call as renderTex(tex, false). */
function typeset(katex, tex) {
  return katex.renderToString(tex, { displayMode: false, output: 'htmlAndMathml', throwOnError: true, trust: false });
}

/** The names of the catalogue, in order. Phase 0: the keys of golden.types. */
export function catalogueNames() {
  const golden = JSON.parse(readFileSync(goldenFile, 'utf8'));
  return Object.keys(golden.types);
}

/**
 * Write { katex, names: { <name>: { text, tex, html } } } to outFile.
 * @param {string} outFile
 * @returns {{ count: number; version: string }}
 */
export function writeNames(outFile) {
  const { version, katex } = installedKatex();
  const names = {};
  for (const name of catalogueNames()) {
    const tex = texOfName(name);
    names[name] = { text: name, tex, html: typeset(katex, tex) };
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ katex: version, names }, null, 2) + '\n');
  return { count: Object.keys(names).length, version };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const { count, version } = writeNames(join(siteDir, 'src', 'generated', 'names.json'));
    process.stdout.write(`names: ${count} names typeset with katex ${version}\n`);
  } catch (error) {
    process.stderr.write(`names: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}\n`);
    process.exit(1);
  }
}
