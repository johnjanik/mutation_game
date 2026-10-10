# P3-A8: Lesson M4: The numbers game and the duality

Phase 3, stage 3.3. Size M. Runs in: a worktree on branch `agent/P3-A8`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

## 1. Objective

When you are done, the lesson page `site/src/content/modules/m4-numbers.mdx` exists, builds, and answers the question of `SPEC.md` 3 M4, "what does the same move look like from the other side?", in seven beats with the figures of its table: the rule of the numbers game on $A_2$ (three moves from $(1,1)$), the prediction on $A_3$ (six moves and the same end whatever the order) with the Numbers Game Lab comparing two games, the linked board with the bridge sentence of 2.4(a), the Kaleidoscope on $A_2$, positions that are not populations ($\tfrac23$ and $\tfrac13$, an orbit of three positions), the pentagon puzzle of the 1986 Olympiad, and the three fates decided by the level. The page follows the anatomy of 8.2, carries at least two predictions and three challenges, writes every golden number with `<G>`, wraps every statement that rests on Appendix E items 2 or 6, and carries the draft mark (D17). It is the module where the second view returns (principle P4) and the start of outcome LO5; with M0 to M3 and M5 it makes up release 0.5. `site/tests/e2e/M4.spec.ts` proves the page against the definition of done of 9.2.

## 2. Read first, in this order

Read in full unless marked "reference".

1. `SPEC.md` 3, the introduction (lines 747 to 751), then M4 in full (lines 845 to 869): the question, the outcomes "(LO1, LO2, start of LO5.)", the seven beats, the figure table (the exact configuration of every figure), the Lie theory sentence and the sources line. The introduction fixes how to read the table: "p" is a start given as a population and "a" a start given as numbers; the configurations "are a starting point for the lesson author and may be refined [D]; the numbers in them are asserted by section 19 of `verify.py` [V]". Read M0 to M3 as reference, to know what the reader has already met (the linked view previewed in M0 beat 4; the frozen population and the boundary boards in M3).
2. `SPEC.md` 2.3 in full: the position, firing, $R_i=I-Ce_ie_i^{\mathsf T}$, legal play ("a node may be fired only when its number is **positive**, and the game ends when no number is positive"), free play, the sign convention paragraph, the Lie theory reading. Beats 1 and 2.
3. `SPEC.md` 2.4 in full, (a) to (e): the translator $a=Cp$, $CS_i=R_iC$ [V], the bridge sentence [D], (b) the transpose, (c) "The games do not coincide" and the index $\det C$, (d) geometry, (e) Wildberger's $q=-Cp$. Beats 3, 4, 5.
4. `SPEC.md` 2.7 F3 and F4 in full, with their provenance. Reference: F5, F6, F10, F11 (what M5 will say; the minuscule orbit of beat 5).
5. `SPEC.md` 2.9, the table rows "This specification", "Wildberger, dual mutation", "Wildberger, the map $\tau$", "Olympiad 1986, Problem 3", "Mozes", "K. Eriksson", "Donnelly", "Gashi, Schedler, Speyer", and the paragraph after the table. Beat 6 quotes the Olympiad in its own convention.
6. `SPEC.md` 2.12 in full, with the fate table, its status paragraph, the pentagon paragraph, and the marks and comarks table. Beats 6 and 7. Reference: 2.6 (the table of what positions are), 2.1 and 2.2 (definitions you use), 2.5 (the invariant form, for beat 4).
7. `SPEC.md` 8.1 to 8.5 in full: the twelve principles, the anatomy of 8.2, the visual language 8.3 (reference), the writing rules 8.4, the patterns 8.5.
8. `SPEC.md` 9.2 ("For a lesson") and 9.3 (own words, cite by key, no [U] as fact, draft mark). Reference: 9.1 row 3 (gate G3 and its owner's part, which includes "Appendix E items 2 and 3" and the reading of M0 to M5), 9.4 (the playtest: question 3 is beat 3's figure, question 4 is beat 2's point).
9. `SPEC.md` Appendix A.1 ($A_2$: the legal game from $(1,1)$ and the translation check), A.2 (the generic game on $A_3$), A.6 (the pentagon). Reference: A.3.
10. `SPEC.md` Appendix E items 2, 6, 11 and 17 (what to wrap, and how to propose an item).
11. `SPEC.md` 4.0 (reference): Starts meaningful; Works before and without JavaScript; Configuration (the `preset` property; `default` is the tool's section 4 state); Predict (the `<details>` fallback); Test hooks. Then the entries of T1, T2, T5, T6 and T15 in section 4 (reference), because you place these five tools.
12. `SPEC.md` 6.6 (state fields, link keys, instance prefixes on lesson pages; the tab of T5 and T15 is not part of a link in schema 1), 7.3 (the four content components, the `<G>` path grammar and output, `<Tex>` with `{{path}}`, `<Unverified>` in preview and release, `<Cite>`, the `released` flag), 7.4 "Without JavaScript", 7.5 A-3 and A-4 (the strings your test reads from the live region), 7.6 (120 kB per lesson; `client:idle` and `client:visible`; lab timings), 7.7 Content row.
13. `SPEC.md` 1.3 (LO1, LO2, LO5), 1.7 (Populations and Numbers; the Mars story and Venus for the dual game), 10 (D5, D7, D8, D14, D17), Appendix C (the site's words, including "position", "fire", "legal play", "level", "frozen population", "the translator $a=Cp$", "fundamental position").
14. `SOURCES.md` 11.2: the entries [IMO86], [Moz90] (not read; what is [S] and what is [S2]), [Eri95b] (read; Definition 1.1), [Don08] (read; Theorem 2.1; $C=M^{\mathsf T}$; fires positive), [GSS12] (read; Theorem 1.2; fires negative), [Pro84] (positive firing predates Mozes, [S2]). `SOURCES.md` 11.1: [W-MS] (pp. 30-32; how to cite it: "unpublished manuscript, undated (circulated c. 2001 to 2004)"; cite [W20] or [W03c] wherever those cover a statement) and [W03c] (section 2: the first published definition of both games; credits the numbers game to Mozes).
15. Oracle functions: none to port. `reference/verify.py` lines 1566 to 1590 (section 19) assert the M4 figure numbers: "on A2 from (1,1) the legal game has 3 moves; on A3 from (1,1,1) it has 6 moves and ends at (-1,-1,-1)"; "on A3 the population (1,1,0) has numbers (1,1,-1)"; "on A2 the position (1,0) is the population (2/3, 1/3), and its orbit has the 3 positions (1,0), (-1,1), (0,-1)". Lines 576 to 606 build `pentagon_example`.
16. Golden keys, through `<G>` and `{{path}}` only (roster: "types.A2/A3.*; pentagon_example through <G>"). Print the shapes before writing, with a script file in your scratch directory (COMMON 4.6), for example one that prints `d['types']['A2']`, `d['types']['A3']`, `d['pentagon_example']` and `d['affine']['A4']`. Expected values: `types.A2`: `cartan` `[[2,-1],[-1,2]]`, `n_positive_roots` 3, `longest_word` `[1,2,1]`, `fired_values` `[1,2,1]`, `det_cartan` 3, `fundamental_orbit_sizes` `[3,3]`, `minuscule_nodes` `[1,2]`, `numbers_of_highest_root` `[1,1]`, `n_reduced_words_w0` 2. `types.A3`: `n_positive_roots` 6, `longest_word` `[1,2,1,3,2,1]`, `fired_values` `[1,2,1,3,2,1]`, `minus_w0` `[3,2,1]`, `det_cartan` 4, `n_reduced_words_w0` 16, `weyl_order` 24. `pentagon_example`: `start_olympiad_convention` `[-1,2,-3,4,-1]`, `start` `[1,-2,3,-4,1]`, `level` -1, `complete_games` 1230, `word_lowest_node_rule` `[1,3,2,1,5,1,2,4,3,2,5,1,4,5]`, `fired` `[1,3,2,1,3,2,1,2,2,1,1,1,1,1]`, `end` `[0,0,0,0,-1]`, `moves` 14. `affine.A4`: `name` `A4~`, `marks` `[1,1,1,1,1]`, `comarks` `[1,1,1,1,1]` (node 0 first). `types.E8.det_cartan`, `types.F4.det_cartan`, `types.G2.det_cartan` are 1.
17. `CONTRACTS.md` 7 in full (frontmatter, imports, lesson components, islands, instance ids, captions, numbers); 5.2 (common tool props, the `Prediction` interface, the registries where presets and `outs` live); 6 (preset ids: T2 `follow`; T5 `compared`; T6 `default`; T15 `pentagon`, `three-fates`; T1 has none); 5.3 (announcement strings and stated limits); 4 (`encodeState`, `decodeState`, prefixes; `highlight`); 1 (aliases); 10.
18. On `main`, before writing: `site/src/content/modules/m0-start.mdx` and `m3-classification.mdx` (the house pattern of a finished lesson), `site/tests/e2e/M0.spec.ts` and `M3.spec.ts` ("M4.spec.ts as before" means this pattern; `m5-weyl.mdx` is written in your stage by `P3-A9` and is not there yet); `site/src/components/tools/T01GameBoard.svelte` with `site/tests/unit/tools/T01.test.ts` and `site/tests/e2e/T01.spec.ts` (exact spellings of `prediction`, `script`, `goal`, `hints`, `panels`, and the `data-out` names); the registries `site/src/tools/registry/T01.ts`, `T02.ts`, `T05.ts`, `T06.ts`, `T15.ts` (presets and `outs`); `site/src/components/lesson/*` and `site/src/content.config.ts`; `decisions/P0-A3.md` (the mathematics route), `decisions/P1-A5.md`, `decisions/P1-A6.md` (the `linkTo` mechanism), `decisions/P2-A4.md` (the `unverifiedMode` prop and the fallback wording of T15), `decisions/P3-A3.md`, `decisions/P3-A4.md`.

## 3. Inputs you depend on

All of these must be on `main` when you start (stage 3.2 merged). If one is missing, stop and report `blocked` for the beat that needs it, build the rest, and say so; do not re-implement a tool or a component.

- From `P1-A5`: `T01GameBoard.svelte` with the three views and the modes of the T1 table, `coords`, `start`, `moves`, `prediction` (board frozen until answered or "show me"; `<details>` without JavaScript), `script`, `goal`, `hints`, `panels`; "step" and "play to the end" in legal play; exact fractions on the populations board in the linked view from numbers; the bridge sentence rendered in the linked view (`data-out="bridgeSentence"`); `gameOver`, `moveCounter`, `mode`.
- From `P1-A6`: `T02OrbitGarden.svelte` with the preset `follow`, `linkTo`, the `orbit` mode for a numbers position (plan property `grows`), the counter `found` and the hidden `total`.
- From `P3-A3`: `T05NumbersGameLab.svelte` with the preset `compared` (`A3` from `(1,1,1)`; game A the lowest-node game, game B preset to the highest-node game `3, 2, 3, 1, 2, 3`; `sortedA`, `sortedB`, `tapesAgree`).
- From `P3-A4`: `T06Kaleidoscope.svelte` with the preset `default` (`A2`, a $=(1,1)$), the readouts `numbers`, `population`, `equation`, and the bridge sentence (`data-out="bridge"`).
- From `P2-A4`: `T15AffinePlayground.svelte` with the presets `pentagon` (the Olympiad form switched on, the example start, the level meter, the switch) and `three-fates` (start editor, level, "play on", `fate`, `fateSentence`, `provenance`), and the `unverifiedMode` prop if `P2-A4` added it.
- From `P1-A4`: `Lesson.astro`, `pages/modules/[slug].astro`, `content.config.ts` (the `modules` collection and its frontmatter schema), the lesson components `Beat`, `Seen`, `LieTheory`, `Challenge`, `ModuleLinks`, `Sources`, `DraftMark`, the glossary page, the sources page, the `released` flag.
- From `P0-A4`: `G`, `Tex`, `Unverified`, `Cite` from `@components/content`; `content/unverified.json` with E1 to E17; the hooks `data-golden`, `data-cite`, `data-unverified`.
- From `P1-A2`: `ToolFrame.svelte` (captions, `data-tool`, `data-moves`, the live region, the `<noscript>` line), the codec with instance prefixes, `site/tests/e2e/nojs.spec.ts`. From `P0-A5`: `site/tests/e2e/a11y.spec.ts`. From `P0-A6`: `scripts/numbers-in-prose.mjs` and the root scripts.
- From `P2-A7`: the rule that a tool calls `classify` once on load (T15 shows the verdict from it).
- From the repository root: `reference/golden_data.json` (read-only, read by `<G>` at build time), `SOURCES.md` (keys `Moz90`, `Eri95b`, `Don08`, `GSS12`, `IMO86`, `W-MS`, `W03c`, `W20`, `Pro84` must exist for `<Cite>`).
- Not needed: the engine directly (the tools and `<G>` call it), T7 and T8 (M5's), the atlas and the sandbox pages beyond what `ModuleLinks` does.

## 4. Deliverables

| File | Contents |
|---|---|
| `site/src/content/modules/m4-numbers.mdx` | The lesson: frontmatter of CONTRACTS 7; the seven beats of SPEC 3 M4 with the figures of its table (sections 5.2 to 5.8 below); at least two predictions and three challenges (5.9); "What we have seen" with provenance (5.10); the Lie theory paragraph (5.11); `ModuleLinks`; sources; the draft mark |
| `site/tests/e2e/M4.spec.ts` | Playwright against the built site, the pattern of `M0.spec.ts` and `M3.spec.ts` plus the M4 checks of section 5.15 |
| `decisions/P3-A8.md` | One dated entry per decision (5.16) |

No other file is yours. A missing tool property or `data-out` goes into your report under `requests` and into the fragment; build with what exists.

## 5. Requirements

### 5.1 Frontmatter, imports, anatomy

- Frontmatter (CONTRACTS 7, plan field names): `title: "The numbers game and the duality"` (SPEC 3 M4 heading), `module: 4`, `question: "What does the same move look like from the other side?"` (SPEC 3 M4), `phase: 3`, `released: true`, `draft: true` (D17: stays true until the owner approves; you never set it to false), `outcomes: ["LO1", "LO2", "LO5"]` (SPEC: "LO1, LO2, start of LO5"), `sources:` every key you cite, at least `["Moz90", "Eri95b", "Don08", "GSS12", "W-MS", "W03c", "IMO86"]`. The schema in `content.config.ts` decides; a field it does not know fails the build.
- Imports: tool components from `@components/tools/...`; `G`, `Tex`, `Unverified`, `Cite` from `@components/content`; the lesson components from P1-A4's barrel (CONTRACTS 7).
- Anatomy, in this order (SPEC 8.2): (1) title and the module's question; (2) a first figure already showing something, with a one-sentence caption (beat 1's T1, section 5.2); (3) the seven beats, "a short paragraph, then a small tool or figure beside or below it. One idea per beat"; (4) "What we have seen" in a framed box with its provenance (`Seen`); (5) "For readers who know Lie theory" (`LieTheory`); (6) "three to five goals, each with a check that reports success" (`Challenge`); (7) links: "the sandbox with this module's board loaded; the Atlas page; the next module" (`ModuleLinks`; "A link whose target has not been released yet is left out by the build"); (8) sources (`Sources`). `DraftMark` renders because `draft: true`.
- Length: "A lesson is between 800 and 1800 words" (8.2). Seven beats in that range leave about 150 words a beat; keep each beat to one or two paragraphs (SPEC 3 introduction).
- Islands (7.6; CONTRACTS 7): the first tool on the page `client:idle`, every other `client:visible`. Instance ids `b1`, `b2`, ... in reading order. Every tool carries a `caption` prop stating the result it demonstrates (P1).
- Plan instance map (adjust if you place more, and say so in the report): `b1` T1 beat 1; `b2` T1 beat 2; `b3` T5 beat 2; `b4` T1 beat 3; `b5` T6 beat 4; `b6` T1 beat 5; `b7` T2 beat 5 (`linkTo="b6"`); `b8` T15 beat 6; `b9` T15 beat 7; challenge instances from `b10`.
- The module's board for `ModuleLinks` (sandbox "with this module's board loaded", 8.2): $A_3$ (plan; the board of beats 2 and 3). Next module: M5 (`m5-weyl`, written in this stage by `P3-A9`); the Atlas is phase 6 and is dropped by the build.

### 5.2 Beat 1: the rule on $A_2$

- Idea (SPEC 3 M4 beat 1): "The rule: a node sends its number down its roads and changes sign. Legal play fires positive numbers. On $A_2$ from $(1,1)$ the game lasts three moves (Appendix A)."
- Figure (row 1): "T1, $A_2$, numbers, legal play, a $=(1,1)$". Props: `board="A2"`, `view="numbers"`, `mode="legal"`, `coords="numbers"`, `start={[1, 1]}`, no moves. First figure of the page: `client:idle`.
- Expected (A.1): firing 1, 2, 1 gives $(-1,2)$, $(1,-2)$, $(-1,-1)$, numbers fired 1, 2, 1, then "game over after 3 moves" (SPEC 4 T1 acceptance; T1 renders `Game over after 3 moves.` in `data-out="gameOver"`). The other order 2, 1, 2 also takes three moves. The A-4 announcement of the first move from $(1,1)$ at node 2 is exactly `Fired node 2. Numbers now 2, minus 1. Move 1.` (SPEC 4 T1 acceptance).
- Prose: the rule in words from 2.3 ("node $i$ sends its number down every road that **leaves** it, then changes sign"), the formula $a_j\mapsto a_j-C_{ji}a_i$, $a_i\mapsto-a_i$ (as `$...$` or `<Tex>` per P0-A3's route), legal and free play defined, and which is active in the figure ("The site offers both and always says which is active", 2.3). Golden numbers: three moves `<G k="types.A2.n_positive_roots"/>`; the word `<G k="types.A2.longest_word" as="word"/>`; the numbers fired `<G k="types.A2.fired_values"/>`. The intermediate positions $(-1,2)$, $(1,-2)$, $(-1,-1)$ have no golden key: typed, listed in `typedNumbers`.
- Credit (8.4): "the numbers game is Mozes', with Proctor's earlier use of the same process and Eriksson's development acknowledged". The sign: "This specification follows Proctor, Donnelly and Wildberger and fires positive numbers" (2.3).

### 5.3 Beat 2: the prediction on $A_3$, then two games compared

- Idea (beat 2): "A prediction on $A_3$ from $(1,1,1)$: 'will a different order of moves give a different ending, or a different number of moves?' The reader plays twice. Six moves, end $(-1,-1,-1)$, every time (F3, F4)."
- Figure (row 2): "T1, $A_3$, numbers, legal play, a $=(1,1,1)$, prediction (a choice); then T5 'two games compared'". T1 props: `board="A3"`, `view="numbers"`, `mode="legal"`, `coords="numbers"`, `start={[1, 1, 1]}`, `prediction` with `answer: { type: 'choice', options: [...], correct: k }` (CONTRACTS 5.2). Plan options: "same end, same number of moves"; "same end, a different number of moves"; "a different end". Correct: the first. The reveal states six moves and the end $(-1,-1,-1)$ every time, citing F3 and F4 in words. Then T5 `preset="compared"` (`A3`, `(1,1,1)`; game A `1, 2, 1, 3, 2, 1`, game B `3, 2, 3, 1, 2, 3`; the sorted tapes `1, 1, 1, 2, 2, 3` agree). Both `client:visible`.
- 4.0 Predict: "The board is frozen until the reader has answered or pressed 'show me'. Without JavaScript the question is followed by a `<details>` element holding the answer and the reveal." The answer is "computed by the engine" (4.0): use T1's mechanism on `main` for checking it (see `decisions/P1-A5.md`).
- Prose: F3, quoted for content: "From any start, any two legal plays of the numbers game end at the same position after the same number of moves, and fire the same multiset of numbers." F4: "From $\rho$, or from any start with all numbers positive, every legal play has exactly $N$ moves and ends at $w_0$ applied to the start: the negatives of the starting numbers, permuted by $-w_0$. From $\rho$ the end is $-\rho$." Write these in the site's words for the primary reader (no $w_0$ before M5; plan: "the end is the start with every sign changed and the nodes read in reverse order" for $A_3$, where $-w_0$ is `<G k="types.A3.minus_w0"/>`). The T5 caption says the tapes agree after sorting, not in order (F3; roster trap of T5).
- Golden numbers: six moves `<G k="types.A3.n_positive_roots"/>`; the word `<G k="types.A3.longest_word" as="word"/>`; the fired numbers `<G k="types.A3.fired_values"/>`; if you say how many different complete games there are, `<G k="types.A3.n_reduced_words_w0"/>` (16; a preview of M5, optional). The end $(-1,-1,-1)$ has no golden key (typed; asserted by `verify.py` section 19).
- Provenance: F3 "The definition is [Eri95b] Definition 1.1; the theorem is attributed to Mozes and Eriksson [S2]; [Don08] Theorem 2.1 [S]". F4 "Checked from $\rho$ and from six random all-positive starts on every type": verified by computation for every type of rank at most 8. The attribution to Mozes is [S2] through Donnelly; see 5.10 for what must be wrapped (E2).

### 5.4 Beat 3: the linked board and the bridge sentence

- Idea (beat 3): "The linked board (T1): populations above, numbers below, joined by $a=Cp$. The sentence of section 2.4(a). The reader verifies it on three moves."
- Figure (row 3): "T1, $A_3$, linked, free play, p $=(1,1,0)$, which shows the numbers $(1,1,-1)$". Props: `board="A3"`, `view="linked"`, `mode="free"`, `coords="populations"`, `start={[1, 1, 0]}`. Expected: populations board `data-value` 1, 1, 0 and numbers board 1, 1, -1 (`data-board` tells them apart). This is the playtest's question 3 (9.4: "On the path with three cities the population is $(1,1,0)$. What numbers does the other view show?" Expected $(1,1,-1)$).
- "The reader verifies it on three moves" (plan): a sentence asking the reader to make three moves and check after each that the number on a node equals the drop of its city; optional `script` of three moves with captions (P7, a worked play-through). Any script must keep `mode="free"`.
- The bridge sentence, exactly as SPEC 2.4(a) prints it and marks [D]: **The number on node $i$ is the amount by which a mutation would lower city $i$.** "This sentence is the bridge between the two views and must appear, with the same wording, wherever the two views are shown together [D]." T1 renders it in the linked view (`data-out="bridgeSentence"`, text content `The number on node i is the amount by which a mutation would lower city i.`). Put it also in the beat 3 prose, word for word, with $i$ in both places. Add the next sentence of 2.4(a) in your own words: a positive number marks a mutation that lowers, zero one that changes nothing, a negative number one that raises.
- The formula: $a=Cp$, $a_i = 2p_i - \sum_{j\ne i}A_{ji}p_j$, "a mutation at $i$ replaces $p_i$ by $p_i - a_i$"; $CS_i=R_iC$ [V] (verified by computation). D7 default: $a=Cp$, "the drop"; never present Wildberger's $q=-Cp$ as the site's convention. If you mention it (2.4(e)): "his dual population records the gain, this specification records the drop", [W-MS] Proposition 0.3, pp. 31-32 [S]; Venus for the dual game with credit (1.7; D5; [W-MS] p. 30).
- Names (P8): "Populations" and "Numbers" capitalised when naming a view; the accent colours and icons are the components' (8.3).

### 5.5 Beat 4: the kaleidoscope

- Idea (beat 4): "The kaleidoscope (T6) on $A_2$: two mirrors, a point, its two sets of coordinates. Firing is reflecting."
- Figure (row 4): "T6 on $A_2$, point at a $=(1,1)$". Props: `preset="default"` (CONTRACTS 6: "`default` (point at $a=(1,1)$)"), `client:visible`. Expected: numbers `1,1`, population `1,1` (on $A_2$, $C^{-1}(1,1)=(1,1)$); firing node 1 gives numbers $(-1,2)$ and population $(0,1)$, the change $-a_1e_1$ (SPEC 4 T6).
- Prose from 2.4(d): "a population lists coordinates along the normals and a position lists scaled distances to the mirrors. One reflection, recorded two ways." $a_i = \frac{2}{|\alpha_i|}\times$ (signed distance from the point to mirror $i$). "The Cartan matrix is the matrix of pairings between normals and mirrors, which is why it is the translator." T6 shows both readouts together, so it renders the bridge sentence (`data-out="bridge"`); your prose need not repeat it here.
- Do not introduce lengths of roots beyond $A_2$ (P4: multiple roads arrive in M6).

### 5.6 Beat 5: positions that are not populations

- Idea (beat 5): "Not every position is a population: on $A_2$ the position $(1,0)$ would need $\tfrac23$ and $\tfrac13$ of a Martian. The numbers game has $\det C$ times as many positions (section 2.4(c)). The orbit of $(1,0)$ has three positions and every number in it is $-1$, 0 or 1: a first minuscule orbit."
- Figure (row 5): "T1, $A_2$, linked, a $=(1,0)$: the populations board shows $\tfrac23,\tfrac13$; T2 'follow' mode beside it (3 positions)". T1 props: `board="A2"`, `view="linked"`, `coords="numbers"`, `start={[1, 0]}`, `mode="free"` (plan: the table names no mode; free lets the reader visit all three positions in any order; record it). T2 props: `preset="follow"`, `linkTo="b6"`, and the orbit of a numbers position (P1-A6's plan property `grows="orbit"`; the `follow` preset infers it "when the followed game is numbers", but pass it explicitly if the property exists). Expected: populations board `data-value` `2/3` and `1/3` (SPEC 4 T1 acceptance; `ratToString`); the orbit is $(1,0)$, $(-1,1)$, $(0,-1)$ (`verify.py` section 19); T2 shows 1 position at load (`found`) and 3 when every position has been visited or when the total is revealed (`total`).
- The `populations` view is not allowed here: "the `populations` view with `coords: numbers` is allowed only when $C^{-1}a$ is integral (otherwise the tool falls back to `linked`)" (SPEC 4 T1). Use `linked`.
- Prose from 2.4(c): over the integers $C$ maps $\mathbb Z^n$ onto a sublattice of index $\det C$; populations fill the root lattice, positions fill the weight lattice, and the quotient has $\det C$ elements; on $A_2$ $\det C=$ `<G k="types.A2.det_cartan"/>`; "On $E_8$, $F_4$ and $G_2$, where $\det C=1$, every position of the numbers game is the translation of exactly one integer population [V]" (optional; `types.E8.det_cartan`). The denominators of $C^{-1}a$ divide $\det C$ (2.6). Orbit size: `<G k="types.A2.fundamental_orbit_sizes[0]"/>`. The word "minuscule" for this orbit: F11 definition [V]; nodes of $A_2$ `<G k="types.A2.minuscule_nodes"/>` if you name them. The fractions $\tfrac23$, $\tfrac13$ have no golden key (typed).
- The roster trap: "'The numbers game has det C times as many positions' is exact; P/Q has det C elements (2.4(c))." Both sets are infinite; write it as the index of one lattice in the other, or as "for every population there are $\det C$ kinds of position", never as a comparison of two finite counts.

### 5.7 Beat 6: the pentagon

- Idea (beat 6): "Where the game came from: the pentagon problem of the 1986 Olympiad, as a puzzle to try now."
- Figure (row 6): "T15 'pentagon', in the Olympiad's convention, with the example start of section 2.12". Props: `preset="pentagon"` (CONTRACTS 6). Expected: the Olympiad form shows `-1, 2, -3, 4, -1` on nodes 1 to 5 (`data-value` carries the value shown, per P2-A4), level $-1$ (`data-out="level"`), Olympiad sum 1 (`data-out="sum"`); "play on" reports `ended after 14 moves` (`data-out="fate"`).
- Prose: the puzzle in the site's own words (never the Olympiad's text; 7.9, 8.4): five integers with positive sum on a pentagon; a negative number is flipped and added to both neighbours; must the process stop? ([IMO86] [S]). "The Olympiad problem prescribes no particular numbers. The site's example start is $(-1,2,-3,4,-1)$ in the Olympiad's convention, which is $(1,-2,3,-4,1)$ in this specification's convention; it ends after 14 moves whatever the order of play [V: all 1230 complete games were enumerated; golden key `pentagon_example`]." Write the start with `<G k="pentagon_example.start_olympiad_convention"/>` and `<G k="pentagon_example.start"/>`, the 14 with `<G k="pentagon_example.moves"/>`, the 1230 with `<G k="pentagon_example.complete_games"/>`, the level with `<G k="pentagon_example.level"/>`.
- State the convention when quoting (8.4; roster trap): the Olympiad fires negative numbers; the site fires positive; "negating every number translates one convention into the other because each firing is linear" (2.3); the translation is $a=-x$ on the 5-cycle (2.9). "'the sum is positive' in the Olympiad's convention is 'the level is negative' here" (2.12). D8: the original convention appears only in T15; elsewhere it is explained, not offered.
- Do not name the proposer of the problem (Appendix E item 11, [U]). The link between the puzzle and Mozes' paper is E2 (5.10).

### 5.8 Beat 7: the level and the three fates

- Idea (beat 7): "Why the pentagon game ends, and when such a game does not: on the boundary boards of M3 a weighted sum of the numbers, the **level**, never changes, and its sign decides between three fates (section 2.12)."
- Figure (row 7): "T15 'three fates' on the pentagon: the reader changes one number and watches the level meter and the outcome". Props: `preset="three-fates"` (P2-A4's default board is the pentagon with the example start; pass `board="pentagon"` if the preset does not fix it). Pass `unverifiedMode` as P2-A4 requested (`unverifiedMode={isReleaseBuild() ? 'fallback' : 'marked'}` from `@lib/unverifiedRegistry`, plan), if the prop exists on `main`; it matters when the reader picks a board with multiple roads.
- Definitions (2.12): comarks $c$ with $c^{\mathsf T}C=0$; the level $\ell(a)=\sum_i c_ia_i$ "of a position is unchanged by every firing" [V]. On the pentagon all marks and comarks are 1 (`<G k="affine.A4.comarks"/>`, node 0 first on $\tilde A_4$; the pentagon is $\tilde A_4$ [V]), so the level is the plain sum. Link "boundary boards" and "frozen population" to M3's terms through the glossary.
- The fate table, quoted exactly (2.12): $\ell(a)<0$ "every legal play ends, after the same number of moves, at the same position"; $\ell(a)=0$, $a\ne0$ "the game never ends and visits only finitely many positions (it loops)"; $\ell(a)>0$ "the game never ends and the numbers grow without bound". T15's reports are `ended after k moves`, `returned to an earlier position after k moves`, `still running after 20000 moves` (SPEC 4 T15; CONTRACTS 5.3).
- Provenance: "for simply laced affine boards this is [GSS12] Theorem 1.2, credited to Eriksson, with the signs reversed because they fire negative numbers [S]". The pentagon, the cycles and the star with four arms of M3 are simple graphs, so the table stated for them carries [GSS12] with the convention stated. Any sentence that extends the table to boards with multiple roads or to twisted boards rests on Appendix E item 6 and is wrapped: `<Unverified item="E6" fallback="...">`. Plan fallback: "On boards with multiple roads the same table was computed on every affine board the site offers, and an argument for it is given beside it." (2.12: "until Appendix E item 6 is settled, the site words it for those boards as computed, with this argument beside it"). Do not cite Kac for the Tits cone (2.12 marks it [U], Appendix E item 4); if you give the argument, give its first step only, with [Don08] Theorem 2.15 [S] ("attributed there to Eriksson").
- "Play detects two of the three fates exactly: a game that has ended, and a position that has come back. That a game of positive level never ends cannot be seen by playing" (2.12). Say this in the prose, so that the reader does not take "still running after 20000 moves" for a proof.

### 5.9 Predictions and challenges

- 9.2: for M0 to M9 "at least two predictions and three challenges, which the drafter adds from the patterns of section 8.5 wherever section 3 names fewer". SPEC 3 M4 names one prediction (beat 2) and no challenge, so add at least one prediction and at least three challenges.
- Plan prediction (pick one or more; the mathematics of each is in section 2 or Appendix A): "Predict a number" on beat 1: "nodes 1 and 2 both hold 1; fire node 1; what will node 2 hold?" Answer 2 (A.1). "Predict a yes or no" on beat 6: "will the pentagon game stop, whatever order you fire in?" Answer yes. "Predict a number" on beat 5: "how many different positions can the numbers game reach from $(1,0)$ on $A_2$?" Answer from `types.A2.fundamental_orbit_sizes[0]`. Each is a `prediction` on the beat's tool, answer computed by the engine (4.0), with a `<details>` fallback.
- Plan challenges (each a `Challenge` with a check over a tool instance's state that reports success, CONTRACTS 7; 8.2 item 6): (1) "Reach a target": on $A_3$ in legal play from $(1,1,1)$, end the game in a different order from the lowest-node one (check: game over, end all minus ones, word not equal to `types.A3.longest_word`); (2) "Find" (8.5 "Classify" or "Find a counterexample" pattern): on $A_2$ find a position other than $(0,0)$ whose population is whole (check: every `data-value` on the populations board integral; the reader may discover $a_1\equiv a_2 \pmod 3$); (3) "Reach a target" on the pentagon: find a start that loops (check: T15 `fate` reports `returned to an earlier position`); (4) optional, the same for "still running" (positive level). Every number in a goal that has a golden value is written with `<G>`.
- Each challenge's check reports success exactly when its goal is met (9.2); without JavaScript the goal shows with its explanation in `<details>` (P1-A4's component).

### 5.10 "What we have seen", provenance, [U]

- `Seen` (8.2 item 4) with provenance per statement (a citation key through `Cite`, or the words "verified by computation"). Statements and provenance:
  - the rule of the numbers game and of legal play: definitions (2.3); the first published definition of both games is [W03c] section 2 [S];
  - F3: [Don08] Theorem 2.1 [S]; the definition of strong convergence [Eri95b] Definition 1.1 [S]; "attributed to Mozes and Eriksson [S2]";
  - F4: verified by computation for every type of rank at most 8;
  - $CS_i=R_iC$ and the bridge sentence: verified by computation (2.4(a) [V]);
  - the index $\det C$ and the $\det C$ classes of positions: 2.4(c) ([V] for $E_8$, $F_4$, $G_2$);
  - the level is unchanged by every firing: verified by computation (2.12 [V]); the fate table on simple graphs: [GSS12] Theorem 1.2 [S], signs reversed, credited to Eriksson; elsewhere wrapped E6.
- 8.4: "'Verified by computation for all boards of rank at most 8' is an acceptable provenance and must not be dressed up as a citation." Credit: "the numbers game is Mozes', with Proctor's earlier use of the same process and Eriksson's development acknowledged" ([Pro84] [S2] through [Don08]).
- Appendix E item 2 (Mozes' paper, not read; roster trap). Wrap in `<Unverified item="E2" fallback="...">` every sentence that reports what [Moz90] itself contains: its sign or matrix convention, its theorem numbers, whether its introduction mentions the Olympiad problem, whether it uses the words "numbers game", what it proves. The fallback names the later sources that report it, which stays true however the item turns out; plan example: wrapped "Mozes introduced the game in 1990 as a generalisation of the pentagon puzzle, firing negative numbers." with fallback "Later authors, Donnelly among them, describe Mozes' game of 1990 as a generalisation of the pentagon puzzle." The bare credit "the numbers game is Mozes'" (8.4) is not wrapped. [S2] statements are cited, not wrapped (0.3); only what rests on an open item is wrapped.
- Appendix E item 6: section 5.8. Item 11: do not name the proposer. Any other [U] statement (none is needed for M4) is wrapped with the next free number `E18`, ... and listed under `proposedUnverifiedItems` (Appendix E item 17; README 3.2). Never edit `content/unverified.json`.
- No sentence is copied from [Moz90], [Eri95b], [Don08], [GSS12], [W-MS], [W03c] or the Olympiad's sheet (8.4; 9.3; COMMON 4.4). Reusing SPEC's wording of the bridge sentence and of the fate table is required, not copying.

### 5.11 For readers who know Lie theory

One paragraph (`LieTheory`), the standard names once (8.4), from SPEC 3 M4 and 2.3: "positions are weights in fundamental-weight coordinates, legal play descends from the dominant chamber, and $P/Q$ is the fundamental group of the adjoint group"; the numbers are the Dynkin labels $a_i=\langle\lambda,\alpha_i^\vee\rangle$; firing is $s_i\lambda=\lambda-a_i\alpha_i$ in fundamental-weight coordinates "because $\alpha_i=\sum_j C_{ji}\,\omega_j$"; legal play "moves from the dominant chamber towards the antidominant one"; $a=Cp$ is $\lambda\mapsto(\langle\lambda,\alpha_i^\vee\rangle)_i$ (Appendix C); the level is $\langle\lambda,K\rangle$ with the comarks (Appendix C). State the convention when you name another source's matrix: Donnelly's $M$ is $C^{\mathsf T}$, Gashi, Schedler and Speyer's $c$ is $C^{\mathsf T}$ and fire negative (2.9). Bourbaki prints the transpose of $C$ (2.9).

### 5.12 Writing rules and principles

- 8.4 in full: plain declarative sentences; define every term on first use and link later uses to the glossary (Appendix C seeds it); the site's words (board, node or city, road, population, numbers, position, mutate, fire, legal, free play, level); the standard term once, in the Lie theory paragraph; state the convention when quoting a source that uses another one; every theorem-like statement with its provenance; numbers with a golden value through `<G>`; accurate credit; house style: no em-dashes anywhere (prose, captions, alt text, prediction texts, challenge goals, comments, the fragment), "no stock rhetorical contrasts or fashionable filler words; the specific in place of the grand"; no copied sentence.
- P8: "Node $i$ is always called 'node $i$' or 'city $i$', never both in one sentence." The bridge sentence of 2.4(a) is the one exception: it is fixed [D] and quoted verbatim.
- P1 and P2: every figure has a caption stating its result, and the prose states every result the argument needs (six moves, the same end, $(1,1,-1)$, $\tfrac23$ and $\tfrac13$, three positions, 14 moves, the three fates); nothing sits only behind a click. P3: open on $A_2$ and $A_3$; generalise after. P4: the Numbers view returns here; no multiple roads, no geometry beyond $A_2$. P5: predictions before reveals. P6: challenges after the beats, the sandbox link last. P7: beat 1 as a worked play, beat 2 half guided, the challenges free. P9: no autoplay; "Neither control acts by itself on page load" (4.0). P10 and P11 are the tools' job.

### 5.13 Numbers, `<G>`, `<Tex>`

- Every number with a golden value through `<G k="..."/>` in prose and `{{path}}` inside `<Tex src="..."/>` (7.3; 8.4; COMMON 4.4). Paths named in 5.2 to 5.8: `types.A2.n_positive_roots`, `types.A2.longest_word`, `types.A2.fired_values`, `types.A2.det_cartan`, `types.A2.fundamental_orbit_sizes[0]`, `types.A2.minuscule_nodes`, `types.A3.n_positive_roots`, `types.A3.longest_word`, `types.A3.fired_values`, `types.A3.minus_w0`, `types.A3.n_reduced_words_w0`, `pentagon_example.start_olympiad_convention`, `pentagon_example.start`, `pentagon_example.level`, `pentagon_example.moves`, `pentagon_example.complete_games`, `pentagon_example.word_lowest_node_rule`, `pentagon_example.fired`, `pentagon_example.end`, `affine.A4.marks`, `affine.A4.comarks`, optionally `types.E8.det_cartan`. Output rules (7.3): integers with a true minus sign; a list in round brackets with commas; `as="word"` labels separated by thin spaces; `as="count"` the length; `as="plain"` without grouping or brackets.
- Numbers with no golden value may be typed and are listed by `scripts/numbers-in-prose.mjs` for review: the positions of A.1 and A.2 along the plays, $(-1,-1)$, $(-1,-1,-1)$, $(1,1,0)$, $(1,1,-1)$, $(1,0)$, $(-1,1)$, $(0,-1)$, $\tfrac23$, $\tfrac13$, the starts of the figures, the year 1986 (and 1990 if used), the entries $2$ and $-1$ of a Cartan matrix written as a matrix. Prefer `<G>` wherever a key exists; record every typed number in `typedNumbers`.
- `<Tex>`: follow P0-A3's route; a formula containing a golden value always goes through `<Tex>` with `{{path}}`. `{{` is also legal TeX: write `\frac{ {a} }{b}` with spaces where a double brace is not a path (P0-A4's trap).

### 5.14 Links, sources, draft mark

- `ModuleLinks`: sandbox with $A_3$ (plan), Atlas, next module M5; omitted automatically when unreleased (7.3). Do not hand-write these links, and do not link M5 or the Atlas in prose.
- `Sources` for the module (SPEC 3 M4): "[Moz90] (not read; see `SOURCES.md`), [Eri95b], [Don08], [GSS12], [W-MS] pp. 30-32, [W03c] section 2", plus [IMO86] (its SOURCES role: "a puzzle in module M4"), [Pro84] if credited, [W20] if cited. Every key through `<Cite>`; an undefined key fails the build. Cite [W-MS] as SOURCES 11.1 says, never with a year.
- `DraftMark` renders because `draft: true` (D17). The owner approves the text of M0 to M5 at G3 (9.1).

### 5.15 Tests: `site/tests/e2e/M4.spec.ts`

"As before" means the pattern of `M0.spec.ts` and `M3.spec.ts` on `main`: against `astro build` then `astro preview`, reading only `data-*` hooks, the live region and the page text; one Playwright run at a time (COMMON 4.5). A comment block at the top lists every `data-out` and `data-control` name used, with the registry file each comes from. Expected values come from the golden file (read it in the test) or from SPEC Appendix A, never from the page itself. Tests (plan names):

1. `without JavaScript the seven figures are present`: JavaScript disabled, `/modules/m4-numbers` has the prose, every tool instance (plan: four `data-tool="board"`, one `numbers`, one `mirror`, one `garden`, two `affine`, plus challenge instances), every caption, controls `disabled`, the `<noscript>` line, the populations board of `b6` showing `2/3` and `1/3`, the numbers board of `b4` showing `1`, `1`, `-1`.
2. `every prediction has a details fallback` (JavaScript off; at least two) and `a prediction freezes the board until answered` (JavaScript on: `data-can-act="false"` on `b2` until an answer or "show me").
3. `word count between 800 and 1800` (the article's prose, not the tools' tables or live regions).
4. `no em-dash in the built text` (no U+2014; by house style no U+2013 in prose).
5. `numbers-in-prose report lists only the allowed numbers` of 5.13.
6. `bridge sentence`: the prose of beat 3 contains "The number on node", "is the amount by which a mutation would lower city" with the same wording as 2.4(a); `b4` and `b6` each render `data-out="bridgeSentence"` with exactly `The number on node i is the amount by which a mutation would lower city i.`; `b5` renders T6's `data-out="bridge"` with the same text.
7. `beat 1 plays three moves on A2`: on `b1` press nodes 1, 2, 1; `data-value` goes $(-1,2)$, $(1,-2)$, $(-1,-1)$; `data-out="gameOver"` reads "Game over after 3 moves" (case-insensitive) with 3 from `types.A2.n_positive_roots`; after a reset, firing node 2 announces `Fired node 2. Numbers now 2, minus 1. Move 1.` in the live region.
8. `beat 2 ends after six moves in any order`: answer the prediction, play to the end on `b2`, `data-moves` equals `types.A3.n_positive_roots`, every value $-1$; on `b3` `sortedA` equals `sortedB` and `tapesAgree` is present.
9. `beat 3 shows (1,1,-1) and keeps a = Cp`: three moves on `b4`; after each, the numbers read equal $C$ times the populations read, with $C$ from `types.A3.cartan`.
10. `beat 4 kaleidoscope`: `b5` `numbers` reads `1,1` and `population` `1,1`; firing node 1 gives numbers `-1,2` and population `0,1`.
11. `beat 5 orbit of three`: on `b6` visit the three positions (fire node 1, then node 2); `b7` `found` reads `types.A2.fundamental_orbit_sizes[0]`; every value seen on the numbers board is $-1$, 0 or 1.
12. `beat 6 pentagon`: `b8` shows `pentagon_example.start_olympiad_convention` as values, `level` $-1$; "play on" gives `ended after` with `pentagon_example.moves`.
13. `beat 7 three fates`: on `b9` change one entry so that the level is 0 with a nonzero position; `fate` reads `returned to an earlier position after`; `fateSentence` reads the level-zero row.
14. `anatomy`: in order, title and question, beats, `Seen` with a provenance per statement, the Lie theory paragraph, at least three challenges, links, sources, draft mark (the layout's hooks on `main`).
15. `wrapped items`: in the preview build at least one `data-unverified="E2"` exists if any sentence about Mozes' text is wrapped, and every sentence that names Mozes with a convention or a theorem number lies inside such a span (assert on your own distinctive phrases).
16. `challenge: <goal>`, one per challenge: reach the goal through the hooks and read the success message; assert it is absent before.

Each test must fail when the behaviour it guards is removed (COMMON 4.3): for example, test 6 fails if one word of the beat 3 sentence is changed; test 11 fails if `b7` follows nothing.

### 5.16 Decisions fragment

`decisions/P3-A8.md`, one dated entry each (COMMON 5.1): every [D] of the figure table made concrete (the mode of row 5, the prediction options of row 2, any script in beat 3, the sandbox board); the defaults relied on (D5, D7, D8, D14, D17, D19 if $B_2$ is named); the predictions and challenges added, each with its 8.5 pattern; every `<Unverified>` used with its fallback; every typed number with its reason; any deviation or request.

## 6. Acceptance

Each line: the condition, its source, the test, the gate. "Owner" marks what 9.2 assigns to the owner; it is `not-automated` in the report with the gate named.

- [ ] Follows the anatomy of 8.2 in order. SPEC 9.2; 8.2. `M4.spec.ts > anatomy`. G3.
- [ ] Reads completely without JavaScript: prose, every figure, captions, tables, disabled controls, noscript line. SPEC 9.2; 7.4; 4.0. `nojs.spec.ts` (P1-A2) on `/modules/m4-numbers`; `M4.spec.ts > without JavaScript the seven figures are present`. G3 "no-JavaScript run".
- [ ] Every statement has a provenance; everything resting on an open item is wrapped in `<Unverified>` with a fallback (E2 for Mozes' text, E6 beyond simple graphs). SPEC 9.2; 8.4; 9.3; roster trap. `M4.spec.ts > anatomy`, `> wrapped items`; RT-08 and RT-09 read the text; owner at G3 (Appendix E item 2 is due at G3). Partly automated; say so.
- [ ] Every number with a golden value through `<G>` or `{{path}}`; the numbers-in-prose report for the file lists only the allowed numbers. SPEC 9.2; 8.4; 7.7 Content row. `M4.spec.ts > numbers-in-prose report lists only the allowed numbers`; the build fails on a bad path. Every merge.
- [ ] At least two predictions and three challenges from 8.5. SPEC 9.2. `M4.spec.ts > every prediction has a details fallback`, `> anatomy`, `> a prediction freezes the board until answered`. G3.
- [ ] Each challenge's check reports success exactly when its goal is met. SPEC 8.2 item 6; 9.2. `M4.spec.ts > challenge: <goal>` (one per challenge). G3.
- [ ] Writing rules of 8.4: no em-dash (automated); own words, site's terms, conventions stated, credit (RT-08; owner). SPEC 9.2; 8.4. `M4.spec.ts > no em-dash in the built text`. Every merge; owner at G3.
- [ ] Between 800 and 1800 words. SPEC 8.2. `M4.spec.ts > word count between 800 and 1800`. G3.
- [ ] Draft mark present (`draft: true`). SPEC 9.2; D17. `M4.spec.ts > anatomy`. G3.
- [ ] First tool `client:idle`, the others `client:visible`; ids `b1`, `b2`, ... in reading order; every tool has a caption. CONTRACTS 7; SPEC 7.6; P1. `M4.spec.ts > without JavaScript ...` (captions); RT-07 for directives. G3.
- [ ] The bridge sentence of 2.4(a) appears with the same wording where the linked view is shown (roster acceptance; SPEC 2.4(a) [D]). `M4.spec.ts > bridge sentence`. G3.
- [ ] Row 1: T1 $A_2$ numbers legal a $=(1,1)$; three moves, game over. SPEC 3 M4; A.1; 4 T1. `M4.spec.ts > beat 1 plays three moves on A2`. G3.
- [ ] Row 2: T1 $A_3$ numbers legal a $=(1,1,1)$ with a choice prediction, then T5 `compared`; six moves, end $(-1,-1,-1)$, sorted tapes agree. SPEC 3 M4; F3; F4. `M4.spec.ts > beat 2 ends after six moves in any order`. G3.
- [ ] Row 3: T1 $A_3$ linked free p $=(1,1,0)$ showing $(1,1,-1)$. SPEC 3 M4; 9.4 question 3. `M4.spec.ts > beat 3 shows (1,1,-1) and keeps a = Cp`. G3.
- [ ] Row 4: T6 `default` on $A_2$ at a $=(1,1)$. SPEC 3 M4; 4 T6. `M4.spec.ts > beat 4 kaleidoscope`. G3.
- [ ] Row 5: T1 $A_2$ linked a $=(1,0)$ showing $\tfrac23$, $\tfrac13$; T2 `follow` with 3 positions. SPEC 3 M4; 4 T1 acceptance; 2.4(c). `M4.spec.ts > beat 5 orbit of three`. G3.
- [ ] Row 6: T15 `pentagon` in the Olympiad's convention with the example start; convention stated. SPEC 3 M4; 2.12; A.6; 8.4. `M4.spec.ts > beat 6 pentagon`. G3.
- [ ] Row 7: T15 `three-fates` on the pentagon; the level meter and the outcome change with one number. SPEC 3 M4; 2.12. `M4.spec.ts > beat 7 three fates`. G3.
- [ ] axe: no serious or critical violations on `/modules/m4-numbers`. SPEC 7.7. `a11y.spec.ts` (P0-A5), run by `MERGE`/`GATE`. G3.
- [ ] Size: at most 120 kB JavaScript before interaction at 360 by 800. SPEC 7.6. `npm run size`, run by `MERGE`/`GATE`. G3.
- [ ] Lab timings on M4 (LCP at most 2.5 s, TBT at most 200 ms, CLS at most 0.1). SPEC 7.6; 9.1 G3 ("sizes and lab timings ... on the core path M0 to M5"). `npm run lab`, run by `GATE`. G3.
- [ ] `npm run build` and `RELEASE=1 npm run build` succeed; the release build's open-items report lists this page under E2 and E6 if used. SPEC 7.3; 7.7; 9.1 G3. Command summaries in the report. Every merge.
- [ ] Type checks pass (`npx astro check`, the configured typecheck). COMMON 4.3. Command summaries. Every merge.
- [ ] Owner: P3 to P8 can be pointed to; read aloud once; approval of the text (D17); Appendix E item 2. SPEC 9.2; 9.1 G3. `not-automated`, gate G3.

## 7. Files

- **You own** (the roster's list, exactly):
  - `site/src/content/modules/m4-numbers.mdx`
  - `site/tests/e2e/M4.spec.ts`
  - `decisions/P3-A8.md`
- **You may edit with the stated protocol**: nothing else. New unverified items are proposed in the report and added by `MERGE` (README 3.2). Requests for a tool property or `data-out` go into `requests` and the fragment.
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, root `package.json` and the lockfile, `site/package.json`, `content/unverified.json`, the components, registries and tests of T1, T2, T5, T6, T15, the lesson components and layouts of P1-A4, the other lessons (`m0` to `m3`, and `m5-weyl.mdx`, which `P3-A9` writes in this stage), `site/src/pages/*`, `scripts/*`, the styles.

## 8. Order of work

1. Confirm worktree and branch (`git rev-parse --show-toplevel`, `git branch --show-current`); `npm ci --prefer-offline` if `node_modules` is absent; Node at least 22.12. Confirm every input of section 3; report `blocked` for a beat whose tool is missing and continue.
2. Read the files of section 2 item 18. Write down the exact prop names, preset ids and `data-out` names you will use.
3. Print the golden shapes (section 2 item 16) and try every `<G>` path through `resolveGoldenPath` in a scratch script (not committed).
4. Frontmatter and skeleton: title, question, seven `Beat`s with their tools and captions, `Seen`, `LieTheory`, challenges, `ModuleLinks`, `Sources`. Build once (`npm run build`). Commit: `P3-A8: M4 skeleton with figures`.
5. Beats 1 to 3 first (the numbers game and the bridge sentence carry the module), then 4 and 5, then 6 and 7. Build after each pair.
6. Predictions, challenges, `Seen` with provenance, the Lie theory paragraph, the `<Unverified>` wraps. Count the words. Commit: `P3-A8: M4 text complete`.
7. `M4.spec.ts`. Build, `astro preview`, run only `site/tests/e2e/M4.spec.ts`; kill the preview. Remove each guarded behaviour once in your working copy to see its test fail; restore it.
8. `scripts/numbers-in-prose.mjs` on your file; justify every line or convert it to `<G>`. `RELEASE=1 npm run build` once; read the open-items report for your page. Type checks. Paste every summary line into the report.
9. `decisions/P3-A8.md`. Commit: `P3-A8: M4 lesson, tests, decisions fragment`. Report.

A partial result is usable in this order: beats 1 to 3 with the bridge sentence teach LO1 and LO2 by themselves; beats 4 to 7 can follow in a second run.

## 9. Traps

- Mozes' paper was not read (E2): what the lesson says about its content is wrapped (roster). Its sign convention (fires negative) is [S2] from later authors; which of $C$ and $C^{\mathsf T}$ is his matrix is [U] (2.9). Never write a theorem number of [Moz90].
- The Olympiad fires negative numbers; the site fires positive: state the convention when quoting (8.4; roster). In T15's Olympiad form `data-value` shows $x=-a$; your test expects `-1, 2, -3, 4, -1` there, and the level meter still reads the site's level $-1$.
- "The numbers game has $\det C$ times as many positions" is exact only as the index of a lattice; $P/Q$ has $\det C$ elements (2.4(c); roster). Never compare two infinite counts as if finite.
- The bridge sentence is fixed [D]; do not rephrase it, and do not "fix" it for P8 (it names node $i$ and city $i$ together by design). D7: $a=Cp$, the drop; Wildberger's $q=-Cp$ is the gain (2.4(e)).
- Firing changes the fired node and its neighbours; a mutation changes one city (2.4(c): "The games do not coincide, even on simply laced boards"). Do not write that the two games are the same game.
- F4's end is "the negatives of the starting numbers, permuted by $-w_0$"; only from $\rho$ is it $-\rho$. Do not write that the end is always minus the start. On $A_3$ $-w_0$ reverses the nodes (`types.A3.minus_w0` `[3,2,1]`).
- F3 compares the tapes as multisets: equal after sorting, not in order (T5 roster trap). On $A_3$ the two preset games happen to fire `1, 2, 1, 3, 2, 1` in the same order; do not say order never matters for the tape.
- Zero is not positive: a node holding 0 cannot be fired in legal play; the game ends when no number is positive (2.3).
- Row 5 must use the `linked` view: `populations` with `coords: numbers` falls back when $C^{-1}a$ is not integral (SPEC 4 T1). `data-value` of a fraction is `p/q` (`2/3`), never a decimal.
- T2 in `follow` shows only what the reader has visited (1 position at load); the caption and prose state the 3. The garden grows the numbers orbit here, not root populations: check the `grows` mode on `main`.
- The pentagon is labelled 1 to 5 clockwise from the top; $\tilde A_4$ in the golden file is node 0 first. The marks and comarks are all ones, so `affine.A4.comarks` prints correctly, but never map pentagon labels to `affine.A4` positions.
- The fate table is [S] only for simply laced affine boards ([GSS12], signs reversed). Any wider statement is E6. The Tits cone of an affine matrix ("believed to be Kac's Proposition 5.8") is [U]; do not cite it.
- "Still running after 20000 moves" is a cap, not a proof that the game never ends (2.12; 4.0 Stated limits).
- Do not name the Olympiad's proposer (E11, [U]). Do not reproduce the problem's text (7.9).
- Proctor's restricted game reading is [U] (2.9; E17): leave it out.
- [S2] is cited, not wrapped; [U] is wrapped. Wrapping a [S] or [V] sentence is wrong, and so is leaving an E2 sentence unwrapped.
- Golden paths: `fundamental_orbit_sizes[0]` is zero-based (7.3); `fired_tally` is an object and is not printed by `<G>`; `types.A3.longest_word` prints labels, so use `as="word"`. A path resolving to zero or several values fails the build.
- Nine or more islands on one page: keep `b1` alone `client:idle` and compact, everything else `client:visible`, so that the 120 kB budget at 360 by 800 counts only what is in view (7.6). Pass `BoardSpec` strings and plain arrays as props, never a `Board` or a `bigint`.
- Astro 7's compiler rejects invalid HTML and its default processor runs no remark or rehype plugins (7.2): follow P0-A3's mathematics route; a bare `$...$` under route (b) is plain text.
- M5 and the Atlas: `ModuleLinks` drops unreleased targets; a link typed in prose is not dropped (7.3). Name M5 without a link.
- `released: true` (so `nojs.spec.ts`, the module index and the sitemap include the page) and `draft: true` (the mark) are different flags.
- Em-dashes are forbidden everywhere you write, the fragment and test comments included (8.4; COMMON 4.4).
- Do not run the whole browser suite, `npm run size` or `npm run lab` (COMMON 4.3, 4.5); one Playwright run at a time; kill `astro preview` afterwards.

## 10. Report

The JSON of `COMMON.md` 5.2, with `agent: "P3-A8"`, and these additional fields:

- `figures`: one entry per tool instance in reading order, `{ id, tool, preset, board, props: { view, mode, coords, start, linkTo, prediction, ... }, directive: "client:idle" | "client:visible", expected: "<the result the caption states>" }`.
- `predictions` and `challenges`: each with its 8.5 pattern, the question or goal, the answer or check, and the test that proves it.
- `wordCount`: the number your test measured.
- `goldenPaths`: every `<G>` and `{{path}}` used, each with the value printed at build time.
- `typedNumbers`: the numbers-in-prose output for your file, annotated with the reason each may be typed.
- `bridgeSentence`: the places it appears (prose of beat 3; `b4`, `b5`, `b6`) and the test that checks each.
- `unverifiedUsed`: the items wrapped (E2, E6 or none) with their fallbacks; `proposedUnverifiedItems` for any new item.
- `hooksRead`: the `data-out` and `data-control` names of T1, T2, T5, T6 and T15 that `M4.spec.ts` reads, with the registry file each comes from.
- `requests`: changes needed in another agent's area (for example a missing `grows` property on T2 or `unverifiedMode` on T15), or an empty list.
- `acceptance`: one line per checkbox of section 6 with the test name and `pass`, `fail` or `not-automated` with the gate, and the summary lines of `npm run build`, `RELEASE=1 npm run build` and the type checks.
