# P6-A8: Lesson M10: Atlas, sandbox, history and sources hub; glossary completion

Phase 6, stage 6.3. Size S. Runs in: a worktree on branch `agent/P6-A8` (model: Opus, the default for build agents, README 3.5).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies. Where this file says (plan), the rule is the build plan's addition and not the specification's; where it says [D], `SPEC.md` marks the point as a design decision; where it says [U], the statement is unverified in `SPEC.md` or `SOURCES.md` and you must wrap it in `<Unverified item="E..">` with a fallback, never print it as fact.

## 1. Objective

When you are done, module M10 exists as `/modules/m10-atlas` (`site/src/content/modules/m10-atlas.mdx`): the reference module of `SPEC.md` section 3, a hub page that links every reference page of the site with one sentence each (the Atlas with its convention switch, the sandbox, the history page, the sources page, the glossary, credits and licences, the open problem, and common confusions), with no predictions and no challenges (9.2). The glossary (`site/src/content/pages/glossary.mdx`, seeded by `P1-A4` from Appendix C) is completed so that every term defined in M0 to M9 has an entry that links back to its first use. Your browser test `site/tests/e2e/M10.spec.ts` proves that every link on the hub resolves, that the glossary covers every term the lessons define, and that both pages render without JavaScript and pass axe. This is the last lesson of release 1.0 and the page a returning reader uses to find the data, the free editor and the record of who did what.

## 2. Read first, in this order

1. `SPEC.md` 3, M10 (lines 1011 to 1015), **in full**. This paragraph is your task statement: what the Atlas and the sandbox are, the history timeline the history page carries, that the sources page is generated from `SOURCES.md`, and the list of "further pages belonging to this module".
2. `SPEC.md` 3, introduction (lines 747 to 751), **in full**: "M10 is reference"; every module follows the anatomy of 8.2; the phase in which M10 is written (phase 6).
3. `SPEC.md` 8.2 (lines 1929 to 1940), **in full**, to decide which parts apply to a reference page (section 5.2 below says which).
4. `SPEC.md` 8.4 (lines 1950 to 1959), **in full**: the writing rules. They bind the hub and the glossary.
5. `SPEC.md` 9.2 (lines 1996 to 2000), **in full**: the lesson definition of done, including "(M10 is reference pages and has none)" for predictions and challenges.
6. `SPEC.md` Appendix C (lines 2300 to 2331), **in full**: the seed of the glossary; its four columns; the rows you must keep.
7. `SPEC.md` 7.3 (lines 1774 to 1823): the pages paragraph (which page appears in which phase; the `released` flag), the sources-page paragraph (sections 11.1 to 11.6 published, 11.0 and 11.7 to 11.9 not), and the four content components (`<G>` path grammar and output, `<Tex>`, `<Unverified>` in preview and release builds, `<Cite>`).
8. Reference, enough to extract the rules that touch your two pages: `SPEC.md` 8.1 (P1, P2, P8), 8.3 (icons and accents "used wherever the view is named"), 8.5 (to know what you must not add), 1.3 (LO10), 1.4 (the seven statements), 1.7 (names: Populations, Numbers; the Mars story with credit), 2.4 (a) (the bridge sentence), 2.9 (the convention table behind the Atlas switch), 2.11 (the open problem), 4 T14, T16 (what the Atlas and the sandbox are), 6.6 (links to a tool with a board loaded), 7.2 item 10 (`BASE_URL`), 7.4 (without JavaScript), 7.5 (A-6, A-11, A-12, A-13), 7.6 (size rows), 7.7 (Without JavaScript, Accessibility, Content, Links rows), 9.1 (G6 row), 9.3, 10 (D14, D16, D17, D19), Appendix E (items 2, 4, 5, 8, 10, 11, 13, 14, 15, 17, for what you must wrap if you touch it).
9. `SPEC.md` 3, modules M0 to M9 (lines 753 to 1009), as reference: the terms each module introduces, as a cross-check for the glossary (section 5.6).
10. `SOURCES.md` 11.0 (lines 11 to 21), **in full**: the meaning of the status labels and the limits of the research. Needed so that the hub's sentence on the sources page describes it correctly, and so that you do not state as fact anything 11.0 says was not read.
11. `CONTRACTS.md` 7 (lesson authoring: frontmatter, imports, lesson components, islands, `<G>`), 1 (repository layout), 6 (preset ids, only to know that M10 places no tool), 8 (CSS custom properties).
12. On `main`, before writing a line: the nine lessons `m0-start.mdx` to `m8-lie-algebras.mdx` (M9 is written beside you by `P6-A7`; see section 9); `site/src/content.config.ts` (the `modules` and `pages` schemas: which frontmatter fields are required, in particular `question`); `site/src/layouts/Lesson.astro` and `Page.astro`; `site/src/components/lesson/*` (`ModuleLinks`, `Sources`, `DraftMark` and their props); `site/src/content/pages/glossary.mdx` (its structure, its anchors, how entries are written) and `site/tests/unit/glossary.test.ts` (what `P1-A4` already asserts); the pages `history.mdx`, `confusions.mdx`, `credits.mdx`, `open-problem.mdx`, `not-quiver-mutation.mdx`, `about.mdx`; `site/src/pages/atlas/index.astro` and `atlas/[board].astro` (`P6-A4`), `tools/[tool].astro`, `sources.astro`, `[page].astro`; the registry entry `site/src/tools/registry/T16.ts`; `site/tests/e2e/nojs.spec.ts`, `a11y.spec.ts`, `basepath.spec.ts` (how they enumerate pages; the axe helper); `decisions/P1-A4.md`, `decisions/P6-A4.md`, `decisions/P6-A6.md` and `DECISIONS.md` (the link helper for `BASE_URL`, the mathematics route of `P0-A3`, the slugs and titles of the phase-6 pages, any first-use markup convention a lesson agent recorded).

No oracle function and no golden key is named for you. If you print a number that has a golden value, it goes through `<G>` (section 5.5).

## 3. Inputs you depend on

On `main` when you start (stage 6.2 merged; the roster names `P6-A4`, `P6-A6`, `P2-A5`, `P1-A4`):

- From `P1-A4`: the `modules` and `pages` collections with their schemas; `Lesson.astro` with the anatomy of 8.2; `modules/[slug].astro` and `modules/index.astro`; `[page].astro`; the lesson components `Beat`, `Seen`, `LieTheory`, `Challenge`, `ModuleLinks`, `Sources`, `DraftMark`; `glossary.mdx` with one entry and one anchor per Appendix C row; `sources.astro` with an anchor per citation key; the `released` flag that drops links to unreleased targets; the internal-link helper built on `import.meta.env.BASE_URL`.
- From `P6-A4`: `/atlas/` (`atlas/index.astro`) and one page per board at `/atlas/<board>` with the convention switch.
- From `P6-A6`: `/history`, `/confusions`, and the extended `/credits`, all `released: true`; the version footer.
- From `P2-A5`: the sandbox at `/tools/sandbox` (tool id `sandbox`, CONTRACTS 4 `ToolId`).
- From `P2-A7`: `/open-problem`. From `P5-A3`: `/not-quiver-mutation`.
- From `P0-A4`: `G`, `Tex`, `Unverified`, `Cite` from `@components/content`; `content/unverified.json` with items `E1` to `E17`.
- From `P0-A5`, `P1-A2`, `P0-A6`: `a11y.spec.ts` (and its axe helper), `nojs.spec.ts`, `basepath.spec.ts`; the root scripts `build`, `preview`, `e2e`.
- The lessons M0 to M8 on `main`. M9 (`m9-real-forms.mdx`, `P6-A7`) is written in parallel in stage 6.3 and merges before you (roster order); you will not see it on your branch.

If the atlas index, the sandbox route, `/history`, `/confusions`, the glossary page or the lesson layout is missing, stop and report `blocked` for the part that needs it; do not re-create another agent's page.

## 4. Deliverables

| File | Contents |
|---|---|
| `site/src/content/modules/m10-atlas.mdx` | frontmatter (5.1); the hub: a first figure (5.2), one item per reference page with one sentence each (5.3); the module links and sources the anatomy keeps (5.2); the draft mark; no prediction, no challenge |
| `site/src/content/pages/glossary.mdx` (completion; additive) | every existing entry and anchor kept; one entry for every term defined in M0 to M9 that is not yet there; every entry, old and new, links back to the term's first use (5.6) |
| `site/tests/e2e/M10.spec.ts` | the Playwright tests of section 6 |
| `decisions/P6-A8.md` | the fragment of COMMON 5.1 (5.9) |

Nothing else. Proposals for new items of `unverified.json` go in your report (`proposedUnverifiedItems`), never in the file.

## 5. Requirements

### 5.1 Frontmatter and route

- File name `m10-atlas.mdx` (SPEC 7.3 layout: `m0-start.mdx ... m10-atlas.mdx`), so the route is `/modules/m10-atlas`.
- `title`: `Atlas, sandbox, history and sources` (the heading of SPEC 3 M10 without the module number). `module`: `10`. `phase`: `6`. `released`: `true`. `draft`: `true` (D17 default: "Claude Code drafts each lesson ... marked as a draft on the page; the owner edits and approves before the release that contains it"; approval of the text of M6 to M10 is the owner's part of G6).
- `question`: SPEC 3 gives M10 no question (it is "reference"). If the `modules` schema requires the field, write one plain question in the site's words (plan), for example `Where are the data of every board, the free editor, and the record of who found what?`, and record it in your fragment. If the field is optional, omit it and record that.
- `outcomes`: `["LO10"]` (plan). 2.9 says its convention table "is the basis of the 'conventions' switch in the Atlas (tool T14) and of outcome LO10", and LO10 is "translate between the conventions of Wildberger, Mozes and Eriksson, Donnelly, Bourbaki, Kac and SageMath".
- `sources`: the keys you cite on the page through `<Cite>` (possibly none; see 5.4). Use the field as the schema defines it.

### 5.2 Anatomy of 8.2, as far as it applies to a reference page

Item by item (8.2 numbering):

1. **Title and the module's question.** The layout renders them from the frontmatter (5.1).
2. **"A first figure, already showing something, with a one-sentence caption."** M10's figure table is empty. Plan: a static figure built at build time with no island, which shows the reference material at a glance: the list of the boards that have an Atlas page, grouped by family, each name a link to `/atlas/<board>`, with the one-sentence caption stating what an Atlas page holds. Take the list of boards from the same source `atlas/index.astro` uses (read it; import its helper if it exports one, otherwise use the engine's names through the site's board-picker list); never type the list by hand, and never edit `P6-A4`'s files. If this duplicates `/atlas/` too closely, a static picture of one board's Atlas data (for example the Cartan matrix of $B_3$ in both conventions, built with the same KaTeX call as `<Tex>`) is acceptable. Its entries come from the golden file, never typed: write the matrix through `<Tex src="... {{path}} ..."/>` with paths under `types.B3.cartan` (SPEC 7.3 path grammar, for example the row `types.B3.cartan[0]`; Appendix G `types[T].cartan`), so that the build fails if a path does not resolve (8.4 "Numbers that have a golden value are written with `<G>`, never typed"; COMMON 4.4). If the path grammar cannot address the single entries needed to lay out the transpose, show $C$ from the golden rows and state in the caption that Bourbaki and Humphreys print its transpose (2.9), rather than typing the transposed matrix. Record the choice. The figure has a text alternative (A-10).
3. **Beats.** M10 has no beats. The hub items of 5.3 take their place: one short item per page, in the order of 5.3.
4. **"What we have seen"** box: does not apply (a reference page states no general result). Omit it (plan reading of "as far as it applies").
5. **"For readers who know Lie theory"**: does not apply. Omit it (plan). If you keep one sentence on the Atlas's standard names, it goes in the Atlas item, not in a `LieTheory` box.
6. **Challenges**: none. 9.2: "for M0 to M9, it has at least two predictions and three challenges ... (M10 is reference pages and has none)". No `Challenge`, no `prediction`, no tool island.
7. **Links**: "the sandbox with this module's board loaded; the Atlas page; the next module." M10 is the last module, so there is no next module. Use `ModuleLinks` if it accepts a module with no successor and no board (read its props); otherwise leave it out, because the hub already links the sandbox and the Atlas. Do not hand-write a second copy of the same links. If `ModuleLinks` requires a board, give the sandbox its default state (no board) or `A3` (plan) and record the choice.
8. **Sources for the module.** The `Sources` component over the frontmatter keys if you cite any; otherwise a link to `/sources` inside the sources item of 5.3 is enough (plan). No source list in SPEC 3 for M10.

Length: 8.2's "between 800 and 1800 words" is written for a lesson with beats. A hub of one sentence per page is shorter; do not pad it to reach 800 words (plan reading). Record the word count and this reading in your fragment, so the owner can disagree at G6.

Layout rules that still apply: text lines near 66 characters (the layout gives this); the page reads completely without interaction and without JavaScript (P1, 7.4); nothing sits behind a click, hover or tab (P2).

### 5.3 The hub: one item per reference page, one sentence each

The roster: "m10-atlas.mdx linking every reference page with one sentence each". SPEC 3 M10 names the pages. Each item is a link (built through the `BASE_URL` helper, never with a leading `/` typed in an `href`) and one sentence in the site's words. Write the sentence from the SPEC text cited, never from the target page's own prose copied over. Give each item the hook `data-hub-item="<id>"` (plan; ids below) so the test can find it.

| Id (plan) | Target | What the sentence must say (source) |
|---|---|---|
| `atlas` | `/atlas/` (and, inside the sentence or the figure, one example such as `/atlas/B3`) | "a data sheet for every board, with a switch between conventions" (SPEC 3 M10); the switch is between this site, Kac and SageMath, and Bourbaki and Humphreys, whose matrix is the transpose (4 T14; 2.9); every item links to the tool that shows it with that board loaded (4 T14) |
| `sandbox` | `/tools/sandbox` | "the free editor" (SPEC 3 M10); both games in free play with integers of any size; import and export of boards as JSON (4 T16) |
| `history` | `/history` | the timeline "with correct credit, in order of date" from Proctor's use of the firing process to Wildberger's 2020 paper; beside it Kostant's game as an oral tradition and Satake and Araki for the diagrams (SPEC 3 M10) |
| `sources` | `/sources` | the page "is generated from `SOURCES.md`" (SPEC 3 M10; 7.3): every work the site cites, each with where to read it and a status in words (11.0: read in the source, reported by a later source, checked by computation, unverified) |
| `glossary` | `/glossary` | the site's words beside Wildberger's, the numbers-game literature's and the standard Lie theory names (Appendix C; its four columns), each linked to the module where it is first used |
| `credits` | `/credits` | "credits and licences" (SPEC 3 M10): every third-party asset and library with its licence, the licences of the site's text and code (7.9), and the acknowledgement of Wildberger's story and terminology |
| `open-problem` | `/open-problem` | "the open problem (section 2.11)": the Mutation Conjecture, in the site's words |
| `confusions` | `/confusions` | "common confusions" (D16): common mistakes about the games, stated as corrections |

Optional items (plan; allowed because they are reference pages, not required by SPEC 3 M10): `about` (`/about`) and `not-quiver-mutation` (`/not-quiver-mutation`, the page of 2.16). Do not link `open-items`: it exists in preview builds only (7.3), so a link from the hub would break in the release build.

Rules for the sentences:

- Credit (8.4, verbatim rule): "the mutation game is Wildberger's; the numbers game is Mozes', with Proctor's earlier use of the same process and Eriksson's development acknowledged; Kostant's game is 'attributed to Kostant'." If the history sentence names any of them, it obeys this. Write "attributed to Kostant" if Kostant's game is named.
- Do not repeat in the hub any statement that `P6-A6` had to wrap: the proposer of the 1986 problem (E11), the content of Mozes' paper (E2), the lectures (E5), the wording of Kostant's attribution beyond "attributed to Kostant" (E13). If you need one, wrap it with the same item and a fallback.
- The Atlas sentence may say that Bourbaki and Humphreys print the transpose ([S2] in 2.9; a convention, not a claim needing a wrapper). It must not say that Kac numbers $E_6$, $E_7$, $E_8$, $G_2$ differently unless wrapped as `E4` (2.9: "[S2] for $E_6$, [U] for the rest"; Appendix E item 4).
- The open-problem sentence states the question, not its answer as a theorem. If it says the statement is true on bidirected boards, that rests on Kac [U for the exact place, E4]; either keep to "an open question, with a counterexample when roads may be one-way" (2.11) or wrap the reference to Kac as `E4`.
- The sources sentence must not overstate the research: say that each entry carries its status, not that every source was read (11.0 lists hosts and books that were not opened).
- No claim of novelty and no "nothing like this exists" (Appendix E item 8; Appendix F's "No interactive tool ... was found" is [U], one search only).
- D19: if you name $B_2$, use "$B_2=C_2$" where a board is recognised from its shape, and the reader's chosen name in a picker context.

### 5.4 Citations

Every key through `<Cite k="..."/>`; an undefined key fails the build (7.3, 7.7). The hub needs no citation (its facts are developed and cited on the pages it links). If you cite, likely keys are `W20` (the mutation game), `Sat60` and `Ara62` (the diagrams). Cite [W-MS] only as "unpublished manuscript, undated" and never with a year (SOURCES 11.9; Appendix F last bullet).

### 5.5 Numbers and mathematics

- "Numbers that have a golden value are written with `<G>`, never typed" (8.4). Examples you may need: the number of Satake records `<G k="satake" as="count"/>`; the number of positive roots of $E_8$ (the Atlas's "up to 120 positive ones listed", 4 T14) `<G k="types.E8.n_positive_roots"/>`. The number of named finite boards has no single golden path (`types` is an object): write "every board of finite type of rank at most 8" or, if you type the number, list it under `typedNumbers` in your report.
- Years and page numbers of sources are not golden values.
- Mathematics through the route `P0-A3` recorded (`$...$` under route (a), `<Tex>` under route (b)); a formula with a golden value goes through `<Tex src="... {{path}} ..."/>` (7.3).

### 5.6 Glossary completion

The roster: "the glossary completed so that every term defined in M0 to M9 has an entry linking back to its first use". 8.4: "Define every term on first use and link later uses to a glossary entry (Appendix C is its seed)."

- **Additive protocol (plan).** Keep every entry, anchor id and column of `P1-A4`'s glossary unchanged: lessons and pages link to those anchors, and `glossary.test.ts` asserts every Appendix C row. Add entries; do not rename, merge or delete. If an existing entry is wrong against SPEC, report it under `requests` to `MERGE` rather than rewriting it silently, unless the fix is purely additive (a back-link).
- **The terms list.** The roster's test "enumerates the terms from the lessons' first-use markup". Find the markup on `main`: read `m0-start.mdx` to `m8-lie-algebras.mdx` and `decisions/P1-A8.md` to `decisions/P5-A3.md` for how a lesson marks a term at its first use (a `<dfn>`, a component, a link to `glossary#<anchor>`, or a `data-*` attribute). Use exactly that markup in the test; never edit a lesson to add it (you do not own them). If the lessons use no uniform markup, the test enumerates (a) every link from a lesson page to a glossary anchor and (b) a list of terms written in `M10.spec.ts` (plan), compiled by reading each lesson, with the lesson slug of each term's first use; record the method in your fragment and send `MERGE` a request that lessons mark first uses uniformly.
- **Cross-check (plan).** Compare your list with the terms SPEC 3 introduces, module by module, and with Appendix C. Terms you should expect, for checking only (the lessons decide which are defined): M0 and M1: board, node, city, road, population, Martian, anti-Martian, mutate, root population, simple root population, raising move, Kostant's game, highest root, root poset; M2: form value (the "energy meter"), invariant form; M3: finite, affine, indefinite, spectral radius, frozen population, one-way road, bidirected board, the Mutation Conjecture; M4: numbers, position, fire, legal play, free play, the translator $a=Cp$, level, fundamental position; M5: word, shortest word, Weyl group, longest element, heap, fired numbers, exponents, Coxeter number $h$, wave; M6: one-way counts, balanced board, weights $d_i$, reversed board, folding, folded board; M7: ring, Wythoff's construction, face type, uniform, Coxeter plane, root polytope; M8: string, single step ($E_i$, $F_i$, $H_i$), minuscule node, relation, signed move; M9: real form, involution, black node, white node, arrow, $\theta$, shadow, multiplicity, the three conditions (lights), real rank, restricted board, Satake diagram, Vogan diagram.
- **M9's terms.** `P6-A7` writes M9 in parallel. Take M9's terms from SPEC 3 M9 and 2.15 and from `P6-A7`'s roster deliverables; link them to `/modules/m9-real-forms` (its slug, from `P6-A7`'s owned file). The link resolves only after both branches merge: write it through the standard helper and let the `released` flag decide; your test of M9's back-links runs at merge (section 9).
- **Each entry.** The site's word first (Appendix C's order), then a definition in plain declarative sentences, then, where one exists, the counterpart in Wildberger's texts, in the numbers-game literature and in Lie theory (Appendix C's four columns; an empty cell where there is none, as Appendix C leaves cells empty). A link back to the term's first use: the module page, with the fragment of the beat or definition if the lesson renders an anchor there (read `Beat`'s output). One anchor per entry, with a stable id (plan: kebab-case of the site's word).
- **Content rules inside entries.** Definitions need no provenance (0.3: "Statements with no label in section 2 are definitions"); any theorem-like statement in an entry needs one (8.4). Numbers with a golden value through `<G>`. [U] statements wrapped: the Kostant entry says "attributed to Kostant" and nothing more about the attribution unless wrapped `E13`; an entry that equates Wildberger's List A with Kac's affine list wraps `E14`; an entry that quotes a theorem number from memory wraps `E10` (or `E4` for Kac); a Vogan-diagram entry that repeats the last sentence of 2.15 on a failed condition 3 wraps `E15`; anything else [U] uses `E17` or a new item proposed in your report.
- **Conventions in entries (8.4: "State the convention whenever a result is quoted from a source that uses another one").** The translator: Wildberger's dual population is $q=-Cp$, the site's numbers are $a=Cp$ ("his dual population records the gain, this specification records the drop", 2.4(e)); if the entry states what the numbers mean, use the bridge sentence of 2.4(a) with the same wording: "The number on node $i$ is the amount by which a mutation would lower city $i$." The numbers-game literature that fires negative translates by negation, each source in its own variable as the table of 2.9 gives it: the Olympiad 1986 problem, $a=-x$ on the 5-cycle; Mozes, $a=-x$, with which of $C$, $C^{\mathsf T}$ is his matrix [U] (2.9; wrap as `E2` if an entry states it); K. Eriksson, $a=-x$ with $C_{ts}=-k_{st}$; Gashi, Schedler and Speyer, $a=-v$ with $C=c^{\mathsf T}$ (their $\delta\cdot v$ is minus the level of 2.12); Benkart, Klivans and Reiner, $a=-u$ with $C=c^{\mathsf T}$. Donnelly fires positive with $a=\lambda$, $C=M^{\mathsf T}$; Björner and Brenti have $a=p$, $C_{s's}=-k_{s,s'}$. Bourbaki's Cartan matrix is the transpose of $C$. For $n\ge3$, Wildberger's $B_n$ and $C_n$ are Bourbaki's $C_n$ and $B_n$ (2.10).
- **Views.** Name the two views **Populations** and **Numbers** (1.7) and use the view icons wherever a view is named if the site has an icon component for them (8.3); never colour text with the accents (8.3: accents mark "borders and icons of panels and the underlines of the two words, never text").
- **The glossary stays a page with no tool** (plan reading: 7.6 sets 15 kB for "a page with no tool (`about`)", and its row names only `about`; applying that budget to the glossary is the plan's reading, as in 5.8).

### 5.7 Writing rules (8.4, all of them, for the hub and the glossary)

- "Plain declarative sentences."
- The site's words consistently: "board, node (city in the Mars story), road, population, numbers, mutate, fire, legal, free play". Node $i$ is "node $i$" or "city $i$", never both in one sentence (P8). The second half of the same bullet, "Give the standard term once, in the Lie theory paragraph", has no Lie theory paragraph to live in on the hub (5.2 item 5 omits the box); on the hub, give no standard term beyond the Atlas item's board names (plan). In the glossary the standard term belongs in the Lie theory column of its entry, which is that page's place for it (Appendix C).
- "Every theorem-like statement carries its provenance. 'Verified by computation for all boards of rank at most 8' is an acceptable provenance and must not be dressed up as a citation."
- "A statement that rests on an open item of Appendix E is wrapped in `<Unverified>`." SPEC 7.3: "A fallback is a weaker sentence that stays true however the item turns out." Keep the `fallback` a plain sentence with no `<Cite>`, `<G>` or markup inside it (plan: a prop string is not parsed as MDX, so a component there would print as text; read the `Unverified` props on `main` and follow them).
- "Credit accurately" (5.3).
- House style (D14 default "as proposed"): "no em-dashes; no stock rhetorical contrasts or fashionable filler words; the specific in place of the grand." No em-dash anywhere: prose, captions, alt text, link text, frontmatter, test comments, your fragment.
- "No sentence of the lessons is copied from a source" (8.4); 7.9 extends this to every sentence, figure and table layout of a paper, preprint or lecture. Do not copy sentences from `SPEC.md`'s sources either; the SPEC phrases quoted in 5.3 are descriptions to restate, except where this file says "verbatim".
- D16: the confusions item describes general confusions and makes no reference to the project note or to the package of Appendix F.

### 5.8 Without JavaScript, accessibility, size

- Both pages read completely without JavaScript (7.4; 9.2). They contain no island, so this follows if nothing is rendered client-side.
- Accessibility (7.5): headings in order (one `h1` from the layout); the hub as a real list (`<ul>` or `<dl>`) with link text that names the target (not "here"); the first figure with a text alternative (A-10); contrast with the existing tokens in both themes (A-6); reflow at 320 pixels (A-11); mathematics through KaTeX with MathML (A-12). axe: no serious or critical violations (7.7).
- Size (7.6): "any lesson page" at most 120 kB and "a page with no tool (`about`)" at most 15 kB of JavaScript fetched before the first interaction. M10 and the glossary place no tool, so both should fetch only the shell, within 15 kB (plan reading; record it). `MERGE` and `GATE` run `npm run size`; you do not.
- Internal links built from `import.meta.env.BASE_URL` (7.2 item 10), so that `basepath.spec.ts` passes.

### 5.9 Decisions fragment

`decisions/P6-A8.md`, one dated entry each: D14 (house style as proposed), D16 (confusions item worded generally), D17 (`draft: true`), D19 if you name $B_2$; the `question` field (written or omitted, and why); `outcomes` `LO10`; the first figure chosen and where its board list comes from; whether `ModuleLinks` is used and with which board; which optional hub items you included; the word count and the reading of 8.2's length for a reference page; the first-use markup found (or the fallback method of 5.6) and the number of terms covered; every new glossary anchor id; every `<Unverified>` item used, with its page; every typed number.

## 6. Acceptance

Each line: the condition, its source, the test (in `site/tests/e2e/M10.spec.ts` unless named otherwise), the gate. Tests run against `astro build` then `astro preview` and read the built HTML, the `data-*` hooks and page text.

- [ ] Every link on the hub resolves: every internal `href` on `/modules/m10-atlas` returns 200 from the preview server, and every fragment (`#id`) exists on its target page. Roster acceptance "every link on the hub resolves (test)". `M10 > every link on the hub resolves`. G6.
- [ ] The hub has one item for each page of SPEC 3 M10 (`data-hub-item` `atlas`, `sandbox`, `history`, `sources`, `glossary`, `credits`, `open-problem`, `confusions`), each with a link to its target and one sentence. Roster deliverable; SPEC 3 M10. `M10 > the hub links every reference page with one sentence each`. G6.
- [ ] No link to `open-items` on the hub (absent from release builds). SPEC 7.3. `M10 > no link to preview-only pages`. G6.
- [ ] The glossary covers the terms list: every term marked as defined in M0 to M9 (by the first-use markup, or the list of 5.6) has an entry on `/glossary`. Roster deliverable "the glossary covers the terms list (a test enumerates the terms from the lessons' first-use markup)". `M10 > the glossary covers every term defined in M0 to M9`. G6 (M9's terms checked after `P6-A7` merges; see section 9).
- [ ] Every glossary entry links back to its first use, and every such link resolves (page 200, fragment present). Roster deliverable "linking back to its first use". `M10 > glossary back-links resolve`. G6.
- [ ] Every Appendix C row is still present in the glossary. Appendix C; `P1-A4`'s acceptance. `site/tests/unit/glossary.test.ts` (P1-A4), run unchanged and green. G6.
- [ ] M10 has no prediction and no challenge: no `Challenge` element, no prediction hook, no tool root (`data-tool`) on the page. SPEC 9.2 "(M10 is reference pages and has none)". `M10 > reference page: no prediction, no challenge, no tool`. G6.
- [ ] The anatomy of 8.2 as far as it applies: title and question (or the recorded omission), a first figure with a caption and text alternative, the hub list, the draft mark. SPEC 8.2, 9.2, D17. `M10 > anatomy of a reference page`. G6.
- [ ] Both pages render without JavaScript with all their text, the figure and every link (JavaScript disabled in the browser context). SPEC 7.4, 9.2; roster acceptance "nojs". `M10 > hub and glossary render without JavaScript`; `nojs.spec.ts` (P1-A2) after merge. G6.
- [ ] axe: no serious or critical violation on `/modules/m10-atlas` and `/glossary`, in light and dark themes (plan for the themes). SPEC 7.7; roster acceptance "axe". `M10 > hub and glossary pass axe` (with `P0-A5`'s helper); `a11y.spec.ts` after merge. G6 (full accessibility scan).
- [ ] Size: both routes fetch no script beyond the shell (no island). SPEC 7.6; roster acceptance "size". `M10 > hub and glossary load no tool script` (plan); `npm run size` by `MERGE` and `GATE` against 7.6 (120 kB for a lesson page; 15 kB for a page with no tool). G6 (sizes on every page).
- [ ] No em-dash (U+2014) in the built text, attributes and alt text of both pages. SPEC 8.4; COMMON 4.4; roster trap. `M10 > no em-dash`. G6; RT-08.
- [ ] Credit wording: if the hub or glossary names Kostant's game, the text contains "attributed to Kostant"; if it names the numbers game's origin, Mozes is credited with Proctor and Eriksson acknowledged. SPEC 8.4. `M10 > credit wording`. G6; RT-08.
- [ ] No claim of novelty: the built text of both pages contains none of "first site", "the first site to", "no other tool", "first tool" or "never been done" (case-insensitive; the list is the plan's, a floor and not a definition). SPEC Appendix E item 8 ("The site should make no claim of novelty until a search has been done"); 9.3 risk table ("the site makes no such claim; see Appendix E item 8"). `M10 > no novelty claim` (plan test). G6; RT-08.
- [ ] The rest of the writing rules of 8.4, which 9.2 makes part of done ("it follows the writing rules of section 8.4"). SPEC 9.2 does not put these rules under the owner's checks at the gate, so COMMON 5.2 does not allow `not-automated` for them. Each rule below has an automated proxy in `M10.spec.ts` (plan tests; each pattern list is a floor, not a definition of the rule), reported in `acceptance` as `pass` or `fail`. The part of a rule that no test decides is a manual reading: record it under `deviations` (`{"spec": "9.2, 8.4", "what": "manual reading of <rule>", "why": "no automated check decides it"}`) so that `MERGE` decides, and put what you checked and changed in `writingRules` (plan field). Also read by the owner at G6 and by RT-08.
  - "Plain declarative sentences." `M10 > the hub links every reference page with one sentence each` asserts that each hub item is one sentence and that no hub sentence ends in "?" or "!" (plan). The rest is a manual reading of both pages (deviation).
  - "Use the site's words consistently: board, node (city in the Mars story), road, population, numbers, mutate, fire, legal, free play." `M10 > site's words` (plan) asserts that no sentence of the hub contains both "node" and "city" (P8; 5.7). The comparison of both pages with that list and with Appendix C is a manual reading (deviation).
  - "State the convention whenever a result is quoted from a source that uses another one (section 2.9)." `M10 > conventions stated` (plan) asserts that every hub item and every glossary entry whose text (including the TeX annotation KaTeX renders) names Bourbaki, Humphreys, Kac, Mozes, Eriksson, the Olympiad, Gashi, Benkart, Donnelly or $\tau$ also contains one of "transpose", "opposite sign", "fire negative", "numbering" or a translation formula of 2.9 ($a=-x$, $a=-v$, $a=-u$, $q=-Cp$). Whether every quoted result is caught is a manual reading (deviation); list each such place, or "none", in `writingRules`.
  - House style: "no stock rhetorical contrasts or fashionable filler words; the specific in place of the grand." `M10 > no stock contrasts or filler` (plan) asserts that the built text of both pages contains none of the list of RT-08 attack 40: "not just", "not only ... but", "more than just", "delve", "journey", "embark", "unlock", "powerful", "seamless", "game-changer", "at its core", "a testament to", "in the world of", "Let's dive" (case-insensitive), the shape "It's not X. It's Y." (a sentence beginning "It's not" or "It is not" followed directly by one beginning "It's" or "It is"), and "beautiful" (any use: the test cannot tell whether it is said of a result, which is what RT-08 reports, so the page avoids the word). That is the whole list of RT-08 attack 40. "The specific in place of the grand" is a manual reading (deviation). The em-dash half of the same rule is the automated line above.
  - "No sentence of the lessons is copied from a source." `M10 > no copied sentence` (plan) asserts that no sentence of eight words or more on the hub, or in a glossary entry you added, appears word for word in `SPEC.md` or `SOURCES.md`, except quotations this file names as verbatim (the 2.4(a) bridge sentence, the credit wording of 8.4). Copying from a paper, preprint or lecture (5.7; SPEC 7.9) cannot be tested from the repository and is a manual reading (deviation); list any verbatim quotation with its source in `writingRules`.
- [ ] Every [U] statement wrapped: in a preview build, each wrapped sentence carries the marker the `Unverified` component renders, with the item numbers you list in the report; in a release build (`RELEASE=1 npm run build`) the open-items report lists your pages under those items. SPEC 7.3, 8.4, 9.3. `M10 > open items are wrapped` and the release build's report (paste the lines). G6.
- [ ] Internal links honour `BASE_URL`. SPEC 7.2 item 10. `basepath.spec.ts` (P0-A6) after merge; `M10 > links resolve` also runs against a `BASE_PATH=/sub/path/` build if the harness offers it. G6.
- [ ] Every number that has a golden value is written with `<G>`, never typed. SPEC 9.2 ("every number that has a golden value is written with `<G>`"), 8.4; 7.7 Content row (`scripts/numbers-in-prose.mjs` "lists every number in lesson prose that is not written with `<G>`, for a person to review"). Run `node scripts/numbers-in-prose.mjs` (or `scripts/report.mjs`, which runs it; P0-A6) after your build and paste the lines for `m10-atlas.mdx`; every number listed there is either replaced by `<G>` or listed in the report's `typedNumbers` with the reason it has no golden path. The script scans `site/src/content/modules/*.mdx` only (P0-A6 roster), so for `glossary.mdx` check by reading and list every typed number under `typedNumbers` too (plan). Read by the owner at G6; RT-09.
- [ ] Every statement has a provenance. SPEC 9.2 ("every statement has a provenance, with `<Unverified>` around anything that rests on an open item"), 8.4 ("Every theorem-like statement carries its provenance"). Definitions need none (0.3); every theorem-like statement on the hub or in a glossary entry (5.6) carries a `<Cite>`, a "Verified by computation" phrase, or a link to the module or page where it is proved or cited. Give each theorem-like statement you write the hook `data-claim` (plan). `M10 > theorem-like statements carry provenance` (plan) asserts that every `data-claim` element contains the output of `<Cite>`, the phrase "Verified by computation", the `<Unverified>` marker, or an internal link to a module or page. SPEC 9.2 lists provenance as part of done, not as an owner's check, so COMMON 5.2 does not allow `not-automated`: whether every theorem-like statement carries the hook is a manual reading, recorded under `deviations` (as in the line above) for `MERGE` to decide, with each statement and its provenance listed in `provenance` (plan field). Also read by the owner at G6 and by RT-09.
- [ ] The build fails on no `<Cite>` key or `<G>` path of yours. SPEC 7.3, 7.7 Content row. `npm run build` passes. Every merge.
- [ ] Type checks pass (`npx astro check`, `npx svelte-check`, or the configured commands). COMMON 4.3. Command summaries in the report. Every merge.
- [ ] Owner's part, not automated: approval of the text of M10 (D17; "approval of the text of M6 to M10"); the page read aloud once for flow (9.2); principles P3 to P8 as far as they apply; accessibility script A-13 on the whole site. SPEC 9.1 G6, 9.2. Report as `not-automated`, gate G6.

## 7. Files

- **You own** (the roster's list, exactly):
  - `site/src/content/modules/m10-atlas.mdx`
  - `site/src/content/pages/glossary.mdx (completion; additive)`
  - `site/tests/e2e/M10.spec.ts`
  - `decisions/P6-A8.md`
- **You may edit with the stated protocol**: `glossary.mdx`, additively (5.6): keep every entry, anchor and column; add entries and back-links; report every change. Ownership note: README section 6 assigns `site/src/content/pages/*.mdx` with the glossary to `P1-A4` and does not mention this completion; the phase-6 roster's `owns` list gives you `glossary.mdx (completion; additive)`. The roster governs this agent. Name `P1-A4` as the original owner in your fragment and in the report's `requests` to `MERGE`, so that the edit is read as the roster's additive completion and not as an ownership breach.
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, root `package.json` and the lockfile, `site/package.json`, every other lesson (`m0-start.mdx` to `m9-real-forms.mdx`; `P6-A7` writes M9 in this stage), `site/src/content/pages/history.mdx`, `confusions.mdx`, `credits.mdx` (`P6-A6`), `about.mdx`, `open-problem.mdx`, `not-quiver-mutation.mdx`, `site/src/pages/*` (including `atlas/*` of `P6-A4`, `embed/*` of `P6-A5`, `sources.astro`), `site/src/components/*` (lesson, content, board, tools, atlas, `Footer.astro`, `Nav.astro`), `site/src/layouts/*`, `site/src/content.config.ts`, `site/src/lib/*`, `site/src/tools/registry/*`, `site/src/content/unverified.json` (never add or close an item), `site/src/styles/*`, `scripts/*`, `SOURCES.md`, `nojs.spec.ts`, `a11y.spec.ts`, `basepath.spec.ts`, `glossary.test.ts` and every other agent's tests, `build-plan/`.

## 8. Order of work

1. Confirm worktree and branch (`git rev-parse --show-toplevel`, `git branch --show-current`); `node --version` at least 22.12; `npm ci --prefer-offline` if `node_modules` is absent. Read the files of section 2 item 12 on `main`. Check the inputs of section 3; if one is missing, report `blocked` for the part that needs it.
2. Find the first-use markup (5.6) and write the terms-list part of `M10.spec.ts` first; run it against the current glossary to see which terms are missing. This is your work list.
3. Write `m10-atlas.mdx`: frontmatter, first figure, the eight hub items, links, draft mark. `npm run build`; open `site/dist/modules/m10-atlas/index.html` and check the links. Write the hub tests; run them. Commit: `P6-A8: M10 hub page`.
4. Complete the glossary, module by module (M0 to M8 from the lessons; M9 from SPEC 3 M9 and 2.15). Build; run the glossary tests and `glossary.test.ts`. Commit: `P6-A8: glossary completed for M0 to M9`.
5. The no-JavaScript, axe, em-dash, wrapped-items and no-script tests. One preview build with `BASE_PATH=/sub/path/` to check links; one release build (`RELEASE=1 npm run build`) to read the open-items report. Run only your spec and `glossary.test.ts`, one Playwright run at a time; kill `astro preview` afterwards. Type checks.
6. Fragment; final commit; report.

## 9. Traps

- **No em-dashes** (roster trap): "the writing rules apply to reference pages too". This includes link text, captions, alt text, frontmatter strings, glossary definitions and comments in the test. Text pulled into the figure from elsewhere (board names, page titles) is covered by the test too.
- **M9 is written beside you.** `P6-A7`'s `m9-real-forms.mdx` is not on your branch. Glossary entries for M9's terms link to `/modules/m9-real-forms`; on your branch that link is dropped or unresolved. Make the test of M9's terms and back-links derive from the built site (so it passes once M9 is merged, in `MERGE`'s run), not from a hard-coded skip; never use `test.skip` (COMMON 4.4). If the test cannot pass on your branch for this reason alone, say so in the report with the failing assertion, and `MERGE` reruns it after merging `P6-A7`.
- **The glossary is shared territory.** Every lesson and several pages link to its anchors. Renaming one breaks links silently in prose. Additive only.
- **First-use markup is not fixed by the plan.** Read what the lessons actually do before writing the test, and record the method; do not invent a component and edit lessons to use it.
- **`open-items` is preview-only.** A link to it from the hub fails in the release build of G6.
- **`released` flag.** Build every link the standard way; the flag drops unreleased targets. By stage 6.3 every target of 5.3 is released; if one is missing from the built hub, a target page lacks `released: true`, which is a request to its owner, not a reason to hard-code the link.
- **Base path.** Never type an `href` beginning with `/`; use the helper `P1-A4` uses.
- **Credit and [U] wording leak through summaries.** A one-sentence summary of `/history` easily states something `P6-A6` wrapped (the Olympiad's proposer, Mozes' theorems, the lectures, Kostant). Summarise the page's purpose, not its contested facts; wrap anything else.
- **The manuscript is undated** (SOURCES 11.9; Appendix F's last bullet). Never "Wildberger (2003)" for [W-MS].
- **Kac's numbering** of $E_6$, $E_7$, $E_8$, $G_2$ is [S2] for $E_6$ and [U] for the rest (2.9): wrap as `E4` if the Atlas sentence mentions it.
- **No novelty claims** (E8): no "the first site to", no "no other tool".
- **The bridge sentence** of 2.4(a), if the translator entry states the meaning of the numbers, is quoted with the same wording ([D]: "must appear, with the same wording, wherever the two views are shown together").
- **The sign of the translator.** Wildberger's $\tau$ gives $q=-Cp$; the site's $a=Cp$ (D7). A glossary row that says "the map $\tau$" without "with the opposite sign" is wrong (Appendix C).
- **No tool on M10.** An island would raise the page above the 15 kB of a page with no tool and add hydration for nothing; the first figure is static.
- **Golden numbers.** Use `<G>` for any count with a golden value (the 167 Satake records, the 120 positive roots of $E_8$); and (plan, 5.7) not inside a `fallback` string.
- **Shell rules (COMMON 4.6).** Absolute paths, no `cd` chains, no inline multi-line scripts.

## 10. Report

The JSON of `COMMON.md` 5.2. In addition:

- `acceptance`: one line per checklist item of section 6, with the test name or the command and its output.
- `hubItems`: each `data-hub-item` id with its target path and the sentence as built.
- `glossaryTerms`: the method used to enumerate terms (markup found, or the fallback list), the number of terms, the list of anchors you added, and the terms whose back-links depend on M9 merging.
- `unverifiedUsed`: every `<Unverified>` item on your two pages with its page and fallback.
- `typedNumbers`: every number typed in prose that has no golden path, with the reason, and the `numbers-in-prose` lines for `m10-atlas.mdx`.
- `provenance` (plan): every theorem-like statement on your two pages with its provenance (6).
- `writingRules` (plan): one entry per manual writing-rule check of section 6 (plain sentences, the site's words, conventions stated, no stock contrasts or filler, no copied sentence), each with what you checked and what you changed, and the output of `M10 > no novelty claim`.
- `requests`: to `MERGE`, rerunning `M10.spec.ts` after `P6-A7` merges and any lesson whose first-use markup is missing or inconsistent; to the owner of any target page that is not released or lacks an anchor you link to.
