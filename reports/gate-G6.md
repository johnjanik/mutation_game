# Gate G6: Real forms, atlas, release 1.0 (run 1)

Gate commit: f07eec66a8b80d249101630305ef6d2d23882738 (local tag gate-G6-candidate), on the integration branch claude/session-6a181f60-hzzoud, which stands in for main. Run by the orchestrator in the GATE role on 2026-10-26, 00:23 to 03:40 UTC, alone on the machine (load average 0.4 to 3), in three parts (build-plan/reports/orchestrator/scripts/gate-g6-chain.sh A, B, C). Logs: reports/gate-G6/ (not committed).

**Verdict: RED.** Two items fail. (1) `npm run e2e` had one failed test: T12.spec.ts:1242 'a link to C8 node 7 (1024 positions) hydrates without a long task, as when it is picked' measured the hydration task at [0, 53, 56] ms, median 53 against at most 50 (G5 and its rerun measured [0, 0, 0]); the same test passed in the e2e run at the CI base two hours later ([0, 0, 51], median 0). A test that fails in any run fails its item (GATE 5.8); no rerun is cited as proof. (2) The lab on every route: 20 of 89 routes over the Total Blocking Time limit of 200 ms (`lab: 89 routes measured, 20 over threshold`, exit 1); every LCP and CLS is within its limit. Every other item passes.

Release named: 1.0, with the built site archived. The owner tags the release; nothing is pushed but the integration branch.

## 1. Preconditions

- The working tree was clean at the start (`git status --porcelain` empty); earlier content reports were moved to reports/gate-G6/previous/ (00-moves.log).
- Every merge of phase 6 is recorded in DECISIONS.md (the MERGE entries of 2026-10-25 and 2026-10-26); the fragments check prints `1265 fragment headings, 0 not in DECISIONS.md`.
- Merge checks with no agent running, on 6214e96 (the commit below the gate commit's two record commits): npm test 3940 passed, e2e 1692 passed and 2 skipped, size 90 routes 0 over (reports/merge-pregate-g6-6214e96/).

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
| all golden tests of phases 0 to 6 pass | `npm test` | 0 | `Test Files  188 passed (188)`; `Tests  3940 passed (3940)`; the engine's coverage gate (phase in force 6, read from the T13 and T14 registry entries) passed: coverage-after-npm-test.json missingByPhase 0 to 6 empty (phase 7 lists golden_boards, golden_folds, orbit_plus_zero_representations, generalized_satake_example, not in force). `npm run verify` regenerates the golden file byte for byte (supporting row) | pass |
| property tests 1 to 13 pass | `npm test` | 0 | packages/engine/test/properties/p1 to p13 exist (`ls`) and passed within the 188 files | pass |
| acceptance of T13 and T14 as automated tests | `npm test`; `npm run e2e` | 0; 1 | site/tests/unit/tools/T13.test.ts and site/tests/unit/atlas.test.ts (with atlas-build-path.test.ts) passed within the 188 files; in the browser T13.spec.ts 27 passed, T13-keyboard.spec.ts 3 passed, T14.spec.ts 29 passed, none failed or skipped | pass |
| full accessibility scan of every page and tool route; keyboard scripts for T1, T4, T13 | `npm run e2e` | 1 | a11y.spec.ts 91 passed, 0 failed (every route of site/dist, no serious or critical violation); `✓ T01.spec.ts:284:1 › keyboard-only play on A3 and E8`; T04.spec.ts 21 passed (its keyboard-only tests among them); T13-keyboard.spec.ts 3 passed. The command's exit 1 is the T12 test of the supporting e2e row | pass |
| sizes and lab timings of SPEC 7.6 on every page | `npm run size` (preview and root release builds); `npm run lab -- --all --json reports/gate-G6/lab.json` | 0; 0; 1 | `size: 90 routes measured, 0 over budget` (preview) and `size: 89 routes measured, 0 over budget` (root release), section 7. Lab on the root release build: `lab: 89 routes measured, 20 over threshold, 0 missing or in error`; over on TBT only: /atlas/C7/, /dev/draw-time/, /embed/form/, /embed/geometry/, /embed/mirror/, /embed/satake/, /embed/weyl/, /glossary/, /modules/m8-lie-algebras/, /sources/, /tools/board/, /tools/fold/, /tools/garden/, /tools/geometry/, /tools/mirror/, /tools/rep/, /tools/sandbox/, /tools/satake/, /tools/symbolic/, /tools/weyl/; every LCP at most 2.102 s and every CLS 0.0000; the canary over on all three as it must be; section 8 | fail (lab) |
| a release build succeeds; its report of open items is left in reports/ | `RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ npm run build`; `npm run report`; `RELEASE=1 BASE_PATH=/ npm run build` | 0; 0; 0 | both release builds succeeded; 26 `open item ... (fallback shown)` lines (section 9); `report: open items report of 2026-10-26T00:58:56.936Z: 13 open items used on 18 pages, 0 unknown items`; `numbers-in-prose: 2 numbers in 1 files, 5 in fallbacks` (the two are years in M10's history item); reports/open-items-report.json and .md are the root release build's (mode release), the Pages build's copies in reports/gate-G6/ | pass |
| the two archives of SPEC 7.8 (Pages address; BASE_PATH=/) built and left in reports/ | tar after each release build | 0; 0 | pages archive: 3288670 bytes, 325 entries, sha256 78588232bc259d02a63c87e441443b586fb33fd4101ac5fe69eced03c53afa05; RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/; root archive: 3284259 bytes, 325 entries, sha256 eaa20cd9fdf0c6d3dde0592aed22bfdb637fa82d0680b3fdbeac3dec10cc6700; RELEASE=1 BASE_PATH=/ | pass |
| LaTeX export produces the three forms of 6.7 (compiling them is the owner's part) | `npm test`; `LATEX_SAMPLES_DIR=reports/gate-G6/latex/ npm run e2e -- site/tests/e2e/latex-export.spec.ts` | 0; 0 | site/tests/unit/latex.test.ts passed with the three byte-for-byte forms of 6.7; the samples spec `5 passed`; reports/gate-G6/latex/ holds dynkin.tex (`\dynkin E{oooooo}`), tikz-graph.tex (12 nodes, 15 edges) and tikz-points.tex (12 points, 24 edges) for the owner's compile | pass |
| reference hashes unchanged | sha256sum | 0 | section 2 | pass |
| supporting: `npm run e2e` (the whole browser suite at the preview build) | `npm run e2e` | 1 | `1 failed`, `2 skipped`, `1691 passed (26.0m)`; failed: `T12.spec.ts:1242:5 › regressions › a link to C8 node 7 (1024 positions) hydrates without a long task, as when it is picked`: `Expected: <= 50, Received: 53` (`link to C8 node 7 [0, 53, 56] ms, median 53; control E7 node 7 [0, 0, 0] ms`). Skipped: mathml.spec.ts › LinearForm renders in WebKit and in Firefox (not installable here). `T12 long tasks after picking E6 at 4x: []`, `... E7 at 4x: []`; E8 drawing time median 11.9 ms | fail |
| supporting: the e2e suite at the CI base (P4-RT-12-02) | `GITHUB_REPOSITORY=johnjanik/mutation_game npm run build`; `... npm run e2e` | 0; 0 | base /mutation_game/; `1692 passed (26.0m)`, `2 skipped` (the same two); the C8 test recorded `[0, 0, 51] ms, median 0` | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 120.6s` | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `91 passed (1.5m)` | pass |
| supporting: the benchmark | `npm run bench -w packages/engine` (alone) | 0 | `orbit benchmark: median 12.82 ms of 7 runs [16.59, 10.76, 14.42, 16.53, 12.61, 12.82, 8.83] ms, threshold 25 ms, 2000 positions, truncated true` | pass |
| supporting: `npm run bench`, `npm run build`, `npm run typecheck` | the three commands | 0; 0; 0 | root bench 2 files passed; build 90 pages, 0 link problems; typecheck `0 errors` | pass |

## 5. Commands run

| no. | command as typed | exit | log |
|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 1 | 05-e2e.log |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log |
| 6c | `env LATEX_SAMPLES_DIR=.../reports/gate-G6/latex/ npm --prefix /home/user/mutation_game run e2e -- site/tests/e2e/latex-export.spec.ts` | 0 | 06c-latex-samples.log |
| 7 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 07-e2e-basepath.log |
| 8 | `env RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/ npm --prefix /home/user/mutation_game run build` | 0 | 08-release-build-pages.log |
| 9 | `npm --prefix /home/user/mutation_game run report` | 0 | 09-report.log |
| 10 | `env RELEASE=1 BASE_PATH=/ npm --prefix /home/user/mutation_game run build` | 0 | 10-release-build-root.log |
| 11 | `npm --prefix /home/user/mutation_game run size` (root release build) | 0 | 11-size-release.log |
| 12 | `npm --prefix /home/user/mutation_game run lab -- --all --json /home/user/mutation_game/reports/gate-G6/lab.json` | 1 | 12-lab.log (5710 s) |
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
/embed/affine/               tool       90                             200     15       67.7       ok
/embed/atlas/                tool       90                             200     7        46.0       ok
/embed/board/                tool       90                             200     21       70.4       ok
/embed/fold/                 tool       90                             200     16       69.0       ok
/embed/form/                 tool       90                             200     16       68.8       ok
/embed/garden/               tool       90                             200     15       66.7       ok
/embed/geometry/             tool       90                             200     20       80.7       ok
/embed/kostant/              tool       90                             200     16       67.5       ok
/embed/lab/                  tool       90                             200     11       64.4       ok
/embed/mirror/               tool       90                             200     18       70.2       ok
/embed/numbers/              tool       90                             200     16       73.1       ok
/embed/rep/                  tool       90                             200     19       85.7       ok
/embed/sandbox/              tool       90                             200     18       73.4       ok
/embed/satake/               tool       90                             200     18       87.1       ok
/embed/symbolic/             tool       90                             200     19       69.0       ok
/embed/weyl/                 tool       90                             200     21       77.4       ok
/glossary/                   no-tool    15                             200     0        0.0        ok
/history/                    no-tool    15                             200     0        0.0        ok
/modules/                    no-tool    15                             200     0        0.0        ok
/modules/m0-start/           lesson     120                            200     21       70.4       ok
/modules/m1-mutation/        lesson     120                            200     21       70.4       ok
/modules/m10-atlas/          lesson     120                            200     0        0.0        ok
/modules/m2-form/            lesson     120                            200     21       70.4       ok
/modules/m3-classification/  lesson     120                            200     11       64.4       ok
/modules/m4-numbers/         lesson     120                            200     21       70.4       ok
/modules/m5-weyl/            lesson     120                            200     21       70.4       ok
/modules/m6-multiple-edges/  lesson     120                            200     21       70.4       ok
/modules/m7-geometry/        lesson     120                            200     20       80.7       ok
/modules/m8-lie-algebras/    lesson     120                            200     19       85.7       ok
/modules/m9-real-forms/      lesson     120                            200     18       87.1       ok
/not-quiver-mutation/        no-tool    15                             200     0        0.0        ok
/open-items/                 no-tool    15                             200     0        0.0        ok
/open-problem/               no-tool    15                             200     0        0.0        ok
/sources/                    no-tool    15                             200     0        0.0        ok
/tools/affine/               tool       90                             200     15       67.7       ok
/tools/atlas/                tool       90                             200     7        46.0       ok
/tools/board/                tool       90                             200     21       70.4       ok
/tools/fold/                 tool       90                             200     16       69.0       ok
/tools/form/                 tool       90                             200     16       68.8       ok
/tools/garden/               tool       90                             200     15       66.7       ok
/tools/geometry/             tool       90                             200     20       80.7       ok
/tools/kostant/              tool       90                             200     16       67.5       ok
/tools/lab/                  tool       90                             200     11       64.4       ok
/tools/mirror/               tool       90                             200     18       70.2       ok
/tools/numbers/              tool       90                             200     16       73.1       ok
/tools/rep/                  tool       90                             200     19       85.7       ok
/tools/sandbox/              tool       90                             200     18       73.4       ok
/tools/satake/               tool       90                             200     18       87.1       ok
/tools/symbolic/             tool       90                             200     19       69.0       ok
/tools/weyl/                 tool       90                             200     21       77.4       ok
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
/embed/affine/               tool       90                             200     15       67.7       ok
/embed/atlas/                tool       90                             200     7        46.0       ok
/embed/board/                tool       90                             200     21       70.4       ok
/embed/fold/                 tool       90                             200     16       69.0       ok
/embed/form/                 tool       90                             200     16       68.8       ok
/embed/garden/               tool       90                             200     15       66.7       ok
/embed/geometry/             tool       90                             200     20       80.7       ok
/embed/kostant/              tool       90                             200     16       67.5       ok
/embed/lab/                  tool       90                             200     11       64.4       ok
/embed/mirror/               tool       90                             200     18       70.2       ok
/embed/numbers/              tool       90                             200     16       73.1       ok
/embed/rep/                  tool       90                             200     19       85.7       ok
/embed/sandbox/              tool       90                             200     18       73.4       ok
/embed/satake/               tool       90                             200     18       87.1       ok
/embed/symbolic/             tool       90                             200     19       69.0       ok
/embed/weyl/                 tool       90                             200     21       77.4       ok
/glossary/                   no-tool    15                             200     0        0.0        ok
/history/                    no-tool    15                             200     0        0.0        ok
/modules/                    no-tool    15                             200     0        0.0        ok
/modules/m0-start/           lesson     120                            200     21       70.4       ok
/modules/m1-mutation/        lesson     120                            200     21       70.4       ok
/modules/m10-atlas/          lesson     120                            200     0        0.0        ok
/modules/m2-form/            lesson     120                            200     21       70.4       ok
/modules/m3-classification/  lesson     120                            200     11       64.4       ok
/modules/m4-numbers/         lesson     120                            200     21       70.4       ok
/modules/m5-weyl/            lesson     120                            200     21       70.4       ok
/modules/m6-multiple-edges/  lesson     120                            200     21       70.4       ok
/modules/m7-geometry/        lesson     120                            200     20       80.7       ok
/modules/m8-lie-algebras/    lesson     120                            200     19       85.7       ok
/modules/m9-real-forms/      lesson     120                            200     18       87.1       ok
/not-quiver-mutation/        no-tool    15                             200     0        0.0        ok
/open-problem/               no-tool    15                             200     0        0.0        ok
/sources/                    no-tool    15                             200     0        0.0        ok
/tools/affine/               tool       90                             200     15       67.7       ok
/tools/atlas/                tool       90                             200     7        46.0       ok
/tools/board/                tool       90                             200     21       70.4       ok
/tools/fold/                 tool       90                             200     16       69.0       ok
/tools/form/                 tool       90                             200     16       68.8       ok
/tools/garden/               tool       90                             200     15       66.7       ok
/tools/geometry/             tool       90                             200     20       80.7       ok
/tools/kostant/              tool       90                             200     16       67.5       ok
/tools/lab/                  tool       90                             200     11       64.4       ok
/tools/mirror/               tool       90                             200     18       70.2       ok
/tools/numbers/              tool       90                             200     16       73.1       ok
/tools/rep/                  tool       90                             200     19       85.7       ok
/tools/sandbox/              tool       90                             200     18       73.4       ok
/tools/satake/               tool       90                             200     18       87.1       ok
/tools/symbolic/             tool       90                             200     19       69.0       ok
/tools/weyl/                 tool       90                             200     21       77.4       ok
size: 89 routes measured, 0 over budget
```

## 8. Lab timings (root release build, every route)

lab: Lighthouse CI (@lhci/cli 0.15.1, Lighthouse 12.6.1) on Chromium 141.0.7390.37; profile 360x800, CPU slowdown 4x, network not throttled; runs per route: 3, median per metric; dist site/dist; base /; processor check: ok, throttlingMethod devtools, cpuSlowdownMultiplier 4, screen 360x800 in all 268 reports

```
lab: canary (slow fixture) at http://127.0.0.1:46683/, 1 run
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
/                                   0.200           51.5             0.0000        ok
/about/                             0.116           4.4              0.0000        ok
/atlas/                             0.402           0.0              0.0000        ok
/atlas/A1/                          0.608           0.0              0.0000        ok
/atlas/A2/                          0.550           22.7             0.0000        ok
/atlas/A3/                          0.500           0.0              0.0000        ok
/atlas/A4/                          0.395           108.1            0.0000        ok
/atlas/A5/                          0.425           85.0             0.0000        ok
/atlas/A6/                          0.643           0.0              0.0000        ok
/atlas/A7/                          0.555           49.6             0.0000        ok
/atlas/A8/                          0.635           20.6             0.0000        ok
/atlas/B2/                          0.554           0.0              0.0000        ok
/atlas/B3/                          0.616           0.0              0.0000        ok
/atlas/B4/                          0.502           78.9             0.0000        ok
/atlas/B5/                          0.557           119.5            0.0000        ok
/atlas/B6/                          0.421           189.6            0.0000        ok
/atlas/B7/                          0.643           0.0              0.0000        ok
/atlas/B8/                          0.638           19.9             0.0000        ok
/atlas/C2/                          0.613           76.4             0.0000        ok
/atlas/C3/                          0.639           31.8             0.0000        ok
/atlas/C4/                          0.602           0.0              0.0000        ok
/atlas/C5/                          0.693           37.2             0.0000        ok
/atlas/C6/                          0.680           0.0              0.0000        ok
/atlas/C7/                          0.323           233.2            0.0000        OVER (TBT)
/atlas/C8/                          0.553           63.6             0.0000        ok
/atlas/D4/                          0.581           38.6             0.0000        ok
/atlas/D5/                          0.397           126.1            0.0000        ok
/atlas/D6/                          0.537           37.0             0.0000        ok
/atlas/D7/                          0.384           166.1            0.0000        ok
/atlas/D8/                          0.464           189.3            0.0000        ok
/atlas/E6/                          0.527           30.5             0.0000        ok
/atlas/E7/                          0.623           0.0              0.0000        ok
/atlas/E8/                          0.408           148.6            0.0000        ok
/atlas/F4/                          0.530           0.0              0.0000        ok
/atlas/G2/                          0.462           56.8             0.0000        ok
/confusions/                        0.545           0.0              0.0000        ok
/credits/                           0.362           0.0              0.0000        ok
/dev/draw-time/                     0.177           339.8            0.0000        OVER (TBT)
/dev/lesson-check/                  0.269           0.0              0.0000        ok
/dev/math-check/                    0.301           0.0              0.0000        ok
/embed/affine/                      0.286           131.4            0.0000        ok
/embed/atlas/                       0.300           84.3             0.0000        ok
/embed/board/                       0.300           123.0            0.0000        ok
/embed/fold/                        0.364           182.8            0.0000        ok
/embed/form/                        0.363           219.7            0.0000        OVER (TBT)
/embed/garden/                      0.348           176.0            0.0000        ok
/embed/geometry/                    0.328           208.1            0.0000        OVER (TBT)
/embed/kostant/                     0.298           101.7            0.0000        ok
/embed/lab/                         0.297           127.0            0.0000        ok
/embed/mirror/                      0.340           202.8            0.0000        OVER (TBT)
/embed/numbers/                     0.338           161.1            0.0000        ok
/embed/rep/                         0.341           196.0            0.0000        ok
/embed/sandbox/                     0.329           194.9            0.0000        ok
/embed/satake/                      0.307           219.7            0.0000        OVER (TBT)
/embed/symbolic/                    0.194           171.0            0.0000        ok
/embed/weyl/                        0.271           309.9            0.0000        OVER (TBT)
/glossary/                          0.394           432.4            0.0000        OVER (TBT)
/history/                           0.309           0.0              0.0000        ok
/modules/                           0.170           0.0              0.0000        ok
/modules/m0-start/                  0.910           126.0            0.0000        ok
/modules/m1-mutation/               1.133           129.9            0.0000        ok
/modules/m10-atlas/                 0.359           0.0              0.0000        ok
/modules/m2-form/                   1.207           137.4            0.0000        ok
/modules/m3-classification/         1.345           162.8            0.0000        ok
/modules/m4-numbers/                1.159           127.7            0.0000        ok
/modules/m5-weyl/                   1.583           132.8            0.0000        ok
/modules/m6-multiple-edges/         1.458           148.0            0.0000        ok
/modules/m7-geometry/               2.102           165.3            0.0000        ok
/modules/m8-lie-algebras/           2.052           329.1            0.0000        OVER (TBT)
/modules/m9-real-forms/             1.800           195.7            0.0000        ok
/not-quiver-mutation/               0.583           0.0              0.0000        ok
/open-problem/                      0.220           0.0              0.0000        ok
/sources/                           0.624           236.3            0.0000        OVER (TBT)
/tools/affine/                      0.198           193.4            0.0000        ok
/tools/atlas/                       0.229           81.4             0.0000        ok
/tools/board/                       0.222           202.9            0.0000        OVER (TBT)
/tools/fold/                        0.212           232.2            0.0000        OVER (TBT)
/tools/form/                        0.197           160.8            0.0000        ok
/tools/garden/                      0.196           202.9            0.0000        OVER (TBT)
/tools/geometry/                    0.238           221.4            0.0000        OVER (TBT)
/tools/kostant/                     0.208           148.0            0.0000        ok
/tools/lab/                         0.255           177.0            0.0000        ok
/tools/mirror/                      0.232           218.8            0.0000        OVER (TBT)
/tools/numbers/                     0.203           193.8            0.0000        ok
/tools/rep/                         0.213           270.3            0.0000        OVER (TBT)
/tools/sandbox/                     0.257           245.7            0.0000        OVER (TBT)
/tools/satake/                      0.338           289.3            0.0000        OVER (TBT)
/tools/symbolic/                    0.211           208.4            0.0000        OVER (TBT)
/tools/weyl/                        0.207           273.6            0.0000        OVER (TBT)
canary (slow fixture, not a route)  3.626           553.7            0.3730        over on LCP, TBT, CLS (as it must be)
lab: 89 routes measured, 20 over threshold, 0 missing or in error
lab: finished in 5710 s
```

The owner accepted gate G3's lab item as machine-bound on 17 October 2026 (TBT 242 to 332 ms on this container); 19 of the 20 routes over lie between 202.8 and 339.8 ms, and /glossary/ (a page with no tool, 83 typeset entries) measures 432.4 ms. Whether the same acceptance holds at G6, and for the glossary, is the owner's.

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

Archives: pages archive: 3288670 bytes, 325 entries, sha256 78588232bc259d02a63c87e441443b586fb33fd4101ac5fe69eced03c53afa05; RELEASE=1 SITE_URL=https://johnjanik.github.io BASE_PATH=/mutation_game/; root archive: 3284259 bytes, 325 entries, sha256 eaa20cd9fdf0c6d3dde0592aed22bfdb637fa82d0680b3fdbeac3dec10cc6700; RELEASE=1 BASE_PATH=/. site/dist holds the last build of the chain, the CI-base preview build (15a); the root release build is the one the lab measured.

## 10. Fragments merged

Every fragment of phase 6 is folded into DECISIONS.md: P6-A1 (with its follow-up), P6-A2, P6-A3, P6-A4, P6-A5, P6-A6, P6-A7, P6-A8, P6-size, P6-tikz, P6-terms, and the MERGE entries (`1265 fragment headings, 0 not in DECISIONS.md`).

## 11. The owner's part

- [ ] Every item of Appendix E not settled earlier, items 1, 4, 5 and 8 first (the open-items report above lists 13 items in use; E8, E11, E12, E14 are used on no page).
- [ ] Accessibility script A-13 on the whole site.
- [ ] Interaction to Next Paint on one phone.
- [ ] One exported LaTeX file of each kind compiled (reports/gate-G6/latex/: dynkin.tex, tikz-graph.tex, tikz-points.tex; the files hold `% needs \usepackage{...}` and a body to \input).
- [ ] Approval of the text of M6 to M10 (M9 and M10 carry the draft mark).
- [ ] The lab item: whether the machine-bound acceptance of G3 holds for the 20 routes over at G6, /glossary/ included.

## 12. Failures, reruns and repairs

- e2e (step 5): T12.spec.ts:1242 for C8 node 7 failed once with a median hydration task of 53 ms (runs 0, 53, 56); it passed in step 15b ([0, 0, 51]). It fails its row. Next: a repair of T12's hydration on its largest boards (the margin under 50 ms that G5 measured is gone since phase 6: ToolFrame's two new buttons and moves prop, and the engine split into more chunks), then the gate rerun after the phase 6 red-team round.
- lab (step 12): 20 routes over TBT; the item fails as measured. The red-team round's performance lens and the owner read section 8.
- No test was skipped beyond the two MathML engines, no timeout was lengthened, no test was retried for this report.
