// Wythoff's construction in M7 (site/src/content/modules/m7-geometry.mdx, read as source) and in the rest of the
// site source: which nodes are ringed fixes the faces of the polytope, not its shape. RT-FIX P6-MERGE-C-01, a MERGE
// follow-up of the phase 6 round: the sibling of P6-RT-09-03 (glossary row 64, content-glossary-wythoff.test.ts).
// As found at d8102c0, M7 beat 2 said "its shape depends only on which nodes are ringed", the Seen statement that
// restates it "a polytope whose shape depends only on the ringed nodes", and a comment of
// site/src/components/tools/t10/scene.ts "the shape depends only on which nodes are ringed". SPEC 2.14: "a polytope
// whose combinatorics depend only on which nodes are ringed"; the edge from lambda to R_i lambda has squared length
// 2 d_i a_i^2, so two rings on the same nodes can give edges in different ratios.
// The face counts come from the engine's wythoffFVector; the squared length of every edge comes from the engine's
// wythoffEdges, solve and formValue (the form is the dot product of the picture, SPEC 2.14 step 3).
// Run: npx vitest run --project site-unit site/tests/unit/content-m7-wythoff.test.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, formValue, solve, wythoffEdges, wythoffFVector } from '@engine';
import type { Board } from '@engine';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const M7 = readFileSync(join(SRC, 'content/modules/m7-geometry.mdx'), 'utf8');
const SHAPE_FIXED = /\bshape\s+depends?\s+only\s+on\s+(?:which\s+nodes\s+are\s+ringed|the\s+ringed\s+nodes)/i;

/** The squared lengths of the edges of the orbit polytope of `rings`, each once, in increasing order. */
function squaredEdgeLengths(board: Board<number>, rings: number[]): number[] {
  const out = new Set<number>();
  const edges = wythoffEdges(board, rings, 1000);
  expect(edges.truncated).toBe(false);
  for (const [u, v] of edges.items) {
    // The population of the edge vector: a = Cp with a = u - v.
    const p = solve(board.cartan, u.map((x, k) => x - v[k]!))!;
    expect(p.every((r) => r.den === 1n)).toBe(true);
    const len = formValue(board, p.map((r) => Number(r.num)))!;
    expect(len.den).toBe(1n);
    out.add(Number(len.num));
  }
  return [...out].sort((x, y) => x - y);
}

/** Every text file under site/src, as [path relative to site/src, contents]. */
function sources(dir: string, rel = ''): [string, string][] {
  return readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((e): [string, string][] => {
    const path = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) return sources(dir, path);
    return /\.(?:mdx?|astro|svelte|ts|js|mjs)$/.test(e.name) ? [[path, readFileSync(join(dir, path), 'utf8')]] : [];
  });
}

describe("M7: Wythoff's construction, the ringed nodes fix the faces", () => {
  // regression: P6-MERGE-C-01
  it('B3 (0,1,1) and (0,2,1) ring the same nodes and have the same faces but not the same shape, and M7 says so', () => {
    // oracle (redteam-RT-09-p6-wythoff.py of P6-RT-09-03): wythoff_f_vector(cartan('B',3), a) = [24, 36, 14, 1] for
    //   both; squared edge lengths {2, 4} for (0,1,1) and {2, 16} for (0,2,1).
    const b3 = boardFromName('B3') as Board<number>; // a named board of finite type is on SafeInt (E-2)
    expect(wythoffFVector(b3, [0, 1, 1]).map(Number)).toEqual([24, 36, 14, 1]);
    expect(wythoffFVector(b3, [0, 2, 1]).map(Number)).toEqual([24, 36, 14, 1]);
    const r1 = squaredEdgeLengths(b3, [0, 1, 1]);
    const r2 = squaredEdgeLengths(b3, [0, 2, 1]);
    expect([r1, r2]).toEqual([[2, 4], [2, 16]]);
    const beat2 = M7.slice(M7.indexOf('<Beat n={2}>'), M7.indexOf('<Beat n={3}>'));
    const seen = M7.slice(M7.indexOf('<Seen'), M7.indexOf('</Seen>'));
    for (const [where, text] of [['beat 2', beat2], ['the Seen box', seen]] as const) {
      const said = text.split(/(?<=[.:])\s+/).find((s) => SHAPE_FIXED.test(s));
      expect(
        said,
        `M7 ${where}: "${(said ?? '').replace(/<[^>]+>/g, '')}". On B3 the orbits of (0,1,1) and (0,2,1) ring the same nodes and have the same face counts (24, 36, 14) but squared edge lengths ${r1.join(' and ')} against ${r2.join(' and ')}: their shapes differ. SPEC 2.14: "a polytope whose combinatorics depend only on which nodes are ringed".`,
      ).toBeUndefined();
    }
    // What M7 says instead, as glossary row 64 does: the faces depend only on the ringed nodes, the edge lengths on
    // the rings too (in fewer words than the glossary, for the word limit of the lesson).
    expect(beat2).toMatch(/its faces depend only on which nodes are ringed, its edge lengths on the rings too\./);
    expect(seen).toMatch(/a polytope whose faces depend only on the ringed nodes/);
  });

  // regression: P6-MERGE-C-01
  it('no source file of the site says the shape of the polytope depends only on the ringed nodes', () => {
    const files = sources(SRC);
    expect(files.length).toBeGreaterThan(100);
    const found = files.filter(([, text]) => SHAPE_FIXED.test(text)).map(([path, text]) => `${path}: "${SHAPE_FIXED.exec(text)![0]}"`);
    // Observed at d8102c0: content/modules/m7-geometry.mdx (beat 2 and the Seen box) and components/tools/t10/scene.ts.
    expect(found, 'SPEC 2.14: the combinatorics depend only on which nodes are ringed, the edge lengths on the rings').toEqual([]);
  });
});
