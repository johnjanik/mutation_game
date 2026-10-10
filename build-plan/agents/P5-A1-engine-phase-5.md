# P5-A1: Engine phase 5: sparse matrices, minuscule representations, Chevalley-Serre checks, strings

Phase 5, stage 5.1. Size M. Runs in: a worktree on branch `agent/P5-A1`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies. Where this file says (plan), the rule is the build plan's addition and not the specification's; where it says [D], `SPEC.md` marks the point as a design decision. Nothing you build is marked [U]: the only [U] in `SPEC.md` 2.18 is "[Hum72] sections 9.4 and 21.3 [U for the section numbers]", which is lesson wording for `P5-A3`, not an engine value. The claims your tests reproduce are [V] in 2.18 (the 18 representations, the signed move and its square, the failure on node 2 of $D_4$).

## 1. Objective

When you are done, `packages/engine/src/rep.ts` holds the `SparseMatrix` operations (multiply, add, commutator, scale, equality) and the four functions marked phase 5 in `SPEC.md` 5.4: `minusculeMatrices`, `signedMoves`, `chevalleySerre` and `stringThrough`, each a port of its oracle counterpart with the guards of 5.6, and `index.ts` exports them. The golden key of the phase 5 row of 5.7, `minuscule_representations`, is covered and passes for all 18 records, and the non-minuscule node 2 of $D_4$ is shown to fail with both sides of every relation returned. These functions are everything `P5-A2` (T12 Representation Builder and `MatrixView.svelte`) calls in stage 5.2, and what gate G5 measures with "golden tests through phase 5 pass (minuscule_representations)" and, through T12, "every Chevalley-Serre relation checks in the tool for every listed representation".

## 2. Read first, in this order

Read in full unless the item says reference.

1. `SPEC.md` 2.18, in full: the six Chevalley-Serre relations; "Strings" (single steps add or subtract column $i$ of $C$); "Minuscule representations: the game graph is the representation" (the basis, the three bullet rules for $H_k$, $F_k$, $E_k$, the list of 18 representations, the move matrix $E_k+F_k+P_k^0$, the signed move $E_k-F_k+P_k^0$ and its square $(-1)^{H_k}$, the failure on node 2 of $D_4$); "One zero weight" as reference only (phase 7, `orbitPlusZeroMatrices`, which must be able to reuse your sparse operations and `chevalleySerre`); the last paragraph as reference (what T12 says about representations out of reach, [D]).
2. `SPEC.md` 2.7, item F11 (minuscule nodes): the equivalent conditions, "every position in the orbit of $\omega_i$ has all its numbers in $\{-1,0,1\}$", and the golden key `highest_root_of_reversed_board`. Reference: the rest of 2.7, F10 (orbit of $\omega_i$ has $|W|/|W_J|$ elements).
3. `SPEC.md` 5.1, E-1 to E-11, in full; in particular E-5 ("the basis of `minusculeMatrices` is the orbit in decreasing lexicographic order"), E-6, E-7, E-9 (rule 1 lists `minusculeMatrices` as an enumeration), E-10, E-11.
4. `SPEC.md` 5.2: the types `SparseMatrix` and `RelationCheck`, verbatim; the paragraph "Five functions return records with the golden field names" (yours are not among them: they return camel-case types and the test maps them).
5. `SPEC.md` 5.4, the table "Representations", in full (your four rows, and the phase 7 row `orbitPlusZeroMatrices` as reference). Reference: the rows `fire`, `orbit`, `orbitSize`, `weylDimension`, `minusculeNodes`, which you call or cross-check against.
6. `SPEC.md` 5.6, in full: the first table, rows "Orbit for which T12 builds matrices | 2000 positions | explanation only" and "Dimension for matrix grids | 27 | list view" (the second is T12's, not yours); the second table, last row ("the Wythoff, Satake, representation and geometry functions | throw `NeedsTwoWayRoads` | throw `NotFiniteType`").
7. `SPEC.md` 5.7, in full: the phase 5 row (`minuscule_representations` | `minusculeMatrices`, `signedMoves`, `chevalleySerre` | 5); comparison rules 1, 2, 5 (records matched by identifying fields), 7 (`weights_dynkin_labels` absent above dimension 27).
8. `SPEC.md` Appendix G: the row `minuscule_representations` ("18 records: `type`, `node`, `dimension`, and `weights_dynkin_labels` (the positions; `null` above dimension 27)"); the sentence that `node` in `minuscule_representations` is a node label; the sentence "`minuscule_representations` by `type` and `node`" (identifying fields).
9. Reference: `SPEC.md` 4 T12 (what your caller does; its acceptance is the source of the $D_4$ test), 3 M8 figure table (the examples a lesson will show: the strings through $(1,0)$ and $(2,0)$ of $A_2$ at node 1, the $3\times3$ matrices of $A_2$, $[E_1,F_1]=H_1$ and $[E_1,F_2]=0$), 6.6 key `q` ("a relation code of section 5.2 with its node labels: `ef:1,2`, `serre-e:2,3`", which is why the `relation` codes are spelled exactly), 7.7, 9.1 (G5 row), 9.3, Appendix H.
10. Oracle, `reference/lie_games.py` (read each function whole, with the helpers it calls): `sp_mul` lines 811 to 819, `sp_add` 822 to 826, `sp_comm` 829 to 830, `sp_scale` 833 to 834 (with the comment at line 809: "Matrices are sparse dictionaries {(row, column): value}; (X Y)[r][c] = sum_k X[r][k] Y[k][c]"); `chevalley_serre_ok` 837 to 853; `minuscule_matrices` 856 to 877; `signed_moves` 1751 to 1758; `string_through` 1744 to 1748; the helpers `fire` 145 to 148, `orbit` 165 to 179, `unit` 182 to 183. Reference: `orbit_plus_zero_matrices` 880 onwards (phase 7), `minuscule_nodes` 1713 to 1717, `weyl_dimension` 307, `orbit_size` 1425.
11. `reference/verify.py` lines 1238 to 1275 (section 14): the list `MINU` of the 18 `(letter, rank, node)` triples; the checks your tests reproduce (dimension equals the Weyl dimension formula; `chevalley_serre_ok`; `S[k] == E[k] + F[k] + P0`; `E[k]^2 = F[k]^2 = 0`; `(1+E)(1-F)(1+E) == E - F + P0 == signed_moves(...)[k]`; its square is the diagonal with `-1` where `orb[r][k] != 0` and `1` elsewhere); how `weights_dynkin_labels` is written (`[list(a) for a in orb] if dim <= 27 else None`, so in basis order); the string checks at 1263 to 1272; the $D_4$ check at 1274 to 1275.
12. Golden key, shape (print it with `python3 -I -c "import json; d=json.load(open('/Users/john/Claude/MutationGame/reference/golden_data.json')); print(d['minuscule_representations'][1])"`):
    - `minuscule_representations` is a list of 18 records `{type, node, dimension, weights_dynkin_labels}` in this order: `A1` 1 (2), `A2` 1 (3), `A2` 2 (3), `A3` 2 (6), `A4` 2 (10), `B2` 2 (4), `B3` 3 (8), `B4` 4 (16), `C2` 1 (4), `C3` 1 (6), `D4` 1 (8), `D4` 3 (8), `D4` 4 (8), `D5` 1 (10), `D5` 5 (16), `E6` 1 (27), `E6` 6 (27), `E7` 7 (56); the number in brackets is `dimension`. `node` is a label. `weights_dynkin_labels` is the list of basis vectors in basis order, one integer per node in label order, and is `null` on `E7` 7 only.
    - Example: `{"type": "A2", "node": 1, "dimension": 3, "weights_dynkin_labels": [[1, 0], [0, -1], [-1, 1]]}`. Others: `A2` 2 gives `[[1, -1], [0, 1], [-1, 0]]`; `B2` 2 gives `[[1, -1], [0, 1], [0, -1], [-1, 1]]`; `C2` 1 gives `[[1, 0], [1, -1], [-1, 1], [-1, 0]]`. Note that the first basis vector is not $\omega_i$ in general.
    - Inputs you read but do not cover: `types[T].cartan`, `types[T].minuscule_nodes`, `types[T].fundamental_orbit_sizes` (phases 0, 1, 3).
13. `CONTRACTS.md` 2.1 (`src/rep.ts`: "`SparseMatrix` operations, `minusculeMatrices`, `signedMoves`, `chevalleySerre`, `stringThrough`; phase 7 adds `orbitPlusZeroMatrices`"; `"dependencies": {}`), 2.2 (`SparseMatrix`, `RelationCheck`, `Board`, `AnyBoard`, `Enumeration`), 2.3 (`CAPS.repOrbit: 2000`, `CAPS.matrixGridDim: 27`, `CAPS.mainThreadItems: 2000`), 2.4 phase 5 (your signatures, verbatim) and phases 0 to 3 (what you call), 2.5, 3 (the harness: `covers`, `GOLDEN_KEYS_BY_PHASE[5]`, `boardOf`, `labels`, `intEq`, `matchRecord`), 10.

## 3. Inputs you depend on

All of this must be on `main` (gate G4 green; the roster's dependency is `P4-A1`, although nothing of phase 4 is called) when you start. If any item is missing, stop and report `blocked` for the parts that need it; do not re-implement it.

- From `P0-A2`: `Board`, `AnyBoard`, `Arith`, `SafeInt`, `Big`, `Vec`, `Matrix`, the type `SparseMatrix` and `RelationCheck` in the types module (if they are not yet declared, declare them in `rep.ts` exactly as `CONTRACTS.md` 2.2 writes them and say so in your report); `boardFromName`, `fromAdjacency`, `cartanNumbers`, `toLabels`, `toPositions`, `fire`; `EngineError`, `NeedsTwoWayRoads`, `NotFiniteType`, `EngineOverflow`; `CAPS` with `repOrbit: 2000`; the harness `packages/engine/test/golden/_harness.ts` with `golden`, `TYPE_NAMES`, `boardOf`, `covers`, `GOLDEN_KEYS_BY_PHASE` (whose entry `5` must read `['minuscule_representations']`), `labels`, `intEq`, `matchRecord`; the `covers()` mechanism that writes `test/golden/coverage.json` with `missingByPhase`.
- From `P1-A1`: `orbit(board, seeds, game, cap, maxDepth?)` returning `Enumeration<T[]>` with the truncation rule of 5.5; `minusculeNodes(board)`; `transposeBoard`.
- From `P2-A1`: `guards.ts` with `requireGcm` and `requireFinite` (and the `WeakMap` cache of E-11); `boardFromName('A2~')` and the other affine names for the guard tests.
- From `P3-A1`: `orbitSize(board, a)` and `weylDimension(board, lambda): bigint` (cross-checks, and optionally the cap test of 5.4 below).
- `fast-check` and `vitest` as installed development dependencies; Node 22.12 or later (`node --version`; otherwise stop and report).
- `reference/golden_data.json`, `reference/lie_games.py`, `reference/verify.py` with the SHA-256 values of `CONTRACTS.md` section 9.

## 4. Deliverables

| File | Contents |
|---|---|
| `packages/engine/src/rep.ts` | the sparse operations `spMul`, `spAdd`, `spComm`, `spScale`, `spEq` (plan names) and the key helper; `minusculeMatrices`, `signedMoves`, `chevalleySerre`, `stringThrough` |
| `packages/engine/src/index.ts` | append the exports of `rep.ts` (and the two types if you had to declare them); change nothing else |
| `packages/engine/test/golden/p5-minuscule.test.ts` | `covers('minuscule_representations')`; all 18 records: dimension, `weights_dynkin_labels` in order where present, every relation holds, the identities of the signed move and of the move matrix, the cross-checks against `weylDimension`, `orbitSize` and `minusculeNodes`; node 2 of $D_4$ fails with both sides returned; the $E_7$ 56 under two seconds |
| `packages/engine/test/golden/p5-rep-units.test.ts` | (plan; no `covers()`, with a comment saying the golden key is covered in `p5-minuscule.test.ts`) the sparse operations against hand values; the matrices of $A_1$ and $A_2$ by hand; the relation records of $A_2$; `stringThrough` examples and the string property; the cap; purity |
| `packages/engine/test/golden/p5-guards.test.ts` | (plan; no `covers()`) the behaviour of every phase-5 function on a one-way board and on an affine board (5.6); `RangeError` cases |
| `decisions/P5-A1.md` | the fragment of `COMMON.md` 5.1 with the entries listed in 5.8 below |

## 5. Requirements

### 5.1 Conventions at your boundary

- `SPEC.md` section 2 is the single source of truth. `C[i][j]` is $\langle\alpha_i^\vee,\alpha_j\rangle$. Firing (5.4, oracle `fire`): `a_j <- a_j - C[j][i] * a_i` for all `j`, so firing node `i` subtracts `a_i` times **column** `i` of `C`. A single step down at node `k` subtracts column `k` of `C` (2.18: "In Dynkin labels a single step subtracts or adds column $i$ of $C$"). The moves used in representations are firings $R_k$ on positions (weights), never mutations. The bridge sentence of 2.4(a), "**The number on node $i$ is the amount by which a mutation would lower city $i$.**", belongs to the tools and lessons; you emit no text.
- Vocabulary: in this task "position" means two things. A **position** of the numbers game is a vector of numbers (a weight in Dynkin labels: the elements of `basis`, `mu`, the result of `stringThrough`). A **node position** is an index `0..n-1` (E-7). The arguments `i`, `k` and the fields `RelationCheck.i`, `RelationCheck.j` are node positions. A vector has one entry per node position; on every named finite board the label order equals the position order, so `weights_dynkin_labels` compares with `basis` without conversion, while `node` (a label) is converted with `toPositions`.
- E-7: every function takes node positions and returns node positions. Never add 1 in `src/`. T12 converts to labels for the screen and for the key `q` of 6.6 (`ef:1,2`).
- E-5: pure functions, no hidden state. Do not mutate `board`, `mu`, `basis`, or any `Map` passed in; return new arrays and new `Map`s (also for the `right` side of a relation that equals an input matrix, plan). Where the oracle chooses, you choose the same: the basis order, the matrix entries as row (image) and column (source), the order of the relation loop.
- E-1 and E-4: exact integer arithmetic. Matrix entries are `bigint` (`SparseMatrix = Map<string, bigint>`) on every board, `SafeInt` boards included; convert a board entry with `BigInt(...)` (or `board.arith.toBig`) before multiplying. Basis vectors and string positions are `number[]` as the contract says (see 5.3 and 5.6 for the conversion rule).
- E-9 and `CONTRACTS.md` 2.1: `src/` imports only `src/`; your functions are synchronous and know nothing about workers (T12 decides where `minusculeMatrices` runs). No `node:*`, no `console.log`, no `Math.random`, no `Date` in `src/`.
- E-10 and 5.6: errors are the classes of `errors.ts`; reaching the cap of `minusculeMatrices` is reported by returning `null`, never thrown.

### 5.2 The sparse operations

`SparseMatrix = Map<string, bigint>`, key `"row,column"` (`CONTRACTS.md` 2.2 and `SPEC.md` 5.2). Rows and columns are basis indices from 0. The key is the two decimal integers joined by one comma, no spaces, no leading zeros (`"0,2"`, `"12,3"`). Provide a helper `spKey(row: number, column: number): string` (plan) and use it everywhere, so that T12 and phase 7 build keys the same way.

Invariant (oracle): **no stored entry is zero.** Every operation below drops zero entries from its result, exactly as the oracle's final `{k: v for k, v in out.items() if v != 0}`. The empty `Map` is the zero matrix.

Signatures (plan names; `P5-A2` and the phase 7 agent will import them):

```ts
export function spKey(row: number, column: number): string;
export function spMul(X: SparseMatrix, Y: SparseMatrix): SparseMatrix;                 // (XY)[r][c] = sum_k X[r][k] Y[k][c]
export function spAdd(X: SparseMatrix, Y: SparseMatrix, cy?: bigint): SparseMatrix;    // X + cy*Y, cy defaults to 1n
export function spComm(X: SparseMatrix, Y: SparseMatrix): SparseMatrix;                // XY - YX
export function spScale(X: SparseMatrix, c: bigint): SparseMatrix;                     // cX; the empty Map when c is 0n
export function spEq(X: SparseMatrix, Y: SparseMatrix): boolean;                       // the same nonzero entries
```

- `spMul` ports `sp_mul` (lines 811 to 819): group the entries of `Y` by row `k`; for each entry `(r, k)` of `X` and each `(c, w)` in row `k` of `Y`, add `v * w` to `(r, c)`; drop zeros.
- `spAdd` ports `sp_add(Xm, Ym, cy=1)` (822 to 826): start from a copy of `X`, add `cy * v` for each entry of `Y`, drop zeros.
- `spComm` ports `sp_comm` (829 to 830): `spAdd(spMul(X, Y), spMul(Y, X), -1n)`.
- `spScale` ports `sp_scale` (833 to 834).
- `spEq` is Python's `dict ==` on zero-free dictionaries: the same key set and equal values, independent of insertion order. (plan) Treat an explicit `0n` entry in an input as absent, so that a `Map` built by a caller without the invariant still compares correctly. Never compare two `Map`s with `===`, with `toEqual` on insertion-ordered dumps, or with `JSON.stringify` (which throws on `bigint`).
- (plan) Parse a key once per entry (split on the comma, `Number(...)`), not inside the innermost loop.

### 5.3 `minusculeMatrices(board, i, cap?)`

Contract (`CONTRACTS.md` 2.4 phase 5): `minusculeMatrices(board, i: number, cap?: number): { basis: number[][]; E: SparseMatrix[]; F: SparseMatrix[]; H: SparseMatrix[]; moves: SparseMatrix[] } | null`. `SPEC.md` 5.4: "basis, $E_k$, $F_k$, $H_k$ and the move matrices, as sparse integer matrices; `null` when the orbit of $\omega_i$ has more than `cap` positions (default 2000)". Oracle `minuscule_matrices(C, i)`, lines 856 to 877, which returns `(orb, E, F, H, S)`; your `moves` is the oracle's `S`.

- Guard (5.6, last row of the second table: "representation ... functions | throw `NeedsTwoWayRoads` | throw `NotFiniteType`"): through `guards.ts` (`requireGcm`, then `requireFinite`), as every earlier finite-theory function does. `RangeError` (plan) when `i` is not an integer in `0..n-1` or `cap` is not a positive integer.
- `cap` defaults to `CAPS.repOrbit` (2000; 5.6 "Orbit for which T12 builds matrices | 2000 positions | explanation only"). Return `null` exactly when the orbit of $\omega_i$ has more than `cap` positions; an orbit of exactly `cap` positions is built. Implementation (plan): enumerate with `orbit(board, [omega_i], 'firing', cap)` from phase 1 and return `null` when the result is `truncated` (5.5: "The cap acts when the search is about to add one position more than the cap: it stops at once with `truncated` true and exactly `cap` items.", so an orbit of exactly `cap` positions is not truncated). You may first ask `orbitSize(board, omega_i)` (exact, no enumeration) and return `null` without enumerating when it exceeds `cap`; if you do, keep the enumeration check as well. Either way the oracle has no cap, so the cap is the engine's own rule.
- $\omega_i$ is the unit vector at node position `i` (oracle `unit(n, i)`), in the board's arithmetic.
- **Basis** (E-5; 4 T12: "The basis is the orbit of $\omega_i$ in decreasing lexicographic order of the positions, as in the oracle"; oracle `sorted(orbit(...), reverse=True)`): sort a copy of the orbit items by numeric lexicographic order on the integer entries, largest first. Python compares tuples entry by entry as integers, so `(1, 0) > (0, -1) > (-1, 1)`. The first basis vector is therefore **not** $\omega_i$ in general (on `B2` node 2 it is `(1, -1)`, on `E7` node 7 it is `(1, 1, 0, -1, 0, 0, 0)` and the last is `(-1, -1, 0, 1, 0, 0, 0)`). Index the basis with a `Map` from the vector's text (entries joined by commas) to its index.
- For each basis vector `a` (in basis order) and each node position `k` from 0 to n-1 (oracle loop order), with `b = fire(board, a, k)`:
  - `moves[k]` gets entry `(idx[b], idx[a]) = 1n` for **every** `a` (the firing move itself as a permutation matrix; when `a_k = 0` this is the diagonal entry `(idx[a], idx[a])`);
  - if `a_k == 1`: `F[k]` gets `(idx[b], idx[a]) = 1n` (2.18: "$F_k$ sends $\mu$ to the fired position $R_k\mu$ when $\mu_k=1$, and to 0 otherwise");
  - else if `a_k == -1`: `E[k]` gets `(idx[b], idx[a]) = 1n` (2.18: "$E_k$ sends $\mu$ to $R_k\mu$ when $\mu_k=-1$, and to 0 otherwise");
  - if `a_k != 0`: `H[k]` gets `(idx[a], idx[a]) = BigInt(a_k)` (2.18: "$H_k$ multiplies by the number $\mu_k$"); zero diagonal entries are not stored.
- The row of an entry is the **image** and the column is the **source** (`(idx[b], idx[a])`), so the matrices act on column vectors and `spMul(X, Y)` is "first `Y`, then `X`". Exchanging the two silently transposes every matrix and exchanges the roles of `E` and `F`.
- Entries with `|a_k| >= 2` (only on a node that is not minuscule) contribute to `moves[k]` and to `H[k]` (value `2n` or `-2n`) and to neither `E[k]` nor `F[k]`. Do not "repair" this: the failure is what T12 shows (5.5 below).
- `moves[k]` is computed from `fire`, as the oracle does, not assembled as `E[k] + F[k] + P_k^0`. The roster and 2.18 describe it as "the permutation matrix $E_k+F_k+P_k^0$"; that identity holds on the 18 minuscule records (2.18 [V]; tested in 6) and fails on node 2 of $D_4$, where the oracle's `S` is still the firing permutation. Where the roster's wording and the oracle differ, the oracle wins (plan: an extension of `COMMON.md` 2, which states only that the oracle wins over a sentence of `SPEC.md`; it agrees with 2.18, which states $E_k+F_k+P_k^0$ only for minuscule nodes).
- `basis` is `number[][]` (contract). On a `Board<number>` (every named finite board, `SafeInt`) use the entries as they are. (plan) On a finite `Board<bigint>` (possible for a finite board built by hand), convert each entry with `Number(...)` after checking `Number.isSafeInteger`, and throw `EngineOverflow` otherwise (it cannot happen on a finite orbit within the cap; the check keeps the contract honest).
- Works for **any** node of a finite board, minuscule or not (4 T12: "For any node $i$ of a named board; the construction succeeds exactly when the node is minuscule, and the tool shows the failure otherwise"). Do not throw or return `null` on a non-minuscule node; node 2 of $D_4$ (orbit 24, at most 2000) returns full matrices.
- Sizes to expect (golden `types[T].fundamental_orbit_sizes`): `D4` `[8, 24, 8, 8]`; `E7` `[126, 576, 2016, 10080, 4032, 756, 56]` (so with the default cap, `E7` nodes 3, 4 and 5, positions 2, 3 and 4, give `null`; 2016 is just above the cap); `E8` `[2160, 17280, 69120, 483840, 241920, 60480, 6720, 240]` (only node 8, position 7, is built with the default cap).

### 5.4 `signedMoves(basis, E, F)`

Contract: `signedMoves(basis, E, F): SparseMatrix[]`. `SPEC.md` 5.4: "the matrices $E_k-F_k+P_k^0$". Oracle `signed_moves(orb, E, F)`, lines 1751 to 1758: for each `k` from 0 to `E.length - 1`, `P0 = {(r, r): 1 for r in range(len(orb)) if orb[r][k] == 0}` and the result is `sp_add(sp_add(E[k], F[k], -1), P0)`, that is `spAdd(spAdd(E[k], F[k], -1n), P0)` in this order.

- 2.18: "The group element $\exp(E_k)\exp(-F_k)\exp(E_k)$ equals $E_k-F_k+P_k^0$: the same matrix with one sign changed in each pair, and its square is $(-1)^{H_k}$ [V]. So in a minuscule representation a game move is a Lie group element with its signs removed." Your test reproduces both identities (verify.py lines 1250 to 1257): `E[k]^2` and `F[k]^2` are the empty matrix, so $\exp(E)=1+E$ and $\exp(-F)=1-F$; `spMul(spMul(1+E, 1-F), 1+E)` equals `signedMoves(...)[k]`; its square equals the diagonal matrix with `-1n` where `basis[r][k] != 0` and `1n` elsewhere.
- No board argument, so no guard (plan reading of 5.6: the function works as defined on whatever matrices it is given). `RangeError` (plan) when `E.length !== F.length` or a basis vector is shorter than `E.length`.
- `P_k^0` is read from `basis[r][k] === 0`; with `number` entries compare with `0`, never with `0n`.

### 5.5 `chevalleySerre(board, E, F, H)`

Contract: `chevalleySerre(board, E, F, H): RelationCheck[]`, with (verbatim from `CONTRACTS.md` 2.2 and `SPEC.md` 5.2):

```ts
type SparseMatrix = Map<string, bigint>;   // key "row,column"
interface RelationCheck { relation: 'hh' | 'he' | 'hf' | 'ef' | 'serre-e' | 'serre-f';
                          i: number; j: number; holds: boolean;
                          left: SparseMatrix; right: SparseMatrix; }
```

`SPEC.md` 5.4: "a `RelationCheck` for every relation, with both sides". Oracle `chevalley_serre_ok(C, E, F, H)`, lines 837 to 853, which returns one boolean; you return one record per relation instance instead, so that T12 can display "the matrix on each side of the relation and whether they are equal" (4 T12) and a failing case can be shown, never thrown (roster trap).

The relations (2.18), with `C` the board's Cartan matrix in node positions and every `C[i][j]` converted to `bigint`:

| `relation` | for | `left` | `right` |
|---|---|---|---|
| `'hh'` | every `i`, `j` (including `i == j`) | `spComm(H[i], H[j])` | the empty `Map` |
| `'he'` | every `i`, `j` | `spComm(H[i], E[j])` | `spScale(E[j], C[i][j])` |
| `'hf'` | every `i`, `j` | `spComm(H[i], F[j])` | `spScale(F[j], -C[i][j])` |
| `'ef'` | every `i`, `j` | `spComm(E[i], F[j])` | a copy of `H[i]` when `i == j`, else the empty `Map` |
| `'serre-e'` | `i != j` | $\operatorname{ad}(E_i)^{1-C_{ij}}E_j$: start `x = E[j]`, then `1 - C[i][j]` times `x = spComm(E[i], x)` | the empty `Map` |
| `'serre-f'` | `i != j` | the same with `F`: `y = F[j]`, then `1 - C[i][j]` times `y = spComm(F[i], y)` | the empty `Map` |

- `holds` is `spEq(left, right)`. `i` and `j` are node positions.
- Note the index placement, which is the oracle's and 2.18's: $[H_i,E_j]=C_{ij}E_j$ uses `C[i][j]` with `i` the index of `H`, and the Serre exponent is `1 - C[i][j]` with `i` the index of the operator applied repeatedly. On `B2`, `C2`, `G2`, `F4` and `B`, `C` boards `C` is not symmetric and the transposed reading fails the golden test.
- The oracle combines the two Serre relations in one boolean; you return them as two records, `'serre-e'` before `'serre-f'`.
- Order of the records (plan; the oracle's loop order): `i` from 0 to n-1, then `j` from 0 to n-1, and within each pair `hh`, `he`, `hf`, `ef`, then (when `i != j`) `serre-e`, `serre-f`. The list therefore has $4n^2+2n(n-1)=6n^2-2n$ records: 20 on `A2`, 88 on `D4`, 280 on `E7`.
- The oracle's `chevalley_serre_ok(...)` is true exactly when every record has `holds: true`.
- Guard (5.6): `requireGcm`, `requireFinite`, as in 5.3. `RangeError` (plan) when `E`, `F` or `H` does not have `n` entries.
- `chevalleySerre` is general: it does not assume entries in `{0, 1}` or any particular basis, because the phase 7 recipe "one zero weight" (2.18) has entries 2 and must be checked by this same function.
- What the oracle gives on node 2 of $D_4$ (computed for this file with `reference/lie_games.py`; use it as a hand check, not a golden value): of the 88 records exactly 10 fail, all `'ef'`, at the position pairs `(0,0), (0,1), (1,0), (1,1), (1,2), (1,3), (2,1), (2,2), (3,1), (3,3)`; every `hh`, `he`, `hf` and Serre record holds. 8 of its 24 basis vectors contain an entry `2` or `-2` (the first is `(2, -1, 0, 0)`). The move matrices of that node are not `E + F + P^0`.
- On `A2` node 1 (position 0): `spComm(E[0], F[0])` is `{"0,0": 1n, "2,2": -1n}`, which equals `H[0]`, and `spComm(E[0], F[1])` is empty: the two clicks of M8 beat 3 ("The reader checks $[E_1,F_1]=H_1$ and $[E_1,F_2]=0$ by clicking").

### 5.6 `stringThrough(board, mu, i)`

Contract: `stringThrough(board, mu: readonly number[], i: number): number[][]`. `SPEC.md` 5.4: "the positions $\mu,\mu-\alpha_i,\dots,\mu-\mu_i\alpha_i$". Oracle `string_through(C, mu, i)`, lines 1744 to 1748: `assert mu[i] >= 0`, then `[tuple(mu[j] - k * C[j][i] for j in range(len(C))) for k in range(mu[i] + 1)]`.

- Order: `k = 0, 1, ..., mu[i]`; the first element is `mu` itself (a copy), the last is `fire(board, mu, i)`; the result has `mu[i] + 1` elements. Subtracting $\alpha_i$ subtracts **column** `i` of `C` (`C[j][i]` for each `j`), as 4 T12 says: "subtracting column $i$ of $C$ each time".
- `mu[i] == 0` gives the one-element list `[mu]`.
- `mu` need not be in any orbit and need not be dominant (4 T12: "The viewer accepts any position, so it can show a line with three or more positions, which a minuscule orbit never has"). Only `mu[i] >= 0` is required.
- `mu[i] < 0`: the oracle asserts. (plan) Throw `RangeError` with a message naming the node position and the value; T12 offers the string only for $\mu_i\ge0$ ("for a chosen position $\mu$ and node $i$ with $\mu_i\ge0$"). `RangeError` also when `mu.length !== n`, when an entry is not a safe integer, or when `i` is out of range.
- Arithmetic: `number`, each result checked with `Number.isSafeInteger`; `EngineOverflow` otherwise (plan, the `SafeInt` rule of E-2).
- Guard (5.6, "representation ... functions"): `requireGcm`, `requireFinite`.
- Facts to test (verify.py lines 1263 to 1272 and M8's figure table): on `A2` at node position 0, `stringThrough(A2, [2, 0], 0)` is `[[2, 0], [0, 1], [-2, 2]]` and `fire(A2, [2, 0], 0)` is `[-2, 2]`; `stringThrough(A2, [1, 0], 0)` is `[[1, 0], [-1, 1]]` (two positions); `stringThrough(A2, [0, 1], 0)` is `[[0, 1]]`. Others computed with the oracle: `A3`, `[2, 1, 0]`, position 0 gives `[[2, 1, 0], [0, 2, 0], [-2, 3, 0]]`; `B2`, `[0, 2]`, position 1 gives `[[0, 2], [1, 0], [2, -2]]`; `G2`, `[0, 3]`, position 1 gives `[[0, 3], [3, 1], [6, -1], [9, -3]]`. Property (verify.py, on `A3`, `B3`, `G2`, `D4`, `mu` with entries in `[0, 3]`): the length is `mu[i] + 1`, the last element is `fire(mu, i)`, and firing node `i` maps element `k` to element `length - 1 - k` ("firing node $i$ turns it end over end").
- No cap on the length (the specification gives none; plan). T12 must bound what a reader can type; that is `P5-A2`'s concern and is listed in your report under `requests`.

### 5.7 Exports

Append to `packages/engine/src/index.ts`: `spKey`, `spMul`, `spAdd`, `spComm`, `spScale`, `spEq`, `minusculeMatrices`, `signedMoves`, `chevalleySerre`, `stringThrough`, and the types `SparseMatrix`, `RelationCheck` if they are declared in `rep.ts`. Change nothing else in `index.ts`.

### 5.8 Decisions fragment

`decisions/P5-A1.md`, one dated entry each in the form of `COMMON.md` 5.1: the names and semantics of the sparse helpers and the key format (plan); `spEq` ignoring explicit zero entries (plan); the order of the `RelationCheck` list and the split of the oracle's Serre boolean into `serre-e` and `serre-f`; `moves` computed from `fire` rather than as `E + F + P^0` (oracle over roster wording); how the cap of `minusculeMatrices` is decided (enumeration with `truncated`, and `orbitSize` if used); the guards on `chevalleySerre` and `stringThrough` and their absence on `signedMoves` (reading of 5.6); every `RangeError` you added; no cap on `stringThrough`; the `bigint` to `number` rule for `basis`; the wall time of the `E7` 56; the versions you observed (`node`, `typescript`, `vitest`, `fast-check`). Add no dependency.

## 6. Acceptance

Every line must have a passing automated test. Gate tags: "G5" is the automatic part of gate G5 of `SPEC.md` 9.1 ("golden tests through phase 5; every relation checks in the tool"); "Every merge" applies the 7.7 rows "Engine, golden" and "Engine, properties" ("required for every merge"); extending that tag to the engine unit tests of this file, which 7.7 does not name, is (plan).

- [ ] `SPEC.md` 5.7 phase 5, `minuscule_representations`: for each of the 18 records, matched with `matchRecord` by `type` and `node` (rule 5), `minusculeMatrices(boardOf(type), toPositions(board, [node])[0])` is not `null` and `basis.length` equals `dimension` (rule 1, `intEq`). `test/golden/p5-minuscule.test.ts > dimension equals the golden value` (18 cases). G5.
- [ ] `minuscule_representations[*].weights_dynkin_labels`: for the 17 records where it is not `null`, `basis` equals it in order (rules 5 and 7; `E7` 7 is skipped because the field is `null`). `p5-minuscule.test.ts > basis equals weights_dynkin_labels in order`. G5.
- [ ] `SPEC.md` 2.18 [V] and 4 T12 acceptance "every relation checks for every listed representation": `chevalleySerre(board, E, F, H)` has $6n^2-2n$ records and every one has `holds: true`, for all 18. `p5-minuscule.test.ts > every Chevalley-Serre relation holds`. G5.
- [ ] `SPEC.md` 2.18 [V], 4 T12 acceptance "choosing the non-minuscule node 2 of $D_4$ shows a failing relation and the explanation that some number in the orbit is 2" (engine part) and the roster trap: `minusculeMatrices(D4, 1)` is not `null` and has 24 basis vectors; some basis vector contains `2`; `chevalleySerre` returns 88 records, some with `holds: false`, each failing record with `spEq(left, right)` false and both sides present; (hand check from the oracle) exactly the 10 `'ef'` records of 5.5 fail. `p5-minuscule.test.ts > D4 node 2 fails and returns both sides`. G5.
- [ ] `SPEC.md` 2.18 [V] (verify.py 1250 to 1257): for all 18 records and every `k`, `spMul(E[k], E[k])` and `spMul(F[k], F[k])` are empty; `(1+E)(1-F)(1+E)` equals `signedMoves(basis, E, F)[k]`; its square is $(-1)^{H_k}$ as a diagonal matrix. `p5-minuscule.test.ts > signed move is exp(E)exp(-F)exp(E) with square (-1)^H`. G5.
- [ ] `SPEC.md` 2.18 [V] "The firing move itself is the permutation matrix $E_k+F_k+P_k^0$": for all 18 records and every `k`, `moves[k]` equals `E[k] + F[k] + P_k^0`, and `moves[k]` sends each basis vector to `fire(basis[c], k)`; on `D4` node 2 it does not equal `E + F + P^0` for some `k` (plan, so the test fails if `moves` is assembled from `E` and `F`). `p5-minuscule.test.ts > moves are the firing permutations`. G5.
- [ ] Cross-checks (verify.py 1244 to 1245; plan as tests): `dimension` equals `weylDimension(board, omega_i)` (compare as `bigint`) and `orbitSize(board, omega_i)`, and `node` is in `minusculeNodes(board)` converted to labels (F11), for all 18; node 2 of `D4` is not in `minusculeNodes`. `p5-minuscule.test.ts > dimension agrees with Weyl and orbitSize; the nodes are minuscule`. G5.
- [ ] Roster acceptance (plan): "the 56 of E7 builds in under two seconds": wall time of `minusculeMatrices(E7, 6)` measured with `performance.now()` is below 2000 ms (the oracle takes a few milliseconds; report the measured time). `p5-minuscule.test.ts > E7 56 builds in under two seconds`. G5.
- [ ] `SPEC.md` 5.4 cap: `minusculeMatrices` returns `null` when the orbit has more than `cap` positions: `minusculeMatrices(E7, 6, 50)` is `null`; `minusculeMatrices(E7, 6, 56)` is not `null` (exactly the cap); with the default cap `E8` position 0 (2160) and `E7` position 2 (2016) are `null` and `E8` position 7 (240) is not. `p5-rep-units.test.ts > cap`. Every merge.
- [ ] `SPEC.md` 2.18 matrices by hand: the expected `basis` of `A1` node 1 and of `A2` node 1 is read in the test from the harness, `matchRecord(golden.minuscule_representations, { type, node }).weights_dynkin_labels` (never typed into source, `COMMON.md` 4.4), and `basis` must equal it; the entries below index rows and columns in that basis order and are not golden fields. `A1` node 1: `E[0] = {"0,1": 1n}`, `F[0] = {"1,0": 1n}`, `H[0] = {"0,0": 1n, "1,1": -1n}`; `A2` node 1: `E = [{"0,2"}, {"2,1"}]`, `F = [{"2,0"}, {"1,2"}]` (all values `1n`), `H = [{"0,0": 1n, "2,2": -1n}, {"1,1": -1n, "2,2": 1n}]`, `moves[0] = {"2,0", "1,1", "0,2"}`, `signedMoves[0] = {"0,2": 1n, "2,0": -1n, "1,1": 1n}`; `[E_1,F_1]=H_1` and `[E_1,F_2]=0` as records of `chevalleySerre` (M8 beat 3). `p5-rep-units.test.ts > A1 and A2 by hand`. Every merge.
- [ ] Sparse operations (plan): `spMul`, `spAdd` (with `cy`), `spComm`, `spScale` (with `0n`), `spEq` on hand matrices; results never contain a zero entry; `spEq` is independent of insertion order and ignores explicit zeros; inputs are unchanged. `p5-rep-units.test.ts > sparse operations`. Every merge.
- [ ] `SPEC.md` 5.4 and 4 T12 `stringThrough`: the examples of 5.6 above, and the property (length `mu[i] + 1`, last is `fire`, firing reverses the string) with `fast-check` on `A3`, `B3`, `G2`, `D4`, entries in `[0, 3]`, fixed seed recorded in the file. `p5-rep-units.test.ts > stringThrough examples`, `> stringThrough property`. Every merge.
- [ ] `SPEC.md` 5.6 guards: on the one-way board `fromAdjacency([[0, 1], [0, 0]])`, `minusculeMatrices`, `chevalleySerre` and `stringThrough` throw `NeedsTwoWayRoads`; on `boardFromName('A2~')` they throw `NotFiniteType`; `signedMoves` works on the matrices of `A2` without a board; the `RangeError` cases of 5.3 to 5.6 (plan). `p5-guards.test.ts > one-way board`, `> affine board`, `> argument errors`. Every merge.
- [ ] E-5 purity: `board.cartan`, `mu`, `basis` and the input `Map`s are deep-equal before and after every call; two calls give equal results. `p5-rep-units.test.ts > purity`. Every merge.
- [ ] `CONTRACTS.md` 3: `GOLDEN_KEYS_BY_PHASE[5]` appears in `coverage.json` after the suite runs: `missingByPhase["5"]` is `[]`. Command `node -e "const c=require('/abs/path/packages/engine/test/golden/coverage.json'); console.log(c.missingByPhase['5'])"` pasted in `commandsRun`. G5.
- [ ] `CONTRACTS.md` 2.4 phase 5: every signature as written, type-checked. `npx tsc --noEmit -p packages/engine` exit 0 in `commandsRun`. Every merge.
- [ ] `CONTRACTS.md` 2.1: `"dependencies": {}` unchanged; `rep.ts` imports only from `src/`. `grep -n "from '" packages/engine/src/rep.ts` pasted in `commandsRun`. Every merge.
- [ ] `COMMON.md` 4.4: no `it.only`, `test.skip`, `xit`, commented-out assertion or self-comparison; no golden value typed into source (every value that is a field of `golden_data.json`, including the `A1` and `A2` bases of the hand test, is read through the harness; the hand-typed `E`, `F`, `H`, `moves`, `signedMoves`, `stringThrough` and `D4` node 2 values are not golden fields). `grep -rnE "\.only|\.skip|xit\(" packages/engine/test` with empty output in `commandsRun`. Every merge.
- [ ] `CONTRACTS.md` 9 and the G5 item "reference hashes unchanged": `shasum -a 256` of the three reference files equals the recorded values. In `commandsRun`. G5 (`GATE` runs it again).

## 7. Files

- **You own** (the roster's list, exactly):
  - `packages/engine/src/rep.ts, index.ts (exports)`
  - `packages/engine/test/golden/p5-*.test.ts`
  - `decisions/P5-A1.md`
- **Also yours**: the generated, uncommitted `packages/engine/test/golden/coverage.json` your run writes.
- **You may edit with the stated protocol**: `packages/engine/src/index.ts` (append exports only).
- **You must not touch**: everything else; in particular `reference/` (never edit `golden_data.json`, `lie_games.py` or `verify.py`), `DECISIONS.md`, root `package.json` and the lockfile, `packages/engine/package.json` and `tsconfig.json`, the engine's Vitest configuration, `packages/engine/test/golden/_harness.ts` (the comparison rules are never changed; ask `MERGE` if a helper is missing), every other `src/` file (`moves.ts`, `search.ts`, `finite.ts`, `guards.ts`, `weyl.ts` and the rest belong to earlier phases; a bug there goes into `requests` with a failing test), `packages/engine/test/properties/` (no numbered property of 5.7 belongs to phase 5), the site (`MatrixView.svelte` and T12 are `P5-A2`'s), `content/unverified.json`.

## 8. Order of work

1. Pre-flight: `node --version` (22.12 or later); `git -C <worktree> rev-parse --show-toplevel` and `git -C <worktree> branch --show-current` (expect `agent/P5-A1`); `npm ci --prefer-offline` at the root if `node_modules` is absent; `shasum -a 256` of the three reference files against `CONTRACTS.md` 9 (stop and report `blocked` on a difference); confirm the inputs of section 3 exist (`orbit`, `fire`, `orbitSize`, `weylDimension`, `minusculeNodes`, the guards, `GOLDEN_KEYS_BY_PHASE[5]`).
2. `p5-rep-units.test.ts`, the sparse part (red); then the sparse operations in `rep.ts`; green. Commit: `P5-A1: sparse matrix operations`.
3. `p5-minuscule.test.ts` and the `A1`, `A2` hand cases of `p5-rep-units.test.ts` (red); then `minusculeMatrices`, `signedMoves`, `chevalleySerre`; green on all 18 records and on `D4` node 2. Export from `index.ts`. Commit: `P5-A1: minuscule matrices, signed moves, Chevalley-Serre records`. This is the first usable increment: `P5-A2` needs exactly these.
4. The `stringThrough` tests (red), then `stringThrough`; green. Export. Commit: `P5-A1: stringThrough`.
5. `p5-guards.test.ts` and the cap and purity tests; fix what they find. `npx tsc --noEmit -p packages/engine`; `npm test -w packages/engine`; inspect `coverage.json` (`missingByPhase["5"]` empty); the grep checks of section 6. Commit: `P5-A1: guards, caps, purity`.
6. `decisions/P5-A1.md`; the report of section 10. Do not run the browser suite, `npm run size` or `npm run lab`.

If you must stop early, say exactly which functions exist and pass their tests, in the order above.

## 9. Traps

1. (roster) "For a node that is not minuscule the recipe fails (D4 omega_2); the tool must show the failure, so chevalleySerre returns both sides rather than throwing." `minusculeMatrices` must also build that node's matrices (orbit 24) rather than refuse it; only the cap returns `null`.
2. (roster) "The basis order is the oracle's: decreasing lexicographic order of the positions (E-5)." Sort numerically, entry by entry, largest first. `Array.prototype.sort` without a comparator compares the arrays as strings (`"-1,0"` sorts before `"-2,0"` although $-2<-1$, and `"10"` before `"2"`), which is not the oracle's order; write a numeric comparator. An increasing order conjugates every matrix and still passes the relation test, and `weights_dynkin_labels` catches it only up to dimension 27, so the order test on 17 records is essential.
3. (roster) "Moves in the representation use the firing R_k on positions (weights), not mutations." Use `fire` (column `k` of `C`), never `mutate` (row `k`). On a symmetric board the two give different vectors anyway, and on `B`, `C`, `F`, `G` the transposition shows up as wrong orbits.
4. The first basis vector is not $\omega_i$ (`A2` node 2 starts with `(1, -1)`, `B2` node 2 with `(1, -1)`, `E7` node 7 with `(1, 1, 0, -1, 0, 0, 0)`). Do not put the highest weight first "because it is natural"; T12 may highlight it, but the basis is the sorted orbit.
5. Row is image, column is source: the oracle writes `F[k][(idx[b], idx[a])]`. Swapping the key transposes every matrix; in this 0/1 basis the transpose of `E[k]` is `F[k]`, so the swap exchanges `E` and `F`, `[E_i,F_i]` becomes $-H_i$ and the `ef` records fail. The hand matrices of `A1` and `A2` in section 6 say at once which mistake was made.
6. `E[k]` is the step **up** and is defined where $\mu_k=-1$; `F[k]` is the step **down** where $\mu_k=1$ (2.18). Firing at $\mu_k=1$ subtracts column `k`, which is a step down. Exchanging them makes `[E_i,F_i]` equal $-H_i$ and the `ef` records fail.
7. `moves` is the oracle's `S`, built from `fire` for every basis vector, including the diagonal entries where `a_k = 0`. It equals `E + F + P^0` only on minuscule nodes. The roster deliverable phrase "the move matrices E_k + F_k + P_k^0" describes the minuscule case.
8. `H[k]` stores only nonzero diagonal entries. Storing `0n` on the diagonal breaks `spEq` against oracle-style results unless `spEq` ignores zeros, and makes `hh` comparisons depend on representation; keep the zero-free invariant everywhere and make `spEq` robust anyway.
9. `C[i][j]` against `C[j][i]`: $[H_i,E_j]=C_{ij}E_j$ and the Serre exponent $1-C_{ij}$ both read row `i`, column `j`. On `B2` (`[[2, -1], [-2, 2]]`) the Serre exponent for `(i, j) = (1, 0)` is 3 and for `(0, 1)` is 2. A transposed reading passes on simply laced boards and fails on `B2`, `B3`, `B4`, `C2`, `C3`.
10. The Serre left side starts from `E[j]` and applies `ad(E[i])` exactly `1 - C[i][j]` times; for unjoined nodes that is once (`[E_i,E_j] = 0`). An off-by-one (starting from `spComm(E[i], E[j])` and then looping `1 - C[i][j]` times) gives one application too many, which is still zero on a correct representation and can hide an error that the right count would show.
11. `B2` and `C2` are both in the golden list as separate types (`B2` node 2, `C2` node 1), with different matrices (`types.B2.cartan` is `[[2, -1], [-2, 2]]`, `types.C2.cartan` is `[[2, -2], [-1, 2]]`). Use `boardOf(type)` with the stored name; do not rename `C2` to `B2` (that rule is for computed names in `identify`).
12. `node` in the golden record is a label; convert with `toPositions(board, [node])[0]`. `RelationCheck.i` and `.j` are positions. The 18 records are all on finite boards whose labels are `1..n`, so a stray `+ 1` in `src/` would not be caught by the golden test; keep `src/` free of label arithmetic.
13. `bigint` and `number` do not mix: `BigInt(C[i][j])` before `spScale`, `BigInt(a_k)` for `H`, `1n` for entries, `-1n` for `cy`. `weylDimension` returns `bigint`; compare with `BigInt(dimension)` or through `intEq`. `JSON.stringify` throws on `bigint`, so print sparse matrices in failure messages by converting values with `String(...)`.
14. Equality of `Map`s: Vitest's `toEqual` compares `Map`s by entries but a test must not rely on insertion order or on the absence of zero entries; use `spEq` (and, in the hand tests, a helper that turns a `Map` into a sorted list of `[key, String(value)]` pairs for readable failures, plan).
15. The cap is on positions in the orbit, not on the dimension of a grid (27 is T12's grid limit, `CAPS.matrixGridDim`, not yours). `null` means "more than `cap`"; exactly `cap` builds. Do not read the 2000 of E-9 as permission to throw.
16. E-9 lists `minusculeMatrices` as an enumeration: T12 decides from `orbitSize` whether to call it in the worker. Your function stays synchronous and must not import anything from the site.
17. `stringThrough` subtracts column `i` (`C[j][i]`), not row `i`; on `G2`, `[0, 3]` at position 1 gives steps of `(3, -2)`, while the row would give `(1, -2)`. The string ends at `fire(mu, i)`, which is a good self-check.
18. Vitest 5 (`COMMON.md` 3) and fast-check 4 (`SPEC.md` 7.2: `fast-check` 4.10.2) postdate most training data: read the installed type definitions for `fc.assert` options (`seed`, `numRuns`), `fc.constantFrom`, `fc.integer({ min, max })`, and the per-test timeout argument of `it`, before writing them. Use `performance.now()` for the timing test and a generous per-test timeout, so that a slow machine fails on the 2000 ms assertion and not on the runner's default timeout.
19. Em-dashes are forbidden in everything you write, comments and messages included (`COMMON.md` 4.4).

## 10. Report

The JSON of `COMMON.md` 5.2, with `"agent": "P5-A1"`, `"branch": "agent/P5-A1"`, the worktree path printed by `git rev-parse --show-toplevel`, every commit, every file changed, and in `commandsRun` at least: `node --version`, `shasum -a 256` of the three reference files, `npx tsc --noEmit -p packages/engine`, `npm test -w packages/engine` (with the pass count), the `coverage.json` check and the grep checks of section 6. `acceptance` lists every line of section 6 with its test. Add these fields:

- `"coverageKeys"`: the `keys` array of `coverage.json` after your run, which must include `minuscule_representations`.
- `"missingByPhase5"`: `missingByPhase["5"]` from the same file (expected `[]`).
- `"goldenRows"`: `{ "minuscule_representations": 18, "withWeights": 17 }` as counted by your tests.
- `"relationCounts"`: the number of `RelationCheck` records for `A2` node 1, `D4` node 2 and `E7` node 7 (expected 20, 88, 280), and the list of failing records on `D4` node 2 as `relation:i,j` in positions.
- `"timings"`: the wall times of `minusculeMatrices` and `chevalleySerre` on `E7` node 7.
- `"referenceHashes"`: the three SHA-256 values you computed.
- `"versions"`: `node`, `typescript`, `vitest`, `fast-check` as installed.
- `"publicApi"`: the names you added to `index.ts`.

`requests` must name: to `P5-A2`, that `stringThrough` has no length cap and that a typed $\mu_i$ must be bounded by T12; any change needed in `_harness.ts`, the Vitest configuration, `package.json` or `tsconfig.json` (to `MERGE`; you edit none of them); any behaviour of `orbit`, `orbitSize`, `weylDimension` or the guards that you had to work around (to the owning agent, with the test that shows it). `deviations` names anything in which you departed from `CONTRACTS.md` 2.2 to 2.5, with the reason.
