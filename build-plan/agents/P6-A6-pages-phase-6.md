# P6-A6: History, common confusions, credits and licences, version footer

Phase 6, stage 6.1. Size S. Runs in: a worktree on branch `agent/P6-A6` (model: Opus, the default for build agents, README 3.5).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies. Where this file says (plan), the rule is the build plan's addition and not the specification's; where it says [D], `SPEC.md` marks the point as a design decision; where it says [U], the statement is unverified in `SPEC.md` or `SOURCES.md` and you must wrap it in `<Unverified item="E..">` with a fallback, never print it as fact.

## 1. Objective

When you are done, three content pages and one shared component are on your branch. `/history` (`site/src/content/pages/history.mdx`) gives the timeline of module M10 in order of date with correct credit, and beside it Kostant's game as an oral tradition and Satake and Araki for the diagrams. `/confusions` (`site/src/content/pages/confusions.mdx`) states the corrections of Appendix D, and the statements of Appendix F that the site must not repeat, as general confusions with no reference to the project note (decision D16). `/credits` (`site/src/content/pages/credits.mdx`, extending `P1-A4`'s page) completes the credits and licences of `SPEC.md` 7.9. `site/src/components/Footer.astro` (extending `P1-A4`'s component) prints on every page the pinned versions of 7.1 read at build time, the site version (the git commit) and both licences with SPDX identifiers. These are pages of module M10 ("Further pages belonging to this module") that `P6-A8`'s hub links in stage 6.3, and they carry the credit that release 1.0 owes to the authors the site builds on.

## 2. Read first, in this order

1. `SPEC.md` 3, M10 (lines 1011 to 1015), **in full**: the history timeline and the list of pages belonging to the module. This is your task statement for `/history`.
2. `SPEC.md` 7.9 (lines 1896 to 1904), **in full**: licences, own words, black-box oracles, the credits page, Wildberger's acknowledgement. Marked [D], with D4 open.
3. `SPEC.md` 8.4 (lines 1950 to 1959), **in full**: the writing rules, in particular "Credit accurately" and the house style. They bind pages as much as lessons.
4. `SPEC.md` Appendix D (lines 2333 to 2353), **in full**: the three main corrections and three smaller points that become `/confusions`.
5. `SPEC.md` Appendix F (lines 2379 to 2418), **in full**: what the site borrows (to credit) and the seven statements the site must not repeat (to correct on `/confusions`).
6. `SPEC.md` Appendix E (lines 2355 to 2377): items 2, 5, 11, 13 **in full** (named by your roster entry); items 8, 10 and 17 as reference (novelty, journal data, other [U] statements you may touch).
7. `SPEC.md` 10, rows D4, D5, D11, D13, D16, D17 (lines 2042 to 2072).
8. `SPEC.md` 7.2 (lines 1757 to 1772): the closing rule on versions in the footer; item 10 (`import.meta.env.BASE_URL` for every link). `SPEC.md` 7.1 (lines 1732 to 1755): the version column you print.
9. `SPEC.md` 7.3 (lines 1774 to 1823): the pages paragraph (`history`, `confusions` in phase 6; `about` and `credits` "extended at each release"; the `released` flag) and the four content components (`<G>`, `<Tex>`, `<Unverified>`, `<Cite>`).
10. Reference, enough to extract the rules: `SPEC.md` 2.3 (line 189, who fires positive and who fires negative), 2.4 (a), (b), (c), (e) (lines 193 to 215; the formulas Appendix D cites), 2.9 (lines 321 to 348, conventions of each source), 2.10 (lines 350 to 378, Wildberger's B and C), 2.16 (lines 668 to 688, quiver mutation), 1.7 (names; the Mars story), 0.3 (labels), 7.4 (without JavaScript), 7.5 (A-6, A-11), 7.6 (15 kB for a page with no tool), 7.8 (no third-party script; the cookie-free counter rule), 8.1 to 8.3, 9.2.
11. `SOURCES.md` 11.1 to 11.4 (lines 23 to 251) for the dates, attributions, statuses and citation keys of every timeline entry, and 11.9 (lines 331 to 338) for the corrected citations. 11.0 (lines 11 to 21) for the meaning of the labels and the limits of the research.
12. `CONTRACTS.md` 7 (lesson authoring: imports from `@components/content`, `<G>` and `<Tex>` for golden numbers), 4 (`katex.ts`; `export.ts` for the commit constant's precedent), 1 (repository layout, `LICENSE`, `LICENSE-content`).
13. On `main`, before writing: `site/src/components/Footer.astro`, `Nav.astro`, `site/src/layouts/Page.astro`, `Lesson.astro`, `Base.astro` (which layouts render the footer); `site/src/pages/[page].astro`, `site/src/content.config.ts` (the `pages` schema and its `released` and other fields); the existing content pages `about.mdx`, `credits.mdx`, `glossary.mdx` (anchors per term), `open-problem.mdx`, `not-quiver-mutation.mdx` (`P5-A3` already words Appendix D for the quiver side; do not duplicate its table); `site/src/lib/katex.ts` (`KATEX_VERSION`); how `P1-A2` set `import.meta.env.PUBLIC_GIT_COMMIT` (its fragment and the root `build` scripts); `site/src/content/unverified.json`; `decisions/P0-A5.md`, `decisions/P1-A4.md` and `DECISIONS.md` (the D4 and D5 defaults recorded, how the dependency list on credits is generated, the mathematics route of `P0-A3`).

No oracle function and no golden key is named for you. If a page prints a number that has a golden value, it goes through `<G>` (section 5.6).

## 3. Inputs you depend on

On `main` when you start (gate G5 passed; the roster names `P1-A4`):

- From `P1-A4`: `content.config.ts` with the `pages` collection; `[page].astro` (which serves `/history`, `/confusions`, `/credits` from the file names); `Page.astro`, `Lesson.astro`, `Nav.astro`, `Footer.astro` (the version footer placeholder); `credits.mdx` and `about.mdx` (the credit rules of 7.9 and 8.4, the D4 licences, the dependency list with licences); `glossary.mdx` with an anchor per term; the `sources` page with an anchor per citation key; the `released` flag that drops links to unreleased pages.
- From `P0-A4`: `G`, `Tex`, `Unverified`, `Cite` from `@components/content`; `content/unverified.json` with items `E2`, `E5`, `E8`, `E10`, `E11`, `E13`, `E17` present (open unless the owner closed one).
- From `P0-A3`: `KATEX_VERSION` exported by `site/src/lib/katex.ts`, and the recorded mathematics route.
- From `P1-A2`: the build-time commit constant (plan: `import.meta.env.PUBLIC_GIT_COMMIT`, falling back to `"unknown"`).
- From `P0-A1`: `LICENSE` (MIT), `LICENSE-content` (CC BY-SA 4.0, SPDX `CC-BY-SA-4.0`), "SPDX identifiers in both package.json files" (roster wording). Check on `main` which `package.json` files carry a `license` field; 5.10 reads the code licence from the root `package.json`, and if that file has none, read it from whichever of the two files carries it (or from `LICENSE`) and record the source in your decisions fragment (plan).
- From `P5-A3`: `/not-quiver-mutation`; from `P2-A7`: `/open-problem`. From `P0-A5`, `P1-A2`, `P0-A6`: `a11y.spec.ts`, `nojs.spec.ts`, `basepath.spec.ts`, and the root scripts `build`, `preview`, `e2e`, `size`, `report`.
- `SOURCES.md` at the root, defining every key you cite (section 5.2 lists them).

If `Footer.astro`, `[page].astro`, the `pages` collection, the content components or the commit constant are missing, stop and report `blocked` for the part that needs them; do not re-create another agent's component.

## 4. Deliverables

| File | Contents |
|---|---|
| `site/src/content/pages/history.mdx` | frontmatter (5.1); the timeline (5.2) as an ordered list in order of date; the sidebar beside it (5.3); `<Unverified>` around E2, E5, E11, E13 (and E10, E17 where used) statements (5.5); sources |
| `site/src/content/pages/confusions.mdx` | frontmatter (5.1); the three main corrections and three smaller points of Appendix D (5.7); the seven Appendix F statements as corrections (5.8); links to the glossary, `/not-quiver-mutation`, `/history`; no reference to the note |
| `site/src/content/pages/credits.mdx` (extension) | everything already there kept; Wildberger's story and terminology acknowledged prominently; the credit lines of 8.4; every third-party asset and bundled library with title, author, source, licence; the licences of D4 with SPDX; the code-samples sentence; the oracle and own-words rules of 7.9; the borrowings of Appendix F (5.9) |
| `site/src/components/Footer.astro` (extension) | the pinned versions read at build time, the engine version, the site version (git commit), the two licences with SPDX identifiers and a link to `/credits`, no JavaScript (5.10) |
| `site/tests/e2e/pages-6.spec.ts` | the Playwright tests of section 6 |
| `decisions/P6-A6.md` | the fragment of COMMON 5.1 (5.12) |

Nothing else. Proposals for new items of `unverified.json` go in the report (`proposedUnverifiedItems`), never in the file.

## 5. Requirements

### 5.1 Frontmatter and page rules common to the three pages

- Use the `pages` schema found on `main` (`P1-A4`). Set `released: true` on `history.mdx` and `confusions.mdx` (SPEC 7.3: "`history`, `confusions`, the Atlas pages (phase 6)"); keep `credits.mdx` released. Titles (plan): `History`, `Common confusions`, `Credits and licences` (the last from M10's list "credits and licences").
- If the schema has a `draft` field, set `draft: true` on `history.mdx` and `confusions.mdx` (plan: they are pages of M10, whose text the owner approves at G6, SPEC 9.1 G6 owner's part "approval of the text of M6 to M10"; D17). Record the choice.
- Writing rules of 8.4, all of them: plain declarative sentences; define every term on first use and link later uses to its glossary anchor; the site's words (board, node, city, road, population, numbers, mutate, fire, legal, free play); "State the convention whenever a result is quoted from a source that uses another one (section 2.9)"; every theorem-like statement carries its provenance; "Numbers that have a golden value are written with `<G>`, never typed"; "No sentence of the lessons is copied from a source" (7.9 extends this to every sentence, figure and table layout of a paper, preprint or lecture); house style: "no em-dashes; no stock rhetorical contrasts or fashionable filler words; the specific in place of the grand" (D14 default: as proposed).
- Citations by key through `<Cite k="..."/>` only (a key not in `SOURCES.md` fails the build, 7.3).
- Every internal link is built from `import.meta.env.BASE_URL` (7.2 item 10). Follow the pattern the existing content pages use; never type a link with a leading slash.
- The pages contain no tool and no island; they are "a page with no tool" for the 15 kB limit of 7.6, and they read completely without JavaScript (7.4).
- 0.2 item 5 and 9.3: "Anything labelled [U] (unverified) must not be printed on the site as fact until a person has checked it." Every such sentence is wrapped (5.5). Never set an item to `closed`; under D11 (default: the owner) the owner closes items.
- No claim of novelty anywhere (Appendix E item 8, 9.5): do not write that the site is the first of its kind or that nothing like it exists. SPEC 0.4 item 2 and the "nothing was found" sentences of Appendix F rest on searches marked [U] (E17).

### 5.2 `/history`: the timeline (SPEC 3 M10)

The specification, verbatim: "The history page gives the timeline with correct credit, in order of date: Proctor's use of the firing process (1984); the Olympiad problem (1986); Björner's preprint on Mozes' game (1988) and Mozes' paper (1990); Eriksson's papers (1992 to 1996); Wildberger's manuscript and first papers (2001 to 2003); Donnelly (2008); Gashi, Schedler and Speyer (2012); Wildberger's Algebra Colloquium paper (2020). Beside the timeline: Kostant's game as an oral tradition; Satake (1960) and Araki (1962) for the diagrams."

Render the timeline as an `<ol>` whose items appear in that order, each with `data-year="<first year>"` (plan hook; years non-decreasing down the list) and the year or range as visible text. One item per entry below; facts and statuses are from `SOURCES.md`, with its labels.

1. **1984, Proctor** `<Cite k="Pro84"/>`. He used the firing process, firing positive numbers, to compute Weyl group orbits of weights in fundamental-weight coordinates [S2, through Donnelly]. It predates Mozes and is the origin of the sign convention the site uses (SOURCES 11.2; SPEC 2.3 line 189, 2.9 row "Proctor [Pro84]": "fire positive", "identical").
2. **1986, the Olympiad problem** `<Cite k="IMO86"/>`: 27th International Mathematical Olympiad, Warsaw, Problem 3 [S]: five integers with positive sum on a pentagon; a negative middle number $y$ of a consecutive triple $x, y, z$ may be replaced by $x+y, -y, z+y$; the question is whether the process must stop (it must). State the convention: the Olympiad fires negative numbers ($a=-x$; the board is the 5-cycle, 2.9; SPEC 2.12 (line 419): "The 5-cycle is the affine board $\tilde A_4$ [V]", and its numbers game is the 1986 Olympiad problem). The proposer is not named in any source read [U]: do not name one; if you do, wrap the name as `E11` (Appendix E item 11: "The proposer of the 1986 Olympiad problem, if the history page names one.").
3. **1988, Björner's preprint** `<Cite k="Bjo88"/>`, "On a combinatorial game of S. Mozes", unpublished; no public copy found; cited in this form by Proctor, Donnelly, Donnelly and Eriksson, and Wildberger (2020). Eriksson credits Björner with the notion of strong convergence [S].
4. **1990, Mozes' paper** `<Cite k="Moz90"/>`, "Reflection processes on graphs and Weyl groups", *J. Combin. Theory Ser. A* 53 (1990) [S for the bibliographic data and abstract]. The text was not read. Everything about its content is [S2] (later authors: Donnelly 2008; Gashi, Schedler and Speyer 2012) or [U] (theorem numbers, matrix convention, whether it uses the words "numbers game", whether it mentions the Olympiad). Wrap every sentence that relies on Mozes' content in `E2` (roster), with a fallback that stays true, for example a sentence that later authors describe the paper as introducing the game, with no claim about its text. Credit (8.4): "the numbers game is Mozes'". The paper is free to read in Elsevier's open archive under a licence that is not Creative Commons; link it, never re-host it.
5. **1992 to 1996, Eriksson's papers** `<Cite k="Eri92"/>`, `Eri93` (thesis, 1993), `Eri94a`, `Eri94b`, `Eri95a`, `Eri95b`, `Eri96a`, `Eri96b` (cite those you mention). Facts with their labels: [Eri95a] was first presented at the 1992 Montréal conference, "the earliest documented title containing the words "numbers game"" [S]; [Eri95b] is the one freely readable Eriksson paper, read in full [S], source for strong convergence (Definition 1.1, Theorem 1); Eriksson fires negative numbers (2.9). Credit (8.4): "Eriksson's development acknowledged". Theorem numbers in [Eri93] are [S2]; cite them only as "cited by Donnelly and Eriksson as".
6. **2001 to 2003, Wildberger's manuscript and first papers.** The manuscript `<Cite k="W-MS"/>` is **undated**. Cite it exactly as SOURCES 11.1 directs: "unpublished manuscript, undated (circulated c. 2001 to 2004)". Facts [S]: Wildberger cited it as "preprint (2001)" in two preprints and as "in preparation" in the published $G_2$ paper; the PDF metadata date of the project copy is 25 November 2004 (11.9). Never write that the manuscript dates from 2003 (Appendix F, last bullet; 11.9). Put the manuscript in its own element with `data-source="W-MS"` (plan) so the test can read it alone. The first published statements: [W03a] and [W03c] state the mutation game (section 3 of [W03a] with the Mars story) [S]; [W03c] section 2 is "the first published definition of **both** games on directed graphs", crediting the numbers game to Mozes [S]. [W03b] contains neither game; omit it or say so. Credit (8.4): "the mutation game is Wildberger's".
7. **2008, Donnelly** `<Cite k="Don08"/>` (European J. Combin. 29 (2008)) and, if you mention it, Donnelly and Eriksson `<Cite k="DE08"/>` (arXiv:0810.5371, 2008; no journal version found). Donnelly fires positive numbers, following Proctor; his matrix $M$ is the transpose of $C$ (state it if you quote a formula). The arXiv number of [DE08] is 0810.5371, not math/0610702, which is [Don06] (11.9).
8. **2012, Gashi, Schedler and Speyer** `<Cite k="GSS12"/>`, looping of the numbers game on extended Dynkin diagrams [S]; they fire negative numbers ($a=-v$, $C=c^{\mathsf T}$; 2.9). If you mention Gashi and Schedler's earlier paper, its title is "On dominance and minuscule Weyl group elements" `<Cite k="GS11"/>`; the title "On Dynkin and extended Dynkin diagrams via the numbers game" does not exist (11.9).
9. **2020, Wildberger's Algebra Colloquium paper** `<Cite k="W20"/>`, "The Mutation Game, Coxeter-Dynkin Graphs, and Generalized Root Systems", *Algebra Colloquium* 27 (2020), no. 1, 55-78 [S]. It is the citable published source for the mutation game on directed multigraphs (11.1).

Wildberger's lectures (roster: "the lectures (E5 wrapped)"): the three 2018 UNSW seminar abstracts are [S] (titles and dates in SOURCES 11.1) and may be stated; every video title, date, channel and link is [U] (Appendix E item 5: "Open the two channels and list the episodes of "Dynamics on Graphs" with titles, dates and whether each is public. Check every video link in `SOURCES.md` 11.1. Decide which to link.") and is wrapped as `E5`. Spell the name "Mozes" even where a source spells it "Moses" (11.1). 7.9 reads: "Videos are linked or embedded with the platform's own player and never re-hosted." On these pages, link the videos and do not embed them (plan): a platform's player would load a third-party script, and 7.8 says "No third-party script at runtime."

Anything else you add to the timeline follows the same rules; journal data marked [U] in 11.1, 11.2 or 11.4 (for example [Gre07], [Don07b], [Car14] page ranges, [Hec84]) is wrapped as `E10`.

### 5.3 `/history`: beside the timeline

Render as an `<aside>` placed beside the list on wide screens and after it on phones (plan), reflowing at 320 pixels (A-11).

- **Kostant's game as an oral tradition.** No publication by Kostant describing the game was found; the written record starts with teaching notes [S: `Ele16`, `Che17`]. The required wording (8.4) is that the game is "attributed to Kostant", printed unwrapped. The fuller wording SOURCES 11.3 proposes, "attributed to Bertram Kostant, popularised by Allen Knutson and by Alexander Postnikov's 2017 MIT course", rests on Appendix E item 13 ("A. Knutson's MathOverflow answer (thread 171999), for the wording of the attribution") and is wrapped as `E13` with a fallback that keeps only "attributed to Kostant" (roster: "Kostant's game as oral tradition (E13 wrapped)").
- **Satake (1960) and Araki (1962) for the diagrams.** `<Cite k="Sat60"/>`: the diagrams with black nodes, white nodes and arrows are reported to appear on p. 109 [S2]; text not read. `<Cite k="Ara62"/>`: the table of diagrams with restricted-root multiplicities, cited by later papers as pp. 32-33 [S2]; text not read. Say no more about their content than these labels allow. Link to M9 only if the `released` flag lets it through (it does in phase 6 once `P6-A7` merges; build the link the standard way and let the flag decide).

### 5.4 `/history`: credit, conventions, sources

- The four credit clauses of 8.4, verbatim in substance and each visible on the page: "the mutation game is Wildberger's; the numbers game is Mozes', with Proctor's earlier use of the same process and Eriksson's development acknowledged; Kostant's game is "attributed to Kostant"."
- Where an entry quotes a rule, say which sign each source fires (2.3 line 189: "This specification follows Proctor, Donnelly and Wildberger and fires positive numbers. Mozes, Eriksson, the 1986 Olympiad problem and Gashi, Schedler and Speyer fire negative numbers").
- End with a sources list of every key cited (plan: the `Sources` component if it accepts page frontmatter, else a plain list of `<Cite>`s), and a link to `/sources`.

### 5.5 Unverified items on your pages

| Item | Wraps | Fallback (yours to word; it must stay true however the item turns out) |
|---|---|---|
| `E2` | every sentence relying on Mozes' content (theorems, conventions, wording, the Olympiad link) | a sentence that later authors describe the paper as introducing the game |
| `E5` | video lectures: titles, dates, channels, links | a sentence that does not name or link an episode |
| `E11` | the proposer of the 1986 problem, only if named | the entry without a name |
| `E13` | the attribution beyond "attributed to Kostant" | "attributed to Kostant" alone |
| `E10` | journal data marked [U] in SOURCES 11.1, 11.2, 11.4, if printed | the entry without the [U] data |
| `E17` | any other [U] statement you print: the Java applets not running in current browsers (Appendix F), "nothing was found" statements, the Weyl group of $E_8$ and the orthogonal group (5.8) | a weaker sentence, or nothing |
| `E8` | do not write a novelty claim at all; no wrapper needed if none is made | |

`<Unverified>` takes `item`, `fallback` (a plain string) and children; the fallback cannot hold `<Cite>` or `<G>`, so keep components outside the wrapper. A new [U] statement not covered by an item above is proposed in your report (`proposedUnverifiedItems`), never added to the file; you may use the next free id in the page meanwhile (P0-A4 treats an unknown id as open).

### 5.6 Numbers

Every number with a golden value is written with `<G k="..."/>` or `{{path}}` in `<Tex>` (8.4; CONTRACTS 7). Years, page numbers, volume numbers and theorem numbers of sources have no golden value. The one golden number these pages are likely to need is the order of the Weyl group of $E_8$ (`<G k="types.E8.weyl_order"/>`; SPEC Appendix F gives 696729600 [V]); others, if any, through paths of `golden_data.json` (for example `wildberger_lists.names.B3`, whose value is the string `C3 with the node order reversed`). Do not type a golden value.

### 5.7 `/confusions`: Appendix D as general confusions (D16)

D16, verbatim: "Whether to state the three corrections of Appendix D publicly (for example in a short "common confusions" page)", default "yes, as general confusions with no reference to the note". So: the page never names, quotes or alludes to the project note "algebraic data" (no "the note", "a note", "algebraic data", "project"); each confusion is stated in the form "It is sometimes said that ...; in fact ..." (plan wording), with the correction in the site's words and its provenance. Each confusion is a section with `data-confusion="<id>"` (plan hook; ids below). What the note gets right (the firing rule, $x\mapsto x-x_iCe_i$, the condition $x_i>0$, termination on finite type, numbers as weight coordinates, transposition exchanging $B_n$ and $C_n$) needs no correction; do not present it as a confusion.

Main corrections:

1. `board-fixed`: **The board does not change.** In the mutation game a mutation changes only the population of the mutated city; the multigraph is fixed throughout ([W20] sections 2 and 5: "a mutation at A changes only the population of A", a short attributed quotation, 7.9). Reversing arrows and toggling edges between neighbours is an operation modelled on Fomin-Zelevinsky quiver mutation, a different construction with the same name (Appendix D item 1; 2.16), and the mutation game is not its "combinatorial shadow". Link to `/not-quiver-mutation` for the comparison table rather than repeating it.
2. `mutation-rule`: **The mutation rule changes one entry.** The update $x\mapsto x-x_iC^{\mathsf T}e_i$ negates $x_i$ and changes the neighbours: it is the firing move of the numbers game on the reversed board. Wildberger's mutation is $x\mapsto x-(e_i^{\mathsf T}Cx)\,e_i$, that is $x_i\mapsto x_i-\sum_jC_{ij}x_j$, which changes one entry and leaves every neighbour alone ($S_i$ of 2.2).
3. `not-the-same-game`: **The games do not coincide on simply laced boards.** With $C$ symmetric, $R_i=S_i^{\mathsf T}$: the two moves are transposes and different matrices. The correct relations are $CS_i=R_iC$ (translate a population by $a=Cp$ and the moves correspond) and $R_i(C)=S_i(C^{\mathsf T})^{\mathsf T}$ (2.4). Because this section shows $a=Cp$ beside a population, it carries the bridge sentence of 2.4(a) (below). "The mutation game on $C$ is the numbers game on $C^{\mathsf T}$" is true about adjoint actions on dual spaces and false as a statement that the two games have the same positions and moves. Wildberger's own statement of the duality: [W-MS] Proposition 0.3, $p\,s_x\tau=p\,\tau r_x$ with $\tau=A-2I$ (2.4(e)); his dual population records the gain $q=-Cp$, the site records the drop $a=Cp$ (D7 default).

Smaller points:

4. `no-sign-condition`: there is no sign condition on a mutation; any city may mutate. Conditions define variants: only raising moves (Kostant's game), or, on the numbers side, only positive firings.
5. `weyl-group-positions`: the positions reached by the numbers game from a generic start correspond to the elements of the Weyl group; the root system is the set of positions of the mutation game, and appears in the numbers game as the fired values (F6).
6. `lattices`: populations lie in the root lattice, numbers in the weight lattice (not the numbers game on the root lattice and the mutation game on the coroot lattice).

If a section shows populations and numbers together (for example $a=Cp$ beside a population), the bridge sentence of 2.4(a) must appear with exactly this wording [D]: "The number on node $i$ is the amount by which a mutation would lower city $i$." Mathematics goes through the route `P0-A3` recorded (`$...$` under route (a), `<Tex>` under route (b)).

### 5.8 `/confusions`: the statements of Appendix F the site must not repeat

Roster: "the statements of Appendix F the site must not repeat, stated as corrections". State each as a general confusion, in the same form as 5.7, without naming the package (plan, in the spirit of D16; record the choice; see uncertainties in your report if you think the package should be named). The corrections are [V] or standard unless marked.

7. `weight-lattice-formula`: the reflection formula $p_i\mapsto p_i-\sum_jC_{ij}p_j$ acts on root coordinates; the action on weights is the numbers game.
8. `b-c-naming`: Wildberger's lists name $B_n$ and $C_n$ exchanged relative to Bourbaki for rank at least 3 (his "$B_n$" is Bourbaki's $C_n$ with the node order reversed; 2.10; golden `wildberger_lists.names`). A text that says it follows Wildberger's naming may in fact follow Bourbaki's; the site uses Bourbaki's names and numbering.
9. `one-way-not-finite`: a test that reports finite type on a board with a one-way road is wrong: on a one-way road the root set is infinite (2.11; golden `one_way_counterexample`).
10. `roots-positive-or-negative`: "every root is positive or negative" is false on the one-way road; it holds on boards with two-way roads.
11. `positive-definite`: the form is positive definite not only for the $A$, $D$, $E$ boards; the forms of $B$, $C$, $F$, $G$ are positive definite too.
12. `e8-orthogonal-group`: Appendix F lists the statement "that the Weyl group of $E_8$ is isomorphic to an orthogonal group over the field of two elements: the orders differ by a factor of 2 [U as worded here; the order of the Weyl group is 696729600 [V]]", and Appendix E item 17 lists "the remark on the orthogonal group" as [U] as a whole. So the whole correction is [U]: any sentence saying that the Weyl group of $E_8$ is or is not isomorphic to an orthogonal group over the field of two elements, and the comparison of orders, sits inside `<Unverified item="E17">`, with a fallback that makes no claim about the orthogonal group (plan: for example a sentence that this comparison is still being checked), or the section leaves the comparison out. The answer depends on which orthogonal group is meant; do not settle it in your own words. Only the order of the Weyl group of $E_8$ is [V]: print it with `<G k="types.E8.weyl_order"/>` outside the wrapper, never typed and never in the fallback string.
13. `manuscript-date`: Wildberger's manuscript is undated (circulated c. 2001 to 2004); it does not date from 2003. Link to `/history`.

Add, if you wish, the misprints of 2.10 (golden `wildberger_lists.misprints_in_paper_and_manuscript`) as a short "reading Wildberger's lists" note; it is not required.

### 5.9 `/credits`: what 7.9 asks for

`SPEC.md` 7.9, the five bullets, verbatim:

- "Proposed: text and figures under CC BY-SA 4.0 (or CC BY 4.0 for the widest reuse); code under MIT (or Apache-2.0). State both in the footer and in the repository, with SPDX identifiers, and say that code samples shown in the text fall under the code licence."
- "Ideas, rules, theorems and data from the literature are restated in the site's own words with citations. No sentence, figure or table layout is copied from a paper, preprint or lecture, beyond short attributed quotations. Videos are linked or embedded with the platform's own player and never re-hosted."
- "Reference software under GPL or LGPL (SageMath, CoReLG, Atlas, Group Explorer) is used only as a black-box oracle for test data; its source is not translated. The MIT-licensed `mutation-game` package may be read."
- "A credits page lists every third-party asset with title, author, source and licence, and the licences of bundled libraries and fonts."
- "The site should acknowledge N. J. Wildberger's story and terminology prominently. A courtesy message to him before launch is recommended (section 10)."

What the extended page holds, keeping everything `P0-A5` and `P1-A4` put there:

1. **Wildberger first** (prominently: the first section under the title, `data-credit="wildberger"`, plan hook): the story of Martians and anti-Martians on Mars, and of Venus for the dual game, retold with credit (SPEC 1.7 gives the credit as "([W20] section 2; [W-MS] pp. 1 and 30)": cite [W20] section 2 and [W-MS] p. 1 for the Mars story and [W-MS] p. 30 for Venus and the dual game; [W03a] section 3 may be added for the Mars story; D5 default "retell with credit"); the terminology the site takes from him (mutation game, population, city, the dual game); the mutation game is his.
2. **The credit lines of 8.4** (`data-credit="games"`): Mozes for the numbers game, Proctor's earlier use of the same process, Eriksson's development, Kostant's game "attributed to Kostant" (any fuller wording wrapped as `E13`, 5.3); link to `/history`.
3. **Licences** (`data-credit="licences"`): text and figures under the content licence and code under the code licence, each with its SPDX identifier (D4 default: `CC-BY-SA-4.0` and `MIT`), links to `LICENSE` and `LICENSE-content` in the repository (or the licence texts' canonical addresses), and the sentence that code samples shown in the text fall under the code licence. Read the identifiers from the same source as the footer (5.10), never type them twice.
4. **Bundled libraries and fonts** (`data-credit="bundled"`): every package whose code or assets reach the reader (at least the Svelte runtime, `nanostores`, Astro's island runtime, KaTeX's stylesheet and fonts, which are the only font files the site ships, SPEC 6.3 "Typefaces" [D]), each with title, author, source (repository or homepage) and licence, read at build time from the installed package's `package.json` (`name`, `version`, `author` or `contributors`, `repository` or `homepage`, `license`) and, for the KaTeX fonts, the licence as read from the package. How you determine the full set of shipped packages (for example by inspecting the client chunks of a build once) is yours (plan); record the method and the set.
5. **Build and test tools** (`data-credit="build"`): the remaining pinned packages of 7.1 (Astro, `@astrojs/mdx`, `@astrojs/svelte`, TypeScript, Vitest, fast-check, Playwright, `@axe-core/playwright`, and the mathematics packages of `P0-A3`'s route) with their licences as read, never from memory: print exactly what each installed package's `license` field says, and do not assume that every package is MIT (plan).
6. **Prior art and borrowed ideas** (`data-credit="prior-art"`): Appendix F calls its "Borrow" and "avoid" columns "design notes"; the roster asks for "prior art to credit where borrowed". Go through **every** row of Appendix F whose "Borrow" cell is not empty, check each against what the built site actually does, and credit the work when the site borrows that idea (plan: a row whose idea the site did not take is left out, and the decision is recorded row by row in `decisions/P6-A6.md`). The rows with a non-empty "Borrow" cell, as SPEC.md gives it:
   - "ADE Concurrent Game": "edit and play modes, undo, visible history, "play to the end"". Attribution: Appendix F places it "on Wildberger's UNSW pages under the name of T. S. Hoang (the documentation, which names no author, is dated 25 November 2004 ...)". Credit it in those terms (plan: for example "the ADE Concurrent Game, hosted on N. J. Wildberger's UNSW pages under the name of T. S. Hoang"), never as "by T. S. Hoang" or with any stronger claim of authorship, and do not add a date or role that Appendix F does not give. In the author field that 7.9 asks for, write that attribution phrase rather than a bare name (plan).
   - GEOMETOR "Mutation Explorer" (2021; MIT): "a first proof that the game works in a browser". Credit it as earlier browser work on the game if the page mentions earlier browser versions at all (plan); the site borrows no code from it.
   - `mutation-game`, A. Cortis (April 2026; MIT; version 0.1.5): "the shape of the API; the pairing of code with background chapters". Credit it only if something was borrowed from it.
   - cut-the-knot page for the pentagon problem: "the puzzle as an entry point". Credit it if the site opens with the Olympiad puzzle (the history entry of 1986 or a lesson does).
   - B. Keller, quiver mutation applet: "the interaction model: click a node, see history".
   - Langlands Programs preview, Coxeter apps: "proof that a TypeScript engine carries serious Coxeter computations". This is an inspiration, not a borrowed feature; credit it only if the project took it as such, and say so in those terms (plan).
   - Group Explorer 3 (LGPL): "several linked views of one object"; no LGPL code copied.
   - SimpLie (T. Nutma; GPL): ""diagram in, structure out"; LaTeX export".
   - Stembridge's Coxeter plane pictures; Vogan's explanation of the $E_8$ picture: "the canonical picture and the plain-language edge rule" (the rule "join each root to its 56 nearest neighbours"); the images are not copied.
   - Stella4D; Jenn3d; Polyhedra Viewer; vZome: "projection with section views; objects linked by operations; replayable construction history". Credit each one whose idea the site's polytope or history views actually take; none of their code is used.
   - CoReLG (GAP): "an external oracle for section 6.4"; credit under item 7 (oracle), not as a borrowing, and only if it was used.
   - `dynkin-diagrams` (LaTeX; LPPL): "the export target of section 6.7".
   - SageMath root systems and crystals: "an external oracle that needs no translation of conventions"; credit under item 7, only if it was used.

   Statements about these works that Appendix F marks [U] (the applets do not run in current browsers; the licence of CoReLG; "nothing was found") are wrapped as `E17` or left out. Copy each title and author exactly as Appendix F writes it.
7. **Reference software as oracle** (`data-credit="oracle"`): the sentence of 7.9 on GPL and LGPL software used only as a black-box oracle; the site's golden data come from the project's own reference implementation (`reference/lie_games.py`, `verify.py`), not from third-party code.
8. **Statistics** (plan, optional): D13 default is "none"; 7.8 says that if visit counts are wanted the site uses a cookie-free counter "and say so on the site". With the default, either say nothing or say that the site collects no visit statistics; never add a counter or any third-party script.

The courtesy message to Wildberger (D6) is the owner's act; the page does not mention it.

### 5.10 `Footer.astro`: versions, site version, licences

- The rule, `SPEC.md` 7.2 verbatim: "Rule: commit the lockfile, pin exact versions in `package.json`, and record the versions in the footer of the built site." And 7.9: state both licences "in the footer and in the repository, with SPDX identifiers".
- Versions are read at build time, never typed: the exact pins of `site/package.json` and the root `package.json` for the packages of the 7.1 table (`astro` 7.3.8, `@astrojs/mdx` 8.0.3, `svelte` 5.57.2, `@astrojs/svelte` 9.0.1, `typescript` 6.0.3, `nanostores` 1.5.5, `vitest` 5.0.3, `fast-check` 4.10.2, `@playwright/test` 1.64.0, `@axe-core/playwright` 4.13.0, as the specification lists them on 9 October 2026; print what the files say), plus `katex` through `KATEX_VERSION` (from `site/src/lib/katex.ts`), plus the engine's `version` from `packages/engine/package.json` (plan, as `exportJSON` does). A package of the list that is absent is left out, not shown as a blank.
- Site version: the git commit (7.4 "Citing": "the site version (git commit)"), from the build-time constant of `P1-A2` (plan: `import.meta.env.PUBLIC_GIT_COMMIT`, fallback `unknown`). Show a short form (plan: the first 12 characters) with the full value in a hook.
- Licences: the code licence from the root `package.json` `license` field (`MIT`), the content licence from `LICENSE-content` (the SPDX identifier it carries, `CC-BY-SA-4.0` under the D4 default); if the file names no recognisable identifier, fail the build with a clear message (plan), so that a change of D4 by `GATE` flows into the footer and the credits page together. A link to `/credits`.
- Layout (plan): one short line (licences, site version, a link to credits) and a `<details>` element "Versions" holding the list, so the footer stays small on a phone; `<details>` works without JavaScript. Keep whatever links and landmarks `P0-A5` and `P1-A4` put in the footer.
- No `<script>`, no island, no client directive: the footer is part of every page's shell and counts toward the 15 kB limit of a page with no tool (7.6). No third-party request (7.8).
- Hooks (plan; the footer is not a tool, so these are page hooks for your spec): `data-site-footer` on the `<footer>` content root; `data-dep="<package name>"` with `data-dep-version="<version>"` on each version entry; `data-commit="<full commit>"`; `data-licence="content"` and `data-licence="code"` with the SPDX identifier as text. Do not use `data-footer`, which `P2-A6` gives to the footer group of exported SVG.
- Every page renders the footer: the index, lessons, content pages, tool pages and the Atlas pages, through the layouts. If a layout on `main` does not include `Footer.astro`, do not edit the layout (it is `P1-A4`'s or `P0-A5`'s): report it under `requests` to `MERGE`. The embed routes of `P6-A5` render a tool alone for an `<iframe>` (7.4 "Embedding"); the footer is not required there (plan).
- Contrast and reflow: footer text meets 4.5 to 1 in both themes using the existing tokens (A-6; CONTRACTS 8), and reflows at 320 pixels (A-11). Styles go in the component's own `<style>` block.

### 5.11 Accessibility of the three pages

Headings in order (one `h1` from the layout), the timeline as a real list, the sidebar as an `<aside>` with a heading, links with meaningful text, no information by colour alone (A-5), contrast (A-6), reflow at 320 pixels (A-11), mathematics through KaTeX with MathML (A-12). axe reports no serious or critical violation (7.7).

### 5.12 Decisions fragment

`decisions/P6-A6.md`, one dated entry each: the D4 default used (licences, SPDX) and where the identifiers are read; the D5 default (Mars story retold with credit); D11 (owner checks the items your pages wrap); D13 (no statistics; whether the credits page says so); D14 (house style as proposed); D16 (general confusions, no reference to the note; whether the package of Appendix F is named); D17 (whether the two new pages carry `draft: true`); the page titles; the hooks you added; the method that determined the bundled packages and the resulting set; each Appendix F row with a "Borrow" cell, credited or left out, with the reason (5.9 item 6); the source of the code licence identifier (section 3); how the footer reads versions, the commit and the licences; the decision not to render the footer on embed routes, if taken; every `<Unverified>` item used, with its page.

## 6. Acceptance

Each line: the condition, its source, the test (all in `site/tests/e2e/pages-6.spec.ts` unless named otherwise), the gate. Tests read the built HTML, `data-*` hooks and page text.

- [ ] `/history`, `/confusions`, `/credits` render without JavaScript with all their text, the timeline list and the sidebar. Roster deliverable "the pages render without JavaScript"; SPEC 7.4. `pages-6 > the three pages render without JavaScript`; `nojs.spec.ts` (P1-A2) after merge. G6.
- [ ] axe: no serious or critical violation on the three pages, in light and dark themes (plan for the themes). Roster deliverable "pass axe"; SPEC 7.7. `pages-6 > the three pages pass axe`; `a11y.spec.ts` (P0-A5) after merge. G6 (full accessibility scan).
- [ ] The timeline lists the nine entries of M10 with their citation keys (Pro84, IMO86, Bjo88, Moz90, an Eriksson key, W-MS and W03a or W03c, Don08, GSS12, W20) in order of date (`data-year` non-decreasing). SPEC 3 M10. `pages-6 > history timeline is complete and in order of date`. G6.
- [ ] Beside the timeline: Kostant's game with the words "attributed to Kostant", and Satake (1960) and Araki (1962) with `Sat60` and `Ara62`. SPEC 3 M10; 8.4. `pages-6 > history sidebar`. G6.
- [ ] Credit is accurate: the page credits the mutation game to Wildberger, the numbers game to Mozes, Proctor's earlier use and Eriksson's development, and Kostant's game as "attributed to Kostant"; the credits page says the same. SPEC 8.4; roster trap. `pages-6 > credit lines on history and credits`; RT-08 rereads. G6.
- [ ] The manuscript is undated: its element (`data-source="W-MS"`) contains "undated" and not "2003". SPEC Appendix F; SOURCES 11.9; roster trap. `pages-6 > the manuscript is undated`. G6.
- [ ] Every [U] date or attribution is wrapped: in a preview build, `/history` carries `data-unverified="E2"`, `"E5"`, `"E13"` (and `"E11"` if a proposer is named); every Mozes-content sentence sits inside an `E2` wrapper. Roster acceptance "every [U] date or attribution wrapped (RT-08)"; Appendix E items 2, 5, 11, 13. `pages-6 > open items are wrapped on history`; RT-08. G6.
- [ ] A release build succeeds and its open-items report lists `/history` under `E2`, `E5`, `E13` (and every other item used on your pages). SPEC 7.3, 9.1 G6. Run `RELEASE=1 npm run build` once and read `reports/open-items-report.json`; paste the lines in the report (the command is yours, the test is `content-components.test.ts` of P0-A4 for the mechanism). G6.
- [ ] No reference to the project note on `/confusions`: the built text contains none of `algebraic data`, `the note`, `project note`, and no name of the package of Appendix F (plan). Roster acceptance "no reference to the project note on the confusions page (D16)"; D16. `pages-6 > confusions makes no reference to the note`. G6.
- [ ] `/confusions` carries the six corrections of Appendix D and the seven statements of Appendix F as corrections (`data-confusion` ids of 5.7 and 5.8, thirteen in all). Roster deliverable; Appendix D, F. `pages-6 > confusions covers Appendix D and F`. G6.
- [ ] The Weyl group order on `/confusions` comes from `<G>` (`data-golden="types.E8.weyl_order"`), outside any wrapper; every mention of the orthogonal group in the `e8-orthogonal-group` section (the isomorphism claim or its denial, and the comparison of orders) lies inside the `data-unverified="E17"` wrapper, or the section does not mention the orthogonal group at all. SPEC 8.4, Appendix E item 17, Appendix F. `pages-6 > golden number and E17 on confusions`. G6.
- [ ] `not-the-same-game` states $CS_i=R_iC$ with the gloss on translating a population by $a=Cp$, and carries the bridge sentence of 2.4(a) verbatim. SPEC Appendix D item 3, 2.4(a). `pages-6 > confusions bridge sentence`. G6.
- [ ] `/credits`: Wildberger's story and terminology acknowledged in the first section (`data-credit="wildberger"` precedes every other `data-credit`); the licences with SPDX identifiers equal to those in `LICENSE-content` and the root `package.json`; the code-samples sentence. SPEC 7.9. `pages-6 > credits acknowledges Wildberger first and states the licences`. G6.
- [ ] `/credits` lists every bundled library and font with title, author, source and licence, and every pinned build package with its licence as read from its `package.json`. SPEC 7.9. `pages-6 > credits lists bundled libraries with title, author, source, licence` (the test reads the installed `package.json` files for the expected set of 5.9 items 4 and 5). G6.
- [ ] `/credits` has a `data-credit="oracle"` section containing the 7.9 sentence that GPL and LGPL reference software is used only as a black-box oracle for test data and its source is not translated. SPEC 7.9 bullet 3. `pages-6 > credits states the oracle rule`. G6.
- [ ] `/credits` has a `data-credit="prior-art"` section; every Appendix F row recorded as credited in `decisions/P6-A6.md` appears there with title and author as Appendix F writes them (the ADE Concurrent Game under the attribution phrase of 5.9 item 6, never "by T. S. Hoang"), and every [U] statement of Appendix F printed there sits inside an `E17` wrapper. SPEC 7.9 bullet 4, Appendix F, Appendix E item 17. `pages-6 > credits lists borrowed prior art` (the test reads the credited rows from a list you export alongside the page, plan). G6.
- [ ] Every third-party asset that is not a package (a linked or embedded video, an image, a borrowed figure layout, if any) is listed on `/credits` with title, author, source and licence, and no video is re-hosted. SPEC 7.9 bullets 2 and 4. `pages-6 > third-party assets are credited and no video is re-hosted`: the test scans the built HTML of every page and the content collections for `<iframe`, `<video`, links to `youtube`, `youtu.be` or `vimeo`, and image files outside the `site/public` icons (plan method); each asset found must appear on `/credits` with title, author, source and licence, and no video file (`.mp4`, `.webm`, `.mov`) may exist in `site/public` or the build output. G6.
- [ ] The footer shows the pinned versions and the site version on every page type (index, a lesson, `/tools/board`, `/history`, `/credits`, an Atlas page if present): each `data-dep-version` equals the `version` of the installed package (read in the test from `node_modules/<name>/package.json`), `katex` equals the installed KaTeX, `data-commit` equals `git rev-parse HEAD` of the built tree or `unknown`. Roster deliverable "the footer shows the versions"; SPEC 7.2 closing rule. `pages-6 > footer shows the versions and the commit`. G6.
- [ ] The footer states both licences with SPDX identifiers on every page type. SPEC 7.9. `pages-6 > footer states both licences`. G6.
- [ ] The footer and the three pages load no script of their own: no `<script>` in the footer markup, and the three pages fetch only the shell. SPEC 7.6 (15 kB for a page with no tool). `pages-6 > the three pages load no tool script` (plan); `npm run size` by `MERGE` and `GATE`. G6 (sizes on every page).
- [ ] No em-dash (U+2014) in the built text of the three pages or the footer. SPEC 8.4; COMMON 4.4. `pages-6 > no em-dash`. G6; RT-08.
- [ ] Internal links on the three pages resolve and honour `BASE_URL`. SPEC 7.2 item 10. `pages-6 > links resolve`; `basepath.spec.ts` (P0-A6) after merge. G6.
- [ ] The build fails on no `<Cite>` key or `<G>` path of yours (every key resolves). SPEC 7.3, 7.7 Content row. `npm run build` passes. Every merge.
- [ ] Type checks pass (`npx astro check`, `npx svelte-check` or the configured commands). COMMON 4.3. Command summaries in the report. Every merge.
- [ ] Owner's part, not automated: the items of Appendix E your pages wrap (2, 5, 11, 13 and any other) are closed or their fallbacks read and accepted; approval of the text of M10's pages. SPEC 9.1 G6 owner's part. Report as `not-automated`, gate G6.

## 7. Files

- **You own** (the roster's list, exactly):
  - `site/src/content/pages/history.mdx, confusions.mdx, credits.mdx (extension)`
  - `site/src/components/Footer.astro (versions)`
  - `site/tests/e2e/pages-6.spec.ts`
  - `decisions/P6-A6.md`
- **You may edit with the stated protocol**: `credits.mdx` and `Footer.astro` additively: keep every element `P0-A5` and `P1-A4` put there (links, landmarks, the generated dependency list), extend rather than replace, and say in your report what you changed. Styles only inside your own files' `<style>` blocks.
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, root `package.json` and the lockfile, `site/package.json`, `LICENSE`, `LICENSE-content`, `CLAUDE.md` (GATE only, on the owner's instruction), `site/src/layouts/*`, `site/src/components/Nav.astro`, `site/src/components/lesson/*`, `site/src/content.config.ts`, `site/src/pages/*` (P1-A4, P1-A2, P6-A4, P6-A5), `site/src/content/pages/about.mdx`, `glossary.mdx` (P1-A4; `P6-A8` completes the glossary), `open-problem.mdx`, `not-quiver-mutation.mdx`, every lesson, `site/src/components/content/*`, `site/src/lib/*` (including `katex.ts` and `export.ts`), `site/src/content/unverified.json` (never add or close an item), `site/src/styles/*`, `scripts/*`, `nojs.spec.ts`, `a11y.spec.ts`, `basepath.spec.ts`, other agents' tests, `build-plan/`.

## 8. Order of work

1. Confirm worktree and branch (`git rev-parse --show-toplevel`, `git branch --show-current`); `node --version` at least 22.12; `npm ci --prefer-offline` if `node_modules` is absent. Read the files of section 2 item 13 on `main`. Check that the inputs of section 3 exist; if not, report `blocked` for that part.
2. `Footer.astro` first (it is on every page and other agents' pages pick it up at merge): versions, commit, licences, hooks. `npm run build`; inspect the footer in `site/dist/index.html` and one tool page. Write the footer tests of `pages-6.spec.ts`; run them. Commit: `P6-A6: version and licence footer`.
3. `credits.mdx` extension (5.9), reading the licence identifiers from the same source as the footer. Build, test, commit.
4. `history.mdx` (5.2 to 5.5), entry by entry against SOURCES 11.1 to 11.4 with the labels beside you; then the history tests. Commit.
5. `confusions.mdx` (5.7, 5.8); then its tests. Commit.
6. One preview build with `BASE_PATH=/sub/path/` to check your links, one release build (`RELEASE=1 npm run build`) to read the open-items report. Run only your spec (`npx playwright test site/tests/e2e/pages-6.spec.ts`), one Playwright run at a time; kill `astro preview` afterwards. Type checks. Fragment; final commit; report.

## 9. Traps

- **The manuscript date.** Wildberger's manuscript is undated (11.9); the "2003" in the `mutation-game` documentation is wrong (Appendix F). Place it in the 2001 to 2003 entry as "unpublished manuscript, undated (circulated c. 2001 to 2004)", never as a 2003 work.
- **Credit (8.4).** The numbers game is Mozes', with Proctor's earlier use and Eriksson's development acknowledged; Kostant's game is "attributed to Kostant". Do not credit the numbers game to Eriksson or to Proctor, nor Kostant's game to Kostant without "attributed to".
- **Mozes was not read.** Theorem numbers, his matrix convention and whether he says "numbers game" are [U] (E2). Later authors' reports are [S2]: say "reported by", never "Mozes proves in Theorem ...".
- **Sign conventions.** The Olympiad, Mozes, Eriksson and Gashi, Schedler and Speyer fire negative; Proctor, Donnelly and Wildberger fire positive (2.3). Quoting a rule from a fire-negative source without saying so is an error under 8.4. Donnelly's matrix is the transpose of $C$.
- **Corrected citations (11.9).** [DE08] is arXiv:0810.5371 (math/0610702 is [Don06]); there is no Gashi and Schedler paper titled "On Dynkin and extended Dynkin diagrams via the numbers game"; Donnelly's 2007 preprint was retitled. Wildberger's seminar abstract spells "Moses"; the site writes "Mozes".
- **[W03c] misprints the dimension of $F_4$ as 56 for 52** (2.10). Do not repeat it if you quote that paper.
- **D16 is about wording, not omission.** The corrections are stated, generally. Any phrase that points at a particular document ("a note", "an earlier description of this project") breaks D16; the test looks for the obvious strings, RT-08 reads the rest.
- **Do not duplicate `/not-quiver-mutation`.** `P5-A3` already holds the comparison table of 2.16 and words the quiver side of Appendix D; link to it.
- **Golden numbers.** The order of the Weyl group of $E_8$ is a golden value: `<G>`, never typed, and never inside a `fallback` string. Years and page numbers of sources are not golden values.
- **`fallback` is a string.** `<Cite>`, `<G>` and markup cannot go inside it; keep them outside the wrapper.
- **Versions are read, not typed.** The footer test compares with the installed packages; a typed "7.3.8" passes today and lies after the next upgrade. The KaTeX version depends on `P0-A3`'s route (0.16.x under route (a), 0.19.x under route (b)); use `KATEX_VERSION`.
- **Licences are read, not typed.** D4 is open; if the owner chooses CC BY 4.0 or Apache-2.0, `GATE` replaces the licence files, and the footer and credits must follow without an edit. Read licences of dependencies from their `package.json`, never from memory (some are not MIT).
- **Hook names.** `data-footer` is taken by `P2-A6`'s exported SVG footer; use `data-site-footer`.
- **The footer is in every page's 15 kB shell.** No script, no island, no import that pulls client code. A `<details>` element needs no JavaScript.
- **Embed routes.** A tool rendered alone for an `<iframe>` (P6-A5) need not carry the site footer; do not edit `embed/[tool].astro`.
- **`released` flag.** Links to M9, M10 and the Atlas appear only when their targets are released; build links the standard way and let the flag drop them. Set `released: true` on your two new pages, or nothing will link to them.
- **Em-dashes in pulled text.** Author strings or titles read from a `package.json` may contain an em-dash; the no-em-dash test covers the built page. Print only name, author, source and licence; if an author string contains U+2014, replace it with a comma (plan) and record it.
- **No novelty claims and no "nothing like it exists"** on any page (E8; Appendix F's searches are [U]).
- **Shell rules (COMMON 4.6).** Absolute paths, no `cd` chains, no inline multi-line scripts.

## 10. Report

The JSON of `COMMON.md` 5.2. In addition:

- `acceptance`: one line per checklist item of section 6, with the test name or the command and its output.
- `unverifiedUsed`: every `<Unverified>` item on your pages with its page and fallback, for example `{"item": "E2", "page": "/history", "fallback": "..."}`.
- `footerVersions`: the list printed by the footer in your build (package, version), the commit shown, and the two licence identifiers.
- `bundledPackages`: the set of shipped packages listed on `/credits` and the method used to determine it.
- `layoutsWithoutFooter`: any page type that does not render `Footer.astro`, as a request to `MERGE`.
- `requests`: to `P6-A8`, the slugs and titles of your pages for the M10 hub; to `MERGE`, anything in a layout or schema you could not change.
