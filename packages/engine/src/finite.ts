// The finite-type data of SPEC.md 2.6 to 2.8 and 5.4: highestRoot, highestShortRoot, coxeterNumber,
// longestWord, minusW0, minusculeNodes, ported from the oracle (lines 1688 to 1717 and 235 to 243).
// Phase 1 writes no guard (E-11): these are called only on named finite boards; P2-A1 puts its guard call
// in place of the first statement of each function, which does no work before that point. Bound (plan,
// E-6): the internal root search runs to CAPS.workerPositions and the internal play of longestWord to the
// same cap; a truncated search, a play at its cap, or a failed finite-type assertion of the oracle throws
// NotFiniteType, the class SPEC.md 5.6 gives a gcm board off the finite types.
import type { Board } from './board';
import { subBoard, transposeBoard } from './board';
import { CAPS } from './caps';
import { NotFiniteType } from './errors';
import type { Word } from './moves';
import { applyWord, toNumbers } from './moves';
import { play } from './play';
import { positiveRootsFrom, roots } from './search';

const INTERNAL_CAP = CAPS.workerPositions;

/** The positive roots of a finite-type board, in positiveRoots order; NotFiniteType when the search is cut. */
function finitePositiveRoots<T>(board: Board<T>): T[][] {
  const all = roots(board, INTERNAL_CAP);
  if (all.truncated) {
    throw new NotFiniteType(`more than ${INTERNAL_CAP} root populations: this board is not of finite type`);
  }
  return positiveRootsFrom(board, all.items);
}

function total<T>(board: Board<T>, v: readonly T[]): T {
  let s = board.arith.zero;
  for (const x of v) s = board.arith.add(s, x);
  return s;
}

/** The positive root of largest total: the first one in positiveRoots order (the oracle's max keeps the first). */
export function highestRoot<T>(board: Board<T>): T[] {
  // phase 2: the guard call of P2-A1 goes here
  const pos = finitePositiveRoots(board);
  const { arith } = board;
  let best = pos[0];
  if (best === undefined) throw new NotFiniteType('a board with no positive root');
  let bestTotal = total(board, best);
  for (let k = 1; k < pos.length; k++) {
    const t = total(board, pos[k]!);
    if (arith.sign(arith.sub(t, bestTotal)) > 0) {
      best = pos[k]!;
      bestTotal = t;
    }
  }
  return best;
}

/**
 * The highest short root without the form (SPEC.md 5.5): among the positive roots whose numbers have no
 * negative entry, one survivor means simply laced (null); two, the one of smaller total (the first
 * minimum); any other count is not of finite type.
 */
export function highestShortRoot<T>(board: Board<T>): T[] | null {
  // phase 2: the guard call of P2-A1 goes here
  const { arith } = board;
  const dom = finitePositiveRoots(board).filter((r) => toNumbers(board, r).every((x) => arith.sign(x) >= 0));
  if (dom.length === 1) return null;
  if (dom.length !== 2) {
    throw new NotFiniteType(`${dom.length} positive roots with no negative number: this board is not of finite type`);
  }
  const [a, b] = dom as [T[], T[]];
  return arith.sign(arith.sub(total(board, b), total(board, a))) < 0 ? b : a;
}

/** h = 2N / n, with the oracle's integer division (2 * N // n). */
export function coxeterNumber<T>(board: Board<T>): number {
  // phase 2: the guard call of P2-A1 goes here
  const N = finitePositiveRoots(board).length;
  return Number(BigInt(2 * N) / BigInt(board.n));
}

/**
 * The word of the longest element of the sub-board on `nodes` (all positions by default): the numbers game
 * on that sub-board from all ones with the lowest-position rule, mapped back to the chosen positions
 * (SPEC.md 5.5). An empty list gives []; a repeated or out-of-range position is a RangeError.
 */
export function longestWord<T>(board: Board<T>, nodes?: readonly number[]): Word {
  // phase 2: the guard call of P2-A1 goes here
  const chosen: number[] = nodes === undefined ? board.labels.map((_, i) => i) : [...nodes].sort((a, b) => a - b);
  if (chosen.length === 0) return [];
  const sub = subBoard(board, chosen); // validates the positions
  const start: T[] = [];
  for (let k = 0; k < sub.n; k++) start.push(sub.arith.one);
  const r = play(sub, start, undefined, INTERNAL_CAP);
  if (r.status !== 'ended') {
    throw new NotFiniteType(`the game from all ones did not end within ${INTERNAL_CAP} moves: not of finite type`);
  }
  return r.word.map((k) => chosen[k]!);
}

/** The images of the positions under -w0: for each i, the j with -w0(e_i) = e_j; NotFiniteType unless it is a unit vector. */
export function minusW0<T>(board: Board<T>): number[] {
  // phase 2: the guard call of P2-A1 goes here
  const word = longestWord(board);
  const { arith, n } = board;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const e: T[] = [];
    for (let j = 0; j < n; j++) e.push(j === i ? arith.one : arith.zero);
    const v = applyWord(board, e, word, 'mutation');
    let image = -1;
    for (let j = 0; j < n; j++) {
      const x = arith.neg(v[j]!);
      if (arith.eq(x, arith.one)) {
        if (image >= 0) throw new NotFiniteType('-w0 does not permute the simple roots: not of finite type');
        image = j;
      } else if (arith.sign(x) !== 0) {
        throw new NotFiniteType('-w0 does not permute the simple roots: not of finite type');
      }
    }
    if (image < 0) throw new NotFiniteType('-w0 does not permute the simple roots: not of finite type');
    out.push(image);
  }
  return out;
}

/** F11: the positions where the highest root of the reversed board has entry 1, increasing. */
export function minusculeNodes<T>(board: Board<T>): number[] {
  // phase 2: the guard call of P2-A1 goes here
  const top = highestRoot(transposeBoard(board));
  const out: number[] = [];
  for (let i = 0; i < board.n; i++) if (board.arith.eq(top[i]!, board.arith.one)) out.push(i);
  return out;
}
