// Every row of the second table of SPEC.md 5.6 for the functions that exist in phase 2 (P2-A1
// instruction 5.13 and section 6), one describe per row, on the one-way board [[2, 0], [-1, 2]], the
// triangle (affine A2~), the star with five arms (indefinite), an unbalanced triangle and a two-component
// board. The six phase-1 finite functions are taken from src/index.ts, which re-exports their guarded
// versions (E-11). The phase-1 tests are untouched; the cases here are additions. No golden key.
import { describe, expect, it } from 'vitest';
import * as api from '../../src/index';
import { NeedsConnectedBoard, NeedsTwoWayRoads, NotAffine, NotFiniteType } from '../../src/errors';
import { requireAffine, requireConnected, requireFinite, requireGcm } from '../../src/guards';
import { boardOf } from '../golden/_harness';
import { ones, unitVectors } from '../helpers/p1';
import { A2_PLUS_TRIANGLE, ONE_WAY, STAR5, TRIANGLE, UNBALANCED_TRIANGLE, boardFromCartan, cycle } from '../helpers/p2';

const oneWay = () => boardFromCartan(ONE_WAY);
const triangle = () => boardFromCartan(TRIANGLE);
const star5 = () => boardFromCartan(STAR5);
const unbalanced = () => boardFromCartan(UNBALANCED_TRIANGLE);
const twoPieces = () => boardFromCartan(A2_PLUS_TRIANGLE);
const nonFinite = () => [triangle(), star5(), unbalanced()];

describe('5.6 row 1: the moves, searches and plays work on every kind of board', () => {
  for (const [name, make] of [['one-way', oneWay], ['triangle', triangle], ['star5', star5], ['unbalanced', unbalanced]] as const) {
    it(`${name}`, () => {
      const b = make();
      const e = unitVectors(b);
      const a = ones(b);
      expect(api.mutate(b, e[0]!, 1).length).toBe(b.n);
      expect(api.fire(b, a, 0)[0]).toBe(-1n);
      expect(api.applyWord(b, a, [0, 1, 0], 'firing').length).toBe(b.n);
      expect(api.applyWord(b, e[0]!, [1, 0], 'mutation').length).toBe(b.n);
      const o = api.orbit(b, e, 'mutation', 50, 3);
      expect(o.items.length).toBeGreaterThan(b.n);
      const g = api.orbitGraph(b, [a], 'firing', 20);
      expect(g.items.length).toBeLessThanOrEqual(20);
      const r = api.roots(b, 30, 2);
      expect(r.items.length).toBeGreaterThan(b.n);
      expect(['ended', 'cap']).toContain(api.play(b, a, undefined, 25).status);
      expect(['ended', 'looped', 'cap']).toContain(api.playFate(b, a, undefined, 25).status);
      expect(['ended', 'cap']).toContain(api.raisingPlay(b, e[0]!, undefined, 25).status);
      expect(['ended', 'cap']).toContain(api.kostantPlay(b, 0, undefined, 25).status);
      expect(api.mutationMatrix(b, 0).length).toBe(b.n);
      expect(api.firingMatrix(b, 0).length).toBe(b.n);
      expect(api.toNumbers(b, e[0]!)[0]).toBe(2n);
    });
  }
  it('on the affine triangle the raising play and Kostant game reach their caps (they never end)', () => {
    const b = triangle();
    expect(api.raisingPlay(b, unitVectors(b)[0]!, undefined, 40).status).toBe('cap');
    expect(api.kostantPlay(b, 0, undefined, 40).status).toBe('cap');
  });
});

describe('5.6 row 2: components, relabellings, transposeBoard, subBoard, determinant work', () => {
  it('one-way board', () => {
    const b = oneWay();
    expect(api.components(b)).toEqual([[0, 1]]);
    expect(api.relabellings(b, b)).toEqual([[0, 1]]);
    expect(api.transposeBoard(b).kind).toBe('one-way');
    expect(api.cartanNumbers(api.transposeBoard(b))).toEqual([[2, -1], [0, 2]]);
    expect(api.subBoard(b, [1]).n).toBe(1);
    expect(api.ratToString(api.determinant(b.cartan))).toBe('4');
  });
  it('non-finite gcm boards', () => {
    for (const b of nonFinite()) {
      expect(api.components(b).length).toBe(1);
      expect(api.relabellings(b, b).length).toBeGreaterThan(0);
      expect(api.transposeBoard(b).n).toBe(b.n);
      expect(api.subBoard(b, [0, 1]).n).toBe(2);
      expect(api.determinant(b.cartan).den).toBe(1n);
    }
    expect(api.relabellings(star5(), star5()).length).toBe(120);
    expect(api.components(twoPieces())).toEqual([[0, 1], [2, 3, 4]]);
  });
});

describe('5.6 row 3: toPopulation gives rationals when det C is nonzero, else null', () => {
  it('one-way board: det 4', () => {
    const p = api.toPopulation(oneWay(), [1n, 1n]);
    expect(p).not.toBeNull();
    expect(api.ratToString(p![0]!)).toBe('1/2');
  });
  it('affine boards are singular, the others are not', () => {
    expect(api.toPopulation(triangle(), [1n, 1n, 1n])).toBeNull();
    expect(api.toPopulation(star5(), ones(star5()))).not.toBeNull();
    expect(api.toPopulation(unbalanced(), [1n, 0n, 0n])).not.toBeNull();
  });
});

describe('5.6 row 4: symmetrizer, gram, formValue null on a one-way board; formIsInvariant works', () => {
  it('one-way board', () => {
    const b = oneWay();
    expect(api.symmetrizer(b)).toBeNull();
    expect(api.gram(b)).toBeNull();
    expect(api.formValue(b, [1n, 0n])).toBeNull();
    const r = api.formIsInvariant(b, [[2, -1], [-1, 2]]);
    expect(r.invariant).toBe(false);
    expect(r.witness).toBeDefined();
    // the units survive a mutation at node 0 (e_0 goes to -e_0); e_0 + e_1 goes to (-1, 1), of value 6, not 2
    expect(r.witness!.node).toBe(0);
    expect(r.witness!.population).toEqual([1, 1]);
  });
  it('non-finite gcm boards: values, or null when not balanced', () => {
    const t = triangle();
    expect(api.symmetrizer(t)!.map(api.ratToString)).toEqual(['1', '1', '1']);
    expect(api.gram(t)!.length).toBe(3);
    expect(api.ratToString(api.formValue(t, [1n, 1n, 1n])!)).toBe('0');
    expect(api.formIsInvariant(t, TRIANGLE)).toEqual({ invariant: true });
    const s = star5();
    expect(api.symmetrizer(s)!.every((x) => api.ratToString(x) === '1')).toBe(true);
    expect(api.ratToString(api.formValue(s, ones(s))!)).toBe('2');
    const u = unbalanced();
    expect(api.symmetrizer(u)).toBeNull();
    expect(api.gram(u)).toBeNull();
    expect(api.formValue(u, [1n, 0n, 0n])).toBeNull();
    expect(api.formIsInvariant(u, TRIANGLE).invariant).toBe(false);
  });
});

describe('5.6 row 5: classify', () => {
  it('one-way board: kind one-way, class null, balanced false, name null', () => {
    expect(api.classify(oneWay())).toEqual([{ nodes: [0, 1], kind: 'one-way', balanced: false, class: null, name: null }]);
  });
  it('affine with marks and comarks; indefinite without', () => {
    expect(api.classify(triangle())).toEqual([
      { nodes: [0, 1, 2], kind: 'gcm', balanced: true, class: 'affine', name: 'A2~', marks: [1, 1, 1], comarks: [1, 1, 1] },
    ]);
    expect(api.classify(star5())).toEqual([{ nodes: [0, 1, 2, 3, 4, 5], kind: 'gcm', balanced: true, class: 'indefinite', name: null }]);
    expect(api.classify(unbalanced())).toEqual([{ nodes: [0, 1, 2], kind: 'gcm', balanced: false, class: 'indefinite', name: null }]);
    expect(api.classify(twoPieces())).toEqual([
      { nodes: [0, 1], kind: 'gcm', balanced: true, class: 'finite', name: 'A2', bourbaki_order: [0, 1] },
      { nodes: [2, 3, 4], kind: 'gcm', balanced: true, class: 'affine', name: 'A2~', marks: [1, 1, 1], comarks: [1, 1, 1] },
    ]);
  });
  it('a one-way component beside a finite one', () => {
    const b = boardFromCartan([[2, -1, 0, 0], [-1, 2, 0, 0], [0, 0, 2, 0], [0, 0, -1, 2]]);
    expect(api.classify(b)).toEqual([
      { nodes: [0, 1], kind: 'gcm', balanced: true, class: 'finite', name: 'A2', bourbaki_order: [0, 1] },
      { nodes: [2, 3], kind: 'one-way', balanced: false, class: null, name: null },
    ]);
  });
});

describe('5.6 row 6: identify, identifyAffine, smallestNonfiniteSubboard, spectralRadius', () => {
  it('null on a one-way board', () => {
    const b = oneWay();
    expect(api.identify(b)).toBeNull();
    expect(api.identifyAffine(b)).toBeNull();
    expect(api.smallestNonfiniteSubboard(b)).toBeNull();
    expect(api.spectralRadius(b)).toBeNull();
  });
  it('identify null off the finite types; the others work', () => {
    expect(api.identify(triangle())).toBeNull();
    expect(api.identify(star5())).toBeNull();
    expect(api.identify(unbalanced())).toBeNull();
    expect(api.identifyAffine(triangle())).toBe('A2~');
    expect(api.identifyAffine(star5())).toBeNull();
    expect(api.identifyAffine(unbalanced())).toBeNull();
    expect(api.smallestNonfiniteSubboard(triangle())).toEqual({ nodes: [0, 1, 2], class: 'affine' });
    expect(api.smallestNonfiniteSubboard(star5())).toEqual({ nodes: [0, 1, 2, 3, 4], class: 'affine' });
    expect(api.smallestNonfiniteSubboard(unbalanced())).toEqual({ nodes: [0, 1, 2], class: 'indefinite' });
    expect(api.smallestNonfiniteSubboard(twoPieces())).toEqual({ nodes: [2, 3, 4], class: 'affine' });
    expect(api.smallestNonfiniteSubboard(boardOf('E8'))).toBeNull();
    expect(api.spectralRadius(triangle())!.toFixed(6)).toBe('2.000000');
    expect(api.spectralRadius(star5())!.toFixed(4)).toBe('2.2361');
    expect(api.spectralRadius(unbalanced())!.toFixed(4)).toBe('2.3028');
  });
  it('a one-way road anywhere on the board gives null, even beside a two-way component (trap 12)', () => {
    const b = boardFromCartan([[2, -1, -1, 0, 0], [-1, 2, -1, 0, 0], [-1, -1, 2, 0, 0], [0, 0, 0, 2, 0], [0, 0, 0, -1, 2]]);
    expect(api.smallestNonfiniteSubboard(b)).toBeNull();
    expect(api.spectralRadius(b)).toBeNull();
    expect(api.classify(b)[0]!.class).toBe('affine');
  });
});

describe('5.6 row 7: cartanClass and isRootPopulation', () => {
  it('throw NeedsTwoWayRoads on a one-way board', () => {
    expect(() => api.cartanClass(oneWay())).toThrow(NeedsTwoWayRoads);
    expect(() => api.isRootPopulation(oneWay(), [1n, 1n])).toThrow(NeedsTwoWayRoads);
  });
  it('work on gcm boards of every class', () => {
    expect(api.cartanClass(triangle())).toBe('affine');
    expect(api.cartanClass(star5())).toBe('indefinite');
    expect(api.cartanClass(unbalanced())).toBe('indefinite');
    expect(api.cartanClass(boardOf('E8'))).toBe('finite');
    expect(api.isRootPopulation(triangle(), [2n, 1n, 1n])).toBe(true);
    expect(api.isRootPopulation(star5(), [1n, 1n, 1n, 1n, 1n, 1n])).toBe(true);
    expect(api.isRootPopulation(unbalanced(), [1n, 1n, 0n])).toBe(true);
    expect(api.isRootPopulation(unbalanced(), [1n, 0n, 1n])).toBe(true);
    // (1, 1, 1) has numbers (0, -1, 0): no city to lower, so it is stuck and is not a root population
    expect(api.isRootPopulation(unbalanced(), [1n, 1n, 1n])).toBe(false);
    expect(api.isRootPopulation(twoPieces(), [1n, 1n, 0n, 0n, 0n])).toBe(true);
    expect(api.isRootPopulation(twoPieces(), [1n, 0n, 1n, 0n, 0n])).toBe(false);
  });
  it('cartanClass, identify and identifyAffine need a connected board; classify handles the pieces', () => {
    expect(() => api.cartanClass(twoPieces())).toThrow(NeedsConnectedBoard);
    expect(() => api.identify(twoPieces())).toThrow(NeedsConnectedBoard);
    expect(() => api.identifyAffine(twoPieces())).toThrow(NeedsConnectedBoard);
    expect(api.classify(twoPieces()).map((r) => r.class)).toEqual(['finite', 'affine']);
    // the kind is checked before connectedness: a one-way board in two pieces reports the roads
    const b = boardFromCartan([[2, 0, 0], [-1, 2, 0], [0, 0, 2]]);
    expect(() => api.cartanClass(b)).toThrow(NeedsTwoWayRoads);
    expect(api.identify(b)).toBeNull();
    expect(api.identifyAffine(b)).toBeNull();
  });
});

describe('5.6 row 8: affineExtension', () => {
  it('throws NeedsTwoWayRoads on a one-way board and NotFiniteType off the finite types', () => {
    expect(() => api.affineExtension(oneWay())).toThrow(NeedsTwoWayRoads);
    for (const b of nonFinite()) expect(() => api.affineExtension(b)).toThrow(NotFiniteType);
    expect(() => api.affineExtension(twoPieces())).toThrow(NeedsConnectedBoard);
    expect(api.affineExtension(boardOf('A1')).marks).toEqual([1, 1]);
  });
});

describe('5.6 row 9: marks, comarks, level', () => {
  it('throw NeedsTwoWayRoads on a one-way board', () => {
    expect(() => api.marks(oneWay())).toThrow(NeedsTwoWayRoads);
    expect(() => api.comarks(oneWay())).toThrow(NeedsTwoWayRoads);
    expect(() => api.level(oneWay(), [1n, 1n])).toThrow(NeedsTwoWayRoads);
  });
  it('work on affine boards', () => {
    expect(api.marks(triangle())).toEqual([1, 1, 1]);
    expect(api.comarks(triangle())).toEqual([1, 1, 1]);
    expect(api.level(triangle(), [1n, -2n, 3n])).toBe(2n);
    expect(api.level(api.boardFromName('pentagon'), [1n, -2n, 3n, -4n, 1n])).toBe(-1n);
  });
  it('NotAffine on finite and indefinite boards', () => {
    for (const [b, cls] of [[boardOf('A2'), 'finite'], [boardOf('E8'), 'finite'], [star5(), 'indefinite'], [unbalanced(), 'indefinite']] as const) {
      const all1 = b.labels.map(() => b.arith.one);
      for (const f of [() => api.marks(b), () => api.comarks(b), () => api.level(b, all1)]) {
        let caught: unknown = null;
        try {
          f();
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(NotAffine);
        expect((caught as NotAffine).message).toContain(cls);
        expect((caught as NotAffine).data.class).toBe(cls);
      }
    }
    // several components: the message names each class in order
    let caught: unknown = null;
    try {
      api.marks(twoPieces());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(NotAffine);
    expect((caught as NotAffine).message).toContain('finite, affine');
    expect((caught as NotAffine).data.class).toBe('finite');
    // a vector of the wrong length is a RangeError before any guard
    expect(() => api.level(triangle(), [1n, 1n])).toThrow(RangeError);
  });
});

describe('5.6 row 10: the finite theory throws NeedsTwoWayRoads, then NotFiniteType', () => {
  const finite = [
    ['longestWord', (b: api.AnyBoard) => api.longestWord(b)],
    ['minusW0', (b: api.AnyBoard) => api.minusW0(b)],
    ['minusculeNodes', (b: api.AnyBoard) => api.minusculeNodes(b)],
    ['highestRoot', (b: api.AnyBoard) => api.highestRoot(b)],
    ['highestShortRoot', (b: api.AnyBoard) => api.highestShortRoot(b)],
    ['coxeterNumber', (b: api.AnyBoard) => api.coxeterNumber(b)],
    ['coroot', (b: api.AnyBoard) => api.coroot(b as api.Board<bigint>, unitVectors(b as api.Board<bigint>)[0]!)],
  ] as const;
  for (const [name, f] of finite) {
    it(`${name}`, () => {
      expect(() => f(oneWay())).toThrow(NeedsTwoWayRoads);
      for (const b of nonFinite()) expect(() => f(b)).toThrow(NotFiniteType);
      expect(() => f(twoPieces())).toThrow(NotFiniteType);
    });
  }
  it('still work on the finite boards, through the guarded exports of index.ts', () => {
    const b = boardOf('B3');
    expect(api.highestRoot(b)).toEqual([1, 2, 2]);
    expect(api.highestShortRoot(b)).toEqual([1, 1, 1]);
    expect(api.coxeterNumber(b)).toBe(6);
    expect(api.longestWord(b).length).toBe(9);
    expect(api.minusW0(b)).toEqual([0, 1, 2]);
    expect(api.minusculeNodes(b)).toEqual([2]);
    expect(api.coroot(b, [1, 2, 2])).toEqual([1, 2, 1]);
    const big = boardFromCartan(api.cartan('G2'));
    expect(api.highestRoot(big)).toEqual([3n, 2n]);
    expect(api.coroot(big, [3n, 2n])).toEqual([1n, 2n]);
  });
  it('a disconnected board whose pieces are all finite counts as finite (requireFinite, plan)', () => {
    const b = boardFromCartan([[2, -1, 0], [-1, 2, 0], [0, 0, 2]]);
    expect(() => requireFinite(b)).not.toThrow();
    expect(api.longestWord(b)).toEqual([0, 1, 0, 2]);
    expect(api.longestWord(b, [0, 1])).toEqual([0, 1, 0]);
    expect(() => api.affineExtension(b)).toThrow(NeedsConnectedBoard);
  });
});

describe('the require* guards and the cache', () => {
  it('requireGcm, requireConnected, requireFinite, requireAffine', () => {
    expect(() => requireGcm(oneWay())).toThrow(NeedsTwoWayRoads);
    expect(() => requireGcm(triangle())).not.toThrow();
    expect(() => requireConnected(twoPieces())).toThrow(NeedsConnectedBoard);
    expect(() => requireConnected(oneWay())).not.toThrow();
    expect(() => requireFinite(oneWay())).toThrow(NeedsTwoWayRoads);
    expect(() => requireFinite(triangle())).toThrow(NotFiniteType);
    expect(() => requireFinite(boardOf('F4'))).not.toThrow();
    expect(() => requireAffine(oneWay())).toThrow(NeedsTwoWayRoads);
    expect(() => requireAffine(boardOf('F4'))).toThrow(NotAffine);
    expect(() => requireAffine(star5())).toThrow(NotAffine);
    expect(() => requireAffine(triangle())).not.toThrow();
    expect(() => requireAffine(api.boardFromName('D4^(3)'))).not.toThrow();
    expect(() => requireAffine(boardFromCartan([[2, -2, 0, 0], [-2, 2, 0, 0], [0, 0, 2, -2], [0, 0, -2, 2]]))).toThrow(NotAffine);
  });
  it('classify returns a fresh copy every time; changing it does not change the next verdict', () => {
    const b = api.boardFromName('pentagon');
    const first = api.classify(b);
    first[0]!.name = 'changed';
    first[0]!.marks!.push(99);
    first[0]!.nodes.pop();
    const second = api.classify(b);
    expect(second).toEqual([
      { nodes: [0, 1, 2, 3, 4], kind: 'gcm', balanced: true, class: 'affine', name: 'A4~', marks: [1, 1, 1, 1, 1], comarks: [1, 1, 1, 1, 1] },
    ]);
    expect(second).not.toBe(first);
    expect(() => requireAffine(b)).not.toThrow();
  });
  it('a board object built per call is classified afresh and gives the same verdict (E-5)', () => {
    expect(api.classify(boardFromCartan(cycle(6)))).toEqual(api.classify(boardFromCartan(cycle(6))));
  });
});
