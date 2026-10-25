// P5-A2: tool T12, the Representation Builder (SPEC.md 4 T12, 2.18, 2.7 F11, 4.0, 5.6, 6.6, E-5, E-7, E-9).
// The acceptance of SPEC 4 T12 over the 18 records of the golden key `minuscule_representations`, through
// the tool's own pure functions in site/src/components/tools/t12/model.ts (which re-exports t12/rep.ts),
// plus the plan's checks (instruction section 6), MatrixView's helpers and the server render of
// T12RepresentationBuilder.svelte.
//
// Golden records come from the harness of P0-A2 (packages/engine/test/golden/_harness.ts): `golden`,
// `matchRecord` (rule 5), `labels` (rule 2), `TYPE_NAMES`. This file never calls `covers`: the key
// `minuscule_representations` is tested in exactly one golden file, P5-A1's (CONTRACTS 3). Every value
// expected below is read from the golden file or computed by the engine; the only matrices typed are the
// worked values of the instruction (sections 5.4 and 5.8), which the oracle printed for A2 and A1.
//
// Properties of T12 beyond the common ones of 4.0 Configuration (id, board, coords, start, moves,
// prediction, preset, caption): `node` (a label, 6.6 `k`) and `relation` (a code with labels, 6.6 `q`).
// `linkTo` and `layers` are accepted and ignored.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CAPS,
  EngineOverflow,
  boardFromName,
  chevalleySerre,
  fire,
  minusculeMatrices,
  minusculeNodes,
  orbitSize,
  play,
  signedMoves,
  spAdd,
  spEq,
  spKey,
  spMul,
  stringThrough,
  toLabels,
  toPositions,
} from '@engine';
import type { AnyBoard, Board, RelationCheck, SparseMatrix } from '@engine';
import { TYPE_NAMES, golden, labels as harnessLabels, matchRecord } from '../../../../packages/engine/test/golden/_harness';
import { T12_BOARDS, T12_CONDITIONAL_OUTS, T12_OUTS, T12_PRESETS } from '../../../src/components/tools/t12/config';
import {
  DRAW_MAX,
  REP_ENGINE,
  RELATIONS,
  RELATIONS_MAIN_WORK,
  STRING_SHOWN_MAX,
  T12Tool,
  acceptRelations,
  addMatrices,
  addSignedMoves,
  admitLink,
  basisHeaders,
  buildRepresentation,
  byPosition,
  captionOf,
  configOf,
  configuredState,
  defaultNode,
  defaultRelation,
  defaultsFor,
  entryList,
  explanation,
  exportData,
  failingDefault,
  findRelation,
  firstFailing,
  forgetRepresentations,
  inArithmetic,
  interaction,
  largestAt,
  limitSentence,
  linkNames,
  listOnMain,
  matrixFormat,
  minusculeLabels,
  moveSentence,
  noMinusculeSentence,
  orbitDrawing,
  orbitLayers,
  parseRelationCode,
  pickSentence,
  positionText,
  relationCaption,
  relationCode,
  relationCount,
  relationDigest,
  relationLabels,
  relationParts,
  relationSpoken,
  relationSummary,
  relationTally,
  relationText,
  relationWork,
  relationsNow,
  relationsOnMain,
  repCaption,
  representationDimension,
  representationOf,
  representationSteps,
  routedCalls,
  shownCheck,
  someNumberPhrase,
  startRepresentation,
  stringCaption,
  stringNote,
  stringView,
  undoSentence,
  type RepEngine,
  type Step,
} from '../../../src/components/tools/t12/model';
import { bigBoard } from '../../../src/lib/state';
import { resolveGoldenPath } from '../../../src/lib/golden';
import T12 from '../../../src/tools/registry/T12';
import { LINK_NOTICE, encodeState } from '../../../src/lib/urlCodec';
import { exportJSON } from '../../../src/lib/export';
import { whereToRun } from '../../../src/lib/worker';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

interface MinusculeRecord {
  type: string;
  node: number;
  dimension: number;
  weights_dynkin_labels: number[][] | null;
}
const RECORDS = golden.minuscule_representations as MinusculeRecord[];

const named = (name: string): Board<number> => boardFromName(name) as Board<number>;
const pos = (board: AnyBoard, label: number): number => toPositions(board, [label])[0]!;
const labelOrderPositions = (board: AnyBoard): number[] => toPositions(board, [...board.labels].sort((a, b) => a - b));
/** A vector by position in label order (the order of the golden vectors and of every vector the tool shows). */
const inLabels = <V>(board: AnyBoard, v: readonly V[]): V[] => labelOrderPositions(board).map((p) => v[p]!);
/** omega_i at a position, by position. */
const omegaAt = (board: AnyBoard, p: number): number[] => Array.from({ length: board.n }, (_, k) => (k === p ? 1 : 0));
const sparse = (entries: Record<string, number>): SparseMatrix => new Map(Object.entries(entries).map(([k, v]) => [k, BigInt(v)]));
/** P_k^0 of the basis: 1 on the diagonal where the number at position k is 0 (SPEC 2.18). */
const projector = (basis: readonly (readonly number[])[], k: number): SparseMatrix => {
  const m: SparseMatrix = new Map();
  basis.forEach((v, r) => {
    if (v[k] === 0) m.set(spKey(r, r), 1n);
  });
  return m;
};
/** (-1)^{H_k} on the basis: -1 where the number at position k is odd, 1 where it is even (SPEC 2.18). */
const minusOneToH = (basis: readonly (readonly number[])[], k: number): SparseMatrix => {
  const m: SparseMatrix = new Map();
  basis.forEach((v, r) => m.set(spKey(r, r), Math.abs(v[k]!) % 2 === 1 ? -1n : 1n));
  return m;
};

// ---------------------------------------------------------------------------------------------
// SPEC 4 T12 acceptance over the 18 records
// ---------------------------------------------------------------------------------------------

describe('T12 acceptance over minuscule_representations', () => {
  it('for every minuscule_representations record the tool\'s dimension equals the golden dimension and the basis equals weights_dynkin_labels', () => {
    expect(RECORDS).toHaveLength(18);
    for (const rec of RECORDS) {
      const board = named(rec.type);
      const rep = buildRepresentation(board, rec.node);
      expect(rep.built, rec.type).toBe(true);
      expect(rep.minuscule, `${rec.type} node ${rec.node}`).toBe(true);
      expect(rep.basis!.length, `${rec.type} node ${rec.node}`).toBe(rec.dimension);
      expect(rep.orbitSize).toBe(rec.dimension);
      expect(rep.orbitSize).toBe(orbitSize(board, omegaAt(board, pos(board, rec.node))));
      // Rule 7: the weights are compared where they are stored (null above dimension 27).
      if (rec.weights_dynkin_labels !== null) expect(rep.basis!.map((v) => inLabels(board, v)), `${rec.type} node ${rec.node}`).toEqual(rec.weights_dynkin_labels);
      // The record is found by type and node (rule 5), and its node is a label (rule 2).
      expect(matchRecord(RECORDS, { type: rec.type, node: rec.node })).toBe(rec);
      expect(harnessLabels(board, [rep.position])).toEqual([rec.node]);
    }
  });

  it('for every listed representation every RelationCheck holds and the tool reports all relations holding', () => {
    for (const rec of RECORDS) {
      const board = named(rec.type);
      const rep = buildRepresentation(board, rec.node);
      const n = board.n;
      // Up to RELATIONS_MAIN_WORK (positions times records) the browser computes the list on the main thread;
      // above (E6, E7 node 7, ...) the worker makes the same engine call, run here in-process.
      expect(relationsOnMain(rep.orbitSize, n), rec.type).toBe(rep.orbitSize * (6 * n * n - 2 * n) <= RELATIONS_MAIN_WORK);
      expect(rep.checks!.length).toBe(6 * n * n - 2 * n);
      for (const c of rep.checks!) {
        expect(c.holds, `${rec.type} node ${rec.node}: ${relationCode(board, c)}`).toBe(true);
        expect(spEq(c.left, c.right)).toBe(true);
      }
      expect(relationSummary(rep.checks!)).toBe(`All ${6 * n * n - 2 * n} relations hold.`);
      expect(explanation(rep)).toBe(`Node ${rec.node} is minuscule: every number in the orbit of e${rec.node} is −1, 0 or 1, and all the relations hold.`);
    }
  });

  it('D4 node 2 builds 24 positions, some relation fails, the default relation is a failing one and the explanation says some number in the orbit is 2', () => {
    const D4 = named('D4');
    const rep = buildRepresentation(D4, 2);
    expect(rep.minuscule).toBe(false);
    expect(rep.built).toBe(true);
    expect(rep.basis!.length).toBe(golden.types.D4!.fundamental_orbit_sizes[1]);
    expect(rep.basis!.length).toBe(24);
    expect(rep.checks!.some((c) => !c.holds)).toBe(true);
    // The worked value of the instruction (5.6), from the oracle: exactly the ef relations fail, at these labels.
    const failing = rep.checks!.filter((c) => !c.holds).map((c) => relationCode(D4, c));
    expect(failing).toEqual(['ef:1,1', 'ef:1,2', 'ef:2,1', 'ef:2,2', 'ef:2,3', 'ef:2,4', 'ef:3,2', 'ef:3,3', 'ef:4,2', 'ef:4,4']);
    expect(relationSummary(rep.checks!)).toBe('10 of 88 relations fail.');
    // The default relation is the first failing check in the engine's order: ef:1,1.
    expect(defaultRelation(rep)).toBe(relationCode(D4, firstFailing(rep.checks!)!));
    expect(defaultRelation(rep)).toBe('ef:1,1');
    expect(findRelation(rep.checks!, D4, defaultRelation(rep))!.holds).toBe(false);
    // The number comes from legal play from omega_2 (F11's third condition): the first number fired above 1.
    const fired = play(D4, omegaAt(D4, pos(D4, 2))).fired;
    const first = fired.find((x) => x > 1)!;
    expect(first).toBe(2);
    expect(rep.firstLarge).toEqual({ value: first, move: fired.findIndex((x) => x > 1) + 1 });
    expect(explanation(rep)).toContain(someNumberPhrase(2));
    expect(explanation(rep)).toContain('some number in the orbit is 2');
    expect(explanation(rep)).toBe(
      `Node 2 is not minuscule: some number in the orbit is 2 (legal play from e2 fires a 2 at move ${rep.firstLarge!.move}), so the steps E and F of the recipe miss some moves and the relations fail.`,
    );
    expect(someNumberPhrase(2)).toBe('some number in the orbit is 2');
    expect(repCaption(rep)).toContain('some number in the orbit is 2');
  });

  it('B3 node 3 and C3 node 1 build 8 and 6 positions with every relation holding (firing, not mutation)', () => {
    for (const [type, node] of [['B3', 3], ['C3', 1]] as const) {
      const board = named(type);
      const rep = buildRepresentation(board, node);
      const rec = matchRecord(RECORDS, { type, node });
      expect(rep.basis!.length).toBe(rec.dimension);
      expect(rep.checks!.every((c) => c.holds)).toBe(true);
      // Each move is fire: the image of a basis vector under moves[k] is fire(basis vector, k).
      rep.basis!.forEach((v, r) => {
        for (let k = 0; k < board.n; k++) {
          const image = fire(board, v, k);
          const c = rep.basis!.findIndex((w) => w.join(',') === image.join(','));
          expect(rep.moves![k]!.get(spKey(c, r))).toBe(1n);
        }
      });
    }
    expect(buildRepresentation(named('B3'), 3).basis!.length).toBe(8);
    expect(buildRepresentation(named('C3'), 1).basis!.length).toBe(6);
  });

  it('G2 node 2 fails with some number in the orbit is 3; boards with no minuscule node say so', () => {
    const G2 = named('G2');
    const rep = buildRepresentation(G2, 2);
    const fired = play(G2, omegaAt(G2, pos(G2, 2))).fired;
    const m = fired.find((x) => x > 1)!;
    expect(m).toBe(3);
    expect(explanation(rep)).toContain(someNumberPhrase(m));
    expect(rep.checks!.some((c) => !c.holds)).toBe(true);
    for (const name of ['E8', 'F4', 'G2']) {
      const r = buildRepresentation(named(name), 1);
      expect(golden.types[name]!.minuscule_nodes).toEqual([]);
      expect(noMinusculeSentence(r)).toBe('This board has no minuscule node, so the recipe of this tool builds none of its representations.');
    }
    expect(noMinusculeSentence(buildRepresentation(named('A2'), 1))).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// The cap of 5.6 and the agreement of F11 with the relations
// ---------------------------------------------------------------------------------------------

describe('T12 cap and verdict', () => {
  /** The engine with a counter on each call (the spy of the instruction, section 6). */
  function counting(): { engine: RepEngine; calls: Record<string, number> } {
    const calls: Record<string, number> = {};
    const count = <F extends (...a: never[]) => unknown>(name: string, f: F): F =>
      ((...a: never[]) => {
        calls[name] = (calls[name] ?? 0) + 1;
        return f(...a);
      }) as F;
    const engine: RepEngine = {
      minusculeNodes: count('minusculeNodes', REP_ENGINE.minusculeNodes),
      orbitSize: count('orbitSize', REP_ENGINE.orbitSize),
      play: count('play', REP_ENGINE.play),
      minusculeMatrices: count('minusculeMatrices', REP_ENGINE.minusculeMatrices),
      signedMoves: count('signedMoves', REP_ENGINE.signedMoves),
      chevalleySerre: count('chevalleySerre', REP_ENGINE.chevalleySerre),
    };
    return { engine, calls };
  }

  it('nodes whose orbit exceeds 2000 positions get the explanation alone and minusculeMatrices is not called', () => {
    const cases: [string, number][] = [['E7', 3], ['E7', 4], ['E7', 5], ...[1, 2, 3, 4, 5, 6, 7].map((k) => ['E8', k] as [string, number])];
    for (const [type, node] of cases) {
      const board = named(type);
      const size = golden.types[type]!.fundamental_orbit_sizes[pos(board, node)]!;
      expect(size, `${type} node ${node}`).toBeGreaterThan(CAPS.repOrbit);
      const { engine, calls } = counting();
      const rep = buildRepresentation(board, node, { engine });
      expect(rep.built).toBe(false);
      expect(rep.orbitSize).toBe(size);
      expect(calls.minusculeMatrices ?? 0, `${type} node ${node}`).toBe(0);
      expect(calls.chevalleySerre ?? 0).toBe(0);
      expect(calls.signedMoves ?? 0).toBe(0);
      expect(rep.basis).toBeNull();
      expect(rep.checks).toBeNull();
      expect(limitSentence(rep)).toBe(`The orbit of e${node} has ${size} positions, more than 2000, so the matrices are not built here.`);
      expect(explanation(rep)).toContain(someNumberPhrase(rep.firstLarge!.value));
      expect(() => orbitLayers(rep)).toThrow(RangeError);
    }
    // At or below the cap the matrices are built: E8 node 8 (240) builds and fails, E7 node 7 builds.
    const { engine, calls } = counting();
    const e8 = buildRepresentation(named('E8'), 8, { engine });
    expect(e8.built).toBe(true);
    expect(calls.minusculeMatrices).toBe(1);
    expect(limitSentence(e8)).toBeNull();
    expect(e8.basis!.length).toBe(golden.types.E8!.fundamental_orbit_sizes[7]);
  });

  it('on every node built, minusculeNodes agrees with whether every relation holds (orbits of at most 600 positions)', () => {
    // The orbits above 600 positions (17 of them, up to 1792) are left out to keep the parallel suite
    // short (instruction, section 6); a run of the oracle for the plan found a failing relation on every
    // node that is not minuscule with an orbit of at most 600 positions.
    let built = 0;
    let failingSeen = 0;
    for (const type of TYPE_NAMES) {
      const board = named(type);
      const minuscule = minusculeNodes(board);
      expect(minusculeLabels(board)).toEqual(toLabels(board, minuscule).sort((a, b) => a - b));
      for (let p = 0; p < board.n; p++) {
        const size = golden.types[type]!.fundamental_orbit_sizes[p]!;
        if (size > 600) continue;
        const label = toLabels(board, [p])[0]!;
        const rep = buildRepresentation(board, label);
        built++;
        const allHold = rep.checks!.every((c) => c.holds);
        expect(allHold, `${type} node ${label}`).toBe(minuscule.includes(p));
        expect(rep.minuscule).toBe(minuscule.includes(p));
        expect(rep.minuscule).toBe(golden.types[type]!.minuscule_nodes.includes(label));
        if (!allHold) failingSeen++;
      }
    }
    const expected = TYPE_NAMES.reduce((s, t) => s + golden.types[t]!.fundamental_orbit_sizes.filter((x) => x <= 600).length, 0);
    expect(built).toBe(expected);
    expect(built).toBeGreaterThan(100);
    expect(failingSeen).toBe(built - TYPE_NAMES.reduce((s, t) => s + golden.types[t]!.minuscule_nodes.length, 0));
  });

  it('the default node is the smallest minuscule label, else 1', () => {
    expect(defaultNode(named('E7'))).toBe(7);
    expect(defaultNode(named('D4'))).toBe(1);
    expect(defaultNode(named('B3'))).toBe(3);
    for (const name of ['E8', 'F4', 'G2']) expect(defaultNode(named(name))).toBe(1);
    for (const type of TYPE_NAMES) {
      const m = golden.types[type]!.minuscule_nodes;
      expect(defaultNode(named(type))).toBe(m.length > 0 ? Math.min(...m) : 1);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Matrices: worked values, the signed move, the format
// ---------------------------------------------------------------------------------------------

describe('T12 matrices', () => {
  it('A2 node 1 and A1 node 1: the worked matrices of the instruction (row the image, column the source)', () => {
    const A2 = named('A2');
    const rep = buildRepresentation(A2, 1);
    expect(rep.basis).toEqual([[1, 0], [0, -1], [-1, 1]]);
    const e1 = pos(A2, 1);
    const e2 = pos(A2, 2);
    expect(spEq(rep.E![e1]!, sparse({ '0,2': 1 }))).toBe(true);
    expect(spEq(rep.F![e1]!, sparse({ '2,0': 1 }))).toBe(true);
    expect(spEq(rep.H![e1]!, sparse({ '0,0': 1, '2,2': -1 }))).toBe(true);
    expect(spEq(rep.E![e2]!, sparse({ '2,1': 1 }))).toBe(true);
    expect(spEq(rep.F![e2]!, sparse({ '1,2': 1 }))).toBe(true);
    expect(spEq(rep.H![e2]!, sparse({ '1,1': -1, '2,2': 1 }))).toBe(true);
    expect(entryList(rep.E![e1]!)).toEqual([[1, 3, 1n]]);
    const A1 = buildRepresentation(named('A1'), 1);
    expect(A1.basis).toEqual([[1], [-1]]);
    expect(spEq(A1.E![0]!, sparse({ '0,1': 1 }))).toBe(true);
    expect(spEq(A1.F![0]!, sparse({ '1,0': 1 }))).toBe(true);
    expect(spEq(A1.H![0]!, sparse({ '0,0': 1, '1,1': -1 }))).toBe(true);
  });

  it('signed move on A2 node 1 equals E - F + P0, and its square is (-1)^H on every listed representation', () => {
    const A2 = named('A2');
    const rep = buildRepresentation(A2, 1);
    const k = pos(A2, 1);
    expect(spEq(rep.moves![k]!, sparse({ '0,2': 1, '1,1': 1, '2,0': 1 }))).toBe(true);
    expect(spEq(rep.signed![k]!, sparse({ '0,2': 1, '1,1': 1, '2,0': -1 }))).toBe(true);
    expect(spEq(spMul(rep.signed![k]!, rep.signed![k]!), sparse({ '0,0': -1, '1,1': 1, '2,2': -1 }))).toBe(true);
    for (const rec of RECORDS) {
      const board = named(rec.type);
      const r = buildRepresentation(board, rec.node);
      for (let q = 0; q < board.n; q++) {
        const P0 = projector(r.basis!, q);
        expect(spEq(r.signed![q]!, spAdd(spAdd(r.E![q]!, r.F![q]!, -1n), P0)), `${rec.type} ${q}`).toBe(true);
        expect(spEq(r.moves![q]!, spAdd(spAdd(r.E![q]!, r.F![q]!), P0))).toBe(true);
        expect(spEq(spMul(r.signed![q]!, r.signed![q]!), minusOneToH(r.basis!, q))).toBe(true);
      }
    }
    expect(signedMoves(rep.basis!, rep.E!, rep.F!).every((m, q) => spEq(m, rep.signed![q]!))).toBe(true);
  });

  it('grids up to dimension 27 inclusive, lists above (5.6)', () => {
    expect(matrixFormat(27)).toBe('grid');
    expect(matrixFormat(CAPS.matrixGridDim)).toBe('grid');
    expect(matrixFormat(28)).toBe('list');
    expect(matrixFormat(56)).toBe('list');
    expect(matrixFormat(buildRepresentation(named('E6'), 1).basis!.length)).toBe('grid');
    expect(matrixFormat(buildRepresentation(named('E7'), 7).basis!.length)).toBe('list');
  });
});

// ---------------------------------------------------------------------------------------------
// The orbit in layers
// ---------------------------------------------------------------------------------------------

describe('T12 orbit in layers', () => {
  it('orbit layers: layer 0 is omega_i, every edge on a minuscule orbit joins adjacent layers and is an entry of F_k', () => {
    for (const rec of RECORDS) {
      const board = named(rec.type);
      const rep = buildRepresentation(board, rec.node);
      const o = orbitLayers(rep);
      expect(o.drawn).toBe(true);
      expect(o.vertices.length).toBe(rec.dimension);
      const zero = o.vertices.filter((v) => v.depth === 0);
      expect(zero.map((v) => v.values)).toEqual([omegaAt(board, rep.position)]);
      expect(o.layerSizes.reduce((a, b) => a + b, 0)).toBe(rec.dimension);
      expect(o.edges.length).toBeGreaterThan(0);
      for (const e of o.edges) {
        const up = o.vertices[e.from]!;
        const down = o.vertices[e.to]!;
        expect(down.depth).toBe(up.depth + 1);
        expect(up.values[e.position]).toBe(1);
        expect(down.values[e.position]).toBe(-1);
        expect(down.values).toEqual(fire(board, up.values, e.position));
        expect(e.step).toBe(true);
        expect(e.node).toBe(toLabels(board, [e.position])[0]);
        // The edge is the entry of F_k from the upper end (column) to the lower end (row), and of E_k back.
        expect(rep.F![e.position]!.get(spKey(down.basisIndex, up.basisIndex))).toBe(1n);
        expect(rep.E![e.position]!.get(spKey(up.basisIndex, down.basisIndex))).toBe(1n);
      }
      // Each pair (mu, R_k mu) with mu_k != 0 is drawn once.
      const pairs = o.vertices.reduce((s, v) => s + v.values.filter((x) => x !== 0).length, 0);
      expect(o.edges.length * 2).toBe(pairs);
      // The drawing places layer d on row d.
      const d = orbitDrawing(o);
      expect(d.y).toEqual(o.vertices.map((v) => v.depth));
      expect(d.layers).toBe(o.layerSizes.length);
    }
    // A2 node 1: the edge (1,0) to (-1,1) is F_1 with the key "2,0".
    const A2 = named('A2');
    const rep = buildRepresentation(A2, 1);
    const o = orbitLayers(rep);
    const edge = o.edges.find((e) => o.vertices[e.from]!.values.join(',') === '1,0' && o.vertices[e.to]!.values.join(',') === '-1,1')!;
    expect(edge.node).toBe(1);
    expect(spKey(o.vertices[edge.to]!.basisIndex, o.vertices[edge.from]!.basisIndex)).toBe('2,0');
    expect(rep.F![pos(A2, 1)]!.has('2,0')).toBe(true);
    expect(o.edges.map((e) => e.node).sort()).toEqual([1, 2]);
  });

  it('on a non-minuscule orbit the edges of a number 2 are no entry of E or F (drawn dashed)', () => {
    const D4 = named('D4');
    const rep = buildRepresentation(D4, 2);
    const o = orbitLayers(rep);
    const dashed = o.edges.filter((e) => !e.step);
    expect(dashed.length).toBeGreaterThan(0);
    for (const e of dashed) {
      expect(e.value).toBe(2);
      const up = o.vertices[e.from]!;
      const down = o.vertices[e.to]!;
      expect(rep.F![e.position]!.has(spKey(down.basisIndex, up.basisIndex))).toBe(false);
      expect(rep.E![e.position]!.has(spKey(up.basisIndex, down.basisIndex))).toBe(false);
      expect(rep.moves![e.position]!.get(spKey(down.basisIndex, up.basisIndex))).toBe(1n);
    }
  });

  it('the orbit figure model draws every vertex up to 300 positions and switches to layer counts above', () => {
    expect(DRAW_MAX).toBe(CAPS.gardenDrawEverything);
    expect(DRAW_MAX).toBe(300);
    const e8 = orbitLayers(buildRepresentation(named('E8'), 8, { relations: 'later' }));
    expect(e8.vertices.length).toBe(240);
    expect(e8.drawn).toBe(true);
    expect(e8.edges.length).toBeGreaterThan(0);
    const e7 = orbitLayers(buildRepresentation(named('E7'), 2, { relations: 'later' }));
    expect(e7.vertices.length).toBe(golden.types.E7!.fundamental_orbit_sizes[1]);
    expect(e7.drawn).toBe(false);
    expect(e7.edges).toEqual([]);
    expect(e7.layerSizes.reduce((a, b) => a + b, 0)).toBe(576);
  });
});

// ---------------------------------------------------------------------------------------------
// Relations: codes, lookup by fields, formulas
// ---------------------------------------------------------------------------------------------

describe('T12 relations', () => {
  it('relationCode and parseRelationCode convert between labels and positions on every board; Serre needs two nodes', () => {
    for (const type of TYPE_NAMES) {
      const board = named(type);
      for (const relation of RELATIONS) {
        for (let i = 0; i < board.n; i++) {
          for (let j = 0; j < board.n; j++) {
            const code = relationCode(board, { relation, i, j });
            const [li, lj] = toLabels(board, [i, j]);
            expect(code).toBe(`${relation}:${li},${lj}`);
            const back = parseRelationCode(board, code);
            if ((relation === 'serre-e' || relation === 'serre-f') && i === j) expect(back).toBeNull();
            else expect(back).toEqual({ relation, i, j });
          }
        }
      }
    }
    const A2 = named('A2');
    expect(parseRelationCode(A2, 'ef:1,3')).toBeNull();
    expect(parseRelationCode(A2, 'xx:1,1')).toBeNull();
    expect(parseRelationCode(A2, 'serre-e:1,1')).toBeNull();
    expect(parseRelationCode(A2, 'ef:0,1')).toBeNull();
  });

  it('findRelation looks a check up by its fields, never by its index in the list', () => {
    const D4 = named('D4');
    const rep = buildRepresentation(D4, 2);
    const shuffled: RelationCheck[] = [...rep.checks!].reverse();
    for (const c of rep.checks!) {
      const code = relationCode(D4, c);
      expect(findRelation(shuffled, D4, code)).toBe(c);
    }
    expect(findRelation(rep.checks!, D4, 'serre-e:1,1')).toBeNull();
  });

  it('formulas of the relations with C_ij substituted, as text and as spoken names', () => {
    const A2 = named('A2');
    const t = (code: string): string => relationText(relationParts(A2, code)!);
    expect(t('ef:1,1')).toBe('[E1, F1] = H1');
    expect(t('ef:1,2')).toBe('[E1, F2] = 0');
    expect(t('hh:1,2')).toBe('[H1, H2] = 0');
    expect(t('he:1,2')).toBe('[H1, E2] = −E2');
    expect(t('he:1,1')).toBe('[H1, E1] = 2E1');
    expect(t('hf:1,2')).toBe('[H1, F2] = F2');
    expect(t('serre-e:1,2')).toBe('ad(E1)^2 E2 = 0');
    expect(t('serre-f:2,1')).toBe('ad(F2)^2 F1 = 0');
    expect(relationText(relationParts(named('A3'), 'serre-e:1,3')!)).toBe('ad(E1) E3 = 0');
    // B2: C[1][2] = -1 and C[2][1] = -2 in positions, so the exponents are 2 and 3.
    const B2 = named('B2');
    expect(relationText(relationParts(B2, 'serre-e:1,2')!)).toBe(`ad(E1)^${1 - B2.cartan[0]![1]!} E2 = 0`);
    expect(relationText(relationParts(B2, 'serre-e:2,1')!)).toBe(`ad(E2)^${1 - B2.cartan[1]![0]!} E1 = 0`);
    expect(relationSpoken(relationParts(A2, 'ef:1,1')!)).toBe('E 1 F 1 commutator equals H 1');
    expect(relationSpoken(relationParts(A2, 'he:1,2')!)).toBe('H 1 E 2 commutator equals minus E 2');
    expect(relationSpoken(relationParts(A2, 'serre-e:1,2')!)).toBe('ad E 1 to the power 2 applied to E 2 equals 0');
  });

  it('the relation list is bounded on the main thread by its work, positions times records: E6 and every list of rank 8 go to the worker', () => {
    // The bound of decisions/P5-A2.md (review P5-A2, finding 2): the work of chevalleySerre is the size of the
    // orbit times the 6n^2 - 2n records; E6 node 1 (5508) and A8 node 1 (3312) were long tasks at four times
    // slower, D6 node 1 (2448) the largest list kept on the main thread.
    expect(RELATIONS_MAIN_WORK).toBe(2500);
    expect(relationCount(6)).toBe(204);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(relationCount(n)).toBe(buildRepresentation(named(n === 1 ? 'A1' : `A${n}`), 1).checks!.length);
    let kept = 0;
    for (const type of TYPE_NAMES) {
      const board = named(type);
      golden.types[type]!.fundamental_orbit_sizes.forEach((size, p) => {
        if (size > CAPS.repOrbit) return;
        const label = toLabels(board, [p])[0]!;
        const onMain = relationsOnMain(size, board.n);
        expect(onMain, `${type} node ${label}`).toBe(relationWork(size, board.n) <= RELATIONS_MAIN_WORK);
        if (type === 'E6' || board.n === 8) expect(onMain, `${type} node ${label}`).toBe(false);
        if (onMain) kept = Math.max(kept, relationWork(size, board.n));
      });
    }
    expect(kept).toBe(12 * relationCount(6));
    expect(relationsOnMain(golden.types.D4!.fundamental_orbit_sizes[1]!, 4)).toBe(true);
    expect(relationsOnMain(golden.types.D6!.fundamental_orbit_sizes[0]!, 6)).toBe(true);
    expect(relationsOnMain(golden.types.A8!.fundamental_orbit_sizes[0]!, 8)).toBe(false);
    const e6 = buildRepresentation(named('E6'), 1, { relations: 'auto' });
    expect(listOnMain(e6)).toBe(false);
    expect(e6.checks).toBeNull();
    expect(defaultRelation(e6)).toBe('ef:1,1');
    const e7 = buildRepresentation(named('E7'), 7, { relations: 'auto' });
    expect(e7.built).toBe(true);
    expect(e7.checks).toBeNull();
    expect(defaultRelation(e7)).toBe('ef:7,7');
    const B8 = named('B8');
    const rep = buildRepresentation(B8, 8, { relations: 'auto' });
    expect(rep.built).toBe(true);
    expect(rep.checks).toBeNull();
    expect(defaultRelation(rep)).toBe('ef:8,8');
    expect(repCaption(rep)).toContain('checked in the background');
    const list = chevalleySerre(B8, rep.E!, rep.F!, rep.H!);
    expect(acceptRelations(rep, list)).toBe(true);
    expect(acceptRelations(rep, list)).toBe(false);
    expect(rep.checks!.every((c) => c.holds)).toBe(true);
    // A non-minuscule orbit above the bound keeps ef:i,i as its default relation (it never waits for the worker).
    const d6 = buildRepresentation(named('D6'), 3, { relations: 'auto' });
    expect(d6.checks).toBeNull();
    expect(defaultRelation(d6)).toBe('ef:3,3');
  });

  it('a pick builds the representation one engine call per step, and in the browser no list above the bound is computed on the main thread after the first state', () => {
    /** Runs steps as the tool's runSteps does: the steps a step returns run next. */
    const runAll = (steps: Step[]): number => {
      const queue = [...steps];
      let ran = 0;
      while (queue.length > 0) {
        const more = queue.shift()!();
        ran++;
        if (Array.isArray(more)) queue.unshift(...more);
      }
      return ran;
    };
    inBrowser(() => {
      forgetRepresentations();
      // D7 node 7 (64 positions, minuscule): four steps; the fourth computes nothing for a minuscule node.
      const steps = representationSteps('D7', 7);
      expect(steps).toHaveLength(4);
      expect(runAll(steps)).toBe(4);
      const d7 = representationOf('D7', 7, 'staged');
      expect(d7.basis).toHaveLength(64);
      expect(d7.signed).not.toBeNull();
      expect(d7.checks).toBeNull();
      expect(() => relationsNow(d7)).toThrow(RangeError);
      relationsNow(d7, true);
      expect(d7.checks!.every((c) => c.holds)).toBe(true);
      // A node that is not minuscule within RELATIONS_MAIN_WORK gets its list in step 4.
      runAll(representationSteps('D4', 2));
      expect(representationOf('D4', 2, 'staged').checks!.some((c) => !c.holds)).toBe(true);
      // Steps interrupted after the first (another pick came first) are completed by representationOf.
      representationSteps('A5', 3)[0]!();
      const a5 = representationOf('A5', 3, 'staged');
      expect(a5.basis).toHaveLength(golden.types.A5!.fundamental_orbit_sizes[2]!);
      expect(a5.signed).not.toBeNull();
      expect(a5.checks).toBeNull();
    });
  });

  it('above 300 positions the signed moves are computed one node per task, and equal the engine\'s whole list (review P5-A2, finding 3)', () => {
    inBrowser(() => {
      forgetRepresentations();
      const steps = representationSteps('B8', 5);
      steps[0]!();
      steps[1]!();
      const more = steps[2]!();
      expect(Array.isArray(more)).toBe(true);
      expect(more as Step[]).toHaveLength(8);
      const b8 = representationOf('B8', 5, 'facts');
      expect(b8.basis).toHaveLength(1792);
      expect(b8.signed).toBeNull();
      (more as Step[]).forEach((s, k) => {
        s();
        expect(b8.signed === null, `after node position ${k}`).toBe(k < 7);
      });
      const whole = signedMoves(b8.basis!, b8.E!, b8.F!);
      b8.signed!.forEach((m, k) => expect(spEq(m, whole[k]!), `node position ${k}`).toBe(true));
    });
    // The same split on a small orbit, against the worked value of the instruction (A2 node 1, k = 1).
    const a2 = buildRepresentation(named('A2'), 1);
    const fresh: typeof a2 = { ...a2, signed: null, signedPart: null };
    addSignedMoves(fresh, {}, 1);
    expect(fresh.signed).toBeNull();
    addSignedMoves(fresh, {}, 0);
    expect(spEq(fresh.signed![0]!, sparse({ '0,2': 1, '1,1': 1, '2,0': -1 }))).toBe(true);
    expect(fresh.signed!.every((m, k) => spEq(m, a2.signed![k]!))).toBe(true);
  });

  it('when a list from the worker arrives on a node that is not minuscule and the default [E_i, F_i] = H_i holds, the tool moves to the first failing check (review P5-A2, finding 6)', () => {
    const cases: [string, number][] = [['C5', 5], ['C6', 6]];
    for (const [type, node] of cases) {
      const rep = buildRepresentation(named(type), node, { relations: 'auto' });
      expect(rep.minuscule).toBe(false);
      expect(listOnMain(rep)).toBe(false);
      expect(defaultRelation(rep)).toBe(`ef:${node},${node}`);
      expect(failingDefault(rep, defaultRelation(rep))).toBeNull();
      acceptRelations(rep, chevalleySerre(rep.board, rep.E!, rep.F!, rep.H!));
      // The default holds on these nodes (the review's script found C5:5 to C8:8), so it moves.
      expect(findRelation(rep.checks!, rep.board, `ef:${node},${node}`)!.holds).toBe(true);
      const to = failingDefault(rep, `ef:${node},${node}`)!;
      expect(to).toBe(relationCode(rep.board, firstFailing(rep.checks!)!));
      expect(findRelation(rep.checks!, rep.board, to)!.holds).toBe(false);
      // A relation the reader chose is never moved by the tool (the component passes it only while unchosen).
      expect(failingDefault(rep, to)).toBeNull();
    }
    // A minuscule node never moves.
    const e7 = buildRepresentation(named('E7'), 7);
    expect(failingDefault(e7, 'ef:7,7')).toBeNull();
    expect(linkNames('?g=C5&k=5&q=ef:5,5', '', 'q')).toBe(true);
    expect(linkNames('?g=C5&k=5', '', 'q')).toBe(false);
    expect(linkNames('?b3.q=ef:1,1', 'b3', 'q')).toBe(true);
  });
});

/** Runs `fn` with a `window` global, so that the model takes the browser's paths (E-9). */
function inBrowser(fn: () => void): void {
  const g = globalThis as { window?: unknown };
  const had = 'window' in g;
  const before = g.window;
  g.window = {};
  try {
    fn();
  } finally {
    if (had) g.window = before;
    else delete g.window;
  }
}

// ---------------------------------------------------------------------------------------------
// The string viewer
// ---------------------------------------------------------------------------------------------

describe('T12 string viewer', () => {
  const A2 = named('A2') as Board<unknown>;
  /** The string through mu (given in label order) at a node label. */
  const view = (mu: number[], node: number) => stringView(A2, byPosition(A2 as AnyBoard, mu), node);

  it('stringView on A2 through (1,0) and (2,0) at node 1', () => {
    const one = view([1, 0], 1);
    expect(one.shown.map((p) => p.key)).toEqual(['1,0', '-1,1']);
    expect(one.shown.map((p) => p.inOrbit)).toEqual([true, true]);
    expect(one.length).toBe(2n);
    const two = view([2, 0], 1);
    expect(two.shown.map((p) => p.key)).toEqual(['2,0', '0,1', '-2,2']);
    expect(two.shown.map((p) => p.inOrbit)).toEqual([true, false, true]);
    expect(two.direction).toBe('down');
    expect(two.elided).toBe(0n);
    // The oracle (verify.py): the line is stringThrough, and firing node 1 exchanges its ends.
    expect(fire(A2 as Board<number>, [2, 0], 0)).toEqual([-2, 2]);
  });

  it('a negative number reads the same line upward from mu; a zero gives mu alone; firing node i reverses the line', () => {
    const up = view([-2, 2], 1);
    expect(up.direction).toBe('up');
    expect(up.shown.map((p) => p.key)).toEqual(['-2,2', '0,1', '2,0']);
    expect(up.shown.map((p) => p.inOrbit)).toEqual([true, false, true]);
    const single = view([0, 3], 1);
    expect(single.direction).toBe('single');
    expect(single.shown.map((p) => p.key)).toEqual(['0,3']);
    expect(single.length).toBe(1n);
    // For random positions of A3 and B3 the line reverses under the firing of its node.
    for (const name of ['A3', 'B3', 'G2']) {
      const b = named(name) as Board<unknown>;
      for (let t = 0; t < 20; t++) {
        const mu = Array.from({ length: b.n }, (_, k) => ((t * 7 + k * 3) % 7) - 3);
        const i = 1 + (t % b.n);
        const v = stringView(b, mu, i);
        const w = stringView(b, fire(b as Board<number>, mu, pos(b as AnyBoard, i)), i);
        expect(w.shown.map((p) => p.key)).toEqual([...v.shown].reverse().map((p) => p.key));
      }
    }
  });

  it('lines of more than 12 positions are listed by their first and last six; more than 2000 by their ends', () => {
    const long = view([30, 0], 1);
    expect(long.length).toBe(31n);
    expect(long.shown).toHaveLength(STRING_SHOWN_MAX);
    expect(long.elided).toBe(19n);
    expect(long.gapAfter).toBe(5);
    expect(long.shown[0]!.key).toBe('30,0');
    expect(long.shown[11]!.key).toBe('-30,30');
    const huge = view([5000, 0], 1);
    expect(huge.tooLong).toBe(true);
    expect(huge.shown.map((p) => p.key)).toEqual(['5000,0', '-5000,5000']);
    expect(huge.elided).toBe(4999n);
    expect(huge.length).toBe(5001n);
  });

  it('a start outside the safe range is computed with Big', () => {
    const big = '12345678901234567890';
    const tool = new T12Tool({ board: 'A2', node: 1, relation: 'ef:1,1', start: [big, 0], moves: [] });
    expect(tool.values()).toEqual([big, '0']);
    const { board, vector } = inArithmetic(tool.board, tool.values());
    expect(typeof vector[0]).toBe('bigint');
    expect(board.arith.zero).toBe(0n);
    const v = tool.string();
    expect(v.tooLong).toBe(true);
    expect(v.shown.map((p) => p.key)).toEqual([`${big},0`, `-${big},${big}`]);
    expect(v.shown.map((p) => p.inOrbit)).toEqual([true, true]);
    expect(v.length).toBe(BigInt(big) + 1n);
    const r = tool.act(1)!;
    expect(r.after).toEqual([`-${big}`, big]);
    expect(tool.string().shown[0]!.key).toBe(`-${big},${big}`);
    // The export keeps the exact digits as decimal text (6.6).
    const doc = JSON.parse(exportJSON(tool.state(), exportData(tool)));
    expect(doc.state.start).toEqual([big, 0]);
    expect(doc.derived.positions[0]).toEqual([big, 0]);
    expect(doc.derived.string.through).toEqual([`-${big}`, big]);
  });

  describe('a safe start whose line, ends or legal play pass 2^53 is computed on the Big board (review P5-A2, finding 1)', () => {
    /** The decimal key of a position given by position, in label order (the order of data-value). */
    const keyOf = (board: AnyBoard, v: readonly (number | bigint)[]): string => toPositions(board, [...board.labels].sort((a, b) => a - b)).map((p) => String(v[p])).join(',');
    /** The end of legal play on the Big copy of the board (the in-orbit test of F3, exact). */
    const bigEnd = (board: AnyBoard, v: readonly bigint[]): string => play(bigBoard(board), v).position.join(',');
    const toolOf = (name: string, node: number, start: string[]): T12Tool => new T12Tool({ board: name, node, relation: `ef:${node},${node}`, start, moves: [] });

    it('A2 node 1 through (5, 9007199254740990): six positions whose entries pass 2^53, shown by their two ends', () => {
      const A2 = named('A2');
      const mu = [5n, 9007199254740990n];
      const tool = toolOf('A2', 1, ['5', '9007199254740990']);
      const view = tool.string();
      const far = fire(bigBoard(A2), mu, pos(A2, 1));
      expect(view.shown.map((p) => p.key)).toEqual([keyOf(A2, mu), keyOf(A2, far)]);
      expect(view.shown.map((p) => p.key)).toEqual(['5,9007199254740990', '-5,9007199254740995']);
      expect(view.length).toBe(6n);
      expect(view.elided).toBe(4n);
      expect(view.unsafe).toBe(true);
      expect(view.shown.map((p) => p.inOrbit)).toEqual([true, bigEnd(A2, far) === bigEnd(A2, mu)]);
      expect(stringNote(view)).toContain('Its entries pass 2^53, so only its two ends are computed here.');
      // The engine refuses the line on numbers: this is what the Big board is for.
      expect(() => stringThrough(A2, [5, 9007199254740990], pos(A2, 1))).toThrow(EngineOverflow);
      // A move from there is exact too, and its line is computed.
      const r = tool.act(2)!;
      expect(r.after).toEqual(fire(bigBoard(A2), mu, pos(A2, 2)).map(String));
      expect(() => tool.string()).not.toThrow();
    });

    it('A2 node 1 through (1, 9007199254740991) and A2 node 2 through (9007199254740991, 1): lines of two positions past 2^53', () => {
      const A2 = named('A2');
      const one = toolOf('A2', 1, ['1', '9007199254740991']).string();
      expect(one.shown.map((p) => p.key)).toEqual(['1,9007199254740991', keyOf(A2, fire(bigBoard(A2), [1n, 9007199254740991n], pos(A2, 1)))]);
      expect(one.shown[1]!.key).toBe('-1,9007199254740992');
      expect(one.elided).toBe(0n);
      expect(one.shown.map((p) => p.inOrbit)).toEqual([true, true]);
      expect(stringNote(one)).not.toContain('2^53');
      const two = toolOf('A2', 2, ['9007199254740991', '1']).string();
      expect(two.shown.map((p) => p.key)).toEqual(['9007199254740991,1', keyOf(A2, fire(bigBoard(A2), [9007199254740991n, 1n], pos(A2, 2)))]);
      expect(two.shown[1]!.key).toBe('9007199254740992,-1');
    });

    it('G2 node 1 through (3, 3002399751580330): a safe line whose legal play passes 2^53', () => {
      const G2 = named('G2');
      const mu = [3, 3002399751580330];
      // Legal play from mu on numbers overflows: the in-orbit test needs the Big board.
      expect(() => play(G2, mu)).toThrow(EngineOverflow);
      const view = toolOf('G2', 1, ['3', '3002399751580330']).string();
      const line = stringThrough(G2, mu, pos(G2, 1));
      expect(view.shown.map((p) => p.key)).toEqual(line.map((v) => keyOf(G2, v)));
      expect(view.length).toBe(4n);
      const muEnd = bigEnd(G2, mu.map(BigInt));
      expect(view.shown.map((p) => p.inOrbit)).toEqual(line.map((v) => bigEnd(G2, v.map(BigInt)) === muEnd));
    });
  });
});

// ---------------------------------------------------------------------------------------------
// State, links, presets, export, announcements, routing
// ---------------------------------------------------------------------------------------------

describe('T12 state and links', () => {
  const configured = configuredState({ preset: 'default' });

  it('the default state is A2, node 1, ef:1,1, the numbers game from all ones (SPEC 6.6; RT-FIX P5-RT-10-03)', () => {
    expect(configured).toEqual({ schema: 1, tool: 'rep', board: 'A2', node: 1, relation: 'ef:1,1', coords: 'numbers', start: [1, 1], moves: [] });
    expect(defaultsFor('E7')).toMatchObject({ board: 'E7', node: 7, relation: 'ef:7,7', start: [1, 1, 1, 1, 1, 1, 1], moves: [] });
    expect(defaultsFor('D4', 2)).toMatchObject({ node: 2, relation: 'ef:1,1', start: [1, 1, 1, 1] });
    expect(configuredState({ board: 'D4', node: 2 })).toMatchObject({ board: 'D4', node: 2, relation: 'ef:1,1' });
    expect(configuredState({ preset: 'string-viewer' })).toMatchObject({ board: 'A2', node: 1, start: [2, 0] });
    expect(() => configuredState({ coords: 'populations' })).toThrow(RangeError);
    expect(() => configuredState({ board: 'A2~' })).toThrow(RangeError);
  });

  it('state round-trips through encodeState and decodeState with k and q', () => {
    const tool = new T12Tool({ board: 'D4', node: 2, relation: 'ef:1,2', start: [0, 1, 0, 0], moves: [2, 1] });
    const query = encodeState(tool.state());
    expect(query).toBe('z=1&g=D4&c=n&s=0,1,0,0&w=2.1&k=2&q=ef:1,2');
    expect(admitLink(`?${query}`, configured, '')).toEqual({ state: tool.state(), notice: null });
    // With an instance prefix on a lesson page.
    const prefixed = encodeState(tool.state(), { prefix: 'b3' });
    expect(admitLink(`?${prefixed}&b1.g=E8`, configured, 'b3')).toEqual({ state: tool.state(), notice: null });
  });

  it('links that change the board or the node take that board\'s and node\'s defaults for what they do not name', () => {
    expect(admitLink('?g=E7', configured, '').state).toMatchObject({ board: 'E7', node: 7, relation: 'ef:7,7', start: [1, 1, 1, 1, 1, 1, 1], moves: [] });
    expect(admitLink('?g=D4&k=2', configured, '').state).toMatchObject({ board: 'D4', node: 2, relation: 'ef:1,1', start: [1, 1, 1, 1] });
    expect(admitLink('?g=A2&k=1&q=ef:1,2', configured, '').state).toMatchObject({ relation: 'ef:1,2' });
    expect(admitLink('?g=A2&k=1&c=n&s=2,0', configured, '').state).toMatchObject({ start: [2, 0], node: 1 });
    expect(admitLink('?k=2', configured, '').state).toMatchObject({ board: 'A2', node: 2, relation: 'ef:2,2', start: [1, 1] });
    // c without s keeps the tool's start (the codec's default for c is all ones, now the tool's default start
    // too, so the configured start of the string viewer's preset shows the rule).
    expect(admitLink('?k=2&c=n', configured, '').state).toMatchObject({ start: [1, 1] });
    expect(admitLink('?c=n', configuredState({ preset: 'string-viewer' }), '').state).toMatchObject({ start: [2, 0] });
    // Keys of other tools are ignored, as unknown keys are.
    expect(admitLink('?v=l&m=l&g=A3', configured, '')).toMatchObject({ notice: null, state: { board: 'A3', node: 1 } });
  });

  it('an unreadable link loads the default state with the notice', () => {
    for (const q of ['?g=A2&k=1&q=serre-e:1,1', '?g=A2&k=5', '?g=A2~', '?g=pentagon', '?g=c:2,-1;-1,2', '?c=p&s=1,0', '?g=A2&q=xx:1,1', '?g=A2&q=ef:1,3', '?s=1,0', '?g=A1&q=serre-e:1,2']) {
      expect(admitLink(q, configured, ''), q).toEqual({ state: configured, notice: LINK_NOTICE });
    }
    expect(admitLink('', configured, '')).toEqual({ state: configured, notice: null });
  });

  it('presets are state objects and links; the registry captions are the tool\'s', () => {
    for (const id of ['default', 'string-viewer', 'relation-checker', 'signed-move'] as const) {
      const { first, ...fields } = T12_PRESETS[id];
      const s = configuredState({ preset: id });
      expect(s).toMatchObject(fields);
      expect(admitLink(`?${encodeState(s)}`, configuredState({ preset: 'default' }), '').state).toEqual(s);
      expect(T12.presets[id]!.caption).toBe(captionOf(new T12Tool(configOf(s)), first));
    }
    expect(T12.presets['string-viewer']!.caption).toBe(
      'On A2 the line through (2, 0) at node 1 has 3 positions: (2, 0), (0, 1) and (−2, 2). Firing node 1 turns it end over end, and (0, 1) lies outside the orbit of (2, 0).',
    );
    const rep = representationOf('A2', 1);
    expect(T12.presets.default.caption).toBe(
      `On A2 the ${rep.basis!.length} positions of the orbit of e1 give ${rep.basis!.length} by ${rep.basis!.length} matrices E, F and H that satisfy all ${rep.checks!.length} Chevalley-Serre relations.`,
    );
  });

  it('Download data gives the basis, the matrices in 1-based [row, column, value], the relations in labels and the string', () => {
    const tool = new T12Tool(configOf(configured));
    const doc = JSON.parse(exportJSON(tool.state(), exportData(tool)));
    expect(doc.derived.basis).toHaveLength(3);
    expect(doc.derived.basis).toEqual([[1, 0], [0, -1], [-1, 1]]);
    expect(doc.derived.E[0]).toEqual([[1, 3, 1]]);
    expect(doc.derived.F[0]).toEqual([[3, 1, 1]]);
    expect(doc.derived.relations).toContainEqual({ relation: 'ef', i: 1, j: 1, holds: true });
    expect(doc.derived.relations).toHaveLength(20);
    // Every record is the engine's, in its order, with its positions mapped through toLabels (E-7): on A2 a
    // node 2 exists only as a label (positions are 0 and 1).
    const rep = tool.rep;
    expect(doc.derived.relations).toEqual(rep.checks!.map((c) => ({ relation: c.relation, i: toLabels(rep.board, [c.i])[0], j: toLabels(rep.board, [c.j])[0], holds: c.holds })));
    expect(doc.derived.relations).toContainEqual({ relation: 'ef', i: 2, j: 2, holds: true });
    expect(doc.derived.relations.every((r: { i: number; j: number }) => r.i >= 1 && r.j >= 1)).toBe(true);
    // The tables the screen shows (SPEC 6.6 Data export; review P5-A2, finding 8): the orbit with its rows
    // and layers, its edges, and the two sides of the relation shown.
    const o = orbitLayers(rep);
    expect(doc.derived.orbit).toEqual(
      [...o.vertices].sort((a, b) => a.basisIndex - b.basisIndex).map((v) => ({ row: v.basisIndex + 1, position: v.values, layer: v.depth })),
    );
    expect(doc.derived.orbit[0]).toEqual({ row: 1, position: [1, 0], layer: 0 });
    expect(doc.derived.edges).toEqual(o.edges.map((e) => [o.vertices[e.from]!.basisIndex + 1, o.vertices[e.to]!.basisIndex + 1, e.node]));
    expect(doc.derived.edges).toContainEqual([1, 3, 1]);
    const c11 = findRelation(rep.checks!, rep.board, 'ef:1,1')!;
    expect(doc.derived.relationSides).toEqual({ relation: 'ef:1,1', holds: true, left: entryList(c11.left).map(([r, c, v]) => [r, c, Number(v)]), right: entryList(c11.right).map(([r, c, v]) => [r, c, Number(v)]) });
    expect(doc.derived.relationSides.left).toEqual([
      [1, 1, 1],
      [3, 3, -1],
    ]);
    // Above 300 positions the graph is not drawn: the orbit is listed, the edges are null.
    const e7two = new T12Tool(configOf(defaultsFor('E7', 2)));
    const big = JSON.parse(exportJSON(e7two.state(), exportData(e7two)));
    expect(big.derived.orbit).toHaveLength(576);
    expect(big.derived.edges).toBeNull();
    expect(doc.derived.string.positions.map((p: { position: number[] }) => p.position)).toEqual([[1, 1], [-1, 2]]);
    const e7 = new T12Tool(configOf(defaultsFor('E7')));
    const d = JSON.parse(exportJSON(e7.state(), exportData(e7)));
    expect(d.derived.dimension).toBe(56);
    expect(d.derived.relations.every((r: { holds: boolean }) => r.holds)).toBe(true);
  });

  it('moves, undo, scrubbing and reset keep the positions and read the A-4 sentences', () => {
    const tool = new T12Tool({ board: 'A2', node: 1, relation: 'ef:1,1', start: [2, 0], moves: [] });
    const r = tool.act(1)!;
    expect(moveSentence(tool, r)).toBe('Fired node 1. Numbers now minus 2, 2. Move 1.');
    expect(tool.string().shown.map((p) => p.key)).toEqual(['-2,2', '0,1', '2,0']);
    tool.act(2);
    tool.act(1);
    expect(tool.state().moves).toEqual([1, 2, 1]);
    expect(tool.scrub(1)).toBe(true);
    expect(undoSentence(tool, 2, 1)).toBe('Undid move 2. Numbers now minus 2, 2.');
    tool.act(2); // from an earlier position: the later moves go
    expect(tool.state().moves).toEqual([1, 2]);
    expect(tool.reset()).toBe(true);
    expect(tool.state().moves).toEqual([]);
    expect(tool.values()).toEqual(['2', '0']);
    // Above four nodes only the changed nodes are read (A-4).
    const e7 = new T12Tool(configOf(defaultsFor('E7')));
    const m = e7.act(7)!;
    expect(moveSentence(e7, m)).toBe('Fired node 7. Node 6 now 2, node 7 now minus 1. Move 1.');
  });

  it('a long list of moves from a link is replayed in the worker (E-9 rule 2), a short one on the main thread', () => {
    const short = new T12Tool({ board: 'A2', node: 1, relation: 'ef:1,1', start: [1, 0], moves: Array.from({ length: 51 }, () => 1) }, { defer: true });
    expect(short.pending).toBe(false);
    expect(short.values()).toEqual(['-1', '1']);
    const long = new T12Tool({ board: 'A2', node: 1, relation: 'ef:1,1', start: [1, 0], moves: Array.from({ length: 2001 }, () => 1) }, { defer: true });
    expect(long.pending).toBe(true);
    expect(whereToRun(long.replayHint())).toBe('worker');
  });

  it('whereToRun sends no default call to the worker and routes rep calls by orbitSize', () => {
    for (const type of TYPE_NAMES) {
      const board = named(type);
      const node = defaultNode(board);
      const calls = routedCalls(type, node);
      const size = golden.types[type]!.fundamental_orbit_sizes[pos(board, node)]!;
      for (const c of calls) {
        const expected = c.fn === 'chevalleySerre' && !relationsOnMain(size, board.n) ? 'worker' : 'main';
        expect(c.where, `${type} node ${node}: ${c.fn}`).toBe(expected);
        if (c.fn === 'minusculeMatrices' || c.fn === 'orbitGraph') expect(c.hint).toMatchObject({ kind: 'enumeration', expectedItems: size });
      }
      if (size <= CAPS.repOrbit) expect(calls.map((c) => c.fn)).toContain('minusculeMatrices');
      else expect(calls.map((c) => c.fn)).not.toContain('minusculeMatrices');
    }
    // E7 node 7: the enumerations on the main thread with 56 items known in advance, the relation list in
    // the worker (above RELATIONS_MAIN_WORK); E6 node 1 (27 positions, 204 records): the list in the worker too, the rest on the main thread.
    const e7 = routedCalls('E7', 7);
    expect(e7.filter((c) => c.where === 'worker').map((c) => c.fn)).toEqual(['chevalleySerre']);
    expect(e7.find((c) => c.fn === 'minusculeMatrices')!.hint).toMatchObject({ expectedItems: 56 });
    expect(routedCalls('E6', 1).filter((c) => c.where === 'worker').map((c) => c.fn)).toEqual(['chevalleySerre']);
    expect(routedCalls('D4', 2).every((c) => c.where === 'main')).toBe(true);
    // The largest orbit T12 builds: the matrices on the main thread (E-9 rule 1), the relation list in the worker.
    const b8 = routedCalls('B8', 5);
    expect(b8.find((c) => c.fn === 'minusculeMatrices')!.where).toBe('main');
    expect(b8.find((c) => c.fn === 'chevalleySerre')!.where).toBe('worker');
  });

  it('a prediction freezes the nodes and the controls until it is answered', () => {
    expect(interaction(3, { hydrated: true, frozen: true, pending: false })).toEqual({ canAct: [false, false, false], controls: false });
    expect(interaction(3, { hydrated: true, frozen: false, pending: false })).toEqual({ canAct: [true, true, true], controls: true });
    expect(interaction(2, { hydrated: true, frozen: false, pending: true }).controls).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------------------------

describe('T12 registry entry', () => {
  it('the T12 registry entry has id rep, number 12, phase 5, the four presets, 32 boards, and lists every data-out name', () => {
    expect(T12.id).toBe('rep');
    expect(T12.number).toBe(12);
    expect(T12.phase).toBe(5);
    expect(T12.title).toBe('Representation Builder');
    expect(Object.keys(T12.presets).sort()).toEqual(['default', 'relation-checker', 'signed-move', 'string-viewer']);
    expect(T12.presets).not.toHaveProperty('one-zero-weight');
    expect([...T12.boards].sort()).toEqual([...TYPE_NAMES].sort());
    expect(T12.boards).toEqual([...T12_BOARDS]);
    // The phase is written as the coverage gate reads it (packages/engine/test/golden/_coverage.setup.ts).
    const source = readFileSync(new URL('../../../src/tools/registry/T12.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/^\s*phase: 5,$/m);
    for (const name of ['dimension', 'minuscule', 'explanation', 'limit', 'orbit-graph', 'matrix-e', 'matrix-f', 'matrix-h', 'relation-left', 'relation-right', 'relation-verdict', 'all-relations', 'move-matrix', 'signed-move', 'string-position', 'string-length', 'relation-formula']) {
      expect(T12.outs).toContain(name);
    }
    // Every name the server renders in the cases below is listed, and every listed name is rendered by one.
    const bodies = [
      loader.render(T12C.default, { id: '' }),
      loader.render(T12C.default, { id: 'b1', board: 'E8', node: 1 }),
      loader.render(T12C.default, { id: 'b2', preset: 'string-viewer', prediction: { question: 'How many?', answer: { type: 'number', value: 3 }, reveal: 'Three.' } }),
    ];
    const seen = new Set<string>();
    for (const body of bodies) for (const m of body.matchAll(/data-out="([^"]+)"/g)) seen.add(m[1]!);
    for (const name of seen) expect(T12.outs, name).toContain(name);
    for (const name of T12_OUTS) if (!T12_CONDITIONAL_OUTS.includes(name) || name === 'limit' || name === 'no-minuscule') expect([...seen], name).toContain(name);
  });
});

// ---------------------------------------------------------------------------------------------
// MatrixView's pure helpers and the server render
// ---------------------------------------------------------------------------------------------

type MatrixModule = {
  default: unknown;
  entriesInOrder: (m: ReadonlyMap<string, bigint | number>) => { row: number; col: number; value: bigint | number }[];
  denseEntries: (d: readonly (readonly (bigint | number | string)[])[]) => { row: number; col: number; value: bigint | number }[];
  toDense: (m: ReadonlyMap<string, bigint | number>, rows: number, cols: number) => (bigint | number)[][];
  autoFormat: (rows: number, cols: number) => 'grid' | 'list';
  formatEntry: (v: bigint | number | string) => string;
  valueText: (v: bigint | number | string) => string;
  listCaption: (caption: string, count: number, rows: number, cols: number) => string;
  matrixTable: (t: TableInput) => string;
  tableColumns: (t: TableInput) => { widths: number[]; rows: number };
  matrixBoxSize: (t: TableInput) => { width: number; height: number };
};
interface TableInput {
  caption: string;
  captionId: string;
  rowHeaders: readonly string[];
  colHeaders: readonly string[];
  entries: readonly { row: number; col: number; value: bigint | number }[];
  shape: 'grid' | 'list';
  sparseDisplay: boolean;
  indexHeaders: boolean;
  listMax: number;
}
type OrbitModule = {
  default: unknown;
  orbitSvg: (
    layers: ReturnType<typeof orbitLayers>,
    drawing: ReturnType<typeof orbitDrawing>,
    texts: readonly string[],
    title: string,
    titleId: string,
  ) => { width: number; height: number; edgeLayers: string[]; vertexLayers: string[] };
  layerCounts: (layers: ReturnType<typeof orbitLayers>) => { vertices: number; edges: number };
  EDGE_CHUNK: number;
  VERTEX_CHUNK: number;
};
type ComponentModule = { default: unknown };
let loader: SsrLoader;
let T12C: ComponentModule;
let MV: MatrixModule;
let OL: OrbitModule;

beforeAll(async () => {
  loader = await ssrLoader();
  T12C = await loader.load<ComponentModule>('/src/components/tools/T12RepresentationBuilder.svelte');
  MV = await loader.load<MatrixModule>('/src/components/math/MatrixView.svelte');
  OL = await loader.load<OrbitModule>('/src/components/tools/t12/OrbitLayers.svelte');
}, 120000);

afterAll(async () => {
  await loader?.close();
});

const outText = (body: string, name: string): string[] =>
  [...body.matchAll(new RegExp(`data-out="${name}"[^>]*>([^]*?)</(?:p|span|div|li|ul|strong|figcaption)>`, 'g'))].map((m) =>
    m[1]!.replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  );

describe('MatrixView', () => {
  it('MatrixView helpers: dense and sparse give the same entries, auto format switches above 27, list entries are row-major', () => {
    const m = sparse({ '2,0': 1, '0,2': -1, '1,1': 3, '0,0': 0 });
    const entries = MV.entriesInOrder(m);
    expect(entries.map((e) => [e.row, e.col, e.value])).toEqual([
      [0, 2, -1n],
      [1, 1, 3n],
      [2, 0, 1n],
    ]);
    const dense = MV.toDense(m, 3, 3);
    expect(dense.map((r) => r.map(String))).toEqual([['0', '0', '-1'], ['0', '3', '0'], ['1', '0', '0']]);
    expect(MV.denseEntries(dense)).toEqual(entries);
    expect(() => MV.toDense(m, 2, 2)).toThrow(RangeError);
    expect(MV.autoFormat(27, 27)).toBe('grid');
    expect(MV.autoFormat(28, 28)).toBe('list');
    expect(MV.autoFormat(27, 28)).toBe('list');
    expect(MV.formatEntry(-3n)).toBe('−3');
    expect(MV.valueText(-3n)).toBe('-3');
    expect(MV.listCaption('F7', 12, 56, 56)).toBe('F7: 12 nonzero entries of a 56 by 56 matrix');
    expect(MV.listCaption('L', 0, 56, 56)).toBe('L: no nonzero entries of a 56 by 56 matrix');
  });

  it('renders a table with caption and row and column headers, cells with 1-based data-row, data-col and data-value', () => {
    const grid = loader.render(MV.default, { caption: 'H1', rowHeaders: ['(1, 0)', '(0, −1)', '(−1, 1)'], colHeaders: ['(1, 0)', '(0, −1)', '(−1, 1)'], sparse: sparse({ '0,0': 1, '2,2': -1 }), out: 'matrix-h' });
    expect(grid).toContain('data-out="matrix-h"');
    expect(grid).toContain('data-format="grid"');
    expect(grid).toMatch(/<caption[^>]*>H1, 3 by 3<\/caption>/);
    expect((grid.match(/<th scope="col"/g) ?? []).length).toBe(4);
    expect((grid.match(/<th scope="row"/g) ?? []).length).toBe(3);
    expect(grid).toMatch(/data-row="1" data-col="1" data-value="1"/);
    expect(grid).toMatch(/data-row="3" data-col="3" data-value="-1"[^>]*>−1</);
    expect((grid.match(/data-value="0"/g) ?? []).length).toBe(7);
    const headers = Array.from({ length: 30 }, (_, k) => `(${k})`);
    const list = loader.render(MV.default, { caption: 'F7', rowHeaders: headers, colHeaders: headers, sparse: sparse({ '5,1': 1, '0,3': -1 }), out: 'x', indexHeaders: true });
    expect(list).toContain('data-format="list"');
    expect(list).toMatch(/F7: 2 nonzero entries of a 30 by 30 matrix/);
    expect(list.indexOf('data-row="1" data-col="4"')).toBeLessThan(list.indexOf('data-row="6" data-col="2"'));
    const empty = loader.render(MV.default, { caption: 'L', rowHeaders: headers, colHeaders: headers, sparse: new Map(), out: 'y' });
    expect(empty).toContain('no nonzero entries');
    const capped = loader.render(MV.default, { caption: 'M', rowHeaders: headers, colHeaders: headers, dense: headers.map((_, r) => headers.map((__, c) => (r === c ? 1 : 0))), listMax: 10 });
    expect((capped.match(/data-value="1"/g) ?? []).length).toBe(10);
    expect(capped).toContain('The first 10 of 30 nonzero entries are listed');
  });

  it('matrixTable fixes the column widths in a colgroup, shows zeros as dots when sparse, and matrixBoxSize estimates the box from the same columns', () => {
    const headers = ['(1, 0)', '(0, −1)', '(−1, 1)'];
    const grid: TableInput = {
      caption: 'E1',
      captionId: 'c1',
      rowHeaders: headers,
      colHeaders: headers,
      entries: MV.entriesInOrder(sparse({ '0,2': 1 })),
      shape: 'grid',
      sparseDisplay: true,
      indexHeaders: true,
      listMax: Infinity,
    };
    const html = MV.matrixTable(grid);
    expect(html.startsWith('<table class="matrix grid"><caption id="c1">E1, 3 by 3</caption><colgroup>')).toBe(true);
    expect((html.match(/<col style="width: calc\(\d+ch \+ 14px\)">/g) ?? []).length).toBe(4);
    expect(MV.tableColumns(grid)).toEqual({ widths: [10, 2, 2, 2], rows: 3 });
    // Index headers: the column shows its index, its position in a hidden span and the tooltip.
    expect(html).toContain('<th scope="col" class="col" title="(0, −1)">2<span class="visually-hidden">: (0, −1)</span></th>');
    expect(html).toContain('<th scope="row">1: (1, 0)</th>');
    expect(html).toMatch(/data-row="1" data-col="3" data-value="1">1</);
    expect((html.match(/<td class="zero" data-row="\d" data-col="\d" data-value="0" aria-label="0">·<\/td>/g) ?? []).length).toBe(8);
    // A list of 56 entries capped at 40: 40 rows, three columns.
    const big = Array.from({ length: 56 }, (_, k) => `(${k})`);
    const list: TableInput = { ...grid, rowHeaders: big, colHeaders: big, entries: big.map((_, k) => ({ row: k, col: (k + 1) % 56, value: -1n })), shape: 'list', listMax: 40 };
    const listed = MV.matrixTable(list);
    expect((listed.match(/<tr><th scope="row">/g) ?? []).length).toBe(40);
    expect(listed).toContain('E1: 56 nonzero entries of a 56 by 56 matrix');
    expect(MV.tableColumns(list).widths).toHaveLength(3);
    expect(MV.tableColumns(list).rows).toBe(40);
    const small = MV.matrixBoxSize(grid);
    const tall = MV.matrixBoxSize(list);
    expect(tall.height).toBeGreaterThan(small.height);
    expect(tall.height - MV.matrixBoxSize({ ...list, listMax: 39 }).height).toBe(29);
    expect(small.width).toBeGreaterThan(0);
    expect(MV.tableColumns({ ...list, entries: [] })).toEqual({ widths: [6, 6, 8], rows: 1 });
  });
});

describe('OrbitLayers', () => {
  it('orbitSvg draws one vertex per position with its basis index and one labelled edge per pair, in layers of one size', () => {
    const rep = buildRepresentation(named('A2'), 1);
    const o = orbitLayers(rep);
    const texts = o.vertices.map((v) => `(${v.values.map((x) => (x < 0 ? `−${-x}` : String(x))).join(', ')})`);
    const svg = OL.orbitSvg(o, orbitDrawing(o), texts, 'The orbit of ω1 on A2', 't1');
    expect(svg.edgeLayers).toHaveLength(1);
    expect(svg.vertexLayers).toHaveLength(1);
    const edges = svg.edgeLayers.join('');
    const vertices = svg.vertexLayers.join('');
    expect(edges).toMatch(/^<svg class="drawing edges-layer" aria-hidden="true" width="\d+" height="\d+"/);
    expect(vertices).toMatch(/^<svg class="drawing vertices-layer" role="img" aria-labelledby="t1" [^>]*><title id="t1">The orbit of ω1 on A2<\/title>/);
    expect((vertices.match(/data-vertex="/g) ?? []).length).toBe(3);
    expect((edges.match(/data-edge-label="/g) ?? []).length).toBe(2);
    // Layer 0 holds omega_1, which is basis vector 1; the text carries the index after #.
    expect(vertices).toContain('data-vertex="1" data-layer="0" data-value="1,0"');
    expect(vertices).toContain('>(1, 0) #1</text>');
    for (const e of o.edges) {
      expect(edges).toContain(`data-edge-node="${e.node}" data-edge-from="${o.vertices[e.from]!.basisIndex + 1}" data-edge-to="${o.vertices[e.to]!.basisIndex + 1}" data-step="true"`);
    }
    expect(edges).not.toContain('class="dashed"');
    // D4 node 2: the edges of a number 2 are dashed.
    const d4 = orbitLayers(buildRepresentation(named('D4'), 2));
    const d4svg = OL.orbitSvg(d4, orbitDrawing(d4), d4.vertices.map((v) => v.values.join(',')), 'D4', 't2');
    expect((d4svg.edgeLayers.join('').match(/class="dashed"/g) ?? []).length).toBe(d4.edges.filter((e) => !e.step).length);
    expect((d4svg.edgeLayers.join('').match(/data-step="false"/g) ?? []).length).toBe(d4.edges.filter((e) => !e.step).length);
    // Text is escaped.
    expect(OL.orbitSvg(o, orbitDrawing(o), texts, 'a <b> & "c"', 't3').vertexLayers[0]).toContain('<title id="t3">a &lt;b&gt; &amp; &quot;c&quot;</title>');
  });

  it('a large orbit is drawn in layers of at most 16 vertices and 40 edges, one SVG each, of one size, the title on the first (review P5-A2, finding 2)', () => {
    expect(OL.VERTEX_CHUNK).toBe(16);
    expect(OL.EDGE_CHUNK).toBe(40);
    const o = orbitLayers(buildRepresentation(named('E7'), 7, { relations: 'later' }));
    const svg = OL.orbitSvg(o, orbitDrawing(o), o.vertices.map((v) => v.values.join(',')), 'E7', 't4');
    expect(svg.vertexLayers).toHaveLength(Math.ceil(56 / 16));
    expect(svg.edgeLayers).toHaveLength(Math.ceil(o.edges.length / 40));
    expect(OL.layerCounts(o)).toEqual({ vertices: svg.vertexLayers.length, edges: svg.edgeLayers.length });
    const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
    for (const l of svg.vertexLayers) expect(count(l, /data-vertex="/g)).toBeLessThanOrEqual(16);
    for (const l of svg.edgeLayers) expect(count(l, /data-edge="/g)).toBeLessThanOrEqual(40);
    expect(svg.vertexLayers.reduce((s, l) => s + count(l, /data-vertex="/g), 0)).toBe(56);
    expect(svg.edgeLayers.reduce((s, l) => s + count(l, /data-edge="/g), 0)).toBe(o.edges.length);
    const size = `width="${svg.width}" height="${svg.height}"`;
    for (const l of [...svg.edgeLayers, ...svg.vertexLayers]) expect(l).toContain(size);
    expect(count(svg.vertexLayers.join(''), /role="img"/g)).toBe(1);
    expect(svg.vertexLayers[0]).toContain('role="img"');
  });
});

describe('T12 server render', () => {
  it('without JavaScript the default orbit, matrices, relation, signed move, string and caption are present and the controls are disabled', () => {
    const body = loader.render(T12C.default, { id: '' });
    expect(body).toContain('data-tool="rep"');
    expect(body).toContain('data-moves="0"');
    expect(outText(body, 'dimension')).toEqual(['3']);
    expect(body).toMatch(/data-out="minuscule" data-minuscule="true"/);
    expect(outText(body, 'explanation')[0]).toBe(explanation(representationOf('A2', 1)));
    expect(body).toContain('data-out="orbit-graph"');
    expect((body.match(/data-vertex="/g) ?? []).length).toBe(3);
    expect((body.match(/data-edge-label="/g) ?? []).length).toBe(2);
    for (const name of ['matrix-e', 'matrix-f', 'matrix-h', 'relation-left', 'relation-right', 'move-matrix', 'signed-move']) {
      expect(body, name).toMatch(new RegExp(`data-out="${name}" data-format="grid" data-rows="3" data-cols="3"`));
    }
    expect(body).toMatch(/data-out="relation-verdict" data-holds="true"/);
    expect(outText(body, 'all-relations')).toEqual(['All 20 relations hold.']);
    expect(body).toMatch(/<math[^>]*data-form-render="mathml"/);
    expect(body).toContain('<msub>');
    expect(body).not.toContain('class="katex');
    expect([...body.matchAll(/data-out="string-position" data-value="([^"]+)" data-in-orbit="(true|false)"/g)].map((m) => [m[1], m[2]])).toEqual([
      ['1,1', 'true'],
      ['-1,2', 'true'],
    ]);
    expect(outText(body, 'string-length')).toEqual(['2']);
    expect(outText(body, 'caption')).toEqual([T12.presets.default.caption]);
    // Every control is disabled before hydration (7.4).
    for (const tag of body.matchAll(/<(button|select|input)\b[^>]*>/g)) expect(tag[0], tag[0]).toMatch(/\sdisabled(=""|\s|>)/);
    // The board's nodes carry the four hooks of 4.0 and the A-3 names of free play.
    const nodes = [...body.matchAll(/<button[^>]*data-node="(\d+)"[^>]*>/g)].map((m) => m[0]);
    expect(nodes).toHaveLength(2);
    for (const b of nodes) {
      expect(b).toContain('data-board="numbers"');
      expect(b).toContain('data-can-act="true"');
      expect(b).toMatch(/data-value="(1|0)"/);
    }
    expect(body).toContain('aria-label="Node 1, value 1, can be fired"');
    // The table view: the orbit and one button per node.
    expect(body).toContain('data-table="orbit"');
    expect((body.match(/data-table-node="/g) ?? []).length).toBe(2);
    expect(body).toContain('<noscript>');
  });

  it('a prediction freezes the tool until answered or shown, and without JavaScript a details element holds the answer and the reveal', () => {
    const body = loader.render(T12C.default, { id: 'b1', prediction: { question: 'How many positions has the orbit?', answer: { type: 'number', value: 3 }, reveal: 'Three: (1, 0), (0, −1) and (−1, 1).' } });
    expect(body).toContain('data-prediction');
    expect(body).toMatch(/<details[^>]*>[^]*<span class="answer-text">3<\/span>[^]*Three: \(1, 0\), \(0, −1\) and \(−1, 1\)\.[^]*<\/details>/);
    // Frozen: no node can act and the controls are off until the reader answers (the pure rule the component uses).
    expect(interaction(2, { hydrated: true, frozen: true, pending: false }).canAct).toEqual([false, false]);
  });

  it('above 2000 positions the server renders the explanation alone with more than 2000, no orbit and no matrix', () => {
    const body = loader.render(T12C.default, { id: 'b2', board: 'E8', node: 1 });
    expect(outText(body, 'orbit-size')).toEqual([String(golden.types.E8!.fundamental_orbit_sizes[0])]);
    expect(outText(body, 'limit')[0]).toContain('more than 2000');
    expect(body).not.toContain('data-out="orbit-graph"');
    expect(body).not.toContain('data-format=');
    expect(outText(body, 'no-minuscule')).toEqual(['This board has no minuscule node, so the recipe of this tool builds none of its representations.']);
    expect(body).toContain('data-out="string-position"');
  });

  it('E6 node 1 renders grids of 27 and E7 node 7 lists of 56; D4 node 2 shows its failing relation', () => {
    const e6 = loader.render(T12C.default, { id: 'b3', board: 'E6', node: 1 });
    expect(e6).toMatch(/data-out="matrix-e" data-format="grid" data-rows="27"/);
    const e7 = loader.render(T12C.default, { id: 'b4', board: 'E7', node: 7 });
    expect(e7).toMatch(/data-out="matrix-e" data-format="list" data-rows="56"/);
    expect(outText(e7, 'all-relations')).toEqual(['All 280 relations hold.']);
    const d4 = loader.render(T12C.default, { id: 'b5', board: 'D4', node: 2 });
    expect(d4).toMatch(/data-out="relation-verdict" data-holds="false"/);
    expect(outText(d4, 'explanation')[0]).toContain('some number in the orbit is 2');
    expect(d4).toMatch(/data-step="false"/);
  });
});

// ---------------------------------------------------------------------------------------------
// The repair after review (P5-A2-review.json): hydration, island data, headers, labels, hooks
// ---------------------------------------------------------------------------------------------

describe('T12 hydration without the relation list or the matrices (review P5-A2, finding 4 and request 10)', () => {
  it('a configured state hydrates with the facts of its node only: minusculeMatrices, signedMoves and chevalleySerre are not called', () => {
    const keep = { ...REP_ENGINE };
    const calls: Record<string, number> = {};
    const counted = <K extends keyof RepEngine>(name: K): RepEngine[K] =>
      ((...a: never[]) => {
        calls[name] = (calls[name] ?? 0) + 1;
        return (keep[name] as (...b: never[]) => unknown)(...a);
      }) as RepEngine[K];
    REP_ENGINE.minusculeMatrices = counted('minusculeMatrices');
    REP_ENGINE.signedMoves = counted('signedMoves');
    REP_ENGINE.chevalleySerre = counted('chevalleySerre');
    try {
      inBrowser(() => {
        forgetRepresentations();
        for (const [board, node] of [['E7', 7], ['E6', 1], ['A2', 1], ['D4', 1]] as const) {
          const tool = new T12Tool(configOf(configuredState({ board, node })));
          expect(tool.rep.basis, board).toBeNull();
          expect(tool.rep.checks, board).toBeNull();
          expect(tool.rep.orbitSize).toBe(golden.types[board]!.fundamental_orbit_sizes[pos(tool.board, node)]);
          expect(() => tool.string()).not.toThrow();
        }
        expect(calls).toEqual({});
      });
    } finally {
      Object.assign(REP_ENGINE, keep);
    }
  });

  it('the server\'s digest gives the browser the counts, the verdict and the two sides of the relation shown, so the first render equals the server\'s', () => {
    const server = buildRepresentation(named('E7'), 7);
    const digest = relationDigest(server, 'ef:7,7')!;
    expect(digest).toMatchObject({ board: 'E7', node: 7, code: 'ef:7,7', holds: true, total: 280, failing: 0 });
    inBrowser(() => {
      forgetRepresentations();
      const tool = new T12Tool(configOf(configuredState({ board: 'E7', node: 7 })));
      const rep = tool.rep;
      expect(rep.checks).toBeNull();
      // Without the digest the browser could only say that the relations are checked in the background.
      expect(repCaption(rep)).toContain('checked in the background');
      expect(repCaption(rep, digest)).toBe(repCaption(server));
      expect(relationCaption(rep, 'ef:7,7', digest)).toBe(relationCaption(server, 'ef:7,7'));
      expect(captionOf(tool, null, 7, digest)).toBe(repCaption(server));
      expect(relationTally(rep, digest)).toEqual({ total: 280, failing: 0 });
      const shown = shownCheck(rep, 'ef:7,7', digest)!;
      const real = findRelation(server.checks!, server.board, 'ef:7,7')!;
      expect(shown.holds).toBe(true);
      expect(spEq(shown.left, real.left)).toBe(true);
      expect(spEq(shown.right, real.right)).toBe(true);
      // Another relation, or a digest of another node, is not taken from it.
      expect(shownCheck(rep, 'ef:1,7', digest)).toBeNull();
      expect(relationTally(representationOf('E7', 1, 'facts'), digest)).toBeNull();
    });
  });

  it('the server writes the digest of the configured state as island data, and leaves no hydration comment in the panels it keeps', async () => {
    const body = loader.render(T12C.default, { id: 'b7', board: 'E7', node: 7 });
    const m = /<script type="application\/json" data-t12-digest="b7">([^<]*)<\/script>/.exec(body);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(relationDigest(buildRepresentation(named('E7'), 7), 'ef:7,7'));
    // The panels are the server's markup of the live panels (t12/static.ts), without hydration comments.
    for (const panel of ['orbit', 'matrices', 'relations', 'signed', 'string']) {
      const at = body.indexOf(`data-panel="${panel}"`);
      expect(at, panel).toBeGreaterThan(0);
    }
    const from = body.indexOf('data-panel="relations"');
    const section = body.slice(from, body.indexOf('</section>', from));
    expect(section).toContain('data-out="relation-verdict"');
    expect(section).not.toMatch(/<!--/);
    // In the browser the island data is read back before hydration.
    const { readDigest } = await loader.load<{ readDigest: (uid: string) => unknown }>('/src/components/tools/t12/static.ts');
    const g = globalThis as { document?: unknown };
    g.document = { querySelector: (sel: string) => (sel === 'script[data-t12-digest="b7"]' ? { textContent: m![1] } : null) };
    try {
      expect(readDigest('b7')).toEqual(JSON.parse(m![1]!));
      expect(readDigest('b8')).toBeNull();
    } finally {
      delete g.document;
    }
  });
});

describe('T12 hooks and texts (review P5-A2, findings 5, 7, 9 and request 11)', () => {
  it('the row headers of every matrix are the golden weights_dynkin_labels, in order (the basis-order trap)', () => {
    for (const rec of RECORDS) {
      if (rec.weights_dynkin_labels === null) continue;
      const rep = buildRepresentation(named(rec.type), rec.node);
      expect(basisHeaders(rep), `${rec.type} node ${rec.node}`).toEqual(rec.weights_dynkin_labels.map((w) => positionText(w)));
    }
    const body = loader.render(T12C.default, { id: '' });
    const h = body.slice(body.indexOf('data-out="matrix-h"'));
    const rows = [...h.slice(0, h.indexOf('</table>')).matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((x) => x[1]);
    const a2 = matchRecord(RECORDS, { type: 'A2', node: 1 }).weights_dynkin_labels!;
    expect(rows).toEqual(a2.map((w, r) => `${r + 1}: ${positionText(w)}`));
    expect(rows).toEqual(['1: (1, 0)', '2: (0, −1)', '3: (−1, 1)']);
  });

  it('the headers are one array per basis, so that a change of state elsewhere does not write the drawn tables again', () => {
    const rep = buildRepresentation(named('E6'), 1);
    const h = basisHeaders(rep);
    expect(h).toHaveLength(27);
    expect(basisHeaders(rep)).toBe(h);
    expect(Object.isFrozen(h)).toBe(true);
    // A representation with the matrices still to compute has no headers, and gets its own once they are.
    const fresh = startRepresentation(named('D4'), 1);
    expect(basisHeaders(fresh)).toEqual([]);
    addMatrices(fresh);
    expect(basisHeaders(fresh)).toHaveLength(8);
    expect(basisHeaders(fresh)).toBe(basisHeaders(fresh));
  });

  it('relation nodes are read through toLabels: a board whose labels are not in position order', () => {
    const A2 = named('A2');
    const swapped = { ...A2, labels: [2, 1] } as AnyBoard;
    expect(relationLabels(swapped, { i: 0, j: 1 })).toEqual([2, 1]);
    expect(relationLabels(A2, { i: 0, j: 1 })).toEqual([1, 2]);
    expect(relationCode(swapped, { relation: 'ef', i: 0, j: 0 })).toBe('ef:2,2');
    // The component reads the selects' labels through relationLabels, never by indexing the sorted labels.
    const source = readFileSync(new URL('../../../src/components/tools/T12RepresentationBuilder.svelte', import.meta.url), 'utf8');
    expect(source).toContain('relationLabels(anyBoard, relationRef)');
    expect(source).not.toMatch(/labels\[relationRef/);
  });

  it('the table view writes negative numbers with the true minus sign and keeps the exact digits', () => {
    const body = loader.render(T12C.default, { id: 't', board: 'A2', node: 1, start: [-2, 2] });
    const button = /<button[^>]*data-table-node="1"[^>]*>([^<]*)<\/button>/.exec(body);
    expect(button![1]).toBe('−2');
    const long = loader.render(T12C.default, { id: 'u', board: 'A2', node: 1, start: ['-12345678901234567890', '0'] });
    expect(/<button[^>]*data-table-node="1"[^>]*>([^<]*)<\/button>/.exec(long)![1]).toBe('−12345678901234567890');
  });

  it('the state shown names its board and node in data-out="state-board" and "state-node" (labels)', () => {
    const body = loader.render(T12C.default, { id: 'b10', board: 'D4', node: 4 });
    expect(outText(body, 'state-board')).toEqual(['D4']);
    expect(outText(body, 'state-node')).toEqual(['4']);
    expect(T12.outs).toContain('state-board');
    expect(T12.outs).toContain('state-node');
  });
});

// ---------------------------------------------------------------------------------------------
// Regressions of the phase 5 red-team round (build-plan/red-team/RT-FIX.md 5.3)
// ---------------------------------------------------------------------------------------------

describe('regressions', () => {
  // Adopted from site/tests/unit/redteam-RT-08-p5-g2-sentence.test.ts (RT-08, phase 5 round). SPEC 2.18
  // "One zero weight" builds the 7-dimensional representation of G2 from the game ("a route to G2 that
  // stays inside the game"); the [D] of "Out of reach" covers only the representations out of reach of both
  // recipes. So on G2 the sentence may say what the minuscule recipe of this tool builds, not that every
  // representation needs more than the game.
  describe('P5-RT-08-05: T12 on G2 says every representation needs more than the game', () => {
    it('the golden file holds a representation of G2 built from one orbit and one zero position', () => {
      expect(resolveGoldenPath('orbit_plus_zero_representations[type=G2;highest_weight=1,0].dimension')).toBe(7);
    });
    for (const node of [1, 2]) {
      // regression: P5-RT-08-05
      it(`G2 node ${node}: the sentence does not say that all its representations need more than the game`, () => {
        const rep = buildRepresentation(boardFromName('G2') as Board<number>, node);
        const sentence = noMinusculeSentence(rep);
        // Observed at 006f50d: "This board has no minuscule node; its representations need more than the game."
        expect(sentence ?? '').not.toMatch(/its representations need more than the game/);
      });
    }
  });

  // Adopted from site/tests/unit/redteam-RT-09-p5-t12-claims.test.ts (RT-09, phase 5 round, attack 26). The
  // panel "The move of node k beside its signed version" stated, on every built node, that the firing matrix
  // is E_k + F_k + P_k^0 and that exp(E_k) exp(-F_k) exp(E_k) is E_k - F_k + P_k^0, and on a node that is not
  // minuscule that the signed matrix is no longer the move with signs. SPEC 2.18 states the identities "in a
  // minuscule representation"; on D4 node 2 at k = 2 both are false, on B3 node 1 at k = 1 both hold. The
  // reproducer printed the claim and the engine's verdict side by side; here each claim the panel makes is
  // checked against the engine's matrices on the same states (and, through largestAt, on every node k of
  // every built node of eight boards).
  describe('P5-RT-09-01: T12 states the identities of a minuscule orbit on every built node', () => {
    /** The explanatory sentences of a panel: its <p class="line"> paragraphs, without the matrices. */
    const panelText = (body: string, name: string): string => {
      const m = new RegExp(`<section[^>]*data-panel="${name}"[^>]*>([^]*?)</section>`).exec(body);
      if (m === null) return '';
      return [...m[1]!.matchAll(/<p class="line[^"]*"[^>]*>([^]*?)<\/p>/g)].map((x) => x[1]!.replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).join(' ');
    };
    const eye = (m: number): SparseMatrix => new Map(Array.from({ length: m }, (_, r) => [`${r},${r}`, 1n] as [string, bigint]));
    /** The engine's own matrices of node `label` of `name` at node `k` (labels; positions inside). */
    function at(name: string, label: number, k: number) {
      const board = boardFromName(name);
      const [i] = toPositions(board, [label]);
      const [kp] = toPositions(board, [k]);
      const m = minusculeMatrices(board, i!)!;
      const E = m.E[kp!]!;
      const F = m.F[kp!]!;
      const n = m.basis.length;
      const P0: SparseMatrix = new Map(m.basis.flatMap((v, r) => (v[kp!] === 0 ? [[`${r},${r}`, 1n] as [string, bigint]] : [])));
      const signedK = signedMoves(m.basis, m.E, m.F)[kp!]!;
      const I = eye(n);
      // E_k^2 = F_k^2 = 0 for these matrices, so exp(E_k) = I + E_k and exp(-F_k) = I - F_k.
      const nilpotent = spMul(E, E).size === 0 && spMul(F, F).size === 0;
      const exp = spMul(spMul(spAdd(I, E), spAdd(I, F, -1n)), spAdd(I, E));
      const efp = spAdd(spAdd(E, F), P0);
      const moveWithSigns = signedK.size === m.moves[kp!]!.size && [...m.moves[kp!]!.keys()].every((key) => signedK.has(key));
      const squareIsSign = spEq(spMul(signedK, signedK), minusOneToH(m.basis, kp!));
      return { minuscule: minusculeNodes(board).includes(i!), n, nilpotent, moveIsEFP: spEq(m.moves[kp!]!, efp), expIsSigned: spEq(exp, signedK), moveWithSigns, squareIsSign };
    }
    /** What the panel of node k claims, read from its text. */
    const claims = (text: string, k: number) => ({
      moveIsEFP: text.includes(`its matrix is E${k} + F${k} + P${k}`),
      expIsSigned: text.includes(`exp(E${k}) exp(−F${k}) exp(E${k}) is E${k} − F${k} + P${k}`),
      noLonger: text.includes('no longer the move with signs'),
      square: text.includes(`Its square multiplies each position by −1 to the power of its number at node ${k}`),
    });

    // regression: P5-RT-09-01
    it('D4 node 2, k = 2 (SPEC 4 T12 acceptance example): the panel does not say that the firing matrix is E2 + F2 + P2 or that exp(E2) exp(-F2) exp(E2) is E2 - F2 + P2; both are false there', () => {
      const body = loader.render(T12C.default, { id: 'r1', board: 'D4', node: 2 });
      const text = panelText(body, 'signed');
      expect(text).not.toBe('');
      const d = at('D4', 2, 2);
      expect(d.minuscule).toBe(false);
      expect(d.nilpotent).toBe(true);
      expect({ moveIsEFP: d.moveIsEFP, expIsSigned: d.expIsSigned }).toEqual({ moveIsEFP: false, expIsSigned: false });
      const said = claims(text, 2);
      expect({ moveIsEFP: said.moveIsEFP, expIsSigned: said.expIsSigned, square: said.square }, `T12 on D4 node 2: "${text}"`).toEqual({ moveIsEFP: false, expIsSigned: false, square: false });
    });

    // regression: P5-RT-09-01
    it('B3 node 1, k = 1: the panel does not say that the signed matrix is no longer the move with signs; there it is the move with signs', () => {
      const body = loader.render(T12C.default, { id: 'r2', board: 'B3', node: 1 });
      const text = panelText(body, 'signed');
      const b = at('B3', 1, 1);
      expect(b.minuscule).toBe(false);
      expect({ moveIsEFP: b.moveIsEFP, expIsSigned: b.expIsSigned, moveWithSigns: b.moveWithSigns, squareIsSign: b.squareIsSign }).toEqual({ moveIsEFP: true, expIsSigned: true, moveWithSigns: true, squareIsSign: true });
      const said = claims(text, 1);
      expect(said.noLonger, `T12 on B3 node 1: "${text}"`).toBe(false);
      expect({ moveIsEFP: said.moveIsEFP, expIsSigned: said.expIsSigned, square: said.square }, `T12 on B3 node 1: "${text}"`).toEqual({ moveIsEFP: true, expIsSigned: true, square: true });
    });

    // regression: P5-RT-09-01
    it('on every node k of every built node of eight boards, the panel states the identities exactly where the engine\'s matrices satisfy them', () => {
      for (const name of ['A3', 'B2', 'B3', 'C3', 'D4', 'D5', 'G2', 'F4']) {
        const board = named(name);
        for (const label of [...board.labels].sort((a, b) => a - b)) {
          const rep = buildRepresentation(board, label, { relations: 'later' });
          if (!rep.built) continue;
          for (const k of [...board.labels].sort((a, b) => a - b)) {
            const e = at(name, label, k);
            const holds = e.moveIsEFP && e.expIsSigned && e.squareIsSign;
            expect(largestAt(rep, pos(board, k)) <= 1, `${name} node ${label}, k = ${k}`).toBe(holds);
            // Either both identities hold or neither does (2.18: the move fails exactly where a number at k is 2 or more).
            expect(e.moveIsEFP, `${name} node ${label}, k = ${k}`).toBe(e.expIsSigned);
            if (rep.minuscule) expect(holds, `${name} node ${label}, k = ${k}`).toBe(true);
          }
        }
      }
      // The panel itself on a few of these states (the server's markup draws node k = node i).
      for (const [name, label] of [['B2', 1], ['C3', 3], ['G2', 1], ['A3', 2]] as const) {
        const text = panelText(loader.render(T12C.default, { id: 'r3', board: name, node: label }), 'signed');
        const e = at(name, label, label);
        const said = claims(text, label);
        expect({ moveIsEFP: said.moveIsEFP, expIsSigned: said.expIsSigned, square: said.square, noLonger: said.noLonger }, `${name} node ${label}: "${text}"`).toEqual({
          moveIsEFP: e.moveIsEFP,
          expIsSigned: e.expIsSigned,
          square: e.moveIsEFP && e.squareIsSign,
          noLonger: false,
        });
      }
    });
  });

  // Adopted from site/tests/unit/redteam-RT-09-p5-t12-claims.test.ts (RT-09, phase 5 round, attack 26); the
  // same cause as P5-RT-13-03 (RT-13 attack 9, site/tests/e2e/redteam-RT-13-p5-dimension.spec.ts, adopted in
  // site/tests/e2e/T12.spec.ts). The readout "Dimension:" (data-out="dimension") showed the size of the
  // orbit of e_i on a node that is not minuscule, which is not the dimension of the representation of that
  // node: golden weyl_dimension gives 28 for D4 node 2 (orbit 24), 248 for E8 node 8 (orbit 240), and on
  // E8's default node 1 3875 (orbit 2160). E8 and F4 open on node 1.
  describe('P5-RT-09-02: T12 shows the size of the orbit as the dimension on a node that is not minuscule', () => {
    const GOLDEN = JSON.parse(readFileSync(new URL('../../../../reference/golden_data.json', import.meta.url), 'utf8')) as {
      weyl_dimension: { type: string; highest_weight: number[]; dimension: number }[];
    };
    const goldenDim = (type: string, label: number, n: number): number => {
      const hw = Array.from({ length: n }, (_, k) => (k === label - 1 ? 1 : 0)).join(',');
      const r = GOLDEN.weyl_dimension.find((x) => x.type === type && x.highest_weight.join(',') === hw);
      if (r === undefined) throw new Error(`no golden weyl_dimension for ${type} omega_${label}`);
      return r.dimension;
    };
    const firstOut = (body: string, name: string): string => {
      const m = new RegExp(`data-out="${name}"[^>]*>([^]*?)</(?:p|span|div)>`).exec(body);
      return m === null ? '' : m[1]!.replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    };
    for (const [name, label, n] of [['D4', 2, 4], ['G2', 1, 2], ['F4', 4, 4], ['E8', 8, 8], ['B3', 1, 3], ['E8', 1, 8], ['F4', 1, 4]] as const) {
      // regression: P5-RT-09-02
      it(`${name} node ${label}: "Dimension:" against golden weyl_dimension`, () => {
        const body = loader.render(T12C.default, { id: 'r3', board: name, node: label });
        const shown = Number(firstOut(body, 'dimension'));
        expect(firstOut(body, 'state-board')).toBe(name);
        expect(firstOut(body, 'minuscule')).toBe('no');
        expect(shown, `T12 shows "Board ${name}, node ${label} · Dimension: ${shown}"; golden weyl_dimension[type=${name};highest_weight=omega_${label}].dimension = ${goldenDim(name, label, n)}`).toBe(goldenDim(name, label, n));
        // The number the readout showed is labelled by what it counts: the positions of the orbit.
        expect(firstOut(body, 'orbit-size'), `${name} node ${label}`).toBe(String(golden.types[name]!.fundamental_orbit_sizes[label - 1]));
        expect(body.replace(/<!--[^]*?-->/g, '')).toMatch(/Positions in the orbit: <span[^>]*data-out="orbit-size"/);
      });
    }
    // regression: P5-RT-09-02
    it('on every minuscule node the dimension is the orbit size and the golden dimension; Download data carries the dimension and the orbit size', () => {
      for (const rec of RECORDS) {
        const rep = buildRepresentation(named(rec.type), rec.node, { relations: 'later' });
        expect(representationDimension(rep), `${rec.type} node ${rec.node}`).toBe(BigInt(rec.dimension));
        expect(representationDimension(rep)).toBe(BigInt(rep.orbitSize));
      }
      for (const [name, label, n] of [['D4', 2, 4], ['E8', 8, 8], ['E8', 1, 8]] as const) {
        const tool = new T12Tool(configOf(defaultsFor(name, label)));
        const d = exportData(tool);
        expect(d.dimension, `${name} node ${label}`).toBe(goldenDim(name, label, n));
        expect(d.orbitSize, `${name} node ${label}`).toBe(golden.types[name]!.fundamental_orbit_sizes[label - 1]);
      }
    });
  });

  // P5-RT-08-01 and P5-RT-13-02 (the same cause): T12 wrote the Lie theory symbol omega_i for the
  // fundamental position in every text it shows, where the site's term is e_i (SPEC Appendix C, 8.4). The
  // browser check of M8 is in site/tests/e2e/M8.spec.ts (describe regressions); here every sentence T12
  // writes, on every node of every board it offers, and its server markup.
  describe('P5-RT-08-01: T12 writes the Lie theory symbol omega_i for the fundamental position', () => {
    // regression: P5-RT-08-01
    it('no sentence T12 writes holds omega, on every node of the 32 boards; the fundamental position is written e_i', () => {
      for (const type of TYPE_NAMES) {
        const board = named(type);
        for (const label of board.labels) {
          const rep = startRepresentation(board, label);
          const texts = [explanation(rep), limitSentence(rep) ?? '', noMinusculeSentence(rep) ?? '', repCaption(rep)];
          for (const t of texts) expect(t, `${type} node ${label}`).not.toContain('ω');
          expect(repCaption(rep), `${type} node ${label}`).toContain(`orbit of e${label}`);
        }
      }
      // The announcement after a pick, and the server's markup of the tool (the orbit panel's title, the
      // drawing's name and its legend, the orbit table's caption, the figure's name).
      const tool = new T12Tool(configOf(configuredState({ board: 'D4', node: 2 })));
      expect(pickSentence(tool)).toBe(`D4, node 2: the orbit of e2 has 24 positions. ${explanation(tool.rep)}`);
      for (const props of [{ id: '' }, { id: 'o1', board: 'D4', node: 2 }, { id: 'o2', board: 'E8', node: 1 }, { id: 'o3', board: 'E7', node: 2 }]) {
        const body = loader.render(T12C.default, props);
        expect(body.includes('ω'), JSON.stringify(props)).toBe(false);
      }
      expect(loader.render(T12C.default, { id: '' })).toContain('The orbit of e1 in layers');
    });
  });

  // P5-RT-03-01 (RT-03, attack 12; SPEC 4.0 Long numbers): the string viewer printed the length of its line
  // and the count of positions not listed in full beyond 12 digits; stringCaption and the figure's name did
  // the same. The browser check is in site/tests/e2e/T12.spec.ts (describe regressions).
  describe('P5-RT-03-01: the string viewer prints the length of the line and the count of positions not listed beyond 12 digits', () => {
    const big = '12345678901234567890';
    // regression: P5-RT-03-01
    it('the server markup shows the length and the count shortened, with the exact digits in data-value and the tooltip', () => {
      const body = loader.render(T12C.default, { id: 'l1', board: 'A2', node: 1, start: [big, 0] }).replace(/<!--[^]*?-->/g, '');
      const length = /<span([^>]*data-out="string-length"[^>]*)>([^<]*)<\/span>/.exec(body);
      const gap = /<li([^>]*data-out="string-gap"[^>]*)>([^<]*)<\/li>/.exec(body);
      expect(length).not.toBeNull();
      expect(gap).not.toBeNull();
      expect(length![2]!.trim()).toBe('1.2345... x 10^19 (20 digits)');
      expect(length![1]).toContain('data-value="12345678901234567891"');
      expect(length![1]).toContain('title="12345678901234567891"');
      expect(gap![2]!.replace(/\s+/g, ' ').trim()).toBe('and 1.2345... x 10^19 (20 digits) more positions');
      expect(gap![1]).toContain('data-value="12345678901234567889"');
      // No count or entry of 20 digits is printed in the string panel's text or in the figure's name (the
      // table view keeps the exact digits, 4.0).
      const panel = /<section[^>]*data-panel="string"[^>]*>([^]*?)<\/section>/.exec(body)![1]!;
      expect(panel.replace(/<[^>]+>/g, ' ')).not.toMatch(/\d{13}/);
      const label = /<figure[^>]*aria-label="([^"]*)"/.exec(body)![1]!;
      expect(label).not.toMatch(/\d{13}/);
      expect(label).toContain('has 1.2345... x 10^19 (20 digits) positions');
      // A short line keeps its numbers as they are.
      const short = loader.render(T12C.default, { id: 'l2', board: 'A2', node: 1, start: [1999, 0] }).replace(/<!--[^]*?-->/g, '');
      expect(/data-out="string-length"[^>]*>([^<]*)</.exec(short)![1]).toBe('2000');
    });

    // regression: P5-RT-03-01
    it('stringCaption shortens the length and the positions beyond 12 digits', () => {
      const A2 = named('A2');
      const { board, vector } = inArithmetic(A2, [big, '0']);
      const view = stringView(board, vector, 1);
      expect(view.length).toBe(12345678901234567891n);
      const caption = stringCaption('A2', view);
      expect(caption).not.toMatch(/\d{13}/);
      expect(caption).toContain('has 1.2345... x 10^19 (20 digits) positions');
      expect(caption).toContain('the line through (1.2345... x 10^19 (20 digits), 0)');
      // Up to 12 digits nothing changes (the registry's caption of the string viewer).
      expect(T12.presets['string-viewer']!.caption).toBe(
        'On A2 the line through (2, 0) at node 1 has 3 positions: (2, 0), (0, 1) and (−2, 2). Firing node 1 turns it end over end, and (0, 1) lies outside the orbit of (2, 0).',
      );
    });
  });

  // Adopted from site/tests/unit/redteam-RT-10-t12-default-start.test.ts (RT-10, phase 5 round, attack 12;
  // SPEC 6.6, field `start`: "the starting position; default: all ones for numbers, one Martian in the
  // first city for populations"). T12's state has coords "numbers" and a start (its string viewer plays the
  // numbers game), but its default start, on the tool route and after a pick of a board or a node, was
  // omega_i (1 at the node, 0 elsewhere). SPEC 4 T12 names no start ("for a chosen position mu").
  describe('P5-RT-10-03: the default start of T12 is the default of 6.6', () => {
    for (const board of ['A2', 'D4', 'E7']) {
      // regression: P5-RT-10-03
      it(`defaultsFor('${board}') has coords numbers and the start all ones`, () => {
        const s = defaultsFor(board);
        expect(s.coords).toBe('numbers');
        expect(s.start, `${board}: ${JSON.stringify(s.start)}`).toEqual(s.start!.map(() => 1));
      });
    }
    // regression: P5-RT-10-03
    it('the default preset of the tool route has the start all ones', () => {
      expect(T12.presets.default.start).toEqual([1, 1]);
    });
    // regression: P5-RT-10-03
    it('a pick of a node, and a link that changes the board or the node, take the start all ones; an author\'s start stays', () => {
      for (const [board, node] of [['D4', 2], ['E8', 1], ['B3', 3], ['G2', 2]] as const) {
        expect(defaultsFor(board, node).start, `${board} node ${node}`).toEqual(named(board).labels.map(() => 1));
      }
      const configured = configuredState({ preset: 'default' });
      expect(admitLink('?g=E7&k=2', configured, '').state.start).toEqual([1, 1, 1, 1, 1, 1, 1]);
      // M8's figures keep the starts their authors give (b1: the string through (2, 0)).
      expect(configuredState({ preset: 'string-viewer', board: 'A2', node: 1, start: [2, 0] }).start).toEqual([2, 0]);
      expect(configuredState({ board: 'D4', node: 1, start: [0, 0, 1, 0] }).start).toEqual([0, 0, 1, 0]);
    });
  });
});
