// The behaviour of SPEC.md 5.6 for the phase-3B functions (plan; P3-A2 instruction 5.8): the functions
// of words (heap, heapKey, commutationClassSize, symbolicPlay, allCompleteGames) work on a one-way board
// and on an affine board; choleskyBasis throws there (p3b-cholesky.test.ts); no argument is mutated
// (E-5). "Joined" is a road either way: on the one-way board [[2, 0], [-1, 2]] the nodes are joined, so
// heap([0, 1]) is [1, 2]. No golden key.
import { describe, expect, it } from 'vitest';
import { boardFromName } from '../../src/board';
import { allCompleteGames, commutationClassSize, heap, heapKey, symbolicPlay } from '../../src/heaps';
import { boardOf } from './_harness';
import { ONE_WAY, boardFromCartan } from '../helpers/p2';

describe('5.6: functions of words off the finite boards', () => {
  it('functions of words on a one-way board', () => {
    const b = boardFromCartan(ONE_WAY);
    expect(b.kind).toBe('one-way');
    expect(heap(b, [0, 1])).toEqual([1, 2]);
    expect(heap(b, [1, 0])).toEqual([1, 2]);
    expect(heap(b, [0, 1, 0, 1])).toEqual([1, 2, 3, 4]);
    expect(heapKey(b, [0, 1])).not.toBe(heapKey(b, [1, 0]));
    expect(commutationClassSize(b, [0, 1])).toBe(1n);
    expect(commutationClassSize(b, [])).toBe(1n);
    // firing node 0 sends its number down the one road to node 1; node 1 sends nothing back
    expect(symbolicPlay(b, [0, 1])).toEqual([[1, 0], [1, 1]]);
    expect(symbolicPlay(b, [1, 0])).toEqual([[0, 1], [1, 0]]);
    expect(allCompleteGames(b, [1n, 0n], 10)).toEqual({ items: [[0, 1]], truncated: false });
  });

  it('on an affine board', () => {
    const b = boardFromName('A2~');
    expect(b.labels).toEqual([0, 1, 2]);
    // on the triangle every node is joined to every other, so every heap is a single column
    expect(heap(b, [0, 1, 2, 0])).toEqual([1, 2, 3, 4]);
    expect(commutationClassSize(b, [0, 1, 2, 0])).toBe(1n);
    expect(heapKey(b, [0, 1, 2, 0])).toBe('0:1,0:4,1:2,2:3');
    const four = boardFromName('A3~');
    // on the square nodes 0 and 2 are unjoined, as are 1 and 3
    expect(heap(four, [0, 2, 1, 3])).toEqual([1, 1, 2, 2]);
    expect(heapKey(four, [0, 2, 1, 3])).toBe(heapKey(four, [2, 0, 3, 1]));
    expect(commutationClassSize(four, [0, 2, 1, 3])).toBe(4n);
    expect(symbolicPlay(b, [0, 1])).toEqual([[1, 0, 0], [1, 1, 0]]);
    // from all ones the plays never end: bounded and reported, never thrown
    const r = allCompleteGames(b, [1n, 1n, 1n], 5);
    expect(r.truncated).toBe(true);
    // from a start of negative level the plays end
    const ended = allCompleteGames(b, [1n, -1n, -1n], 100);
    expect(ended.truncated).toBe(false);
    expect(ended.items.length).toBeGreaterThan(0);
    for (const w of ended.items) for (const i of w) expect(i).toBeGreaterThanOrEqual(0);
  });

  it('bigint and long words: masks beyond 31 bricks', () => {
    const b = boardOf('F4');
    // the longest word of F4 has 24 moves; a word of 40 moves on A1 is a single column of 40 bricks
    const a1 = boardOf('A1');
    const long: number[] = [];
    for (let k = 0; k < 40; k++) long.push(0);
    expect(heap(a1, long).length).toBe(40);
    expect(heap(a1, long)[39]).toBe(40);
    expect(commutationClassSize(a1, long)).toBe(1n);
    // two unjoined nodes fired 20 times each in alternation: 40 bricks in two columns, C(40, 20) orders
    const a3 = boardOf('A3');
    const alt: number[] = [];
    for (let k = 0; k < 20; k++) alt.push(0, 2);
    expect(commutationClassSize(a3, alt)).toBe(137846528820n);
    expect(heapKey(a3, alt)).toBe(heapKey(a3, [...alt].reverse()));
    expect(b.n).toBe(4);
  });

  it('arguments are not mutated', () => {
    const b = boardOf('B3');
    const word = Object.freeze([0, 1, 0, 2]);
    const start = Object.freeze([1, 1, 1]);
    expect(heap(b, word).length).toBe(4);
    expect(heapKey(b, word).length).toBeGreaterThan(0);
    expect(commutationClassSize(b, word)).toBe(2n);
    expect(symbolicPlay(b, word).length).toBe(4);
    const all = allCompleteGames(b, start, 100);
    expect(all.items.length).toBe(42);
    expect(word).toEqual([0, 1, 0, 2]);
    expect(start).toEqual([1, 1, 1]);
    for (let k = 1; k < all.items.length; k++) expect(all.items[k]).not.toBe(all.items[0]);
    const big = boardFromName('pentagon');
    const bigStart = Object.freeze([1n, -2n, 3n, -4n, 1n]);
    expect(allCompleteGames(big, bigStart, 5).truncated).toBe(true);
    expect(bigStart).toEqual([1n, -2n, 3n, -4n, 1n]);
  });

  it('word positions are checked', () => {
    const b = boardOf('A2');
    expect(() => heap(b, [2])).toThrow(RangeError);
    expect(() => heapKey(b, [-1])).toThrow(RangeError);
    expect(() => commutationClassSize(b, [0.5])).toThrow(RangeError);
  });
});
