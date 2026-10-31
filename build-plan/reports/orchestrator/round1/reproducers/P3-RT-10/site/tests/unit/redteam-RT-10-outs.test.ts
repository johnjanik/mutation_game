// RT-10 (spec-compliance), phase 3 round 1, attack 9 (lists): every data-out name rendered by a tool's
// default state in the built site is in the registry's `outs` (CONTRACTS 5.2 "outs: every data-out name the
// tool renders"). Needs `npm run build` first. Run: npx vitest run site/tests/unit/redteam-RT-10-outs.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const registry = import.meta.glob('../../src/tools/registry/T*.ts', { eager: true }) as Record<string, { default: { id: string; outs: string[] } }>;

describe('RT-10: rendered data-out names are in the registry outs', () => {
  for (const [path, mod] of Object.entries(registry)) {
    const { id, outs } = mod.default;
    it(`${path.split('/').pop()} (${id})`, () => {
      const html = readFileSync(fileURLToPath(new URL(`../../dist/tools/${id}/index.html`, import.meta.url)), 'utf8');
      const rendered = [...new Set([...html.matchAll(/data-out="([^"]+)"/g)].map((m) => m[1]!))];
      expect(rendered.filter((n) => !outs.includes(n))).toEqual([]);
    });
  }
});
