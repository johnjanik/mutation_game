// choleskyBasis (plan; SPEC.md 2.14 the triangular basis, 5.4 Geometry, 5.6 the geometry functions,
// E-1; verify.py lines 1225 to 1233; P3-A2 instruction 5.13): U^T U = B within 1e-9 on all 32 types with
// B from gram as floats, entries below the diagonal exactly 0, a positive diagonal, the angle between
// alpha_1 and alpha_2, and the two errors. Identities only, never coordinates against typed constants.
// No golden key.
import { describe, expect, it } from 'vitest';
import { boardFromName, fromAdjacency } from '../../src/board';
import { gram } from '../../src/classify';
import { NeedsTwoWayRoads, NotFiniteType } from '../../src/errors';
import { choleskyBasis } from '../../src/geometry';
import { TYPE_NAMES, boardOf } from './_harness';

describe('choleskyBasis', () => {
  it('U^T U = B on every type', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const U = choleskyBasis(b);
      const B = gram(b);
      expect(B).not.toBeNull();
      const n = b.n;
      expect(U.length).toBe(n);
      for (let i = 0; i < n; i++) {
        expect(U[i]!.length).toBe(n);
        expect(U[i]![i]!).toBeGreaterThan(0);
        for (let j = 0; j < i; j++) expect(U[i]![j]).toBe(0);
        for (let j = 0; j < n; j++) {
          let s = 0;
          for (let k = 0; k < n; k++) s += U[k]![i]! * U[k]![j]!;
          const expected = Number(B![i]![j]!.num) / Number(B![i]![j]!.den);
          expect(Math.abs(s - expected)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('angle between alpha_1 and alpha_2', () => {
    const cases: [string, number][] = [
      ['A2', 3], ['B2', 4], ['C2', 4], ['G2', 6], ['A5', 3], ['C3', 3], ['F4', 3], ['D5', 3], ['E7', 2],
    ];
    for (const [T, m] of cases) {
      const U = choleskyBasis(boardOf(T));
      const angle = (Math.atan2(U[1]![1]!, U[0]![1]!) * 180) / Math.PI;
      expect(Math.abs(angle - (180 - 180 / m))).toBeLessThan(1e-9);
    }
  });

  it('alpha_1 lies along the first axis with length sqrt(2 d_1)', () => {
    for (const T of ['A3', 'B3', 'C3', 'G2', 'F4']) {
      const b = boardOf(T);
      const U = choleskyBasis(b);
      const d1 = gram(b)![0]![0]!;
      expect(Math.abs(U[0]![0]! * U[0]![0]! - Number(d1.num) / Number(d1.den))).toBeLessThan(1e-9);
      for (let k = 1; k < b.n; k++) expect(U[k]![0]).toBe(0);
    }
  });

  it('errors', () => {
    const oneWay = fromAdjacency([[0, 1], [0, 0]]);
    expect(oneWay.kind).toBe('one-way');
    expect(() => choleskyBasis(oneWay)).toThrow(NeedsTwoWayRoads);
    expect(() => choleskyBasis(boardFromName('A2~'))).toThrow(NotFiniteType);
    expect(() => choleskyBasis(boardFromName('pentagon'))).toThrow(NotFiniteType);
  });

  it('is pure: two calls agree and the board is untouched', () => {
    const b = boardOf('E8');
    const first = choleskyBasis(b);
    const second = choleskyBasis(b);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(Object.isFrozen(b.cartan)).toBe(true);
  });
});
