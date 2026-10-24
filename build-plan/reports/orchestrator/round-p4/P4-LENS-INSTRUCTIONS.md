# Red-team lens, phase 4 round (Two Games build)

You are one red-team lens attacking the Two Games build at commit b9b8504c1b893dc73a25b46fe62382d59eb9cdf1 (tagged gate-G4-candidate; gate G4's report is reports/gate-G4.md). Phase scope: phases 0 to 4. This round also carries the RETEST of round 1 (which ran over phases 0 to 3 at the G3 commit): your prompt lists the areas where your lens's round 1 findings were fixed; attack those first, then run the rest of your lens's attack list for phases 0 to 4.

## Environment (the plan was written for the owner's Mac; these notes override it)

- Repository root: /home/user/mutation_game. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and /home/user/mutation_game for files you only read). Wherever it says main, read the integration branch claude/session-6a181f60-hzzoud, which may move while you work: you attack b9b8504 only. Never check out the integration branch, never commit to it, never push.
- FIRST, in your fresh worktree: `git reset --hard b9b8504c1b893dc73a25b46fe62382d59eb9cdf1` (your branch must start exactly there; confirm with git log -1), then `npm ci --prefer-offline` once. Never npm install. Confirm your branch name with `git branch --show-current` and report it.
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13 (reference/verify.py runs from reference/; Python scripts that import lie_games run without -I). Two other agents work at the same time: use only your own scratch directory /tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/<your lens id, lower case>-p4/ and only your own four ports (named in your prompt).
- Browsers: only Chromium is installed. Every Playwright or Lighthouse run needs PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/pw-browsers in its environment. Never run playwright install. Never set TMPDIR for Playwright. WebKit and Firefox cannot be installed here (network policy).
- Preview servers: never use port 4321 and never pkill broadly. For browser runs copy playwright.config.ts to your scratch directory with the webServer command `node node_modules/astro/bin/astro.mjs preview --port <your first port> --ignore-lock` run in site/ (or ../node_modules/astro/bin/astro.mjs if site/node_modules has no astro) and baseURL on that port, and run `npx playwright test -c <your copy> <spec>`; stop your server with `pkill -f "port <your first port>"`. npm run size takes `-- --port <second port>`; npm run lab takes `-- --port <third port>`.
- If site unit tests fail with "Cannot read properties of undefined (reading Symbol(filename))", that is a stale Vite SSR cache under /tmp/two-games-ssr-test-cache-*: run vitest with TMPDIR set to a fresh directory inside your scratch directory (vitest only).
- The machine is shared, so timing measurements are noisy: check uptime, measure when the load is low, and repeat a timing result before reporting it.
- Shell commands: absolute paths, no `cd` chains, no multi-line inline scripts (write a script file in your scratch directory and run it).
- Last step before your final message: commit your reproducers on your branch, then delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree, stop your preview server, and confirm `git status --porcelain` is empty.

## Known and decided, so not findings by themselves

Cite them if you think one breaks SPEC.md anyway.

- The integration branch claude/session-6a181f60-hzzoud stands in for main (DECISIONS.md, P0-A1 entry).
- Lab timings: the owner accepted gate G3's lab item as machine-bound on 17 October 2026 (Total Blocking Time 242 to 332 ms on M0 to M5 on this container; DECISIONS.md, "OWNER: gate G3's lab item"). Gate G4 measured M6 at 252.3 ms and M7 at 381.3 ms (reports/gate-G4.md section 8), sent to this round. A lab number on M0 to M6 in the G3 range is not a finding; M7's number, a regression, a wrong measurement method or another budget is.
- WebKit and Firefox are not installable here; site/tests/e2e/mathml.spec.ts skips them (MERGE stage 3.2 entry; RT-FIX P3-RT-12-03 kept the skip).
- Decisions the owner holds (DECISIONS.md, the "MERGE: red-team round 1" entries): P3-RT-01-01 (symbolicPlay's return type off the finite types), P3-RT-05-06 (polygon radius 133 against 130), P3-RT-13-01 (predictions whose answer shows in the prose or caption before the reader commits), P3-RT-11-09 (commit order), P3-RT-07-03 (the engine chunk on the index page), the module-link order of SPEC 8.2 item 7, and SOURCES.md keys [RV16], [RV21], [CPS22]. Do not report these again unless you find something new about them.
- The build agents' JSON reports were not committed; what they claimed is in decisions/<agent>.md, decisions/RT-FIX-P3-*.md and the MERGE entries of DECISIONS.md, with every accepted deviation listed there. The gate reports are reports/gate-G0.md to gate-G4.md. The round 1 findings, with their reproducers, are in /home/user/mutation_game/build-plan/reports/orchestrator/round1/ (round1-confirmed-A.json, round1-confirmed-B.json, round1-deferred.json, reproducers/).

## What to do

Read /home/user/mutation_game/build-plan/RED-TEAM-COMMON.md, /home/user/mutation_game/build-plan/CONTRACTS.md and your lens file /home/user/mutation_game/build-plan/red-team/<your lens file>, and follow the lens file completely for every attack that applies to phases 0 to 4 (its "Scope by phase": earlier items stay in scope). For the retest areas: rerun your round 1 reproducers (copies under the round1/reproducers directory) against b9b8504, then attack around each fix (the fix's own edges, its siblings, and what it may have broken).

Commit every reproducer on your branch (new files only, named redteam-<lens id>-*; never modify an existing test). Each finding must be reproducible from a clean checkout of b9b8504 plus your reproducer file, by the exact command you give.

## Your final message

Only the JSON of RED-TEAM-COMMON.md section 5, nothing else: {"lens", "phase": 4, "gateCommit": "b9b8504c1b893dc73a25b46fe62382d59eb9cdf1", "branch", "coverage": [...], "findings": [{"id": "P4-<lens id>-NN", "severity", "title", "location", "claim", "expected", "observed", "reproduction", "specRef", "proposedFix", "reproducer"}], "notes": [...]}. In coverage, give one line per round 1 finding of your lens saying whether its fix holds (the retest), then the rest of your coverage.
