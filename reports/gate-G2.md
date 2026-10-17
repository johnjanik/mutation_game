# Gate G2: Form and classification

- Phase: 2. Round: build.
- Date: 2026-10-10 20:27 (UTC).
- Gate commit (the tested commit, tagged gate-G2-candidate): 77ca18a3925de4a7242c73a36d43859368536b9a MERGE: integration fix after P2-A9: the M2 one-view test ignores the next-module link
- Report commit: the commit that carries this file, above the gate commit; its SHA is in the JSON report.
- Verdict: GREEN
- Release named: none
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).

## 1. Preconditions

- `git rev-parse --show-toplevel`: /home/user/mutation_game. Branch claude/session-6a181f60-hzzoud. `git status --porcelain`: empty before and after the run. Node v22.22.0, npm 10.9.4, python3 3.13.16, Playwright 1.64.0.
- Expected commit from the stage 2.3 merge: 2490f29. The first gate run on 2490f29 (kept under reports/gate-G2/run1-2490f29/) passed every command except `npm run e2e`, where one assertion of site/tests/e2e/M2.spec.ts ("one view only", written in stage 2.3 before M3 was released) read M3's title "Finite, affine, wild" in M2's next-module link and treated it as prose. MERGE fixed that test to leave the closing navigation out of the prose it reads (77ca18a, an integration fix recorded in DECISIONS.md, stage 2.3), and the whole chain was rerun on 77ca18a, the tested commit. No source file changed between the two runs.
- reports/gate-G2/ recreated; earlier run-time reports moved to reports/gate-G2/previous/. Browser runs used `PLAYWRIGHT_BROWSERS_PATH` pointing at a scratch directory of symlinks to the container's Chromium build 1194 (Playwright 1.64.0 expects 1248; CI installs it).

## 2. Reference hashes

```
c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f  reference/golden_data.json
485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad  reference/lie_games.py
1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d  reference/verify.py
```

Equal to CONTRACTS.md 9.

## 3. Installed versions

Every pinned package (the ten of SPEC 7.1, @astrojs/check 0.9.10, svelte-check 4.7.6, katex 0.16.47, @astrojs/markdown-remark 7.3.2, remark-math 6.0.0, rehype-katex 7.0.1, @types/node 22.20.5) is installed at its pinned version; the table of reports/gate-G0.md section 3 holds unchanged (checked by script against node_modules after `npm ci`: 0 mismatches). No dependency was added in phase 2.

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| golden tests through phase 2 pass (table of SPEC 5.7) | `npm test` | 0 | `Test Files  74 passed (74)`; `Tests  1878 passed (1878)`; coverage.json after the run: phase 0 missing `[]`, phase 1 missing `[]`, phase 2 missing `[]` (34 keys registered: the 22 of G1 and the 12 of phase 2, types[*].symmetrizer, simply_laced, n_short_positive, n_long_positive, long_to_short_ratio, det_cartan, affine, twisted_affine, affine_names, classification_tests, pentagon_example, kostant[*].affine_board_from_node, recomputed against the table of SPEC 5.7); each key registered by `covers()` in exactly one file (p2-affine-names, p2-affine, p2-classification, p2-kostant-affine, p2-pentagon, p2-twisted-affine, p2-types-form) | pass |
| property tests 5, 10, 13 and the second half of 7 pass | `npm test` | 0 | files p5-form, p10-affine, p13-relabel, p7-roots-signs (with isRootPopulation) present under packages/engine/test/properties with their fixed seeds and among the 74 files that passed (the test runner prints no per-file line in this log; 1878 of 1878 tests passed); p1 to p8, p10, p13 all present | pass |
| acceptance of T3, T4, T15, T16 and the phase-2 parts of T2 and T9 as automated tests | `npm test`; `npm run e2e` | 0; 0 | site/tests/unit/tools/T03, T04, T15, T16, T09-phase2 test files passed under site-unit; site/tests/e2e: T03.spec.ts 11, T04.spec.ts 17, T15.spec.ts 21, T16.spec.ts 22, phase2-additions.spec.ts 17 (T1 panels, T2 verdict, T9 affine and play-on, open-problem page), T02.spec.ts 20, T09.spec.ts 16 passed; `387 passed (5.5m)`, no failed, flaky or skipped test | pass |
| the run without JavaScript passes on M0 to M3, the tool routes and the pages | `npm run e2e` | 0 | nojs.spec.ts: 22 passed, one per route of site/dist (20 routes: about, credits, dev/lesson-check, dev/math-check, glossary, index, modules, modules/m0-start, m1-mutation, m2-form, m3-classification, open-items, open-problem, sources, tools/affine, board, form, garden, kostant, lab, sandbox) plus the worker-on-demand companions; routes of site/dist not visited: none | pass |
| axe scan: no serious or critical violations on every page and tool route | `npm run e2e` | 0 | a11y.spec.ts: 22 passed, every route of site/dist discovered and scanned after hydration; routes not scanned: none; also the axe tests of M0 to M3, T01 to T04, T09, T15, T16 passed | pass |
| the size limits of SPEC 7.6 hold on every route | `npm run size` | 0 | `size: 21 routes measured, 0 over budget` (the 20 routes plus /404); table in section 7; every route of site/dist has a row | pass |
| reference file hashes unchanged | sha256sum (section 2) | 0 | the three lines of section 2 | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 144.4s`; `verify: regenerated file is byte for byte reference/golden_data.json (455014 bytes)` | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `2 passed (25.5s)` | pass |
| supporting: `npm run build`, `RELEASE=1 npm run build`, `npm run report` | the three commands | 0; 0; 0 | preview build 21 pages; release build 20 pages (no open-items route); `open item E4 used on /modules/m1-mutation/`, `E6 and E4 and E10 used on /modules/m3-classification/`, `E6 used on /tools/affine/`, `E4 used on /open-problem/` (fallback shown); `report: open items report of 2026-10-10T20:26:39.040Z: 3 open items used on 4 pages, 0 unknown items`; provenance: mode release, generated after the release build start 20:26:27Z, every page listed is a route of site/dist | pass |
| supporting: `npm run typecheck` | `npm run typecheck` | 0 | engine tsc clean; `astro check` 0 errors; `svelte-check` 0 errors (168 files) | pass |

Every roster row passes: GREEN.

## 5. Commands run

Logs in /home/user/mutation_game/reports/gate-G2/ (uncommitted), each ending in `exit=<status>`; the first run in run1-2490f29/.

| no. | command as typed | exit | log | summary |
|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log | Test Files 74 passed; Tests 1878 passed (59 s) |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log | 6649 checks, byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log | 21 pages |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log | 387 passed (5.5m) |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log | 21 routes, 0 over budget |
| 7 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 07-e2e-basepath.log | 2 passed |
| 8 | `RELEASE=1 npm --prefix /home/user/mutation_game run build` | 0 | 08-release-build.log | 20 pages; report files written |
| 9 | `npm --prefix /home/user/mutation_game run report` | 0 | 09-report.log | 3 open items on 4 pages |
| 10 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 10-typecheck.log | 0 errors |

No skipped, todo or flaky test in either runner. The first run on 2490f29 (run1-2490f29/) had the same results for commands 1 to 4 and 6 to 10 and one failed test in command 5, as section 1 says; it is not cited as proof.

## 6. Golden coverage

Phase 0: 2 keys. Phase 1: 20 keys. Phase 2: 12 keys (types[*].symmetrizer, types[*].simply_laced, types[*].n_short_positive, types[*].n_long_positive, types[*].long_to_short_ratio, types[*].det_cartan, affine, twisted_affine, affine_names, classification_tests, pentagon_example, kostant[*].affine_board_from_node). All 34 present in coverage.json; missing none; each registered by exactly one golden test file. Phase 3 keys are all still missing, as expected before stage 3.1.

## 7. Sizes

```
route                        label      limit (kB, 1 kB = 1000 bytes)  status  scripts  gzip (kB)  result
/                            one-board  60                             200     8        39.8       ok
/about/                      no-tool    15                             200     0        0.0        ok
/credits/                    no-tool    15                             200     0        0.0        ok
/dev/lesson-check/           tool       90                             200     0        0.0        ok
/dev/math-check/             no-tool    15                             200     0        0.0        ok
/glossary/                   no-tool    15                             200     0        0.0        ok
/modules/                    lesson     120                            200     0        0.0        ok
/modules/m0-start/           lesson     120                            200     17       69.6       ok
/modules/m1-mutation/        lesson     120                            200     17       69.6       ok
/modules/m2-form/            lesson     120                            200     17       69.6       ok
/modules/m3-classification/  lesson     120                            200     11       66.2       ok
/open-items/                 no-tool    15                             200     0        0.0        ok
/open-problem/               no-tool    15                             200     0        0.0        ok
/sources/                    no-tool    15                             200     0        0.0        ok
/tools/affine/               tool       90                             200     14       72.2       ok
/tools/board/                tool       90                             200     17       69.6       ok
/tools/form/                 tool       90                             200     14       69.6       ok
/tools/garden/               tool       90                             200     13       64.6       ok
/tools/kostant/              tool       90                             200     14       69.2       ok
/tools/lab/                  tool       90                             200     11       66.2       ok
/tools/sandbox/              tool       90                             200     17       79.4       ok
size: 21 routes measured, 0 over budget
```

The closest route to its limit is /tools/sandbox/ (79.4 of 90 kB); phase 3 adds nothing to that route by plan, but the lessons M0 to M2 at 69.6 kB of 120 carry the shared tool bundle and grow with every tool placed in a lesson.

## 8. Lab timings

Not required at this gate.

## 9. Release build, reports and archives

Release build (RELEASE=1, SITE_URL and BASE_PATH unset): 20 pages; reports/open-items-report.json mode release, 17 items, E4 used on /modules/m1-mutation/, /modules/m3-classification/ and /open-problem/, E6 on /modules/m3-classification/ and /tools/affine/, E10 on /modules/m3-classification/, 0 unknown; reports/open-items-report.md beside it; reports/numbers-in-prose.md written (0 numbers in prose in 0 of 4 lesson files). No archive at this gate. site/dist holds the release build.

## 10. Fragments merged and decisions recorded during the phase

Merge commits since gate-G1-candidate: P2-A1, P2-A6 (stage 2.1), P2-A2, P2-A3, P2-A4, P2-A7, P2-A5 (stage 2.2), P2-A8, P2-A9 (stage 2.3). Fragments decisions/P2-A1.md to P2-A9.md and MERGE.md, all folded into DECISIONS.md under the headings "2026-10-10 MERGE: P2 stage 2.1", "2.2" and "2.3". No new dependency. Integration fixes by MERGE: 19db83e, 4ed7cb7, 7cb09c6, e115da4, b007449, 77ca18a. Design questions passed to the owner are listed under "Passed to the orchestrator" in each stage entry (among them P2-A2's capped root test timing against 7.6, P2-A4's reading of D19 for the affine pair, P2-A7's issue-tracker URL).

## 11. Owner's part

Due before release 0.5 (after G3); never blocks the next phase (SPEC 9.1).

- [ ] Appendix E item 6: the fate sentence of the non-simply-laced affine boards in T15 (wrapped as E6 on /modules/m3-classification/ and /tools/affine/) needs the owner's verification or a source.
- [ ] Still open from G1: a first reading of M0 and M1 by two readers of the primary audience; the draft mark stays on M0 to M3 until the owner approves them (D17, due at G3).

## 12. Notes

- The first run on 2490f29 (section 1) found a stale test assertion, not a defect of the site; it is kept as evidence of the fix, not cited as proof.
- Leads for the red team: RT-04 the T4 counter's main-thread search on the star (stops at 2000) and P2-A2's capped root test at four times slowdown (93 to 114 ms); RT-05 the T15 polygon keyboard wrap and the T16 editor at 320 pixels; RT-08 the three E-item wraps on M3 and whether the "not of finite type" wording appears only where classify says so; RT-10 the T15Route wrapper that decides the E6 wording at build time.
- The red team of phase 2 was not run in this build (budget).
