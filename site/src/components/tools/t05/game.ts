// The game model of T5, the Numbers Game Lab (SPEC.md 4 T5, 4.0, 2.3, 2.6, 2.7 F3 F4 F10, 6.6, 7.4).
// Pure, no DOM. Legal play of the numbers game only: a node may be fired when its number is positive,
// and the game ends when none is. The start and the move list are the state; every position is
// recomputed by the engine (`fire`), one call per move (7.4), and kept in a list so that undo,
// redo and scrubbing cost nothing. The tape is the number on each node just before it fired (the
// oracle's `play`: fired.append(a[i]) before fire). Positions inside, labels outside (E-7): `start`
// is in label order, `moves` are labels, and the engine is called with positions.
import { CAPS, EngineOverflow, fire, legalNodes, play, toLabels, toPositions } from '@two-games/engine';
import type { AnyBoard, Board, Choose } from '@two-games/engine';
import { bigBoard, labelOrder, resolveBoard, type BoardSpec } from '../../../lib/state';

/** The kinds of start of the start chooser (SPEC 4 T5 "all ones, a fundamental weight, or custom"). */
export type StartKind = 'ones' | 'fundamental' | 'custom';

/** All ones, rho (SPEC 2.6), in label order. */
export function onesStart(n: number): number[] {
  return Array.from({ length: n }, () => 1);
}

/** The fundamental weight omega_i = e_i (2.6) for the node with the k-th label (k from 0), label order. */
export function fundamentalStart(n: number, k: number): number[] {
  return Array.from({ length: n }, (_, j) => (j === k ? 1 : 0));
}

/** The kind shown by the chooser, derived from the start, never stored (plan): ones, a unit vector, or custom. */
export function startKindOf(start: readonly (number | string)[]): StartKind {
  const t = start.map((x) => String(x));
  if (t.every((x) => x === '1')) return 'ones';
  const ones = t.filter((x) => x === '1').length;
  if (ones === 1 && t.every((x) => x === '1' || x === '0')) return 'fundamental';
  return 'custom';
}

/** The index (in label order) of the 1 of a unit-vector start, or null. */
export function fundamentalIndex(start: readonly (number | string)[]): number | null {
  if (startKindOf(start) !== 'fundamental') return null;
  return start.findIndex((x) => String(x) === '1');
}

/** True when every entry of the start is 1 (the game from rho). */
export function isOnes(start: readonly (number | string)[]): boolean {
  return startKindOf(start) === 'ones';
}

/** The digits an entry of a custom start may have (6.6: the codec's limit for `s`, plan). */
export const START_DIGITS = 40;

/**
 * Reads one typed entry of a custom start: an optional minus sign (ASCII or U+2212) and at most 40
 * digits. Returns the entry as a number when it is a safe integer, as decimal text otherwise, or null.
 */
export function readStartEntry(text: string): number | string | null {
  const t = text.trim().replace(/^−/, '-');
  const m = /^(-?)(\d+)$/.exec(t);
  if (m === null || m[2]!.length > START_DIGITS) return null;
  const big = BigInt(t);
  const n = Number(big);
  return Number.isSafeInteger(n) && BigInt(n) === big ? n : big.toString();
}

function entryBig(x: number | string): bigint {
  if (typeof x === 'number') {
    if (!Number.isSafeInteger(x)) throw new RangeError(`${String(x)} is not a safe integer`);
    return BigInt(x);
  }
  if (!/^-?\d+$/.test(x)) throw new RangeError(`${JSON.stringify(x)} is not an integer`);
  return BigInt(x);
}

function fitsSafe(x: number | string): boolean {
  const big = entryBig(x);
  return Number.isSafeInteger(Number(big)) && BigInt(Number(big)) === big;
}

/**
 * The board for a start: a named finite board keeps SafeInt unless an entry of the start leaves the
 * safe range, in which case it is reloaded with Big arithmetic, with no message (SPEC 4 T1, plan
 * reading for T5).
 */
export function boardForStart(board: AnyBoard, start: readonly (number | string)[]): AnyBoard {
  return start.every(fitsSafe) ? board : bigBoard(board);
}

/** The start (label order) as a vector by position, in the board's arithmetic. */
export function startVector(board: AnyBoard, start: readonly (number | string)[]): unknown[] {
  if (start.length !== board.n) throw new RangeError(`the start has ${start.length} entries, but the board has ${board.n} nodes`);
  const positions = toPositions(board, labelOrder(board));
  const b = board as Board<unknown>;
  const big = typeof b.arith.zero === 'bigint';
  const v: unknown[] = new Array(board.n);
  start.forEach((x, k) => {
    v[positions[k]!] = big ? entryBig(x) : b.arith.fromInt(Number(entryBig(x)));
  });
  return v;
}

/** A vector by position as a list in label order. */
export function inLabelOrder<X>(board: AnyBoard, v: readonly X[]): X[] {
  return toPositions(board, labelOrder(board)).map((p) => v[p]!);
}

/** The lowest position among the allowed ones (E-5), the rule of step and play to the end. */
export const lowestChoice: Choose<unknown> = (allowed) => allowed[0]!;
/** The highest position among the allowed ones: the plan's rule for game B of "two games compared". */
export const highestChoice: Choose<unknown> = (allowed) => allowed[allowed.length - 1]!;

export type ChoiceRule = 'lowest' | 'highest';

/** One entry of the tape: the move's number in the list, the node fired (label) and the number fired. */
export interface TapeEntry {
  move: number;
  label: number;
  value: string;
}

export type ActResult = { kind: 'moved'; label: number } | { kind: 'refused'; label: number; number: string };

export interface PlayOutcome {
  status: 'ended' | 'looped' | 'cap';
  moves: number;
}

export interface GameConfig {
  board: BoardSpec;
  start: readonly (number | string)[];
  moves?: readonly number[];
}

/**
 * One legal play of the numbers game: the start (label order), the move list (labels; it may run past
 * the cursor after an undo, for redo), the cursor, and every position by position in the board's
 * arithmetic. A move list the legal rule forbids throws a RangeError (a link is checked before).
 */
export class NumbersGame {
  readonly spec: BoardSpec;
  board: AnyBoard;
  readonly start: (number | string)[];
  moves: number[] = [];
  cursor = 0;
  positions: unknown[][] = [];

  constructor(config: GameConfig) {
    this.spec = config.board;
    this.start = [...config.start];
    this.board = boardForStart(resolveBoard(config.board), this.start);
    this.guarded(() => {
      this.positions = [startVector(this.board, this.start)];
    });
    const labels = config.moves ?? [];
    for (const position of toPositions(this.board, labels)) {
      if (this.act(position).kind !== 'moved') {
        throw new RangeError(`move ${this.moves.length + 1} (node ${toLabels(this.board, [position])[0]}) is not a legal firing`);
      }
    }
  }

  private get b(): Board<unknown> {
    return this.board as Board<unknown>;
  }

  get n(): number {
    return this.board.n;
  }

  /** Labels by position. */
  get labels(): readonly number[] {
    return this.board.labels;
  }

  /** Runs `body`; on EngineOverflow switches to Big, recomputes every position and runs it again. */
  private guarded<R>(body: () => R): R {
    try {
      return body();
    } catch (e) {
      if (!(e instanceof EngineOverflow) || typeof this.b.arith.zero === 'bigint') throw e;
    }
    this.board = bigBoard(this.board);
    const ks = toPositions(this.board, this.moves);
    const out: unknown[][] = [startVector(this.board, this.start)];
    for (const k of ks) out.push(fire(this.b, out[out.length - 1]!, k));
    this.positions = out;
    return body();
  }

  /** The position after `index` moves, by position. */
  positionAt(index: number): readonly unknown[] {
    return this.positions[index]!;
  }

  get current(): readonly unknown[] {
    return this.positions[this.cursor]!;
  }

  /** Decimal texts of a position, by position (the hooks' data-value). */
  shownAt(index: number): string[] {
    return this.positions[index]!.map((x) => this.b.arith.show(x));
  }

  get shown(): string[] {
    return this.shownAt(this.cursor);
  }

  /** The positions with a positive number at a point of the play, increasing (E-5 order). */
  legalAt(index = this.cursor): number[] {
    return legalNodes(this.b, this.positions[index]!);
  }

  canAct(): boolean[] {
    const allowed = new Set(this.legalAt());
    return Array.from({ length: this.n }, (_, k) => allowed.has(k));
  }

  /** No number is positive at the current point (SPEC 2.3: the game ends). */
  get gameOver(): boolean {
    return this.legalAt().length === 0;
  }

  /** Fires a position when its number is positive; a refusal changes nothing. */
  act(position: number): ActResult {
    const label = toLabels(this.board, [position])[0]!;
    if (this.b.arith.sign(this.current[position]) <= 0) {
      return { kind: 'refused', label, number: this.b.arith.show(this.current[position]) };
    }
    this.appendWord([position]);
    return { kind: 'moved', label };
  }

  /** Appends moves (positions) at the cursor, discarding the moves after it; one engine call per move. */
  appendWord(word: readonly number[]): void {
    this.moves = this.moves.slice(0, this.cursor);
    this.positions = this.positions.slice(0, this.cursor + 1);
    const labels = toLabels(this.board, word);
    const base = this.moves.length;
    this.guarded(() => {
      // On a retry after the switch to Big, the moves already appended were recomputed with the rest.
      for (let k = this.moves.length - base; k < word.length; k++) {
        this.positions.push(fire(this.b, this.positions[this.positions.length - 1]!, word[k]!));
        this.moves.push(labels[k]!);
      }
    });
    this.cursor = this.moves.length;
  }

  /** The position step fires: the lowest (or, for game B, the highest) allowed one, or null at the end. */
  stepPosition(rule: ChoiceRule = 'lowest'): number | null {
    const allowed = this.legalAt();
    if (allowed.length === 0) return null;
    return rule === 'lowest' ? allowed[0]! : allowed[allowed.length - 1]!;
  }

  /**
   * Play to the end: one call of the engine's `play` from the current position with the cap of 5.6,
   * its word appended to the moves. On a finite type the status is always 'ended' (F3, F5).
   */
  playToEnd(rule: ChoiceRule = 'lowest', cap: number = CAPS.playMoves): PlayOutcome {
    const result = this.guarded(() => play(this.b, this.current, rule === 'lowest' ? undefined : (highestChoice as Choose<unknown>), cap));
    this.appendWord(result.word);
    return { status: result.status, moves: result.word.length };
  }

  undo(): boolean {
    if (this.cursor === 0) return false;
    this.cursor--;
    return true;
  }

  redo(): boolean {
    if (this.cursor >= this.moves.length) return false;
    this.cursor++;
    return true;
  }

  reset(): boolean {
    if (this.moves.length === 0) return false;
    this.moves = [];
    this.positions = [this.positions[0]!];
    this.cursor = 0;
    return true;
  }

  scrub(to: number): boolean {
    if (!Number.isInteger(to) || to < 0 || to > this.moves.length || to === this.cursor) return false;
    this.cursor = to;
    return true;
  }

  /** The moves made up to the cursor (labels). */
  get applied(): number[] {
    return this.moves.slice(0, this.cursor);
  }

  /** The tape up to the cursor: for each move, the number on its node just before it fired. */
  tape(): TapeEntry[] {
    const out: TapeEntry[] = [];
    const ks = toPositions(this.board, this.applied);
    ks.forEach((k, m) => {
      out.push({ move: m + 1, label: this.moves[m]!, value: this.b.arith.show(this.positions[m]![k]) });
    });
    return out;
  }

  /** The numbers fired up to the cursor, as decimal text in move order. */
  fired(): string[] {
    return this.tape().map((e) => e.value);
  }

  /** The current position in label order, as decimal text. */
  valuesInLabelOrder(index = this.cursor): string[] {
    return inLabelOrder(this.board, this.shownAt(index));
  }
}

/** The word of the lowest-node (or highest-node) game from a start, as labels (the presets' moves). */
export function gameWord(spec: BoardSpec, start: readonly (number | string)[], rule: ChoiceRule = 'lowest'): number[] {
  const g = new NumbersGame({ board: spec, start });
  g.playToEnd(rule);
  return g.applied;
}
