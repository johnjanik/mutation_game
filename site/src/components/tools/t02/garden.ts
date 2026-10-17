// The model of the Orbit Garden (T2), pure functions with no DOM (SPEC.md 4 T2, 4.0, 5.4, 5.5, 5.6,
// E-2, E-5, E-7, E-9). Everything here runs synchronously on the main thread: every search is called
// with the cap CAPS.gardenPositions (2000), which E-9 rule 1 counts as known in advance, so nothing
// here imports the worker. Positions are vectors in positions (E-7) in the board's arithmetic; keys
// are the entries joined by commas through `arith.show` (5.5), never JSON (a bigint does not
// serialise). Labels appear only where this module hands data to the screen.
import {
  Big,
  CAPS,
  EngineOverflow,
  fire,
  mutate,
  orbitGraph,
  roots,
  toLabels,
  toPositions,
  wordTo,
} from '@two-games/engine';
import type { AnyBoard, Board, Game, OrbitGraph, Word } from '@two-games/engine';
import { bigBoard, isNamedFinite as namedFinite, labelOrder, parseInteger } from '../../../lib/state';
import type { Coords } from '../../../lib/state';
import type { Highlight } from '../../../lib/highlight';

/** What grows: the root populations from every single Martian, or the orbit of one position. */
export type Grows = 'roots' | 'orbit';
/** How it grows: as the reader visits positions, or one breadth-first layer per press. */
export type Growth = 'follow' | 'explore';

/** A position in positions, in some board's arithmetic. */
export type Vector = readonly unknown[];

/**
 * The finite-type test of phase 1, the one place T2 asks it (SPEC 5.6: a tool decides by calling
 * `classify` once when the board is loaded). Before phase 2 it is true exactly for a board named by a
 * finite type (state.ts `isNamedFinite`); every custom board counts as not of finite type (4.0, E-9
 * rule 2). P2-A7 switches this one line to the verdict of `classify` that resolveBoard attaches.
 */
export function isNamedFinite(board: AnyBoard): boolean {
  return namedFinite(board);
}

/**
 * The layers bound of 4.0: the `layers` property when the page gives one, otherwise
 * CAPS.layersOffFinite (40) on a board that is not of finite type and no bound on a finite one.
 */
export function layersBound(board: AnyBoard, layers?: number): number | undefined {
  if (layers !== undefined) return layers;
  return isNamedFinite(board) ? undefined : CAPS.layersOffFinite;
}

/** The game of the garden: mutation for roots and for an orbit of populations, firing for numbers. */
export function gameOf(grows: Grows, coords: Coords | undefined): Game {
  if (grows === 'roots') return 'mutation';
  return coords === 'numbers' ? 'firing' : 'mutation';
}

/** The key of a position (5.5): entries as decimal text joined by commas. */
export function keyOf(board: AnyBoard, v: Vector): string {
  const show = (board.arith as Board<unknown>['arith']).show;
  let key = '';
  for (let k = 0; k < v.length; k++) key += (k === 0 ? '' : ',') + show(v[k]);
  return key;
}

/** The entries of a position in label order, as decimal text (what a link, a hook or a table shows). */
export function entriesInLabelOrder(board: AnyBoard, v: Vector): string[] {
  const show = (board.arith as Board<unknown>['arith']).show;
  return toPositions(board, labelOrder(board)).map((p) => show(v[p]));
}

/** The hook text of a position: entries in label order joined by commas, ASCII minus (data-position). */
export function positionText(board: AnyBoard, v: Vector): string {
  return entriesInLabelOrder(board, v).join(',');
}

/**
 * A start given in label order (JSON numbers or decimal strings) as a vector in positions. The board
 * returned is the board itself, or its Big copy when an entry does not fit SafeInt (E-2; T1's rule).
 */
export function startVector(board: AnyBoard, start: readonly (number | string)[]): { board: AnyBoard; v: Vector } {
  if (start.length !== board.n) throw new RangeError(`the start has ${start.length} entries, but the board has ${board.n} nodes`);
  const big = start.map((x) => (typeof x === 'number' ? BigInt(x) : parseInteger(x)));
  const fits = big.every((x) => Number.isSafeInteger(Number(x)));
  const b: AnyBoard = board.arith === (Big as unknown) || !fits ? bigBoard(board) : board;
  const positions = toPositions(b, labelOrder(b));
  const v: unknown[] = new Array(b.n);
  const isBig = typeof (b.arith as Board<unknown>['arith']).zero === 'bigint';
  for (let k = 0; k < b.n; k++) v[positions[k]!] = isBig ? big[k] : Number(big[k]);
  return { board: b, v };
}

/** The single Martians e_0, ..., e_{n-1} in increasing position: the seeds of `roots` (oracle `roots`). */
export function unitSeeds(board: AnyBoard): Vector[] {
  const a = board.arith as Board<unknown>['arith'];
  return Array.from({ length: board.n }, (_, i) => Array.from({ length: board.n }, (_, j) => (j === i ? a.one : a.zero)));
}

export interface GardenSpec {
  board: AnyBoard;
  grows: Grows;
  /** The seed of `orbit` mode (positions, the board's arithmetic); ignored in `roots` mode. */
  seed?: Vector;
  game: Game;
}

/** The seeds of a garden: all single Martians in `roots` mode, the one seed in `orbit` mode. */
export function seedsOf(spec: GardenSpec): Vector[] {
  if (spec.grows === 'roots') return unitSeeds(spec.board);
  if (spec.seed === undefined) throw new RangeError('orbit mode needs a seed');
  return [spec.seed];
}

export interface Grown {
  /** The board the search ran on (its Big copy after an overflow). */
  board: AnyBoard;
  graph: OrbitGraph<unknown>;
  maxDepth: number | undefined;
}

/** Runs `body` on the board, again on its Big copy when SafeInt overflows (E-2). */
export function withOverflow<R>(board: AnyBoard, body: (b: AnyBoard) => R): { board: AnyBoard; result: R } {
  try {
    return { board, result: body(board) };
  } catch (e) {
    if (!(e instanceof EngineOverflow) || board.arith === (Big as unknown)) throw e;
    const big = bigBoard(board);
    return { board: big, result: body(big) };
  }
}

function toBigVector(v: Vector): bigint[] {
  return v.map((x) => BigInt(x as number | bigint));
}

/**
 * The one call that grows the garden: orbitGraph(board, seeds, game, CAPS.gardenPositions, maxDepth),
 * never legalOnly, never in the worker. The garden after k layers is exactly the engine's result for
 * maxDepth k, so the order and truncation of SPEC 5.5 hold by construction.
 */
export function grow(spec: GardenSpec, maxDepth: number | undefined): Grown {
  const seeds = seedsOf(spec);
  const { board, result } = withOverflow(spec.board, (b) => {
    const s = b === spec.board ? seeds : seeds.map(toBigVector);
    return orbitGraph(b as Board<unknown>, s, spec.game, CAPS.gardenPositions, maxDepth);
  });
  return { board, graph: result, maxDepth };
}

/**
 * The number of layers to grow: in `explore`, the layers grown so far (`grown` at load), clamped to
 * the layers bound when there is one.
 */
export function clampLayers(grown: number, bound: number | undefined): number {
  const g = Math.max(0, Math.floor(grown));
  return bound === undefined ? g : Math.min(g, bound);
}

/**
 * Whether "Grow one layer" can act: not when the search has completed (truncated false and fewer
 * layers than maxDepth), not at the layers bound, not when the cap has cut the search.
 */
export function canGrow(g: OrbitGraph<unknown>, maxDepth: number | undefined, bound: number | undefined): boolean {
  if (g.truncated) return false;
  if (maxDepth === undefined) return false;
  if (bound !== undefined && maxDepth >= bound) return false;
  return g.depthReached === maxDepth;
}

/** The vertex index: key to index in items. */
export function vertexIndex(board: AnyBoard, items: readonly Vector[]): Map<string, number> {
  const index = new Map<string, number>();
  items.forEach((v, k) => index.set(keyOf(board, v), k));
  return index;
}

/** An edge of the garden: two vertex indices (from < to), the node of the move and its label. */
export interface GardenEdge {
  from: number;
  to: number;
  node: number; // position
  label: number; // E-7
}

/**
 * Every edge of the move graph (SPEC 5.4: "applies every move to every position of items once more"):
 * mutate or fire at every node of every item, look the result up, and keep it when it is in the garden.
 * A move is an involution, so each edge is kept once (from < to). A move that changes nothing joins a
 * position to itself and is not drawn. Two nodes joining the same two positions give two edges.
 */
export function moveEdges(board: AnyBoard, items: readonly Vector[], game: Game, index?: Map<string, number>): GardenEdge[] {
  const idx = index ?? vertexIndex(board, items);
  const move = game === 'mutation' ? mutate : fire;
  const b = board as Board<unknown>;
  const edges: GardenEdge[] = [];
  for (let h = 0; h < items.length; h++) {
    for (let i = 0; i < board.n; i++) {
      const w = move(b, items[h]!, i);
      const k = idx.get(keyOf(board, w));
      if (k === undefined || k <= h) continue;
      edges.push({ from: h, to: k, node: i, label: board.labels[i]! });
    }
  }
  return edges;
}

/** The number of positions in each layer 0, 1, ..., depthReached (layer 0 the seeds). */
export function newPerLayer(depth: readonly number[]): number[] {
  const out: number[] = [];
  for (const d of depth) {
    while (out.length <= d) out.push(0);
    out[d]!++;
  }
  return out;
}

/**
 * The layers of the chart with the last one marked when the cap cut it (4.0: never present a truncated
 * result as complete): layers above completeLayers are incomplete when the search was truncated.
 */
export function chartLayers(g: OrbitGraph<unknown>): { layer: number; count: number; complete: boolean }[] {
  return newPerLayer(g.depth).map((count, layer) => ({ layer, count, complete: !g.truncated || layer <= g.completeLayers }));
}

// ---------------------------------------------------------------------------------------------
// The counter (SPEC 4 T2 Interactions)
// ---------------------------------------------------------------------------------------------

export type Total = { kind: 'number'; value: number } | { kind: 'more'; text: string } | { kind: 'none' };

/** The text of a total that exceeds the bound: exactly "more than 2000". */
export const MORE_THAN = `more than ${CAPS.gardenPositions}`;

/**
 * The total of the counter. `roots` on a named finite-type board: the number of roots, complete by
 * E-9 rule 1. `orbit`: from the full bounded search of the seed, its number of items when it completed,
 * "more than 2000" when the cap cut it, and no total when it stopped at the layers bound below the cap
 * (plan: "more than 2000" would then be false). Any other case: no total.
 * Phase 3: on a board `classify` calls finite the counter's orbit total comes from `orbitSize` instead,
 * in gardenTotal (t02/phase2.ts, beside the other rules that read the verdict of `classify`).
 */
export function totalOf(spec: GardenSpec, bound: number | undefined): Total {
  if (spec.grows === 'roots') {
    if (!isNamedFinite(spec.board)) return { kind: 'none' };
    const r = roots(spec.board as Board<unknown>, CAPS.gardenPositions);
    return r.truncated ? { kind: 'more', text: MORE_THAN } : { kind: 'number', value: r.items.length };
  }
  const { graph: g } = grow(spec, bound);
  if (g.truncated) return { kind: 'more', text: MORE_THAN };
  if (bound !== undefined && g.depthReached >= bound) return { kind: 'none' };
  return { kind: 'number', value: g.items.length };
}

/** The text the counter shows for a total (plan wording for no total). */
export function totalText(t: Total): string {
  if (t.kind === 'number') return String(t.value);
  if (t.kind === 'more') return t.text;
  return 'no total on this board';
}

// ---------------------------------------------------------------------------------------------
// The jump (SPEC 4 T2 "click a vertex to jump there (the board shows a shortest word, from wordTo)")
// ---------------------------------------------------------------------------------------------

/** The seed index a vertex was reached from: follow `parent` until it is null. */
export function rootOf(g: OrbitGraph<unknown>, index: number): number {
  let k = index;
  for (;;) {
    const p = g.parent[k];
    if (p === null || p === undefined) return k;
    k = p;
  }
}

export interface Jump {
  /** The seed in label order (decimal text entries made numbers when safe). */
  start: (number | string)[];
  /** The shortest word, as labels. */
  moves: number[];
  /** The word in positions. */
  word: Word;
}

function integerOut(text: string): number | string {
  const n = Number(text);
  return Number.isSafeInteger(n) && String(n) === text ? n : text;
}

/** The state change of a jump to vertex `index`: start the seed it came from, moves the word (labels). */
export function jumpTo(board: AnyBoard, g: OrbitGraph<unknown>, index: number): Jump {
  const word = wordTo(g, index);
  const seed = g.items[rootOf(g, index)]!;
  return { start: entriesInLabelOrder(board, seed).map(integerOut), moves: toLabels(board, word), word };
}

/**
 * A shortest word from `start` to the position with key `targetKey` (for a linked T1 whose start is not
 * a seed of the garden), within the garden's bounds; null when it is not found there.
 */
export function wordFromStart(board: AnyBoard, start: Vector, game: Game, targetKey: string, bound: number | undefined): number[] | null {
  const g = orbitGraph(board as Board<unknown>, [start], game, CAPS.gardenPositions, bound);
  for (let k = 0; k < g.items.length; k++) {
    if (keyOf(board, g.items[k]!) === targetKey) return toLabels(board, wordTo(g, k));
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Edges drawn above 300 positions (SPEC 4 T2 Size), the current play, the highlight, the reset
// ---------------------------------------------------------------------------------------------

/** Whether every vertex and edge is drawn: up to CAPS.gardenDrawEverything positions, inclusive. */
export function drawsEverything(count: number): boolean {
  return count <= CAPS.gardenDrawEverything;
}

/**
 * The edges along the current play: for each move of the play (positions `playKeys[k]` to
 * `playKeys[k+1]` by the node with label `playLabels[k]`), the garden edge joining those two vertices
 * by that node, when both are in the garden. Returns indices into `edges`.
 */
export function playEdges(edges: readonly GardenEdge[], index: Map<string, number>, playKeys: readonly string[], playLabels: readonly number[]): number[] {
  const byPair = new Map<string, number>();
  edges.forEach((e, k) => byPair.set(`${e.from}|${e.to}|${e.label}`, k));
  const out = new Set<number>();
  for (let k = 0; k + 1 < playKeys.length; k++) {
    const a = index.get(playKeys[k]!);
    const b = index.get(playKeys[k + 1]!);
    if (a === undefined || b === undefined || a === b) continue;
    const id = `${Math.min(a, b)}|${Math.max(a, b)}|${playLabels[k]}`;
    const e = byPair.get(id);
    if (e !== undefined) out.add(e);
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * The edges drawn: all of them up to 300 positions; above, only the edges at the focused vertex and
 * along the current play ("as in T8"). Returns indices into `edges`, increasing.
 */
export function visibleEdges(edges: readonly GardenEdge[], vertexCount: number, focused: number | null, along: readonly number[]): number[] {
  if (drawsEverything(vertexCount)) return edges.map((_, k) => k);
  const out = new Set<number>(along);
  if (focused !== null) edges.forEach((e, k) => { if (e.from === focused || e.to === focused) out.add(k); });
  return [...out].sort((x, y) => x - y);
}

/**
 * The value of the page's highlight store for a vertex (SPEC 7.4): kind 'root' in roots mode and
 * 'position' in orbit mode; board the board's name or, for a custom board, the `c:` text of the codec;
 * value the entries in label order. Null when an entry is not a safe integer (the atom holds numbers).
 */
export function highlightFor(board: AnyBoard, boardText: string, grows: Grows, v: Vector | null): Highlight | null {
  if (v === null) return null;
  const entries = entriesInLabelOrder(board, v).map(Number);
  if (!entries.every((x) => Number.isSafeInteger(x))) return null;
  return { kind: grows === 'roots' ? 'root' : 'position', board: boardText, value: entries };
}

/**
 * Reset (4.0 History, plan for T2): the move list empties; in `explore` the garden returns to its
 * configured `grown` layers (clamped to the bound); in `follow` to the seed alone.
 */
export function resetGrowth(growth: Growth, grown: number, bound: number | undefined): { layers: number; moves: number[] } {
  return { layers: growth === 'explore' ? clampLayers(grown, bound) : 0, moves: [] };
}

/** The labels shown for an orbit-graph item index list (for exports and the table): the word to it. */
export function wordLabels(board: AnyBoard, g: OrbitGraph<unknown>, index: number): number[] {
  return toLabels(board, wordTo(g, index));
}
