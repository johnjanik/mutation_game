// The golden key `wythoff` (SPEC.md 2.14 "Orbit polytopes", 5.4 Geometry, 5.6 "Edges drawn (T10): 70000 at
// rest", E-4, E-6, E-7, 5.7 phase 4 and rules 1, 4, 5, 6, 7, Appendix G; P4-A1 instruction 5.11, 5.12, 5.14;
// verify.py lines 1005 to 1033 and 1114 to 1118). Records are matched by `type` and `rings` (rule 5);
// `rings` is in label order and is converted to positions through the labels (E-7); `name` is
// documentation (rule 6); `edge_length_squared` is present on some records only (rule 7) and compares as
// rational text (rule 4). Face counts are bigint (E-4); FaceType.nodes are positions (E-7).
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { fire, toPopulation } from '../../src/moves';
import { CAPS } from '../../src/caps';
import { symmetrizer } from '../../src/classify';
import { toPositions } from '../../src/board';
import type { Rational } from '../../src/rational';
import { rat, ratAdd, ratMul, ratSign, ratSub } from '../../src/rational';
import { orbit } from '../../src/search';
import { orbitSize } from '../../src/weyl';
import { wythoffEdges, wythoffFaceTypes, wythoffFVector } from '../../src/wythoff';
import { boardOf, covers, golden, intEq, matchRecord, ratText } from './_harness';

covers('wythoff');

interface WythoffRecord {
  type: string;
  rings: number[];
  name: string;
  f_vector: number[];
  edges_enumerated: boolean;
  edge_length_squared?: string;
}

const RECORDS = golden.wythoff as WythoffRecord[];

/** rings in label order to positions: rings[k] belongs to the position whose label is the k-th label (E-7). */
function ringsInPositions(board: Board<number>, rings: readonly number[]): number[] {
  const sortedLabels = [...board.labels].sort((a, b) => a - b);
  const out: number[] = board.labels.map(() => 0);
  rings.forEach((x, k) => {
    out[toPositions(board, [sortedLabels[k]!])[0]!] = x;
  });
  return out;
}

function lexCompare(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k]! - b[k]!;
  return 0;
}

function pairKey(u: readonly number[], v: readonly number[]): string {
  return lexCompare(u, v) <= 0 ? `${u.join(',')}|${v.join(',')}` : `${v.join(',')}|${u.join(',')}`;
}

/** The vertices of the orbit polytope: the orbit of the start under free play of the numbers game. */
function vertices(board: Board<number>, r: number[]): number[][] {
  const o = orbit(board, [r], 'firing', CAPS.verticesDrawn);
  expect(o.truncated).toBe(false);
  return o.items;
}

/**
 * The squared length of every difference of two vertices, by the plan shortcut of P4-A1 instruction 5.14:
 * with p = C^(-1) e (toPopulation) and d the symmetrizer, (p, p) = sum_i d_i p_i e_i, since B = DC and
 * C p = e. The populations of the vertices are computed once; p is linear in e.
 */
function minimumSquaredDistance(board: Board<number>, verts: number[][]): { min: Rational; pairs: Set<string> } {
  const d = symmetrizer(board)!;
  const pops = verts.map((v) => toPopulation(board, v)!);
  let min: Rational | null = null;
  let pairs = new Set<string>();
  for (let a = 0; a < verts.length; a++) {
    for (let b = a + 1; b < verts.length; b++) {
      let s = rat(0);
      for (let i = 0; i < board.n; i++) {
        const e = verts[a]![i]! - verts[b]![i]!;
        if (e === 0) continue;
        s = ratAdd(s, ratMul(ratMul(d[i]!, ratSub(pops[a]![i]!, pops[b]![i]!)), rat(e)));
      }
      const c = min === null ? -1 : ratSign(ratSub(s, min));
      if (c < 0) {
        min = s;
        pairs = new Set([pairKey(verts[a]!, verts[b]!)]);
      } else if (c === 0) {
        pairs.add(pairKey(verts[a]!, verts[b]!));
      }
    }
  }
  return { min: min!, pairs };
}

describe('wythoff records', () => {
  it('there are 26 records, each identified by type and rings; exactly one is not enumerated', () => {
    expect(RECORDS.length).toBe(26);
    for (const rec of RECORDS) expect(matchRecord(RECORDS, { type: rec.type, rings: rec.rings })).toBe(rec);
    expect(RECORDS.filter((r) => !r.edges_enumerated).length).toBe(1);
  });

  for (const row of RECORDS) {
    const rec = matchRecord(RECORDS, { type: row.type, rings: row.rings });
    const id = `${rec.type} ${JSON.stringify(rec.rings)}`;

    it(`f_vector ${id}`, () => {
      const board = boardOf(rec.type);
      const n = board.n;
      const r = ringsInPositions(board, rec.rings);
      const f = wythoffFVector(board, r);
      expect(f.length).toBe(n + 1);
      for (const x of f) expect(typeof x).toBe('bigint');
      intEq(f.slice(0, n), rec.f_vector);
      expect(f[n]).toBe(1n);
      // the same from the face types, summed by dimension
      const byDim: bigint[] = f.map(() => 0n);
      for (const ft of wythoffFaceTypes(board, r)) {
        expect(ft.dimension).toBe(ft.nodes.length);
        expect(typeof ft.count).toBe('bigint');
        for (const p of ft.nodes) expect(p >= 0 && p < n).toBe(true);
        byDim[ft.dimension] = byDim[ft.dimension]! + ft.count;
      }
      intEq(byDim.slice(0, n), rec.f_vector);
      // the vertex count is the orbit size (verify.py line 1012)
      expect(f[0]).toBe(BigInt(orbitSize(board, r)));
    });

    if (rec.edges_enumerated) {
      it(`edges ${id}`, () => {
        const board = boardOf(rec.type);
        const r = ringsInPositions(board, rec.rings);
        const t0 = performance.now();
        const E = wythoffEdges(board, r, CAPS.edgesAtRest);
        const ms = performance.now() - t0;
        if (rec.f_vector[1]! > 60000) process.stdout.write(`wythoffEdges ${id}: ${E.items.length} edges in ${ms.toFixed(0)} ms\n`);
        expect(E.truncated).toBe(false);
        intEq(E.items.length, rec.f_vector[1]);
        const verts = vertices(board, r);
        intEq(verts.length, rec.f_vector[0]);
        const vertexKeys = new Set(verts.map((v) => v.join(',')));
        const seen = new Set<string>();
        // counted in the loop and asserted once (one expect per edge would dominate the 69120-edge case)
        let notCanonical = 0;
        let notVertices = 0;
        for (const [u, v] of E.items) {
          if (!(lexCompare(u, v) < 0)) notCanonical += 1;
          const ku = u.join(',');
          const kv = v.join(',');
          if (!vertexKeys.has(ku) || !vertexKeys.has(kv)) notVertices += 1;
          seen.add(`${ku}|${kv}`);
        }
        expect(notCanonical).toBe(0);
        expect(notVertices).toBe(0);
        expect(seen.size).toBe(E.items.length);
        // 30 s instead of Vitest's 5 s (MERGE, P4 wave 4.1, on the review of P4-A1; instruction 5.14
        // allows it): the E8 2_41 case took 3 s for the enumeration alone on a loaded machine.
      }, 30_000);
    } else {
      it(`edges stop at the cap on ${rec.type} 1_42 ${JSON.stringify(rec.rings)}`, () => {
        // E-6, E-10 and 5.6: the cap is reported in `truncated`, never thrown; exactly cap items
        const board = boardOf(rec.type);
        const r = ringsInPositions(board, rec.rings);
        expect(rec.f_vector[1]!).toBeGreaterThan(CAPS.edgesAtRest);
        const E = wythoffEdges(board, r, CAPS.edgesAtRest);
        expect(E.truncated).toBe(true);
        expect(E.items.length).toBe(CAPS.edgesAtRest);
        process.stdout.write(`wythoffEdges ${id}: truncated with ${E.items.length} items\n`);
      }, 30_000);
    }

    if (rec.edge_length_squared !== undefined) {
      it(`edge_length_squared ${id}`, () => {
        // verify.py lines 1019 to 1030: the minimum squared distance between two vertices, attained
        // exactly by the edges (simply laced, equal rings, at most 300 vertices)
        const board = boardOf(rec.type);
        const r = ringsInPositions(board, rec.rings);
        const verts = vertices(board, r);
        expect(verts.length).toBeLessThanOrEqual(300);
        const { min, pairs } = minimumSquaredDistance(board, verts);
        expect(ratText(min)).toBe(rec.edge_length_squared);
        const edges = new Set(wythoffEdges(board, r, CAPS.edgesAtRest).items.map(([u, v]) => pairKey(u, v)));
        expect(pairs.size).toBe(edges.size);
        for (const k of pairs) expect(edges.has(k)).toBe(true);
      });
    }
  }
});

describe('face types and edges by hand', () => {
  it('face types of B3 (1,0,1) in positions', () => {
    // P4-A1 instruction 5.11, computed with the oracle (which prints [1], [3], [1, 3] for the same faces)
    expect(wythoffFaceTypes(boardOf('B3'), [1, 0, 1])).toEqual([
      { nodes: [], dimension: 0, count: 24n },
      { nodes: [0], dimension: 1, count: 24n },
      { nodes: [0, 1], dimension: 2, count: 8n },
      { nodes: [2], dimension: 1, count: 24n },
      { nodes: [0, 2], dimension: 2, count: 12n },
      { nodes: [1, 2], dimension: 2, count: 6n },
      { nodes: [0, 1, 2], dimension: 3, count: 1n },
    ]);
    expect(wythoffFVector(boardOf('B3'), [1, 0, 1])).toEqual([24n, 48n, 26n, 1n]);
  });

  it('face types of A3 (1,0,1) and A2 (1,1)', () => {
    expect(wythoffFaceTypes(boardOf('A3'), [1, 0, 1]).map((f) => [f.nodes, f.count])).toEqual([
      [[], 12n], [[0], 12n], [[0, 1], 4n], [[2], 12n], [[0, 2], 6n], [[1, 2], 4n], [[0, 1, 2], 1n],
    ]);
    expect(wythoffFVector(boardOf('A3'), [1, 0, 1])).toEqual([12n, 24n, 14n, 1n]);
    expect(wythoffFaceTypes(boardOf('A2'), [1, 1]).map((f) => [f.nodes, f.count])).toEqual([
      [[], 6n], [[0], 3n], [[1], 3n], [[0, 1], 1n],
    ]);
  });

  it('no ring: one vertex and no edge', () => {
    expect(wythoffFVector(boardOf('A3'), [0, 0, 0])).toEqual([1n, 0n, 0n, 0n]);
    expect(wythoffEdges(boardOf('A3'), [0, 0, 0], CAPS.edgesAtRest)).toEqual({ items: [], truncated: false });
  });

  it('the move graph and the polytope graph on A2 from (1, 1)', () => {
    // SPEC.md 2.14 [V]: "On the hexagon of A2 from (1,1) each graph has six edges, four are shared and two
    // differ" (verify.py lines 1114 to 1118)
    const board = boardOf('A2');
    const verts = vertices(board, [1, 1]);
    const moves = new Set<string>();
    for (const v of verts) for (let i = 0; i < board.n; i++) moves.add(pairKey(v, fire(board, v, i)));
    const poly = new Set(wythoffEdges(board, [1, 1], CAPS.edgesAtRest).items.map(([u, v]) => pairKey(u, v)));
    expect(moves.size).toBe(6);
    expect(poly.size).toBe(6);
    expect([...moves].filter((k) => poly.has(k)).length).toBe(4);
  });

  it('a small cap: exactly cap items, truncated', () => {
    const E = wythoffEdges(boardOf('A3'), [1, 0, 1], 5);
    expect(E.truncated).toBe(true);
    expect(E.items.length).toBe(5);
    const all = wythoffEdges(boardOf('A3'), [1, 0, 1], 24);
    expect(all.truncated).toBe(false);
    expect(all.items.length).toBe(24);
    expect(E.items).toEqual(all.items.slice(0, 5));
  });
});
