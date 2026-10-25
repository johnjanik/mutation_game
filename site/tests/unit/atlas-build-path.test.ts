// P6-A4 (repair after review): no golden data in the build path of the Atlas, checked on the modules
// themselves (SPEC.md 4 T14 "generated at build time by calling the engine"; instruction 5.1 and section 6,
// "no golden import or <G> in the build path"; CONTRACTS 3: the golden file is the test oracle only).
// The ruling of MERGE (DECISIONS.md 'MERGE: P6-A4 reviewed; rulings'): a test file without the harness that
// makes reference/golden_data.json throw on import, then loads atlasData, the downloads and the names for all
// 32 boards. A source scan (atlas.test.ts > no golden data in the build path) misses an import made through
// import.meta.glob, a barrel or a module in between; here every import of the golden file, however it is
// written, fails, and so does a read of the file through node:fs (the harness reads it that way).
//
// The 32 names are written out once below; they are the type names of SPEC 2.8, and atlas.test.ts checks
// ATLAS_BOARDS against the golden file's own list. names.ts reads the two files that scripts/names.mjs
// writes at the start of a build (site/src/generated, not committed); where they are absent (the unit suite
// runs before the build in CI) this file runs that script first, in a child process, as the prebuild does.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above the imports, so the message is hoisted with them.
const { GOLDEN_IMPORTED } = vi.hoisted(() => ({ GOLDEN_IMPORTED: 'reference/golden_data.json reached the build path of the Atlas' }));

// Any import of the golden file (a static import, a dynamic one, an eager import.meta.glob) throws.
vi.mock('../../../reference/golden_data.json', () => {
  throw new Error(GOLDEN_IMPORTED);
});

// A read of the golden file through node:fs throws too (the harness of P0-A2 reads it with readFileSync).
function guardFs<T extends object>(actual: T): T {
  const touches = (path: unknown): boolean => String(path instanceof URL ? path.href : path).includes('golden_data.json');
  const wrap = (name: string): unknown => {
    const fn = (actual as Record<string, unknown>)[name];
    if (typeof fn !== 'function') return fn;
    return (path: unknown, ...rest: unknown[]) => {
      if (touches(path)) throw new Error(`${GOLDEN_IMPORTED} (node:fs ${name})`);
      return (fn as (...a: unknown[]) => unknown)(path, ...rest);
    };
  };
  const out: Record<string, unknown> = { ...(actual as Record<string, unknown>) };
  for (const name of ['readFileSync', 'readFile', 'openSync', 'createReadStream']) out[name] = wrap(name);
  return { ...out, default: out } as T;
}
vi.mock('node:fs', async (importOriginal) => guardFs(await importOriginal<typeof import('node:fs')>()));
vi.mock('fs', async (importOriginal) => guardFs(await importOriginal<typeof import('node:fs')>()));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const readFile = (path: Parameters<typeof actual.readFile>[0], ...rest: unknown[]) => {
    if (String(path instanceof URL ? path.href : path).includes('golden_data.json')) return Promise.reject(new Error(`${GOLDEN_IMPORTED} (node:fs/promises readFile)`));
    return (actual.readFile as (...a: unknown[]) => Promise<unknown>)(path, ...rest);
  };
  return { ...actual, readFile, default: { ...actual, readFile } };
});

const BOARDS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8',
  'E6', 'E7', 'E8', 'F4', 'G2',
];

/** A dynamic import whose failure names its own cause (Vitest wraps an error thrown by a mock factory). */
async function load<T>(importer: () => Promise<T>): Promise<T> {
  try {
    return await importer();
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    throw cause instanceof Error ? cause : error;
  }
}

const GENERATED = ['names.json', 'satake-names.json'].map((f) => fileURLToPath(new URL(`../../src/generated/${f}`, import.meta.url)));
const NAMES_SCRIPT = fileURLToPath(new URL('../../../scripts/names.mjs', import.meta.url));

describe('no golden data in the build path (modules)', () => {
  it('the golden file cannot be imported or read in this file', async () => {
    // The guard itself: without it the rest of this file would prove nothing.
    await expect(load(() => import('../../../reference/golden_data.json'))).rejects.toThrow(GOLDEN_IMPORTED);
    const fs = await import('node:fs');
    expect(() => fs.readFileSync(new URL('../../../reference/golden_data.json', import.meta.url))).toThrow(GOLDEN_IMPORTED);
  });

  it('atlasData and the three downloads, for all 32 boards', async () => {
    const { ATLAS_BOARDS, atlasData } = await load(() => import('../../src/components/atlas/atlasData'));
    const { atlasCsv, atlasJson, atlasLatex } = await load(() => import('../../src/components/atlas/downloads'));
    expect([...ATLAS_BOARDS]).toEqual(BOARDS);
    for (const T of BOARDS) {
      const sheet = atlasData(T);
      expect(sheet.name).toBe(T);
      expect(JSON.parse(atlasJson(sheet)).state).toEqual({ schema: 1, tool: 'atlas', board: T });
      expect(atlasCsv(sheet).startsWith('item,label,value\n')).toBe(true);
      expect(atlasLatex(sheet, `https://example.org/atlas/${T}/`).split('\n').length).toBeGreaterThan(2);
    }
  });

  it('the names of every board and of every real form, for all 32 boards', async () => {
    if (!GENERATED.every((f) => existsSync(f))) {
      // What the prebuild does (scripts/names.mjs, which reads the spellings of the catalogue itself).
      const run = spawnSync(process.execPath, [NAMES_SCRIPT], { encoding: 'utf8' });
      expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
    }
    const { atlasData } = await load(() => import('../../src/components/atlas/atlasData'));
    const { cartanLabelName, realFormName, restrictedTypeName, typeName } = await load(() => import('../../src/components/atlas/names'));
    let forms = 0;
    for (const T of BOARDS) {
      expect(typeName(T)).toContain('class="katex"');
      for (const f of atlasData(T).realForms) {
        forms += 1;
        expect(realFormName(f.realForm).html).toContain('class="katex"');
        expect(cartanLabelName(f.cartanLabel)).toContain('class="katex"');
        if (f.restrictedTypeDisplay !== null) expect(restrictedTypeName(f.restrictedTypeDisplay)).toContain('class="katex"');
      }
    }
    expect(forms).toBeGreaterThan(BOARDS.length);
  });
});
