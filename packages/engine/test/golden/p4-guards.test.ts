// The phase-4 functions off the finite boards and by hand (SPEC.md 5.6 second table, E-5, E-7, E-10, E-11,
// 5.4 "-0 counted as 0", 5.5 "classify_restricted ... must be ported as it stands"; P4-A1 instruction 5.13,
// 5.14). No covers(): no golden key stores these cases (plan addition under the README section 4 rule that
// every build agent owns its own tests); the golden keys of phase 4 are covered by p4-folding,
// p4-wythoff, p4-coxeter-plane and p4-e8-h4. The random words of applyWordFloat use fast-check with the
// fixed seed recorded below and in decisions/P4-A1.md.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Big, SafeInt } from '../../src/arith';
import type { AnyBoard } from '../../src/board';
import { boardFromName, cartan, cartanNumbers, fromAdjacency, subBoard } from '../../src/board';
import { gram } from '../../src/classify';
import { EngineError, NeedsTwoWayRoads, NotFiniteType } from '../../src/errors';
import { averagedRootsType, averagedSimpleCartan, fold, symmetries } from '../../src/fold';
import {
  applyWordFloat,
  coxeterPlanePoints,
  coxeterPlaneRings,
  coxeterWord,
  euclideanBasis,
  ringsOfPoints,
  round6,
  symEig,
} from '../../src/geometry';
import { applyWord } from '../../src/moves';
import { classifyRestricted } from '../../src/restrictedType';
import { roots } from '../../src/search';
import { wythoffEdges, wythoffFaceTypes, wythoffFVector } from '../../src/wythoff';
import { renumber } from '../helpers/p2';
import { TYPE_NAMES, boardOf } from './_harness';

// fixed seed and run count of the applyWordFloat property, recorded in decisions/P4-A1.md
const SEED = 20261017;
const NUM_RUNS = 300;

type Call = (board: AnyBoard) => unknown;

function identityOf(n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(k);
  return out;
}

/** Every guarded phase-4 function, called with arguments of the right shape for the board (plan). */
const GUARDED: [string, Call][] = [
  ['fold', (b) => fold(b, identityOf(b.n))],
  ['averagedRootsType', (b) => averagedRootsType(b, identityOf(b.n))],
  ['averagedSimpleCartan', (b) => averagedSimpleCartan(b, identityOf(b.n))],
  ['euclideanBasis', (b) => euclideanBasis(b)],
  ['coxeterPlanePoints', (b) => coxeterPlanePoints(b)],
  ['coxeterPlaneRings', (b) => coxeterPlaneRings(b)],
  ['coxeterWord', (b) => coxeterWord(b)],
  ['applyWordFloat', (b) => applyWordFloat(b, b.labels.map(() => 1), [0], 'firing')],
  ['wythoffFaceTypes', (b) => wythoffFaceTypes(b, b.labels.map(() => 1))],
  ['wythoffFVector', (b) => wythoffFVector(b, b.labels.map(() => 1))],
  ['wythoffEdges', (b) => wythoffEdges(b, b.labels.map(() => 1), 100)],
];

function caught(f: () => unknown): unknown {
  try {
    f();
  } catch (e) {
    return e;
  }
  return null;
}

describe('one-way board', () => {
  const oneWay = () => fromAdjacency([[0, 1], [0, 0]]);
  it('is a one-way board', () => {
    expect(oneWay().kind).toBe('one-way');
  });
  for (const [name, f] of GUARDED) {
    it(`${name} throws NeedsTwoWayRoads, an EngineError`, () => {
      const e = caught(() => f(oneWay()));
      expect(e).toBeInstanceOf(NeedsTwoWayRoads);
      expect(e).toBeInstanceOf(EngineError);
    });
  }
});

describe('affine board', () => {
  const affine = () => boardFromName('A2~');
  for (const [name, f] of GUARDED) {
    it(`${name} throws NotFiniteType, an EngineError`, () => {
      const e = caught(() => f(affine()));
      expect(e).toBeInstanceOf(NotFiniteType);
      expect(e).toBeInstanceOf(EngineError);
    });
  }
  it('the pentagon and the star with five arms are refused too', () => {
    const star5 = fromAdjacency([
      [0, 1, 1, 1, 1, 1], [1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0],
    ]);
    for (const b of [boardFromName('pentagon'), star5]) {
      for (const [name, f] of GUARDED) expect(caught(() => f(b)), name).toBeInstanceOf(NotFiniteType);
    }
  });
});

describe('symmetries off the finite types', () => {
  it('works on the one-way board and on the triangle A2~', () => {
    expect(symmetries(fromAdjacency([[0, 1], [0, 0]])).map((s) => [...s])).toEqual([[0, 1]]);
    const tri = symmetries(boardFromName('A2~')).map((s) => [...s]);
    expect(tri.length).toBe(6);
    expect(tri[0]).toEqual([0, 1, 2]);
    expect(symmetries(boardFromName('pentagon')).length).toBe(10);
  });
  it('a limit that is not a positive integer is a RangeError (relabellings)', () => {
    expect(() => symmetries(boardOf('A3'), 0)).toThrow(RangeError);
  });
});

describe('symEig', () => {
  it('a hand matrix: [[2, -1], [-1, 2]] has eigenvalues 1 and 3 with orthonormal eigenvectors', () => {
    const { values, vectors } = symEig([[2, -1], [-1, 2]]);
    expect(values.length).toBe(2);
    expect(Math.abs(values[0]! - 1)).toBeLessThan(1e-12);
    expect(Math.abs(values[1]! - 3)).toBeLessThan(1e-12);
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        const d = vectors[a]![0]! * vectors[b]![0]! + vectors[a]![1]! * vectors[b]![1]!;
        expect(Math.abs(d - (a === b ? 1 : 0))).toBeLessThan(1e-12);
      }
    }
  });

  it('M v = lambda v, ascending values and orthonormal rows on the Cartan matrices of the simply laced types', () => {
    for (const T of TYPE_NAMES.filter((t) => /^[ADE]/.test(t))) {
      const M = cartan(T);
      const n = M.length;
      const { values, vectors } = symEig(M);
      for (let k = 1; k < n; k++) expect(values[k]!).toBeGreaterThanOrEqual(values[k - 1]!);
      for (let k = 0; k < n; k++) {
        for (let i = 0; i < n; i++) {
          let mv = 0;
          for (let j = 0; j < n; j++) mv += M[i]![j]! * vectors[k]![j]!;
          expect(Math.abs(mv - values[k]! * vectors[k]![i]!), `${T} ${k} ${i}`).toBeLessThan(1e-9);
        }
        for (let l = 0; l < n; l++) {
          let d = 0;
          for (let j = 0; j < n; j++) d += vectors[k]![j]! * vectors[l]![j]!;
          expect(Math.abs(d - (k === l ? 1 : 0)), `${T} ${k} ${l}`).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('does not change its argument; a matrix that is not square is a RangeError', () => {
    const M = Object.freeze([Object.freeze([2, -1]), Object.freeze([-1, 2])]);
    symEig(M);
    expect(M).toEqual([[2, -1], [-1, 2]]);
    expect(() => symEig([[1, 2, 3], [4, 5, 6]])).toThrow(RangeError);
  });
});

describe('applyWordFloat', () => {
  const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
    const n = boardOf(T).n;
    return fc.tuple(
      fc.constant(T),
      fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }),
      fc.array(fc.integer({ min: 0, max: n - 1 }), { minLength: 0, maxLength: 24 }),
      fc.constantFrom('mutation' as const, 'firing' as const),
    );
  });

  it('applyWordFloat agrees with applyWord on integers', () => {
    fc.assert(
      fc.property(caseArb, ([T, v, word, game]) => {
        const board = boardOf(T);
        expect(applyWordFloat(board, v, word, game)).toEqual(applyWord(board, v, word, game));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('is linear in v on floats', () => {
    fc.assert(
      fc.property(caseArb, ([T, v, word, game]) => {
        const board = boardOf(T);
        const x = v.map((a, k) => a / 3 + Math.SQRT2 * k);
        const y = v.map((a, k) => 0.5 - a * Math.PI + k / 7);
        const sum = x.map((a, k) => 2 * a - 3 * y[k]!);
        const fx = applyWordFloat(board, x, word, game);
        const fy = applyWordFloat(board, y, word, game);
        const fs = applyWordFloat(board, sum, word, game);
        fs.forEach((s, k) => expect(Math.abs(s - (2 * fx[k]! - 3 * fy[k]!))).toBeLessThan(1e-6 * (1 + Math.abs(s))));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('the two moves on floats, by hand, and the argument unchanged', () => {
    const b = boardOf('B3');
    const v = Object.freeze([0, 1, Math.SQRT2]);
    // firing node 3 of B3 (position 2): column 2 of C is (0, -1, 2), so a_2 gains sqrt 2 and a_3 changes sign
    const fired = applyWordFloat(b, v, [2], 'firing');
    expect(Math.abs(fired[1]! - (1 + Math.SQRT2))).toBeLessThan(1e-12);
    expect(fired[2]).toBe(-Math.SQRT2);
    expect(fired[0]).toBe(0);
    // mutating city 2 (position 1): row 1 of C is (-1, 2, -1)
    const mutated = applyWordFloat(b, v, [1], 'mutation');
    expect(Math.abs(mutated[1]! - (1 - (2 - Math.SQRT2)))).toBeLessThan(1e-12);
    expect(v).toEqual([0, 1, Math.SQRT2]);
  });

  it('RangeError on a bad vector, word or game', () => {
    const b = boardOf('A3');
    expect(() => applyWordFloat(b, [1, 2], [0], 'firing')).toThrow(RangeError);
    expect(() => applyWordFloat(b, [1, 2, 3], [3], 'firing')).toThrow(RangeError);
    expect(() => applyWordFloat(b, [1, 2, 3], [0], 'jumping' as never)).toThrow(RangeError);
  });
});

describe('the minus-zero rule of coxeterPlaneRings', () => {
  it('minus zero rounds to zero', () => {
    // SPEC.md 5.4: coordinates rounded to 6 decimals with -0 counted as 0
    expect(Object.is(Math.round(-1e-7 * 1e6) / 1e6, -0)).toBe(true);
    expect(Object.is(round6(-1e-7), 0)).toBe(true);
    expect(Object.is(round6(-0), 0)).toBe(true);
    expect(Object.is(round6(-4e-7), 0)).toBe(true);
    expect(round6(1.4142135)).toBe(1.414214);
    expect(round6(-1.4142135)).toBe(-1.414213);
    // why it matters: a key made with toFixed would see two points here
    expect((-1e-7).toFixed(6)).not.toBe((1e-7).toFixed(6));
    const r = ringsOfPoints([[-1e-7, 1], [1e-7, 1], [1, -1e-7], [1, 1e-7]], 2);
    expect(r.distinct_points).toBe(2);
    expect(r.rings).toEqual([[1, 4]]);
    expect(r.h_points_on_every_ring).toBe(false);
  });
});

describe('classifyRestricted', () => {
  it('classifyRestricted refuses a non-root-system', () => {
    const B = [[2, 0], [0, 3]].map((row) => row.map((x) => ({ num: BigInt(x), den: 1n })));
    // three vectors of three different squared lengths (2, 3, 5)
    expect(() => classifyRestricted([[1, 0], [0, 1], [1, 1]], B, 2)).toThrow(EngineError);
    // one squared length, but not A, D or E
    const B1 = [[{ num: 2n, den: 1n }]];
    expect(() => classifyRestricted([[1]], B1, 1)).toThrow(EngineError);
    // two squared lengths in rank 3 with counts of neither B3 nor C3
    const B3 = gram(boardOf('B3'))!;
    expect(() => classifyRestricted([[1, 0, 0], [0, 0, 1], [-1, 0, 0]], B3, 3)).toThrow(EngineError);
  });

  it('names the root systems of the finite types from their integer roots (rank 2 says B2)', () => {
    for (const T of TYPE_NAMES) {
      const board = boardOf(T);
      const S = roots(board, 1000).items;
      const res = classifyRestricted(S, gram(board)!, board.n);
      expect(res.name, T).toBe(T === 'C2' ? 'B2' : T);
      expect(res.classes.reduce((s, c) => s + c.roots, 0), T).toBe(S.length);
    }
  });

  it('a set counts each vector once; integer, bigint and rational entries agree', () => {
    const board = boardOf('G2');
    const S = roots(board, 100).items;
    const B = gram(board)!;
    const asInts = classifyRestricted([...S, ...S], B, 2);
    const asBig = classifyRestricted(S.map((v) => v.map((x) => BigInt(x))), B, 2);
    const asRat = classifyRestricted(S.map((v) => v.map((x) => ({ num: BigInt(2 * x), den: 2n }))), B, 2);
    expect(asInts).toEqual({ name: 'G2', classes: [{ class: 'short', roots: 6, form_value: '2' }, { class: 'long', roots: 6, form_value: '6' }] });
    expect(asBig).toEqual(asInts);
    expect(asRat).toEqual(asInts);
  });
});

describe('symmetries that are not permutations', () => {
  const b = boardOf('A3');
  for (const bad of [[0, 0, 1], [0, 1], [0, 1, 3], [0, 1, 1.5], [-1, 1, 2]]) {
    it(`fold, averagedRootsType, averagedSimpleCartan throw RangeError on ${JSON.stringify(bad)}`, () => {
      expect(() => fold(b, bad)).toThrow(RangeError);
      expect(() => averagedRootsType(b, bad)).toThrow(RangeError);
      expect(() => averagedSimpleCartan(b, bad)).toThrow(RangeError);
    });
  }
});

describe('the identity symmetry', () => {
  it('folds A3 to A3 and averages to A3 with one class all', () => {
    const b = boardOf('A3');
    const res = fold(b, [0, 1, 2]);
    expect(res.orbits).toEqual([[0], [1], [2]]);
    expect(res.reason).toBeNull();
    expect(cartanNumbers(res.folded!)).toEqual(cartanNumbers(b));
    expect(res.folded!.name).toBe('A3');
    expect([...res.folded!.labels]).toEqual([1, 2, 3]);
    expect(averagedRootsType(b, [0, 1, 2])).toEqual({ name: 'A3', classes: [{ class: 'all', roots: 12, form_value: '2' }] });
    expect(averagedSimpleCartan(b, [0, 1, 2])).toEqual(cartanNumbers(b));
  });

  it('folds every finite type to itself', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const res = fold(b, identityOf(b.n));
      expect(cartanNumbers(res.folded!), T).toEqual(cartanNumbers(b));
      expect(averagedSimpleCartan(b, identityOf(b.n)), T).toEqual(cartanNumbers(b));
    }
  });
});

describe('the folded board', () => {
  it('E6 folds to F4 with labels in the Bourbaki order of F4 (identify order [0, 2, 3, 1])', () => {
    const b = boardOf('E6');
    const res = fold(b, [5, 1, 4, 3, 2, 0]);
    expect(res.orbits).toEqual([[0, 5], [1], [2, 4], [3]]);
    expect(res.folded!.name).toBe('F4');
    // labels[order[k]] = k + 1: position 0 plays F4 node 1, position 2 node 2, position 3 node 3, position 1 node 4
    expect([...res.folded!.labels]).toEqual([1, 4, 2, 3]);
    expect(Object.isFrozen(res.folded)).toBe(true);
    expect(Object.isFrozen(res.folded!.cartan)).toBe(true);
    expect(res.folded!.arith).toBe(SafeInt);
  });

  it('the rotation of D4 folds to G2 with its nodes exchanged', () => {
    const res = fold(boardOf('D4'), [2, 1, 3, 0]);
    expect(cartanNumbers(res.folded!)).toEqual([[2, -1], [-3, 2]]);
    expect(res.folded!.name).toBe('G2');
    expect([...res.folded!.labels]).toEqual([2, 1]);
  });

  it('a disconnected finite board: the pieces fold, and a disconnected fold keeps the order of the orbits', () => {
    const twoA2 = fromAdjacency([[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]]);
    const swapped = fold(twoA2, [2, 3, 0, 1]);
    expect(swapped.orbits).toEqual([[0, 2], [1, 3]]);
    expect(swapped.folded!.name).toBe('A2');
    const threeA1 = fromAdjacency([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    const id = fold(threeA1, [0, 1, 2]);
    expect(id.folded!.name).toBeUndefined();
    expect([...id.folded!.labels]).toEqual([1, 2, 3]);
    expect(cartanNumbers(id.folded!)).toEqual([[2, 0, 0], [0, 2, 0], [0, 0, 2]]);
  });
});

describe('positions, not labels (E-7), and the Big path', () => {
  it('on a sub-board whose labels are 2, 3, 4 the results are positions', () => {
    const sub = subBoard(boardOf('A4'), [1, 2, 3]); // an A3 with labels 2, 3, 4
    expect([...sub.labels]).toEqual([2, 3, 4]);
    expect(fold(sub, [2, 1, 0]).orbits).toEqual([[0, 2], [1]]);
    expect(wythoffFaceTypes(sub, [1, 0, 1]).map((f) => f.nodes)).toEqual([[], [0], [0, 1], [2], [0, 2], [1, 2], [0, 1, 2]]);
    expect([...coxeterWord(sub)]).toEqual([0, 2, 1]);
  });

  it('a renumbered A3 on Big gives the same answers as the named board, in its own positions', () => {
    // node 0 of the renumbered board is node 1 (the middle) of A3
    const perm = [1, 0, 2];
    const C = renumber(cartan('A3'), perm);
    const A = C.map((row, i) => row.map((_, j) => (i === j ? 0 : -C[j]![i]!)));
    const big = fromAdjacency(A);
    expect(big.arith).toBe(Big);
    expect(coxeterPlaneRings(big)).toEqual(coxeterPlaneRings(boardOf('A3')));
    expect(wythoffFVector(big, [0, 1, 1])).toEqual(wythoffFVector(boardOf('A3'), [1, 0, 1]));
    const edges = wythoffEdges(big, [0, 1, 1], 1000);
    expect(edges.truncated).toBe(false);
    expect(edges.items.length).toBe(24);
    for (const [u, v] of edges.items) for (const x of [...u, ...v]) expect(typeof x).toBe('number');
    const res = fold(big, [0, 2, 1]);
    expect(res.orbits).toEqual([[0], [1, 2]]);
    expect(res.folded!.name).toBe('B2');
    expect(averagedRootsType(big, [0, 2, 1]).name).toBe('B2');
    expect([...coxeterWord(big)]).toEqual([0, 1, 2]);
    const id = symmetries(big).map((s) => [...s]);
    expect(id).toEqual([[0, 1, 2], [0, 2, 1]]);
  });
});

describe('purity (E-5)', () => {
  it('no phase-4 function changes its arguments', () => {
    const b = boardOf('D4');
    const tau = Object.freeze([2, 1, 3, 0]);
    const rings = Object.freeze([1, 0, 1, 0]);
    fold(b, tau);
    averagedRootsType(b, tau);
    averagedSimpleCartan(b, tau);
    wythoffFaceTypes(b, rings);
    wythoffEdges(b, rings, 1000);
    applyWordFloat(b, rings, Object.freeze([0, 1, 2]), 'mutation');
    expect(tau).toEqual([2, 1, 3, 0]);
    expect(rings).toEqual([1, 0, 1, 0]);
    expect(Object.isFrozen(b.cartan)).toBe(true);
    const e1 = euclideanBasis(b);
    const e2 = euclideanBasis(b);
    expect(e2).toEqual(e1);
    expect(e2.E).not.toBe(e1.E);
  });

  it('wythoff rings and caps are checked', () => {
    const b = boardOf('A3');
    expect(() => wythoffFaceTypes(b, [1, 0])).toThrow(RangeError);
    expect(() => wythoffFVector(b, [1, -1, 0])).toThrow(RangeError);
    expect(() => wythoffEdges(b, [1, 0, 0], -1)).toThrow(RangeError);
    expect(wythoffEdges(b, [1, 0, 0], 0)).toEqual({ items: [], truncated: true });
  });
});
