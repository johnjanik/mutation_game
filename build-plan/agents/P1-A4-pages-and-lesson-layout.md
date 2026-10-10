# P1-A4: Glossary, sources page, open-items page, about and credits, lesson layout components, released flag

Phase 1, stage 1.1. Size M (the roster `rosters/phase-1.json` says M; the table of `README.md` section 4 says S; the roster is the current truth). Runs in: a worktree on branch `agent/P1-A4`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

## 1. Objective

When you are done the site has the non-lesson pages of phase 1 and the frame every lesson is written into. The glossary (seeded from Appendix C), the sources page (generated from `SOURCES.md`, sections 11.1 to 11.6 only), the open-items page (generated from `content/unverified.json`, preview builds only), and the extended about and credits pages exist as routes, so that `<Cite>` links and `<Unverified>` marks have somewhere to point from the first lesson on (`SPEC.md` 7.3). The content collections `modules` and `pages`, the module route and index, the `Lesson.astro` layout with the anatomy of 8.2, and the lesson components `Beat`, `Seen`, `LieTheory`, `Challenge`, `ModuleLinks`, `Sources` and `DraftMark` are what the lesson agents `P1-A8` (M0) and `P1-A9` (M1) build on in stage 1.3 and every later lesson copies. The `released` flag of 7.3 is honoured everywhere a link is rendered.

## 2. Read first, in this order

1. `SPEC.md` 7.3 (lines 1774 to 1823), **in full**: the layout tree; the paragraph "Pages other than lessons and tools" (which page appears in which phase, the `released` flag); the paragraph "The sources page"; the four content components (you link to their targets and must understand `<Cite>` and `<Unverified>` exactly).
2. `SPEC.md` 8.2 (lines 1929 to 1940), **in full**: the anatomy of a lesson page, its eight items, the word count, the 66-character column, tools full width on phones.
3. `SPEC.md` 8.1 (lines 1908 to 1927), 8.4 (lines 1950 to 1959), 8.5 (lines 1961 to 1973), in full: principles, writing rules (they bind every sentence you write), the seven patterns of predictions and challenges (your `Challenge` component expresses "Reach a target", "Reach by raising", "Find a counterexample", "Classify" and "Explain"; "Predict a number" and "Predict a yes or no" are the tools' `prediction` configuration of 4.0, line 1048; see 5.10).
4. `SPEC.md` 9.2 (lines 1996 to 2000), the lesson paragraph: the definition of done your layout and components make checkable. 9.1 (lines 1977 to 1994): the phase 1 row; the G0 row (a preview build and a release build both succeed); and every row whose owner's part names items of Appendix E, which is the "gate" the open-items page shows per item: G2 (item 6), G3 (items 2 and 3), G4 (items 7 and 9), G6 ("Every item of Appendix E not settled at an earlier gate, items 1, 4, 5 and 8 first") and phase 7 (item 9 for the golden folding). The G0 row names no item of Appendix E.
5. `SPEC.md` Appendix C (lines 2300 to 2331), **in full**: the 26 rows and four columns of the glossary.
6. `SPEC.md` Appendix E (lines 2355 to 2377): what the open-items page lists, and how items are numbered (`E4`).
7. `SPEC.md` 3: the introduction (lines 747 to 751, the anatomy reference and the phases of the modules), M0 (lines 753 to 773, as a reference for what a lesson places), M10 (lines 1011 to 1015: the sources page, glossary, credits and licences belong to the reference module).
8. `SPEC.md` 7.4 (lines 1825 to 1833): "Citing" (what "Copy link" and "Cite" give; the Cite text itself is `P6-A5`'s) and "Without JavaScript" (every page reads completely without JavaScript).
9. `SPEC.md` 10 (lines 2042 to 2073): D1 (working title), D4 (licences), D5 (Mars story retold with credit), D14 (house style), D15 (the open-problem page, served by your `[page].astro` in phase 2), D16 (the confusions page, served by it in phase 6), D17 (the draft mark).
10. `SPEC.md` 7.9 (lines 1896 to 1904), 1.1, 1.4, 1.7 (lines 75 to 135): what about and credits say. 0.3 (lines 34 to 46): the provenance labels the sources page spells out.
11. Reference only: 7.2 item 10 and the closing rule (lines 1770 to 1772: base path; versions in the footer); 7.5 A-1, A-2, A-4, A-11, A-12 (lines 1835 to 1853); 7.6 (lines 1855 to 1870: the 15 kB row and its "shell: navigation, theme switch, the highlight store"; `client:idle` and `client:visible`); 7.7 (lines 1872 to 1886: the Accessibility, Content, Without JavaScript and Links rows); 6.1 "Size on screen" (line 1597: below 400 pixels the board's box runs edge to edge); 4.0 "Test hooks" (line 1057); 6.6 (lines 1672 to 1715: the bare keys on `/tools/...` routes, used by the sandbox link).
12. `SOURCES.md`: 11.0 (lines 11 to 21) for the meaning of the labels; skim 11.1 to 11.6 (lines 23 to 317) for the shapes you must render (keys at the start of a paragraph, at the start of a list item, and mid-line; `$...$`; `<https://...>` autolinks; label variants such as `[V: ...]`, `[S, page image]`, `[V; section 2.10]`); 11.7 to 11.9 (lines 319 to 338) are what must not be published.
13. `CONTRACTS.md` 7 in full (frontmatter, imports, lesson components, islands, numbers) and 4 (`katex.ts`: `renderTex`; `golden.ts`; `urlCodec.ts`: `encodeState`, used for the sandbox link; `highlight.ts`, part of the shell). `CONTRACTS.md` 1 (path aliases; `siteAndBase` normalises `base` to begin and end with `/`), 5.1 (`ToolFrame` hooks your `Challenge` reads), 5.2 (common tool props, the registry), 6 (tool ids), 8 (CSS custom properties), 10.
14. On `main` before writing: `decisions/P0-A3.md` (the mathematics route; whether `$...$` works in MDX or every formula goes through `<Tex>`; whether `@astrojs/markdown-remark` is installed), `decisions/P0-A4.md` and `site/src/lib/sources.ts` (the API `keys()`, `hasKey(k)`, `entry(k)`, `citeTitle(k)`, `SourcesKeyError`; the anchor contracts `sources#<key>` and `open-items#<id>`), `site/src/lib/unverifiedRegistry.ts` (`isReleaseBuild()`, `itemById`, the item shape `{ id, status, statement, whereToCheck, gate, closedOn?, closedBy? }`), `decisions/P0-A5.md`, `site/src/layouts/Base.astro`, `site/src/pages/about.astro` and `credits.astro` (the phase-0 versions you convert), `site/tests/e2e/nojs-phase0.spec.ts` and `a11y.spec.ts` (what they assert on `/about/` and `/credits/`), `site/astro.config.mjs` (the `markdown` key, `trailingSlash`, `base`).

There is no oracle function and no golden key for this task.

## 3. Inputs you depend on

On `main` when you start (merged at G0):

- From `P0-A3`: `site/src/lib/katex.ts` with `renderTex(src: string, display: boolean): string` and `KATEX_VERSION`; the KaTeX stylesheet link in `Base.astro`; the route decision in `decisions/P0-A3.md`; the kept page `site/src/pages/dev/math-check.mdx` marked `released: false` (a real unreleased target your link tests can use).
- From `P0-A4`: `G`, `Tex`, `Unverified`, `Cite` from `@components/content`; `site/src/lib/sources.ts`; `site/src/lib/unverifiedRegistry.ts`; `site/src/lib/golden.ts`; `site/src/content/unverified.json` with E1 to E17, all `open`.
- From `P0-A5`: `site/src/layouts/Base.astro` (head, `base.css`, KaTeX link, skip link to `#main`, an inline `<nav>` and `<footer>` with links to index, about and credits, `<main id="main">`, no `<script>`); the phase-0 `about.astro` and `credits.astro` (credits generates its dependency list at build time from the three `package.json` files and the installed packages); `site/src/lib/a11y.ts`.
- From `P0-A1` and `P0-A6`: the aliases `@components/*`, `@lib/*`; the root Vitest configuration covering `site/tests/unit`; `playwright.config.ts` (preview server, `baseURL` with `BASE_PATH`); `@axe-core/playwright`; `scripts/size.mjs` behind `npm run size`; `basepath.spec.ts`.

Built in parallel with you in stage 1.1, and therefore not on `main`: `P1-A2`'s `state.ts`, `urlCodec.ts`, `ToolFrame.svelte`, `tools/index.ts`, `tools/types.ts`; `P1-A3`'s `ThemeSwitch.svelte` and `tokens.css`; `P1-A1`'s engine phase 1. Build against `CONTRACTS.md` as if they were there; do not re-implement them, and do not import a file that does not exist on your branch (section 5.11 says how each gap is bridged). If something from G0 listed above is missing, stop and report `blocked`.

## 4. Deliverables

| File | Contents |
|---|---|
| `site/src/content.config.ts` | Collections `modules` (`src/content/modules/*.mdx`) and `pages` (`src/content/pages/*.mdx`) with the strict frontmatter schemas of 5.1 |
| `site/src/content/pages/glossary.mdx` | The glossary: one entry per row of Appendix C, four columns, the site's words first, an anchor per term (5.4) |
| `site/src/content/pages/about.mdx` | The about page converted from `P0-A5`'s `about.astro` and extended (5.7) |
| `site/src/content/pages/credits.mdx` | The credits page converted from `P0-A5`'s `credits.astro` and extended (5.8) |
| `site/src/pages/[page].astro` | One route per entry of the `pages` collection, on `Page.astro` (5.2) |
| `site/src/pages/modules/[slug].astro` | One route per entry of `modules`, on `Lesson.astro`, released or not (5.2) |
| `site/src/pages/modules/index.astro` | The module index: released modules only, in order of `module` (5.3) |
| `site/src/pages/sources.astro` | The sources page from `SOURCES.md` (5.5) |
| `site/src/pages/open-items.astro` | The open-items page, preview builds only (5.6) |
| `site/src/layouts/Page.astro` | Layout of a non-lesson page on `Base.astro`; renders the generated dependency table when the frontmatter asks for it (5.8) |
| `site/src/layouts/Lesson.astro` | Layout of a lesson with the anatomy of 8.2 (5.9) |
| `site/src/components/Nav.astro`, `Footer.astro` | Site navigation and footer, released targets only (5.11) |
| `site/src/components/lesson/Beat.astro`, `Seen.astro`, `LieTheory.astro`, `Challenge.svelte`, `ModuleLinks.astro`, `Sources.astro`, `DraftMark.astro`, `index.ts` | The lesson components of CONTRACTS 7 (5.10) and their barrel |
| `site/src/lib/pages/released.ts`, `sourcesMarkdown.ts`, `challengeCheck.ts` (plan; see 7) | Pure helpers, so the logic is unit-testable without `astro:content` |
| `site/tests/unit/sources-page.test.ts`, `glossary.test.ts`, `released.test.ts` | Unit tests (6) |
| `site/tests/unit/challenge.test.ts` (plan; own test under README 4) | Unit tests of the check evaluator |
| `site/tests/e2e/pages.spec.ts` | Playwright against the built site (6) |
| deletion of `site/src/pages/about.astro` and `credits.astro` | The conversion to content pages that README 6 gives you |
| `decisions/P1-A4.md` | Your decisions fragment (5.13) |

## 5. Requirements

### 5.1 Content collections (`content.config.ts`)

- Astro 7 content layer: read `node_modules/astro` types for `defineCollection`, the `glob` loader and `z` before writing (COMMON 3). Collection ids are the file names without extension (`m0-start`, `glossary`).
- `modules` schema, from CONTRACTS 7 (plan names), strict, so that a field the schema does not know fails the build (`P1-A8` and `P1-A9` rely on this): `title` (string), `module` (integer 0 to 10), `question` (string), `phase` (integer 1 to 6), `released` (boolean), `draft` (boolean; D17: "Claude Code drafts each lesson from sections 2 and 3 and the figure tables, marked as a draft on the page; the owner edits and approves before the release that contains it"; plan: default `true`), `outcomes` (array of `LO1` to `LO10`, 1.3), `sources` (array of strings, each checked with `hasKey` from `sources.ts`; an unknown key fails the build naming it, plan).
- `pages` schema (plan), strict: `title` (string), `phase` (integer 0 to 7), `released` (boolean, 7.3: "driven by a `released` flag in each page's front matter"), optional `description` (string), optional `generated` (`'dependencies'` only; 5.8). Later page agents (`P2-A7` open-problem, `P5-A3` not-quiver-mutation, `P6-A6` history and confusions) write to this schema; record it in your fragment.
- No two collections or static pages may produce the same route; `glossary`, `about`, `credits` and later page slugs must never equal `sources`, `open-items`, `modules`, `tools`, `atlas`, `embed`, `index` (plan; test in `released.test.ts`).

### 5.2 Routes `[page].astro` and `modules/[slug].astro`

- 7.3 layout: `pages/` holds `index.astro`, `modules/[slug].astro`, `tools/[tool].astro`, `atlas/[board].astro`, `embed/[tool].astro`, `sources.astro`, `open-items.astro`, `[page].astro`. You write `[page].astro`, `modules/[slug].astro`, `sources.astro`, `open-items.astro` and the plan file `modules/index.astro`; the rest belong to others (README 6).
- `getStaticPaths` returns **every** entry, released or not. Roster: "a page or tool with released: false is built (so its tests can run) but no link to it is rendered anywhere, and it is excluded from the module index and the sitemap".
- `[page].astro` renders the entry with `render(entry)` inside `Page.astro`; `modules/[slug].astro` inside `Lesson.astro`, passing the frontmatter. Route shapes: `/<slug>` and `/modules/<slug>` (P1-A8 expects `/modules/m0-start`), always under the configured base.
- Sitemap: `SPEC.md` names no sitemap and none is installed. Do not add one (no dependency may be added). If one exists on `main` when you start, exclude unreleased routes from it; otherwise record in your fragment that the rule is met vacuously (plan).

### 5.3 The module index (`modules/index.astro`, plan)

- Lists released modules only, in increasing `module`, each with its title linked to its route and its question. An unreleased module never appears (roster). Phase 1: M0 and M1 once merged; your branch has none, so the page must build and render an empty list correctly (a sentence saying no module is published yet, plan).
- No island; it is a no-tool page under the 15 kB limit of 7.6.

### 5.4 The glossary (`glossary.mdx`)

- 7.3: "`glossary`, seeded from Appendix C (phase 1, growing)". 8.4: "Define every term on first use and link later uses to a glossary entry (Appendix C is its seed)". M10 names it among the reference pages.
- One entry per row of Appendix C, all 26 rows, in the order of the appendix, with the four columns in this order and these headings: `This site`, `Wildberger` (with `<Cite k="W20"/>` and `<Cite k="W-MS"/>`, the appendix heads the column "Wildberger ([W20], [W-MS])"), `Numbers-game literature`, `Lie theory`. The site's words come first (roster). Copy every cell's content faithfully, mathematics included (`$(m,n)$`, `$-C_{ji}$`, `$\lambda\mapsto(\langle\lambda,\alpha_i^\vee\rangle)_i$`, ...); empty cells of the appendix stay empty; "(not used)" and "(no counterpart)" stay as written.
- Mathematics: by the route recorded in `decisions/P0-A3.md`. Under route (a) write `$...$` in the MDX; under route (b) every formula goes through `<Tex src="..."/>`. Check that backslashes reach KaTeX (7.3 `<Tex>` paragraph).
- Anchors (roster: "anchors per term"): every term of the first column gets its own anchor, so that a row with several terms (`node, city`; `bidirected board; one-way board`; `raising move; Kostant's game`; `black, white, arrows`; ...) has several. Slug rule (plan, record it): lower case; drop `$...$` and parenthesised parts; spaces to hyphens; ASCII letters, digits and hyphens only (`board`, `bidirected-board`, `one-way-board`, `node`, `city`, `roads`, `counts`, `the-translator`, `fundamental-position`, `weights`, `form-value`, `kostants-game`, ...). The slugs are a contract for every lesson agent; list all of them in your fragment. An anchor never changes once published.
- Layout: a table is hard to read at 320 pixels (A-11: "Prose and controls reflow at 320 CSS pixels"). Plan: render each row as a definition-list entry (term as `<dt>` with the anchor, the three other columns as labelled `<dd>` lines), or as a table that reflows to stacked rows below 600 pixels; either way no horizontal page scroll at 320 pixels.
- A short opening paragraph in the site's words saying what the four columns are (8.4 rules apply). No number with a golden value (none occurs in Appendix C).
- Frontmatter: `title: "Glossary"`, `phase: 1`, `released: true`.

### 5.5 The sources page (`sources.astro`)

Rules from 7.3, quoted: "built from `SOURCES.md` by `sources.astro`, which renders the file as Markdown (not MDX, which rejects its angle-bracket links) and publishes sections 11.1 to 11.6 with the status labels spelled out in words. Sections 11.0 and 11.7 to 11.9 are the research record and are not published. The formulas of the file (`$...$`) are typeset at build time with the same KaTeX call that `<Tex>` uses, whichever route is chosen for lessons, because the file does not pass through the MDX pipeline."

- Read the file by static import, `import text from '<relative path to repository root>/SOURCES.md?raw'` (P0-A4's pattern; never resolve a path from `import.meta.url` at run time). Never edit `SOURCES.md`.
- Slice: from the line `### 11.1 ` up to, not including, the line `### 11.7 `. Nothing before (the file title, the version line, 11.0) and nothing after (11.7, 11.8, 11.9) reaches the page.
- Mathematics: before Markdown rendering, replace every `$...$` span by an opaque alphanumeric placeholder; after rendering, substitute `renderTex(src, false)` for each placeholder. This is "the same KaTeX call that `<Tex>` uses" under either route, and it keeps a remark-math plugin (route (a)) from seeing the formulas. Today the file holds about 206 inline spans and no `$$`.
- Markdown rendering without a new dependency, in this order of preference (verify each in `node_modules` types first): (1) `createMarkdownProcessor` from `@astrojs/markdown-remark` when it is a direct dependency of `site` (route (a)); (2) an inline loader for a `sources` collection in `content.config.ts` that uses the loader context's `renderMarkdown`, which runs Astro's configured processor; (3) if neither exists, do not add a package: write the request (package, version, licence) in your fragment and report the sources page as `partial`.
- Status labels spelled out in words. `SPEC.md` 0.3 and `SOURCES.md` 11.0 define them; the specification fixes no display wording, so the words are the roster's (plan): `[S]` "read in the source", `[S2]` "reported by a later source", `[V]` "checked by computation", `[U]` "unverified"; and, should it occur, `[D]` "design decision" (plan). Match a label only as the exact token `S`, `S2`, `V`, `U` or `D` directly after `[` and directly before `]`, `,`, `;` or `:`; keep the rest of the bracket (`[V: every printed list ...]` becomes "(checked by computation: every printed list ...)", `[S, page image]` becomes "(read in the source, page image)", plan). Never touch Markdown links `[text](url)` or bracketed citation keys.
- An anchor per citation key: the element that prints `**[KEY]**` gets `id="KEY"`, the key as it stands (P0-A4's contract `sources#<key>`; keys match `[A-Za-z][A-Za-z0-9+-]*`, including `W-MS` and `EGH+11`; no encoding). Keys appear at the start of a paragraph, at the start of a list item, and mid-line after another entry (`[Car26]`, `[Gre08]`, `[Gre13]`, `[Don07b]`, `[Don08b]`, `[BL92]`, `[Oni04]`, `[Bum13]`, `[RV16]`, `[RV21]`, `[Mac72]`, `[Cox73]`); every one gets its anchor. Use `keys()` from `sources.ts` as the list to cover; do not write a second key parser.
- A key that `sources.ts` defines but that lies outside 11.1 to 11.6 (none today; P0-A4 asked you to decide): the build fails with a message naming the key and its section (plan), so a `<Cite>` can never point at an unpublished anchor.
- Headings: the page has its own `<h1>` "Sources" (plan) and a short opening paragraph in the site's words explaining the four status words; the `### 11.k` headings become `<h2>` so the heading order is valid (plan). Autolinks `<https://...>` render as links.
- No island, no client script, no KaTeX JavaScript; the KaTeX stylesheet comes from `Base.astro`.
- Optional (plan): plain `[KEY]` mentions inside entries may link to their anchors. Not required.

### 5.6 The open-items page (`open-items.astro`)

- 7.3: "`open-items`, generated from `content/unverified.json` and present in preview builds only". Preview build is the default; a release build is `RELEASE=1 npm run build`; decide with `isReleaseBuild()` from `unverifiedRegistry.ts`, never a second rule.
- Lists every item of `unverified.json` in order: its id, status (`open` or `closed`, and for a closed item "the date and the source that settled it", `closedOn` and `closedBy`), statement, where to check, the gate, and the pages that use it (roster). Each item carries `id="<id>"` (`id="E4"`), the anchor `<Unverified>` links to in preview builds (`open-items#E4`).
- Pages that use an item: the registry of P0-A4 collects usages while pages render, and the open-items page may render before the lessons that use an item. Plan: compute usages statically, by scanning the raw sources of `src/content/**/*.mdx` (`import.meta.glob(..., { query: '?raw', eager: true })`) for `<Unverified item="..."` and mapping each file to its route; list an item id used on a page but absent from `unverified.json` (an `E18` proposed before `MERGE` adds it) under a separate heading.
- Only the owner closes an item (7.3; 9.3). The page shows status and never changes it; nothing you write sets `closed`.
- Release builds: the route must not exist in `dist`, and nothing links to it. Find a supported Astro 7 way for a static page to be left out of a release build (read the docs and types). If none exists inside the files you own, render nothing useful in a release build, write a request to `MERGE` and `P0-A6` for a release-only removal of `dist/open-items/` in the build command, and report it under `deviations`.
- Wording: the statements are the specification's [U] checklist shown as items to check, never as fact; frame them so (for example a heading "What a person still has to check", plan).

### 5.7 The about page (`about.mdx`)

- Converted from `P0-A5`'s `about.astro` with every sentence it had, so `P0-A5`'s and `P1-A2`'s tests of `/about/` keep passing at the same URL. Then delete `about.astro` (a static `about.astro` would shadow `[page].astro`).
- Content (roster): the storyline of 1.4 in brief (the seven statements, summarised in the site's words; a statement links to its module only when that module is released, 5.12); the names of 1.7: the working title "Two Games on a Dynkin Diagram" (D1 default, [D]), the two views called **Populations** (the mutation game; roots) and **Numbers** (the numbers game; weights), Wildberger's story of Martians and anti-Martians on Mars, and of Venus for the dual game, retold with credit (D5 default; `<Cite k="W20"/>` section 2, `<Cite k="W-MS"/>` pp. 1 and 30); the purpose of 1.1.
- 8.4 credit: "the mutation game is Wildberger's; the numbers game is Mozes', with Proctor's earlier use of the same process and Eriksson's development acknowledged; Kostant's game is "attributed to Kostant"". If the page names Kostant's game, say "attributed to Kostant" and nothing more about who attributes it (Appendix E item 13 is open on the wording; anything further goes in `<Unverified item="E13" fallback="...">`).
- 8.3 [D]: "Icons: a small city for Populations, a small numbered disc for Numbers, used wherever the view is named", and the two accents mark "the borders and icons of panels and the underlines of the two words, never text". No icon component is on `main` and none is in your list; name the views in words, and record the gap in your fragment for the owner of the icons (plan).
- No number with a golden value typed (8.4); if one is needed, `<G>`.
- Frontmatter: `title: "About"`, `phase: 0`, `released: true`.

### 5.8 The credits page (`credits.mdx`)

- Converted from `P0-A5`'s `credits.astro`, keeping what it asserted; then delete `credits.astro`.
- 7.9 [D]: "A credits page lists every third-party asset with title, author, source and licence, and the licences of bundled libraries and fonts." "The site should acknowledge N. J. Wildberger's story and terminology prominently." "Ideas, rules, theorems and data from the literature are restated in the site's own words with citations." "Videos are linked or embedded with the platform's own player and never re-hosted." "Reference software under GPL or LGPL (SageMath, CoReLG, Atlas, Group Explorer) is used only as a black-box oracle for test data; its source is not translated. The MIT-licensed `mutation-game` package may be read."
- Credit rules of 8.4 (as in 5.7), with citations by key (`W20`, `Moz90`, `Pro84`, an Eriksson key such as `Eri92`; check each with `hasKey`).
- Licences, D4 default: content under CC BY-SA 4.0 and code under MIT, with SPDX identifiers `CC-BY-SA-4.0` and `MIT`, and the sentence that code samples shown in the text fall under the code licence (7.9). D4 is open; say these are the current licences, not a final choice.
- The dependency list (roster: "the list of dependencies with licences"): generated at build time, never typed. Move `P0-A5`'s generation logic into `Page.astro`, which renders the table after the MDX content when the frontmatter has `generated: 'dependencies'` (plan). Every dependency of the three `package.json` files (root, `packages/engine`, `site`), pinned version, the `license` field read from the installed package, marked when shipped to the reader; KaTeX's fonts with the licence notice found inside the installed package; "licence not stated in the package" when none is found.
- The version footer placeholder (roster): the slot in `Footer.astro` (5.11) where `P6-A6` will print the pinned versions (7.2 closing rule: "record the versions in the footer of the built site") and the git commit.
- Frontmatter: `title: "Credits"`, `phase: 0`, `released: true`, `generated: "dependencies"`.

### 5.9 `Lesson.astro` and `Page.astro`

- Both compose `Base.astro` (5.11 explains the nav and footer). `Page.astro` props: the `pages` frontmatter; renders `<h1>` from `title` and the content.
- `Lesson.astro`, the anatomy of 8.2, quoted:
  1. "Title and the module's question." The layout renders `<h1 data-anatomy="title">` from `title` and the question from `question` in `<p data-anatomy="question">` (plan hooks).
  2. "A first figure, already showing something, with a one-sentence caption." Placed by the lesson (beat 1's figure in M0 and M1).
  3. "Beats: a short paragraph, then a small tool or figure beside or below it. One idea per beat." `Beat`.
  4. ""What we have seen": the general statement in a framed box, with its provenance (a citation key, or "verified by computation")." `Seen`.
  5. ""For readers who know Lie theory": the standard names, in one paragraph." `LieTheory`.
  6. "Challenges: three to five goals, each with a check that reports success." `Challenge`.
  7. "Links: the sandbox with this module's board loaded; the Atlas page; the next module. (A link whose target has not been released yet is left out by the build; section 7.3.)" `ModuleLinks`.
  8. "Sources for the module." `Sources`.
- The layout renders `DraftMark` itself when `draft` is true (D17), directly after the question (plan); lessons need not place it. `released` and `draft` are independent.
- "A lesson is between 800 and 1800 words. Tools take the full width of the screen on phones (section 6.1) and sit in a wide column on desktop; text lines stay near 66 characters." Plan: prose in a column whose measure is near 66 characters (for example `max-inline-size: 34em`, measured, record the value); figures in a wider column on desktop; on a viewport narrower than 400 pixels the figure box runs from edge to edge of the viewport (6.1 "Size on screen": "On a viewport narrower than 400 pixels the box runs from edge to edge of the viewport, so $W$ is the viewport width"). No horizontal page scroll at 320 pixels (A-11).
- Islands are the lesson's (CONTRACTS 7: first tool `client:idle`, others `client:visible`); the layout adds no island beyond the shell.
- Styles: component-scoped, using the custom properties of CONTRACTS 8 only (`--page`, `--text`, `--accent-populations`, `--accent-numbers`, `--focus-ring`, ...), so both themes work; accents never for text or fills (8.3). Respect `prefers-reduced-motion` (A-9).

### 5.10 The lesson components (`site/src/components/lesson/`)

Import path for lessons: `import { Beat, Seen, LieTheory, Challenge, ModuleLinks, Sources, DraftMark } from '@components/lesson'` through `index.ts` (CONTRACTS 7). Every component is valid as a block element in MDX (blank lines around it) and renders valid HTML (Astro 7's compiler rejects invalid HTML, 7.2 item 1). Hooks are plan names; record them in your fragment because the lesson tests read them.

- `Beat.astro`: props `n` (beat number, required). Renders `<section data-anatomy="beat" data-beat="{n}" id="beat-{n}">` with the default slot (the paragraph) and a named slot `figure` rendered in `<div data-anatomy="figure">` in the wide figure column. A static figure (SPEC 3: "\"static\" is a drawing with no controls") supplies its own caption with `<figure>`/`<figcaption>`; a tool's caption comes from the tool (CONTRACTS 7: "Every tool has a `caption` prop stating the result it demonstrates (P1)").
- `Seen.astro`: the framed box with the heading "What we have seen" (8.2 item 4, exact words) and `data-anatomy="seen"`. Prop `provenance: string | string[]`, required and non-empty. Each value is either a key of `SOURCES.md`, rendered through `<Cite k>` (an unknown key fails the build), or a phrase that begins with the words "verified by computation", matched without regard to case so that both 8.2's lower-case "verified by computation" and 8.4's capitalised example pass (plan; 8.2; 8.4: ""Verified by computation for all boards of rank at most 8" is an acceptable provenance and must not be dressed up as a citation"), rendered as plain words, never as a bracketed link. Each rendered provenance carries `data-provenance`. Anything else fails the build with a message (plan).
- `LieTheory.astro`: `<section data-anatomy="lie-theory">` with the heading "For readers who know Lie theory" (8.2 item 5; 1.2: "Each module has a clearly marked "For readers who know Lie theory" paragraph that states the standard name of what was just played [D]") and the default slot.
- `Challenge.svelte` (Svelte 5 runes only; an island the lesson hydrates with `client:visible`):
  - Props, all serializable (Astro island props cannot carry functions): `goal` (the goal text, required), `explanation` (required), `for` (the instance id of the tool the check reads, for example `"b9"`), `check` (a `ChallengeCheck`, below).
  - Server HTML (without JavaScript): `<div data-challenge>` with the goal text and `<details><summary>...</summary>{explanation}</details>` (roster: "without JavaScript the goal is shown with a <details> explanation"); a polite status region present and empty (pattern of A-4).
  - With JavaScript: the component locates the tool root `[data-tool][data-instance="{for}"]` and observes only the hooks of 4.0 ("The tool's root element carries `data-tool` and `data-moves`"; node buttons carry `data-node`, `data-board`, `data-value`, `data-can-act`; other outputs are `data-out="<name>"`) with a `MutationObserver`. When the check is met it sets `data-met="true"` and renders `<p data-challenge-result>` with a short success sentence (plan: "Goal reached.") and announces it once through its status region. Before the goal is met the result element is absent (`P1-A8` and `P1-A9` assert this).
  - `data-instance` is a plan hook: `ToolFrame` (`P1-A2`) receives `instanceId` but CONTRACTS 5.1 names only `data-tool` and `data-moves`; request `data-instance` on the tool root from `P1-A2` in your report.
  - `ChallengeCheck` (plan, in `site/src/lib/pages/challengeCheck.ts`, with a pure `evaluate(check, observation): boolean`):
    - `{ kind: 'out', name: string, equals?: string }`: met when `[data-out=name]` inside the tool has non-empty text, or text equal to `equals`. This delegates to a tool's own goal (`P1-A5`'s plan `data-out="goalMet"`) and covers 8.5 "Classify" later (T13's lights).
    - `{ kind: 'reach', board: 'populations' | 'numbers', values: (number | string)[], maxMoves?: number }`: met when the node values of that board, in increasing label order, equal `values` (8.5 "Reach a target"; "Reach by raising" when the lesson puts the tool in raising mode), and `data-moves` is at most `maxMoves` when given (8.1 P6: "end the game in the fewest moves").
    - `{ kind: 'distinct', board: 'populations' | 'numbers', count: number }`: met when the number of distinct value vectors shown on that board since the page loaded is at least `count` (P1-A9's "find all 12 root populations of $A_3$").
    - `{ kind: 'input', predicate: string, board: string }`: the component renders a labelled text input for a population and a button; met when the named predicate accepts the typed vector. Start with one predicate, `fixed-by-every-mutation` (nonzero, and every entry of $Cp$ is 0), computed with the engine (`resolveBoard`, `toNumbers`); add others only on a lesson agent's request.
    - `{ kind: 'mixed-signs', board: 'populations' | 'numbers' }` (plan): met when the values shown on that board contain at least one positive and at least one negative entry at the same time. This expresses 8.5 "Find a counterexample", whose example is "Find a board and a play that puts Martians and anti-Martians on the board together." (Impossible with two-way roads.) The reader picks the board in the tool (a one-way road is needed), so the check reads only the values; no phase 1 lesson needs it, but the kind and its test are part of your evaluator.
    - `{ kind: 'explain' }`: 8.5's pattern "Explain", whose example cell reads "A free-text box that is not graded, followed by the site's own explanation." It reports no success and does not count toward the three checked challenges of 9.2.
  - Not handled by `Challenge`: 8.5's "Predict a number" and "Predict a yes or no". These are the `prediction` configuration of the tools (4.0 "Predict": "Tools placed in the guided part of a module accept a `prediction` configuration: a question, an answer type (a number, a position, a choice), the correct answer computed by the engine, and the text of the reveal."), built by the tool owners, not by you.
  - Numbers in a check that have a golden value are passed by the lesson from `resolveGoldenPath` at build time in the MDX (8.4), never typed; `Challenge.svelte` itself never imports `@lib/golden` or `@lib/sources` (the golden file would enter the client bundle).
  - Compare values as decimal text after mapping U+2212 to `-` (6.3 writes the true minus on screen; `data-value` is "decimal text, or `p/q` for a fraction", 4.0).
- `ModuleLinks.astro`: props `module` (number) and `board` (the module's board, for example `"A3"`). Renders, in this order, only the targets that are released (8.2 item 7; 7.3): the sandbox with the board loaded (`tools/sandbox?g=<board>`, the bare key `g` of 6.6 on a tool route, built with `encodeState` once `P1-A2` has merged, plan), the Atlas page of the board (`atlas/<board>`, plan, `P6-A4`), and the next module (the module numbered `module + 1`; omitted when that module is absent or unreleased, never replaced by a later one, plan). In phase 1 the sandbox (phase 2) and the Atlas (phase 6) are absent; SPEC 4 T16 says "M0 and M1, which are written before the sandbox exists, receive the link when phase 2 is released". Wrapper `data-anatomy="links"` always present with `data-count`; with a count of 0 it renders no heading and no landmark (plan); otherwise a heading (plan: "Where next").
- `Sources.astro`: prop `keys: string[]` (lessons pass `frontmatter.sources`) and an optional default slot for a note such as SPEC 3's "[W20] section 2 for the story". Renders the heading "Sources" (plan), `data-anatomy="sources"`, and for each key `<Cite k>` followed by its `citeTitle(k)`.
- `DraftMark.astro`: `data-anatomy="draft"`, a visible note that the page is a draft not yet approved by the owner (D17; plan wording without an em-dash), not conveyed by colour alone (A-5).
- `index.ts`: re-exports the seven components. If `astro check` cannot type `.astro` re-exports, say so in the report (as P0-A4 did for `@components/content`).

### 5.11 `Nav.astro`, `Footer.astro`, and the shell

- 7.6: "a page with no tool (`about`) | 15 kB | the shell: navigation, theme switch, the highlight store". Nav and Footer ship no script of their own.
- `Nav.astro` (plan): links to the index, the module index, the glossary, the sources page, about, credits, each built from `import.meta.env.BASE_URL` and present only when its target is released. A `<nav>` with an accessible name; operable by keyboard; visible focus (A-2).
- Theme switch: `P1-A3` builds `site/src/components/ThemeSwitch.svelte` in this stage and asks you to place it in `Nav.astro` with `client:idle`. It is not on `main` when you start and a `client:` island needs a static import. Leave a marked place in `Nav.astro` and write a request to `MERGE` to add `<ThemeSwitch client:idle />` there after both branches merge; never write your own switch.
- `Footer.astro` (plan): the licence line of 7.9 (D4 default, SPDX identifiers, the code-sample sentence), a link to credits and to sources, a link to open-items in preview builds only, and the empty version slot for `P6-A6` (5.8).
- `Base.astro` is `P0-A5`'s and renders its own inline `<nav>` and `<footer>`. You may not edit it. Request from `MERGE` (and say so in `requests`) the two-line change that makes `Base.astro` render `<Nav />` and `<Footer />` in place of its inline ones, keeping the skip link and `<main id="main">`. Until then your layouts must not produce two `<nav>` landmarks with the same name on one page; if `Base.astro` offers named slots for them, use those and no request is needed.

### 5.12 The `released` flag (7.3)

- 7.3: "A link to a page that has not been released yet is left out by the build, driven by a `released` flag in each page's front matter." Roster: "a page or tool with released: false is built (so its tests can run) but no link to it is rendered anywhere, and it is excluded from the module index and the sitemap".
- One implementation, `site/src/lib/pages/released.ts` (plan): pure functions over plain entry lists (testable without `astro:content`) plus thin wrappers that read the collections. A target is a module (by slug), a page (by slug), a tool (by id of the table of section 4) or an Atlas page (by board). Rules (plan): a module or page is released when its entry exists and `released` is `true`; a tool is released when its registry entry `site/src/tools/registry/T{nn}.ts` exists (read with `import.meta.glob`, so it works before `P1-A2`'s collector merges) and its optional `released` field is not `false` (request that optional field in `tools/types.ts` from `P1-A2`); an Atlas page is released when `site/src/pages/atlas/[board].astro` exists; the static pages `sources` (always) and `open-items` (preview builds only).
- `hrefFor(target)`: joins `import.meta.env.BASE_URL` and the route with exactly one slash; never an `href` beginning with `/` typed in source (7.2 item 10: "Every internal link and asset path is built from `import.meta.env.BASE_URL`"; `P0-A6`'s `BASE_PATH=/sub/path/` test).
- `linkIfReleased(target)`: the href or `null`. `Nav`, `Footer`, `ModuleLinks`, the module index and the about page use it. For links inside lesson prose (M0's map of the seven statements), export a way for MDX to use it (plan: lessons call `linkIfReleased` in an MDX expression and render text alone when it is `null`); document the pattern in your fragment, because `P1-A8` asks for exactly this.

### 5.13 Writing rules for everything you write (8.4)

Plain declarative sentences; define every term on first use; the site's words (board, node, city in the Mars story, road, population, numbers, mutate, fire, legal, free play); provenance for every theorem-like statement; numbers with a golden value through `<G>`; credit accurately (5.7); "no em-dashes; no stock rhetorical contrasts or fashionable filler words; the specific in place of the grand" (D14 default "as proposed"); "No sentence of the lessons is copied from a source". This covers page prose, headings, component strings, `aria-label`s, test names and comments, and your fragment. Do not state anything [U] as fact; wrap it in `<Unverified item="E.." fallback="...">` (9.3), and propose a new item in your report if none fits.

### 5.14 Decisions fragment (`decisions/P1-A4.md`)

Record (COMMON 5.1): both frontmatter schemas; every plan hook name (`data-anatomy` values, `data-beat`, `data-provenance`, `data-challenge`, `data-met`, `data-challenge-result`, `data-count`); the `ChallengeCheck` kinds and predicates; the glossary slug rule and every slug; the status words of the sources page; the Markdown renderer used and why; the open-items release mechanism; how `released` is decided per kind of target and the MDX pattern for released-aware prose links; the column measure chosen; the defaults of section 10 relied on (D1, D4, D5, D14, D15, D16, D17); the requests made (5.10, 5.11, 5.12); the deletion of `about.astro` and `credits.astro`.

## 6. Acceptance

Run your own tests only (COMMON 4.3), plus `npm run size` once at the end because two criteria are sizes of your pages.

- [ ] Sources page: every citation key of `keys()` resolves to an anchor `id="<key>"` on the built page. Roster acceptance 1; 7.3. `sources-page.test.ts > every key gets an anchor` (on the transformed HTML) and `pages.spec.ts > sources: every key of SOURCES.md has an anchor`. G1.
- [ ] Sources page: sections 11.0 and 11.7 to 11.9 absent (no "How to read this section", "Related interactive work surveyed", "Technology and standards", "Corrections to citations"); 11.1 to 11.6 present. Roster acceptance 1; 7.3. `sources-page.test.ts > publishes 11.1 to 11.6 only`; `pages.spec.ts > sources: unpublished sections absent`. G1.
- [ ] Sources page: no `[S]`, `[S2]`, `[V]`, `[U]` token left; each spelled out in words. 7.3. `sources-page.test.ts > status labels spelled out`. G1.
- [ ] Sources page: every `$...$` typeset by `renderTex` (MathML present, A-12; no `$` delimiter left; no KaTeX script). 7.3; 7.2 item 3. `sources-page.test.ts > formulas typeset with renderTex`; `pages.spec.ts > sources: MathML present`. G1.
- [ ] Glossary: every Appendix C row present, with its four columns in order and an anchor per term. Roster acceptance 2; 7.3. `glossary.test.ts > every Appendix C row is in the glossary` (parses the table from `SPEC.md` at test time; no row typed into the test) and `> one anchor per term, unique`. G1.
- [ ] The `released` flag drops links to unreleased targets everywhere and excludes them from the module index, while the page is still built. Roster acceptance 3; 7.3; 8.2 item 7. `released.test.ts > unreleased module omitted from links and index`, `> unreleased page omitted`, `> next module omitted when absent or unreleased`, `> tool without registry entry omitted`; `pages.spec.ts > no link anywhere targets dev/math-check` (the real `released: false` page). G1.
- [ ] No route collision between collections and static pages. Plan. `released.test.ts > no slug collides with a static route`. Every merge.
- [ ] Every internal link on your pages resolves under the base path, and none begins with `/` unless it begins with the configured base. 7.2 item 10; 7.7 Links row. `pages.spec.ts > internal links resolve` (run also by `P0-A6`'s `basepath.spec.ts` at merge). G1.
- [ ] About, credits, glossary, sources and the module index render, with the nav operable by keyboard (Tab reaches every nav link in order, Enter follows it, the focus ring is visible). Roster deliverable; A-1, A-2. `pages.spec.ts > pages render`, `> nav by keyboard`. G1.
- [ ] Each of these pages reads completely without JavaScript (text, tables, MathML). 7.4; G1 "the run without JavaScript passes on M0, M1, the tool routes and the pages". `pages.spec.ts > without JavaScript` (a context with `javaScriptEnabled: false`); `P1-A2`'s `nojs.spec.ts` covers them at the gate. G1.
- [ ] axe: no serious or critical violations on about, credits, glossary, sources, open-items and the module index, in the light theme and with `data-theme="dark"`. Roster acceptance 5; 7.7. `pages.spec.ts > axe on every page`. G1.
- [ ] The no-tool pages fetch at most 15 kB of JavaScript gzip at 360 by 800 pixels. Roster acceptance 4; 7.6. `npm run size` rows for `/about/`, `/credits/`, `/glossary/`, `/sources/`, `/modules/`, `/open-items/` (paste them in the report). G1 "the size limits of SPEC 7.6 hold on every route".
- [ ] Open-items page: in a preview build every item E1 to E17 is listed with status, statement, where to check, gate and using pages, each with `id="E<n>"`; in a release build the route is absent and nothing links to it. 7.3. `pages.spec.ts > open-items lists every item with its anchor`; the release check `pages.spec.ts > open-items absent in a release build` (build with `RELEASE=1` into a temporary `OUT_DIR`, CONTRACTS 1, and inspect the files). G1.
- [ ] Lesson layout: a fixture lesson renders, in order, title, question, draft mark when `draft: true`, beats with figures, the `Seen` box with a provenance, the Lie theory section, challenges, links, sources; no draft mark when `draft: false`. 8.2; 9.2; D17. Plan: a fixture under `site/tests/fixtures/lesson/` built in a temporary project or directory by `released.test.ts > lesson anatomy fixture` (P0-A4's fixture-build method); the real lessons are proven by `M0.spec.ts` and `M1.spec.ts` in stage 1.3. G1.
- [ ] `Seen` rejects a provenance that is neither a key nor "verified by computation"; an unknown key fails the build; both "verified by computation" and 8.4's "Verified by computation for all boards of rank at most 8" are accepted. 8.2 item 4; 8.4. `released.test.ts > Seen provenance rules` (fixture build, with a lower-case and a capitalised phrase). Every merge.
- [ ] `Challenge`: each check kind is met exactly when its condition holds and not before; values compared after the U+2212 mapping. 8.2 item 6; 8.5; 9.2. `challenge.test.ts > out`, `> reach`, `> reach with maxMoves`, `> distinct`, `> input fixed-by-every-mutation`, `> mixed-signs`, `> explain never reports success`. End-to-end proof: `M0.spec.ts` and `M1.spec.ts` challenge tests (stage 1.3). G1.
- [ ] Text column near 66 characters on desktop; tools edge to edge below 400 pixels; no horizontal scroll at 320 pixels. 8.2; 6.1; A-11. `pages.spec.ts > lesson column measure` and `> reflow at 320` (on the fixture or, after stage 1.3, on M0). G1.
- [ ] Type checks pass: `npx astro check`, `npx svelte-check`. COMMON 4.3. Every merge.
- [ ] A preview build and a release build both succeed. 9.1 G0 (still required). Run both once; paste the summary lines. Every merge.
- Not automated, owner's part (9.2, 9.1 G1 and G3): principles P3 to P8 in the lessons and their reading aloud; the first reading of M0 and M1 by two readers at G1. Nothing of yours is checked only by hand.

## 7. Files

- **You own** (roster, exactly):
  - `site/src/content.config.ts (collections modules and pages with frontmatter schemas of CONTRACTS 7)`
  - `site/src/content/pages/glossary.mdx, about.mdx, credits.mdx`
  - `site/src/pages/sources.astro, open-items.astro, [page].astro, modules/[slug].astro, modules/index.astro`
  - `site/src/layouts/Lesson.astro, Page.astro; site/src/components/Nav.astro, Footer.astro`
  - `site/src/components/lesson/Beat.astro, Seen.astro, LieTheory.astro, Challenge.svelte, ModuleLinks.astro, Sources.astro, DraftMark.astro, index.ts`
  - `site/tests/unit/sources-page.test.ts, glossary.test.ts, released.test.ts`
  - `site/tests/e2e/pages.spec.ts`
  - `decisions/P1-A4.md`
- **You may edit with the stated protocol**:
  - Delete `site/src/pages/about.astro` and `site/src/pages/credits.astro` (README 6: `P1-A4` "converts about and credits to content pages"), carrying their content and test-visible behaviour into the MDX pages.
  - Create (plan; not in the roster's list, report them under `filesChanged` and in your fragment): `site/src/lib/pages/released.ts`, `sourcesMarkdown.ts`, `challengeCheck.ts`; `site/tests/unit/challenge.test.ts` and fixtures under `site/tests/fixtures/lesson/` (README 4: "Every build agent also owns its own tests").
  - `site/src/styles/*`: README 6 grants "additive edits by the tool and page owners for their own component styles only", after `P1-A3`'s `tokens.css`. Plan: prefer component-scoped styles inside your own components and layouts; make an additive edit in `site/src/styles/*` only when a style cannot live in a component, add nothing that changes another owner's rules, and report it under `filesChanged`.
- **You must not touch**: everything else; in particular `reference/`, `SOURCES.md`, `SPEC.md`, `DECISIONS.md`, root `package.json`, `site/package.json` and the lockfile, `site/astro.config.mjs`, `playwright.config.ts`, the root Vitest configuration, `site/src/layouts/Base.astro`, `site/src/pages/index.astro`, `site/src/pages/tools/*`, `site/src/lib/*` other than `lib/pages/`, `site/src/components/content/*`, `site/src/components/math/*`, `site/src/components/board/*`, `site/src/components/draw/*`, `site/src/components/tools/*`, `site/src/components/ThemeSwitch.svelte`, `site/src/tools/*`, existing rules in `site/src/styles/*` (additive edits only, as above), `site/src/content/modules/*` (lesson agents), `site/src/content/unverified.json` (never add or close an item), `scripts/*`, and every other agent's tests (`a11y.spec.ts`, `nojs.spec.ts`, `nojs-phase0.spec.ts`, `basepath.spec.ts`, `board-keyboard.spec.ts`).

## 8. Order of work

1. Confirm worktree and branch; `node --version` (22.12 or later); `npm ci --prefer-offline` if `node_modules` is absent. Read the files of section 2 item 14 and note the mathematics route, the Markdown processor available, and what `P0-A5`'s tests assert on `/about/` and `/credits/`.
2. `content.config.ts` with both schemas; `[page].astro`, `Page.astro`; move about and credits into MDX, delete the two `.astro` pages; build (`npm run build`) and check `/about/` and `/credits/` at the same URLs. Commit `P1-A4: content collections, page route, about and credits as content pages`. First usable increment.
3. `released.ts` with `released.test.ts` first; then `Nav.astro`, `Footer.astro`, `modules/index.astro`, `modules/[slug].astro`. Commit.
4. `glossary.test.ts` (failing), then `glossary.mdx`. Commit.
5. `sources-page.test.ts` (failing), then `sourcesMarkdown.ts` and `sources.astro`. Build; inspect `dist/sources/`. Commit.
6. `open-items.astro`, including the release-build behaviour. Commit.
7. `Lesson.astro` and the seven lesson components; `challenge.test.ts` before `challengeCheck.ts`; the lesson fixture. Commit `P1-A4: lesson layout and components`. Lesson agents need this; do it before polishing.
8. `pages.spec.ts`; one Playwright run at a time; kill `astro preview` afterwards.
9. `npx astro check`, `npx svelte-check`, both builds, `npm run size` once. Fragment, report.

## 9. Traps

- `SOURCES.md` contains angle-bracket links that MDX rejects (7.3); render it as Markdown. (roster)
- The sources page uses the same KaTeX call as `<Tex>` (`renderTex`) so one stylesheet fits (7.2 item 3). Under route (a) a remark-math plugin in the configured processor would otherwise typeset the file with its own call; the placeholder step prevents that. (roster)
- Only the owner closes an item; the open-items page shows status, it never changes it. (roster)
- No em-dashes anywhere in prose you write. (roster)
- Keys appear mid-line (`[Car26]` after `[Car14]`); a parser that looks only at line starts misses twelve anchors. Use `keys()` from `sources.ts`.
- Status labels have variants (`[V: ...]`, `[S, page image]`, `[V; section 2.10]`, `[S]; content [S2]`); a replacement that matches only `[V]` leaves bracketed codes on the page. Markdown links `[10.1142/...](https://...)` are brackets too; never touch them.
- `<Unverified>` usages are registered while pages render, so the registry may be empty when `open-items.astro` renders. Read usages from the MDX sources.
- A static `about.astro` shadows `[page].astro` for the same route; delete the phase-0 pages in the same commit that adds the MDX ones.
- A typed `href="/..."` breaks under `BASE_PATH=/sub/path/` and is not dropped by the `released` flag. Every internal link goes through `hrefFor` or `linkIfReleased`.
- `import.meta.env.BASE_URL` may or may not end in `/` depending on configuration; join with exactly one slash.
- Astro island props must be serializable: a `check` function cannot be passed from MDX to `Challenge.svelte`. Use the declarative `ChallengeCheck`.
- Never import `@lib/golden`, `@lib/sources` or `@lib/unverifiedRegistry` into `Challenge.svelte` or any client module; the 455 kB golden file would enter the bundle and break the 15 kB and 120 kB limits of 7.6.
- `data-value` holds ASCII decimal text; the screen shows U+2212. Compare after normalising.
- Svelte 5 runes only in `Challenge.svelte`: `$props`, `$state`, `$derived`, `$effect`, `onclick`, snippets; no `export let`, no `$:`, no `on:click`, no slots (COMMON 3).
- MDX wraps inline JSX in `<p>`; a block component (`Beat`, `Seen`) inside a paragraph is invalid HTML and Astro 7 rejects it. Document the blank-line rule for lesson authors.
- Astro 7's default Markdown processor runs no remark or rehype plugins (7.2 item 1); do not assume `.md` rendering behaves as in Astro 4 or 5. Read the installed types.
- Two `<nav>` landmarks with the same name, or a `<footer>` inside `<main>`, make axe findings; coordinate with `Base.astro` through `MERGE` (5.11).
- The glossary is a table of 26 rows and four columns; at 320 pixels a plain table scrolls the page sideways (A-11).
- A `released: false` page is still built and its route exists; only links and the module index drop it. Do not exclude it from `getStaticPaths`.
- The next-module link is module `k + 1` only (8.2 item 7: "the next module"); skipping to a later released module would send a reader past a module that is not yet published (plan).
- "verified by computation" is a provenance, not a citation (8.4); never render it in square brackets or as a link.
- Do not raise the 15 kB budget or move the theme switch into your own code to save bytes; the switch is `P1-A3`'s.

## 10. Report

The JSON of `COMMON.md` 5.2, with these additional fields:

- `markdownRenderer`: which of the three routes of 5.5 was used, with the package and version.
- `mathRoute`: the route read from `decisions/P0-A3.md` and how the glossary writes formulas.
- `hooks`: every plan hook name of 5.9 and 5.10, for `P1-A8` and `P1-A9`.
- `challengeApi`: the `ChallengeCheck` kinds and predicates as implemented, with one MDX example each.
- `glossarySlugs`: the list of anchors.
- `openItemsRelease`: how the page is left out of a release build, or the request made.
- `sizes`: the `npm run size` rows for the no-tool pages (gzip bytes against 15 kB).
- `deviations` (COMMON 4.4 and 5.2; CONTRACTS header: "A change to a contract is a deviation to be reported, never made silently"), at least these two departures from the roster's wording: (1) the open-items page computes "the pages that use it" by a static scan of the MDX sources (5.6) instead of from "the registry of P0-A4", because the registry fills only while pages render; (2) `Challenge` takes a declarative, serializable `ChallengeCheck` object (5.10) instead of a "check function over a tool instance's state", because Astro island props cannot carry functions. Add any other departure, such as the open-items release mechanism of 5.6 if it needs a change outside your files.
- `requests`, at least: to `MERGE`, render `Nav.astro` and `Footer.astro` from `Base.astro` and place `<ThemeSwitch client:idle />` in `Nav.astro`; to `P1-A2`, `data-instance` on the `ToolFrame` root and an optional `released` field in `tools/types.ts`; to `MERGE` and `P0-A6`, the release-only removal of `open-items` if needed.
