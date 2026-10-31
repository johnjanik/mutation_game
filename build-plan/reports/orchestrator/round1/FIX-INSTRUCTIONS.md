# Residual fixes after red-team round 1 (Two Games build)

You fix a short list of residual items that the confirmers of red-team round 1 found after the fix branches were merged. You are in a fresh git worktree on your own branch; report its name.

## Environment (the plan was written for the owner's Mac; these notes override it)

- Repository root: /home/user/mutation_game. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and /home/user/mutation_game for files you only read). Wherever it says main, read the integration branch claude/session-6a181f60-hzzoud: never check it out, never commit to it, never push.
- FIRST, in your fresh worktree: `git reset --hard 51a7e26` (the integration head with every round 1 fix merged), then `npm ci --prefer-offline` once. Never npm install.
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13. Other agents work at the same time: use only your own scratch directory /tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/<your who>/ and only your own four ports (named in your prompt).
- Browsers: only Chromium is installed. Every Playwright run needs PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/pw-browsers. Never run playwright install. Never set TMPDIR for Playwright.
- Preview servers: never use port 4321 and never pkill broadly. For browser runs copy playwright.config.ts to your scratch directory with the webServer command `node node_modules/astro/bin/astro.mjs preview --port <your first port> --ignore-lock` run in site/ and baseURL on that port, and run `npx playwright test -c <your copy> <spec>`; stop your server with `pkill -f "port <your first port>"`. npm run size takes `-- --port <your second port>`.
- If site unit tests fail with "Cannot read properties of undefined (reading Symbol(filename))", that is a stale Vite SSR cache under /tmp/two-games-ssr-test-cache-*: run vitest with TMPDIR set to a fresh directory inside your scratch directory (vitest only).
- The machine is shared, so timing results are noisy: repeat a timing failure once alone before calling it real.
- Shell commands: absolute paths, no `cd` chains, no multi-line inline scripts (write a script file in your scratch directory and run it).

## Rules

Read /home/user/mutation_game/build-plan/COMMON.md, /home/user/mutation_game/build-plan/CONTRACTS.md and /home/user/mutation_game/build-plan/RED-TEAM-COMMON.md section 7, and follow them. In short: fix each cause, not the symptom; never touch reference/, a golden value, a convention, a cap or an interface of CONTRACTS.md (if a fix would need one, stop on that item and report it as needs-decision with the reason); never weaken or delete an existing assertion; every fix gets a test that fails without it (prove it with a scratch revert); prose follows SPEC 8.4 and the terms of SPEC Appendix C, with no em-dash; numbers in prose come from <G>, numbers in formulas from <Tex>.

Run the engine suite (`npm test -w packages/engine`), every site unit file you touched, `npm run check -w site`, and the browser specs of every route you changed (against `npm run build` and your own preview port). Commit with messages `RT-FIX residual: <what>`, and write the decisions fragment named in your prompt for every choice the specification leaves open.

Last step before your final message: commit, then delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree, stop your preview server, and confirm `git status --porcelain` is empty.

## Your final message

Only this JSON: {"agent": "<who>", "status": "done | partial | blocked", "branch": "...", "commits": ["sha subject"], "filesChanged": ["..."], "commandsRun": [{"cmd": "...", "exit": 0, "summary": "..."}], "acceptance": [{"item": "<item number and text>", "status": "fixed | needs-decision | could-not-reproduce", "test": "<the test that guards it>"}], "deviations": [{"spec": "...", "what": "...", "why": "..."}], "decisionsFragment": "<path>", "handoff": "..."}
