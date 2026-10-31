# Gate G6: Real forms, atlas, release 1.0 (rerun after the phase 6 red-team round)

- Phase: 6. Round: the phase 6 red-team round, rerun after its fixes.
- Date: 2026-10-31, 09:28 to 12:15 UTC, alone on the machine (no agent, no other preview server; load average 0.8 to 1.4 at the starts of the parts), in three parts (build-plan/reports/orchestrator/scripts/gate-g6-rerun-chain.sh A, B, C). Logs: reports/gate-G6-rerun/ (not committed).
- Gate commit (the tested commit, local tag gate-G6-candidate): facff375ac33a40d822560c34842538d706f6fb5 MERGE: prediction-links.spec.ts presses and reads T13's paint controls.
- Report commit: the commit that carries this file, the child of the gate commit. Read this report there or on the integration branch; the copy at the gate commit is run 1's.
- **Verdict: RED** on one roster item, the lab timings on every page: 28 of 89 routes over the Total Blocking Time limit of 200 ms (`lab: 89 routes measured, 28 over threshold`, exit 1); every LCP (at most 2.216 s) and every CLS (at most 0.0033) is within its limit. Every other roster item and every supporting row passes, among them the e2e row that failed run 1 (T12.spec.ts:1242, the C8 link hydration).
- Release named: 1.0, with the built site archived (section 9). The owner tags the release; nothing is pushed but the integration branch.
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).
- Previous runs:
  - run 1, RED, on f07eec6 (2026-10-26 00:23 to 03:40): T12.spec.ts:1242 'a link to C8 node 7 (1024 positions) hydrates without a long task' failed in the preview e2e run (median 53 ms against 50), and the lab had 20 of 89 routes over TBT. The red-team round at f07eec6 confirmed 32 of 48 findings; its fix clusters, with a product repair of T12's link hydration (cluster t12-t5), were confirmed and merged (DECISIONS.md, "MERGE: the phase 6 red-team round, fixes merged"). This report quotes only the run on facff37.

## 1. Preconditions

- The working tree was clean at the start (`git status --porcelain` empty); the content reports left by the last build were moved to reports/gate-G6-rerun/previous/ (00-moves.log). Run 1's archives were moved to reports/gate-G6/run1-archives/ before the chain.
- Every merge of the round is recorded in DECISIONS.md; the fragments check prints `1312 fragment headings, 0 not in DECISIONS.md`.
- Merge checks with no agent running, on 9e9b492 (the round merged; reports/merge-p6-round-9e9b492/): npm test 3995 of 3996 (the scaffold test 'astro dev appears nowhere' at its 5 s limit, passing alone), typecheck, build, size 90 routes 0 over; e2e 1749 passed, 2 failed: prediction-links.spec.ts on M9, a stale test that pressed T13's first node button, adapted by MERGE in the gate commit (11 of 11 then pass), and T08 F4 pick (one 320 ms task under the full run, 20 of 20 alone). Both pass in this run.

## 2. Reference hashes

| file | sha256 | CONTRACTS.md 9 |
|---|---|---|
| reference/golden_data.json | c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f | equal |
| reference/lie_games.py | 485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad | equal |
| reference/verify.py | 1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d | equal |

(16-reference-sha256.log; `git ls-files -s reference` in 16-reference-index.log.)

## 3. Installed versions

- astro 7.3.8
- @astrojs/mdx 8.0.3
- svelte 5.57.2
- @astrojs/svelte 9.0.1
- typescript 6.0.3
- nanostores 1.5.5
- vitest 5.0.3
- fast-check 4.10.2
- @playwright/test 1.64.0
- @axe-core/playwright 4.13.0
- @astrojs/check 0.9.10
- svelte-check 4.7.6
- katex 0.16.47

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| all golden tests of phases 0 to 6 pass | `npm test` | 0 | `Test Files  205 passed (205)`; `Tests  3996 passed (3996)`; the engine's coverage gate (phase in force 6) passed: coverage-after-npm-test.json missingByPhase 0 to 6 empty (phase 7 lists golden_boards, golden_folds, orbit_plus_zero_representations, generalized_satake_example, not in force). `npm run verify` regenerates the golden file byte for byte (supporting row) | pass |
| property tests 1 to 13 pass | `npm test` | 0 | packages/engine/test/properties/p1 to p13 passed within the 205 files | pass |
| acceptance of T13 and T14 as automated tests | `npm test`; `npm run e2e` | 0; 0 | site/tests/unit/tools/T13.test.ts and site/tests/unit/atlas.test.ts (with atlas-build-path.test.ts) passed within the 205 files; in the browser T13.spec.ts 40 passed, T13-keyboard.spec.ts 7 passed, T14.spec.ts 32 passed, none failed or skipped (the round added tests to all three) | pass |
| full accessibility scan of every page and tool route; keyboard scripts for T1, T4, T13 | `npm run e2e` | 0 | a11y.spec.ts 91 passed, 0 failed (every route of site/dist, no serious or critical violation); `✓ T01.spec.ts:284:1 › keyboard-only play on A3 and E8`; T04.spec.ts 21 passed (its keyboard-only tests among them); T13-keyboard.spec.ts 7 passed | pass |
| sizes and lab timings of SPEC 7.6 on every page | `npm run size` (preview and root release builds); `npm run lab -- --all --json reports/gate-G6-rerun/lab.json` | 0; 0; 1 | `size: 90 routes measured, 0 over budget` (preview) and `size: 89 routes measured, 0 over budget` (root release), section 7; the largest are /tools/satake/ and /embed/satake/ at 88.1 of 90 kB. Lab on the root release build: `lab: 89 routes measured, 28 over threshold, 0 missing or in error`; over on TBT only: /atlas/B6/, /atlas/D6/, /atlas/D8/, /dev/draw-time/, /embed/geometry/, /embed/rep/, /embed/sandbox/, /embed/satake/, /embed/symbolic/, /embed/weyl/, /glossary/, /modules/m5-weyl/, /modules/m8-lie-algebras/, /modules/m9-real-forms/, /sources/, /tools/board/, /tools/fold/, /tools/form/, /tools/garden/, /tools/geometry/, /tools/lab/, /tools/mirror/, /tools/numbers/, /tools/rep/, /tools/sandbox/, /tools/satake/, /tools/symbolic/, /tools/weyl/; every LCP at most 2.216 s and every CLS at most 0.0033; the canary over on all three as it must be; section 8 | fail (lab) |
| a release build succeeds; its report of open items is left in reports/ | `RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ npm run build`; `npm run report`; `RELEASE=1 BASE_PATH=/ npm run build` | 0; 0; 0 | both release builds succeeded (89 pages each, `links: 3855 internal links on 89 pages of site/dist checked, 0 problems`); 26 `open item ... (fallback shown)` lines, the same as run 1 (section 9); `report: open items report of 2026-10-31T10:07:01.311Z: 13 open items used on 18 pages, 0 unknown items`; `numbers-in-prose: 2 numbers in 1 files, 5 in fallbacks`; reports/open-items-report.json and .md are the root release build's, the Pages build's copies in reports/gate-G6-rerun/ | pass |
| the two archives of SPEC 7.8 (Pages address; BASE_PATH=/) built and left in reports/ | tar after each release build | 0; 0 | pages archive: 3317641 bytes, 358 entries, sha256 c459abae6f4b30271a47a6142551c23004289f8f6f970241e9506443d3a679d6; RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/; root archive: 3313050 bytes, 358 entries, sha256 20b609c87603ae13398016f5b29521449cb93e3badd89e9bc963b367b3f9de38; RELEASE=1 BASE_PATH=/ | pass |
| LaTeX export produces the three forms of 6.7 (compiling them is the owner's part) | `npm test`; `LATEX_SAMPLES_DIR=reports/gate-G6-rerun/latex/ npm run e2e -- site/tests/e2e/latex-export.spec.ts` | 0; 0 | site/tests/unit/latex.test.ts passed with the three byte-for-byte forms of 6.7; the samples spec `13 passed`; reports/gate-G6-rerun/latex/ holds dynkin.tex (`\dynkin E{oooooo}`), tikz-graph.tex (T2), tikz-points.tex (T10), and, new in the round (P6-RT-10-01), tikz-graph-weyl.tex (T8) and tikz-graph-rep.tex (T12), for the owner's compile | pass |
| reference hashes unchanged | sha256sum | 0 | section 2 | pass |
| supporting: `npm run e2e` (the whole browser suite at the preview build) | `npm run e2e` | 0 | `1751 passed (28.3m)`, `2 skipped`, 0 failed, none flaky. Skipped: mathml.spec.ts › LinearForm renders in WebKit and in Firefox (not installable here). The test that failed run 1, `✓ T12.spec.ts:1242:5 › regressions › a link to C8 node 7 (1024 positions) hydrates without a long task, as when it is picked`: `link to C8 node 7 [0, 0, 0] ms, median 0`. `T12 long tasks after picking E6 at 4x: []`, `... E7 at 4x: []`; E8 drawing time median 9 ms | pass |
| supporting: the e2e suite at the CI base (P4-RT-12-02) | `GITHUB_REPOSITORY=johnjanik/mutation_game npm run build`; `... npm run e2e` | 0; 0 | base /mutation_game/, 90 pages; `1751 passed (27.4m)`, `2 skipped` (the same two), 0 failed, 0 flaky; the C8 test recorded `link to C8 node 7 [0, 0, 0] ms, median 0` | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 133.8s`; `verify: regenerated file is byte for byte reference/golden_data.json (455014 bytes)` | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `91 passed (1.5m)` | pass |
| supporting: the benchmark | `npm run bench -w packages/engine` (alone) | 0 | `orbit benchmark: median 8.59 ms of 7 runs [12.89, 9.71, 8.59, 9.81, 6.46, 7.78, 7.76] ms, threshold 25 ms, 2000 positions, truncated true` | pass |
| supporting: `npm run bench`, `npm run build`, `npm run typecheck` | the three commands | 0; 0; 0 | root bench (the engine's bench, then site/tests/timing) `Test Files` 6 passed (6); 2 passed (2); build 90 pages, `links: 4012 internal links on 90 pages of site/dist checked, 0 problems`; typecheck `0 errors` | pass |

## 5. Commands run

| no. | command as typed | exit | log |
|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log |
| 6c | `env LATEX_SAMPLES_DIR=.../reports/gate-G6-rerun/latex/ npm --prefix /home/user/mutation_game run e2e -- site/tests/e2e/latex-export.spec.ts` | 0 | 06c-latex-samples.log |
| 7 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 07-e2e-basepath.log |
| 8 | `env RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ npm --prefix /home/user/mutation_game run build` | 0 | 08-release-build-pages.log |
| 9 | `npm --prefix /home/user/mutation_game run report` | 0 | 09-report.log |
| 10 | `env RELEASE=1 BASE_PATH=/ npm --prefix /home/user/mutation_game run build` | 0 | 10-release-build-root.log |
| 11 | `npm --prefix /home/user/mutation_game run size` (root release build) | 0 | 11-size-release.log |
| 12 | `npm --prefix /home/user/mutation_game run lab -- --all --json /home/user/mutation_game/reports/gate-G6-rerun/lab.json` | 1 | 12-lab.log (5753 s) |
| 13 | `npm --prefix /home/user/mutation_game run bench -w packages/engine` | 0 | 13-bench.log |
| 13b | `npm --prefix /home/user/mutation_game run bench` | 0 | 13b-bench-root.log |
| 14 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 14-typecheck.log |
| 15a | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run build` | 0 | 15a-build-ci-base.log |
| 15b | `env GITHUB_REPOSITORY=johnjanik/mutation_game npm --prefix /home/user/mutation_game run e2e` | 0 | 15b-e2e-ci-base.log |

## 6. Golden coverage

coverage-after-npm-test.json: missingByPhase 0 to 6 empty; phase 7 (not in force) lists golden_boards, golden_folds, orbit_plus_zero_representations, generalized_satake_example.

## 7. Sizes

Preview build (`npm run size`, step 6):

```
route                        label      limit (kB, 1 kB = 1000 bytes)  status  scripts  gzip (kB)  result
/                            one-board  60                             200     8        41.8       ok
/about/                      no-tool    15                             200     0        0.0        ok
/atlas/                      no-tool    15                             200     0        0.0        ok
/atlas/A1/                   tool       90                             200     0        0.0        ok
/atlas/A2/                   tool       90                             200     0        0.0        ok
/atlas/A3/                   tool       90                             200     0        0.0        ok
/atlas/A4/                   tool       90                             200     0        0.0        ok
/atlas/A5/                   tool       90                             200     0        0.0        ok
/atlas/A6/                   tool       90                             200     0        0.0        ok
/atlas/A7/                   tool       90                             200     0        0.0        ok
/atlas/A8/                   tool       90                             200     0        0.0        ok
/atlas/B2/                   tool       90                             200     0        0.0        ok
/atlas/B3/                   tool       90                             200     0        0.0        ok
/atlas/B4/                   tool       90                             200     0        0.0        ok
/atlas/B5/                   tool       90                             200     0        0.0        ok
/atlas/B6/                   tool       90                             200     0        0.0        ok
/atlas/B7/                   tool       90                             200     0        0.0        ok
/atlas/B8/                   tool       90                             200     0        0.0        ok
/atlas/C2/                   tool       90                             200     0        0.0        ok
/atlas/C3/                   tool       90                             200     0        0.0        ok
/atlas/C4/                   tool       90                             200     0        0.0        ok
/atlas/C5/                   tool       90                             200     0        0.0        ok
/atlas/C6/                   tool       90                             200     0        0.0        ok
/atlas/C7/                   tool       90                             200     0        0.0        ok
/atlas/C8/                   tool       90                             200     0        0.0        ok
/atlas/D4/                   tool       90                             200     0        0.0        ok
/atlas/D5/                   tool       90                             200     0        0.0        ok
/atlas/D6/                   tool       90                             200     0        0.0        ok
/atlas/D7/                   tool       90                             200     0        0.0        ok
/atlas/D8/                   tool       90                             200     0        0.0        ok
/atlas/E6/                   tool       90                             200     0        0.0        ok
/atlas/E7/                   tool       90                             200     0        0.0        ok
/atlas/E8/                   tool       90                             200     0        0.0        ok
/atlas/F4/                   tool       90                             200     0        0.0        ok
/atlas/G2/                   tool       90                             200     0        0.0        ok
/confusions/                 no-tool    15                             200     0        0.0        ok
/credits/                    no-tool    15                             200     0        0.0        ok
/dev/draw-time/              tool       90                             200     7        39.2       ok
/dev/lesson-check/           tool       90                             200     0        0.0        ok
/dev/math-check/             no-tool    15                             200     0        0.0        ok
/embed/affine/               tool       90                             200     15       67.9       ok
/embed/atlas/                tool       90                             200     7        46.1       ok
/embed/board/                tool       90                             200     21       70.7       ok
/embed/fold/                 tool       90                             200     16       69.2       ok
/embed/form/                 tool       90                             200     16       69.0       ok
/embed/garden/               tool       90                             200     15       66.8       ok
/embed/geometry/             tool       90                             200     20       81.0       ok
/embed/kostant/              tool       90                             200     16       67.8       ok
/embed/lab/                  tool       90                             200     11       64.6       ok
/embed/mirror/               tool       90                             200     18       70.4       ok
/embed/numbers/              tool       90                             200     16       73.5       ok
/embed/rep/                  tool       90                             200     19       86.2       ok
/embed/sandbox/              tool       90                             200     18       73.6       ok
/embed/satake/               tool       90                             200     18       88.1       ok
/embed/symbolic/             tool       90                             200     19       69.3       ok
/embed/weyl/                 tool       90                             200     21       77.7       ok
/glossary/                   no-tool    15                             200     0        0.0        ok
/history/                    no-tool    15                             200     0        0.0        ok
/modules/                    no-tool    15                             200     0        0.0        ok
/modules/m0-start/           lesson     120                            200     21       70.7       ok
/modules/m1-mutation/        lesson     120                            200     21       70.7       ok
/modules/m10-atlas/          lesson     120                            200     0        0.0        ok
/modules/m2-form/            lesson     120                            200     21       70.7       ok
/modules/m3-classification/  lesson     120                            200     11       64.6       ok
/modules/m4-numbers/         lesson     120                            200     21       70.7       ok
/modules/m5-weyl/            lesson     120                            200     21       70.7       ok
/modules/m6-multiple-edges/  lesson     120                            200     21       70.7       ok
/modules/m7-geometry/        lesson     120                            200     20       81.0       ok
/modules/m8-lie-algebras/    lesson     120                            200     19       86.2       ok
/modules/m9-real-forms/      lesson     120                            200     18       88.1       ok
/not-quiver-mutation/        no-tool    15                             200     0        0.0        ok
/open-items/                 no-tool    15                             200     0        0.0        ok
/open-problem/               no-tool    15                             200     0        0.0        ok
/sources/                    no-tool    15                             200     0        0.0        ok
/tools/affine/               tool       90                             200     15       67.9       ok
/tools/atlas/                tool       90                             200     7        46.1       ok
/tools/board/                tool       90                             200     21       70.7       ok
/tools/fold/                 tool       90                             200     16       69.2       ok
/tools/form/                 tool       90                             200     16       69.0       ok
/tools/garden/               tool       90                             200     15       66.8       ok
/tools/geometry/             tool       90                             200     20       81.0       ok
/tools/kostant/              tool       90                             200     16       67.8       ok
/tools/lab/                  tool       90                             200     11       64.6       ok
/tools/mirror/               tool       90                             200     18       70.4       ok
/tools/numbers/              tool       90                             200     16       73.5       ok
/tools/rep/                  tool       90                             200     19       86.2       ok
/tools/sandbox/              tool       90                             200     18       73.6       ok
/tools/satake/               tool       90                             200     18       88.1       ok
/tools/symbolic/             tool       90                             200     19       69.3       ok
/tools/weyl/                 tool       90                             200     21       77.7       ok
size: 90 routes measured, 0 over budget
```

Root release build (step 11):

```
route                        label      limit (kB, 1 kB = 1000 bytes)  status  scripts  gzip (kB)  result
/                            one-board  60                             200     8        41.8       ok
/about/                      no-tool    15                             200     0        0.0        ok
/atlas/                      no-tool    15                             200     0        0.0        ok
/atlas/A1/                   tool       90                             200     0        0.0        ok
/atlas/A2/                   tool       90                             200     0        0.0        ok
/atlas/A3/                   tool       90                             200     0        0.0        ok
/atlas/A4/                   tool       90                             200     0        0.0        ok
/atlas/A5/                   tool       90                             200     0        0.0        ok
/atlas/A6/                   tool       90                             200     0        0.0        ok
/atlas/A7/                   tool       90                             200     0        0.0        ok
/atlas/A8/                   tool       90                             200     0        0.0        ok
/atlas/B2/                   tool       90                             200     0        0.0        ok
/atlas/B3/                   tool       90                             200     0        0.0        ok
/atlas/B4/                   tool       90                             200     0        0.0        ok
/atlas/B5/                   tool       90                             200     0        0.0        ok
/atlas/B6/                   tool       90                             200     0        0.0        ok
/atlas/B7/                   tool       90                             200     0        0.0        ok
/atlas/B8/                   tool       90                             200     0        0.0        ok
/atlas/C2/                   tool       90                             200     0        0.0        ok
/atlas/C3/                   tool       90                             200     0        0.0        ok
/atlas/C4/                   tool       90                             200     0        0.0        ok
/atlas/C5/                   tool       90                             200     0        0.0        ok
/atlas/C6/                   tool       90                             200     0        0.0        ok
/atlas/C7/                   tool       90                             200     0        0.0        ok
/atlas/C8/                   tool       90                             200     0        0.0        ok
/atlas/D4/                   tool       90                             200     0        0.0        ok
/atlas/D5/                   tool       90                             200     0        0.0        ok
/atlas/D6/                   tool       90                             200     0        0.0        ok
/atlas/D7/                   tool       90                             200     0        0.0        ok
/atlas/D8/                   tool       90                             200     0        0.0        ok
/atlas/E6/                   tool       90                             200     0        0.0        ok
/atlas/E7/                   tool       90                             200     0        0.0        ok
/atlas/E8/                   tool       90                             200     0        0.0        ok
/atlas/F4/                   tool       90                             200     0        0.0        ok
/atlas/G2/                   tool       90                             200     0        0.0        ok
/confusions/                 no-tool    15                             200     0        0.0        ok
/credits/                    no-tool    15                             200     0        0.0        ok
/dev/draw-time/              tool       90                             200     7        39.2       ok
/dev/lesson-check/           tool       90                             200     0        0.0        ok
/dev/math-check/             no-tool    15                             200     0        0.0        ok
/embed/affine/               tool       90                             200     15       67.9       ok
/embed/atlas/                tool       90                             200     7        46.1       ok
/embed/board/                tool       90                             200     21       70.7       ok
/embed/fold/                 tool       90                             200     16       69.2       ok
/embed/form/                 tool       90                             200     16       69.0       ok
/embed/garden/               tool       90                             200     15       66.8       ok
/embed/geometry/             tool       90                             200     20       81.0       ok
/embed/kostant/              tool       90                             200     16       67.8       ok
/embed/lab/                  tool       90                             200     11       64.6       ok
/embed/mirror/               tool       90                             200     18       70.4       ok
/embed/numbers/              tool       90                             200     16       73.5       ok
/embed/rep/                  tool       90                             200     19       86.2       ok
/embed/sandbox/              tool       90                             200     18       73.6       ok
/embed/satake/               tool       90                             200     18       88.1       ok
/embed/symbolic/             tool       90                             200     19       69.3       ok
/embed/weyl/                 tool       90                             200     21       77.7       ok
/glossary/                   no-tool    15                             200     0        0.0        ok
/history/                    no-tool    15                             200     0        0.0        ok
/modules/                    no-tool    15                             200     0        0.0        ok
/modules/m0-start/           lesson     120                            200     21       70.7       ok
/modules/m1-mutation/        lesson     120                            200     21       70.7       ok
/modules/m10-atlas/          lesson     120                            200     0        0.0        ok
/modules/m2-form/            lesson     120                            200     21       70.7       ok
/modules/m3-classification/  lesson     120                            200     11       64.6       ok
/modules/m4-numbers/         lesson     120                            200     21       70.7       ok
/modules/m5-weyl/            lesson     120                            200     21       70.7       ok
/modules/m6-multiple-edges/  lesson     120                            200     21       70.7       ok
/modules/m7-geometry/        lesson     120                            200     20       81.0       ok
/modules/m8-lie-algebras/    lesson     120                            200     19       86.2       ok
/modules/m9-real-forms/      lesson     120                            200     18       88.1       ok
/not-quiver-mutation/        no-tool    15                             200     0        0.0        ok
/open-problem/               no-tool    15                             200     0        0.0        ok
/sources/                    no-tool    15                             200     0        0.0        ok
/tools/affine/               tool       90                             200     15       67.9       ok
/tools/atlas/                tool       90                             200     7        46.1       ok
/tools/board/                tool       90                             200     21       70.7       ok
/tools/fold/                 tool       90                             200     16       69.2       ok
/tools/form/                 tool       90                             200     16       69.0       ok
/tools/garden/               tool       90                             200     15       66.8       ok
/tools/geometry/             tool       90                             200     20       81.0       ok
/tools/kostant/              tool       90                             200     16       67.8       ok
/tools/lab/                  tool       90                             200     11       64.6       ok
/tools/mirror/               tool       90                             200     18       70.4       ok
/tools/numbers/              tool       90                             200     16       73.5       ok
/tools/rep/                  tool       90                             200     19       86.2       ok
/tools/sandbox/              tool       90                             200     18       73.6       ok
/tools/satake/               tool       90                             200     18       88.1       ok
/tools/symbolic/             tool       90                             200     19       69.3       ok
/tools/weyl/                 tool       90                             200     21       77.7       ok
size: 89 routes measured, 0 over budget
```

Against run 1, the tool, embed and lesson routes with scripts are 0.1 to 1.0 kB heavier (the round's fixes), and / and /dev/draw-time/ are unchanged; none is over its budget.

## 8. Lab timings (root release build, every route)

lab: Lighthouse CI (@lhci/cli 0.15.1, Lighthouse 12.6.1) on Chromium 141.0.7390.37; profile 360x800, CPU slowdown 4x, network not throttled; runs per route: 3, median per metric; dist site/dist; base /; processor check: ok, throttlingMethod devtools, cpuSlowdownMultiplier 4, screen 360x800 in all 268 reports

```
lab: canary (slow fixture) at http://127.0.0.1:33603/, 1 run
lab: route 1/89 / (http://localhost:4324/), runs: 3
lab: route 2/89 /about/ (http://localhost:4324/about/), runs: 3
lab: route 3/89 /atlas/ (http://localhost:4324/atlas/), runs: 3
lab: route 4/89 /atlas/A1/ (http://localhost:4324/atlas/A1/), runs: 3
lab: route 5/89 /atlas/A2/ (http://localhost:4324/atlas/A2/), runs: 3
lab: route 6/89 /atlas/A3/ (http://localhost:4324/atlas/A3/), runs: 3
lab: route 7/89 /atlas/A4/ (http://localhost:4324/atlas/A4/), runs: 3
lab: route 8/89 /atlas/A5/ (http://localhost:4324/atlas/A5/), runs: 3
lab: route 9/89 /atlas/A6/ (http://localhost:4324/atlas/A6/), runs: 3
lab: route 10/89 /atlas/A7/ (http://localhost:4324/atlas/A7/), runs: 3
lab: route 11/89 /atlas/A8/ (http://localhost:4324/atlas/A8/), runs: 3
lab: route 12/89 /atlas/B2/ (http://localhost:4324/atlas/B2/), runs: 3
lab: route 13/89 /atlas/B3/ (http://localhost:4324/atlas/B3/), runs: 3
lab: route 14/89 /atlas/B4/ (http://localhost:4324/atlas/B4/), runs: 3
lab: route 15/89 /atlas/B5/ (http://localhost:4324/atlas/B5/), runs: 3
lab: route 16/89 /atlas/B6/ (http://localhost:4324/atlas/B6/), runs: 3
lab: route 17/89 /atlas/B7/ (http://localhost:4324/atlas/B7/), runs: 3
lab: route 18/89 /atlas/B8/ (http://localhost:4324/atlas/B8/), runs: 3
lab: route 19/89 /atlas/C2/ (http://localhost:4324/atlas/C2/), runs: 3
lab: route 20/89 /atlas/C3/ (http://localhost:4324/atlas/C3/), runs: 3
lab: route 21/89 /atlas/C4/ (http://localhost:4324/atlas/C4/), runs: 3
lab: route 22/89 /atlas/C5/ (http://localhost:4324/atlas/C5/), runs: 3
lab: route 23/89 /atlas/C6/ (http://localhost:4324/atlas/C6/), runs: 3
lab: route 24/89 /atlas/C7/ (http://localhost:4324/atlas/C7/), runs: 3
lab: route 25/89 /atlas/C8/ (http://localhost:4324/atlas/C8/), runs: 3
lab: route 26/89 /atlas/D4/ (http://localhost:4324/atlas/D4/), runs: 3
lab: route 27/89 /atlas/D5/ (http://localhost:4324/atlas/D5/), runs: 3
lab: route 28/89 /atlas/D6/ (http://localhost:4324/atlas/D6/), runs: 3
lab: route 29/89 /atlas/D7/ (http://localhost:4324/atlas/D7/), runs: 3
lab: route 30/89 /atlas/D8/ (http://localhost:4324/atlas/D8/), runs: 3
lab: route 31/89 /atlas/E6/ (http://localhost:4324/atlas/E6/), runs: 3
lab: route 32/89 /atlas/E7/ (http://localhost:4324/atlas/E7/), runs: 3
lab: route 33/89 /atlas/E8/ (http://localhost:4324/atlas/E8/), runs: 3
lab: route 34/89 /atlas/F4/ (http://localhost:4324/atlas/F4/), runs: 3
lab: route 35/89 /atlas/G2/ (http://localhost:4324/atlas/G2/), runs: 3
lab: route 36/89 /confusions/ (http://localhost:4324/confusions/), runs: 3
lab: route 37/89 /credits/ (http://localhost:4324/credits/), runs: 3
lab: route 38/89 /dev/draw-time/ (http://localhost:4324/dev/draw-time/), runs: 3
lab: route 39/89 /dev/lesson-check/ (http://localhost:4324/dev/lesson-check/), runs: 3
lab: route 40/89 /dev/math-check/ (http://localhost:4324/dev/math-check/), runs: 3
lab: route 41/89 /embed/affine/ (http://localhost:4324/embed/affine/), runs: 3
lab: route 42/89 /embed/atlas/ (http://localhost:4324/embed/atlas/), runs: 3
lab: route 43/89 /embed/board/ (http://localhost:4324/embed/board/), runs: 3
lab: route 44/89 /embed/fold/ (http://localhost:4324/embed/fold/), runs: 3
lab: route 45/89 /embed/form/ (http://localhost:4324/embed/form/), runs: 3
lab: route 46/89 /embed/garden/ (http://localhost:4324/embed/garden/), runs: 3
lab: route 47/89 /embed/geometry/ (http://localhost:4324/embed/geometry/), runs: 3
lab: route 48/89 /embed/kostant/ (http://localhost:4324/embed/kostant/), runs: 3
lab: route 49/89 /embed/lab/ (http://localhost:4324/embed/lab/), runs: 3
lab: route 50/89 /embed/mirror/ (http://localhost:4324/embed/mirror/), runs: 3
lab: route 51/89 /embed/numbers/ (http://localhost:4324/embed/numbers/), runs: 3
lab: route 52/89 /embed/rep/ (http://localhost:4324/embed/rep/), runs: 3
lab: route 53/89 /embed/sandbox/ (http://localhost:4324/embed/sandbox/), runs: 3
lab: route 54/89 /embed/satake/ (http://localhost:4324/embed/satake/), runs: 3
lab: route 55/89 /embed/symbolic/ (http://localhost:4324/embed/symbolic/), runs: 3
lab: route 56/89 /embed/weyl/ (http://localhost:4324/embed/weyl/), runs: 3
lab: route 57/89 /glossary/ (http://localhost:4324/glossary/), runs: 3
lab: route 58/89 /history/ (http://localhost:4324/history/), runs: 3
lab: route 59/89 /modules/ (http://localhost:4324/modules/), runs: 3
lab: route 60/89 /modules/m0-start/ (http://localhost:4324/modules/m0-start/), runs: 3
lab: route 61/89 /modules/m1-mutation/ (http://localhost:4324/modules/m1-mutation/), runs: 3
lab: route 62/89 /modules/m10-atlas/ (http://localhost:4324/modules/m10-atlas/), runs: 3
lab: route 63/89 /modules/m2-form/ (http://localhost:4324/modules/m2-form/), runs: 3
lab: route 64/89 /modules/m3-classification/ (http://localhost:4324/modules/m3-classification/), runs: 3
lab: route 65/89 /modules/m4-numbers/ (http://localhost:4324/modules/m4-numbers/), runs: 3
lab: route 66/89 /modules/m5-weyl/ (http://localhost:4324/modules/m5-weyl/), runs: 3
lab: route 67/89 /modules/m6-multiple-edges/ (http://localhost:4324/modules/m6-multiple-edges/), runs: 3
lab: route 68/89 /modules/m7-geometry/ (http://localhost:4324/modules/m7-geometry/), runs: 3
lab: route 69/89 /modules/m8-lie-algebras/ (http://localhost:4324/modules/m8-lie-algebras/), runs: 3
lab: route 70/89 /modules/m9-real-forms/ (http://localhost:4324/modules/m9-real-forms/), runs: 3
lab: route 71/89 /not-quiver-mutation/ (http://localhost:4324/not-quiver-mutation/), runs: 3
lab: route 72/89 /open-problem/ (http://localhost:4324/open-problem/), runs: 3
lab: route 73/89 /sources/ (http://localhost:4324/sources/), runs: 3
lab: route 74/89 /tools/affine/ (http://localhost:4324/tools/affine/), runs: 3
lab: route 75/89 /tools/atlas/ (http://localhost:4324/tools/atlas/), runs: 3
lab: route 76/89 /tools/board/ (http://localhost:4324/tools/board/), runs: 3
lab: route 77/89 /tools/fold/ (http://localhost:4324/tools/fold/), runs: 3
lab: route 78/89 /tools/form/ (http://localhost:4324/tools/form/), runs: 3
lab: route 79/89 /tools/garden/ (http://localhost:4324/tools/garden/), runs: 3
lab: route 80/89 /tools/geometry/ (http://localhost:4324/tools/geometry/), runs: 3
lab: route 81/89 /tools/kostant/ (http://localhost:4324/tools/kostant/), runs: 3
lab: route 82/89 /tools/lab/ (http://localhost:4324/tools/lab/), runs: 3
lab: route 83/89 /tools/mirror/ (http://localhost:4324/tools/mirror/), runs: 3
lab: route 84/89 /tools/numbers/ (http://localhost:4324/tools/numbers/), runs: 3
lab: route 85/89 /tools/rep/ (http://localhost:4324/tools/rep/), runs: 3
lab: route 86/89 /tools/sandbox/ (http://localhost:4324/tools/sandbox/), runs: 3
lab: route 87/89 /tools/satake/ (http://localhost:4324/tools/satake/), runs: 3
lab: route 88/89 /tools/symbolic/ (http://localhost:4324/tools/symbolic/), runs: 3
lab: route 89/89 /tools/weyl/ (http://localhost:4324/tools/weyl/), runs: 3
lab: Lighthouse CI (@lhci/cli 0.15.1, Lighthouse 12.6.1) on Chromium 141.0.7390.37; profile 360x800, CPU slowdown 4x, network not throttled; runs per route: 3, median per metric; dist site/dist; base /; processor check: ok, throttlingMethod devtools, cpuSlowdownMultiplier 4, screen 360x800 in all 268 reports
route                               LCP (<= 2.5 s)  TBT (<= 200 ms)  CLS (<= 0.1)  status
/                                   0.294           49.0             0.0000        ok
/about/                             0.180           0.0              0.0000        ok
/atlas/                             0.369           38.1             0.0000        ok
/atlas/A1/                          0.586           0.0              0.0000        ok
/atlas/A2/                          0.609           17.6             0.0000        ok
/atlas/A3/                          0.586           95.8             0.0000        ok
/atlas/A4/                          0.407           163.0            0.0000        ok
/atlas/A5/                          0.495           128.2            0.0000        ok
/atlas/A6/                          0.684           0.0              0.0000        ok
/atlas/A7/                          0.586           98.0             0.0000        ok
/atlas/A8/                          0.715           31.5             0.0000        ok
/atlas/B2/                          0.405           62.3             0.0000        ok
/atlas/B3/                          0.447           178.1            0.0000        ok
/atlas/B4/                          0.412           139.9            0.0000        ok
/atlas/B5/                          0.549           106.6            0.0000        ok
/atlas/B6/                          0.554           210.1            0.0000        OVER (TBT)
/atlas/B7/                          0.517           140.1            0.0000        ok
/atlas/B8/                          0.604           69.6             0.0000        ok
/atlas/C2/                          0.397           141.5            0.0000        ok
/atlas/C3/                          0.400           128.4            0.0000        ok
/atlas/C4/                          0.655           97.7             0.0000        ok
/atlas/C5/                          0.645           0.0              0.0000        ok
/atlas/C6/                          0.529           122.6            0.0000        ok
/atlas/C7/                          0.444           111.5            0.0000        ok
/atlas/C8/                          0.421           191.4            0.0000        ok
/atlas/D4/                          0.407           132.7            0.0000        ok
/atlas/D5/                          0.544           56.1             0.0000        ok
/atlas/D6/                          0.402           202.7            0.0000        OVER (TBT)
/atlas/D7/                          0.508           142.0            0.0000        ok
/atlas/D8/                          0.389           224.7            0.0000        OVER (TBT)
/atlas/E6/                          0.533           86.4             0.0000        ok
/atlas/E7/                          0.522           0.0              0.0000        ok
/atlas/E8/                          0.426           87.3             0.0000        ok
/atlas/F4/                          0.546           0.0              0.0000        ok
/atlas/G2/                          0.480           59.1             0.0000        ok
/confusions/                        0.502           31.9             0.0000        ok
/credits/                           0.342           0.0              0.0000        ok
/dev/draw-time/                     0.161           305.0            0.0000        OVER (TBT)
/dev/lesson-check/                  0.265           0.0              0.0000        ok
/dev/math-check/                    0.312           0.0              0.0000        ok
/embed/affine/                      0.247           153.2            0.0000        ok
/embed/atlas/                       0.301           92.5             0.0000        ok
/embed/board/                       0.362           186.4            0.0000        ok
/embed/fold/                        0.348           173.5            0.0000        ok
/embed/form/                        0.319           150.0            0.0033        ok
/embed/garden/                      0.323           178.0            0.0000        ok
/embed/geometry/                    0.390           275.0            0.0000        OVER (TBT)
/embed/kostant/                     0.301           145.4            0.0000        ok
/embed/lab/                         0.195           152.2            0.0000        ok
/embed/mirror/                      0.369           157.2            0.0000        ok
/embed/numbers/                     0.329           191.1            0.0000        ok
/embed/rep/                         0.233           277.4            0.0000        OVER (TBT)
/embed/sandbox/                     0.366           262.1            0.0000        OVER (TBT)
/embed/satake/                      0.408           310.5            0.0000        OVER (TBT)
/embed/symbolic/                    0.194           228.2            0.0000        OVER (TBT)
/embed/weyl/                        0.300           309.4            0.0000        OVER (TBT)
/glossary/                          0.562           419.0            0.0000        OVER (TBT)
/history/                           0.425           0.0              0.0000        ok
/modules/                           0.160           0.0              0.0000        ok
/modules/m0-start/                  0.906           168.7            0.0000        ok
/modules/m1-mutation/               1.222           95.2             0.0000        ok
/modules/m10-atlas/                 0.372           0.0              0.0000        ok
/modules/m2-form/                   1.370           170.5            0.0000        ok
/modules/m3-classification/         1.416           152.4            0.0000        ok
/modules/m4-numbers/                1.306           134.1            0.0000        ok
/modules/m5-weyl/                   1.538           209.6            0.0000        OVER (TBT)
/modules/m6-multiple-edges/         1.475           122.9            0.0000        ok
/modules/m7-geometry/               1.960           170.6            0.0000        ok
/modules/m8-lie-algebras/           2.216           220.7            0.0000        OVER (TBT)
/modules/m9-real-forms/             1.719           250.5            0.0000        OVER (TBT)
/not-quiver-mutation/               0.360           79.1             0.0000        ok
/open-problem/                      0.193           0.0              0.0000        ok
/sources/                           0.726           375.5            0.0000        OVER (TBT)
/tools/affine/                      0.224           184.5            0.0000        ok
/tools/atlas/                       0.262           150.9            0.0000        ok
/tools/board/                       0.193           262.4            0.0000        OVER (TBT)
/tools/fold/                        0.250           203.9            0.0000        OVER (TBT)
/tools/form/                        0.234           271.8            0.0000        OVER (TBT)
/tools/garden/                      0.259           273.8            0.0000        OVER (TBT)
/tools/geometry/                    0.290           351.2            0.0000        OVER (TBT)
/tools/kostant/                     0.236           142.3            0.0000        ok
/tools/lab/                         0.286           268.3            0.0000        OVER (TBT)
/tools/mirror/                      0.245           281.0            0.0000        OVER (TBT)
/tools/numbers/                     0.262           271.0            0.0000        OVER (TBT)
/tools/rep/                         0.236           364.8            0.0000        OVER (TBT)
/tools/sandbox/                     0.298           300.4            0.0000        OVER (TBT)
/tools/satake/                      0.212           414.7            0.0000        OVER (TBT)
/tools/symbolic/                    0.294           389.2            0.0000        OVER (TBT)
/tools/weyl/                        0.249           295.7            0.0000        OVER (TBT)
canary (slow fixture, not a route)  3.811           556.7            0.3730        over on LCP, TBT, CLS (as it must be)
lab: 89 routes measured, 28 over threshold, 0 missing or in error
lab: finished in 5753 s
```

The owner accepted gate G3's lab item as machine-bound on 17 October 2026 (TBT 242 to 332 ms on this container). Here 27 of the 28 routes over lie between 202.7 and 414.7 ms, and /glossary/ (a page with no script, 83 typeset entries; P6-RT-07-03 measured its layout of KaTeX markup) measures 419.0 ms. Against run 1, the median change of the median TBT per route is: the 16 tool routes +70 ms; the 16 embed routes +28 ms; the 32 Atlas sheets +46 ms; the lessons M0 to M9 +6 ms; the pages with no script +0 ms. The canary measured 556.7 ms against 553.7 in run 1, and the per-run values swing widely (/tools/symbolic/ 159, 389 and 496 ms in its three runs). The rise on the tool routes sits in the hydration task (Astro's client chunk, the same file in both runs).

A diagnostic after the chain, cited as proof of nothing about the verdict: the root release builds of f07eec6 (run 1) and facff37 (this run) were built in scratch worktrees and measured with the same lab script on six routes, alternating f07eec6, facff37, f07eec6, facff37 (3 runs each, so 6 runs per route and commit; load average 0.9 to 1.5; the canary 554.1 to 555.4 ms in all four). Median TBT in ms, f07eec6 then facff37:

| route | f07eec6 | facff37 | change |
|---|---|---|---|
| /tools/geometry/ | 228.2 | 215.4 | -12.7 |
| /tools/satake/ | 309.4 | 312.8 | +3.4 |
| /tools/symbolic/ | 209.3 | 248.9 | +39.6 |
| /tools/rep/ | 258.8 | 375.2 | +116.4 |
| /tools/form/ | 223.8 | 262.8 | +39.0 |
| /sources/ | 392.7 | 364.6 | -28.1 |

The single runs swing widely on both commits (/tools/rep/ 198 to 491 ms on f07eec6). /tools/geometry/ and /tools/satake/ do not move, so most of their rise between the two gate runs is the container. /tools/rep/ rises by about 116 ms: after Astro's hydration task, four of its six runs on facff37 show a T12RepresentationBuilder task, a task of 50 to 68 ms and a second T12RepresentationBuilder task; none of the six runs on f07eec6 shows that sequence (two of them have two T12RepresentationBuilder tasks with nothing between). That fits the round's repair of T12's link hydration (cluster t12-t5: the link is read after hydration; P6-RT-11-03 and run 1's T12.spec.ts:1242). It reads as a regression of T12's default state in the lab (/tools/rep/, and /embed/rep/ through the same component), which no test measures. /tools/symbolic/ and /tools/form/ rise by about 40 ms, within the spread of single runs. Whether the G3 acceptance holds at G6, for the tool routes above 332 ms and for the glossary, is the owner's decision; so is whether T12's extra task is repaired before release 1.0.

## 9. Release build, reports and archives

Open items in the Pages release build (08-release-build-pages.log):

```
open item E1 used on /mutation_game/modules/m9-real-forms/ (fallback shown)
open item E2 used on /mutation_game/history/ (fallback shown)
open item E2 used on /mutation_game/modules/m4-numbers/ (fallback shown)
open item E3 used on /mutation_game/modules/m5-weyl/ (fallback shown)
open item E4 used on /mutation_game/atlas/E6/ (fallback shown)
open item E4 used on /mutation_game/atlas/E7/ (fallback shown)
open item E4 used on /mutation_game/atlas/E8/ (fallback shown)
open item E4 used on /mutation_game/atlas/G2/ (fallback shown)
open item E4 used on /mutation_game/modules/m1-mutation/ (fallback shown)
open item E4 used on /mutation_game/modules/m3-classification/ (fallback shown)
open item E4 used on /mutation_game/open-problem/ (fallback shown)
open item E5 used on /mutation_game/credits/ (fallback shown)
open item E5 used on /mutation_game/history/ (fallback shown)
open item E6 used on /mutation_game/embed/affine/ (fallback shown)
open item E6 used on /mutation_game/modules/m3-classification/ (fallback shown)
open item E6 used on /mutation_game/modules/m4-numbers/ (fallback shown)
open item E6 used on /mutation_game/tools/affine/ (fallback shown)
open item E7 used on /mutation_game/modules/m7-geometry/ (fallback shown)
open item E9 used on /mutation_game/modules/m7-geometry/ (fallback shown)
open item E10 used on /mutation_game/modules/m3-classification/ (fallback shown)
open item E10 used on /mutation_game/modules/m8-lie-algebras/ (fallback shown)
open item E13 used on /mutation_game/history/ (fallback shown)
open item E15 used on /mutation_game/modules/m9-real-forms/ (fallback shown)
open item E16 used on /mutation_game/modules/m5-weyl/ (fallback shown)
open item E16 used on /mutation_game/modules/m6-multiple-edges/ (fallback shown)
open item E17 used on /mutation_game/confusions/ (fallback shown)
```

Archives: pages archive: 3317641 bytes, 358 entries, sha256 c459abae6f4b30271a47a6142551c23004289f8f6f970241e9506443d3a679d6; RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/; root archive: 3313050 bytes, 358 entries, sha256 20b609c87603ae13398016f5b29521449cb93e3badd89e9bc963b367b3f9de38; RELEASE=1 BASE_PATH=/. Files: reports/release-1.0-pages.tar.gz and reports/release-1.0-root.tar.gz (run 1's are in reports/gate-G6/run1-archives/). site/dist holds the last build of the chain, the CI-base preview build (15a); the root release build is the one the lab measured.

## 10. Fragments merged

Every fragment of phase 6 and of its red-team round is folded into DECISIONS.md: the phase's fragments (section 10 of run 1) and the round's 45 RT-FIX-P6 sections with the MERGE entry "the phase 6 red-team round, fixes merged" (`1312 fragment headings, 0 not in DECISIONS.md`).

## 11. The owner's part

- [ ] Every item of Appendix E not settled earlier, items 1, 4, 5 and 8 first (the open-items report lists 13 items in use; E8, E11, E12, E14 are used on no page).
- [ ] Accessibility script A-13 on the whole site.
- [ ] Interaction to Next Paint on one phone.
- [ ] One exported LaTeX file of each kind compiled (reports/gate-G6-rerun/latex/: dynkin.tex, tikz-graph.tex, tikz-points.tex, tikz-graph-weyl.tex, tikz-graph-rep.tex; each holds `% needs \usepackage{...}` and a body to \input).
- [ ] Approval of the text of M6 to M10 (M9 and M10 carry the draft mark).
- [ ] The lab item: whether the machine-bound acceptance of G3 holds for the 28 routes over at G6, /glossary/ and the tool routes above 332 ms included, and whether T12's extra task after hydration (/tools/rep/, about +116 ms against run 1) is repaired before release 1.0 (section 8).
- [ ] The decisions the round left to the owner (DECISIONS.md, "MERGE: the phase 6 red-team round, fixes merged"): the worker wire labels (a change to CONTRACTS.md 4), T6's LaTeX export, and the findings refuted but recorded for the owner.

## 12. Failures, reruns and repairs

- lab (step 12): 28 routes over TBT; the item fails as measured. The diagnostic of section 8 finds one regression from the round, the extra task after T12's hydration on /tools/rep/ (about +116 ms); a repair would go to the T12 role, and a lab run on every route would follow it.
- No test failed in either e2e run. No test was skipped beyond the two MathML engines, no timeout was lengthened, no test was retried for this report.
