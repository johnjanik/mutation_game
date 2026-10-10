# Common instructions for every build agent

You are one agent in a team building the site specified in `SPEC.md` (version 1.1) at the repository root. Read this file first, then `build-plan/CONTRACTS.md`, then your own instruction in `build-plan/agents/`. Your instruction names the sections of `SPEC.md` you must read in full before writing anything. `SPEC.md` is the source of truth; this file and `CONTRACTS.md` only say how the team works together. If they ever seem to disagree with `SPEC.md`, follow `SPEC.md` and say so in your report.

## 1. The project in six sentences

The site teaches two games on a Dynkin diagram, Wildberger's mutation game and Mozes' numbers game, and the Lie theory they lead to. A dependency-free TypeScript engine (`packages/engine`) reproduces `reference/golden_data.json`, the acceptance oracle. Sixteen Svelte 5 tools and eleven MDX lessons sit on an Astro 7 static site. Everything is built in the seven phases of `SPEC.md` section 9, each with a gate. You are building one piece of one phase. Other agents are building the other pieces at the same time, against the interfaces in `CONTRACTS.md`.

## 2. Conventions you may not change

These are fixed by `SPEC.md` section 2 and repeated in `CLAUDE.md` (Appendix H). Do not alter them, do not "simplify" a formula from memory, and do not reconcile them with another author's convention.

- Cartan matrix: $C_{ij}=\langle\alpha_i^\vee,\alpha_j\rangle$ (Kac, SageMath). Bourbaki prints the transpose.
- Board: $A_{ij}$ = roads from $i$ to $j$ = $-C_{ji}$. More roads run from the long node to the short node.
- Mutation (populations, roots): only entry $i$ changes, $p_i\leftarrow p_i-\sum_j C_{ij}p_j$.
- Firing (numbers, weights): $a_j\leftarrow a_j-C_{ji}a_i$ for all $j$, so $a_i\leftarrow-a_i$.
- Legal firing: the number is positive. The game ends when none is positive.
- Translator: $a=Cp$. The number on a node is the drop a mutation would cause there.
- The board never changes. Quiver mutation is a different operation (section 2.16).
- Nodes are positions $0..n-1$ inside the engine, labels everywhere else (Bourbaki $1..n$; $0$ first on affine boards). Only `toLabels` and `toPositions` convert (E-7).
- Where a choice is free, take the lowest position first (E-5).
- $B_2$ and $C_2$ are one board: computed names say `B2`; its affine board is `C2~`.
- `reference/` is read-only for everyone. Never edit `golden_data.json`, `lie_games.py` or `verify.py`.

If the oracle and a sentence of `SPEC.md` disagree, the oracle wins (section 0.2 item 2). If the engine and the oracle disagree and you believe the oracle is wrong, do **not** change the engine to match your belief and do not edit `verify.py`: write a standalone script `reports/discrepancies/<your-id>-<n>.py` that imports `lie_games` and demonstrates the point, describe it in your report with `status: blocked` for that item, and continue with the rest of your task.

## 3. The toolchain is newer than your training

Astro 7, Svelte 5, Vite 8, Vitest 5, TypeScript 6, KaTeX 0.18 and 0.19 all postdate most of what you know (`SPEC.md` 7.2). Rules:

- Before using any API of an installed package, read its type definitions and its `CHANGELOG.md` or `README.md` under `node_modules/`. Do not write from memory of Astro 4 or 5, Svelte 4 or Vitest 1.
- Svelte 5 only: `$state`, `$derived`, `$props`, `$effect`, snippets. Never `export let`, `$:` blocks, `writable` for local state, `on:click` (use `onclick`), or slots where snippets are expected. The one store idiom allowed is a Nano Store read as `$name`.
- Astro 7's default Markdown processor runs no remark or rehype plugins; the choice of mathematics route is recorded in `DECISIONS.md` by `P0-A3` and is binding afterwards.
- For automated checks use `astro build` then `astro preview`, never `astro dev`.
- Pin exact versions. Never add a dependency to `packages/engine`. Never add a dependency to the site unless your instruction names it; otherwise write the request in your decisions fragment and continue without it.
- Node must be 22.12 or later. If `node --version` says otherwise, stop and report.

## 4. How you work

### 4.1 Your worktree and branch

You are running in a fresh git worktree on a branch of your own. Confirm with `git rev-parse --show-toplevel` and `git branch --show-current` and put both in your report. Commit your work on that branch with messages that begin with your agent id, for example `P1-A5: T1 linked view with exact fractions`. Never check out or commit to `main`. Never force-push, rebase onto, or merge from another agent's branch. The `MERGE` agent integrates.

If `node_modules` is absent in your worktree, run `npm ci --prefer-offline` once at the root. Do not run `npm install`, which would change the lockfile.

### 4.2 Files you may touch

Your instruction lists the files and directories you own. Create and edit only those, plus `decisions/<your-id>.md` and the test files named in your instruction. If your task needs a change elsewhere, write what you need in your report under `requests` and in your decisions fragment, and build against the contract as if the change were made. Never edit root `package.json` or the lockfile unless your instruction says so. Never edit `DECISIONS.md` directly (write the fragment). Never edit `content/unverified.json` to add an item (propose it in your report).

### 4.3 Tests first for the engine, tests alongside for the rest

For an engine function, write the golden test (or the property test) before the function, from the key of `golden_data.json` named in `SPEC.md` 5.7, with the comparison rules of 5.7 as implemented in the harness. Port from `reference/lie_games.py` function by function, keeping the oracle's choices (lowest position first; the orders of candidates and of search). For a tool, every acceptance criterion of its entry in `SPEC.md` section 4 becomes an automated test: a Vitest test on the engine functions where the criterion ranges over all boards or many random cases, a Playwright test against the built site for the named examples and one case per kind of board the tool offers, reading only the hooks of section 4.0 and the live region. A test must fail when the behaviour it guards is removed; do not write tests that pass against an empty implementation.

Run only your own test files and the engine suite (`npm test -w packages/engine`, and your `site/tests/unit` and `site/tests/e2e` files). Do not run the whole browser suite, `npm run size` or `npm run lab` unless your instruction says so; `MERGE` and `GATE` run those.

Type-check before you report: `npx tsc --noEmit -p packages/engine` and, for site work, `npx astro check` and `npx svelte-check` (or the project's configured commands). A type error is a failure to fix, not to suppress.

### 4.4 Forbidden

- `it.only`, `test.skip`, `xit`, commented-out assertions, loosened tolerances, a golden value typed into source, a test that compares a value with itself.
- Changing a comparison rule of the golden harness, a convention, a label, the sign of the legal move, a cap of section 5.6, or an interface in `CONTRACTS.md`. A deviation you believe necessary goes in your report under `deviations`, with the reason; `MERGE` decides.
- Copying a sentence, figure or table layout from a paper, preprint or lecture. Lessons are written from `SPEC.md` sections 2 and 3 in the site's own words with citations by key.
- Stating anything `SPEC.md` labels [U] as fact in a lesson. Wrap it in `<Unverified item="E.." fallback="...">`.
- Setting an item of `content/unverified.json` to `closed`.
- Any third-party script, font, or request at runtime. KaTeX and fonts are self-hosted and never sent to the reader as JavaScript.
- Em-dashes in prose. The house style of 8.4.
- Guessing at a number that has a golden value. Use `<G>` in prose and `{{path}}` in `<Tex>`.
- `console.log` left in shipped code; `any` without a comment saying why.

### 4.5 Resource etiquette

Other agents share this machine (8 GB of memory). Do not start a second Playwright run while one of yours is running. Kill `astro preview` when you are done. Keep caps as the specification sets them; never raise a cap to make a test faster.

### 4.6 Shell commands that never need approval

Claude Code's permission check asks the owner about a `cd` inside a compound command and about multi-line inline scripts, even when prompts are otherwise off. Hundreds of such prompts stalled the first runs. Therefore:

- Never write `cd X; ...` or `cd X && ...`. Use absolute paths in every command (`grep -n ... /Users/john/Claude/MutationGame/SPEC.md`). If a tool must run from a directory (`npm`, `astro`, `git`), pass the directory as an argument (`npm --prefix`, `git -C <dir>`, `npx --prefix`) or use the tool's own directory flag.
- Never write a multi-line `python3 -c "..."` or a heredoc inline. Write the script to a file under your scratch directory with the Write tool (or a one-line `printf`), then run `python3 /absolute/path/script.py`.
- One command per Bash call where practical; no `&&` chains longer than two commands.

## 5. When you are done

You are done when every deliverable in your instruction exists, every test you were asked to write passes, type-checks pass, your work is committed on your branch, your decisions fragment is written, and your report is complete. If something is not done, say exactly what and why; a partial, honest report is worth more than a complete-looking one. Never report a check as passed that you did not run; paste the summary line of each command you ran.

### 5.1 Your decisions fragment

`decisions/<your-id>.md`, Markdown, one dated entry per decision, in this form:

```
## 2026-10-12 P1-A5: fraction display in linked view
Decision: ... What the specification left open: ... Default used (SPEC section 10, D..): ... Reason: ...
```

Record: every default of section 10 you relied on; every dependency you were told to add (version, licence, size if shipped); every [U] item of section 7 you settled while building a tool; every choice `SPEC.md` marks [D] that you had to make concrete; every deviation.

### 5.2 Your report

Your final message is the report, as JSON matching this shape (the workflow validates it):

```json
{
  "agent": "P1-A5",
  "status": "done | partial | blocked",
  "branch": "agent/P1-A5",
  "worktree": "/path/printed/by/git",
  "commits": ["<sha> <subject>", "..."],
  "filesChanged": ["site/src/components/tools/T01GameBoard.svelte", "..."],
  "commandsRun": [{"cmd": "npm test -w packages/engine", "exit": 0, "summary": "412 passed"}],
  "acceptance": [{"item": "SPEC 4 T1: A2 legal play 1,2,1 shows ... game over after 3 moves", "status": "pass | fail | not-automated", "test": "site/tests/e2e/T01.spec.ts > legal play on A2"}],
  "deviations": [{"spec": "5.4", "what": "...", "why": "..."}],
  "requests": [{"to": "P1-A2", "what": "..."}],
  "proposedUnverifiedItems": [{"statement": "...", "whereToCheck": "...", "fallback": "..."}],
  "decisionsFragment": "decisions/P1-A5.md",
  "openQuestions": ["..."],
  "handoff": "two or three sentences a reviewer needs"
}
```

`acceptance` lists every criterion of your instruction, one line each, with the test that proves it. `not-automated` is allowed only where `SPEC.md` itself says the check is manual (the owner's part of a gate); say which gate.
