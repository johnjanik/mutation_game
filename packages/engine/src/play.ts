// The rule-bound plays (SPEC.md 2.3 legal play, 2.7 F13 Kostant's game, 5.4, E-5, E-6): play, raisingPlay
// and kostantPlay, ported from the oracle's play (lines 220 to 232), raising_play (701 to 713) and
// kostant_play (696 to 698) with the lowest-position rule. Each returns 'ended' or 'cap' and never
// throws at a cap (E-10); 'looped' and firstVisit belong to playFate (phase 2, appended here by P2-A1).
// The cap rule (plan): the game ends ('ended') when no node is allowed, even at exactly cap moves; a
// game still open after cap moves stops before move cap + 1 with 'cap' and exactly cap moves.
import type { Vec } from './arith';
import type { Board } from './board';
import { CAPS } from './caps';
import type { Choose, Word } from './moves';
import { fire, legalNodes, mutate, raisingNodes, toNumbers } from './moves';

export interface PlayResult<T> {
  status: 'ended' | 'looped' | 'cap';
  moves: number;
  word: Word;
  fired: T[];
  position: Vec<T>;
  firstVisit?: number;
}

function checkCap(cap: number): void {
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError(`the cap ${String(cap)} is not a non-negative integer`);
}

function pick<T>(choose: Choose<T> | undefined, allowed: readonly number[], v: Vec<T>): number {
  if (choose === undefined) return allowed[0]!;
  const i = choose(allowed, v);
  if (!allowed.includes(i)) throw new RangeError(`choose returned ${String(i)}, which is not among the allowed nodes`);
  return i;
}

/**
 * Legal play of the numbers game: fire a node with a positive number, the lowest position unless `choose`
 * picks one, until no number is positive. `fired` holds the number fired at each move; the default cap is
 * CAPS.playMoves.
 */
export function play<T>(board: Board<T>, a: Vec<T>, choose?: Choose<T>, cap: number = CAPS.playMoves): PlayResult<T> {
  checkCap(cap);
  let current: T[] = [...a];
  const word: number[] = [];
  const fired: T[] = [];
  for (;;) {
    const allowed = legalNodes(board, current);
    if (allowed.length === 0) return { status: 'ended', moves: word.length, word, fired, position: current };
    if (word.length === cap) return { status: 'cap', moves: word.length, word, fired, position: current };
    const i = pick(choose, allowed, current);
    fired.push(current[i]!);
    word.push(i);
    current = fire(board, current, i);
  }
}

/**
 * Raising play of the mutation game from any population: mutate a city whose number (C p)_i is negative,
 * the lowest position unless `choose` picks one, until no city would rise. `fired` holds that number at the
 * moment of each mutation (negative; the city rises by its negation; -1 throughout on a simply laced
 * board, F13) (plan). Default cap CAPS.playMoves.
 */
export function raisingPlay<T>(board: Board<T>, p: Vec<T>, choose?: Choose<T>, cap: number = CAPS.playMoves): PlayResult<T> {
  checkCap(cap);
  let current: T[] = [...p];
  const word: number[] = [];
  const fired: T[] = [];
  for (;;) {
    const allowed = raisingNodes(board, current);
    if (allowed.length === 0) return { status: 'ended', moves: word.length, word, fired, position: current };
    if (word.length === cap) return { status: 'cap', moves: word.length, word, fired, position: current };
    const i = pick(choose, allowed, current);
    fired.push(toNumbers(board, current)[i]!);
    word.push(i);
    current = mutate(board, current, i);
  }
}

/** Kostant's game (F13): raisingPlay from one Martian in city i (a position; RangeError otherwise). */
export function kostantPlay<T>(board: Board<T>, i: number, choose?: Choose<T>, cap: number = CAPS.playMoves): PlayResult<T> {
  if (!Number.isInteger(i) || i < 0 || i >= board.n) {
    throw new RangeError(`position ${String(i)} is outside 0..${board.n - 1}`);
  }
  const { arith, n } = board;
  const start: T[] = [];
  for (let j = 0; j < n; j++) start.push(j === i ? arith.one : arith.zero);
  return raisingPlay(board, start, choose, cap);
}

// =============================================================================================
// Phase 2 (P2-A1): playFate, appended after P1-A1's code; nothing above this line is changed.
// SPEC.md 2.12 (the fate table), 5.4, 5.5 "Fates", 5.6; port of the oracle's play_fate (lines 1309 to
// 1325) in its order of tests: the end first, then the move, then the loop test, then the cap test. So
// a repeat is 'looped' even on the cap-th move, and a cap-th move that ends the game reports 'cap'
// (trap 6); this differs from play above and is the oracle's choice.
// =============================================================================================

/**
 * Legal play with loop detection: 'ended' when no number is positive, 'looped' at the first position seen
 * before (firstVisit is the move count at which it was first seen, 0 for the start), 'cap' when the play
 * has made `cap` moves without either (default CAPS.playMoves). The lowest position unless `choose`
 * picks one. Works on every kind of board. `cap` must be a positive integer (RangeError otherwise, plan).
 */
export function playFate<T>(board: Board<T>, a: Vec<T>, choose?: Choose<T>, cap: number = CAPS.playMoves): PlayResult<T> {
  if (!Number.isInteger(cap) || cap < 1) throw new RangeError(`the cap ${String(cap)} is not a positive integer`);
  if (a.length !== board.n) throw new RangeError(`the vector has ${a.length} entries, but the board has ${board.n} nodes`);
  const show = board.arith.show;
  const keyOf = (v: readonly T[]): string => v.map(show).join(',');
  let current: T[] = [...a];
  const seen = new Map<string, number>();
  seen.set(keyOf(current), 0);
  const word: number[] = [];
  const fired: T[] = [];
  for (;;) {
    const allowed = legalNodes(board, current);
    if (allowed.length === 0) return { status: 'ended', moves: word.length, word, fired, position: current };
    const i = pick(choose, allowed, current);
    fired.push(current[i]!);
    word.push(i);
    current = fire(board, current, i);
    const key = keyOf(current);
    const first = seen.get(key);
    if (first !== undefined) {
      return { status: 'looped', moves: word.length, word, fired, position: current, firstVisit: first };
    }
    seen.set(key, word.length);
    if (word.length >= cap) return { status: 'cap', moves: word.length, word, fired, position: current };
  }
}
