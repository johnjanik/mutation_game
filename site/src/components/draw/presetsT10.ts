// The build-time preset pipeline of T10 (SPEC.md 4 T10 "Presets"; 3 M7; 5.1 E-9) as a TypeScript
// module, imported by scripts/presets.mjs (Node, with its own type stripping) and by the unit tests.
// Every default and every configuration that the figure table of M7 names is computed here, through
// the engine only, so that no default of T10 needs the worker. A data file depends only on the board
// and the rings: the projection and the graph switch are view options of the state, so presets with
// the same board and rings share one file (plan).
//
// For P4-A3: the manifest names each file by a bare file name, with no leading slash. T10 fetches
// import.meta.env.BASE_URL + PRESET_DIR + file (SPEC 7.2 item 10), never a path that starts with "/".
//
// Nodes: positions inside, labels in the files (E-7). On a named finite board the labels are 1..n in
// position order, so a vector (rings, a vertex) is the same list in both orders; node lists (the tree's
// `node`) are converted with toLabels. Files hold numbers only: no polytope name, no sentence.
import * as engine from '@engine';
import { CAPS, boardFromName, fire, highestRoot, highestShortRoot, orbitGraph, toLabels, toNumbers } from '@engine';
import type { AnyBoard, Board, Enumeration } from '@engine';

/** The directory of the data files under the site's base, and the manifest's name in it. */
export const PRESET_DIR = 'presets/T10/';
export const MANIFEST_FILE = 'index.json';

/** The preset ids of T10 (CONTRACTS.md 6). */
export type PresetId = 'root-polytope' | 'rings' | 'face-table' | 'two-graphs' | 'make-uniform' | 'showpiece' | 'coxeter-plane';

export interface PresetConfig {
  /** A named finite type. */
  board: string;
  /** One non-negative integer per node in label order, or the numbers of the highest root (never typed: computed). */
  rings: readonly number[] | 'highest-root';
  /** The preset ids that use this file. */
  presets: readonly PresetId[];
}

/**
 * The one list of configurations, in the order of the manifest (plan; the M7 figure table). P4-A3 fixes
 * T10's default in registry/T10.ts; if it is not among these, P4-A3 adds a line here and reruns the script.
 */
export const PRESET_CONFIGS: readonly PresetConfig[] = [
  { board: 'A2', rings: 'highest-root', presets: ['root-polytope', 'two-graphs'] },
  { board: 'A3', rings: 'highest-root', presets: ['root-polytope'] },
  { board: 'D4', rings: 'highest-root', presets: ['root-polytope', 'coxeter-plane'] },
  { board: 'A3', rings: [1, 0, 0], presets: ['rings'] },
  { board: 'B3', rings: [1, 0, 1], presets: ['face-table'] },
  { board: 'B3', rings: [0, 1, 1], presets: ['make-uniform'] },
  { board: 'E8', rings: 'highest-root', presets: ['showpiece'] },
];

/** The fields of a data file, in the order they are written; no others (plan). */
export const PRESET_FIELDS = [
  'schema',
  'tool',
  'key',
  'board',
  'rings',
  'presets',
  'counts',
  'edgesEnumerated',
  'fVector',
  'vertices',
  'adjacency',
  'moveAdjacency',
  'tree',
  'shortRoots',
] as const;

export interface PresetCounts {
  vertices: number;
  edges: number;
  moveEdges: number;
}

export interface PresetData {
  schema: 1;
  tool: 'geometry';
  key: string;
  board: string;
  /** Label order. */
  rings: number[];
  presets: PresetId[];
  counts: PresetCounts;
  edgesEnumerated: true;
  /** The entries of wythoffFVector: JSON numbers when safe integers, else decimal strings (SPEC 6.6 "Data export"). */
  fVector: (number | string)[];
  /** One position of the numbers game per vertex, in label order, in the engine's order (items[0] the start). */
  vertices: number[][];
  /** For each vertex the sorted indices of its neighbours with a larger index in the polytope graph. */
  adjacency: number[][];
  /** The same for the move graph (mu joined to R_i mu for every node i with R_i mu different from mu). */
  moveAdjacency: number[][];
  /** The breadth-first tree of orbitGraph: parent index, and the node fired to reach it (a label). */
  tree: { parent: (number | null)[]; node: (number | null)[] };
  /** For a root polytope with two root lengths: the orbit of the highest short root, no edges; else null. */
  shortRoots: number[][] | null;
}

export interface ManifestEntry {
  key: string;
  board: string;
  rings: number[];
  presets: PresetId[];
  /** A bare file name in PRESET_DIR. */
  file: string;
  counts: PresetCounts;
}

export interface PresetManifest {
  schema: 1;
  tool: 'geometry';
  files: ManifestEntry[];
}

/** A configuration that a preset must not ship: more vertices or edges than the tool draws (5.6). */
export class PresetRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetRefused';
  }
}

/**
 * The phase 4 engine functions this pipeline and its tests need, with the signatures of CONTRACTS.md
 * 2.4. P4-A1 adds them to @engine in stage 4.1, beside this module. Until that is merged they are
 * looked up on the engine's namespace, so that this module type-checks without them, and a call
 * throws an Error naming P4-A1 when one is missing. Nothing here implements them. Once P4-A1 is
 * merged, this accessor becomes a plain named import (handoff to the continuation of P4-A2).
 */
export interface Phase4Engine {
  euclideanBasis(board: AnyBoard): { E: number[][]; eigenvalues: number[] };
  wythoffEdges(board: AnyBoard, rings: readonly number[], cap: number): Enumeration<[number[], number[]]>;
  wythoffFVector(board: AnyBoard, rings: readonly number[]): bigint[];
}

export function phase4Engine(): Phase4Engine {
  const api = engine as unknown as Partial<Record<keyof Phase4Engine, unknown>>;
  const missing = (['euclideanBasis', 'wythoffEdges', 'wythoffFVector'] as const).filter((k) => typeof api[k] !== 'function');
  if (missing.length > 0) {
    throw new Error(`@engine does not export ${missing.join(', ')} yet (phase 4, P4-A1); the T10 presets cannot be computed`);
  }
  return api as unknown as Phase4Engine;
}

/** The named finite board of a configuration, with SafeInt arithmetic. */
function namedBoard(name: string): Board<number> {
  const board: AnyBoard = boardFromName(name);
  if (board.name !== name || typeof board.arith.zero !== 'number') {
    throw new RangeError(`${name} is not a named finite board`);
  }
  return board as Board<number>;
}

/** The rings of a configuration in label order: as given, or toNumbers(board, highestRoot(board)). */
export function presetRings(config: PresetConfig): number[] {
  const board = namedBoard(config.board);
  const rings = config.rings === 'highest-root' ? toNumbers(board, highestRoot(board)) : [...config.rings];
  if (rings.length !== board.n || rings.some((r) => !Number.isSafeInteger(r) || r < 0)) {
    throw new RangeError(`the rings of ${config.board} must be ${board.n} non-negative integers, not ${rings.join(',')}`);
  }
  return rings;
}

/** The key and file name of a configuration: <board>-r<rings joined by '.'>, for example E8-r0.0.0.0.0.0.0.1. */
export function presetKey(config: PresetConfig): string {
  return `${config.board}-r${presetRings(config).join('.')}`;
}

export function presetFile(key: string): string {
  return `${key}.json`;
}

/** The hashing rule of SPEC 5.5: the entries as decimal text joined by commas. */
function keyOf(v: readonly number[]): string {
  return v.join(',');
}

function safeOrText(x: bigint): number | string {
  return x <= BigInt(Number.MAX_SAFE_INTEGER) && x >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(x) : x.toString();
}

/**
 * The short roots of a configuration (SPEC 2.14: a root polytope "with the short roots available as a
 * second set of points"): when the configuration is a root polytope (rings 'highest-root') on a board
 * with two root lengths, the orbit of the numbers of highestShortRoot(board) in the engine's order,
 * no edges; null when the board is simply laced or the configuration is not a root polytope. Needs only
 * the engine of phases 0 to 3, so it is tested on a board with two root lengths (B3) although no shipped
 * configuration is a root polytope there.
 */
export function presetShortRoots(config: PresetConfig): number[][] | null {
  if (config.rings !== 'highest-root') return null;
  const board = namedBoard(config.board);
  const short = highestShortRoot(board);
  if (short === null) return null;
  const g = orbitGraph(board, [toNumbers(board, short)], 'firing', CAPS.verticesDrawn);
  if (g.truncated) throw new PresetRefused(`${presetKey(config)}: the short roots exceed ${CAPS.verticesDrawn}`);
  return g.items.map((v) => [...v]);
}

/** Turns unordered pairs into sorted lists of larger neighbours; a repeated pair or a loop is a bug. */
function adjacencyLists(count: number, pairs: Iterable<readonly [number, number]>, what: string): { lists: number[][]; size: number } {
  const lists: number[][] = Array.from({ length: count }, () => []);
  const seen = new Set<string>();
  let size = 0;
  for (const [i, j] of pairs) {
    if (i === j) throw new Error(`${what}: a loop at vertex ${i}`);
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const k = `${a},${b}`;
    if (seen.has(k)) throw new Error(`${what}: the pair ${k} is listed twice`);
    seen.add(k);
    lists[a]!.push(b);
    size++;
  }
  for (const l of lists) l.sort((x, y) => x - y);
  return { lists, size };
}

/**
 * Computes one data file, through the engine: the vertices are orbitGraph(board, [rings], 'firing',
 * CAPS.verticesDrawn).items (E-5 order, items[0] the start), refused when truncated; the polytope edges
 * are wythoffEdges(board, rings, CAPS.edgesAtRest), refused when truncated, each end mapped to its
 * vertex by the hashing rule; the move graph applies every node to every vertex once more (5.4); the
 * face counts are wythoffFVector; the short roots are presetShortRoots. An edge end that is not a
 * vertex is a bug and throws.
 */
export function computePreset(config: PresetConfig): PresetData {
  const board = namedBoard(config.board);
  const rings = presetRings(config);
  const key = presetKey(config);
  const { wythoffEdges, wythoffFVector } = phase4Engine();

  const graph = orbitGraph(board, [rings], 'firing', CAPS.verticesDrawn);
  if (graph.truncated) throw new PresetRefused(`${key}: the orbit has more than ${CAPS.verticesDrawn} vertices`);
  const vertices = graph.items.map((v) => [...v]);
  const index = new Map<string, number>();
  vertices.forEach((v, i) => index.set(keyOf(v), i));
  const at = (v: readonly number[]): number => {
    const i = index.get(keyOf(v));
    if (i === undefined) throw new Error(`${key}: ${keyOf(v)} is not a vertex of the orbit`);
    return i;
  };

  const edges = wythoffEdges(board, rings, CAPS.edgesAtRest);
  if (edges.truncated) throw new PresetRefused(`${key}: more than ${CAPS.edgesAtRest} edges`);
  const polytope = adjacencyLists(
    vertices.length,
    edges.items.map(([u, v]): [number, number] => [at(u), at(v)]),
    `${key} polytope graph`,
  );

  const movePairs: [number, number][] = [];
  vertices.forEach((v, i) => {
    for (let k = 0; k < board.n; k++) {
      const j = at(fire(board, v, k));
      if (j > i) movePairs.push([i, j]);
    }
  });
  const moves = adjacencyLists(vertices.length, movePairs, `${key} move graph`);

  const shortRoots = presetShortRoots(config);

  return {
    schema: 1,
    tool: 'geometry',
    key,
    board: config.board,
    rings,
    presets: [...config.presets],
    counts: { vertices: vertices.length, edges: polytope.size, moveEdges: moves.size },
    edgesEnumerated: true,
    fVector: wythoffFVector(board, rings).map(safeOrText),
    vertices,
    adjacency: polytope.lists,
    moveAdjacency: moves.lists,
    tree: {
      parent: [...graph.parent],
      node: graph.node.map((k) => (k === null ? null : toLabels(board, [k])[0]!)),
    },
    shortRoots,
  };
}

/** The file text: JSON with no spaces and a final newline, the fields in the order of PRESET_FIELDS. */
export function serializePreset(data: PresetData): string {
  const ordered: Record<string, unknown> = {};
  for (const f of PRESET_FIELDS) ordered[f] = data[f];
  return JSON.stringify(ordered) + '\n';
}

/** The manifest of the files, in the order given (PRESET_CONFIGS order). */
export function buildManifest(files: readonly PresetData[]): PresetManifest {
  return {
    schema: 1,
    tool: 'geometry',
    files: files.map((d) => ({
      key: d.key,
      board: d.board,
      rings: [...d.rings],
      presets: [...d.presets],
      file: presetFile(d.key),
      counts: { vertices: d.counts.vertices, edges: d.counts.edges, moveEdges: d.counts.moveEdges },
    })),
  };
}

export function serializeManifest(manifest: PresetManifest): string {
  return JSON.stringify(manifest) + '\n';
}

/** The manifest entry for a board and rings in label order, or null (then the configuration is not a preset). */
export function presetFor(manifest: PresetManifest, board: string, rings: readonly number[]): ManifestEntry | null {
  const r = rings.join('.');
  return manifest.files.find((f) => f.board === board && f.rings.join('.') === r) ?? null;
}
