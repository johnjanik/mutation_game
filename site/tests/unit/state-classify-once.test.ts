// RT-03 attack 23 (method C, last paragraph): how many times a tool calls `classify` when its board is
// loaded. SPEC.md 5.6, last sentence: "A tool decides whether a board is of finite type by calling
// `classify` once when the board is loaded". The tool is rendered on the server through Vite with the
// Svelte plugin (as _svelteSsr.ts does), with one extra transform that counts the calls of `classify`
// made by site/src/lib/state.ts (the only module of the site that calls it: resolveBoard and
// boardVerdict go through its verdictOf).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITE = fileURLToPath(new URL('../../', import.meta.url));
let server: ViteDevServer;
let render: (c: unknown, o: { props: unknown }) => { body: string };

type Counter = { __rt03Classify?: number };

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-rt03-classify-cache'),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: 'rt03-count-classify',
        enforce: 'pre',
        transform(code, id) {
          if (!id.replace(/\\/g, '/').endsWith('/site/src/lib/state.ts')) return null;
          const out = code.replace(
            'const records = deepFreeze(classify(board));',
            'const records = deepFreeze((globalThis.__rt03Classify = (globalThis.__rt03Classify ?? 0) + 1, classify(board)));',
          );
          if (out === code) throw new Error('state.ts changed: the counting transform no longer applies');
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

async function classifyCalls(path: string, props: Record<string, unknown>): Promise<number> {
  const mod = (await server.ssrLoadModule(path)) as { default: unknown };
  // Module load computes the presets at build time; only the render of one instance is counted.
  (globalThis as Counter).__rt03Classify = 0;
  // svelte/server renders when `body` is read.
  const body = render(mod.default, { props }).body;
  expect(body.length).toBeGreaterThan(0);
  return (globalThis as Counter).__rt03Classify ?? 0;
}

describe('RT-03 attack 23: classify is called once when the board is loaded', () => {
  for (const [path, props] of [
    ['/src/components/tools/T02OrbitGarden.svelte', { id: '', preset: 'default', board: { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] } }],
    ['/src/components/tools/T04ClassificationLab.svelte', { id: '', preset: 'default', board: { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] } }],
    ['/src/components/tools/T16Sandbox.svelte', { id: '', preset: 'default' }],
    ['/src/components/tools/T01GameBoard.svelte', { id: '', board: { cartan: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]] } }],
  ] as const) {
    // regression: P3-RT-03-05
    it(path.split('/').pop()!, async () => {
      const n = await classifyCalls(path, props);
      expect(n, `classify calls while rendering ${path}`).toBe(1);
    }, 120_000);
  }
});

// The same count on the largest board the editor allows, the 12-cycle (affine A11~), which the RT-07 lens
// loaded by link into T1, T2, T4 and T16 (attack 24): its verdict was computed 2, 3, 4 and 5 times per
// load (one classify per resolveBoard of the spec, each a new board object). SPEC.md 5.6, last sentence.
describe('classify is called once when a 12-node board is loaded', () => {
  const ring12 = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => (i === j ? 2 : j === (i + 1) % 12 || i === (j + 1) % 12 ? -1 : 0)));
  for (const [path, props] of [
    ['/src/components/tools/T01GameBoard.svelte', { id: '', board: { cartan: ring12 } }],
    ['/src/components/tools/T02OrbitGarden.svelte', { id: '', preset: 'default', board: { cartan: ring12 } }],
    ['/src/components/tools/T04ClassificationLab.svelte', { id: '', preset: 'default', board: { cartan: ring12 } }],
    ['/src/components/tools/T16Sandbox.svelte', { id: '', preset: 'default', board: { cartan: ring12 } }],
  ] as const) {
    // regression: P3-RT-07-02
    it(`${path.split('/').pop()!} on the 12-cycle`, async () => {
      const n = await classifyCalls(path, props);
      expect(n, `classify calls while rendering ${path} on the 12-cycle`).toBe(1);
    }, 120_000);
  }
});
