// The dimension calculator of T5 (SPEC.md 4 T5 "Dimension calculator"; 2.7 F9; Appendix A.3; 5.4
// weylDimension; E-4). Pure, no DOM. The word is the lowest-node game from rho (the engine's play, as the
// oracle's weyl_dimension). The tape from rho is its `fired`; the tape from lambda + rho is the number on
// each node just before it fires along the same word (engine `fire` at each step). D and M are products
// of bigints, never floats; the quotient shown is the engine's weylDimension, checked against M / D.
import { fire, play, toLabels, weylDimension } from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import { bigBoard } from '../../../lib/state';

/** Plan cap: at most 6 digits per entry of lambda, on the input and on a link (decisions/P3-A3.md). */
export const LAMBDA_DIGITS = 6;
export const LAMBDA_MAX = 10 ** LAMBDA_DIGITS - 1;

/** True when lambda is dominant and within the cap: one whole number 0..999999 per node. */
export function validLambda(lambda: readonly number[] | undefined, n: number): lambda is number[] {
  return lambda !== undefined && lambda.length === n && lambda.every((x) => Number.isSafeInteger(x) && x >= 0 && x <= LAMBDA_MAX);
}

/** The text of a lambda field accepted by the input: digits only, at most 6 (a minus sign is refused). */
export function readLambdaEntry(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t) || t.replace(/^0+(?=\d)/, '').length > LAMBDA_DIGITS) return null;
  return Number(t);
}

export interface DimensionResult {
  /** The word of the game from rho, as labels. */
  word: number[];
  /** The numbers fired from rho, decimal text. */
  tapeRho: string[];
  /** lambda + rho in label order. */
  start: string[];
  /** The numbers fired from lambda + rho along the same word, decimal text. */
  tapeLambdaRho: string[];
  D: bigint;
  M: bigint;
  /** weylDimension(board, lambda), equal to M / D. */
  dimension: bigint;
}

/** The message shown should the calculation fail in the engine (plan wording; it cannot happen within the cap). */
export const DIMENSION_FAILED = 'The dimension could not be computed for this lambda.';

/**
 * The two games of F9 for a dominant lambda (label order). The tapes are computed in Big arithmetic, so
 * no number on them can overflow; the quotient is the engine's weylDimension on the board itself.
 */
export function dimensionOf(board: AnyBoard, lambda: readonly number[]): DimensionResult {
  if (!validLambda(lambda, board.n)) throw new RangeError('lambda must be dominant, one whole number of at most 6 digits per node');
  const big = bigBoard(board);
  const labelsInOrder = [...board.labels].sort((a, b) => a - b);
  // lambda is in label order; the vector is by position (E-7).
  const lambdaByPosition: number[] = new Array(board.n);
  labelsInOrder.forEach((l, k) => {
    lambdaByPosition[board.labels.indexOf(l)] = lambda[k]!;
  });
  const rho = Array.from({ length: big.n }, () => 1n);
  const game = play(big, rho);
  if (game.status !== 'ended') throw new Error('the game from rho did not end');
  let D = 1n;
  for (const f of game.fired) D *= f;
  let current: bigint[] = lambdaByPosition.map((x) => BigInt(x) + 1n);
  const startText = labelsInOrder.map((l) => current[board.labels.indexOf(l)]!.toString());
  const tapeLambdaRho: string[] = [];
  let M = 1n;
  for (const i of game.word) {
    tapeLambdaRho.push(current[i]!.toString());
    M *= current[i]!;
    current = fire(big, current, i);
  }
  const dimension = weylDimension(board as Board<unknown>, lambdaByPosition);
  if (M % D !== 0n || M / D !== dimension) throw new Error('M / D differs from weylDimension');
  return {
    word: toLabels(board, game.word),
    tapeRho: game.fired.map((x) => x.toString()),
    start: startText,
    tapeLambdaRho,
    D,
    M,
    dimension,
  };
}
