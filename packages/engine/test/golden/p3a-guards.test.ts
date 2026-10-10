// The behaviour of the phase-3A functions off the finite boards (SPEC.md 5.6, both tables, E-5, E-6,
// E-10, E-11; P3-A1 instruction 5.2, 5.3, 5.4, section 6). No covers(): no golden key stores these cases
// (plan); the file guards the rows of 5.6 for weylOrder, weylDimension, orbitSize, wavePlay,
// countCompleteGames, legalLayers, separatingRoots (NeedsTwoWayRoads on a one-way board, NotFiniteType
// on a gcm board off the finite types), bipartition on every kind of board, the purity of E-5 on frozen
// inputs, the caps, and the generic path on a Big board.
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import type { AnyBoard } from '../../src/board';
import { boardFromName, cartan, fromAdjacency } from '../../src/board';
import { EngineError, NeedsTwoWayRoads, NotFiniteType } from '../../src/errors';
import { play } from '../../src/play';
import {
  bipartition,
  countCompleteGames,
  exponentsFromFired,
  legalLayers,
  orbitSize,
  separatingRoots,
  wavePlay,
  weylDimension,
  weylOrder,
} from '../../src/weyl';
import { ones, unitVectors } from '../helpers/p1';
import { A2_PLUS_TRIANGLE, STAR5, TRIANGLE, boardFromCartan, cycle, renumber } from '../helpers/p2';
import { boardOf } from './_harness';

type Guarded = (board: AnyBoard, a: readonly (number | bigint)[]) => unknown;

/** rho on a board of either arithmetic (the generic `ones` of helpers/p1 does not take the union). */
function onesAny(board: AnyBoard): (number | bigint)[] {
  return board.labels.map(() => board.arith.one);
}

/** The seven guarded functions, each called with a vector of the board's size (plan). */
const GUARDED: [string, Guarded][] = [
  ['weylOrder', (b) => weylOrder(b)],
  ['weylDimension', (b) => weylDimension(b, b.labels.map(() => 0))],
  ['orbitSize', (b, a) => orbitSize(b, a as never)],
  ['wavePlay', (b, a) => wavePlay(b, a as never, 0)],
  ['countCompleteGames', (b) => countCompleteGames(b)],
  ['legalLayers', (b) => legalLayers(b)],
  ['separatingRoots', (b, a) => separatingRoots(b, a as never)],
];

describe('one-way board', () => {
  const oneWay = () => fromAdjacency([[0, 1], [0, 0]]);
  it('is a one-way Big board', () => {
    const b = oneWay();
    expect(b.kind).toBe('one-way');
    expect(b.arith).toBe(Big);
  });
  for (const [name, f] of GUARDED) {
    it(`${name} throws NeedsTwoWayRoads, an EngineError`, () => {
      const b = oneWay();
      let caught: unknown = null;
      try {
        f(b, onesAny(b));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(NeedsTwoWayRoads);
      expect(caught).toBeInstanceOf(EngineError);
      expect(caught).not.toBeInstanceOf(NotFiniteType);
    });
  }
});

describe('affine board', () => {
  const boards: [string, () => AnyBoard][] = [
    ['A2~', () => boardFromName('A2~')],
    ['pentagon (affine A4~)', () => boardFromName('pentagon')],
    ['the star with five arms (indefinite)', () => boardFromCartan(STAR5)],
    ['A2 beside a triangle (one piece not finite)', () => boardFromCartan(A2_PLUS_TRIANGLE)],
  ];
  for (const [label, make] of boards) {
    for (const [name, f] of GUARDED) {
      it(`${name} throws NotFiniteType on ${label}`, () => {
        const b = make();
        let caught: unknown = null;
        try {
          f(b, onesAny(b));
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(NotFiniteType);
        expect(caught).toBeInstanceOf(EngineError);
      });
    }
  }
  it('the guard decides by classify, not by running into a cap: a cap of 0 still throws NotFiniteType', () => {
    const b = boardFromName('A2~');
    expect(() => countCompleteGames(b, 0)).toThrow(NotFiniteType);
    expect(() => legalLayers(b, undefined, 0)).toThrow(NotFiniteType);
  });
});

describe('bipartition on any board', () => {
  it('works on the one-way road: [[0], [1]]', () => {
    expect(bipartition(fromAdjacency([[0, 1], [0, 0]]))).toEqual([[0], [1]]);
  });
  it('null on the odd cycles A2~ and pentagon, and on a 7-cycle', () => {
    expect(bipartition(boardFromName('A2~'))).toBeNull();
    expect(bipartition(boardFromName('pentagon'))).toBeNull();
    expect(bipartition(boardFromCartan(TRIANGLE))).toBeNull();
    expect(bipartition(boardFromCartan(cycle(7)))).toBeNull();
  });
  it('[[0, 2], [1, 3]] on square, and the 6-cycle splits alternately', () => {
    expect(bipartition(boardFromName('square'))).toEqual([[0, 2], [1, 3]]);
    expect(bipartition(boardFromCartan(cycle(6)))).toEqual([[0, 2, 4], [1, 3, 5]]);
  });
  it('[[0], []] on A1', () => {
    expect(bipartition(boardOf('A1'))).toEqual([[0], []]);
  });
  it('colour 0 at the least position of each component of a board in two pieces', () => {
    // A2 on positions 0, 1 and A3 on positions 2, 3, 4
    const C = [
      [2, -1, 0, 0, 0],
      [-1, 2, 0, 0, 0],
      [0, 0, 2, -1, 0],
      [0, 0, -1, 2, -1],
      [0, 0, 0, -1, 2],
    ];
    expect(bipartition(boardFromCartan(C))).toEqual([[0, 2, 4], [1, 3]]);
    // an odd cycle in one piece makes the whole answer null
    expect(bipartition(boardFromCartan(A2_PLUS_TRIANGLE))).toBeNull();
    // the star with five arms is a tree: the centre alone in class 0
    expect(bipartition(boardFromCartan(STAR5))).toEqual([[0], [1, 2, 3, 4, 5]]);
  });
  it('works on every twisted and untwisted affine tree, and the classes are fresh arrays', () => {
    expect(bipartition(boardFromName('B3~'))).toEqual([[0, 1, 3], [2]]);
    // D4^(3) has its matrix [[2, 0, -1], [0, 2, -1], [-1, -3, 2]]: node 2 is the centre
    expect(bipartition(boardFromName('D4^(3)'))).toEqual([[0, 1], [2]]);
    const b = boardOf('A3');
    expect(bipartition(b)).not.toBe(bipartition(b));
  });
});

describe('purity', () => {
  it('every function accepts deep-frozen inputs and leaves them unchanged', () => {
    const b = boardOf('B3');
    expect(Object.isFrozen(b)).toBe(true);
    const a = Object.freeze([2, -1, 3]);
    const lambda = Object.freeze([1, 0, 2]);
    const fired = Object.freeze([1, 2, 1, 5, 4, 3, 3, 2, 1]);
    expect(bipartition(b)).toEqual([[0, 2], [1]]);
    expect(exponentsFromFired(fired, 3)).toEqual([1, 3, 5]);
    expect(weylOrder(b)).toBe(48);
    expect(wavePlay(b, a, 1).rounds).toBeGreaterThan(0);
    expect(orbitSize(b, a)).toBe(48);
    expect(weylDimension(b, lambda)).toBeGreaterThan(0n);
    expect(countCompleteGames(b)).toBe(42n);
    expect(legalLayers(b, a)).not.toBeNull();
    expect(separatingRoots(b, a).length).toBeGreaterThan(0);
    expect(a).toEqual([2, -1, 3]);
    expect(lambda).toEqual([1, 0, 2]);
    expect(fired).toEqual([1, 2, 1, 5, 4, 3, 3, 2, 1]);
  });
  it('results share no array with the inputs', () => {
    const b = boardOf('A2');
    const a = [1, -1];
    const w = wavePlay(b, a, 0);
    expect(w.position).not.toBe(a);
    const zero = [0, 0];
    expect(wavePlay(b, zero, 0).position).not.toBe(zero);
    const layers1 = legalLayers(b);
    const layers2 = legalLayers(b);
    expect(layers1).not.toBe(layers2);
    expect(layers1).toEqual(layers2);
  });
  it('the same board object gives the same answers on repeated calls (the cache changes no result)', () => {
    const b = boardOf('D4');
    const first = [weylOrder(b), orbitSize(b, [0, 1, 0, 0]), countCompleteGames(b), legalLayers(b)];
    const second = [weylOrder(b), orbitSize(b, [0, 1, 0, 0]), countCompleteGames(b), legalLayers(b)];
    expect(first).toEqual(second);
  });
});

describe('caps', () => {
  it('countCompleteGames and legalLayers report their caps as null, never by throwing', () => {
    const b = boardOf('A3');
    expect(countCompleteGames(b, 23)).toBeNull();
    expect(legalLayers(b, undefined, 23)).toBeNull();
    expect(countCompleteGames(boardOf('E8'))).toBeNull();
  });
  it('the wave is bounded: A3 from (2, -4, -3) never ends and returns the result reached at round 10001 (plan)', () => {
    const b = boardOf('A3');
    for (const c of [0, 1] as const) {
      const w = wavePlay(b, [2, -4, -3], c);
      expect(w.rounds).toBe(10001);
      expect(w.legal).toBe(false);
      // 10001 rounds alternate the classes [0, 2] and [1]: 5001 rounds of the first colour, 5000 of the other
      expect(w.word.length).toBe(c === 0 ? 5001 * 2 + 5000 : 5001 + 5000 * 2);
      expect(w.position.some((x) => x > 0)).toBe(true); // it would go on
    }
  });
  it('wavePlay rejects a colour other than 0 or 1 and a vector of the wrong length', () => {
    const b = boardOf('A2');
    expect(() => wavePlay(b, [1, 1], 2 as never)).toThrow(RangeError);
    expect(() => wavePlay(b, [1], 0)).toThrow(RangeError);
    expect(() => orbitSize(b, [1])).toThrow(RangeError);
    expect(() => separatingRoots(b, [1, 1, 1])).toThrow(RangeError);
  });
});

describe('the generic path on a Big board', () => {
  // A3 renumbered so that fromAdjacency's phase-0 rule does not name it: a custom board with Big
  const b = boardFromCartan(renumber(cartan('A3'), [1, 0, 2]));
  it('is a Big board that classify calls finite', () => {
    expect(b.arith).toBe(Big);
    expect(b.name).toBeUndefined();
  });
  it('every function gives the A3 values in the board arithmetic', () => {
    expect(bipartition(b)).toEqual([[0], [1, 2]]);
    expect(weylOrder(b)).toBe(24);
    expect(exponentsFromFired(play(b, ones(b)).fired.map(Number), 3)).toEqual([1, 2, 3]);
    const w = wavePlay(b, ones(b), 0);
    expect(w.rounds).toBe(4);
    expect(w.legal).toBe(true);
    expect(w.position).toEqual([-1n, -1n, -1n]);
    expect(unitVectors(b).map((e) => orbitSize(b, e))).toEqual([6, 4, 4]);
    // positions 1 and 2 are Bourbaki nodes 1 and 3: the adjoint representation, dim 15
    expect(weylDimension(b, [0, 1, 1])).toBe(15n);
    expect(weylDimension(b, [1, 0, 1])).toBe(20n);
    expect(countCompleteGames(b)).toBe(16n);
    expect(legalLayers(b)).toEqual([1, 3, 5, 6, 5, 3, 1]);
    const sep = separatingRoots(b, [-1n, -1n, -1n]);
    expect(sep.length).toBe(6);
    for (const r of sep) for (const x of r) expect(typeof x).toBe('bigint');
    expect(separatingRoots(b, ones(b))).toEqual([]);
  });
});
