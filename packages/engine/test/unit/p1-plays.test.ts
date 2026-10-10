// play, raisingPlay, kostantPlay (P1-A1 instruction 5.7, 5.12): SPEC.md Appendix A.1, A.2 and A.4 as test
// vectors, the cap rule of 5.6, raising play, the one-way board and the triangle. No golden key.
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { applyWord, fire, mutate, toNumbers } from '../../src/moves';
import { positiveRoots } from '../../src/search';
import { kostantPlay, play, raisingPlay } from '../../src/play';
import { highestRoot, highestShortRoot } from '../../src/finite';
import { bigBoard, ones, tallyOf, unitVectors } from '../helpers/p1';
import { boardOf } from '../golden/_harness';

const TRIANGLE = [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]];
const ONE_WAY = [[2, 0], [-1, 2]];

describe('A.1: the games from (1, 1)', () => {
  // SPEC.md Appendix A.1, positions in code (node 1 is position 0)
  const games: [string, number[], number[], number[][]][] = [
    ['A2', [0, 1, 0], [1, 2, 1], [[-1, 2], [1, -2], [-1, -1]]],
    ['B2', [0, 1, 0, 1], [1, 3, 2, 1], [[-1, 3], [2, -3], [-2, 1], [-1, -1]]],
    ['G2', [0, 1, 0, 1, 0, 1], [1, 2, 5, 3, 4, 1], [[-1, 2], [5, -2], [-5, 3], [4, -3], [-4, 1], [-1, -1]]],
  ];
  for (const [T, word, fired, steps] of games) {
    it(`${T}: word, fired numbers, end and every position on the way`, () => {
      const b = boardOf(T);
      const r = play(b, [1, 1]);
      expect(r.status).toBe('ended');
      expect(r.word).toEqual(word);
      expect(r.fired).toEqual(fired);
      expect(r.moves).toBe(word.length);
      expect(r.position).toEqual([-1, -1]);
      for (let k = 1; k <= word.length; k++) {
        expect(applyWord(b, [1, 1], word.slice(0, k), 'firing')).toEqual(steps[k - 1]);
      }
    });
  }

  it('the positive root populations grouped by height', () => {
    expect(positiveRoots(boardOf('A2'))).toEqual([[0, 1], [1, 0], [1, 1]]);
    expect(positiveRoots(boardOf('B2'))).toEqual([[0, 1], [1, 0], [1, 1], [1, 2]]);
    expect(positiveRoots(boardOf('G2'))).toEqual([[0, 1], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]]);
  });

  it('translation checks, both ways', () => {
    const a2 = boardOf('A2');
    expect(toNumbers(a2, [1, 1])).toEqual([1, 1]);
    expect(mutate(a2, [1, 1], 0)).toEqual([0, 1]);
    expect(toNumbers(a2, [0, 1])).toEqual([-1, 2]);
    expect(fire(a2, [1, 1], 0)).toEqual([-1, 2]);
    expect(mutate(a2, [1, 1], 1)).toEqual([1, 0]);
    expect(toNumbers(a2, [1, 0])).toEqual([2, -1]);
    expect(fire(a2, [1, 1], 1)).toEqual([2, -1]);
    const b2 = boardOf('B2');
    expect(toNumbers(b2, [1, 2])).toEqual([0, 2]);
    expect(mutate(b2, [1, 2], 1)).toEqual([1, 0]);
    expect(toNumbers(b2, [1, 0])).toEqual([2, -2]);
    expect(fire(b2, [0, 2], 1)).toEqual([2, -2]);
    const g2 = boardOf('G2');
    expect(toNumbers(g2, [3, 2])).toEqual([0, 1]);
    expect(mutate(g2, [3, 2], 1)).toEqual([3, 1]);
    expect(toNumbers(g2, [3, 1])).toEqual([3, -1]);
    expect(fire(g2, [0, 1], 1)).toEqual([3, -1]);
    for (const [b, p] of [[a2, [1, 1]], [b2, [1, 2]], [g2, [3, 2]]] as const) {
      for (let i = 0; i < 2; i++) expect(toNumbers(b, mutate(b, p, i))).toEqual(fire(b, toNumbers(b, p), i));
    }
  });
});

describe('A.2: the generic game on A3', () => {
  it('six steps, word 1 2 1 3 2 1, tally {1: 3, 2: 2, 3: 1}', () => {
    const b = boardOf('A3');
    const r = play(b, [1, 1, 1]);
    expect(r.status).toBe('ended');
    expect(r.word).toEqual([0, 1, 0, 2, 1, 0]);
    expect(r.fired).toEqual([1, 2, 1, 3, 2, 1]);
    const steps = [[-1, 2, 1], [1, -2, 3], [-1, -1, 3], [-1, 2, -3], [1, -2, -1], [-1, -1, -1]];
    for (let k = 1; k <= 6; k++) expect(applyWord(b, [1, 1, 1], r.word.slice(0, k), 'firing')).toEqual(steps[k - 1]);
    expect(r.position).toEqual([-1, -1, -1]);
    expect(tallyOf(r.fired)).toEqual({ '1': 3, '2': 2, '3': 1 });
  });
});

describe("A.4: Kostant's game under the lowest-position rule", () => {
  it('A3 from city 1', () => {
    const b = boardOf('A3');
    const k = kostantPlay(b, 0);
    expect(k.status).toBe('ended');
    expect(k.word).toEqual([1, 2]);
    expect(k.moves).toBe(2);
    expect(k.position).toEqual([1, 1, 1]);
    expect(toNumbers(b, k.position)).toEqual([1, 0, 1]);
    expect(applyWord(b, [1, 0, 0], [1], 'mutation')).toEqual([1, 1, 0]);
    expect(k.fired).toEqual([-1, -1]);
  });

  it('D4 from city 1', () => {
    const b = boardOf('D4');
    const k = kostantPlay(b, 0);
    expect(k.word).toEqual([1, 2, 3, 1]);
    expect(k.moves).toBe(4);
    expect(k.position).toEqual([1, 2, 1, 1]);
    expect(toNumbers(b, k.position)).toEqual([0, 1, 0, 0]);
    const met = [[1, 1, 0, 0], [1, 1, 1, 0], [1, 1, 1, 1], [1, 2, 1, 1]];
    for (let s = 1; s <= 4; s++) expect(applyWord(b, [1, 0, 0, 0], k.word.slice(0, s), 'mutation')).toEqual(met[s - 1]);
  });

  it('B3 from the long city 1: 3 moves, final numbers (0, 1, 0), the highest root', () => {
    const b = boardOf('B3');
    const k = kostantPlay(b, 0);
    expect(k.word).toEqual([1, 2, 1]);
    expect(k.moves).toBe(3);
    expect(k.position).toEqual([1, 2, 2]);
    expect(toNumbers(b, k.position)).toEqual([0, 1, 0]);
    const met = [[1, 1, 0], [1, 1, 2], [1, 2, 2]];
    for (let s = 1; s <= 3; s++) expect(applyWord(b, [1, 0, 0], k.word.slice(0, s), 'mutation')).toEqual(met[s - 1]);
    expect(k.position).toEqual(highestRoot(b));
    expect(k.fired).toEqual([-1, -2, -1]);
  });

  it('B3 from the short city 3: 2 moves, final numbers (1, 0, 0), the highest short root', () => {
    const b = boardOf('B3');
    const k = kostantPlay(b, 2);
    expect(k.word).toEqual([1, 0]);
    expect(k.moves).toBe(2);
    expect(k.position).toEqual([1, 1, 1]);
    expect(toNumbers(b, k.position)).toEqual([1, 0, 0]);
    expect(applyWord(b, [0, 0, 1], [1], 'mutation')).toEqual([0, 1, 1]);
    expect(k.position).toEqual(highestShortRoot(b));
  });

  it('where the game ends on the boards with two root lengths', () => {
    // SPEC.md A.4, the end columns; long and short cities from 2.8
    const table: [string, number[], number[], number[], number[]][] = [
      ['B2', [0], [1], [1, 2], [1, 1]],
      ['B3', [0, 1], [2], [1, 2, 2], [1, 1, 1]],
      ['C3', [2], [0, 1], [2, 2, 1], [1, 2, 1]],
      ['F4', [0, 1], [2, 3], [2, 3, 4, 2], [1, 2, 3, 2]],
      ['G2', [1], [0], [3, 2], [2, 1]],
    ];
    for (const [T, long, short, longEnd, shortEnd] of table) {
      const b = boardOf(T);
      for (const i of long) {
        const k = kostantPlay(b, i);
        expect(k.status).toBe('ended');
        expect(k.position).toEqual(longEnd);
        expect(k.position).toEqual(highestRoot(b));
      }
      for (const i of short) {
        const k = kostantPlay(b, i);
        expect(k.status).toBe('ended');
        expect(k.position).toEqual(shortEnd);
        expect(k.position).toEqual(highestShortRoot(b));
      }
    }
  });

  it('A1: 0 moves, position (1)', () => {
    const k = kostantPlay(boardOf('A1'), 0);
    expect(k.status).toBe('ended');
    expect(k.moves).toBe(0);
    expect(k.position).toEqual([1]);
    expect(k.word).toEqual([]);
  });

  it('throws RangeError on a bad city', () => {
    expect(() => kostantPlay(boardOf('A2'), 2)).toThrow(RangeError);
    expect(() => kostantPlay(boardOf('A2'), -1)).toThrow(RangeError);
  });
});

describe('caps and statuses', () => {
  it('A2 from (1, 1) with a cap of 2 is cap at (1, -2); with a cap of 3 it ends', () => {
    const b = boardOf('A2');
    const r2 = play(b, [1, 1], undefined, 2);
    expect(r2.status).toBe('cap');
    expect(r2.moves).toBe(2);
    expect(r2.position).toEqual([1, -2]);
    expect(r2.word).toEqual([0, 1]);
    const r3 = play(b, [1, 1], undefined, 3);
    expect(r3.status).toBe('ended');
    expect(r3.moves).toBe(3);
    const r0 = play(b, [1, 1], undefined, 0);
    expect(r0.status).toBe('cap');
    expect(r0.moves).toBe(0);
    expect(r0.position).toEqual([1, 1]);
    expect(play(b, [-1, 0], undefined, 0).status).toBe('ended');
  });

  it('the triangle from (1, 1, 1) never ends: cap with exactly 20000 moves', () => {
    const b = bigBoard(TRIANGLE);
    const r = play(b, [1n, 1n, 1n]);
    expect(r.status).toBe('cap');
    expect(r.moves).toBe(CAPS.playMoves);
    expect(r.word.length).toBe(20000);
    expect(r.fired.length).toBe(20000);
    expect(r.position.some((x) => x > 0n)).toBe(true);
  });

  it("Kostant's game on every city of the triangle: cap with 300 moves", () => {
    const b = bigBoard(TRIANGLE);
    for (let i = 0; i < 3; i++) {
      const k = kostantPlay(b, i, undefined, 300);
      expect(k.status).toBe('cap');
      expect(k.moves).toBe(300);
      expect(k.fired.every((x) => x < 0n)).toBe(true);
    }
  });

  it('play on the one-way board works as defined', () => {
    const b = bigBoard(ONE_WAY);
    const r = play(b, [1n, 1n]);
    expect(r.status).toBe('ended');
    expect(r.moves).toBe(2);
    expect(r.word).toEqual([0, 1]);
    expect(r.position).toEqual([-1n, -2n]);
    expect(r.fired).toEqual([1n, 2n]);
  });

  it('throws RangeError on a bad cap, a vector of the wrong length and a choose that returns a node not allowed', () => {
    const b = boardOf('A2');
    expect(() => play(b, [1, 1], undefined, -1)).toThrow(RangeError);
    expect(() => play(b, [1, 1], undefined, 1.5)).toThrow(RangeError);
    expect(() => play(b, [1])).toThrow(RangeError);
    expect(() => play(b, [1, 1], () => 1)).toThrow(RangeError); // (1, 1): both allowed at first; then (-1, 2) allows only 1 ... then (1, -2) allows only 0
    expect(() => raisingPlay(b, [-1, 0], () => 1)).toThrow(RangeError);
    expect(() => raisingPlay(b, [1, 1], undefined, 2.5)).toThrow(RangeError);
  });

  it('choose receives the allowed positions in increasing order and the current vector', () => {
    const b = boardOf('A3');
    const seen: [number[], number[]][] = [];
    const r = play(b, [1, 1, 1], (allowed, v) => {
      seen.push([[...allowed], [...v]]);
      return allowed[allowed.length - 1]!;
    });
    expect(r.status).toBe('ended');
    expect(r.moves).toBe(6);
    expect(seen[0]).toEqual([[0, 1, 2], [1, 1, 1]]);
    expect(r.word[0]).toBe(2);
    for (const [allowed] of seen) for (let k = 1; k < allowed.length; k++) expect(allowed[k]!).toBeGreaterThan(allowed[k - 1]!);
  });
});

describe('raisingPlay', () => {
  it('A2 from (-1, 0) ends at (1, 1) after 2 moves, word [0, 1], fired [-2, -1]; from (0, 0) at once', () => {
    const b = boardOf('A2');
    const r = raisingPlay(b, [-1, 0]);
    expect(r.status).toBe('ended');
    expect(r.moves).toBe(2);
    expect(r.word).toEqual([0, 1]);
    expect(r.fired).toEqual([-2, -1]);
    expect(r.position).toEqual([1, 1]);
    const z = raisingPlay(b, [0, 0]);
    expect(z.status).toBe('ended');
    expect(z.moves).toBe(0);
    expect(z.position).toEqual([0, 0]);
  });

  it('recomputes the raising nodes after every move and rises by -fired', () => {
    const b = boardOf('D4');
    const r = raisingPlay(b, [1, 0, 0, 0]);
    let p = [1, 0, 0, 0];
    for (let k = 0; k < r.word.length; k++) {
      const i = r.word[k]!;
      const a = toNumbers(b, p);
      expect(a[i]).toBe(r.fired[k]);
      expect(a[i]!).toBeLessThan(0);
      // the lowest raising position of the current population, not the next in an earlier list
      expect(i).toBe(a.findIndex((x) => x < 0));
      const q = mutate(b, p, i);
      expect(q[i]! - p[i]!).toBe(-r.fired[k]!);
      p = q;
    }
    expect(p).toEqual(r.position);
  });

  it('equals kostantPlay from a unit vector', () => {
    const b = boardOf('E6');
    for (let i = 0; i < b.n; i++) {
      expect(raisingPlay(b, unitVectors(b)[i]!)).toEqual(kostantPlay(b, i));
    }
    expect(play(b, ones(b)).status).toBe('ended');
  });
});
