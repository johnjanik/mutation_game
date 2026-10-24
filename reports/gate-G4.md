# Gate G4: Multiple edges and geometry

- Phase: 4. Round: build, after red-team round 1 over phases 0 to 3 and its fixes.
- Date: 2026-10-24 09:10 to 09:32 (UTC).
- Gate commit (the tested commit, tagged gate-G4-candidate): b9b8504c1b893dc73a25b46fe62382d59eb9cdf1 MERGE: red-team round 1 residual fixes, fragments folded
- Report commit: the commit that carries this file, above the gate commit.
- Verdict: RED (one roster item: the lab timings on M6 and M7, Total Blocking Time 252.3 and 381.3 ms against 200 ms; every other roster item and every supporting row passes).
- Release named: none (G4 names no release; the next release is 1.0 at G6). No release build ran, as GATE.md 5.5 step 7 prescribes for G4.
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).

## 1. Preconditions

- The phase's last MERGE finished: P4 waves 4.1 to 4.5 merged (DECISIONS.md, "MERGE: P4 wave 4.5"); red-team round 1 groups A, B, the deferred round and the residual fixes merged and recorded (DECISIONS.md, the four "MERGE: red-team round 1" entries of 2026-10-17 and 2026-10-24).
- Nothing else ran on the machine during the chain: no agent, no preview server, no test run (load average 0.38 at the start, 1.14 when the lab started, 1.56 before the benchmarks).
- Stale Vite SSR caches under /tmp were removed before the chain; earlier open-items and numbers reports were moved to reports/gate-G4/previous/ (00-moves.log).
- `git status --porcelain` was empty after the build (status-after-build.log) and after the chain.

## 2. Reference hashes

Recomputed with sha256sum (13-reference-sha256.log) and compared with CONTRACTS.md 9:

| file | sha256 | CONTRACTS.md 9 |
|---|---|---|
| reference/golden_data.json | c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f | equal |
| reference/lie_games.py | 485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad | equal |
| reference/verify.py | 1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d | equal |

`git diff --stat 76b502f HEAD -- reference/` (the G3 gate commit to this one) is empty.

## 3. Installed versions

Node v22.22.0; npm ci from the committed lockfile. astro 7.3.8, svelte 5.57.2, @astrojs/svelte 9.0.1, @astrojs/mdx 8.0.3, typescript 6.0.3, vitest 5.0.3, fast-check 4.10.2, @playwright/test 1.64.0 with Chromium (WebKit and Firefox cannot be installed in this container), @lhci/cli 0.15.1 with Lighthouse 12.6.1 on Chromium 141.0.7390.37.

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| golden tests through phase 4 pass | `npm test` | 0 | `Test Files  135 passed (135)`; `Tests  3022 passed (3022)`. The engine project's teardown gate (RT-FIX P3-RT-11-03, wired and tested by the residual fix) fails the run when any golden key of a phase up to 4 has no test; the run passed, with 49 keys registered (coverage-after-npm-test.json), among them folding, e8, e8.h4_projection, coxeter_plane_types_with_coincident_points and the wythoff keys. `npm run verify` regenerates the golden file byte for byte (supporting row) | pass |
| property test 11 passing | `npm test` | 0 | packages/engine/test/properties/p11-folding.test.ts present (beside p1 to p8, p10, p12, p13); all 135 files passed; diagnostic per-file count: `p11-folding.test.ts passed 3/3` (diag-vitest-files.json) | pass |
| acceptance of T10 and T11 as automated tests | `npm test`; `npm run e2e` | 0; 0 | site/tests/unit/tools/T10.test.ts and T11.test.ts passed within the 135 files (diagnostic counts 33/33 and 32/32); site/tests/e2e/T10.spec.ts 27 passed and T11.spec.ts 23 passed in the e2e run, none failed or skipped | pass |
| the drawing-time test of SPEC 7.6 for the E8 picture (under 100 ms on the CI runner) | `npm run e2e` | 0 | `✓ draw-time.spec.ts:26:1 › the E8 root set with 6720 edges draws in the Coxeter plane in under 100 ms`; `E8 drawing time: median 14.6 ms of 5 (25.4, 14.6, 15.5, 9.4, 9 ms), first 25.4 ms, dpr 1` | pass |
| lab timings on M6 and M7 | `npm run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/` | 1 | `/modules/m6-multiple-edges/  1.418  252.3  0.0003  OVER (TBT)`; `/modules/m7-geometry/  2.203  381.3  0.0000  OVER (TBT)`; canary over on all three as it must be; throttling checks ok (section 8) | fail |
| no-JavaScript run (including the SVG snapshot of T10), axe, sizes; T10 preset data files at most 30 kB compressed each; reference hashes unchanged | `npm run e2e`; `npm run size`; the gzip one-liner; sha256sum | 0; 0; 0; 0 | nojs.spec.ts: `every route renders without JavaScript` passed on all 32 routes of site/dist (the route list equals `find site/dist -name index.html`), with the default-state comparison of RT-FIX P3-RT-06-03; `✓ T10.spec.ts:397:3 › without JavaScript › the default projection ships as an SVG snapshot without JavaScript`; a11y.spec.ts 33 passed (no serious or critical violation on any route); `size: 32 routes measured, 0 over budget` (section 7); `presets-size.test.ts > every preset file and the manifest gzip to at most 30 kB` passed, and measured independently the largest file is 8088 B (E8), all below 30000 (section 7); hashes equal (section 2) | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 131.5s`; `verify: regenerated file is byte for byte reference/golden_data.json (455014 bytes)` | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `33 passed (33.8s)` (one test per route since RT-FIX P3-RT-12-04) | pass |
| supporting: the benchmark | `npm run bench -w packages/engine` (alone, after the browser runs) | 0 | `orbit benchmark: median 12.61 ms of 7 runs [...] threshold 25 ms, 2000 positions, truncated true` | pass |
| supporting: `npm run bench`, `npm run build`, `npm run typecheck` | the three commands | 0; 0; 0 | root bench: engine 3 files and site timing 2 files passed (`T4 load path ... median 10.97 ms`); build 32 pages, links.mjs 0 problems; typecheck `0 errors`, 1 hint (T06.spec.ts unused parameter, there since phase 3) | pass |

## 5. Commands run

Logs in reports/gate-G4/ (not committed; reports/* is ignored except the gate reports).

| no. | command as typed | exit | log | summary |
|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log | Test Files 135 passed; Tests 3022 passed |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log | 6649 checks, byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log | 32 pages; 0 link problems |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log | 891 passed, 2 skipped (MathML on WebKit and Firefox) (11.7m) |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log | 32 routes, 0 over budget |
| 6b | the gzip one-liner of GATE.md section 8 (Sizes) on site/public/presets/T10/ | 0 | 06b-presets-gzip.log | 8 files, largest 8088 B |
| 7 | `npm --prefix /home/user/mutation_game run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/` | 1 | 07-lab.log | 2 routes, 2 over threshold (TBT) |
| 8 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 08-e2e-basepath.log | 33 passed |
| 9 | `npm --prefix /home/user/mutation_game run report` | 1 | 09-report.log | expected at G4: `report: no release build report found at reports/open-items-report.json; run RELEASE=1 npm run build first`; reports/numbers-in-prose.md written (0 numbers in prose, 5 in fallbacks) |
| 10 | `npm --prefix /home/user/mutation_game run bench -w packages/engine` | 0 | 10-bench.log | median 12.61 ms |
| 11 | `npm --prefix /home/user/mutation_game run bench` | 0 | 11-bench-root.log | engine bench and the site timing files passed |
| 12 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 12-typecheck.log | 0 errors |
| diag | `npx vitest run <p11, T10, T11, presets-size> --reporter=json` | 0 | diag-vitest-files.json | per-file counts quoted in section 4; not a gate command |

## 6. Golden coverage

The engine project's teardown (packages/engine/test/golden/_coverage.setup.ts) now enforces SPEC 5.7 at every run: it reads the phase in force from the tool registry (4) and fails the run when a golden key of a phase at or below it has no test calling covers(). `npm test` passed, so no key through phase 4 is missing; 49 keys were registered. The wiring is guarded by packages/engine/test/unit/coverage-gate.test.ts (a child run without p3a-e8.test.ts must fail naming e8).

## 7. Sizes

`npm run size` (06-size.log), limits per route in kB of 1000 bytes, gzip of the scripts each route fetches:

| route | label | limit | gzip (kB) |
|---|---|---|---|
| / | one-board | 60 | 46.7 |
| /dev/draw-time/ | tool | 90 | 41.1 |
| /modules/m0-start/, m1-mutation, m2-form, m4-numbers, m5-weyl, m6-multiple-edges | lesson | 120 | 73.0 each |
| /modules/m3-classification/ | lesson | 120 | 69.3 |
| /modules/m7-geometry/ | lesson | 120 | 82.4 |
| /tools/affine/ | tool | 90 | 75.5 |
| /tools/board/ | tool | 90 | 73.0 |
| /tools/fold/ | tool | 90 | 74.4 |
| /tools/form/ | tool | 90 | 73.1 |
| /tools/garden/ | tool | 90 | 69.6 |
| /tools/geometry/ | tool | 90 | 82.4 |
| /tools/kostant/ | tool | 90 | 71.9 |
| /tools/lab/ | tool | 90 | 69.3 |
| /tools/mirror/ | tool | 90 | 74.8 |
| /tools/numbers/ | tool | 90 | 79.1 |
| /tools/sandbox/ | tool | 90 | 82.4 |
| /tools/symbolic/ | tool | 90 | 71.9 |
| /tools/weyl/ | tool | 90 | 78.9 |
| /about/, /credits/, /dev/math-check/, /glossary/, /modules/, /open-items/, /open-problem/, /sources/ | no-tool | 15 | 0.0 each |
| /dev/lesson-check/ | tool | 90 | 0.0 |

`size: 32 routes measured, 0 over budget`. Since RT-FIX P3-RT-07-05 the module index /modules/ is a page with no tool (15 kB). /tools/geometry/ went from 89.2 kB at wave 4.4 to 82.4 kB after RT-FIX P3-RT-07-04 (no tool route carries another tool's presets).

T10 preset files, gzip level 9 (06b-presets-gzip.log), bytes: A2-r1.1.json 270; A3-r1.0.0.json 246; A3-r1.0.1.json 337; B3-r0.1.1.json 451; B3-r1.0.1.json 460; D4-r0.1.0.0.json 520; E8-r0.0.0.0.0.0.0.1.json 8088; index.json 349. All at most 30000.

## 8. Lab timings

`npm run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/` on the preview build of step 4 (07-lab.log): Lighthouse CI 0.15.1 (Lighthouse 12.6.1) on Chromium 141.0.7390.37; profile 360x800, CPU slowdown 4x through the DevTools protocol, network not throttled; 3 runs per route, median per metric; the processor check confirmed devtools throttling at 4x and the 360x800 screen in all 7 reports.

| route | LCP (at most 2.5 s) | TBT (at most 200 ms) | CLS (at most 0.1) | status |
|---|---|---|---|---|
| /modules/m6-multiple-edges/ | 1.418 | 252.3 | 0.0003 | over (TBT) |
| /modules/m7-geometry/ | 2.203 | 381.3 | 0.0000 | over (TBT) |
| canary (slow fixture) | 3.634 | 555.0 | 0.3730 | over on all three, as it must be |

The item fails on Total Blocking Time; LCP and CLS pass on both lessons. The machine was quiet (load average 1.14 at the start). For comparison, the owner accepted the G3 lab item as machine-bound on 2026-10-17, with Total Blocking Time 242 to 332 ms on M0 to M5 on this container (DECISIONS.md, "OWNER: gate G3's lab item accepted as machine-bound"). M6 at 252.3 ms falls inside that range; M7 at 381.3 ms is above it. M7 carries thirteen T10 instances; the 12-node load fix of round 1 showed that on this container the hydration of one tool is a single task of 60 to 100 ms even with little engine work, so M7's figure is likely hydration of the instances near the first screen. Whether M7 can be brought under 200 ms by deferring work at load is sent to the phase 4 red-team round (RT-07) and its fixes; the gate is rerun after them.

## 9. Release build and reports

No release build at G4 (GATE.md 5.5 step 7). `npm run report` exited 1 with the expected message, and reports/numbers-in-prose.md was written: 0 numbers in prose and 0 inside formulas in the 8 lesson files; 5 numbers in the fallbacks of <Unverified> (a section added by the residual content fix): M3 line 112 ('rank at most 8', '2500', and 8 again, with the word 'ten'), and M4 line 109 ('1990', a year, not a golden value). The M3 fallback is carried to a polish pass (DECISIONS.md, "MERGE: red-team round 1, residual fixes").

## 10. Fragments merged and decisions recorded during the phase

Phase 4: P4-A1 to P4-A6 and P4-X2, waves 4.1 to 4.5 (DECISIONS.md, the "MERGE: P4 wave" entries). Red-team round 1: decisions/RT-FIX-P3-*.md for 25 clusters and the residual fixes, folded with four MERGE entries; P3-RT-10-02 fixed by MERGE (the dependency records). The phase 3 round's retest is folded into the phase 4 red-team round (task list; to be recorded with that round).

## 11. Owner's part

Due before release 1.0; never blocks the next phase (SPEC 9.1).

- [ ] The E8 picture tried on one mid-range phone (SPEC 7.6: the E8 root set, its Coxeter projection and 6720 edges draw in under 100 ms on the phone; /dev/draw-time/ shows the timing; 9.1).
- [ ] Appendix E item 7 (SPEC Appendix E; used on /modules/m7-geometry/, open, nothing shown in a release build).
- [ ] Appendix E item 9 (SPEC Appendix E; used on /modules/m7-geometry/, open, fallback shown in a release build).

Decisions the owner holds from red-team round 1 (DECISIONS.md, the round 1 MERGE entries): P3-RT-01-01 (the return type of symbolicPlay off the finite types), P3-RT-05-06 (polygon radius 133 against 130 at a width of 320), P3-RT-13-01 (eleven predictions on M0 to M5 show their answer before the reader commits; four questions), P3-RT-11-09 (four engine functions committed before their tests), P3-RT-07-03 (the index page fetches the whole engine chunk, 15081 B gzip), the module-link order of SPEC 8.2 item 7 against 4 (T16) and 8.1 P6, and SOURCES.md keys [RV16], [RV21] and [CPS22]. The G4 lab item (section 8).

## 12. Notes

- The e2e run had no failure and no retry: 891 passed, 2 skipped. Two timing tests that failed under load during the fix round (T10 'no long task', T08 'picking F4') passed here on a quiet machine.
- The site timing run (`npm run bench`, second stage) loaded again only after MERGE's fix e604f98 (the toolchain fix had removed the aliases the timing configuration copied).
- The P3 red-team round's retest is to run inside the phase 4 red-team round: each lens attacks its round 1 fixed areas first, then the phase 4 tools and lessons.
