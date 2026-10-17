// P1-A2: ToolFrame in a real browser (CONTRACTS.md 5.1; SPEC.md 7.4, 4.0, 7.5 A-4). The fixture tool
// of site/tests/fixtures/toolframe is rendered on the server and bundled for the client with Vite and
// the Svelte plugin inside this test, then served from a stub origin, so the check needs no registered
// tool. It is the instruction's `toolframe.test.ts > hydration enables the controls`, moved here
// because the unit project has no DOM (decisions/P1-A2.md).
// Hooks read: data-frame, data-tool, data-moves, data-hydrated, data-controls, data-control,
// data-node, data-table-node, data-live.
import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ssrLoader } from '../unit/_svelteSsr';
import { defaultState } from '../../src/lib/state';

const SITE = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = 'http://localhost:5987'; // a secure context, served by page routes only
const PAGE_PATH = '/tools/fixture/';

interface Bundle {
  files: Map<string, string>;
  entry: string;
}

let bundle: Bundle;
let serverHtml: string;
const props = { initial: defaultState('board', 'A2') };

test.beforeAll(async () => {
  const out = await build({
    configFile: false,
    root: SITE,
    logLevel: 'silent',
    cacheDir: join(tmpdir(), 'two-games-hydration-cache'),
    plugins: [svelte({ configFile: false })],
    resolve: { tsconfigPaths: true },
    build: {
      write: false,
      minify: false,
      modulePreload: false,
      rollupOptions: { input: { entry: join(SITE, 'tests/fixtures/toolframe/hydrate-entry.ts') } },
    },
  });
  const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => ('output' in o ? o.output : []));
  const files = new Map<string, string>();
  let entry = '';
  for (const o of outputs) {
    const text = o.type === 'chunk' ? o.code : typeof o.source === 'string' ? o.source : Buffer.from(o.source).toString('utf8');
    files.set(o.fileName, text);
    if (o.type === 'chunk' && o.isEntry) entry = o.fileName;
  }
  bundle = { files, entry };
  const loader = await ssrLoader();
  try {
    const { default: Fixture } = await loader.load<{ default: unknown }>('/tests/fixtures/toolframe/FixtureTool.svelte');
    serverHtml = loader.render(Fixture, props);
  } finally {
    await loader.close();
  }
});

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PAGE_PATH) {
      const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title></head><body><main><div id="app" data-props='${JSON.stringify(props)}'>${serverHtml}</div></main><script type="module" src="/${bundle.entry}"></script></body></html>`;
      await route.fulfill({ status: 200, contentType: 'text/html', body: page });
      return;
    }
    const file = bundle.files.get(url.pathname.slice(1));
    if (file === undefined) await route.fulfill({ status: 404, body: '' });
    else await route.fulfill({ status: 200, contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: file });
  });
});

test('hydration enables the controls', async ({ page }) => {
  const scriptsSeen: string[] = [];
  page.on('request', (r) => scriptsSeen.push(r.url()));
  await page.goto(`${ORIGIN}${PAGE_PATH}?keep=1#here`);
  const root = page.locator('[data-frame]');
  await expect(root).toHaveAttribute('data-hydrated', 'true');
  await expect(root).toHaveAttribute('data-tool', 'board');
  await expect(root).toHaveAttribute('data-moves', '0');
  // No disabled attribute is left on the controls fieldset, the frame's buttons, the table or the nodes.
  await expect(page.locator('fieldset[data-controls]')).not.toHaveAttribute('disabled');
  await expect(page.locator('details fieldset')).not.toHaveAttribute('disabled');
  for (const control of ['undo', 'redo', 'reset', 'copyLink', 'downloadData', 'step']) {
    await expect(page.locator(`[data-control="${control}"]`)).toBeEnabled();
    await expect(page.locator(`[data-control="${control}"]`)).not.toHaveAttribute('disabled');
  }
  await expect(page.locator('[data-node]')).toHaveCount(2);
  for (const b of await page.locator('[data-node], [data-table-node]').all()) await expect(b).toBeEnabled();
  // Hydration wrote nothing to the address bar, and the export module was not fetched yet.
  expect(page.url()).toBe(`${ORIGIN}${PAGE_PATH}?keep=1#here`);
  expect(scriptsSeen.some((u) => /export/.test(u))).toBe(false);
  // The live region is present and empty before the first move.
  await expect(page.locator('[data-live]')).toHaveText('');
});

test('moves update the address bar after a burst, and the live region announces', async ({ page }) => {
  await page.goto(`${ORIGIN}${PAGE_PATH}?keep=1#here`);
  await expect(page.locator('[data-frame]')).toHaveAttribute('data-hydrated', 'true');
  const historyLength = await page.evaluate(() => history.length);
  await page.locator('[data-node="1"]').click();
  await page.locator('[data-node="2"]').click();
  await page.locator('[data-control="step"]').click();
  await expect(page.locator('[data-frame]')).toHaveAttribute('data-moves', '3');
  // One replaceState half a second after the burst: bare keys on a tool route, other keys kept.
  await expect.poll(() => page.url()).toBe(`${ORIGIN}${PAGE_PATH}?keep=1&z=1&g=A2&c=p&s=1,0&w=1.2.1#here`);
  expect(await page.evaluate(() => history.length)).toBe(historyLength); // replaceState, never pushState
  await expect(page.locator('[data-live]')).toHaveText('Stepped.');
});

test('copy link and download data', async ({ page }) => {
  await page.goto(`${ORIGIN}${PAGE_PATH}`);
  await expect(page.locator('[data-frame]')).toHaveAttribute('data-hydrated', 'true');
  await page.locator('[data-node="2"]').click();
  // Copy link encodes the current state at once, before the bar is updated.
  await page.locator('[data-control="copyLink"]').click();
  await expect(page.locator('[data-live]')).toHaveText('Link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${ORIGIN}${PAGE_PATH}?z=1&g=A2&c=p&s=1,0&w=2`);
  // Download data saves board-board.json with the JSON of exportJSON.
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-control="downloadData"]').click()]);
  expect(download.suggestedFilename()).toBe('board-board.json');
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  expect(doc.state).toEqual({ ...props.initial, moves: [2] });
  expect(doc.derived.positions).toEqual([[1, 0], [1, 1]]);
});
