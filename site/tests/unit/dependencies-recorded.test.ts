// SPEC.md 9.3: "any added dependency, whether shipped to the reader or used only by the build, is recorded
// in DECISIONS.md with its version and licence, and with its size if it is shipped"; CLAUDE.md Rules. Every
// dependency of the three package.json files must have a DECISIONS.md line on which its name is followed,
// within 300 characters, by its pinned version and the licence of the installed package (the form of the
// P0-A3 table rows and of the MERGE entry "dependency records completed"). Adopted from the RT-10 reproducer
// redteam-RT-10-pins-deps.mjs (attack 18).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = (p: string) => JSON.parse(readFileSync(root + p, 'utf8')) as Record<string, unknown>;
const decisions = readFileSync(root + 'DECISIONS.md', 'utf8').split('\n');
const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const pinned = new Map<string, string>();
for (const f of ['package.json', 'packages/engine/package.json', 'site/package.json']) {
  const p = json(f);
  for (const kind of ['dependencies', 'devDependencies']) {
    for (const [name, spec] of Object.entries((p[kind] ?? {}) as Record<string, string>)) pinned.set(name, spec);
  }
}

describe('every dependency is recorded in DECISIONS.md with its version and licence', () => {
  it('the three package.json files declare dependencies', () => {
    expect(pinned.size).toBeGreaterThan(0);
  });
  // regression: P3-RT-10-02
  it.each([...pinned])('%s %s', (name, version) => {
    const licence = (json(`node_modules/${name}/package.json`).license as string | undefined) ?? '';
    expect(licence, `installed licence of ${name}`).not.toBe('');
    const rx = new RegExp(`(^|[^\\w@/-])${esc(name)}(?![\\w/-])[\\s\\S]{0,300}`);
    const recorded = decisions.some((l) => {
      const m = rx.exec(l);
      return m !== null && m[0].includes(version) && m[0].includes(licence);
    });
    expect(recorded, `a DECISIONS.md line naming ${name} with ${version} and ${licence}`).toBe(true);
  });
});
