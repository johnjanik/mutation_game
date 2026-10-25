// P6-size: the main-thread table of engineCall (site/src/lib/worker.ts) and its fallback, and the two
// source rules that keep a route's scripts to the engine modules its own code uses (SPEC.md 7.6: a tool
// route carries "the tool's own code with the engine functions only it uses"; 5.1 E-9). worker.ts used to
// spread the whole engine namespace into its table, and Challenge.svelte imported the whole engine
// dynamically; either one put every engine module into one chunk that every route fetched, and
// /tools/rep/ went over its 90 kB when phase 6 added satake.ts and satakeCatalogue.ts. The built
// result is checked by site/tests/e2e/engine-weight.spec.ts and engine-fallback.spec.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { NotABoard, boardFromName, toLabels } from '@two-games/engine';
import { __testing, engineCall, provide } from '../../src/lib/worker';
import astroConfig, { moduleSideEffects } from '../../astro.config.mjs';

const SITE = resolve(import.meta.dirname, '../..');
const SRC = join(SITE, 'src');
const A3 = boardFromName('A3');

/** Every source file under site/src that the client build can bundle, with its text. */
function sources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|svelte|js|mjs)$/.test(name)) out.push({ file: relative(SITE, p).split(sep).join('/'), text: readFileSync(p, 'utf8') });
    }
  };
  walk(SRC);
  return out;
}

/** The text without its comment lines (//, /*, * and <!-- lines), so that a sentence about engineCall is not a call. */
function code(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*|<!--)/.test(line))
    .join('\n');
}

afterEach(() => {
  __testing.reset();
});

describe('the main-thread table of engineCall', () => {
  it('holds positionsOf and firstForbiddenMove without a provide, and what callers provide', () => {
    expect(__testing.provided()).toEqual(expect.arrayContaining(['positionsOf', 'firstForbiddenMove']));
    expect(__testing.provided()).not.toContain('chevalleySerre');
    provide({ chevalleySerre: (() => ({ ok: true })) as never });
    expect(__testing.provided()).toContain('chevalleySerre');
  });

  it('runs a provided function on the main thread without loading the whole engine', async () => {
    let loads = 0;
    __testing.setRuntime({ inNode: () => false, loadEngine: async () => (loads++, {}) });
    const calls: unknown[][] = [];
    provide({ toLabels: ((board: never, ps: never) => (calls.push([board, ps]), toLabels(board, ps))) as never });
    expect(await engineCall('toLabels', [A3, [0, 2]], { board: A3, kind: 'other' })).toEqual([1, 3]);
    expect(calls).toEqual([[A3, [0, 2]]]);
    expect(loads).toBe(0);
    expect(__testing.fallbacks()).toEqual([]);
    expect(__testing.workerCreated()).toBe(false);
  });

  it('a name nobody provided runs from the whole engine and is reported when E-9 keeps it on the main thread', async () => {
    let loads = 0;
    __testing.setRuntime({ inNode: () => false, loadEngine: async () => (loads++, await import('@two-games/engine')) });
    // weylOrder: no module of this test provides it; 'count' with 24 elements runs on the main thread.
    expect(await engineCall('weylOrder', [A3], { board: A3, kind: 'count', expectedItems: 24 })).toBe(24);
    expect(loads).toBe(1);
    expect(__testing.fallbacks()).toEqual(['weylOrder']);
    expect(__testing.workerCreated()).toBe(false);
    // Errors keep their class on this path too.
    await expect(engineCall('boardFromName', ['Q7'], { board: A3, kind: 'other' })).rejects.toBeInstanceOf(NotABoard);
    expect(__testing.fallbacks()).toEqual(['weylOrder', 'boardFromName']);
  });

  it('in Node a call that E-9 sends to the worker runs from the whole engine and is not reported', async () => {
    let loads = 0;
    __testing.setRuntime({ loadEngine: async () => (loads++, await import('@two-games/engine')) });
    // An enumeration without expectedItems goes to the worker in a browser; in Node it runs in-process.
    expect(await engineCall('weylOrder', [A3], { board: A3, kind: 'enumeration' })).toBe(24);
    expect(loads).toBe(1);
    expect(__testing.fallbacks()).toEqual([]);
    expect(__testing.workerCreated()).toBe(false);
  });

  it('a name the engine lacks rejects with a TypeError, as before', async () => {
    __testing.setRuntime({ inNode: () => false });
    await expect(engineCall('noSuchFunction' as never, [] as never, { board: A3, kind: 'other' })).rejects.toBeInstanceOf(TypeError);
  });
});

describe('the sources keep the engine out of shared chunks', () => {
  // The names worker.ts holds itself, and playFate, which E-9 runs only in the worker (worker.ts ALWAYS_IN_WORKER).
  const NEED_NO_PROVIDE = new Set(['positionsOf', 'firstForbiddenMove', 'playFate']);

  it('every module that calls engineCall provides the engine functions it calls by name', () => {
    const problems: string[] = [];
    let callers = 0;
    for (const { file, text } of sources()) {
      if (file === 'src/lib/worker.ts') continue;
      const body = code(text);
      if (!/\bengineCall\(/.test(body)) continue;
      callers++;
      const providedHere = new Set<string>();
      for (const m of body.matchAll(/\bprovide\(\{([^}]*)\}\)/g)) {
        for (const entry of m[1]!.split(',')) {
          const key = entry.split(':')[0]!.trim();
          if (key) providedHere.add(key);
        }
      }
      const named = [...body.matchAll(/\bengineCall\(\s*'(\w+)'/g)].map((m) => m[1]!);
      for (const name of named) if (!NEED_NO_PROVIDE.has(name) && !providedHere.has(name)) problems.push(`${file}: engineCall('${name}') without provide({ ${name} })`);
      // A call by a computed name (T1's play to the end) needs a provide of its own all the same.
      if (/\bengineCall\(\s*[^'\s]/.test(body) && providedHere.size === 0) problems.push(`${file}: engineCall by a computed name without a provide`);
    }
    expect(callers).toBeGreaterThanOrEqual(7);
    expect(problems).toEqual([]);
  });

  it('no client module imports the whole engine at run time, except the worker and the fallback', () => {
    const ENGINE = String.raw`['"](?:@two-games/engine|@engine)['"]`;
    const whole = new RegExp(String.raw`import\s+\*\s+as\s+\w+\s+from\s+${ENGINE}|import\(\s*${ENGINE}\s*\)|export\s+\*\s+from\s+${ENGINE}`);
    const allowed = new Set(['src/lib/engine.worker.ts', 'src/lib/engineAll.ts']);
    const found = sources().filter(({ file, text }) => !allowed.has(file) && whole.test(code(text))).map(({ file }) => file);
    expect(found).toEqual([]);
    // The fallback chunk is reached only from worker.ts.
    const importers = sources().filter(({ file, text }) => file !== 'src/lib/worker.ts' && /['"][./@\w]*engineAll['"]/.test(code(text))).map(({ file }) => file);
    expect(importers).toEqual([]);
  });

  it('the build treats the engine modules as free of side effects, and nothing else', () => {
    expect(moduleSideEffects('/home/u/repo/packages/engine/src/satake.ts')).toBe(false);
    expect(moduleSideEffects('C:\\repo\\packages\\engine\\src\\rep.ts')).toBe(false);
    expect(moduleSideEffects('/home/u/repo/site/src/lib/state.ts')).toBe(true);
    expect(moduleSideEffects('/home/u/repo/node_modules/svelte/src/index-client.js')).toBe(true);
    expect(moduleSideEffects('/home/u/repo/site/src/components/board/Board.svelte?svelte&type=style&lang.css')).toBe(true);
    const treeshake = (astroConfig as { vite?: { build?: { rolldownOptions?: { treeshake?: { moduleSideEffects?: unknown } } } } }).vite?.build?.rolldownOptions?.treeshake;
    expect(treeshake?.moduleSideEffects).toBe(moduleSideEffects);
  });
});
