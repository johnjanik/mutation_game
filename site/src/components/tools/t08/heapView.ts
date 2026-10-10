// The heap view of T8 (SPEC.md 4 T8 bullet 3; 5.5 Heaps; 2.7 F5). Pure. "The current word as a stack
// of bricks, one column per node, a brick resting on the earlier bricks of the same or a joined node;
// and the number of plays with the same stack (commutationClassSize)." The levels come from the
// engine's heap (level 1 is the floor); this module never computes a level. Columns are the node
// labels in increasing order, left to right (plan). Two heaps are compared by heapKey, never by the
// list of levels in play order.
import { commutationClassSize, heap, heapKey, toPositions } from '@two-games/engine';
import type { AnyBoard } from '@two-games/engine';

export interface Brick {
  /** The brick's place in the word (0 = first move). */
  move: number;
  /** The node, as a label (E-7). */
  label: number;
  /** Its column: the rank of the label among the board's labels in increasing order (0 = leftmost). */
  column: number;
  /** Its level from the engine's heap: 1 is the floor. */
  level: number;
}

export interface HeapData {
  bricks: Brick[];
  /** heapKey of the word (positions inside the key, as the engine writes it). */
  key: string;
  /** commutationClassSize: the number of plays with the same stack (1 for the empty word). */
  count: bigint;
  /** The highest level, 0 for the empty word. */
  height: number;
  /** The column labels, left to right. */
  columns: number[];
}

/** The bricks of a word given in labels. */
export function bricksOf(board: AnyBoard, moves: readonly number[]): Brick[] {
  const word = toPositions(board, moves);
  const levels = heap(board, word);
  const columns = [...board.labels].sort((a, b) => a - b);
  return moves.map((label, k) => ({ move: k, label, column: columns.indexOf(label), level: levels[k]! }));
}

/** Everything the heap view shows for the current word (labels). */
export function heapData(board: AnyBoard, moves: readonly number[]): HeapData {
  const word = toPositions(board, moves);
  const bricks = bricksOf(board, moves);
  return {
    bricks,
    key: heapKey(board, word),
    count: commutationClassSize(board, word),
    height: bricks.reduce((m, b) => Math.max(m, b.level), 0),
    columns: [...board.labels].sort((a, b) => a - b),
  };
}

/** The bricks as a sorted multiset of "label:level" (what two equal stacks share). */
export function brickMultiset(bricks: readonly Brick[]): string[] {
  return bricks.map((b) => `${b.label}:${b.level}`).sort();
}
