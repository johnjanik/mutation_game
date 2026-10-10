// Heaps of plays and the other functions of words (SPEC.md 5.4, 5.5 "Heaps", 2.7 F5, F6 and F12, E-4,
// E-6, E-7, E-10; CONTRACTS.md 2.4 phase 3): heap, heapKey, commutationClassSize, symbolicPlay and
// allCompleteGames, ported from the oracle's heap (lines 1150 to 1158), heap_key (1161 to 1162),
// commutation_class_size (1397 to 1411), symbolic_play (1414 to 1422) and all_complete_games (1165 to
// 1180). Every function takes and returns positions, works on every kind of board (5.6: no guard is
// called here), never writes into an argument, and never throws at a cap. Wildberger's "frame" is the
// site's "heap" (Appendix C).
import type { Vec } from './arith';
import type { AnyBoard, Board } from './board';
import { CAPS } from './caps';
import { EngineOverflow } from './errors';
import type { Word } from './moves';
import { fire } from './moves';
import type { Enumeration } from './search';

/** Every entry of a word is a position 0..n-1 (plan: RangeError otherwise, as for mutate and fire). */
function checkWord<T>(board: Board<T>, word: Word): void {
  for (const i of word) {
    if (!Number.isInteger(i) || i < 0 || i >= board.n) {
      throw new RangeError(`position ${String(i)} is outside 0..${board.n - 1}`);
    }
  }
}

/**
 * The oracle's test of "the same or a joined node": i === j, or a road in either direction (so a single
 * one-way road joins). Zero tests go through arith.sign, never !== 0, because 0n !== 0 holds.
 */
function joined<T>(board: Board<T>, i: number, j: number): boolean {
  if (i === j) return true;
  const { arith, cartan } = board;
  return arith.sign(cartan[i]![j]!) !== 0 || arith.sign(cartan[j]![i]!) !== 0;
}

/**
 * The heap of a play as falling bricks: brick k lands on level 1 + max of the levels of the earlier
 * bricks at the same or a joined node (level 1 is the floor). One level per brick, in the order of the
 * word; the empty word gives []. Every function here has an AnyBoard overload (plan, as in phase 2).
 */
export function heap<T>(board: Board<T>, word: Word): number[];
export function heap(board: AnyBoard, word: Word): number[];
export function heap<T>(board: Board<T>, word: Word): number[] {
  checkWord(board, word);
  const levels: number[] = [];
  for (let k = 0; k < word.length; k++) {
    const i = word[k]!;
    let top = 0;
    for (let j = 0; j < k; j++) {
      if (levels[j]! > top && joined(board, i, word[j]!)) top = levels[j]!;
    }
    levels.push(1 + top);
  }
  return levels;
}

/**
 * A key equal for two words exactly when their sorted multisets of (node, level) pairs are equal (the
 * oracle's tuple(sorted(zip(word, heap)))). Format (plan): the pairs sorted by node, then by level,
 * each written "node:level" over positions, joined by commas; the empty word gives "".
 */
export function heapKey<T>(board: Board<T>, word: Word): string;
export function heapKey(board: AnyBoard, word: Word): string;
export function heapKey<T>(board: Board<T>, word: Word): string {
  const levels = heap(board, word);
  const pairs: [number, number][] = [];
  for (let k = 0; k < word.length; k++) pairs.push([word[k]!, levels[k]!]);
  pairs.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
  return pairs.map(([node, level]) => `${node}:${level}`).join(',');
}

/**
 * The number of plays with the same heap (E-4: bigint): the number of ways to lay the bricks one at a
 * time. Dynamic programming over the set of bricks already laid as a bigint mask (a number mask would
 * break at 31 bricks): below[k] is the set of earlier bricks at the same or a joined node; count(full) = 1;
 * count(mask) sums count(mask | bit k) over the bricks k not in mask whose below[k] is inside mask;
 * memoised by mask; the answer is count(0). The empty word gives 1n.
 */
export function commutationClassSize<T>(board: Board<T>, word: Word): bigint;
export function commutationClassSize(board: AnyBoard, word: Word): bigint;
export function commutationClassSize<T>(board: Board<T>, word: Word): bigint {
  checkWord(board, word);
  const m = word.length;
  const bit: bigint[] = [];
  for (let k = 0; k < m; k++) bit.push(1n << BigInt(k));
  const below: bigint[] = [];
  for (let k = 0; k < m; k++) {
    let mask = 0n;
    for (let j = 0; j < k; j++) if (joined(board, word[k]!, word[j]!)) mask |= bit[j]!;
    below.push(mask);
  }
  const full = m === 0 ? 0n : (1n << BigInt(m)) - 1n;
  const memo = new Map<bigint, bigint>();
  const count = (mask: bigint): bigint => {
    if (mask === full) return 1n;
    const known = memo.get(mask);
    if (known !== undefined) return known;
    let total = 0n;
    for (let k = 0; k < m; k++) {
      if ((mask & bit[k]!) === 0n && (below[k]! & mask) === below[k]) total += count(mask | bit[k]!);
    }
    memo.set(mask, total);
    return total;
  };
  return count(0n);
}

/** Number from an exact bigint, or EngineOverflow when it is not a safe integer (plan reading of the contract). */
function toSafeNumber(x: bigint): number {
  const v = Number(x);
  if (!Number.isSafeInteger(v) || BigInt(v) !== x) {
    throw new EngineOverflow(`a coefficient of the symbolic game, ${x.toString()}, is not a safe integer`);
  }
  return v;
}

/**
 * The word played in the numbers game from the indeterminates x_1, ..., x_n: the linear forms fired, one
 * per move, each as its integer coefficient vector over positions. Row j of the running matrix is the
 * form on node j; each move records row i before the move, then a_j <- a_j - C[j][i] a_i on every row
 * (row i becomes its negative). No legality test: any word is played. Computed exactly in bigint and
 * converted entry by entry; an entry beyond 2^53 throws EngineOverflow. The empty word gives [].
 */
export function symbolicPlay<T>(board: Board<T>, word: Word): number[][];
export function symbolicPlay(board: AnyBoard, word: Word): number[][];
export function symbolicPlay<T>(board: Board<T>, word: Word): number[][] {
  checkWord(board, word);
  const { n, arith, cartan } = board;
  const C: bigint[][] = cartan.map((row) => row.map((x) => arith.toBig(x)));
  let M: bigint[][] = [];
  for (let i = 0; i < n; i++) {
    const row: bigint[] = [];
    for (let k = 0; k < n; k++) row.push(k === i ? 1n : 0n);
    M.push(row);
  }
  const fired: number[][] = [];
  for (const i of word) {
    const Mi = M[i]!;
    fired.push(Mi.map(toSafeNumber));
    M = M.map((row, j) => row.map((x, k) => x - C[j]![i]! * Mi[k]!));
  }
  return fired;
}

interface Frame<T> {
  a: T[];
  positive: number[]; // the nodes with a positive number, increasing
  next: number; // the index of the next one to try
}

function positiveNodes<T>(board: Board<T>, a: readonly T[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.n; i++) if (board.arith.sign(a[i]!) > 0) out.push(i);
  return out;
}

/**
 * Every complete legal play of the numbers game from `start`, as words of positions. Depth first with the
 * positive nodes tried in increasing position (the oracle's order), so the items come in lexicographic
 * order and the first is the word of play(board, start). The cap (E-6, E-10): when the search is about to
 * record game number cap + 1 it stops at once with exactly cap items and truncated true. Plays that do
 * not end (plan, from E-6 and 5.4): when a single play reaches CAPS.playMoves moves without ending, the
 * search stops at once with truncated true and the games found so far. On a finite-type board every play
 * from one start has the same length (F3), so there the bound binds only when that length exceeds the cap
 * on moves; on any other board a result with truncated true is never the complete list. An explicit stack
 * keeps a 20000-move play off the call stack.
 */
export function allCompleteGames<T>(board: Board<T>, start: Vec<T>, cap: number): Enumeration<Word>;
export function allCompleteGames(board: AnyBoard, start: Vec<number | bigint>, cap: number): Enumeration<Word>;
export function allCompleteGames<T>(board: Board<T>, start: Vec<T>, cap: number): Enumeration<Word> {
  const { n } = board;
  if (start.length !== n) {
    throw new RangeError(`the start has ${start.length} entries, but the board has ${n} nodes`);
  }
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError(`the cap ${String(cap)} is not a non-negative integer`);
  const items: Word[] = [];
  const word: number[] = [];
  const first: T[] = [...start];
  const stack: Frame<T>[] = [{ a: first, positive: positiveNodes(board, first), next: 0 }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    if (frame.positive.length === 0) {
      // a complete game: the word so far
      if (items.length === cap) return { items, truncated: true };
      items.push([...word]);
      stack.pop();
      word.pop();
      continue;
    }
    if (frame.next === frame.positive.length) {
      stack.pop();
      word.pop();
      continue;
    }
    if (word.length === CAPS.playMoves) return { items, truncated: true };
    const i = frame.positive[frame.next]!;
    frame.next += 1;
    word.push(i);
    const b = fire(board, frame.a, i);
    stack.push({ a: b, positive: positiveNodes(board, b), next: 0 });
  }
  return { items, truncated: false };
}
