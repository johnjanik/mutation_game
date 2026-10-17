// `follow` (SPEC.md 4 T2 "Modes of growth": vertices appear as the reader visits them). Pure. The
// garden starts with the followed board's position when it attaches; each move the reader makes adds
// the position it reaches when that position is new, and the edge it travelled (labelled by the node)
// when that edge is new; undo, redo, scrubbing and revisits add no vertex. A vertex keeps its place
// as others appear: it is ranked by its depth in the bounded orbitGraph of the followed start,
// computed once; a position outside that bounded graph goes one rank below the position it came from.
import { CAPS, orbitGraph } from '@two-games/engine';
import type { AnyBoard, Board, Game, OrbitGraph } from '@two-games/engine';
import { keyOf, type GardenEdge, type Vector } from './garden';

export interface FollowModel {
  items: Vector[];
  keys: string[];
  index: Map<string, number>;
  edges: GardenEdge[];
  /** The rank of each vertex (its layer in the drawing). */
  rank: number[];
  /** The index of each vertex in `rankGraph`, or null when the bounded search did not reach it. */
  inRankGraph: (number | null)[];
  /** The bounded search of the followed start, computed once; jumps take their words from it. */
  rankGraph: OrbitGraph<unknown>;
  rankIndex: Map<string, number>;
  /** True when CAPS.gardenPositions positions are held and nothing more is added. */
  full: boolean;
}

/** The model holding only the position the followed board stands on. */
export function followStart(board: AnyBoard, current: Vector, game: Game, bound: number | undefined): FollowModel {
  const rankGraph = orbitGraph(board as Board<unknown>, [current], game, CAPS.gardenPositions, bound);
  const rankIndex = new Map<string, number>();
  rankGraph.items.forEach((v, k) => rankIndex.set(keyOf(board, v), k));
  const key = keyOf(board, current);
  return {
    items: [current],
    keys: [key],
    index: new Map([[key, 0]]),
    edges: [],
    rank: [0],
    inRankGraph: [0],
    rankGraph,
    rankIndex,
    full: false,
  };
}

/**
 * The model after the reader moved from `from` to `to` by the node at position `node` (a move), or
 * changed the followed state some other way (`node` null: undo, redo, a scrub, a jump, a link), in
 * which case only a new position is added, without an edge. Returns the same model object when
 * nothing changed, a new one otherwise.
 */
export function followStep(model: FollowModel, board: AnyBoard, from: Vector | null, to: Vector, node: number | null): FollowModel {
  const toKey = keyOf(board, to);
  const fromIdx = from === null ? undefined : model.index.get(keyOf(board, from));
  let toIdx = model.index.get(toKey);
  let next = model;
  if (toIdx === undefined) {
    if (model.items.length >= CAPS.gardenPositions) return model.full ? model : { ...model, full: true };
    const r = model.rankIndex.get(toKey);
    const rank = r !== undefined ? model.rankGraph.depth[r]! : (fromIdx !== undefined ? model.rank[fromIdx]! + 1 : 0);
    toIdx = model.items.length;
    const index = new Map(model.index);
    index.set(toKey, toIdx);
    next = {
      ...model,
      items: [...model.items, to],
      keys: [...model.keys, toKey],
      index,
      rank: [...model.rank, rank],
      inRankGraph: [...model.inRankGraph, r ?? null],
    };
  }
  if (node !== null && fromIdx !== undefined && fromIdx !== toIdx) {
    const a = Math.min(fromIdx, toIdx);
    const b = Math.max(fromIdx, toIdx);
    const label = board.labels[node]!;
    if (!next.edges.some((e) => e.from === a && e.to === b && e.label === label)) {
      next = { ...next, edges: [...next.edges, { from: a, to: b, node, label }] };
    }
  }
  return next;
}

/**
 * The positions of the play `moves`, from the positions `held` of the play `heldMoves` (held[k] is the
 * position after the first k moves). SPEC 7.4: "while a tool runs it keeps the list of positions of the
 * current play in memory and extends it by one position per move, so a move costs one engine call
 * however long the play is". The positions of the moves the two lists share are kept, and `apply` (one
 * engine call: the move by the node with that label) is called once for each move after them, so a
 * followed T1's new move costs one call and its undo none. Returns a new array; `held` is not changed.
 */
export function extendPlay<V>(held: readonly V[], heldMoves: readonly number[], moves: readonly number[], apply: (v: V, label: number) => V): V[] {
  const shared = Math.min(heldMoves.length, moves.length, held.length - 1);
  let k = 0;
  while (k < shared && heldMoves[k] === moves[k]) k++;
  const out = held.slice(0, k + 1);
  for (let j = k; j < moves.length; j++) out.push(apply(out[j]!, moves[j]!));
  return out;
}

/**
 * Whether a change of the move list from `before` to `after` is one move made by the reader: `after`
 * is a prefix of `before` (cut at the cursor) followed by one move, and not itself a prefix of
 * `before` (that would be an undo, or a redo of a move already followed). Returns the label of that
 * move or null.
 */
export function moveMade(before: readonly number[], after: readonly number[]): number | null {
  if (after.length === 0 || after.length > before.length + 1) return null;
  for (let k = 0; k < after.length - 1; k++) if (after[k] !== before[k]) return null;
  if (after.length <= before.length && after[after.length - 1] === before[after.length - 1]) return null;
  return after[after.length - 1]!;
}
