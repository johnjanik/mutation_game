// The phase-5 functions off the finite boards, with bad arguments, and at the label boundary (SPEC.md 5.6
// second table, last row: "the Wythoff, Satake, representation and geometry functions | throw
// NeedsTwoWayRoads | throw NotFiniteType"; E-7, E-10, E-11; P5-A1 instruction 5.3 to 5.6). No covers(): no
// golden key stores these cases; the golden key of phase 5, minuscule_representations, is covered in
// p5-minuscule.test.ts. signedMoves takes no board and so has no guard (plan reading of 5.6).
import { describe, expect, it } from 'vitest';
import type { AnyBoard } from '../../src/board';
import { boardFromName, fromAdjacency, subBoard } from '../../src/board';
import { EngineError, EngineOverflow, NeedsTwoWayRoads, NotFiniteType } from '../../src/errors';
import type { SparseMatrix } from '../../src/rep';
import { chevalleySerre, minusculeMatrices, signedMoves, spEq, stringThrough } from '../../src/rep';
import { bigBoard } from '../helpers/p1';
import { boardOf, golden } from './_harness';

function caught(f: () => unknown): unknown {
  try {
    f();
  } catch (e) {
    return e;
  }
  return null;
}

/** n empty matrices. */
function empties(n: number): SparseMatrix[] {
  const out: SparseMatrix[] = [];
  for (let k = 0; k < n; k++) out.push(new Map());
  return out;
}

/** Each guarded phase-5 function, called with arguments of the right shape for the board. */
const GUARDED: [string, (b: AnyBoard) => unknown][] = [
  ['minusculeMatrices', (b) => minusculeMatrices(b, 0)],
  ['chevalleySerre', (b) => chevalleySerre(b, empties(b.n), empties(b.n), empties(b.n))],
  ['stringThrough', (b) => stringThrough(b, b.labels.map((_, k) => (k === 0 ? 1 : 0)), 0)],
];

describe('one-way board', () => {
  const oneWay = (): AnyBoard => fromAdjacency([[0, 1], [0, 0]]);
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
  for (const name of ['A2~', 'C2~', 'G2~']) {
    for (const [fn, f] of GUARDED) {
      it(`${fn} on ${name} throws NotFiniteType, an EngineError`, () => {
        const e = caught(() => f(boardFromName(name)));
        expect(e).toBeInstanceOf(NotFiniteType);
        expect(e).toBeInstanceOf(EngineError);
      });
    }
  }
  it('an indefinite board throws NotFiniteType too', () => {
    const hyperbolic = bigBoard([[2, -3], [-3, 2]]);
    for (const [, f] of GUARDED) expect(caught(() => f(hyperbolic))).toBeInstanceOf(NotFiniteType);
  });
  it('signedMoves works on the matrices of A2 without a board', () => {
    const m = minusculeMatrices(boardOf('A2'), 0)!;
    const s = signedMoves(m.basis, m.E, m.F);
    expect(s.length).toBe(2);
    expect(spEq(s[0]!, new Map([['0,2', 1n], ['2,0', -1n], ['1,1', 1n]]))).toBe(true);
  });
});

describe('argument errors', () => {
  const a2 = boardOf('A2');
  it('minusculeMatrices: a node position outside 0..n-1, or a cap that is not a positive integer', () => {
    for (const i of [-1, 2, 0.5, Number.NaN]) expect(() => minusculeMatrices(a2, i), String(i)).toThrow(RangeError);
    for (const cap of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => minusculeMatrices(a2, 0, cap), String(cap)).toThrow(RangeError);
    }
    // a cap equal to the orbit of omega_1 (read from the golden file) is a valid cap
    expect(minusculeMatrices(a2, 0, golden.types.A2!.fundamental_orbit_sizes[0]!)).not.toBeNull();
  });

  it('signedMoves: E and F of different lengths, or a basis vector shorter than E', () => {
    const m = minusculeMatrices(a2, 0)!;
    expect(() => signedMoves(m.basis, m.E, m.F.slice(0, 1))).toThrow(RangeError);
    expect(() => signedMoves(m.basis.map((a) => a.slice(0, 1)), m.E, m.F)).toThrow(RangeError);
    expect(signedMoves(m.basis, m.E.slice(0, 1), m.F.slice(0, 1)).length).toBe(1);
  });

  it('chevalleySerre: E, F or H without one matrix per node', () => {
    expect(() => chevalleySerre(a2, empties(1), empties(2), empties(2))).toThrow(RangeError);
    expect(() => chevalleySerre(a2, empties(2), empties(3), empties(2))).toThrow(RangeError);
    expect(() => chevalleySerre(a2, empties(2), empties(2), empties(1))).toThrow(RangeError);
    expect(chevalleySerre(a2, empties(2), empties(2), empties(2)).length).toBe(20);
  });

  it('signedMoves and chevalleySerre: a matrix key that spKey would not write (the check of the sparse operations)', () => {
    const m = minusculeMatrices(a2, 0)!;
    const badE = [new Map([['0, 2', 1n]]), m.E[1]!];
    expect(() => signedMoves(m.basis, badE, m.F)).toThrow(RangeError);
    expect(() => chevalleySerre(a2, badE, m.F, m.H)).toThrow(RangeError);
    expect(() => chevalleySerre(a2, m.E, m.F, [m.H[0]!, new Map([['01,1', -1n]])])).toThrow(RangeError);
  });

  it('stringThrough: wrong length, an entry that is not a safe integer, a position out of range, mu_i < 0', () => {
    expect(() => stringThrough(a2, [1], 0)).toThrow(RangeError);
    expect(() => stringThrough(a2, [1, 0, 0], 0)).toThrow(RangeError);
    for (const x of [1.5, Number.NaN, 2 ** 53, Number.POSITIVE_INFINITY]) expect(() => stringThrough(a2, [0, x], 0), String(x)).toThrow(RangeError);
    for (const i of [-1, 2, 0.5]) expect(() => stringThrough(a2, [1, 0], i), String(i)).toThrow(RangeError);
    const e = caught(() => stringThrough(a2, [-1, 0], 0));
    expect(e).toBeInstanceOf(RangeError);
    expect(String((e as Error).message)).toContain('-1');
  });

  it('argument errors come before the guards (P2-A1 order): RangeError on a one-way board', () => {
    const oneWay = fromAdjacency([[0, 1], [0, 0]]);
    expect(() => minusculeMatrices(oneWay, 5)).toThrow(RangeError);
    expect(() => chevalleySerre(oneWay, empties(1), empties(2), empties(2))).toThrow(RangeError);
    expect(() => stringThrough(oneWay, [-1, 0], 0)).toThrow(RangeError);
  });

  it('a string past 2^53 throws EngineOverflow, not a wrong number', () => {
    // column 0 of A2 is (2, -1): the second entry passes 2^53 at the third position of the string
    const big = Number.MAX_SAFE_INTEGER - 1;
    expect(stringThrough(boardOf('A2'), [1, big], 0)).toEqual([[1, big], [-1, big + 1]]);
    expect(caught(() => stringThrough(boardOf('A2'), [3, big], 0))).toBeInstanceOf(EngineOverflow);
  });
});

describe('positions, not labels (E-7)', () => {
  it('on a sub-board labelled 2 and 3, records and bases use positions 0 and 1', () => {
    const sub = subBoard(boardOf('A3'), [1, 2]);
    expect([...sub.labels]).toEqual([2, 3]);
    const m = minusculeMatrices(sub, 0)!;
    expect(m.basis).toEqual(minusculeMatrices(boardOf('A2'), 0)!.basis);
    const records = chevalleySerre(sub, m.E, m.F, m.H);
    expect(new Set(records.map((r) => r.i))).toEqual(new Set([0, 1]));
    expect(new Set(records.map((r) => r.j))).toEqual(new Set([0, 1]));
    expect(records.every((r) => r.holds)).toBe(true);
    expect(stringThrough(sub, [1, 0], 0)).toEqual([[1, 0], [-1, 1]]);
  });
});
