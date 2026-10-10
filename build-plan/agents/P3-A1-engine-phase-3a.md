# P3-A1: Engine phase 3A: Weyl group data, counting, dimension formula

Phase 3, stage 3.1. Size M. Runs in: a worktree on branch `agent/P3-A1`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies. Where this file says (plan), the rule is the build plan's addition and not the specification's; where it says [D], `SPEC.md` marks the point as a design decision. Nothing you build is marked [U] and you write no lesson text, so there is nothing for you to wrap in `<Unverified>`: the [U] labels near your sections (F14's item number in [Ste59]; the name "rectified 4_21" in the E8 table of 2.14) concern lesson wording, not engine values. Every golden value you test was computed by the oracle and is [V].

## 1. Objective

When you are done, `packages/engine/src/weyl.ts` holds the nine phase-3 functions that `CONTRACTS.md` 2.1 assigns to you: `bipartition`, `separatingRoots`, `wavePlay`, `exponentsFromFired`, `weylOrder`, `orbitSize`, `weylDimension`, `countCompleteGames`, `legalLayers`, each a port of its oracle function in `reference/lie_games.py`, each guarded as the table of `SPEC.md` 5.6 requires, and all exported from `src/index.ts`. Their golden tests pass: `types[*].exponents`, `types[*].weyl_order`, `types[*].bipartite_colouring`, `types[*].fundamental_orbit_sizes`, `types[*].n_reduced_words_w0`, `types[*].length_distribution`, `weyl_dimension` and `e8` (without `h4_projection`), together with the second comparison of `types[*].coxeter_number` against the number of wave rounds. These functions are what T5 Numbers Game Lab (`P3-A3`), T7 and the T1 colour-class panel (`P3-A5`), T8 Weyl Explorer (`P3-A6`), the worker routing of E-9 (`orbitSize`) and the phase-4 engine (`P4-A1`) call, and what gate G3 measures (SPEC 9.1, row 3: "G3: golden tests through phase 3").

## 2. Read first, in this order

Read in full unless the item says reference.

1. `SPEC.md` 2.6, in full: the table of what positions are; rho is the position with 1 on every node; dominant means no negative number; the length of `w` is the least number of moves; `w_0` is reached by any complete legal game from rho.
2. `SPEC.md` 2.7, F4 to F12 and F14, in full. F4 (N moves from any all-positive start, end at `w_0` applied to the start); F5 (reachable positions are the elements of W; "the least number of moves that reaches a position equals the number of positive roots beta with <a, beta^vee> < 0, the mirrors that separate the position from the start": this is `separatingRoots`); F6 (fired numbers are coroot pairings); F7 (the tally, the conjugate partition, the exponents, `N = sum m_i`, `h = m_n + 1`, `|W| = prod(m_i + 1)`); F8 (the wave, h rounds whichever colour starts, A3: 4 rounds, 6 moves, A1 degenerate); F9 (`dim V(lambda) = M / D`); F10 (orbit of `omega_i` has `|W| / |W_J|` elements); F11 (reference); F12 (the counts 2, 16, 768, 292864; 2, 42, 24024; 2316, 12985968, 2144892, 2); F14 (reference).
3. `SPEC.md` 2.14, the paragraph "Facts about E8 used on the site" and its table, in full: 240 roots of norm 2, each with inner product 1 with exactly 56 others, -1 with 56, 0 with 126, -2 with its negative; `det C = 1`; the fundamental weights are the columns of `C^{-1}`; the populations of `omega_8`, `omega_1`, `omega_7`, `omega_2` with norms 2, 4, 6, 8; the orbit sizes 2160, 17280, 69120, 483840, 241920, 60480, 6720, 240.
4. `SPEC.md` 5.1, E-1 to E-11, in full, in particular E-4 ("Counts that can be large are `bigint`: the products in `weylDimension` ..., `countCompleteGames`, `commutationClassSize`. Group orders and orbit sizes fit in safe integers for every board of at most 12 nodes and are numbers."), E-5, E-6, E-7, E-9 item 1 ("from phase 3, an orbit on a finite-type board whose size `orbitSize` gives"), E-10, E-11.
5. `SPEC.md` 5.3, the row `bipartition(board)`.
6. `SPEC.md` 5.4, the phase-3 rows for your functions: `separatingRoots`, `wavePlay`, `exponentsFromFired`, `weylOrder`, `orbitSize`, `weylDimension`, `countCompleteGames`, `legalLayers`. The other phase-3 rows (`allCompleteGames`, `heap`, `heapKey`, `commutationClassSize`, `symbolicPlay`) and `choleskyBasis` are `P3-A2`'s; read them as reference only.
7. `SPEC.md` 5.5, the paragraph "Counting games" in full; "Order and truncation of a search" and "The longest word" as reference (you call `orbitGraph` and `play`).
8. `SPEC.md` 5.6, in full: the cap table (rows "Group order for the Weyl Explorer: 1152" and "Group order for counting games: 60000") and the function table (seven of your functions, `weylOrder`, `weylDimension`, `orbitSize`, `wavePlay`, `countCompleteGames`, `legalLayers` and `separatingRoots`, are in the last row: they "throw `NeedsTwoWayRoads`" on a `one-way` board and "throw `NotFiniteType`" on a `gcm` board that is not of finite type; `bipartition` is in the row that works on every board; `exponentsFromFired` takes no board, appears in no row, and has no guard).
9. `SPEC.md` 5.7: the phase-3 rows of the golden table; the sentences "`coxeter_number` is compared with 2N/n in phase 1 and, for rank at least 2, with the number of rounds of `wavePlay` in phase 3" and "`fundamental_orbit_sizes` is compared with `orbitSize`, and with the size of the enumerated orbit only where it is at most 20000"; comparison rules 1, 2, 5 (`weyl_dimension` is a list of records matched by `type` and `highest_weight`, never by index; `length_distribution` compares in order) and 7 (`n_reduced_words_w0` and `length_distribution` are absent above `|W| = 60000` and are not tested there).
10. `SPEC.md` Appendix A.2 and A.3, in full: the generic game on A3 with its tally and its wave; the three dimension examples on A2, G2, B2. These are hand-checkable vectors for your unit tests.
11. `SPEC.md` Appendix G: the paragraph on fields that hold node labels (a list with one entry per node, such as `bipartite_colouring`, `fundamental_orbit_sizes` and the rows of `e8.fundamental_weights_in_root_coordinates`, is in label order); the paragraph on identifying fields (`weyl_dimension` by `type` and `highest_weight`); the rows `.coxeter_number, .det_cartan, .simply_laced, .exponents, .weyl_order`, `.bipartite_colouring`, `.fundamental_orbit_sizes, .minuscule_nodes`, `.n_reduced_words_w0, .length_distribution`, `weyl_dimension`, `e8`.
12. Reference: `SPEC.md` 2.3 (firing and legal play), 2.5 (the form, coroots as the root populations of the reversed board), 4 T5 and 4 T8 (what your callers do; T5's dimension calculator is "for a chosen dominant lambda"), 7.7 (test commands), 9.1 (the G3 row), 9.3.
13. Oracle, `reference/lie_games.py`; read each function whole with the helpers it calls: `bipartition` 258 to 272; `wave_play` 275 to 287; `exponents_from_fired` 290 to 293; `weyl_order` 296 to 304; `weyl_dimension` 307 to 320; `count_reduced_words_w0` 323 to 339; `legal_layers` 1381 to 1387; `separating_roots` 1390 to 1394; `orbit_size` 1425 to 1431; `weight_inner` 686 to 689 (reference for the E8 norms of 5.11 only: you port no `weightInner`, and `formValue` of `P2-A1` plays its part). Helpers: `components` 92 to 103, `symmetrizer` 106 to 120, `gram` 123 to 126, `bil` 129 to 131, `fire` 145 to 148, `orbit` 165 to 179, `unit` 182 to 183, `roots` 186 to 190, `positive_roots` 193 to 194, `coroot_coords` 201 to 207, `dynkin_labels` 210 to 213, `play` 220 to 232, `solve`, `inverse`, `weight_to_root_coords` 656 to 683, `sub_matrix` 734 to 736, `orbit_graph` 1328 to 1349.
14. `reference/verify.py`, the checks that wrote your keys: lines 169 to 208 (the game from rho, `exponents_from_fired`, `weyl_order`, the wave for both start colours, `rounds == 1 + first` on A1, `bipartite_colouring`); 222 to 248 (`fundamental_orbit_sizes` as `W // weyl_order(sub)`, `orbit_size(C, unit(n, i))`, the enumerated orbit only where `size <= 20000`); 260 to 283 (`count_reduced_words_w0` and `legal_layers` only when `W <= 60000`; for `W <= 2000` the depth of every position equals the number of separating roots); 326 to 340 (`DIMS`, the 30 dimension records, the E8 product above 2^53); 1291 to 1304 (the `e8` record: `fw[i]` is column i of `C^{-1}`, `neighbours_at_inner_product_1` is the integer 56); 1585 to 1587 (A3 wave 4 rounds, E8 wave 30 rounds, A2 dimension 8); 1677 to 1684 (orbit size of any position: play to the end, then `|W| / |W_J|`; 150 random positions on A3, B3, D4, G2, F4).
15. Golden keys, shapes (print them with a script file under your scratch directory, run as `python3 /absolute/path/script.py` as COMMON 4.6 requires; adding `-I` is a (plan) precaution, not a COMMON 4.6 rule):
    - `types[T].exponents`: ascending list, A3 `[1, 2, 3]`, B3 `[1, 3, 5]`, E8 `[1, 7, 11, 13, 17, 19, 23, 29]`.
    - `types[T].weyl_order`: integer, A3 `24`, B3 `48`, E6 `51840`, E8 `696729600`.
    - `types[T].bipartite_colouring`: 0 or 1 per node in label order; A1 `[0]`, A3 `[0, 1, 0]`, D5 `[0, 1, 0, 1, 1]`, E8 `[0, 1, 1, 0, 1, 0, 1, 0]`.
    - `types[T].fundamental_orbit_sizes`: one integer per node in label order; A3 `[4, 6, 4]`, B3 `[6, 12, 8]`, E8 `[2160, 17280, 69120, 483840, 241920, 60480, 6720, 240]` (only E8 has entries above 20000: nodes 3 to 6).
    - `types[T].n_reduced_words_w0`: integer, present for the 23 types with `|W| <= 60000` and absent on `A8`, `B7`, `B8`, `C7`, `C8`, `D7`, `D8`, `E7`, `E8`. Values include A1 `1`, D5 `12985968`, D6 `4814069133600`, E6 `1266633313578528`, B6 and C6 `1671643033734960`. All present values are below 2^53, but the type is still `bigint` (E-4).
    - `types[T].length_distribution`: present on the same 23 types; A1 `[1, 1]`, A3 `[1, 3, 5, 6, 5, 3, 1]`, G2 `[1, 2, 2, 2, 2, 2, 1]`; N + 1 entries summing to `weyl_order`.
    - `weyl_dimension`: list of 30 records `{type, highest_weight, dimension}`, `highest_weight` in label order; first `{"type": "A1", "highest_weight": [3], "dimension": 4}`, last `{"type": "E8", "highest_weight": [1, 0, 0, 0, 0, 0, 0, 0], "dimension": 3875}`.
    - `e8`: `{"fundamental_weights_in_root_coordinates": [[4, 5, 7, 10, 8, 6, 4, 2], [5, 8, 10, 15, 12, 9, 6, 3], ..., [2, 3, 4, 6, 5, 4, 3, 2]], "neighbours_at_inner_product_1": 56, "h4_projection": {...}}`. Row i is `omega_{i+1}` as a population. `neighbours_at_inner_product_1` is the bare integer 56, not a list. `h4_projection` is `P4-A1`'s (phase 4).
    - Read, not covered by you: `types[T].coxeter_number` (phase 1, covered by `P1-A1`'s file), `types[T].fired_values`, `types[T].n_positive_roots`, `types[T].highest_root`.
16. `CONTRACTS.md` 2.1 (`src/weyl.ts` is yours; `index.ts` is append-only), 2.2 (`Board`, `AnyBoard`, `Vec`, `Word`, `Enumeration`, `PlayResult`, `OrbitGraph`, `Rational`, and `WaveResult<T> { rounds: number; legal: boolean; position: Vec<T>; word: Word; }` (plan)), 2.3 (`CAPS.countGamesGroup` 60000, `CAPS.legalLayersDefault` 100000, `CAPS.weylExplorerGroup` 1152), 2.4 phase 3 (your signatures, verbatim) and phases 0 to 2 (what you call), 2.5, 3 (the harness: `covers`, `GOLDEN_KEYS_BY_PHASE[3]`, `boardOf`, `TYPE_NAMES`, `labels`, `wordLabels`, `intEq`, `matchRecord`, `ratText`), 10.

## 3. Inputs you depend on

All of this must be on `main` (gate G2 green) when you start. If any item is missing, stop and report `blocked` for the parts that need it; do not re-implement it.

- From `P0-A2`: `Board`, `AnyBoard`, `Arith`, `SafeInt`, `Big`, `Vec`, `Word`, `Game`; `boardFromName`, `fromAdjacency`, `toLabels`, `toPositions`, `fire`; `EngineError`, `NeedsTwoWayRoads`, `NotFiniteType`, `EngineOverflow`; `CAPS` in `src/caps.ts`; the harness `packages/engine/test/golden/_harness.ts` with `golden`, `TYPE_NAMES`, `boardOf`, `covers`, `GOLDEN_KEYS_BY_PHASE` (entry `3` must read `['types[*].exponents', 'types[*].weyl_order', 'types[*].bipartite_colouring', 'types[*].fundamental_orbit_sizes', 'types[*].n_reduced_words_w0', 'types[*].length_distribution', 'weyl_dimension', 'heaps', 'pentagon_example.complete_games', 'e8']`; if it differs, use the harness's spellings and report the difference to `MERGE` under `requests`), `labels`, `wordLabels`, `intEq`, `matchRecord`, `ratText`, and the `covers()` mechanism that writes `test/golden/coverage.json` with `missingByPhase`.
- From `P1-A1`: `components`, `subBoard`, `Rational` and its helpers, `toNumbers`, `toPopulation`, `applyWord`, `legalNodes`, `play(board, a, choose?, cap?)` with the lowest-position rule, `orbit`, `orbitGraph(board, seeds, game, cap, maxDepth?, legalOnly?)`, `wordTo`, `roots`, `positiveRoots` (sorted by total, then lexicographically), `coxeterNumber`, `longestWord`.
- From `P2-A1`: `coroot(board, root)`, `formValue(board, p, q?)`, `classify`, `boardFromName` for `A2~`, `pentagon`, `square`; `guards.ts` with `requireGcm` and `requireFinite` and the `WeakMap` cache of E-11.
- `vitest` and `fast-check` as installed development dependencies; Node 22.12 or later (`node --version`; otherwise stop and report).
- `reference/golden_data.json`, `reference/lie_games.py`, `reference/verify.py` with the SHA-256 values of `CONTRACTS.md` section 9.

`P3-A2` (heaps, `choleskyBasis`, the benchmark) and `P3-A7` (lab timings) run beside you in stage 3.1. You need nothing from them and they need nothing from you; `P3-A2` also appends to `src/index.ts`, and `MERGE` resolves that file.

## 4. Deliverables

| File | Contents |
|---|---|
| `packages/engine/src/weyl.ts` | `bipartition`, `separatingRoots`, `wavePlay`, `exponentsFromFired`, `weylOrder`, `orbitSize`, `weylDimension`, `countCompleteGames`, `legalLayers`; a private unguarded helper for the order of the Weyl group of a set of nodes (plan, 5.6 below) |
| `packages/engine/src/index.ts` | append the nine exports in one block headed by a comment `// phase 3 (P3-A1): weyl.ts` (plan, to ease the merge with `P3-A2`); change nothing else |
| `packages/engine/test/golden/p3a-exponents.test.ts` | `covers('types[*].exponents', 'types[*].weyl_order')`; both keys for all 32 types; the A3 tally of A.2; F7's `N = sum m_i` and `h = m_n + 1` |
| `packages/engine/test/golden/p3a-wave.test.ts` | `covers('types[*].bipartite_colouring')`; the colouring for all 32 types; the wave from rho for both start colours, rounds equal to `types[*].coxeter_number` for rank at least 2 (the second comparison of 5.7, without registering `coxeter_number`, which `P1-A1`'s file covers); A1; the A3 wave of A.2 |
| `packages/engine/test/golden/p3a-orbit-size.test.ts` | `covers('types[*].fundamental_orbit_sizes')`; `orbitSize` for every node of every type; the enumerated orbit where the size is at most 20000; `orbitSize` of any position against enumeration (verify lines 1677 to 1684) |
| `packages/engine/test/golden/p3a-games.test.ts` | `covers('types[*].n_reduced_words_w0', 'types[*].length_distribution')`; `countCompleteGames` and `legalLayers` on the 23 types where the keys are present; `null` above the caps; the F12 values |
| `packages/engine/test/golden/p3a-separating.test.ts` | no `covers()` (plan; a comment says no golden key stores separating roots): F5 on every type with `|W| <= 2000`; the B2 hand case |
| `packages/engine/test/golden/p3a-weyl-dimension.test.ts` | `covers('weyl_dimension')`; all 30 records; A.3; the E8 timing |
| `packages/engine/test/golden/p3a-e8.test.ts` | `covers('e8')`; the fundamental weights through `toPopulation`; the 56 neighbours through `formValue` |
| `packages/engine/test/golden/p3a-guards.test.ts` | no `covers()` (plan; a comment says why): the behaviour of every function of yours on a `one-way` board and on a `gcm` board that is not of finite type per 5.6; `bipartition` on odd and even cycles and on several components; purity; caps |
| `decisions/P3-A1.md` | the fragment of `COMMON.md` 5.1 with the entries listed in 5.12 below |

## 5. Requirements

### 5.1 Conventions at your boundary

- Every function takes positions and returns positions (E-7; `CONTRACTS.md` 2.4). No function of yours converts to labels. Tests convert golden lists with `labels`, `wordLabels` or `toPositions`; on the named finite boards labels are `1..n` in position order, so a list "in label order" is a list in position order there.
- Firing is `a_j <- a_j - C_ji a_i` for all j, so `a_i <- -a_i` (2.3). Legal means the number is **positive**; the game ends when none is positive. Use `fire` from `moves.ts`; never re-derive it.
- The lowest position first wherever a choice is free (E-5). Every play inside your functions uses `play` with its default rule, so the word from rho is the word of `types[*].longest_word` (A3: positions `[0, 1, 0, 2, 1, 0]`, labels `1, 2, 1, 3, 2, 1`, fired `1, 2, 1, 3, 2, 1`).
- Arithmetic is the board's (E-2): `Board<number>` with `SafeInt` for named finite boards, `Board<bigint>` with `Big` for boards from `fromAdjacency` that `identify` does not name. Write the functions generically over `Arith<T>`; E-2 allows writing a core function twice if generics prove awkward [D]. Products that can exceed 2^53 go through `arith.toBig` and `bigint` (E-4).
- Pure and deterministic (E-5): never mutate `a`, `lambda`, `fired` or a board; no hidden state other than the cache of E-11, which you only read through `guards.ts`.
- Nothing in `src/` imports from outside `src/`; no new dependency (`CONTRACTS.md` 2.1).

### 5.2 Guards (5.6, E-10, E-11)

- `weylOrder`, `weylDimension`, `orbitSize`, `wavePlay`, `countCompleteGames`, `legalLayers`, `separatingRoots` are in the last row of the 5.6 function table: on a `one-way` board they "throw `NeedsTwoWayRoads`"; on a `gcm` board that is not of finite type they "throw `NotFiniteType`". Call `requireGcm` then `requireFinite` from `guards.ts` at the top of each; never decide finiteness by running a play or an enumeration into its cap (E-11, 5.6 last sentence).
- `bipartition` is in the row that "work[s] (roads in either direction join)" on a `one-way` board and works on every `gcm` board: no guard.
- `exponentsFromFired` takes no board and has no guard.
- Reaching a cap is never thrown (E-10). Your caps are reported as `null` (`countCompleteGames`, `legalLayers`).
- Error classes are the ones of `errors.ts` (`NeedsTwoWayRoads`, `NotFiniteType`), all `instanceof EngineError`.

### 5.3 `bipartition(board): [number[], number[]] | null`

- 5.3: "two colour classes, or `null` if the board has an odd cycle"; oracle `bipartition` (258 to 272), which raises `ValueError('not bipartite')` where you return `null`.
- Joined means a road in either direction: `C[i][j] != 0 || C[j][i] != 0` (the oracle's test; 2.1 "Two nodes are joined when at least one road runs between them, in either direction").
- The oracle walks the components in the order of `components` (each sorted, components in order of least position) and gives colour 0 to the **least position** of each component, then colours by depth-first search. Return class 0 (the positions with colour 0) first and class 1 second, each in increasing position (plan: the oracle returns a colour per node; sorted lists are the plan's reading of the contract type).
- On A1 the result is `[[0], []]`: class 1 is empty. On `square` it is `[[0, 2], [1, 3]]`; on `A2~` and on `pentagon` (odd cycles) it is `null`. On every finite-type board it is non-null (the diagrams are trees).
- Golden mapping: `bipartite_colouring` is a 0 or 1 per node in label order; the test builds `colour[i] = classes[0].includes(i) ? 0 : 1` for every position and compares with `intEq`.

### 5.4 `wavePlay(board, a, firstColour: 0 | 1): WaveResult<T>`

- 5.4: "rounds and legality of the wave"; F8: colour the nodes with two colours so that joined nodes differ; from rho "fire all nodes of one colour, then all of the other, and repeat; one **round** is the firing of one colour class. Every firing is legal and the game ends after exactly h rounds, whichever colour starts (on A3: 4 rounds, 6 moves). On A1 one colour class is empty and the statement degenerates to a single move."
- Oracle `wave_play` (275 to 287), exactly: colours from `bipartition`; `c = firstColour`; **while some number is positive**: for each position `i` of class `c` in increasing position, if `a[i] <= 0` set `legal = false`, then fire `i` regardless (the oracle fires the whole class even when a member is not positive); after the class, `rounds += 1` and `c = 1 - c`. The test for "some number positive" is made only between rounds. A start with no positive number gives `rounds: 0`, `legal: true`, `word: []`, `position` equal to the start.
- Return `WaveResult` (plan, `CONTRACTS.md` 2.2): `rounds`, `legal` (true when every firing was of a positive number), `position` (the end), `word` (every node fired, in order, as positions).
- A1 follows the oracle and verify line 207: from rho, `firstColour = 0` gives 1 round; `firstColour = 1` gives 2 rounds, the first of which fires the empty class. Both have `word` `[0]` and `legal: true`. T5 says "on A1 it is a single move and the tool says so" (4 T5); that is the tool's sentence, built on `word.length`, not a change to your count.
- From rho on every type of rank at least 2, for both start colours, `rounds` equals `coxeter_number`, `legal` is true and `word.length` equals N (E8: 30 rounds, 120 moves).
- A2 (Appendix A.2) on A3 from `(1, 1, 1)`, `firstColour = 0`: after round 1 (nodes 1, 3) `(-1, 3, -1)`; round 2 (node 2) `(2, -3, 2)`; round 3 (nodes 1, 3) `(-2, 1, -2)`; round 4 (node 2) `(-1, -1, -1)`. Word in positions `[0, 2, 1, 0, 2, 1]`.
- Termination cap (plan): from a start that is not dominant the wave can run for ever on a finite board (checked while drafting this file with the oracle: on A3 from `(2, -4, -3)` with the second colour first, and on B3, D4, F4 from many random starts, the oracle's loop reaches its cap). E-6 says "No function loops without a bound". The oracle's `wave_play` has `cap=10_000` and tests `rounds > cap` after each round, so it raises `OverflowError` after round 10001, not after round 10000. Bound the loop at the same point (plan): stop after the round that makes `rounds` exceed 10000, so a wave that ends within 10001 rounds behaves as the oracle's does. Neither `SPEC.md` nor `CONTRACTS.md` says what to return there and `WaveResult` has no `status` field; E-10 forbids throwing at a cap. Return the `WaveResult` reached at the bound (rounds 10001) (plan), record the choice in your fragment, and put the missing `status` under `openQuestions` as a contract amendment for the orchestrator. Do not add a field to `WaveResult` on your own.

### 5.5 `exponentsFromFired(fired: readonly number[], n: number): number[]` and `weylOrder(board): number`

- F7: "Let k_j be the number of times the value j is fired in the game from rho. Then k_1 >= k_2 >= ..., and the conjugate partition is the list of exponents m_1 <= ... <= m_n. Further N = sum m_i, h = m_n + 1 and |W| = prod(m_i + 1)." Compute the exponents from the tally of fired numbers; do not compute them from eigenvalues.
- Oracle `exponents_from_fired` (290 to 293), exactly: tally the values; for `i = 1..n` count the distinct values `k` whose tally is at least `i`; return those n counts sorted ascending. A3: fired `[1, 2, 1, 3, 2, 1]`, tally `{1: 3, 2: 2, 3: 1}`, exponents `[1, 2, 3]`. B3: fired `[1, 2, 1, 5, 4, 3, 3, 2, 1]`, tally `{1: 3, 2: 2, 3: 2, 4: 1, 5: 1}`, exponents `[1, 3, 5]`.
- `weylOrder` (oracle 296 to 304): `play` from rho with the lowest-position rule, `exponentsFromFired(fired, n)`, return `prod(m_i + 1)` as a number. The oracle returns 1 for an empty matrix. Compute the product in `SafeInt` (plan) so that an impossible overflow throws `EngineOverflow` instead of returning a wrong number; E-4 says group orders fit in safe integers on 12 nodes. On a `Big` board convert each fired value with `Number(...)` before tallying (the values are at most h - 1).
- Guard: finite only (5.2 above).

### 5.6 `orbitSize(board, a): number`

- 5.4: "the size of the orbit of any position, without enumeration: play a to the end, let J be the nodes where the end is zero, and return |W| / |W_J|". The oracle's `orbit_size` (1425 to 1431) "takes a position with no negative number" and asserts it; yours takes **any** position, so play it to the end first (`play`, lowest-position rule), then take the zeros of the end. verify lines 1677 to 1684 check the same rule by negating the end; the set of zeros is the same.
- `|W_J|` (plan, as `P4-A1`'s instruction does for the same quantity): 1 for the empty set; otherwise the product over the connected components of J (`components` of `subBoard(board, J)`) of the order of each component's group. Use a private unguarded helper so that an empty sub-board never meets `requireFinite` and no sub-board pays for a second `classify`; the oracle's `weyl_order(sub_matrix(C, J))` on a disconnected sub-matrix equals this product.
- Examples: `orbitSize(A2, [1, 0])` is 3; `orbitSize(A2, [-1, 1])` is 3 (the end is `[0, -1]`); a zero position has orbit size 1; `orbitSize(D4, [0, 1, 0, 0])` is 24; E8 gives the eight values of `fundamental_orbit_sizes`, including 483840, without enumerating anything.
- It must stay cheap (one play of at most N moves plus small plays): E-9 item 1 lets the site decide from `orbitSize` that an orbit is small enough for the main thread.
- Guard: finite only.

### 5.7 `weylDimension(board, lambda: readonly number[]): bigint`

- F9: "Record the word of any complete game from rho and the product D of the numbers fired. Replay the same word from lambda + rho and let M be the product of the numbers fired. Then dim V(lambda) = M / D."
- Oracle `weyl_dimension` (307 to 320), exactly: `play` from rho (lowest-position rule) gives `word` and `fired_rho`; start at `lambda + rho` (add 1 to every entry); for each node of `word`, multiply `M` by the current number at that node, then fire it; `D` is the product of `fired_rho`; return `M / D`. All of it in `bigint` (E-4: for E8 the product exceeds 2^53, verify line 340). Never floats.
- `lambda` is in positions, in the board's node order, and is dominant (4 T5: "for a chosen dominant lambda"). The oracle asserts every number met along the word is positive and that `D` divides `M`. What the engine does for a `lambda` of the wrong length or with a negative entry is not specified: throw `RangeError` (plan, the same choice `toPositions` makes for bad input), record it, and list it under `openQuestions`. A remainder from `M / D` on a dominant `lambda` cannot happen; if it does, throw an `Error` naming the board (plan) rather than return a rounded value.
- A.3: A2, `lambda = (1, 1)`: word 1, 2, 1; from rho fired `1, 2, 1` (product 2); from `(2, 2)` fired `2, 4, 2` (product 16); quotient 8. G2, `lambda = (1, 0)`: word 1, 2, 1, 2, 1, 2; fired `1, 2, 5, 3, 4, 1` (120) and `2, 3, 7, 4, 5, 1` (840); quotient 7. B2, `lambda = (0, 1)`: word 1, 2, 1, 2; fired `1, 3, 2, 1` (6) and `1, 4, 3, 2` (24); quotient 4.
- Roster acceptance: "weylDimension of E8 lambda for 3875 computes in under a second" (`lambda = [1, 0, 0, 0, 0, 0, 0, 0]`).
- Guard: finite only.

### 5.8 `countCompleteGames(board, cap?: number): bigint | null`

- F12: "The number of complete legal games from rho is the number of reduced words of w_0". 5.5 "Counting games": "dynamic programming over positions layer by layer from all ones; counts are `bigint`. Offered for |W| <= 60000." 5.6: "Group order for counting games: 60000: count not offered".
- Oracle `count_reduced_words_w0` (323 to 339): `count = {rho: 1}`; for each layer, for each position `a` in the layer and each node `i` in increasing position with `a[i] > 0`, add `count[a]` to `count[fire(a, i)]` in the next layer; when the next layer is empty the last layer holds one position (`-rho`) and its count is the answer. Key positions by their entries joined as decimal text (`arith.show`, as 5.5 "Orbits" does). Counts are `bigint` (E-4) even though every golden value is below 2^53.
- Cap: default `CAPS.countGamesGroup` (60000). Return `null` exactly when `|W| > cap` (plan reading of "offered for |W| <= 60000"; the oracle's own limit is 70000 positions found, which gives the same presence on all 32 types because the smallest group order above 60000 among the 32 types is D7's 322560). Check `weylOrder(board) > cap` before the dynamic programme so that no layer is built for a group that is too large (plan). The engine accepts any cap the caller passes (5.5: "The engine itself accepts any cap").
- Values: A2 to A5 `2, 16, 768, 292864`; B2 to B4 and C2 to C4 `2, 42, 24024`; D4 `2316`; D5 `12985968`; F4 `2144892`; G2 `2`; A1 `1`; E6 `1266633313578528` (`|W| = 51840`, so E6 **is** counted); E7 and E8 give `null`.
- E-9 item 3 sends "the counts of games and of heaps on a board whose group has more than 2000 elements" to the worker; that decision is the site's (`worker.ts`), not yours. Your function is synchronous.
- Guard: finite only.

### 5.9 `legalLayers(board, start?, cap?): number[] | null`

- 5.4: "positions first reached after 0, 1, 2, ... legal moves; `null` when more than `cap` positions are found (default 100000)". Default `start` is rho (the board's `arith.one` on every node); default `cap` is `CAPS.legalLayersDefault`.
- Oracle `legal_layers` (1381 to 1387): `orbit_graph` with `legal_only=True` from `[start]`, then the number of positions at each depth from 0 to the largest. Port it on `orbitGraph(board, [start], 'firing', cap, undefined, true)`: the search order and the cap behaviour of 5.5 are `P1-A1`'s; `truncated: true` means the search was about to add position `cap + 1`, which is exactly "more than `cap` positions are found", so return `null` then. The oracle raises `OverflowError` at the same point (its default cap is also 100000).
- From rho the result is `length_distribution` (A2 `[1, 2, 2, 1]`, A3 `[1, 3, 5, 6, 5, 3, 1]`): N + 1 entries, symmetric, summing to `|W|` (verify line 266). From another start: A2 from `[1, 0]` gives `[1, 1, 1]`.
- Guard: finite only.

### 5.10 `separatingRoots(board, a): T[][]`

- 5.4: "positive roots beta with <a, beta^vee> < 0"; F5: their number is the least number of moves that reaches `a` from the start, "the mirrors that separate the position from the start".
- Oracle `separating_roots` (1390 to 1394): from `positive_roots(roots(C))`, keep each `b` with `sum(a_i * coroot_coords(C, b)_i) < 0`. Port it on `positiveRoots(board)` and `coroot(board, b)`; keep the order of `positiveRoots` (by total, then lexicographically). Pair `a` with the **coroot** of beta, not with beta: on B2 (`C = [[2, -1], [-2, 2]]`), the positive roots `(0, 1), (1, 0), (1, 1), (1, 2)` have coroots `(0, 1), (1, 0), (2, 1), (1, 1)`, and `separatingRoots(B2, [2, -3])` is `[[0, 1], [1, 2]]`; pairing with the roots themselves would wrongly give `[[0, 1], [1, 1], [1, 2]]`.
- More hand values: B2 from rho `[]`; `[-1, 3]` gives `[[1, 0]]`; `[2, -1]` gives `[[0, 1]]`; `[-1, -1]` gives all four.
- Return the roots as populations in the board's arithmetic.
- Guard: finite only.

### 5.11 Golden tests (5.7), one key in one file

Use only the harness helpers; never re-implement a comparison rule (`CONTRACTS.md` 3). Iterate `TYPE_NAMES` and build boards with `boardOf`.

- `types[*].exponents`: `exponentsFromFired(play(board, ones).fired, n)` against the stored list. `types[*].weyl_order`: `weylOrder(board)`.
- `types[*].bipartite_colouring`: as 5.3.
- `types[*].coxeter_number`, second comparison: for every type of rank at least 2 and both `firstColour` values, `wavePlay(board, ones, c).rounds` equals the stored `coxeter_number` and `legal` is true. Do not register this key with `covers()`: a key is tested in exactly one file for coverage, and `P1-A1`'s file registers it; say so in a comment.
- `types[*].fundamental_orbit_sizes`: `orbitSize(board, e_i)` for every node i of every type; and `orbit(board, [e_i], 'firing', cap).items.length` with `truncated: false` wherever the stored size is at most 20000 (5.7).
- `types[*].n_reduced_words_w0`: `countCompleteGames(board)` with `intEq` (bigint against JSON number) on the 23 types where present; rule 7: not tested where absent.
- `types[*].length_distribution`: `legalLayers(board)` in order on the same 23 types; also `sum` equals `weyl_order`.
- `weyl_dimension`: for each of the 30 records, `weylDimension(boardOf(type), highest_weight)` against `dimension` with `intEq`; rule 5: iterate the records and identify each by `type` and `highest_weight` (use `matchRecord` when you look one up, never an index).
- `e8` (without `h4_projection`): for each node i, `toPopulation(E8, e_i)` has every denominator 1 and its numerators equal row i of `fundamental_weights_in_root_coordinates`; for every one of the 240 roots of `roots(E8, cap)`, the number of roots `s` with `formValue(E8, r, s)` equal to 1 (`ratText` gives `"1"`) is `neighbours_at_inner_product_1` (56). The oracle checks the first ten roots; checking all 240 is the plan's.
- E8 norms of 2.14 (not a golden key; the table's "norm" column, [V]): `formValue(E8, toPopulation(E8, e_i))` is `2`, `4`, `6`, `8` (`ratText`) at the nodes labelled 8, 1, 7, 2. This is what the oracle's `weight_inner(C, e_i, e_i)` gives (checked while drafting this file: 4, 8, 14, 30, 20, 12, 6, 2 for nodes 1 to 8); assert the four values of the table, and the other four from the oracle as (plan).
- After `npm test -w packages/engine`, `coverage.json` must show none of your eight keys in `missingByPhase["3"]` (only `heaps` and `pentagon_example.complete_games`, `P3-A2`'s, may remain until `MERGE` combines the branches).

### 5.12 Decisions fragment (`decisions/P3-A1.md`)

One dated entry each for: the wave's bound and what it returns there (5.4); `weylDimension`'s `RangeError` on a bad `lambda` (5.7); `countCompleteGames` testing `|W| > cap` up front against the oracle's count of positions (5.8); the order of `bipartition`'s classes (5.3); the unguarded helper for `|W_J|` (5.6); whether you wrote the functions generically or twice (E-2 [D]); and the roster's E6 trap corrected (section 9).

## 6. Acceptance

Gate G3 runs `npm test -w packages/engine`; `MERGE` runs the same fast tests at the merge of stage 3.1. Each line below is one condition and the test that proves it.

- [ ] 5.7, `types[*].exponents` for all 32 types. `p3a-exponents.test.ts > exponents from the tally of the game from rho`. G3.
- [ ] 5.7, `types[*].weyl_order` for all 32 types (E8 696729600). `p3a-exponents.test.ts > weylOrder`. G3.
- [ ] F7: `N = sum m_i` and `h = m_n + 1` on every type; A.2 tally `(3, 2, 1)` gives exponents `1, 2, 3` and 24. `p3a-exponents.test.ts > F7 relations`, `> A3 tally of Appendix A.2`. G3.
- [ ] 5.7, `types[*].bipartite_colouring` for all 32 types. `p3a-wave.test.ts > bipartite colouring`. G3.
- [ ] 5.7, `coxeter_number` equals the wave rounds for rank at least 2, both start colours, every firing legal, N moves. `p3a-wave.test.ts > wave from rho lasts h rounds`. G3.
- [ ] F8 on A1: 1 round with the first colour, 2 with the second, one move each. `p3a-wave.test.ts > A1 wave`. G3.
- [ ] A.2 wave on A3: the four positions after each round, word `1, 3, 2, 1, 3, 2` in labels. `p3a-wave.test.ts > A3 wave of Appendix A.2`. G3.
- [ ] 5.7, `types[*].fundamental_orbit_sizes` against `orbitSize` for every node of every type, including E8's 483840. `p3a-orbit-size.test.ts > orbitSize of every fundamental weight`. G3.
- [ ] 5.7, the same against the enumerated orbit wherever the size is at most 20000. `p3a-orbit-size.test.ts > enumerated orbits up to 20000`. G3.
- [ ] 5.4, `orbitSize` of any position: 150 random positions with entries in `[-3, 3]` on A3, B3, D4, G2, F4 against the enumerated orbit, with a fixed seed. `p3a-orbit-size.test.ts > orbitSize of any position`. G3.
- [ ] 5.7, `types[*].n_reduced_words_w0` on the 23 types where present, as `bigint`. `p3a-games.test.ts > countCompleteGames`. G3.
- [ ] F12 values A2 to A5, B2 to B4, C2 to C4, D4, D5, F4, G2 as listed in 2.7. `p3a-games.test.ts > F12 counts`. G3.
- [ ] 5.6, count not offered above 60000: `countCompleteGames` is `null` on A8, B7, B8, C7, C8, D7, D8, E7, E8, and on A3 with `cap` 23 (plan). `p3a-games.test.ts > null above the cap`. G3.
- [ ] 5.7, `types[*].length_distribution` on the 23 types where present, in order, summing to `weyl_order`. `p3a-games.test.ts > legalLayers`. G3.
- [ ] 5.4, `legalLayers` returns `null` when more than `cap` positions are found: A3 with `cap` 23 gives `null`, with `cap` 24 gives the layers (plan). `p3a-games.test.ts > legalLayers cap`. G3.
- [ ] F5 and 5.4 `separatingRoots`: on every type with `|W| <= 2000`, for every position of `orbitGraph` from rho with `legalOnly`, the number of separating roots equals its depth and the length of `wordTo`; the B2 hand cases of 5.10. `p3a-separating.test.ts > depth equals separating mirrors`, `> B2 coroot pairing`. G3.
- [ ] 5.7, all 30 `weyl_dimension` records, including 3875 for E8. `p3a-weyl-dimension.test.ts > thirty records`. G3.
- [ ] A.3: A2 `(1, 1)` gives 8, G2 `(1, 0)` gives 7, B2 `(0, 1)` gives 4, with the stated products. `p3a-weyl-dimension.test.ts > Appendix A.3`. G3.
- [ ] Roster: `weylDimension` of E8 for 3875 computes in under a second (measured with `performance.now()`). `p3a-weyl-dimension.test.ts > E8 3875 under one second`. G3.
- [ ] 5.7, `e8.fundamental_weights_in_root_coordinates` through `toPopulation`. `p3a-e8.test.ts > fundamental weights`. G3.
- [ ] 5.7, `e8.neighbours_at_inner_product_1` (56) through `formValue` for all 240 roots. `p3a-e8.test.ts > 56 neighbours`. G3.
- [ ] 2.14, the norms of `omega_8`, `omega_1`, `omega_7`, `omega_2` are 2, 4, 6, 8 through `formValue` of `toPopulation(E8, e_i)` (the oracle's `weight_inner`). `p3a-e8.test.ts > fundamental weight norms`. G3.
- [ ] 5.6: each of `weylOrder`, `weylDimension`, `orbitSize`, `wavePlay`, `countCompleteGames`, `legalLayers`, `separatingRoots` throws `NeedsTwoWayRoads` on `fromAdjacency([[0, 1], [0, 0]])` and `NotFiniteType` on `boardFromName('A2~')`, each `instanceof EngineError`. `p3a-guards.test.ts > one-way board`, `> affine board`. G3.
- [ ] 5.3 and 5.6: `bipartition` works on every board: `[[0], [1]]` on the one-way road, `null` on `A2~` and `pentagon`, `[[0, 2], [1, 3]]` on `square`, `[[0], []]` on A1, and colour 0 at the least position of each component of a board in two pieces. `p3a-guards.test.ts > bipartition on any board`. G3.
- [ ] E-5: no function mutates its arguments (frozen inputs). `p3a-guards.test.ts > purity`. G3.
- [ ] Roster: the phase-3A keys covered and passing: `coverage.json` lists `types[*].exponents`, `types[*].weyl_order`, `types[*].bipartite_colouring`, `types[*].fundamental_orbit_sizes`, `types[*].n_reduced_words_w0`, `types[*].length_distribution`, `weyl_dimension`, `e8`. Paste the `node -e` line that prints `keys` and `missingByPhase["3"]` and its output in `commandsRun`. G3.
- [ ] COMMON 4.3: `npx tsc --noEmit -p packages/engine` exits 0. G3.

## 7. Files

- **You own** (the roster's list, exactly):
  - `packages/engine/src/weyl.ts, index.ts (exports)`
  - `packages/engine/test/golden/p3a-*.test.ts`
  - `decisions/P3-A1.md`
- **You may edit with the stated protocol**: `packages/engine/src/index.ts`, append only (one export block for `weyl.ts`); `P3-A2` appends its own block in the same stage and `MERGE` combines them. The generated, uncommitted `packages/engine/test/golden/coverage.json` and `.coverage/` entries that your test run writes.
- **You must not touch**: everything else; in particular `reference/` (read-only for everyone), `DECISIONS.md`, root `package.json` and the lockfile, `packages/engine/package.json`, `tsconfig.json`, `packages/engine/vitest.config.ts`, `packages/engine/test/golden/_harness.ts` (add helpers in your own test files, never change a comparison rule), the `src/` files of phases 0 to 2 (`arith.ts`, `errors.ts`, `caps.ts`, `board.ts`, `moves.ts`, `rational.ts`, `linalg.ts`, `search.ts`, `play.ts`, `finite.ts`, `classify.ts`, `affine.ts`, `form.ts`, `guards.ts`), `P3-A2`'s files (`src/heaps.ts`, `src/geometry.ts`, `test/golden/p3b-*.test.ts`, `test/properties/p12-heaps.test.ts`, `test/bench/orbit.bench.ts`), `P3-A7`'s files (`scripts/lab.mjs`), the tests of earlier phases, anything under `site/` or `scripts/`, `content/unverified.json`, `main`.

## 8. Order of work

1. Confirm the worktree and branch (`git rev-parse --show-toplevel`, `git branch --show-current`), `node --version`, and the three reference hashes of `CONTRACTS.md` 9. Run `npm ci --prefer-offline` once if `node_modules` is absent. Run `npm test -w packages/engine` to see the phase 0 to 2 suite green before you change anything.
2. Read the oracle functions of section 2 item 13 and print the golden shapes of item 15 with a script file.
3. Tests first (COMMON 4.3; SPEC 9.3): write `p3a-exponents.test.ts` and `p3a-wave.test.ts` against stubs that throw; see them fail. Write `bipartition`, `exponentsFromFired`, `weylOrder`, `wavePlay`; see them pass. Commit: `P3-A1: bipartition, exponents, group order, wave`.
4. `p3a-orbit-size.test.ts`, then the `|W_J|` helper and `orbitSize`. Commit.
5. `p3a-weyl-dimension.test.ts` and `p3a-e8.test.ts`, then `weylDimension`. Commit. This is the first usable increment for `P3-A3` (T5 needs exponents, order, wave and dimension).
6. `p3a-games.test.ts` and `p3a-separating.test.ts`, then `countCompleteGames`, `legalLayers`, `separatingRoots`. Commit.
7. `p3a-guards.test.ts`; add the guards and the wave bound; append the exports to `index.ts`. Commit: `P3-A1: guards, caps, exports`.
8. `npx tsc --noEmit -p packages/engine`; `npm test -w packages/engine`; read `coverage.json`; write `decisions/P3-A1.md`; final commit; report.

## 9. Traps

1. **Exponents from the tally, not from eigenvalues** (roster). F7: the exponents are the conjugate partition of the tally of fired numbers from rho, "read sideways". Do not compute them from the eigenvalues of the Cartan matrix or from a table.
2. **`orbitSize` takes any position: play it to the end first** (roster; 5.4). The oracle's `orbit_size` asserts a dominant argument; copying it literally would give wrong sizes for every non-dominant position (the zeros of a non-dominant position are not the stabiliser).
3. **`countCompleteGames` must be `bigint`** (roster, corrected). The roster's trap reads "12985968 for D5 fits a number but E6 does not (5.6: offered only for |W| <= 60000, so E6 returns null)". Both halves are wrong against the golden file and 5.6: `|W(E6)| = 51840` is below 60000, so E6 is counted and must return `1266633313578528n` (`types.E6.n_reduced_words_w0` is present), and that value is below 2^53. The types that return `null` at the default cap are A8, B7, B8, C7, C8, D7, D8, E7, E8. The reason for `bigint` is E-4, not a golden value that overflows. Record the correction in your fragment and report it under `openQuestions`.
4. **The wave fires the whole class even when a member is not positive**, and checks "some number positive" only between rounds. Do not stop mid-round and do not skip a non-positive node; set `legal = false` and fire it, as the oracle does.
5. **The wave on A1 with the second colour first counts an empty round**: 2 rounds, 1 move (verify line 207: `rounds == 1 + first`). T5's sentence "a single move" is about moves.
6. **The wave can run for ever from a non-dominant start on a finite board** (5.4 above): bound it; do not assume termination.
7. **Coroots, not roots, in `separatingRoots`**: on simply laced boards they coincide, so only a B, C, F or G test catches a pairing with beta instead of beta^vee. Use the B2 case of 5.10.
8. **Positions against labels.** `weyl_dimension.highest_weight`, `bipartite_colouring` and `fundamental_orbit_sizes` are in label order; on the named finite boards that is position order, so a missing `toPositions` goes unnoticed in the golden tests. Keep the engine in positions anyway (E-7); no function of yours returns labels.
9. **Rows against columns in the E8 weights.** `fundamental_weights_in_root_coordinates[i]` is `omega_{i+1}`, a column of `C^{-1}` (verify line 1298: `fw = [[int(Cinv[j][i]) for j in range(8)] for i in range(8)]`, so `fw[i][j] = Cinv[j][i]`). E8's Cartan matrix is symmetric, so this test cannot catch a transposition; it is not evidence that `toPopulation` is right on B or G boards (that is `P1-A1`'s test).
10. **`neighbours_at_inner_product_1` is the integer 56**, not a list of roots. Compare a count.
11. **`|W_J|` on an empty or disconnected sub-board.** J is often empty (rho has no zero) or disconnected (D4 with J the three outer nodes). Do not call the guarded `weylOrder` on `subBoard(board, J)`: an empty board may not be constructible. A board in several pieces is not the reason: `P2-A1`'s instruction (its 5.13) has `requireFinite` treat a board as finite when every component is finite (plan), so the guard would pass a disconnected finite J; the helper still avoids a guard call and a `classify` per sub-board on a path that E-9 item 1 wants cheap. Use the private helper of 5.6.
12. **The count's cap is on the group order, the oracle's on positions found.** The oracle's `count_reduced_words_w0` stops when `seen > 70000`; the specification offers the count for `|W| <= 60000`. Use `CAPS.countGamesGroup`, never the literal 70000 or 60000.
13. **`legalLayers` and the cap.** `null` means more than `cap` positions, which is `orbitGraph`'s `truncated: true`. A cap equal to `|W|` must still return the layers. Do not raise or lower `CAPS.legalLayersDefault` to make a test faster (COMMON 4.5).
14. **`weylDimension` replays the same word** (F9, oracle): the word of the game from rho, applied to `lambda + rho`, not a fresh legal play from `lambda + rho`. By F6 the product would come out the same, but the oracle multiplies along the replayed word and T5 shows that tape ("the tape from lambda + rho along the same word", 4 T5), so keep the oracle's procedure. The numbers met along that word from `lambda + rho` are all positive when `lambda` is dominant.
15. **No floats anywhere** (E-1): not in `weylDimension`, not in `orbitSize` (exact integer division of two safe integers), not in the counts.
16. **Purity.** `play` returns a fresh position; still, never sort or tally in place on the caller's `fired` array.
17. **Tests that pass against an empty implementation are forbidden** (COMMON 4.3, 4.4). Every golden test must fail if the function returns `[]`, `0`, `0n` or `null`; check this once by hand with a stub before you write the function.
18. **Performance.** `countCompleteGames` on E6, B6, C6 and A7 builds about 40000 to 52000 positions with `bigint` sums; it runs in Node in the tests, and the site sends it to the worker above 2000 elements (E-9 item 3). Keep the inner loop on arrays and string keys; do not enumerate all complete games (A5 alone has 292864).

## 10. Report

The JSON of `COMMON.md` 5.2. In addition:

- `acceptance` has one line per checklist item of section 6, with the test name.
- `commandsRun` includes `npm test -w packages/engine`, `npx tsc --noEmit -p packages/engine`, and the `node -e` line that prints `coverage.json`'s `keys` and `missingByPhase["3"]`, each with its summary line.
- `openQuestions` names: the wave's missing `status` field and what you return at the bound (5.4); `weylDimension`'s behaviour on a non-dominant or wrong-length `lambda` (5.7); the roster's E6 trap corrected (trap 3); and the README section 4 table, which lists `allCompleteGames` under `P3-A1` and `bipartition` under `P3-A2`, while the roster and `CONTRACTS.md` 2.1 and 2.4 give `bipartition` to you and `allCompleteGames` to `P3-A2` (you followed the roster and the contracts).
- `requests` names any change needed in `_harness.ts`, `vitest.config.ts`, `package.json` or `tsconfig.json` (to `MERGE`), and any behaviour of `play`, `orbitGraph`, `coroot`, `formValue` or `requireFinite` you had to work around (to the owning agent, with the test that shows it).
- `deviations` names anything in which you departed from `CONTRACTS.md` 2.2 to 2.5; the expected list is empty.
- `handoff` tells `P3-A3` that `wavePlay(board, ones, c).word` gives the moves of each round (split it by colour class with `bipartition`), that `exponentsFromFired` takes numbers, and that `weylDimension` returns `bigint` and expects a dominant `lambda` in positions; tells `P3-A5` the shape of `bipartition`'s result (class 0 holds the least position of each component); tells `P3-A6` that `countCompleteGames` and `legalLayers` return `null` above their caps and that `separatingRoots` returns populations in the order of `positiveRoots`; and tells `P4-A1` that `weylOrder` is guarded and that `|W_J|` for an empty or disconnected J needs its own product over components.
