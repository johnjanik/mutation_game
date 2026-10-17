// The meter and small values of T3 (SPEC.md 4 T3, 2.5, 2.7 F2, 2.11, 5.4 to 5.6; P2-A2 instruction
// 5.3 and 5.5). Pure, no DOM. Every number comes from the engine: the form value from `formValue`
// (shown with `ratToString`), the root verdict from `isRootPopulation` at its default cap
// (CAPS.rootTestSteps), the population of a linked T1 from the play kept for the states it published
// (`followPlay`, extended move by move, 7.4; `positionsOf` when no play is held).
// Nothing here evaluates a form by hand (SPEC 7.3).
import { EngineOverflow, fire, formValue, isRootPopulation, mutate, ratToString, toPositions } from '@two-games/engine';
import type { AnyBoard, Board } from '@two-games/engine';
import { bigBoard, defaultStart, positionsOf, resolveBoard, type ToolState } from '../../../lib/state';
import { entryValue } from './digits';

/** Words of the tool (plan wording; recorded in decisions/P2-A2.md). */
export const FORM_TEXT = {
  noForm: 'This board has no invariant form.',
  root: 'root population',
  notRoot: 'not a root population',
  tooLarge: 'too large to test here',
  needsTwoWay: 'the test needs two-way roads',
  incomplete: 'type a whole number in every city',
  numbersLink: 'The linked board starts from numbers; the meter reads populations only.',
} as const;

/** A vector given in label order, as a vector by position in the board's arithmetic. */
export function byPosition(board: AnyBoard, inLabelOrder: readonly (number | string)[]): unknown[] {
  if (inLabelOrder.length !== board.n) throw new RangeError(`${inLabelOrder.length} entries for ${board.n} cities`);
  const b = board as Board<unknown>;
  const big = typeof b.arith.zero === 'bigint';
  const positions = toPositions(board, [...board.labels].sort((x, y) => x - y));
  const v: unknown[] = new Array(board.n);
  inLabelOrder.forEach((x, k) => {
    v[positions[k]!] = big ? BigInt(x) : b.arith.fromInt(Number(x));
  });
  return v;
}

/**
 * The form value (p, p) of a population (by position, in the board's arithmetic) as `ratToString` text
 * (rule 4 of SPEC 5.7: p/q in lowest terms, or p), or null when the board has no invariant form
 * (not balanced, or a one-way road; SPEC 5.6).
 */
export function formText(board: AnyBoard, p: readonly unknown[]): string | null {
  const r = formValue(board as Board<unknown>, p);
  return r === null ? null : ratToString(r);
}

/** The verdict of the root test as the tool words it; `null` from the engine is never a negative verdict. */
export function rootVerdict(board: AnyBoard, p: readonly unknown[]): string {
  if (board.kind !== 'gcm') return FORM_TEXT.needsTwoWay; // isRootPopulation throws NeedsTwoWayRoads there (5.6)
  const r = isRootPopulation(board as Board<unknown>, p);
  return verdictText(r);
}

/** The words for an answer of `isRootPopulation`. */
export function verdictText(answer: boolean | null): string {
  if (answer === null) return FORM_TEXT.tooLarge;
  return answer ? FORM_TEXT.root : FORM_TEXT.notRoot;
}

/** One judged row of small values: its form value (null: no invariant form) and its verdict. */
export interface RowJudgement {
  complete: boolean;
  value: string | null;
  verdict: string;
}

/** Judges a row of typed texts (label order). An incomplete row is judged by nothing. */
export function judgeRow(board: AnyBoard, texts: readonly string[]): RowJudgement {
  const values = texts.map(entryValue);
  if (values.length !== board.n || values.some((x) => x === null)) return { complete: false, value: null, verdict: FORM_TEXT.incomplete };
  const p = byPosition(board, values as number[]);
  return { complete: true, value: formText(board, p), verdict: rootVerdict(board, p) };
}

/** The default rows of small values (plan): on A3, (1,0,0), (1,1,1), (1,0,1); elsewhere the first single Martian, all ones, and 1 then 0 then 1. */
export function defaultRows(board: AnyBoard): string[][] {
  const n = board.n;
  const martian = Array.from({ length: n }, (_, k) => (k === 0 ? '1' : '0'));
  const ones = Array.from({ length: n }, () => '1');
  const alternate = Array.from({ length: n }, (_, k) => (k % 2 === 0 ? '1' : '0'));
  const rows = [martian, ones, alternate];
  // Keep distinct rows only (A1 and A2 repeat some of them).
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** What the meter reads and from where (instruction 5.3; plan: a pure helper so that Node can test it). */
export interface MeterModel {
  /** The board the population lives on. */
  board: AnyBoard;
  /** The population read by the meter, in label order (the engine's decimal texts). */
  population: string[];
  /** The meter's text: the form value, or null when the board has no invariant form. */
  value: string | null;
  /** Whether the tool draws a board of its own (false when it follows a T1 through linkTo). */
  ownBoard: boolean;
  /** A sentence instead of a value when the source cannot be read as a population (a numbers start). */
  message: string | null;
}

/** The play of a followed instance as T3 keeps it between the states it publishes (SPEC 7.4). */
export interface FollowedPlay {
  /** The last state the followed instance published. */
  state: ToolState;
  /** Its board, resolved once per board (its Big copy after an overflow, E-2). */
  board: AnyBoard;
  /** The start and the position after each move, by position, in the board's arithmetic. */
  positions: readonly (readonly unknown[])[];
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The positions of `state`'s moves from `held`, the positions of `heldMoves`: one engine call per move they do not share. */
function extendFrom(board: AnyBoard, state: ToolState, held: readonly (readonly unknown[])[], heldMoves: readonly number[]): (readonly unknown[])[] {
  const b = board as Board<unknown>;
  const move = (state.coords ?? 'populations') === 'numbers' ? fire : mutate;
  const moves = state.moves ?? [];
  const shared = Math.min(heldMoves.length, moves.length, held.length - 1);
  let k = 0;
  while (k < shared && heldMoves[k] === moves[k]) k++;
  const out = held.slice(0, k + 1);
  for (let j = k; j < moves.length; j++) out.push(move(b, out[j]!, toPositions(board, [moves[j]!])[0]!));
  return out;
}

/**
 * The play after the followed instance published `next`, from the play kept for its last state. SPEC
 * 7.4: "while a tool runs it keeps the list of positions of the current play in memory and extends it
 * by one position per move, so a move costs one engine call however long the play is". With the same
 * board, coords and start, the positions of the moves both lists share are kept and only the moves
 * after them are applied; the first state, another board, coords or start, and an overflow are loads,
 * replayed from the start (with Big after an overflow, as positionsOf does).
 */
export function followPlay(held: FollowedPlay | null, next: ToolState): FollowedPlay {
  const sameBoard = held !== null && sameJson(held.state.board, next.board);
  if (held !== null && sameBoard && (held.state.coords ?? 'populations') === (next.coords ?? 'populations') && sameJson(held.state.start, next.start)) {
    try {
      return { state: next, board: held.board, positions: extendFrom(held.board, next, held.positions, held.state.moves ?? []) };
    } catch (e) {
      if (!(e instanceof EngineOverflow)) throw e;
    }
  }
  const board = sameBoard ? held!.board : resolveBoard(next.board);
  const start = next.start ?? defaultStart(board, next.coords ?? 'populations');
  try {
    return { state: next, board, positions: extendFrom(board, next, [byPosition(board, start)], []) };
  } catch (e) {
    if (!(e instanceof EngineOverflow)) throw e;
  }
  const big = bigBoard(board);
  return { state: next, board: big, positions: extendFrom(big, next, [byPosition(big, start)], []) };
}

/**
 * The meter of a T3. Without `linkTo` it reads its own current population (`own`: the board and the
 * population in label order, from the engine's replay). With `linkTo`, it reads the last state the
 * followed instance published and draws no board of its own: from `held`, the play the component keeps
 * for that state with `followPlay` (7.4), or, without it, replayed by `positionsOf`. Before the
 * followed instance has published (the build, or a T1 not yet hydrated) it reads its own configured
 * state, which the page sets to the T1's.
 */
export function meterModel(
  linkTo: string | undefined,
  followed: ToolState | null,
  own: { board: AnyBoard; population: readonly string[] },
  held: FollowedPlay | null = null,
): MeterModel {
  const ownBoard = linkTo === undefined;
  if (!ownBoard && followed !== null) {
    const board = held !== null ? held.board : resolveBoard(followed.board);
    if ((followed.coords ?? 'populations') === 'numbers') {
      return { board, population: [], value: null, ownBoard, message: FORM_TEXT.numbersLink };
    }
    let population: string[];
    if (held !== null) {
      const last = held.positions[held.positions.length - 1]!;
      const show = (board as Board<unknown>).arith.show;
      population = toPositions(board, [...board.labels].sort((x, y) => x - y)).map((p) => show(last[p]));
    } else {
      const all = positionsOf(followed);
      population = all[all.length - 1]!.map(String);
    }
    return { board, population, value: valueOf(board, population), ownBoard, message: null };
  }
  const population = [...own.population];
  return { board: own.board, population, value: valueOf(own.board, population), ownBoard, message: null };
}

function valueOf(board: AnyBoard, population: readonly string[]): string | null {
  return formText(board, byPosition(board, population));
}
