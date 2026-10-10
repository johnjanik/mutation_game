# P6-A4: Tool T14 Atlas: one static page per board

Phase 6, stage 6.2. Size M. Runs in: a worktree on branch `agent/P6-A4`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

## 1. Objective

When you are done the site has tool T14, the Atlas (id `atlas`): one static page `/atlas/<board>/` for each of the 32 named finite types ($A_1$ to $A_8$, $B_2$ to $B_8$, $C_2$ to $C_8$, $D_4$ to $D_8$, $E_6$, $E_7$, $E_8$, $F_4$, $G_2$), generated at build time by calling the engine, plus an index page `/atlas/`. Each page is a data sheet: the Cartan matrix with a convention switch and the note on Wildberger's names, roads, weights, roots, highest roots and their numbers, exponents, $h$, $|W|$, $\det C$, minuscule nodes, $-w_0$, orbit sizes of the fundamental weights, the number of complete games where the golden data has it, the ring sizes in the Coxeter plane, marks and comarks of the affine board, and the real forms. Every item links to the tool that demonstrates it with that board loaded, and the page offers JSON, CSV and LaTeX downloads. The Atlas is the reference sheet of module M10 (`P6-A8` links it in stage 6.3), the target of the "Atlas page" link that `ModuleLinks` puts on every lesson (8.2 item 7), and a test of the engine: the phase-6 roster's gate items for G6 require "acceptance of T13 and T14 as automated tests" (plan, `rosters/phase-6.json`; SPEC 9.1's G6 row itself reads "all golden tests of phases 0 to 6; full accessibility scan; sizes and lab timings of section 7.6 on every page; a release build succeeds").

## 2. Read first, in this order

Read in full:

1. SPEC 4 T14 (line 1217): the entry you build, two paragraphs. Every phrase of it is restated in section 5 and every clause of its acceptance paragraph is a line of section 6.
2. SPEC 2.9 (line 321): the conventions table. Its last two rows drive the switch: "SageMath; Kac [Kac90] ... same matrix. Kac numbers the nodes of $E_6$, $E_7$, $E_8$ and $G_2$ differently ([S2] for $E_6$, [U] for the rest)" and "Bourbaki [Bou68]; Humphreys [Hum72] ... transpose of $C$ [S2]; same node numbering". The sentence before the table says it "is the basis of the 'conventions' switch in the Atlas (tool T14) and of outcome LO10".
3. SPEC 2.10 (line 350): Wildberger's names and numbering, the table of translations (all rows [V], golden key `wildberger_lists`), "So for rank at least 3 the letters $B$ and $C$ are exchanged relative to Bourbaki", and the misprint table (which the site must not reproduce).
4. SPEC 4.0 (line 1040): the rules common to every tool. Section 5.9 below says which apply to a static data sheet and how.
5. SPEC 2.8 (line 273): Bourbaki numbering of every family, the reference matrices, the table of data (its "$-w_0$ on nodes" column prints `identity` and its minuscule column prints `none`), and "Names in rank 2" ($B_2$ and $C_2$ are one board; "The site shows '$B_2=C_2$' where a single name could mislead [D]").
6. SPEC 6.6 (line 1672): the state object, the URL form with one-letter keys, bare keys on a tool's own route, and the Validation paragraph. Every link you generate must pass it.

Read for reference:

7. SPEC 2.12 (line 394): marks (the positive integer $\delta$ with $C\delta=0$) and comarks ($c^{\mathsf T}C=0$), node 0 first; the table of marks and comarks of some untwisted boards; "On simply laced boards marks and comarks coincide".
8. SPEC 6.4 (line 1633, the "Names in rank 2" and "Coincidences" paragraphs) and 6.5 (line 1668): plain-text real-form names in data, display names, Cartan's labels "shown beside them", and "Some references write $\mathfrak{sp}(2p,2q)$ and $\mathfrak{sp}(8)$ for what is here $\mathfrak{sp}(p,q)$ and $\mathfrak{sp}(4)$; the Atlas notes this."
9. SPEC 6.7 (line 1716): `\dynkin` export with explicit marks in Bourbaki order, one character per node (`o` white, `*` black); the package's named diagrams are not used.
10. SPEC 7.3 (line 1774): `pages/atlas/[board].astro`; the Atlas pages appear in phase 6; the `released` flag; `names.json` "the tools that show names (T13, T14, the board pickers) look them up there"; the four content components (`G`, `Tex`, `Unverified`, `Cite`). You use `<Unverified>` and `<Cite>` for the notes and `<Tex>` (or `renderTex` of `lib/katex.ts`) for mathematics, always with a literal `src` and never with a `{{path}}`, so no golden value enters the page. You never use `<G>` (trap 1).
11. SPEC 7.4 (line 1825, "Without JavaScript"), 7.5 (A-1 to A-13; A-13 for release 1.0 adds "read the Atlas page of $B_3$"), 7.6 (the 15 kB row: "a page with no tool (`about`) ... the shell"), 7.2 item 10 (base path).
12. SPEC 3 M10 (line 1011): "The Atlas (T14) is a data sheet for every board, with a switch between conventions."
13. SPEC 10 D19 (line 2042 onward): "the name of the board the reader chose in pickers, and '$B_2=C_2$' wherever a board is recognised from its shape". SPEC 9.5, the risk table row whose risk cell is "Confusion between $B$ and $C$ when readers compare with Wildberger" and whose answer cell is "section 2.10 surfaced in M6 and in the Atlas".
14. SPEC 5.1 E-4, E-7, E-9, E-10; 5.6 (the row "Group order for counting games: 60000, count not offered"); 5.7 (comparison rules 1 to 7, the phase rows for every `types[*]` field).
15. SPEC 8.4 (writing rules; no em-dashes), 9.2 (definition of done for a tool), Appendix E item 4 (Kac's numbering "for the Atlas").
16. Appendix G (line 2420): the `types` rows (which fields exist on which types), `affine[T]` (`name`, `constructor_name`, `cartan_node0_first`, `marks`, `comarks`), `satake`.

Oracle: none (the roster lists no oracle function; every value comes from engine functions already ported and golden-tested by earlier agents).

Golden keys you compare against (in tests only, never at build or run time). Shapes, printed from the file:

- `types[T]` for the 32 names in file order `A1..A8, B2..B8, C2..C8, D4..D8, E6, E7, E8, F4, G2`. For `B3`: `cartan` `[[2,-1,0],[-1,2,-1],[0,-2,2]]`; `adjacency` `[[0,1,0],[1,0,2],[0,1,0]]`; `symmetrizer` `[2,2,1]`; `n_roots` 18; `n_positive_roots` 9; `positive_roots` `[[0,0,1],[0,1,0],[1,0,0],[0,1,1],[1,1,0],[0,1,2],[1,1,1],[1,1,2],[1,2,2]]`; `highest_root` `[1,2,2]`; `numbers_of_highest_root` `[0,1,0]`; `highest_short_root` `[1,1,1]`; `numbers_of_highest_short_root` `[1,0,0]`; `exponents` `[1,3,5]`; `coxeter_number` 6; `weyl_order` 48; `det_cartan` 2; `minuscule_nodes` `[3]`; `minus_w0` `[1,2,3]`; `fundamental_orbit_sizes` `[6,12,8]`; `n_reduced_words_w0` 42; `coxeter_plane` `{"rings": [[1.154701, 12], [2.0, 6]], "distinct_points": 12, "h_points_on_every_ring": false}`.
- Absent fields (rule 7): `positive_roots` on `A5..A8, B5..B8, C5..C8, D5..D8` (compare `n_positive_roots`); `highest_short_root` and `numbers_of_highest_short_root` on every simply laced type; `n_reduced_words_w0` on `A8, B7, B8, C7, C8, D7, D8, E7, E8` (the types with $|W|>60000$); `coxeter_plane` on `A1`. The largest `n_positive_roots` is 120 ($E_8$).
- `affine[T]`: for `B2` `{"name": "C2~", "constructor_name": "B2~", "marks": [1,1,2], "comarks": [1,1,1]}`; for `C2` `{"name": "C2~", "constructor_name": "C2~", "marks": [1,2,1], "comarks": [1,1,1]}`; for `B3` `{"name": "B3~", "constructor_name": "B3~", "marks": [1,1,2,2], "comarks": [1,1,2,1]}`. Node 0 first.
- `satake`, filtered by `dynkin_type`: for `B3` the pairs (`cartan_label`, `real_form`) are `("B II","so(1,6)")`, `("B I","so(2,5)")`, `("B I","so(3,4)")`, `("compact","so(7)")`; on `D4` six records including `so(2,6)` and `so*(8)`; 167 records in all.

CONTRACTS sections that bind you: 2.1 and 2.4 (engine signatures), 2.2 (`Rational`, `SatakeCatalogueEntry`), 3 (harness helpers for your test), 4 (`export.ts`: `exportJSON`, `exportLaTeX`; `state.ts`: `defaultState`; `urlCodec.ts`: `encodeState`, `decodeState`), 5.2 (registry entry for `atlas`), 6 ("T1 and T14 have no presets (T1 is configured by its properties; T14 is static pages)"), 7 (content components), 1 (path aliases).

## 3. Inputs you depend on

Must be on `main` when you start (stage 6.1b is merged). If any is missing, stop and report `blocked`; do not re-implement it.

- Engine (`@engine`): phase 0 to 2: `boardFromName`, `cartanNumbers`, `adjacency`, `toLabels`, `positiveRoots`, `roots`, `highestRoot`, `highestShortRoot`, `toNumbers`, `coxeterNumber`, `minusW0`, `minusculeNodes`, `play`, `determinant`, `symmetrizer`, `affineExtension`, `identifyAffine`, `transposeBoard`; phase 3 (`P3-A1`): `exponentsFromFired`, `weylOrder`, `orbitSize`, `countCompleteGames`; phase 4 (`P4-A1`): `coxeterPlaneRings`; phase 6 (`P6-A2`): `satakeCatalogue`; `CAPS` from `caps.ts`.
- `scripts/names.mjs` extended by `P6-A2`, writing `site/src/generated/names.json` with every real-form display name of 6.5, every Cartan label and every type name.
- `site/src/lib/export.ts`: `exportJSON` (`P1-A2`) and `exportLaTeX` (`P6-A5`, stage 6.1).
- `site/src/lib/state.ts` (`defaultState`) and `urlCodec.ts` (`encodeState`, `decodeState`), `P1-A2`.
- `site/src/tools/types.ts` (`ToolRegistryEntry`) and `tools/index.ts`, `pages/tools/[tool].astro` (`P1-A2`); `pages/embed/[tool].astro` (`P6-A5`).
- `site/src/components/content/Unverified.astro`, `Cite.astro`, `Tex.astro` (`P0-A4`); `site/src/lib/katex.ts` (`P0-A3`).
- `site/src/components/math/MatrixView.svelte` (`P5-A2`), rendered on the server with no `client:` directive.
- `site/src/layouts/Page.astro`, `Nav.astro`, `Footer.astro`, and the `released` mechanism (`P1-A4`); the theme tokens of `site/src/styles/` (`P1-A3`).
- `packages/engine/test/golden/_harness.ts` (`golden`, `TYPE_NAMES`, `intEq`, `ringsEq`, `ratText`, `sortedPositiveRoots`), imported by `atlas.test.ts` only. The `@engine` alias points at the engine package, which does not export its tests, so import the harness by a relative path from `site/tests/unit/atlas.test.ts` (`../../../packages/engine/test/golden/_harness.ts`; plan, the practice `P4-A4` and `P6-A3` also follow). Never import it from shipped code. See trap 16 for `covers()`.

Not needed and not yours: T13 (`P6-A3`, built in parallel in this stage; your links to `/tools/satake` resolve once both branches are merged), the lessons, the engine source.

## 4. Deliverables

| File | Contents |
|---|---|
| `site/src/components/atlas/atlasData.ts` (plan name) | `ATLAS_BOARDS` (the 32 names) and a pure function `atlasData(name: string): AtlasSheet` that computes every item of the sheet with the engine, returns labels (never positions), integers as `number` or `bigint`, and the tool link of each item |
| `site/src/components/atlas/*.astro` (plan: `AtlasSheet.astro`, `ConventionSwitch.astro`, `WildbergerNote.astro`, `AtlasDownloads.astro`, `AtlasItem.astro`) | the sections of the page, server-rendered, no `client:` directive |
| `site/src/components/atlas/AtlasPicker.svelte` (plan) | the component the registry points to for `/tools/atlas` and `/embed/atlas`: the 32 boards grouped by letter, each a link to its Atlas page; with `g` in the URL, the chosen board's link first |
| `site/src/components/atlas/atlas.css` or scoped styles (plan) | layout, the CSS-only switch, horizontal scroll inside matrix boxes |
| `site/src/pages/atlas/[board].astro` | `getStaticPaths` over `ATLAS_BOARDS`; renders `AtlasSheet` in `Page.astro` |
| `site/src/pages/atlas/index.astro` | the index of the 32 pages grouped by letter |
| `site/src/tools/registry/T14.ts` | `{ number: 14, id: 'atlas', title: 'Atlas', phase: 6, boards: [...ATLAS_BOARDS], presets: <none, see 5.10>, outs: [...], component: () => import('@components/atlas/AtlasPicker.svelte') }` |
| `site/tests/unit/atlas.test.ts` | Vitest: every value of `atlasData` against golden for all 32 types; the transpose; every tool link decodes; no golden import in the build path; no misprinted Wildberger list. Imports the harness by a relative path and does not call `covers()` (trap 16, plan) |
| `site/tests/e2e/T14.spec.ts` | Playwright: B3 without JavaScript; the switch; downloads; displayed values on all 32 pages; links; no island; axe; 320 px; long numbers; index |
| `decisions/P6-A4.md` | every plan choice of section 5 marked (plan), the 15 kB choice, build time |

## 5. Requirements

### 5.1 Pages and generation

- One static page per board, "generated at build time by calling the engine" (T14). Route `/atlas/<name>/` with `<name>` the type name exactly as in data (`A1`, `B3`, `E8`), one for each of the 32 named finite types. The roster summary adds "(and the affine boards' marks and comarks)": these are items on the finite board's page, not pages of their own (plan reading).
- `ATLAS_BOARDS` is written in `atlasData.ts` from the families of 2.8 ($A_1$ to $A_8$, $B_2$ to $B_8$, $C_2$ to $C_8$, $D_4$ to $D_8$, $E_6$, $E_7$, $E_8$, $F_4$, $G_2$), never read from `golden_data.json`; `atlas.test.ts` checks that it equals `TYPE_NAMES` (plan).
- "Compute from the engine at build time; do not print golden values (the Atlas is a test of the engine, not a copy of the file)" (roster trap). No import of `reference/golden_data.json` and no `<G>` or `{{path}}` anywhere in the Atlas build path. The golden file is the test oracle only.
- At build time every call runs in Node and E-9 does not apply. Nothing on the Atlas page calls the engine in the browser.
- Every internal link and asset is built from `import.meta.env.BASE_URL` (7.2 item 10).
- `atlas/index.astro`: the 32 boards grouped by letter (4.0 "Board pickers ... grouped by letter"), each with its typeset name from `names.json` and a link to its page.
- Release: the Atlas appears in phase 6 (7.3). Make sure the pages count as released for `ModuleLinks` and the nav under `P1-A4`'s `released` mechanism. Read that mechanism on `main` first. If it needs an edit to a file you do not own, write the request (to `P1-A4`'s area, executed by `MERGE`) in your report and decisions fragment.

### 5.2 The items, in the order of the T14 entry

For each item: what is shown, the engine call, the golden field it must equal, and the tool it links to. The tool links are the plan's choice. SPEC says only "Every item links to the tool that demonstrates it with that board loaded". Each link must name a tool that offers the board (see 5.3).

1. **Cartan matrix** with the convention switch (5.4) and the note on Wildberger's names (5.5). `cartanNumbers(boardFromName(T))`, rows and columns in label order. Golden `types[T].cartan`. Link: T1 `board` (`/tools/board?g=T`).
2. **Roads**: the adjacency matrix $A$ with $A_{ij}$ = roads from $i$ to $j$ = $-C_{ji}$, from `adjacency(board)`. Golden `adjacency`. Link: T1. A drawing of the board is optional (plan). If you draw it, use the drawing code of `components/draw/` on the server with no hydration, and never `Board.svelte` with live buttons.
3. **Weights $d_i$**: `symmetrizer(board)`, `Rational[]`, shown through `ratText` (all integers on the 32 types). Golden `symmetrizer`. Link: T3 `form`.
4. **Roots**: the number of roots `roots(board, cap).items.length` (or $2N$) and of positive roots, and the list of positive roots "up to 120 positive ones listed" (T14). Use `positiveRoots(board)`, in its order: sorted by total, then lexicographically, each a population in label order. Write the cap of 120 into the code, with a sentence for a longer list that says in words how many were listed and how many exist (wording plan; 4.0 "Stated limits" requires that a cut is said in words, but its two example sentences are about layers and positions, and neither SPEC nor CONTRACTS 5.3 gives a sentence for a root-list cap). No type exceeds it ($E_8$ has exactly 120), so all 32 lists are complete. Golden `n_roots`, `n_positive_roots`, and `positive_roots` where present (in order, rule 5); where absent, the count is compared (T14 acceptance). Link: T2 `garden` (`/tools/garden?g=T`). The growth mode of T2 is not part of a link (6.6, quoted under item 12), so the link opens the garden in its default mode; say in the link text what the reader will see there (plan).
5. **Highest roots and their numbers**: `highestRoot(board)` and `toNumbers(board, highestRoot)`; on $B$, $C$, $F$, $G$ also `highestShortRoot(board)` and its numbers (`null` elsewhere: omit the line, never print "null"). Golden `highest_root`, `numbers_of_highest_root`, `highest_short_root`, `numbers_of_highest_short_root`. Link: T9 `kostant` (Kostant's game ends at the highest root, or the highest short root from a short city).
6. **Exponents**: `exponentsFromFired(play(board, ones).fired, n)` from the game from all ones with the lowest-node rule. Golden `exponents`. Link: T5 `numbers` (`/tools/numbers?g=T`). The link loads only the board (and, if you give one, the start). It cannot open the tally: 6.6 says "Options that are not listed here (the growth mode of T2, the weights typed into T3, the tab of T5, T11 or T15, ...) are not part of a link in schema 1; a link opens the tool with those at their defaults." So T5 opens on its default tab, and the link text tells the reader where the tally is (wording plan).
7. **$h$**: `coxeterNumber(board)`. Golden `coxeter_number`. Link: T5 `numbers` (`/tools/numbers?g=T`), where the wave counts $h$ rounds on rank at least 2. The wave is a tab of T5 (its preset `wave`, CONTRACTS 6), and "the tab of T5" is one of the options that "are not part of a link in schema 1; a link opens the tool with those at their defaults" (6.6). So the link loads only the board, T5 opens on its default tab, and the link text tells the reader to open the wave to count the rounds (wording plan). Do not claim on the page that the link opens the wave.
8. **$|W|$**: `weylOrder(board)`, a number (E-4). Golden `weyl_order`. Link: T8 `weyl` on the 14 boards it offers ($A_1$ to $A_5$, $B_2$ to $B_4$, $C_2$ to $C_4$, $D_4$, $F_4$, $G_2$), otherwise T5.
9. **$\det C$**: `determinant(cartan)`, a `Rational`, shown as an integer. Golden `det_cartan`. Link (plan): T1 in the linked view (`v=l`), where $a=Cp$ shows the matrix at work.
10. **Minuscule nodes**: `minusculeNodes(board)` converted with `toLabels`, increasing. Print "none" when empty ($E_8$, $F_4$, $G_2$), as the 2.8 table does. Golden `minuscule_nodes`. Link: T12 `rep` with `k=<label>` for the first minuscule node, or with no `k` when there is none.
11. **$-w_0$**: `minusW0(board)` gives, for each position, the position of its image. Show the images in label order, $(\sigma(1),\dots,\sigma(n))$, and add the word "identity" when it is the identity, as the 2.8 table does. Golden `minus_w0`. Link (plan): T1 in the numbers view, legal mode, from the fundamental weight of node 1 (`v=n&m=l&c=n&s=1,0,...`). Playing it to the end lands on $-\omega_{\sigma(1)}$.
12. **Orbit sizes of the fundamental weights**: `orbitSize(board, e_i)` for each node in label order (numbers; E-4 says they fit). Golden `fundamental_orbit_sizes`. Link (plan): T2 with the board and the start $\omega_1$ (`g=T&c=n&s=1,0,...`). The link cannot carry orbit mode: the growth mode of T2 is one of the options that "are not part of a link in schema 1; a link opens the tool with those at their defaults" (6.6). So the link loads only the board and the start, the garden opens in its default mode, and the link text tells the reader to choose orbit mode to grow the orbit of $\omega_1$ (wording plan). Do not claim on the page that the link opens the orbit.
13. **Number of complete games, "where the golden data has it"**: call `countCompleteGames(board)` only when `weylOrder(board) <= CAPS.countGamesGroup` (60000; 5.6 "Group order for counting games: 60000, count not offered"). The result is a `bigint` (E-4). On the nine types above the cap, show a sentence that the count is not offered for a group of more than 60000 elements (wording plan) and no number. Golden `n_reduced_words_w0` where present. Link: T8 `weyl` (`/tools/weyl?g=T`) on its 14 boards, where the counter shows the count; elsewhere (plan) T1 in the numbers view, legal mode, from all ones (`v=n&m=l&c=n&s=1,...,1`, one `1` per node), where a complete game can be played. The view must be named, because 6.6 Validation rejects "a view and a mode that the table of T1 does not allow together". The counter is a preset of T8 (`counter`, CONTRACTS 6), and no key of 6.6 carries a preset, so a link cannot open it: the link loads only the board, T8 opens in its default view, and the link text tells the reader to choose the counter (wording plan). Do not claim on the page that the link opens the counter.
14. **Ring sizes in the Coxeter plane**: `coxeterPlaneRings(board).rings`, the sizes innermost first. If you also show radii, compare them within $10^{-5}$ (rule 3). On $A_1$ (rank 1) there is no Coxeter plane: omit the item with a sentence, and do not call the function. Golden `types[T].coxeter_plane.rings` (sizes exactly; radii through `ringsEq`). Link: T10 `geometry` with `r` = the numbers of the highest root and `j=coxeter` (plan; the root polytope in the Coxeter plane, as in T10's acceptance).
15. **Marks and comarks of the affine board**: `affineExtension(boardFromName(T))` gives `{board, marks, comarks}`, node 0 first, labels $0,\dots,n$ (E-7). Show the affine board's name from `identifyAffine(ext.board)` and both vectors with their node labels. Add the sentence of 2.12 that on simply laced boards they coincide only where it is true of this board. Golden `affine[T].name`, `.marks`, `.comarks`. Link: T15 `affine` with `g=<affine[T].constructor_name>`, which is `T~` (`B2~` on the $B_2$ page, `C2~` on the $C_2$ page).
16. **Real forms**: `satakeCatalogue(T)`, one line per record, in catalogue order. Each line has the display name from `names.json` (6.5) with Cartan's label "shown beside" it (6.5), and $\mathfrak{su}^*(2m)$ "also shown as $\mathfrak{sl}(m,\mathbb H)$" (6.5). On $C_n$ pages add the note of 6.5: "Some references write $\mathfrak{sp}(2p,2q)$ and $\mathfrak{sp}(8)$ for what is here $\mathfrak{sp}(p,q)$ and $\mathfrak{sp}(4)$; the Atlas notes this." Golden: the set of (`cartan_label`, `real_form`) of `satake` records with this `dynkin_type`, matched by `real_form` (rule 5). Link: T13 `satake` with `x` = the black-node labels joined by dots (empty for none) and `t` = the full `tau` in label order joined by dots (6.6: "`x=2.3.4.5&t=1.2.3.4.5.6`").

The roster summary also lists "roots up to 120 positive" and "highest roots and their numbers" as above. Nothing else is required. Do not add fields such as `highest_root_of_reversed_board` or `length_distribution` unless you test them against golden too (plan).

### 5.3 Links to tools (6.6)

- Each link is `${BASE_URL}tools/<id>?<query>` with bare keys (6.6: "On a tool's own route (`/tools/...`, `/embed/...`) the keys are bare"). Build the query with `encodeState` from a `ToolState` (`defaultState(tool, T)` plus the fields named above), so the readable form of 6.6 is kept (`w=1.2.3.1`, `s=1,0,0`, `x=`, `t=`).
- Every link must pass `decodeState` for its tool with `notice === null`. The traps are 6.6's rules: "`s` must come with `c`"; a list whose length is not the number of nodes; "a board that the tool does not offer (section 4)"; "a `t` ... whose square is not the identity"; "a view and a mode that the table of T1 does not allow together". T8 offers 14 boards and T6 four, so never link T8 or T6 for a board outside their lists. `atlas.test.ts` decodes every link of every page.
- A link names only what it changes ("A key that is absent keeps ... the tool's default").

### 5.4 The convention switch (2.9, T14)

- Two options, in this wording or close to it: "This site, Kac and SageMath" shows $C$ with $C_{ij}=\langle\alpha_i^\vee,\alpha_j\rangle$. "Bourbaki and Humphreys (transposed)" shows $C^{\mathsf T}$ (2.9: "Cartan matrix $n(\alpha_i,\alpha_j)=\langle\alpha_i,\alpha_j^\vee\rangle$ ... transpose of $C$ [S2]; same node numbering").
- Compute the transpose with `cartanNumbers(transposeBoard(board))` or by transposing the integer matrix. The test compares it with the transpose of golden `cartan` ("the transposed matrix equals the transpose", T14 acceptance).
- A no-JavaScript-capable control (roster): both matrices are rendered in the HTML and the switch shows one. Use a native radio group (`<fieldset>` with a `<legend>`, two `<input type="radio">` with labels) and CSS `:checked` selectors that set `display: none` on the hidden matrix, so a screen reader also skips it. The default is "This site". No island, no script (plan).
- The note beside the switch says that the node numbering is the same in both (2.9) and states the matrix convention of this site in words ("$C_{ij}=\langle\alpha_i^\vee,\alpha_j\rangle$; the board has $A_{ij}=-C_{ji}$ roads from $i$ to $j$"). Cite with `<Cite k="Kac90"/>`, `<Cite k="Bou68"/>`, `<Cite k="Hum72"/>`.
- Kac's numbering: on the $E_6$, $E_7$, $E_8$ and $G_2$ pages say that Kac numbers the nodes differently. For $E_6$ the statement is [S2] and may stand. For $E_7$, $E_8$, $G_2$ it is [U] and must be wrapped: `<Unverified item="E4" fallback="...">`. Appendix E item 4 lists "Kac's numbering of $E_6$, $E_7$, $E_8$, $G_2$ for the Atlas", and the roster trap says "Kac numbers E and G differently ([U]: wrap in the note, E4)". Wrapping the $E_6$ sentence too is allowed and safer (plan). Suggested fallback: "Other books may number the nodes of this board differently; compare the Cartan matrices before reading off a node." (plan wording).

### 5.5 The note on Wildberger's names (2.10)

- On each page, the row of the 2.10 table that applies, in the site's words:
  - $B_2$, $C_2$: Wildberger's "$B_2$", "$C_2$" are these boards with the same numbering.
  - $B_n$, $n\ge3$: Wildberger's "$C_n$" is this board with the node order reversed (his vertex $k$ is node $n+1-k$).
  - $C_n$, $n\ge3$: his "$B_n$" is this board reversed.
  - $F_4$: his "$F_4$" is this board with the node order reversed, so his vertices 3 and 4 are the long ones.
  - $G_2$: same numbering (vertex 1 short).
  - $D_n$: his vertex $k$ is node $n-k$ and his 0 is node $n$.
  - $E_6$, $E_7$: his path $1,2,3,\dots$ is nodes $1,3,4,\dots$ and his 0 is node 2.
- Add the general sentence "So for rank at least 3 the letters $B$ and $C$ are exchanged relative to Bourbaki" on $B$ and $C$ pages (9.5 names this confusion as the Atlas's to surface).
- The table has no row for $A_n$ or $E_8$. Say only that the site uses Bourbaki's names and numbering, and claim nothing about Wildberger's lists for those boards.
- Provenance: [V] ("obtained by typing the printed lists of positive roots into `verify.py` and comparing", golden key `wildberger_lists`), stated in words on the page, for example "checked by computation against the printed lists" (wording plan; 8.4 accepts a provenance such as "Verified by computation for all boards of rank at most 8" and says it "must not be dressed up as a citation"), with the lists compared (the third column of 2.10). Cite `<Cite k="W20"/>` and `<Cite k="W-MS"/>`.
- Never reproduce a misprinted list of 2.10. If you show any list of Wildberger's, show the corrected one.

### 5.6 Names and rank 2 (2.8, D19)

- Board, affine-board and real-form names come from `site/src/generated/names.json` (7.3). Never typeset them with KaTeX inside a component of your own and never type them by hand.
- D19: the page for $C_2$ is titled $C_2$ and the page for $B_2$ is titled $B_2$ ("the name of the board the reader chose in pickers"). Each of the two pages says that $B_2$ and $C_2$ are one board with the two nodes exchanged (2.8, "The site shows '$B_2=C_2$' where a single name could mislead [D]") and links to the other.
- The affine board is recognised from its shape, so both pages show `C2~` (`affine[B2].name` and `affine[C2].name` are both `C2~`), marked as "$B_2=C_2$" where it could mislead (D19). The marks differ by page: `(1,1,2)` on $B_2$ and `(1,2,1)` on $C_2$, because the numbering differs (see trap 3).
- Real forms on $B_2$ and $C_2$: "$B_2$ and $C_2$ each list the same three algebras under their two families of names" (6.4). Show each page's own catalogue. A sentence pointing to the other page is welcome (plan).

### 5.7 Downloads: JSON, CSV, LaTeX (T14, 4.0)

- **JSON**: `exportJSON(defaultState('atlas', T), derived)` with `derived` the sheet's values (labels, integers; `exportJSON` writes bigints as decimal strings and adds the engine version and git commit, 6.6 "Data export").
- **CSV** (format plan): UTF-8, header `item,label,value`, one row per scalar item and one row per entry of each vector or matrix row (for example `positive_root,5,"0,1,2"`). Integers are written in full digits. Document the format in the decisions fragment.
- **LaTeX** (content plan): `exportLaTeX('dynkin', { type: T, black: [], tau: <identity> })` for the board, then one line per real form `exportLaTeX('dynkin', { type: T, black, tau })` preceded by a `%` comment with the Cartan label and the plain-text name, as in the examples of 6.7 (`\dynkin[involutions={16}] E{oo***o}   % E III, e6(-14)`). Read the `data` shape of `exportLaTeX` on `main` (it is `P6-A5`'s). Do not use the package's named diagrams (6.7).
- Delivery without JavaScript (plan): generate the three files at build time and offer each as `<a download="atlas-<T>.<ext>" href="data:<type>;charset=utf-8,<encoded>">`. Endpoint files (`pages/atlas/[board].json.ts` and the like) are outside your ownership. If you prefer them, request them and use data URIs until they are granted. Record the choice.
- File names (plan): `atlas-B3.json`, `atlas-B3.csv`, `atlas-B3.tex`.

### 5.8 Accessibility and layout (7.5, 6.3)

- Headings in order (one `h1` with the board name, an `h2` per item). Matrices are HTML tables with a caption and row and column headers labelled by node (`MatrixView.svelte` rendered on the server, or the same structure in Astro). The A-13 script for release 1.0 reads "the Atlas page of $B_3$" with a screen reader.
- Mathematics typeset at build time (KaTeX through `<Tex>` or `renderTex`, MathML included, A-12). No KaTeX JavaScript is sent.
- A-6 contrast through the theme tokens (CONTRACTS 8). A-11: the page reflows at 320 CSS pixels, and a matrix wider than the column (the $8\times8$ ones) scrolls inside its own box. No horizontal page scroll.
- A-5: negative entries are written with a true minus sign and are never marked by colour alone.
- Every link has a name that says where it goes, for example "Play this board in the Game Board" (plan wording). Never use "click here".
- A-10 ("Every figure has a text alternative, and every tool has a 'show as table' view that presents the same state as an HTML table with a button per node"): the Atlas sheet is already a set of HTML tables and lists, so it needs no separate table view, and it has no node buttons to put in one (plan reading; record it in the decisions fragment). If you draw the board (item 2), the drawing has a text alternative naming the board and its roads, and the adjacency table beside it is its table form. `AtlasPicker.svelte` shows no figure: it is a list of links, which is its own text form (plan reading).
- A-1 on `/tools/atlas` and `/embed/atlas`: the picker is a list of native links, each reachable with Tab and followed with Enter, with no custom key handling and no focus trap. A-2 (visible focus) and A-11 hold there too. The arrow-key and undo rules of A-1 concern boards and do not arise (plan reading).

### 5.9 Rules of 4.0 as they apply to a static sheet

- **Works without JavaScript**: the whole page is HTML. With JavaScript off every section, the switch and the downloads work (T14.spec.ts).
- **Starts meaningful**: the page opens on the data sheet. Nothing needs a click except the switch.
- **Long numbers**: "A value of more than 12 digits is shown shortened ('1.2345... x 10^83', with the number of digits), with the exact digits in the table view, in the tooltip and in every export." This applies to complete games on $A_7$ (14 digits), $D_6$ (13), $B_6$, $C_6$ and $E_6$ (16 each). Show the shortened form with the digit count, the exact digits in `title` and in a visible "exact value" disclosure (`<details>`, plan), and full digits in all three downloads.
- **Stated limits**: the count not offered above 60000 and the 120-root cap are stated in words, never as silent omissions. The words "not of finite type" never appear (every Atlas board is finite).
- **Test hooks** (4.0, adapted to a page with no node buttons): the sheet's root element carries `data-tool="atlas"`. Every value a criterion mentions is an element with `data-out="<name>"`, and the names are listed in a comment block at the top of `T14.spec.ts` and in the registry's `outs`. Each such element also carries `data-exact` (plan), holding the value as JSON in label order, with integers beyond $2^{53}$ as decimal strings, so tests never parse formatted text. Plan names: `cartan`, `cartan-transposed`, `adjacency`, `symmetrizer`, `n-roots`, `n-positive-roots`, `positive-roots`, `highest-root`, `numbers-of-highest-root`, `highest-short-root`, `numbers-of-highest-short-root`, `exponents`, `coxeter-number`, `weyl-order`, `det-cartan`, `minuscule-nodes`, `minus-w0`, `fundamental-orbit-sizes`, `complete-games`, `coxeter-plane-rings`, `affine-name`, `marks`, `comarks`, `real-forms`.
- **History, step, Copy link, SVG/PNG export**: do not apply to a static sheet. There is no state to change, and the page URL is the link (plan reading; record it).
- **Predict**: applies only to "Tools placed in the guided part of a module" that "accept a `prediction` configuration". The Atlas pages are not lesson figures and take no `prediction`. `AtlasPicker.svelte` takes none either (plan reading; record it).
- **One state, derived views**: there is no move list and nothing is recomputed in the browser. The only state object is `defaultState('atlas', T)`, used for the JSON export (5.7) and for the picker route (plan reading).
- **Configuration**: T14 is configured by its board only. The registry entry has no presets (CONTRACTS 6). The picker's only input is `g` (5.10).
- **Growth off the finite types**: does not apply. Every Atlas board is finite, and the sheet grows no set of positions with a `layers` bound; the root list comes from `positiveRoots` (plan reading).
- **Board pickers**: the index page and `AtlasPicker.svelte` offer the 32 named types grouped by letter (5.1, 5.10).
- **Keyboard and screen reader**: the only controls are the radio group of the switch, the links and the `<details>` disclosures, all native elements and so keyboard operable (A-1). Nothing changes the page except the switch, whose state the browser announces, so no live region is needed (plan reading).
- **Small screens**: the page and the picker are usable at 320 CSS pixels (A-11, 5.8). Links and radio controls keep a target of at least 24 by 24 CSS pixels (A-7; 4.0 "never below 24"); there are no node buttons, so the 44-pixel rule for nodes does not arise (plan reading).
- **Test hooks, `data-moves`**: 4.0 puts `data-tool` and `data-moves` on a tool's root element. The Atlas has no moves, so its root element carries `data-tool="atlas"` and `data-moves=""` (plan: empty list), and no element carries `data-node`, `data-board`, `data-value` or `data-can-act`, since there are no node buttons.
- **Cite**: the notes cite with `<Cite>` (5.4, 5.5).
- **Signs**: by numeral, with a true minus sign.

### 5.10 Registry entry and the `/tools/atlas` route (CONTRACTS 5.2, plan)

- `T14.ts` registers `number: 14`, `id: 'atlas'`, `title: 'Atlas'`, `phase: 6`, `boards` = the 32 names, `outs` as in 5.9, and no presets (CONTRACTS 6: "T14 is static pages"). Read `ToolRegistryEntry` and `registry.test.ts` on `main`. If the type requires a `default` preset, give `default: { caption: '...' }` with no state fields and record it.
- `pages/tools/[tool].astro` and `pages/embed/[tool].astro` will render `AtlasPicker.svelte` (you never edit those pages). Keep it small: a list of 32 links grouped by letter, the caption stating what the Atlas is, and, when hydrated with a `g` in the URL that names a board, that board's page link first. It calls no engine function. It stays within the 90 kB budget of a tool route and needs no worker.

### 5.11 Size (7.6, roster)

- "the atlas pages carry no tool JavaScript beyond the shell (15 kB rule for a page with no tool, unless a tool is embedded; record the choice)". Plan: embed no tool. No `client:*` directive anywhere under `pages/atlas/` or `components/atlas/` except inside `AtlasPicker.svelte`'s own route. Record "no tool embedded; 15 kB applies" in the decisions fragment.
- Data URIs and tables add HTML, not JavaScript. Keep the $E_8$ page reasonable: report its HTML size.
- Lab timings (7.6; G6 in 9.1: "sizes and lab timings of section 7.6 on every page"): on the built site with the mobile profile, "Largest Contentful Paint at most 2.5 s, Total Blocking Time at most 200 ms, Cumulative Layout Shift at most 0.1". `GATE` runs them (`npm run lab`), not you. The $E_8$ page, with its large tables and data URIs, is the page most at risk of LCP; report its HTML weight (`buildTiming`) with that in mind, and run `npm run lab` on `/atlas/E8/` once if it is available on `main`.

## 6. Acceptance

Each line: the condition, its source, the test, the gate.

- [ ] Every displayed value that has a golden value equals it, for all 32 types (cartan, adjacency, symmetrizer, n_roots, n_positive_roots, positive_roots, highest roots and numbers, exponents, coxeter_number, weyl_order, det_cartan, minuscule_nodes, minus_w0, fundamental_orbit_sizes, n_reduced_words_w0 where present, coxeter_plane ring sizes and radii, affine marks, comarks and name, real-form names and labels). SPEC 4 T14 acceptance. `atlas.test.ts > golden values, <T>` (data) and `T14.spec.ts > displayed values equal golden on every page` (the built pages, through `data-exact`; plan). G6.
- [ ] Lists of roots for types where `positive_roots` is absent: the count is compared. SPEC 4 T14 acceptance; 5.7 rule 7. `atlas.test.ts > golden values, <T>`. G6.
- [ ] The transposed matrix equals the transpose. SPEC 4 T14 acceptance. `atlas.test.ts > transposed matrix equals the transpose` and `T14.spec.ts > convention switch`. G6.
- [ ] Fields that are absent or `null` (rule 7) are not shown as values: no short-root lines on simply laced types, no ring sizes on $A_1$, no count above 60000. `atlas.test.ts > absent fields`. G6.
- [ ] The B3 page renders without JavaScript with every section. Roster. `T14.spec.ts > B3 without JavaScript`. G6.
- [ ] The convention switch shows $C$ by default and $C^{\mathsf T}$ when chosen, with and without JavaScript, by keyboard. Roster; 2.9. `T14.spec.ts > convention switch`. G6.
- [ ] The downloads produce files: JSON, CSV and LaTeX for every page (T14 "Downloads: JSON, CSV, LaTeX"). The JSON parses and holds the values. The plan checks below rest on plan formats and are marked so: the CSV has the header `item,label,value` and one row per positive root (plan, the CSV format of 5.7); the LaTeX file holds the line that `exportLaTeX('dynkin', ...)` returns for $B_3$ with no black node and the identity `tau`, which by 6.7 should have the form `\dynkin B{ooo}` (plan: assert the string `exportLaTeX` actually returns, read on `main`, not a literal you typed), plus one line per real form (plan). Roster; T14. `T14.spec.ts > downloads`. G6.
- [ ] Every item links to the tool that demonstrates it with the board loaded, and every link decodes with no notice. SPEC 4 T14; 6.6. `atlas.test.ts > tool links decode` and `T14.spec.ts > links`. G6.
- [ ] Values are computed by the engine at build time, with no golden import or `<G>` in the build path. Roster trap. `atlas.test.ts > no golden data in the build path` (plan: scans the source files of `components/atlas/` and `pages/atlas/`). G6.
- [ ] `ATLAS_BOARDS` equals `TYPE_NAMES`, and the index lists 32 links grouped by letter. T14 "one static page per board". `atlas.test.ts > boards` and `T14.spec.ts > index`. G6.
- [ ] The Kac numbering sentence on $E_7$, $E_8$, $G_2$ is inside `<Unverified item="E4">` (the preview build shows the mark linking to open-items). 2.9 [U]; Appendix E item 4. `T14.spec.ts > Kac note wrapped`. G6.
- [ ] The note on Wildberger's names shows the row of 2.10 that applies, and B and C pages say the letters are exchanged for rank at least 3. 2.10; 9.5. `T14.spec.ts > Wildberger note` (on $B_3$, $C_3$, $F_4$, $D_5$, $E_6$, $E_8$). G6.
- [ ] No misprinted list of 2.10 is reproduced (2.10: "Misprints that the site must not reproduce"). The plan shows no list of Wildberger's, so the test asserts that the note data of `atlasData` holds no root list. If you choose to show one, the test instead asserts, for each board, that the list shown has no repeated entry (the $A_4$, $D_5$ and $E_6$ misprints are roots printed "a second time" or "each printed twice") and, mapped back through the translation row of the board, has as many entries as `positiveRoots(board)` and equals it as a set (which also rejects the wrong roots "1211" of "$C_4$" and "12" of "$G_2$"). The page also never shows the misprinted form of Example 8.6 ("$\beta_{41}=60$ and the term $-60p_4p_1$"); the test asserts that string is absent from the source of `components/atlas/`. 2.10; section 5.5. `atlas.test.ts > no misprinted Wildberger list` (plan). G6.
- [ ] D19: the $B_2$ and $C_2$ pages carry their own names and say "$B_2=C_2$". `T14.spec.ts > rank 2 naming`. G6.
- [ ] The $\mathfrak{sp}(2p,2q)$ note appears on $C_n$ pages. 6.5. `T14.spec.ts > sp note`. G6.
- [ ] Long numbers: complete games on $E_6$ are shown shortened with the digit count, with exact digits in `title`, in the disclosure and in the downloads. 4.0. `T14.spec.ts > long numbers`. G6.
- [ ] The Atlas pages ship no tool JavaScript: no `astro-island` element in the HTML, and the route sum is within 15 kB. Roster; 7.6. `T14.spec.ts > no island on atlas pages` and `npm run size` (run by `MERGE` and `GATE`, not by you). G6.
- [ ] Lab timings of 7.6 on every Atlas page (LCP at most 2.5 s, TBT at most 200 ms, CLS at most 0.1), $E_8$ the page to watch. 7.6; 9.1 G6. `npm run lab` (run by `GATE`, not by you; you report the HTML size of `/atlas/E8/`). G6.
- [ ] Axe: no serious or critical violation on `/atlas/B3/`, `/atlas/E8/`, `/atlas/`. 7.7; 9.2. `T14.spec.ts > axe`, plus the full scan of `a11y.spec.ts` at the gate. G6.
- [ ] Reflow at 320 CSS pixels with no horizontal page scroll on `/atlas/E8/` and `/atlas/B8/`. A-11. `T14.spec.ts > 320 px`. G6.
- [ ] Registry entry valid, `/tools/atlas` and `/embed/atlas` render the picker. CONTRACTS 5.2, 6. `T14.spec.ts > tool route` (and `P1-A2`'s `registry.test.ts`, which you run). G6.
- [ ] The picker on `/tools/atlas` is operable from the keyboard: Tab reaches every board link in order with a visible focus ring, and Enter on the $B_3$ link opens `/atlas/B3/`. A-1, A-2. `T14.spec.ts > tool route` (plan: keyboard steps). G6.
- [ ] Definition of done for a tool (9.2: "its acceptance criteria are automated and pass; A-1 to A-12 hold; it obeys every rule of section 4.0 (default state with a caption, rendering without JavaScript, link, undo, reset, export as far as the current phase provides it, test hooks, stated limits); it stays within its size budget; it has a 'show as table' view"). Mapped: acceptance criteria, the T14 lines above; A-1 and A-2, the picker line above and the switch line (keyboard); A-3, A-4, A-7 for nodes, A-8 and A-9 have no subject on a page with no node buttons, no moves and no motion (plan reading, recorded); A-5, A-6, A-11, A-12, 5.8 and the axe and 320 px lines; A-10, 5.8 (the sheet is tables; plan reading, recorded); 4.0, section 5.9 rule by rule (caption: the page's opening sentence stating what the sheet shows, plan; link: the page URL and the tool links; undo and reset: no state to change; export: the three downloads; test hooks: `data-out` and `data-exact`; stated limits: the 60000 sentence and the 120 cap); size budget, the 15 kB line. `decisions/P6-A4.md` lists each plan reading. These automated parts are conditions you must meet; the tests named in the lines above check them. Only the owner's check is not a condition for merging (9.2: "Checked by the owner at the gate, and so no condition for merging: principles P1, P2, P9 and P10 of section 8.1 can be pointed to in it"): the owner checks at G6 that principles P1, P2, P9 and P10 of 8.1 can be pointed to in the Atlas. `not-automated` for that part. G6.
- [ ] A-13 screen-reader reading of the Atlas page of $B_3$. 7.5. `not-automated`: the owner's part of G6, release 1.0.

## 7. Files

- **You own** (the roster's list, exactly):
  - `site/src/pages/atlas/[board].astro, atlas/index.astro`
  - `site/src/components/atlas/*`
  - `site/src/tools/registry/T14.ts`
  - `site/tests/unit/atlas.test.ts, site/tests/e2e/T14.spec.ts`
  - `decisions/P6-A4.md`
- **You may edit with the stated protocol**: `site/src/styles/*` additively, for your own component styles only (README 6). Prefer scoped styles in `components/atlas/`.
- **You must not touch**: everything else. In particular: `reference/`; `DECISIONS.md`; root `package.json` and the lockfile; `site/src/content/unverified.json` (E4 already exists; propose nothing new unless you need another [U] statement); the engine (`packages/engine/`); `scripts/names.mjs` (`P6-A2`'s; request a missing name); `site/src/lib/*` (`export.ts`, `state.ts`, `urlCodec.ts`); `pages/tools/[tool].astro` and `pages/embed/[tool].astro`; `ToolFrame.svelte`; `MatrixView.svelte`; `components/content/*`; the layouts, `Nav.astro`, `Footer.astro` and the released mechanism of `P1-A4`; T13's files (`P6-A3`, same stage); every other test file.

## 8. Order of work

1. Confirm worktree and branch; `npm ci --prefer-offline` if `node_modules` is absent; check Node. Read the inputs of section 3 on `main` (`ToolRegistryEntry`, `exportJSON`, `exportLaTeX`'s data shape, `decodeState`, `Unverified.astro`, `Page.astro`, the released mechanism, `names.json` keys after `npm run build`). If any is missing, report `blocked`.
2. Write `atlas.test.ts` against an `atlasData` stub: golden values for all 32 types, the transpose, absent fields, links decode, boards, no golden in the build path, no misprinted Wildberger list. Watch it fail.
3. Write `atlasData.ts` until the unit test passes. Time `atlasData` for each type (the counts on $E_6$, $B_6$, $C_6$ and the orbit sizes on $E_8$ are the slow ones) and note the build-time cost. Commit (`P6-A4: atlas data from the engine with golden tests`). This is the first usable increment.
4. Write the components and `[board].astro`, `index.astro`; the switch; the notes with `<Unverified>` and `<Cite>`; the downloads. `npx astro check`, `npx svelte-check`, `npm run build`. Commit.
5. `T14.ts` and `AtlasPicker.svelte`; run `registry.test.ts`. Commit.
6. Write `T14.spec.ts` (comment block of `data-out` names first), run it against `astro preview` alone (no other Playwright run of yours at the same time), and kill the preview. Commit.
7. Decisions fragment, report.

## 9. Traps

1. **Golden values printed instead of computed.** "Compute from the engine at build time; do not print golden values (the Atlas is a test of the engine, not a copy of the file)" (roster). No `<G>`, no `resolveGoldenPath`, no JSON import of the golden file in `components/atlas/` or `pages/atlas/`.
2. **Transpose, not renumbering.** "Bourbaki and Humphreys print the transpose (2.9)" with the same node numbering. "Kac numbers E and G differently ([U]: wrap in the note, E4)" (roster). Do not renumber anything for Kac. Only state it, and wrap it.
3. **The affine board of $B_2$.** Build it with `affineExtension(boardFromName(T))`. Do not use `boardFromName(affine[T].name)`. Both $B_2$ and $C_2$ have affine name `C2~`, but `boardFromName('C2~')` has $C_2$'s numbering, with marks `(1,2,1)`, while golden `affine.B2.marks` is `(1,1,2)`. The T15 link uses `constructor_name` (`B2~` for $B_2$).
4. **Positions versus labels (E-7).** `minusW0` returns, for each position, the position of its image; convert each image with `toLabels`. `minusculeNodes` returns positions. The affine vectors are labelled $0..n$ with node 0 first; the finite ones $1..n$. Never add 1 by hand.
5. **`highestShortRoot` returns `null` on simply laced types**, and `coxeter_plane` is absent on $A_1$. Omit those lines. Do not print "null" or call `coxeterPlaneRings` on rank 1.
6. **Counting games.** `countCompleteGames` returns a `bigint`. Guard with `weylOrder(board) <= CAPS.countGamesGroup` and never raise the cap (COMMON 4.5). Five values exceed 12 digits and need the long-number rule. `n_reduced_words_w0` for $E_6$ is 1266633313578528, a safe integer that is still shortened on screen.
7. **`symmetrizer` and `determinant` return `Rational`s.** Print them with `ratText` (`"2"`, not `"2/1"`).
8. **Exponents come from the play from all ones** (`fired` values through `exponentsFromFired`), not from a table. `play` takes the lowest position first (E-5).
9. **Links that fail validation** load the tool's default with a notice, which a reader sees as a broken link. Common causes: `s` without `c`; linking T8 or T6 to a board they do not offer; `t` given as positions; `x` with commas instead of dots. The decode test catches them all.
10. **Rank-2 names (D19).** The page the reader chose keeps its name. "$B_2=C_2$" appears where a name is recognised from the shape (the affine name `C2~` on the $B_2$ page). Never title the $C_2$ page `B2`.
11. **Wildberger's B and C.** On $B_n$ pages with $n\ge3$ his name is "$C_n$", and on $C_n$ pages it is "$B_n$". It is easy to write the row the wrong way round. The 2.10 table has no row for $A_n$ or $E_8$, so invent none.
12. **Real-form names are plain text in data and typeset from `names.json` on screen** (`su*(4)` in data; $\mathfrak{su}^*(4)$, also $\mathfrak{sl}(2,\mathbb H)$, on screen). The $D_4$ catalogue has six records, two of which (`so(2,6)`, `so*(8)`) are the same real form (6.4). List both; do not merge them.
13. **No island by accident.** A Svelte component in an `.astro` page ships JavaScript only with a `client:` directive. `MatrixView.svelte` must be used without one. The convention switch is CSS. One `client:load` would break the 15 kB budget of every Atlas page.
14. **Astro 7 and Svelte 5** postdate your training (COMMON 3): read the installed `getStaticPaths` types and Svelte 5 server rendering before writing. Use `astro build` then `astro preview`, never `astro dev`, for tests.
15. **Base path.** A link written as `/tools/...` breaks under `BASE_PATH=/sub/path/` (the `e2e:basepath` build). Use `import.meta.env.BASE_URL` everywhere, including the links of the index page and of the tool route's picker.
16. **The golden test rules apply in your unit test.** Use the harness helpers (`intEq`, `ringsEq`, `ratText`, `sortedPositiveRoots`), imported by the relative path of section 3; never re-implement a comparison rule. CONTRACTS 3 says both "a golden key is tested in exactly one file" and "every test file calls `covers(...)` with the keys it tests". The `types[*]`, `affine` and `satake` keys are already covered by the engine's golden test files, so the two rules cannot both hold for `atlas.test.ts`. Plan reading (the one `P6-A3` and `P4-A4` also follow): `atlas.test.ts` does not call `covers()`, because the coverage of each key stays with its one engine file; importing the harness registers nothing, only a call to `covers` does. Record this reading in `decisions/P6-A4.md` and report it under `deviations` for MERGE to confirm (section 10). If the harness cannot be imported from `site/tests/unit` (the root Vitest configuration does not resolve it, or importing it writes to `coverage.json`), stop there, do not re-implement a rule, and report it under `requests` to `P0-A2` and MERGE (for example, a site-side re-export of the helpers without `covers`).
17. **Em-dashes** are forbidden in every sentence you put on the page (8.4), including notes and fallbacks.

## 10. Report

The JSON of `COMMON.md` 5.2, with every line of section 6 in `acceptance`. Also include:

- `buildTiming`: the time `atlasData` takes for each of the 32 types and for the whole atlas build, and the HTML size of `/atlas/E8/`.
- `toolLinks`: for one board ($B_3$), the item-to-tool map with the generated URLs.
- `sizeChoice`: "no tool embedded; the 15 kB limit applies" or the alternative chosen.
- `requests`: anything needed from `P1-A4` (released flag for the Atlas pages), `P6-A2` (a missing name in `names.json`), `P6-A5` (the `exportLaTeX` data shape), or endpoint files for downloads if you chose them.
- `deviations`: `atlas.test.ts` not calling `covers()` for the golden keys the engine's files cover, while comparing only through the harness helpers (trap 16). Otherwise none expected; the plan readings of 5.7, 5.9 and 5.10 go in the decisions fragment.
