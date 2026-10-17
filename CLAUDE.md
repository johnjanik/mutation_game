# Two Games on a Dynkin Diagram: rules for this repository

Read SPEC.md sections 0, 1, 2 before changing code. SOURCES.md resolves citation keys.

## Conventions (do not change; SPEC.md section 2)
- Cartan matrix: C[i][j] = <alpha_i^vee, alpha_j> (Kac, SageMath). Bourbaki prints the transpose.
- Board: A[i][j] = roads from i to j = -C[j][i]. More roads run from long to short.
- Mutation (populations, roots): only entry i changes: p[i] <- p[i] - sum_j C[i][j] p[j].
- Firing (numbers, weights): a[j] <- a[j] - C[j][i] a[i] for all j, so a[i] <- -a[i].
- Legal firing: the number is positive. The game ends when none is positive.
- Translator: a = C p. The number on a node is the drop a mutation would cause there.
- The board never changes (quiver mutation is a different operation; SPEC 2.16).
- Nodes: positions 0..n-1 inside the engine (as in the oracle); labels everywhere else
  (Bourbaki 1..n; 0 first on affine boards). Only toLabels / toPositions convert. (SPEC 5.1, E-7)
- Where a choice is free, take the lowest position first (play, kostantPlay, searches). (E-5)
- B2 and C2 are one board: computed names say B2, its affine board is C2~.

## Ground truth
- reference/golden_data.json is the contract for packages/engine. Port from reference/lie_games.py.
- Regenerate with: python3 reference/verify.py reference/golden_data.json (stdlib only; must report 0 failed).
  npm run verify reruns it and compares with the committed file.
- Never edit golden_data.json by hand. If the math looks wrong, add a failing check to verify.py and stop.
- Comparison rules and the phase of each golden key: SPEC.md 5.7.

## Build
- Node >= 22.12, npm workspaces. Astro 7 static, MDX, Svelte 5 (runes), TypeScript 6.0.x (not 7).
- Astro 7's default Markdown processor does not run remark or rehype plugins; see SPEC.md 7.2.
- KaTeX CSS and fonts must match the KaTeX version that rendered the HTML. Self-host them.
- GitHub Pages serves under /<repo>/: site and base come from the environment (SPEC 7.2 item 10);
  build every link from import.meta.env.BASE_URL.
- Exact pinned versions; commit the lockfile.
- Commands: npm ci; npm test; npm run build; RELEASE=1 npm run build; npm run e2e; npm run size;
  npm run verify.
- For automated checks use astro build + astro preview, not astro dev.

## Rules
- Mathematics lives only in packages/engine, which has NO dependencies (no DOM, no npm packages).
  Components call it. Every dependency added to the site is recorded in DECISIONS.md (version,
  licence, and size if it is shipped to the reader).
- Numbers: SafeInt (guarded number) only on named finite-type boards; bigint (Big) on every other
  board. Both exist from phase 0 behind the Arith interface. Counts that can be large (dimensions,
  numbers of games) are bigint.
- Every enumeration has a cap and returns {items, truncated}; every play returns a status.
  Off the finite types a search is bounded by layers (maxDepth, default 40), never by guessing.
- Main thread: at most 2000 items or 2000 moves per call. Anything larger runs in the worker (E-9).
- Satake records for display come from satakeRecord, which applies the C2 naming of SPEC 6.4.
- A board with a one-way road is allowed in the editor; theory functions refuse it (SPEC 5.6).
- Every tool: default state rendered at build time (works without JavaScript), keyboard operable,
  announced moves (templates in SPEC 7.5), sign shown by numeral and fill as well as colour,
  undo, reset, link, export, table view, test hooks data-node / data-board / data-value /
  data-can-act / data-out (SPEC 4.0).
- Lessons read fully without JavaScript. Nothing essential behind a click.
- Numbers in prose come from <G k="..."/>, numbers in formulas from <Tex src="...{{path}}..."/>.
  Anything resting on an open item of SPEC Appendix E is wrapped in
  <Unverified item="E..." fallback="...">. Never set an item to closed; the owner does that.
  Citations use <Cite k="..."/>. Do not copy text or figures.
- Prose style: plain sentences, no em-dashes, terms from SPEC.md Appendix C.
- One tool or one lesson per pull request, with tests. Merge it yourself when every required check
  is green. Open decisions: use the default in SPEC.md section 10 and log it in DECISIONS.md.
- The public site changes only when a version tag is pushed or the owner runs deploy.yml by hand;
  the owner tags releases.
- No tool's default state may need the worker: precompute at build time, or offer a button.

## Phases (SPEC.md section 9)
0 foundations; 1 the two moves (T1, T2, T9; M0, M1); 2 form and classification (T3, T4, T15, T16; M2, M3);
3 duality and Weyl group (T5-T8; M4, M5; release 0.5); 4 multiple edges and geometry (T10, T11; M6, M7);
5 representations (T12; M8); 6 real forms, atlas (T13, T14; M9, M10; release 1.0); 7 extensions.
Start a phase when the automatic part of the previous gate passes. The owner's part is due at releases and never holds up a phase.

This repository is built by several Claude Code agents at once. The rules for working together (file ownership, branches, decisions fragments, reports, the red team) are in build-plan/: read build-plan/COMMON.md and build-plan/CONTRACTS.md, then your own file in build-plan/agents/.
