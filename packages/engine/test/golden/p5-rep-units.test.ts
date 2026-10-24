// The phase-5 engine by hand (SPEC.md 2.18, 5.2, 5.4, 5.6, E-5; P5-A1 instruction 5.2 to 5.6, section 6).
// No covers(): the golden key of phase 5, minuscule_representations, is covered in p5-minuscule.test.ts
// (a key is tested in exactly one file, CONTRACTS.md 3); this file holds the plan's unit tests: the sparse
// operations against hand values, the matrices of A1 and A2 by hand, the relation records of A2, the
// examples and the property of stringThrough, the cap of minusculeMatrices, the Serre exponent, the same
// results on a Board<bigint>, and purity. The bases of A1 and A2 are read from the golden file through the
// harness; the hand-typed E, F, H, moves, signed moves and strings are not golden fields (they index rows and
// columns in that basis order). The property of stringThrough uses fast-check with the fixed seed below,
// recorded in decisions/P5-A1.md.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { cartan, cartanNumbers } from '../../src/board';
import { CAPS } from '../../src/caps';
import { fire } from '../../src/moves';
import type { RelationCheck, SparseMatrix } from '../../src/rep';
import {
  chevalleySerre,
  minusculeMatrices,
  signedMoves,
  spAdd,
  spComm,
  spEq,
  spKey,
  spMul,
  spScale,
  stringThrough,
} from '../../src/rep';
import { bigBoard } from '../helpers/p1';
import { boardOf, golden, intEq, matchRecord } from './_harness';

// fixed seed and run count of the stringThrough property (CONTRACTS.md 3), recorded in decisions/P5-A1.md
const SEED = 20261024;
const NUM_RUNS = 400;

interface MinusculeRecord {
  type: string;
  node: number;
  dimension: number;
  weights_dynkin_labels: number[][] | null;
}

const RECORDS = golden.minuscule_representations as MinusculeRecord[];

/** A sparse matrix from [key, value] pairs, in the order given (insertion order is not meaningful). */
function sp(entries: [string, number][]): SparseMatrix {
  return new Map(entries.map(([k, v]) => [k, BigInt(v)] as [string, bigint]));
}

/** The entries as sorted [key, decimal text] pairs: a readable, order-free picture for failure messages (plan). */
function dump(M: SparseMatrix): [string, string][] {
  return [...M.entries()].map(([k, v]) => [k, String(v)] as [string, string]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** True when no stored entry is zero (the oracle's invariant). */
function zeroFree(M: SparseMatrix): boolean {
  for (const v of M.values()) if (v === 0n) return false;
  return true;
}

describe('sparse operations', () => {
  // X = [[1, 2], [3, 0]] and Y = [[0, 4], [-1, 5]] as dense matrices, rows are images, columns sources.
  const X = (): SparseMatrix => sp([['0,0', 1], ['0,1', 2], ['1,0', 3]]);
  const Y = (): SparseMatrix => sp([['0,1', 4], ['1,1', 5], ['1,0', -1]]);

  it('spKey joins row and column with one comma', () => {
    expect(spKey(0, 2)).toBe('0,2');
    expect(spKey(12, 3)).toBe('12,3');
    expect(spKey(0, 0)).toBe('0,0');
    for (const [r, c] of [[-1, 0], [0, -1], [1.5, 0], [0, Number.NaN], [Number.POSITIVE_INFINITY, 0]] as [number, number][]) {
      expect(() => spKey(r, c), `${r},${c}`).toThrow(RangeError);
    }
  });

  it('spMul: (XY)[r][c] = sum_k X[r][k] Y[k][c], zeros dropped', () => {
    const x = X();
    const y = Y();
    // XY = [[-2, 14], [0, 12]]; YX = [[12, 0], [14, -2]]
    expect(dump(spMul(x, y))).toEqual(dump(sp([['0,0', -2], ['0,1', 14], ['1,1', 12]])));
    expect(dump(spMul(y, x))).toEqual(dump(sp([['0,0', 12], ['1,0', 14], ['1,1', -2]])));
    // a sum that cancels: (1, 1) times the column (1, -1)
    const cancel = spMul(sp([['0,0', 1], ['0,1', 1]]), sp([['0,0', 1], ['1,0', -1]]));
    expect(cancel.size).toBe(0);
    // keys with more than one digit, and a rectangular product
    expect(dump(spMul(sp([['12,3', 2]]), sp([['3,10', 5]])))).toEqual([['12,10', '10']]);
    // (1, 2, 3) times the 3 x 2 matrix with rows (0, 1), (0, 1), (-1, -1) is (-3, 0)
    expect(dump(spMul(sp([['0,0', 1], ['0,1', 2], ['0,2', 3]]), sp([['0,1', 1], ['1,1', 1], ['2,0', -1], ['2,1', -1]])))).toEqual([
      ['0,0', '-3'],
    ]);
    // the empty Map is the zero matrix
    expect(spMul(new Map(), x).size).toBe(0);
    expect(spMul(x, new Map()).size).toBe(0);
    for (const M of [spMul(x, y), spMul(y, x), cancel]) expect(zeroFree(M)).toBe(true);
  });

  it('spMul refuses a key that is not two decimal integers joined by one comma', () => {
    for (const bad of ['0, 1', '0;1', 'a,1', '01,1', '1', '1,2,3', '-1,0', '']) {
      expect(() => spMul(sp([[bad, 1]]), sp([['0,0', 1]])), bad).toThrow(RangeError);
      expect(() => spMul(sp([['0,0', 1]]), sp([[bad, 1]])), bad).toThrow(RangeError);
    }
  });

  it('spAdd: X + cy Y with cy defaulting to 1, zeros dropped', () => {
    const x = X();
    const y = Y();
    expect(dump(spAdd(x, y))).toEqual(dump(sp([['0,0', 1], ['0,1', 6], ['1,0', 2], ['1,1', 5]])));
    expect(dump(spAdd(x, y, -1n))).toEqual(dump(sp([['0,0', 1], ['0,1', -2], ['1,0', 4], ['1,1', -5]])));
    // X + 3Y: the entry (1, 0) is 3 - 3 = 0 and is dropped
    expect(dump(spAdd(x, y, 3n))).toEqual(dump(sp([['0,0', 1], ['0,1', 14], ['1,1', 15]])));
    expect(spAdd(x, x, -1n).size).toBe(0);
    const same = spAdd(x, y, 0n);
    expect(dump(same)).toEqual(dump(x));
    expect(same).not.toBe(x);
    // an explicit zero in an input is dropped
    expect(dump(spAdd(sp([['0,0', 0], ['1,1', 2]]), new Map()))).toEqual([['1,1', '2']]);
    for (const M of [spAdd(x, y), spAdd(x, y, -1n), spAdd(x, y, 3n), same]) expect(zeroFree(M)).toBe(true);
  });

  it('spComm: XY - YX', () => {
    // [X, Y] = [[-14, 14], [-14, 14]]
    expect(dump(spComm(X(), Y()))).toEqual(dump(sp([['0,0', -14], ['0,1', 14], ['1,0', -14], ['1,1', 14]])));
    expect(dump(spComm(Y(), X()))).toEqual(dump(sp([['0,0', 14], ['0,1', -14], ['1,0', 14], ['1,1', -14]])));
    expect(spComm(X(), X()).size).toBe(0);
    // diagonal matrices commute
    expect(spComm(sp([['0,0', 2], ['1,1', -1]]), sp([['0,0', 5], ['1,1', 7]])).size).toBe(0);
  });

  it('spScale: cX, the empty Map when c is 0', () => {
    expect(dump(spScale(X(), 3n))).toEqual(dump(sp([['0,0', 3], ['0,1', 6], ['1,0', 9]])));
    expect(dump(spScale(X(), -1n))).toEqual(dump(sp([['0,0', -1], ['0,1', -2], ['1,0', -3]])));
    expect(spScale(X(), 0n).size).toBe(0);
    const one = spScale(X(), 1n);
    expect(one).not.toBe(X());
    expect(dump(one)).toEqual(dump(X()));
    expect(zeroFree(spScale(sp([['0,0', 0], ['1,1', 2]]), 5n))).toBe(true);
  });

  it('spEq: the same nonzero entries, independent of insertion order, explicit zeros ignored', () => {
    expect(spEq(X(), X())).toBe(true);
    expect(spEq(sp([['0,0', 1], ['1,0', 3], ['0,1', 2]]), X())).toBe(true);
    expect(spEq(sp([['0,0', 1], ['5,5', 0]]), sp([['0,0', 1]]))).toBe(true);
    expect(spEq(sp([['0,0', 1]]), sp([['0,0', 1], ['5,5', 0]]))).toBe(true);
    expect(spEq(sp([['3,3', 0]]), new Map())).toBe(true);
    expect(spEq(new Map(), new Map())).toBe(true);
    expect(spEq(X(), Y())).toBe(false);
    expect(spEq(sp([['0,0', 1]]), sp([['0,0', 2]]))).toBe(false);
    expect(spEq(sp([['0,0', 1]]), sp([['0,0', 1], ['0,1', 1]]))).toBe(false);
    expect(spEq(sp([['0,0', 1], ['0,1', 1]]), sp([['0,0', 1]]))).toBe(false);
    expect(spEq(sp([['0,0', 1]]), sp([['1,1', 1]]))).toBe(false);
    expect(spEq(sp([['0,0', 1]]), new Map())).toBe(false);
  });

  it('inputs are unchanged by every operation', () => {
    const x = X();
    const y = Y();
    const zx = sp([['0,0', 0], ['1,1', 2]]);
    const before = [dump(x), dump(y), dump(zx)];
    spMul(x, y);
    spMul(zx, x);
    spAdd(x, y, -1n);
    spAdd(zx, y);
    spComm(x, y);
    spScale(x, 0n);
    spScale(zx, 2n);
    spEq(zx, y);
    expect([dump(x), dump(y), dump(zx)]).toEqual(before);
    expect(zx.get('0,0')).toBe(0n);
  });
});

/** The record of rule 5 for (type, node), with its non-null weights. */
function weightsOf(type: string, node: number): number[][] {
  const w = matchRecord(RECORDS, { type, node }).weights_dynkin_labels;
  if (w === null) throw new Error(`${type} node ${node} has no weights in the golden file`);
  return w;
}

/** The record of chevalleySerre with this relation and these positions (exactly one). */
function recordOf(records: RelationCheck[], relation: RelationCheck['relation'], i: number, j: number): RelationCheck {
  const hits = records.filter((r) => r.relation === relation && r.i === i && r.j === j);
  expect(hits.length).toBe(1);
  return hits[0]!;
}

describe('A1 and A2 by hand', () => {
  it('A1 node 1: the basis of the golden file, E, F, H, the move and the signed move', () => {
    const b = boardOf('A1');
    const m = minusculeMatrices(b, 0)!;
    expect(m).not.toBeNull();
    intEq(m.basis, weightsOf('A1', 1), 'basis');
    expect(dump(m.E[0]!)).toEqual([['0,1', '1']]);
    expect(dump(m.F[0]!)).toEqual([['1,0', '1']]);
    expect(dump(m.H[0]!)).toEqual([['0,0', '1'], ['1,1', '-1']]);
    expect(dump(m.moves[0]!)).toEqual([['0,1', '1'], ['1,0', '1']]);
    expect(dump(signedMoves(m.basis, m.E, m.F)[0]!)).toEqual([['0,1', '1'], ['1,0', '-1']]);
    const records = chevalleySerre(b, m.E, m.F, m.H);
    expect(records.map((r) => r.relation)).toEqual(['hh', 'he', 'hf', 'ef']);
    expect(records.every((r) => r.holds)).toBe(true);
  });

  it('A2 node 1: the basis of the golden file and the 3 x 3 matrices', () => {
    const b = boardOf('A2');
    const m = minusculeMatrices(b, 0)!;
    intEq(m.basis, weightsOf('A2', 1), 'basis');
    expect(m.E.map(dump)).toEqual([[['0,2', '1']], [['2,1', '1']]]);
    expect(m.F.map(dump)).toEqual([[['2,0', '1']], [['1,2', '1']]]);
    expect(m.H.map(dump)).toEqual([
      [['0,0', '1'], ['2,2', '-1']],
      [['1,1', '-1'], ['2,2', '1']],
    ]);
    expect(dump(m.moves[0]!)).toEqual([['0,2', '1'], ['1,1', '1'], ['2,0', '1']]);
    expect(dump(m.moves[1]!)).toEqual([['0,0', '1'], ['1,2', '1'], ['2,1', '1']]);
    const signed = signedMoves(m.basis, m.E, m.F);
    expect(dump(signed[0]!)).toEqual([['0,2', '1'], ['1,1', '1'], ['2,0', '-1']]);
    expect(dump(signed[1]!)).toEqual([['0,0', '1'], ['1,2', '-1'], ['2,1', '1']]);
  });

  it('A2 node 2: the basis of the golden file (the first vector is not omega_2)', () => {
    const m = minusculeMatrices(boardOf('A2'), 1)!;
    intEq(m.basis, weightsOf('A2', 2), 'basis');
    expect(m.basis[0]).not.toEqual([0, 1]);
  });

  it('A2: [E_1, F_1] = H_1 and [E_1, F_2] = 0 as records of chevalleySerre (M8 beat 3)', () => {
    const b = boardOf('A2');
    const m = minusculeMatrices(b, 0)!;
    const records = chevalleySerre(b, m.E, m.F, m.H);
    expect(records.length).toBe(20);
    expect(records.slice(0, 10).map((r) => `${r.relation}:${r.i},${r.j}`)).toEqual([
      'hh:0,0', 'he:0,0', 'hf:0,0', 'ef:0,0', 'hh:0,1', 'he:0,1', 'hf:0,1', 'ef:0,1', 'serre-e:0,1', 'serre-f:0,1',
    ]);
    const ef11 = recordOf(records, 'ef', 0, 0);
    expect(ef11.holds).toBe(true);
    expect(dump(ef11.left)).toEqual([['0,0', '1'], ['2,2', '-1']]);
    expect(spEq(ef11.right, m.H[0]!)).toBe(true);
    expect(ef11.right).not.toBe(m.H[0]);
    const ef12 = recordOf(records, 'ef', 0, 1);
    expect(ef12.holds).toBe(true);
    expect(ef12.left.size).toBe(0);
    expect(ef12.right.size).toBe(0);
    expect(dump(spComm(m.E[0]!, m.F[0]!))).toEqual([['0,0', '1'], ['2,2', '-1']]);
    // [H_1, E_2] = C_12 E_2 = -E_2: the right side is E_2 scaled by C[0][1]
    const he12 = recordOf(records, 'he', 0, 1);
    expect(dump(he12.right)).toEqual([['2,1', '-1']]);
    expect(he12.holds).toBe(true);
    // [H_2, F_1] = -C_21 F_1 = F_1
    expect(dump(recordOf(records, 'hf', 1, 0).right)).toEqual([['2,0', '1']]);
    expect(records.every((r) => r.holds)).toBe(true);
  });
});

describe('the Serre exponent is 1 - C[i][j], with i the operator applied', () => {
  // N shifts e0 -> e1 -> e2 -> e3; for X = e_1 e_0^T, ad(N)^2 X = e_3 e_0^T is not zero and ad(N)^3 X = 0
  // (checked with the oracle's sp_comm). So the left side of a Serre record is zero exactly when the
  // exponent is at least 3: the record tells the count, and on B2 which entry of C it reads.
  const N = (): SparseMatrix => new Map([['1,0', 1n], ['2,1', 1n], ['3,2', 1n]]);
  const X = (): SparseMatrix => new Map([['1,0', 1n]]);
  const none = (): SparseMatrix[] => [new Map(), new Map()];

  it('A2 (exponent 2): ad(E_1)^2 E_2 is e_3 e_0^T, so the record fails; the same for F', () => {
    const b = boardOf('A2');
    const records = chevalleySerre(b, [N(), X()], [N(), X()], none());
    for (const rel of ['serre-e', 'serre-f'] as const) {
      const r = recordOf(records, rel, 0, 1);
      expect(dump(r.left)).toEqual([['3,0', '1']]);
      expect(r.right.size).toBe(0);
      expect(r.holds).toBe(false);
    }
  });

  it('B2: (i, j) = (0, 1) has exponent 1 - C[0][1] = 2 and fails; (1, 0) has exponent 1 - C[1][0] = 3 and holds', () => {
    const b = boardOf('B2');
    expect(cartanNumbers(b)).toEqual([[2, -1], [-2, 2]]);
    const first = chevalleySerre(b, [N(), X()], [N(), X()], none());
    for (const rel of ['serre-e', 'serre-f'] as const) {
      const r = recordOf(first, rel, 0, 1);
      expect(dump(r.left)).toEqual([['3,0', '1']]);
      expect(r.holds).toBe(false);
    }
    const second = chevalleySerre(b, [X(), N()], [X(), N()], none());
    for (const rel of ['serre-e', 'serre-f'] as const) {
      const r = recordOf(second, rel, 1, 0);
      expect(r.left.size).toBe(0);
      expect(r.holds).toBe(true);
    }
  });
});

describe('stringThrough examples', () => {
  it('A2 at node 1: through (2, 0) three positions, through (1, 0) two, through (0, 1) one (M8 beat 1)', () => {
    const b = boardOf('A2');
    expect(stringThrough(b, [2, 0], 0)).toEqual([[2, 0], [0, 1], [-2, 2]]);
    expect(fire(b, [2, 0], 0)).toEqual([-2, 2]);
    expect(stringThrough(b, [1, 0], 0)).toEqual([[1, 0], [-1, 1]]);
    expect(stringThrough(b, [0, 1], 0)).toEqual([[0, 1]]);
  });

  it('A3, B2 and G2: each step subtracts column i of C (computed with the oracle)', () => {
    expect(stringThrough(boardOf('A3'), [2, 1, 0], 0)).toEqual([[2, 1, 0], [0, 2, 0], [-2, 3, 0]]);
    expect(stringThrough(boardOf('B2'), [0, 2], 1)).toEqual([[0, 2], [1, 0], [2, -2]]);
    // G2: column 1 of C is (-3, 2), so the steps are (3, -2); row 1 would give (1, -2)
    expect(cartan('G2')).toEqual([[2, -3], [-1, 2]]);
    expect(stringThrough(boardOf('G2'), [0, 3], 1)).toEqual([[0, 3], [3, 1], [6, -1], [9, -3]]);
  });

  it('accepts a position outside any minuscule orbit and not dominant', () => {
    expect(stringThrough(boardOf('A2'), [3, -5], 0)).toEqual([[3, -5], [1, -4], [-1, -3], [-3, -2]]);
  });
});

describe('stringThrough property', () => {
  const caseArb = fc.constantFrom('A3', 'B3', 'G2', 'D4').chain((T) => {
    const n = boardOf(T).n;
    return fc.tuple(fc.constant(T), fc.array(fc.integer({ min: 0, max: 3 }), { minLength: n, maxLength: n }), fc.integer({ min: 0, max: n - 1 }));
  });

  it('the string has mu_i + 1 positions, ends at fire(mu, i), steps by column i, and firing node i reverses it', () => {
    let longest = 0;
    fc.assert(
      fc.property(caseArb, ([T, mu, i]) => {
        const b = boardOf(T);
        const input = [...mu];
        const st = stringThrough(b, mu, i);
        const C = cartanNumbers(b);
        expect(st.length).toBe(mu[i]! + 1);
        expect(st[0]).toEqual(mu);
        expect(st[0]).not.toBe(mu);
        expect(st[st.length - 1]).toEqual(fire(b, mu, i));
        for (let k = 1; k < st.length; k++) {
          for (let j = 0; j < b.n; j++) expect(st[k - 1]![j]! - st[k]![j]!).toBe(C[j]![i]);
        }
        for (let k = 0; k < st.length; k++) expect(fire(b, st[k]!, i)).toEqual(st[st.length - 1 - k]);
        expect(mu).toEqual(input);
        longest = Math.max(longest, st.length);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
    // not vacuous: strings of every length up to 4 occur
    expect(longest).toBe(4);
  });
});

describe('cap', () => {
  const sizes = (T: string): number[] => golden.types[T]!.fundamental_orbit_sizes;

  it('null when the orbit of omega_i has more than cap positions; exactly cap is built', () => {
    const e7 = boardOf('E7');
    const size = sizes('E7')[6]!;
    expect(minusculeMatrices(e7, 6, 50)).toBeNull();
    expect(minusculeMatrices(e7, 6, size - 1)).toBeNull();
    const exact = minusculeMatrices(e7, 6, size);
    expect(exact).not.toBeNull();
    intEq(exact!.basis.length, size);
    expect(minusculeMatrices(e7, 6, size + 1)!.basis.length).toBe(size);
    expect(minusculeMatrices(boardOf('A1'), 0, 2)).not.toBeNull();
    expect(minusculeMatrices(boardOf('A1'), 0, 1)).toBeNull();
  });

  it('the default cap is CAPS.repOrbit: E8 node 1 and E7 node 3 give null, E8 node 8 is built', () => {
    expect(CAPS.repOrbit).toBe(2000);
    expect(sizes('E8')[0]!).toBeGreaterThan(CAPS.repOrbit);
    expect(sizes('E7')[2]!).toBeGreaterThan(CAPS.repOrbit);
    expect(sizes('E8')[7]!).toBeLessThanOrEqual(CAPS.repOrbit);
    expect(minusculeMatrices(boardOf('E8'), 0)).toBeNull();
    expect(minusculeMatrices(boardOf('E7'), 2)).toBeNull();
    const e8 = minusculeMatrices(boardOf('E8'), 7);
    expect(e8).not.toBeNull();
    intEq(e8!.basis.length, sizes('E8')[7]);
    // a node that is not minuscule still gets its matrices: entries 2 occur in H, never in E or F
    expect(e8!.basis.some((a) => a.includes(2))).toBe(true);
    for (const list of [e8!.E, e8!.F]) for (const M of list) for (const v of M.values()) expect(v).toBe(1n);
  });
});

describe('the same results on a Board<bigint>', () => {
  it('E6 node 1 and D5 node 5 on a hand-built Big board equal the SafeInt results; strings too', () => {
    for (const [T, i] of [['E6', 0], ['D5', 4]] as [string, number][]) {
      const small = boardOf(T);
      const big: Board<bigint> = bigBoard(cartan(T));
      const a = minusculeMatrices(small, i)!;
      const b = minusculeMatrices(big, i)!;
      expect(b.basis).toEqual(a.basis);
      for (const x of b.basis.flat()) expect(typeof x).toBe('number');
      for (const key of ['E', 'F', 'H', 'moves'] as const) {
        for (let k = 0; k < small.n; k++) expect(spEq(b[key][k]!, a[key][k]!), `${T} ${key}[${k}]`).toBe(true);
      }
      expect(chevalleySerre(big, b.E, b.F, b.H).every((r) => r.holds)).toBe(true);
      const mu = [2, 0, 1, 0, 3, 0].slice(0, small.n);
      expect(stringThrough(big, mu, 0)).toEqual(stringThrough(small, mu, 0));
      expect(stringThrough(big, mu, 0).length).toBe(3);
    }
  });
});

describe('purity', () => {
  it('minusculeMatrices: the board is unchanged; two calls give equal results in new arrays and Maps', () => {
    const b = boardOf('B3');
    const before = cartanNumbers(b);
    const first = minusculeMatrices(b, 2)!;
    const second = minusculeMatrices(b, 2)!;
    expect(cartanNumbers(b)).toEqual(before);
    expect(second.basis).toEqual(first.basis);
    expect(second.basis).not.toBe(first.basis);
    expect(second.basis[0]).not.toBe(first.basis[0]);
    for (const key of ['E', 'F', 'H', 'moves'] as const) {
      for (let k = 0; k < b.n; k++) {
        expect(spEq(second[key][k]!, first[key][k]!)).toBe(true);
        expect(second[key][k]).not.toBe(first[key][k]);
      }
    }
    // changing a result does not change a later call (no hidden state)
    const reference = minusculeMatrices(b, 2)!;
    first.basis[0]![0] = 99;
    first.E[0]!.set('0,0', 5n);
    first.H[2]!.clear();
    const third = minusculeMatrices(b, 2)!;
    expect(third.basis).toEqual(reference.basis);
    expect(spEq(third.E[0]!, reference.E[0]!)).toBe(true);
    expect(spEq(third.H[2]!, reference.H[2]!)).toBe(true);
  });

  it('signedMoves and chevalleySerre leave the basis and every Map unchanged and return new Maps', () => {
    const b = boardOf('D4');
    const m = minusculeMatrices(b, 0)!;
    const basis = Object.freeze(m.basis.map((a) => Object.freeze([...a])));
    const snap = (list: SparseMatrix[]): [string, string][][] => list.map(dump);
    const before = [snap(m.E), snap(m.F), snap(m.H)];
    const s1 = signedMoves(basis, m.E, m.F);
    const s2 = signedMoves(basis, m.E, m.F);
    for (let k = 0; k < b.n; k++) {
      expect(spEq(s1[k]!, s2[k]!)).toBe(true);
      expect(s1[k]).not.toBe(s2[k]);
      expect(s1[k]).not.toBe(m.E[k]);
      expect(s1[k]).not.toBe(m.F[k]);
    }
    const r1 = chevalleySerre(b, m.E, m.F, m.H);
    const r2 = chevalleySerre(b, m.E, m.F, m.H);
    expect(r1.map((r) => [r.relation, r.i, r.j, r.holds])).toEqual(r2.map((r) => [r.relation, r.i, r.j, r.holds]));
    const inputs = new Set<SparseMatrix>([...m.E, ...m.F, ...m.H]);
    for (let k = 0; k < r1.length; k++) {
      expect(spEq(r1[k]!.left, r2[k]!.left)).toBe(true);
      expect(spEq(r1[k]!.right, r2[k]!.right)).toBe(true);
      expect(r1[k]!.left).not.toBe(r2[k]!.left);
      expect(r1[k]!.right).not.toBe(r2[k]!.right);
      expect(inputs.has(r1[k]!.left)).toBe(false);
      expect(inputs.has(r1[k]!.right)).toBe(false);
    }
    expect([snap(m.E), snap(m.F), snap(m.H)]).toEqual(before);
    expect(basis.map((a) => [...a])).toEqual(m.basis);
  });

  it('stringThrough leaves mu unchanged and returns new arrays', () => {
    const b = boardOf('G2');
    const mu = Object.freeze([1, 3]);
    const first = stringThrough(b, mu, 1);
    const second = stringThrough(b, mu, 1);
    expect(first).toEqual(second);
    expect(first[0]).not.toBe(mu);
    expect(first[0]).not.toBe(second[0]);
    expect(mu).toEqual([1, 3]);
    const zero = stringThrough(b, Object.freeze([0, 0]), 0);
    expect(zero).toEqual([[0, 0]]);
  });
});
