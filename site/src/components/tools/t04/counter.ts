// T4's root counter and conjecture hunter (P2-A3; SPEC 4 T4 Root counter and Conjecture hunter, 2.11,
// 4.0 Stated limits and Growth, 5.5 Order and truncation, 5.6, E-9). Pure.
//
// The counter grows the root populations breadth first from the single Martians e_0..e_{n-1}, in
// position order and in the board's own arithmetic (the oracle's [unit(n, i) for i in range(n)]).
// On a board that classify calls finite the count is complete: no layer bound, a cap of 2000 (at most
// 288 roots on twelve nodes, E-9). On any other board the main thread searches `layers` layers or
// 2000 positions, whichever comes first, and "keep counting" starts a new search in the worker with a
// cap of 100000 and the same layer bound. The stop sentences are T2's, character for character
// (t02/limits.ts). The hunter reads only the positions a search found and never states a theorem.
import { CAPS, orbitGraph, toLabels, wordTo } from '@two-games/engine';
import type { AnyBoard, Board, OrbitGraph } from '@two-games/engine';
import type { CallHint } from '../../../lib/worker';
import { stopMessage as gardenStopMessage } from '../t02/limits';
import { isLong, shortValue } from '../t01/longNumber';

/** The default `layers` property (4.0: "default 40 on any board that classify does not call finite"). */
export const DEFAULT_LAYERS = CAPS.layersOffFinite;

/** The single Martians e_0..e_{n-1} in position order, in the board's arithmetic (1n and 0n on Big). */
export function seedsOf(board: AnyBoard): unknown[][] {
  const arith = (board as Board<unknown>).arith;
  return Array.from({ length: board.n }, (_, i) => Array.from({ length: board.n }, (_, j) => (i === j ? arith.one : arith.zero)));
}

/** The cap and layer bound of a search: none on a finite board (complete), `layers` otherwise. */
export function searchBounds(finiteKnown: boolean, layers: number, cap: number = CAPS.mainThreadItems): { cap: number; maxDepth: number | undefined } {
  return { cap, maxDepth: finiteKnown ? undefined : layers };
}

/** The hint of a counter call (E-9): an enumeration whose cap is known in advance. */
export function counterHint(board: AnyBoard, cap: number, finiteKnown: boolean): CallHint {
  return { board, kind: 'enumeration', expectedItems: cap, finiteKnown };
}

/** The root populations by breadth-first layer, as the engine's orbitGraph returns them. */
export function rootSearch(board: AnyBoard, finiteKnown: boolean, layers: number, cap: number = CAPS.mainThreadItems): OrbitGraph<unknown> {
  const { maxDepth } = searchBounds(finiteKnown, layers, cap);
  return orbitGraph(board as Board<unknown>, seedsOf(board), 'mutation', cap, maxDepth);
}

/** The number of positions at each depth 0..depthReached (layer 0 holds the n seeds). */
export function layerCounts(graph: OrbitGraph<unknown>): number[] {
  const out: number[] = graph.items.length === 0 ? [] : Array.from({ length: graph.depthReached + 1 }, () => 0);
  for (const d of graph.depth) out[d] = (out[d] ?? 0) + 1;
  return out;
}

/**
 * The stop sentence of 5.5, or null when the count is complete: "stopped after N positions; layers 0
 * to L are complete" when the cap cut the search, "stopped after L layers" when the layer bound did.
 */
export function stopMessage(graph: OrbitGraph<unknown>, maxDepth: number | undefined, cap: number): string | null {
  return gardenStopMessage(graph, maxDepth, maxDepth, cap);
}

export interface CounterView {
  /** Root populations found. */
  found: number;
  /** New root populations per layer, for every layer present (the last may be incomplete). */
  layers: number[];
  /** Every layer up to this one is complete. */
  completeLayers: number;
  /** Positions in the complete layers 0..completeLayers. */
  inComplete: number;
  truncated: boolean;
  /** The sentence of 5.5, or null when the count is complete. */
  stop: string | null;
  /** How the search ended: complete, cut by the layer bound, or cut by the cap. */
  ended: 'complete' | 'layers' | 'cap';
  /** The layer bound used (undefined on a finite board). */
  maxDepth: number | undefined;
}

export function counterView(graph: OrbitGraph<unknown>, maxDepth: number | undefined, cap: number): CounterView {
  const layers = layerCounts(graph);
  const completeLayers = graph.completeLayers;
  const inComplete = layers.slice(0, completeLayers + 1).reduce((a, b) => a + b, 0);
  const stop = stopMessage(graph, maxDepth, cap);
  const ended = graph.truncated ? 'cap' : stop !== null ? 'layers' : 'complete';
  return { found: graph.items.length, layers, completeLayers, inComplete, truncated: graph.truncated, stop, ended, maxDepth };
}

/** A root population with both signs (2.11), as the hunter reports it, everything in labels. */
export interface Mixed {
  /** Index in the search's items (breadth-first order). */
  index: number;
  /** Moves from its single Martian: the depth. */
  moves: number;
  /** The entries in label order, as decimal text. */
  population: string[];
  /** The label of the city of the single Martian the word starts from. */
  start: number;
  /** The mutations, as labels, in the order played. */
  word: number[];
}

/** The positions in increasing label order (the order of `start` in 6.6). */
function labelOrder(board: AnyBoard): number[] {
  return [...board.labels.keys()].sort((a, b) => board.labels[a]! - board.labels[b]!);
}

/**
 * The first root population found with at least one positive and one negative entry, in the order of
 * `items` (breadth first), or null. Zeros count for neither sign.
 */
export function findMixed(graph: OrbitGraph<unknown>, board: AnyBoard): Mixed | null {
  const arith = (board as Board<unknown>).arith;
  for (let index = 0; index < graph.items.length; index++) {
    const v = graph.items[index]!;
    let pos = false;
    let neg = false;
    for (const x of v) {
      const s = arith.sign(x);
      if (s > 0) pos = true;
      else if (s < 0) neg = true;
    }
    if (!(pos && neg)) continue;
    let root = index;
    while (graph.parent[root] !== null && graph.parent[root] !== undefined) root = graph.parent[root]!;
    const seed = graph.items[root]!;
    const seedPosition = seed.findIndex((x) => arith.sign(x) !== 0);
    return {
      index,
      moves: graph.depth[index]!,
      population: labelOrder(board).map((p) => arith.show(v[p])),
      start: board.labels[seedPosition]!,
      word: toLabels(board, wordTo(graph, index)),
    };
  }
  return null;
}

/** An entry as shown: a true minus sign, and the shortened form above 12 digits (4.0 Long numbers). */
export function shownEntry(text: string): string {
  return isLong(text) ? shortValue(text) : text.replace(/^-/, '−');
}

/**
 * What the hunter reports (SPEC 4 T4; plan wordings for the cap-cut and the complete search):
 * - found: "(−1, 1) after 2 moves from one Martian in city 1: mutate 2, then 1";
 * - none, the layer bound acted: "none among the k root populations of the first 40 layers" (T4);
 * - none, the cap acted: "none among the k root populations found; layers 0 to L are complete" (plan);
 * - none, the search was complete: "none among the k root populations" (plan).
 */
export function hunterSentence(view: CounterView, mixed: Mixed | null): string {
  if (mixed !== null) {
    const moves = mixed.moves === 1 ? '1 move' : `${mixed.moves} moves`;
    const word = mixed.word.length === 0 ? '' : `: mutate ${mixed.word.join(', then ')}`;
    return `(${mixed.population.map(shownEntry).join(', ')}) after ${moves} from one Martian in city ${mixed.start}${word}`;
  }
  if (view.ended === 'cap') return `none among the ${view.found} root populations found; layers 0 to ${view.completeLayers} are complete`;
  if (view.ended === 'layers') return `none among the ${view.found} root populations of the first ${view.maxDepth} layers`;
  return `none among the ${view.found} root populations`;
}
