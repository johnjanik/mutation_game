# Gate G3: Duality and the Weyl group

- Phase: 3. Round: build.
- Date: 2026-10-11 00:43 (UTC).
- Gate commit (the tested commit, tagged gate-G3-candidate): 76b502f0a2f33b05ea50b7403b9de8413ce94cd6 MERGE: record the M0 test fix in the stage 3.3 entry
- Report commit: the commit that carries this file, above the gate commit; its SHA is in the JSON report.
- Verdict: RED (one item: the lab timings of SPEC 7.6 on the core path; every other item passes)
- Release named: 0.5, the core path. The two archives are built and left in reports/ (section 9); whether to tag and publish with the lab item red is the owner's decision (README 7).
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).

## 1. Preconditions

- `git rev-parse --show-toplevel`: /home/user/mutation_game. Branch claude/session-6a181f60-hzzoud. `git status --porcelain`: empty before and after the run. Node v22.22.0, npm 10.9.4, python3 3.13.16, Playwright 1.64.0 (Chromium only; WebKit and Firefox cannot be downloaded in this container, the network policy blocks their host).
- Expected commit from the stage 3.3 merge: 4a36786. The first gate run on 4a36786 (kept under reports/gate-G3/run1-4a36786/) passed every command except `npm run e2e`, where one assertion of site/tests/e2e/M0.spec.ts ("beat 5: links only to released modules", last edited at the stage 2.3 merge) still forbade links to M4 and M5, and `npm run lab`, which fails in both runs (section 4). MERGE fixed that test (a606a1c, recorded in DECISIONS.md, stage 3.3) and the whole chain was rerun on 76b502f, the tested commit. No source file changed between the two runs.
- reports/gate-G3/ recreated; earlier run-time reports moved to reports/gate-G3/previous/ (and the fixture report that content-components.test.ts writes to previous/fixture-*). Browser runs used `PLAYWRIGHT_BROWSERS_PATH` pointing at a scratch directory of symlinks to the container's Chromium build 1194 (Playwright 1.64.0 expects 1248; CI installs it).

## 2. Reference hashes

```
c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f  reference/golden_data.json
485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad  reference/lie_games.py
1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d  reference/verify.py
```

Equal to CONTRACTS.md 9.

## 3. Installed versions

Every pinned package (the ten of SPEC 7.1, @astrojs/check 0.9.10, svelte-check 4.7.6, katex 0.16.47, @astrojs/markdown-remark 7.3.2, remark-math 6.0.0, rehype-katex 7.0.1, @types/node 22.20.5) is installed at its pinned version; the table of reports/gate-G0.md section 3 holds unchanged. One dependency was added in phase 3: `@lhci/cli` 0.15.1 (Apache-2.0, build only, never shipped; Lighthouse 12.6.1 inside it), pinned exactly in the root package.json and installed at that version (P3-A7's entry in DECISIONS.md). Checked by script after `npm ci`: 0 mismatches.

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| golden tests through phase 3 pass (table of SPEC 5.7) | `npm test` | 0 | `Test Files  94 passed (94)`; `Tests  2489 passed (2489)`; coverage.json after the run: phase 0 missing `[]`, phase 1 `[]`, phase 2 `[]`, phase 3 `[]` (44 keys registered; the ten of phase 3: types[*].exponents, weyl_order, bipartite_colouring, fundamental_orbit_sizes, n_reduced_words_w0, length_distribution, weyl_dimension, heaps, pentagon_example.complete_games, e8, recomputed against the table of SPEC 5.7); each key registered by `covers()` in exactly one file (p3a-exponents, p3a-wave, p3a-orbit-size, p3a-games, p3a-weyl-dimension, p3a-e8, p3b-heaps, p3b-pentagon-games) | pass |
| property tests 1 to 13 as far as their functions exist (12 added) | `npm test` | 0 | files p1 to p8, p10, p12-heaps, p13 present under packages/engine/test/properties with their fixed seeds, among the 94 files that passed (p9 and p11 wait for their phase-4 and phase-5 functions) | pass |
| acceptance of T5, T6, T7, T8 as automated tests | `npm test`; `npm run e2e` | 0; 0 | site/tests/unit/tools/T05, T06, T07, T08 test files passed under site-unit; site/tests/e2e: T05.spec.ts 35, T06.spec.ts 14, T07.spec.ts 22, T08.spec.ts 10 passed; mathml.spec.ts 1 passed (Chromium) and 2 skipped (WebKit and Firefox, not installed here: the skip names `npx playwright install webkit firefox`; the MathML rendering in those engines is not verified by this gate, owner's part below); `534 passed, 2 skipped (7.2m)`, no failed or flaky test | pass |
| sizes and lab timings of SPEC 7.6 on the core path M0 to M5 | `npm run size`; `npm run lab` | 0; 1 | sizes: `size: 26 routes measured, 0 over budget` (the six lessons 70.8 to 74.7 kB of 120); lab timings against the root release build, default list (index, M0 to M5), three runs each, median per metric, processor check ok (devtools throttling at 4 in all 22 reports): LCP 0.23 to 1.67 s and CLS at most 0.0387 pass on every route; Total Blocking Time: `/` 59.4 ms ok, M0 261.3, M1 242.3, M2 276.2, M3 332.1, M4 269.9, M5 329.1 ms, each `OVER (TBT)` against 200 ms; `lab: 7 routes measured, 6 over threshold, 0 missing or in error`; table in section 8 | **fail** (lab timings) |
| a release build succeeds and prints its two reports (open items; numbers in prose) | `RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ npm run build`; `npm run report`; `RELEASE=1 BASE_PATH=/ npm run build` | 0; 0; 0 | both release builds 26 pages (no open-items route); open items printed during the build: E4 on m1-mutation, E6, E4 and E10 on m3-classification, E2 and E6 on m4-numbers, E3 and E16 on m5-weyl, E6 on tools/affine, E4 on open-problem (fallback shown); `report: open items report of 2026-10-11T00:33:03.162Z: 6 open items used on 6 pages, 0 unknown items`; reports/numbers-in-prose.md: `0 numbers in prose in 0 of 6 lesson files; 0 numbers inside formulas`; provenance: the final reports/open-items-report.json has mode release, generatedAt 00:33:16.250Z after the root build start 00:33:03Z, every page listed is a route of site/dist | pass |
| the benchmark of 7.6 (25 ms) passes | `npm run bench -w packages/engine` (the script P3-A2 asked for, test/bench/orbit.bench.ts alone, after the lab with no browser running, load average 0.83) | 0 | `orbit benchmark: median 21.01 ms of 7 runs [30.48, 25.62, 22.90, 19.54, 20.18, 19.64, 21.01] ms, threshold 25 ms, 2000 positions, truncated true`; `Tests 1 passed` | pass |
| no-JavaScript run, axe, sizes on every route; reference hashes unchanged | `npm run e2e`; `npm run size`; sha256sum | 0; 0; 0 | nojs.spec.ts 28 passed, one per route of site/dist (26 routes, listed in section 6) plus the companions; a11y.spec.ts 28 passed, every route scanned after hydration (120 s timeout, no scan over 30 s); routes not visited or not scanned: none; every route has a size row, none over budget; the three lines of section 2 | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 135.1s`; regenerated file byte for byte reference/golden_data.json | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `2 passed (31.3s)` | pass |
| supporting: `npm run build`, `npm run typecheck` | the two commands | 0; 0 | preview build 27 pages; engine tsc clean; `astro check` 0 errors; `svelte-check` 0 errors | pass |

One roster row fails (the lab timings): RED.

## 5. Commands run

Logs in /home/user/mutation_game/reports/gate-G3/ (uncommitted), each ending in `exit=<status>`; the first run in run1-4a36786/.

| no. | command as typed | exit | log | summary |
|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log | Test Files 94 passed; Tests 2489 passed |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log | 6649 checks, byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log | 27 pages |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log | 534 passed, 2 skipped (7.2m) |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log | 26 routes, 0 over budget |
| 7 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 07-e2e-basepath.log | 2 passed |
| 8 | `RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ npm --prefix /home/user/mutation_game run build` | 0 | 08-release-build-pages.log | 26 pages; Pages archive taken at once |
| 9 | `npm --prefix /home/user/mutation_game run report` | 0 | 09-report.log | 6 open items on 6 pages |
| 10 | `RELEASE=1 BASE_PATH=/ npm --prefix /home/user/mutation_game run build` | 0 | 10-release-build-root.log | 26 pages; root archive taken at once |
| 11 | `npm --prefix /home/user/mutation_game run size` (root release build) | 0 | 11-size-release.log | 26 routes, 0 over budget (section 7) |
| 12 | `npm --prefix /home/user/mutation_game run lab` (root release build, default list) | 1 | 12-lab.log | 7 routes, 6 over threshold (TBT) |
| 13 | `npm --prefix /home/user/mutation_game run bench -w packages/engine` (alone) | 0 | 13-bench.log | median 21.01 ms |
| 14 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 14-typecheck.log | 0 errors |

No flaky test; the two skips are the uninstalled engines of mathml.spec.ts, reported with their reason. The first run on 4a36786 had the same results except the one stale assertion of M0.spec.ts in command 5 (section 1) and lab medians of 229 to 348 ms; it is not cited as proof.

## 6. Golden coverage

Phases 0 to 2: 34 keys as at G2. Phase 3: ten keys (section 4), all present in coverage.json, missing none, each registered by exactly one golden test file. Routes of site/dist (26): about, credits, dev/lesson-check, dev/math-check, glossary, index, modules, modules/m0-start, m1-mutation, m2-form, m3-classification, m4-numbers, m5-weyl, open-problem, sources, tools/affine, board, form, garden, kostant, lab, mirror, numbers, sandbox, symbolic, weyl.

## 7. Sizes

Root release build (command 11; the preview build of command 6 gives the same rows plus /open-items/ at 0.0 kB):

```
route                        label      limit (kB, 1 kB = 1000 bytes)  status  scripts  gzip (kB)  result
/                            one-board  60                             200     8        41.8       ok
/about/                      no-tool    15                             200     0        0.0        ok
/credits/                    no-tool    15                             200     0        0.0        ok
/dev/lesson-check/           tool       90                             200     0        0.0        ok
/dev/math-check/             no-tool    15                             200     0        0.0        ok
/glossary/                   no-tool    15                             200     0        0.0        ok
/modules/                    lesson     120                            200     0        0.0        ok
/modules/m0-start/           lesson     120                            200     18       74.7       ok
/modules/m1-mutation/        lesson     120                            200     18       74.7       ok
/modules/m2-form/            lesson     120                            200     18       74.7       ok
/modules/m3-classification/  lesson     120                            200     11       70.8       ok
/modules/m4-numbers/         lesson     120                            200     18       74.7       ok
/modules/m5-weyl/            lesson     120                            200     18       74.7       ok
/open-problem/               no-tool    15                             200     0        0.0        ok
/sources/                    no-tool    15                             200     0        0.0        ok
/tools/affine/               tool       90                             200     14       76.8       ok
/tools/board/                tool       90                             200     18       74.7       ok
/tools/form/                 tool       90                             200     14       74.2       ok
/tools/garden/               tool       90                             200     14       69.4       ok
/tools/kostant/              tool       90                             200     14       73.8       ok
/tools/lab/                  tool       90                             200     11       70.8       ok
/tools/mirror/               tool       90                             200     15       76.2       ok
/tools/numbers/              tool       90                             200     14       80.1       ok
/tools/sandbox/              tool       90                             200     18       84.2       ok
/tools/symbolic/             tool       90                             200     15       73.6       ok
/tools/weyl/                 tool       90                             200     17       79.9       ok
size: 26 routes measured, 0 over budget
```

## 8. Lab timings

Invocation: `npm --prefix /home/user/mutation_game run lab` (the default route list: the index and M0 to M5), against the root release build (`RELEASE=1 BASE_PATH=/`), with nothing else running. Tool: Lighthouse CI (@lhci/cli 0.15.1, Lighthouse 12.6.1) on Chromium 141.0.7390.37; profile 360 by 800, processor slowed four times through devtools throttling (checked in all 22 reports), network not throttled; three runs per route, median per metric.

```
route                               LCP (<= 2.5 s)  TBT (<= 200 ms)  CLS (<= 0.1)  status
/                                   0.225           59.4             0.0005        ok
/modules/m0-start/                  0.902           261.3            0.0000        OVER (TBT)
/modules/m1-mutation/               1.241           242.3            0.0000        OVER (TBT)
/modules/m2-form/                   1.346           276.2            0.0011        OVER (TBT)
/modules/m3-classification/         1.459           332.1            0.0017        OVER (TBT)
/modules/m4-numbers/                1.456           269.9            0.0387        OVER (TBT)
/modules/m5-weyl/                   1.670           329.1            0.0007        OVER (TBT)
canary (slow fixture, not a route)  3.643           554.1            0.3730        over on LCP, TBT, CLS (as it must be)
lab: 7 routes measured, 6 over threshold, 0 missing or in error
```

Reading (from P3-X1's analysis, DECISIONS.md stage 3.3): before the stage 3.3 render hint the lessons measured 500 to 1500 ms of Total Blocking Time here (parsing and laying out the lesson markup chunk by chunk after the first paint); with the hint anchored at the end of the lesson the parse happens before the first paint, and what remains over the line is the hydration task of the first tool (client:idle, 200 to 330 ms at four times slowdown on this container). This container runs the reference benchmark about 2.3 times slower than the processor the 7.6 lines were sized for (reference/bench_orbit.mjs: 9 ms there, 19.5 to 21 ms here), so on the reference machine these medians would likely fall under 200 ms; the gate measures this machine and reports the item as failed.

## 9. Release build, reports and archives

- Pages archive: `RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/` (the remote `https://github.com/johnjanik/mutation_game`); reports/release-0.5-pages.tar.gz, 1575685 bytes, 162 entries, sha256 e184cc0b10282b454c0671d5772ce6471f3bd94c251829dbfdc9c2036540a11d; index.html at the archive root; asset paths begin with /mutation_game/ (checked: the KaTeX stylesheet and the first script of index.html).
- Root archive: `RELEASE=1 BASE_PATH=/`, SITE_URL unset; reports/release-0.5-root.tar.gz, 1574800 bytes, 162 entries, sha256 8b98aaa34c66ccc115a10a6b3e93d4edffa1001d71b325d215e3b183d8234fea; index.html at the root; asset paths begin with /.
- Both archives stay in reports/ (ignored by git) for the owner, who tags and publishes (README 7); nothing was tagged `v*` and nothing was pushed by the gate beyond the report commit.
- reports/open-items-report.json and .md (from the root build): mode release, 17 items, E2, E3, E4, E6, E10, E16 used on six pages, 0 unknown. reports/numbers-in-prose.md: no prose number outside <G> or <Tex> in M0 to M5. site/dist holds the root release build.

## 10. Fragments merged and decisions recorded during the phase

Merge commits since gate-G2-candidate: P3-A1, P3-A2, P3-A7 (stage 3.1), P3-A3, P3-A4, P3-A5, P3-A6 (stage 3.2), P3-A8, P3-A9, P3-X1 (stage 3.3; P3-X1 is the lesson-weight agent the orchestrator added for the lab timings). Fragments decisions/P3-A1.md to P3-A9.md, P3-X1.md and MERGE.md, all folded into DECISIONS.md under the headings "2026-10-10 MERGE: P3 stage 3.1", "3.2" and "3.3". One new dependency, @lhci/cli 0.15.1 (section 3). Integration fixes by MERGE: 61684f9 (phase-3 names in the pinned export list; the bench script), 40a34a6 and 22b0abd (mutate, fire and the search key tuned for the 7.6 benchmark; no result changes), 6b3bdf2 (M2's Kaleidoscope link), f7699f5 (T1's colour-panel tests), 691e082 (mathml.spec.ts skips an uninstalled engine), a453339 (axe scan timeout), 4a36786 (the render hint anchored at the end of the lesson), a606a1c (M0's beat-5 links). Decisions by the orchestrator recorded there: the render hint and its trade (a later first paint against no blocking after it); the KaTeX output option, the first tool's hydration cost and the question whether the 7.6 lines are meant for this machine, passed to the owner.

## 11. Owner's part

Due before release 0.5; never blocks the next phase (SPEC 9.1).

- [ ] Playtest of 9.4 with five readers (SPEC 9.4).
- [ ] Accessibility script A-13 for release 0.5: play a game on A2, grow the root garden of A3, classify a board in T4 (SPEC 7.5).
- [ ] Appendix E items 2 and 3 (E2 is used on /modules/m4-numbers/, E3 on /modules/m5-weyl/, each with its fallback shown; also still open and shown: E4, E6, E10, E16).
- [ ] Reading of M0 to M5 against P1 to P12 and approval of their text (D17: the six lessons carry the draft mark until approved).
- [ ] The two content reports (reports/open-items-report.md and reports/numbers-in-prose.md) read before the release (SPEC 7.7).
- [ ] Interaction to Next Paint on one phone, target 200 ms (SPEC 7.6).
- [ ] D6 carried out (SPEC 10).
- [ ] Added at this gate: the lab item of section 8 (decide between the render hint as merged, moving it back, or a lighter first tool; and whether the 7.6 lines are measured on this container or on the reference machine); MathML in WebKit and Firefox (`npx playwright install webkit firefox && npm run build && npx playwright test site/tests/e2e/mathml.spec.ts`, and set RENDER = 'spans' in LinearForm.svelte if either fails); the Pages archive carries the base of the GitHub remote, so `deploy.yml` or the archive as built serves /mutation_game/.

## 12. Notes

- The first run on 4a36786 (section 1) found a stale test assertion, not a defect of the site; it is kept as evidence of the fix, not cited as proof.
- Leads for the red team: RT-04 the first tool's hydration task (T1, 200 to 330 ms at four times slowdown) and the flaky long-task test of T05 seen under heavy load during stage 3.3; RT-05 T8's canvas above 192 elements (theme switch leaves the old colours until the next draw) and the T6 drag snapping; RT-08 the E2, E3 and E16 wraps on M4 and M5; RT-10 T7's right board built beside Board.svelte; RT-12 the @lhci/cli tree's npm audit findings (build only).
- The red team of phase 3 was not run in this build (budget).

## 13. Addendum (2026-10-17)

The owner accepted the lab item as bound to the build container (DECISIONS.md, "OWNER: gate G3's lab item accepted as machine-bound"); the automatic part of G3 is treated as passed and phase 4 starts. The measurements above are unchanged.
