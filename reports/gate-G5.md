# Gate G5: Representations

- Phase: 5. Round: the phase 5 red-team round (which carried the retest of the phase 4 round), rerun after its fixes.
- Date: 2026-10-25 16:15 to 17:03 (UTC).
- Gate commit (the tested commit, tagged gate-G5-candidate): 6cd2c06d232e4175e196b389737ed01495ac63c9 MERGE: fold the P5-A2 repair entries; record the repair after the first run of the G5 rerun
- Report commit: the commit that carries this file, the child of the gate commit. Read this report there or on the integration branch; the copy at the gate commit is the previous run's.
- Verdict: GREEN (every roster item and every supporting row passes).
- Release named: none (G5 names no release; the next release is 1.0 at G6). A release build ran as a supporting row before `npm run report`, because the round changed the release report (P5-RT-12-01).
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).
- Previous runs:
  - build round: GREEN on 006f50d (2026-10-25 02:28 to 03:05), after a first run on de46828 failed two stale tests of M7.spec.ts.
  - red-team round, run 1: on 00e6a4c (2026-10-25 10:34 to 11:23), every row passed but the e2e run at the CI base, where T12.spec.ts 'no long task when E6 is picked and node 1 (27 positions) is built, with the processor slowed four times' failed (tasks of 170 and 53 ms). The T12 role repaired the pick and MERGE merged the repair (DECISIONS.md, "MERGE: the T12 repair after the first run of the G5 rerun"); this report quotes only the run on 6cd2c06.
- The tag gate-G5-candidate was moved from 006f50d to 6cd2c06 (local, not pushed).

## 1. Preconditions

- The round's last MERGE finished: all thirteen lenses reported, 24 findings were confirmed and fixed in six clusters, each fix confirmed by a separate agent and merged, and the fragments folded (DECISIONS.md, "MERGE: the phase 5 red-team round, fixes merged"); then the T12 repair after run 1 (reviewed, its race closed by a second repair, merged; "MERGE: the T12 repair after the first run of the G5 rerun"). 99 commits since the previous gate-G5-candidate (006f50d), all by the round's fixers and repairers (merged), MERGE or GATE; 143 since gate-G4-candidate.
- Nothing else ran on the machine during the chain: no agent, no preview server, no test run (load average 0.07 at the start, 1.33 after the e2e run, 1.46 before the CI-base run).
- Stale Vite SSR caches under /tmp were removed before the chain; the earlier numbers report was moved to reports/gate-G5-rerun/previous/ (00-moves.log).
- `git status --porcelain` was empty after the build (status-after-build.log) and after the chain.

## 2. Reference hashes

Recomputed with sha256sum (13-reference-sha256.log) and compared with CONTRACTS.md 9:

| file | sha256 | CONTRACTS.md 9 |
|---|---|---|
| reference/golden_data.json | c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f | equal |
| reference/lie_games.py | 485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad | equal |
| reference/verify.py | 1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d | equal |

`git diff --stat gate-G4-candidate 6cd2c06 -- reference/` is empty.

## 3. Installed versions

Node v22.22.0; npm ci from the committed lockfile, unchanged in phase 5 and in the round (no dependency added). astro 7.3.8, svelte 5.57.2, @astrojs/svelte 9.0.1, @astrojs/mdx 8.0.3, typescript 6.0.3, vitest 5.0.3, fast-check 4.10.2, @playwright/test 1.64.0 with Chromium (WebKit and Firefox cannot be installed in this container).

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| golden tests through phase 5 pass (minuscule_representations) | `npm test` | 0 | `Test Files  166 passed (166)`; `Tests  3390 passed (3390)`. The engine project's teardown gate (phase in force 5, read from the T12 registry entry) passed with none missing through phase 5 (coverage-after-npm-test.json: missingByPhase 0 to 5 empty). `npm run verify` regenerates the golden file byte for byte (supporting row) | pass |
| every Chevalley-Serre relation checks in the tool for every listed representation | `npm test`; `npm run e2e` | 0; 0 | packages/engine/test/golden/p5-minuscule.test.ts (one case per record of minuscule_representations, 18 records) and site/tests/unit/tools/T12.test.ts passed within the 166 files; the round adds packages/engine/test/unit/rep-hh-he-hf-fail.test.ts (hh, he and hf where they fail, P5-RT-11-01). In the browser: `✓ T12.spec.ts:121:1 › acceptance: every listed representation shows its golden dimension, is minuscule, and every relation holds (21.0s)` and `✓ T12.spec.ts:138:1 › acceptance: choosing node 2 of D4 shows a failing relation and the explanation that some number in the orbit is 2` | pass |
| acceptance of T12 as automated tests; no-JavaScript run, axe, sizes; reference hashes unchanged | `npm test`; `npm run e2e`; `npm run size`; sha256sum | 0; 0; 0; 0 | T12.test.ts passed within the 166 files; T12.spec.ts 69 passed, none failed or skipped (among them the two long-task tests at 4x, which recorded `T12 long tasks after picking E6 at 4x: []` and `... E7 at 4x: []`); M8.spec.ts 30 passed; nojs.spec.ts 84 passed (all 35 routes, with the round's check of T12's orbit drawing and matrices, P5-RT-06-01); a11y.spec.ts 36 passed (no serious or critical violation on any route); `size: 35 routes measured, 0 over budget` (section 7); hashes equal (section 2) | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 134.0s`; regenerated file byte for byte reference/golden_data.json | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `36 passed (38.1s)` | pass |
| supporting: release build and `npm run report` (the round changed the release report) | `RELEASE=1 OUT_DIR=dist-release npm run build`; `npm run report` | 0; 0 | `links: 1209 internal links on 34 pages of site/dist-release checked, 0 problems`; 14 `open item ... (fallback shown)` lines; `report: open items report of 2026-10-25T16:41:30.074Z: 8 open items used on 9 pages, 0 unknown items`; `numbers-in-prose: 0 numbers in 0 files, 5 in fallbacks` | pass |
| supporting: the e2e suite at the CI base (P4-RT-12-02) | `GITHUB_REPOSITORY=johnjanik/mutation_game npm run build`; `GITHUB_REPOSITORY=johnjanik/mutation_game npm run e2e` | 0; 0 | base /mutation_game/, as ci.yml builds it; `1124 passed (20.1m)`, `2 skipped`; the two long-task tests recorded `[]` | pass |
| supporting: the benchmark | `npm run bench -w packages/engine` (alone, after the browser runs) | 0 | `orbit benchmark: median 10.45 ms of 7 runs [12.03, 10.45, 8.87, 10.70, 6.68, 9.65, 12.19] ms, threshold 25 ms, 2000 positions, truncated true`; 5 files passed | pass |
| supporting: `npm run bench`, `npm run build`, `npm run typecheck` | the three commands | 0; 0; 0 | root bench: engine 5 files and site timing 2 files passed (`T4 load path ... median 15.31 ms`); build 35 pages, `links: 1292 internal links on 35 pages of site/dist checked, 0 problems`; typecheck `0 errors`, `0 warnings`, 1 hint (T06.spec.ts unused parameter, there since phase 3) | pass |

## 5. Commands run

Logs in reports/gate-G5-rerun/ (not committed; reports/* is ignored except the gate reports); run 1's logs in reports/gate-G5-rerun-1/. The chain is build-plan/reports/orchestrator/scripts/gate-g5-rerun-chain.sh (the G5 chain plus the release build).

| no. | command as typed | exit | log | summary |
|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log | Test Files 166 passed; Tests 3390 passed |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log | 6649 checks, byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log | 35 pages; 0 link problems |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log | 1124 passed, 2 skipped (MathML on WebKit and Firefox) (19.8m); E8 drawing time median 10.1 ms of 5 |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log | 35 routes, 0 over budget |
| 6b | the gzip one-liner on site/public/presets/T10/ | 0 | 06b-presets-gzip.log | 8 files, largest 8088 B (unchanged) |
| 8 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 08-e2e-basepath.log | 36 passed |
| 9a | `env RELEASE=1 OUT_DIR=dist-release npm --prefix /home/user/mutation_game run build` | 0 | 09a-build-release.log | 34 pages; 0 link problems; 14 open-item lines |
| 9 | `npm --prefix /home/user/mutation_game run report` | 0 | 09-report.log | 8 open items on 9 pages; numbers-in-prose 0 in prose, 5 in fallbacks |
| 10 | `npm --prefix /home/user/mutation_game run bench -w packages/engine` | 0 | 10-bench.log | median 10.45 ms |
| 11 | `npm --prefix /home/user/mutation_game run bench` | 0 | 11-bench-root.log | engine bench and the site timing files passed |
| 12 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 12-typecheck.log | 0 errors |
| 14a | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run build` | 0 | 14a-build-ci-base.log | built at the base /mutation_game/ |
| 14b | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run e2e` | 0 | 14b-e2e-ci-base.log | 1124 passed, 2 skipped (20.1m) |

## 6. Golden coverage

The engine project's teardown reads the phase in force from the tool registry (5) and fails the run when a golden key of a phase at or below it has no test calling covers(). `npm test` passed with none missing through phase 5. The keys still unregistered belong to phases 6 and 7 (satake, admissible_pairs, admissible_counts, satake_examples, folding[*].quasi_split_real_form; golden_boards, golden_folds, orbit_plus_zero_representations, generalized_satake_example).

## 7. Sizes

`npm run size` (06-size.log), limits per route in kB of 1000 bytes, gzip of the scripts each route fetches:

| route | label | limit | gzip (kB) |
|---|---|---|---|
| / | one-board | 60 | 48.6 |
| /dev/draw-time/ | tool | 90 | 43.1 |
| /modules/m0-start/, m1-mutation, m2-form, m4-numbers, m5-weyl, m6-multiple-edges | lesson | 120 | 74.6 each |
| /modules/m3-classification/ | lesson | 120 | 70.4 |
| /modules/m7-geometry/ | lesson | 120 | 82.0 |
| /modules/m8-lie-algebras/ | lesson | 120 | 87.9 |
| /tools/affine/ | tool | 90 | 73.6 |
| /tools/board/ | tool | 90 | 74.6 |
| /tools/fold/ | tool | 90 | 72.8 |
| /tools/form/ | tool | 90 | 74.7 |
| /tools/garden/ | tool | 90 | 70.7 |
| /tools/geometry/ | tool | 90 | 82.0 |
| /tools/kostant/ | tool | 90 | 73.5 |
| /tools/lab/ | tool | 90 | 70.4 |
| /tools/mirror/ | tool | 90 | 72.9 |
| /tools/numbers/ | tool | 90 | 77.3 |
| /tools/rep/ | tool | 90 | 87.9 |
| /tools/sandbox/ | tool | 90 | 83.7 |
| /tools/symbolic/ | tool | 90 | 73.9 |
| /tools/weyl/ | tool | 90 | 80.5 |
| /about/, /credits/, /dev/math-check/, /glossary/, /modules/, /not-quiver-mutation/, /open-items/, /open-problem/, /sources/ | no-tool | 15 | 0.0 each |
| /dev/lesson-check/ | tool | 90 | 0.0 |

`size: 35 routes measured, 0 over budget`. /tools/rep/ is at 87.9 kB (89.8 at the build round; 90.016 kB with the first two T12 clusters merged and before the third). Moving inLabelOrder out of t01/model.ts (the cluster of P5-RT-07-01) took about 3.2 kB off every route that loads Predict.svelte without the rest of T1's model (for example /tools/geometry/ 85.3 to 82.0, /tools/mirror/ 76.2 to 72.9); the round's T12 fixes and repairs add the rest. Routes that load all of T1's model are slightly heavier (/tools/board/ 74.4 to 74.6).

## 8. Lab timings

Not a G5 item, and not run (GATE.md 5.5 runs `npm run lab` at G3, G4 and G6). The RT-07 lens of the round measured /tools/rep/ and M8 with Lighthouse at load 3 to 6 (medians 237 to 257 ms and 242 to 245 ms Total Blocking Time; recorded in round-p5/out/RT-07.json, notes).

## 9. Release build and reports

A release build ran as a supporting row (RELEASE=1, OUT_DIR=dist-release, removed after the chain): 34 pages, 0 link problems, and on standard error the 14 open-item lines quoted in the table (E2, E3, E4, E6, E7, E9, E10, E16, each with its fallback shown, among them E10 on /modules/m8-lie-algebras/). `npm run report` then exited 0: `open items report of 2026-10-25T16:41:30.074Z: 8 open items used on 9 pages, 0 unknown items`, and reports/numbers-in-prose.md lists 0 numbers in prose and 5 in the fallbacks of <Unverified>. No archive at G5.

## 10. Fragments merged and decisions recorded during the phase

The build round's fragments (decisions/P5-A1.md, P5-A2.md, P5-A3.md, and P4-A6.md's G5 entry), folded before the first G5 run. The red-team round's: decisions/RT-FIX-P5-lessons.md, RT-FIX-P5-history.md, RT-FIX-P5-toolchain.md, RT-FIX-P5-t12-content.md, RT-FIX-P5-t12-a11y.md, RT-FIX-P5-t12-perf.md (24 sections) and the four entries of decisions/P5-A2.md marked G5 rerun repair, folded by MERGE, with MERGE's two entries of 2026-10-25 ("the phase 5 red-team round, fixes merged" and "the T12 repair after the first run of the G5 rerun"). `fragments-folded.mjs`: 1010 fragment headings, 0 not in DECISIONS.md. GATE folded nothing.

## 11. Owner's part

Due before release 1.0; never blocks the next phase (SPEC 9.1).

- none

Decisions the owner holds, carried from G4 and from the build round, and added by the round (DECISIONS.md, "MERGE: the phase 5 red-team round, fixes merged" and "MERGE: the T12 repair after the first run of the G5 rerun"): which sense of 'Dimension' T12 shows (now the representation's dimension on every node, the orbit's size under 'Positions in the orbit'); two cases of P5-RT-05-03 left silent for the size limit (the worker's list after a board or node pick, a worker failure); a move followed by Back within the 500 ms burst loses the move on every tool; the residual long task of a T12 pick (the cold mount of the shared Board, 21 to 60 ms at 4x; the two tests fail about 4 to 6 times in 100 runs on this container), with options (a) lighten the Board's mount, (b) keep one Board across picks, (c) accept it as Svelte work; the lenses' notes listed in the round's entry; the E-9 sizing for the 1120 and 1792 position orbits; the SPEC wordings from M8's review; the brace-string practice of M8's typed numbers; and the G4 and round 1 lists.

## 12. Notes

- Run 1 of this rerun, on 00e6a4c, failed one test in the e2e run at the CI base: T12.spec.ts 'no long task when E6 is picked ... slowed four times' saw tasks of 170 and 53 ms (the root run of the same chain passed it). A diagnostic repeat of the two long-task tests at the CI base (--repeat-each 10, load about 1) failed 2 of 20 (57 and 55 ms); it is not cited as proof of anything. The T12 role split the heavy steps of a pick, a review found a race the split opened, a second repair closed it, and the whole chain ran again on 6cd2c06. No test was retried, skipped or given a longer timeout, and the two long-task tests, their threshold and their throttling are unchanged.
- The long-task tests passed in both e2e runs here, but they remain load-sensitive on this container: in 80-run batches at load 1 to 2 they fail about 4 to 6 times in 100, on the repair and on the commit before it alike; the remaining long task is the shared Board's cold mount (section 11).
- The adopted test 'a link to E7 node 6 ... hydrates without a long task' (P5-RT-07-01) passed in both runs; its confirmer saw it marginal for C8 node 7 at load 1 (1 of 3 runs, median 52 against 50).
- e2e: 1124 passed and 2 skipped at the root and at the CI base; no failure, no flaky test. The two skipped tests are mathml.spec.ts's WebKit and Firefox cases, skipped because those browsers are not installed (known since phase 0).
