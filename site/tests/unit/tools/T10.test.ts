// P4-A3: tool T10, the Geometry Studio (SPEC.md 4 T10; 2.14; 5.6; 6.3; 6.6; 7.4; 7.6; E-7, E-9). The five
// acceptance criteria of SPEC 4 T10 over every golden record, the limits, make uniform, the presets, the
// edge labels and the server-rendered snapshot, through the tool's own pure modules in
// site/src/components/tools/t10/ and the engine. No DOM.
//
// Expected values are read from reference/golden_data.json (this file never calls the harness's covers():
// the keys `wythoff`, `types[*].coxeter_plane` and `coxeter_plane_types_with_coincident_points` are tested
// by P4-A1's golden files) or computed by the engine. The only constants typed are SPEC's own acceptance
// statements (the hexagon of A2: six edges in each graph, four shared, 2.14) and the caps, read from CAPS.
//
// Properties of T10 beyond the common ones of 4.0 Configuration (id, board, prediction, preset, caption):
// rings (one non-negative integer per node, label order), projection (the j value of 6.6), graph
// ('polytope' | 'moves'). linkTo, coords, start, moves and layers are accepted and ignored.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CAPS,
  applyWordFloat,
  boardFromName,
  classify,
  orbitGraph,
  orbitSize,
  symmetrizer,
  toLabels,
  wythoffEdges,
  wythoffFVector,
} from '@engine';
import type { Board } from '@engine';
import T10 from '../../../src/tools/registry/T10';
import { T10_BOARDS, T10_OUTS, T10_PRESETS, T10_PRESET_IDS, defaultProjectionText } from '../../../src/components/tools/t10/config';
import {
  classifiedBoard,
  computeOrbit,
  countsOf,
  drawingMatrix,
  edgeArgs,
  edgeLimitText,
  edgesToIndices,
  enumerationHint,
  faceTable,
  fitsMainThread,
  fromGraph,
  fromPresetFile,
  isClassified,
  RING_MAX,
  refusalText,
  rootPolytopeRings,
  shortRootRings,
  t10Board,
  toLabelVector,
  toPositionVector,
  vertexArgs,
  type PresetFile,
} from '../../../src/components/tools/t10/scene';
import { sharedEdgeCount, moveEdgeColour } from '../../../src/components/tools/t10/graphs';
import { MoveGraphBuilder, drawMoves, moveEdges } from '../../../src/components/tools/t10/moves';
import { coxeterStats, distinctDotsText, planeStats } from '../../../src/components/tools/t10/coxeter';
import { baseEdgeLengths, distinctLengths, replayVertices, replayWholeWords, symmetrizerFloats, uniformConstant, uniformMatters, uniformStart } from '../../../src/components/tools/t10/uniform';
import { MANIFEST_FILE, PLACED_FIGURES, PRESET_DIR, SHELL_LINKS, dataFileFor, presetState } from '../../../src/components/tools/t10/presets';
import { POLYTOPE_NAMES, polytopeNameHtml, polytopeNamePlain } from '../../../src/components/tools/t10/names';
import {
  admit,
  coreFacts,
  coreFactsInTasks,
  deriveInTasks,
  drawnOf,
  enumerateInTasks,
  factsOf,
  figureText,
  forgetCore,
  limitTexts,
  loadPlan,
  otherFacts,
  pictureOf,
  prepareInTasks,
  shortRootPositions,
  stateOf,
  uncachedCore,
  type StudioConfig,
} from '../../../src/components/tools/t10/studio';
import { drawPicture, type PictureColours } from '../../../src/components/tools/t10/drawing';
import { pictureSvg } from '../../../src/components/tools/t10/svg';
import { snapshotOf } from '../../../src/components/tools/t10/snapshot';
import { MANIFEST_FILE as P4A2_MANIFEST, PRESET_CONFIGS, PRESET_DIR as P4A2_DIR, presetFor, presetRings, type PresetManifest } from '../../../src/components/draw/presetsT10';
import { LINK_NOTICE, decodeState, encodeState } from '../../../src/lib/urlCodec';
import { whereToRun } from '../../../src/lib/worker';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

// ---------------------------------------------------------------------------------------------
// Golden data and the data files, read from disk
// ---------------------------------------------------------------------------------------------

interface WythoffRecord {
  type: string;
  rings: number[];
  name: string;
  f_vector: number[];
  edges_enumerated: boolean;
  edge_length_squared?: string;
}
interface TypeRecord {
  numbers_of_highest_root: number[];
  numbers_of_highest_short_root?: number[];
  coxeter_plane?: { rings: [number, number][]; distinct_points: number; h_points_on_every_ring: boolean };
  fundamental_orbit_sizes: number[];
}
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const golden = JSON.parse(readFileSync(`${ROOT}reference/golden_data.json`, 'utf8')) as {
  wythoff: WythoffRecord[];
  types: Record<string, TypeRecord>;
  coxeter_plane_types_with_coincident_points: string[];
};
const TYPES = Object.keys(golden.types);
const DATA_DIR = `${ROOT}site/public/presets/T10/`;
const manifest = JSON.parse(readFileSync(`${DATA_DIR}index.json`, 'utf8')) as PresetManifest;
const fileOf = (name: string): PresetFile => JSON.parse(readFileSync(`${DATA_DIR}${name}`, 'utf8')) as PresetFile;

const B = (name: string): Board<number> => boardFromName(name) as Board<number>;
const configOf = (board: string, rings: number[], projection?: string, graph: 'polytope' | 'moves' = 'polytope'): StudioConfig =>
  admit({ board, rings, projection: projection ?? defaultProjectionText(B(board).n), graph }, false)!;
const record = (type: string, rings: number[]): WythoffRecord => {
  const hits = golden.wythoff.filter((r) => r.type === type && r.rings.join('.') === rings.join('.'));
  if (hits.length !== 1) throw new Error(`${hits.length} wythoff records for ${type} ${rings.join('.')}`);
  return hits[0]!;
};
const oneRing = (n: number, label: number): number[] => Array.from({ length: n }, (_, k) => (k + 1 === label ? 1 : 0));
/** The vertices of a configuration without edges, as a change finds them before it is shown. */
const prepareVertices = (c: StudioConfig): ReturnType<typeof fromGraph> => fromGraph(t10Board(c.board), c.rings, orbitGraph(...vertexArgs(t10Board(c.board), c.rings)));
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
/** The time limit of a test that enumerates whole orbits of tens of thousands of items (a limit of the runner, not of the tool). */
const HEAVY = 60_000;
function timeMedian(f: () => unknown, runs = 7): number {
  f(); // warm up once, outside the measurement
  const t: number[] = [];
  for (let k = 0; k < runs; k++) {
    const t0 = performance.now();
    f();
    t.push(performance.now() - t0);
  }
  return median(t);
}

/** A canvas stand-in that records what is drawn (the parts drawPicture uses). */
function recorder(): Parameters<typeof drawPicture>[0] & { strokes: number; texts: string[]; moveTos: number } {
  const r = {
    strokes: 0,
    texts: [] as string[],
    moveTos: 0,
    lineWidth: 1,
    strokeStyle: '' as unknown,
    fillStyle: '' as unknown,
    globalAlpha: 1,
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    lineJoin: '',
    save() {},
    restore() {},
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {
      r.moveTos++;
    },
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {
      r.strokes++;
    },
    strokeText() {},
    fillText(text: string) {
      r.texts.push(text);
    },
  };
  return r;
}
const COLOURS: PictureColours = { page: '#FFFFFF', text: '#1A1A1A', road: '#1A1A1A', focus: '#0072B2', edges: ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#B26F00', '#3A8FCB', '#807500', '#1A1A1A'] };
const BOX = { width: 360, height: 360 };
const NO_OPTIONS = { uniform: false, shortRoots: false, rotation: null, highlighted: null };

// ---------------------------------------------------------------------------------------------
// SPEC 4 T10 Acceptance
// ---------------------------------------------------------------------------------------------

describe('SPEC 4 T10 acceptance', () => {
  it('face table totals equal f_vector for every wythoff record', () => {
    expect(golden.wythoff).toHaveLength(26);
    for (const r of golden.wythoff) {
      const board = t10Board(r.type);
      const table = faceTable(board, r.rings);
      expect(table.totals.map(String), `${r.type} ${r.rings.join('.')}`).toEqual(r.f_vector.map(String));
      // The rows sum to the totals, every row's dimension is the size of its face type, nodes are labels.
      for (let d = 0; d < board.n; d++) {
        const sum = table.rows.filter((x) => x.dimension === d).reduce((s, x) => s + x.count, 0n);
        expect(sum).toBe(table.totals[d]);
      }
      for (const row of table.rows) {
        expect(row.nodes).toHaveLength(row.dimension);
        for (const l of row.nodes) expect(board.labels).toContain(l);
      }
      // The table's totals equal the engine's wythoffFVector on its first n entries.
      expect(table.totals.map(String)).toEqual(wythoffFVector(board, toPositionVector(board, r.rings)).slice(0, board.n).map(String));
    }
  });

  it('drawn vertices and edges equal f_vector[0] and f_vector[1] where edges_enumerated', () => {
    const records = golden.wythoff.filter((r) => r.edges_enumerated);
    expect(records).toHaveLength(25);
    let largest = 0;
    for (const r of records) {
      const facts = factsOf(configOf(r.type, r.rings));
      expect(facts.decision.refused).toBe(false);
      expect(facts.decision.verticesOnly).toBe(false);
      expect(limitTexts(facts)).toEqual({ refused: '', limit: '' });
      const data = computeOrbit(facts.board, r.rings, facts.decision)!;
      expect(data.vertices.length, `${r.type} ${r.rings.join('.')} vertices`).toBe(r.f_vector[0]);
      expect(data.polytopeEdges, `${r.type} edges enumerated`).not.toBeNull();
      expect(data.polytopeEdges!.length, `${r.type} ${r.rings.join('.')} edges`).toBe(r.f_vector[1]);
      // Every edge is a pair of distinct vertices, listed once.
      const keys = new Set(data.polytopeEdges!.map(([a, b]) => `${a},${b}`));
      expect(keys.size).toBe(data.polytopeEdges!.length);
      for (const [a, b] of data.polytopeEdges!) expect(a < b && b < data.vertices.length).toBe(true);
      largest = Math.max(largest, r.f_vector[1]!);
    }
    // 2_41 is among them: the largest edge set drawn at rest, below the cap.
    expect(largest).toBe(record('E8', [1, 0, 0, 0, 0, 0, 0, 0]).f_vector[1]);
    expect(largest).toBeLessThanOrEqual(CAPS.edgesAtRest);
  }, HEAVY); // 25 whole orbits, 2_41's 69120 edges among them: about 2 s alone, more than Vitest's 5 s default in the parallel suite

  it('1_42 gives 17280 vertices, no edges, and the edge limit message', () => {
    const r = record('E8', [0, 1, 0, 0, 0, 0, 0, 0]);
    expect(r.edges_enumerated).toBe(false);
    const facts = factsOf(configOf('E8', r.rings, 'coxeter'));
    expect(facts.decision.refused).toBe(false);
    expect(facts.decision.verticesOnly).toBe(true);
    expect(facts.decision.edgeItems).toBe(0);
    const { limit, refused } = limitTexts(facts);
    expect(refused).toBe('');
    expect(limit).toContain(String(r.f_vector[1]));
    expect(limit).toContain(String(CAPS.edgesAtRest));
    expect(limit).toBe(edgeLimitText(BigInt(r.f_vector[1]!)));
    const data = computeOrbit(facts.board, r.rings, facts.decision)!;
    expect(data.vertices).toHaveLength(r.f_vector[0]!);
    expect(data.polytopeEdges).toBeNull();
    // The picture holds the vertices and no segment.
    const drawn = drawnOf(facts, data, NO_OPTIONS, drawingMatrix(facts.board), null);
    expect(drawn.edges).toHaveLength(0);
    const ctx = recorder();
    const result = drawPicture(ctx, pictureOf(facts, drawn, NO_OPTIONS, BOX), COLOURS, { turning: false, dpr: 1 });
    expect(result.pointsDrawn).toBe(r.f_vector[0]);
    expect(result.segmentsDrawn).toBe(0);
  });

  it('root polytope rings and distinct dots match coxeter_plane for every type of rank at least 2', () => {
    const smaller: string[] = [];
    let checked = 0;
    for (const T of TYPES) {
      const g = golden.types[T]!;
      if (g.coxeter_plane === undefined) {
        expect(T).toBe('A1');
        continue;
      }
      const board = B(T);
      const rings = rootPolytopeRings(board);
      const facts = factsOf(configOf(T, rings, 'coxeter'));
      const data = computeOrbit(board, rings, facts.decision)!;
      const short = facts.shortRings === null ? null : shortRootPositions(board, facts.shortRings);
      const drawn = drawnOf(facts, data, { ...NO_OPTIONS, shortRoots: true }, drawingMatrix(board), short);
      const stats = drawn.stats!;
      const expected = g.coxeter_plane;
      expect(stats.rings.map(([, c]) => c), `${T} ring sizes`).toEqual(expected.rings.map(([, c]) => c));
      stats.rings.forEach(([r], k) => expect(Math.abs(r - expected.rings[k]![0]), `${T} radius ${k}`).toBeLessThan(1e-5));
      expect(stats.distinct, `${T} distinct dots`).toBe(expected.distinct_points);
      expect(stats.points).toBe(expected.rings.reduce((s, [, c]) => s + c, 0));
      if (stats.distinct < stats.points) {
        smaller.push(T);
        expect(distinctDotsText(stats)).toBe(`${expected.distinct_points} distinct dots for ${stats.points} points`);
      } else expect(distinctDotsText(stats)).toBeNull();
      checked++;
    }
    expect(checked).toBe(31);
    expect(smaller.sort()).toEqual([...golden.coxeter_plane_types_with_coincident_points].sort());
  });

  it('A2 (1,1): six polytope edges, six move edges, four shared', () => {
    const board = B('A2');
    const facts = factsOf(configOf('A2', [1, 1], 'coxeter'));
    const data = computeOrbit(board, [1, 1], facts.decision)!;
    const moves = moveEdges(board, data.vertices);
    expect(data.polytopeEdges).toHaveLength(6);
    expect(moves).toHaveLength(6);
    expect(sharedEdgeCount(data.polytopeEdges!, moves)).toBe(4);
    // The two edges in only one graph each, in numbers coordinates (2.14 [V]): computed, not typed.
    const text = (i: number): string => toLabelVector(board, data.vertices[i]!).join(',');
    const polyOnly = data.polytopeEdges!.filter(([a, b]) => !moves.some(([c, d]) => c === a && d === b)).map(([a, b]) => [text(a), text(b)].sort().join(' | '));
    const moveOnly = moves.filter(([a, b]) => !data.polytopeEdges!.some(([c, d]) => c === a && d === b)).map(([a, b]) => [text(a), text(b)].sort().join(' | '));
    expect(polyOnly).toHaveLength(2);
    expect(moveOnly).toHaveLength(2);
    // Each move edge carries the label of the node fired: firing that node at one end gives the other.
    for (const [a, b, label] of moves) {
      const k = toPositionVector(board, oneRing(board.n, label)).indexOf(1);
      expect(applyWordFloat(board, data.vertices[a]!, [k], 'firing')).toEqual(data.vertices[b]!.map((x) => x + 0));
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Limits (5.6, 5.9)
// ---------------------------------------------------------------------------------------------

describe('limits', () => {
  it('orbits above 20000 vertices are refused with the orbit size and never enumerated', () => {
    let refusedSeen = 0;
    for (const T of TYPES) {
      const board = B(T);
      const sizes = golden.types[T]!.fundamental_orbit_sizes;
      for (let label = 1; label <= board.n; label++) {
        const rings = oneRing(board.n, label);
        const facts = factsOf(configOf(T, rings));
        expect(facts.counts.vertices).toBe(sizes[label - 1]);
        const refused = sizes[label - 1]! > CAPS.verticesDrawn;
        expect(facts.decision.refused, `${T} node ${label}`).toBe(refused);
        if (refused) {
          refusedSeen++;
          expect(limitTexts(facts).refused).toBe(refusalText(sizes[label - 1]!));
          expect(limitTexts(facts).refused).toContain(String(sizes[label - 1]));
          expect(facts.decision.vertexItems).toBe(0);
          expect(computeOrbit(board, rings, facts.decision)).toBeNull();
          expect(loadPlan(facts, manifest, 'reader')).toEqual({ kind: 'refused' });
          // The face table is still there (it is exact and cheap).
          expect(facts.faces.totals[0]).toBe(BigInt(sizes[label - 1]!));
        }
      }
    }
    // E8 nodes 3 to 6 among them.
    const e8 = golden.types.E8!.fundamental_orbit_sizes;
    for (const label of [3, 4, 5, 6]) expect(factsOf(configOf('E8', oneRing(8, label))).decision.refused).toBe(e8[label - 1]! > CAPS.verticesDrawn);
    expect(refusedSeen).toBeGreaterThan(0);
  });

  it('the turning subset has at most 8000 edges, is deterministic, and the rest set is complete up to 70000', () => {
    const rings = [1, 0, 0, 0, 0, 0, 0, 0];
    const facts = factsOf(configOf('E8', rings, 'xyz:1,2,3@20,30,0'));
    const data = computeOrbit(facts.board, rings, facts.decision)!;
    const drawn = drawnOf(facts, data, NO_OPTIONS, drawingMatrix(facts.board), null);
    const picture = pictureOf(facts, drawn, NO_OPTIONS, BOX);
    const total = record('E8', rings).f_vector[1]!;
    const atRest = drawPicture(recorder(), picture, COLOURS, { turning: false, dpr: 1 });
    expect(atRest.segmentsDrawn).toBe(total);
    expect(atRest.verticesOnly).toBe(false);
    const a = recorder();
    const b = recorder();
    const turning1 = drawPicture(a, picture, COLOURS, { turning: true, dpr: 1 });
    const turning2 = drawPicture(b, picture, COLOURS, { turning: true, dpr: 1 });
    expect(turning1.segmentsDrawn).toBe(CAPS.edgesTurning);
    expect(turning1.sampled).toBe(true);
    expect(turning2.segmentsDrawn).toBe(turning1.segmentsDrawn);
    expect(b.moveTos).toBe(a.moveTos);
    // Above the rest cap nothing but the vertices (a move graph that large; the polytope graph is never enumerated there).
    const big = { ...picture, scene: { ...picture.scene, segments: Array.from({ length: CAPS.edgesAtRest + 1 }, () => picture.scene.segments[0]!) } };
    expect(drawPicture(recorder(), big, COLOURS, { turning: false, dpr: 1 }).verticesOnly).toBe(true);
  }, HEAVY);
});

// ---------------------------------------------------------------------------------------------
// Make uniform (5.7)
// ---------------------------------------------------------------------------------------------

describe('make uniform', () => {
  it('make uniform on B3 (0,1,1) gives one squared edge length and keeps 24 vertices and 36 edges', () => {
    const board = B('B3');
    const rings = [0, 1, 1];
    const r = record('B3', rings);
    const facts = factsOf(configOf('B3', rings));
    expect(facts.uniformMatters).toBe(true);
    const P = drawingMatrix(board);
    const data = computeOrbit(board, rings, facts.decision)!;
    // The integer orbit: squared lengths 2 d_i a_i^2 = 4 at node 2 and 2 at node 3 (computed from d and the rings).
    const d = symmetrizerFloats(board);
    const integer = baseEdgeLengths(board, P, toPositionVector(board, rings));
    expect(integer.map((l) => l.label)).toEqual([2, 3]);
    integer.forEach((l) => expect(Math.abs(l.squared - 2 * d[l.label - 1]! * rings[l.label - 1]! ** 2)).toBeLessThan(1e-9));
    expect(distinctLengths(integer)).toHaveLength(2);
    // Uniform: a_i = c / sqrt(d_i), every base edge 2 c^2.
    const c = uniformConstant(rings);
    const start = uniformStart(board, rings);
    const uniform = baseEdgeLengths(board, P, start);
    uniform.forEach((l) => expect(Math.abs(l.squared - 2 * c * c)).toBeLessThan(1e-9));
    expect(distinctLengths(uniform)).toHaveLength(1);
    // The ratio sqrt(2) of the uniform truncated cube (2.14).
    expect(Math.abs(start[2]! / start[1]! - Math.SQRT2)).toBeLessThan(1e-12);
    // The combinatorics do not change: the same vertex count and edge pairs; the drawn picture keeps them.
    const replayed = replayVertices(board, data, start);
    expect(replayed).toHaveLength(r.f_vector[0]!);
    expect(data.polytopeEdges).toHaveLength(r.f_vector[1]!);
    const drawn = drawnOf(facts, data, { ...NO_OPTIONS, uniform: true }, P, null);
    expect(drawn.ys).toHaveLength(r.f_vector[0]!);
    expect(drawn.edges).toHaveLength(r.f_vector[1]!);
    // Every edge of the uniform picture has the same squared length, 2 c^2, measured on the drawn coordinates.
    for (const [i, j] of data.polytopeEdges!) {
      const s = drawn.ys[i]!.reduce((acc, x, k) => acc + (x - drawn.ys[j]![k]!) ** 2, 0);
      expect(Math.abs(s - 2 * c * c)).toBeLessThan(1e-9);
    }
    // Replaying along the tree is the replay of every whole word (4 T10 Make uniform).
    expect(replayVertices(board, data, start)).toEqual(replayWholeWords(board, data, start));
    // B3 (1,1,0): two ringed nodes of one length, equal numbers: already uniform, the option is disabled.
    expect(uniformMatters(board, [1, 1, 0])).toBe(false);
    expect(uniformMatters(board, [1, 0, 0])).toBe(false);
  });

  it('squared base-edge length equals 2 d_i a_i^2 on B3, C3, G2', () => {
    for (const [T, rings] of [
      ['B3', [1, 2, 3]],
      ['C3', [2, 1, 1]],
      ['G2', [1, 2]],
    ] as [string, number[]][]) {
      const board = B(T);
      const d = (symmetrizer(board) ?? []).map((x) => Number(x.num) / Number(x.den));
      const lengths = baseEdgeLengths(board, drawingMatrix(board), toPositionVector(board, rings));
      expect(lengths).toHaveLength(rings.filter((x) => x > 0).length);
      for (const l of lengths) expect(Math.abs(l.squared - 2 * d[l.label - 1]! * rings[l.label - 1]! ** 2), `${T} node ${l.label}`).toBeLessThan(1e-9);
      // The golden edge_length_squared where the record has one: the simply laced equal-ring records give "2".
    }
    for (const r of golden.wythoff.filter((x) => x.edge_length_squared !== undefined)) {
      const board = B(r.type);
      const lengths = baseEdgeLengths(board, drawingMatrix(board), toPositionVector(board, r.rings));
      expect(distinctLengths(lengths), `${r.type} ${r.rings.join('.')}`).toEqual([r.edge_length_squared]);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Rounding (5.8)
// ---------------------------------------------------------------------------------------------

describe('rounding', () => {
  it('distinct dot count rounds to 6 decimals and counts -0 as 0', () => {
    expect(planeStats([{ x: -1e-9, y: 0 }, { x: 0, y: 0 }, { x: 1e-9, y: -0 }]).distinct).toBe(1);
    expect(planeStats([{ x: 1.0000004, y: 2 }, { x: 1.0000001, y: 2 }]).distinct).toBe(1);
    expect(planeStats([{ x: 1.000001, y: 2 }, { x: 1.000002, y: 2 }]).distinct).toBe(2);
    // toFixed would keep the sign of a tiny negative number: the rule does not.
    expect((-1e-9).toFixed(6)).toBe('-0.000000');
    const stats = planeStats([{ x: 3, y: 4 }, { x: -3, y: -4 }, { x: 0, y: 5.0000001 }, { x: 1, y: 0 }]);
    expect(stats.rings).toEqual([[1, 1], [5, 3]]);
    expect(stats.points).toBe(4);
    expect(coxeterStats([[3, 9, 4], [-3, 9, -4]]).rings).toEqual([[5, 2]]);
  });
});

// ---------------------------------------------------------------------------------------------
// Presets (5.1, 5.10)
// ---------------------------------------------------------------------------------------------

describe('presets', () => {
  it('every registry preset is a state object that round-trips through encodeState and decodeState', () => {
    expect(Object.keys(T10.presets).sort()).toEqual([...T10_PRESET_IDS].sort());
    for (const id of T10_PRESET_IDS) {
      const state = presetState(id);
      const fields = T10.presets[id]!;
      expect(fields.board).toBe(state.board);
      expect(fields.rings).toEqual(state.rings);
      expect(fields.projection).toBe(state.projection);
      expect(fields.graph).toBe(state.graph);
      // The state is one the tool shows as it stands (strict: the projection applies to the board).
      expect(admit(state, true), id).toEqual({ board: state.board, rings: state.rings, projection: state.projection, graph: state.graph });
      // Round trip through the codec, against a different default (the link carries every field).
      const other = presetState(id === 'showpiece' ? 'default' : 'showpiece');
      const decoded = decodeState(encodeState(state), 'geometry', other);
      expect(decoded.notice, id).toBeNull();
      expect(decoded.state).toEqual(state);
      expect(typeof fields.caption).toBe('string');
      // No digit in a caption except inside a board name: every number shown comes from the engine (COMMON 4.4).
      expect(fields.caption.replace(/\b[A-G][1-8]\b/g, ''), `${id} caption`).not.toMatch(/\d/);
    }
    expect(T10.boards).toEqual([...T10_BOARDS]);
    expect([...T10.boards].sort()).toEqual([...TYPES].sort());
    expect(T10.outs).toEqual([...T10_OUTS]);
    expect(T10.number).toBe(10);
    expect(T10.id).toBe('geometry');
  });

  it('every section 3 configuration has a preset data file', () => {
    expect(PLACED_FIGURES.filter((f) => f.beat !== null)).toHaveLength(9);
    const files = new Set<string>();
    for (const fig of PLACED_FIGURES) {
      const p = T10_PRESETS[fig.preset];
      const board = B(fig.board);
      const rings = p.rootPolytope === true ? rootPolytopeRings(board) : p.rings;
      if (p.rootPolytope !== true) expect(fig.board).toBe(p.board);
      const entry = dataFileFor(manifest, fig.board, rings);
      expect(entry, `beat ${fig.beat} ${fig.preset} on ${fig.board}`).not.toBeNull();
      const file = fileOf(entry!.file);
      expect(file.vertices.length).toBe(orbitSize(board, toPositionVector(board, rings)));
      files.add(entry!.file);
    }
    // Nine placed figures and the default make seven distinct configurations (counted by board and rings).
    expect(files.size).toBe(7);
    // The root-polytope preset is the root polytope of its own board.
    expect(T10_PRESETS['root-polytope'].rings).toEqual(rootPolytopeRings(B(T10_PRESETS['root-polytope'].board)));
    expect(T10_PRESETS.default.rings).toEqual(rootPolytopeRings(B('A3')));
    expect(T10_PRESETS.showpiece.rings).toEqual(rootPolytopeRings(B('E8')));
    expect(T10_PRESETS['two-graphs'].rings).toEqual(rootPolytopeRings(B('A2')));
  });

  it('root polytope shortcut equals numbers_of_highest_root and the short set equals numbers_of_highest_short_root for all 32 types', () => {
    expect(TYPES).toHaveLength(32);
    for (const T of TYPES) {
      const board = B(T);
      const g = golden.types[T]!;
      expect(rootPolytopeRings(board), T).toEqual(g.numbers_of_highest_root);
      if (g.numbers_of_highest_short_root === undefined) expect(shortRootRings(board), T).toBeNull();
      else expect(shortRootRings(board), T).toEqual(g.numbers_of_highest_short_root);
    }
  });

  it('every preset and the default open from a data file with no worker hint', () => {
    for (const fig of PLACED_FIGURES) {
      const p = T10_PRESETS[fig.preset];
      const board = B(fig.board);
      const config = admit({ board: fig.board, rings: p.rootPolytope === true ? rootPolytopeRings(board) : p.rings, projection: p.projection, graph: p.graph }, false)!;
      for (const origin of ['load', 'reader'] as const) {
        const plan = loadPlan(factsOf(config), manifest, origin);
        expect(plan.kind, `${fig.preset} on ${fig.board} (${origin})`).toBe('file');
      }
    }
    // A link to the showpiece compares board and rings, not the preset id.
    const link = decodeState('g=E8&r=0.0.0.0.0.0.0.1&j=coxeter', 'geometry', presetState('default'));
    expect(loadPlan(factsOf(admit(link.state, true)!), manifest, 'load')).toEqual({ kind: 'file', file: 'E8-r0.0.0.0.0.0.0.1.json' });
  });

  it('the browser lookup of a data file agrees with P4-A2 presetsT10.ts', () => {
    expect(PRESET_DIR).toBe(P4A2_DIR);
    expect(MANIFEST_FILE).toBe(P4A2_MANIFEST);
    for (const config of PRESET_CONFIGS) {
      const rings = presetRings(config);
      expect(dataFileFor(manifest, config.board, rings)).toEqual(presetFor(manifest, config.board, rings));
      expect(dataFileFor(manifest, config.board, rings)).not.toBeNull();
    }
    for (const [board, rings] of [['A3', [1, 1, 1]], ['E8', [1, 0, 0, 0, 0, 0, 0, 0]], ['A2', [1, 0]]] as [string, number[]][]) {
      expect(dataFileFor(manifest, board, rings)).toBeNull();
      expect(presetFor(manifest, board, rings)).toBeNull();
    }
  });

  it('the data files read back as the engine computes them', () => {
    for (const entry of manifest.files) {
      const board = B(entry.board);
      const fromFile = fromPresetFile(board, fileOf(entry.file));
      const facts = factsOf(configOf(entry.board, entry.rings));
      const computed = computeOrbit(board, entry.rings, facts.decision)!;
      expect(fromFile.vertices).toEqual(computed.vertices);
      expect(fromFile.parent).toEqual(computed.parent);
      expect(fromFile.node).toEqual(computed.node);
      expect(fromFile.polytopeEdges!.length).toBe(computed.polytopeEdges!.length);
      expect(new Set(fromFile.polytopeEdges!.map(([a, b]) => `${a},${b}`))).toEqual(new Set(computed.polytopeEdges!.map(([a, b]) => `${a},${b}`)));
      const moves = moveEdges(board, computed.vertices);
      expect(new Set(fromFile.moveEdges!.map((e) => e.join(',')))).toEqual(new Set(moves.map((e) => e.join(','))));
      expect(fromFile.source).toBe('preset');
    }
  });
});

// ---------------------------------------------------------------------------------------------
// E-9 and the main thread (7.6)
// ---------------------------------------------------------------------------------------------

describe('where the work runs', () => {
  it('enumeration hints route at most 2000 items to main and more to the worker', () => {
    const board = B('E8');
    expect(whereToRun(enumerationHint(board, CAPS.mainThreadItems))).toBe('main');
    expect(whereToRun(enumerationHint(board, CAPS.mainThreadItems + 1))).toBe('worker');
    // Through the tool's plan: 2_41 (2160 vertices, 69120 edges) waits for the button at load, goes to the worker on a reader's change.
    const f241 = factsOf(configOf('E8', [1, 0, 0, 0, 0, 0, 0, 0], 'coxeter'));
    expect(loadPlan(f241, manifest, 'load').kind).toBe('wait');
    const reader = loadPlan(f241, manifest, 'reader');
    expect(reader.kind).toBe('enumerate');
    if (reader.kind === 'enumerate') {
      expect(reader.worker).toBe(true);
      expect(whereToRun(reader.vertexHint)).toBe('worker');
      expect(whereToRun(reader.edgeHint!)).toBe('worker');
    }
    // A small configuration that is not precomputed runs on the main thread at load.
    const small = loadPlan(factsOf(configOf('A3', [1, 1, 1])), manifest, 'load');
    expect(small.kind).toBe('enumerate');
    if (small.kind === 'enumerate') {
      expect(small.worker).toBe(false);
      expect(whereToRun(small.vertexHint)).toBe('main');
    }
    // 1_42: vertices only, so no edge enumeration at all.
    const f142 = loadPlan(factsOf(configOf('E8', [0, 1, 0, 0, 0, 0, 0, 0], 'coxeter')), manifest, 'reader');
    expect(f142.kind === 'enumerate' && f142.edgeHint === null).toBe(true);
    // The four-shell links of M7 beat 7 never need the worker before an interaction.
    for (const link of SHELL_LINKS) {
      const { state, notice } = decodeState(link, 'geometry', presetState('default'));
      expect(notice).toBeNull();
      const plan = loadPlan(factsOf(admit(state, true)!), manifest, 'load');
      expect(['file', 'wait'], link).toContain(plan.kind);
    }
  });

  it('main-thread work stays under the long-task budget', () => {
    const BUDGET = 25; // ms, the margin SPEC 7.6 sets for its own benchmark (plan)
    const timings: Record<string, number> = {};
    // Each piece is timed alone, because the tool runs each in a task of its own (studio.ts coreFactsInTasks,
    // prepareInTasks, enumerateInTasks, deriveInTasks; the tests below check that structure). The verdict of
    // classify is timed on a new board object (the engine keeps it per object, E-11), as the first change to
    // a board computes it; the short roots are timed without their cache, as the first change computes them.
    timings['E8: classify, first time on the board'] = timeMedian(() => classify(B('E8')));
    const e8 = classifiedBoard('E8');
    for (let label = 1; label <= 8; label++) {
      const rings = oneRing(8, label);
      timings[`E8 node ${label}: counts`] = timeMedian(() => countsOf(e8, rings));
      timings[`E8 node ${label}: face table`] = timeMedian(() => faceTable(e8, rings));
      timings[`E8 node ${label}: other facts, first time on the board`] = timeMedian(() => [shortRootRings(e8), otherFacts(e8, 'E8', rings)]);
    }
    // The showpiece: its data file read into orbit data, and its move graph from the vertex list (one slice).
    const showpieceFile = fileOf('E8-r0.0.0.0.0.0.0.1.json');
    timings['E8 showpiece: data file to orbit data'] = timeMedian(() => fromPresetFile(t10Board('E8'), showpieceFile));
    const showpiece = fromPresetFile(B('E8'), showpieceFile);
    expect(B('E8').n * showpiece.vertices.length).toBeLessThanOrEqual(CAPS.mainThreadItems);
    timings['E8 showpiece: move graph'] = timeMedian(() => moveEdges(B('E8'), showpiece.vertices));
    // The largest enumeration the plan still sends to the main thread, over the 32 types with one ringed node.
    let best: { T: string; label: number; items: number } | null = null;
    for (const T of TYPES) {
      const n = B(T).n;
      for (let label = 1; label <= n; label++) {
        const facts = factsOf(configOf(T, oneRing(n, label)));
        if (!fitsMainThread(facts.decision)) continue;
        const items = facts.decision.vertexItems + facts.decision.edgeItems;
        if (best === null || items > best.items) best = { T, label, items };
      }
    }
    expect(best).not.toBeNull();
    const largest = configOf(best!.T, oneRing(B(best!.T).n, best!.label));
    const lf = factsOf(largest);
    const what = `${best!.T} node ${best!.label}`;
    const vertices = orbitGraph(...vertexArgs(lf.board, largest.rings)).items;
    const edges = wythoffEdges(...edgeArgs(lf.board, largest.rings));
    timings[`largest main-thread vertex enumeration (${what}, ${lf.decision.vertexItems} items)`] = timeMedian(() => orbitGraph(...vertexArgs(lf.board, largest.rings)));
    timings[`largest main-thread edge enumeration (${what}, ${lf.decision.edgeItems} items)`] = timeMedian(() => wythoffEdges(...edgeArgs(lf.board, largest.rings)));
    timings[`its index pairs (${what})`] = timeMedian(() => edgesToIndices(vertices, edges));
    timings[`its move graph, one slice (${what})`] = timeMedian(() => new MoveGraphBuilder(lf.board, vertices).step(CAPS.mainThreadItems));
    for (const [w, ms] of Object.entries(timings)) expect(ms, w).toBeLessThan(BUDGET);
    console.info(`T10 main-thread medians (ms): ${JSON.stringify(Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v * 100) / 100])))}`);
  });
});

// ---------------------------------------------------------------------------------------------
// Tasks of their own (7.6): what the tool runs between two yields to the browser
// ---------------------------------------------------------------------------------------------

/** A stand-in for nextTask that counts the tasks; `mark` records the task in which each piece of work ended. */
function taskCounter(): { steps: { nextTask: () => Promise<void>; live: () => boolean; mark: (s: string) => void }; task: () => number; marks: [string, number][]; stopAfter: (k: number) => void } {
  let task = 0;
  let stop = Infinity;
  const marks: [string, number][] = [];
  return {
    steps: {
      nextTask: async () => {
        await Promise.resolve();
        task++;
      },
      live: () => task <= stop,
      mark: (s: string) => marks.push([s, task]),
    },
    task: () => task,
    marks,
    stopAfter: (k: number) => {
      stop = k;
    },
  };
}

describe('tasks of their own', () => {
  it('a change computes its counts, its face table and its other facts in three tasks after the one that asked', async () => {
    for (const [T, rings] of [
      ['E8', [1, 0, 0, 0, 0, 0, 0, 0]],
      ['E8', [0, 0, 1, 0, 0, 0, 0, 0]],
      ['B6', [0, 0, 0, 1, 0, 0]],
    ] as [string, number[]][]) {
      forgetCore(T, rings);
      const t = taskCounter();
      const firstOnBoard = !isClassified(T);
      const core = await coreFactsInTasks(T, rings, t.steps);
      // One piece per task, from the first task after the caller's: the verdict of classify the first time on a board.
      expect(t.marks.map(([s]) => s), T).toEqual([...(firstOnBoard ? ['board'] : []), 'counts', 'faces', 'others']);
      expect(t.marks.map(([, k]) => k), T).toEqual(t.marks.map((_, i) => i + 1));
      // The same facts as in one call, stored where the component's derived value finds them.
      expect(coreFacts(T, rings)).toBe(core);
      const fresh = uncachedCore(T, rings);
      expect(core!.counts).toEqual(fresh.counts);
      expect(core!.faces).toEqual(fresh.faces);
      expect([core!.name, core!.shortRings, core!.uniformMatters]).toEqual([fresh.name, fresh.shortRings, fresh.uniformMatters]);
      // A configuration already known answers at once, in the caller's task.
      const again = taskCounter();
      expect(await coreFactsInTasks(T, rings, again.steps)).toBe(coreFacts(T, rings));
      expect(again.task()).toBe(0);
    }
    // A newer change stops the work at its next task, and nothing is stored.
    const rings = [0, 0, 0, 0, 0, 1, 0, 0];
    forgetCore('E8', rings);
    const t = taskCounter();
    t.stopAfter(1);
    expect(isClassified('E8')).toBe(true);
    expect(await coreFactsInTasks('E8', rings, t.steps)).toBeNull();
    expect(t.marks).toEqual([['counts', 1]]);
    expect(await coreFactsInTasks('E8', rings, taskCounter().steps)).not.toBeNull();
  });

  it('a change finds the vertices of a main-thread orbit in a task of its own, and is shown in one more', async () => {
    const config = configOf('B6', [0, 0, 0, 1, 0, 0], 'coxeter');
    forgetCore(config.board, config.rings);
    const t = taskCounter();
    const p = await prepareInTasks(config, null, t.steps);
    expect(t.marks.map(([s]) => s).filter((s) => s !== 'board')).toEqual(['counts', 'faces', 'others', 'vertices', 'shown']);
    expect(t.marks.map(([, k]) => k)).toEqual(t.marks.map((_, i) => i + 1));
    expect(p!.vertices!.vertices).toEqual(orbitGraph(...vertexArgs(t10Board('B6'), config.rings)).items);
    // A refused orbit and an orbit above 2000 vertices get none; known vertices are not computed again.
    for (const [c, known] of [
      [configOf('E8', [0, 0, 1, 0, 0, 0, 0, 0], 'coxeter'), null],
      [configOf('E8', [1, 0, 0, 0, 0, 0, 0, 0], 'coxeter'), null],
      [config, p!.vertices],
    ] as [StudioConfig, ReturnType<typeof fromPresetFile> | null][]) {
      const u = taskCounter();
      const q = await prepareInTasks(c, known, u.steps);
      expect(u.marks.map(([s]) => s)).not.toContain('vertices');
      expect(u.marks.at(-1)).toEqual(['shown', u.task()]);
      expect(u.task()).toBeGreaterThan(u.marks.length > 1 ? u.marks.at(-2)![1] : 0);
      expect(q!.vertices).toBe(known);
    }
  });

  it('a load runs the vertices, the edges and their index pairs each in a task of its own', async () => {
    const config = configOf('B6', [0, 0, 0, 1, 0, 0], 'coxeter');
    const facts = factsOf(config);
    const plan = loadPlan(facts, manifest, 'reader');
    expect(plan.kind).toBe('enumerate');
    if (plan.kind !== 'enumerate') return;
    expect(plan.worker).toBe(false);
    const expected = computeOrbit(facts.board, config.rings, facts.decision)!;
    for (const partial of [null, prepareVertices(config)]) {
      const t = taskCounter();
      const calls: [string, number][] = [];
      const result = await enumerateInTasks(facts, plan, partial, {
        ...t.steps,
        orbitGraph: async (args) => {
          calls.push(['orbitGraph', t.task()]);
          return orbitGraph(...args);
        },
        wythoffEdges: async (args) => {
          calls.push(['wythoffEdges', t.task()]);
          return wythoffEdges(...args);
        },
      });
      // Nothing heavy in the caller's task (0); each enumeration and the index pairs in a task of their own.
      const pieces = [...calls, ...t.marks.filter(([s]) => s === 'indices')];
      expect(pieces.every(([, k]) => k >= 1)).toBe(true);
      expect(new Set(pieces.map(([, k]) => k)).size).toBe(pieces.length);
      expect(calls.map(([f]) => f)).toEqual(partial === null ? ['orbitGraph', 'wythoffEdges'] : ['wythoffEdges']);
      expect(t.marks.map(([s]) => s)).toEqual(partial === null ? ['vertices', 'edges', 'indices'] : ['edges', 'indices']);
      expect(result!.vertices).toEqual(expected.vertices);
      expect(result!.polytopeEdges).toEqual(expected.polytopeEdges);
    }
  });

  it('the move graph is derived in slices of at most 2000 moves, the first after the task that asked', async () => {
    const board = t10Board('E8');
    const vertices = orbitGraph(...vertexArgs(board, [1, 0, 0, 0, 0, 0, 0, 0])).items.map((v) => [...v]);
    expect(board.n * vertices.length).toBeGreaterThan(CAPS.mainThreadItems);
    const builder = new MoveGraphBuilder(board, vertices);
    const t = taskCounter();
    const slices: { task: number; budget: number; vertices: number }[] = [];
    const done = await deriveInTasks((budget) => {
      const before = builder.progress;
      const complete = builder.step(budget);
      slices.push({ task: t.task(), budget, vertices: builder.progress - before });
      return complete;
    }, t.steps);
    expect(done).toBe(true);
    expect(slices.length).toBeGreaterThan(1);
    expect(slices[0]!.task).toBeGreaterThanOrEqual(1);
    expect(slices.map((s) => s.task)).toEqual(slices.map((_, i) => slices[0]!.task + i));
    // A move is a firing at a node whose entry is not zero; a slice stops once it has applied its budget.
    let from = 0;
    slices.forEach((s, i) => {
      const moves = vertices.slice(from, from + s.vertices).reduce((sum, v) => sum + v.filter((x) => x !== 0).length, 0);
      from += s.vertices;
      expect(s.budget).toBe(CAPS.mainThreadItems);
      expect(moves).toBeLessThan(CAPS.mainThreadItems + board.n);
      if (i < slices.length - 1) expect(moves).toBeGreaterThanOrEqual(CAPS.mainThreadItems);
    });
    expect(from).toBe(vertices.length);
    expect(builder.edges).toEqual(moveEdges(board, vertices));
  });
});

// ---------------------------------------------------------------------------------------------
// Edge labels (6.3, A-5) and names (A-12, 5.15)
// ---------------------------------------------------------------------------------------------

describe('labels and names', () => {
  it('every drawn move-graph edge carries its node label', () => {
    for (const [T, rings, projection] of [
      ['A2', [1, 1], 'coxeter'],
      ['E8', [0, 0, 0, 0, 0, 0, 0, 1], 'coxeter'],
    ] as [string, number[], string][]) {
      const facts = factsOf(configOf(T, rings, projection, 'moves'));
      const data = computeOrbit(facts.board, rings, facts.decision)!;
      data.moveEdges = moveEdges(facts.board, data.vertices);
      if (T === 'A2') expect(data.moveEdges).toHaveLength(6); // 2.14: six edges in each graph of the hexagon
      const drawn = drawnOf(facts, data, NO_OPTIONS, drawingMatrix(facts.board), null);
      expect(drawn.edges).toHaveLength(data.moveEdges.length);
      const picture = pictureOf(facts, drawn, NO_OPTIONS, BOX);
      // The scene model: one label per segment, the label of the node of that edge.
      const byPair = new Map(data.moveEdges.map(([a, b, l]) => [`${a},${b}`, l]));
      expect(picture.segmentLabels).toHaveLength(data.moveEdges.length);
      picture.scene.segments.forEach((s, k) => expect(picture.segmentLabels![k]).toBe(byPair.get(`${Math.min(s.a, s.b)},${Math.max(s.a, s.b)}`)));
      // The canvas: a numeral for every drawn edge, no threshold.
      const ctx = recorder();
      const result = drawPicture(ctx, picture, COLOURS, { turning: false, dpr: 1 }, drawMoves);
      // Without the move module the move graph is not drawn at all (never without its labels).
      expect(() => drawPicture(recorder(), picture, COLOURS, { turning: false, dpr: 1 })).toThrow();
      expect(result.labelsDrawn).toBe(data.moveEdges.length);
      expect(ctx.texts.sort()).toEqual(picture.segmentLabels!.map(String).sort());
      // The SVG (the snapshot and the export): one <text> per edge, with the label as its text, and the colour by label.
      const svg = pictureSvg(picture, { title: 't', desc: 'd', id: 'x' });
      const texts = [...svg.matchAll(/<text data-edge-label="(\d+)"[^>]*>(\d+)<\/text>/g)];
      expect(texts).toHaveLength(data.moveEdges.length);
      for (const m of texts) expect(m[1]).toBe(m[2]);
      expect(texts.map((m) => m[2]).sort()).toEqual(picture.segmentLabels!.map(String).sort());
      for (const label of new Set(picture.segmentLabels)) expect(svg).toContain(`data-edge-label="${label}" stroke="${moveEdgeColour(label)}"`);
    }
  });

  it('polytope names come from the 26 golden records and are never shown as raw text', () => {
    const table = Object.fromEntries(golden.wythoff.map((r) => [`${r.type}:${r.rings.join('.')}`, r.name]));
    expect(POLYTOPE_NAMES).toEqual(table);
    for (const name of Object.values(POLYTOPE_NAMES)) {
      const html = polytopeNameHtml(name);
      expect(html.replace(/<[^>]+>/g, '')).not.toMatch(/\d_\d/);
      if (/\d_\d/.test(name)) expect(html).toContain('<math');
      expect(polytopeNamePlain(name)).not.toContain('_');
    }
    expect(polytopeNamePlain('4_21 (E8 root polytope)')).toBe('polytope 4 21 (E8 root polytope)');
    expect(JSON.stringify(POLYTOPE_NAMES)).not.toContain('rectified');
  });
});

// ---------------------------------------------------------------------------------------------
// Links (5.1, 5.2)
// ---------------------------------------------------------------------------------------------

describe('links', () => {
  it('bad boards, rings and projections load the default with the notice; positions and labels convert at the boundary', () => {
    const defaults = presetState('default');
    for (const search of ['g=A4~', 'g=pentagon', 'g=A3&j=xyz:1,2,5', 'g=A3&j=xyz:1,1,2', 'g=A2&j=xyz:1,2,3', 'g=A3&r=1.0', 'g=A3&r=1.-1.0', 'g=A3&e=x']) {
      const { state, notice } = decodeState(search, 'geometry', defaults);
      expect(notice, search).toBe(LINK_NOTICE);
      expect(state).toEqual(defaults);
    }
    // A board the codec accepts but T10 does not show: the tool checks before any engine call.
    expect(admit({ board: 'A4~', rings: [1, 0, 0, 0, 0] }, true)).toBeNull();
    expect(admit({ board: 'A3', rings: [1, 0, 0], projection: 'xyz:1,2,5' }, true)).toBeNull();
    expect(admit({ board: 'A3', rings: [1, 0, 0], projection: 'xyz:1,2,5' }, false)!.projection).toBe(defaultProjectionText(3));
    // A ring above the six digits the tool takes is not a state it shows (plan: no orbit leaves SafeInt).
    expect(admit({ board: 'E8', rings: [0, 0, 0, 0, 0, 0, 0, RING_MAX] }, true)).not.toBeNull();
    expect(admit({ board: 'E8', rings: [0, 0, 0, 0, 0, 0, 0, RING_MAX + 1] }, true)).toBeNull();
    expect(factsOf(admit({ board: 'E8', rings: [RING_MAX, 0, 0, 0, 0, 0, 0, RING_MAX] }, true)!).counts.vertices).toBe(
      orbitSize(B('E8'), [1, 0, 0, 0, 0, 0, 0, 1]),
    );
    // A link that changes the board drops the old rings (the codec) and the tool takes the root polytope.
    const e8 = decodeState('g=E8', 'geometry', defaults);
    expect(e8.state.rings).toBeUndefined();
    expect(admit(e8.state, true)!.rings).toEqual(golden.types.E8!.numbers_of_highest_root);
    // Labels at the boundary: on every board, toPositionVector and toLabelVector are inverse, through toLabels.
    for (const T of TYPES) {
      const board = B(T);
      const v = Array.from({ length: board.n }, (_, k) => k * 7 + 1);
      expect(toLabelVector(board, toPositionVector(board, v))).toEqual(v);
      expect(toLabels(board, [0])).toEqual([1]);
    }
    // stateOf writes exactly the four fields of 6.6.
    expect(Object.keys(stateOf(configOf('A3', [1, 0, 1]))).sort()).toEqual(['board', 'graph', 'projection', 'rings', 'schema', 'tool']);
  });

  it('the move graph builder works in slices and gives the same edges', () => {
    const board = B('E8');
    const data = fromPresetFile(board, fileOf('E8-r0.0.0.0.0.0.0.1.json'));
    const whole = moveEdges(board, data.vertices);
    const sliced = new MoveGraphBuilder(board, data.vertices);
    let steps = 0;
    while (!sliced.step(CAPS.mainThreadItems / 4)) steps++;
    expect(steps).toBeGreaterThan(0);
    expect(sliced.edges).toEqual(whole);
    expect(new Set(whole.map((e) => e.join(',')))).toEqual(new Set(data.moveEdges!.map((e) => e.join(','))));
  });

  it('the figure text names the board, the rings and the counts, in plain words', () => {
    const facts = factsOf(configOf('E8', [0, 0, 0, 0, 0, 0, 0, 1], 'coxeter'));
    const r = record('E8', [0, 0, 0, 0, 0, 0, 0, 1]);
    const text = figureText(facts, 'polytope');
    expect(text).toContain('E8');
    expect(text).toContain('rings 0, 0, 0, 0, 0, 0, 0, 1');
    expect(text).toContain(`${r.f_vector[0]} vertices`);
    expect(text).toContain(`${r.f_vector[1]} edges`);
    expect(text).toContain('polytope 4 21');
    expect(text).not.toContain('_');
  });
});

// ---------------------------------------------------------------------------------------------
// The snapshot of 7.4 (server rendering)
// ---------------------------------------------------------------------------------------------

describe('server rendering', () => {
  let loader: SsrLoader;
  let T10C: { default: unknown };
  beforeAll(async () => {
    loader = await ssrLoader();
    T10C = await loader.load<{ default: unknown }>('/src/components/tools/T10GeometryStudio.svelte');
  }, 120000);
  afterAll(async () => {
    await loader?.close();
  });

  const snapshotOfBody = (body: string): string => {
    const m = /<div[^>]*data-out="snapshot"[^>]*>([^]*?<\/svg>)/.exec(body);
    if (m === null) throw new Error('no snapshot in the server render');
    return m[1]!;
  };

  it('server rendering the showpiece yields an SVG with 240 points and 6720 segments', () => {
    const r = record('E8', [0, 0, 0, 0, 0, 0, 0, 1]);
    const body = loader.render(T10C.default, { id: 'b1', preset: 'showpiece' });
    const svg = snapshotOfBody(body);
    expect((svg.match(/<circle /g) ?? []).length).toBe(r.f_vector[0]);
    const segments = [...svg.matchAll(/<path stroke-width="[^"]*" stroke-opacity="[^"]*" d="([^"]*)"/g)].reduce((s, m) => s + (m[1]!.match(/M/g) ?? []).length, 0);
    expect(segments).toBe(r.f_vector[1]);
    expect(svg).toContain('role="img"');
    // The counts are in the HTML too, and the face table.
    expect(body).toMatch(new RegExp(`data-out="vertexCount"[^>]*>${r.f_vector[0]}<`));
    expect(body).toMatch(new RegExp(`data-out="edgeCount"[^>]*>${r.f_vector[1]}<`));
    expect(body).toContain('data-out="faceTable"');
    // Built by the same code the snapshot helper uses.
    const snap = snapshotOf(factsOf(configOf('E8', r.rings, 'coxeter')), 'x');
    expect(snap.points).toBe(r.f_vector[0]);
    expect(snap.segments).toBe(r.f_vector[1]);
  }, 60000);

  it('the default route renders the default configuration, its face table, and disabled controls', () => {
    const body = loader.render(T10C.default, { id: '', preset: 'default', caption: T10_PRESETS.default.caption });
    const r = record('A3', [1, 0, 1]);
    const svg = snapshotOfBody(body);
    expect((svg.match(/<circle /g) ?? []).length).toBe(r.f_vector[0]);
    expect(body).toMatch(new RegExp(`data-out="fVector"[^>]*>${r.f_vector.join(', ')}<`));
    // Every button and input of the tool is disabled in the server render (4.0, 7.4).
    for (const m of body.matchAll(/<(button|input|select)\b[^>]*>/g)) {
      if (m[0].includes('data-control="') || m[0].includes('data-node=') || m[0].includes('type="number"')) expect(m[0], m[0]).toMatch(/disabled/);
    }
    // Every data-out of the registry that is always rendered is present.
    for (const name of T10_OUTS) {
      if (name === 'notice' || name === 'noscript') continue;
      expect(body, name).toContain(`data-out="${name}"`);
    }
    // Ring board hooks.
    expect((body.match(/data-board="numbers"/g) ?? []).length).toBe(3);
  }, 60000);

  it('a root-polytope figure placed on another board shows that board s root polytope; a move-graph figure labels its edges', () => {
    const a2 = loader.render(T10C.default, { id: 'b2', preset: 'root-polytope', board: 'A2' });
    expect(a2).toMatch(/data-out="vertexCount"[^>]*>6</);
    const moves = loader.render(T10C.default, { id: 'b3', preset: 'two-graphs', graph: 'moves' });
    const svg = snapshotOfBody(moves);
    expect((svg.match(/<text data-edge-label=/g) ?? []).length).toBe(6);
    expect(() => loader.render(T10C.default, { id: 'b4', board: 'A4~' })).toThrow(/b4/);
    // A prediction (4.0 Predict): without JavaScript the question is followed by a <details> with the answer and the reveal.
    const predicted = loader.render(T10C.default, {
      id: 'b5',
      preset: 'rings',
      prediction: { question: 'How many vertices?', answer: { type: 'number', value: 4 }, reveal: 'A tetrahedron.' },
    });
    expect(predicted).toMatch(/data-prediction=""[^]*How many vertices\?[^]*<details[^]*<summary>Answer<\/summary>[^]*<p>4<\/p>[^]*A tetrahedron\./);
  }, 60000);
});
