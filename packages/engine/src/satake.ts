// Satake diagrams (SPEC.md 2.15, 5.2 SatakeDiagram, Admissibility, Reason, 5.4 "Satake functions (phase 6)",
// 5.6, 6.4, E-5, E-7, E-10, E-11; CONTRACTS.md 2.1, 2.2, 2.4 phase 6; owner P6-A1): theta, shadow2,
// admissibility, satake and restrictedBoard, ported from the oracle's theta (reference/lie_games.py lines 464
// to 471), sub_positive_roots (474 to 486), admissibility (489 to 523) and admissible (526 to 533), shadow2
// (536 to 539), satake (587 to 649), restricted_board (788 to 803) and tau_orbits (393 to 402), keeping the
// oracle's choices: the black set used sorted, theta in three stages (permute by tau, play the word of w_X
// as mutations, negate), the white tau-orbits in order of their least node, the composite word w_X followed
// by the longest word of X u O. classifyRestricted (P4-A1's port of classify_restricted) is re-exported.
// restrictedCoordinates (P6-A1 follow-up for T13, no oracle function) gives the coordinates of a shadow in the
// simple restricted roots, in the order of the orbits, so that T13 draws shadows without a solver of its own.
//
// Positions in, positions out (E-7): black, tau, populations and every node of every result are positions
// 0..n-1; the oracle's satake returns node numbers from 1 and its admissibility sentences, the engine returns
// positions and Reason records as data. Exact arithmetic (E-1, E-3): populations and shadows are integers,
// shadows kept doubled (2 alpha-bar = alpha - theta alpha); the form is rational (gram).
//
// Order of checks in every function (P2-A1's order, kept by every engine module since): the shape of the
// diagram and of the population (RangeError), then requireGcm (NeedsTwoWayRoads) and requireFinite
// (NotFiniteType) through guards.ts (E-11), before any computation; satake and restrictedBoard then throw
// NotAdmissible, carrying the Admissibility record, on a pair that fails any item; satake then throws
// NeedsConnectedBoard on a restricted root system in several pieces (MERGE ruling (1) on P6-A1). The oracle's
// asserts become EngineError with the oracle's text; none is reachable with an admissible pair.
import { SafeInt } from './arith';
import type { Vec } from './arith';
import type { Board } from './board';
import { boardKind, cartanNumbers, components, subBoard } from './board';
import { CAPS } from './caps';
import { gram, identify } from './classify';
import { EngineError, EngineOverflow, NeedsConnectedBoard, NotAdmissible, NotFiniteType } from './errors';
import type { Admissibility, Reason } from './errors';
import { longestWord as longestWordUnguarded } from './finite';
import type { Symmetry } from './fold';
import { requireFinite, requireGcm } from './guards';
import { solve } from './linalg';
import type { Word } from './moves';
import { applyWord } from './moves';
import type { Rational } from './rational';
import { rat, ratAdd, ratDiv, ratEq, ratMul, ratToString } from './rational';
import { classifyRestricted } from './restrictedType';
import { positiveRootsFrom, roots } from './search';

export { classifyRestricted } from './restrictedType';

// ---------------------------------------------------------------------------------------------
// Types (CONTRACTS.md 2.2, verbatim; SatakeDiagram from SPEC.md 5.2)
// ---------------------------------------------------------------------------------------------

/** A decorated board: the black positions and the full symmetry tau, the image of every position. */
export interface SatakeDiagram {
  board: Board;
  black: readonly number[];
  tau: Symmetry;
}

/** What satake() returns: the fields of SPEC.md 6.4 from rank to restricted_reflection_word_lengths, nodes as positions. */
export interface SatakeComputed {
  rank: number;
  real_rank: number;
  restricted_type: string | null;
  multiplicities: { class: string; roots: number; mult: number }[];
  n_restricted_roots: number;
  dim_g: number;
  dim_k: number;
  dim_p: number;
  character: number;
  roots_compact_imaginary: number;
  roots_real: number;
  roots_complex: number;
  w_X_word: number[];
  restricted_simple_orbits: number[][];
  restricted_simple_multiplicities: [number, number][];
  restricted_cartan: number[][] | null;
  restricted_board: string | null;
  restricted_orbits_in_bourbaki_order: number[][] | null;
  restricted_reflection_word_lengths: number[];
}

/** The restricted game of SPEC.md 2.15 (plan type): orbits, doubled simple restricted roots, Cartan matrix, words, board. */
export interface RestrictedBoard {
  orbits: number[][];
  simpleRestrictedRoots2: number[][];
  cartan: number[][];
  compositeWords: Word[];
  board: Board;
}

// ---------------------------------------------------------------------------------------------
// Argument checks (plan, P6-A1 instruction 5.2) and the guard
// ---------------------------------------------------------------------------------------------

/** The black positions, sorted, after checking the diagram's shape; RangeError on any malformed part. */
function checkDiagram(d: SatakeDiagram): number[] {
  if (d === null || typeof d !== 'object') throw new RangeError('a Satake diagram is an object { board, black, tau }');
  const n = d.board.n;
  const tau = d.tau;
  if (!Array.isArray(tau) || tau.length !== n) {
    throw new RangeError(`tau of this board has ${n} entries, not ${Array.isArray(tau) ? tau.length : 'none'}`);
  }
  const hit: boolean[] = [];
  for (let k = 0; k < n; k++) hit.push(false);
  for (const x of tau) {
    if (!Number.isInteger(x) || x < 0 || x >= n) throw new RangeError(`the image ${String(x)} under tau is outside 0..${n - 1}`);
    if (hit[x]) throw new RangeError(`the image ${x} appears twice under tau: not a permutation`);
    hit[x] = true;
  }
  const black = d.black;
  if (!Array.isArray(black)) throw new RangeError('the black nodes are a list of positions');
  const seen: boolean[] = [];
  for (let k = 0; k < n; k++) seen.push(false);
  for (const x of black) {
    if (!Number.isInteger(x) || x < 0 || x >= n) throw new RangeError(`the black position ${String(x)} is outside 0..${n - 1}`);
    if (seen[x]) throw new RangeError(`the black position ${x} is repeated`);
    seen[x] = true;
  }
  return [...black].sort((a, b) => a - b);
}

/**
 * A population of the board's length with integer entries, as plain numbers (SafeInt rule of E-2). Read with an
 * index loop, not map: map skips the holes of a sparse array, and a hole must reach the integer check (RangeError).
 */
function checkPopulation(n: number, p: Vec<number>, what: string): number[] {
  if (!Array.isArray(p) || p.length !== n) {
    throw new RangeError(`the ${what} has ${Array.isArray(p) ? p.length : 'no'} entries, but the board has ${n} nodes`);
  }
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const x: number | bigint | undefined = p[k];
    if (typeof x === 'bigint') {
      if (x > BigInt(Number.MAX_SAFE_INTEGER) || x < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new EngineOverflow(`the entry ${x.toString()} of the ${what} is not a safe integer`);
      }
      out.push(Number(x));
      continue;
    }
    if (!Number.isInteger(x)) throw new RangeError(`the entry ${String(x)} of the ${what} is not an integer`);
    if (!Number.isSafeInteger(x)) throw new EngineOverflow(`the entry ${String(x)} of the ${what} is not a safe integer`);
    out.push(x === 0 ? 0 : (x as number));
  }
  return out;
}

/** NeedsTwoWayRoads on a one-way board, NotFiniteType off the finite types (SPEC.md 5.6, through guards.ts). */
function guard(board: Board): void {
  requireGcm(board);
  requireFinite(board);
}

/**
 * The board in plain numbers: the board itself when it uses SafeInt (every named finite board), otherwise a
 * private SafeInt copy of its integer matrix (a finite board built by hand may carry Big, E-2). Internal only.
 */
function numeric(board: Board): Board<number> {
  if (board.arith === SafeInt) return board;
  const C = cartanNumbers(board);
  return { n: board.n, cartan: C, labels: board.labels, kind: board.kind, arith: SafeInt };
}

/** Everything one call needs about the diagram: the board in numbers, n, sorted X, its set, tau, the word of w_X. */
interface Prepared {
  board: Board<number>;
  n: number;
  X: number[];
  black: boolean[];
  tau: readonly number[];
  wx: Word;
}

/** The guard, then the data of one call; X is the diagram's sorted black set, already checked by checkDiagram. */
function prepare(d: SatakeDiagram, X: number[] = checkDiagram(d)): Prepared {
  guard(d.board);
  const board = numeric(d.board);
  const n = board.n;
  const black: boolean[] = [];
  for (let i = 0; i < n; i++) black.push(false);
  for (const i of X) black[i] = true;
  // the word of w_X, computed once per call and passed on (E-5; P6-A1 instruction 5.2, trap 21)
  return { board, n, X, black, tau: [...d.tau], wx: longestWordUnguarded(board, X) };
}

// ---------------------------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------------------------

function unit(n: number, i: number): number[] {
  const e: number[] = [];
  for (let j = 0; j < n; j++) e.push(j === i ? 1 : 0);
  return e;
}

const keyOf = (v: readonly number[]): string => v.join(',');

/** theta = -w_X o tau in the oracle's three stages: q[tau[i]] = p[i]; play wx as mutations; negate. */
function thetaWith(P: Prepared, p: readonly number[]): number[] {
  const q: number[] = [];
  for (let i = 0; i < P.n; i++) q.push(0);
  for (let i = 0; i < P.n; i++) q[P.tau[i]!] = p[i]!;
  const w = applyWord(P.board, q, P.wx, 'mutation');
  return w.map((x) => SafeInt.neg(x));
}

/** The integer vector alpha - theta(alpha), twice the shadow. */
function shadow2With(P: Prepared, p: readonly number[]): number[] {
  const t = thetaWith(P, p);
  return p.map((x, i) => SafeInt.sub(x, t[i]!));
}

/** bil(B, x, y) = sum of x_i B_ij y_j over the pairs with x_i and y_j nonzero (oracle lines 129 to 131). */
function bil(B: readonly (readonly Rational[])[], x: readonly number[], y: readonly number[]): Rational {
  let s = rat(0);
  for (let i = 0; i < x.length; i++) {
    if (x[i] === 0) continue;
    for (let j = 0; j < y.length; j++) {
      if (y[j] === 0) continue;
      s = ratAdd(s, ratMul(B[i]![j]!, rat(BigInt(x[i]!) * BigInt(y[j]!))));
    }
  }
  return s;
}

function gramOf(board: Board<number>): Rational[][] {
  const B = gram(board);
  if (B === null) throw new NotFiniteType('this function needs a board of finite type; this board is not balanced');
  return B;
}

/** Every root of the finite board (at most 288 on twelve nodes, so the search is exact; plan, as P1-A1). */
function allRoots(board: Board<number>): number[][] {
  const R = roots(board, CAPS.workerPositions);
  if (R.truncated) throw new EngineError('the roots of a finite board exceed the search cap');
  return R.items;
}

/**
 * The positive roots of the sub-board on X, in full coordinates (oracle sub_positive_roots): entry k of a root
 * of subBoard(board, X) is placed at position X[k]; empty when X is empty.
 */
function subPositiveRoots(board: Board<number>, X: readonly number[]): number[][] {
  if (X.length === 0) return [];
  const sub = subBoard(board, X);
  const R = roots(sub, CAPS.workerPositions);
  if (R.truncated) throw new EngineError('the roots of a finite board exceed the search cap');
  return positiveRootsFrom(sub, R.items).map((r) => {
    const v: number[] = [];
    for (let i = 0; i < board.n; i++) v.push(0);
    X.forEach((i, k) => {
      v[i] = r[k]!;
    });
    return v;
  });
}

/** The tau-orbits of the given positions, walked in the order given, each sorted (oracle tau_orbits). */
function tauOrbits(tau: readonly number[], nodes: readonly number[]): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const i of nodes) {
    if (seen.has(i)) continue;
    const o = [i];
    let j = tau[i]!;
    while (j !== i) {
      o.push(j);
      j = tau[j]!;
    }
    for (const k of o) seen.add(k);
    out.push(o.sort((a, b) => a - b));
  }
  return out;
}

function whiteOf(P: Prepared): number[] {
  const out: number[] = [];
  for (let i = 0; i < P.n; i++) if (!P.black[i]) out.push(i);
  return out;
}

// ---------------------------------------------------------------------------------------------
// theta and shadow2 (oracle theta, shadow2)
// ---------------------------------------------------------------------------------------------

/**
 * theta = -w_X o tau on a population (SPEC.md 2.15): (1) move each entry along tau, q[tau[i]] = p[i]; (2) play
 * the word of w_X, the longest word of the black sub-board, as mutations, letters in order; (3) negate every
 * entry. Does not check admissibility (on A2 with node 1 black and no arrow it is -s_1). RangeError on a
 * malformed diagram or population; NeedsTwoWayRoads, NotFiniteType as 5.6.
 */
export function theta(d: SatakeDiagram, p: Vec<number>): number[] {
  const X = checkDiagram(d);
  const q = checkPopulation(d.board.n, p, 'population');
  return thetaWith(prepare(d, X), q);
}

/** The integer vector alpha - theta(alpha) = 2 alpha-bar, entry by entry (oracle shadow2): shadows are kept doubled. */
export function shadow2(d: SatakeDiagram, root: Vec<number>): number[] {
  const X = checkDiagram(d);
  const a = checkPopulation(d.board.n, root, 'root');
  return shadow2With(prepare(d, X), a);
}

// ---------------------------------------------------------------------------------------------
// admissibility (oracle admissibility; SPEC.md 2.15 "Which pairs are real forms", 5.2 Reason)
// ---------------------------------------------------------------------------------------------

function admissibilityWith(P: Prepared): Admissibility {
  const { board, n, X, black, tau, wx } = P;
  const C = board.cartan;
  const reasons: Record<string, Reason> = {};
  // symmetry: C[tau i][tau j] == C[i][j] for every pair; the rows i where some j breaks it
  const badSym: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (C[tau[i]!]![tau[j]!] !== C[i]![j]) {
        badSym.push(i);
        break;
      }
    }
  }
  const symmetry = badSym.length === 0;
  if (!symmetry) reasons.symmetry = { code: 'not-a-symmetry', nodes: badSym };
  // condition 1: tau o tau = 1 (reported first, as in the oracle), and tau(X) = X
  const notInvol: number[] = [];
  for (let i = 0; i < n; i++) if (tau[tau[i]!] !== i) notInvol.push(i);
  const moves = X.filter((i) => !black[tau[i]!]);
  const condition_1 = notInvol.length === 0 && moves.length === 0;
  if (notInvol.length > 0) reasons.condition_1 = { code: 'not-an-involution', nodes: notInvol };
  else if (moves.length > 0) reasons.condition_1 = { code: 'moves-black-set', nodes: moves };
  // condition 2: w_X(alpha_i) = -alpha_tau(i) on the black nodes; judged whatever the others say
  const bad2: number[] = [];
  for (const i of X) {
    const v = applyWord(board, unit(n, i), wx, 'mutation');
    const t = tau[i]!;
    if (!v.every((x, j) => x === (j === t ? -1 : 0))) bad2.push(i);
  }
  if (bad2.length > 0) reasons.condition_2 = { code: 'differs-from-minus-wX', nodes: bad2 };
  // condition 3: <alpha_i, rho_X^vee> = sum over the positive roots beta of X of (alpha_i, beta) / (beta, beta)
  // is an integer at every white node fixed by tau; judged whatever the others say
  const B = gramOf(board);
  const pos = subPositiveRoots(board, X);
  const norms = pos.map((b) => bil(B, b, b));
  const bad3: number[] = [];
  const values: string[] = [];
  for (let i = 0; i < n; i++) {
    if (black[i] || tau[i] !== i) continue;
    const e = unit(n, i);
    let val = rat(0);
    pos.forEach((b, k) => {
      val = ratAdd(val, ratDiv(bil(B, e, b), norms[k]!));
    });
    if (val.den !== 1n) {
      bad3.push(i);
      values.push(ratToString(val));
    }
  }
  // one failing node: its fraction; several: their fractions in the order of the nodes, joined by "; "
  // (the oracle's own separator; plan reading of the single `value` of the contract)
  if (bad3.length > 0) reasons.condition_3 = { code: 'not-an-integer', nodes: bad3, value: values.join('; ') };
  const condition_2 = bad2.length === 0;
  const condition_3 = bad3.length === 0;
  return {
    symmetry,
    condition_1,
    condition_2,
    condition_3,
    admissible: symmetry && condition_1 && condition_2 && condition_3,
    reasons,
  };
}

/**
 * Kolb's three conditions for the pair (X, tau), each judged on its own, with the symmetry of the board judged
 * separately (oracle admissibility): an Admissibility record whose reasons hold a Reason for each failed item
 * only, under the keys symmetry, condition_1, condition_2, condition_3, with positions and, for condition 3,
 * the fraction as text. Never throws on a well-formed diagram of a finite board.
 */
export function admissibility(d: SatakeDiagram): Admissibility {
  return admissibilityWith(prepare(d));
}

/** NotAdmissible with the record, its message naming the first failed item in the oracle's order (admissible). */
function requireAdmissible(P: Prepared): void {
  const a = admissibilityWith(P);
  if (a.admissible) return;
  const first = (['symmetry', 'condition_1', 'condition_2', 'condition_3'] as const).find((k) => !a[k])!;
  throw new NotAdmissible(a, `not admissible: ${first}`);
}

// ---------------------------------------------------------------------------------------------
// restrictedBoard (oracle restricted_board; SPEC.md 2.15 "The restricted game", E-7)
// ---------------------------------------------------------------------------------------------

interface RestrictedCore {
  orbits: number[][];
  simple: number[][];
  cartan: number[][];
  words: Word[];
  board: Board;
  order: number[] | null;
}

function restrictedWith(P: Prepared): RestrictedCore {
  const { board, n, X, wx } = P;
  const B = gramOf(board);
  const orbits = tauOrbits(P.tau, whiteOf(P));
  // the doubled simple restricted root of each orbit, from its least node
  const simple = orbits.map((o) => shadow2With(P, unit(n, o[0]!)));
  const m = orbits.length;
  const cartan: number[][] = [];
  for (let s = 0; s < m; s++) {
    const row: number[] = [];
    const ss = bil(B, simple[s]!, simple[s]!);
    for (let t = 0; t < m; t++) {
      const x = ratDiv(ratMul(rat(2), bil(B, simple[s]!, simple[t]!)), ss);
      if (x.den !== 1n) throw new EngineError(`the restricted Cartan entry (${s}, ${t}) is ${ratToString(x)}, not an integer`);
      row.push(Number(x.num));
    }
    cartan.push(row);
  }
  // apply w_X first, then w_{X u O}: one word, played left to right, not reduced
  const words: Word[] = orbits.map((o) => {
    const nodes = [...X, ...o].sort((a, b) => a - b);
    return [...wx, ...longestWordUnguarded(board, nodes)];
  });
  // the board object (plan reading of E-7, as P4-A1's folded board): cartan in the order of the orbits, labels
  // 1..m in the Bourbaki order of the type identify names; identify only on a connected board with nodes
  const frozen = Object.freeze(cartan.map((row) => Object.freeze([...row])));
  const kind = boardKind(cartan);
  if (kind === 'not-a-board') throw new EngineError('the restricted Cartan matrix is not a board');
  const draft: Board = { n: m, cartan: frozen, labels: [], kind, arith: SafeInt };
  const labels: number[] = [];
  for (let k = 0; k < m; k++) labels.push(k + 1);
  let name: string | undefined;
  let order: number[] | null = null;
  if (m > 0 && kind === 'gcm' && components(draft).length === 1) {
    const id = identify(draft);
    if (id !== null) {
      for (let k = 0; k < m; k++) labels[id.order[k]!] = k + 1;
      name = id.name;
      order = id.order;
    }
  }
  const rb: Board = { n: m, cartan: frozen, labels: Object.freeze(labels), kind, arith: SafeInt };
  if (name !== undefined) rb.name = name;
  return { orbits, simple, cartan, words, board: Object.freeze(rb), order };
}

/**
 * The restricted game of an admissible pair: the tau-orbits of the white positions (in order of their least
 * position, each sorted), the doubled simple restricted root of each (shadow2 of e at the orbit's least node),
 * the restricted Cartan matrix 2 (s, t) / (s, s) in the order of the orbits, the composite words (the word of
 * w_X followed by the longest word of X u O, played left to right on populations as mutations), and the
 * restricted board (labels in the Bourbaki order of the type identify names, 1..m in orbit order when none is
 * named; n = 0 for a compact form). Throws NotAdmissible on a pair that is not admissible.
 */
export function restrictedBoard(d: SatakeDiagram): RestrictedBoard {
  const P = prepare(d);
  requireAdmissible(P);
  const r = restrictedWith(P);
  return {
    orbits: r.orbits.map((o) => [...o]),
    simpleRestrictedRoots2: r.simple.map((s) => [...s]),
    cartan: r.cartan.map((row) => [...row]),
    compositeWords: r.words,
    board: r.board,
  };
}

// ---------------------------------------------------------------------------------------------
// restrictedCoordinates (P6-A1 follow-up for T13: P6-A3 instruction 5.8 and 5.9; SPEC.md 2.15, 7.3)
// ---------------------------------------------------------------------------------------------

/**
 * Copies of rb's doubled simple restricted roots, after checking that rb belongs to the diagram: its orbits are
 * the tau-orbits of the diagram's white positions (as restrictedBoard lists them), and each simple restricted
 * root has one integer entry per node of the diagram's board. RangeError otherwise.
 */
function checkRestricted(d: SatakeDiagram, X: readonly number[], rb: RestrictedBoard): number[][] {
  if (rb === null || typeof rb !== 'object' || !Array.isArray(rb.orbits) || !Array.isArray(rb.simpleRestrictedRoots2)) {
    throw new RangeError('a restricted board is an object with orbits and simpleRestrictedRoots2, as restrictedBoard returns');
  }
  const n = d.board.n;
  const isBlack = new Set(X);
  const white: number[] = [];
  for (let i = 0; i < n; i++) if (!isBlack.has(i)) white.push(i);
  const want = tauOrbits(d.tau, white);
  const m = rb.orbits.length;
  if (m !== want.length || rb.simpleRestrictedRoots2.length !== m) {
    throw new RangeError(
      `this restricted board has ${m} orbits and ${rb.simpleRestrictedRoots2.length} simple restricted roots, but the ` +
        `diagram has ${want.length} tau-orbits of white nodes: the restricted board belongs to another diagram`,
    );
  }
  want.forEach((o, k) => {
    const got: unknown = rb.orbits[k];
    if (!Array.isArray(got) || got.length !== o.length || o.some((x, j) => got[j] !== x)) {
      throw new RangeError(`orbit ${k} of this restricted board is not the orbit (${o.join(', ')}) of the diagram: the restricted board belongs to another diagram`);
    }
  });
  return rb.simpleRestrictedRoots2.map((s, k) => checkPopulation(n, s, `simple restricted root ${k}`));
}

/**
 * The coordinates of a doubled shadow in the doubled simple restricted roots (SPEC.md 2.15): the integers c, one
 * per orbit in the order of rb.orbits (the order of rb.simpleRestrictedRoots2, rb.cartan and rb.board's
 * positions, not the Bourbaki order of rb.board's labels), with sum over k of c[k] * rb.simpleRestrictedRoots2[k]
 * equal to shadow2 exactly. Since both sides are doubled, these are the coordinates of the shadow alpha-bar in
 * the simple restricted roots; a composite move at orbit k changes them as mutate(rb.board, c, k).
 * Exact rational arithmetic: the normal equations G c = S v (G the integer Gram matrix of the simple restricted
 * roots under the dot product, invertible because they are independent) solved by linalg's solve, then the
 * combination checked entry by entry. A compact form (no orbit) gives [] for the zero vector.
 * RangeError when shadow2 has the wrong length or an entry that is not an integer, when it is not a combination
 * of the simple restricted roots (any nonzero vector on a compact form), when it is a combination with a
 * coefficient that is not an integer, and when rb does not belong to the diagram (other orbits, or simple
 * restricted roots of another length); on a malformed diagram as the other Satake functions; then
 * NeedsTwoWayRoads, NotFiniteType as 5.6. Pure: no argument is changed and the result is a new array.
 */
export function restrictedCoordinates(d: SatakeDiagram, rb: RestrictedBoard, shadow2: Vec<number>): number[] {
  const X = checkDiagram(d);
  const n = d.board.n;
  const v = checkPopulation(n, shadow2, 'shadow');
  const S = checkRestricted(d, X, rb);
  guard(d.board);
  const m = S.length;
  const shown = `(${v.join(', ')})`;
  const Sb = S.map((s) => s.map((x) => BigInt(x)));
  const vb = v.map((x) => BigInt(x));
  const dot = (x: readonly bigint[], y: readonly bigint[]): bigint => {
    let t = 0n;
    for (let i = 0; i < n; i++) t += x[i]! * y[i]!;
    return t;
  };
  const G = Sb.map((s) => Sb.map((t) => dot(s, t)));
  const c = solve(G, Sb.map((s) => dot(s, vb)));
  if (c === null) throw new RangeError('the simple restricted roots of this restricted board are not linearly independent');
  // the solution of the normal equations is a combination equal to v exactly when v lies in their span
  for (let i = 0; i < n; i++) {
    let t = rat(0);
    for (let k = 0; k < m; k++) t = ratAdd(t, ratMul(c[k]!, rat(Sb[k]![i]!)));
    if (!ratEq(t, rat(vb[i]!))) {
      throw new RangeError(
        m === 0
          ? `the shadow ${shown} is not zero, but this diagram has no simple restricted root (a compact form: every node is black)`
          : `the shadow ${shown} is not a combination of the simple restricted roots`,
      );
    }
  }
  if (c.some((x) => x.den !== 1n)) {
    throw new RangeError(
      `the shadow ${shown} is not an integer combination of the simple restricted roots: its coordinates would be (${c.map(ratToString).join(', ')})`,
    );
  }
  return c.map((x, k) => {
    if (x.num > BigInt(Number.MAX_SAFE_INTEGER) || x.num < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new EngineOverflow(`coordinate ${k} of the shadow ${shown} is not a safe integer`);
    }
    return Number(x.num);
  });
}

// ---------------------------------------------------------------------------------------------
// satake (oracle satake; SPEC.md 2.15, 6.4)
// ---------------------------------------------------------------------------------------------

/**
 * Every computed field of SPEC.md 6.4 for an admissible pair, from rank to restricted_reflection_word_lengths,
 * with the golden field names and nodes as positions (oracle satake). restricted_type is B2 for every rank 2
 * system with two lengths and restricted_board is identify's name (the C2 display adjustment is satakeRecord's,
 * SPEC.md 6.4). Throws NotAdmissible on a pair that is not admissible, before any shadow is classified, and
 * NeedsConnectedBoard (E-10) on an admissible pair whose restricted root system is in several pieces (possible
 * only on a board in several pieces, such as the split form of A2 + A2), where the oracle cannot name it.
 */
export function satake(d: SatakeDiagram): SatakeComputed {
  const P = prepare(d);
  requireAdmissible(P);
  const { board, n, X } = P;
  const R = allRoots(board);
  const B = gramOf(board);
  const rootKeys = new Set(R.map(keyOf));
  const th = new Map<string, number[]>();
  for (const a of R) th.set(keyOf(a), thetaWith(P, a));
  // the oracle's asserts, kept (SPEC.md 2.15: asserted inside satake for every record it computes)
  for (const t of th.values()) if (!rootKeys.has(keyOf(t))) throw new EngineError('theta does not preserve the roots');
  for (const a of R) {
    if (keyOf(th.get(keyOf(th.get(keyOf(a))!))!) !== keyOf(a)) throw new EngineError('theta is not an involution');
  }
  // compact imaginary (theta a = a, restricts to 0), real (theta a = -a), complex; the multiset of shadows of the
  // other roots, keyed by the doubled shadow (the same multiset as the oracle's halves)
  const restr = new Map<string, { v: number[]; count: number }>();
  let nCompact = 0;
  let nReal = 0;
  let nComplex = 0;
  for (const a of R) {
    const t = th.get(keyOf(a))!;
    if (t.every((x, i) => x === a[i])) {
      nCompact += 1;
      continue;
    }
    if (t.every((x, i) => x === -a[i]!)) nReal += 1;
    else nComplex += 1;
    const s = a.map((x, i) => x - t[i]!);
    const k = keyOf(s);
    const e = restr.get(k);
    if (e === undefined) restr.set(k, { v: s, count: 1 });
    else e.count += 1;
  }
  const phiX = 2 * subPositiveRoots(board, X).length;
  if (nCompact !== phiX) throw new EngineError(`(${nCompact}, ${phiX})`);
  for (const a of positiveRootsFrom(board, R)) {
    const t = th.get(keyOf(a))!;
    if (keyOf(t) !== keyOf(a) && t.some((x) => x > 0)) {
      throw new EngineError('theta(positive non-compact root) must be negative');
    }
  }
  const r = tauOrbits(P.tau, whiteOf(P)).length;
  // the restricted board: one node per tau-orbit of white nodes. A restricted root system in several pieces is
  // refused here, where the oracle's classify_restricted fails on it (MERGE ruling (1) on P6-A1, E-10: the class
  // identify throws on a board in several pieces); restrictedBoard still returns that board (labels 1..m, no name)
  const rb = restrictedWith(P);
  const pieces = r > 0 ? components(rb.board).length : 1;
  if (pieces > 1) {
    throw new NeedsConnectedBoard(
      `satake needs a restricted root system in one piece; the restricted board of this pair is in ${pieces} pieces`,
    );
  }
  const S = [...restr.values()];
  let name: string | null = null;
  const mult: { class: string; roots: number; mult: number }[] = [];
  if (r > 0) {
    // only after admissibility (2.15, generalized diagrams): a pair failing condition 3 never reaches here
    const rt = classifyRestricted(
      S.map((e) => e.v),
      B,
      r,
    );
    name = rt.name;
    const normText = S.map((e) => ratToString(bil(B, e.v, e.v)));
    for (const c of rt.classes) {
      const ms = new Set<number>();
      S.forEach((e, k) => {
        if (normText[k] === c.form_value) ms.add(e.count);
      });
      if (ms.size !== 1) throw new EngineError(`multiplicity not constant on a length class (${[...ms].join(', ')})`);
      mult.push({ class: c.class, roots: c.roots, mult: [...ms][0]! });
    }
  }
  const nphi = R.length;
  const dimK = n - r + (nphi + phiX) / 2;
  const dimP = r + (nphi - phiX) / 2;
  const count = (v: readonly number[]): number => restr.get(keyOf(v))?.count ?? 0;
  const simpleMult: [number, number][] = rb.simple.map((s) => [count(s), count(s.map((x) => 2 * x))]);
  rb.simple.forEach((s, k) => {
    const half = s.every((x) => x % 2 === 0) ? count(s.map((x) => x / 2)) : 0;
    if (!(simpleMult[k]![0] > 0 && half === 0)) throw new EngineError('a simple restricted root is never twice a restricted root');
  });
  return {
    rank: n,
    real_rank: r,
    restricted_type: name,
    multiplicities: mult,
    n_restricted_roots: S.length,
    dim_g: n + nphi,
    dim_k: dimK,
    dim_p: dimP,
    character: dimP - dimK,
    roots_compact_imaginary: nCompact,
    roots_real: nReal,
    roots_complex: nComplex,
    w_X_word: [...P.wx],
    restricted_simple_orbits: rb.orbits.map((o) => [...o]),
    restricted_simple_multiplicities: simpleMult,
    restricted_cartan: rb.cartan.map((row) => [...row]),
    restricted_board: rb.order === null ? null : rb.board.name!,
    restricted_orbits_in_bourbaki_order: rb.order === null ? null : rb.order.map((k) => [...rb.orbits[k]!]),
    restricted_reflection_word_lengths: rb.words.map((w) => w.length - 2 * P.wx.length),
  };
}
