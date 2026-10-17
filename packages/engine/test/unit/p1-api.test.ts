// The public API of phase 1 (P1-A1 instruction 5.9, 5.12): every name of section 1 and the four types are
// exported from src/index.ts; no function changes its arguments (deep-frozen inputs, one call each); the
// results of play, orbitGraph and roots share no array with their inputs (E-5). No golden key.
import { describe, expect, it } from 'vitest';
import * as api from '../../src/index';
import type { Enumeration, OrbitGraph, PlayResult, Rational } from '../../src/index';
import { bigBoard, ones, unitVectors } from '../helpers/p1';
import { boardOf } from '../golden/_harness';

const PHASE_1_NAMES = [
  'components', 'transposeBoard', 'subBoard',
  'determinant', 'solve', 'inverse',
  'rat', 'ratAdd', 'ratSub', 'ratMul', 'ratDiv', 'ratNeg', 'ratEq', 'ratSign', 'ratToString',
  'mutationMatrix', 'firingMatrix', 'toNumbers', 'toPopulation', 'applyWord', 'legalNodes', 'raisingNodes',
  'play', 'raisingPlay', 'kostantPlay',
  'orbit', 'orbitGraph', 'wordTo', 'roots', 'positiveRoots',
  'highestRoot', 'highestShortRoot', 'coxeterNumber', 'longestWord', 'minusW0', 'minusculeNodes',
] as const;

// Phase 2 (P2-A1): the names appended to index.ts (CONTRACTS.md 2.1 and 2.4 phase 2, plus the plan's
// nullVector, twistedAEven and the four require* guards). Added here so that the pinned list stays exact.
const PHASE_2_NAMES = [
  'symmetrizer', 'gram', 'cartanClass', 'relabellings', 'identify', 'affineCandidates', 'identifyAffine',
  'classify', 'smallestNonfiniteSubboard', 'spectralRadius',
  'affineExtension', 'nullVector', 'marks', 'comarks', 'level', 'twistedAEven',
  'formValue', 'formIsInvariant', 'isRootPopulation', 'coroot',
  'requireGcm', 'requireConnected', 'requireFinite', 'requireAffine',
  'playFate',
] as const;

// Phase 3 (stage 3.1, MERGE on the requests of P3-A1 and P3-A2): the names of weyl.ts, heaps.ts and
// geometry.ts, pinned here as the earlier phases are.
const PHASE_3_NAMES = [
  'bipartition', 'separatingRoots', 'wavePlay', 'exponentsFromFired', 'weylOrder', 'orbitSize', 'weylDimension',
  'countCompleteGames', 'legalLayers', 'heap', 'heapKey', 'commutationClassSize', 'symbolicPlay', 'allCompleteGames',
  'choleskyBasis',
] as const;

// Phase 4 (P4-A1, an edit pre-approved by the orchestrator): the names of fold.ts, restrictedType.ts, the
// phase-4 additions of geometry.ts and wythoff.ts, pinned here as the earlier phases are.
const PHASE_4_NAMES = [
  'symmetries', 'fold', 'averagedRootsType', 'averagedSimpleCartan', 'classifyRestricted',
  'symEig', 'euclideanBasis', 'coxeterPlanePoints', 'coxeterPlaneRings', 'coxeterWord', 'applyWordFloat',
  'wythoffFaceTypes', 'wythoffFVector', 'wythoffEdges',
] as const;

const PHASE_0_NAMES = [
  'SafeInt', 'Big', 'EngineError', 'NotABoard', 'NeedsTwoWayRoads', 'NeedsConnectedBoard', 'NotFiniteType',
  'NotAffine', 'NotAdmissible', 'EngineOverflow', 'CAPS', 'cartan', 'boardFromName', 'fromAdjacency',
  'adjacency', 'boardKind', 'toLabels', 'toPositions', 'cartanNumbers', 'mutate', 'fire',
] as const;

function frozen<T>(v: T[]): readonly T[] {
  return Object.freeze(v);
}

describe('exports of src/index.ts', () => {
  it('has every phase-1 function of P1-A1 instruction section 1, after every phase-0 name', () => {
    for (const n of PHASE_1_NAMES) expect(typeof (api as Record<string, unknown>)[n]).toBe('function');
    for (const n of PHASE_0_NAMES) expect(api).toHaveProperty(n);
    for (const n of PHASE_2_NAMES) expect(typeof (api as Record<string, unknown>)[n]).toBe('function');
    for (const n of PHASE_3_NAMES) expect(typeof (api as Record<string, unknown>)[n]).toBe('function');
    for (const n of PHASE_4_NAMES) expect(typeof (api as Record<string, unknown>)[n]).toBe('function');
    expect(Object.keys(api).sort()).toEqual(
      [...PHASE_0_NAMES, ...PHASE_1_NAMES, ...PHASE_2_NAMES, ...PHASE_3_NAMES, ...PHASE_4_NAMES].sort(),
    );
  });

  it('exports the four types (checked by tsc on this file)', () => {
    const r: Rational = api.rat(1, 2);
    const e: Enumeration<number[]> = api.roots(boardOf('A1'), 10);
    const g: OrbitGraph<number> = api.orbitGraph(boardOf('A1'), [[1]], 'mutation', 10);
    const p: PlayResult<number> = api.play(boardOf('A1'), [1]);
    expect(r.den).toBe(2n);
    expect(e.items.length).toBe(2);
    expect(g.items.length).toBe(2);
    expect(p.moves).toBe(1);
  });
});

describe('no function changes its arguments', () => {
  it('every phase-1 function accepts deep-frozen inputs', () => {
    const b = boardOf('B3'); // frozen by the engine
    expect(Object.isFrozen(b)).toBe(true);
    expect(Object.isFrozen(b.cartan)).toBe(true);
    const p = frozen([1, 2, 2]);
    const a = frozen([1, 1, 1]);
    const word = frozen([0, 1, 0]);
    const nodes = frozen([2, 0]);
    const seeds = frozen([frozen([1, 0, 0]), frozen([0, 1, 0])]);
    const M = frozen([frozen([2, -1]), frozen([-1, 2])]);
    const rhs = frozen([1, 0]);
    const q = api.rat(1, 2);
    Object.freeze(q);
    expect(api.components(b)).toEqual([[0, 1, 2]]);
    expect(api.transposeBoard(b).name).toBe('C3');
    expect([...api.subBoard(b, nodes).labels]).toEqual([1, 3]);
    expect(api.determinant(M)).toEqual(api.rat(3));
    expect(api.solve(M, rhs)).not.toBeNull();
    expect(api.inverse(M)).not.toBeNull();
    expect(api.ratAdd(q, q)).toEqual(api.rat(1));
    expect(api.ratSub(q, q)).toEqual(api.rat(0));
    expect(api.ratMul(q, q)).toEqual(api.rat(1, 4));
    expect(api.ratDiv(q, q)).toEqual(api.rat(1));
    expect(api.ratNeg(q)).toEqual(api.rat(-1, 2));
    expect(api.ratEq(q, q)).toBe(true);
    expect(api.ratSign(q)).toBe(1);
    expect(api.ratToString(q)).toBe('1/2');
    expect(api.mutationMatrix(b, 1).length).toBe(3);
    expect(api.firingMatrix(b, 1).length).toBe(3);
    expect(api.toNumbers(b, p)).toEqual([0, 1, 0]);
    expect(api.toPopulation(b, a)).not.toBeNull();
    // B3: two roads from node 2 to node 3, so firing node 2 on (-1, 2, 1) gives (1, -2, 5)
    expect(api.applyWord(b, a, word, 'firing')).toEqual([-1, -1, 5]);
    expect(api.legalNodes(b, a)).toEqual([0, 1, 2]);
    expect(api.raisingNodes(b, frozen([1, 0, 0]))).toEqual([1]);
    expect(api.play(b, a).status).toBe('ended');
    expect(api.raisingPlay(b, frozen([1, 0, 0])).status).toBe('ended');
    expect(api.kostantPlay(b, 0).status).toBe('ended');
    // the orbit of the two long simple roots of B3 is the 12 long roots
    expect(api.orbit(b, seeds, 'mutation', 100).items.length).toBe(12);
    const g = api.orbitGraph(b, seeds, 'mutation', 100);
    expect(api.wordTo(g, 5).length).toBe(g.depth[5]);
    expect(api.roots(b, 100).items.length).toBe(18);
    expect(api.positiveRoots(b).length).toBe(9);
    expect(api.highestRoot(b)).toEqual([1, 2, 2]);
    expect(api.highestShortRoot(b)).toEqual([1, 1, 1]);
    expect(api.coxeterNumber(b)).toBe(6);
    expect(api.longestWord(b, nodes)).toEqual([0, 2]);
    expect(api.minusW0(b)).toEqual([0, 1, 2]);
    expect(api.minusculeNodes(b)).toEqual([2]);
    expect(p).toEqual([1, 2, 2]);
    expect(a).toEqual([1, 1, 1]);
    expect(word).toEqual([0, 1, 0]);
    expect(nodes).toEqual([2, 0]);
    expect(seeds).toEqual([[1, 0, 0], [0, 1, 0]]);
    expect(q).toEqual({ num: 1n, den: 2n });
  });

  it('the Big board and its vectors survive too', () => {
    const b = bigBoard([[2, -1, -1], [-1, 2, -1], [-1, -1, 2]]);
    const v = frozen([1n, 1n, 1n]);
    expect(api.play(b, v, undefined, 5).status).toBe('cap');
    expect(api.raisingPlay(b, frozen([1n, 0n, 0n]), undefined, 5).status).toBe('cap');
    expect(api.orbitGraph(b, [v], 'firing', 50, 3, true).truncated).toBe(false);
    expect(api.roots(b, 50, 2).items.length).toBe(15);
    expect(api.toPopulation(b, v)).toBeNull();
    expect(v).toEqual([1n, 1n, 1n]);
  });
});

describe('results share no array with the inputs', () => {
  it('play', () => {
    const b = boardOf('A2');
    const a = [1, 1];
    const r = api.play(b, a);
    expect(r.position).not.toBe(a);
    const ended = api.play(b, [-1, 0]);
    const start = [-1, 0];
    const same = api.play(b, start);
    expect(same.position).not.toBe(start);
    expect(ended.position).toEqual([-1, 0]);
    const z = api.raisingPlay(b, start);
    expect(z.position).not.toBe(start);
    const w = api.applyWord(b, start, [], 'firing');
    expect(w).not.toBe(start);
    expect(w).toEqual(start);
  });

  it('orbitGraph and roots', () => {
    const b = boardOf('A2');
    const seeds = unitVectors(b);
    const g = api.orbitGraph(b, seeds, 'mutation', 100);
    for (const s of seeds) for (const item of g.items) expect(item).not.toBe(s);
    expect(g.items).not.toBe(seeds);
    const first = api.roots(b, 100);
    const second = api.roots(b, 100);
    for (let k = 0; k < first.items.length; k++) expect(first.items[k]).not.toBe(second.items[k]);
    const o = api.orbit(b, [ones(b)], 'firing', 100);
    expect(o.items).toEqual(api.orbitGraph(b, [ones(b)], 'firing', 100).items);
  });
});
