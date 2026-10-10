# P7-overview: Extensions after release 1.0

Phase 7, after gate G6 and release 1.0. Five items, each S or M, released as 1.x. Gate: per item (`SPEC.md` 9.1). Red team: ten lenses, at most two rounds (`rosters/phase-7.json`).

This file is the overview of phase 7 for the orchestrator and for whoever drafts each item's full instruction. It gives the order of the items and the reasons for it, one brief per item in the shape of `build-plan/TEMPLATE-build-agent.md`, the rules the items share, and the red-team lenses that apply. No build agent runs from this file. Everything in `COMMON.md` and `CONTRACTS.md` applies to every phase 7 agent. Where this file adds a name, a path or a procedure that neither `SPEC.md` nor the plan files give, the addition is marked (plan), as in `CONTRACTS.md`.

The scope, from `SPEC.md` 1.5, verbatim:

> **Planned extensions, specified here but built after version 1** (phase 7): the golden boards $H_2$, $H_3$, $H_4$ and the golden foldings $A_4\to H_2$, $D_6\to H_3$, $E_8\to H_4$ (section 2.17) [V]; the 7-dimensional representation of $G_2$ and the vector representations of type $B$ from single steps (section 2.18) [V]; generalized Satake diagrams; Vogan diagrams as a side-by-side view; embeddable web components.

## 1. Status of the items and the drafting rule

The roster says, verbatim: "Briefed, not fully specified: the owner's reading of release 1.0 may change the order (D9 default: golden boards first). Each item gets a full instruction file when it is scheduled, drafted from this roster with the same template." README section 4 says the items "are briefed, not fully specified, because the owner's reading of release 1.0 may change their order."

**The rule.** When an item is scheduled, its full instruction file `build-plan/agents/P7-A{m}-{slug}.md` is drafted from its entry in `rosters/phase-7.json` and its brief below, following `TEMPLATE-build-agent.md` exactly (all ten sections, the template's headings in order, the header line filled in), and it is verified and revised like every instruction file of phases 0 to 6 before any build agent runs. A brief is not an instruction: it fixes the scope, the sources, the golden keys and the acceptance, and it lists the decisions the full file must take. The file names follow from the slugs, which `workflows/build-phase.js` reads as `agents/${id}-${slug}.md`: `P7-A1-golden-boards.md`, `P7-A2-orbit-plus-zero.md`, `P7-A3-generalized-satake.md`, `P7-A4-vogan-side-by-side.md`, `P7-A5-web-components.md`.

Steps when an item is scheduled (plan):

1. The owner confirms or changes the order of D9 (section 2). The first agent that runs records the default or the answer in its decisions fragment (`COMMON.md` 5.1: "every default of section 10 you relied on").
2. The orchestrator completes the item's roster entry with the fields the entries of phases 0 to 6 carry and the phase 7 entries lack (`isolation`, `contracts`, `dependsOn`, `owns`, `deliverables`, `acceptance`, `traps`, `sources`), taken from the brief, and adds the item's rows to README section 6, which has no phase 7 rows. The phase 7 roster also differs from every earlier roster at the top level: it has no `gateItems` and no `ownerPart`, and its `gate` is the string "per item"; step 5 supplies all three per item.
3. It adds the item's engine signatures to `CONTRACTS.md` 2.4 (which stops at phase 6) and any new preset or `data-out` name to `CONTRACTS.md` 6, as contract amendments, before the drafting. The coverage check of a per-item gate is one of these amendments: `CONTRACTS.md` 3 says "`GATE` fails if `coverage.json` lacks a key assigned to a phase at or below the gate's", and `GOLDEN_KEYS_BY_PHASE[7]` holds the keys of three items, so a gate of one item would fail on the keys of the items not yet built. The proposal of section 3 (Gate per item) is written into `CONTRACTS.md` 3 and `agents/GATE.md` by the orchestrator, with the owner's agreement, before the first per-item gate runs; until then it is a proposal, not a rule (`CONTRACTS.md`: "A change to a contract is a deviation to be reported, never made silently").
4. It drafts the full file with `workflows/draft-instructions.js` (the item added to its `BUILD` list as `[7, id, slug]`), lets the verifier and reviser run, and then runs `workflows/consistency.js`.
5. It gives the item a gate stage (`"gate": true`), a gate name (for example `G7-A1`) and `gateItems` taken from the brief's acceptance and the phase 7 row of 9.1. The briefs write "Gate of P7-A{m}" for that gate. Without a gate stage `build-phase.js` ends after the last merge and no gate runs. `build-phase.js` and `redteam-phase.js` read the gate's name, items and owner's part from the top level of the roster (`R.gate`, `R.gateItems`, `R.ownerPart`), not from the stage: with `gate` left at "per item", the gate prompt would write `reports/gate-per item.md` and tag `gate-per item-candidate`. The roster restricted to the item (step 7) therefore sets the top-level `gate` to the item's gate name, `gateItems` to its items, and `ownerPart` to its owner's part, as a string like the earlier rosters. The phase 7 row of 9.1 names only "Appendix E item 9 for the golden folding.", but every per-item gate is a release gate (section 3), and two passages of `SPEC.md` give the owner work at each release: 9.4 is headed "Playtest script (owner's part of gate G3, and each later release)", and A-13 of 7.5 says "Each release is checked by hand with one screen reader on desktop and one on a phone". (plan) So `ownerPart` is "Appendix E item 9 for the golden folding; playtest of 9.4; accessibility script A-13." for P7-A1, and "Playtest of 9.4; accessibility script A-13." for the other four items, as `rosters/phase-3.json` lists both; the owner may decide that a 1.x release reuses the playtest of 1.0, and that decision is recorded in `DECISIONS.md`, never assumed by `GATE`. The gate items include the release build, its open-items report and the two archives of the item's 1.x release (section 3), and `agents/GATE.md` is extended to name them for phase 7.
6. The phase 7 scope of each lens of section 9 is reconciled with the table of section 9. Every lens of section 9 already carries phase 7 content. All ten (`RT-01`, `RT-02`, `RT-03`, `RT-05` to `RT-11`) have a phase 7 row in their scope table; `RT-01` also has a phase 7 scope paragraph. The phase 7 attacks are `RT-01` attack 43 ("Phase 7: golden arithmetic, the golden boards, one zero weight, generalized Satake diagrams"), `RT-02` attack 38, `RT-03` attack 35, `RT-05` attacks 45 ("Embedded tools (phase 6 and 7)") and 46 ("Phase 7 boards (phase 7)"), `RT-06` attack 32, `RT-08` attack 38 ("Generalized Satake diagrams presented as real forms"), `RT-09` attack 34 and `RT-11` attack 34. `RT-10` names the phase 7 presets `golden` and `one-zero-weight` in attack 11 and checks the defaults, D9 among them, in attack 18 (its section 2 item 7 gives "phase 7: D9"). `RT-07` covers phase 7 through its row and its attacks marked "phases 0 to 7". Where an existing row or attack differs from section 9 (for example the wording of `RT-10`'s row), the orchestrator decides which stands and edits one of the two. No lens needs a new row.
7. The build runs with `build-phase.js` on a roster restricted to the scheduled stage and its gate, with the top-level `gate`, `gateItems` and `ownerPart` of step 5, then `redteam-phase.js` with the lenses of section 9 and `maxRounds: 2`.

Model policy (README 3.5): `modelFor` in `build-phase.js` gives the session model only to slugs that begin with `engine-`. No phase 7 slug does, so all five items run on Opus by default, the engine parts of P7-A1 and P7-A2 included. A roster entry may set `"model"` to change this; the choice is the owner's when the item is scheduled (plan).

## 2. Order of the items (D9) and why

| Stage | Agent | Item | Size | Golden keys (5.7, phase 7) | Owner's part (9.1, 9.4, A-13) |
|---|---|---|---|---|---|
| 7.a | `P7-A1` golden-boards | Golden boards H2, H3, H4 and the golden foldings; T11 golden tab; M7 beat 8 | M | `golden_boards`, `golden_folds` | Appendix E item 9; 9.4 playtest and A-13 (plan, each release) |
| 7.b | `P7-A2` orbit-plus-zero | Representations with one zero weight: engine, T12 preset, M8 beat 7 | S | `orbit_plus_zero_representations` | 9.4 playtest and A-13 (plan, each release) |
| 7.c | `P7-A3` generalized-satake | Generalized Satake diagrams as an advanced toggle in T13 | S | `generalized_satake_example` | 9.4 playtest and A-13 (plan, each release) |
| 7.c | `P7-A4` vogan-side-by-side | Vogan diagrams beside Satake diagrams (T13 sidebar) | M | none | 9.4 playtest and A-13 (plan, each release) |
| 7.c | `P7-A5` web-components | Embeddable web components | M | none | 9.4 playtest and A-13 (plan, each release) |

Every stage runs in worktrees and is merged after (roster: `"isolation": "worktree", "mergeAfter": true`). The decision, from `SPEC.md` 10:

> | D9 | Order of the phase 7 extensions | golden boards; one zero weight; generalized Satake; Vogan; web components | golden boards first |

And 9.1 says the extensions are built "each S or M, any order". The plan takes D9's default and the order of its list. Why (plan):

1. **Golden boards first.** It is the item with the most specification behind it: 2.17 in full, all [V], two golden keys, a tool tab and a lesson beat whose slots phase 4 left open (P4-A4's instruction keeps a `golden` tab with `released: false`; P4-A6's keeps beat 8 as a placeholder). It is also the deepest engine change of the phase: `ZPhi` is the third instance of `Arith` (E-1, E-2) beneath the core functions every tool calls, so doing it first means the other four items are built and red-teamed on the final engine. And its one owner's check, Appendix E item 9, is already due before release 1.0, because 9.1 names it at G4 as well ("Appendix E items 7 and 9"), so the item adds no new check of Appendix E and waits on nobody (the playtest of 9.4 and the A-13 script fall due at every 1.x release in any order; section 1, step 5).
2. **One zero weight second.** The other item with golden data and a lesson beat (M8 beat 7, left as a `released:false` placeholder by P5-A3). It is small, confined to `rep.ts`, T12 and M8, and gives the site its route to $G_2$ inside the game (2.18).
3. **Generalized Satake, Vogan and web components together (7.c).** They do not depend on the first two items or on each other in the engine. P7-A3 has one golden key and P7-A4 and P7-A5 none, and P7-A4 and P7-A5 are the least specified (the roster: "no engine computation beyond what exists is specified"; 7.4: "Web components are a phase 7 option"), so they are the items the owner is most likely to re-scope after reading release 1.0, and nothing waits for them.

Constraints on any reordering (plan): P7-A3 and P7-A4 both change T13, and README 3.2 says "Two agents never own the same file in the same stage" (section 7 of their briefs gives a split; otherwise put them in different stages). P7-A5 wraps every tool through the registry, so its tests rerun at the gate of any later item that changes a tool's state, hooks or presets. No item needs another item's engine functions.

Not briefed: the phase 7 row of 9.1 also lists "further languages". It is neither in D9's list nor in the roster, and D12's default is English. It needs its own roster entry and brief before it can be scheduled.

## 3. Rules every phase 7 item shares

- **Gate per item.** The phase 7 row of 9.1, verbatim: "| **7 Extensions** (each S or M, any order) | Golden boards and golden folding; representations with one zero weight; generalized Satake diagrams; Vogan diagrams side by side; web components; further languages. | Per item: its golden tests (section 5.7, phase 7) and tool acceptance. | Appendix E item 9 for the golden folding. | 1.x |". (plan) Because every item changes a released tool or lesson, each per-item gate also reruns the automatic part of G6 (all golden tests of phases 0 to 6, the acceptance of every tool, the run without JavaScript, the accessibility scan, sizes and lab timings). (plan, a proposed amendment of `CONTRACTS.md` 3, not yet a rule; see section 1, step 3) The gate checks `coverage.json` against the keys of phases 0 to 6 plus the item's own keys, not the whole of `GOLDEN_KEYS_BY_PHASE[7]`, which holds the keys of three items; until the amendment is made, `CONTRACTS.md` 3 as written applies and `GATE` reports the keys of unbuilt items as missing.
- **The 1.x release of each item.** 9.1 names the release of phase 7 "1.x". README 7: "Releases (0.5 after G3, 1.0 after G6) are built by `GATE` as release builds and left as archives in `reports/`; tagging and publishing are the owner's acts." 7.8: "Each release attaches two archives of the built site to the GitHub release: one built for the Pages address, and one built with `BASE_PATH=/`". (plan) Each per-item gate is a release gate in the manner of G6: `GATE` makes the release build (`RELEASE=1 npm run build`), leaves its report of open items in `reports/` (7.3: "it prints a report of the open items and the pages that use them, which the owner reads at each release"), runs `npm run report`, and builds the two archives of 7.8 as `agents/GATE.md` 5.7 describes, named `reports/release-{v}-pages.tar.gz` and `reports/release-{v}-root.tar.gz` as in `agents/GATE.md`, where `{v}` is the 1.x version number the owner chooses (not the item number `{m}` of P7-A{m}). (plan) The owner's part of each per-item gate lists the playtest of 9.4 ("owner's part of gate G3, and each later release") and the screen-reader script of A-13 ("Each release is checked by hand with one screen reader on desktop and one on a phone, following a written script that grows with the site"), extended by the item's new tool state or beat; `GATE` lists them as due and never runs them. `GATE` tags the measured commit locally as `gate-{gate name}-candidate`, as `agents/GATE.md` 5.12 says, and nothing else: it never pushes, never creates a version tag (`v*`) and never publishes. The version tag, which triggers `deploy.yml` (7.8), and the GitHub release are the owner's acts. `agents/GATE.md` today covers archives at G3 and G6 only, so the orchestrator extends it for phase 7 when the first item is scheduled (section 1, step 5).
- **Conventions and reference.** `COMMON.md` 2 holds unchanged: no convention of section 2, label, sign of the legal move, cap of 5.6 or comparison rule changes in phase 7. `reference/` stays read-only and its hashes (CONTRACTS 9) are checked at every per-item gate.
- **Golden tests** follow CONTRACTS 3: each phase 7 key is tested in exactly one file, which calls `covers(...)` with the key spelled as in 5.7, and comparison rules 1 to 7 come from the harness. The phase 7 row of 5.7, verbatim: "| `golden_boards`, `golden_folds`, `orbit_plus_zero_representations`, `generalized_satake_example` | `ZPhi`, `coxeterH`, `goldenFold`, `orbitPlusZeroMatrices`, `shadow2` | 7 |". Appendix G matches `golden_folds` by `from` and `to`, `orbit_plus_zero_representations` by `type` and `highest_weight`, and `generalized_satake_example` by `type` and `black_nodes`; `rule` and the `name` of a representation are documentation (rule 6). Test files are `packages/engine/test/golden/p7-*.test.ts` (plan, after `p4-*`, `p5-*`, `p6a-*`).
- **Extending released work.** Four items extend a tool or a lesson built in phases 4 to 6, and P7-A5 wraps every tool. (plan) The full instruction grants the phase 7 agent the files of that tool or lesson for its run, for additive changes: the existing acceptance tests keep passing, and a test may be extended but never weakened (`COMMON.md` 4.4). A change in another area (board components, `lib/`, `draw/`, `pages/`, root `package.json`) follows README 6: a request in the report and the fragment, made by the owning area's agent or by `MERGE`.
- **Lessons.** A beat written in phase 7 follows 8.2, 8.4, 8.5 and 9.2: every number with a golden value through `<G>` or `{{path}}`; every [U] statement inside `<Unverified>`; a new [U] item proposed in the report (`proposedUnverifiedItems`) and numbered by `MERGE` with the next free number, one more than the largest `E<n>` in `content/unverified.json` and in any reservation recorded in `DECISIONS.md` (`agents/MERGE.md`; Appendix E item 17: "the next free number"), which by phase 7 is likely above `E18`; the page keeps its draft mark (D17) until the owner approves the new text. A placeholder is replaced in place and keeps its beat number.
- **Tools.** 4.0 applies to every change: the default state rendered without JavaScript, controls disabled until hydration, the test hooks (`data-tool`, `data-moves`, `data-node`, `data-board`, `data-value`, `data-can-act`, `data-out`), presets that are state objects, stated limits, A-1 to A-12 of 7.5, E-9 for anything that may exceed 2000 items, and the limits of 7.6 (90 kB for `/tools/<id>`, 120 kB for a lesson page).
- **Links.** (plan) Schema 1 of 6.6 does not change in phase 7. Options that 6.6 does not list "are not part of a link in schema 1; a link opens the tool with those at their defaults." A new state field would change `ToolState` (CONTRACTS 4), which is a deviation that goes in the report for `MERGE` to decide (`COMMON.md` 4.4).

## 4. P7-A1 golden-boards: Golden boards H2, H3, H4 and the golden foldings; T11 golden tab; M7 beat 8

Phase 7, stage 7.a. Size M. Runs in: a worktree on branch `agent/P7-A1` (MERGE and GATE: the primary checkout on `main`).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

### 1. Objective

The engine gains its third arithmetic, the type `ZPhi {a: bigint, b: bigint}` with the instance `ZPhiArith: Arith<ZPhi>`, the boards $H_2$, $H_3$, $H_4$ from `coxeterH(n)`, and `goldenFold(name, v)`; both games run on the $H$ boards with exact arithmetic in $\mathbb Z[\varphi]$ and reproduce `golden_boards` and `golden_folds`. Tool T11 gains its golden tab (preset `golden`): a big board $A_4$, $D_6$ or $E_8$ played pair by pair beside its $H$ board, whose values are shown as $a+b\varphi$. Lesson M7 gets beat 8, released: "(Phase 7) Golden boards: $H_3$, $H_4$, and $E_8$ folding onto $H_4$ as two 600-cells (section 2.17)."

### 2. Read first, in this order

1. `SPEC.md` 2.17 in full (the standard; its facts are quoted in section 5 below).
2. 5.1 E-1, E-2; 5.2 (`Arith`: `show` is "decimal text; also the hash key", `toBig` is "SafeInt and Big only"); 5.4, the Golden boards paragraph: "Golden boards (phase 7): the type `ZPhi {a: bigint, b: bigint}` with its `Arith` instance; `coxeterH(n)`; `goldenFold(name, v)`. Oracle: class `Phi`, `coxeter_H`, `golden_fold`, `GOLDEN_FOLDS`."; 5.5 (Orbits; Order and truncation of a search).
3. 5.7 (phase 7 row; rules 1, 2, 5, 6) and Appendix G (`golden_boards`, `golden_folds`; `longest_word` and `pairs_plain_golden` are labels).
4. 4 T11 in full, 4.0, 6.1 (the $H_n$ row), 6.2, 6.3, 6.6 (T11 keys; the tab is not part of a link), 7.5.
5. 3 M7 (beat 8, figure row 8), 8.1 to 8.5, 9.2, Appendix E items 8 and 9; 2.13 and 2.14 for context (the projection onto $H_4$ is the phase 4 key `e8.h4_projection`, already tested by P4-A1).
6. Oracle: `class Phi` (l.905), `coxeter_H` (l.966), `GOLDEN_FOLDS` (l.979), `golden_fold` (l.986); `reference/verify.py` section 16 (l.1326 to 1404), which writes both keys and holds `golden_fold_search` (l.1361).
7. CONTRACTS 2.1 (rows `arith.ts`: "phase 7 adds `ZPhi`"; `golden.ts`: "phase 7: `ZPhi` arithmetic, `coxeterH`, `goldenFold`"), 2.2, 2.4 phases 0 and 1, 3, 4 (`a11y.ts`), 5, 6 (T11: `fold`, `average`, `golden` (phase 7)), 7.
8. `agents/P4-A4-t11-folding-bench.md` 5.6 and 5.13, `agents/P4-A6-lesson-m7.md` 5.4, and `decisions/P4-A4.md`, `decisions/P4-A6.md` on `main` (the slot mechanisms actually used). SOURCES 11.2 ([Eri95b], [Don08]).

### 3. Inputs you depend on

On `main` at release 1.0: `Arith`, `SafeInt`, `Big`; the core `mutate`, `fire`, `applyWord`, `legalNodes`, `play`, `orbit`, `orbitGraph` written once against `Arith<T>` (E-2); the harness with `covers` and `GOLDEN_KEYS_BY_PHASE[7]`; T11 with its tab slot and `t11/model.ts`; the board family and the layouts of 6.1; `a11y.ts`; `m7-geometry.mdx` with the beat 8 placeholder. E-2 allowed the core to be written twice for the two integer kinds ("writing the half-dozen core functions twice is acceptable"); if `main` holds that, the $H$ boards need a generalization of files of earlier phases, which the full file must grant explicitly (plan), or the agent reports `blocked` rather than re-implementing the core.

### 4. Deliverables

| File (plan paths) | Contents |
|---|---|
| `packages/engine/src/arith.ts` (additive) | `ZPhi`, `ZPhiArith` |
| `packages/engine/src/golden.ts` (new) | `coxeterH`, `goldenFold`, the table of pairs of 2.17 in positions |
| `packages/engine/src/index.ts` | exports appended |
| `packages/engine/test/unit/zphi.test.ts` | arithmetic, exact sign, `show` |
| `packages/engine/test/golden/p7-golden-boards.test.ts` | `covers('golden_boards')`; $CS_i=R_iC$ |
| `packages/engine/test/golden/p7-golden-folds.test.ts` | `covers('golden_folds')` |
| `site/src/components/tools/T11FoldingBench.svelte`, `site/src/components/tools/t11/` (a golden model beside `model.ts`), `site/src/tools/registry/T11.ts` (preset `golden`, boards, `data-out` names), `site/tests/unit/tools/T11.test.ts`, `site/tests/e2e/T11.spec.ts` | the golden tab |
| `site/src/content/modules/m7-geometry.mdx` (beat 8 only), `site/tests/e2e/M7.spec.ts` (additive) | beat 8 |
| `decisions/P7-A1.md` | fragment |

CONTRACTS 2.1 names `ZPhi` in two rows (`arith.ts`: "phase 7 adds `ZPhi`"; `golden.ts`: "phase 7: `ZPhi` arithmetic, `coxeterH`, `goldenFold`"), and `RT-03`'s phase 7 scope row says "`ZPhi` (`golden.ts`)". (plan) The type and `ZPhiArith` go in `arith.ts` beside `SafeInt` and `Big`, and `golden.ts` imports them; the other choice, both in `golden.ts`, is equally consistent with CONTRACTS 2.1 and needs no grant for `arith.ts`. Whichever stands, two things follow before the drafting (section 1, steps 2 and 6): `RT-03`'s row is reconciled with it, and, since README 6 gives `arith.ts` and `index.ts` to `P0-A2` ("`P0-A2` owns `arith.ts`, `errors.ts`, `board.ts` (phase-0 part), `moves.ts` (phase-0 part), `index.ts`"), the orchestrator adds a README 6 row granting P7-A1 its additive edits of `index.ts` and, under this choice, of `arith.ts`. Without that row these two files are requests (README 6), not deliverables. Signatures (plan, to be added to CONTRACTS 2.4): `coxeterH(n: 2 | 3 | 4): Board<ZPhi>` with `labels` 1 to n and `name` `"H2"`, `"H3"`, `"H4"`; `goldenFold(name: 'A4' | 'D6' | 'E8', v: Vec<number> | Vec<bigint>): ZPhi[]`, in the order of the $H$ nodes.

### 5. Requirements

The facts of 2.17, verbatim:

> **Boards.** $H_n$ ($n=2,3,4$; $H_2=I_2(5)$) is the path $1-2-\dots-n$ with symmetric matrix $C$: 2 on the diagonal, $-1$ on ordinary edges, $-\varphi$ in both directions on the last edge. Both games are defined by the formulas of sections 2.2 and 2.3 with this $C$ [D]. Facts [V]:
>
> | Board | root populations | order of the group | length of the game from all ones |
> |---|---|---|---|
> | $H_2$ | 10 | 10 | 5 |
> | $H_3$ | 30 | 120 | 15 |
> | $H_4$ | 120 | 14400 | 60 |
>
> Every root population is all $\ge0$ or all $\le0$ (signs taken as real numbers), $CS_i=R_iC$ holds, and the game from all ones ends at all minus ones.

The golden folding, verbatim:

> **Golden folding.** There is a third kind of folding, in which a pair of nodes of a simply laced board becomes one node carrying a number of $\mathbb Z[\varphi]$. For each pair one node is "plain" and one is "golden", and
>
> $$\text{value on the } H \text{ board} \;=\; (\text{value at the plain node}) + \varphi\cdot(\text{value at the golden node}),$$
>
> for populations and for positions alike. The two nodes of a pair are never joined, and acting on both is one move of the $H$ game [V for both games]:
>
> | Big board | $H$ board | pairs (plain, golden), in the order of the $H$ nodes |
> |---|---|---|
> | $A_4$ | $H_2$ | $(1,3)$, $(4,2)$ |
> | $D_6$ | $H_3$ | $(1,5)$, $(2,4)$, $(6,3)$ |
> | $E_8$ | $H_4$ | $(8,1)$, $(7,3)$, $(6,4)$, $(2,5)$ |
>
> Under the fold the roots of the big board go onto the roots of the $H$ board together with their multiples by $\varphi$: $240=120+120$ for $E_8$ [V]. Seen in Euclidean coordinates this is the projection of the 240 roots of $E_8$ onto the 4-dimensional space belonging to the exponents 1, 11, 19, 29, where they form two 600-cells whose radii are in the ratio $\varphi$ [V]. An exhaustive search over all ways of pairing non-adjacent nodes finds exactly one golden folding of $A_4$, one of $E_8$, and two of $D_6$ that differ by the symmetry of the board [V]. The construction is classical (it is usually credited to Lusztig, to Shcherbak and to Moody and Patera [U; no source was read for it in this research]).

The arithmetic, verbatim:

> Arithmetic for the engine: $(a+b\varphi)(c+d\varphi)=(ac+bd)+(ad+bc+bd)\varphi$, and the sign of $a+b\varphi$ is the sign of $(2a+b)+b\sqrt5$, decided exactly by comparing $(2a+b)^2$ with $5b^2$ when the two terms have opposite signs. Other polygons $I_2(m)$ are a floating-point display feature only [D].

- **`ZPhiArith`** implements all of `Arith` (5.2). `add`, `sub`, `neg`, `eq` work on both components; `mul` is the rule above; `sign` is the rule above in the oracle's branches (`Phi.sign`: $u=2a+b$, $v=b$; both $\ge0$ gives 0 or 1, both $\le0$ gives $-1$, otherwise the sign is that of $u$ times that of $u^2-5v^2$), never through a float; `show` is exact and injective because it is the hash key of searches (5.5); `toBig` is "SafeInt and Big only", so (plan) it throws on `ZPhi`.
- **Both games** on `coxeterH(n)`: `mutate`, `fire`, `applyWord`, `legalNodes` (positive by `ZPhiArith.sign`), `play` (lowest position first, E-5) and `orbit` run unchanged. All 2.17 facts hold: 10, 30, 120 root populations, each of one sign; orbits of all ones under firing of size 10, 120, 14400; the game from all ones ends at all minus ones after 5, 15, 60 moves; $CS_i=R_iC$ over $\mathbb Z[\varphi]$.
- **`goldenFold(name, v)`**: entry $j$ is $v_{\text{plain}_j}+\varphi\,v_{\text{golden}_j}$, pairs in the order of the $H$ nodes, for populations and positions alike. Inside the engine the pairs are positions (E-7); tests convert with `toLabels`.
- **The 600-cells and the search** (2.17, [V]): "two 600-cells whose radii are in the ratio $\varphi$" is the phase 4 key `e8.h4_projection`; "exactly one golden folding of $A_4$, one of $E_8$, and two of $D_6$ that differ by the symmetry of the board" has no golden key. (plan) If beat 8 states it, a test ports `golden_fold_search` to check it.
- **T11 golden tab.** 4 T11: "Phase 7 adds the golden foldings with values shown as $a+b\varphi$." (plan, after the fold tab of 2.13 and P4-A4): the tab offers $A_4$, $D_6$, $E_8$; plain and golden nodes are marked by a cue that is not colour alone (6.3); one click, Enter or Space on either node of a pair, or on its $H$ node, acts on both nodes ("acting on both is one move of the $H$ game"); the $H$ board is drawn by the row "$H_n$ (phase 7) | node $i$ at $(i,0)$; the last edge carries the label 5" of 6.1 and played by the engine on `coxeterH(m)`, not copied, so that the agreement the reader sees is the theorem; values are written $a+b\varphi$ with true minus signs; both games are offered; signs (6.3) come from the exact sign; History counts pair moves (plan: a pair move is stored in `moves` as the smallest label of the pair, as P4-A4 stores an orbit); announcements keep the templates of 7.5 with the values in words (plan: `2 plus 3 phi`, `minus phi`); the default state is rendered at build time with a caption that states the result it demonstrates (4.0).
- **E-9.** The orbit of all ones on $H_4$ has 14400 positions: an enumeration on an $H$ board that is not known to stay at or below 2000 items runs in the worker or at build time, and no default state needs it.
- **M7 beat 8.** Figure row: "| 8 | T11 golden tab (phase 7) |" (plan: the `golden` preset on $E_8$, the board the beat names). Numbers through `<G>`: `golden_boards.H3.n_roots`, `golden_boards.H4.n_roots`, `golden_boards.H4.group_order`, `golden_boards.H4.longest_word` with `as="count"`, `types.E8.n_roots`, `e8.h4_projection.shell_sizes`, `e8.h4_projection.exponents_kept`, `golden_folds[from=E8;to=H4].pairs_plain_golden[0]`. Numbers without a golden value (the counts 1, 1, 2 of the search) are typed and recorded in the fragment. The sentence "The construction is classical (it is usually credited to Lusztig, to Shcherbak and to Moody and Patera [U; no source was read for it in this research])" is wrapped in `<Unverified item="E9">` with a fallback that stays true; no claim of novelty (Appendix E item 8).

### 6. Acceptance

- [ ] 5.7, `golden_boards`: for H2, H3, H4, `matrix_as_pairs_a_plus_b_phi` equals `coxeterH(n).cartan` as pairs $[a,b]$; `n_roots` equals the orbit of the unit vectors under mutation (cap at least 20000, as the oracle), each of one sign; `group_order` equals the orbit of all ones under firing; `longest_word` equals `toLabels` of the word of `play` from all ones and `fired_values_as_pairs` its fired values; the play ends at all minus ones after `n_roots / 2` moves. `p7-golden-boards.test.ts`. Gate of P7-A1.
- [ ] 2.17 "$CS_i=R_iC$ holds" for every node of each $H$ board, over $\mathbb Z[\varphi]$. Same file (plan: build $S_i$ and $R_i$ column by column from `mutate` and `fire` on unit vectors, since `mutationMatrix` and `firingMatrix` return `number[][]` in CONTRACTS 2.4).
- [ ] 5.7, `golden_folds`, each record matched by `from` and `to`: `pairs_plain_golden` equals the engine's pairs in labels; no pair is joined; on 200 seeded random positions with entries in $[-6,6]$ and every pair $j$, mutating both nodes then folding equals folding then mutating node $j$ of the $H$ board, and the same for firing; the roots of the big board fold onto the roots of the $H$ board and their multiples by $\varphi$, with as many images as roots, twice the $H$ count. `p7-golden-folds.test.ts`. Gate of P7-A1.
- [ ] `ZPhiArith`: products, exact sign on values near zero and at large size (plan), `show` injective. `test/unit/zphi.test.ts`. Gate of P7-A1.
- [ ] T11 golden tab (plan, modelled on 4 T11 acceptance): for each of the three foldings, 200 random pair plays agree between the big board folded and the $H$ board, in both games; the $H$ board is the one named in `to`. `T11.test.ts`; `T11.spec.ts` for $A_4$ and $E_8$, keyboard, no JavaScript. Every acceptance test of 4 T11 from G4 still passes. Gate of P7-A1.
- [ ] M7: 9.2 for the changed page; beat 8 present, its figure the golden tab, E9 wrapped; run without JavaScript, axe, 120 kB. `M7.spec.ts`. Gate of P7-A1.
- [ ] Owner's part, not automated: Appendix E item 9 (9.1 row 7; also named at G4). Gate of P7-A1: listed in its owner's part (`ownerPart`) as due, never run by `GATE`.
- [ ] Owner's part, not automated (plan, section 3): the playtest of 9.4 and the A-13 screen-reader script, extended by the golden tab and beat 8. Gate of P7-A1: listed in `ownerPart` and in `reports/gate-G7-A1.md` as due, never run by `GATE`.

### 7. Files

- **You own** (plan): the deliverables of section 4, with `arith.ts` and `index.ts` only once the README 6 row of section 4 grants them (otherwise they are requests to `P0-A2`'s area under README 6).
- **You may edit with the stated protocol** (plan): the core files of earlier phases (`moves.ts`, `play.ts`, `search.ts`, `guards.ts`) only if section 3's check fails and the full file grants it, keeping every existing test green. The $H_n$ row of the layouts and the label 5 on its edge (`site/src/components/draw/` and the board family) and a spoken form of $a+b\varphi$ (`site/src/lib/a11y.ts`) lie in other agents' areas: README 6, "An agent whose task needs a change in another agent's area writes the request in its report and its decisions fragment, and the owning agent or `MERGE` makes the change". You do not edit those files; you write the requests, unless the orchestrator has given the item its own README 6 rows for them (section 1, step 2).
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, root `package.json` and the lockfile, `content/unverified.json`, T12, T13 and the other lessons.

### 8. Order of work

1. `zphi.test.ts`, then `ZPhiArith`. 2. The two golden tests, then `coxeterH`, `goldenFold`, and whatever the core needs; commit (the engine part is usable alone). 3. The golden model of T11 with its unit tests, then the tab; commit. 4. Beat 8; build; `T11.spec.ts`, `M7.spec.ts`; commit.

### 9. Traps

- A floating-point sign is wrong near zero: $13-8\varphi\approx0.056$ is positive, and for consecutive Fibonacci numbers $a$, $b$ of opposite signs the value $a+b\varphi$ shrinks towards zero as they grow, until a double gets its sign wrong (near the 40th Fibonacci number a double already returns 0). Use the exact rule only.
- Core code that treats values as JavaScript numbers fails silently on `ZPhi` objects: `x > 0` on an object is false, so a play from all ones would end after 0 moves; a search keyed by `v.join(',')` gives every position of a board the same key (`[object Object]` repeated) and stops at the first seed. Everything goes through `board.arith`.
- $\varphi$ is not a road count: `adjacency`, `cartanNumbers`, `boardKind`, `boardFromName`, the road styles of 6.2 and everything behind `classify` (E-11) take integer matrices. Decide the `kind` of a `Board<ZPhi>` and how the rational and finite-theory functions refuse it; E-10 has no error class for this (a new class is a deviation).
- $-\varphi$ sits on the last edge, between nodes $n-1$ and $n$, in both directions; not on the first.
- Plain first: the value is plain $+\ \varphi\cdot$ golden. The first $H$ node of $E_8$ is the pair $(8,1)$. $D_6$ uses $(1,5)$, $(2,4)$, $(6,3)$, not its image under the swap of nodes 5 and 6.
- The table of pairs is the definition (2.17, like the oracle's `GOLDEN_FOLDS`), not a golden value; but a test that only compares it with `pairs_plain_golden` is a tautology. The golden test must check the moves and the roots as `verify.py` section 16 does.
- Caps: a cap of 2000 truncates the orbit of $H_4$ (14400); in the browser that orbit is an E-9 enumeration.
- T11's boards of 4 T11 exclude $E_8$, and 6.6 keeps the tab out of a link: decide how a link made on the golden tab behaves (it must never show the "could not be read" notice for a link the site produced) and amend P4-A4's test of the offered boards per tab, without weakening it.
- 4.0 defines `data-value` as "decimal text, or as `p/q` for a fraction"; a value $a+b\varphi$ needs one fixed form (plan), listed in the test file.
- Do not build $I_2(m)$ for other $m$: no tool of section 4 offers it.

### 10. Report

`COMMON.md` 5.2. (plan) Also: `coreChanges` (whether the core had to change, and which files), `goldenTabLink` (the decision on links from the tab), `beat8Mechanism` (what replaced the placeholder).

## 5. P7-A2 orbit-plus-zero: Representations with one zero weight: engine, T12 preset, M8 beat 7

Phase 7, stage 7.b. Size S. Runs in: a worktree on branch `agent/P7-A2` (MERGE and GATE: the primary checkout on `main`).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

### 1. Objective

The engine gains `orbitPlusZeroMatrices(board, lambda)` (5.4: "| `orbitPlusZeroMatrices(board, lambda)` | section 2.18 | 7 | `orbit_plus_zero_matrices` |") in `src/rep.ts` and reproduces `orbit_plus_zero_representations`. T12 gains the preset `one-zero-weight` (CONTRACTS 6), and M8 gets beat 7, released: "(Phase 7) One zero weight: the 7 of $G_2$ and the vector representations of type $B$."

### 2. Read first, in this order

1. `SPEC.md` 2.18 in full, the paragraph One zero weight above all, and the paragraph after it ("Out of reach of these two recipes").
2. 5.4 (Representations table), 5.6 (`repOrbit` 2000, `matrixGridDim` 27), 5.7 (phase 7 row; rules 1, 5, 6; Appendix G `orbit_plus_zero_representations`).
3. 4 T12 in full, 4.0, 6.6 (T12 keys `node` and `relation`), 7.3 (`MatrixView`).
4. 3 M8 (beat 7, figure row 7), 8.1 to 8.5, 9.2; SOURCES 11.1 [W03c].
5. Oracle `orbit_plus_zero_matrices` (l.880), `minuscule_matrices` (l.856), `chevalley_serre_ok` (l.837); `verify.py` l.1277 to 1288.
6. CONTRACTS 2.1 (`rep.ts`: "phase 7 adds `orbitPlusZeroMatrices`"), 2.2 (`SparseMatrix`, `RelationCheck`), 2.4 phase 5 (the model signature), 3, 5, 6, 7; the roster entries of P5-A2 and P5-A3 and their fragments on `main`.

### 3. Inputs you depend on

On `main`: `SparseMatrix` operations, `minusculeMatrices`, `chevalleySerre` (`rep.ts`), `orbit`, `weylDimension`; T12 (`T12RepresentationBuilder.svelte`, `t12/`, `MatrixView.svelte`, `registry/T12.ts`); `m8-lie-algebras.mdx` with beat 7 as a `released:false` placeholder. Nothing from P7-A1.

### 4. Deliverables

`packages/engine/src/rep.ts` (additive) and `packages/engine/src/index.ts` exports; `packages/engine/test/golden/p7-orbit-plus-zero.test.ts` (plan) with `covers('orbit_plus_zero_representations')`; the T12 preset in `site/src/tools/registry/T12.ts` and `site/src/components/tools/t12/`, with its tests (`site/tests/unit/tools/T12.test.ts`, `site/tests/e2e/T12.spec.ts`, additive); beat 7 in `site/src/content/modules/m8-lie-algebras.mdx` and `site/tests/e2e/M8.spec.ts` (additive); `decisions/P7-A2.md`. Signature (plan, modelled on `minusculeMatrices`): `orbitPlusZeroMatrices(board, lambda: readonly number[]): { basis: number[][]; E: SparseMatrix[]; F: SparseMatrix[]; H: SparseMatrix[] }`.

### 5. Requirements

The recipe, verbatim from 2.18:

> **One zero weight.** Some representations have as weights one orbit together with the zero weight, once: the vector representation of $B_n$ (dimension $2n+1$), the 7-dimensional representation of $G_2$, the adjoint of $A_1$. For these, take the positions of the orbit of the highest weight and one extra basis vector for the zero position, let $H_k$ multiply by $\mu_k$, and let $E_k$ and $F_k$ move one step (add or subtract column $k$ of $C$) with coefficient 1, except that the two steps that **leave** the zero position have coefficient 2. The Chevalley-Serre relations hold [V for $A_1$, $B_2$, $B_3$, $B_4$ and $G_2$]. This gives the site a route to $G_2$ that stays inside the game, in the spirit of [W03c], whose own construction uses a different basis with entries between $-2$ and 2.

- Port the oracle exactly: the basis is the orbit of $\lambda$ under firing in decreasing lexicographic order (as `minusculeMatrices`, E-5), then the zero position last; $H_k$ is diagonal with $\mu_k$; for each basis vector $\mu$ and node $k$, if $\mu$ minus column $k$ of $C$ is in the basis, $F_k$ has the entry (row of the target, column of $\mu$) equal to 2 when $\mu$ is zero and 1 otherwise, and $E_k$ likewise for $\mu$ plus column $k$. Keys `"row,column"`, values `bigint` (CONTRACTS 2.2).
- The cases of 2.18: $\omega_1$ of $B_n$, $\omega_1$ of $G_2$, and $\lambda=(2)$ on $A_1$. The oracle applies the recipe to any $\lambda$ unchecked; (plan) the engine does the same and T12 offers only these cases, so the tool never shows a failing relation for a case 2.18 claims. The lesson claims [V] only for $A_1$, $B_2$, $B_3$, $B_4$ and $G_2$.
- T12, preset `one-zero-weight`, figure row 7 of M8: `| 7 | T12 "one zero weight" on $G_2$ (phase 7) |`. The orbit in layers with the extra zero position, the matrices as grids (dimension at most 27), the relation checker with every relation holding (`chevalleySerre`), and the coefficient 2 visible on the two steps that leave zero. The minuscule behaviour of T12 is unchanged (node 2 of $D_4$ still fails, as its acceptance says).
- How a link reaches the preset: 6.6 gives T12 the keys `node` and `relation` only, and $\lambda=(2)$ on $A_1$ is no node, while 4.0 says "every preset is also a state object and a link". The full file must make the mode a state object without a schema change (for example chosen from board and node), or record it as an unlisted option that a link does not carry (6.6).
- M8 beat 7: numbers through `<G>`, for example `orbit_plus_zero_representations[type=G2;highest_weight=1,0].dimension`; [V] stated as "verified by computation"; `<Cite k="W03c"/>`; the next paragraph of 2.18 sets the limit: the site "says plainly that the matrices need more than the game [D]".

### 6. Acceptance

- [ ] 5.7, `orbit_plus_zero_representations`, five records matched by `type` and `highest_weight`: `dimension` equals the basis length and `weylDimension(board, highest_weight)` (rule 1 across `bigint`); `weights_dynkin_labels` equals the basis in order (rule 5); `chevalleySerre(board, E, F, H)` holds for every relation. `p7-orbit-plus-zero.test.ts`. Gate of P7-A2.
- [ ] (plan) The 2s sit exactly on the steps that leave zero, and the same recipe with every coefficient 1 fails a relation (so the test fails if the 2 is removed). Same file. Gate of P7-A2.
- [ ] T12 preset on $G_2$: dimension 7 from the golden value, every relation holds in the checker, matrices as grids. `T12.spec.ts`; every T12 acceptance test of G5 still passes. Gate of P7-A2.
- [ ] M8: 9.2 for the changed page, beat 7 present with its figure, run without JavaScript, axe, 120 kB. `M8.spec.ts`. Gate of P7-A2.
- [ ] Owner's part, not automated (plan, section 3): the playtest of 9.4 and the A-13 screen-reader script, extended by the T12 preset and beat 7. Gate of P7-A2: listed in `ownerPart` and in its gate report as due, never run by `GATE`.

### 7. Files

- **You own** (plan): the deliverables of section 4.
- **You may edit with the stated protocol** (plan): T12's component, `t12/`, registry and tests, and beat 7 of M8, additively.
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, root `package.json` and the lockfile, `content/unverified.json`, `minusculeMatrices` and the phase 5 golden test.

### 8. Order of work

The golden test, then the function; commit. The preset and its tests; commit. Beat 7; build; `M8.spec.ts`; commit.

### 9. Traps

- Basis order: on $G_2$ the first basis vector is $(2,-1)$, not the highest weight $(1,0)$ (golden `weights_dynkin_labels`); zero comes last.
- Column $k$ of $C$, not row $k$: on $B_2$, $C=$ `[[2,-1],[-2,2]]`, and the steps at zero through node 2 reach $(-1,2)$ and $(1,-2)$; with the row, $(-2,2)$ is not a weight and the relations fail at zero. Symmetric boards hide this; $B_n$ and $G_2$ do not.
- The coefficient 2 belongs to the steps that leave zero (the column of the zero vector), in both $E_k$ and $F_k$; the steps that arrive at zero keep 1. Only nodes whose column is a weight have steps at zero ($B_n$: node $n$; $G_2$: node 1; $A_1$: node 1).
- `name` ("the 7 of g2") is documentation; `type` is an identifier.

### 10. Report

`COMMON.md` 5.2. (plan) Also: `presetLink` (how the preset is reached by a link).

## 6. P7-A3 generalized-satake: Generalized Satake diagrams as an advanced toggle in T13

Phase 7, stage 7.c. Size S. Runs in: a worktree on branch `agent/P7-A3` (MERGE and GATE: the primary checkout on `main`).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

### 1. Objective

T13 gains its phase 7 toggle ("**Toggles**: show $\tau$ on black nodes; (phase 7) generalized diagrams."): with it on, condition 3 is replaced by the condition of [RV20]; the $G_2$ examples whose shadows are not a root system are shown as shadows and multiplicities only, and type recognition refuses them as 2.15 requires. The golden test of `generalized_satake_example` passes.

### 2. Read first, in this order

1. `SPEC.md` 2.15 in full (the three conditions; What a failed condition 3 means; Shadows; Generalized Satake diagrams).
2. 4 T13 in full, 4.0, 6.3 (decoration on its own copy), 6.6 (`black`, `tau`; unlisted options), 7.5.
3. 5.4 (Satake functions), 5.7 (phase 7 row), Appendix G (`generalized_satake_example`: `black_nodes` are labels, $\tau$ the identity).
4. SOURCES 11.4 [RV20].
5. Oracle `shadow2` (l.536), `theta` (l.464), `admissibility` (l.489); `verify.py` l.847 to 860.
6. CONTRACTS 2.2 (`SatakeDiagram`, `Admissibility`, `Reason`), 2.4 phase 6, 5, 6 (T13 presets); the roster entries of P6-A1 and P6-A3 and their fragments on `main`.

### 3. Inputs you depend on

On `main`: `theta`, `shadow2`, `admissibility`, `satake` (throwing `NotAdmissible`), `matchCatalogue`, `subBoard`, `components`, `identify`, `formValue`, `roots`; T13 with its toggle row, `t13/`, `registry/T13.ts` and tests.

### 4. Deliverables

`packages/engine/test/golden/p7-generalized-satake.test.ts` (plan) with `covers('generalized_satake_example')`; the toggle and the generalized display in T13 (`site/src/components/tools/T13SatakeStudio.svelte`, `site/src/components/tools/t13/`, `site/src/tools/registry/T13.ts`) with tests (`site/tests/unit/tools/T13.test.ts`, `site/tests/e2e/T13.spec.ts`, `site/tests/e2e/T13-keyboard.spec.ts`, additive); `decisions/P7-A3.md`.

### 5. Requirements

Verbatim from 2.15:

> **Generalized Satake diagrams** ([RV20]) replace condition 3 by: the connected component of $X\cup\{j\}$ containing a $\tau$-fixed white node $j$ is not of type $A_2$. They are an optional advanced switch. Their shadows need not form a root system: on $G_2$ with the long node 2 black the shadows are $\pm\lambda,\pm2\lambda,\pm3\lambda$ with multiplicities 2, 1, 2, and with the short node 1 black they are $\pm\lambda,\pm2\lambda$ with multiplicities 4, 1, which looks like $BC_1$ although $\mathfrak g_2$ has no real form of real rank 1 [V; golden key `generalized_satake_example`]. The type-recognition code must therefore refuse pairs that fail condition 3.

And SOURCES 11.4: "For the site: an optional "advanced" switch in T13, with a warning that these diagrams need not give a restricted root system; the two generalized diagrams on $G_2$ are computed in the script as examples [V]."

- The toggle is off by default (plan) and, as an unlisted option of 6.6, not part of a link. With it off, T13 behaves exactly as at G6.
- With it on, the third light judges the RV20 condition for every $\tau$-fixed white node, with its reason in words naming the component of type $A_2$ in labels (plan); the symmetry check and conditions 1 and 2 are unchanged.
- A pair that passes RV20 and fails Kolb's condition 3 gets no real form name, no catalogue entry, no restricted type, no restricted board and no $\dim\mathfrak k$ (`satake` throws `NotAdmissible`); it gets its shadows (`shadow2` over all roots) with their multiplicities, as a table (plan), and the warning. A pair that passes Kolb's three conditions is shown as before.
- Where the RV20 test lives: 5.4 names no engine function for it, and 7.3 says "Components contain no mathematics beyond calling the engine." (plan) Compose existing engine calls (`subBoard`, `components`, `identify`) in one helper of `t13/` with a unit test; an engine function or a new `Reason` code would change CONTRACTS 2.4 or the type of SPEC 5.2 and needs the orchestrator and the owner.

### 6. Acceptance

- [ ] 5.7, `generalized_satake_example`, two records matched by `type` and `black_nodes`: on $G_2$ with the stored black node and $\tau$ the identity, `shadow2` over all roots, zero shadows dropped; $\lambda$ is the shortest shadow by `formValue`, of the two the larger in lexicographic order, and equals `twice_the_shortest_shadow`; the counts of $\lambda$, $2\lambda$, $3\lambda$ equal `multiplicities_of_1_2_3_times_it`; every nonzero shadow is one of those multiples with either sign. `p7-generalized-satake.test.ts`. Gate of P7-A3.
- [ ] Type recognition refuses both pairs: `satake` throws `NotAdmissible` and `matchCatalogue` returns no record. Same file. Gate of P7-A3.
- [ ] Toggle off: every T13 acceptance test of G6 passes unchanged (including "for every type, the set of pairs $(X,\tau)$ accepted, over all subsets $X$ and all symmetries $\tau$ of order at most 2, equals `admissible_pairs[T]`"). `T13.test.ts`, `T13.spec.ts`, `T13-keyboard.spec.ts`, unchanged. Gate of P7-A3.
- [ ] Toggle on (`T13.spec.ts`): node 2 black shows $\pm\lambda,\pm2\lambda,\pm3\lambda$ with 2, 1, 2; node 1 black shows $\pm\lambda,\pm2\lambda$ with 4, 1; neither shows a real form or a restricted type; the warning shows; $A_2$ with node 1 black still fails the third light. Gate of P7-A3.
- [ ] (plan) With the toggle on, every pair of `admissible_pairs[T]` passes the RV20 condition, since SOURCES 11.4 calls it a weakening of Kolb's condition. `T13.test.ts`. Gate of P7-A3.
- [ ] Keyboard (`T13-keyboard.spec.ts`), axe, `/tools/satake` at most 90 kB. The size by `npm run size`. Gate of P7-A3.
- [ ] Owner's part, not automated (plan, section 3): the playtest of 9.4 and the A-13 screen-reader script, extended by the toggle. Gate of P7-A3: listed in `ownerPart` and in its gate report as due, never run by `GATE`.

### 7. Files

- **You own** (plan): the golden test above, `decisions/P7-A3.md`, and in stage 7.c the only right to edit the existing files of T13 (`T13SatakeStudio.svelte`, the files already in `t13/`, `registry/T13.ts`); new files of your own in `t13/`; you mount P7-A4's sidebar component when its report asks.
- **You may edit with the stated protocol** (plan): T13's test files, additively.
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, `src/satake.ts` and the phase 6 tests, `content/unverified.json`, M9.

### 8. Order of work

The golden test (it needs only `shadow2`); commit. The RV20 helper with its unit tests; the toggle and the display; commit.

### 9. Traps

- Never call a generalized diagram a real form, and keep the careful wording of 2.15 on a failed condition 3 when the toggle is off (M9 beat 4: never say that $\theta$ "is not an involution").
- $G_2$: node 1 is short and node 2 long (the oracle's `cartan('G', 2)` is `[[2,-3],[-1,2]]`). `black_nodes` are labels.
- The stored multiplicities for node 1 black are `[4, 1, 0]` (three entries), while 2.15 says "4, 1". `twice_the_shortest_shadow` is `[2, 1]` for node 2 and `[3, 2]` for node 1: shortest by the form, not by the sum.
- The shadows picture of T13 uses the restricted board's triangular basis, which a non-root-system lacks: use the table.
- The condition concerns the component of $X\cup\{j\}$ that contains $j$, for each $\tau$-fixed white $j$; not the components of $X$ alone.

### 10. Report

`COMMON.md` 5.2. (plan) Also: `rv20Location` (where the test lives) and `mounted` (whether P7-A4's sidebar was mounted).

## 7. P7-A4 vogan-side-by-side: Vogan diagrams beside Satake diagrams (T13 sidebar)

Phase 7, stage 7.c. Size M. Runs in: a worktree on branch `agent/P7-A4` (MERGE and GATE: the primary checkout on `main`).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

### 1. Objective

T13 gains a sidebar that sets the standard picture of a Vogan diagram beside the Satake picture, with the statement of 2.15 that the same undecorated diagram means the split form as a Satake diagram and the compact form as a Vogan diagram. The roster, verbatim: "A side-by-side view; no engine computation beyond what exists is specified, so the content is the standard picture with the statement that the same undecorated diagram means the split form as a Satake diagram and the compact form as a Vogan diagram [S2]; anything further is [U] and wrapped."

### 2. Read first, in this order

1. `SPEC.md` 2.15 (Other encodings; What a failed condition 3 means), 0.3 (the label [S2]).
2. 3 M9 (beat 9, figure row "| 9 | static |"), 4 T13 in full, 6.3, 7.3 (the content components; release builds and fallbacks), 8.4, 9.2.
3. Appendix E items 15 and 17; SOURCES 11.4 [Kna02] (only its table of contents was read).
4. CONTRACTS 4, 5, 7; the roster entries of P6-A3 and P6-A7 and their fragments on `main`.

### 3. Inputs you depend on

On `main`: T13; `m9-real-forms.mdx` with the static Vogan sidebar of beat 9 (P6-A7) and the E15 wrap; `<Cite>`, `<Unverified>`; `content/unverified.json` with E15.

### 4. Deliverables

(plan) A sidebar component `site/src/components/tools/t13/VoganSidebar.svelte` (or a build-time fragment, see section 5), its test `site/tests/e2e/T13-vogan.spec.ts`, a link from M9 beat 9 to it, and `decisions/P7-A4.md`.

### 5. Requirements

Verbatim from 2.15:

> **Other encodings**, for a sidebar: Vogan diagrams (built from a maximally compact Cartan subalgebra; [Kna02] VI.8) and the Tits index. The site should say that the same undecorated Dynkin diagram means the split form as a Satake diagram and the compact form as a Vogan diagram [S2].

- (plan) The picture: the current board drawn twice with no decoration, side by side, one read as a Satake diagram (all white, no arrows: the split form) and one as a Vogan diagram (nothing painted, no involution: the compact form), on their own copies of the diagram (6.3), with the statement in the site's own words and `[Kna02]` as its citation.
- No engine computation, and no Vogan diagram of any other real form: no source beyond the table of contents of [Kna02] was read, and the golden data hold none. Every further statement is [U]: the sentence of 2.15 on $\mathfrak{sl}(3,\mathbb R)$ ("the Vogan diagram of $\mathfrak{sl}(3,\mathbb R)$ shows the two nodes exchanged and nothing painted") stays under `<Unverified item="E15">`, and any new one is proposed as a new item (`proposedUnverifiedItems`).
- `<Cite>` and `<Unverified>` are Astro components rendered at build time and do not exist inside a Svelte island. The full file must place the sidebar's text where they work (for example rendered at build time and passed into the island) so that a release build shows a closed item unmarked and an open one as its fallback or nothing (7.3).
- M9 beat 9 stays static, as its figure row says; (plan) it gains a link to the sidebar.

### 6. Acceptance

No golden key; 9.1 asks for "tool acceptance" (plan):

- [ ] The sidebar renders in the default state of T13, with JavaScript disabled too, and states the [S2] sentence with its citation (`data-out="vogan-sidebar"`, plan name). `T13-vogan.spec.ts`. Gate of P7-A4.
- [ ] No statement about Vogan diagrams beyond the [S2] sentence appears outside `<Unverified>`; a release build shows only fallbacks for open items. Same file, on the release build. Gate of P7-A4.
- [ ] Every T13 acceptance test of G6 and every M9 test still passes; axe; keyboard; `/tools/satake` at most 90 kB; no file under `packages/engine/` changed. `T13.test.ts`, `T13.spec.ts`, `T13-keyboard.spec.ts` and `M9.spec.ts`, unchanged; axe and keyboard in `T13-vogan.spec.ts`; the size by `npm run size`; the engine check by `git diff --stat` from the start of the item to its merge (plan). Gate of P7-A4.
- [ ] Owner's part, not automated (plan, section 3): the playtest of 9.4 and the A-13 screen-reader script, extended by the sidebar. Gate of P7-A4: listed in `ownerPart` and in its gate report as due, never run by `GATE`.

### 7. Files

- **You own** (plan): the deliverables of section 4 and beat 9 of `m9-real-forms.mdx`, additively.
- **You may edit with the stated protocol**: none of T13's existing files in stage 7.c, which P7-A3 holds (README 3.2); your sidebar is a new file, and your report asks P7-A3 or `MERGE` to mount it (README 6).
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, `packages/engine/`, `content/unverified.json`.

### 8. Order of work

The sidebar with its test on the preview build; the release-build check; the link from beat 9; commit after each.

### 9. Traps

- Inventing Vogan data for real forms; the roster says "anything further is [U] and wrapped".
- The decoration never competes with the sign encoding (6.3).
- The Tits index is named in 2.15 with no data; name it at most.
- Never say that $\theta$ "is not an involution" (M9 beat 4).

### 10. Report

`COMMON.md` 5.2. (plan) Also: `mountRequest` (the request to P7-A3 or `MERGE`) and the new unverified items proposed.

## 8. P7-A5 web-components: Embeddable web components

Phase 7, stage 7.c. Size M. Runs in: a worktree on branch `agent/P7-A5` (MERGE and GATE: the primary checkout on `main`).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

### 1. Objective

Custom elements that wrap the tools, so that a teacher can embed a tool in another page without an iframe, "with the same state and link format" (roster). They serve the tertiary audience of 1.2: "| Tertiary: teachers and expositors | Either of the above | Embeddable tools and exportable figures |".

### 2. Read first, in this order

1. `SPEC.md` 7.4 in full, 1.2, 7.6 in full ("budgets apply").
2. 6.6 (URL form: "On a tool's own route (`/tools/...`, `/embed/...`) the keys are bare"; Validation), 4.0, 7.5, 7.3, 7.8 ("No third-party script at runtime"), 7.9 (credit), 5.1 E-9.
3. 7.1 and 7.2 (toolchain), SOURCES 11.8; the installed Svelte's documentation on custom elements (`COMMON.md` 3).
4. CONTRACTS 4 (`state.ts`, `urlCodec.ts`, `worker.ts`), 5 (`ToolFrame`, the registry), 8 (CSS custom properties); the roster entry of P6-A5 (embed routes) and its fragment on `main`.

### 3. Inputs you depend on

On `main`: the registry `site/src/tools/index.ts` and every tool; `pages/embed/[tool].astro`; `decodeState`, `encodeState`, `resolveBoard`; `lib/worker.ts`; `ToolFrame`; the tokens of CONTRACTS 8.

### 4. Deliverables

(plan) One custom element per registered tool (or one element with a `tool` attribute), its build entry and served path, a host-page test `site/tests/e2e/webcomponents.spec.ts` with a fixture page, a short embedding text for readers (a request to the owner of the page it goes on), and `decisions/P7-A5.md`. A new build script or dependency is requested, not installed (`COMMON.md` 3).

### 5. Requirements

Verbatim from 7.4:

> - **Embedding.** Every tool has a route `/embed/<tool>` that renders the tool alone for use in an `<iframe>`, accepting the same query parameters. Web components are a phase 7 option.

- Same state and link format: the element takes the keys and values of 6.6 as on `/embed/<tool>` (bare keys), decoded by `decodeState` (plan); any validation failure gives the default state and the same notice as on the site. (plan) The tool inside is the same component as on `/tools/<id>`, with 4.0, A-1 to A-12 and the test hooks intact.
- 7.6 applies (plan: the script one element fetches before the first interaction stays within the 90 kB of "each tool alone"); KaTeX is never sent to the reader; the E-9 cases still run in a worker and never on the main thread.
- (plan) The element never writes the host page's address bar or history (the `replaceState` of 7.4 is for the site's own pages); "Copy link" and "Cite" point to the tool's route on the site with the state.
- (plan) Without JavaScript the element shows its light-DOM children, which the embedding text fills with a link to the tool's route.
- (plan) The tokens of CONTRACTS 8 are defined on the element itself and follow `prefers-color-scheme`, since the host page has neither the site's `:root` nor its theme switch.

### 6. Acceptance

No golden key; 9.1 asks for "tool acceptance" (plan):

- [ ] For every registered tool, an element on a host page served from another origin renders the default state with the same hooks as `/embed/<tool>`, and the same keys give the same state for one example per tool. `site/tests/e2e/webcomponents.spec.ts` (plan: one test per tool, driven by the registry). Gate of P7-A5.
- [ ] A move updates `data-moves` and the live region announces with the templates of 7.5; the host page's address is unchanged. `webcomponents.spec.ts`. Gate of P7-A5.
- [ ] Sampled validation failures of 6.6 give the default state and the notice. `webcomponents.spec.ts`. Gate of P7-A5.
- [ ] An E-9 case runs off the main thread; no long task. `webcomponents.spec.ts` (plan: a long-task observer on the host page). Gate of P7-A5.
- [ ] Size per element at most 90 kB gzip, measured as `npm run size` does; axe on the host page; the keyboard model of A-1; the fallback without JavaScript. `webcomponents.spec.ts` for axe, keyboard and the fallback; the size by `npm run size` (plan: one size row per element). Gate of P7-A5.
- [ ] Owner's part, not automated (plan, section 3): the playtest of 9.4 and the A-13 screen-reader script, extended by one embedded element on a host page. Gate of P7-A5: listed in `ownerPart` and in its gate report as due, never run by `GATE`.

### 7. Files

- **You own** (plan): the deliverables of section 4.
- **You may edit with the stated protocol** (plan): nothing of the tools themselves; a change a tool needs (a hook unreachable in a shadow root, for example) is a request to the item or area that owns it.
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, root `package.json` and the lockfile (request a script), `pages/embed/[tool].astro`, `lib/` (request changes).

### 8. Order of work

One element for T1 with the host test, end to end; then the rest from the registry; then sizes and accessibility; commit after each.

### 9. Traps

- A Web Worker cannot be started from a script on another origin as an ordinary worker; check in the browsers how E-9's worker starts on a host page, and never move its cases to the main thread.
- Fonts declared inside a shadow root may not load in every browser: check the KaTeX markup of `names.json` (T13, T14, pickers) inside the element.
- Two elements on one host page keep separate states (instance ids, 6.6); a script loaded twice must not define an element name twice.
- Svelte 5 only, read from the installed package (`COMMON.md` 3); `astro dev` never in a check.
- `RT-04` (codec) is not in the phase 7 lenses; if the element parses anything itself instead of calling `decodeState`, add `RT-04` for this item (plan).

### 10. Report

`COMMON.md` 5.2. (plan) Also: the element names, the served path of each script, and the measured size per element.

## 9. Red team for phase 7

From the roster: `"redTeam": { "lenses": ["RT-01", "RT-02", "RT-03", "RT-05", "RT-06", "RT-07", "RT-08", "RT-09", "RT-10", "RT-11"], "maxRounds": 2 }`. The protocol is README 5.3, with at most two rounds instead of three (`redteam-phase.js` reads `maxRounds`). The lenses run after each item's gate on the areas it changed (plan). What each lens aims at in phase 7 (plan; every lens file below already has a phase 7 row, and most have phase 7 attacks, which are reconciled with this table as section 1, step 6 says):

| Lens | Phase 7 focus | Items |
|---|---|---|
| `RT-01` differential-oracle | `ZPhiArith` against the oracle's `Phi` on random and near-zero values; `mutate`, `fire`, `play`, `orbit` on $H_2$, $H_3$, $H_4$ from random starts; `goldenFold` on random vectors; `orbitPlusZeroMatrices` against `orbit_plus_zero_matrices`; `shadow2` on pairs that pass RV20 and fail condition 3 | A1, A2, A3 |
| `RT-02` convention-drift | plain against golden; the order of the $H$ nodes; $\varphi$ on the last edge; positions against labels in the pairs; column against row of $C$ on $B_n$ and $G_2$; $E$ against $F$ and the 2 on steps leaving zero; the node numbering of $G_2$ | A1, A2, A3 |
| `RT-03` bounds-and-errors | the $H_4$ orbit against caps and E-9; a `Board<ZPhi>` passed to rational and finite-theory functions; `toBig` on `ZPhi` | A1 |
| `RT-05` a11y-and-layout | the golden tab (keyboard, spoken $a+b\varphi$, signs, the $H_n$ layout at 320 pixels); the T12 preset; the T13 toggle and sidebar; elements in a shadow root | all |
| `RT-06` no-js-and-no-worker | the default states of the golden tab, the T12 preset and the sidebar without JavaScript; no worker for any default; the fallback of an element | all |
| `RT-07` perf-budget | `/tools/fold`, `/tools/rep`, `/tools/satake` and the M7, M8, M9 pages within their limits; the engine's `packages/engine/src/golden.ts` (`ZPhi` code, `coxeterH`, `goldenFold`) not pulled into routes that do not use it (not to be confused with `site/src/lib/golden.ts`, `P0-A4`'s `<G>` resolver, which runs at build time on every lesson route); size per element | all |
| `RT-08` content-rules | beat 8 of M7, beat 7 of M8 and the Vogan sidebar: `<G>` for every golden number, E9 and E15 wrapped, draft marks, no em-dash, no claim of novelty | A1, A2, A4 |
| `RT-09` math-claims | the facts of 2.17 and 2.18 as stated; generalized diagrams never called real forms; the [S2] Vogan sentence | A1, A2, A3, A4 |
| `RT-10` spec-compliance | each item's brief and full file walked line by line: functions and presets present, acceptance automated, decisions logged (D9) | all |
| `RT-11` test-integrity | the phase 7 keys covered once each; reference hashes; tests that fail against an empty or float-based implementation; the table of pairs not compared only with itself | A1, A2, A3 |

Names per item (plan, a proposed amendment, not yet a rule). `RED-TEAM-COMMON.md` and `CONTRACTS.md` fix the lens branch as `redteam/P{k}-RT-{nn}` and the fix branch as `fix/P{k}-<cluster>`, and `redteam-phase.js` builds the finding ids (`P${R.phase}-${lens}-NN`), the report `reports/merge-P${R.phase}-redteam-round${round}.md` and the fixers' names (`RT-FIX-P{k}-<cluster slug>`, with their fragments and discrepancy scripts) from the phase alone. Run once per item, every phase 7 item would reuse `redteam/P7-RT-01` and the other branches, reports and fragments of the item before it. So each per-item run carries the item in every such name: lens branches `redteam/P7-A{m}-RT-{nn}`, fix branches `fix/P7-A{m}-<cluster>`, finding ids `P7-A{m}-RT-{nn}-NN`, `reports/merge-P7-A{m}-redteam-round{r}.md`, `decisions/RT-FIX-P7-A{m}-<cluster slug>.md`, `reports/discrepancies/RT-FIX-P7-A{m}-<cluster slug>-<n>.py`, and a scratch directory and fixer worktree per item. The orchestrator writes this into `CONTRACTS.md` (the branch line), `RED-TEAM-COMMON.md`, `red-team/RT-FIX.md` and `redteam-phase.js` (for example from an `item` field of the restricted roster, step 7 of section 1) before the first per-item red-team run; until then a per-item run must not start while the branches of an earlier item's run still exist.

Not in the list: `RT-04` codec-attacker (schema 1 does not change; see P7-A5's traps), `RT-12` toolchain-reality (no new dependency is planned; (plan) add it for an item that adds one) and `RT-13` reader-playtest (9.4 makes the playtest the owner's part "of gate G3, and each later release").

## 10. Decisions the full files must take

A checklist for the orchestrator when it schedules an item (plan). Each is discussed in the brief named.

1. The order of D9, confirmed or changed by the owner (section 2).
2. Where `ZPhi` and `ZPhiArith` live (`arith.ts` or `golden.ts`), the reconciliation of `RT-03`'s row "`ZPhi` (`golden.ts`)" with that choice, the README 6 row that grants P7-A1 (and P7-A2) the additive edits of `arith.ts` and `index.ts` that README 6 gives to `P0-A2`, and the phase 7 signatures for CONTRACTS 2.4 (P7-A1, P7-A2).
3. Whether the core on `main` is generic over `Arith<T>`, and who may change it (P7-A1).
4. The `kind` of a `Board<ZPhi>` and how the rational and finite-theory functions refuse it, given that E-10 has no class for it (P7-A1).
5. The boards of T11's golden tab, links made on it, `data-value` and the spoken form of $a+b\varphi$ (P7-A1).
6. How T12's one-zero-weight mode is reached by a link in schema 1 (P7-A2).
7. Where the RV20 condition is computed (P7-A3).
8. The split of T13's files between P7-A3 and P7-A4 in stage 7.c (P7-A3, P7-A4).
9. Where the sidebar's prose is rendered so that `<Cite>` and `<Unverified>` work (P7-A4).
10. Element names, build path, host-page policy, worker start and size row of the web components (P7-A5).
11. The top-level `gate`, `gateItems` and `ownerPart` of each item's restricted roster (the owner's part with the 9.4 playtest and the A-13 script of each release, or the owner's recorded decision that a 1.x release is exempt), and its coverage check (the coverage check as an amendment of `CONTRACTS.md` 3 and `agents/GATE.md`); the 1.x release build, its open-items report and archives, with the version tag and publishing left to the owner; README 6 rows; the reconciliation of the phase 7 rows and attacks of the lens files (sections 1 and 3).
12. The model of P7-A1 and P7-A2 (section 1).
13. The per-item names of the red-team runs (lens and fix branches, finding ids, reports, fragments, scratch directories and fixer worktrees), as an amendment of `CONTRACTS.md`, `RED-TEAM-COMMON.md`, `red-team/RT-FIX.md` and `redteam-phase.js` (section 9).
14. The "further languages" of 9.1, not briefed here (section 2).
