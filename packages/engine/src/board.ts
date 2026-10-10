// Boards: SPEC.md 2.1 (the board, C = 2I - A^T, the three kinds), 2.8 (Bourbaki numbering of every
// finite family), 5.2 (the Board type), 5.3, E-7 (positions inside, labels at the boundary), E-8.
// Port of the oracle's cartan, adjacency, board_kind and the finite branch of board_from_name.
// Boards are immutable: the object, its labels, its matrix and every row are frozen.
import { Big, SafeInt } from './arith';
import type { Arith, Matrix } from './arith';
import { NotABoard } from './errors';
// Phase 2 (P2-A1): the affine and twisted names of boardFromName. These two modules import this one in
// turn; the cycle is safe because nothing runs at module load (P2-A1 instruction, trap 15).
import { extendMatrix } from './affine';
import { affineCandidates } from './classify';

export interface Board<T = number> {
  n: number;
  cartan: Matrix<T>; // C[i][j] = <alpha_i^vee, alpha_j>, positions 0..n-1
  labels: readonly number[]; // what the reader sees for each position (E-7)
  kind: 'gcm' | 'one-way';
  arith: Arith<T>;
  name?: string; // "E8", "B3", "A4~", "D4^(3)", "pentagon"; undefined if custom
}

export type AnyBoard = Board<number> | Board<bigint>;

// ---------------------------------------------------------------------------------------------
// Finite names: a letter A to G and a rank, exactly the ranges of SPEC.md 2.8. The oracle's cartan
// does not validate ranks; the engine throws NotABoard outside these ranges and on any other string.
// ---------------------------------------------------------------------------------------------

const FAMILIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
type Family = (typeof FAMILIES)[number];

function familyAllows(letter: Family, n: number): boolean {
  switch (letter) {
    case 'A': return n >= 1;
    case 'B': return n >= 2;
    case 'C': return n >= 2;
    case 'D': return n >= 4;
    case 'E': return n === 6 || n === 7 || n === 8;
    case 'F': return n === 4;
    case 'G': return n === 2;
  }
}

/** Parses "A3", "B4", ... into letter and rank; null unless the family allows the rank. */
function parseFiniteName(name: string): { letter: Family; n: number } | null {
  const m = /^([A-G])([1-9][0-9]*)$/.exec(name);
  if (m === null) return null;
  const letter = m[1] as Family;
  const n = Number(m[2]);
  if (!Number.isSafeInteger(n) || !familyAllows(letter, n)) return null;
  return { letter, n };
}

/**
 * The Cartan matrix of a finite type in Bourbaki numbering (positions 0..n-1), as fresh plain numbers.
 * Port of the oracle's cartan(letter, n) with its helper link(i, j, cij, cji) on 1-based nodes.
 */
export function cartan(name: string): number[][] {
  const parsed = parseFiniteName(name);
  if (parsed === null) throw new NotABoard(`${JSON.stringify(name)} is not the name of a finite type`);
  const { letter, n } = parsed;
  const C: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(i === j ? 2 : 0);
    C.push(row);
  }
  // 1-based node numbers, as in the oracle and in SPEC.md 2.8
  const link = (i: number, j: number, cij = -1, cji = -1): void => {
    C[i - 1]![j - 1] = cij;
    C[j - 1]![i - 1] = cji;
  };
  switch (letter) {
    case 'A':
      for (let i = 1; i < n; i++) link(i, i + 1);
      break;
    case 'B': // alpha_n short; C_{n,n-1} = -2
      for (let i = 1; i < n - 1; i++) link(i, i + 1);
      link(n - 1, n, -1, -2);
      break;
    case 'C': // alpha_n long; C_{n-1,n} = -2
      for (let i = 1; i < n - 1; i++) link(i, i + 1);
      link(n - 1, n, -2, -1);
      break;
    case 'D': // path 1..n-1, node n joined to node n-2
      for (let i = 1; i < n - 1; i++) link(i, i + 1);
      link(n - 2, n);
      break;
    case 'E': // path 1-3-4-5-6(-7-8), node 2 joined to 4
      link(1, 3); link(3, 4); link(4, 5); link(5, 6); link(2, 4);
      if (n >= 7) link(6, 7);
      if (n >= 8) link(7, 8);
      break;
    case 'F': // nodes 1, 2 long; 3, 4 short; C_{32} = -2
      link(1, 2); link(2, 3, -1, -2); link(3, 4);
      break;
    case 'G': // node 1 short, node 2 long; C_{12} = -3
      link(1, 2, -3, -1);
      break;
  }
  return C;
}

// ---------------------------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------------------------

function freezeMatrix<T>(rows: T[][]): Matrix<T> {
  for (const row of rows) Object.freeze(row);
  return Object.freeze(rows);
}

function bourbakiLabels(n: number): readonly number[] {
  const labels: number[] = [];
  for (let k = 1; k <= n; k++) labels.push(k);
  return Object.freeze(labels);
}

function makeBoard<T>(
  rows: T[][],
  labels: readonly number[],
  kind: 'gcm' | 'one-way',
  arith: Arith<T>,
  name?: string,
): Board<T> {
  const board: Board<T> = { n: rows.length, cartan: freezeMatrix(rows), labels, kind, arith };
  if (name !== undefined) board.name = name;
  return Object.freeze(board);
}

/** Labels 0..n-1, for the affine and twisted boards (E-7). */
function affineLabels(n: number): readonly number[] {
  const labels: number[] = [];
  for (let k = 0; k < n; k++) labels.push(k);
  return Object.freeze(labels);
}

/**
 * A board from its name. Phase 0: the finite names that cartan accepts give a Board<number> with
 * SafeInt, labels 1..n in Bourbaki order, kind 'gcm' and the name as given ("B2" and "C2" are both
 * names). Phase 2 (P2-A1, port of the oracle's board_from_name, lines 1786 to 1808): 'pentagon' and
 * 'square' (the 5-cycle and the 4-cycle, labels 1..m round the cycle); "X~" for every finite name X
 * (the untwisted affine extension, labels 0..n; "B2~" and "C2~" are both accepted and build the two
 * numberings); the twisted names "A2^(2)" ... "D4^(3)" as listed by affineCandidates(m) for m = 2..13
 * (labels 0..n in the order of their matrix). All of these are Board<bigint> with Big (E-2), kind 'gcm',
 * and the name as given (plan). Every other name throws NotABoard.
 */
export function boardFromName(name: string): AnyBoard {
  if (name === 'pentagon' || name === 'square') {
    const m = name === 'pentagon' ? 5 : 4;
    const rows: bigint[][] = [];
    for (let i = 0; i < m; i++) {
      const row: bigint[] = [];
      for (let j = 0; j < m; j++) {
        const d = (((i - j) % m) + m) % m;
        row.push(i === j ? 2n : d === 1 || d === m - 1 ? -1n : 0n);
      }
      rows.push(row);
    }
    return makeBoard(rows, bourbakiLabels(m), 'gcm', Big, name);
  }
  const affine = /^([A-G][1-9][0-9]*)~$/.exec(name);
  if (affine !== null) {
    const C = cartan(affine[1]!); // throws NotABoard on an unknown finite name
    const ext = extendMatrix(C, false);
    return makeBoard(ext.cartan.map((row) => row.map((x) => BigInt(x))), affineLabels(C.length + 1), 'gcm', Big, name);
  }
  if (/^[A-E][1-9][0-9]*\^\((2|3)\)$/.test(name)) {
    for (let m = 2; m <= 13; m++) {
      for (const cand of affineCandidates(m)) {
        if (cand.name === name) {
          return makeBoard(cand.cartan.map((row) => row.map((x) => BigInt(x))), affineLabels(m), 'gcm', Big, name);
        }
      }
    }
    throw new NotABoard(`${JSON.stringify(name)} is not the name of a twisted affine board with at most 13 nodes`);
  }
  const C = cartan(name); // throws NotABoard on an unknown name
  return makeBoard(C, bourbakiLabels(C.length), 'gcm', SafeInt, name);
}

// ---------------------------------------------------------------------------------------------
// Kinds (E-8), port of the oracle's board_kind. Plan additions: a matrix that is not square, a ragged
// matrix, or a row holding a non-number is 'not-a-board'. The empty matrix is 'gcm', as in the oracle.
// Takes plain numbers only: the kind of a Big board is computed before its entries become bigint.
// ---------------------------------------------------------------------------------------------

export function boardKind(C: readonly (readonly number[])[]): 'not-a-board' | 'one-way' | 'gcm' {
  if (!Array.isArray(C)) return 'not-a-board';
  const n = C.length;
  for (let i = 0; i < n; i++) {
    const row = C[i];
    if (!Array.isArray(row) || row.length !== n) return 'not-a-board';
    if (typeof row[i] !== 'number' || row[i] !== 2) return 'not-a-board';
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const x = row[j];
      if (typeof x !== 'number' || !Number.isInteger(x) || x > 0) return 'not-a-board';
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if ((C[i]![j] === 0) !== (C[j]![i] === 0)) return 'one-way';
    }
  }
  return 'gcm';
}

// ---------------------------------------------------------------------------------------------
// Adjacency and back (SPEC.md 2.1): C = 2I - A^T, A[i][j] = roads from i to j = -C[j][i].
// ---------------------------------------------------------------------------------------------

function sameMatrix(M: number[][], N: number[][]): boolean {
  if (M.length !== N.length) return false;
  for (let i = 0; i < M.length; i++) {
    const r = M[i]!;
    const s = N[i]!;
    if (r.length !== s.length) return false;
    for (let j = 0; j < r.length; j++) if (r[j] !== s[j]) return false;
  }
  return true;
}

/**
 * The finite type whose standard matrix equals C, trying the families in the order A, B, C, D, E, F, G
 * (SPEC.md 5.5, "Naming"); null when none matches. Exact comparison only; phase 2 replaces this with
 * identify.
 */
function finiteNameOf(C: number[][]): string | null {
  const n = C.length;
  for (const letter of FAMILIES) {
    if (!familyAllows(letter, n)) continue;
    const name = `${letter}${n}`;
    if (sameMatrix(cartan(name), C)) return name;
  }
  return null;
}

/**
 * A board from its adjacency matrix. A must be a square matrix of non-negative integers with zero
 * diagonal, on at least one node, and C = 2I - A^T must be a board; otherwise NotABoard. A one-way
 * adjacency gives kind 'one-way'. Labels are 1..n in order of creation (E-7).
 * Arithmetic in phase 0: SafeInt with the type's name when C equals the standard matrix of a finite
 * type, except that the C2 matrix [[2, -2], [-1, 2]] gets a SafeInt board with no name (a computed
 * name would have to say B2, whose Bourbaki order this matrix does not have; reordering is identify's
 * job in phase 2); Big with no name otherwise.
 */
export function fromAdjacency(A: number[][]): AnyBoard {
  if (!Array.isArray(A) || A.length === 0) throw new NotABoard('an adjacency matrix needs at least one node');
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const row = A[i];
    if (!Array.isArray(row) || row.length !== n) throw new NotABoard('the adjacency matrix is not square');
    for (let j = 0; j < n; j++) {
      const x = row[j];
      if (typeof x !== 'number' || !Number.isInteger(x) || x < 0) {
        throw new NotABoard(`the road count at (${i}, ${j}) is not a non-negative integer`);
      }
      if (i === j && x !== 0) throw new NotABoard(`a board has no loops, but node ${i} has ${x}`);
    }
  }
  const C: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(i === j ? 2 : -A[j]![i]!);
    C.push(row);
  }
  const kind = boardKind(C);
  if (kind === 'not-a-board') throw new NotABoard('the matrix 2I - A^T is not a board');
  const name = finiteNameOf(C);
  if (name !== null) {
    if (name === 'C2') return makeBoard(C, bourbakiLabels(n), 'gcm', SafeInt);
    return boardFromName(name);
  }
  const big = C.map((row) => row.map((x) => BigInt(x)));
  return makeBoard(big, bourbakiLabels(n), kind, Big);
}

/** A[i][j] = roads from i to j = -C[j][i], as fresh plain numbers; port of the oracle's adjacency. */
export function adjacency(board: AnyBoard): number[][] {
  const C = board.cartan as Matrix<number | bigint>;
  const n = board.n;
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(i === j ? 0 : -Number(C[j]![i]!));
    A.push(row);
  }
  return A;
}

/** A fresh number[][] copy of board.cartan (plan); equals cartan(board.name) for a named finite board. */
export function cartanNumbers(board: AnyBoard): number[][] {
  const C = board.cartan as Matrix<number | bigint>;
  return C.map((row) => row.map((x) => Number(x)));
}

// ---------------------------------------------------------------------------------------------
// E-7: the only two converters between positions and labels.
// ---------------------------------------------------------------------------------------------

/** Maps each position to its label; RangeError on a position outside 0..n-1 (plan). */
export function toLabels(board: AnyBoard, positions: readonly number[]): number[] {
  const out: number[] = [];
  for (const p of positions) {
    if (!Number.isInteger(p) || p < 0 || p >= board.n) {
      throw new RangeError(`position ${String(p)} is outside 0..${board.n - 1}`);
    }
    out.push(board.labels[p]!);
  }
  return out;
}

/** Maps each label to its position; RangeError on an unknown label. */
export function toPositions(board: AnyBoard, labels: readonly number[]): number[] {
  const out: number[] = [];
  for (const label of labels) {
    const p = board.labels.indexOf(label);
    if (p < 0) throw new RangeError(`label ${String(label)} is not on this board`);
    out.push(p);
  }
  return out;
}

// =============================================================================================
// Phase 1 (P1-A1): components, transposeBoard, subBoard. Appended after P0-A2's code; nothing above
// this line is changed. SPEC.md 5.3, 5.6 (both work on a one-way board: roads in either direction join),
// E-7 (subBoard keeps the labels of the chosen nodes). Ports of the oracle's components, transpose and
// sub_matrix.
// =============================================================================================

/** Integer copy of a matrix in either arithmetic, for boardKind and the naming match. */
function integerRows<T>(M: Matrix<T>): number[][] {
  return (M as Matrix<number | bigint>).map((row) => row.map((x) => Number(x)));
}

/**
 * The connected components as lists of positions, each sorted, in order of least position. Two positions
 * are joined when C[i][j] or C[j][i] is nonzero (oracle lines 92 to 103).
 */
export function components<T>(board: Board<T>): number[][] {
  const { n, cartan, arith } = board;
  const seen: boolean[] = [];
  for (let i = 0; i < n; i++) seen.push(false);
  const out: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    const comp: number[] = [];
    const stack: number[] = [s];
    seen[s] = true;
    while (stack.length > 0) {
      const i = stack.pop()!;
      comp.push(i);
      for (let j = 0; j < n; j++) {
        if (seen[j] || i === j) continue;
        if (arith.sign(cartan[i]![j]!) !== 0 || arith.sign(cartan[j]![i]!) !== 0) {
          seen[j] = true;
          stack.push(j);
        }
      }
    }
    comp.sort((a, b) => a - b);
    out.push(comp);
  }
  return out;
}

/**
 * The reversed board (SPEC.md 2.4(b), 5.3): cartan C^T in fresh rows, the same labels and arithmetic,
 * the kind of the transposed matrix (the board's own), and the finite name whose standard matrix equals
 * C^T, under the phase-0 rule of fromAdjacency (the C2 matrix stays unnamed); undefined otherwise (plan).
 */
export function transposeBoard<T>(board: Board<T>): Board<T>;
export function transposeBoard(board: AnyBoard): AnyBoard;
export function transposeBoard<T>(board: Board<T>): Board<T> {
  const { n, cartan } = board;
  const rows: T[][] = [];
  for (let i = 0; i < n; i++) {
    const row: T[] = [];
    for (let j = 0; j < n; j++) row.push(cartan[j]![i]!);
    rows.push(row);
  }
  const ints = integerRows(rows);
  const kind = boardKind(ints);
  if (kind === 'not-a-board') throw new NotABoard('the transposed matrix is not a board');
  const match = finiteNameOf(ints);
  const name = match !== null && match !== 'C2' ? match : undefined;
  return makeBoard(rows, Object.freeze([...board.labels]), kind, board.arith, name);
}

/**
 * The induced board on the chosen positions, sorted ascending (oracle sub_matrix, lines 734 to 736):
 * position k of the result is the k-th smallest chosen position; labels are those of the chosen nodes,
 * unchanged (E-7); kind from the induced matrix; the board's arithmetic; no name (plan). An empty list,
 * a repeated position or a position outside 0..n-1 is a RangeError (plan).
 */
export function subBoard<T>(board: Board<T>, nodes: readonly number[]): Board<T>;
export function subBoard(board: AnyBoard, nodes: readonly number[]): AnyBoard;
export function subBoard<T>(board: Board<T>, nodes: readonly number[]): Board<T> {
  if (nodes.length === 0) throw new RangeError('a sub-board needs at least one node');
  const sorted = [...nodes].sort((a, b) => a - b);
  for (let k = 0; k < sorted.length; k++) {
    const p = sorted[k]!;
    if (!Number.isInteger(p) || p < 0 || p >= board.n) {
      throw new RangeError(`position ${String(p)} is outside 0..${board.n - 1}`);
    }
    if (k > 0 && sorted[k - 1] === p) throw new RangeError(`position ${p} is repeated`);
  }
  const rows: T[][] = sorted.map((i) => sorted.map((j) => board.cartan[i]![j]!));
  const kind = boardKind(integerRows(rows));
  if (kind === 'not-a-board') throw new NotABoard('the induced matrix is not a board');
  const labels = Object.freeze(sorted.map((i) => board.labels[i]!));
  return makeBoard(rows, labels, kind, board.arith);
}
