// RT-FIX P3-RT-10-06 (adopted from the RT-10 lens, site/tests/unit/redteam-RT-10-outs.test.ts): every
// data-out name rendered by a tool's default state in the built site is in the registry's `outs`
// (CONTRACTS 5.2 "outs: every data-out name the tool renders"; SPEC 4.0 Test hooks). It reads the
// built pages, so it runs with the browser suite after npm run build (the unit suite runs before the
// build in CI); it needs no browser. Names rendered only after interaction or by a property are
// checked in the tools' own files (T01.test.ts, T08.spec.ts).
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REGISTRY = new URL('../../src/tools/registry/', import.meta.url);
const files = readdirSync(REGISTRY)
  .filter((f) => /^T\d+\.ts$/.test(f))
  .sort();
const registry = Object.fromEntries(
  await Promise.all(files.map(async (f) => [`../../src/tools/registry/${f}`, (await import(new URL(f, REGISTRY).href)) as { default: { id: string; outs: string[] } }] as const)),
);

test.describe('RT-10: rendered data-out names are in the registry outs', () => {
  for (const [path, mod] of Object.entries(registry)) {
    const { id, outs } = mod.default;
    // regression: P3-RT-10-06
    test(`${path.split('/').pop()} (${id})`, () => {
      const html = readFileSync(fileURLToPath(new URL(`../../dist/tools/${id}/index.html`, import.meta.url)), 'utf8');
      const rendered = [...new Set([...html.matchAll(/data-out="([^"]+)"/g)].map((m) => m[1]!))];
      expect(rendered.filter((n) => !outs.includes(n))).toEqual([]);
    });
  }
});

// The residual of P3-RT-10-06 for P4-A3: T10 renders Predict.svelte when a prediction is given (M7), and
// its outs lacked predictResult and predictReveal, which the default state never renders, so the check
// above could not see it. Two checks: every tool whose component renders Predict.svelte lists both names
// (read from the sources), and on lesson instances with a prediction (T10 on M7, T11 on M6) every data-out
// name rendered inside the instance, before and after "Show me", is in the outs of its tool.
const PREDICT_OUTS = ['predictResult', 'predictReveal'];
const SITE = new URL('../../', import.meta.url);
const COMPONENTS = new URL('src/components/', SITE);

// P6-A4 (repair after review, pre-approved by MERGE): the specifier of an entry's component is resolved here,
// not matched against one directory. An alias of the paths of site/tsconfig.json (the one declaration the build,
// the type check and the unit tests read) is replaced by its target; any other specifier is relative to the
// registry file. The component may live in any directory under src/components/ (T14's is in atlas/).
const ALIASES: [string, URL][] = Object.entries(
  (JSON.parse(readFileSync(fileURLToPath(new URL('tsconfig.json', SITE)), 'utf8')) as { compilerOptions: { paths: Record<string, string[]> } }).compilerOptions.paths,
)
  .filter(([alias]) => alias.endsWith('/*'))
  .map(([alias, [target]]) => [alias.slice(0, -1), new URL(target!.slice(0, -1), SITE)]);

/** The file a component specifier names, seen from the registry file `from`. */
function componentFile(specifier: string, from: URL): URL {
  for (const [prefix, dir] of ALIASES) if (specifier.startsWith(prefix)) return new URL(specifier.slice(prefix.length), dir);
  return new URL(specifier, from);
}

test.describe('RT-10: a tool that renders a prediction lists its data-out names', () => {
  for (const [path, mod] of Object.entries(registry)) {
    const { id, outs } = mod.default;
    // regression: residual of P3-RT-10-06 (T10_OUTS lacked predictResult and predictReveal)
    test(`${path.split('/').pop()} (${id}): Predict.svelte's names, if it renders Predict`, () => {
      const entryFile = new URL(path.replace('../../src/tools/registry/', ''), REGISTRY);
      const entry = readFileSync(fileURLToPath(entryFile), 'utf8');
      const specifier = /component:\s*\(\)\s*=>\s*import\('([^']+\.svelte)'\)/.exec(entry)?.[1];
      expect(specifier, `${path}: the component it loads`).toBeTruthy();
      const file = componentFile(specifier!, entryFile);
      expect(file.href.startsWith(COMPONENTS.href), `${path}: ${specifier} is a file under src/components/`).toBe(true);
      const source = readFileSync(fileURLToPath(file), 'utf8');
      // A static or a dynamic import of the component (T10 fetches it only where a prediction is given); an
      // import of its type alone renders nothing.
      const renders = /(?:^|\n)\s*import\s+(?!type\b)\w+\s+from\s+'\.\.\/board\/Predict\.svelte'|import\('\.\.\/board\/Predict\.svelte'\)/.test(source);
      if (renders) for (const name of PREDICT_OUTS) expect(outs, `${id} renders Predict.svelte`).toContain(name);
      // The tools known to render it today (T1, T3, T5 to T11, T15), so that the source check is not empty.
      if (['board', 'form', 'numbers', 'mirror', 'symbolic', 'weyl', 'kostant', 'geometry', 'fold', 'affine'].includes(id)) expect(renders, `${id} renders Predict.svelte`).toBe(true);
    });
  }
});

const INSTANCES: { what: string; route: string; id: string; tool: string }[] = [
  { what: 'T10 on M7, beat 4 (rings)', route: 'modules/m7-geometry/', id: 'b4', tool: 'geometry' },
  { what: 'T10 on M7, beat 7 (make uniform)', route: 'modules/m7-geometry/', id: 'b7', tool: 'geometry' },
  { what: 'T11 on M6, beat 7 (fold)', route: 'modules/m6-multiple-edges/', id: 'b7', tool: 'fold' },
];
const outsOf = (tool: string): string[] => Object.values(registry).find((m) => m.default.id === tool)!.default.outs;

test.describe('RT-10: a lesson instance with a prediction renders only names of its tool outs', () => {
  for (const c of INSTANCES) {
    // regression: residual of P3-RT-10-06 (T10_OUTS lacked predictResult and predictReveal)
    test(c.what, async ({ page }) => {
      await page.goto(c.route);
      const root = page.locator(`[data-tool="${c.tool}"][data-instance="${c.id}"]`);
      await root.scrollIntoViewIfNeeded();
      await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
      await expect(root.locator('[data-prediction]')).toHaveCount(1);
      // Each data-out belongs to the nearest tool root around it.
      const names = (): Promise<string[]> =>
        root.evaluate((r) => [...r.querySelectorAll('[data-out]')].filter((e) => e.closest('[data-tool]') === r).map((e) => e.getAttribute('data-out')!));
      const seen = new Set(await names());
      await root.locator('[data-control="predictShow"]').click();
      await expect(root.locator('[data-out="predictReveal"]')).toHaveCount(1);
      for (const n of await names()) seen.add(n);
      for (const name of PREDICT_OUTS) expect([...seen], `${c.what}: rendered`).toContain(name);
      expect([...seen].filter((n) => !outsOf(c.tool).includes(n)), `${c.what}: names not in the outs of ${c.tool}`).toEqual([]);
    });
  }
});
