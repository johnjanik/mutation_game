# RT-FIX, phase 4 round (Two Games build)

You fix one cluster of confirmed findings of the phase 4 red-team round. You are in a fresh git worktree on your own branch; report its name exactly as `git branch --show-current` prints it.

## Environment (the plan was written for the owner's Mac; these notes override it)

- Repository root: /home/user/mutation_game. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and /home/user/mutation_game for files you only read). Wherever it says main, read the integration branch claude/session-6a181f60-hzzoud: never check it out, never commit to it, never push.
- FIRST, in your fresh worktree: `git reset --hard <base>` (the integration head named in your prompt; it holds the gate commit b9b8504 plus every round 1 fix and the round's records), then `npm ci --prefer-offline` once. Never npm install. The findings were made at b9b8504; the files they name are unchanged between b9b8504 and your base except build-plan/reports/ and DECISIONS.md.
- The lens branches named in the findings (`branch` field) are local branches of this repository: `git show <branch>:<path>` reads a reproducer; `git checkout <branch> -- <path>` brings one in (then rename it, section 5.3 of RT-FIX.md: no file named redteam-* stays on your branch).
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13 (reference/verify.py runs from reference/; Python scripts that import lie_games run without -I). Other agents work at the same time: use only your own scratch directory /tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/<your who>/ and only your own four ports (named in your prompt). Chromium refuses ports 5060, 5061, 6000, 6665 to 6669 and 6697.
- Browsers: only Chromium is installed. Every Playwright or Lighthouse run needs PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/pw-browsers. Never run playwright install. Never set TMPDIR for Playwright.
- Preview servers: never use port 4321 and never pkill broadly. For browser runs copy site/playwright.config.ts to your scratch directory with the webServer command `node node_modules/astro/bin/astro.mjs preview --port <your first port> --ignore-lock` run in site/ (or ../node_modules/astro/bin/astro.mjs if site/node_modules has no astro) and baseURL on that port, and run `npx playwright test -c <your copy> <spec>`; stop your server with `pkill -f "port <your first port>"`. npm run size takes `-- --port <your second port>`; npm run lab takes `-- --port <your third port>`.
- If site unit tests fail with "Cannot read properties of undefined (reading Symbol(filename))", that is a stale Vite SSR cache under /tmp/two-games-ssr-test-cache-*: run vitest with TMPDIR set to a fresh directory inside your scratch directory (vitest only).
- The machine is shared, so timing results are noisy: check uptime, and repeat a timing failure once alone before calling it real.
- Shell commands: absolute paths, no `cd` chains, no multi-line inline scripts (write a script file in your scratch directory and run it).

## Rules

Read /home/user/mutation_game/build-plan/red-team/RT-FIX.md and follow it completely; it names what else to read (COMMON.md, CONTRACTS.md, RED-TEAM-COMMON.md, the SPEC passages). In short: fix each cause, not the symptom, for every input; never touch reference/, a golden value, a convention, a cap or an interface of CONTRACTS.md (if a fix would need one, the finding is needs-decision with the options); never weaken or delete an existing assertion; every fixed finding gets a permanent test under a plain name with `// regression: <finding id>` that fails without the fix (prove it with a scratch revert); prose follows SPEC 8.4 and the terms of SPEC Appendix C, with no em-dash; numbers in prose come from <G>, numbers in formulas from <Tex>; lessons keep within their word limit (check it).

Findings marked DUPLICATE in your prompt are the same cause as the finding they name; your fix and test for that finding close both, and your acceptance line names both ids.

Run the engine suite (`npm test -w packages/engine`), every site unit file you touched, `npm run check -w site`, `npm run build`, and the browser specs of every route you changed against your own preview port (for a lesson: its own spec, nojs.spec.ts and the axe spec for that route). Commit with messages `RT-FIX <finding ids>: <what>`, and write the decisions fragment named in your prompt for every choice the specification leaves open, with a heading per entry of the form `## 2026-10-24 RT-FIX-P4-<cluster>: <subject> (<finding ids>)`.

Last step before your final message: commit, then delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree, stop your preview server, and confirm `git status --porcelain` is empty.

## Your final message

Only this JSON: {"agent": "<who>", "status": "done | partial | blocked", "branch": "...", "base": "<sha>", "commits": ["sha subject"], "filesChanged": ["..."], "commandsRun": [{"cmd": "...", "exit": 0, "summary": "..."}], "acceptance": [{"item": "<finding id>", "status": "fixed | needs-decision | could-not-reproduce", "test": "<the test that guards it>", "evidence": "<red before, green after; for needs-decision the options>"}], "deviations": [{"spec": "...", "what": "...", "why": "..."}], "decisionsFragment": "<path or none>", "handoff": "<what the lens should know when it reruns; any proposedFix you did not follow and why>"}
