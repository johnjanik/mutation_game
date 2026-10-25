// canonicalPair and matchCatalogue (SPEC.md 5.4 "Satake functions (phase 6)", 5.5 "The class of a Satake pair",
// 2.15 "Which pairs are real forms", 4 T13; 5.7 rules 2, 5, 6; Appendix G; P6-A2 instruction 5.5, 5.6, 5.8, 6):
// the examples of the instruction (checked against the oracle's canonical_pair), invariance under the symmetries
// of the board, the D4 coincidence of so(2,6) and so*(8), and the names in `real_forms` of the twelve
// `satake_examples` (matched by type, black_nodes and tau, rule 5; the oracle sorts the names).
// No covers() (plan, P6-A2 instruction section 4): `satake_examples` is registered by P6-A1's
// p6a-satake-examples.test.ts, which compares its verdicts; this file reads its `real_forms` without registering
// the key again, a departure from CONTRACTS.md 3 ("a golden key is tested in exactly one file") reported under
// `deviations` for MERGE to decide.
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { toPositions } from '../../src/board';
import { symmetries } from '../../src/fold';
import type { SatakeDiagram } from '../../src/satake';
import { admissibility } from '../../src/satake';
import { canonicalPair, matchCatalogue, satakeCatalogue, satakeRecord } from '../../src/satakeCatalogue';
import { TYPE_NAMES, boardOf, golden, matchRecord } from './_harness';

interface ExampleRecord {
  type: string;
  black_nodes: number[];
  tau: number[];
  admissible: boolean;
  real_forms: string[];
}

const EXAMPLES = golden.satake_examples as ExampleRecord[];

/** The image of the pair (X, tau) under the symmetry g: (g(X), g tau g^-1), with t[g[i]] = g[tau[i]]. */
function image(g: readonly number[], X: readonly number[], tau: readonly number[]): { black: number[]; tau: number[] } {
  const t: number[] = tau.map(() => 0);
  tau.forEach((x, i) => {
    t[g[i]!] = g[x]!;
  });
  return { black: X.map((i) => g[i]!), tau: t };
}

/** Lexicographic order on integer lists, element by element (test-side). */
function listOrder(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < Math.min(a.length, b.length); k++) if (a[k] !== b[k]) return a[k]! - b[k]!;
  return a.length - b.length;
}

/** The order of SPEC.md 5.5: the sorted black set first, then the images under tau. */
function pairOrder(p: { black: number[]; tau: number[] }, q: { black: number[]; tau: number[] }): number {
  return listOrder(p.black, q.black) || listOrder(p.tau, q.tau);
}

/** Every pair (X, tau) of the board with tau any symmetry (not only involutions), X any subset. */
function allPairs(board: Board): { black: number[]; tau: number[] }[] {
  const out: { black: number[]; tau: number[] }[] = [];
  for (let mask = 0; mask < 1 << board.n; mask++) {
    const X: number[] = [];
    for (let i = 0; i < board.n; i++) if ((mask >> i) & 1) X.push(i);
    for (const t of symmetries(board)) out.push({ black: X, tau: [...t] });
  }
  return out;
}

describe('canonicalPair', () => {
  it('canonical pair examples', () => {
    const d4 = boardOf('D4');
    // black labels 3, 4 with the identity: the class of so(2,6) and so*(8), whose own pairs give the same result
    expect(canonicalPair({ board: d4, black: [2, 3], tau: [0, 1, 2, 3] })).toEqual({ black: [0, 2], tau: [0, 1, 2, 3] });
    expect(canonicalPair({ board: d4, black: [0, 2], tau: [0, 1, 2, 3] })).toEqual({ black: [0, 2], tau: [0, 1, 2, 3] });
    expect(canonicalPair({ board: d4, black: [0, 3], tau: [0, 1, 2, 3] })).toEqual({ black: [0, 2], tau: [0, 1, 2, 3] });
    // so(1,7): black labels 2, 3, 4 and the swap of 3 and 4; the least image comes from a symmetry of order 2 that
    // moves node 1
    expect(canonicalPair({ board: d4, black: [1, 2, 3], tau: [0, 1, 3, 2] })).toEqual({ black: [0, 1, 2], tau: [2, 1, 0, 3] });
    // so(3,5): no black node, the swap of 3 and 4 is the least of the three swaps
    expect(canonicalPair({ board: d4, black: [], tau: [3, 1, 2, 0] })).toEqual({ black: [], tau: [0, 1, 3, 2] });
    // A3: su(1,3) is its own canonical pair
    expect(canonicalPair({ board: boardOf('A3'), black: [1], tau: [2, 1, 0] })).toEqual({ black: [1], tau: [2, 1, 0] });
    // E6: e6(-14) is its own canonical pair
    expect(canonicalPair({ board: boardOf('E6'), black: [4, 2, 3], tau: [5, 1, 4, 3, 2, 0] })).toEqual({
      black: [2, 3, 4], tau: [5, 1, 4, 3, 2, 0],
    });
  });

  it('tau is conjugated as g tau g^-1, and every symmetry counts, those of order 3 included', () => {
    const d4 = boardOf('D4');
    // a tau of order 3 is conjugate only to itself and to its inverse: [2, 1, 3, 0] and [3, 1, 0, 2]
    expect(canonicalPair({ board: d4, black: [], tau: [3, 1, 0, 2] })).toEqual({ black: [], tau: [2, 1, 3, 0] });
    expect(canonicalPair({ board: d4, black: [], tau: [2, 1, 3, 0] })).toEqual({ black: [], tau: [2, 1, 3, 0] });
    // black label 4 alone: a symmetry that moves label 4 to label 1 gives the least black set
    expect(canonicalPair({ board: d4, black: [3], tau: [0, 1, 2, 3] })).toEqual({ black: [0], tau: [0, 1, 2, 3] });
    // the swap of 3 and 4 with black label 1: the rotations give the swaps of 1 and 3, of 1 and 4, black 3 or 4
    expect(canonicalPair({ board: d4, black: [0], tau: [0, 1, 3, 2] })).toEqual({ black: [0], tau: [0, 1, 3, 2] });
    expect(canonicalPair({ board: d4, black: [2], tau: [3, 1, 2, 0] })).toEqual({ black: [0], tau: [0, 1, 3, 2] });
  });

  it('invariance under the symmetries: every pair and its images have one canonical pair (D4, every pair)', () => {
    const board = boardOf('D4');
    const auts = symmetries(board);
    expect(auts.length).toBe(6);
    for (const p of allPairs(board)) {
      const c = canonicalPair({ board, ...p });
      const images = auts.map((g) => image(g, p.black, p.tau)).map((q) => ({ black: [...q.black].sort((a, b) => a - b), tau: q.tau }));
      for (const q of images) {
        expect(canonicalPair({ board, ...q }), JSON.stringify(p)).toEqual(c);
        // the representative is the least image: black set first, then tau, lexicographically on integers
        expect(pairOrder(c, q) <= 0, JSON.stringify(p)).toBe(true);
      }
      // the representative is an image of the pair, and is its own representative
      expect(images.some((q) => pairOrder(c, q) === 0), JSON.stringify(p)).toBe(true);
      expect(canonicalPair({ board, ...c })).toEqual(c);
    }
  });

  it('invariance under the symmetries: every catalogue entry of every type', () => {
    for (const type of TYPE_NAMES) {
      const board = boardOf(type);
      for (const e of satakeCatalogue(type)) {
        const c = canonicalPair({ board, black: e.black_nodes, tau: e.tau });
        for (const g of symmetries(board)) {
          const im = image(g, e.black_nodes, e.tau);
          expect(canonicalPair({ board, ...im }), `${type} ${e.real_form} ${JSON.stringify(g)}`).toEqual(c);
        }
      }
    }
  });

  it('the canonical pairs of the catalogue entries of a board are distinct, except so(2,6) and so*(8) on D4', () => {
    for (const type of TYPE_NAMES) {
      const board = boardOf(type);
      const keys = satakeCatalogue(type).map((e) => JSON.stringify(canonicalPair({ board, black: e.black_nodes, tau: e.tau })));
      const distinct = new Set(keys).size;
      expect(distinct, type).toBe(type === 'D4' ? keys.length - 1 : keys.length);
    }
  });
});

describe('matchCatalogue', () => {
  it('D4 black 3 and 4 matches both forms', () => {
    const board = boardOf('D4');
    for (const blackLabels of [[3, 4], [1, 3], [1, 4]]) {
      const d: SatakeDiagram = { board, black: toPositions(board, blackLabels), tau: [0, 1, 2, 3] };
      const m = matchCatalogue(d);
      // both records, in catalogue order, each with its own restricted_type_display (SPEC.md 4 T13)
      expect(m.map((r) => r.real_form), JSON.stringify(blackLabels)).toEqual(['so(2,6)', 'so*(8)']);
      expect(m.map((r) => r.restricted_type_display)).toEqual(['B2', 'C2']);
      expect(m.map((r) => r.restricted_type)).toEqual(['B2', 'B2']);
      // full records, exactly those of satakeRecord
      const entries = satakeCatalogue('D4');
      expect(m[0]).toEqual(satakeRecord('D4', entries.find((e) => e.real_form === 'so(2,6)')!));
      expect(m[1]).toEqual(satakeRecord('D4', entries.find((e) => e.real_form === 'so*(8)')!));
    }
  });

  it('a non-admissible pair matches nothing', () => {
    // A2 with black label 1 and the identity (reference/verify.py's check)
    expect(matchCatalogue({ board: boardOf('A2'), black: [0], tau: [0, 1] })).toEqual([]);
    // every pair of D4 that admissibility refuses matches nothing, and every pair it accepts matches one or two
    const board = boardOf('D4');
    for (const p of allPairs(board)) {
      const d: SatakeDiagram = { board, ...p };
      const m = matchCatalogue(d);
      if (admissibility(d).admissible) expect(m.length, JSON.stringify(p)).toBeGreaterThanOrEqual(1);
      else expect(m, JSON.stringify(p)).toEqual([]);
    }
  });

  for (const type of TYPE_NAMES) {
    it(`every catalogue entry matches its own record, and so does every image of it under a symmetry: ${type}`, () => {
      const board = boardOf(type);
      const auts = symmetries(board);
      for (const e of satakeCatalogue(type)) {
        const own = satakeRecord(type, e);
        for (const g of auts) {
          const m = matchCatalogue({ board, ...image(g, e.black_nodes, e.tau) });
          const where = `${type} ${e.real_form} ${JSON.stringify(g)}`;
          expect(m.length, where).toBe(type === 'D4' && (e.real_form === 'so(2,6)' || e.real_form === 'so*(8)') ? 2 : 1);
          expect(m.find((r) => r.real_form === e.real_form), where).toEqual(own);
        }
      }
    });
  }

  it('real forms of the twelve examples', () => {
    expect(EXAMPLES.length).toBe(12);
    for (const rec of EXAMPLES) {
      const board = boardOf(rec.type);
      const d: SatakeDiagram = { board, black: toPositions(board, rec.black_nodes), tau: toPositions(board, rec.tau) };
      const where = `${rec.type} black ${JSON.stringify(rec.black_nodes)} tau ${JSON.stringify(rec.tau)}`;
      // rule 5: the record is identified by type, black_nodes and tau
      expect(matchRecord(EXAMPLES, { type: rec.type, black_nodes: rec.black_nodes, tau: rec.tau }), where).toBe(rec);
      const names = admissibility(d).admissible ? matchCatalogue(d).map((r) => r.real_form).sort() : [];
      expect(names, where).toEqual(rec.real_forms);
      // and matchCatalogue alone gives the same, since a pair that is not admissible matches nothing
      expect(matchCatalogue(d).map((r) => r.real_form).sort(), where).toEqual(rec.real_forms);
    }
  });
});
