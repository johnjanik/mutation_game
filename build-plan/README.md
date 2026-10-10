# Build and red-team plan: Two Games on a Dynkin Diagram

Version 1 of the plan, 10 October 2026. Written for the project owner to review before the build is launched. Covers `SPEC.md` version 1.1 and `SOURCES.md` version 1.1.

This directory is the orchestration layer for building the site with many Claude Code agents. It does not change anything in the specification. Where it adds a rule, the rule is about how agents work together; the mathematics, conventions, tools, lessons, tests and gates are those of `SPEC.md`.

---

## 0. Read this first: three things to settle before launch

1. **Node 22 is installed** (settled 10 October 2026, after this plan's first draft found it missing): `node` 22.23.3 and `npm` 10.9.9 from Homebrew's `node@22` are on PATH, which satisfies section 7.1 (Node 22.12 or later). The pre-flight repeats the check at launch.
2. **Python is 3.9.6, and that is enough.** The oracle (`reference/verify.py`) was validated by its authors on 3.11, 3.12 and 3.13. I ran it on this machine's 3.9.6: all 6649 checks pass in 133 seconds and the regenerated file is byte for byte the committed `golden_data.json`. So `npm run verify` works as the specification intends with the system Python. The pre-flight repeats this check at launch.
3. **The repository is on GitHub** (settled 10 October 2026): `github.com/johnjanik/mutation_game`, `main` tracking `origin/main` over SSH, with the owner's AGPL-3.0 `LICENSE`, the specification package and this plan committed. `gh` is not installed; plain `git` pushes work. The deploy workflow stays skipped until the owner enables Pages and sets `DEPLOY_PAGES`. D4 is answered for the code licence (AGPL-3.0-only); the content licence keeps the CC BY-SA 4.0 default until the owner says otherwise. Pushing to GitHub is the owner's act; `MERGE` and `GATE` commit locally only.

Machine: 8 processors, 8 GB of memory, 59 GB free. The memory is the limiting resource for parallel agents (each worktree runs its own `npm ci`, Astro build and Playwright). The workflows therefore run at most **four** build agents at once, and only one agent at a time runs the full browser suite.

---

## 1. What is being built, in one paragraph

A static Astro 7 site with Svelte 5 islands, a dependency-free TypeScript engine that reproduces `reference/golden_data.json`, sixteen interactive tools, eleven lesson modules, an atlas, and the supporting pages, built in the seven phases of `SPEC.md` section 9 with the gates of section 9.1. Each phase is built by a small team of agents working in parallel where the dependencies allow, integrated by a gate agent that runs the automatic part of the gate, and then attacked by a red team of adversarial agents whose confirmed findings are fixed and re-tested before the phase is declared done.

---

## 2. How the plan is organised

| File or directory | What it is |
|---|---|
| `README.md` (this file) | The plan: roster, dependency order, orchestration, red-team protocol, gates, what the owner sees |
| `COMMON.md` | The preamble every **build** agent receives before its own instruction |
| `CONTRACTS.md` | The interfaces that agents working in parallel must agree on without talking: package layout, engine API surface by phase, tool component props, state and codec API, test helpers, hooks, report format |
| `RED-TEAM-COMMON.md` | The charter every **red-team** agent receives: what to attack, finding format, severity, verification, what it may and may not touch |
| `agents/P{k}-A{m}-*.md` | One instruction per build agent, grouped by phase |
| `agents/MERGE.md`, `agents/GATE.md` | The two recurring roles: merging branches after a stage, and running a phase gate |
| `red-team/RT-{nn}-*.md` | One instruction per red-team lens |
| `red-team/RT-VERIFY.md`, `red-team/RT-FIX.md` | The verifier that tries to reproduce and to refute a finding, and the fixer |
| `rosters/phase-{k}.json` | The machine-readable roster of a phase: stages, agents, dependencies, lenses; passed to the workflow scripts as `args` |
| `workflows/build-phase.js` | The generic Workflow script that builds one phase from its roster |
| `workflows/redteam-phase.js` | The generic Workflow script that red-teams one phase from its roster |
| `workflows/preflight.js` | The pre-launch checks (toolchain, oracle, registry versions) |
| `workflows/draft-instructions.js`, `fix-gaps.js`, `consistency.js` | How the instruction files themselves were produced: drafted from the rosters and the spec, verified by an independent agent, revised, and cross-checked; rerun after any hand edit |
| `reports/` | Records of that verification: the verifier verdicts per file (`verify-gaps-*.json`), the cross-file items resolved by the consistency pass, and later the gate and merge reports of the build |

Agent ids: `P{phase}-A{number}` for build agents, `RT-{number}` for red-team lenses, `MERGE`, `GATE`, `RT-VERIFY`, `RT-FIX`. The ids are used in branch names, in `decisions/` fragments, in reports and in commit messages, so that every change on `main` can be traced to the instruction that produced it.

---

## 3. Orchestration model

### 3.1 One workflow per phase, the orchestrator in the loop

Each phase runs as two Workflow invocations with the orchestrator (the Claude Code session that launched the build) reading the results between them:

1. **Build** (`workflows/build-phase.js` with `rosters/phase-k.json`): the stages of the phase in order; within a stage the agents run in parallel, each in its own git worktree on its own branch; a `MERGE` agent merges the stage's branches into `main` and runs the fast tests; the last stage is the `GATE` agent, which runs the full automatic gate of section 9.1 and writes the gate report.
2. **Red team** (`workflows/redteam-phase.js`): the lenses that apply to the phase run in parallel against `main`; findings are deduplicated; every finding is verified by two independent agents (one reproduces, one tries to refute); confirmed findings are clustered and fixed; the fixes are merged; the lenses that found them rerun on the fixed areas; the gate reruns. The loop repeats until a round produces no confirmed finding, with a ceiling of three rounds.

The orchestrator declares the phase done when the gate report is green and the red team is dry, records the owner's part of the gate as *due* in `DECISIONS.md`, and starts the next phase. This is the rule of section 9.1: the automatic part gates the next phase, the owner's part never does.

### 3.2 Branches, worktrees and merging

- `main` changes only through `MERGE` and `GATE` agents, which are the only agents that run in the primary checkout (`/Users/john/Claude/MutationGame`) rather than in a worktree. Build agents never commit to `main`.
- Every build agent works in a fresh worktree on a branch named `agent/P{k}-A{m}` (the harness creates the worktree; the agent reports its branch and path). It commits its own work with messages prefixed by its id.
- Each agent has a **file ownership** list (section 6 of this file and each agent's instruction). It edits only files it owns or that are listed as shared with a stated protocol. Two agents never own the same file in the same stage.
- Shared files with a protocol: `DECISIONS.md` is written only by `MERGE` and `GATE`, from fragments that build agents leave in `decisions/<agent-id>.md`; root `package.json` and the lockfile are edited only by `P0-A1`, `P0-A6`, `P1-A2`, `MERGE` and `GATE` (a build agent that needs a dependency writes the request into its decisions fragment and stops short of installing it, except where its instruction names the dependency); `content/unverified.json` gains new items only through `MERGE`, which assigns the next free number to items that lesson agents propose.
- The merge order within a stage is the order in the roster. Conflicts are resolved by `MERGE` in favour of the specification, not of either branch; a conflict that needs a design decision is reported, not guessed.

### 3.3 Why the stages are what they are

The dependencies that force sequence are: the engine functions of a phase before the tools of that phase; the state, codec and drawing libraries before the first tool; the tools of a module before its lesson (a lesson places the tools and cannot be built or tested without them); everything before the gate. Everything else runs in parallel. The result is four stages in most phases: engine and libraries; tools and pages; lessons; gate. Phase 0 has an extra first stage because the repository must exist before worktrees can.

### 3.4 Concurrency and resources

- At most four build agents run at once (the workflow chunks larger stages). Red-team lenses are read-only and lighter; up to six run at once.
- Each worktree runs `npm ci --prefer-offline` once; the npm cache makes the second and later installs fast. Playwright browsers are installed once per machine (`npx playwright install chromium webkit`), not per worktree.
- Build agents run only their own test files and the engine suite. Only `MERGE` and `GATE` run the whole browser suite, `npm run size` and `npm run lab`, so that two Playwright runs do not compete for memory.
- Agents are sized S, M or L as in section 9.1. An L task is split (engine phases 3 and 6; the Satake studio has a separate catalogue agent). No agent is asked to hold more than one tool or one lesson, the specification's unit of a pull request.

### 3.5 Model policy

Decided by the owner on 10 October 2026, after the first drafting run exhausted the account's five-hour window for the session model: build agents run on Opus 5.5 by default; the engine ports (`engine-*` agents), `RT-VERIFY` in both modes, `MERGE` and `GATE` run on the session model (Fable 5.1); red-team lenses and `RT-FIX` run on Opus. A roster entry may set `"model"` to override its agent. The policy lives in `workflows/build-phase.js` (`modelFor`) and `workflows/redteam-phase.js` (`OPUS`), and can be changed at any gate. The instruction files were drafted on Fable for phase 0 and on Opus afterwards, with every file verified by an independent agent either way.

### 3.6 What happens when an agent fails

An agent that cannot finish reports `status: partial` or `blocked` with what is done and what is not. The orchestrator decides: re-run with the report as added context, split the task, or carry the gap to the red team as a known open item. A blocked agent never leaves half-merged work on `main`, because it never touches `main`.

---

## 4. The roster

Sizes are the specification's (S, M, L). "Owns" is summarised; the full ownership list is in each agent's file. Every build agent also owns its own tests and its `decisions/<id>.md` fragment.

### Phase 0: Foundations (gate G0)

| Stage | Agent | Task | Size | Depends on |
|---|---|---|---|---|
| 0.1 | `P0-A1` repo-scaffold | `git init`; npm workspaces; Astro 7, Svelte 5, MDX, TypeScript 6.0.x pinned exactly after checking the registry; layout of section 7.3; `CLAUDE.md` from Appendix H; `DECISIONS.md`, licences, `.gitignore`; `astro.config.mjs` with `site`/`base` from the environment; the three workflow files; Vitest and Playwright configuration; first commit | S | nothing |
| 0.2 | `P0-A2` engine-core | `Arith` with `SafeInt` and `Big`; `Board`; `cartan`, `boardFromName` (finite), `fromAdjacency`, `adjacency`, `boardKind`, `toLabels`, `toPositions`, `mutate`, `fire`; error classes; the golden-test harness with the seven comparison rules; phase-0 golden tests for all 32 types; property test 1 | S | 0.1 |
| 0.2 | `P0-A3` math-spike | The rendering spike of 7.2 item 3: route (a) against route (b) on one `.mdx` page each; `lib/katex.ts` with `renderTex`; KaTeX self-hosted with CSS and fonts from the same installed package; `scripts/names.mjs` skeleton; the decision in a fragment | S | 0.1 |
| 0.2 | `P0-A6` scripts-and-ci | `scripts/size.mjs`, `scripts/verify.mjs`, `scripts/numbers-in-prose.mjs`, `scripts/lab.mjs` stub with a decisions note, hook-up of `names.mjs`; the bodies of the npm commands of 7.7; the `BASE_PATH=/sub/path/` browser test | S | 0.1 |
| 0.3 | `P0-A4` content-components | `<G>`, `<Tex>`, `<Unverified>`, `<Cite>`; `lib/golden.ts` path resolver with the selection grammar; `content/unverified.json` seeded with E1 to E17; `SOURCES.md` key parser; build failures on bad keys and paths; unit tests | S | 0.2 merged (needs `lib/katex.ts`) |
| 0.3 | `P0-A5` board-seed | The board component family (`Board`, `Node`, `Roads`, `History`) with the keyboard model A-1, the live region A-4 and `lib/a11y.ts`, the sign encoding of 6.3, hooks of 4.0, undo/redo/reset; the index page with one board on $A_2$ rendered at build time and hydrated, showing mathematics; the phase-0 `about` and `credits` pages (7.3 places them in phase 0; `about` is the no-tool page measured against the 15 kB limit); Playwright keyboard script, axe, no-JavaScript check | M | 0.2 merged (needs the engine and `lib/katex.ts`) |
| 0.4 | `GATE` (G0) | Merge; run G0 exactly as 9.1; gate report | | 0.3 merged |

### Phase 1: The two moves (gate G1)

| Stage | Agent | Task | Size | Depends on |
|---|---|---|---|---|
| 1.1 | `P1-A1` engine-1 | The phase-1 functions of 5.3 and 5.4 (components, transposeBoard, subBoard, determinant, Rational, matrices, toNumbers, toPopulation, applyWord, legalNodes, raisingNodes, play, raisingPlay, kostantPlay, orbit, orbitGraph, wordTo, roots, positiveRoots, highestRoot, highestShortRoot, coxeterNumber, longestWord, minusW0, minusculeNodes); phase-1 golden tests; property tests 1 to 4, 6, 7, 8 | M | G0 |
| 1.1 | `P1-A2` site-infra | `lib/state.ts`, `lib/urlCodec.ts` with every validation rule of 6.6, `lib/worker.ts` (E-9 routing), `lib/export.ts` (JSON), History API throttling, the highlight store, `lib/a11y.ts` announcement templates; the generic no-JavaScript Playwright run; codec unit tests | M | G0 |
| 1.1 | `P1-A3` draw-layout | Node layouts of 6.1 with the size rule, road styles of 6.2, palette and themes of 6.3 as CSS custom properties, `draw/layeredLayout.ts`, hit-area rule A-7 | S | G0 |
| 1.1 | `P1-A4` pages | Glossary seeded from Appendix C; `sources.astro` from `SOURCES.md` (Markdown, KaTeX at build time, sections 11.1 to 11.6 only); `open-items.astro` (preview builds only); about and credits extended; the lesson layout and components of 8.2; `released` flag handling | M | G0 |
| 1.2 | `P1-A5` T1 game-board | Tool T1 complete: views, modes, coords (fractions), script, goal, prediction, hints, panels, roadStyle; acceptance of T1 as tests | L | 1.1 merged |
| 1.2 | `P1-A6` T2 orbit-garden | Tool T2: roots and orbit modes, follow and explore, layers and caps with the exact stop messages, positive-roots-only poset view, counter, chart off the finite types | M | 1.1 merged |
| 1.2 | `P1-A7` T9 kostant | Tool T9 over T1's raising mode: moods, end caption, final-numbers marking, the affine recipe caption; `raisingPlay`; phase-1 acceptance | S | 1.1 merged |
| 1.3 | `P1-A8` lesson M0 | Module M0 as MDX from section 3 and the figure table; predictions, challenges, `<G>` everywhere; draft mark | M | 1.2 merged |
| 1.3 | `P1-A9` lesson M1 | Module M1 | M | 1.2 merged |
| 1.4 | `GATE` (G1) | | | 1.3 merged |

### Phase 2: Form and classification (gate G2)

| Stage | Agent | Task | Size | Depends on |
|---|---|---|---|---|
| 2.1 | `P2-A1` engine-2 | The phase-2 functions: symmetrizer, gram, cartanClass, relabellings, identify, affineCandidates, identifyAffine, classify, smallestNonfiniteSubboard, affineExtension, marks, comarks, spectralRadius, boardFromName (affine, twisted, pentagon, square), playFate, isRootPopulation, coroot, formValue, formIsInvariant, level; the guards of E-11 with the `WeakMap` cache; phase-2 golden tests; property tests 5, 10, 13 | L | G1 |
| 2.1 | `P2-A6` svg-png-export | SVG and PNG export of any tool's figure with the footer line of 8.3; export tests | S | G1 |
| 2.2 | `P2-A2` T3 form-finder | Meter, builder with witness, small values | M | 2.1 merged |
| 2.2 | `P2-A3` T4 classification-lab | The board editor (`BoardEditor.svelte`, shared with T16), verdict panel, balance and weights, spectral radius, smallest non-finite sub-board, root counter with worker continuation, conjecture hunter | L | 2.1 merged |
| 2.2 | `P2-A4` T15 affine-playground | Frozen population, marks and comarks, the pentagon in both conventions with the level meter, three fates | M | 2.1 merged |
| 2.2 | `P2-A5` T16 sandbox | The editor with both games in free play on `Big`, JSON import and export; the `bigint_test` acceptance | S | 2.1 merged; composes `BoardEditor` by contract |
| 2.2 | `P2-A7` phase-2-additions | The parts of T2 and T9 that section 4 assigns to G2 (verdict beside the stop message; affine board name and button; "play on"); the open-problem page; the rule that a tool calls `classify` once on load; the sandbox link added to M0 and M1 | M | 2.1 merged |
| 2.3 | `P2-A8` lesson M2 | | M | 2.2 merged |
| 2.3 | `P2-A9` lesson M3 | | M | 2.2 merged |
| 2.4 | `GATE` (G2) | | | 2.3 merged |

### Phase 3: Duality and the Weyl group (gate G3; release 0.5)

| Stage | Agent | Task | Size | Depends on |
|---|---|---|---|---|
| 3.1 | `P3-A1` engine-3A | separatingRoots, wavePlay, exponentsFromFired, weylOrder, orbitSize, weylDimension, countCompleteGames, legalLayers, allCompleteGames; their golden tests | M | G2 |
| 3.1 | `P3-A2` engine-3B | bipartition, heap, heapKey, commutationClassSize, symbolicPlay, choleskyBasis; their golden tests; property test 12; the `Vitest` benchmark of 7.6 (25 ms) | M | G2 |
| 3.1 | `P3-A7` lab-timings | `npm run lab`: Lighthouse CI if it runs within the hour, else the Playwright fallback of 7.6; decision fragment | S | G2 |
| 3.2 | `P3-A3` T5 numbers-game-lab | Start chooser, tape, tally with exponents, wave, two games compared, dimension calculator | M | 3.1 merged |
| 3.2 | `P3-A4` T6 kaleidoscope | The rank-2 plane with mirrors, triangular basis, exact fractions, drag with snapping and key equivalents, overlays | M | 3.1 merged |
| 3.2 | `P3-A5` T7 symbolic-game | Two boards; `LinearForm.svelte` as MathML with the engine check of 7.3 and the span fallback | S | 3.1 merged |
| 3.2 | `P3-A6` T8 weyl-explorer | Layered graph for $\lvert W\rvert\le1152$, words and separating roots, counter, heap view, SVG snapshot above 192 elements | L | 3.1 merged |
| 3.3 | `P3-A8` lesson M4 | | M | 3.2 merged |
| 3.3 | `P3-A9` lesson M5 | | M | 3.2 merged |
| 3.4 | `GATE` (G3) | Includes a release build with its two reports; sizes and lab timings on M0 to M5 | | 3.3 merged |

### Phase 4: Multiple edges and geometry (gate G4)

| Stage | Agent | Task | Size | Depends on |
|---|---|---|---|---|
| 4.1 | `P4-A1` engine-4 | symmetries, fold, averagedRootsType, averagedSimpleCartan, symEig, euclideanBasis, coxeterPlanePoints, coxeterPlaneRings, coxeterWord, applyWordFloat, wythoffFaceTypes, wythoffFVector, wythoffEdges; golden tests; property test 11 | L | G3 |
| 4.1 | `P4-A2` projector | `draw/projector.ts`: rotations in coordinate planes, orthogonal projection, depth cue, Canvas 2D drawing and the same code producing SVG in Node; the build-time preset pipeline (vertices and edges as data files of at most 30 kB compressed) | M | G3 |
| 4.2 | `P4-A3` T10 geometry-studio | Rings, root polytope, projections, two graphs, make uniform, showpiece, limits, presets, no-JavaScript SVG; the drawing-time test | L | 4.1 merged |
| 4.2 | `P4-A4` T11 folding-bench | Symmetric play on both boards, the average tab, Bourbaki order of the folded board | M | 4.1 merged |
| 4.3 | `P4-A5` lesson M6 | | M | 4.2 merged |
| 4.3 | `P4-A6` lesson M7 | | M | 4.2 merged |
| 4.4 | `GATE` (G4) | | | 4.3 merged |

### Phase 5: Representations (gate G5)

| Stage | Agent | Task | Size | Depends on |
|---|---|---|---|---|
| 5.1 | `P5-A1` engine-5 | `SparseMatrix`, minusculeMatrices, signedMoves, chevalleySerre, stringThrough; golden tests | M | G4 |
| 5.2 | `P5-A2` T12 representation-builder | Orbit in layers, matrix grids and lists, relation checker, signed moves, string viewer; `MatrixView.svelte` | M | 5.1 merged |
| 5.3 | `P5-A3` lesson M8 and the not-quiver-mutation page | | M | 5.2 merged |
| 5.4 | `GATE` (G5) | | | 5.3 merged |

### Phase 6: Real forms, atlas, release 1.0 (gate G6)

| Stage | Agent | Task | Size | Depends on |
|---|---|---|---|---|
| 6.1 | `P6-A1` engine-6A | theta, shadow2, admissibility with `Reason` records, satake, restrictedBoard, `classifyRestricted` ported as it stands; golden tests for `satake_examples`, `admissible_pairs`, `admissible_counts`; property test 9 | L | G5 |
| 6.1 | `P6-A5` latex-and-embed | LaTeX export of 6.7 (`\dynkin` with explicit marks; TikZ for graphs and projections); `/embed/<tool>` routes; the "Cite" text | S | G5 |
| 6.1 | `P6-A6` pages-6 | History timeline (M10 order and credit), common-confusions page (D16, Appendix D worded generally), credits and licences (7.9), footer with versions | S | G5 |
| 6.1b | `P6-A2` engine-6B | satakeCatalogue from the parametric rules of 6.4, satakeRecord with the $C_2$ adjustment, canonicalPair, matchCatalogue; the `satake` golden test for all 167 records; `scripts/names.mjs` for every catalogue name | M | 6.1 `P6-A1` merged |
| 6.2 | `P6-A3` T13 satake-studio | Decorate, three lights with reasons, play theta, shadows picture and table, restricted board with composite words, catalogue, toggles | L | 6.1b merged |
| 6.2 | `P6-A4` T14 atlas | `atlas/[board].astro` for every board with the convention switch, every item linked to its tool, downloads | M | 6.1b merged |
| 6.3 | `P6-A7` lesson M9 | | M | 6.2 merged |
| 6.3 | `P6-A8` lesson M10 | The hub for atlas, sandbox, history and sources; glossary completion | S | 6.2 merged |
| 6.4 | `GATE` (G6) | Release 1.0 build; full accessibility scan; sizes and lab timings on every page; open-items report; the two archives of 7.8 | | 6.3 merged |

### Phase 7: Extensions (after 1.0; see `agents/P7-overview.md`)

Golden boards first (D9), then representations with one zero weight, generalized Satake diagrams, Vogan diagrams side by side, web components. Each is one or two agents with its own golden tests (5.7, phase 7). They are briefed, not fully specified, because the owner's reading of release 1.0 may change their order.

**Totals**: 7 phases, 50 build-agent instructions, 2 recurring roles, 13 red-team lenses, 2 red-team roles. Roughly 60 build-agent runs and, at two red-team rounds per phase, roughly 180 red-team runs (lenses, verifiers and fixers together) across phases 0 to 6.

---

## 5. The red team

### 5.1 Charter in one paragraph

The red team's job is to find the ways in which the build is wrong, incomplete, or only appears to pass. It never improves the product directly; it produces findings with reproductions. A finding survives only if a second agent reproduces it and a third fails to refute it with a citation of the specification. Confirmed findings are fixed by separate agents, every confirmed correctness bug becomes a permanent test, and the lens that found a bug reruns after the fix. The red team is dry when a full round produces no confirmed finding.

### 5.2 The thirteen lenses

| Lens | Attacks | Applies from |
|---|---|---|
| `RT-01` differential-oracle | Runs the TypeScript engine against the Python oracle on **random** boards and positions beyond the golden data: random bidirected and one-way boards up to 12 nodes, random populations and positions, long random plays; compares every function pair of sections 5.3 and 5.4 that exists; also recomputes a sample of golden values independently from the definitions of section 2 without reading the engine source | phase 0 |
| `RT-02` convention-drift | Reads the engine source hunting for sign, transposition and label errors that symmetric test boards cannot detect: $C$ against $C^{\mathsf T}$, roads into against roads out of, positions against labels (E-7), the lowest-position rule, node 0 first on affine boards, `B2` not `C2`, the reversed board for minuscule nodes and fired forms. Constructs asymmetric cases where each confusion would show and checks that such a test exists | phase 0 |
| `RT-03` bounds-and-errors | Caps, truncation flags, `completeLayers`, `maxDepth` against cap, `SafeInt` overflow at exactly $2^{53}$, `Big` fallback, every error class of E-10 on every input kind of the table in 5.6, hostile matrices (non-square, floats, strings, 13 nodes, empty, diagonal not 2, positive off-diagonal), `null` returns, the 20000-step cap of the root test | phase 0 |
| `RT-04` codec-attacker | Every validation rule of 6.6 by construction of a failing input; round-trip and idempotence properties; links that would show an illegal position; prefixing on lesson pages; `replaceState` throttling; injection strings; the notice text; old schema numbers | phase 1 |
| `RT-05` a11y-and-layout | A-1 to A-12 by hand-written Playwright scripts, not by axe alone: roving tabindex and the 45-degree arrow rule, polygon wrap, Home and End, `u` and `r` only inside the board, live-region templates character for character, changed-nodes-only above four nodes, burst coalescing, focus ring, the hit-area rule of 6.1 at 320 pixels for every standard layout, contrast computed from the shipped CSS in both themes, reduced motion, table view, no drag-only action | phase 0 |
| `RT-06` no-js-and-no-worker | JavaScript disabled on every page: text, default figures, tables, captions, disabled controls, `<details>` fallback of predictions, SVG snapshots of T10 and T8, the `<noscript>` line; and the rule that no default state fetches the worker (intercept the worker script and fail if it loads before the first interaction) | phase 0 |
| `RT-07` perf-budget | The four limits of 7.6 per route, with an independent measurement; a tool that drags the whole engine into its chunk; KaTeX or any typesetting code in the client bundle; the 25 ms benchmark; the 100 ms $E_8$ drawing test; reserved box sizes and layout shift; `client:idle` and `client:visible` as specified | phase 0 |
| `RT-08` content-rules | For every lesson and page: every number with a golden value written with `<G>`; every [U] statement wrapped; the bridge sentence of 2.4(a) verbatim wherever both views appear; the stated-limit wording; "not of finite type" only after `classify`; the careful wording on a failed condition 3; no em-dashes; terms from Appendix C; anatomy of 8.2; two predictions and three challenges in M0 to M9; 800 to 1800 words; draft mark; credit lines; no sentence copied from a source; none of the Appendix F statements the site must not repeat | phase 1 |
| `RT-09` math-claims | Every mathematical claim in a lesson or page checked against section 2 and the golden data; every figure configuration against the tables of section 3 (board, view, mode, start, expected result); every "for readers who know Lie theory" paragraph for correct standard names; conventions stated when a source with another convention is quoted | phase 1 |
| `RT-10` spec-compliance | The phase's checklist walked item by item: every function of the phase exists with the contracted signature and the behaviour of 5.6 off the finite boards; every acceptance criterion of every tool of the phase is an **automated** test that fails when the behaviour is removed; the gate's commands run as written; hooks present; presets of section 3 exist as `preset` values; `DECISIONS.md` entries for defaults and dependencies; exact pins; engine `package.json` without dependencies; `CLAUDE.md` matches Appendix H | phase 0 |
| `RT-11` test-integrity | Did the builders game the tests: skipped or `.only` tests, assertions removed or inverted, tolerances loosened, tautological comparisons, golden values copied into source, the golden file or `verify.py` modified (hash check), golden keys of the phase without a test (cross-reference the table in 5.7 with the test files), tests that pass against an empty implementation (mutation testing by hand on a sample) | phase 0 |
| `RT-12` toolchain-reality | The pinned versions exist and are the ones 7.2 names; `astro dev` nowhere in CI or scripts; `site` and `base` from the environment and the `BASE_PATH=/sub/path/` test; release against preview build semantics of `<Unverified>`; KaTeX CSS and fonts from the same installed package that rendered the HTML; lockfile committed; `engines` field; the deploy job skipped without `DEPLOY_PAGES`; Svelte 4 patterns absent | phase 0 |
| `RT-13` reader-playtest | An agent in the role of the primary reader (first-year linear algebra, no Lie theory) works through the released modules on the built site, answers the playtest questions of 9.4 afterwards from what the site taught, and reports where it stopped reading, which tool it would skip, every wrong prediction, and where principles P1 to P12 cannot be pointed to | phase 1 |

### 5.3 The protocol of a red-team round

1. **Find.** The lenses that apply run in parallel against `main` at the gate commit. Each returns a list of findings in the schema of `RED-TEAM-COMMON.md`: lens, severity, title, location, claim, reproduction, the specification passage it violates, proposed fix, and a reproducer committed to the lens's own branch `redteam/P{k}-RT-{nn}` as a test or script.
2. **Dedupe.** Findings with the same location and claim are merged in plain code (not by an agent).
3. **Verify.** For each finding two agents run in parallel: one `RT-VERIFY` in reproduce mode (run the reproducer on a clean checkout; does it fail as claimed?) and one in refute mode (argue from the specification that the behaviour is permitted or the finding misreads a passage; it must cite a section). A finding is **confirmed** when it reproduces and is not refuted. A finding that does not reproduce is dropped; one that is refuted with a citation is dropped and the citation is recorded.
4. **Fix.** Confirmed findings are clustered by file area; one `RT-FIX` agent per cluster works in a worktree: it fixes the cause, keeps or adds the reproducer as a permanent test, never changes a golden value or a convention, and reports. `MERGE` merges the fixes.
5. **Retest.** The lenses that produced confirmed findings rerun on the fixed areas, and `GATE` reruns the phase gate.
6. **Repeat** from 1 until a round confirms nothing, or three rounds have run. If the third round still confirms blockers, the phase is not done and the orchestrator reports to the owner.

Severity: **blocker** (a convention, a golden mismatch, a gate command that fails, a wrong statement presented as fact, an inaccessible tool) fails the gate; **major** (a stated behaviour missing, a cap not honoured, a size budget exceeded, a prose rule broken) must be fixed before the release that contains it, and in practice is fixed in the round; **minor** (wording, naming, a missing hook name in a test file) is fixed if the fixer is already in the file, else logged.

### 5.4 What the red team never does

It never edits `main`, a golden file, `verify.py`, a convention, or a test to make it pass. It never marks a finding fixed. It never sets an item of `content/unverified.json` to closed. It writes only to its own `redteam/` branch and the scratch directory.

---

## 6. File ownership, by area

The table says which agent may create or edit files in each area. An agent whose task needs a change in another agent's area writes the request in its report and its decisions fragment, and the owning agent or `MERGE` makes the change.

| Area | Owner |
|---|---|
| Root files (`package.json`, lockfile, `tsconfig`, `.gitignore`, `CLAUDE.md`, licences), `.github/`, `playwright.config.ts`, the root Vitest configuration | `P0-A1` creates them all in stage 0.1. Afterwards: root `package.json` and lockfile by `P0-A6`, `P1-A2`, `P3-A7`, `MERGE`, `GATE`; `.gitignore`, `playwright.config.ts`, the root Vitest configuration and `ci.yml` by `P0-A6` (additive), then `MERGE` and `GATE`; `CLAUDE.md`, the licences, `deploy.yml` and `links.yml` by `GATE` only, on the owner's instruction |
| `DECISIONS.md` | `MERGE`, `GATE` (from `decisions/*.md` fragments written by every agent) |
| `reference/` | nobody. Read only. A hash of `golden_data.json`, `lie_games.py` and `verify.py` is recorded at phase 0 and checked at every gate |
| `scripts/` | `P0-A6`; `P0-A3` for `names.mjs`; `P3-A7` for the lab script; `P6-A2` extends `names.mjs` |
| `packages/engine/src/*` | the engine agent of the phase, by module file (see `CONTRACTS.md` section 2 for which file belongs to which phase); `P0-A2` owns `arith.ts`, `errors.ts`, `board.ts` (phase-0 part), `moves.ts` (phase-0 part), `index.ts` |
| `packages/engine/test/golden/_harness.ts` | `P0-A2`; later engine agents add helpers in their own files, never change the comparison rules |
| `site/src/components/board/*` | `P0-A5`; `P1-A5` extends; `P2-A3` adds `BoardEditor.svelte` |
| `site/src/components/tools/T{nn}*.svelte`, `site/src/tools/registry/T{nn}.ts`, `site/tests/unit/tools/T{nn}.test.ts`, `site/tests/e2e/T{nn}.spec.ts` | the tool's agent |
| `site/src/lib/katex.ts`, `site/public/katex/*` | `P0-A3` |
| `site/src/components/math/*` | `P0-A4` (`Tex.astro`), `P1-A5` (`Frac.svelte`), `P3-A5` (`LinearForm.svelte`), `P5-A2` (`MatrixView.svelte`) |
| `site/src/components/content/*`, `site/src/lib/golden.ts`, `site/src/content/unverified.json` | `P0-A4`; `MERGE` adds items |
| `site/src/components/draw/*` | `P1-A3` (`layeredLayout.ts`, layouts, roads, palette), `P4-A2` (`projector.ts`) |
| `site/src/lib/a11y.ts` | `P0-A5`; `P1-A2` extends |
| `site/src/lib/state.ts`, `urlCodec.ts`, `worker.ts`, `export.ts`, `highlight.ts`, `components/board/ToolFrame.svelte` | `P1-A2`; `P2-A7` extends `state.ts` (classify on load); `P2-A6` extends `export.ts`; `P6-A5` adds LaTeX to `export.ts` |
| `site/src/content/modules/m{k}-*.mdx` | the lesson's agent |
| `site/src/content/pages/*.mdx` | `P1-A4` (glossary, about, credits), `P2-A7` (open-problem), `P5-A3` (not-quiver-mutation), `P6-A6` (history, confusions, credits extension) |
| `site/src/pages/*` | `P0-A1` (the placeholder index), `P0-A5` (the index page with the board; `about.astro` and `credits.astro` in phase 0), `P1-A4` (`sources.astro`, `open-items.astro`, `[page].astro`, `modules/[slug].astro`; converts about and credits to content pages), `P1-A2` (`tools/[tool].astro`), `P6-A4` (`atlas/[board].astro`), `P6-A5` (`embed/[tool].astro`) |
| `site/src/styles/*` | `P0-A1` (`base.css` with the tokens), then `P1-A3` (`tokens.css`, themes; may restructure `base.css`), then additive edits by the tool and page owners for their own component styles only |
| `site/public/` presets data for T10 | `P4-A2` pipeline, `P4-A3` content |
| `site/tests/e2e/nojs.spec.ts`, `a11y.spec.ts`, `basepath.spec.ts` | `P1-A2`, `P0-A5`, `P0-A6` respectively |
| `scripts/katex-assets.mjs`, `site/src/pages/dev/*` (spike and check pages, `released: false`) | `P0-A3`; `P4-A2` adds its own dev page |
| `site/src/lib/sources.ts`, `site/src/lib/unverifiedRegistry.ts`, `site/tests/fixtures/content/` | `P0-A4` |
| `scripts/presets.mjs`, `site/src/components/draw/canvasScene.ts`, `svgScene.ts` | `P4-A2` |
| `site/src/content/pages/glossary.mdx` | `P1-A4`; `P6-A8` completes it (additive) |
| `build-plan/` | the orchestrator |

---

## 7. Gates: what runs and what the owner sees

At each gate the `GATE` agent runs exactly the commands of section 7.7 that the gate row of 9.1 names, in a clean checkout of `main`, and writes `reports/gate-G{k}.md` with, for every item of the automatic part: the command, its exit status, the relevant lines of its output, and pass or fail. It also records: the hashes of the three reference files, the installed versions of the pinned packages, the sizes table of `npm run size`, and the list of `decisions/` fragments merged. A gate is green only when every item passes; the agent never softens an item.

After the red team is dry, the orchestrator writes a short message to the owner with: the gate report location, the red-team summary (findings by lens and severity, what was fixed, what was logged), the owner's part of the gate from 9.1 as a checklist, and the open decisions used by default during the phase. The next phase starts without waiting, as section 9.1 says.

Releases (0.5 after G3, 1.0 after G6) are built by `GATE` as release builds and left as archives in `reports/`; tagging and publishing are the owner's acts.

---

## 8. Pre-flight (before phase 0)

`workflows/preflight.js` runs these checks and stops the launch if one fails:

1. `node --version` is 22.12 or later; `npm --version` prints.
2. `python3 reference/verify.py <temp>` exits 0 and the file equals `reference/golden_data.json` byte for byte; if it does not, the files are compared as parsed JSON and the difference is reported (section 5.7 says what to do: do not commit the new file).
3. The versions of 7.1 resolve on the registry (`npm view <pkg>@<version> version` for each), and the peer ranges of `@astrojs/svelte`, `svelte-check` and `@astrojs/check` admit TypeScript 6.0.x.
4. Playwright can install Chromium and WebKit.
5. `git` works and the directory is not yet a repository (or is one with a clean tree).

---

## 9. Risks of the multi-agent build itself, and the answer to each

| Risk | Answer |
|---|---|
| A builder makes a test pass by weakening it | `RT-11` at every phase; `GATE` compares the list of golden keys tested with the table of 5.7; the golden file is hash-checked |
| Two agents interpret a shared interface differently | `CONTRACTS.md` fixes signatures, props, hooks and file names before any agent starts; `MERGE` reconciles; `RT-10` checks the contract was followed |
| The toolchain is newer than the agents' training | `COMMON.md` requires reading the installed package's types and changelog before using an API; `P0-A3` is a spike for exactly this; `RT-12` checks the result |
| Memory pressure from parallel builds | four build agents at once; one browser suite at a time; `npm ci --prefer-offline` |
| An agent runs out of context on an L task | L tasks are split or come with a "finish in order" list in their instruction so a partial result is usable; the orchestrator re-runs with the report |
| Convention drift that golden tests cannot see | `RT-02` builds asymmetric cases on purpose; property tests 2 and 3 run on every merge |
| Lessons drift from the data | `<G>` enforced by the build and by `RT-08`; `RT-09` checks claims against section 2 |
| The red team produces noise | two-stage verification; a refutation must cite the specification; dropped findings are recorded with their reason |
| A phase stalls on the owner's part | it never blocks (9.1); the plan records it as due |

---

## 10. How the launch proceeds

1. Node 22 is installed (section 0). Python 3.9.6 passes the oracle.
2. You read this file, `COMMON.md`, `CONTRACTS.md`, `RED-TEAM-COMMON.md`, and whichever agent and lens files you care to sample. Edits you make to any file here are taken as given; after editing, `workflows/consistency.js` can be rerun to check the set.
3. You say "launch". I run the pre-flight, then phase 0's build workflow, then its red team, and report at the gate. Then phase 1, and so on, reporting at each gate, through G6. You may stop me at any gate, change a decision, or redirect.

The exact invocations, for the record (each `roster` is the parsed JSON of the phase's file in `rosters/`):

```
Workflow({ scriptPath: 'build-plan/workflows/preflight.js' })
Workflow({ scriptPath: 'build-plan/workflows/build-phase.js',   args: <roster of phase k> })
Workflow({ scriptPath: 'build-plan/workflows/redteam-phase.js', args: { roster: <roster of phase k>, gateCommit: '<sha from reports/gate-Gk.md>' } })
Workflow({ scriptPath: 'build-plan/workflows/consistency.js' })      // after any edit to the instruction files
```

The orchestrator reads the result of each before starting the next: a build whose gate is not green is not red-teamed, and a red team that is not dry after three rounds is reported to you before the next phase starts.
