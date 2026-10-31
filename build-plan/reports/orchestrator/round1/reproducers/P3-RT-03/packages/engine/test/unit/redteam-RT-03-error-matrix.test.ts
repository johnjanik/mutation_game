// RT-03 attack 7 (method E) and attack 8: every exported function that takes a board, on the boards of
// the second table of SPEC.md 5.6, with the outcome of each cell: 'works', 'null', or the class thrown.
import { describe, expect, it } from 'vitest';
import * as E from '../../src/index';
import type { AnyBoard, Board } from '../../src/index';
import { golden } from '../golden/_harness';

const ct = golden.classification_tests as { label: string; cartan: number[][] }[];
const cartanOf = (label: string): number[][] => ct.find((c) => c.label === label)!.cartan;

/** A board from a Cartan matrix through fromAdjacency (A[i][j] = -C[j][i]). */
function fromCartan(C: number[][]): AnyBoard {
  const n = C.length;
  return E.fromAdjacency(C.map((_, i) => C.map((__, j) => (i === j ? 0 : -C[j]![i]!))));
}

const boards: Record<string, AnyBoard> = {
  oneWay2: E.fromAdjacency([[0, 1], [0, 0]]),
  oneWay3: E.fromAdjacency([[0, 1, 0], [0, 0, 1], [0, 0, 0]]),
  finite: E.boardFromName('A3'),
  affine: fromCartan([[2, -1, -1], [-1, 2, -1], [-1, -1, 2]]),
  indefinite: E.fromAdjacency([[0, 3], [3, 0]]),
  unbalanced: fromCartan(cartanOf('triangle with one double road (unbalanced)')),
  unbalanced2: fromCartan(cartanOf('triangle with unbalanced road counts all round')),
  disconnected: fromCartan(cartanOf('two components: A2 and the triangle')),
};

function vec(b: AnyBoard, xs: number[]): (number | bigint)[] {
  return b.arith === E.Big ? xs.map((x) => BigInt(x)) : xs;
}
const ones = (b: AnyBoard) => vec(b, Array.from({ length: b.n }, () => 1));
const e0 = (b: AnyBoard) => vec(b, Array.from({ length: b.n }, (_, i) => (i === 0 ? 1 : 0)));
const ident = (b: AnyBoard) => Array.from({ length: b.n }, (_, i) => Array.from({ length: b.n }, (_, j) => (i === j ? 1 : 0)));

type Call = (b: AnyBoard) => unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const F = E as any;
const calls: Record<string, Call> = {
  mutate: (b) => F.mutate(b, e0(b), 0),
  fire: (b) => F.fire(b, ones(b), 0),
  applyWord: (b) => F.applyWord(b, e0(b), [0, 1, 0], 'mutation'),
  orbit: (b) => F.orbit(b, [e0(b)], 'mutation', 100, 5),
  orbitGraph: (b) => F.orbitGraph(b, [e0(b)], 'firing', 100, 5),
  roots: (b) => F.roots(b, 100, 5),
  positiveRoots: (b) => F.positiveRoots(b, 100, 5),
  play: (b) => F.play(b, ones(b), undefined, 50),
  playFate: (b) => F.playFate(b, ones(b), undefined, 50),
  raisingPlay: (b) => F.raisingPlay(b, e0(b), undefined, 50),
  kostantPlay: (b) => F.kostantPlay(b, 0, undefined, 50),
  allCompleteGames: (b) => F.allCompleteGames(b, ones(b), 5),
  mutationMatrix: (b) => F.mutationMatrix(b, 0),
  firingMatrix: (b) => F.firingMatrix(b, 0),
  toNumbers: (b) => F.toNumbers(b, ones(b)),
  legalNodes: (b) => F.legalNodes(b, ones(b)),
  raisingNodes: (b) => F.raisingNodes(b, e0(b)),
  symbolicPlay: (b) => F.symbolicPlay(b, [0, 1, 0]),
  heap: (b) => F.heap(b, [0, 1, 0]),
  heapKey: (b) => F.heapKey(b, [0, 1, 0]),
  commutationClassSize: (b) => F.commutationClassSize(b, [0, 1, 0]),
  components: (b) => F.components(b),
  bipartition: (b) => F.bipartition(b),
  relabellings: (b) => F.relabellings(b, b),
  transposeBoard: (b) => F.transposeBoard(b),
  subBoard: (b) => F.subBoard(b, [0, 1]),
  determinant: (b) => F.determinant(b.cartan),
  toPopulation: (b) => F.toPopulation(b, ones(b)),
  symmetrizer: (b) => F.symmetrizer(b),
  gram: (b) => F.gram(b),
  formValue: (b) => F.formValue(b, e0(b)),
  formIsInvariant: (b) => F.formIsInvariant(b, ident(b)),
  classify: (b) => F.classify(b),
  identify: (b) => F.identify(b),
  identifyAffine: (b) => F.identifyAffine(b),
  smallestNonfiniteSubboard: (b) => F.smallestNonfiniteSubboard(b),
  spectralRadius: (b) => F.spectralRadius(b),
  cartanClass: (b) => F.cartanClass(b),
  isRootPopulation: (b) => F.isRootPopulation(b, e0(b)),
  affineExtension: (b) => F.affineExtension(b),
  marks: (b) => F.marks(b),
  comarks: (b) => F.comarks(b),
  level: (b) => F.level(b, ones(b)),
  weylOrder: (b) => F.weylOrder(b),
  weylDimension: (b) => F.weylDimension(b, Array.from({ length: b.n }, () => 1)),
  orbitSize: (b) => F.orbitSize(b, ones(b)),
  longestWord: (b) => F.longestWord(b),
  minusW0: (b) => F.minusW0(b),
  minusculeNodes: (b) => F.minusculeNodes(b),
  highestRoot: (b) => F.highestRoot(b),
  highestShortRoot: (b) => F.highestShortRoot(b),
  coxeterNumber: (b) => F.coxeterNumber(b),
  wavePlay: (b) => F.wavePlay(b, ones(b), 0),
  countCompleteGames: (b) => F.countCompleteGames(b),
  legalLayers: (b) => F.legalLayers(b),
  coroot: (b) => F.coroot(b, e0(b)),
  separatingRoots: (b) => F.separatingRoots(b, ones(b)),
  choleskyBasis: (b) => F.choleskyBasis(b),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

type Cell = 'works' | 'null' | string;
type Row = { oneWay: Cell; finite: Cell; affine: Cell; indefinite: Cell; unbalanced: Cell; disconnected: Cell };
const row = (oneWay: Cell, finite: Cell, affine: Cell, indefinite: Cell, unbalanced: Cell, disconnected: Cell): Row => ({
  oneWay, finite, affine, indefinite, unbalanced, disconnected,
});
const W = 'works';
const all: Row = row(W, W, W, W, W, W);
const theory = row('NeedsTwoWayRoads', W, 'NotFiniteType', 'NotFiniteType', 'NotFiniteType', 'NotFiniteType');

// The second table of SPEC.md 5.6, row by row.
const expected: Record<string, Row> = {
  mutate: all, fire: all, applyWord: all, orbit: all, orbitGraph: all, roots: all, positiveRoots: all, play: all,
  playFate: all, raisingPlay: all, kostantPlay: all, allCompleteGames: all, mutationMatrix: all, firingMatrix: all,
  toNumbers: all, legalNodes: all, raisingNodes: all, symbolicPlay: all, heap: all, heapKey: all,
  commutationClassSize: all,
  components: all, bipartition: all, relabellings: all, transposeBoard: all, subBoard: all, determinant: all,
  toPopulation: all,
  symmetrizer: row('null', W, W, W, 'null', W),
  gram: row('null', W, W, W, 'null', W),
  formValue: row('null', W, W, W, 'null', W),
  formIsInvariant: all,
  classify: all,
  identify: row('null', W, 'null', 'null', 'null', 'NeedsConnectedBoard'),
  identifyAffine: row('null', W, W, W, W, 'NeedsConnectedBoard'),
  smallestNonfiniteSubboard: row('null', W, W, W, W, W),
  spectralRadius: row('null', W, W, W, W, W),
  cartanClass: row('NeedsTwoWayRoads', W, W, W, W, 'NeedsConnectedBoard'),
  isRootPopulation: row('NeedsTwoWayRoads', W, W, W, W, W),
  affineExtension: theory,
  marks: row('NeedsTwoWayRoads', 'NotAffine', W, 'NotAffine', 'NotAffine', 'NotAffine'),
  comarks: row('NeedsTwoWayRoads', 'NotAffine', W, 'NotAffine', 'NotAffine', 'NotAffine'),
  level: row('NeedsTwoWayRoads', 'NotAffine', W, 'NotAffine', 'NotAffine', 'NotAffine'),
  weylOrder: theory, weylDimension: theory, orbitSize: theory, longestWord: theory, minusW0: theory,
  minusculeNodes: theory, highestRoot: theory, highestShortRoot: theory, coxeterNumber: theory, wavePlay: theory,
  countCompleteGames: theory, legalLayers: theory, coroot: theory, separatingRoots: theory, choleskyBasis: theory,
};

const COLUMN: Record<string, keyof Row> = {
  oneWay2: 'oneWay', oneWay3: 'oneWay', finite: 'finite', affine: 'affine', indefinite: 'indefinite',
  unbalanced: 'unbalanced', unbalanced2: 'unbalanced', disconnected: 'disconnected',
};

// Functions whose null is one of their ordinary values (an odd cycle, no affine name, every subset finite,
// a simply laced board, det C = 0): for these a null counts as 'works'.
const NULL_IS_A_VALUE = new Set(['bipartition', 'identifyAffine', 'smallestNonfiniteSubboard', 'highestShortRoot', 'toPopulation']);

function outcome(call: Call, b: AnyBoard, fn = ''): { cell: Cell; detail: string } {
  try {
    const r = call(b);
    if (r === null) {
      const oneWay = b.kind === 'one-way';
      return NULL_IS_A_VALUE.has(fn) && !oneWay ? { cell: 'works', detail: 'null (a value)' } : { cell: 'null', detail: 'null' };
    }
    if (r === undefined) return { cell: 'undefined', detail: 'undefined' };
    return { cell: 'works', detail: 'works' };
  } catch (e) {
    const err = e as Error;
    const cls = err.constructor.name;
    let detail = cls;
    if (!(err instanceof E.EngineError)) detail += ' (not an EngineError)';
    if (err.name !== cls) detail += ` (name ${err.name})`;
    return { cell: detail, detail: `${detail}: ${err.message}` };
  }
}

describe('RT-03 attack 7: the error matrix of SPEC.md 5.6', () => {
  it('every exported board function has a row', () => {
    const fns = Object.entries(E)
      .filter(([, v]) => typeof v === 'function' && !/^[A-Z]/.test(v.name))
      .map(([k]) => k);
    const boardless = new Set([
      'cartan', 'boardFromName', 'fromAdjacency', 'boardKind', 'rat', 'ratAdd', 'ratSub', 'ratMul', 'ratDiv', 'ratNeg',
      'ratEq', 'ratSign', 'ratToString', 'solve', 'inverse', 'wordTo', 'affineCandidates', 'nullVector', 'twistedAEven',
      'exponentsFromFired', 'requireGcm', 'requireConnected', 'requireFinite', 'requireAffine', 'adjacency', 'toLabels',
      'toPositions', 'cartanNumbers',
    ]);
    expect(fns.filter((f) => !boardless.has(f) && !(f in calls))).toEqual([]);
  });

  it('each cell', () => {
    const failures: string[] = [];
    const matrix: string[] = [];
    for (const [fn, call] of Object.entries(calls)) {
      const cells: string[] = [];
      for (const [bname, b] of Object.entries(boards)) {
        const want = expected[fn]![COLUMN[bname]!];
        const got = outcome(call, b, fn);
        cells.push(`${bname}=${got.cell}`);
        if (got.cell !== want) failures.push(`${fn} on ${bname}: expected ${want}, got ${got.detail}`);
      }
      matrix.push(`${fn}: ${cells.join(' ')}`);
    }
    // eslint-disable-next-line no-console
    console.log(matrix.join('\n'));
    expect(failures).toEqual([]);
  });

  it('NotAffine names the class; classify records', () => {
    try {
      E.marks(boards.indefinite!);
    } catch (e) {
      expect((e as Error).message).toContain('indefinite');
    }
    try {
      E.marks(boards.finite!);
    } catch (e) {
      expect((e as Error).message).toContain('finite');
    }
    const ow = E.classify(boards.oneWay2!);
    expect(ow).toEqual([{ nodes: [0, 1], kind: 'one-way', balanced: false, class: null, name: null }]);
    expect(E.components(boards.oneWay3! as Board<bigint>).length).toBe(1);
    const tri = E.classify(boards.affine!);
    expect(tri.length).toBe(1);
    expect(tri[0]!.class).toBe('affine');
    expect(tri[0]!.marks).toEqual([1, 1, 1]);
    expect(tri[0]!.comarks).toEqual([1, 1, 1]);
    for (const b of [boards.indefinite!, boards.unbalanced!, boards.unbalanced2!]) expect(E.classify(b)[0]!.class).toBe('indefinite');
    expect(E.classify(boards.unbalanced!)[0]!.balanced).toBe(false);
    expect(E.classify(boards.disconnected!).length).toBe(2);
    expect(E.toPopulation(boards.affine as Board<bigint>, [1n, 0n, 0n])).toBe(null);
    expect(E.toPopulation(boards.indefinite as Board<bigint>, [1n, 0n])).not.toBe(null);
  });
});

describe('RT-03 attack 8: guards follow classify, not the name', () => {
  function permuted(b: AnyBoard, perm: number[]): AnyBoard {
    const A = E.adjacency(b);
    return E.fromAdjacency(perm.map((i) => perm.map((j) => A[i]![j]!)));
  }
  it('a permuted B3, A2 beside A1, and a custom triangle', () => {
    const b3 = permuted(E.boardFromName('B3'), [2, 0, 1]);
    expect(b3.name).toBeUndefined();
    expect(E.weylOrder(b3)).toBe(48);
    expect(E.longestWord(b3).length).toBe(9);
    expect(E.highestRoot(b3).map(Number).sort()).toEqual([1, 2, 2]);
    const a2a1 = fromCartan([[2, -1, 0], [-1, 2, 0], [0, 0, 2]]);
    expect(E.weylOrder(a2a1)).toBe(12);
    expect(E.longestWord(a2a1).length).toBe(4);
    expect(() => E.highestRoot(boards.affine!)).toThrow(E.NotFiniteType);
  });
  it('the verdict is not reused across board objects', () => {
    const fin = fromCartan([[2, -1, 0], [-1, 2, -1], [0, -1, 2]]);
    E.classify(fin);
    E.highestRoot(fin);
    const aff = fromCartan([[2, -1, -1], [-1, 2, -1], [-1, -1, 2]]);
    expect(() => E.highestRoot(aff)).toThrow(E.NotFiniteType);
  });
});
