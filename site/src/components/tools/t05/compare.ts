// Two games compared (SPEC.md 4 T5 "Two games compared"; 2.7 F3, F4). Pure, no DOM. Game A is the
// tool's state; game B starts from the same start with its own move list (outside the link, plan). The
// two tapes are compared after sorting by value, never in move order: F3 says any two legal plays fire
// the same multiset of numbers, end at the same position and have the same length.

export interface GameSummary {
  /** The numbers fired, decimal text, in move order. */
  tape: readonly string[];
  /** No number is positive at the current point. */
  ended: boolean;
  /** The current position in label order, decimal text. */
  end: readonly string[];
  moves: number;
}

export interface Comparison {
  sortedA: string[];
  sortedB: string[];
  /** Both games have ended and the sorted tapes are equal. */
  agree: boolean;
  /** Both games have ended. */
  bothEnded: boolean;
  sameEnd: boolean;
  sameLength: boolean;
  /** The line shown under the overlay (plan wording). */
  status: string;
}

function compareText(a: string, b: string): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** A tape sorted by value (numerically). */
export function sortedTape(tape: readonly string[]): string[] {
  return [...tape].sort(compareText);
}

export const AGREE_TEXT = 'the sorted tapes agree';
export const DIFFER_TEXT = 'the sorted tapes differ';
export const UNFINISHED_A = 'Game A is unfinished: play it to the end to compare.';
export const UNFINISHED_B = 'Game B is unfinished: play it to the end to compare.';
export const UNFINISHED_BOTH = 'Both games are unfinished: play them to the end to compare.';

export function compareGames(a: GameSummary, b: GameSummary): Comparison {
  const sortedA = sortedTape(a.tape);
  const sortedB = sortedTape(b.tape);
  const bothEnded = a.ended && b.ended;
  const equal = sortedA.length === sortedB.length && sortedA.every((v, k) => v === sortedB[k]);
  const agree = bothEnded && equal;
  const sameEnd = a.end.length === b.end.length && a.end.every((v, k) => v === b.end[k]);
  const status = !a.ended && !b.ended ? UNFINISHED_BOTH : !a.ended ? UNFINISHED_A : !b.ended ? UNFINISHED_B : agree ? AGREE_TEXT : DIFFER_TEXT;
  return { sortedA, sortedB, agree, bothEnded, sameEnd, sameLength: a.moves === b.moves, status };
}
