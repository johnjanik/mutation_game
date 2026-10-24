## toolchain-b (689d441): 8/8 fixed, regression tests fail on revert
- Residuals: eight tool unit tests (T01, T02, T03, T05, T08, T09, T09-phase2, T15) keep their own createServer alias copies (sibling of P3-RT-12-05); mathml.spec.ts still skips an engine that is not installed, CI included (P3-RT-12-03 second half, kept on the orchestrator's instruction); the P0-A6 entry "the route classifier" in DECISIONS.md says /modules/* gets the lesson row (the fragment narrows it to /modules/<slug>/).
- Side effects: npm run build now runs scripts/links.mjs (postbuild) everywhere; npm run report refuses a report without complete: true (regenerate with RELEASE=1 npm run build). No version changed.
## perf-b (73f126a): 3/4 fixed (07-01, 07-04, 10-06), 07-03 needs-decision (confirmer agrees)
- 07-03 now: / fetches the engine chunk at 15081 B gzip (12037 at G3; phase 4 grew it); route / at 45.3 of 60 kB. Meeting the bound needs moving definitions between CONTRACTS 2.1 files or a second engine copy: the owner's call.
- Residual: T10_OUTS (t10/config.ts) lacks predictResult and predictReveal (Predict.svelte renders them): sibling of 10-06 for P4-A3.
- Note: historyNames-cursor-only.test.ts checks source text only; behaviour checked by hand on all 11 History users. A new tool must also be added to site/src/tools/offered.ts.
- Full e2e on the branch: 634 passed, 2 skipped.
## test-integrity-b (1f2c676): 7/8 fixed, 11-09 needs-decision (confirmer agrees: history cannot be rewritten)
- Gap to fix: coverage-gate.test.ts does not guard the teardown wiring (removing the coverageGate(keys, phaseInForce()) call in _coverage.setup.ts line 94 leaves the test green and a deleted golden test file unnoticed).
- Later round: loose live-region checks in T10.spec.ts (157, 614, 615) and T11.spec.ts (203), phase 4 tools.
- Timing noise under load: T08 'picking F4' (passes alone), T10 unit long-task budget.
## follow-predict (041bf11): 4/4 fixed (13-04, 13-03, 13-10, 05-09) and siblings; reverts fail the tests
- Residual (minor): T7 Step at the end of the game is aria-disabled but Enter/Space/click still call step() and announce 'Game over after 6 moves.'; the fragment says the handler does nothing in that state.
- Pre-existing: T15 Play on at the end of the pentagon game is neither disabled nor aria-disabled and announces 'Played 0 moves to the end.'
- Design consequence (recorded in the fragment): any outside state other than the configured one withdraws an open prediction, a jump from a linked follower included (T8 vertex on M5 b2, T2 vertex), so a reader can skip a prediction that way.
- Label slip: the T08 engine-moves test is tagged P3-RT-13-04 but covers the T8 sibling of P3-RT-04-04. play-focus.spec.ts:46 unused 'page' (hint).
- Deviation (recorded): T02.spec and T08.spec count engine moves through Chromium coverage (site/tests/e2e/engineMoves.ts), not only data-* hooks.
## lesson-m5 (3046f31): 5/5 fixed (09-02, 08-05 M5 part, 08-08, 08-09 M5 part, 13-07)
- Residual (minor): E16 fallback types 'up to rank 7' in a prop the numbers-in-prose scanner does not read; beat 6 'rank at most eight' against the Seen box 'rank at most 8'. M5 at 1791 of 1800 words.
- The original RT-09-02 reproducer cannot pass on any branch (it asserts counterexamples that exist do not exist); the adopted M5.spec.ts test is the regression. The M2/M3 cases of 08-05 and the open-problem E4 part of 08-09 belong to lesson-m2/m3 and pages: check the full reproducers on the merged head.
## pages (dd29f7c): 5/6 fixed (08-01 open-problem part, 08-09 open-problem part, 08-03, 08-10, 08-06), 13-01 needs-decision (confirmer agrees)
- 13-01, the owner's four questions: (1) on prediction figures, do SPEC 8.1 P5 and 4.0 Predict override P1 / CONTRACTS 7 "every tool has a caption stating the result" (captions that state the setting, or ToolFrame withholding the caption until the prediction resolves; without JavaScript the caption reads in full after the <details>); (2) where revealing prose goes: (a) authors move it below the prediction into the next beat, or (b) Beat gains an after-figure slot (CONTRACTS 7 change); (3) whether T15's presets hold back moods and fateSentence while a prediction is open; (4) then the M0 to M5 owners apply the ruling to the 11 beats (M0 b2, b4; M1 b1, b5; M2 b1; M3 b4, b8; M4 b2, b6, b8; M5 b9).
- Residuals: [W-MS] research note with raw backticks in M0, M1, M3 to M6 Sources lists; removed autolinks leave 'Free: .', 'Preprint: .', 'Official sheet: . Solutions: , .', 'course page .'; citeTitle keeps notes for [Bjo88], [Car14], [Bou68], [Cox73]; credits page prints raw Markdown in svelte's author cell.
- Owner question: SPEC 8.2 item 7 orders the module links sandbox, Atlas, next; the fix follows 4 T16 and 8.1 P6 (sandbox last).
## small-fixes (9271516): 3/3 fixed (10-05, 05-08, 05-10) and residuals (T9 toPositions, T16 held count); reverts fail the tests
- T9 road counts now from engine exports (toNumbers, transposeBoard, coroot): 163 starts of 32 types match the oracle in unit and browser.
- New residuals: T09Kostant.svelte:440 data-mark={anyBoard.labels[k]} instead of toLabels (the regression scan misses label indexing); t09/kostant.ts finiteData cache key `${board.name ?? ''}|arith|labels` lets unnamed custom boards of one size share an entry; two readings of a move that changes nothing on more than four nodes: shared changedOnly 'Fired node 3. Move 1.' against T11 (t11/model.ts:612) '... Nothing changed. Move k.'.
- Deviation: commit fd4dbb0 titled with P3-RT-03-01 (another cluster's id).
## duplicates (40c2d50): 3/4 fixed (08-02, 10-01, 12-02); 07-02 partly fixed
- Cluster complete: 1f5bca0 tests for 08-02/10-01 (cause removed by group A ab7c723), e34058c 07-02 (classify.ts faster, one classify per load), 439ff89 12-02 (lock keyed by realpathSync: the two test files spelled the site directory with and without a trailing slash), 40c2d50 fragment.
- 12-02: 0 of 9 races in three runs, mixed spellings too; npm test three runs exit 0 (111 files, 2899 tests).
- 07-02 remainder: classify count 1 per load (was 2 to 5); Node bench passes (31 to 48 ms); but in the browser the T4 lab load of the 12-cycle by link has 58 to 77 ms engine self time and long tasks of 101 to 159 ms even at load 1.3; board-load.spec.ts 'lab' fails 3 of 3 and would turn npm run e2e red. Probably cold JIT (Node first-run 59 to 95 ms against 26.8 warm).
- Gaps: the T01 12-cycle case of state-classify-once.test.ts passes with 2f39395 reverted (does not guard T1); classify.ts change reason only in the commit message, not the fragment.
## residual-tools (merged 1f307df): 10/10 fixed; T11 now uses the shared changedOnly (SPEC 7.5 leaves the sentence open)
## residual-content (merged): 4 items fixed; needs the owner: SOURCES.md keys [RV16], [RV21] (no authors) and [CPS22] (no title), cited on no route today
- numbers-in-prose now reports fallback numbers as a third kind; M3 E4 fallback types 'rank at most 8', '2500' and 'ten' (lesson-m3 owner, later polish); M4 '1990' and M7 'node 7' are not golden values.
- citeTitle keeps the first sentence plus DOI/MSC/arXiv/ISBN: [BLS91] keeps its DOI, [EGH+11] loses a locator note, [Ste59] loses 'Free at the AMS.'.
## MERGE fix e604f98: timing config copied resolve.alias, which toolchain-b removed; npm run bench threw and scripts.test failed on the merged head.
