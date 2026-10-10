# P6-A5: LaTeX export, embed routes, the Cite text

Phase 6, stage 6.1. Size S. Runs in: a worktree on branch `agent/P6-A5` (model: Opus, the default for build agents, README 3.5).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies. Where this file says (plan), the rule is the build plan's addition and not the specification's; where it says [D], `SPEC.md` marks the point as a design decision. You write no lesson prose, so nothing of yours is wrapped in `<Unverified>`; the one [U] near your work (Safari's limit on `replaceState`, SPEC 7.4) belongs to `P1-A2`'s `history.ts` and needs nothing from you.

## 1. Objective

When you are done, `site/src/lib/export.ts` exports `exportLaTeX`, which writes a Dynkin or Satake diagram for the LaTeX package `dynkin-diagrams` with explicit marks in Bourbaki order and the arrows as the `involutions` option, exactly in the forms of SPEC 6.7, and writes orbit graphs and projections as plain TikZ coordinates. `ToolFrame.svelte` gains the two phase-6 buttons of CONTRACTS 5.1, "Export LaTeX" and "Cite", so every tool on the site gets them without code of its own; "Cite" gives a citation text with the page title, the site version (git commit), the date and the link (SPEC 7.4). The page `site/src/pages/embed/[tool].astro` gives every registered tool a route `/embed/<tool>` that renders the tool alone for an `<iframe>` and accepts the same query parameters as `/tools/<tool>`. This is the phase-6 part of SPEC 4.0 "Share and export" and of the phase-6 row of SPEC 9.1 ("LaTeX export, embed routes"), and it serves the tertiary audience of SPEC 1.2, "teachers and expositors", who should leave with "Embeddable tools and exportable figures". `P6-A3` (T13 catalogue export) and `P6-A4` (T14 LaTeX download) call your `exportLaTeX` in stage 6.2.

## 2. Read first, in this order

1. `SPEC.md` 6.7 (line 1716), **in full**: the three forms, the rule "explicit marks in Bourbaki order, one character per node (`o` white, `*` black), and arrows as an option", the refusal of the package's named diagrams, "plain TikZ coordinates", and the owner's part of G6.
2. `SPEC.md` 7.4 (line 1825), the bullets **Citing** and **Embedding** in full; read the rest of 7.4 (single source of truth, History API, without JavaScript) because the embed route and the new buttons obey it.
3. `SPEC.md` 7.3 (line 1774): the page list (`embed/[tool].astro` under `pages/`), and the rule "Every internal link and asset path is built from `import.meta.env.BASE_URL`" of 7.2 item 10 (line 1757), reference.
4. `SPEC.md` 4.0 (line 1040), in full as reference: "Share and export" (LaTeX in phase 6), "Works before and without JavaScript" (your buttons and your route), "Long numbers" ("the exact digits ... in every export"), "Small screens", "Test hooks".
5. `SPEC.md` 1.2 (line 79): the tertiary audience row.
6. `SPEC.md` 6.6 (line 1672), reference: the URL form, bare keys "On a tool's own route (`/tools/...`, `/embed/...`)", the validation rules, and "A link carries no site version; the "Cite" button gives a citation text that includes the version."
7. `SPEC.md` 2.15 (line 602), the paragraphs "The decorated board" and "What the diagram does not show": arrows join white nodes exchanged by $\tau$; $\tau$ may move black nodes and may be non-trivial with no arrow drawn; "the drawing shows arrows between white nodes only".
8. `SPEC.md` 6.4 (line 1633), the paragraph "Fields of a catalogue record" (`black_nodes`, `tau` "images of all nodes", `arrows` "pairs of white nodes"), and Appendix B (line 2200), whose records your unit test sweeps.
9. `SPEC.md` 2.8 "Names in rank 2" (line 319) and 10 D19: $B_2$ and $C_2$ are one board; the name the reader chose is shown.
10. `SPEC.md` 7.5 (line 1835) A-1, A-7, A-10, and 7.6 (line 1855) the budget table and "No typesetting library ... is sent to the client", reference. 7.7 (line 1872) rows "Without JavaScript" and "Accessibility". 9.1 row 6 and 9.2 "For a tool" ("export as far as the current phase provides it").
11. `SOURCES.md` line 257, the `dynkin-diagrams` entry (version, the mark strings, the compiled syntax), reference.
12. Oracle: none. Golden key: `satake` (read only, as input for your tests): the fields `dynkin_type`, `real_form`, `black_nodes`, `tau`, `arrows` of all 167 records, in particular `satake[dynkin_type=E6;real_form=e6(-14)]`, `satake[dynkin_type=E7;real_form=e7(-5)]`, `satake[dynkin_type=A5;real_form=su(2,4)]`.
13. `CONTRACTS.md` 4 (`export.ts`, the line `exportLaTeX(kind: 'dynkin'|'tikz-graph'|'tikz-points', data: unknown): string; // phase 6 (P6-A5)`, and `exportJSON`), 5.1 (`ToolFrame`, its props and its buttons "from phase 6 "Export LaTeX", "Cite""), 5.2 (the registry drives `pages/embed/[tool].astro`; "A tool agent never edits those pages"), 6 (preset ids), 1 (path aliases). These bind you.
14. On `main` before you start: `site/src/lib/export.ts` (`exportJSON` of `P1-A2`; `exportSVG`, `exportPNG`, `FooterLine`, `ExportOptions`, `exportFileName` of `P2-A6`), `site/src/components/board/ToolFrame.svelte` (with `P2-A6`'s comment marking where "Export LaTeX" and "Cite" go), `site/src/lib/history.ts` (`linkFor`), `site/src/tools/index.ts` and `types.ts` (the registry), `site/src/pages/tools/[tool].astro` (how a registry component is hydrated), the layout and stylesheets that page uses, `decisions/P1-A2.md` and `decisions/P2-A6.md` (the commit constant, `data-frame`, `data-hydrated`, the hook names, how `[tool].astro` hydrates a tool, the file-name rule), `site/tests/e2e/nojs.spec.ts` (it skips `/embed/*`, which is why you check those routes yourself), `site/tests/unit/export.test.ts`, `site/tests/unit/export-svg.test.ts`, `site/tests/unit/toolframe.test.ts`, `playwright.config.ts`.

## 3. Inputs you depend on

From `P1-A2` (phase 1) and `P2-A6` (phase 2), merged before G5:

- `site/src/lib/export.ts` with `exportJSON`, `exportSVG`, `exportPNG`, `FooterLine`, `ExportOptions`, `exportFileName`, loading in Node without a DOM.
- `site/src/components/board/ToolFrame.svelte` with the hydration flag that enables controls, "Copy link", "Download data", "Export SVG", "Export PNG", the `exportNotice` output, the live region and its `announce`, the `boardName` prop of `P2-A6`, `data-tool`, `data-moves`, `data-frame`, `data-hydrated`.
- `site/src/lib/history.ts` with `linkFor(instanceId)` (the string "Copy link" copies).
- The git-commit build constant used by `exportJSON` (`P1-A2` 5.5; plan name `import.meta.env.PUBLIC_GIT_COMMIT`, falling back to `"unknown"`).
- `site/src/tools/index.ts` (`registry`, `toolById`), `site/src/tools/types.ts` (`ToolRegistryEntry`), and `site/src/pages/tools/[tool].astro` with its settled way of hydrating a registry component (`P1-A2` trap 1: possibly a generated static import table instead of `import.meta.glob`).
- `site/src/lib/urlCodec.ts` (`decodeState`) and `state.ts` (`ToolState`, `resolveBoard`): tools read the URL themselves on hydration; your route only has to render them as `[tool].astro` does.
- The registered tools on `main` at the start of stage 6.1: T1 to T12, T15, T16. T13 and T14 are registered in stage 6.2 by `P6-A3` and `P6-A4`, after you; your tests must pick them up by themselves (section 9, trap 9).

If `exportFileName`, `linkFor`, the commit constant or the hydration route of `[tool].astro` is missing, stop and report `blocked` for the part that needs it; do not re-implement another agent's piece.

## 4. Deliverables

| File | Contents |
|---|---|
| `site/src/lib/export.ts` (additive) | `exportLaTeX(kind, data)` with the signature of CONTRACTS 4 exactly; the exported input types `DynkinExportData`, `TikzGraphData`, `TikzPointsData` (plan); the pure helpers `latexFile(kind, body, link)` and `citeText(parts)` (plan). Nothing existing changed; no top-level access to `window` or `document`; no import of the engine or of KaTeX. |
| `site/src/pages/embed/[tool].astro` | One static route per registered tool, `/embed/<id>`, rendering the tool alone in its `default` state with its caption, hydrated `client:idle`, bare query keys, no site navigation, every path from `import.meta.env.BASE_URL`. |
| `site/src/components/board/ToolFrame.svelte` (additive) | Two buttons with the texts `Export LaTeX` and `Cite` after `Export PNG`; the optional prop `latexForExport` (plan); the default derivation of a `dynkin` export from the state; the citation output `data-out="citeText"`; hooks of 5.4. Nothing existing moved, renamed or restyled. |
| `site/tests/unit/latex.test.ts` | The three forms of 6.7 byte for byte; one mark per node in Bourbaki order and the exact `involutions` option for every `satake` record (Appendix B included); TikZ forms; refusals; `citeText`. |
| `site/tests/e2e/embed.spec.ts` | Every registered tool has an embed route that renders and hydrates; the routes without JavaScript; axe on each; the A2 state loads; a bad link shows the notice; the two new buttons in the browser. |
| `decisions/P6-A5.md` | The entries of section 10. |

## 5. Requirements

### 5.1 `exportLaTeX('dynkin', data)`: diagrams for `dynkin-diagrams` (SPEC 6.7)

- Signature, exactly (CONTRACTS 4): `export function exportLaTeX(kind: 'dynkin'|'tikz-graph'|'tikz-points', data: unknown): string;`. Validate `data` at run time. Export, for callers, (plan) `export interface DynkinExportData { type: string; black?: readonly number[]; tau?: readonly number[] }`, where `type` is a finite type name (`"E6"`, `"A5"`, `"C2"`), `black` the **labels** of the black nodes (default none) and `tau` the image of every node **as labels, in label order** (default the identity), the same convention as `ToolState.black` and `ToolState.tau` (SPEC 6.6: "labels of black nodes; the images of all nodes") and as the golden fields `black_nodes` and `tau`.
- SPEC 6.7, verbatim: "Diagrams are exported for the `dynkin-diagrams` package with explicit marks in Bourbaki order, one character per node (`o` white, `*` black), and arrows as an option". On a named finite board, label $k$ is Bourbaki node $k$ (E-7), so character $k$ of the mark string is the mark of label $k$.
- The three forms, which your output must reproduce byte for byte (SPEC 6.7; the trailing comments are the specification's annotations, not part of the output (plan reading)):

  ```latex
  \dynkin[involutions={16}] E{oo***o}   % E III, e6(-14)
  \dynkin E{o*oo*o*}                    % E VI, e7(-5)
  \dynkin[involutions={15;24}] A{oo*oo} % su(2,4)
  ```

  The inputs are the golden records: `e6(-14)` has `black_nodes` `[3, 4, 5]`, `tau` `[6, 2, 5, 4, 3, 1]`, `arrows` `[[1, 6]]`; `e7(-5)` has `black_nodes` `[2, 5, 7]`, `tau` the identity of 7 nodes, `arrows` `[]`; `su(2,4)` has `black_nodes` `[3]`, `tau` `[5, 4, 3, 2, 1]`, `arrows` `[[1, 5], [2, 4]]`. So `exportLaTeX('dynkin', {type: 'E6', black: [3,4,5], tau: [6,2,5,4,3,1]})` returns exactly `\dynkin[involutions={16}] E{oo***o}`, and so on.
- Shape of the string (read off the three forms): `\dynkin`, then the option `[involutions={...}]` only when there is at least one arrow, then one space, then the family letter of `type` (`A` to `G`, the type name without its rank), then `{`, the marks, `}`. No trailing newline from `exportLaTeX` (plan; `latexFile` adds line ends). With no arrow there is no option at all, never `[involutions={}]`.
- Arrows ("arrows as an option"): the pairs $\{i,\tau(i)\}$ with $i<\tau(i)$ and **both nodes white** (SPEC 2.15: "White nodes exchanged by $\tau$ are joined by an arrow in the drawing"; "the drawing shows arrows between white nodes only"; 6.4 `arrows` "pairs of white nodes"). Each pair is written as its two labels concatenated, smaller first (`16`, `15`, `24`); pairs are separated by `;` with no space, in increasing order of the smaller label (`{15;24}`). This must equal the golden `arrows` of every record. A $\tau$ that exchanges black nodes (the $3\leftrightarrow5$ of `e6(-14)`, the swap of `so(1,7)` on $D_4$, the flip of the compact form `su(4)`) contributes nothing: "Printed tables and the CoReLG software record $\tau$ only on white nodes" (2.15), and the package draws what a printed diagram shows. T13's toggle "show $\tau$ on black nodes" [D] is a screen option of `P6-A3` and does not change the export (plan reading; record it).
- Undecorated diagrams (T14 downloads, the default of every tool): all marks `o`, no option: `\dynkin E{oooooooo}` for $E_8$, `\dynkin G{oo}` for $G_2$. This follows from the same rule ("explicit marks"); the package's short forms such as `\dynkin E8` are not used (plan reading of 6.7).
- Not used, SPEC 6.7 verbatim: "The package's own named diagrams (`\dynkin E{VI}` and so on) are not used for export because the mapping of its sub-labels to particular ranks was not checked." No Roman-numeral or named argument ever appears; no ellipsis `.` marks, no `fold` option (the package's internal strings use them, `SOURCES.md` line 257; you do not).
- $B_2$ and $C_2$: use the family letter of the `type` given (`B` or `C`). The golden catalogue has records under both `B2` and `C2` (6.4 "Coincidences"); a picker shows the name the reader chose (D19). Do not normalise `C2` to `B2`.
- Refusals (plan): throw `RangeError` with a message naming the fault when `type` is not a finite type name the package draws with marks (`A1`..`A8`, `B2`..`B8`, `C2`..`C8`, `D4`..`D8`, `E6`..`E8`, `F4`, `G2`, the 32 types of the golden file; affine, twisted, `pentagon`, `square` and custom boards are refused: section 9 trap 8); when a label of `black` or `tau` is outside `1..n` or repeated in `black`; when `tau` is not a permutation of `1..n` or its square is not the identity (2.15: "a symmetry $\tau$ of the board with $\tau^2=1$"). Whether $\tau$ is a symmetry of the board and whether the pair is admissible are not `exportLaTeX`'s concern: it draws a decoration, and T13 decides what to offer (plan). All 32 names have rank at most 8, so labels are single digits and the concatenated pairs are unambiguous; keep the check so that a rank above 9 throws rather than writing `{110}` (plan).
- Pure: `exportLaTeX` imports nothing from the engine, KaTeX, Svelte or the DOM, so that `P6-A4` can call it at build time in Node and `ToolFrame` can load it with the dynamic `import()` of `export.ts` that `P1-A2` set up (SPEC 7.6: "No typesetting library ... is sent to the client"; the export module must not weigh on the route budget).

### 5.2 `exportLaTeX('tikz-graph' | 'tikz-points', data)` (SPEC 6.7 "Orbit graphs and projections are exported as plain TikZ coordinates")

The specification fixes only "plain TikZ coordinates"; every detail below is (plan) and goes in your fragment.

- `tikz-graph` (orbit graphs: T2's garden, T8's graph): `export interface TikzGraphData { nodes: { x: number; y: number; label?: string }[]; edges: [number, number][]; directed?: boolean }`. Output:

  ```latex
  \begin{tikzpicture}
    \node[circle,draw,inner sep=1pt] (n0) at (0,0) {$1$};
    \node[circle,draw,inner sep=1pt] (n1) at (1.5,-1) {};
    \draw (n0) -- (n1);
  \end{tikzpicture}
  ```

  one `\node` per node in the order given, one `\draw` per edge in the order given (`->` instead of `--` when `directed`), no style library, no `\usetikzlibrary`.
- `tikz-points` (projections: T10, T6): `export interface TikzPointsData { points: [number, number][]; edges?: [number, number][]; labels?: (string | null)[] }`. Output: one `\fill (x,y) circle (1pt);` per point, then one `\draw (x1,y1) -- (x2,y2);` per edge, inside one `tikzpicture`.
- Coordinates: mathematical orientation (y up); a caller converting from SVG screen coordinates negates y. Numbers are written with at most 4 decimals, trailing zeros removed, `-0` written `0`; a non-finite coordinate throws `RangeError`.
- Labels: TeX special characters escaped (`\ # $ % & _ { } ~ ^`); a label is written in full, never shortened: SPEC 4.0 "Long numbers": "A value of more than 12 digits is shown shortened ... with the exact digits in the table view, in the tooltip and in every export."
- Default size: no scaling inside `exportLaTeX`; a caller passes coordinates already scaled to a few centimetres (plan).

### 5.3 The downloaded file (plan)

- `latexFile(kind, body, link): string` returns the text of the `.tex` file "Export LaTeX" downloads: a first comment line `% <link>`, a second comment line naming what the snippet needs (`% needs \usepackage{dynkin-diagrams}` for `dynkin`, `% needs \usepackage{tikz}` for the TikZ kinds), then `body`, then a final newline. No `\documentclass`: the file is a snippet to `\input` (record this; the owner compiles "one exported LaTeX file of each kind" at G6, SPEC 9.1).
- File name: `P2-A6`'s `exportFileName(toolId, boardName, 'tex')`, so the base name matches the SVG and PNG exports.

### 5.4 `ToolFrame`: "Export LaTeX" and "Cite" (CONTRACTS 5.1; SPEC 4.0, 7.4)

- Protocol: add, do not restructure. Add two `<button type="button">` with exactly the texts `Export LaTeX` and `Cite`, after `Export PNG`, at the place `P2-A6` marked with a comment. Hooks: use the attribute family `P2-A6` used for its buttons (read it on `main`; its instruction names `[data-export]`): plan names `data-export="latex"` and `data-control="cite"`, and `data-out="citeText"` for the citation. `P1-A2`'s `toolframe.test.ts`, `nojs.spec.ts` and `P2-A6`'s `export.spec.ts` and `export-svg.test.ts` must stay green; run them.
- Disabled until hydration, rendered in the server HTML so hydration does not change the frame's size (SPEC 4.0: "Controls are present but disabled until the island has hydrated"; 7.4: "Controls are rendered with the `disabled` attribute, which the island removes when it hydrates"; 7.6: "Tools reserve their box size in the HTML"). Nothing happens on page load; only a click or a key starts an export or a citation (A-9 "No motion starts by itself"; 4.0 "Neither control acts by itself on page load").
- Keyboard: native buttons, reachable in the control row's tab order, named by their visible text (A-1, 4.1.2); targets 44 pixels where the layout allows, never below 24 (A-7, 4.0 "Small screens"); usable at 320 CSS pixels (A-11).
- **Export LaTeX**, what it exports (plan):
  - a new optional prop `latexForExport?: { kind: 'dynkin'|'tikz-graph'|'tikz-points'; data: unknown } | (() => { kind; data } | null)`; a tool that passes it chooses what is exported (T2 an orbit graph, T10 a projection, T13 the selected diagram);
  - otherwise the default: when `state.board` is a string naming one of the 32 finite types, `exportLaTeX('dynkin', { type: state.board, black: state.black ?? [], tau: state.tau ?? identity })`; this gives every tool on a named finite board an export of its diagram with no code of its own, as `P2-A6`'s buttons did for SVG and PNG;
  - otherwise (affine, twisted, preset or custom board, and no prop): the click shows `nothing to export as LaTeX` (plan wording) in `P2-A6`'s `data-out="exportNotice"`; the button stays present so that the frame keeps its size.
  - the click builds `latexFile(kind, exportLaTeX(kind, data), linkFor(instanceId))` and downloads it as `P2-A6` downloads (object URL, `<a download>`, revoked afterwards); every error is caught into `exportNotice`; no `console.log`.
  - The new prop is an addition to CONTRACTS 5.1: report it under `deviations` as additive (as `P2-A6` did with `boardName`).
- **Cite** (SPEC 7.4, verbatim: ""Copy link" gives the link of section 6.6, which carries no site version. "Cite" gives a citation text with the page title, the site version (git commit), the date and the link. Old schema versions stay readable."):
  - `citeText({ title, siteName, commit, date, link }): string` in `export.ts` (pure, unit-tested). Plan format, one line: `<title>. <siteName>, site version <commit>, <date>. <link>`, for example `Game Board. Two Games on a Dynkin Diagram, site version 3f2a9c1, 2026-11-02. https://owner.github.io/repo/tools/board?z=1&g=A2&w=1.2`.
  - `title`: the page's title at the moment of the click (`document.title`, with the site-name suffix removed if the layout adds one; plan). On a lesson page this is the lesson's title; on `/tools/<id>` and `/embed/<id>` the tool's title.
  - `siteName`: the site's name as configured once by phase 0 (D1 default: the working title "Two Games on a Dynkin Diagram" [D], SPEC 1.7); read it from where the layout reads it; never type it a second time if a constant exists (plan).
  - `commit`: the same build constant `exportJSON` writes (`P1-A2` 5.5), so the two never disagree.
  - `date`: the reader's local date at the click, ISO 8601 `YYYY-MM-DD` (plan reading of "the date": the access date of a web citation; record it).
  - `link`: `linkFor(instanceId)`, the exact string "Copy link" copies; it carries no version (6.6: "A link carries no site version").
  - The click shows the text in `data-out="citeText"` (a visible, selectable paragraph inside the frame, so the reader can copy it by hand) and copies it with the Clipboard API inside `try`; plan announcement through the live region: `Citation copied.` when the copy succeeds, `Citation shown below the tool.` when it fails.

### 5.5 The embed route `site/src/pages/embed/[tool].astro` (SPEC 7.4 "Embedding", 7.3, 6.6; CONTRACTS 5.2)

- SPEC 7.4, verbatim: "Every tool has a route `/embed/<tool>` that renders the tool alone for use in an `<iframe>`, accepting the same query parameters. Web components are a phase 7 option." Do not build web components.
- Generated from the registry (CONTRACTS 5.2: "`pages/tools/[tool].astro` and `pages/embed/[tool].astro` are generated from it. A tool agent never edits those pages."): `getStaticPaths` gives one route per entry of `registry`, `/embed/<id>`, with exactly the ids of `/tools/<id>`. Hydrate the registry component the same way `[tool].astro` does (`P1-A2` trap 1; if `[tool].astro` uses a generated static import table, use the same table, do not build a second one; if that table lives inside `[tool].astro` and cannot be imported, request through `MERGE` that it move to a shared module and, meanwhile, report the item `blocked` rather than copying the imports).
- The tool in its `default` state with its caption (4.0 "Starts meaningful"), hydrated `client:idle` (7.6: "the first tool of a page hydrates when the browser is idle"), with an empty instance id so that the keys are bare (6.6: "On a tool's own route (`/tools/...`, `/embed/...`) the keys are bare."). The tool reads the URL itself on hydration through `decodeState`; validation and the notice of 6.6 are the codec's and the tool's; your route adds nothing to them.
- "Alone": no site navigation, no header, no theme switch, no footer of the site (plan reading). The page is a complete HTML document of its own (plan): `lang="en"`, a `<title>` equal to the tool's registry title, the site's stylesheets (tokens and themes of 6.3 and 8.3, as the layout of `[tool].astro` loads them) so the tool looks as on the site in light and dark (`prefers-color-scheme`; an embedding page cannot reach the reader's stored theme), `<meta name="robots" content="noindex">` and `<link rel="canonical">` to `/tools/<id>` (plan), and one small link under the tool, `Open on the site`, to `/tools/<id>` with the same query, `target="_blank"` and `rel="noopener"` (plan; it carries the credit when the tool is framed elsewhere). A root hook `data-embed` on `<body>` (plan) so tests can tell the route apart.
- Every internal link and asset from `import.meta.env.BASE_URL` (7.2 item 10); never a path typed with a leading slash. No third-party script, font or request (7.8 "No third-party script at runtime").
- Without JavaScript (4.0, 7.4): the default figure, the caption, the `<noscript>` line and the A-10 table are in the HTML, every control `disabled`. `P1-A2`'s `nojs.spec.ts` skips `/embed/*` ("phase 6, its own check"), so `embed.spec.ts` carries that check for your routes.
- Size: SPEC 7.6 has no row for embed routes. Plan: hold each `/embed/<id>` to the limit of "each tool alone, on `/tools/<id>`: 90 kB", which it cannot exceed if it carries no shell. Report the gzip size of `/embed/board` if you can measure it without running `npm run size` (COMMON 4.3), and request that `MERGE` or `GATE` add `/embed/*` to the routes `npm run size` measures if `size.mjs` does not discover them.
- Accessibility: the embed page passes axe with no serious or critical violation (7.7), has one `<main>` landmark and the tool's accessible names as on `/tools/<id>`.

### 5.6 What is not yours

- T13's catalogue button "Export as `\dynkin` LaTeX" and the decoration it passes are `P6-A3`'s (SPEC 4 T13 "Catalogue"); T14's LaTeX download is `P6-A4`'s. They call your `exportLaTeX`.
- Wiring `tikz-graph` into T2 or T8 and `tikz-points` into T10 or T6 needs a `latexForExport` prop in components you do not own. Request it (section 10, `requests`): to `MERGE`, for the owners of `T02OrbitGarden.svelte` (`P1-A6`) and `T10GeometryStudio.svelte` (`P4-A3`) at least, so that by G6 one tool exports each TikZ kind and the owner can compile "one exported LaTeX file of each kind".
- `P6-A6` owns the footer with the versions; your citation reads the same commit constant and never edits the footer.

## 6. Acceptance

Gate: G6 (roster gate items "LaTeX export produces the three forms of 6.7 (compiling them is the owner's part)", "full accessibility scan of every page and tool route", "sizes and lab timings of SPEC 7.6 on every page"). Every line names the automated test that proves it.

- [ ] Roster acceptance "the three forms of 6.7 reproduced exactly" and gate item "LaTeX export produces the three forms of 6.7": `site/tests/unit/latex.test.ts` > `the three forms of SPEC 6.7 byte for byte` (inputs `black_nodes` and `tau` of the golden records `e6(-14)`, `e7(-5)`, `su(2,4)`; expected strings typed from 6.7). G6.
- [ ] Roster deliverable "a Satake export for every record of Appendix B has one mark per node in Bourbaki order" (plan: swept over all 167 records of `satake`, of which Appendix B is a printing): `latex.test.ts` > `one mark per node in Bourbaki order for every satake record` (length equals `rank`, `*` exactly at `black_nodes`). G6.
- [ ] SPEC 6.7 "arrows as an option" with 2.15 and 6.4 "arrows (pairs of white nodes)": `latex.test.ts` > `the involutions option equals the golden arrows for every satake record` (no option exactly when `arrows` is empty). G6.
- [ ] SPEC 2.15 "the drawing shows arrows between white nodes only": `latex.test.ts` > `tau on black nodes is never exported` (`e6(-14)`, `so(1,7)`, `su(4)` give no pair with a black node; `su(4)` gives `\dynkin A{***}`). G6.
- [ ] SPEC 6.7 "The package's own named diagrams ... are not used": `latex.test.ts` > `no named diagram syntax` (no output for any record or type matches `\{[IVX]+\}`, `fold` or `.` in the marks). G6.
- [ ] Undecorated export of every named type (plan reading of "explicit marks"): `latex.test.ts` > `undecorated diagram for each of the 32 types` (`\dynkin E{oooooooo}`, `\dynkin G{oo}`, `\dynkin C{oo}` for `C2`, `\dynkin B{oo}` for `B2`). G6.
- [ ] Refusals (plan): `latex.test.ts` > `invalid dynkin data throws RangeError` (unknown or affine type, label out of range, `tau` not a permutation, `tau` squared not the identity). G6.
- [ ] SPEC 6.7 "Orbit graphs and projections are exported as plain TikZ coordinates": `latex.test.ts` > `tikz-graph writes one node per vertex and one draw per edge`, `tikz-points writes plain coordinates`, `coordinates have at most four decimals and no minus zero`. G6.
- [ ] SPEC 4.0 "Long numbers" ("the exact digits ... in every export"): `latex.test.ts` > `labels keep every digit` (a 30-digit label written in full). G6.
- [ ] `latexFile` names the package and the link (plan): `latex.test.ts` > `the downloaded file names its package and link`. G6.
- [ ] SPEC 7.4 "Cite" "page title, the site version (git commit), the date and the link": `latex.test.ts` > `citeText holds title, site name, version, date and link`; `site/tests/e2e/embed.spec.ts` > `Cite gives the page title, the commit, the date and the link` (fixed clock; the commit equals the `commit` field of "Download data"; the link equals the Copy link string). G6.
- [ ] SPEC 6.6 and 7.4 "A link carries no site version": `embed.spec.ts` > `the cited link carries no site version`. G6.
- [ ] CONTRACTS 5.1 "from phase 6 "Export LaTeX", "Cite"": `embed.spec.ts` > `Export LaTeX downloads the diagram of the board` (`/tools/board?z=1&g=E6` downloads a `.tex` file containing `\dynkin E{oooooo}`) and `Cite gives ...`. G6.
- [ ] SPEC 4.0 and 7.4 controls disabled until hydration: `embed.spec.ts` > `Export LaTeX and Cite are disabled without JavaScript and enabled after hydration`; `P1-A2`'s `nojs.spec.ts` and `toolframe.test.ts` and `P2-A6`'s `export.spec.ts` stay green (run once each). G6.
- [ ] SPEC 7.5 A-1 keyboard: `embed.spec.ts` > `Export LaTeX and Cite work from the keyboard`. G6.
- [ ] Roster acceptance "every embed route renders and hydrates (e2e, one per tool)" and SPEC 7.4 "Every tool has a route `/embed/<tool>`": `embed.spec.ts` > `every registered tool has an embed route` (the set of `site/dist/embed/*` equals the set of `site/dist/tools/*`) and `embed route renders and hydrates: <id>` (one generated test per route found: `data-tool` equals the id, `data-hydrated="true"`, no site navigation, `data-embed` present). G6.
- [ ] Roster deliverable "a test that /embed/board?g=A2&... loads the state" and SPEC 7.4 "accepting the same query parameters": `embed.spec.ts` > `the A2 state loads on the embed route` (`/embed/board?z=1&g=A2&v=n&m=l&c=n&s=1,1&w=1.2` shows `data-moves="2"`, node 1 `data-value="1"`, node 2 `data-value="-2"`, no notice; these are the positions of SPEC 4 T1 acceptance, "firing 1, 2, 1 shows $(-1,2)$, $(1,-2)$, ..."; the same query on `/tools/board` shows the same hooks). G6.
- [ ] SPEC 6.6 "Validation" on an embed route: `embed.spec.ts` > `an unreadable link on an embed route shows the notice and the default state` (`/embed/board?z=1&g=A2&w=9`). G6.
- [ ] SPEC 7.4 "Without JavaScript" on the embed routes (not covered by `nojs.spec.ts`): `embed.spec.ts` > `embed routes render without JavaScript` (for every route: figure, caption, `<noscript>` line, A-10 table, every control `disabled`). G6.
- [ ] SPEC 7.7 accessibility "axe scan of every page and tool route", G6 "full accessibility scan": `embed.spec.ts` > `embed routes pass axe` (no serious or critical violation), using the axe package and helper `P0-A5`'s `a11y.spec.ts` uses. G6.
- [ ] SPEC 7.8 "No third-party script at runtime": `embed.spec.ts` > `an embed route makes no external request`. G6.
- [ ] SPEC 7.6 sizes on every page: `npm run size` (run by `GATE`; report your measurement or the request of 5.5). G6.
- [ ] `export.ts` still loads in Node without a DOM: `latex.test.ts` > `the export module loads in Node without a DOM`. G6.
- [ ] COMMON 4.3: each test fails when its behaviour is removed; check it on the three-forms test (drop the option) and on the tau-on-black test (draw every pair).
- [ ] Type checks: `npx astro check` and `npx svelte-check` (or `npm run typecheck`) pass; no `any` without a comment.
- [ ] Owner's part of G6, not automated (SPEC 9.1: "one exported LaTeX file of each kind compiled (section 6.7)"; 6.7: "the build pipeline has no TeX installation"): report `not-automated` with the gate G6.

## 7. Files

- **You own** (the roster's list, exactly):
  - `site/src/lib/export.ts (exportLaTeX; additive)`
  - `site/src/pages/embed/[tool].astro`
  - `site/src/components/board/ToolFrame.svelte (Export LaTeX and Cite buttons; additive)`
  - `site/tests/unit/latex.test.ts, site/tests/e2e/embed.spec.ts`
  - `decisions/P6-A5.md`
- **You may edit with the stated protocol**: `export.ts` additively (`exportJSON`, `exportSVG`, `exportPNG` and their signatures untouched); `ToolFrame.svelte` additively (two buttons, one optional prop, one output element, their handlers and component-scoped styles; nothing existing moved, renamed or restyled; README 6: "`P6-A5` adds LaTeX to `export.ts`").
- **You must not touch**: everything else; in particular `reference/` (read only; your test reads `golden_data.json` as input and never calls the harness's `covers`, since `satake` is covered by `P6-A1` and `P6-A2`), `DECISIONS.md`, root `package.json` and the lockfile (you add no dependency), `site/src/content/unverified.json`, the engine, `site/src/pages/tools/[tool].astro` and every other page, `site/src/tools/index.ts`, `types.ts` and `registry/*`, every `T{nn}` component and its tests, `history.ts`, `urlCodec.ts`, `state.ts`, the layouts, `site/src/styles/*` beyond styles scoped to your components, `Footer.astro` (`P6-A6`), `nojs.spec.ts`, `a11y.spec.ts`, `basepath.spec.ts`, `export.spec.ts`, `export-svg.test.ts`, `toolframe.test.ts`, `playwright.config.ts`, the root Vitest configuration, `scripts/`. A change you need there goes under `requests`.

## 8. Order of work

1. Checks: `node --version` (22.12 or later); `git rev-parse --show-toplevel` and `git branch --show-current` (`agent/P6-A5`); `npm ci --prefer-offline` if `node_modules` is absent; `npm run build` passes on `main`. Read the files of section 2 item 14 and the installed type definitions of `astro` and `svelte` you use (COMMON 3).
2. Write `latex.test.ts` for the `dynkin` kind (the three forms, the sweep over the 167 records, tau on black, named syntax, undecorated, refusals) and watch it fail. Implement `exportLaTeX('dynkin')` and its types in `export.ts`. Run it with `export.test.ts` and `export-svg.test.ts`. Commit `P6-A5: exportLaTeX for dynkin-diagrams with the three forms of 6.7`. This is the first usable increment: `P6-A3` and `P6-A4` can build on it.
3. Tests, then code, for `tikz-graph`, `tikz-points`, `latexFile`, `citeText`. Commit.
4. `ToolFrame`: the two buttons, `latexForExport`, the default derivation, the citation output. Run `toolframe.test.ts`. Commit.
5. `embed/[tool].astro`. `npm run build`; check `site/dist/embed/*` against `site/dist/tools/*`; open `/embed/board` in `astro preview` and inside a scratch `<iframe>` page once by hand. Commit.
6. `embed.spec.ts`: build, then run only your spec (`npx playwright test site/tests/e2e/embed.spec.ts`), then, one at a time, `nojs.spec.ts` and `export.spec.ts` to see they are still green. Kill `astro preview`. Commit.
7. Type checks; the fragment; the report.

## 9. Traps

1. **Marks are one character per node in Bourbaki order; arrows are the involutions option listing white-node pairs only** (roster; 6.7, 2.15). The golden `tau` of `e6(-14)` swaps 3 and 5, both black: writing `{16;35}` is the classic mistake. The compact forms of $A_n$, $D_n$ ($n$ odd) and $E_6$ have a non-trivial $\tau$ and no arrow; `so(p,2n-p)` with $p\le n-2$ and $n-p$ odd has the swap and no arrow (2.15 "What the diagram does not show").
2. **Compiling the files is the owner's part; the build has no TeX** (roster; 6.7). Do not add a TeX dependency or a CI step; the byte-for-byte test against 6.7 is the automatic check.
3. **Labels, not positions.** `black`, `tau` and the arrows are labels from 1 (as in `ToolState` and the golden file); engine functions use positions from 0. An off-by-one shifts every mark. Do not convert through the engine: on a named finite board label $k$ is position $k-1$ and Bourbaki node $k$.
4. **The exact punctuation**: one space after the option or after `\dynkin`, none inside the braces; `;` between pairs with no space; the two labels of a pair concatenated; no `[involutions={}]` when there is no arrow; the family letter only, never the rank (`E{...}`, not `E6{...}`).
5. **Do not use the package's named forms** (`\dynkin E{VI}`, `\dynkin E6`) or its internal mark strings with `.` and folds (`SOURCES.md` line 257): 6.7 refuses them because their mapping to ranks was not checked.
6. **$B_2$ and $C_2$.** The engine's computed names say `B2` (COMMON 2), but a catalogue record or a picker may say `C2`; export the letter of the name you are given. The golden file has three records under each.
7. **`export.ts` must stay light and DOM-free** (CONTRACTS 4; `P1-A2` loads it with a dynamic `import()`; `P2-A6` tests that it loads in Node). No engine import (derive arrows from `tau` yourself), no KaTeX, no top-level `window`.
8. **Boards the package cannot draw with marks.** Affine (`A4~`, `C2~`), twisted (`D4^(3)`), `pentagon`, `square` and custom boards have no `dynkin` form in 6.7. Refuse them in `exportLaTeX` and show the notice in `ToolFrame`; do not invent an affine syntax. Put the question in `openQuestions`.
9. **T13 and T14 arrive after you.** Stage 6.1 runs before stage 6.2. Never hard-code the list of tool ids in `embed.spec.ts`: derive the routes from `site/dist/tools/*` (or the registry files) so that `MERGE` and `GATE` test `/embed/satake` and `/embed/atlas` once they exist. T14 is "static pages" per board (CONTRACTS 6; SPEC 4 T14); if its registry entry has no hydrating component, the "hydrates" assertion cannot apply to it: make the per-route test assert hydration only when the route contains a `data-frame` element, and write the reading in your fragment and in `openQuestions`.
10. **Hydration directives and dynamic components** (`P1-A2` trap 1). Astro does not hydrate a component held in a variable with `client:*`. Use exactly the mechanism `[tool].astro` uses; verify in `site/dist/embed/board/index.html` that an island is emitted.
11. **The run without JavaScript skips you.** `nojs.spec.ts` skips `/embed/*`; if `embed.spec.ts` does not check those routes with JavaScript off, nobody does.
12. **Bare keys on the embed route.** An instance id on the embed page would prefix every key (`b1.g=A2`) and break "accepting the same query parameters". Mirror `[tool].astro` exactly.
13. **Base path.** Every link (the canonical link, `Open on the site`, stylesheets) from `import.meta.env.BASE_URL`; a leading slash passes the default build and fails `P0-A6`'s `BASE_PATH=/sub/path/` run at the gate.
14. **The clipboard in Playwright** needs a permission and differs by browser; assert on `data-out="citeText"` and on the downloaded file, not on the clipboard. Fix the clock (`page.clock`) before testing the date.
15. **Do not restructure `ToolFrame`.** Other tools and tests depend on its hooks and layout; add beside `P2-A6`'s buttons, keep the box reserved, and keep every new control `disabled` until hydration.
16. **No em-dashes** in any string you ship (the notice, the announcements, the link text), per the house style of 8.4.

## 10. Report

The JSON of `COMMON.md` 5.2, with:

- `acceptance`: every line of section 6, the owner's compile check as `not-automated` with gate G6.
- `deviations`: the optional prop `latexForExport` on `ToolFrame` (additive to CONTRACTS 5.1); the exported types `DynkinExportData`, `TikzGraphData`, `TikzPointsData` and the helpers `latexFile`, `citeText` (additive to CONTRACTS 4); anything else you changed against CONTRACTS.
- `requests`: to `MERGE`, for `P1-A6` (T2) and `P4-A3` (T10) at least, a `latexForExport` prop passing an orbit graph (`tikz-graph`) and a projection (`tikz-points`), so that one file of each kind exists for the owner at G6; to `MERGE` or `GATE`, `/embed/*` in the routes of `npm run size` and of the axe scan if they are not discovered from `site/dist`; to `P1-A2`'s area through `MERGE`, a shared module for the registry's hydration table if `[tool].astro` keeps it private.
- `decisionsFragment`: `decisions/P6-A5.md`, one dated entry each: the reading that the comments of 6.7 are not output; the arrow order and the refusal rules; the undecorated form; the TikZ formats, decimals and orientation; the `.tex` file header and name; the `latexForExport` prop and the default derivation; the Cite format, the site-name source and the access-date reading; the embed page's layout (no navigation, `noindex`, canonical, `Open on the site`, theme by `prefers-color-scheme`) and the size limit applied; the T14 reading of trap 9; the D1 and D19 defaults relied on.
- `openQuestions`: whether affine boards should ever have a `dynkin` export; whether the downloaded `.tex` should be a standalone document; the date in the Cite text (access date) for the owner's confirmation; the reading of "renders and hydrates" for T14.
- `proposedUnverifiedItems`: empty; nothing here rests on an item of Appendix E.
- Extra field `latexSamples` (plan): the exact strings your code produces for `e6(-14)`, `e7(-5)`, `su(2,4)`, `su(4)`, `so(1,7)` and the undecorated `E8`, so the reviewer can compare them with 6.7 at a glance.
