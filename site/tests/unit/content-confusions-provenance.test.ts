// Every section of /confusions/ gives the source of its correction (site/src/content/pages/confusions.mdx, read as
// source). Adopted from the RT-08 reproducer of the phase 6 round, attacks 26 and 37: /confusions/ promises that
// every correction comes "with the source of the correction" (its first sentence; M10's hub repeats it: "each with
// the source of its correction"), and SPEC 8.4 asks that every theorem-like statement carry its provenance. Twelve of
// the thirteen sections cited a source or said "verified by computation"; the section "Which lattice each game lives
// in" (data-confusion="lattices") did neither, although it states a theorem-like fact: "The translator a=Cp carries
// the first lattice into the second, onto a sublattice whose index is det C." (The Atlas gives the same fact a
// provenance line, "The index is a fact of linear algebra ...".)
// Run: npx vitest run --project site-unit site/tests/unit/content-confusions-provenance.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(fileURLToPath(new URL('../../src/content/pages/confusions.mdx', import.meta.url)), 'utf8');
const sections = [...src.matchAll(/<section data-confusion="([^"]+)">([\s\S]*?)<\/section>/g)].map((m) => ({ id: m[1]!, body: m[2]! }));
const PROVENANCE = /<Cite k=|verified by computation|a fact of linear algebra/;

describe('/confusions/ promises a source for every correction, but the section on lattices has none', () => {
  // regression: P6-RT-08-08
  it('the page promises a source for each correction', () => {
    expect(src).toMatch(/corrects each one, with the source of the correction/);
    expect(sections.length).toBe(13);
  });
  // regression: P6-RT-08-08
  it('each section carries a citation or a computation', () => {
    const without = sections.filter((s) => !PROVENANCE.test(s.body)).map((s) => s.id);
    // Observed at f07eec6: ["lattices"].
    expect(without, 'sections of confusions.mdx with no source for their correction').toEqual([]);
  });
});
