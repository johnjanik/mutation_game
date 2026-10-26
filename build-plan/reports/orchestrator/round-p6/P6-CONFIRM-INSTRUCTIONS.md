# Confirming one red-team fix branch (phase 6 round of the Two Games build)

You confirm the fixes of one red-team cluster on its fix branch. You fix nothing and commit nothing.

## Environment (the plan was written for the owner's Mac; these notes override it)

- Repository root: /home/user/mutation_game. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and /home/user/mutation_game for files you only read). Wherever it says main, read the integration branch claude/session-6a181f60-hzzoud: never check it out, never commit to it, never push anything.
- FIRST, in your fresh worktree: `git checkout --detach <the branch named in your prompt>`; then `npm ci --prefer-offline` once. Never npm install.
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13 (reference/verify.py runs from reference/; Python scripts that import lie_games run without -I). Other agents work at the same time: use only your own scratch directory /tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/<your who>/ and only your own four ports (named in your prompt).
- Browsers: only Chromium is installed. Every Playwright run needs PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/pw-browsers in its environment. Never run playwright install. Never set TMPDIR for Playwright (Chromium crashes under the scratch path). Chromium refuses ports 5060, 5061, 6000, 6665 to 6669 and 6697. WebKit and Firefox cannot be installed here.
- Preview servers: never use port 4321 and never pkill broadly. For browser runs copy playwright.config.ts to your scratch directory with the webServer command `node node_modules/astro/bin/astro.mjs preview --port <your first port> --ignore-lock` run in site/ and baseURL on that port, and run `npx playwright test -c <your copy> <spec>`; stop your server with `pkill -f "port <your first port>"`. npm run size takes `-- --port <your second port>`.
- If site unit tests fail with "Cannot read properties of undefined (reading Symbol(filename))", that is a stale Vite SSR cache under /tmp/two-games-ssr-test-cache-*: run vitest with TMPDIR set to a fresh directory inside your scratch directory (vitest only, never Playwright).
- The machine is shared, so timing results are noisy: repeat a timing failure once alone before calling it real.
- Shell commands: absolute paths, no `cd` chains, no multi-line inline scripts (write a script file in your scratch directory and run it).

## What to do

Read /home/user/mutation_game/build-plan/RED-TEAM-COMMON.md sections 6 and 7 first, and the fixer's report named in your prompt (its acceptance lines, deviations and handoff).

The findings are the entries of the cluster file named in your prompt (a JSON array; each entry has claim, expected, observed, reproduction, specRef, reproducer, lens, branch and the verifiers' evidence). The lens branches named in each entry's `branch` field exist locally. The findings were made at f07eec6 (gate-G6-candidate); the fix branch is based on the integration head named in your prompt, which holds f07eec6 plus the round records.

For each finding:
1. Run the ORIGINAL reproducer (bring it in with `git checkout <lens branch> -- <path>` into a scratch copy outside the suite if the fixer renamed it, or copy it from the reproducers directory), run the fixer's regression test, and re-run the reproduction steps of the finding by hand. Decide whether the behaviour the finding describes is gone.
2. Check that a regression test exists in the permanent suite (with the comment `// regression: <finding id>`) and that it FAILS when the fix is reverted: a scratch revert of the fix's source lines (git stash or a scratch copy), run, then restore. Say which lines you reverted and what the test printed.
3. Note any side effect: another test that now fails, a behaviour of SPEC.md the fix broke, a golden value or a convention touched, a file outside the cluster's area changed without a recorded reason, an em-dash in added prose, a .only or .skip added.

A finding the fixer marked needs-decision is `fixed: false`, with the fixer's reason as evidence (say whether you agree that it needs the owner).

Also run, on the branch: the engine suite (`npm test -w packages/engine`), the site unit files the fix touched, `npm run check -w site`, and the browser specs of every route the fix changed (against `npm run build` and your own preview port).

Last step before your final message: delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree, stop your preview server, restore any scratch revert, and confirm `git status --porcelain` is empty.

## Your final message

Only this JSON, nothing else:

{"branch": "<branch>", "results": [{"findingId": "...", "fixed": true, "regressionTestPresent": true, "evidence": "commands run, what they printed, what the scratch revert showed"}], "sideEffects": ["..."]}
