# Gate G1: The two moves

- Phase: 1. Round: build.
- Date: 2026-10-10 18:14 (UTC).
- Gate commit (the tested commit, tagged gate-G1-candidate): 47bf8c43ff9f96277a0351ab7b5079c78be70f5a MERGE: integration fix after P1-A4 and the lessons: the module index test accepts the released modules
- Report commit: the commit that carries this file, above the gate commit; its SHA is in the JSON report.
- Verdict: GREEN
- Release named: none
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` (DECISIONS.md, P0-A1 entry).

## 1. Preconditions

- `git rev-parse --show-toplevel`: /home/user/mutation_game. Branch claude/session-6a181f60-hzzoud. `git status --porcelain`: empty. Node v22.22.0, npm 10.9.4, python3 3.13.16, Playwright 1.64.0.
- Expected commit from the stage 1.3 merge: 1140392. Two earlier gate runs on 1140392 are kept under reports/gate-G1/run2-1140392/ (and run1-tmpdir/): the first failed every browser command before any test ran because Chromium crashed at launch with `TMPDIR` pointed at the scratchpad (an environment failure, repaired by using the default temp directory); the second, repaired, run passed everything except two assertions of site/tests/e2e/pages.spec.ts that expected the module index to say "No module is published yet.", written in stage 1.1 before M0 and M1 existed. MERGE fixed that test to accept the released modules (47bf8c4), and the whole chain was rerun on 47bf8c4, the tested commit.
- reports/gate-G1/ recreated; earlier run-time reports moved to reports/gate-G1/previous/. Browser runs used `PLAYWRIGHT_BROWSERS_PATH` pointing at a scratch directory of symlinks to the container's Chromium build 1194 (Playwright 1.64.0 expects 1248; CI installs it).

## 2. Reference hashes

```
c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f  reference/golden_data.json
485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad  reference/lie_games.py
1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d  reference/verify.py
```

Equal to CONTRACTS.md 9.

## 3. Installed versions

Every pinned package (the ten of SPEC 7.1, @astrojs/check 0.9.10, svelte-check 4.7.6, katex 0.16.47, @astrojs/markdown-remark 7.3.2, remark-math 6.0.0, rehype-katex 7.0.1, @types/node 22.20.5) is installed at its pinned version; the table of reports/gate-G0.md section 3 holds unchanged. No dependency was added in phase 1.

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| phase 0 and phase 1 golden tests pass (table of SPEC 5.7) | `npm test` | 0 | `Test Files  54 passed (54)`; `Tests  1307 passed (1307)`; packages/engine/test/golden/p0-types-cartan, p0-board-kind, p1-types-roots, p1-types-rho-game, p1-kostant, p1-one-way, p1-layer-growth, p1-bigint all passed; coverage.json: phase 0 missing `[]`, phase 1 missing `[]` (22 keys registered, recomputed against the table of SPEC 5.7 in the plan's spellings); each key in exactly one file | pass |
| property tests 1, 2, 3, 4, 6, 7 (first half), 8 pass | `npm test` | 0 | files p1-involution, p2-translator, p3-transpose, p4-orders, p6-convergence, p7-roots-signs, p8-generic-game present and passed (seed 20261010 recorded in each) | pass |
| acceptance of T1, T2, T9 (the phase-1 parts) as automated tests | `npm test`; `npm run e2e` | 0; 0 | site/tests/unit/tools/T01.test.ts (38), T02.test.ts (25), T09.test.ts (19) passed; site/tests/e2e/T01.spec.ts 44 passed, T02.spec.ts 20 passed, T09.spec.ts 16 passed; `213 passed (2.9m)`, no failed, flaky or skipped test | pass |
| the run without JavaScript passes on M0, M1, the tool routes and the pages | `npm run e2e` | 0 | nojs.spec.ts: 15 passed, one per route of site/dist (about, credits, dev/lesson-check, dev/math-check, glossary, index, modules, modules/m0-start, modules/m1-mutation, open-items, sources, tools/board, tools/garden, tools/kostant) plus the worker-on-demand companion; routes of site/dist not visited: none | pass |
| axe scan: no serious or critical violations on every page and tool route | `npm run e2e` | 0 | a11y.spec.ts: 15 passed, every route of site/dist discovered and scanned after hydration; routes not scanned: none; also M0.spec.ts, M1.spec.ts, T01, T02, T09 axe tests passed | pass |
| the size limits of SPEC 7.6 hold on every route | `npm run size` | 0 | `size: 14 routes measured, 0 over budget`; table in section 7; every route of site/dist has a row | pass |
| reference file hashes unchanged | sha256sum (section 2) | 0 | the three lines of section 2 | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 142.2s`; `verify: regenerated file is byte for byte reference/golden_data.json (455014 bytes)` | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `2 passed (16.8s)` | pass |
| supporting: `npm run build`, `RELEASE=1 npm run build`, `npm run report` | the three commands | 0; 0; 0 | preview build 14 pages; release build 13 pages (no open-items route), `open item E4 used on /modules/m1-mutation/ (fallback shown)`; `report: open items report of 2026-10-10T18:13:15.483Z: 1 open items used on 1 pages, 0 unknown items`; provenance: mode release, generated after the release build start 18:13:06Z, the one page listed is a route of site/dist | pass |
| supporting: `npm run typecheck` | `npm run typecheck` | 0 | engine tsc clean; `astro check` 0 errors; `svelte-check` 0 errors | pass |

Every roster row passes: GREEN.

## 5. Commands run

Logs in /home/user/mutation_game/reports/gate-G1/ (uncommitted), each ending in `exit=<status>`; earlier runs in run1-tmpdir/ and run2-1140392/.

| no. | command as typed | exit | log | summary |
|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 0 | 02-npm-test.log | Test Files 54 passed; Tests 1307 passed |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 0 | 03-npm-verify.log | 6649 checks, byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 0 | 04-build.log | 14 pages |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 0 | 05-e2e.log | 213 passed (2.9m) |
| 6 | `npm --prefix /home/user/mutation_game run size` | 0 | 06-size.log | 14 routes, 0 over budget |
| 7 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 0 | 07-e2e-basepath.log | 2 passed |
| 8 | `RELEASE=1 npm --prefix /home/user/mutation_game run build` | 0 | 08-release-build.log | 13 pages; report files written |
| 9 | `npm --prefix /home/user/mutation_game run report` | 0 | 09-report.log | 1 open item on 1 page |
| 10 | `npm --prefix /home/user/mutation_game run typecheck` | 0 | 10-typecheck.log | 0 errors |

No skipped, todo or flaky test in either runner.

## 6. Golden coverage

Phase 0: types[*].cartan, types[*].adjacency. Phase 1: the twenty keys of SPEC 5.7 (types[*].n_roots ... types[*].minuscule_nodes, kostant[*].end_from_node, kostant[*].moves_from_node, kostant[*].final_numbers_from_node, one_way_counterexample, layer_growth_examples, bigint_test). All 22 present in coverage.json; missing none; each registered by exactly one golden test file.

## 7. Sizes

```
route                  label      limit (kB, 1 kB = 1000 bytes)  status  scripts  gzip (kB)  result
/                      one-board  60                             200     7        34.5       ok
/about/                no-tool    15                             200     0        0.0        ok
/credits/              no-tool    15                             200     0        0.0        ok
/dev/lesson-check/     tool       90                             200     0        0.0        ok
/dev/math-check/       no-tool    15                             200     0        0.0        ok
/glossary/             no-tool    15                             200     0        0.0        ok
/modules/              lesson     120                            200     0        0.0        ok
/modules/m0-start/     lesson     120                            200     11       57.4       ok
/modules/m1-mutation/  lesson     120                            200     11       57.4       ok
/open-items/           no-tool    15                             200     0        0.0        ok
/sources/              no-tool    15                             200     0        0.0        ok
/tools/board/          tool       90                             200     11       57.4       ok
/tools/garden/         tool       90                             200     9        54.6       ok
/tools/kostant/        tool       90                             200     10       58.3       ok
size: 14 routes measured, 0 over budget
```

## 8. Lab timings

Not required at this gate.

## 9. Release build, reports and archives

Release build (RELEASE=1, SITE_URL and BASE_PATH unset): 13 pages, `open item E4 used on /modules/m1-mutation/ (fallback shown)`; reports/open-items-report.json mode release, 17 items, E4 used on /modules/m1-mutation/, 0 unknown; reports/open-items-report.md beside it; reports/numbers-in-prose.md written (no prose number outside <G> or <Tex> in M0 or M1). No archive at this gate. site/dist holds the release build.

## 10. Fragments merged and decisions recorded during the phase

Merge commits since gate-G0-candidate: P1-A1, P1-A2, P1-A3, P1-A4 (stage 1.1), P1-A5, P1-A6, P1-A7 (stage 1.2), P1-A8, P1-A9 (stage 1.3). Fragments decisions/P1-A1.md to P1-A9.md and MERGE.md, all folded into DECISIONS.md under the headings "2026-10-10 MERGE: P1 stage 1.1", "1.2" and "1.3". No new dependency. Design decisions by the orchestrator recorded there: the theme switch as a plain button with an inline script (15 kB budget); LONG_LIST_REPLAY kept at the contract reading. Integration fixes by MERGE: c519b2c, cc63e1d, the stage 1.1 fix commit, b627e81, 2b3a189, cff0050, be76b92, 47bf8c4.

## 11. Owner's part

Due before release 0.5 (after G3); never blocks the next phase (SPEC 9.1).

- [ ] A first reading of M0 and M1 by two readers of the primary audience (SPEC 9.1, the row of phase 1; D2 and D17 of section 10). Both modules carry the draft mark until the owner approves them (D17, due at G3).

## 12. Notes

- The two earlier runs on 1140392 (section 1): run 1 was an environment failure (Chromium SIGTRAP at launch under a scratchpad TMPDIR); run 2 found the stale module-index assertion of pages.spec.ts. Neither is cited as proof; the run on 47bf8c4 is.
- Leads for the red team: RT-05 the T2 layer chart (made focusable at merge) and the 36-pixel history strip buttons; RT-08 the numbers-in-prose scanner skipping lines after an apostrophe inside an MDX comment (m0-start.mdx); RT-10 the T9 tool built beside T1 rather than on T01GameBoard; RT-04 the long-move-list replay on the main thread under the 'sync' reading.
- The red team of phase 1 was not run in this build (budget).
