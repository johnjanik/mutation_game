// The Satake catalogue (SPEC.md 6.4, 6.5, Appendix B.1, 2.15 "Which pairs are real forms" and "What the diagram
// does not show", 5.4 "Satake functions (phase 6)", 5.5 "The class of a Satake pair", 5.6, E-5, E-7, E-10, E-11;
// CONTRACTS.md 2.1, 2.2, 2.4 phase 6; owner P6-A2): satakeCatalogue, satakeRecord, canonicalPair and
// matchCatalogue, ported from the oracle's _ident, _flip_a, _swap_d, FLIP_E6 (reference/lie_games.py lines 1460
// to 1473), satake_catalogue (1476 to 1573), canonical_pair (1576 to 1589), match_catalogue (1592 to 1597) and
// satake_record (1811 to 1827), keeping the oracle's choices: the families in the order A, B, C, D, then the
// exceptional rows, and inside a family the order of the oracle's loops; the class of a pair is the least
// (sorted black set, then tau) over every symmetry g of the board, with tau conjugated as g tau g^-1.
//
// Positions in, positions out (E-7): black_nodes, tau, arrows and every node of a record are positions 0..n-1;
// the oracle's satake_record returns labels, the engine returns positions and tests convert with toLabels.
// The engine takes a board name ('A3', 'C2', 'E6') where the oracle takes a family letter and a rank. The oracle's
// expectations em and dk are not fields of the contract (CONTRACTS.md 2.2): the golden comparison covers them.
//
// Order of checks (P2-A1's engine-wide order, kept by P6-A1 and accepted by MERGE): the name (NotABoard from
// boardFromName), the shape of the arguments (RangeError), then requireGcm (NeedsTwoWayRoads) and requireFinite
// (NotFiniteType) through guards.ts (E-11), before any computation; satakeRecord then throws NotAdmissible
// through satake on an entry that is not admissible. canonicalPair and matchCatalogue never throw NotAdmissible.
import type { Board } from './board';
import { boardFromName, cartan, cartanNumbers } from './board';
import { EngineError, NotABoard } from './errors';
import type { Symmetry } from './fold';
import { symmetries } from './fold';
import { requireFinite, requireGcm } from './guards';
import type { SatakeComputed, SatakeDiagram } from './satake';
import { satake } from './satake';

// ---------------------------------------------------------------------------------------------
// Types (CONTRACTS.md 2.2, verbatim)
// ---------------------------------------------------------------------------------------------

/** One entry of the catalogue of a board: Cartan's label, the real form, the pair (positions) and the display type. */
export interface SatakeCatalogueEntry {
  cartan_label: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  restricted_type_display: string | null;
}

/** The complete record of SPEC.md 6.4: the catalogue fields, arrows, tau_moves_black_nodes and satake's fields. */
export interface SatakeRecord extends SatakeCatalogueEntry, SatakeComputed {
  dynkin_type: string;
  arrows: [number, number][];
  tau_moves_black_nodes: boolean;
}

// ---------------------------------------------------------------------------------------------
// The permutations of the catalogue (oracle _ident, _flip_a, _swap_d, FLIP_E6), as fresh arrays
// ---------------------------------------------------------------------------------------------

function ident(n: number): number[] {
  const t: number[] = [];
  for (let i = 0; i < n; i++) t.push(i);
  return t;
}

/** i -> n - 1 - i: the flip of A_n (the identity on A_1). */
function flipA(n: number): number[] {
  const t: number[] = [];
  for (let i = 0; i < n; i++) t.push(n - 1 - i);
  return t;
}

/** The identity with positions n - 2 and n - 1 exchanged: the swap of the two short arms of D_n. */
function swapD(n: number): number[] {
  const t = ident(n);
  t[n - 2] = n - 1;
  t[n - 1] = n - 2;
  return t;
}

/** The symmetry of E6 in positions: labels 1 and 6, 3 and 5 exchanged, 2 and 4 fixed. Copied wherever it is used. */
const FLIP_E6: readonly number[] = Object.freeze([5, 1, 4, 3, 2, 0]);

/** from, from + step, ... below to (Python's range). */
function range(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let k = from; k < to; k += step) out.push(k);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Input checks and the guard
// ---------------------------------------------------------------------------------------------

/**
 * The black positions, sorted, after checking the shape of a pair on a board of n nodes: tau a permutation of
 * 0..n-1, black a list of distinct positions. RangeError on any malformed part; the arguments are only read.
 */
function checkPair(n: number, black: unknown, tau: unknown): number[] {
  if (!Array.isArray(tau) || tau.length !== n) {
    throw new RangeError(`tau of this board has ${n} entries, not ${Array.isArray(tau) ? tau.length : 'none'}`);
  }
  const hit: boolean[] = [];
  for (let k = 0; k < n; k++) hit.push(false);
  for (const x of tau as unknown[]) {
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x >= n) {
      throw new RangeError(`the image ${String(x)} under tau is outside 0..${n - 1}`);
    }
    if (hit[x]) throw new RangeError(`the image ${x} appears twice under tau: not a permutation`);
    hit[x] = true;
  }
  if (!Array.isArray(black)) throw new RangeError('the black nodes are a list of positions');
  const seen: boolean[] = [];
  for (let k = 0; k < n; k++) seen.push(false);
  for (const x of black as unknown[]) {
    if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x >= n) {
      throw new RangeError(`the black position ${String(x)} is outside 0..${n - 1}`);
    }
    if (seen[x]) throw new RangeError(`the black position ${x} is repeated`);
    seen[x] = true;
  }
  return [...(black as number[])].sort((a, b) => a - b);
}

/** The black positions of a diagram, sorted, after checking its shape (RangeError). */
function checkDiagram(d: SatakeDiagram): number[] {
  if (d === null || typeof d !== 'object' || d.board === null || typeof d.board !== 'object') {
    throw new RangeError('a Satake diagram is an object { board, black, tau }');
  }
  return checkPair(d.board.n, d.black, d.tau);
}

/** NeedsTwoWayRoads on a one-way board, NotFiniteType off the finite types (SPEC.md 5.6, through guards.ts). */
function guard(board: Board): void {
  requireGcm(board);
  requireFinite(board);
}

/**
 * Family letter and rank of a finite board name. boardFromName has already accepted the name and the guard has
 * found the board finite, so only the finite names "A1", "B2", ..., "G2" reach here.
 */
function familyOf(name: string): { L: string; n: number } {
  const m = /^([A-G])([1-9][0-9]*)$/.exec(name);
  if (m === null) throw new EngineError(`no catalogue rule for the board ${JSON.stringify(name)}`);
  return { L: m[1]!, n: Number(m[2]) };
}

/** The board of a name, guarded: NotABoard on an unknown name, NotFiniteType off the finite types. */
function finiteBoard(name: string): Board {
  // a finite name gives a Board<number> with SafeInt (E-2); every other name is refused by the guard below
  const board = boardFromName(name) as Board;
  guard(board);
  return board;
}

// ---------------------------------------------------------------------------------------------
// satakeCatalogue (oracle satake_catalogue; SPEC.md 6.4 parametric table, 6.5 spellings, Appendix B.1)
// ---------------------------------------------------------------------------------------------

/** The entries of the finite type L_n by the parametric rules of SPEC.md 6.4 and the rows of Appendix B.1. */
function entriesOf(L: string, n: number): SatakeCatalogueEntry[] {
  const out: SatakeCatalogueEntry[] = [];
  const add = (label: string, form: string, X: readonly number[], tau: readonly number[], display: string | null): void => {
    out.push({
      cartan_label: label,
      real_form: form,
      black_nodes: [...X].sort((a, b) => a - b),
      tau: [...tau],
      restricted_type_display: display,
    });
  };
  if (L === 'A') {
    add('A I', `sl(${n + 1},R)`, [], ident(n), `A${n}`);
    if (n % 2 === 1 && n >= 3) {
      const m = (n + 1) / 2;
      add('A II', `su*(${n + 1})`, range(0, n, 2), ident(n), `A${m - 1}`);
    }
    if (n >= 2) {
      for (let p = 1; p <= Math.floor((n + 1) / 2); p++) {
        const q = n + 1 - p;
        add(p === 1 ? 'A IV' : 'A III', `su(${p},${q})`, range(p, n - p), flipA(n), p === q ? `C${p}` : `BC${p}`);
      }
    }
    add('compact', `su(${n + 1})`, range(0, n), flipA(n), null);
  } else if (L === 'B') {
    for (let p = 1; p <= n; p++) {
      const q = 2 * n + 1 - p;
      add(p === 1 ? 'B II' : 'B I', `so(${p},${q})`, range(p, n), ident(n), p === 1 ? 'A1' : `B${p}`);
    }
    add('compact', `so(${2 * n + 1})`, range(0, n), ident(n), null);
  } else if (L === 'C') {
    add('C I', `sp(${2 * n},R)`, [], ident(n), `C${n}`);
    for (let p = 1; p <= Math.floor(n / 2); p++) {
      const q = n - p;
      const X = [...range(0, 2 * p, 2), ...range(2 * p, n)];
      const display = p < q ? `BC${p}` : p === 1 ? 'A1' : `C${p}`;
      add('C II', `sp(${p},${q})`, X, ident(n), display);
    }
    add('compact', `sp(${n})`, range(0, n), ident(n), null);
  } else if (L === 'D') {
    for (let p = 1; p <= n; p++) {
      const q = 2 * n - p;
      const label = p === 1 ? 'D II' : 'D I';
      if (p === n) {
        add(label, `so(${p},${q})`, [], ident(n), `D${n}`);
      } else {
        // black p..n-1 only when two or more nodes remain; tau by the parity of n - p (SPEC.md 2.15: for
        // n - p odd and p <= n - 2 the swap moves black nodes only, and no arrow is drawn)
        const X = n - p >= 2 ? range(p, n) : [];
        const tau = (n - p) % 2 === 0 ? ident(n) : swapD(n);
        add(label, `so(${p},${q})`, X, tau, p === 1 ? 'A1' : `B${p}`);
      }
    }
    if (n % 2 === 0) {
      add('D III', `so*(${2 * n})`, range(0, n - 1, 2), ident(n), `C${n / 2}`);
    } else {
      add('D III', `so*(${2 * n})`, range(0, n - 2, 2), swapD(n), `BC${(n - 1) / 2}`);
    }
    add('compact', `so(${2 * n})`, range(0, n), n % 2 === 0 ? ident(n) : swapD(n), null);
  } else if (L === 'E' && n === 6) {
    add('E I', 'e6(6)', [], ident(6), 'E6');
    add('E II', 'e6(2)', [], FLIP_E6, 'F4');
    add('E III', 'e6(-14)', [2, 3, 4], FLIP_E6, 'BC2');
    add('E IV', 'e6(-26)', [1, 2, 3, 4], ident(6), 'A2');
    add('compact', 'e6(-78)', range(0, 6), FLIP_E6, null);
  } else if (L === 'E' && n === 7) {
    add('E V', 'e7(7)', [], ident(7), 'E7');
    add('E VI', 'e7(-5)', [1, 4, 6], ident(7), 'F4');
    add('E VII', 'e7(-25)', [1, 2, 3, 4], ident(7), 'C3');
    add('compact', 'e7(-133)', range(0, 7), ident(7), null);
  } else if (L === 'E' && n === 8) {
    add('E VIII', 'e8(8)', [], ident(8), 'E8');
    add('E IX', 'e8(-24)', [1, 2, 3, 4], ident(8), 'F4');
    add('compact', 'e8(-248)', range(0, 8), ident(8), null);
  } else if (L === 'F' && n === 4) {
    add('F I', 'f4(4)', [], ident(4), 'F4');
    add('F II', 'f4(-20)', [0, 1, 2], ident(4), 'BC1');
    add('compact', 'f4(-52)', range(0, 4), ident(4), null);
  } else if (L === 'G' && n === 2) {
    add('G', 'g2(2)', [], ident(2), 'G2');
    add('compact', 'g2(-14)', range(0, 2), ident(2), null);
  }
  return out;
}

/**
 * The real forms of the complex simple Lie algebra of a finite board, one entry each, as Satake diagrams: Cartan's
 * label, the real form in the plain-text spelling of SPEC.md 6.5, the black positions (sorted), the full involution
 * tau (the image of every position, black ones included) and the type of the restricted roots as the tables print
 * it (C2 in the families whose general member is C_p; null for the compact form). Entries in the oracle's order.
 * Any rank the family allows is accepted (the golden data stop at 8). NotABoard on a name boardFromName does not
 * know; NotFiniteType on an affine, twisted or preset board (SPEC.md 5.6).
 */
export function satakeCatalogue(name: string): SatakeCatalogueEntry[] {
  finiteBoard(name);
  const { L, n } = familyOf(name);
  return entriesOf(L, n);
}

// ---------------------------------------------------------------------------------------------
// satakeRecord (oracle satake_record; SPEC.md 6.4 "Names in rank 2" and "Fields of a catalogue record")
// ---------------------------------------------------------------------------------------------

/**
 * The complete record of one catalogue entry (SPEC.md 6.4), with the golden field names in the oracle's order and
 * nodes as positions: dynkin_type (the name), the catalogue fields, arrows (the pairs of white positions exchanged
 * by tau, each once, sorted), tau_moves_black_nodes, then the 19 fields of satake. The C2 adjustment of 6.4: where
 * the entry displays C2, restricted_board is renamed C2 and restricted_orbits_in_bourbaki_order is a reversed copy
 * (short node first); restricted_type and every other field stay as satake computes them. NotABoard on an unknown
 * name; RangeError on a malformed entry; NeedsTwoWayRoads, NotFiniteType as SPEC.md 5.6; NotAdmissible (through
 * satake) on an entry that is not admissible.
 */
export function satakeRecord(name: string, entry: SatakeCatalogueEntry): SatakeRecord {
  const board = boardFromName(name) as Board;
  if (entry === null || typeof entry !== 'object') throw new RangeError('a catalogue entry is an object');
  const X = checkPair(board.n, entry.black_nodes, entry.tau);
  guard(board);
  const tau = [...entry.tau];
  const s = satake({ board, black: X, tau });
  const n = board.n;
  const black: boolean[] = [];
  for (let i = 0; i < n; i++) black.push(false);
  for (const i of X) black[i] = true;
  // arrows: the pairs of white nodes exchanged by tau, without duplicates, sorted (a compact form has none)
  const arrows: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const j = tau[i]!;
    if (j === i || black[i]) continue;
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    if (!arrows.some(([x, y]) => x === a && y === b)) arrows.push([a, b]);
  }
  arrows.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const record: SatakeRecord = {
    dynkin_type: name,
    cartan_label: entry.cartan_label,
    real_form: entry.real_form,
    black_nodes: X,
    tau,
    arrows,
    tau_moves_black_nodes: X.some((i) => tau[i] !== i),
    restricted_type_display: entry.restricted_type_display,
    rank: s.rank,
    real_rank: s.real_rank,
    restricted_type: s.restricted_type,
    multiplicities: s.multiplicities,
    n_restricted_roots: s.n_restricted_roots,
    dim_g: s.dim_g,
    dim_k: s.dim_k,
    dim_p: s.dim_p,
    character: s.character,
    roots_compact_imaginary: s.roots_compact_imaginary,
    roots_real: s.roots_real,
    roots_complex: s.roots_complex,
    w_X_word: s.w_X_word,
    restricted_simple_orbits: s.restricted_simple_orbits,
    restricted_simple_multiplicities: s.restricted_simple_multiplicities,
    restricted_cartan: s.restricted_cartan,
    restricted_board: s.restricted_board,
    restricted_orbits_in_bourbaki_order: s.restricted_orbits_in_bourbaki_order,
    restricted_reflection_word_lengths: s.restricted_reflection_word_lengths,
  };
  if (entry.restricted_type_display === 'C2') {
    // SPEC.md 6.4 "Names in rank 2": the board is drawn like its relatives C_p, short node first (the oracle's assert)
    const order = s.restricted_orbits_in_bourbaki_order;
    if (s.restricted_board !== 'B2' || order === null) throw new EngineError('restricted board of a C2 record is not B2');
    record.restricted_board = 'C2';
    record.restricted_orbits_in_bourbaki_order = order.map((o) => [...o]).reverse();
  }
  return record;
}

// ---------------------------------------------------------------------------------------------
// canonicalPair and matchCatalogue (oracle canonical_pair, match_catalogue; SPEC.md 5.5, 2.15, 4 T13)
// ---------------------------------------------------------------------------------------------

/** -1, 0 or 1 as a is lexicographically before, equal to or after b (integer entries, equal lengths). */
function compareLists(a: readonly number[], b: readonly number[]): number {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) return a[k]! < b[k]! ? -1 : 1;
  }
  return a.length - b.length;
}

/**
 * The least (g(X) sorted, g tau g^-1) over the given symmetries g, comparing the black list first and then tau,
 * both lexicographically on integers (Python's tuple order). t[g[i]] = g[tau[i]] is g tau g^-1.
 */
function canonicalWith(X: readonly number[], tau: readonly number[], auts: readonly Symmetry[]): { black: number[]; tau: number[] } {
  let best: { black: number[]; tau: number[] } | null = null;
  for (const g of auts) {
    const black = X.map((i) => g[i]!).sort((a, b) => a - b);
    const t: number[] = [];
    for (let i = 0; i < tau.length; i++) t.push(0);
    for (let i = 0; i < tau.length; i++) t[g[i]!] = g[tau[i]!]!;
    if (best === null) {
      best = { black, tau: t };
      continue;
    }
    const c = compareLists(black, best.black);
    if (c < 0 || (c === 0 && compareLists(t, best.tau) < 0)) best = { black, tau: t };
  }
  // every board has at least its identity among its symmetries
  if (best === null) throw new EngineError('the board has no symmetry, not even the identity');
  return best;
}

/**
 * A representative of the class of the pair (black, tau) under the symmetries of the board (SPEC.md 5.5): over
 * every symmetry g (the order-3 ones of D4 included), the pair (g(X), g tau g^-1), keeping the least in the order
 * "sorted black set, then the images under tau". Two pairs describe the same real form exactly when their
 * representatives are equal. Defined for every well-formed pair, admissible or not; positions in and out.
 * RangeError on a malformed diagram; NeedsTwoWayRoads, NotFiniteType as SPEC.md 5.6.
 */
export function canonicalPair(d: SatakeDiagram): { black: number[]; tau: number[] } {
  const X = checkDiagram(d);
  guard(d.board);
  return canonicalWith(X, d.tau, symmetries(d.board));
}

/**
 * Every catalogue record whose pair is in the class of the diagram's pair, as complete records (satakeRecord), in
 * catalogue order: one for an admissible pair; two on D4 for the class of so(2,6) and so*(8); none for a pair that
 * is not admissible (no catalogue entry is in its class), and never NotAdmissible. The board must be one built by
 * boardFromName (a name, and the matrix of that name): a board without a name has no catalogue, RangeError.
 * RangeError on a malformed diagram; NeedsTwoWayRoads, NotFiniteType as SPEC.md 5.6.
 */
export function matchCatalogue(d: SatakeDiagram): SatakeRecord[] {
  const X = checkDiagram(d);
  guard(d.board);
  const name = d.board.name;
  if (name === undefined || !sameMatrix(cartanNumbers(d.board), finiteCartan(name))) {
    throw new RangeError('matchCatalogue needs a board built by boardFromName');
  }
  // the symmetries once per call, shared by every canonical pair of this call (E-5)
  const auts = symmetries(d.board);
  const key = canonicalWith(X, d.tau, auts);
  const { L, n } = familyOf(name);
  const out: SatakeRecord[] = [];
  for (const e of entriesOf(L, n)) {
    const k = canonicalWith(e.black_nodes, e.tau, auts);
    if (compareLists(k.black, key.black) === 0 && compareLists(k.tau, key.tau) === 0) out.push(satakeRecord(name, e));
  }
  return out;
}

/** The standard matrix of a finite name, or null when the name is not one that cartan knows. */
function finiteCartan(name: string): number[][] | null {
  try {
    return cartan(name);
  } catch (e) {
    if (e instanceof NotABoard) return null;
    throw e;
  }
}

function sameMatrix(a: readonly (readonly number[])[], b: readonly (readonly number[])[] | null): boolean {
  if (b === null || a.length !== b.length) return false;
  return a.every((row, i) => row.length === b[i]!.length && row.every((x, j) => x === b[i]![j]));
}
