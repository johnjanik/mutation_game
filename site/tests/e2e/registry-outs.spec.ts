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
