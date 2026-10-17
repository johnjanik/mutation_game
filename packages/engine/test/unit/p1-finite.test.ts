// finite.ts (P1-A1 instruction 5.8, 5.12): the examples of 5.8, the -w0 rule of SPEC.md 2.8, the count of
// minuscule nodes (F11), the NotFiniteType fallback on the triangle, and the facts of 2.7 that no golden
// key holds: F5, F6, F10 and the first and third conditions of F11, as verify.py checks them. No golden key.
import { describe, expect, it } from 'vitest';
import { cartanNumbers, subBoard, transposeBoard } from '../../src/board';
import { CAPS } from '../../src/caps';
import { NotFiniteType } from '../../src/errors';
import { applyWord } from '../../src/moves';
import { orbit, orbitGraph, positiveRoots } from '../../src/search';
import { play } from '../../src/play';
import { coxeterNumber, highestRoot, highestShortRoot, longestWord, minusW0, minusculeNodes } from '../../src/finite';
import { bigBoard, ones, unitVectors } from '../helpers/p1';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

const TRIANGLE = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];

// The columns |W| and det C of the table of SPEC.md 2.8 for its 19 types (typed from the table).
const TABLE_2_8: [string, number, number][] = [
  ['A1', 2, 2], ['A2', 6, 3], ['A3', 24, 4], ['A4', 120, 5], ['A5', 720, 6],
  ['B2', 8, 2], ['B3', 48, 2], ['B4', 384, 2], ['C2', 8, 2], ['C3', 48, 2], ['C4', 384, 2],
  ['D4', 192, 4], ['D5', 1920, 4], ['D6', 23040, 4], ['E6', 51840, 3], ['E7', 2903040, 2],
  ['E8', 696729600, 1], ['F4', 1152, 1], ['G2', 12, 1],
];

const sorted = (v: readonly number[]): number[] => [...v].sort((a, b) => a - b);
const total = (v: readonly number[]): number => v.reduce((s, x) => s + x, 0);

describe('the examples of 5.8', () => {
  it('longestWord on sub-boards keeps the chosen positions', () => {
    expect(longestWord(boardOf('A3'), [2, 0])).toEqual([0, 2]);
    expect(longestWord(boardOf('B3'), [1, 2])).toEqual([1, 2, 1, 2]);
    expect(longestWord(boardOf('B3'), [])).toEqual([]);
    expect(longestWord(boardOf('E8'), [7])).toEqual([7]);
    for (const T of ['A1', 'B3', 'E6']) {
      const b = boardOf(T);
      expect(longestWord(b)).toEqual(play(b, ones(b)).word);
      expect(longestWord(b, b.labels.map((_, i) => i))).toEqual(play(b, ones(b)).word);
    }
    // a sub-board whose labels are not 1..n: positions, never labels, come back
    const sub = subBoard(boardOf('A4'), [1, 2, 3]);
    expect(longestWord(sub, [2, 1])).toEqual([1, 2, 1]);
    expect(() => longestWord(boardOf('A3'), [1, 1])).toThrow(RangeError);
    expect(() => longestWord(boardOf('A3'), [3])).toThrow(RangeError);
  });

  it('minusW0 in positions: E6, A3, D5', () => {
    expect(minusW0(boardOf('E6'))).toEqual([5, 1, 4, 3, 2, 0]);
    expect(minusW0(boardOf('A3'))).toEqual([2, 1, 0]);
    expect(minusW0(boardOf('D5'))).toEqual([0, 1, 2, 4, 3]);
  });

  it('minusculeNodes in positions: B3, C3, E6, E8, F4, G2', () => {
    expect(minusculeNodes(boardOf('B3'))).toEqual([2]);
    expect(minusculeNodes(boardOf('C3'))).toEqual([0]);
    expect(minusculeNodes(boardOf('E6'))).toEqual([0, 5]);
    expect(minusculeNodes(boardOf('E8'))).toEqual([]);
    expect(minusculeNodes(boardOf('F4'))).toEqual([]);
    expect(minusculeNodes(boardOf('G2'))).toEqual([]);
  });

  it('F11 on B3: the highest root of the reversed board is (2, 2, 1), not (1, 2, 1)', () => {
    const b = boardOf('B3');
    expect(highestRoot(transposeBoard(b))).toEqual([2, 2, 1]);
    expect(highestRoot(b)).toEqual([1, 2, 2]);
    expect(highestShortRoot(b)).toEqual([1, 1, 1]);
    expect(coxeterNumber(b)).toBe(6);
    expect(coxeterNumber(boardOf('A1'))).toBe(2);
  });

  it('highestShortRoot is null exactly on the simply laced types', () => {
    for (const T of TYPE_NAMES) {
      const simplyLaced = /^[ADE]/.test(T);
      expect(highestShortRoot(boardOf(T)) === null).toBe(simplyLaced);
    }
  });

  it('-w0 is the reversal on A_n, the exchange of the last two nodes on D_n for odd n, the flip on E6, the identity otherwise', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const n = b.n;
      const id = b.labels.map((_, i) => i);
      let expected = id;
      if (T.startsWith('A')) expected = id.map((i) => n - 1 - i);
      else if (T.startsWith('D') && n % 2 === 1) expected = [...id.slice(0, n - 2), n - 1, n - 2];
      else if (T === 'E6') expected = [5, 1, 4, 3, 2, 0];
      expect(minusW0(b)).toEqual(expected);
    }
  });

  it('the number of minuscule nodes is det C - 1 (F11) on the 19 types of the table of 2.8', () => {
    for (const [T, , det] of TABLE_2_8) expect(minusculeNodes(boardOf(T)).length).toBe(det - 1);
  });

  it('throws NotFiniteType from each of the six functions on the triangle', { timeout: 60000 }, () => {
    const t = bigBoard(TRIANGLE);
    expect(() => highestRoot(t)).toThrow(NotFiniteType);
    expect(() => highestShortRoot(t)).toThrow(NotFiniteType);
    expect(() => coxeterNumber(t)).toThrow(NotFiniteType);
    expect(() => longestWord(t)).toThrow(NotFiniteType);
    expect(() => minusW0(t)).toThrow(NotFiniteType);
    expect(() => minusculeNodes(t)).toThrow(NotFiniteType);
  });

  it('works with Big arithmetic on a named matrix', () => {
    const b = bigBoard(cartanNumbers(boardOf('G2')));
    expect(highestRoot(b)).toEqual([3n, 2n]);
    expect(highestShortRoot(b)).toEqual([2n, 1n]);
    expect(coxeterNumber(b)).toBe(6);
    expect(longestWord(b)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(minusW0(b)).toEqual([0, 1]);
    expect(minusculeNodes(b)).toEqual([]);
  });
});

describe('facts of 2.7 that no golden key holds', () => {
  it('F5 reachable positions from rho', { timeout: 60000 }, () => {
    for (const [T, W] of TABLE_2_8) {
      if (W > CAPS.countGamesGroup) continue;
      const b = boardOf(T);
      const g = orbitGraph(b, [ones(b)], 'firing', CAPS.workerPositions, undefined, true);
      expect(g.truncated).toBe(false);
      expect(g.items.length).toBe(W);
      expect(g.depthReached).toBe(positiveRoots(b).length);
    }
  });

  it('F6 fired numbers are coroot heights', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const fired = sorted(play(b, ones(b)).fired);
      const heights = sorted(positiveRoots(transposeBoard(b)).map(total));
      expect(fired).toEqual(heights);
    }
    expect(play(boardOf('B2'), [1, 1]).fired).toEqual([1, 3, 2, 1]);
    expect(sorted(play(boardOf('B2'), [1, 1]).fired)).toEqual([1, 1, 2, 3]);
  });

  it('F10 games from fundamental weights', () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const N = positiveRoots(b).length;
      const word = longestWord(b);
      const coroots = positiveRoots(transposeBoard(b));
      for (let i = 0; i < b.n; i++) {
        const omega = unitVectors(b)[i]!;
        const r = play(b, omega);
        expect(r.status).toBe('ended');
        const J = b.labels.map((_, j) => j).filter((j) => j !== i);
        const NJ = J.length === 0 ? 0 : positiveRoots(subBoard(b, J)).length;
        expect(r.moves).toBe(N - NJ);
        expect(r.position).toEqual(applyWord(b, omega, word, 'firing'));
        expect(sorted(r.fired)).toEqual(sorted(coroots.map((c) => c[i]!).filter((x) => x !== 0)));
      }
    }
  });

  it('F11 minuscule conditions', { timeout: 60000 }, () => {
    for (const T of TYPE_NAMES) {
      const b = boardOf(T);
      const minuscule = minusculeNodes(b);
      for (let i = 0; i < b.n; i++) {
        const omega = unitVectors(b)[i]!;
        const isMinuscule = minuscule.includes(i);
        // third condition: every number fired in the game from omega_i is 1
        expect(play(b, omega).fired.every((x) => x === 1)).toBe(isMinuscule);
        // first condition, for orbits of at most 20000 positions
        const o = orbit(b, [omega], 'firing', 20000);
        if (o.truncated) continue;
        expect(o.items.every((v) => v.every((x) => x >= -1 && x <= 1))).toBe(isMinuscule);
      }
    }
  });
});
