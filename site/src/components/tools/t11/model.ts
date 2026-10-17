// T11, the Folding Bench: the pure part of the tool (SPEC.md 4 T11, 2.13, 4.0, 6.6, E-5, E-7, E-9).
// Owner P4-A4. No DOM. Every mathematical value comes from the engine: `symmetries`, `fold`,
// `averagedRootsType`, `applyWord` (and `positionsOf`, the site's replay, in the worker). This module
// only maps between labels and positions (E-7, through toLabels and toPositions), expands a symmetric
// move to its orbit, keeps the positions of the current play, and writes the sentences and the export.
//
// The two constructions of 2.13 are kept apart: the fold tab shows (a), the orbit sums, played on the
// folded board; the average tab shows (b), the type of the averaged roots. Neither is derived from the
// other here.
//
// A symmetric move is recorded in `moves` as ONE entry, the smallest label of the orbit acted on (plan,
// instruction 5.3); on replay it expands to the whole orbit in increasing position (E-5). The folded
// board's word is the same list read through the orbit map: folded position s is orbit s.
import {
  EngineOverflow,
  adjacency,
  applyWord,
  averagedRootsType,
  averagedSimpleCartan,
  cartanNumbers,
  fold,
  identify,
  symmetries,
  toLabels,
  toPositions,
} from '@two-games/engine';
import type { AnyBoard, Board, Game, RestrictedType, Symmetry } from '@two-games/engine';
import { announceTemplates, moveAnnouncement, speak } from '../../../lib/a11y';
import { bigBoard, cloneState, integerOut, labelOrder, resolveBoard, type ToolState } from '../../../lib/state';
import { LINK_NOTICE, decodeState, normalisePrefix } from '../../../lib/urlCodec';
import { whereToRun, type CallHint } from '../../../lib/worker';
import { T11_BOARDS, type T11View } from './config';

export type { T11View } from './config';

/** The phrase the first tab must show when the board does not fold (SPEC 4 T11 acceptance). */
export const ORBIT_EDGE_PHRASE = 'an orbit contains an edge';

/** The game played in a view (2.2, 2.3). */
export const gameOf = (view: T11View): Game => (view === 'numbers' ? 'firing' : 'mutation');

const asc = (a: number, b: number): number => a - b;

// ---------------------------------------------------------------------------------------------
// Symmetries: labels at the boundary, positions inside (E-7)
// ---------------------------------------------------------------------------------------------

/**
 * The symmetry of the state (the images of all nodes in label order, SPEC 6.6 `y`) as positions: the
 * node with the k-th label goes to the node labelled images[k]. RangeError on a wrong length, an
 * unknown label or a list that is not a permutation.
 */
export function symmetryToPositions(board: AnyBoard, images: readonly number[]): Symmetry {
  if (images.length !== board.n) throw new RangeError(`a symmetry of this board has ${board.n} images, not ${images.length}`);
  const from = toPositions(board, labelOrder(board));
  const to = toPositions(board, images);
  const sigma: number[] = new Array<number>(board.n);
  from.forEach((p, k) => {
    sigma[p] = to[k]!;
  });
  if (new Set(sigma).size !== board.n) throw new RangeError('the images are not a permutation of the labels');
  return sigma;
}

/** A symmetry in positions as the images of all nodes in label order (the inverse of symmetryToPositions). */
export function symmetryToLabels(board: AnyBoard, sigma: Symmetry): number[] {
  return labelOrder(board).map((l) => toLabels(board, [sigma[toPositions(board, [l])[0]!]!])[0]!);
}

export const isIdentity = (sigma: Symmetry): boolean => sigma.every((x, i) => x === i);

/** The symmetries the picker lists: the engine's list (identity first, lexicographic) without the identity. */
export function offeredSymmetries(board: AnyBoard): Symmetry[] {
  return symmetries(board).filter((s) => !isIdentity(s));
}

/** The default symmetry of a board: the first one the picker lists, in labels (plan). */
export function defaultSymmetry(board: AnyBoard): number[] {
  const first = offeredSymmetries(board)[0];
  if (first === undefined) throw new RangeError(`${board.name ?? 'this board'} has no symmetry other than the identity`);
  return symmetryToLabels(board, first);
}

// ---------------------------------------------------------------------------------------------
// The fold of a board by a symmetry
// ---------------------------------------------------------------------------------------------

export interface FoldContext {
  /** The big board (a named finite board, SafeInt). */
  board: AnyBoard;
  /** The symmetry in labels (state.symmetry) and in positions. */
  images: number[];
  sigma: Symmetry;
  /** The orbits in positions, each increasing, in order of least position (the engine's). */
  orbits: number[][];
  /** The orbit index of each position. */
  orbitOf: number[];
  /** The folded board (position s is orbit s; labels in the Bourbaki order of its type), or null. */
  folded: Board | null;
  foldedName: string | null;
  /** The sentence of the first tab when the board does not fold, else null. */
  message: string | null;
  /** The order of the symmetry. */
  order: number;
  /** The colour of each orbit, 1 to 8: its folded label, or its index plus 1 when the board does not fold (plan). */
  colour: number[];
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** "{1, 3}" (labels). */
export const orbitText = (labels: readonly number[]): string => `{${labels.join(', ')}}`;

function joinAnd(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The first tab's sentence when the board does not fold: the engine's reason, made sure to carry the
 * words "an orbit contains an edge" (plan, instruction 5.8), then the orbits that contain an edge.
 */
export function foldMessage(reason: string, edgeOrbits: readonly (readonly number[])[]): string {
  const why = reason.includes(ORBIT_EDGE_PHRASE) ? reason : `${ORBIT_EDGE_PHRASE} (${reason})`;
  let text = `This board does not fold by this symmetry: ${why}.`;
  if (edgeOrbits.length === 1) text += ` The orbit ${orbitText(edgeOrbits[0]!)} contains an edge.`;
  else if (edgeOrbits.length > 1) text += ` The orbits ${joinAnd(edgeOrbits.map(orbitText))} each contain an edge.`;
  return text;
}

const contexts = new Map<string, FoldContext>();

/**
 * The fold of a named board by a symmetry given in labels (fold, construction (a) of 2.13). Cached per
 * board name and symmetry: boards are immutable (E-11), so the cache cannot go stale.
 */
export function foldContext(board: AnyBoard, images: readonly number[]): FoldContext {
  const key = `${board.name ?? ''}|${images.join('.')}`;
  const known = board.name !== undefined ? contexts.get(key) : undefined;
  if (known !== undefined) return known;
  const sigma = symmetryToPositions(board, images);
  // fold does not check that the permutation preserves the board (the oracle's fold neither): T11 does.
  const C = cartanNumbers(board);
  if (C.some((row, i) => row.some((c, j) => C[sigma[i]!]![sigma[j]!] !== c))) throw new RangeError('the images are not a symmetry of the board');
  const r = fold(board, sigma);
  const orbits = r.orbits.map((o) => [...o].sort(asc));
  const orbitOf: number[] = new Array<number>(board.n);
  orbits.forEach((o, s) => o.forEach((p) => (orbitOf[p] = s)));
  const folded = r.folded;
  const foldedName = folded === null ? null : (folded.name ?? identify(folded)?.name ?? null);
  let message: string | null = null;
  if (folded === null) {
    const A = adjacency(board);
    const edged = orbits.filter((o) => o.some((i) => o.some((j) => A[i]![j] !== 0)));
    message = foldMessage(r.reason ?? ORBIT_EDGE_PHRASE, edged.map((o) => toLabels(board, o).sort(asc)));
  }
  const ctx: FoldContext = {
    board,
    images: [...images],
    sigma,
    orbits,
    orbitOf,
    folded,
    foldedName,
    message,
    order: orbits.reduce((acc, o) => (acc * o.length) / gcd(acc, o.length), 1),
    colour: orbits.map((_, s) => (folded === null ? s + 1 : folded.labels[s]!)),
  };
  if (board.name !== undefined) contexts.set(key, ctx);
  return ctx;
}

/** The orbits in labels, each increasing, in the engine's order (golden `orbits`). */
export function orbitsInLabels(ctx: FoldContext): number[][] {
  return ctx.orbits.map((o) => toLabels(ctx.board, o).sort(asc));
}

/** The orbits in the Bourbaki order of the folded board (golden `folded_orbits_in_bourbaki_order`), or null. */
export function orbitsInBourbakiOrder(ctx: FoldContext): number[][] | null {
  if (ctx.folded === null) return null;
  const inLabels = orbitsInLabels(ctx);
  const folded = ctx.folded;
  return inLabels.map((_, k) => inLabels[folded.labels.indexOf(k + 1)]!);
}

/** "{1, 3} {2}, order 2": the symmetry as the picker shows it (plan). */
export function symmetryText(ctx: FoldContext): string {
  return `${orbitsInLabels(ctx).map(orbitText).join(' ')}, order ${ctx.order}`;
}

/** The orbit index of the node with this label. */
export function orbitOfLabel(ctx: FoldContext, label: number): number {
  return ctx.orbitOf[toPositions(ctx.board, [label])[0]!]!;
}

/** The smallest label of orbit s: the entry a symmetric move on s leaves in `moves`. */
export function lowestLabel(ctx: FoldContext, s: number): number {
  return Math.min(...toLabels(ctx.board, ctx.orbits[s]!));
}

/** A symmetric move on orbit s as its single moves, in increasing position (E-5). */
export function expandMove(ctx: FoldContext, s: number): number[] {
  return [...ctx.orbits[s]!].sort(asc);
}

/** The folded board's word for a list of moves (labels of the big board): one orbit index per entry. */
export function foldedWord(ctx: FoldContext, moves: readonly number[]): number[] {
  return moves.map((l) => orbitOfLabel(ctx, l));
}

/** The big board's word: every entry expanded to its orbit. */
export function bigWord(ctx: FoldContext, moves: readonly number[]): number[] {
  return foldedWord(ctx, moves).flatMap((s) => expandMove(ctx, s));
}

/** Any label of an orbit names it; the list is written back with each orbit's smallest label (plan). */
export function normaliseMoves(ctx: FoldContext, moves: readonly number[]): number[] {
  return foldedWord(ctx, moves).map((s) => lowestLabel(ctx, s));
}

/**
 * The default start in label order (plan): all ones for the numbers view (6.6, symmetric for every
 * symmetry); for the populations view one Martian in every city of the orbit of the first city, which is
 * the folded board's "one Martian in the first city".
 */
export function defaultStart(board: AnyBoard, view: T11View, orbits: readonly (readonly number[])[]): number[] {
  const order = labelOrder(board);
  if (view === 'numbers') return order.map(() => 1);
  const first = toPositions(board, [order[0]!])[0]!;
  const orbit = orbits.find((o) => o.includes(first)) ?? [first];
  return order.map((l) => (orbit.includes(toPositions(board, [l])[0]!) ? 1 : 0));
}

const canonical = (x: number | string): string => String(integerOut(x));

/** True when the start (label order) is constant on every orbit, so that the folded board has a start. */
export function isSymmetricStart(ctx: FoldContext, start: readonly (number | string)[]): boolean {
  if (start.length !== ctx.board.n) return false;
  const at = (p: number): string => canonical(start[labelOrder(ctx.board).indexOf(toLabels(ctx.board, [p])[0]!)]!);
  return ctx.orbits.every((o) => o.every((p) => at(p) === at(o[0]!)));
}

// ---------------------------------------------------------------------------------------------
// Playing both boards (the engine plays each board on its own Cartan matrix)
// ---------------------------------------------------------------------------------------------

type AnyVec = readonly unknown[];

function startVector(board: Board<unknown>, start: readonly (number | string)[]): unknown[] {
  const positions = toPositions(board as AnyBoard, labelOrder(board as AnyBoard));
  const v: unknown[] = new Array<unknown>(board.n);
  positions.forEach((p, k) => {
    const t = canonical(start[k]!);
    v[p] = typeof board.arith.zero === 'bigint' ? BigInt(t) : board.arith.fromInt(Number(t));
  });
  return v;
}

const needsBig = (start: readonly (number | string)[]): boolean => start.some((x) => typeof integerOut(x) === 'string');

/**
 * Both final positions of a play (positions order, in the board's arithmetic): the big board plays the
 * expanded word, the folded board the word read through the orbit map, each by applyWord on its own
 * matrix. `moves` are labels of the big board; `start` is in label order and symmetric.
 */
export function replay(ctx: FoldContext, start: readonly (number | string)[], moves: readonly number[], game: Game): { big: unknown[]; small: unknown[] } {
  if (ctx.folded === null) throw new RangeError('the board does not fold by this symmetry');
  const big = (needsBig(start) ? bigBoard(ctx.board) : ctx.board) as Board<unknown>;
  const folded = (needsBig(start) ? bigBoard(ctx.folded) : ctx.folded) as Board<unknown>;
  const v0 = startVector(big, start);
  const f0 = ctx.orbits.map((o) => v0[o[0]!]);
  return { big: applyWord(big, v0, bigWord(ctx, moves), game), small: applyWord(folded, f0, foldedWord(ctx, moves), game) };
}

// ---------------------------------------------------------------------------------------------
// Worker hints (E-9)
// ---------------------------------------------------------------------------------------------

/** The hint of a replay of `wordLength` single moves on `board` (E-9 rule 2: a long list read from a link). */
export function playHint(board: AnyBoard, wordLength: number): CallHint {
  return { board, kind: 'play', moves: wordLength };
}

/**
 * The number of roots of an offered board, known in advance (E-9 rule 1): A_n has n(n + 1), D_n has
 * 2n(n - 1), E6 has 72 (SPEC 4 T2), E7 126 and E8 240. RangeError for any other name.
 */
export function rootCount(name: string): number {
  const m = /^([ADE])(\d+)$/.exec(name);
  const n = m === null ? 0 : Number(m[2]);
  if (m?.[1] === 'A' && n >= 1) return n * (n + 1);
  if (m?.[1] === 'D' && n >= 4) return 2 * n * (n - 1);
  const e: Record<number, number> = { 6: 72, 7: 126, 8: 240 };
  if (m?.[1] === 'E' && e[n] !== undefined) return e[n]!;
  throw new RangeError(`no root count for ${name}`);
}

/** The hint of averagedRootsType: an enumeration of the roots of a finite board, whose number is known. */
export function averagedHint(board: AnyBoard): CallHint {
  return { board, kind: 'enumeration', finiteKnown: true, expectedItems: rootCount(board.name ?? '') };
}

const averages = new WeakMap<FoldContext, RestrictedType>();

/**
 * The type of the averaged roots (construction (b) of 2.13, averagedRootsType), for every symmetry,
 * whether the board folds or not. It runs where whereToRun places it, which for the roots of a finite
 * board is always the main thread (instruction 5.7); an answer of 'worker' would be a bug of the hint.
 */
export function averagedOf(ctx: FoldContext): RestrictedType {
  const known = averages.get(ctx);
  if (known !== undefined) return known;
  if (whereToRun(averagedHint(ctx.board)) !== 'main') throw new Error('averagedRootsType was placed in the worker');
  const r = averagedRootsType(ctx.board, ctx.sigma);
  const out: RestrictedType = { name: r.name, classes: r.classes.map((c) => ({ class: c.class, roots: c.roots, form_value: c.form_value })) };
  averages.set(ctx, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The bench: one state, the positions of the current play (4.0, 7.4)
// ---------------------------------------------------------------------------------------------

export interface BenchConfig {
  board: string;
  view: T11View;
  symmetry?: readonly number[];
  start?: readonly (number | string)[];
  moves?: readonly number[];
}

export interface ActResult {
  /** The orbit acted on, its labels (increasing), the move's number, and the big board before and after (positions). */
  orbit: number;
  labels: number[];
  move: number;
  before: string[];
  after: string[];
}

const show = (x: unknown): string => String(x);

/**
 * The state of one T11 instance and the positions of its play. Both boards are recomputed by the engine
 * from the start and the list of symmetric moves; the positions after each move are kept, one engine
 * call per board per move (7.4). With `defer`, nothing is played in the constructor: the caller replays
 * on the main thread (replaySync) or in the worker (workerStates, acceptReplay), as E-9 decides.
 */
export class FoldBench {
  readonly spec: string;
  readonly view: T11View;
  readonly game: Game;
  readonly ctx: FoldContext;
  readonly start: (number | string)[];
  moves: number[];
  cursor: number;
  pending: boolean;
  private useBig: boolean;
  private bigAt: (string[] | undefined)[];
  private smallAt: (string[] | undefined)[];

  constructor(cfg: BenchConfig, opts: { defer?: boolean } = {}) {
    if (!(T11_BOARDS as readonly string[]).includes(cfg.board)) throw new RangeError(`T11 does not offer the board ${cfg.board}`);
    const board = resolveBoard(cfg.board);
    this.spec = cfg.board;
    this.view = cfg.view;
    this.game = gameOf(cfg.view);
    this.ctx = foldContext(board, cfg.symmetry ?? defaultSymmetry(board));
    if (isIdentity(this.ctx.sigma)) throw new RangeError('T11 does not offer the identity');
    this.start = (cfg.start ?? defaultStart(board, cfg.view, this.ctx.orbits)).map((x) => integerOut(x));
    if (!isSymmetricStart(this.ctx, this.start)) throw new RangeError('the start is not constant on the orbits of the symmetry');
    const moves = cfg.moves ?? [];
    if (this.ctx.folded === null && moves.length > 0) throw new RangeError('the board does not fold by this symmetry, so it has no symmetric moves');
    this.moves = normaliseMoves(this.ctx, moves);
    this.cursor = this.moves.length;
    this.useBig = needsBig(this.start);
    this.bigAt = [];
    this.smallAt = [];
    this.setStart();
    this.pending = false;
    if (opts.defer && this.moves.length > 0) this.pending = true;
    else this.replaySync();
  }

  get folds(): boolean {
    return this.ctx.folded !== null;
  }

  private bigCopies: { big: Board<unknown>; folded: Board<unknown> | null } | null = null;

  /**
   * The two boards in the arithmetic in force: the named board and the folded board (SafeInt), or their
   * Big copies (same matrices, labels and names) once a start or a play leaves the safe range (SPEC 4 T1,
   * "reloaded with Big arithmetic, with no message"). The copies are made once, so the drawing keeps them.
   */
  boards(): { big: Board<unknown>; folded: Board<unknown> | null } {
    const f = this.ctx.folded;
    if (!this.useBig) return { big: this.ctx.board as Board<unknown>, folded: f as Board<unknown> | null };
    this.bigCopies ??= { big: bigBoard(this.ctx.board) as Board<unknown>, folded: f === null ? null : (bigBoard(f) as Board<unknown>) };
    return this.bigCopies;
  }

  private setStart(): void {
    const v0 = startVector(this.boards().big, this.start).map(show);
    this.bigAt = [v0];
    this.smallAt = [this.ctx.orbits.map((o) => v0[o[0]!]!)];
  }

  private vec(board: Board<unknown>, values: readonly string[]): AnyVec {
    return typeof board.arith.zero === 'bigint' ? values.map((t) => BigInt(t)) : values.map((t) => board.arith.fromInt(Number(t)));
  }

  /** Plays move k (from the position after k moves) on both boards. */
  private advance(k: number): void {
    const s = orbitOfLabel(this.ctx, this.moves[k]!);
    const { big, folded } = this.boards();
    this.bigAt[k + 1] = applyWord(big, this.vec(big, this.bigAt[k]!), expandMove(this.ctx, s), this.game).map(show);
    this.smallAt[k + 1] = applyWord(folded!, this.vec(folded!, this.smallAt[k]!), [s], this.game).map(show);
  }

  /** Plays every move of the list on the main thread; an overflow of SafeInt replays in Big (SPEC 4 T1). */
  replaySync(): void {
    for (;;) {
      try {
        for (let k = 0; k < this.moves.length; k++) if (this.bigAt[k + 1] === undefined) this.advance(k);
        this.pending = false;
        return;
      } catch (e) {
        if (!(e instanceof EngineOverflow) || this.useBig) throw e;
        this.useBig = true;
        this.setStart();
      }
    }
  }

  /** The number of single moves on the big board and of moves on the folded board, as two hints (E-9). */
  hints(): { big: CallHint; folded: CallHint } {
    const big = playHint(this.ctx.board, bigWord(this.ctx, this.moves).length);
    return { big, folded: playHint(this.ctx.folded ?? this.ctx.board, this.folds ? this.moves.length : 0) };
  }

  needsWorker(): boolean {
    const h = this.hints();
    return whereToRun(h.big) === 'worker' || whereToRun(h.folded) === 'worker';
  }

  /**
   * The two replays as states for the site's `positionsOf` (6.6 fields; coords = the view): the big board
   * by name with the expanded word as labels; the folded board as a custom matrix in orbit order, whose
   * labels 1..m follow its positions (E-7: custom boards), so that it is rebuilt in the worker with the
   * same positions. Every position of each play comes back.
   */
  workerStates(): { big: ToolState; folded: ToolState } {
    const folded = this.ctx.folded!;
    const f0 = this.smallAt[0]!;
    return {
      big: { schema: 1, tool: 'fold', board: this.spec, coords: this.view, start: [...this.start], moves: toLabels(this.ctx.board, bigWord(this.ctx, this.moves)) },
      folded: {
        schema: 1,
        tool: 'fold',
        board: { cartan: cartanNumbers(folded) },
        coords: this.view,
        start: f0.map((t) => integerOut(t)),
        moves: foldedWord(this.ctx, this.moves).map((s) => s + 1),
      },
    };
  }

  /** Takes the positions of both replays (label order, as positionsOf gives them) and keeps those after each symmetric move. */
  acceptReplay(bigList: readonly (readonly (number | string)[])[], foldedList: readonly (readonly (number | string)[])[]): void {
    const positions = toPositions(this.ctx.board, labelOrder(this.ctx.board));
    const inPositions = (row: readonly (number | string)[]): string[] => {
      const out: string[] = new Array<string>(row.length);
      positions.forEach((p, k) => (out[p] = String(row[k])));
      return out;
    };
    const word = foldedWord(this.ctx, this.moves);
    let at = 0;
    this.bigAt = [inPositions(bigList[0]!)];
    word.forEach((s, k) => {
      at += this.ctx.orbits[s]!.length;
      this.bigAt[k + 1] = inPositions(bigList[at]!);
    });
    this.smallAt = foldedList.map((row) => row.map(String));
    if (this.bigAt.length !== this.moves.length + 1 || this.smallAt.length !== this.moves.length + 1) throw new RangeError('the replay does not match the moves');
    this.useBig = this.bigAt.some((v) => v !== undefined && needsBig(v)) || needsBig(this.start);
    this.bigCopies = null;
    this.pending = false;
  }

  /** Whether each big node may be acted on: in free play every node of a board that folds, never while pending. */
  canAct(): boolean[] {
    return this.ctx.orbitOf.map(() => this.folds && !this.pending);
  }

  /** One symmetric move on orbit s, from the cursor (later moves are discarded); null when none is possible. */
  act(s: number): ActResult | null {
    if (!this.folds || this.pending || s < 0 || s >= this.ctx.orbits.length) return null;
    const label = lowestLabel(this.ctx, s);
    this.moves = [...this.moves.slice(0, this.cursor), label];
    this.bigAt.length = this.cursor + 1;
    this.smallAt.length = this.cursor + 1;
    this.replaySync();
    this.cursor++;
    return { orbit: s, labels: toLabels(this.ctx.board, this.ctx.orbits[s]!).sort(asc), move: this.cursor, before: this.bigAt[this.cursor - 1]!, after: this.bigAt[this.cursor]! };
  }

  /** Moves the cursor (undo, redo, the strip); false when out of range or while pending. */
  scrub(k: number): boolean {
    if (this.pending || k < 0 || k > this.moves.length || k === this.cursor) return false;
    this.cursor = k;
    return true;
  }

  /** Empties the list (4.0 History: "reset empties the list"). */
  reset(): boolean {
    if (this.pending || this.moves.length === 0) return false;
    this.moves = [];
    this.cursor = 0;
    this.bigAt.length = 1;
    this.smallAt.length = 1;
    return true;
  }

  /** The state of 6.6: the moves up to the cursor, coords equal to the view, the symmetry in labels. */
  state(): ToolState {
    return {
      schema: 1,
      tool: 'fold',
      board: this.spec,
      view: this.view,
      coords: this.view,
      start: [...this.start],
      moves: this.moves.slice(0, this.cursor),
      symmetry: [...this.ctx.images],
    };
  }

  /** The big board after k moves, by position (the start while a replay is pending). */
  bigValues(k: number = this.cursor): string[] {
    return this.bigAt[k] ?? this.bigAt[0]!;
  }

  /** The folded board after k moves, by folded position (orbit index). */
  foldedValues(k: number = this.cursor): string[] {
    return this.smallAt[k] ?? this.smallAt[0]!;
  }

  bigInLabelOrder(k: number = this.cursor): string[] {
    const v = this.bigValues(k);
    return toPositions(this.ctx.board, labelOrder(this.ctx.board)).map((p) => v[p]!);
  }

  /** The folded board's values in its own label order 1..m (Bourbaki order); empty when it does not fold. */
  foldedInLabelOrder(k: number = this.cursor): string[] {
    const f = this.ctx.folded;
    if (f === null) return [];
    const v = this.foldedValues(k);
    return f.labels.map((_, j) => v[f.labels.indexOf(j + 1)]!);
  }
}

// ---------------------------------------------------------------------------------------------
// Announcements (A-4 punctuation; the wording for several nodes is the plan's, instruction 5.6)
// ---------------------------------------------------------------------------------------------

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

/**
 * One announcement per symmetric move. An orbit of one node uses the A-4 template unchanged. Several
 * nodes: "Fired nodes 1 and 3. Numbers now minus 1, 3, minus 1. Move 1." (populations: "Mutated cities
 * ..."); above four nodes the changed-nodes form of A-4. A move that changes nothing says so (plan).
 */
export function announceSymmetric(bench: FoldBench, r: ActResult): string {
  const board = bench.ctx.board;
  const numbers = bench.view === 'numbers';
  const verb = numbers ? 'Fired' : 'Mutated';
  const noun = numbers ? 'node' : 'city';
  const order = labelOrder(board);
  const pos = toPositions(board, order);
  const before = pos.map((p) => r.before[p]!);
  const after = pos.map((p) => r.after[p]!);
  const changed = order.filter((_, k) => before[k] !== after[k]);
  const head = r.labels.length === 1 ? `${verb} ${noun} ${r.labels[0]}.` : `${verb} ${numbers ? 'nodes' : 'cities'} ${joinAnd(r.labels.map(String))}.`;
  if (board.n > 4 && changed.length === 0) return `${head} Nothing changed. Move ${r.move}.`;
  if (r.labels.length === 1) return moveAnnouncement(verb, order, r.labels[0]!, before, after, r.move);
  if (board.n <= 4) return `${head} ${numbers ? 'Numbers' : 'Populations'} now ${after.map((v) => speak(v)).join(', ')}. Move ${r.move}.`;
  const parts = changed.map((l, k) => `${k === 0 ? cap(noun) : noun} ${l} now ${speak(after[order.indexOf(l)]!)}`);
  return `${head} ${parts.join(', ')}. Move ${r.move}.`;
}

/** "Undid move 4. Numbers now ..." (A-4), with the big board after `at` moves. */
export function undoAnnouncement(bench: FoldBench, undone: number, at: number): string {
  return announceTemplates.undid(undone, bench.bigInLabelOrder(at), bench.view === 'numbers' ? 'numbers' : 'populations');
}

// ---------------------------------------------------------------------------------------------
// Links (6.6, plan rules of instruction 5.3)
// ---------------------------------------------------------------------------------------------

/**
 * Reads one instance's state from a query string: the codec (decodeState) first, then T11's own rules
 * (plan): a parseable `m` is ignored (removed before the codec reads the link, never written back); `v=l`
 * is a view T11 does not offer; `v` and `c` name one game (a link with only one of them sets both); a
 * missing `y` takes the board's default symmetry; the identity is not offered; a missing `s` takes the
 * tool's default start for the board, view and symmetry in force; a start must be constant on orbits;
 * a board that does not fold has no moves; any label of an orbit in `w` is written back as the orbit's
 * smallest label. Any failure: the defaults and LINK_NOTICE.
 */
export function admitLink(search: string, defaults: ToolState, prefix: string): { state: ToolState; notice: string | null } {
  const pre = normalisePrefix(prefix);
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  let text = raw;
  const m = params.getAll(`${pre}m`);
  if (m.length === 1 && ['f', 'l', 'r'].includes(m[0]!)) {
    params.delete(`${pre}m`);
    text = params.toString();
  }
  const { state: decoded, notice } = decodeState(text, 'fold', defaults, { prefix });
  if (notice !== null) return { state: decoded, notice };
  try {
    return { state: admitState(decoded, defaults, { v: params.has(`${pre}v`), c: params.has(`${pre}c`), s: params.has(`${pre}s`) }), notice: null };
  } catch {
    return { state: cloneState(defaults), notice: LINK_NOTICE };
  }
}

function admitState(decoded: ToolState, defaults: ToolState, has: { v: boolean; c: boolean; s: boolean }): ToolState {
  let view = decoded.view;
  let coords = decoded.coords;
  if (view === 'linked') throw new RangeError('T11 does not offer the linked view');
  if (has.v && !has.c) coords = view;
  if (has.c && !has.v) view = coords;
  view = view ?? coords ?? 'numbers';
  coords = coords ?? view;
  if (view !== coords) throw new RangeError('the view and the coords name two games');
  if (typeof decoded.board !== 'string' || !(T11_BOARDS as readonly string[]).includes(decoded.board)) throw new RangeError('a board T11 does not offer');
  const board = resolveBoard(decoded.board);
  const images = decoded.symmetry ?? defaultSymmetry(board);
  const ctx = foldContext(board, images);
  if (isIdentity(ctx.sigma)) throw new RangeError('T11 does not offer the identity');
  const same = decoded.board === defaults.board && view === defaults.view && images.join('.') === (defaults.symmetry ?? []).join('.');
  const start = has.s ? decoded.start! : same && defaults.start !== undefined ? defaults.start : defaultStart(board, view, ctx.orbits);
  if (!isSymmetricStart(ctx, start)) throw new RangeError('the start is not constant on the orbits');
  const moves = decoded.moves ?? [];
  if (ctx.folded === null && moves.length > 0) throw new RangeError('moves on a board that does not fold');
  return { schema: 1, tool: 'fold', board: decoded.board, view, coords, start: [...start], moves: normaliseMoves(ctx, moves), symmetry: [...images] };
}

// ---------------------------------------------------------------------------------------------
// Download data (4.0 Share and export; 6.6 Data export)
// ---------------------------------------------------------------------------------------------

/**
 * What "Download data" writes beside the state: the symmetry (images, orbits in labels, order), the folded
 * board (name, labels of its rows, Cartan matrix in orbit order as the golden `folded_cartan`, orbits in
 * Bourbaki order) or the message, the averaged type and its classes, the Cartan matrix of the averaged
 * simple roots, and the positions of both boards after each move up to the cursor, in label order.
 * Integers are JSON numbers when safe, decimal strings otherwise.
 */
export function exportData(bench: FoldBench): Record<string, unknown> {
  const { ctx } = bench;
  const avg = averagedOf(ctx);
  const upTo = Array.from({ length: bench.cursor + 1 }, (_, k) => k);
  return {
    view: bench.view,
    symmetry: { images: [...ctx.images], orbits: orbitsInLabels(ctx), order: ctx.order },
    folded:
      ctx.folded === null
        ? null
        : { name: ctx.foldedName, labels: [...ctx.folded.labels], cartan: cartanNumbers(ctx.folded), orbitsInBourbakiOrder: orbitsInBourbakiOrder(ctx) },
    foldMessage: ctx.message,
    averaged: { name: avg.name, classes: avg.classes.map((c) => ({ ...c })) },
    averagedSimpleCartan: averagedSimpleCartan(ctx.board, ctx.sigma),
    bigPositions: upTo.map((k) => bench.bigInLabelOrder(k).map((v) => integerOut(v))),
    foldedPositions: ctx.folded === null ? null : upTo.map((k) => bench.foldedInLabelOrder(k).map((v) => integerOut(v))),
  };
}
