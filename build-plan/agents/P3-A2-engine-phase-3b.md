# P3-A2: Engine phase 3B: heaps, complete games, symbolic play, Cholesky basis, benchmark

Phase 3, stage 3.1. Size M. Runs in: a worktree on branch `agent/P3-A2`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies. Where this file says (plan), the rule is the build plan's addition and not the specification's; where it says [D], `SPEC.md` marks the point as a design decision. Nothing you compute is marked [U]: every value you reproduce was computed by the oracle and is [V], and the [S2] and [U] labels near your sections (in F3, "the theorem is attributed to Mozes and Eriksson [S2]"; in F14, "the item number there was not confirmed [U]"), like F12's unlabelled remark that Stanley's theorem is cited "[Sta84], not read", concern the wording of lessons written by other agents, not your code.

## 1. Objective

When you are done, `packages/engine` holds the six phase 3 functions that are not in `weyl.ts`: `heap`, `heapKey`, `commutationClassSize`, `allCompleteGames` and `symbolicPlay` in `src/heaps.ts`, and `choleskyBasis` in `src/geometry.ts`, each ported from `reference/lie_games.py` with the oracle's choices and exported from `src/index.ts`. Their golden tests (`heaps`, `pentagon_example.complete_games`) pass, property test 12 of `SPEC.md` 5.7 passes, the symbolic forms are proved equal to the positive roots of the reversed board on the types T7 tests, and the Vitest benchmark of `SPEC.md` 7.6 (the 12-cycle with a chord, 2000 positions in `Big`, median of seven runs, fails above 25 ms) exists and passes on this machine. In stage 3.2, the Kaleidoscope (T6, `P3-A4`) draws with `choleskyBasis`, the Symbolic Game (T7, `P3-A5`) calls `symbolicPlay`, and the Weyl Explorer (T8, `P3-A6`) shows heaps with `heap` and `commutationClassSize`. Gate G3 checks your part with "golden tests through phase 3 pass", "property tests 1 to 13 as far as their functions exist (12 added)" and "the benchmark of 7.6 (25 ms) passes".

## 2. Read first, in this order

Read in full unless the item says reference.

1. `SPEC.md` 2.4 (b), in full: $R_i(C)=S_i(C^{\mathsf T})^{\mathsf T}$; "On a multiply laced board the reversed board is the dual diagram ($B_n\leftrightarrow C_n$; $F_4$ and $G_2$ with long and short exchanged)". This is why the symbolic forms are roots of the **reversed** board.
2. `SPEC.md` 2.5, the bullets "Long and short" and "Coroots" (reference): $(\alpha_i,\alpha_i)=2d_i$; "the coroots are exactly the root populations of the reversed board $C^{\mathsf T}$ [V]". `choleskyBasis` factors $B=DC$.
3. `SPEC.md` 2.7, F5, F6 and F12 in full (F3, F4 and F10 as reference). F5: complete legal plays from an all-positive start are the reduced words of $w_0$. F6: "Play a complete legal game with indeterminates $x_1,\dots,x_n$ as the start, using the word of any complete game from $\rho$. The linear forms fired are the positive root populations of the reversed board, each exactly once." F12: the counts 2, 16, 768, 292864 for $A_2$ to $A_5$ (the last is why `allCompleteGames` needs its cap).
4. `SPEC.md` 2.14, the paragraph "Euclidean coordinates" (steps 1 to 4 as reference) and in full the paragraph on the triangular basis: "The simplest is the triangular one (Cholesky; oracle function `cholesky_basis`), which needs no eigenvalues: it puts $\alpha_1$ along the first axis and $\alpha_2$ in the plane of the first two axes, at the angle $\pi-\pi/m$ to $\alpha_1$ with $m=3,4,6$ for $A_{12}A_{21}=1,2,3$, and at a right angle when nodes 1 and 2 are not joined [V]. The kaleidoscope (T6) uses it. Floating point enters only in these two recipes; everything before step 1 is exact."
5. `SPEC.md` 5 (opening) and 5.1, E-1 to E-11, in full. Above all E-1 (floating point only in the Geometry table and `spectralRadius`), E-4 ("Counts that can be large are `bigint`": `commutationClassSize`), E-5 (purity; the oracle's choices), E-6 (every enumeration takes a cap and returns `{items, truncated}`; "No function loops without a bound"), E-7 (positions inside), E-8, E-9 (your functions are synchronous; the site decides where they run), E-10 (errors; "Reaching a cap is reported in a field of the result and is never thrown").
6. `SPEC.md` 5.2, in full: `Word`, `Enumeration`, `Board`, `Arith`.
7. `SPEC.md` 5.4, the rows `allCompleteGames`, `heap`/`heapKey`, `commutationClassSize`, `symbolicPlay`, and the Geometry row `choleskyBasis`. The other phase 3 rows (`separatingRoots`, `wavePlay`, `exponentsFromFired`, `weylOrder`, `orbitSize`, `weylDimension`, `countCompleteGames`, `legalLayers`) and 5.3's `bipartition` belong to `P3-A1` and are reference.
8. `SPEC.md` 5.5, the bullet "Heaps" in full; "Orbits" and "Order and truncation of a search" in full (the benchmark measures that search); "Counting games" as reference (`P3-A1`).
9. `SPEC.md` 5.6, both tables in full: the row that lists `allCompleteGames`, `symbolicPlay`, `heap` "and the other functions of words" as working on one-way and non-finite boards, and the row that makes "the geometry functions" throw.
10. `SPEC.md` 5.7: the golden table rows of phase 3, "Details of some rows", comparison rules 1, 2, 5, 7, and property 12 in full.
11. `SPEC.md` 7.6, the bullet "Main-thread work" in full (the benchmark); the rest of 7.6 as reference. 7.7 row "Engine, properties" and "Performance" as reference.
12. `SPEC.md` 4 T6, T7 and T8 (reference): the callers. T7's acceptance ("on every type of rank at most 4 and on $E_6$, with the word `longest_word`, the multiset of fired forms equals the positive roots of the transposed Cartan matrix; on $B_3$ the table visibly differs from the list of positive roots of $B_3$ itself") rests on your engine test. T8's acceptance ("two plays that differ by exchanging adjacent moves at unjoined nodes show the same heap; on $A_3$ the 16 complete games show 8 different heaps, with the numbers of games per heap equal to `heaps.A3.games_per_heap`") rests on your functions.
13. `SPEC.md` Appendix A.1, in full, and A.2 (reference): the $B_2$ symbolic game, "on $B_2$ from $(x_1,x_2)$ the same four moves fire $x_1$, $2x_1+x_2$, $x_1+x_2$, $x_2$, which are the positive root populations $(1,0)$, $(2,1)$, $(1,1)$, $(0,1)$ of the reversed board $C_2$; the board $B_2$ itself has $(1,2)$ where this list has $(2,1)$ (F6)".
14. `SPEC.md` Appendix G, the rows `heaps` and `pentagon_example`, and the paragraph on fields that hold node labels. Appendix C (reference): Wildberger's "frame" is the site's "heap".
15. `SPEC.md` 9.1, the G3 row (reference).
16. Oracle `reference/lie_games.py`, each function whole with its helpers: `heap` 1150 to 1158; `heap_key` 1161 to 1162; `all_complete_games` 1165 to 1180; `commutation_class_size` 1397 to 1411; `symbolic_play` 1414 to 1422; `cholesky_basis` 1669 to 1682. Helpers: `fire` 145 to 148; `unit` 182 to 183; `play` 220 to 232; `symmetrizer` 106 to 120 and `gram` 123 to 126 (already ported by `P2-A1`); `orbit` 165 to 179 (for the minuscule `orbit_size`).
17. `reference/verify.py`, the checks that wrote or use your keys: 217 to 221 (symbolic play on every type: sorted forms equal the sorted positive roots of the transposed board, and all $N$ distinct); 579 to 608 (the pentagon: `ex_site`, `all_complete_games(pent, ex_site, limit=100_000)`, 1230 games, each of 14 moves with the same end and fired multiset); 1225 to 1233 (`cholesky_basis`: $U^{\mathsf T}U=B$ to `1e-9`, entries below the diagonal exactly `0.0`; the angle `atan2(U[1][1], U[0][1])` in degrees equals `180 - 180/m` to `1e-9` for `('A', 2, 3), ('B', 2, 4), ('C', 2, 4), ('G', 2, 6), ('A', 5, 3), ('C', 3, 3), ('F', 4, 3), ('D', 5, 3), ('E', 7, 2)`); 1537 to 1564 (section 18, heaps); 1589 to 1591 (the M6 check of the $B_2$ symbolic game).
18. `reference/bench_orbit.mjs`, in full: the benchmark's board `RING12`, its seeds, `cap` 2000, `maxDepth` 40, the `median` helper (seven runs, sorted, element `reps >> 1`). It is "NOT part of the contract and NOT a port of the engine".
19. Golden keys, shapes (print them with a script file, `COMMON.md` 4.6):
    - `heaps` is an object with nine records. Six keyed by type name, each `{complete_games, distinct_heaps, games_per_heap}`: `"A2"` `2, 2, [1, 1]`; `"A3"` `16, 8, [1, 1, 1, 1, 2, 2, 4, 4]`; `"B2"` `2, 2, [1, 1]`; `"B3"` `42, 14, [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 8, 8]`; `"G2"` `2, 2, [1, 1]`; `"D4"` `2316, 182, [...]` (182 entries, ascending, from `1` to `216`). Three keyed with a space, each `{moves, orbit_size, complete_games}`: `"A4 omega_2"` `6, 10, 5`; `"D5 omega_5"` `10, 16, 12`; `"E6 omega_1"` `16, 27, 78`. The node in the key is a label.
    - `pentagon_example` is `{cartan: [[2, -1, 0, 0, -1], [-1, 2, -1, 0, 0], [0, -1, 2, -1, 0], [0, 0, -1, 2, -1], [-1, 0, 0, -1, 2]], start_olympiad_convention: [-1, 2, -3, 4, -1], start: [1, -2, 3, -4, 1], level: -1, complete_games: 1230, word_lowest_node_rule: [1, 3, 2, 1, 5, 1, 2, 4, 3, 2, 5, 1, 4, 5], fired: [1, 3, 2, 1, 3, 2, 1, 2, 2, 1, 1, 1, 1, 1], end: [0, 0, 0, 0, -1], moves: 14, note}`. Only `complete_games` is yours; the rest is `P2-A1`'s key `pentagon_example`.
    - `types[T].positive_roots` (present on the 16 types `A1` to `A4`, `B2` to `B4`, `C2` to `C4`, `D4`, `E6`, `E7`, `E8`, `F4`, `G2`) and `types[T].longest_word` (labels), `types[T].cartan`: read for the symbolic test; these keys are `P1-A1`'s and you do not register them.
20. `CONTRACTS.md` 2.1 (the rows `heaps.ts` and `geometry.ts`), 2.2 (types), 2.3 (`CAPS`), 2.4 phase 3 (your signatures, verbatim), 2.5, 3 (harness, `covers`, the one-file rule, property files with a fixed seed, and "The benchmark of 7.6 lives in `test/bench/orbit.bench.ts` (phase 3, `P3-A2`)"), 9, 10.

## 3. Inputs you depend on

All of this must be on `main` (gate G2 green) when you start. If an item is missing, stop and report `blocked` for the parts that need it; do not re-implement it.

- From `P0-A2`: `arith.ts` (`Arith`, `SafeInt`, `Big`), `errors.ts` (`EngineError`, `NeedsTwoWayRoads`, `NotFiniteType`, `EngineOverflow`), `caps.ts` (`CAPS` with `playMoves: 20000`, `mainThreadItems: 2000`, `legalLayersDefault: 100000`, `workerPositions: 100000`), `board.ts` (`Board`, `AnyBoard`, `boardFromName`, `fromAdjacency`, `toLabels`, `toPositions`, `cartanNumbers`), `moves.ts` (`fire`, `mutate`, `Word`, `Game`), and the harness `test/golden/_harness.ts` (`golden`, `TYPE_NAMES`, `boardOf`, `covers`, `GOLDEN_KEYS_BY_PHASE`, `labels`, `wordLabels`, `intEq`, `matchRecord`, `sortedPositiveRoots`) whose `GOLDEN_KEYS_BY_PHASE[3]` contains `'heaps'` and `'pentagon_example.complete_games'`.
- From `P1-A1`: `transposeBoard`, `play` (lowest position first), `orbit`, `orbitGraph` (the search of 5.5, with `maxDepth` and the cap), `positiveRoots`, `longestWord`.
- From `P2-A1`: `gram` and `symmetrizer` (`Rational[][]`, `Rational[]`, or `null`), the guards of `guards.ts` (`requireGcm`, `requireFinite`), `classify`, and `boardFromName` for `"pentagon"` and `"X~"` names (`Board<bigint>`).
- The engine suite green on `main`, `vitest` and `fast-check` installed for `packages/engine`, Node 22.12 or later, and the three reference hashes of `CONTRACTS.md` 9.
- Nothing from `P3-A1` or `P3-A7`, who work beside you in stage 3.1. You do not call `bipartition`, `countCompleteGames` or any function of `weyl.ts`.

## 4. Deliverables

| File | Contents |
|---|---|
| `packages/engine/src/heaps.ts` | `heap`, `heapKey`, `commutationClassSize`, `symbolicPlay`, `allCompleteGames` (5.2 to 5.6 below) |
| `packages/engine/src/geometry.ts` | new file with `choleskyBasis` only (5.7); `P4-A1` adds the phase 4 functions later |
| `packages/engine/src/index.ts` | append the six exports; touch nothing else |
| `packages/engine/test/golden/p3b-heaps.test.ts` | golden key `heaps`, with the oracle's own checks of section 18 of `verify.py` (5.10) |
| `packages/engine/test/golden/p3b-pentagon-games.test.ts` | golden key `pentagon_example.complete_games` (5.11) |
| `packages/engine/test/golden/p3b-complete-games.test.ts` | (plan) order, cap and bound of `allCompleteGames`; one-way and non-ending boards (5.5, 5.8) |
| `packages/engine/test/golden/p3b-symbolic.test.ts` | (plan, from F6, T7 acceptance and `verify.py` 217 to 221) symbolic forms against the reversed board's positive roots; Appendix A.1 on $B_2$ (5.12) |
| `packages/engine/test/golden/p3b-cholesky.test.ts` | (plan, from 2.14 and `verify.py` 1225 to 1233) $U^{\mathsf T}U=B$, triangularity, the angles, the errors (5.13) |
| `packages/engine/test/golden/p3b-kinds.test.ts` | (plan) the behaviour of 5.6 on one-way and non-finite boards; purity (5.8) |
| `packages/engine/test/properties/p12-heaps.test.ts` | property 12 of 5.7, `fast-check`, fixed seed recorded in the file (5.14) |
| `packages/engine/test/bench/orbit.bench.ts` | the benchmark of 7.6 (5.15) |
| `decisions/P3-A2.md` | your fragment (5.17) |

## 5. Requirements

### 5.1 Positions, words, arithmetic

- Every function takes and returns positions (E-7, `CONTRACTS.md` 2.4 "Every function takes positions and returns positions"). A `Word` is a list of positions in the order played. Golden words and node lists are labels; tests convert with `toPositions` and `toLabels` (or the harness's `labels`, `wordLabels`) and nothing else converts.
- A board may be `Board<number>` (`SafeInt`) or `Board<bigint>` (`Big`). Every test of a matrix entry against zero, and every sign test, goes through `board.arith.sign` (or `arith.eq` with `arith.zero`), never `!== 0`, because `0n !== 0` is true in JavaScript.
- Pure and deterministic (E-5): no argument is mutated, no hidden state, the same output for the same input.
- No dependency, no import from outside `src/` (`CONTRACTS.md` 2.1).

### 5.2 `heap(board, word): number[]`

- `SPEC.md` 5.5 "Heaps": "brick $k$ lands on level $1+\max$ of the levels of earlier bricks at the same or a joined node." Return one level per brick, in the order of `word`; level 1 is the floor; `heap(board, [])` is `[]`.
- "Joined" is the oracle's test: `word[j] == i or C[i][word[j]] != 0 or C[word[j]][i] != 0`, a road in **either** direction (oracle 1150 to 1158). On a one-way board a single road joins.
- Oracle check to reproduce (`verify.py` 1553): on $A_3$, `heap` of the play with labels 1, 2, 1, 3, 2, 1 (positions `[0, 1, 0, 2, 1, 0]`) is `[1, 2, 3, 3, 4, 5]`.

### 5.3 `heapKey(board, word): string`

- `SPEC.md` 5.4: "a key that is equal for plays with the same heap". The oracle's key is `tuple(sorted(zip(word, heap(C, word))))`, the sorted multiset of (node, level) pairs. Your string must be equal for two words exactly when those sorted multisets are equal.
- The text format is yours (plan); a deterministic choice such as the pairs sorted by node then level and written `node:level` joined by commas, over positions, does it. Record the format in your fragment, because T8 groups games by it.
- Oracle checks (`verify.py` 1551 to 1552): on $A_3$ the plays with labels 1, 3, 2 and 3, 1, 2 have equal keys; 1, 2, 1 and 2, 1, 2 do not.

### 5.4 `commutationClassSize(board, word): bigint`

- `SPEC.md` 5.4: "number of plays with the same heap; `bigint`"; E-4 lists it among the counts that are `bigint`.
- `SPEC.md` 5.5: "**Plays with the same heap** are counted by dynamic programming over the sets of bricks already laid (a bit mask; a brick may be laid when every earlier brick at the same or a joined node has been)." Port oracle 1397 to 1411 exactly: `below[k]` is the set of earlier indices `j < k` at the same or a joined node (either direction); `count(full) = 1`; `count(mask)` sums `count(mask | 1 << k)` over the `k` not in `mask` with `below[k] ⊆ mask`; memoise by mask; the answer is `count(0)`. The empty word gives `1n`.
- The count is the same for every word of one heap; the oracle checks it equals the number of games with that heap (`verify.py` 1546 to 1547 and 1559 to 1560).

### 5.5 `allCompleteGames(board, start, cap): Enumeration<Word>`

- `SPEC.md` 5.4: "every complete legal play from `start`, as an `Enumeration` of words; works on any board, and stops at the cap when the plays do not end". A play is legal when it fires only a node whose number is positive (`arith.sign > 0`); it is complete when no number is positive.
- The oracle's order (1165 to 1180): depth first; at each position the positive nodes are tried in **increasing position**. The items therefore come in lexicographic order of words, and the first item is the word of `play(board, start)` (the lowest-position rule). Keep this order.
- The cap (E-6). The oracle appends and raises `OverflowError` when it holds more than `limit` games. The engine never throws at a cap (E-10): when the search is about to add item number `cap + 1` it stops at once and returns exactly `cap` items with `truncated: true` (plan, the rule of 5.5 for searches applied to this enumeration). Otherwise `truncated` is `false`.
- Plays that do not end. The oracle has no guard here (on such a board it recurses until Python's recursion limit). E-6 says "No function loops without a bound", and 5.4 says the function "stops at the cap when the plays do not end". Plan rule, to record in your fragment: the search also stops at once with `truncated: true` when a single play reaches `CAPS.playMoves` (20000) moves without ending, returning the complete games found so far. On a finite-type board (one of the boards of `SPEC.md` 2.8), F3 says "any two legal plays of the numbers game end at the same position after the same number of moves", so there every play from `start` ends and the bound binds only if that common length exceeds 20000 (from $\rho$ it is $N$, by F5). `SPEC.md` 2.7 states F3 only for finite-type boards; on a one-way, affine, indefinite or reader-drawn board the specification gives no such guarantee, so there the bound can cut a search in which some plays end and others do not. That is an assumption of the plan (plan): such a result is reported with `truncated: true` and is never presented as the complete list.
- Use an explicit stack, not recursion, so that a 20000-move play cannot overflow the JavaScript call stack (plan).
- `start` is a vector in the board's arithmetic; the oracle's default start is all ones and the callers pass it.

### 5.6 `symbolicPlay(board, word): number[][]`

- `CONTRACTS.md` 2.4: "the linear forms fired, as integer coefficient vectors". Port oracle 1414 to 1422 exactly: the start is the identity, row `j` being the coefficient vector of the number on node `j` ($x_{j+1}$); for each `i` of `word` in order, append a copy of row `i` (the form **before** the move), then replace every row `j` by `row j - C[j][i] * row i` (firing, $a_j\leftarrow a_j-C_{ji}a_i$, so row `i` becomes its negative). Return the list of appended rows, one per move.
- No legality test: it plays any word ("The left board decides which moves are legal; the right board only follows", 4 T7).
- F6: with the word of a complete game from $\rho$ (for example `longest_word`) the forms are the positive root populations of the reversed board, each exactly once.
- Return type. The contract says `number[][]`. Compute exactly (in `bigint`, or in the board's arithmetic) and convert each entry to a number, throwing `EngineOverflow` when an entry is not a safe integer (plan reading of the contract; record it). On every finite type the entries are root coefficients and small; on `Board<bigint>` boards with long words they can grow.

### 5.7 `choleskyBasis(board): number[][]`

- `SPEC.md` 5.4 Geometry: "upper triangular $U$ with $U^{\mathsf T}U=B$"; `CONTRACTS.md` 2.4: "upper triangular U with U^T U = B (floats)". Port oracle 1669 to 1682 exactly: `Bm` is `gram(board)` converted to floats (`Number(num) / Number(den)` of each `Rational`); for each column `j` in increasing order, `s = Bm[j][j] - sum over k < j of U[k][j]^2`, `U[j][j] = Math.sqrt(s)`, then for `i > j`, `U[j][i] = (Bm[j][i] - sum over k < j of U[k][j] * U[k][i]) / U[j][j]`. Rows of the result are the rows of $U$; entries below the diagonal are exactly `0`.
- Column `j` is the picture of $\alpha_{j+1}$: $\alpha_1$ along the first axis with length $\sqrt{2d_1}$, $\alpha_2$ in the plane of the first two axes at the angle $\pi-\pi/m$ to $\alpha_1$, $m=3,4,6$ for $A_{12}A_{21}=1,2,3$, and $\pi/2$ when nodes 1 and 2 are not joined (2.14).
- Floating point is allowed here and only here among your functions (E-1). Positive definiteness of $B$ holds on finite types only.
- Guards (5.6, "the geometry functions"): throw `NeedsTwoWayRoads` on a one-way board and `NotFiniteType` on a `gcm` board that is not of finite type, through `guards.ts` (`requireGcm`, `requireFinite`), before any arithmetic.

### 5.8 Behaviour by kind of board (`SPEC.md` 5.6)

| Function | One-way board | `gcm` board not of finite type |
|---|---|---|
| `heap`, `heapKey`, `commutationClassSize`, `symbolicPlay` ("the other functions of words") | work as defined | work |
| `allCompleteGames` | works as defined | works; bounded by its cap and the rule of 5.5 |
| `choleskyBasis` | throws `NeedsTwoWayRoads` | throws `NotFiniteType` |

No function of `heaps.ts` calls a guard. None of them throws at a cap (E-10).

### 5.9 Exports and placement

`CONTRACTS.md` 2.1: `src/heaps.ts` holds `heap`, `heapKey`, `commutationClassSize`, `symbolicPlay`, `allCompleteGames`; `src/geometry.ts` holds `choleskyBasis` (phase 3) and later the phase 4 functions. `src/index.ts` "re-exports the public API; nothing else". Signatures exactly as `CONTRACTS.md` 2.4:

```ts
allCompleteGames(board, start, cap): Enumeration<Word>
heap(board, word): number[];  heapKey(board, word): string;  commutationClassSize(board, word): bigint
symbolicPlay(board, word): number[][]                              // the linear forms fired, as integer coefficient vectors
choleskyBasis(board): number[][]                                   // upper triangular U with U^T U = B (floats)
```

### 5.10 Golden test `p3b-heaps.test.ts` (key `heaps`)

- Call `covers('heaps')` with exactly that spelling. This file is the only one that registers it.
- Six boards, from all ones (`boardOf(name)`, start `[1, ..., 1]`), names exactly `A2`, `A3`, `B2`, `B3`, `G2`, `D4`: `allCompleteGames(board, ones, CAPS.legalLayersDefault)` is not truncated; `complete_games` equals `items.length`; `distinct_heaps` equals the number of distinct `heapKey` values; `games_per_heap` equals the list of games per key **sorted ascending** (rule 5: the stored list is sorted, so compare in that order).
- For every heap of those six boards, `commutationClassSize` of one word of the class equals the number of games in the class (`verify.py` 1546 to 1547; plan to test, oracle to define).
- Three minuscule plays, keys exactly `"A4 omega_2"`, `"D5 omega_5"`, `"E6 omega_1"`. For each, the start is the fundamental weight at the label in the key (convert the label with `toPositions`), `play(board, omega)` gives the word: `moves` equals its length; `orbit_size` equals the number of items of `orbit(board, [omega], 'firing', cap)` with `truncated: false` (the roster's "orbit_size via orbit"; any cap of at least 27 works, use `CAPS.mainThreadItems`); `complete_games` equals `commutationClassSize(board, word)` compared with `intEq` (bigint against a JSON number).
- Oracle checks of the same section (`verify.py` 1554 to 1563): for `A4 omega_2` and `D5 omega_5`, every game of `allCompleteGames(board, omega, cap)` has one and the same `heapKey`, and their number equals `commutationClassSize`; every number fired from omega is 1. The oracle skips the enumeration on `E6 omega_1`; you may do the same.
- The A3 examples of 5.2 and 5.3.

### 5.11 Golden test `p3b-pentagon-games.test.ts` (key `pentagon_example.complete_games`)

- `covers('pentagon_example.complete_games')`, that spelling exactly. `P2-A1` covers `pentagon_example` (the plain key "covers everything but X").
- Board `boardFromName('pentagon')` (a `Board<bigint>`, labels 1 to 5), whose `cartanNumbers` must equal `pentagon_example.cartan` (assert it). Start: the stored `start` `[1, -2, 3, -4, 1]` in this specification's convention, as `bigint`; never `start_olympiad_convention`.
- `allCompleteGames(board, start, 100000)` (the oracle's limit) is not truncated and has `complete_games` = 1230 items. Each item has 14 moves, ends at `end` `[0, 0, 0, 0, -1]` and fires the same multiset as `fired` (`verify.py` 590 to 597). The first item, in labels, equals `word_lowest_node_rule`.

### 5.12 Symbolic forms `p3b-symbolic.test.ts` (no golden key registered)

- T7's acceptance, at engine level: on every type of rank at most 4 (`A1` to `A4`, `B2` to `B4`, `C2` to `C4`, `D4`, `F4`, `G2`) and on `E6`, with `word = toPositions(board, types[T].longest_word)`, the multiset of `symbolicPlay(board, word)` equals the positive roots of the transposed Cartan matrix, compared after `sortedPositiveRoots` on both sides, and the forms are pairwise distinct (`N` of them). The expected list is golden: `types[U].positive_roots` where `types[U].cartan` equals `transposeBoard(board)`'s matrix ($A_n$, $D_4$, $E_6$: `U = T`; $B_n$ and $C_n$ exchange). For `F4` and `G2` no stored matrix equals the transpose: the transpose is the same type with the node order reversed, so the expected list is `types[T].positive_roots` with each vector reversed; assert in the test that reversing the node order of the stored matrix gives the transposed matrix before using it.
- On `B3` the multiset differs from `types.B3.positive_roots` (it contains `[1, 2, 1]`, which $B_3$ lacks).
- Appendix A.1: on `B2`, `symbolicPlay(board, play(board, [1, 1]).word)` equals, in order, `[[1, 0], [2, 1], [1, 1], [0, 1]]`; `[1, 2]` is a positive root of `B2` and `[2, 1]` is not (`verify.py` 1589 to 1591).
- (plan, mirrors `verify.py` 217 to 221, which runs on all 32 types) on every type, the sorted forms from the word of `play(board, ones)` equal `positiveRoots(transposeBoard(board))`, sorted.
- Do not call `covers('types[*].positive_roots')`: that key is `P1-A1`'s, and a key is registered in exactly one file.

### 5.13 Cholesky `p3b-cholesky.test.ts` (no golden key)

- On every one of the 32 types: $U^{\mathsf T}U=B$ entry by entry within `1e-9`, with $B$ from `gram` as floats; every entry below the diagonal is exactly `0`; every diagonal entry is positive.
- The angle `atan2(U[1][1], U[0][1])` in degrees equals `180 - 180 / m` within `1e-9` for `A2` (m = 3), `B2` (4), `C2` (4), `G2` (6), `A5` (3), `C3` (3), `F4` (3), `D5` (3), `E7` (2, the right angle: nodes 1 and 2 of $E_7$ are not joined).
- Never compare coordinates against typed constants (roster trap); the identities above are the test.
- Errors: a one-way board (`fromAdjacency([[0, 1], [0, 0]])`, whose matrix is `[[2, 0], [-1, 2]]`) throws `NeedsTwoWayRoads`; `boardFromName('A2~')` throws `NotFiniteType`.

### 5.14 Property 12 `p12-heaps.test.ts`

- `SPEC.md` 5.7: "`heap` is unchanged by exchanging adjacent moves at unjoined nodes, and `commutationClassSize` is the same for both words." "The board is drawn at random from the type list".
- With `fast-check`: `fc.constantFrom(...TYPE_NAMES)`, a random word of positions (plan: length 0 to 16, so that the bit-mask count stays small), and an index `k`; when `word[k]` and `word[k+1]` are different and unjoined (both `C[a][b]` and `C[b][a]` zero), swap them and assert equal `heapKey` and equal `commutationClassSize`. "Unchanged" means the multiset of (node, level), which is `heapKey`; the list of `heap` levels is permuted by the swap and is not compared index by index. Use `fc.assert` with an explicit `seed` and `numRuns` recorded in the file (`CONTRACTS.md` 3). No `covers()`.
- (plan) A guard that the property is not vacuous: count the runs where a swap happened and assert it is positive; and one fixed counter-example, A3 `[0, 1, 0]` against `[1, 0, 1]`, whose keys differ.

### 5.15 Benchmark `test/bench/orbit.bench.ts`

- `SPEC.md` 7.6 "Main-thread work": "A Vitest benchmark repeats that case (the 12-cycle with one chord, joining nodes 1 and 7, as in `reference/bench_orbit.mjs`) and fails above 25 ms (median of seven runs)." `CONTRACTS.md` 3: "the 12-cycle with a chord joining nodes 1 and 7, 2000 positions, `Big`, median of seven runs, fails above 25 ms."
- The case, as `bench_orbit.mjs` builds it: twelve nodes, labels 1 to 12, joined `k` to `k + 1` for `k = 1..11`, 12 to 1, and 1 to 7 (positions 0 and 6), one road each way. Build it with `fromAdjacency` from the symmetric 0/1 adjacency; assert the board's arithmetic is `Big` (it is not a named finite type). Seeds: the twelve unit vectors (the simple roots) as `bigint`. Call `orbitGraph(board, seeds, 'mutation', 2000, 40)` (the search of 5.5, as the reference script's `orbitGraph(Big, RING12, units, 2000, 40)`).
- Assert the result is the intended work: `items.length === 2000` and `truncated === true`.
- Time seven runs with `performance.now()`, sort, take element 3 (the reference's `ts[reps >> 1]`), and assert it is at most 25 ms. Add no warm-up runs and no retries; never raise the threshold (`COMMON.md` 4.4 forbids "loosened tolerances"; the 25 ms line is fixed by `SPEC.md` 7.6 and `CONTRACTS.md` section 3, and a deviation you believe necessary goes in your report under `deviations`). Print the median with the threshold on one line (for example with `console.info` inside the test file, which is not shipped code) so that `GATE` can quote it.
- Write it with Vitest's `describe`, `it` and `expect`, so that it fails; Vitest's `bench()` API reports timings and does not fail on a threshold. Read the installed Vitest's documentation for how `*.bench.ts` files are collected before deciding how to run it.
- Wiring (plan). `GATE` runs "the command that runs `packages/engine/test/bench/orbit.bench.ts` as `P3-A2` wired it (in `npm test`, or a script named in its decisions fragment or in `packages/engine/package.json`)"; "If no command on `main` runs the file, the item fails". You own neither `packages/engine/vitest.config.ts` nor `packages/engine/package.json`. Therefore: check whether the engine's include patterns already collect `test/bench/*.bench.ts`; if not, write a request to `MERGE` for a separate script in `packages/engine/package.json` (for example `"bench"`) that runs only this file, and keep the file out of the default `npm test` run, because timing under the parallel suite is noisy. Until the request is met, run it with a command you verify against the installed Vitest CLI (a configuration file in your scratch directory passed with `--config` is acceptable) and record that exact command in your fragment and report.

### 5.16 Size and main thread (reference)

Your functions are synchronous (E-9). The site routes "the counts of games and of heaps on a board whose group has more than 2000 elements" to the worker; T8 offers only boards with at most 1152 group elements. You add no worker logic and no cap beyond those stated here.

### 5.17 Decisions fragment `decisions/P3-A2.md`

One dated entry each, in the form of `COMMON.md` 5.1: the `heapKey` text format; the cap semantics of `allCompleteGames` (exactly `cap` items, `truncated: true`) and the 20000-move bound for plays that do not end, with the reason (E-6; F3 only for finite-type boards, and the plan's assumption, marked (plan), for every other board, as in 5.5); the explicit stack; the `bigint` (or other) mask representation of `commutationClassSize`; the overflow rule of `symbolicPlay`; how `choleskyBasis` converts rationals to floats; the benchmark command, the measured median on this machine, and the request made for the script; the `fast-check` seed and `numRuns`; the versions of `node`, `vitest` and `fast-check` you observed. Add no dependency.

## 6. Acceptance

- [ ] `SPEC.md` 5.7, golden key `heaps` (phase 3): the six boards and the three minuscule plays reproduce `complete_games`, `distinct_heaps`, `games_per_heap`, `moves`, `orbit_size`, `complete_games`. `test/golden/p3b-heaps.test.ts > heaps: six boards from all ones`, `> heaps: minuscule plays`. G3 ("golden tests through phase 3 pass").
- [ ] `verify.py` section 18: `commutationClassSize` equals the number of games per heap; one heap and the right count from `omega` on `A4` and `D5`; the A3 examples of `heap` and `heapKey`. `p3b-heaps.test.ts > class size equals games per heap`, `> minuscule plays have one heap`, `> A3 examples`. G3.
- [ ] `SPEC.md` 5.7, golden key `pentagon_example.complete_games` = 1230 (phase 3), with 14 moves, the same end and the same fired multiset in every game. `test/golden/p3b-pentagon-games.test.ts > 1230 complete games from the stored start`. G3.
- [ ] `coverage.json` lists `heaps` and `pentagon_example.complete_games` (so `missingByPhase["3"]` lacks them after your run). Proven by the harness after `npm test -w packages/engine`; paste the inspection command and its output. G3 (`GATE` reads the same file).
- [ ] `SPEC.md` 5.4 and E-6: `allCompleteGames` returns the lexicographic order with the lowest-position play first; on `A5` with cap 100000 it returns exactly 100000 items and `truncated: true` (292864 exist, F12); on a board where plays do not end (`A2~` from all ones) it stops with `truncated: true` in bounded time; on the one-way board `[[2, 0], [-1, 2]]` from `[1, 0]` it returns `[[0, 1]]`. `test/golden/p3b-complete-games.test.ts > order`, `> cap on A5`, `> plays that do not end`, `> one-way board`. G3.
- [ ] `SPEC.md` 2.7 F6 and 4 T7 acceptance (engine part): on every type of rank at most 4 and on `E6`, with `longest_word`, the multiset of `symbolicPlay` forms equals the positive roots of the transposed Cartan matrix; on `B3` it differs from `B3`'s own. `test/golden/p3b-symbolic.test.ts > forms are the reversed board's positive roots`, `> B3 differs from its own roots`. G3 ("acceptance of T5, T6, T7, T8 as automated tests", through `P3-A5`).
- [ ] Appendix A.1: the $B_2$ symbolic game fires `[1, 0], [2, 1], [1, 1], [0, 1]`. `p3b-symbolic.test.ts > B2 symbolic game of Appendix A.1`. G3.
- [ ] (plan) `verify.py` 217 to 221 on all 32 types. `p3b-symbolic.test.ts > every type against positiveRoots of the transpose`. G3.
- [ ] `SPEC.md` 2.14 and 5.4: `choleskyBasis` is upper triangular with $U^{\mathsf T}U=B$ within `1e-9` on all 32 types, and the angles of `verify.py` 1230 to 1233 hold. `test/golden/p3b-cholesky.test.ts > U^T U = B on every type`, `> angle between alpha_1 and alpha_2`. G3.
- [ ] `SPEC.md` 5.6: `choleskyBasis` throws `NeedsTwoWayRoads` on a one-way board and `NotFiniteType` on `A2~`; the functions of words work on a one-way board and on an affine board; no argument is mutated. `p3b-cholesky.test.ts > errors`, `test/golden/p3b-kinds.test.ts > functions of words on a one-way board`, `> on an affine board`, `> arguments are not mutated`. G3.
- [ ] `SPEC.md` 5.7 property 12. `test/properties/p12-heaps.test.ts > heap and class size unchanged by exchanging unjoined adjacent moves`. G3 ("property tests 1 to 13 as far as their functions exist (12 added)").
- [ ] `SPEC.md` 7.6 benchmark: median of seven runs at most 25 ms, with 2000 positions and `truncated: true`. `test/bench/orbit.bench.ts > 12-cycle with a chord: 2000 positions in Big within 25 ms`, run by the command recorded in your fragment. G3 ("the benchmark of 7.6 (25 ms) passes").
- [ ] Type checks: `npx tsc --noEmit -p packages/engine` exits 0. Every merge.
- [ ] The whole engine suite still passes: `npm test -w packages/engine`. Every merge.

No line of this checklist is manual.

## 7. Files

- **You own** (the roster's list, exactly):
  - `packages/engine/src/heaps.ts, geometry.ts (choleskyBasis), index.ts (exports)`
  - `packages/engine/test/golden/p3b-*.test.ts`
  - `packages/engine/test/properties/p12-heaps.test.ts`
  - `packages/engine/test/bench/orbit.bench.ts`
  - `decisions/P3-A2.md`
- **You may edit with the stated protocol**: `packages/engine/src/index.ts`, append your export lines only. `P3-A1` appends its own lines to the same file in the same stage; `MERGE` joins the two. Do not reorder or reformat existing lines.
- **You must not touch**: everything else; in particular `packages/engine/src/weyl.ts` and its tests (`P3-A1`), every engine file of earlier phases (`board.ts`, `moves.ts`, `search.ts`, `play.ts`, `form.ts`, `classify.ts`, `guards.ts`, ...), `packages/engine/test/golden/_harness.ts`, `packages/engine/vitest.config.ts`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `reference/` (read only), `DECISIONS.md`, root `package.json` and the lockfile, the root Vitest configuration, everything under `site/` and `scripts/`, `content/unverified.json`, other agents' tests.

## 8. Order of work

1. Pre-flight: `node --version` (22.12 or later), `git rev-parse --show-toplevel`, `git branch --show-current` (expect `agent/P3-A2`); `npm ci --prefer-offline` at the root if `node_modules` is absent; `shasum -a 256` of the three reference files against `CONTRACTS.md` 9 (stop and report `blocked` on a difference). Confirm the inputs of section 3 exist (`gram`, the guards, `boardFromName('pentagon')`, `orbitGraph`, `play`, `transposeBoard`, `positiveRoots`). Read `packages/engine/vitest.config.ts` for the include patterns, and the installed Vitest and `fast-check` documentation (`COMMON.md` 3).
2. Tests first (`COMMON.md` 4.3): write `p3b-heaps.test.ts` and `p3b-pentagon-games.test.ts` from the golden keys, and `p3b-complete-games.test.ts`; see them fail against stubs.
3. `heap`, `heapKey`, `commutationClassSize`, `allCompleteGames` in `heaps.ts`; exports; run until the heaps and pentagon tests pass. Commit: `P3-A2: heaps, class sizes, all complete games with golden tests`. This is the first usable increment (T8 needs it).
4. `p3b-symbolic.test.ts`, then `symbolicPlay`. Commit.
5. `p3b-cholesky.test.ts`, then `geometry.ts` with `choleskyBasis`. Commit.
6. `p3b-kinds.test.ts` and `p12-heaps.test.ts`. Commit.
7. `orbit.bench.ts`; decide and verify the command that runs it; run it alone with nothing else running on the machine you control; record the median. Commit.
8. `npx tsc --noEmit -p packages/engine`; `npm test -w packages/engine`; inspect `coverage.json`; write `decisions/P3-A2.md`; commit; report.

## 9. Traps

1. **Reversed board** (roster). The symbolic forms are roots of the REVERSED board. On `B3` the table differs from `B3`'s own positive roots; on `B2` the form $2x_1+x_2$ is the root `(2, 1)` of `C2`, where `B2` has `(1, 2)`. Compare with the transpose, never with the board itself.
2. **F4 and G2 transposes have no golden record of their own.** Their transposed matrices are the same type with the nodes in reverse order; reverse the stored vectors (and prove the matrix correspondence in the test) rather than looking for a key that does not exist.
3. **The A5 cap** (roster). `allCompleteGames` on `A5` from all ones has 292864 plays: respect the cap. The `heaps` golden uses six small boards (the largest is `D4` with 2316).
4. **Floating point in `choleskyBasis`** (roster). Test $U^{\mathsf T}U=B$ to `1e-9`, never coordinates against typed numbers.
5. **"Joined" means a road either way, and the same node counts.** The oracle tests `C[i][j] != 0 or C[j][i] != 0`. On the one-way board `[[2, 0], [-1, 2]]` the nodes are joined, so `heap([0, 1])` is `[1, 2]`.
6. **`bigint` zeros.** On a `Board<bigint>`, `C[i][j] !== 0` is always true. Use `arith.sign` (the same mistake is trap 16 of `P1-A1` about `bench_orbit.mjs`).
7. **Bit masks in JavaScript.** `1 << k` and `&` work on 32-bit signed integers; at `k = 31` the sign flips and from `k = 32` the shift wraps. Words longer than 30 moves occur (`F4`'s longest word has 24, a random property word or a word on an affine board can be longer). Use `bigint` masks, or a representation without that limit, and key the memo `Map` by it.
8. **`heapKey` compares multisets, not level lists.** Exchanging two unjoined adjacent moves permutes the `heap` levels; only the sorted (node, level) pairs stay equal.
9. **The empty word.** `heap` is `[]`, `commutationClassSize` is `1n`, `symbolicPlay` is `[]`.
10. **`symbolicPlay` records the form before the move**, then updates every row, including row `i`, which becomes its negative. Recording after the update gives the negatives.
11. **Pentagon start convention.** Use `start` `[1, -2, 3, -4, 1]`; the Olympiad's start fires negative numbers. The board is `Board<bigint>`, so the start must be `bigint`.
12. **Order of `allCompleteGames`.** Depth first with nodes in increasing position: the first item is `play`'s word. A breadth-first or recursive-unordered enumeration passes the count tests and breaks T8's ordering and the first-item test.
13. **Cap off by one.** The oracle raises when it holds `limit + 1` games; the engine returns exactly `cap` items with `truncated: true` and never throws (E-10).
14. **Non-ending plays and the call stack.** On an affine board from all ones the plays never end; a recursive port overflows the stack or loops. Use the explicit stack and the 20000-move bound of 5.5.
15. **Minuscule key names contain a space and a label**: `"A4 omega_2"`, `"D5 omega_5"`, `"E6 omega_1"`. The start is the unit vector at **position** `label - 1` on these finite boards; convert through `toPositions`, not by subtraction.
16. **`orbit_size` of the minuscule records is checked by enumeration** (`orbit` in the firing game), not by `orbitSize`, which is `P3-A1`'s and may not be on `main` when you start.
17. **One file per golden key.** Register `heaps` in `p3b-heaps.test.ts` and `pentagon_example.complete_games` in `p3b-pentagon-games.test.ts`, nowhere else; do not register `types[*].positive_roots` or `pentagon_example`.
18. **The benchmark measures `orbitGraph`, a phase 1 function you do not own.** If it fails at 25 ms, do not change `search.ts` and do not raise the threshold; report the median and the profile, with `status: partial` for that item and a request to the owner of `search.ts` through `MERGE`.
19. **Vitest's benchmark mode does not fail on thresholds**, and the default `vitest run` include pattern may not collect `*.bench.ts`. Check with the installed version; a benchmark that no command runs fails the G3 item.
20. **Timing noise.** Other agents share this machine (8 GB). Run the benchmark alone, never while one of your Playwright or full test runs is going; never retry until it passes.
21. **`gram` returns `Rational`.** Convert with `Number(num) / Number(den)` only inside `choleskyBasis`; do not change `form.ts`. Apply the finite-type guard before calling `gram`, so that an affine board throws `NotFiniteType` rather than reaching a square root of a non-positive number.
22. **`index.ts` is shared in stage 3.1** with `P3-A1`. Append only; a merge conflict there is `MERGE`'s to resolve.
23. **Wildberger's "frame" is the site's "heap"** (Appendix C, oracle docstring). Use "heap" in names and comments.
24. Em-dashes are forbidden in everything you write, comments and messages included (`COMMON.md` 4.4).

## 10. Report

The JSON of `COMMON.md` 5.2, with `"agent": "P3-A2"`, `"branch": "agent/P3-A2"`, the worktree path printed by `git rev-parse --show-toplevel`, every commit, every file changed, and in `commandsRun` at least: `node --version`; `shasum -a 256` of the three reference files; `npx tsc --noEmit -p packages/engine`; `npm test -w packages/engine` (with the pass count); the `coverage.json` inspection; the benchmark command with its median. In `acceptance`, one line per checklist item of section 6 with the test that proves it; `not-automated` appears nowhere.

Additional fields (plan):

- `"benchmark"`: `{ "command": "...", "medianMs": <number>, "runsMs": [seven numbers], "positions": 2000, "truncated": true, "thresholdMs": 25 }`.
- `"coverageKeys"`: the two keys you registered, as they appear in `coverage.json`.
- `"heapKeyFormat"`: one line describing the string.
- `"allCompleteGamesBound"`: one line stating the cap semantics and the bound for plays that do not end.

`requests` must name: the script or include pattern that runs the benchmark (to `MERGE`, for `packages/engine/package.json` or `packages/engine/vitest.config.ts`), unless an existing pattern already runs it; and any input of section 3 found missing. `deviations` lists anything that departs from `CONTRACTS.md` 2.4 or `SPEC.md` 5; the expected list is empty. `handoff` tells `P3-A4` that `choleskyBasis` returns rows and that column `j` is $\alpha_{j+1}$; tells `P3-A5` that `symbolicPlay` returns forms over positions in the order of the moves; and tells `P3-A6` the `heapKey` format and that `commutationClassSize` returns `bigint`.
