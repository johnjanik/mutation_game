// Weyl group data read off the games (SPEC.md 2.6, 2.7 F5 to F12, 5.3, 5.4, 5.5 "Counting games", 5.6;
// CONTRACTS.md 2.1, 2.4 phase 3; owner P3-A1): bipartition, separatingRoots, wavePlay, exponentsFromFired,
// weylOrder, orbitSize, weylDimension, countCompleteGames, legalLayers. Ports of the oracle's bipartition
// (lines 258 to 272), wave_play (275 to 287), exponents_from_fired (290 to 293), weyl_order (296 to 304),
// weyl_dimension (307 to 320), count_reduced_words_w0 (323 to 339), legal_layers (1381 to 1387),
// separating_roots (1390 to 1394) and orbit_size (1425 to 1431).
//
// Conventions at this boundary (E-5, E-7): positions in, positions out; every play is `play` with the
// lowest-position rule, so the word from rho is the word of types[*].longest_word; every move goes through
// `fire`. Guards (5.6, E-11): the seven functions of the finite theory call requireGcm then requireFinite;
// bipartition works on every board; exponentsFromFired takes no board. A cap is reported as null, never
// thrown (E-10). Products that can exceed 2^53 are bigint (E-4); group orders are SafeInt numbers.
// Written once, generically over the board's arithmetic (E-2); each function that takes a board has the
// AnyBoard overload of P2-A1's pattern so that tools can pass the union type.
import type { Vec } from './arith';
import { SafeInt } from './arith';
import type { AnyBoard, Board } from './board';
import { components, subBoard } from './board';
import { CAPS } from './caps';
import { NotFiniteType } from './errors';
import { corootOf } from './form';
import { requireFinite, requireGcm } from './guards';
import type { Word } from './moves';
import { fire } from './moves';
import { play } from './play';
import { orbitGraph, positiveRoots } from './search';

/** The result of wavePlay (CONTRACTS.md 2.2, plan): rounds, legality, the end and every node fired. */
export interface WaveResult<T> {
  rounds: number;
  legal: boolean;
  position: Vec<T>;
  word: Word;
}

/**
 * The bound of the wave (plan, P3-A1 instruction 5.4): from a start that is not dominant the wave can run
 * for ever on a finite board, and E-6 allows no unbounded loop. The oracle's wave_play has cap=10000 and
 * raises after the round that makes rounds exceed it; the engine stops at the same point and returns the
 * WaveResult reached there (rounds 10001), since WaveResult has no status field and E-10 forbids throwing.
 */
const WAVE_ROUNDS_CAP = 10000;

function checkLength<T>(board: Board<T>, v: Vec<T>): void {
  if (v.length !== board.n) {
    throw new RangeError(`the vector has ${v.length} entries, but the board has ${board.n} nodes`);
  }
}

function onesOf<T>(board: Board<T>): T[] {
  const out: T[] = [];
  for (let j = 0; j < board.n; j++) out.push(board.arith.one);
  return out;
}

// ---------------------------------------------------------------------------------------------
// bipartition (SPEC.md 5.3; oracle lines 258 to 272): works on every kind of board
// ---------------------------------------------------------------------------------------------

/**
 * The two colour classes, class 0 then class 1, each in increasing position, or null when the board has
 * an odd cycle. Joined means a road in either direction. The least position of each component gets
 * colour 0 (the oracle's walk); class 1 is empty on A1. No guard: works on one-way boards too (5.6).
 */
export function bipartition<T>(board: Board<T>): [number[], number[]] | null;
export function bipartition(board: AnyBoard): [number[], number[]] | null;
export function bipartition<T>(board: Board<T>): [number[], number[]] | null {
  const { n, cartan, arith } = board;
  const joined = (i: number, j: number): boolean =>
    i !== j && (arith.sign(cartan[i]![j]!) !== 0 || arith.sign(cartan[j]![i]!) !== 0);
  const colour: (0 | 1 | null)[] = [];
  for (let k = 0; k < n; k++) colour.push(null);
  for (const comp of components(board)) {
    const first = comp[0]!;
    colour[first] = 0;
    const stack: number[] = [first];
    while (stack.length > 0) {
      const i = stack.pop()!;
      const ci = colour[i]!;
      for (const j of comp) {
        if (!joined(i, j)) continue;
        const cj = colour[j];
        if (cj === null) {
          colour[j] = ci === 0 ? 1 : 0;
          stack.push(j);
        } else if (cj === ci) {
          return null; // an odd cycle
        }
      }
    }
  }
  const zero: number[] = [];
  const one: number[] = [];
  for (let k = 0; k < n; k++) (colour[k] === 0 ? zero : one).push(k);
  return [zero, one];
}

// ---------------------------------------------------------------------------------------------
// exponentsFromFired, weylOrder (SPEC.md 2.7 F7; oracle lines 290 to 304)
// ---------------------------------------------------------------------------------------------

/**
 * The exponents as the conjugate partition of the tally of fired values (F7): for i = 1..n, the number of
 * distinct values fired at least i times, sorted ascending. Takes no board and has no guard. `n` must be
 * a non-negative integer (RangeError otherwise, plan). Never reads eigenvalues (trap 1).
 */
export function exponentsFromFired(fired: readonly number[], n: number): number[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`n = ${String(n)} is not a non-negative integer`);
  const tally = new Map<number, number>();
  for (const x of fired) tally.set(x, (tally.get(x) ?? 0) + 1);
  const counts = [...tally.values()];
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    let m = 0;
    for (const c of counts) if (c >= i) m += 1;
    out.push(m);
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * The order of the group of a finite-type board, unguarded (plan, instruction 5.6): play from rho, take
 * the exponents of the tally, multiply m_i + 1 in SafeInt so that an impossible overflow throws
 * EngineOverflow rather than returning a wrong number (E-4: the order fits on 12 nodes). 1 on no nodes,
 * as in the oracle. A play that reaches its cap means the board is not of finite type after all.
 */
function groupOrder<T>(board: Board<T>): number {
  if (board.n === 0) return 1;
  const game = play(board, onesOf(board));
  if (game.status !== 'ended') {
    throw new NotFiniteType(`the game from rho has not ended after ${game.moves} moves: this board is not of finite type`);
  }
  const fired = game.fired.map((x) => Number(board.arith.toBig(x))); // the values are at most h - 1
  let order = 1;
  for (const m of exponentsFromFired(fired, board.n)) order = SafeInt.mul(order, m + 1);
  return order;
}

/**
 * |W_J| for a set J of positions (plan, instruction 5.6): 1 for the empty set, otherwise the product over
 * the connected components of the induced board of each component's group order. Unguarded, so that an
 * empty J never meets requireFinite and no sub-board pays for a classify; the oracle's
 * weyl_order(sub_matrix(C, J)) on a disconnected sub-matrix equals this product.
 */
function parabolicOrder<T>(board: Board<T>, J: readonly number[]): number {
  if (J.length === 0) return 1;
  const sub = subBoard(board, J);
  const sorted = [...J].sort((a, b) => a - b); // position k of sub is sorted[k]
  let order = 1;
  for (const comp of components(sub)) {
    const piece = subBoard(board, comp.map((k) => sorted[k]!));
    order = SafeInt.mul(order, groupOrder(piece));
  }
  return order;
}

/** |W| = prod(m_i + 1) from the game from rho (F7, oracle weyl_order); finite only (5.6). */
export function weylOrder<T>(board: Board<T>): number;
export function weylOrder(board: AnyBoard): number;
export function weylOrder<T>(board: Board<T>): number {
  requireGcm(board);
  requireFinite(board);
  return groupOrder(board);
}

// ---------------------------------------------------------------------------------------------
// wavePlay (SPEC.md 2.7 F8, 5.4; oracle lines 275 to 287)
// ---------------------------------------------------------------------------------------------

/**
 * The wave: fire every node of colour `firstColour` in increasing position, then every node of the other
 * colour, and repeat while some number is positive (the test is made only between rounds); one round is
 * the firing of one colour class, and the whole class is fired even when a member is not positive, which
 * sets `legal` false (the oracle's choice, trap 4). A start with no positive number gives 0 rounds. On A1
 * the empty class counts as a round when it goes first (2 rounds, 1 move). Bounded at WAVE_ROUNDS_CAP
 * rounds (plan). Finite only (5.6); `firstColour` must be 0 or 1 (RangeError otherwise, plan).
 */
export function wavePlay<T>(board: Board<T>, a: Vec<T>, firstColour: 0 | 1): WaveResult<T>;
export function wavePlay(board: AnyBoard, a: Vec<number | bigint>, firstColour: 0 | 1): WaveResult<number | bigint>;
export function wavePlay<T>(board: Board<T>, a: Vec<T>, firstColour: 0 | 1): WaveResult<T> {
  checkLength(board, a);
  if (firstColour !== 0 && firstColour !== 1) throw new RangeError(`firstColour must be 0 or 1, not ${String(firstColour)}`);
  requireGcm(board);
  requireFinite(board);
  const classes = bipartition(board);
  if (classes === null) throw new NotFiniteType('the board has an odd cycle: it is not of finite type');
  const { arith } = board;
  let current: T[] = [...a];
  const word: number[] = [];
  let rounds = 0;
  let legal = true;
  let c: 0 | 1 = firstColour;
  const somePositive = (): boolean => current.some((x) => arith.sign(x) > 0);
  while (somePositive()) {
    for (const i of classes[c]) {
      if (arith.sign(current[i]!) <= 0) legal = false;
      current = fire(board, current, i);
      word.push(i);
    }
    rounds += 1;
    c = c === 0 ? 1 : 0;
    if (rounds > WAVE_ROUNDS_CAP) break;
  }
  return { rounds, legal, position: current, word };
}

// ---------------------------------------------------------------------------------------------
// orbitSize (SPEC.md 2.7 F10, 5.4; oracle lines 1425 to 1431, for a dominant position)
// ---------------------------------------------------------------------------------------------

/**
 * The size of the orbit of any position without enumeration: play `a` to the end, let J be the nodes
 * where the end is zero, return |W| / |W_J| (5.4). The oracle takes a dominant position; playing first
 * makes the rule hold for every position (trap 2; verify.py lines 1677 to 1684 negate the end, which
 * has the same zeros). Exact integer division. Finite only (5.6).
 */
export function orbitSize<T>(board: Board<T>, a: Vec<T>): number;
export function orbitSize(board: AnyBoard, a: Vec<number | bigint>): number;
export function orbitSize<T>(board: Board<T>, a: Vec<T>): number {
  checkLength(board, a);
  requireGcm(board);
  requireFinite(board);
  const end = play(board, a).position;
  const J: number[] = [];
  for (let i = 0; i < board.n; i++) if (board.arith.sign(end[i]!) === 0) J.push(i);
  const W = groupOrder(board);
  const WJ = parabolicOrder(board, J);
  if (W % WJ !== 0) throw new Error(`|W| = ${W} is not a multiple of |W_J| = ${WJ} on ${board.name ?? 'this board'}`);
  return W / WJ;
}

// ---------------------------------------------------------------------------------------------
// weylDimension (SPEC.md 2.7 F9, 5.4, E-4; oracle lines 307 to 320)
// ---------------------------------------------------------------------------------------------

/**
 * dim V(lambda) = M / D (F9): the word and the product D of the game from rho, then the same word replayed
 * from lambda + rho with the product M of the numbers met, as bigint (E-4: on E8 the products exceed 2^53).
 * `lambda` is in positions and dominant (non-negative safe integers, one per node); anything else is a
 * RangeError (plan, instruction 5.7). Never floats; a remainder, which cannot happen for a dominant
 * lambda, throws an Error naming the board rather than returning a rounded value. Finite only (5.6).
 */
export function weylDimension<T>(board: Board<T>, lambda: readonly number[]): bigint;
export function weylDimension(board: AnyBoard, lambda: readonly number[]): bigint;
export function weylDimension<T>(board: Board<T>, lambda: readonly number[]): bigint {
  if (lambda.length !== board.n) {
    throw new RangeError(`lambda has ${lambda.length} entries, but the board has ${board.n} nodes`);
  }
  for (const x of lambda) {
    if (typeof x !== 'number' || !Number.isSafeInteger(x) || x < 0) {
      throw new RangeError(`lambda must be dominant: every entry a non-negative integer, not ${String(x)}`);
    }
  }
  requireGcm(board);
  requireFinite(board);
  const { arith } = board;
  const rhoGame = play(board, onesOf(board));
  let D = 1n;
  for (const f of rhoGame.fired) D *= arith.toBig(f);
  let current: T[] = lambda.map((x) => arith.add(arith.fromInt(x), arith.one));
  let M = 1n;
  for (const i of rhoGame.word) {
    M *= arith.toBig(current[i]!);
    current = fire(board, current, i);
  }
  if (M % D !== 0n) throw new Error(`the product ${M} is not a multiple of ${D} on ${board.name ?? 'this board'}`);
  return M / D;
}

// ---------------------------------------------------------------------------------------------
// countCompleteGames (SPEC.md 2.7 F12, 5.5 "Counting games", 5.6; oracle lines 323 to 339)
// ---------------------------------------------------------------------------------------------

/**
 * The number of complete legal games from rho, the number of reduced words of w_0 (F12), by dynamic
 * programming over the positions layer by layer: each position of a layer sends its count to every
 * position one legal firing away; the last layer is {-rho} and holds the answer, as bigint (E-4). Offered
 * for |W| <= cap (default CAPS.countGamesGroup, 60000): null when the group is larger, decided from
 * weylOrder before any layer is built (plan; the oracle counts positions found instead). `cap` must be a
 * non-negative integer (RangeError otherwise, plan). Finite only (5.6).
 */
export function countCompleteGames<T>(board: Board<T>, cap?: number): bigint | null;
export function countCompleteGames(board: AnyBoard, cap?: number): bigint | null;
export function countCompleteGames<T>(board: Board<T>, cap: number = CAPS.countGamesGroup): bigint | null {
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError(`the cap ${String(cap)} is not a non-negative integer`);
  requireGcm(board);
  requireFinite(board);
  if (groupOrder(board) > cap) return null;
  const { n, arith } = board;
  const show = arith.show;
  const keyOf = (v: readonly T[]): string => v.map(show).join(',');
  let layer: T[][] = [onesOf(board)];
  let counts: bigint[] = [1n];
  for (;;) {
    const next: T[][] = [];
    const nextCounts: bigint[] = [];
    const index = new Map<string, number>();
    for (let h = 0; h < layer.length; h++) {
      const a = layer[h]!;
      const c = counts[h]!;
      for (let i = 0; i < n; i++) {
        if (arith.sign(a[i]!) <= 0) continue;
        const b = fire(board, a, i);
        const key = keyOf(b);
        const k = index.get(key);
        if (k === undefined) {
          index.set(key, next.length);
          next.push(b);
          nextCounts.push(c);
        } else {
          nextCounts[k] = nextCounts[k]! + c;
        }
      }
    }
    if (next.length === 0) {
      if (layer.length !== 1) throw new Error('the last layer of the count holds more than one position');
      return counts[0]!;
    }
    layer = next;
    counts = nextCounts;
  }
}

// ---------------------------------------------------------------------------------------------
// legalLayers (SPEC.md 2.7 F5, 5.4, 5.5; oracle lines 1381 to 1387)
// ---------------------------------------------------------------------------------------------

/**
 * The numbers of positions first reached after 0, 1, 2, ... legal moves from `start` (default rho); from
 * rho this is the length distribution of W. null when more than `cap` positions are found (default
 * CAPS.legalLayersDefault, 100000), which is orbitGraph's `truncated`; the search order and cap rule are
 * P1-A1's (5.5). `cap` must be a non-negative integer (RangeError otherwise, plan); a cap of 0 is
 * exceeded by the start itself. Finite only (5.6).
 */
export function legalLayers<T>(board: Board<T>, start?: Vec<T>, cap?: number): number[] | null;
export function legalLayers(board: AnyBoard, start?: Vec<number | bigint>, cap?: number): number[] | null;
export function legalLayers<T>(board: Board<T>, start?: Vec<T>, cap: number = CAPS.legalLayersDefault): number[] | null {
  if (start !== undefined) checkLength(board, start);
  if (!Number.isInteger(cap) || cap < 0) throw new RangeError(`the cap ${String(cap)} is not a non-negative integer`);
  requireGcm(board);
  requireFinite(board);
  if (cap === 0) return null;
  const seed: T[] = start === undefined ? onesOf(board) : [...start];
  const g = orbitGraph(board, [seed], 'firing', cap, undefined, true);
  if (g.truncated) return null;
  const sizes: number[] = [];
  for (let d = 0; d <= g.depthReached; d++) sizes.push(0);
  for (const d of g.depth) sizes[d] = sizes[d]! + 1;
  return sizes;
}

// ---------------------------------------------------------------------------------------------
// separatingRoots (SPEC.md 2.7 F5, 5.4; oracle lines 1390 to 1394)
// ---------------------------------------------------------------------------------------------

/**
 * The positive roots beta with <a, beta^vee> < 0, the mirrors between `a` and the dominant chamber, as
 * populations in the board's arithmetic and in the order of positiveRoots (by total, then
 * lexicographically). The pairing is with the coroot of beta, not with beta (trap 7). For a position
 * reached from rho their number is the length of a shortest play (F5). Finite only (5.6).
 */
export function separatingRoots<T>(board: Board<T>, a: Vec<T>): T[][];
export function separatingRoots(board: AnyBoard, a: Vec<number | bigint>): (number | bigint)[][];
export function separatingRoots<T>(board: Board<T>, a: Vec<T>): T[][] {
  checkLength(board, a);
  requireGcm(board);
  requireFinite(board);
  const { arith, n } = board;
  const big = a.map((x) => arith.toBig(x));
  const out: T[][] = [];
  for (const beta of positiveRoots(board)) {
    const cor = corootOf(board, beta);
    let pairing = 0n;
    for (let i = 0; i < n; i++) pairing += big[i]! * BigInt(cor[i]!);
    if (pairing < 0n) out.push(beta);
  }
  return out;
}
