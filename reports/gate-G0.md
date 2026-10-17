# Gate G0: Foundations

- Phase: 0. Round: build.
- Date: 2026-10-10 15:38 (UTC).
- Gate commit (the tested commit, tagged gate-G0-candidate): d7136545e6e897a58c60e06d200b806394751d92 MERGE: integration fix after P0-A4: JSON import attribute so Node can load astro.config.mjs
- Report commit: the commit that carries this file, above the gate commit; its SHA is in the JSON report.
- Verdict: GREEN
- Release named: none
- Integration branch: `claude/session-6a181f60-hzzoud` stands in for `main` in this cloud build (DECISIONS.md, P0-A1 entry). Nothing is pushed to `main`; the owner merges.

## 1. Preconditions

- `git rev-parse --show-toplevel`: /home/user/mutation_game. `git branch --show-current`: claude/session-6a181f60-hzzoud. `git status --porcelain`: empty.
- `git rev-parse HEAD`: d7136545e6e897a58c60e06d200b806394751d92. Expected commit from the stage 0.3 merge: f7a47c3 plus one integration fix (d713654, below), made after a first gate run on f7a47c3 failed its browser, size and base-path commands with `TypeError: Module ".../site/src/content/unverified.json" needs an import attribute of "type: json"` (Node 22 loading site/astro.config.mjs, which since bedcc94 imports P0-A4's registry). The fix is one import attribute in site/src/lib/unverifiedRegistry.ts, recorded under integration fixes. The first run's logs are kept in reports/gate-G0/run1/.
- `node --version` v22.22.0; `npm --version` 10.9.4; `python3 --version` Python 3.13.16; `npx playwright --version` Version 1.64.0.
- No stale `astro preview`, `playwright` or `vitest` process before the run. reports/gate-G0/ recreated; reports/open-items-report.json, reports/open-items-report.md and reports/numbers-in-prose.md of earlier runs moved to reports/gate-G0/previous/.
- Browser runs used `PLAYWRIGHT_BROWSERS_PATH` pointing at a scratch directory of symlinks to the container's Chromium build 1194 (Playwright 1.64.0 expects build 1248, which this container cannot download). CI installs the expected build with `npx playwright install --with-deps chromium`.

## 2. Reference hashes

```
c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f  reference/golden_data.json
485caee8eb8519697626a72bfafd84fa568834792cc32bdcd90a04b80f864bad  reference/lie_games.py
1fc9f82bf62d9342817820c271f59eec9ca9721530a81adfa17d7a4d08dd384d  reference/verify.py
```

Equal to CONTRACTS.md 9. reference/bench_orbit.mjs is present.

## 3. Installed versions

| package | pinned in | pinned | installed | equal |
|---|---|---|---|---|
| astro | site | 7.3.8 | 7.3.8 | yes |
| @astrojs/mdx | site | 8.0.3 | 8.0.3 | yes |
| svelte | site | 5.57.2 | 5.57.2 | yes |
| @astrojs/svelte | site | 9.0.1 | 9.0.1 | yes |
| typescript | root | 6.0.3 | 6.0.3 | yes |
| nanostores | site | 1.5.5 | 1.5.5 | yes |
| vitest | root | 5.0.3 | 5.0.3 | yes |
| fast-check | packages/engine | 4.10.2 | 4.10.2 | yes |
| @playwright/test | root | 1.64.0 | 1.64.0 | yes |
| @axe-core/playwright | root | 4.13.0 | 4.13.0 | yes |
| @astrojs/check | site | 0.9.10 | 0.9.10 | yes |
| svelte-check | site | 4.7.6 | 4.7.6 | yes |
| katex | site | 0.16.47 | 0.16.47 | yes |
| @astrojs/markdown-remark | site | 7.3.2 | 7.3.2 | yes |
| remark-math | site | 6.0.0 | 6.0.0 | yes |
| rehype-katex | site | 7.0.1 | 7.0.1 | yes |
| @types/node | root | 22.20.5 | 22.20.5 | yes |

node v22.22.0, npm 10.9.4, python3 3.13.16, Playwright 1.64.0.

## 4. Gate table

| item | command(s) | exit | relevant output lines | pass or fail |
|---|---|---|---|---|
| phase 0 golden tests pass for all 32 types (types[*].cartan, types[*].adjacency via cartan, adjacency, boardKind) | `npm test` | 0 | `Test Files  17 passed (17)`; `Tests  460 passed (460)`; packages/engine/test/golden/p0-types-cartan.test.ts and p0-board-kind.test.ts passed; coverage.json keys `["types[*].adjacency","types[*].cartan"]`, missingByPhase[0] `[]`, recomputed missing `[]`; each key covered in exactly one file (p0-types-cartan.test.ts) | pass |
| the index page shows mathematics and the A2 board with JavaScript disabled | `npm run e2e` | 0 | `33 passed (21.6s)`; nojs-phase0.spec.ts: `the board SVG with values renders without JavaScript`, `the caption and the formula's MathML are present`, `controls are disabled and the noscript line is present`, `the island is hydrated with client:idle`, `about and credits render their text without JavaScript`; routes of site/dist: /, /about/, /credits/, /dev/math-check/, all visited by the no-JavaScript or axe specs | pass |
| the keyboard script passes on the board (A-1, A-3, A-4) | `npm run e2e` | 0 | board-keyboard.spec.ts, 19 tests passed, among them `Tab reaches exactly one node button, then the History buttons`, `Right and Left move between the two nodes and stop at the ends`, `Home and End go to the first and last label`, `Enter on city 1 mutates and announces the template string`, `node names follow the A-3 template and update after a move`, `the live region is present and empty before the first move`, `a burst of moves announces only the last state`, `u undoes only while focus is inside the board; r redoes; reset empties the list` | pass |
| the first two limits of SPEC 7.6 hold (15 kB for a page with no tool; 60 kB for the page with one Game Board) | `npm run size` | 0 | `/  one-board  60  200  3  22.1  ok`; `/about/  no-tool  15  200  0  0.0  ok`; `/credits/  no-tool  15  200  0  0.0  ok`; `size: 4 routes measured, 0 over budget` | pass |
| a preview build and a release build both succeed | `npm run build`; `RELEASE=1 npm run build` | 0; 0 | `[build] 4 page(s) built in 3.25s` `[build] Complete!`; `[build] 4 page(s) built in 2.48s` `[build] Complete!`; the release build wrote reports/open-items-report.json (mode release, 17 items, 0 unknown) and reports/open-items-report.md | pass |
| the rendering route is recorded in DECISIONS.md | `grep -n -i "route (a)\|katex 0.16" DECISIONS.md` | 0 | line 163: `Decision: lessons use route (a): remark-math 6.0.0 and rehype-katex 7.0.1 under unified() from @astrojs/markdown-remark 7.3.2 ... KaTeX 0.16.47, pinned exactly in site/package.json` (the P0-A3 entry, folded at stage 0.2) | pass |
| reference file hashes equal CONTRACTS.md section 9 | `sha256sum` (section 2) | 0 | the three lines of section 2 | pass |
| supporting: `npm run verify` | `npm run verify` | 0 | `6649 checks passed, 0 failed, 151.5s`; `verify: regenerated file is byte for byte reference/golden_data.json (455014 bytes)` | pass |
| supporting: `npm run e2e:basepath` | `npm run e2e:basepath` | 0 | `2 passed (9.1s)` (every internal link and asset of the BASE_PATH=/sub/path/ build lives under /sub/path/ and resolves) | pass |
| supporting: axe on the index page | `npm run e2e` | 0 | a11y.spec.ts: `index page has no serious or critical axe violations`, `about page ...`, `credits page ...`, `about and credits fetch no script and carry no data-tool` | pass |
| supporting: `npm run report` | `npm run report` | 0 | `report: open items report of 2026-10-10T15:38:05.063Z: 0 open items used on 0 pages, 0 unknown items`; provenance: mode release, generatedAt 15:38:05.063Z after the release build start 15:38:02Z, no pages listed, markdown beside it | pass |
| supporting: `npm run typecheck` | `npm run typecheck` | 0 | engine tsc clean; `astro check` 0 errors; `svelte-check` 0 errors 0 warnings | pass |

Every roster row passes: GREEN.

## 5. Commands run

Logs in /home/user/mutation_game/reports/gate-G0/ (uncommitted), each ending in `exit=<status>`; the first run on f7a47c3 is in reports/gate-G0/run1/.

| no. | command as typed | start (UTC) | exit | log | summary |
|---|---|---|---|---|---|
| 1 | `npm --prefix /home/user/mutation_game ci` | 15:33:52 | 0 | 01-npm-ci.log | installed from the lockfile |
| 2 | `npm --prefix /home/user/mutation_game test` | 15:34:05 | 0 | 02-npm-test.log | Test Files 17 passed (17); Tests 460 passed (460) |
| 3 | `npm --prefix /home/user/mutation_game run verify` | 15:34:33 | 0 | 03-npm-verify.log | 6649 checks passed, 0 failed, 151.5s; byte for byte |
| 4 | `npm --prefix /home/user/mutation_game run build` | 15:37:05 | 0 | 04-build.log | 4 page(s) built; Complete! |
| 5 | `npm --prefix /home/user/mutation_game run e2e` | 15:37:11 | 0 | 05-e2e.log | 33 passed (21.6s) |
| 6 | `npm --prefix /home/user/mutation_game run size` | 15:37:36 | 0 | 06-size.log | 4 routes measured, 0 over budget |
| 7 | `npm --prefix /home/user/mutation_game run e2e:basepath` | 15:37:46 | 0 | 07-e2e-basepath.log | 2 passed (9.1s) |
| 8 | `RELEASE=1 npm --prefix /home/user/mutation_game run build` | 15:38:02 | 0 | 08-release-build.log | 4 page(s) built; Complete!; report files written |
| 9 | `npm --prefix /home/user/mutation_game run report` | 15:38:07 | 0 | 09-report.log | report: open items report of 2026-10-10T15:38:05.063Z |
| 10 | `npm --prefix /home/user/mutation_game run typecheck` | 15:38:10 | 0 | 10-typecheck.log | 0 errors |

No skipped, todo or flaky test in either runner. No report file existed under reports/ after `npm test` (step 2).

## 6. Golden coverage

Phase 0 required keys: `types[*].cartan`, `types[*].adjacency`. Present in coverage.json: both. Missing: none. The harness table in packages/engine/test/golden/_harness.ts spells both keys as the plan does. One-file rule: each key is registered by p0-types-cartan.test.ts only.

## 7. Sizes

```
route             label      limit (kB, 1 kB = 1000 bytes)  status  scripts  gzip (kB)  result
/                 one-board  60                             200     3        22.1       ok
/about/           no-tool    15                             200     0        0.0        ok
/credits/         no-tool    15                             200     0        0.0        ok
/dev/math-check/  no-tool    15                             200     0        0.0        ok
size: 4 routes measured, 0 over budget
```

Every route of site/dist appears in the table.

## 8. Lab timings

Not required at this gate.

## 9. Release build, reports and archives

Preview build: `4 page(s) built in 3.25s`, `Complete!`. Release build (RELEASE=1, SITE_URL and BASE_PATH unset): `4 page(s) built in 2.48s`, `Complete!`; no `open item` line (no page uses `<Unverified>` yet); reports/open-items-report.json with mode `release`, 17 items, 0 unknown, generated 2026-10-10T15:38:05.063Z, and reports/open-items-report.md beside it (every item E1 to E17 open with no pages). reports/numbers-in-prose.md written by `npm run report` (no lesson files yet). No archive at this gate. site/dist holds the release build.

## 10. Fragments merged and decisions recorded during the phase

Merge commits since the root commit: 6365a13 P0-A2, d71ca9c P0-A3, 4c88347 P0-A6 (stage 0.2); 8db2a9d P0-A4, 55b0dc4 P0-A5 (stage 0.3). Fragments written: decisions/P0-A1.md, P0-A2.md, P0-A3.md, P0-A4.md, P0-A5.md, P0-A6.md, MERGE.md; every one is folded into DECISIONS.md under the stage headings "2026-10-10 MERGE: P0 stage 0.2" and "2026-10-10 MERGE: P0 stage 0.3". Defaults of section 10 recorded: D1 (working title), D3 (Astro with Svelte), D4 (AGPL-3.0-only for code by the owner; CC BY-SA 4.0 for content by default), D17 (noted open), D18 (no preview deployment). Dependencies recorded: @astrojs/check 0.9.10, svelte-check 4.7.6, @types/node 22.20.5 (build only); katex 0.16.47 (shipped: CSS 3.5 kB gzip and fonts on demand), rehype-katex 7.0.1, remark-math 6.0.0, @astrojs/markdown-remark 7.3.2 (build only).

Integration fixes by MERGE during the phase: b5dfe9b (scaffold test for the engine's re-export index), bedcc94 (openItemsReportIntegration wired into astro.config.mjs), d713654 (JSON import attribute).

## 11. Owner's part

Due before the first release (0.5, after G3); never blocks the next phase (SPEC 9.1).

- [ ] Enable GitHub Pages on github.com/johnjanik/mutation_game and set the repository variable DEPLOY_PAGES, then run deploy.yml once by hand (SPEC 7.8, 10; until then the build uses the defaults of 7.2 item 10 and the deploy job is skipped).
- [ ] Confirm the content licence (D4, CC BY-SA 4.0 default; the code licence is AGPL-3.0 by the owner's choice) (SPEC 7.9, 10).
- [ ] Answer or accept the defaults for D1 (name), D3 (framework), D17 (who writes the lessons) (SPEC 10).

## 12. Notes

- First gate run on f7a47c3: `npm run e2e`, `npm run size` and `npm run e2e:basepath` failed before any test ran, with the JSON import attribute error above (an integration-level failure of two correct branches, repaired by d713654). The rerun is the proof; the first run is diagnostic only.
- Design questions passed to the orchestrator by MERGE (decisions/MERGE.md): the phase-0 name of the C2 matrix from fromAdjacency; boardKind([]); whether /dev/ pages stay out of release builds; whether route (a) formula errors should fail the build; size classifier cases outside the 7.6 table; the trailing 500 ms announcement window for a lone move; 36-pixel strip buttons.
- Leads for the red team: RT-12 should confirm the GitHub action major tags of the three workflows (taken from memory, not read from GitHub); RT-07 the 22.1 kB index page; RT-05 the strip buttons below 44 pixels.
- The red team of phase 0 was not run in this build (budget); its lenses are listed in rosters/phase-0.json for a later round.
