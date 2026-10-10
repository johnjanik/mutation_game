// The play of T15 (SPEC.md 4 T15, 4.0 History and Step and play to the end, 5.6, 7.4, E-7, E-9). One
// class and a few pure helpers, no DOM. Every board is Board<bigint> (E-2); every move goes through the
// engine (fire, mutate, applyWord, legalNodes, toNumbers); positions inside, labels outside (E-7).
//
// The history after a long play (plan, decisions/P2-A4.md): a play of up to 20000 moves comes back
// from the worker as its word and its final position only, and E-9 rule 2 forbids replaying more than
// 2000 moves on the main thread. So positions are computed on demand and cached: the start, every
// position reached by a hand move, the end of a play, and every position scrubbed to. A position is
// computed from the nearest cached one, forwards or backwards (each move is an involution: firing or
// mutating twice at one node changes nothing), with applyWord on the main thread when the distance is
// at most 2000 moves (CAPS.mainThreadItems) and in the worker otherwise. Undo is one move back from the
// cached current position and never asks which moves are legal (4.0: "undo needs no legality test").
import { CAPS, applyWord, fire, legalNodes, mutate, toLabels, toNumbers, toPositions } from '@two-games/engine';
import type { Board, ClassifyRecord } from '@two-games/engine';
import { integerOut, labelOrder, type ToolState } from '../../../lib/state';

export type Coords = 'populations' | 'numbers';

/** The longest stretch of moves replayed on the main thread (E-9 rule 2; CAPS.mainThreadItems). */
export const MAIN_THREAD_MOVES = CAPS.mainThreadItems;

/** A start entry (a safe integer or decimal text) as bigint; RangeError otherwise. */
export function entryBig(x: number | string | bigint): bigint {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') {
    if (!Number.isSafeInteger(x)) throw new RangeError(`${String(x)} is not a safe integer`);
    return BigInt(x);
  }
  if (!/^-?\d+$/.test(x)) throw new RangeError(`${JSON.stringify(x)} is not an integer`);
  return BigInt(x);
}

/** A list in label order (the order of `start`, the table and exports) to a vector by position. */
export function byPosition<X>(board: Board<bigint>, inLabels: readonly X[]): X[] {
  const pos = toPositions(board, labelOrder(board));
  const out: X[] = new Array(board.n);
  pos.forEach((p, k) => {
    out[p] = inLabels[k]!;
  });
  return out;
}

/** A vector by position to a list in label order. */
export function inLabelOrder<X>(board: Board<bigint>, v: readonly X[]): X[] {
  return toPositions(board, labelOrder(board)).map((p) => v[p]!);
}

/**
 * The verdict line from the classify record (5.6: classify once when the board is loaded). D19: a
 * board recognised from its shape as C2~ is named in the B2 = C2 form for both choices (plan reading of
 * D19 for the affine pair). Never "not of finite type" from anything but classify (4.0).
 */
export function verdictText(records: readonly ClassifyRecord[]): string {
  if (records.length !== 1) return `${records.length} pieces`;
  const r = records[0]!;
  if (r.class === null) return 'a board with a one-way road';
  if (r.class !== 'affine') return r.class === 'finite' ? 'finite' : 'not of finite type and not affine';
  const name = r.name === 'C2~' ? 'B2~ = C2~' : (r.name ?? 'unnamed');
  return `affine, recognised as ${name}`;
}

/** True when the Cartan matrix is symmetric (marks and comarks then coincide, 2.12). */
export function isSymmetric(board: Board<bigint>): boolean {
  for (let i = 0; i < board.n; i++) for (let j = 0; j < i; j++) if (board.cartan[i]![j] !== board.cartan[j]![i]) return false;
  return true;
}

export interface GameConfig {
  coords: Coords;
  /** In label order; integers as safe numbers or decimal text. */
  start: readonly (number | string)[];
  /** Labels. */
  moves?: readonly number[];
}

/** One play: the start, the move list (with a redo tail after an undo), the cursor, the cache. */
export class AffineGame {
  readonly board: Board<bigint>;
  readonly coords: Coords;
  /** The start in label order, as the state writes it (safe integers as numbers, else decimal text). */
  readonly start: (number | string)[];
  moves: number[];
  cursor: number;
  /** Calls of legalNodes made through legalAt (a test hook: undo must not add to it). */
  legalCalls = 0;
  private readonly cache = new Map<number, bigint[]>();

  constructor(board: Board<bigint>, config: GameConfig) {
    this.board = board;
    this.coords = config.coords;
    if (config.start.length !== board.n) throw new RangeError(`the start has ${config.start.length} entries, but the board has ${board.n} nodes`);
    const big = config.start.map(entryBig);
    this.start = big.map((x) => integerOut(x));
    this.cache.set(0, byPosition(board, big));
    const moves = [...(config.moves ?? [])];
    toPositions(board, moves); // throws RangeError on a label the board does not have
    this.moves = moves;
    this.cursor = moves.length;
  }

  get game(): 'firing' | 'mutation' {
    return this.coords === 'numbers' ? 'firing' : 'mutation';
  }

  get labels(): readonly number[] {
    return this.board.labels;
  }

  /** The nearest index whose position is cached. */
  private nearest(k: number): number {
    let best = 0;
    for (const j of this.cache.keys()) if (Math.abs(j - k) < Math.abs(best - k)) best = j;
    return best;
  }

  /** The word (positions) that leads from index j to index k: forwards, or backwards in reverse order. */
  private wordBetween(j: number, k: number): number[] {
    if (k >= j) return toPositions(this.board, this.moves.slice(j, k));
    return toPositions(this.board, this.moves.slice(k, j)).reverse();
  }

  /** Whether the position at index k is known without a long replay. */
  cheap(k: number): boolean {
    return this.cache.has(k) || Math.abs(this.nearest(k) - k) <= MAIN_THREAD_MOVES;
  }

  /**
   * The position (by position, bigint) at index k of the move list, from the cache or by applyWord on
   * this thread from the nearest cached index; null when that is more than 2000 moves away (the caller
   * then uses positionAtAsync). `long` allows any distance (build time in Node, where E-9 does not bind).
   */
  positionAt(k: number, long = false): bigint[] | null {
    if (!Number.isInteger(k) || k < 0 || k > this.moves.length) throw new RangeError(`no position ${k}`);
    const hit = this.cache.get(k);
    if (hit !== undefined) return hit;
    const j = this.nearest(k);
    if (Math.abs(j - k) > MAIN_THREAD_MOVES && !long) return null;
    const v = applyWord(this.board, this.cache.get(j)!, this.wordBetween(j, k), this.game);
    this.cache.set(k, v);
    return v;
  }

  /** The position at index k through `run` (the worker's applyWord) when it is far from the cache. */
  async positionAtAsync(k: number, run: (v: bigint[], word: number[], game: 'firing' | 'mutation') => Promise<bigint[]>): Promise<bigint[]> {
    const near = this.positionAt(k);
    if (near !== null) return near;
    const j = this.nearest(k);
    const v = await run(this.cache.get(j)!, this.wordBetween(j, k), this.game);
    this.cache.set(k, v);
    return v;
  }

  /** The current position; it is always cached (every way of moving the cursor caches its target). */
  get current(): bigint[] {
    return this.cache.get(this.cursor) ?? this.positionAt(this.cursor, true)!;
  }

  /** The numbers at index k: the position itself, or a = C p from a population (2.4). */
  numbersAt(k: number): bigint[] {
    const v = k === this.cursor ? this.current : this.positionAt(k, true)!;
    return this.coords === 'numbers' ? v : toNumbers(this.board, v);
  }

  /** The legal nodes (positions) at the cursor in the numbers game (fire a positive number, 2.3). */
  legalNow(): number[] {
    this.legalCalls++;
    return legalNodes(this.board, this.numbersAt(this.cursor));
  }

  /** Drops the moves after the cursor and their cached positions (acting from an earlier position). */
  private truncate(): void {
    this.moves = this.moves.slice(0, this.cursor);
    for (const j of [...this.cache.keys()]) if (j > this.cursor) this.cache.delete(j);
  }

  /** One move at a position (fire or mutate), from the cursor; the moves after it are discarded. */
  act(position: number): number {
    const label = toLabels(this.board, [position])[0]!;
    const from = this.current;
    this.truncate();
    const next = this.coords === 'numbers' ? fire(this.board, from, position) : mutate(this.board, from, position);
    this.moves.push(label);
    this.cursor = this.moves.length;
    this.cache.set(this.cursor, next);
    return label;
  }

  /** Appends a play computed elsewhere (its word in positions and its final position) at the cursor. */
  appendPlay(word: readonly number[], position: readonly bigint[]): void {
    this.truncate();
    for (const l of toLabels(this.board, word)) this.moves.push(l);
    this.cursor = this.moves.length;
    this.cache.set(this.cursor, [...position]);
  }

  /** Moves the cursor to k when its position is cheap; false when it is not (use moveToAsync). */
  moveTo(k: number): boolean {
    if (!Number.isInteger(k) || k < 0 || k > this.moves.length) return false;
    if (this.positionAt(k) === null) return false;
    this.cursor = k;
    return true;
  }

  async moveToAsync(k: number, run: (v: bigint[], word: number[], game: 'firing' | 'mutation') => Promise<bigint[]>): Promise<boolean> {
    if (!Number.isInteger(k) || k < 0 || k > this.moves.length) return false;
    await this.positionAtAsync(k, run);
    this.cursor = k;
    return true;
  }

  /** Undo: one move back; no legality test (4.0). */
  undo(): boolean {
    return this.cursor > 0 && this.moveTo(this.cursor - 1);
  }

  redo(): boolean {
    return this.cursor < this.moves.length && this.moveTo(this.cursor + 1);
  }

  /** Reset empties the move list (4.0). */
  reset(): boolean {
    if (this.moves.length === 0 && this.cursor === 0) return false;
    this.cursor = 0;
    this.truncate();
    return true;
  }

  /** The state of 6.6 at the cursor: moves up to the cursor, never positions (7.4). */
  state(boardName: string): ToolState {
    return { schema: 1, tool: 'affine', board: boardName, coords: this.coords, start: [...this.start], moves: this.moves.slice(0, this.cursor) };
  }
}

/** The start of a picked board in a tab (4.0 Board pickers, plan): the marks in `frozen`, all ones for numbers. */
export function startFor(coords: Coords, board: Board<bigint>, marksByPosition: readonly number[]): number[] {
  if (coords === 'populations') return inLabelOrder(board, marksByPosition);
  return Array.from({ length: board.n }, () => 1);
}

/** delta + e_x in label order: the frozen population with one Martian added in city `label` (2.12). */
export function withMartian(board: Board<bigint>, marksByPosition: readonly number[], label: number): (number | string)[] {
  const order = labelOrder(board);
  const m = inLabelOrder(board, marksByPosition);
  return order.map((l, k) => integerOut(BigInt(m[k]!) + (l === label ? 1n : 0n)));
}
