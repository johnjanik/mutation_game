// The glossary's entry "Wythoff's construction" (row 64): which nodes are ringed fixes the faces of the polytope,
// not its shape. Adopted from site/tests/unit/redteam-RT-09-p6-glossary-history.test.ts, describe P6-RT-09-03
// (lens RT-09, phase 6 round, branch worktree-agent-a59a82db3a362f1d9). As found at f07eec6 the entry said "Its
// shape depends only on which nodes are ringed"; SPEC 2.14 says "a polytope whose combinatorics depend only on
// which nodes are ringed", and gives the edge from lambda to R_i lambda the squared length 2 d_i a_i^2.
// The squared lengths are computed from the engine's symmetrizer, beside the oracle's values typed in; the face
// counts come from the engine's wythoffFVector.
// Run: npx vitest run --project site-unit site/tests/unit/content-glossary-wythoff.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, ratToString, symmetrizer, wythoffFVector } from '@engine';

const GLOSSARY = readFileSync(fileURLToPath(new URL('../../src/content/pages/glossary.mdx', import.meta.url)), 'utf8');

/** The definition of the glossary entry whose dfn has this id, as written in the source. */
function definition(id: string): string {
  const at = GLOSSARY.indexOf(`<dfn id="${id}">`);
  expect(at, `glossary entry ${id}`).toBeGreaterThan(0);
  const m = /<dd data-col="definition">([^]*?)<\/dd>/.exec(GLOSSARY.slice(at));
  return m![1]!.trim();
}

describe("glossary row 64: Wythoff's construction", () => {
  // regression: P6-RT-09-03
  it('B3 (0,1,1) and (0,2,1): the same rings and face counts, edge lengths in the ratio 2 against 8', () => {
    const def = definition('wythoffs-construction');
    // oracle (redteam/RT-09/redteam-RT-09-p6-wythoff.py): wythoff_f_vector(cartan('B',3), a) = [24, 36, 14, 1] for both;
    //   squared edge lengths {2, 4} for (0,1,1) and {2, 16} for (0,2,1) (2 d_i a_i^2 with symmetrizer [2, 2, 1], SPEC 2.14).
    const b3 = boardFromName('B3');
    const d = symmetrizer(b3)!.map((r) => Number(ratToString(r)));
    expect(d).toEqual([2, 2, 1]);
    const squared = (a: number[]): number[] => [...new Set(a.flatMap((x, i) => (x > 0 ? [2 * d[i]! * x ** 2] : [])))].sort((x, y) => x - y);
    const r1 = squared([0, 1, 1]);
    const r2 = squared([0, 2, 1]);
    expect([r1, r2]).toEqual([[2, 4], [2, 16]]);
    expect(wythoffFVector(b3, [0, 1, 1]).map(Number)).toEqual([24, 36, 14, 1]);
    expect(wythoffFVector(b3, [0, 2, 1]).map(Number)).toEqual([24, 36, 14, 1]);
    expect(
      /shape depends only on which nodes are ringed/.test(def),
      `glossary "Wythoff's construction": "${def.replace(/<[^>]+>/g, '')}". On B3 the orbits of (0,1,1) and (0,2,1) ring the same nodes and have the same face counts (24, 36, 14) but squared edge lengths ${r1.join(' and ')} against ${r2.join(' and ')}: their shapes differ. SPEC 2.14: "a polytope whose combinatorics depend only on which nodes are ringed".`,
    ).toBe(false);
    // What the entry says instead: the faces depend only on the ringed nodes (the cited claim), and the edge lengths
    // on the rings themselves.
    expect(def).toMatch(/<span data-claim>Its faces, and the way they meet, depend only on which nodes are ringed \(<Cite k="Cox35"\/>, <Cite k="CKPS95"\/>\)\.<\/span>/);
    expect(def).toMatch(/The lengths of its edges depend on the rings too, so two orbits with the same ringed nodes can differ in shape\./);
  });
});
