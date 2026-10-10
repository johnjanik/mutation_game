# P0-A2: Engine core: arithmetic, boards, the two moves, errors, caps, golden harness

Phase 0, stage 0.2. Size S. Runs in: a worktree on branch `agent/P0-A2`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies. Where this file says (plan), the rule is the build plan's addition and not the specification's; where it says [D], `SPEC.md` marks the point as a design decision open to the owner; nothing you build in this task is marked [U].

## 1. Objective

When you are done, `packages/engine` holds the phase-0 engine of `SPEC.md` section 5: the `Arith` interface with its `SafeInt` and `Big` instances, the `Board` type with labels, `cartan` for every finite family at any rank the family allows, `boardFromName` for finite names, `fromAdjacency` and `adjacency`, `boardKind`, `toLabels` and `toPositions`, `cartanNumbers`, `mutate` and `fire`, every error class of E-10, and the caps module. Beside it stands the golden-test harness that every later engine agent will import: the parsed golden file, the seven comparison rules of 5.7 implemented once, the phase table of golden keys in machine-readable form, and the coverage registry `covers()`. The phase-0 golden tests for all 32 types, property test 1, and the unit tests for labels and overflow pass. This is the foundation that the board component of `P0-A5` hydrates against in stage 0.3 and that gate G0 measures: "phase 0 golden tests pass for all 32 types".

## 2. Read first, in this order

Read in full unless the item says reference.

1. `SPEC.md` 2.1, in full: the board, $A_{ij}$ as roads from $i$ to $j$, $C=2I-A^{\mathsf T}$, the three kinds `gcm`, `one-way`, `not-a-board`, and Wildberger's edge type $(m,n)$. This fixes `fromAdjacency`, `adjacency` and `boardKind`.
2. `SPEC.md` 2.2, in full: the mutation, only entry $i$ changes, $S_i=I-e_ie_i^{\mathsf T}C$. This fixes `mutate`.
3. `SPEC.md` 2.3, in full: firing, $a_j\mapsto a_j-C_{ji}a_i$ for all $j$, $R_i=I-Ce_ie_i^{\mathsf T}$, and the sign convention of legal play (not used in phase 0, but the sign must not be touched). This fixes `fire`.
4. `SPEC.md` 2.4, in full: the translator $a=Cp$, $CS_i=R_iC$, and the bridge sentence of (a). Property 2 of 5.7 (phase 1) will test your `mutate` and `fire` against each other; read it so that you port both sides from the same convention.
5. `SPEC.md` 2.8, in full: Bourbaki numbering of every finite family, the four reference matrices, the table of the 32 types, and the paragraph "Names in rank 2". This fixes `cartan`.
6. `SPEC.md` 5 (opening paragraph) and 5.1, E-1 to E-11, in full. E-2 (two arithmetics, both in phase 0), E-5 (pure, deterministic), E-7 (positions inside, labels at the boundary, with the table of labels and the sentence on the unit test that this task writes), E-8 (three kinds of board), E-10 (error classes), E-11 (the engine guards, from phase 2; not in phase 0).
7. `SPEC.md` 5.2, in full: the `Arith` interface and the `Board` type, verbatim the contract you implement.
8. `SPEC.md` 5.3, the rows with phase 0 (`cartan`, `boardFromName`, `fromAdjacency` and `adjacency`, `boardKind`, `toLabels` and `toPositions`); 5.4, the rows `mutate` and `fire`. Read the rest of 5.3 and 5.4 as reference, so that `index.ts` and the types leave room for what follows.
9. `SPEC.md` 5.6, in full: both tables. The first gives the numbers of `caps.ts`; the second says what `mutate` and `fire` do off the finite boards (they "work as defined").
10. `SPEC.md` 5.7, in full: the golden table (your `GOLDEN_KEYS_BY_PHASE`), the seven comparison rules (your harness), the thirteen property tests (you write number 1), and "Regenerating the golden data" (you never do; `P0-A6` writes `verify.mjs`).
11. `SPEC.md` Appendix A.1, in full: the three rank 2 boards with firing tables from $(1,1)$ and mutation lines. These are your hand-checked test vectors for `fire` and `mutate` on asymmetric boards.
12. `SPEC.md` Appendix G, in full: the schema of the golden file, the list of fields that hold node labels, and the record-matching fields. Your `GoldenData` type and the harness helpers follow it.
13. Reference: `SPEC.md` 2.11 (the one-way play $(1,0)\to(1,1)\to(-1,1)$, a test vector for `mutate` on a one-way board), 7.3 (the engine's place in the repository), 7.7 (the test commands), 9.1 (the G0 row), 9.3, Appendix H.
14. Oracle, `reference/lie_games.py`: the module docstring, lines 1 to 27 (conventions, identical to section 2); `cartan`, lines 32 to 67 (note the two-argument signature `cartan(letter, n)` and the helper `link(i, j, cij, cji)` with 1-based arguments); `transpose`, line 82, and `adjacency`, lines 86 to 89; `mutate`, lines 138 to 142; `fire`, lines 145 to 148; `mutation_matrix` and `firing_matrix`, lines 151 to 158 (phase 1, but they show which index is the row); `board_kind`, lines 1012 to 1026; `board_from_name`, lines 1786 to 1808, the finite branch being the regular expression `([A-G])(\d+)(~?)` and the two lines that return `C, list(range(1, len(C) + 1))`.
15. `reference/verify.py`: line 91 (`TYPES`, the order of the 32 records), lines 128 and 280 (how a `types` record is written), line 603 (the oracle's own check that `board_from_name(t)[0]` equals `types[t].cartan`), line 940 (`one_way_counterexample`), lines 1415 to 1428 (`bigint_test`, including the loop at lines 1421 to 1425 that sets `first_unsafe = k + 1`), line 1534 (the oracle's two `not-a-board` examples).
16. Golden keys, shapes (print them with `python3 -I -c "import json; d=json.load(open('reference/golden_data.json')); print(d['types']['B2']['cartan'], d['types']['B2']['adjacency'])"` and the like):
    - `types` is an object whose 32 keys, in file order, are `A1` to `A8`, `B2` to `B8`, `C2` to `C8`, `D4` to `D8`, `E6`, `E7`, `E8`, `F4`, `G2`. `types[T].cartan` and `types[T].adjacency` are lists of rows of integers, positions in Bourbaki order. For example `types.B2.cartan` is `[[2, -1], [-2, 2]]` and `types.B2.adjacency` is `[[0, 2], [1, 0]]`; `types.G2.cartan` is `[[2, -3], [-1, 2]]` and `types.G2.adjacency` is `[[0, 1], [3, 0]]`.
    - `conventions` is an object of nine one-line strings (`node_labels`, `cartan`, `adjacency`, `mutation`, `firing`, `legal_firing_rule`, `longest_word_rule`, `rank_two_naming`, `floats`). Read it; no test compares it.
    - `classification_tests` is a list of 13 records `{label, cartan, components, smallest_nonfinite_subboard, spectral_radius_4_decimals}`; each `components[k]` has `kind` (`"gcm"` or `"one-way"`). Twelve boards are `gcm`; the record labelled `one-way road` has `cartan` `[[2, 0], [-1, 2]]`. You use only `cartan` and `components[*].kind`.
    - `one_way_counterexample` is `{cartan: [[2, 0], [-1, 2]], start: [1, 0], moves: [2, 1], result: [-1, 1]}`; `moves` are labels of mutations.
    - `bigint_test` is `{cartan: [[2, -3], [-3, 2]], population_start: [1, 0], mutation_nodes: <200 labels, 2, 1, 2, 1, ...>, population_end: <two decimal strings>, numbers_start: [1, 0], firing_nodes: <200 labels, 1, 2, 1, 2, ...>, firing_mode: "free play", numbers_end: <two decimal strings>, first_move_after_which_an_entry_exceeds_2_to_53: 39}`.
17. `CONTRACTS.md` 1 (package names, commands), 2.1 (which file holds what), 2.2 (types, verbatim), 2.3 (caps), 2.4 phase 0 (signatures, verbatim), 2.5, 3 (the harness, verbatim), 9 (reference hashes), 10 (branch and commit form). Read 2.4 phases 1 and 2 as reference so that nothing you write blocks them.

## 3. Inputs you depend on

All of this must be on `main` from `P0-A1` (stage 0.1) when you start. If any item is missing, stop and report `blocked` for the parts that need it; do not create it yourself.

- Root `package.json` with workspaces `packages/*` and `site`, `"engines": {"node": ">=22.12"}`, exact pins of `typescript` 6.0.x, `vitest` 5.0.x and `fast-check` 4.x (`SPEC.md` 7.1 names `vitest` 5.0.3 and `fast-check` 4.10.2; `P0-A1` may have moved to the nearest existing version and recorded it). A committed `package-lock.json`. `node_modules` installed, or install with `npm ci --prefer-offline` once at the root.
- `packages/engine/package.json` named `@two-games/engine`, `"type": "module"`, `"dependencies": {}`, development dependencies `typescript`, `vitest`, `fast-check` only; `packages/engine/tsconfig.json` strict; `packages/engine/vitest.config.ts` (you will edit it); `packages/engine/src/index.ts` with an empty export (you will replace it). The root Vitest configuration (`vitest.workspace.ts`, or a root `vitest.config.ts` with `test.projects`; `CONTRACTS.md` 1 says `P0-A1` records which file Vitest 5.0.3 reads) listing `packages/engine` as a project.
- `reference/golden_data.json`, `reference/lie_games.py`, `reference/verify.py` with the SHA-256 values of `CONTRACTS.md` section 9. Verify them yourself before writing a line (section 8, step 1). `reference/` is read-only for everyone.
- Node 22.12 or later (`node --version`; otherwise stop and report).
- Nothing from `site/` and nothing from the other stage 0.2 agents (`P0-A3`, `P0-A6`). The engine imports nothing outside `packages/engine/src`.

## 4. Deliverables

| File | Contents |
|---|---|
| `packages/engine/src/arith.ts` | `Arith<T>`; `SafeInt: Arith<number>` (every `add`, `sub`, `mul`, `fromInt` result checked with `Number.isSafeInteger`, failure throws `EngineOverflow`); `Big: Arith<bigint>`; `show()` as decimal text; `toBig()`; the type aliases `Vec<T>` and `Matrix<T>` (plan placement); re-export of `EngineOverflow` from `errors.ts` (plan, so that both file descriptions of `CONTRACTS.md` 2.1 hold) |
| `packages/engine/src/errors.ts` | `EngineError` base; `NotABoard`, `NeedsTwoWayRoads`, `NeedsConnectedBoard`, `NotFiniteType`, `NotAffine` (message carries the class), `NotAdmissible` (carries the `Admissibility`), `EngineOverflow`; the interfaces `Admissibility` and `Reason` of `CONTRACTS.md` 2.2, verbatim, because `NotAdmissible` carries one (plan placement) |
| `packages/engine/src/caps.ts` | `export const CAPS = { ... } as const` with exactly the numbers of `CONTRACTS.md` 2.3 |
| `packages/engine/src/board.ts` | `Board<T>`, `AnyBoard`; `cartan(name)`; `boardFromName(name)` for finite names; `fromAdjacency(A)`; `adjacency(board)`; `boardKind(C)`; `toLabels`, `toPositions`; `cartanNumbers(board)` |
| `packages/engine/src/moves.ts` | `mutate`, `fire`, generic over the board's `Arith`; the type aliases `Word`, `Game`, `Choose` of `CONTRACTS.md` 2.2 (plan placement; phase 1 appends `mutationMatrix`, `firingMatrix` and the rest) |
| `packages/engine/src/index.ts` | re-exports the public API of the five files above and nothing else; later agents append their exports |
| `packages/engine/test/golden/_harness.ts` | everything of `CONTRACTS.md` section 3: `golden`, `TYPE_NAMES`, `boardOf`, `covers`, `GOLDEN_KEYS_BY_PHASE`, `labels`, `wordLabels`, `intEq`, `ringsEq`, `ratText`, `matchRecord`, `sortedPositiveRoots`; the `GoldenData` type; the hash guard of 5.8 (plan) |
| `packages/engine/vitest.config.ts` | `P0-A1`'s configuration plus the global setup or reporter that collects `covers()` registrations into `packages/engine/test/golden/coverage.json` after every run; include patterns for `test/golden`, `test/properties`, `test/unit` |
| `packages/engine/test/golden/p0-types-cartan.test.ts` | the phase-0 golden tests on all 32 types; calls `covers('types[*].cartan', 'types[*].adjacency')` |
| `packages/engine/test/golden/p0-board-kind.test.ts` | `boardKind` on every `classification_tests[*].cartan`, on `one_way_counterexample.cartan`, on `bigint_test.cartan` and on hand-written matrices that are not boards; `fromAdjacency` on a one-way adjacency; calls no `covers()` (it reads keys of phases 1 and 2 as inputs only; see 5.9) |
| `packages/engine/test/properties/p1-involution.test.ts` | property 1 of 5.7 with `fast-check` and a fixed seed recorded in the file |
| `packages/engine/test/unit/labels.test.ts` | the E-7 unit test on a hand-built board with labels `[0, 1, 2, 3]`, and the finite counterpart |
| `packages/engine/test/unit/overflow.test.ts` | `SafeInt` overflow on the `bigint_test` board, the exact move at which it throws, the `Big` replay to `population_end`; the small `Arith` instance checks |
| `packages/engine/test/unit/moves.test.ts` | (plan addition of this instruction, under the README section 4 rule that every build agent owns its own tests) the Appendix A.1 firing tables and mutation lines on $A_2$, $B_2$, $G_2$, the one-way play of 2.11, purity of arguments; see 5.9 |
| `packages/engine/test/unit/harness.test.ts` | (plan addition, same rule) self-checks of the comparison helpers, of `TYPE_NAMES`, of the key spellings in `GOLDEN_KEYS_BY_PHASE`, of `"dependencies": {}` and of "src imports nothing outside src"; the `CAPS` values of `CONTRACTS.md` 2.3, the E-10 error classes, and the public API of `index.ts` (5.7); see 5.9 |
| `decisions/P0-A2.md` | one dated entry per decision, in the form of `COMMON.md` 5.1; the list of what to record is in 5.11 |

## 5. Requirements

### 5.1 Conventions at your boundary

- `SPEC.md` section 2 is the single source of truth. $C_{ij}=\langle\alpha_i^\vee,\alpha_j\rangle$ (Kac, SageMath). $A_{ij}$ is the number of roads from $i$ to $j$, and $C=2I-A^{\mathsf T}$, so $C_{ij}=-A_{ji}$ for $i\ne j$ and $C_{ii}=2$. "So $-C_{ij}$ is the number of roads from $j$ **into** $i$." More roads run from the long node to the short node.
- E-7: inside the engine a node is a position $0,\dots,n-1$ "exactly as in the oracle, and row and column $k$ of every matrix belong to position $k$." A board carries `labels`; for a named finite-type board they are $1,\dots,n$ in Bourbaki order. "**Everything outside the engine uses labels**: the golden file, state objects, URLs, exports, the screen, announcements. Two functions, `toLabels` and `toPositions`, convert node lists and words; nothing else converts." Your functions take positions and return positions. The golden file holds labels; tests convert with `toLabels` and `toPositions` (comparison rule 2). E-7 ends: "No golden test would notice a stray `+ 1` on a board whose labels start at 0, so this is checked by a unit test on an affine board." That unit test is `labels.test.ts`.
- E-5: functions never mutate their arguments and have no hidden state. Where the oracle chooses, the engine chooses the same: lowest position first. Phase 0 has no function that chooses.
- E-1: integer arithmetic only. No floating point anywhere in your files.
- E-9: the engine is synchronous and knows nothing about workers, the DOM, the network or npm. Your `src/` files import only each other. No `node:*` import, no `console.log`, no `Math.random`, no `Date`.
- The bridge sentence of 2.4(a), which `SPEC.md` marks [D] and requires "with the same wording, wherever the two views are shown together", is for the tools and lessons, not for the engine; it is quoted here only so that you port both moves from the same reading of $a=Cp$: "**The number on node $i$ is the amount by which a mutation would lower city $i$.**" A positive number marks a mutation that lowers, zero one that changes nothing, a negative number one that raises. The identity your two moves must satisfy is $CS_i=R_iC$ (property 2, tested in phase 1 with `toNumbers`).
- If the engine and the oracle disagree on a value and you believe the oracle is wrong, follow `COMMON.md` 2 and `SPEC.md` 0.2 item 2: the oracle wins; do not change the engine to match your belief and do not edit `verify.py`; write a standalone script `reports/discrepancies/P0-A2-<n>.py` that imports `lie_games` and demonstrates the point, report that item with `status: blocked`, and continue with the rest of the task. In phase 0 this should not arise: every value you reproduce is a matrix printed in `SPEC.md` 2.8 or Appendix A.1 as well as in the golden file.
- `B_2` and `C_2` are one board with the nodes exchanged. `cartan("B2")` and `cartan("C2")` are both valid and give different matrices (the golden `types` holds both records). Computed names say `B2`; that rule belongs to `identify` and `classify` in phase 2, not to `cartan` or `boardFromName`, and a name that `fromAdjacency` derives from a matrix is a computed name too, so in phase 0 `fromAdjacency` gives the $C_2$ matrix no name (see 5.5). How the site shows the name is [D] (2.8 "Names in rank 2", decision D19) and is no concern of the engine.

### 5.2 `arith.ts`

Implement `SPEC.md` 5.2 verbatim, as `CONTRACTS.md` 2.2 restates it:

```ts
export interface Arith<T> {
  zero: T; one: T; fromInt(n: number): T;
  add(a: T, b: T): T; sub(a: T, b: T): T; mul(a: T, b: T): T; neg(a: T): T;
  sign(a: T): -1 | 0 | 1; eq(a: T, b: T): boolean;
  show(a: T): string;                    // decimal text; also the hash key
  toBig(a: T): bigint;                   // SafeInt and Big only
}
export const SafeInt: Arith<number>;     // every result checked with Number.isSafeInteger; failure throws EngineOverflow
export const Big: Arith<bigint>;
export type Vec<T> = readonly T[];
export type Matrix<T> = readonly (readonly T[])[];
```

- `SafeInt`: E-2, "JavaScript numbers, every result checked with `Number.isSafeInteger`, a failure throws `EngineOverflow`". Check the result of every `add`, `sub`, `mul` and `fromInt`; `neg` of a safe integer is safe. `Number.isSafeInteger(2 ** 53)` is `false`, so the largest value a `SafeInt` ever holds is $2^{53}-1$. `fromInt` of an unsafe number throws `EngineOverflow`; so does `fromInt` of a non-integer (plan: E-1 admits no non-integer, and the engine has no other error class for one).
- `SafeInt.sign` returns exactly `-1`, `0` or `1` (not `-0`: `Math.sign(-0)` is `-0`). Normalise `-0` to `0` in the results of `mul`, `neg` and `fromInt` (plan), so that `show` and `eq` behave as for the oracle's integers: `(-1) * 0` is `-0` in JavaScript.
- `SafeInt.show(a)` is `String(a)`; every safe integer prints as plain decimal digits with a leading `-` when negative. `SafeInt.toBig(a)` is `BigInt(a)`.
- `Big`: `0n`, `1n`, `BigInt(n)` for `fromInt` (an integer `n`), plain `bigint` operators, `show` is `a.toString()`, `toBig` is the identity.
- E-2 last sentence, marked [D]: "If generics prove awkward, writing the half-dozen core functions twice is acceptable; the tests do not care." Write `mutate` and `fire` once, generic over `board.arith`. If you fall back to two copies, keep the generic signatures of `CONTRACTS.md` 2.4 and record the choice in your fragment.

### 5.3 `errors.ts`

E-10 and `CONTRACTS.md` 2.2: all classes extend `EngineError` (plan), which extends `Error`. The exact class names: `EngineError`, `NotABoard`, `NeedsTwoWayRoads`, `NeedsConnectedBoard`, `NotFiniteType`, `NotAffine`, `NotAdmissible`, `EngineOverflow`.

- Each class sets `this.name` to its own class name, so that the worker of phase 1 can re-throw "as the same class" from `{ name, message, data? }` (`CONTRACTS.md` 4, `worker.ts`).
- `NotAffine` carries the class in its message, for example `new NotAffine('finite')` giving a message that contains the word `finite` (`SPEC.md` 5.6: "throw `NotAffine` (with the class in the message)"). Expose the class as `data: { class: 'finite' | 'indefinite' }` (plan).
- `NotAdmissible` carries the `Admissibility` record as `data: Admissibility` (plan field name). Declare `Admissibility` and `Reason` here, verbatim from `CONTRACTS.md` 2.2, and export them through `index.ts`; the phase 6 agent imports them.
- `EngineOverflow` is thrown only by `SafeInt`. Define it here and re-export it from `arith.ts`.
- "Reaching a cap is reported in a field of the result and is never thrown." No cap exists in phase 0; keep the rule in mind for the shape of `index.ts`.
- The texts of the messages are yours; keep them short and plain, no em-dash.

### 5.4 `caps.ts`

Exactly `CONTRACTS.md` 2.3, derived from the first table of `SPEC.md` 5.6 and from 4.0, E-6, E-9:

```ts
export const CAPS = {
  customNodes: 12, roadsEachWay: 4, layersOffFinite: 40, mainThreadItems: 2000, gardenPositions: 2000,
  gardenDrawEverything: 300, workerPositions: 100000, playMoves: 20000, linkMoves: 20000,
  verticesDrawn: 20000, edgesAtRest: 70000, edgesTurning: 8000, weylExplorerGroup: 1152,
  countGamesGroup: 60000, rootTestSteps: 20000, formFinderDigits: 6, repOrbit: 2000, matrixGridDim: 27,
  relabellingsDefault: 10000, legalLayersDefault: 100000,
} as const;
```

No phase-0 function consults a cap. The engine does not cap the number of nodes: `customNodes` is for the editor and `resolveBoard` (5.6: "editor refuses a 13th"); `cartan("A12")` and larger boards work.

### 5.5 `board.ts`

The `Board` type, verbatim from `SPEC.md` 5.2:

```ts
export interface Board<T = number> {
  n: number;
  cartan: Matrix<T>;                     // C[i][j] = <alpha_i^vee, alpha_j>, positions 0..n-1
  labels: readonly number[];             // what the reader sees for each position (E-7)
  kind: 'gcm' | 'one-way';
  arith: Arith<T>;
  name?: string;                         // "E8", "B3", "A4~", "D4^(3)", "pentagon"; undefined if custom
}
export type AnyBoard = Board<number> | Board<bigint>;                    // (plan)
```

Boards are immutable (E-11 relies on it). Never mutate a board after construction; freezing the object and its rows is allowed (plan).

The phase-0 signatures, verbatim from `CONTRACTS.md` 2.4:

```ts
cartan(name: string): number[][]                                   // "A3", "B4", ... any rank the family allows; throws NotABoard on an unknown name
boardFromName(name: string): AnyBoard                              // finite names → Board<number> with SafeInt; phase 2 extends
fromAdjacency(A: number[][]): AnyBoard                             // C = 2I - A^T; SafeInt if identify names a finite type (phase 2), else Big; phase 0: Big unless the matrix equals a named finite type's
adjacency(board: AnyBoard): number[][]
boardKind(C: readonly (readonly number[])[]): 'not-a-board' | 'one-way' | 'gcm'
toLabels(board: AnyBoard, positions: readonly number[]): number[]
toPositions(board: AnyBoard, labels: readonly number[]): number[]  // throws RangeError on an unknown label
cartanNumbers(board: AnyBoard): number[][]                         // (plan) integer copy for display and tests
```

**`cartan(name)`.** Port of the oracle's `cartan(letter, n)` (lines 32 to 67), with the name parsed from one string: a letter `A` to `G` followed by decimal digits, nothing else (no `~`, no lower case, no spaces). The numbering is Bourbaki's, `SPEC.md` 2.8, in positions:

- $A_n$ ($n\ge1$): path $1-2-\dots-n$; `C[k][k+1] = C[k+1][k] = -1`.
- $B_n$ ($n\ge2$): path; two roads from $n-1$ to $n$ and one back; node $n$ short; "$C_{n,n-1}=-2$", that is `C[n-1][n-2] = -2` and `C[n-2][n-1] = -1` in positions.
- $C_n$ ($n\ge2$): path; two roads from $n$ to $n-1$ and one back; node $n$ long; "$C_{n-1,n}=-2$", that is `C[n-2][n-1] = -2` and `C[n-1][n-2] = -1`.
- $D_n$ ($n\ge4$): path $1-\dots-(n-1)$, and node $n$ joined to node $n-2$: `C[n-1][n-3] = C[n-3][n-1] = -1`.
- $E_6$, $E_7$, $E_8$: path $1-3-4-5-6(-7(-8))$, and node 2 joined to node 4: `C[0][2] = C[2][0] = -1`, `C[1][3] = C[3][1] = -1`, `C[2][3]`, `C[3][4]`, `C[4][5]`, then `C[5][6]` for $n\ge7$ and `C[6][7]` for $n=8$, each with its transpose.
- $F_4$: path $1-2-3-4$; two roads from 2 to 3 and one back; "$C_{32}=-2$", that is `C[2][1] = -2` and `C[1][2] = -1`.
- $G_2$: three roads from 2 to 1 and one back; "$C_{12}=-3$", that is `C[0][1] = -3` and `C[1][0] = -1`.

The reference matrices of 2.8 must come out exactly:

$$B_2=\begin{pmatrix}2&-1\\-2&2\end{pmatrix},\quad C_2=\begin{pmatrix}2&-2\\-1&2\end{pmatrix},\quad G_2=\begin{pmatrix}2&-3\\-1&2\end{pmatrix},\quad F_4=\begin{pmatrix}2&-1&0&0\\-1&2&-1&0\\0&-2&2&-1\\0&0&-1&2\end{pmatrix}.$$

In JSON form: `B2` is `[[2, -1], [-2, 2]]`, `C2` is `[[2, -2], [-1, 2]]`, `G2` is `[[2, -3], [-1, 2]]`, `F4` is `[[2, -1, 0, 0], [-1, 2, -1, 0], [0, -2, 2, -1], [0, 0, -1, 2]]`, and from the golden file `D4` is `[[2, -1, 0, 0], [-1, 2, -1, -1], [0, -1, 2, 0], [0, -1, 0, 2]]` and `E6` is `[[2, 0, -1, 0, 0, 0], [0, 2, 0, -1, 0, 0], [-1, 0, 2, -1, 0, 0], [0, -1, -1, 2, -1, 0], [0, 0, 0, -1, 2, -1], [0, 0, 0, 0, -1, 2]]`.

Ranks: "any rank the family allows" (5.3) means exactly the ranges of 2.8: `A` for $n\ge1$, `B` and `C` for $n\ge2$, `D` for $n\ge4$, `E` for $n\in\{6,7,8\}$, `F` for $n=4$, `G` for $n=2$. Ranks above 8 are allowed (the golden file stops at 8 only because that is what was checked). Every other name throws `NotABoard` (`CONTRACTS.md` 2.4): `B1`, `C1`, `D2`, `D3`, `E5`, `E9`, `F3`, `F5`, `G3`, `A0`, `H3`, `a3`, the empty string, and in every phase the names that are not finite types, `A3~`, `C2~`, `D4^(3)`, `pentagon`, `square` (`cartan` is the finite-type constructor of 5.3; those names belong to `boardFromName` from phase 2). The oracle does not validate ranks and returns nonsense for several of these (section 9, trap 7); the engine must not copy that.

The return value is a fresh `number[][]` of plain numbers, whatever arithmetic a board built from it will use.

**`boardFromName(name)`, phase 0.** For a finite name accepted by `cartan`: `{ n, cartan: cartan(name), labels: [1, ..., n], kind: 'gcm', arith: SafeInt, name }` as a `Board<number>` (E-2: "named finite-type boards use `SafeInt`"; E-7: labels $1,\dots,n$, Bourbaki order; `name` is the string as given, for example `"B2"` or `"C2"`). This matches the oracle's `board_from_name` finite branch, which returns `C, list(range(1, len(C) + 1))`, and `verify.py` line 603 checks that `board_from_name(t)[0]` equals `types[t].cartan` for all 32 types. Every other name (`X~`, `B2~`, `C2~`, twisted names, `pentagon`, `square`) belongs to phase 2 and throws `NotABoard` in phase 0 (plan; the phase 2 engine agent extends this function in this same file). Do not pin the phase-0 behaviour on those names in a test; a test that `boardFromName('A3~')` throws would break in phase 2 in a file you own.

**`fromAdjacency(A)`.** $C=2I-A^{\mathsf T}$: `C[i][j]` is `2` when `i === j` and `-A[j][i]` otherwise. Validation (E-8: `not-a-board` is "rejected with `NotABoard` by every constructor"): `A` must be a square matrix of non-negative integers with zero diagonal, and `boardKind(C)` must not be `'not-a-board'`; otherwise throw `NotABoard`. A one-way adjacency is accepted and gives `kind: 'one-way'` (2.1: "Both games can be played on a one-way board"). Labels are $1,\dots,n$ "in order of creation" (E-7, custom boards). Arithmetic in phase 0, per `CONTRACTS.md` 2.4: `Big` unless the matrix equals a named finite type's. Concretely (plan): compare `C` entry for entry with `cartan(X)` for every finite name `X` of size `n` that `cartan` accepts, trying the families in the order `A`, `B`, `C`, `D`, `E`, `F`, `G` (the order of 5.5, "Naming"); on the first match return `boardFromName(X)` (so `SafeInt`, `name: X`), with one exception: for the $C_2$ matrix `[[2, -2], [-1, 2]]` return the same `SafeInt` board with `name` undefined (plan). The reason: a name that `fromAdjacency` derives from a matrix is a computed name, and `COMMON.md` section 2 says "$B_2$ and $C_2$ are one board: computed names say `B2`", while SPEC 5.5 "Naming" tries $A$, $B$, $C$, ... "so the rank 2 board is named `B2`". Naming this matrix `"C2"` would contradict that rule, and naming it `"B2"` without reordering the nodes would put a name on a board whose position order is not the Bourbaki order of `cartan("B2")`; reordering is the job of `identify` in phase 2. So leave the name undefined, do not pin the name of this matrix in any test, and raise it as a question to the orchestrator in your report (`requests`): which name, if any, `fromAdjacency` should give the $C_2$ matrix in phase 0. Otherwise return a `Board<bigint>` with `cartan` converted entry by entry with `BigInt`, `kind: boardKind(C)`, `arith: Big`, `labels: [1, ..., n]`, `name` undefined. Record this rule in your fragment; the phase 2 agent replaces the exact comparison with `identify`. Do not call anything from phase 2.

**`adjacency(board)`.** Port of the oracle's `adjacency` (lines 86 to 89): `A[i][j]` is `0` when `i === j` and `-C[j][i]` otherwise, as plain numbers (`Number()` of a `bigint` entry). Returns fresh arrays. The 5.3 table names `adjacency` as the oracle of both `fromAdjacency` and `adjacency`. `fromAdjacency(adjacency(board)).cartan` equals `cartanNumbers(board)` for every board.

**`boardKind(C)`.** Port of the oracle's `board_kind` (lines 1012 to 1026), whose docstring is the specification's: `'not-a-board'` when "some diagonal entry is not 2, or some off-diagonal entry is positive or not an integer"; `'one-way'` when "for some pair of nodes there are roads in one direction only (C[i][j] = 0 but C[j][i] != 0)"; `'gcm'` otherwise, "every road has at least one road back". Order of the checks as in the oracle: every row, diagonal first, then off-diagonal entries (`Number.isInteger` for the integer test; `-1.0` is an integer in JavaScript as in Python); then the one-way test over pairs `j < i`. Additions (plan, the oracle would raise on such input): a matrix that is not square, a ragged matrix, or a row containing a non-number returns `'not-a-board'`. The empty matrix returns `'gcm'` in the oracle; follow the oracle in `boardKind` and record it, but `fromAdjacency([])` throws `NotABoard` (plan: 2.1 defines a board on nodes $1,\dots,n$, and no function is defined on no nodes). `boardKind` takes plain numbers; compute the kind of a `Big` board from the integer matrix before converting entries to `bigint`.

**`toLabels(board, positions)`** maps each position to `board.labels[position]` and throws `RangeError` on a position outside $0,\dots,n-1$ (plan, mirroring the contract's rule for `toPositions`). **`toPositions(board, labels)`** maps each label to its index in `board.labels` and "throws `RangeError` on an unknown label". Both return fresh arrays and accept a word (positions or labels in the order played) as well as a node list. These two functions are the only converters in the engine; no other function adds or subtracts one. The 5.3 table gives their oracle as "(boundary only)": the oracle works in positions throughout and has no counterpart, so they are tested by `labels.test.ts` and not against an oracle function.

**`cartanNumbers(board)`** returns a fresh `number[][]` copy of `board.cartan` (plan), `Number()` of each `bigint` entry; it equals `cartan(board.name)` for a named finite board.

### 5.6 `moves.ts`

Signatures, verbatim from `CONTRACTS.md` 2.4:

```ts
mutate<T>(board: Board<T>, p: Vec<T>, i: number): T[]
fire<T>(board: Board<T>, a: Vec<T>, i: number): T[]
```

**`mutate`** is `SPEC.md` 2.2 and the oracle's `mutate` (lines 138 to 142): "A **mutation at $i$** changes only the entry $p_i$":

$$p_i \longmapsto -p_i + \sum_{j\ne i} A_{ji}\,p_j \;=\; p_i - \sum_{j} C_{ij}\,p_j .$$

Compute `q = copy of p; q[i] = sub(p[i], Σ_j mul(C[i][j], p[j]))` with the board's `arith`, the sum over all `j` including `j === i` exactly as the oracle writes it. Row `i` of `C` is used. "The board is never changed by a mutation."

**`fire`** is `SPEC.md` 2.3 and the oracle's `fire` (lines 145 to 148): "**Firing node $i$** negates $a_i$ and feeds the neighbours":

$$a_i \longmapsto -a_i,\qquad a_j \longmapsto a_j + A_{ij}\,a_i \;=\; a_j - C_{ji}\,a_i\quad (j\ne i).$$

Compute `b[j] = sub(a[j], mul(C[j][i], a[i]))` for every `j`, including `j === i`, where `C[i][i] = 2` gives `-a[i]`. Column `i` of `C` is used. "In words: node $i$ sends its number down every road that **leaves** it, then changes sign."

Both functions: return a fresh array of length `n`; never write into `p`, `a` or the board; throw `RangeError` when `i` is not a position or the vector's length is not `n` (plan). Both take any sign of entries: free play is the group action; legality is phase 1's `legalNodes` and `play`, not yours. Per `SPEC.md` 5.6, second table, first row: `mutate` and `fire` "work as defined" on a `one-way` board and "work" on a `gcm` board that is not of finite type. No guard, no error, no cap in these two functions.

Checks you can do by hand, from `SPEC.md` 2.11 and Appendix A.1 (labels in the text, positions in code):

- One-way board `[[2, 0], [-1, 2]]`, from $(1,0)$: mutate city 2, then city 1, "reach a mixed population": $(1,0)\to(1,1)\to(-1,1)$. This is also `one_way_counterexample` (`start`, `moves`, `result`).
- $A_2$ from $(1,1)$ in free play, firing 1, 2, 1: $(1,1)\to(-1,2)\to(1,-2)\to(-1,-1)$. Mutating city 1 of $p=(1,1)$ gives $(0,1)$; city 2 gives $(1,0)$.
- $B_2$ from $(1,1)$, firing 1, 2, 1, 2: $(1,1)\to(-1,3)\to(2,-3)\to(-2,1)\to(-1,-1)$. Mutating city 2 of $p=(1,2)$ gives $(1,0)$.
- $G_2$ from $(1,1)$, firing 1, 2, 1, 2, 1, 2: $(1,1)\to(-1,2)\to(5,-2)\to(-5,3)\to(4,-3)\to(-4,1)\to(-1,-1)$. Mutating city 2 of $p=(3,2)$ gives $(3,1)$.

The $B_2$ and $G_2$ lines are the only phase-0 checks that distinguish row from column: the involution property holds for the transposed formulas too (section 9, trap 4).

### 5.7 `index.ts`

Re-export, and nothing else: `Arith`, `SafeInt`, `Big`, `Vec`, `Matrix` from `arith.ts`; every error class and `Admissibility`, `Reason` from `errors.ts`; `CAPS` from `caps.ts`; `Board`, `AnyBoard`, `cartan`, `boardFromName`, `fromAdjacency`, `adjacency`, `boardKind`, `toLabels`, `toPositions`, `cartanNumbers` from `board.ts`; `mutate`, `fire`, `Word`, `Game`, `Choose` from `moves.ts`. `P0-A5` imports from `@two-games/engine` (the alias `@engine` in the site, `CONTRACTS.md` 1) in stage 0.3, so every name above must resolve from the package root with the `exports` or `main` field `P0-A1` configured; if `packages/engine/package.json` lacks a usable entry point, write the request and report it rather than editing that file.

### 5.8 The golden harness, `test/golden/_harness.ts`

Exports, verbatim from `CONTRACTS.md` 3:

```ts
export const golden: GoldenData;                                   // parsed once from reference/golden_data.json; never mutated
export const TYPE_NAMES: readonly string[];                        // the 32 keys of golden.types in file order
export function boardOf(typeName: string): Board<number>;
export function covers(...keys: string[]): void;                   // registers the golden keys a test file covers; written to test/golden/coverage.json by the Vitest reporter/globalSetup
export const GOLDEN_KEYS_BY_PHASE: Record<0|1|2|3|4|5|6|7, string[]>;   // the table of SPEC 5.7, machine-readable
export function labels(board: AnyBoard, positions: readonly number[]): number[];
export function wordLabels(board: AnyBoard, word: Word): number[];
export function intEq(actual: unknown, expected: unknown, message?: string): void;        // rule 1; bigint vs decimal string allowed
export function ringsEq(actual: [number, number][], expected: [number, number][]): void;  // rule 3; radii within 1e-5
export function ratText(r: Rational): string;                                              // rule 4
export function matchRecord<T extends object>(list: T[], where: Partial<T>): T;            // rule 5; throws unless exactly one
export function sortedPositiveRoots(list: number[][]): number[][];                          // total, then lexicographic
```

- **Loading.** Read `reference/golden_data.json` once at module load with `node:fs`, by a path relative to the harness file (`new URL('../../../../reference/golden_data.json', import.meta.url)`), so that it works from any worktree. Do not import the JSON as a module. Never mutate the parsed object (freeze it, or type it `readonly`). Big integers in the file are decimal strings (`bigint_test`); `JSON.parse` keeps them as strings.
- **Hash guard (plan).** Before parsing, compute the SHA-256 of the file bytes with `node:crypto` and compare with `c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f` (`CONTRACTS.md` 9). On a difference throw an `Error` whose message names the file and says to stop and report; do not fall back to parsing. Export the check as `verifyGoldenHash(file?: string | URL): void` (plan; an addition to the contract's export list, not a change to it) so that `harness.test.ts` can run it on a temporary copy with one byte changed. This makes every golden test fail loudly if the reference changes, which `CONTRACTS.md` 9 calls a blocker.
- **`TYPE_NAMES`** is `Object.keys(golden.types)` in file order: `A1, A2, A3, A4, A5, A6, A7, A8, B2, B3, B4, B5, B6, B7, B8, C2, C3, C4, C5, C6, C7, C8, D4, D5, D6, D7, D8, E6, E7, E8, F4, G2` (32 names). **`boardOf(T)`** is `boardFromName(T)` for those names and throws for any other.
- **`GoldenData`** types the keys you use precisely (`types` with `cartan`, `adjacency` and the other fields of Appendix G as optional where rule 7 says they may be absent; `conventions`; `classification_tests`; `one_way_counterexample`; `bigint_test`) and declares every other top-level key of Appendix G with a loose type (`unknown` or a minimal record shape). Later engine agents narrow in their own files; they do not edit this one except to append (the comparison rules are never changed).
- **Key spellings (plan).** `covers()` and `GOLDEN_KEYS_BY_PHASE` use one grammar, derived from the table of `SPEC.md` 5.7: a top-level key as it stands (`satake`); a field of every `types` record as `types[*].<field>`; a field of every record of another list or keyed object as `<key>[*].<field>` (`kostant[*].affine_board_from_node`, `folding[*].quasi_split_real_form`); a field of a single record as `<key>.<field>` (`pentagon_example.complete_games`, `e8.h4_projection`). Where the table says "without X", the plain key covers everything but X, and X is its own key in its own phase. The table, transcribed:

```ts
export const GOLDEN_KEYS_BY_PHASE: Record<0|1|2|3|4|5|6|7, string[]> = {
  0: ['types[*].cartan', 'types[*].adjacency'],
  1: ['types[*].n_roots', 'types[*].n_positive_roots', 'types[*].positive_roots', 'types[*].highest_root',
      'types[*].highest_short_root', 'types[*].numbers_of_highest_root', 'types[*].numbers_of_highest_short_root',
      'types[*].highest_root_of_reversed_board', 'types[*].coxeter_number', 'types[*].longest_word',
      'types[*].fired_values', 'types[*].fired_tally', 'types[*].minus_w0', 'types[*].minuscule_nodes',
      'kostant[*].end_from_node', 'kostant[*].moves_from_node', 'kostant[*].final_numbers_from_node',
      'one_way_counterexample', 'layer_growth_examples', 'bigint_test'],
  2: ['types[*].symmetrizer', 'types[*].simply_laced', 'types[*].n_short_positive', 'types[*].n_long_positive',
      'types[*].long_to_short_ratio', 'types[*].det_cartan',
      'affine', 'twisted_affine', 'affine_names', 'classification_tests', 'pentagon_example',
      'kostant[*].affine_board_from_node'],
  3: ['types[*].exponents', 'types[*].weyl_order', 'types[*].bipartite_colouring', 'types[*].fundamental_orbit_sizes',
      'types[*].n_reduced_words_w0', 'types[*].length_distribution',
      'weyl_dimension', 'heaps', 'pentagon_example.complete_games', 'e8'],
  4: ['folding', 'wythoff', 'types[*].coxeter_plane', 'coxeter_plane_types_with_coincident_points', 'e8.h4_projection'],
  5: ['minuscule_representations'],
  6: ['satake', 'admissible_pairs', 'admissible_counts', 'satake_examples', 'folding[*].quasi_split_real_form'],
  7: ['golden_boards', 'golden_folds', 'orbit_plus_zero_representations', 'generalized_satake_example'],
};
```

  The row "none" of the table (`wildberger_lists`, `wythoff_hull_checks`, `wythoff_note`, `about`, `conventions`) is documentation and is not in the record; name it in a comment. `GATE` fails if `coverage.json` lacks a key assigned to a phase at or below the gate's, so a later agent that misspells a key fails its gate: the spellings above are binding for the team.

- **`covers(...keys)`** registers the keys a test file covers. Vitest runs test files in isolated workers, so module-level state in the harness is not shared across files: persist each registration to disk (for example one small JSON file per test file under `test/golden/.coverage/`, or an append to one NDJSON file) and merge in the teardown of a `globalSetup` declared in `vitest.config.ts`, which first clears the previous run's registrations and at the end writes `packages/engine/test/golden/coverage.json`. The file's shape (plan, so that `GATE` can read it without TypeScript): `{ "keys": [sorted unique spellings], "missingByPhase": { "0": [...], "1": [...], ... "7": [...] } }`, where `missingByPhase[k]` lists the keys of `GOLDEN_KEYS_BY_PHASE[k]` absent from `keys`. After this task's suite runs, `missingByPhase["0"]` is `[]`. `coverage.json` is a build output: do not commit it; write a request that `.gitignore` gain `packages/engine/test/golden/coverage.json` and `packages/engine/test/golden/.coverage/`. A key is tested in exactly one file, so no two files register the same key.
- **Rule 1, `intEq(actual, expected, message?)`.** "Integers compare exactly. Every JSON number in the golden file is a safe integer, except the ring radii of rule 3. Integers beyond $2^{53}$ are stored as decimal strings (`bigint_test`) and compare with `bigint` values by their decimal text." Implement recursively over arrays (vectors, matrices, lists of lists), with these leaf rules: a `number` actual must be a safe integer and equal a `number` expected with `===`, or equal a decimal-string expected by `String(actual)`; a `bigint` actual equals `expected` when `actual.toString() === String(expected)`; any other pairing, a length mismatch or a non-array against an array fails with the message plus the path to the leaf. Booleans and identifiers are compared in tests with `toBe` (rule 6), not through `intEq`.
- **Rule 2** is `labels` and `wordLabels`, both `toLabels(board, list)`.
- **Rule 3, `ringsEq`.** "the same number of rings, the same sizes in the same order (innermost first), radii equal to within $10^{-5}$." Each ring is `[radius, count]`; counts compare exactly, radii by `Math.abs(a - b) <= 1e-5`.
- **Rule 4, `ratText(r)`.** `"p/q"` in lowest terms, or `"p"` when `den` is `1n`. The `Rational` type arrives in phase 1 (`src/rational.ts`); declare the parameter structurally as `{ num: bigint; den: bigint }` in the harness (plan) and do not reduce: the caller passes lowest terms with `den > 0`.
- **Rule 5, `matchRecord(list, where)`.** Returns the one record whose fields named in `where` equal the given values, comparing arrays by their JSON text (`rings=1,0,0,0` is stored as a list); throws with the count and the `where` text unless exactly one matches. **`sortedPositiveRoots(list)`** returns a copy sorted by total, then lexicographically, ascending, for `positive_roots`.
- **Rules 6 and 7** need no helper: document them in a comment at the top of the harness (identifiers compare exactly with `toBe`; a field absent or `null` in a record where Appendix G allows it is not tested, while a meaningful `null` compares as `null`).
- The comparison rules are implemented once here and never re-implemented in a test (`CONTRACTS.md` 3). Later engine agents add helpers in their own files and never change these.

### 5.9 The tests

Write each test before the function it tests (`COMMON.md` 4.3), from the golden key or the spec text, and make sure it fails against an empty implementation. No `it.only`, no `test.skip`, no golden value typed into source. The four reference matrices of 2.8, the tables of Appendix A.1 and the play of 2.11 are printed in `SPEC.md` and may be typed as literals with a comment naming their section. Inputs that a test makes up itself (the one-way adjacency `[[0, 1], [0, 0]]`, the invalid matrices and names, the arithmetic edge values, the square board of `labels.test.ts`) may also be typed, together with the values the 2.1 formula $C = 2I - A^{\mathsf T}$ or the 2.2 and 2.3 rules give for them by hand (plan). Every other expected value, and every adjacency of a named type, comes from `golden` through the harness or is derived in the test from a permitted literal; the golden adjacencies of `B2` and `G2` and the decimal strings of `bigint_test` are never typed.

**`test/golden/p0-types-cartan.test.ts`**, the 5.7 phase-0 row (`types[*]`: `cartan`, `adjacency` exercising `cartan`, `adjacency`, `boardKind`). First line of effect: `covers('types[*].cartan', 'types[*].adjacency')`. For every `T` of `TYPE_NAMES` (a `describe.each` or a loop over the 32 names, one `it` per type and check so that a failure names the type):

- `intEq(cartan(T), golden.types[T].cartan)`.
- `intEq(adjacency(boardOf(T)), golden.types[T].adjacency)` (the oracle's `adjacency(cartan)`); and the way back: `fromAdjacency(golden.types[T].adjacency)` has `cartanNumbers` equal to `golden.types[T].cartan`, `arith` `SafeInt` and `name` `T` for every `T` except `C2`, whose `name` is not asserted (the phase-0 rule of 5.5 and its $C_2$ exception).
- `boardKind(golden.types[T].cartan)` and `boardKind(cartan(T))` are `'gcm'`.
- `boardFromName(T)`: `n` equals the rank in the name, `labels` equal `[1, ..., n]`, `kind` is `'gcm'`, `arith` is `SafeInt`, `name` is `T`, `cartanNumbers` equal `golden.types[T].cartan`.
- Once, not per type: the four matrices of 2.8 as literals (`B2`, `C2`, `G2`, `F4`); `TYPE_NAMES` has 32 entries in the order of 5.8; `cartan` throws `NotABoard` (and `instanceof EngineError`) on `B1`, `C1`, `D2`, `D3`, `E5`, `E9`, `F3`, `F5`, `G3`, `A0`, `H3`, `a3`, `''`; `cartan('A12')` has 12 rows and is the path matrix; `cartan('B9')` has `C[8][7] === -2`; `cartan('D9')` has `C[8][6] === -1` and `C[8][7] === 0`.

**`test/golden/p0-board-kind.test.ts`**, the roster's deliverable. It reads `classification_tests`, `one_way_counterexample` and `bigint_test` as inputs only; those keys are covered in phase 2 and phase 1 by the files of those phases, so this file calls no `covers()` and says why in a comment at the top (plan). Tests:

- For every record of `golden.classification_tests`: `boardKind(record.cartan)` equals `'one-way'` when some `components[k].kind` is `'one-way'` and `'gcm'` otherwise (twelve `gcm`, one `one-way`; every board of the list is either connected or has only `gcm` components, so the roster's rule "its components' kind where the board is connected" reduces to this).
- `boardKind(golden.one_way_counterexample.cartan)` is `'one-way'`; `boardKind(golden.bigint_test.cartan)` is `'gcm'`.
- Hand-written matrices are `'not-a-board'`: the oracle's own two examples at `verify.py` line 1534, `[[2, 1], [1, 2]]` (positive off-diagonal) and `[[1, -1], [-1, 2]]` (diagonal not 2); then `[[2, 1], [-1, 2]]` (one positive entry beside a valid one), `[[3]]`, `[[2, -0.5], [-1, 2]]` (not an integer, the oracle's docstring), `[[2, -1]]` (not square, plan), `[[2, -1], [-1, 2, 0]]` (ragged, plan). `[[2]]` is `'gcm'`.
- `fromAdjacency([[0, 1], [0, 0]])` (one road from city 1 to city 2) has `cartanNumbers` `[[2, 0], [-1, 2]]`, `kind` `'one-way'`, `arith` `Big`, `labels` `[1, 2]`, `name` undefined; `fromAdjacency(golden.types.B2.adjacency)` has `cartanNumbers` equal to the 2.8 literal `B2` matrix (the asymmetric $B_2$ check of the roster) and `name` `'B2'`, and the same holds for `golden.types.G2.adjacency` and the 2.8 literal `G2`; as a cross-check independent of the engine, the test derives the adjacency from each 2.8 literal by $A_{ij} = -C_{ji}$ ($i \ne j$, $A_{ii} = 0$) and asserts it equals the golden adjacency; `fromAdjacency` of the adjacency derived the same way from `golden.bigint_test.cartan` is a `Big` board without a name; `fromAdjacency` throws `NotABoard` on `[[0, -1], [1, 0]]`, `[[1, 1], [1, 0]]`, `[[0, 1]]`, `[[0, 0.5], [1, 0]]`.

**`test/properties/p1-involution.test.ts`**, property 1 of 5.7: "`mutate(B, mutate(B, p, i), i) = p` and `fire(B, fire(B, a, i), i) = a`." "The board is drawn at random from the type list, and vectors have random integer entries in $[-9,9]$." With `fast-check`: `fc.constantFrom(...TYPE_NAMES)`, a vector of `n` integers in `[-9, 9]`, a position in `[0, n-1]`; assert the two identities with `toEqual` on `boardOf(T)` (`SafeInt`) and on a hand-built `Board<bigint>` with the same matrix (plan, so that both arithmetics are exercised), and assert that the input vector is unchanged. Use `fc.assert` with an explicit `seed` and `numRuns` (at least 500) recorded in the file (`CONTRACTS.md` 3: "a fixed seed recorded in the file"). No `covers()`.

**`test/unit/labels.test.ts`**, the E-7 unit test the specification asks for. Build by hand a `Board<bigint>` with the matrix of the square, `[[2, -1, 0, -1], [-1, 2, -1, 0], [0, -1, 2, -1], [-1, 0, -1, 2]]`, `labels: [0, 1, 2, 3]` (what an affine board will have in phase 2), `kind: 'gcm'`, `arith: Big`, no `name`. Assert: `toLabels(board, [0, 1, 2, 3])` is `[0, 1, 2, 3]` and `toLabels(board, [0])` is `[0]`, not `[1]`; `toPositions(board, [0, 3])` is `[0, 3]`; the word `[2, 0, 3, 1]` round-trips through `toLabels` then `toPositions`; `toPositions(board, [4])` and `toPositions(board, [-1])` throw `RangeError`; `toLabels(board, [4])` throws `RangeError`; `mutate(board, [1n, 0n, 0n, 0n], 0)` is `[-1n, 0n, 0n, 0n]` and `mutate(board, [0n, 1n, 0n, 1n], 0)` is `[2n, 1n, 0n, 1n]`, so position 0 changes exactly the entry the reader calls node 0; `fire(board, [1n, 0n, 0n, 0n], 0)` is `[-1n, 1n, 0n, 1n]`. On the finite side, `boardOf('A3')`: `toPositions(board, [1, 2, 3])` is `[0, 1, 2]`, `toLabels(board, [0])` is `[1]`, `toPositions(board, [0])` throws `RangeError`. These guard E-7 against a stray `+ 1`.

**`test/unit/overflow.test.ts`**, the roster's deliverable. Build the `bigint_test` board twice: `safe`, a hand-built `Board<number>` `{ n: 2, cartan: golden.bigint_test.cartan, labels: [1, 2], kind: 'gcm', arith: SafeInt }`, and `big`, from `fromAdjacency` of its adjacency (a `Big` board, since `[[2, -3], [-3, 2]]` is no finite type). Convert `mutation_nodes` and `firing_nodes` with `toPositions` (they are labels: `mutation_nodes` begins `2, 1, 2, 1`, so positions `1, 0, 1, 0`). Then:

- With `big`, replay all 200 `mutation_nodes` from `population_start`; `intEq(result, golden.bigint_test.population_end)` (decimal strings against `bigint`). Also replay `firing_nodes` from `numbers_start` with `fire` and compare with `numbers_end` (plan; the golden key `bigint_test` itself is covered in phase 1, so this file calls no `covers()`).
- With `safe`, replay move by move; moves 1 to 37 succeed and give the same entries as the `big` replay (compare by `show`); the throw is an `EngineOverflow`, `instanceof EngineError`, and it happens during move 38. State the semantics in a comment, derived from `verify.py` lines 1421 to 1425: the oracle applies move `k + 1` (one-based) and records `first_unsafe = k + 1` the first time `max(abs(x)) > 2 ** 53` afterwards, so `first_move_after_which_an_entry_exceeds_2_to_53 = 39` means that the stored entries are at most $2^{53}$ after 38 moves and exceed it after 39. A per-operation `SafeInt` throws one move earlier: the entries after 37 moves are `1304969544928657` and `3416454622906707`; move 38 forms the product `3 × 3416454622906707 = 10249363868720121`, which exceeds `Number.MAX_SAFE_INTEGER = 9007199254740991`, although the result of move 38, `8944394323791464`, would be safe. The firing replay throws during move 38 for the same reason: before move 38 the numbers are `-1304969544928657` and `3416454622906707`, move 38 fires position 1 (label 2), and the product `C[0][1] × a[1] = -3 × 3416454622906707` is unsafe although both results, `8944394323791464` and `-3416454622906707`, would be safe. Assert also the weaker invariant that the throwing move is at most `golden.bigint_test.first_move_after_which_an_entry_exceeds_2_to_53`, so that the test still states the oracle's number. This departs from the roster's wording (plan): the roster line says `SafeInt` "throws EngineOverflow at the move after first_move_after_which_an_entry_exceeds_2_to_53", which read literally is move 40, but the same line asks you to "determine the exact index semantics from verify.py and state them in a comment", and the semantics above give move 38. Assert 38, record the departure in your fragment (5.11), and list it in `deviations` of your report (section 10) so that the orchestrator and `RT-VERIFY` see that the roster line is superseded.
- `Arith` checks: `SafeInt.add(9007199254740991, 1)`, `SafeInt.mul(2 ** 27, 2 ** 27)`, `SafeInt.fromInt(2 ** 53)`, `SafeInt.fromInt(0.5)` throw `EngineOverflow`; `SafeInt.mul(-1, 0)` shows `"0"` and has `sign` `0`; `SafeInt.sign(-0)` is `0`; `SafeInt.toBig(-3)` is `-3n`; `Big.show(BigInt(golden.bigint_test.numbers_end[1]))` equals the string `golden.bigint_test.numbers_end[1]`, and `Big.show` of each entry of the `big` firing replay result equals the matching string of `numbers_end` (no 84-digit value is typed into source); `Big.sign`, `Big.eq`, `Big.fromInt(7)` behave.

**`test/unit/moves.test.ts`** (plan addition): the four hand checks of 5.6 as tests, in positions, on `boardOf('A2')`, `boardOf('B2')`, `boardOf('G2')` and on `fromAdjacency([[0, 1], [0, 0]])`; each step of the three firing tables, the three mutation lines, and the one-way play `(1, 0) → (1, 1) → (-1, 1)`; the same vectors on hand-built `Big` copies; `mutate` and `fire` leave their input arrays unchanged (deep-compare before and after) and return new arrays; `RangeError` on `i = n` and on a vector of the wrong length.

**`test/unit/harness.test.ts`** (plan addition): `intEq` accepts `[1n, 2n]` against `["1", "2"]`, `[[2, -1], [-1, 2]]` against itself, `5n` against `5`, and rejects `[1]` against `[1, 2]`, `2` against `3`, `1n` against `"2"`, `0.5` against `0.5`; `ratText({ num: 3n, den: 1n })` is `"3"` and `ratText({ num: -1n, den: 2n })` is `"-1/2"`; `ringsEq` accepts radii that differ by `1e-6` and rejects a different count or ring order; `matchRecord` returns the one match and throws on zero and on two matches; `sortedPositiveRoots([[1, 1], [0, 1], [1, 0]])` is `[[0, 1], [1, 0], [1, 1]]`; `TYPE_NAMES.length` is 32 and `TYPE_NAMES[0]` is `'A1'`, `TYPE_NAMES[31]` is `'G2'`; every key of `GOLDEN_KEYS_BY_PHASE` names an existing top-level key of `golden` after stripping `[*].field` and `.field`, and each field named exists on at least one record of that key (not on the first record: the first record of `types` is `A1`, which by Appendix G and rule 7 of 5.7 has no `highest_short_root`, `numbers_of_highest_short_root`, `n_short_positive`, `n_long_positive`, `long_to_short_ratio` or `coxeter_plane`, since the short-root fields appear "only on $B$, $C$, $F$, $G$" and `coxeter_plane` is "present for rank at least 2"; do not change the golden file or drop such keys to make the test pass); `GOLDEN_KEYS_BY_PHASE[0]` equals `['types[*].cartan', 'types[*].adjacency']`; `packages/engine/package.json` has `dependencies` equal to `{}`; every `import` or `export ... from` specifier in `src/*.ts` begins with `./` and resolves inside `src/` (no `node:`, no bare package name).

  The same file also checks the three phase-0 deliverables that no other test exercises (plan placement):

  - **`CAPS`** (5.4): `CAPS` deep-equals the object of `CONTRACTS.md` 2.3, typed in the test as a literal with a comment naming `CONTRACTS.md` 2.3 (it is a plan contract, not a golden value): all 20 keys and no others, for example `edgesAtRest` is `70000`, `countGamesGroup` is `60000`, `customNodes` is `12`, `matrixGridDim` is `27`, `legalLayersDefault` is `100000`.
  - **Errors** (5.3, E-10): for each of the seven classes `NotABoard`, `NeedsTwoWayRoads`, `NeedsConnectedBoard`, `NotFiniteType`, `NotAffine`, `NotAdmissible`, `EngineOverflow`, an instance is `instanceof` its class, `instanceof EngineError` and `instanceof Error`, and its `name` equals the class name (so that the phase 1 worker can re-throw "as the same class", `CONTRACTS.md` 4); `new NotAffine('finite')` has a message containing `finite` and `data` deep-equal to `{ class: 'finite' }`; a `NotAdmissible` built from a hand-written `Admissibility` record carries that record as `data`.
  - **Public API** (5.7): `import * as api from '@two-games/engine'` (the package root, as `P0-A5` imports it) has every runtime name of 5.7 defined: `SafeInt`, `Big`, the eight error classes, `CAPS`, `cartan`, `boardFromName`, `fromAdjacency`, `adjacency`, `boardKind`, `toLabels`, `toPositions`, `cartanNumbers`, `mutate`, `fire`; the type-only names (`Arith`, `Vec`, `Matrix`, `Admissibility`, `Reason`, `Board`, `AnyBoard`, `Word`, `Game`, `Choose`) are imported with `import type` from the same specifier in the test file, so that `tsc --noEmit` fails on a missing one.

### 5.10 Package rules

`SPEC.md` 5, opening: "The engine is one TypeScript package with no runtime dependencies: nothing from the DOM, from a UI framework, from the network or from npm (its only development dependencies are TypeScript and the test tools)." `CONTRACTS.md` 2.1: `"dependencies": {}`; "Nothing in `src/` imports from outside `src/`." Tests may import `node:fs`, `node:crypto`, `node:path`, `vitest` and `fast-check`; `src/` may not. Strict TypeScript: no `any` without a comment saying why. `npx tsc --noEmit -p packages/engine` must pass; if `P0-A1`'s `tsconfig.json` does not include `test/`, type-check the tests with the same options through a command you record, and request the include in your report rather than editing the file.

### 5.11 What to record in `decisions/P0-A2.md`

One dated entry each, in the form of `COMMON.md` 5.1: the generics choice of E-2 [D]; the placement of `Vec`, `Matrix`, `Word`, `Game`, `Choose`, `Admissibility`, `Reason` and of `EngineOverflow` (plan); the error message texts and the `data` fields; the phase-0 naming rule of `fromAdjacency` (exact match, family order, `name` undefined for the $C_2$ matrix and the open question raised about it); the overflow move 38 and its departure from the roster's wording "at the move after first_move_after_which_an_entry_exceeds_2_to_53" (5.9); the rank ranges that `cartan` accepts and that the oracle does not validate; `boardFromName` throwing `NotABoard` on phase 2 names in phase 0; `boardKind` on non-square input and on the empty matrix; the `-0` normalisation; `toLabels` throwing `RangeError`; the coverage mechanism and the shape of `coverage.json`; the hash guard; the `fast-check` seed; the two added test files; every version you observed (`node`, `typescript`, `vitest`, `fast-check`). Add no dependency.

## 6. Acceptance

Each line: the condition, the test that proves it, the gate.

- [ ] `SPEC.md` 5.7 phase 0, `types[*].cartan`: `cartan(T)` equals `types[T].cartan` for all 32 types. `test/golden/p0-types-cartan.test.ts > cartan(T) equals types[T].cartan`. G0 ("phase 0 golden tests pass for all 32 types").
- [ ] `SPEC.md` 5.7 phase 0, `types[*].adjacency`: `adjacency(boardOf(T))` equals `types[T].adjacency` for all 32 types, and `fromAdjacency` inverts it. `p0-types-cartan.test.ts > adjacency(T) equals types[T].adjacency`, `> fromAdjacency(types[T].adjacency) rebuilds the board`. G0.
- [ ] `SPEC.md` 5.7 phase 0, `boardKind` on `types[*]`: `'gcm'` for all 32 types. `p0-types-cartan.test.ts > boardKind of every type is gcm`. G0.
- [ ] `SPEC.md` 2.8: the four reference matrices $B_2$, $C_2$, $G_2$, $F_4$ reproduced; Bourbaki rules at ranks above 8; unknown names and ranks throw `NotABoard`. `p0-types-cartan.test.ts > reference matrices of 2.8`, `> ranks beyond the golden file`, `> unknown names throw NotABoard`. Every merge (7.7, engine golden and unit).
- [ ] `SPEC.md` 5.3 and E-7: `boardFromName(T)` is a `SafeInt` board with labels `1..n`, kind `gcm`, name `T`. `p0-types-cartan.test.ts > boardFromName(T) carries labels, kind, arith and name`. G0.
- [ ] Roster: `boardKind` on every `classification_tests[*].cartan` equals the kind of its components; `one_way_counterexample.cartan` is `one-way`; hand-written matrices are `not-a-board`. `test/golden/p0-board-kind.test.ts > classification_tests kinds`, `> one-way counterexample`, `> not-a-board matrices`. G0.
- [ ] `SPEC.md` 2.1 and E-8: `fromAdjacency` accepts a one-way adjacency as `kind: 'one-way'` with `Big`, rejects non-boards with `NotABoard`, and `C = 2I - A^T` on the asymmetric $B_2$. `p0-board-kind.test.ts > fromAdjacency one-way`, `> fromAdjacency rejects`, `> fromAdjacency B2 is asymmetric the right way`. Every merge.
- [ ] `SPEC.md` 5.7 property 1: `mutate` twice and `fire` twice are the identity on random vectors in $[-9, 9]$ on random types, `SafeInt` and `Big`. `test/properties/p1-involution.test.ts > mutate is an involution`, `> fire is an involution`. G0 (roster: "property 1 passes (G0)").
- [ ] `SPEC.md` 2.2, 2.3, Appendix A.1, 2.11: the firing tables of $A_2$, $B_2$, $G_2$ from $(1, 1)$, the mutation lines, the one-way play; arguments unchanged. `test/unit/moves.test.ts > A.1 firing tables`, `> A.1 mutation lines`, `> 2.11 one-way play`, `> purity`. Every merge.
- [ ] `SPEC.md` E-7: a board with labels `[0, 1, 2, 3]` round-trips `toLabels` and `toPositions`, and `mutate` on position 0 changes the entry the reader calls node 0; `toPositions` throws `RangeError` on an unknown label. `test/unit/labels.test.ts > affine-style labels round-trip`, `> mutate at position 0 changes node 0`, `> unknown label throws RangeError`, `> finite labels are 1-based`. Every merge (roster: "labels and overflow unit tests pass").
- [ ] `SPEC.md` E-2 and roster: on the `bigint_test` board with `SafeInt`, replaying `mutation_nodes` throws `EngineOverflow` during move 38, no later than `first_move_after_which_an_entry_exceeds_2_to_53` (39), with the semantics stated in a comment; with `Big` it reaches `population_end` (and `firing_nodes` reach `numbers_end`). `test/unit/overflow.test.ts > SafeInt throws at move 38`, `> Big replay reaches population_end`, `> Big firing replay reaches numbers_end`, `> SafeInt arithmetic checks`. Every merge.
- [ ] `CONTRACTS.md` 3: the harness exports every name of section 3; `intEq`, `ringsEq`, `ratText`, `matchRecord`, `sortedPositiveRoots` behave as rules 1, 3, 4, 5; `TYPE_NAMES` is the 32 keys in file order; every spelling of `GOLDEN_KEYS_BY_PHASE` resolves in the golden file (each field present on at least one record of its key, per 5.9). `test/unit/harness.test.ts > comparison helpers`, `> TYPE_NAMES`, `> GOLDEN_KEYS_BY_PHASE spellings resolve`. Every merge.
- [ ] `CONTRACTS.md` 2.3 (5.4): `CAPS` holds exactly the 20 numbers of 2.3. `test/unit/harness.test.ts > CAPS equals CONTRACTS 2.3`. Every merge.
- [ ] `SPEC.md` E-10, `CONTRACTS.md` 2.2 and 4 (5.3): all seven error classes extend `EngineError` and set `name` to their class name; `NotAffine` carries `data.class` and the class in its message; `NotAdmissible` carries `data: Admissibility`. `test/unit/harness.test.ts > error classes`. Every merge.
- [ ] 5.7 and `CONTRACTS.md` 1: every name of 5.7 resolves from `@two-games/engine`, as `P0-A5` imports it in stage 0.3. `test/unit/harness.test.ts > public API from the package root` (runtime names), with the type-only names checked by `npx tsc --noEmit -p packages/engine` on the same file; the `publicApi` report field lists them. Every merge.
- [ ] Roster: `GOLDEN_KEYS_BY_PHASE[0]` keys all appear in `coverage.json` after the suite runs. Proven by the file written by the global setup's teardown: `missingByPhase["0"]` is `[]` after `npm test -w packages/engine`; paste the command `node -e "const c=require('./packages/engine/test/golden/coverage.json'); console.log(c.keys, c.missingByPhase['0'])"` and its output in `commandsRun`. G0 (the `GATE` agent reads the same file).
- [ ] Roster and `CONTRACTS.md` 2.1: `packages/engine/package.json` has `"dependencies": {}` and `src/` imports nothing outside `src/`. `test/unit/harness.test.ts > no runtime dependency`, `> src imports only src`; also the command `grep -rn "from '" packages/engine/src` pasted in `commandsRun`. Every merge.
- [ ] Roster: `tsc --noEmit` passes with strict. Command `npx tsc --noEmit -p packages/engine`, exit 0, pasted in `commandsRun`. Every merge.
- [ ] `CONTRACTS.md` 9: the three reference files have the recorded SHA-256 values; the harness refuses a changed `golden_data.json`. Command `shasum -a 256 reference/golden_data.json reference/lie_games.py reference/verify.py` pasted in `commandsRun`; `test/unit/harness.test.ts > hash guard rejects a changed file` (call the guard function on a temporary copy with one byte changed). G0 item "reference file hashes equal CONTRACTS.md section 9" (run by `GATE`; your run is the early warning).
- [ ] `COMMON.md` 4.4: no `it.only`, `test.skip`, `xit`, commented-out assertion, loosened tolerance or self-comparison in your test files. Command `grep -rnE "\.only|\.skip|xit\(" packages/engine/test` with empty output, pasted in `commandsRun`. Every merge.

## 7. Files

- **You own** (the roster's list, exactly):
  - `packages/engine/src/arith.ts, errors.ts, caps.ts, board.ts, moves.ts, index.ts`
  - `packages/engine/test/golden/_harness.ts, p0-types-cartan.test.ts, p0-board-kind.test.ts`
  - `packages/engine/test/properties/p1-involution.test.ts`
  - `packages/engine/test/unit/labels.test.ts, overflow.test.ts`
  - `packages/engine/vitest.config.ts (coverage reporter for covers())`
  - `decisions/P0-A2.md`
- **Also yours, under the README section 4 rule that every build agent owns its own tests** (plan addition of this instruction; the orchestrator may strike them): `packages/engine/test/unit/moves.test.ts`, `packages/engine/test/unit/harness.test.ts`; the generated, uncommitted `packages/engine/test/golden/coverage.json` and `packages/engine/test/golden/.coverage/`.
- **You may edit with the stated protocol**: `packages/engine/vitest.config.ts` was created by `P0-A1` in stage 0.1 and is yours in stage 0.2; keep `P0-A1`'s settings and add the global setup and include patterns. `packages/engine/src/index.ts` was created by `P0-A1` with an empty export; replace its content.
- **You must not touch**: everything else; in particular `reference/` (read-only for everyone; never edit `golden_data.json`, `lie_games.py` or `verify.py`), `DECISIONS.md` (write the fragment), root `package.json` and the lockfile (`P0-A1`; a missing `fast-check` is a request, not an install), `packages/engine/package.json` and `packages/engine/tsconfig.json` (`P0-A1`; request changes), the root Vitest configuration, `.gitignore`, `playwright.config.ts` and `.github/` (created by `P0-A1`, then `P0-A6`'s in this stage; README section 6), anything under `site/` or `scripts/`, the files of `P0-A3` and `P0-A6` who run beside you, `content/unverified.json`, `main`.

## 8. Order of work

1. Pre-flight. `node --version` (22.12 or later), `git rev-parse --show-toplevel`, `git branch --show-current` (expect `agent/P0-A2`); `npm ci --prefer-offline` at the root if `node_modules` is absent; `shasum -a 256` of the three reference files against `CONTRACTS.md` 9 (stop and report `blocked` on a difference); read `P0-A1`'s `packages/engine/package.json`, `tsconfig.json`, `vitest.config.ts`, and the `README.md` or `CHANGELOG.md` of `vitest` and `fast-check` under `node_modules` for the configuration and assertion APIs (global setup, reporters, `fc.assert` options). Note every version in your fragment.
2. `errors.ts`, `caps.ts`, `arith.ts`, in that order (`arith.ts` imports `EngineOverflow`). Write the `Arith` checks of `overflow.test.ts` first, run them red, then implement. Commit: `P0-A2: errors, caps, arithmetic`.
3. `_harness.ts` with the loader, the hash guard, `TYPE_NAMES`, `GOLDEN_KEYS_BY_PHASE`, the comparison helpers and `covers()`; `vitest.config.ts` with the global setup that clears, merges and writes `coverage.json`; `harness.test.ts`. The harness imports `boardFromName` for `boardOf`, so write the `board.ts` skeleton (type and function stubs that throw) at the same time. Commit: `P0-A2: golden harness and coverage registry`.
4. `p0-types-cartan.test.ts` and `p0-board-kind.test.ts`, red; then `board.ts` in the order `boardKind`, `cartan`, `boardFromName`, `adjacency`, `fromAdjacency`, `toLabels`, `toPositions`, `cartanNumbers`; green. Commit: `P0-A2: boards, cartan for every finite family, boardKind`.
5. `moves.test.ts`, `p1-involution.test.ts`, `labels.test.ts`, the `bigint_test` parts of `overflow.test.ts`, red; then `moves.ts`; green. Commit: `P0-A2: mutate and fire, property 1, labels and overflow tests`.
6. `index.ts`; `npx tsc --noEmit -p packages/engine`; `npm test -w packages/engine`; inspect `coverage.json`; the grep checks of section 6. Fix every type error; suppress none. Commit: `P0-A2: public API`.
7. `decisions/P0-A2.md`; the report of section 10. Do not run the browser suite, `npm run size` or `npm run lab`.

A partial result is usable from step 4 on: `P0-A5` needs `boardFromName`, `mutate`, `fire`, `toLabels`, `toPositions` and the error classes; if you must stop early, say exactly which of these exist and pass their tests.

## 9. Traps

1. $C=2I-A^{\mathsf T}$, not $2I-A$. `adjacency` gives `A[i][j]` as roads from `i` to `j`; `C[i][j] = -A[j][i]`. On a simply laced board the two agree, so the test that catches a transposition is $B_2$: the adjacency `golden.types.B2.adjacency` (which is `[[0, 2], [1, 0]]`) must give Cartan `[[2, -1], [-2, 2]]`, and `golden.types.G2.adjacency` (which is `[[0, 1], [3, 0]]`) must give `[[2, -3], [-1, 2]]`. The adjacencies are quoted here to explain the trap; in test source read them from `golden.types` or derive them from the 2.8 literals (5.9), never type them.
2. The multiply laced entries, in positions: $B_n$ has `C[n-1][n-2] = -2` (the 1-based $C_{n,n-1}$ of 2.8), $C_n$ has `C[n-2][n-1] = -2`, $F_4$ has `C[2][1] = -2`, $G_2$ has `C[0][1] = -3`. Check every one against `types[*].cartan`; the oracle's `link(i, j, cij, cji)` takes 1-based arguments and writes `C[i-1][j-1] = cij`.
3. `SafeInt.mul` must check the product, not only sums. `Number.isSafeInteger(2 ** 53)` is `false`; `Number.MAX_SAFE_INTEGER` is `9007199254740991`. `fromInt` must check too.
4. `fire` changes every entry by `-C[j][i] * a[i]`, the column `i` of `C`; `mutate` uses the row `i`. Do not transpose by habit, and do not trust property 1 to catch it: the transposed formulas are involutions too. Only the asymmetric vectors of Appendix A.1 ($B_2$: $(1,1)\to(-1,3)$; $G_2$: $(-1,2)\to(5,-2)$) and the mutation lines ($B_2$: mutating city 2 of $(1,2)$ gives $(1,0)$) tell row from column in phase 0.
5. The harness loads `reference/golden_data.json` by a path relative to the harness file (`import.meta.url`), never relative to the working directory, so it works from any worktree and from the primary checkout.
6. The overflow move. `first_move_after_which_an_entry_exceeds_2_to_53 = 39` counts moves from 1 and tests the stored entries after the move with `> 2 ** 53`. A `SafeInt` that checks every operation throws during move 38, because the product `3 × 3416454622906707 = 10249363868720121` is formed before the safe result `8944394323791464`. Assert move 38 and explain it in the comment; do not loosen the test to "throws at some point", and do not weaken `SafeInt` to check only final entries so that 39 comes out. The firing replay throws at move 38 as well (it fires position 1, whose number is `3416454622906707`). The entries of both replays are every second Fibonacci number ($F_2, F_4, F_6, \dots$: 1, 3, 8, 21, 55; after 37 moves $F_{74}$ and $F_{76}$), a quick way to check a replay by hand.
7. The oracle's `cartan(letter, n)` does not validate ranks: `cartan('B', 1)` returns `[[-2]]`, `cartan('D', 3)` returns an $A_3$ in another numbering, `cartan('E', 9)` and `cartan('G', 3)` return disconnected matrices, `cartan('A', 0)` returns `[]`, and `cartan('E', 5)` and `cartan('F', 3)` raise `IndexError`. The engine throws `NotABoard` for every rank outside 2.8 and for every unknown letter; the test of 5.9 lists the cases.
8. The oracle's `cartan` takes two arguments; the engine's takes one string. Parse strictly: `B2` and `C2` are both names; `A3~`, `B2~`, `C2~`, `D4^(3)`, `pentagon`, `square` are phase 2 names and throw in phase 0 (do not pin that in a test; see 5.5).
9. `-0`. `(-1) * 0` is `-0`, `Math.sign(-0)` is `-0`, `Object.is(-0, 0)` is `false`. Normalise in `SafeInt` so that `show` is `"0"` and `sign` is `0` for every zero result.
10. `boardKind` runs on plain numbers and must not receive a `bigint` matrix (`2n !== 2`). Compute the kind from the integer matrix in `fromAdjacency`, then convert to `bigint` for a `Big` board. A non-integer entry such as `-0.5` is `'not-a-board'` by the oracle's docstring; `-1.0` is an integer.
11. Labels in the golden file. `mutation_nodes` begins `2, 1, 2, 1` and `firing_nodes` begins `1, 2, 1, 2`; on the two-node board labels `1, 2` are positions `0, 1`. Convert with `toPositions` in `overflow.test.ts`; never subtract 1 by hand in a test, and never add 1 in `src/`.
12. Vitest isolation. Each test file runs in its own worker with its own module instances; a `Set` inside `_harness.ts` is empty in the global setup process. Persist `covers()` registrations to disk and merge in the teardown; clear the previous run's registrations at the start of every run, or a removed `covers()` call would go unnoticed.
13. Vitest 5 and fast-check 4 postdate most training data (`SPEC.md` 7.2 item 6; `COMMON.md` 3). Read the installed type definitions for `globalSetup`, `reporters`, `include`, and for `fc.assert`, `fc.property`, `fc.integer({ min, max })`, `fc.array(arb, { minLength, maxLength })`, `fc.constantFrom`. Do not write the Vitest 1 or fast-check 3 forms from memory.
14. `JSON.stringify` throws on `bigint`. Compare by `show()` text or through `intEq`; never stringify a `Big` vector in a test or an error message without converting.
15. The `bigint_test` board `[[2, -3], [-3, 2]]` equals no finite type, so `fromAdjacency` must give `Big`; the $A_2$ adjacency `[[0, 1], [1, 0]]` equals a finite type and gives `SafeInt` with `name: 'A2'`. Do not implement this with `identify` (phase 2); exact equality against `cartan(X)` only.
16. `P0-A1`'s `index.ts` is an empty export so that the package compiles before you exist; your `index.ts` must export every name of 5.7 or `P0-A5` cannot import in stage 0.3. Check with `node --input-type=module -e "import('./packages/engine/dist/index.js')"` only if `P0-A1` configured a build step; otherwise rely on `tsc --noEmit` and the Vitest imports through the package name.
17. Purity (E-5). `mutate` must copy before writing (`const q = [...p]`); `fire` must build a new array; `cartan`, `adjacency`, `cartanNumbers`, `toLabels`, `toPositions` return fresh arrays. A frozen board must never be written to.
18. `cartan` returns `number[][]`; a `Board<bigint>` carries `bigint` entries in `cartan`. `mutate` and `fire` multiply `C[i][j]` by `p[j]` in the board's arithmetic, so the matrix must already be in that arithmetic; do not mix `number` and `bigint` (`TypeError: Cannot mix BigInt and other types`).
19. No floats, no `Math.random`, no `Date`, no `console.log` in `src/`. Floating point appears only in the geometry functions of later phases and in `spectralRadius`.
20. The engine does not cap `n`. `cartan('A12')` works; so does a 13-node adjacency. The cap of 12 belongs to the editor and to `resolveBoard` (`CAPS.customNodes`).
21. Your `tsconfig` comes from `P0-A1`. If it includes a DOM `lib` or excludes `test/`, do not edit it; write the request and record the command you used to type-check the tests.
22. Em-dashes are forbidden in everything you write, comments and messages included (`COMMON.md` 4.4).

## 10. Report

The JSON of `COMMON.md` 5.2, with `"agent": "P0-A2"`, `"branch": "agent/P0-A2"`, the worktree path printed by `git rev-parse --show-toplevel`, every commit, every file changed, and in `commandsRun` at least: `node --version`, `shasum -a 256` of the three reference files, `npx tsc --noEmit -p packages/engine`, `npm test -w packages/engine` (with the pass count), the `coverage.json` inspection command, the two `grep` checks of section 6. In `acceptance`, one line per checklist item of section 6 with the test name that proves it; `not-automated` appears nowhere in this task. Additional fields this task must include (plan):

- `"coverageKeys"`: the `keys` array of `coverage.json` after your run (expected `["types[*].adjacency", "types[*].cartan"]`).
- `"missingByPhase0"`: `missingByPhase["0"]` from the same file (expected `[]`).
- `"overflowMove"`: the one-based move at which `SafeInt` threw in `overflow.test.ts` (expected `38`) and the golden `first_move_after_which_an_entry_exceeds_2_to_53` (expected `39`).
- `"referenceHashes"`: the three SHA-256 values you computed.
- `"versions"`: `node`, `typescript`, `vitest`, `fast-check` as installed.
- `"publicApi"`: the list of names exported by `index.ts`.

`requests` must name: the `.gitignore` lines for `coverage.json` and `.coverage/` (to `MERGE`: `.gitignore` is `P0-A6`'s in this stage, README section 6, and `P0-A6` runs beside you); any change needed in `packages/engine/package.json` or `tsconfig.json` (to `P0-A1`); `fast-check` if it is missing. `requests` must also carry the question about the name of the $C_2$ matrix from `fromAdjacency` (5.5), to the orchestrator. `deviations` names anything in which you departed from `CONTRACTS.md` 2.2 to 2.5 or 3, or from the roster, with the reason; the expected list has one entry: the overflow test asserts move 38, not the roster's literal "the move after first_move_after_which_an_entry_exceeds_2_to_53" (move 40), for the reason given in 5.9. `handoff` tells `P0-A5` which functions to import and how a `Board<number>` for $A_2$ is obtained (`boardFromName('A2')`), and tells the phase 1 engine agent where to append in `board.ts`, `moves.ts` and `index.ts` and which key spellings `GOLDEN_KEYS_BY_PHASE[1]` expects.
