// The golden keys types[*].coxeter_plane and coxeter_plane_types_with_coincident_points (SPEC.md 2.14 "The
// Coxeter plane", 5.4 Geometry, 5.5 "Eigenvectors", 5.7 phase 4 and rules 3, 5, 7, Appendix G; P4-A1
// instruction 5.6 to 5.9 and 5.14; verify.py section 13, lines 1183 to 1232). Rings within 1e-5 (rule 3),
// distinct points and h_points_on_every_ring exactly, for the 31 types of rank 2 to 8 (A1's coxeter_plane
// is null and is not compared, rule 7). Eigenvector signs and the bases of repeated eigenvalues are not
// unique (5.5), so the remaining checks are invariants and never coordinates: E^T E = B within 1e-9, the
// eigenvalues 2 - 2 cos(pi m / h) against the exponents within 1e-6, no root at the origin, every ring a
// multiple of h, the counts summing to the number of roots, and the rotation of the plane by 2 pi / h by
// the bipartite Coxeter element within 1e-8 (either sense, one sense per type, as verify.py accepts).
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { toPositions } from '../../src/board';
import { gram } from '../../src/classify';
import { coxeterPlanePoints, coxeterPlaneRings, coxeterWord, euclideanBasis } from '../../src/geometry';
import { coxeterNumber } from '../../src/guards';
import { applyWord } from '../../src/moves';
import { roots } from '../../src/search';
import { TYPE_NAMES, boardOf, covers, golden, ringsEq } from './_harness';

covers('types[*].coxeter_plane', 'coxeter_plane_types_with_coincident_points');

/** The types whose coxeter_plane is present: rank 2 to 8 (rule 7: absent, that is null, on A1). */
const PLANE_TYPES = TYPE_NAMES.filter((T) => golden.types[T]!.coxeter_plane != null);

function floatGram(board: Board<number>): number[][] {
  const B = gram(board);
  if (B === null) throw new Error('a finite board is balanced');
  return B.map((row) => row.map((r) => Number(r.num) / Number(r.den)));
}

function dot(u: readonly number[], v: readonly number[]): number {
  let s = 0;
  for (let k = 0; k < u.length; k++) s += u[k]! * v[k]!;
  return s;
}

/** Lexicographic order of integer vectors, compared as numbers (the oracle's sorted(roots(C))). */
function lexCompare(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k]! - b[k]!;
  return 0;
}

/**
 * Whether the Coxeter word of the board rotates the plane of rows 0 and n - 1 of E by exactly 2 pi / h, in
 * one sense or the other, on every root: P(w r) = Rot(sgn 2 pi / h) P(r) within 1e-8 (SPEC.md 2.14 [V]).
 * Returns the sign that works (1 or -1), or 0 when neither does.
 */
function rotationSign(board: Board<number>): number {
  const n = board.n;
  const { E } = euclideanBasis(board);
  const h = coxeterNumber(board);
  const word = coxeterWord(board);
  const R = roots(board, 1000).items;
  const P = (v: readonly number[]): [number, number] => [dot(E[0]!, v), dot(E[n - 1]!, v)];
  for (const sgn of [1, -1]) {
    const c = Math.cos((2 * Math.PI) / h);
    const s = sgn * Math.sin((2 * Math.PI) / h);
    const ok = R.every((r) => {
      const [x, y] = P(r);
      const [u, v] = P(applyWord(board, r, word, 'mutation'));
      return Math.abs(u - (c * x - s * y)) < 1e-8 && Math.abs(v - (s * x + c * y)) < 1e-8;
    });
    if (ok) return sgn;
  }
  return 0;
}

describe('coxeter plane rings', () => {
  it('31 types of rank 2 to 8 carry coxeter_plane; A1 does not', () => {
    expect(PLANE_TYPES.length).toBe(31);
    expect(PLANE_TYPES).not.toContain('A1');
    expect(golden.types.A1!.coxeter_plane ?? null).toBeNull();
  });

  for (const T of PLANE_TYPES) {
    it(`coxeter plane of ${T}`, () => {
      const expected = golden.types[T]!.coxeter_plane!;
      const got = coxeterPlaneRings(boardOf(T));
      ringsEq(got.rings, expected.rings);
      expect(got.distinct_points).toBe(expected.distinct_points);
      expect(got.h_points_on_every_ring).toBe(expected.h_points_on_every_ring);
    });
  }

  it('types with coincident points', () => {
    const computed = PLANE_TYPES.filter((T) => coxeterPlaneRings(boardOf(T)).distinct_points < golden.types[T]!.n_roots).sort();
    expect(computed).toEqual(golden.coxeter_plane_types_with_coincident_points);
  });
});

describe('Euclidean basis invariants', () => {
  it('E^T E = B', () => {
    // verify.py section 13 on the types of rank 2 to 8, and A1 (plan)
    for (const T of TYPE_NAMES) {
      const board = boardOf(T);
      const { E } = euclideanBasis(board);
      const B = floatGram(board);
      const n = board.n;
      expect(E.length, T).toBe(n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let s = 0;
          for (let k = 0; k < n; k++) s += E[k]![i]! * E[k]![j]!;
          expect(Math.abs(s - B[i]![j]!), `${T} (${i}, ${j})`).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('eigenvalues are 2 - 2 cos(pi m / h)', () => {
    // SPEC.md 2.14 step 2: the eigenvalues, ascending, are 2 - 2 cos(pi m_j / h) over the exponents
    for (const T of TYPE_NAMES) {
      const board = boardOf(T);
      const { eigenvalues } = euclideanBasis(board);
      const h = coxeterNumber(board);
      const exps = golden.types[T]!.exponents;
      expect(eigenvalues.length, T).toBe(exps.length);
      for (let k = 1; k < eigenvalues.length; k++) expect(eigenvalues[k]!, T).toBeGreaterThanOrEqual(eigenvalues[k - 1]!);
      eigenvalues.forEach((lambda, k) => {
        const m = (h / Math.PI) * Math.acos(Math.min(1, Math.max(-1, 1 - lambda / 2)));
        expect(Math.abs(m - exps[k]!), `${T} eigenvalue ${k}`).toBeLessThan(1e-6);
      });
    }
  });

  it('rings are multiples of h and avoid the origin', () => {
    for (const T of PLANE_TYPES) {
      const board = boardOf(T);
      const h = coxeterNumber(board);
      const { rings } = coxeterPlaneRings(board);
      expect(rings[0]![0], T).toBeGreaterThan(1e-6);
      for (const [, c] of rings) expect(c % h, T).toBe(0);
      expect(rings.reduce((s, [, c]) => s + c, 0), T).toBe(golden.types[T]!.n_roots);
      for (let k = 1; k < rings.length; k++) expect(rings[k]![0], T).toBeGreaterThan(rings[k - 1]![0]);
      expect(coxeterPlanePoints(board).length, T).toBe(golden.types[T]!.n_roots);
    }
  });

  it('points are the sorted roots projected to rows 0 and n - 1 of E', () => {
    for (const T of ['A3', 'B3', 'G2', 'D4', 'F4']) {
      const board = boardOf(T);
      const n = board.n;
      const { E } = euclideanBasis(board);
      const sorted = [...roots(board, 1000).items].sort(lexCompare);
      const pts = coxeterPlanePoints(board);
      expect(pts.length).toBe(sorted.length);
      sorted.forEach((r, k) => {
        expect(Math.abs(pts[k]![0] - dot(E[0]!, r))).toBeLessThan(1e-12);
        expect(Math.abs(pts[k]![1] - dot(E[n - 1]!, r))).toBeLessThan(1e-12);
      });
    }
  });

  it('Coxeter element rotates by 2 pi / h', () => {
    for (const T of PLANE_TYPES) expect(rotationSign(boardOf(T)), T).not.toBe(0);
  });
});

describe('coxeter word', () => {
  it('coxeter word order', () => {
    // the oracle's coxeter_word (reference/lie_games.py lines 1663 to 1666): all nodes of colour 0 in
    // increasing order, then all of colour 1, colour 0 holding position 0; examples of P4-A1 instruction 5.9
    expect([...coxeterWord(boardOf('A3'))]).toEqual([0, 2, 1]);
    expect([...coxeterWord(boardOf('D4'))]).toEqual([0, 2, 3, 1]);
    expect([...coxeterWord(boardOf('E8'))]).toEqual([0, 3, 5, 7, 1, 2, 4, 6]);
    for (const T of TYPE_NAMES) {
      const board = boardOf(T);
      const n = board.n;
      const word = [...coxeterWord(board)];
      expect([...word].sort((a, b) => a - b), T).toEqual(board.labels.map((_, k) => k));
      expect(word[0], T).toBe(0);
      // against the golden bipartite_colouring (labels in order; a phase-3 key read, not covered here)
      const colour = golden.types[T]!.bipartite_colouring;
      const zero = toPositions(board, board.labels.filter((_, k) => colour[k] === 0));
      const one = toPositions(board, board.labels.filter((_, k) => colour[k] === 1));
      expect(word, T).toEqual([...zero, ...one]);
      // each class ascending and no two positions of one class joined
      for (const cls of [zero, one]) {
        for (let k = 1; k < cls.length; k++) expect(cls[k]!, T).toBeGreaterThan(cls[k - 1]!);
        for (const i of cls) for (const j of cls) if (i !== j) expect(board.cartan[i]![j], `${T} ${i} ${j}`).toBe(0);
      }
      expect(zero.length + one.length, T).toBe(n);
    }
  });
});

describe('E8 showpiece facts', () => {
  it('E8 gives 8 rings of 30, 240 distinct points, and its Coxeter element rotates the plane by 2 pi / 30', () => {
    // SPEC.md 2.14 [V]: "For E8 there are 8 rings of 30 and all 240 points are distinct"
    const board = boardOf('E8');
    const { rings, distinct_points, h_points_on_every_ring } = coxeterPlaneRings(board);
    expect(rings.map(([, c]) => c)).toEqual([30, 30, 30, 30, 30, 30, 30, 30]);
    expect(distinct_points).toBe(240);
    expect(h_points_on_every_ring).toBe(true);
    expect(coxeterNumber(board)).toBe(30);
    expect(rotationSign(board)).not.toBe(0);
  });
});
