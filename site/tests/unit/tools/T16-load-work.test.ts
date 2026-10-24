// regression: P3-RT-07-02 (residual: the engine work of a load that the default view does not show).
// SPEC 7.6 "Main-thread work": "No engine call on the main thread may become a long task (50 ms)". SPEC 4
// T16: "No verdicts beyond those of T4"; T16Verdict.svelte shows T4's verdict bullet and leaves out T4's
// "Also shown" items (balance and weights, the spectral radius, a smallest non-finite sub-board). Loading
// the 12-cycle by link into T16 still ran smallestNonfiniteSubboard, the largest engine call of the load,
// for a sub-board the sandbox never shows. The tool is rendered on the server through Vite with the Svelte
// plugin (the island runs the same script when it hydrates), with one transform that counts the calls of
// spectralRadius and smallestNonfiniteSubboard made by site/src/components/tools/t04/verdict.ts, the only
// module of the site that calls them. T4, which shows both, is the control: there each runs once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const SITE = fileURLToPath(new URL('../../../', import.meta.url));
let server: ViteDevServer;
let render: (c: unknown, o: { props: unknown }) => { body: string };

type Counter = { __t16Spectral?: number; __t16Nonfinite?: number };
const counter = globalThis as Counter;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), `two-games-t16-load-work-${createHash('sha256').update(import.meta.url).digest('hex').slice(0, 8)}`),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: 't16-count-also-shown',
        enforce: 'pre',
        transform(code, id) {
          if (!id.replace(/\\/g, '/').endsWith('/site/src/components/tools/t04/verdict.ts')) return null;
          const out = code
            .replace('engine.spectralRadius(board);', '(globalThis.__t16Spectral = (globalThis.__t16Spectral ?? 0) + 1, engine.spectralRadius(board));')
            .replace(
              'engine.smallestNonfiniteSubboard(board);',
              '(globalThis.__t16Nonfinite = (globalThis.__t16Nonfinite ?? 0) + 1, engine.smallestNonfiniteSubboard(board));',
            );
          if ((out.match(/__t16Spectral = /g) ?? []).length !== 1 || (out.match(/__t16Nonfinite = /g) ?? []).length !== 1) {
            throw new Error('verdict.ts changed: the counting transform no longer applies');
          }
          return out;
        },
      },
      svelte({ configFile: false }),
    ],
    resolve: { tsconfigPaths: true },
  });
  render = ((await server.ssrLoadModule('svelte/server')) as { render: typeof render }).render;
}, 120_000);

afterAll(async () => {
  await server?.close();
});

/** The calls of the two "Also shown" functions while one instance of the tool renders. */
async function alsoShownCalls(path: string, props: Record<string, unknown>): Promise<{ spectral: number; nonfinite: number }> {
  const mod = (await server.ssrLoadModule(path)) as { default: unknown };
  counter.__t16Spectral = 0;
  counter.__t16Nonfinite = 0;
  // svelte/server renders when `body` is read.
  expect(render(mod.default, { props }).body.length).toBeGreaterThan(0);
  return { spectral: counter.__t16Spectral ?? 0, nonfinite: counter.__t16Nonfinite ?? 0 };
}

const ring12 = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => (i === j ? 2 : j === (i + 1) % 12 || i === (j + 1) % 12 ? -1 : 0)));

describe('T16 runs no engine call for what its default view does not show (7.6)', () => {
  it('T16Sandbox on the 12-cycle computes neither the spectral radius nor a smallest non-finite sub-board', async () => {
    expect(await alsoShownCalls('/src/components/tools/T16Sandbox.svelte', { id: '', board: { cartan: ring12 } })).toEqual({ spectral: 0, nonfinite: 0 });
  }, 120_000);

  it('T16Sandbox on its default board computes neither', async () => {
    expect(await alsoShownCalls('/src/components/tools/T16Sandbox.svelte', { id: '' })).toEqual({ spectral: 0, nonfinite: 0 });
  }, 120_000);

  it('control: T04ClassificationLab on the 12-cycle computes each once (it shows both)', async () => {
    expect(await alsoShownCalls('/src/components/tools/T04ClassificationLab.svelte', { id: '', preset: 'default', board: { cartan: ring12 } })).toEqual({
      spectral: 1,
      nonfinite: 1,
    });
  }, 120_000);
});
