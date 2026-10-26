# RT-VERIFY, phase 6 round (Two Games build)

You verify the findings of one red-team lens against commit f07eec66a8b80d249101630305ef6d2d23882738 (gate-G6-candidate), in one mode: reproduce or refute (named in your prompt). Another agent verifies the same findings in the other mode; you do not see its work. You verify every finding of the lens, each on its own: one finding's result never decides another's.

## Environment (the plan was written for the owner's Mac; these notes override it)

- Repository root: /home/user/mutation_game. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and /home/user/mutation_game for files you only read). Never check out the integration branch claude/session-6a181f60-hzzoud, never commit, never push.
- FIRST, in your fresh worktree: `git checkout --detach f07eec66a8b80d249101630305ef6d2d23882738`. Reproduce mode: then bring in only the reproducer files a finding names, with `git checkout <lens branch> -- <path>` (the lens branch is in the lens output's `branch` field, before any space or parenthesis), finding by finding; restore the tree between findings when one finding's files would affect another's run. Then `npm ci --prefer-offline` once. Never npm install. Refute mode: you read and may run commands, but you add nothing.
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13 (reference/verify.py runs from reference/; Python scripts that import lie_games run without -I). Other agents work at the same time: use only your own scratch directory /tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/<your who>/ and only your own four ports (named in your prompt).
- Browsers: only Chromium is installed. Every Playwright or Lighthouse run needs PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad/pw-browsers. Never run playwright install. Never set TMPDIR for Playwright.
- Preview servers: never use port 4321 and never pkill broadly. If a reproducer's own Playwright config names a port, copy it to your scratch directory with your first port in the webServer command and baseURL. Stop your server with `pkill -f "port <your first port>"`.
- If site unit tests fail with "Cannot read properties of undefined (reading Symbol(filename))", run vitest with TMPDIR set to a fresh directory inside your scratch directory (vitest only).
- The machine is shared, so timing results are noisy: check uptime and repeat a timing result before relying on it.
- Set NODE_DISABLE_COMPILE_CACHE=1 in the environment of every astro build, npm run build, npm run size and Playwright webServer: Astro's CLI otherwise enables Node's compile cache, and concurrent builds of several agents stall on the one shared cache directory under /tmp (RT-12 phase 6 note). It changes nothing in the output.
- Shell commands: absolute paths, no `cd` chains, no multi-line inline scripts (write a script file in your scratch directory and run it).
- Last step: delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree, stop your preview server, and confirm `git status --porcelain` shows only nothing (refute) or only the reproducer files you brought in (reproduce).

## What to do

Read /home/user/mutation_game/build-plan/RED-TEAM-COMMON.md sections 2 to 4 and 6 and /home/user/mutation_game/build-plan/red-team/RT-VERIFY.md, and follow them exactly for your mode.

- Reproduce mode: run each finding's reproduction exactly as written, from the clean commit plus only its reproducer. Report reproduced true or false, the command, the output, and whether the observed value matches the finding's `observed`. A reproduction that needs a step the finding did not state is reproduced false, with the reason.
- Refute mode: read each finding and the passage of SPEC.md (or CONTRACTS.md, or the oracle) it cites, and try to show the behaviour is permitted, that the finding misreads the passage, that the item belongs to a later phase, that the oracle agrees with the build, or that it is a [D] choice or a logged decision (DECISIONS.md, decisions/*.md, the "known and decided" list in /home/user/mutation_game/build-plan/reports/orchestrator/round-p6/P6-LENS-INSTRUCTIONS.md). A refutation must cite a section, a golden key, an oracle function and input, a phase assignment or a recorded decision; taste is not a refutation. If you cannot refute with a citation, report refuted false. You may also propose a severity adjustment with the rubric of RED-TEAM-COMMON 4.

## Your final message

Only this JSON: {"lens": "<lens id>", "mode": "reproduce | refute", "verdicts": [{"findingId": "...", "mode": "...", "reproduced": true, "refuted": false, "citation": "...", "evidence": "...", "severityAdjustment": "none | lower to major | lower to minor | raise to major | raise to blocker", "reason": "..."}]}. In refute mode set reproduced to null; in reproduce mode set refuted to null.
