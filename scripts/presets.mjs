#!/usr/bin/env node
// Writes the T10 preset data files (SPEC.md 4 T10 "Presets": the default and every configuration
// that section 3 names are computed at build time and shipped as data files, each at most 30 kB after
// compression [D], so that no default needs the worker; 5.1 E-9). The pipeline itself is the
// TypeScript module site/src/components/draw/presetsT10.ts, which calls the engine only; this script
// loads it with Node's own type stripping (no loader package) and writes
//   site/public/presets/T10/<key>.json   one file per configuration of PRESET_CONFIGS
//   site/public/presets/T10/index.json   the manifest
// removing any other .json file in that directory. It writes nothing and exits 1 when a configuration
// is refused (more vertices or edges than T10 draws) or a file would exceed the limit.
//
// Run from any directory:  node scripts/presets.mjs            (write the files)
//                          node scripts/presets.mjs --check    (compare with the files on disk, write nothing)
//
// Loading TypeScript: Node 22.18 and later strip types by default (process.features.typescript is
// 'strip'); on Node 22.12 to 22.17 the script runs itself again once with --experimental-strip-types.
// Node's resolver tries no extensions and knows no path alias, so one resolve hook maps '@engine' to
// packages/engine/src/index.ts and an extensionless relative specifier inside packages/engine/src/ or
// site/src/components/draw/ to the .ts file that exists. It uses module.registerHooks (synchronous,
// Node 22.15 and later) and falls back to module.register with the same rule.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import module from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_URL = new URL('../', import.meta.url);
const ROOT = fileURLToPath(ROOT_URL);
const OUT_DIR = join(ROOT, 'site', 'public', 'presets', 'T10');
const PIPELINE = new URL('site/src/components/draw/presetsT10.ts', ROOT_URL).href;
const ENGINE_INDEX = new URL('packages/engine/src/index.ts', ROOT_URL).href;
/** Directories whose extensionless relative imports are TypeScript sources. */
const TS_DIRS = [new URL('packages/engine/src/', ROOT_URL).href, new URL('site/src/components/draw/', ROOT_URL).href];
const REEXEC = 'TWO_GAMES_PRESETS_STRIP_TYPES';

/**
 * The resolve rule of the hook, free of closures so that its text also serves module.register.
 * Returns the URL of the TypeScript file a specifier names, or null to leave it to Node.
 * @param {string} specifier
 * @param {string | undefined} parentURL
 * @param {string} engineIndex
 * @param {string[]} tsDirs
 * @returns {string | null}
 */
function resolveTypeScript(specifier, parentURL, engineIndex, tsDirs) {
  if (specifier === '@engine') return engineIndex;
  if (parentURL === undefined || !(specifier.startsWith('./') || specifier.startsWith('../'))) return null;
  if (!tsDirs.some((dir) => parentURL.startsWith(dir))) return null;
  if (/\.[cm]?[jt]s$/.test(specifier)) return null;
  for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
    const url = new URL(candidate, parentURL);
    if (existsSync(fileURLToPath(url))) return url.href;
  }
  return null;
}

/** Registers the resolve hook, synchronously when Node offers module.registerHooks. */
function registerResolveHook() {
  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        const url = resolveTypeScript(specifier, context.parentURL, ENGINE_INDEX, TS_DIRS);
        return url === null ? nextResolve(specifier, context) : { url, shortCircuit: true };
      },
    });
    return 'module.registerHooks';
  }
  const source = [
    "import { existsSync } from 'node:fs';",
    "import { fileURLToPath } from 'node:url';",
    resolveTypeScript.toString(),
    'export async function resolve(specifier, context, nextResolve) {',
    `  const url = resolveTypeScript(specifier, context.parentURL, ${JSON.stringify(ENGINE_INDEX)}, ${JSON.stringify(TS_DIRS)});`,
    '  return url === null ? nextResolve(specifier, context) : { url, shortCircuit: true };',
    '}',
  ].join('\n');
  module.register('data:text/javascript,' + encodeURIComponent(source));
  return 'module.register';
}

/** On Node 22.12 to 22.17 type stripping needs a flag: run this script again, once, with it. */
function ensureTypeStripping() {
  if (process.features.typescript) return;
  if (process.env[REEXEC] === '1') {
    console.error('presets: this Node cannot strip TypeScript types, even with --experimental-strip-types');
    process.exit(1);
  }
  const flags = process.execArgv.filter((a) => a !== '--no-experimental-strip-types');
  const result = spawnSync(
    process.execPath,
    [...flags, '--experimental-strip-types', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, [REEXEC]: '1' } },
  );
  process.exit(result.status ?? 1);
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const unknown = args.filter((a) => a !== '--check');
  if (unknown.length > 0) {
    console.error(`presets: unknown option ${unknown[0]}\nusage: node scripts/presets.mjs [--check]`);
    process.exit(2);
  }
  ensureTypeStripping();
  const hook = registerResolveHook();
  const pipeline = await import(PIPELINE);
  const { KB, gzipSize } = await import(pathToFileURL(join(ROOT, 'scripts', 'size.mjs')).href);
  const limit = 30 * KB;

  /** @type {{ file: string; text: string }[]} */
  const outputs = [];
  const computed = [];
  const problems = [];
  for (const config of pipeline.PRESET_CONFIGS) {
    try {
      const data = pipeline.computePreset(config);
      computed.push(data);
      outputs.push({ file: pipeline.presetFile(data.key), text: pipeline.serializePreset(data) });
    } catch (err) {
      problems.push(`${config.board} ${JSON.stringify(config.rings)}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    }
  }
  if (problems.length === 0) {
    outputs.push({ file: pipeline.MANIFEST_FILE, text: pipeline.serializeManifest(pipeline.buildManifest(computed)) });
  }

  const rows = [];
  for (const { file, text } of outputs) {
    const bytes = Buffer.byteLength(text, 'utf8');
    const gzip = gzipSize(Buffer.from(text, 'utf8'));
    if (gzip > limit) problems.push(`${file}: ${gzip} bytes after gzip, above ${limit}`);
    const data = computed.find((d) => pipeline.presetFile(d.key) === file);
    rows.push([file, data ? String(data.counts.vertices) : '', data ? String(data.counts.edges) : '', data ? String(data.counts.moveEdges) : '', String(bytes), String(gzip)]);
  }
  const head = ['file', 'vertices', 'edges', 'moveEdges', 'bytes', 'gzip bytes'];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  for (const r of [head, ...rows]) console.log(r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd());
  console.log(`presets: Node ${process.version}, type stripping '${process.features.typescript}', resolve hook ${hook}; limit ${limit} bytes after gzip (level 9)`);

  if (problems.length > 0) {
    for (const p of problems) console.error(`presets: ${p}`);
    console.error('presets: nothing written');
    process.exit(1);
  }

  const wanted = new Set(outputs.map((o) => o.file));
  const stale = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => f.endsWith('.json') && !wanted.has(f)) : [];
  if (check) {
    const differ = outputs.filter(({ file, text }) => !existsSync(join(OUT_DIR, file)) || readFileSync(join(OUT_DIR, file), 'utf8') !== text).map((o) => o.file);
    if (differ.length > 0 || stale.length > 0) {
      for (const f of differ) console.error(`presets: ${f} differs from the pipeline's output`);
      for (const f of stale) console.error(`presets: ${f} is not produced by the pipeline`);
      console.error('presets: run node scripts/presets.mjs and commit the files');
      process.exit(1);
    }
    console.log(`presets: the ${outputs.length} files in site/public/presets/T10/ are the pipeline's output`);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of stale) rmSync(join(OUT_DIR, f));
  for (const { file, text } of outputs) writeFileSync(join(OUT_DIR, file), text);
  console.log(`presets: wrote ${outputs.length} files to site/public/presets/T10/${stale.length > 0 ? `, removed ${stale.join(', ')}` : ''}`);
}

main().catch((err) => {
  console.error(`presets: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
