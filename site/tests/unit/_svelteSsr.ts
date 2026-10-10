// Test helper (P1-A2): loads a .svelte file for server rendering through Vite with the Svelte plugin,
// because the site-unit Vitest project compiles no .svelte files. Used by toolframe.test.ts and
// history.test.ts. Not a test file itself (no .test. in its name).
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITE = fileURLToPath(new URL('../../', import.meta.url));

export interface SsrLoader {
  load<T = Record<string, unknown>>(path: string): Promise<T>;
  /** svelte/server's render from the same Svelte instance as the loaded components. */
  render(component: unknown, props: Record<string, unknown>): string;
  close(): Promise<void>;
}

export async function ssrLoader(): Promise<SsrLoader> {
  const server: ViteDevServer = await createServer({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-ssr-test-cache'),
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [svelte({ configFile: false })],
    resolve: { tsconfigPaths: true },
  });
  const server_ = (await server.ssrLoadModule('svelte/server')) as { render: (c: unknown, o: { props: unknown }) => { body: string } };
  return {
    render: (component, props) => server_.render(component, { props }).body,
    load: async <T>(path: string) => (await server.ssrLoadModule(path)) as T,
    close: () => server.close(),
  };
}
