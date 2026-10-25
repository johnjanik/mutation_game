# Gate G5: Representations

- Phase: 5. Round: build.
- Date: 2026-10-25 02:28 to 03:05 (UTC).
- Gate commit (the tested commit, tagged gate-G5-candidate): 006f50d9f9b4843d37b4bfd3e75b0c051cc0ff39 MERGE: fold P4-A6's G5 entry; record the integration repair
- Report commit: the commit that carries this file, the child of the gate commit.
- Verdict: GREEN (every roster item and every supporting row passes).
- Release named: none (G5 names no release; the next release is 1.0 at G6). No release build ran, as GATE.md 5.5 step 7 prescribes for G5.
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).
- Previous runs: a first run on de46828 failed two tests of M7.spec.ts that the arrival of M8 made stale (the anatomy test forbade a link to M8, and the next-module link put M7 at 1803 words). P4-A6 repaired both and MERGE merged the repair (DECISIONS.md, "MERGE: an integration repair before gate G5"); this report quotes only the second run, on 006f50d.

## 1. Preconditions

- The phase's last MERGE finished: stages 5.1 (engine, P5-A1), 5.2 (T12 and MatrixView, P5-A2) and 5.3 (M8 and the not-quiver-mutation page, P5-A3) merged, each reviewed by a separate agent and repaired, and recorded (DECISIONS.md, "MERGE: P5 stage 5.1", "MERGE: P5 stage 5.2", "MERGE: P5 stages 5.2 and 5.3 repaired after review", "MERGE: an integration repair before gate G5"). 44 commits since gate-G4-candidate, all by the build agents of phase 5 (merged), MERGE or GATE.
- Nothing else ran on the machine during the chain: no agent, no preview server, no test run (load average 0.61 at the start, 2.42 before the benchmarks).
- Stale Vite SSR caches under /tmp were removed before the chain; earlier open-items and numbers reports were moved to reports/gate-G5/previous/ (00-moves.log).
- `git status --porcelain` was empty after the build (status-after-build.log) and after the chain.

## 2. Reference hashes

Recomputed with sha256sum (13-reference-sha256.log) and compared with CONTRACTS.md 9:

| file | sha256 | CONTRACTS.md 9 |
|---|---|---|
| reference/golden_data.json | c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f | equal |
| reference/lie_games.py | 485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad | equal |
| reference/verify.py | 1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d | equal |

`git diff --stat gate-G4-candidate 006f50d -- reference/` is empty.

## 3. Installed versions

Node v22.22.0; npm ci from the committed lockfile, unchanged in phase 5 (no dependency added). astro 7.3.8, svelte 5.57.2, @astrojs/svelte 9.0.1, @astrojs/mdx 8.0.3, typescript 6.0.3, vitest 5.0.3, fast-check 4.10.2, @playwright/test 1.64.0 with Chromium (WebKit and Firefox cannot be installed in this container).

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| golden tests through phase 5 pass (minuscule_representations) | `npm test` | 0 | `Test Files  159 passed (159)`; `Tests  3333 passed (3333)`. The phase in force is now 5 (the T12 registry entry), so the engine project's teardown gate fails the run when a golden key of phases 0 to 5 has no test; the run passed, with 50 keys registered and none missing through phase 5 (coverage-after-npm-test.json: missingByPhase 0 to 5 empty). minuscule_representations is covered in packages/engine/test/golden/p5-minuscule.test.ts. `npm run verify` regenerates the golden file byte for byte (supporting row) | pass |
| every Chevalley-Serre relation checks in the tool for every listed representation | `npm test`; `npm run e2e` | 0; 0 | packages/engine/test/golden/p5-minuscule.test.ts › `every Chevalley-Serre relation holds` (one case per record of minuscule_representations, 18 records) and site/tests/unit/tools/T12.test.ts › `for every listed representation every RelationCheck holds and the tool reports all relations holding` passed within the 159 files; in the browser, T12.spec.ts › `acceptance: every listed representation shows its golden dimension, is minuscule, and every relation holds` passed | pass |
| acceptance of T12 as automated tests; no-JavaScript run, axe, sizes; reference hashes unchanged | `npm test`; `npm run e2e`; `npm run size`; sha256sum | 0; 0; 0; 0 | site/tests/unit/tools/T12.test.ts passed within the 159 files; site/tests/e2e/T12.spec.ts 42 passed, none failed or skipped; nojs.spec.ts 83 passed, among them `every route renders without JavaScript` on all 35 routes of site/dist (with /modules/m8-lie-algebras/, /not-quiver-mutation/ and /tools/rep/); a11y.spec.ts 36 passed (no serious or critical violation on any route); `size: 35 routes measured, 0 over budget` (section 7); hashes equal (section 2) | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 116.4s`; regenerated file byte for byte reference/golden_data.json | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `36 passed (33.7s)` (one test per route) | pass |
| supporting: the e2e suite at the CI base (P4-RT-12-02) | `GITHUB_REPOSITORY=johnjanik/mutation_game npm run build`; `GITHUB_REPOSITORY=johnjanik/mutation_game npm run e2e` | 0; 0 | base /mutation_game/, as ci.yml builds it; `1069 passed (15.2m)`, `2 skipped` | pass |
| supporting: the benchmark | `npm run bench -w packages/engine` (alone, after the browser runs) | 0 | `orbit benchmark: median 9.83 ms of 7 runs [...] threshold 25 ms, 2000 positions, truncated true`; 5 files passed, among them the E7 56 timing of P5-A1 | pass |
| supporting: `npm run bench`, `npm run build`, `npm run typecheck` | the three commands | 0; 0; 0 | root bench: engine 5 files and site timing 2 files passed (`T4 load path ... median 14.07 ms`); build 35 pages, links.mjs 0 problems; typecheck `0 errors`, 1 hint (T06.spec.ts unused parameter, there since phase 3) | pass |

## 5. Commands run

Logs in reports/gate-G5/ (not committed; reports/* is ignored except the gate reports). The chain is build-plan/reports/orchestrator/scripts/gate-g5-chain.sh.

| no. | command as typed | exit | log | summary |
|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log | Test Files 159 passed; Tests 3333 passed |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log | 6649 checks, byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log | 35 pages; 0 link problems |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log | 1069 passed, 2 skipped (MathML on WebKit and Firefox) (15.1m) |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log | 35 routes, 0 over budget |
| 6b | the gzip one-liner on site/public/presets/T10/ | 0 | 06b-presets-gzip.log | 8 files, largest 8088 B (unchanged) |
| 8 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 08-e2e-basepath.log | 36 passed |
| 9 | `npm --prefix /home/user/mutation_game run report` | 1 | 09-report.log | expected at G5: `report: no release build report found at reports/open-items-report.json; run RELEASE=1 npm run build first`; reports/numbers-in-prose.md written (0 numbers in prose, 5 in fallbacks) |
| 10 | `npm --prefix /home/user/mutation_game run bench -w packages/engine` | 0 | 10-bench.log | median 9.83 ms |
| 11 | `npm --prefix /home/user/mutation_game run bench` | 0 | 11-bench-root.log | engine bench and the site timing files passed |
| 12 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 12-typecheck.log | 0 errors |
| 14a | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run build` | 0 | 14a-build-ci-base.log | built at the base /mutation_game/ |
| 14b | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run e2e` | 0 | 14b-e2e-ci-base.log | 1069 passed, 2 skipped (15.2m) |

## 6. Golden coverage

The engine project's teardown reads the phase in force from the tool registry, which is 5 since the T12 entry landed, and fails the run when a golden key of a phase at or below it has no test calling covers(). `npm test` passed with 50 keys registered and none missing through phase 5. The keys still unregistered belong to phases 6 and 7 (satake, admissible_pairs, admissible_counts, satake_examples, folding[*].quasi_split_real_form; golden_boards, golden_folds, orbit_plus_zero_representations, generalized_satake_example).

## 7. Sizes

`npm run size` (06-size.log), limits per route in kB of 1000 bytes, gzip of the scripts each route fetches:

| route | label | limit | gzip (kB) |
|---|---|---|---|
| / | one-board | 60 | 48.6 |
| /dev/draw-time/ | tool | 90 | 43.1 |
| /modules/m0-start/, m1-mutation, m2-form, m4-numbers, m5-weyl, m6-multiple-edges | lesson | 120 | 74.4 each |
| /modules/m3-classification/ | lesson | 120 | 70.4 |
| /modules/m7-geometry/ | lesson | 120 | 85.3 |
| /modules/m8-lie-algebras/ | lesson | 120 | 89.8 |
| /tools/affine/ | tool | 90 | 76.9 |
| /tools/board/ | tool | 90 | 74.4 |
| /tools/fold/ | tool | 90 | 76.1 |
| /tools/form/ | tool | 90 | 74.5 |
| /tools/garden/ | tool | 90 | 70.7 |
| /tools/geometry/ | tool | 90 | 85.3 |
| /tools/kostant/ | tool | 90 | 73.3 |
| /tools/lab/ | tool | 90 | 70.4 |
| /tools/mirror/ | tool | 90 | 76.2 |
| /tools/numbers/ | tool | 90 | 80.6 |
| /tools/rep/ | tool | 90 | 89.8 |
| /tools/sandbox/ | tool | 90 | 83.6 |
| /tools/symbolic/ | tool | 90 | 73.7 |
| /tools/weyl/ | tool | 90 | 80.3 |
| /about/, /credits/, /dev/math-check/, /glossary/, /modules/, /not-quiver-mutation/, /open-items/, /open-problem/, /sources/ | no-tool | 15 | 0.0 each |
| /dev/lesson-check/ | tool | 90 | 0.0 |

`size: 35 routes measured, 0 over budget`. /tools/rep/ stands at 89.8 kB against its 90 kB budget. Every tool route and lesson is about 1.8 to 1.9 kB heavier than at G4 (for example /tools/board/ 72.6 to 74.4 kB): the shared code grew in phase 5 (section 12).

## 8. Lab timings

Not a G5 item, and not run (GATE.md 5.5 runs `npm run lab` at G3, G4 and G6). The builders' own measurements are recorded in DECISIONS.md ("MERGE: P5 stages 5.2 and 5.3 repaired after review"): after T12's repair, /tools/rep/ medians 174.8 to 202.4 ms and M8 154.2 to 222.1 ms Total Blocking Time at load 0.4 to 1.6 (before the repair: 392.9 and 246.7 ms).

## 9. Release build and reports

No release build at G5 (GATE.md 5.5 step 7). `npm run report` exited 1 with the expected message, and reports/numbers-in-prose.md was written: 0 numbers in prose and 0 inside formulas in the 9 lesson files; 5 numbers in the fallbacks of <Unverified>, as at G4. M8 adds no number to the report; its typed numbers sit in <Tex> or in brace strings, each on the allowlist of M8.spec.ts (section 12).

## 10. Fragments merged and decisions recorded during the phase

decisions/P5-A1.md, P5-A2.md and P5-A3.md, with the entries their repairs added or edited, and P4-A6.md's entry for the G5 repair, folded by MERGE (DECISIONS.md, the "MERGE: P5" entries of 2026-10-24 and 2026-10-25). MERGE pinned the phase 5 export names in packages/engine/test/unit/p1-api.test.ts and wired T12 into the tool route and the offered boards on the builders' requests.

## 11. Owner's part

Due before release 1.0; never blocks the next phase (SPEC 9.1).

- none

Decisions the owner holds, carried from G4 and added in phase 5 (DECISIONS.md): the sizing of SPEC E-9 rule 1 for minusculeMatrices on the B8, C8 and D8 nodes of 1120 and 1792 positions (they build on the main thread as E-9 prescribes; at 4x slowdown minusculeMatrices takes 92 to 160 ms and reading the worker's reply 149 to 269 ms); four SPEC wordings that M8's review found too broad (2.16 on [BGP73] Theorem 1.1, Appendix D correction 3 at an isolated node, 2.7 F11 'on a connected board', the E8 smallest representation without a label) and a verify.py check for the Hasse diagram of Kostant's game; the practice of keeping typed numbers in brace strings so that the numbers-in-prose report lists none (M8.spec.ts holds an allowlist instead); and the G4 list (P4-RT-11-02 the orbit benchmark, P4-RT-12-01 links.yml, P4-RT-13-04, the M7 sandbox board) and the round 1 list.

## 12. Notes

- The first run of the chain, on de46828, failed two tests of M7.spec.ts, both caused by M8's arrival: the anatomy test still forbade a link to M8, and ModuleLinks' next-module link put M7 at 1803 words. Repaired by P4-A6 in agent/P4-A6-g5 (the assertion now requires exactly one next link, to M8; 15 repeated words cut, 1788 now) and merged by MERGE; the whole chain ran again. No test was retried, skipped or given a longer timeout.
- The e2e runs had no failure and no retry: 1069 passed and 2 skipped at the root and at the CI base. T12's two 'no long task at 4x' tests passed here; the fixer measured 79 passes in 80 runs at low load (one 50 ms task on E6, the first mount of Board.svelte), so they remain load-sensitive.
- /tools/rep/ is at 89.8 of 90 kB, and the shared code of every tool route grew by about 1.8 kB in phase 5. The next tool that adds to the shared chunk will push /tools/rep/ over its budget.
- In M8 the typed numbers are kept in brace strings and <Tex> so that the numbers-in-prose report lists none; M8.spec.ts holds an allowlist of them with their reasons. The report the owner reads before a release (SPEC 7.7) therefore does not show them; listed for the owner in section 11.
