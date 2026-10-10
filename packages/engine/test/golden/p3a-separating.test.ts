// Separating mirrors (SPEC.md 2.7 F5, 5.4 separatingRoots; P3-A1 instruction 5.10). No covers(): no
// golden key stores separating roots (plan); the file checks F5 as verify.py lines 268 to 279 did, on
// every type with |W| <= 2000: for every position reached by legal play from rho, the number of
// separating roots equals its depth and the length of wordTo; and the B2 hand cases, where the pairing
// with the coroot (not the root) is what tells the two apart.
import { describe, expect, it } from 'vitest';
import { applyWord, fire } from '../../src/moves';
import { orbitGraph, positiveRoots, wordTo } from '../../src/search';
import { coroot } from '../../src/form';
import { separatingRoots, weylOrder } from '../../src/weyl';
import { ones } from '../helpers/p1';
import { TYPE_NAMES, boardOf, golden } from './_harness';

const SMALL = TYPE_NAMES.filter((T) => golden.types[T]!.weyl_order <= 2000);

describe('depth equals separating mirrors', () => {
  it('the small types are the 15 with |W| <= 2000', () => {
    expect(SMALL).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'B2', 'B3', 'B4', 'C2', 'C3', 'C4', 'D4', 'D5', 'F4', 'G2']);
  });
  for (const T of SMALL) {
    it(`${T}: every position reached from rho`, { timeout: 60000 }, () => {
      const b = boardOf(T);
      const W = weylOrder(b);
      const g = orbitGraph(b, [ones(b)], 'firing', W + 1, undefined, true);
      expect(g.truncated).toBe(false);
      expect(g.items.length).toBe(W);
      const pos = positiveRoots(b);
      const indexOf = new Map<string, number>();
      for (let k = 0; k < g.items.length; k++) indexOf.set(g.items[k]!.join(','), k);
      for (let k = 0; k < g.items.length; k++) {
        const v = g.items[k]!;
        const sep = separatingRoots(b, v);
        expect(sep.length).toBe(g.depth[k]);
        const word = wordTo(g, k);
        expect(word.length).toBe(g.depth[k]);
        expect(applyWord(b, ones(b), word, 'firing')).toEqual(v);
        // the separating roots are positive roots, in the order of positiveRoots
        let last = -1;
        for (const r of sep) {
          const idx = pos.findIndex((p) => p.every((x, j) => x === r[j]));
          expect(idx).toBeGreaterThan(last);
          last = idx;
        }
        // a node is positive exactly when firing it lengthens the element (F5; verify.py lines 272 to 274)
        for (let i = 0; i < b.n; i++) {
          const w = fire(b, v, i);
          const kw = indexOf.get(w.join(','));
          expect(kw).toBeDefined();
          expect(g.depth[kw!]).toBe(g.depth[k]! + (v[i]! > 0 ? 1 : -1));
        }
      }
      // rho itself has none; -rho has all N
      expect(separatingRoots(b, ones(b))).toEqual([]);
      expect(separatingRoots(b, ones(b).map((x) => -x)).length).toBe(pos.length);
    });
  }
});

describe('B2 coroot pairing', () => {
  it('the positive roots of B2 and their coroots', () => {
    const b = boardOf('B2');
    expect(b.cartan).toEqual([[2, -1], [-2, 2]]);
    const pos = positiveRoots(b);
    expect(pos).toEqual([[0, 1], [1, 0], [1, 1], [1, 2]]);
    expect(pos.map((r) => coroot(b, r))).toEqual([[0, 1], [1, 0], [2, 1], [1, 1]]);
  });
  it('separatingRoots(B2, [2, -3]) is [[0, 1], [1, 2]]: pairing with the roots themselves would also keep [1, 1]', () => {
    const b = boardOf('B2');
    const a = Object.freeze([2, -3]);
    expect(separatingRoots(b, a)).toEqual([[0, 1], [1, 2]]);
    // the wrong pairing, with beta instead of beta^vee, as a guard against the trap
    const wrong = positiveRoots(b).filter((r) => a[0]! * r[0]! + a[1]! * r[1]! < 0);
    expect(wrong).toEqual([[0, 1], [1, 1], [1, 2]]);
    expect(a).toEqual([2, -3]);
  });
  it('more hand values', () => {
    const b = boardOf('B2');
    expect(separatingRoots(b, [1, 1])).toEqual([]);
    expect(separatingRoots(b, [-1, 3])).toEqual([[1, 0]]);
    expect(separatingRoots(b, [2, -1])).toEqual([[0, 1]]);
    expect(separatingRoots(b, [-1, -1])).toEqual([[0, 1], [1, 0], [1, 1], [1, 2]]);
  });
  it('the result shares no array with the positive roots of another call', () => {
    const b = boardOf('B2');
    const first = separatingRoots(b, [-1, -1]);
    const second = separatingRoots(b, [-1, -1]);
    for (let k = 0; k < first.length; k++) expect(first[k]).not.toBe(second[k]);
  });
});
