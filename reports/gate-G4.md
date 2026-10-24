# Gate G4: Multiple edges and geometry

- Phase: 4. Round: red-team round of phase 4 (which carried the retest of round 1), rerun after its fixes.
- Date: 2026-10-24 17:44 to 18:19 (UTC).
- Gate commit (the tested commit, tagged gate-G4-candidate): 9d047863b2b948118a97429d3e15ba7e0c008c83 MERGE: two test fixes the gate G4 rerun found
- Report commit: the commit that carries this file, the child of the gate commit.
- Verdict: GREEN (every roster item and every supporting row passes).
- Release named: none (G4 names no release; the next release is 1.0 at G6). A release build ran as a supporting row, into a separate directory, so that `npm run report` reads a report from this commit.
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).
- Previous runs (carried forward from the overwritten report):
  - build round, RED (the lab timings on M6 and M7, Total Blocking Time 252.3 and 381.3 ms), gate commit b9b8504c1b893dc73a25b46fe62382d59eb9cdf1.
  - first run of this rerun, on 8561d8d, not reported as a verdict: 2 site unit tests failed (a clock reading in the parallel engine suite) and 1 browser test failed at the CI base (a test that reopened its copied link without the base); M7 measured 231.0 ms. Both test causes were fixed by MERGE in 9d04786 and the whole chain ran again (section 12).
- The tag gate-G4-candidate was moved from b9b8504 to 9d04786 (local tag; not pushed).

## 1. Preconditions

- The round's last MERGE finished: the six fix branches of the phase 4 red-team round are merged and recorded (DECISIONS.md, "MERGE: the phase 4 red-team round, fixes merged"), and MERGE's two test fixes are in the gate commit. Commits since the previous gate commit b9b8504: the round's records (build-plan/reports/orchestrator/round-p4/), the MERGE restoring a lost DECISIONS heading (P4-RT-10-03), the six fix merges with their folded fragments, and the two test fixes; all by MERGE.
- Nothing else ran on the machine during the chain: no agent, no preview server, no test run (load average 0.70 at the start, 2.57 when the lab started, 1.40 before the benchmarks, 1.82 before the run at the CI base).
- Stale Vite SSR caches under /tmp were removed before the chain; earlier open-items and numbers reports were moved to reports/gate-G4-rerun/previous/ (00-moves.log).
- `git status --porcelain` was empty after the build (status-after-build.log) and after the chain.

## 2. Reference hashes

Recomputed with sha256sum (13-reference-sha256.log) and compared with CONTRACTS.md 9:

| file | sha256 | CONTRACTS.md 9 |
|---|---|---|
| reference/golden_data.json | c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f | equal |
| reference/lie_games.py | 485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad | equal |
| reference/verify.py | 1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d | equal |

`git diff --stat b9b8504 9d04786 -- reference/` is empty.

## 3. Installed versions

Node v22.22.0; npm ci from the committed lockfile, which is unchanged since the build round. astro 7.3.8, svelte 5.57.2, @astrojs/svelte 9.0.1, @astrojs/mdx 8.0.3, typescript 6.0.3, vitest 5.0.3, fast-check 4.10.2, @playwright/test 1.64.0 with Chromium (WebKit and Firefox cannot be installed in this container), @lhci/cli 0.15.1 with Lighthouse 12.6.1 on Chromium 141.0.7390.37.

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| golden tests through phase 4 pass | `npm test` | 0 | `Test Files  155 passed (155)`; `Tests  3105 passed (3105)`. The engine project's teardown gate fails the run when a golden key of a phase up to 4 has no test; the run passed, with 49 keys registered and no key missing through phase 4 (coverage-after-npm-test.json). `npm run verify` regenerates the golden file byte for byte (supporting row) | pass |
| property test 11 passing | `npm test` | 0 | packages/engine/test/properties/p11-folding.test.ts present, unchanged since the build round, and within the 155 files that passed | pass |
| acceptance of T10 and T11 as automated tests | `npm test`; `npm run e2e` | 0; 0 | site/tests/unit/tools/T10.test.ts and T11.test.ts passed within the 155 files; site/tests/e2e/T10.spec.ts 45 passed and T11.spec.ts 26 passed in the e2e run (the round's regressions included), none failed or skipped | pass |
| the drawing-time test of SPEC 7.6 for the E8 picture (under 100 ms on the CI runner) | `npm run e2e` | 0 | `✓ draw-time.spec.ts:26:1 › the E8 root set with 6720 edges draws in the Coxeter plane in under 100 ms`; `E8 drawing time: median 13.8 ms of 5 (29.6, 13.8, 11.1, 14.9, 10.9 ms), first 29.6 ms, dpr 1` | pass |
| lab timings on M6 and M7 | `npm run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/` | 0 | `/modules/m6-multiple-edges/  1.369  134.2  0.0000  ok`; `/modules/m7-geometry/  1.831  172.5  0.0000  ok`; `lab: 2 routes measured, 0 over threshold, 0 missing or in error`; canary over on all three as it must be; throttling checks ok (section 8) | pass |
| no-JavaScript run (including the SVG snapshot of T10), axe, sizes; T10 preset data files at most 30 kB compressed each; reference hashes unchanged | `npm run e2e`; `npm run size`; the gzip one-liner; sha256sum | 0; 0; 0; 0 | nojs.spec.ts 77 passed, among them `every route renders without JavaScript` on all 32 routes and, new this round, `nojs.spec.ts rejects a T10 snapshot with no point and no segment` (the default figure of a T10 root is its snapshot, which must hold a point or a segment) and `T10 shows no time sentence without a time before hydration`; a11y.spec.ts 33 passed (no serious or critical violation on any route); `size: 32 routes measured, 0 over budget` (section 7); the largest T10 preset file is 8088 B gzip (E8), all below 30000 (section 7); hashes equal (section 2) | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 120.5s`; regenerated file byte for byte reference/golden_data.json | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `33 passed (33.6s)` | pass |
| supporting: the e2e suite at the CI base (new this round, P4-RT-12-02) | `GITHUB_REPOSITORY=johnjanik/mutation_game npm run build`; `GITHUB_REPOSITORY=johnjanik/mutation_game npm run e2e` | 0; 0 | base /mutation_game/, as ci.yml builds it; `983 passed (12.6m)`, `2 skipped` | pass |
| supporting: a release build and its reports | `RELEASE=1 OUT_DIR=dist-release npm run build`; `npm run report` | 0; 0 | 13 lines `open item <E> used on <page> (fallback shown)`, among them `open item E7 used on /modules/m7-geometry/ (fallback shown)` (P4-RT-08-10); `report: open items report of 2026-10-24T18:05:33.257Z: 8 open items used on 8 pages, 0 unknown items` (section 9) | pass |
| supporting: the benchmark | `npm run bench -w packages/engine` (alone, after the browser runs) | 0 | `orbit benchmark: median 8.76 ms of 7 runs [...] threshold 25 ms, 2000 positions, truncated true`; 4 files passed, among them the timed half of the P4-RT-03-02 regression | pass |
| supporting: `npm run bench`, `npm run build`, `npm run typecheck` | the three commands | 0; 0; 0 | root bench: engine 4 files and site timing 2 files passed (`T4 load path ... median 20.07 ms`); build 32 pages, links.mjs 0 problems; typecheck `0 errors`, 1 hint (T06.spec.ts unused parameter, there since phase 3) | pass |

## 5. Commands run

Logs in reports/gate-G4-rerun/ (not committed; reports/* is ignored except the gate reports). The chain is build-plan/reports/orchestrator/scripts/gate-g4-rerun-chain.sh.

| no. | command as typed | exit | log | summary |
|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log | Test Files 155 passed; Tests 3105 passed |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log | 6649 checks, byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log | 32 pages; 0 link problems |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log | 983 passed, 2 skipped (MathML on WebKit and Firefox) (12.5m) |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log | 32 routes, 0 over budget |
| 6b | the gzip one-liner of GATE.md section 8 (Sizes) on site/public/presets/T10/ | 0 | 06b-presets-gzip.log | 8 files, largest 8088 B |
| 7 | `npm --prefix /home/user/mutation_game run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/` | 0 | 07-lab.log | 2 routes, 0 over threshold |
| 8 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 08-e2e-basepath.log | 33 passed |
| 9a | `env RELEASE=1 OUT_DIR=dist-release npm --prefix /home/user/mutation_game run build` | 0 | 09a-build-release.log | release build; the open-item lines of section 9 |
| 9 | `npm --prefix /home/user/mutation_game run report` | 0 | 09-report.log | 8 open items on 8 pages, 0 unknown; numbers-in-prose written |
| 10 | `npm --prefix /home/user/mutation_game run bench -w packages/engine` | 0 | 10-bench.log | median 8.76 ms |
| 11 | `npm --prefix /home/user/mutation_game run bench` | 0 | 11-bench-root.log | engine bench and the site timing files passed |
| 12 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 12-typecheck.log | 0 errors |
| 14a | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run build` | 0 | 14a-build-ci-base.log | built at the base /mutation_game/ |
| 14b | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run e2e` | 0 | 14b-e2e-ci-base.log | 983 passed, 2 skipped (12.6m) |

## 6. Golden coverage

The engine project's teardown (packages/engine/test/golden/_coverage.setup.ts) reads the phase in force from the tool registry (4) and fails the run when a golden key of a phase at or below it has no test calling covers(). `npm test` passed, so no key through phase 4 is missing; 49 keys were registered. The keys still unregistered belong to phases 5 to 7 (minuscule_representations; satake, admissible_pairs, admissible_counts, satake_examples, folding[*].quasi_split_real_form; golden_boards, golden_folds, orbit_plus_zero_representations, generalized_satake_example).

## 7. Sizes

`npm run size` (06-size.log), limits per route in kB of 1000 bytes, gzip of the scripts each route fetches:

| route | label | limit | gzip (kB) |
|---|---|---|---|
| / | one-board | 60 | 46.8 |
| /dev/draw-time/ | tool | 90 | 41.3 |
| /modules/m0-start/, m1-mutation, m2-form, m4-numbers, m5-weyl, m6-multiple-edges | lesson | 120 | 72.6 each |
| /modules/m3-classification/ | lesson | 120 | 68.6 |
| /modules/m7-geometry/ | lesson | 120 | 83.4 |
| /tools/affine/ | tool | 90 | 75.0 |
| /tools/board/ | tool | 90 | 72.6 |
| /tools/fold/ | tool | 90 | 74.2 |
| /tools/form/ | tool | 90 | 72.7 |
| /tools/garden/ | tool | 90 | 68.9 |
| /tools/geometry/ | tool | 90 | 83.4 |
| /tools/kostant/ | tool | 90 | 71.5 |
| /tools/lab/ | tool | 90 | 68.6 |
| /tools/mirror/ | tool | 90 | 74.3 |
| /tools/numbers/ | tool | 90 | 78.8 |
| /tools/sandbox/ | tool | 90 | 81.7 |
| /tools/symbolic/ | tool | 90 | 71.5 |
| /tools/weyl/ | tool | 90 | 78.5 |
| /about/, /credits/, /dev/math-check/, /glossary/, /modules/, /open-items/, /open-problem/, /sources/ | no-tool | 15 | 0.0 each |
| /dev/lesson-check/ | tool | 90 | 0.0 |

`size: 32 routes measured, 0 over budget`. Against the build round: routes that do not show T10 are 0.2 to 0.7 kB lighter (P4-RT-07-05: offered.ts no longer pulls T10's and T11's preset captions into the shared chunk); /tools/geometry/ and M7 are 1.0 kB heavier (82.4 to 83.4 kB: P4-RT-07-02, T10's server markup holds the prediction form so that hydration does not shift the page).

T10 preset files, gzip level 9 (06b-presets-gzip.log), bytes: A2-r1.1.json 270; A3-r1.0.0.json 246; A3-r1.0.1.json 337; B3-r0.1.1.json 451; B3-r1.0.1.json 460; D4-r0.1.0.0.json 520; E8-r0.0.0.0.0.0.0.1.json 8088; index.json 349. All at most 30000.

## 8. Lab timings

`npm run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/` on the preview build of step 4 (07-lab.log): Lighthouse CI 0.15.1 (Lighthouse 12.6.1) on Chromium 141.0.7390.37; profile 360x800, CPU slowdown 4x through the DevTools protocol, network not throttled; 3 runs per route, median per metric; the processor check confirmed devtools throttling at 4x and the 360x800 screen in all 7 reports.

| route | LCP (at most 2.5 s) | TBT (at most 200 ms) | CLS (at most 0.1) | status |
|---|---|---|---|---|
| /modules/m6-multiple-edges/ | 1.369 | 134.2 | 0.0000 | ok |
| /modules/m7-geometry/ | 1.831 | 172.5 | 0.0000 | ok |
| canary (slow fixture) | 3.588 | 554.3 | 0.3730 | over on all three, as it must be |

The item passes. The build round measured 252.3 and 381.3 ms. The change comes from the round's fixes: the KaTeX fonts a page uses are preloaded from its head (P4-RT-07-03; RT-07 had measured that the late fonts' relayout added about 40 percent of M7's Total Blocking Time), and T10 no longer empties and refills its output lines on hydration (P4-RT-07-01). For the record, the first run of this rerun (on 8561d8d, the same site code) measured M7 at 231.0 ms with the machine at load 2.69 when the lab started, against 2.57 here; the confirmer of the shared fix measured 171.5 to 191.8 ms at load below 1.3. M7 stays close to the limit on this container; this is a measurement of the gate commit, quoted as it came.

## 9. Release build and reports

A release build ran into site/dist-release (removed after the chain), so that `npm run report` reads a report this commit wrote; G4 names no release, and nothing was published. The build printed one line per open item and page, all with the fallback shown: E2 on M4; E3 on M5; E4 on M1, M3 and /open-problem/; E6 on M3, M4 and /tools/affine/; E7 and E9 on M7; E10 on M3; E16 on M5 and M6. The E7 line now says "fallback shown" (P4-RT-08-10; the build round's report repeated a line that said "nothing shown"). `npm run report` accepted the report (8 open items on 8 pages, 0 unknown items; since P4-RT-12-04 it refuses the report of a release build that failed in its link check). reports/numbers-in-prose.md: 0 numbers in prose and 0 inside formulas; 5 numbers in the fallbacks of <Unverified> (the M3 E4 fallback carried to a polish pass, and M4's year 1990), as at the build round.

## 10. Fragments merged and decisions recorded during the round

The phase 4 red-team round (with the retest of round 1): 59 findings, 45 confirmed (3 blocker, 30 major, 12 minor), 3 duplicates, 11 dropped (10 refuted with a citation, 1 not reproduced). Six fix branches, each confirmed by a separate agent, merged with the fragments decisions/RT-FIX-P4-lesson-m6.md, -lesson-m7.md, -a11y.md, -tool-t10.md, -toolchain.md, -engine.md and -shared.md folded (DECISIONS.md, "MERGE: the phase 4 red-team round, fixes merged"); MERGE's two test fixes in 9d04786. Every round 1 fix was retested by its lens and holds. The round's records are in build-plan/reports/orchestrator/round-p4/.

## 11. Owner's part

Due before release 1.0; never blocks the next phase (SPEC 9.1).

- [ ] The E8 picture tried on one mid-range phone (SPEC 7.6: the E8 root set, its Coxeter projection and 6720 edges draw in under 100 ms on the phone; /dev/draw-time/ shows the timing; 9.1).
- [ ] Appendix E item 7 (SPEC Appendix E; used on /modules/m7-geometry/, open, fallback shown in a release build).
- [ ] Appendix E item 9 (SPEC Appendix E; used on /modules/m7-geometry/, open, fallback shown in a release build).

Decisions the owner holds. From round 1: P3-RT-01-01 (symbolicPlay's return type off the finite types), P3-RT-05-06 (polygon radius 133 against 130 at 320), P3-RT-13-01 (predictions whose answer shows before the reader commits, now also M6 b1, b4, b7 and M7 b4, b7), P3-RT-11-09 (commit order), P3-RT-07-03 (the engine chunk on the index page), the module-link order of SPEC 8.2 item 7, SOURCES.md keys [RV16], [RV21], [CPS22]. From this round: P4-RT-11-02 (what SPEC 7.6's orbit benchmark measures: a case for the bigint loop catches a slowed loop but measured 21.6 to 40.5 ms here, so it is not committed and no threshold changed); P4-RT-12-01 (links.yml fails every weekly run and opens no issue; dropped as not reproduced because of a path bug in the finding's command, but real: GitHub run 39258486524; the workflow waits for the owner's word); P4-RT-13-04 (refuted: captions of a tool page reached by a link describe the default state; a possible new requirement); the M7 sandbox board (round 1's reading "the board of the first figure" applied: A2).

## 12. Notes

- The first run of this rerun, on 8561d8d, failed two rows, both from tests added by the round's fixes. (1) `npm test`: site/tests/unit/scripts.test.ts failed 2 tests because the regression test of P4-RT-03-02 compared two clock readings in the parallel engine suite; MERGE moved that timed half to packages/engine/test/bench/ (run alone by `npm run bench -w packages/engine`), keeping the counting tests in the unit suite. (2) The e2e suite at the CI base: T10.spec.ts, the P4-RT-04-01 regression, reopened its copied link by its path with only the leading slash dropped, which at /mutation_game/ named a page that does not exist (a sibling of P4-RT-12-02); MERGE made it open the copied link as it stands. Both were checked by hand, then the whole chain ran again on 9d04786; this report quotes only that run. No test was retried, skipped or given a longer timeout.
- The e2e runs had no failure and no retry: 983 passed and 2 skipped at the root and at the CI base.
- Known load-sensitive tests, which passed here: T15 'announcements of a capped play, recorded' (a race in the test, received 'Board square.' under load), T10 'no long task', board-load 'one long task'.
- T02.spec.ts and registry-outs.spec.ts read site/dist directly and ignore OUT_DIR; they pass at the root and at the CI base, where the build is site/dist, and are not run at /sub/path/.
