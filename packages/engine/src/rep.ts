// Representations read off the numbers game (SPEC.md 2.18, 5.2, 5.4 table "Representations", 5.6;
// CONTRACTS.md 2.1, 2.2, 2.4 phase 5; owner P5-A1). Ports of the oracle's sparse helpers sp_mul, sp_add,
// sp_comm and sp_scale (reference/lie_games.py lines 811 to 834, with the comment at line 809), of
// chevalley_serre_ok (837 to 853), minuscule_matrices (856 to 877), string_through (1744 to 1748) and
// signed_moves (1751 to 1758). Phase 7 adds orbitPlusZeroMatrices here, built on the same sparse
// operations and checked by the same chevalleySerre.
//
// Matrices are sparse: a Map from the key "row,column" (spKey) to a nonzero bigint, on every board, SafeInt
// boards included (E-1, E-4). Rows and columns are basis indices from 0; the row of an entry is the image
// and the column the source, so the matrices act on column vectors and spMul(X, Y) is "first Y, then X".
// No stored entry is zero: every operation drops zeros from its result, as the oracle's final
// `{k: v for k, v in out.items() if v != 0}` does, and the empty Map is the zero matrix.
//
// Conventions at this boundary (E-5, E-7): node positions in and out (i, k, RelationCheck.i and .j); pure
// functions that never write into a board, a vector or a Map they are given and always return new arrays
// and new Maps. No label arithmetic, no worker, no cap thrown (E-9, E-10).

/** A sparse integer matrix: key "row,column" (spKey), nonzero bigint values (SPEC.md 5.2, verbatim). */
export type SparseMatrix = Map<string, bigint>;

/** One instance of one Chevalley-Serre relation with both sides (SPEC.md 5.2, verbatim). */
export interface RelationCheck {
  relation: 'hh' | 'he' | 'hf' | 'ef' | 'serre-e' | 'serre-f';
  i: number;
  j: number;
  holds: boolean;
  left: SparseMatrix;
  right: SparseMatrix;
}

// ---------------------------------------------------------------------------------------------
// The sparse operations (oracle lines 809 to 834)
// ---------------------------------------------------------------------------------------------

/** The key of a matrix entry, without checks (internal; spKey checks). */
function keyOf(row: number, column: number): string {
  return `${row},${column}`;
}

/**
 * The key of the entry in row `row` and column `column`: the two decimal integers joined by one comma, no
 * spaces, no leading zeros ("0,2", "12,3"). Both must be non-negative safe integers (RangeError otherwise).
 */
export function spKey(row: number, column: number): string {
  if (!Number.isSafeInteger(row) || row < 0 || !Number.isSafeInteger(column) || column < 0) {
    throw new RangeError(`a matrix entry needs a non-negative integer row and column, not ${String(row)} and ${String(column)}`);
  }
  return keyOf(row, column);
}

const KEY = /^(0|[1-9][0-9]*),(0|[1-9][0-9]*)$/;

/** Row and column of a key written as spKey writes it; RangeError on any other text. */
function parseKey(key: string): [number, number] {
  const m = KEY.exec(key);
  if (m === null) throw new RangeError(`${JSON.stringify(key)} is not a matrix key "row,column"`);
  const r = Number(m[1]);
  const c = Number(m[2]);
  if (!Number.isSafeInteger(r) || !Number.isSafeInteger(c)) throw new RangeError(`${JSON.stringify(key)} is not a matrix key "row,column"`);
  return [r, c];
}

/** The entries of `out` that are not zero, in the order of `out` (the oracle's final filter). */
function zeroFree(out: Map<string, bigint>): SparseMatrix {
  const res: SparseMatrix = new Map();
  for (const [k, v] of out) if (v !== 0n) res.set(k, v);
  return res;
}

/**
 * The product XY: (XY)[r][c] = sum_k X[r][k] Y[k][c] (oracle sp_mul): the entries of Y grouped by row k,
 * then for each entry (r, k) of X and each (c, w) in row k of Y, v * w added to (r, c); zeros dropped.
 * Each key is parsed once (RangeError on a key that spKey would not write).
 */
export function spMul(X: SparseMatrix, Y: SparseMatrix): SparseMatrix {
  const byRow = new Map<number, [number, bigint][]>();
  for (const [key, w] of Y) {
    const [k, c] = parseKey(key);
    let row = byRow.get(k);
    if (row === undefined) {
      row = [];
      byRow.set(k, row);
    }
    row.push([c, w]);
  }
  const out = new Map<string, bigint>();
  for (const [key, v] of X) {
    const [r, k] = parseKey(key);
    const row = byRow.get(k);
    if (row === undefined) continue;
    for (const [c, w] of row) {
      const at = keyOf(r, c);
      out.set(at, (out.get(at) ?? 0n) + v * w);
    }
  }
  return zeroFree(out);
}

/** X + cy Y, cy defaulting to 1n (oracle sp_add): a copy of X, then cy * v added for each entry of Y; zeros dropped. */
export function spAdd(X: SparseMatrix, Y: SparseMatrix, cy: bigint = 1n): SparseMatrix {
  const out = new Map<string, bigint>(X);
  for (const [k, v] of Y) out.set(k, (out.get(k) ?? 0n) + cy * v);
  return zeroFree(out);
}

/** The commutator [X, Y] = XY - YX (oracle sp_comm). */
export function spComm(X: SparseMatrix, Y: SparseMatrix): SparseMatrix {
  return spAdd(spMul(X, Y), spMul(Y, X), -1n);
}

/** cX (oracle sp_scale); the empty Map when c is 0n. */
export function spScale(X: SparseMatrix, c: bigint): SparseMatrix {
  const out: SparseMatrix = new Map();
  for (const [k, v] of X) {
    const x = c * v;
    if (x !== 0n) out.set(k, x);
  }
  return out;
}

/**
 * Whether X and Y have the same nonzero entries: Python's `==` on zero-free dictionaries, independent of
 * insertion order. An explicit 0n entry in either counts as absent (plan), so that a Map built without the
 * invariant still compares correctly.
 */
export function spEq(X: SparseMatrix, Y: SparseMatrix): boolean {
  let nx = 0;
  for (const [k, v] of X) {
    if (v === 0n) continue;
    nx += 1;
    if (Y.get(k) !== v) return false;
  }
  let ny = 0;
  for (const v of Y.values()) if (v !== 0n) ny += 1;
  return nx === ny;
}
