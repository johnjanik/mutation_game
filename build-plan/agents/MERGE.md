# MERGE: integrate a stage into main (recurring role)

Phase {k}, every roster stage with `"mergeAfter": true` (0.2, 0.3; 1.1 to 1.3; 2.1 to 2.3; 3.1 to 3.3; 4.1 to 4.3; 5.1 to 5.3; 6.1, 6.1b, 6.2, 6.3; 7.a to 7.c), and once after every red-team fix round. Stage 0.1 has no merge: `P0-A1` commits to `main` directly, and the `MERGE` of stage 0.2 takes up its fragment, its deviations and its requests (5.16). Size (plan, no plan file sizes MERGE): S for a stage of one or two agents, M for three or more or for a stage whose branches conflict. Runs in: the primary checkout `/Users/john/Claude/MutationGame`, on `main`, with no worktree. You and `GATE` are the only agents that change `main` (README 3.2). Model: the session model (README 3.5).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies, with the differences this file states: you have no branch of your own and commit to `main`; you run the whole browser suite and `npm run size`, which build agents may not; you may edit root `package.json`, the lockfile, `DECISIONS.md` and `content/unverified.json` under the protocols below; and you never decide a design question. `COMMON.md` 4.4 ends its list with "A deviation you believe necessary goes in your report under `deviations`, with the reason; `MERGE` decides.": you do decide each reported deviation, by the procedure of 5.15, and a deviation that is a design question is the one case you pass to the orchestrator (README 3.2: "a conflict that needs a design decision is reported, not guessed").

The prompt that launches you names the phase and the stage (or the red-team round), and gives, in roster order, the agents to merge with their branch names, worktree paths and reports (`status`, `filesChanged`, `requests`, `proposedUnverifiedItems`, `decisionsFragment`, `deviations`), followed by the agents that did not finish. Where this file writes `{k}` read the phase number, `{s}` the stage name, `{r}` the red-team round. `ROOT` means `/Users/john/Claude/MutationGame`.

## 1. Objective

When you are done, every finished branch of the stage is merged into `main` in roster order with a `--no-ff` merge commit naming its agent; every conflict is resolved in favour of `SPEC.md` and `CONTRACTS.md` or reported; `DECISIONS.md` carries every fragment of the stage under a stage heading; every proposed unverified item has its number in `site/src/content/unverified.json` or reserved in `DECISIONS.md` (5.6); every request of every report and of every fragment you fold has been routed; every deviation the agents report has your verdict (5.15); and `main` passes `npm ci`, the type-check, the unit and engine tests, the build, the browser suite and the size budget (`SPEC.md` 7.7: build failures and sizes at every merge). You leave `reports/merge-P{k}-{s}.md` on disk for `GATE` and the orchestrator, and your JSON report tells the workflow whether `main` is green and at which commit. If `main` cannot be made green by integration-level fixes, you reset it to the start commit (the last green commit) and report `blocked`; a stage is never left half-merged on `main` (README 3.6).

## 2. Read first, in this order

1. `build-plan/README.md` 3.2 (only `MERGE` and `GATE` change `main`; merge order is roster order; conflicts in favour of the specification; a conflict needing a design decision is reported), 3.4 (only `MERGE` and `GATE` run the browser suite and `npm run size`; one Playwright run at a time), 3.6 (a failed agent never leaves half-merged work on `main`), 6 (the ownership table: who may edit what, and which shared files you may edit) and 7 (what `GATE` reads after you). Read in full.
2. `build-plan/COMMON.md` in full, in particular 2 (conventions you may not change), 4.4 (the forbidden list, which binds your fixes), 4.6 (shell rules), 5.1 (the fragment format you fold into `DECISIONS.md`) and 5.2 (the report you extend).
3. `build-plan/CONTRACTS.md` 1 (repository layout and root scripts: `test`, `build`, `e2e`, `size`, `typecheck`, `check`), 3 (the golden harness: comparison rules implemented once and never changed), 9 (the hashes of the three reference files) and 10 (branch names, commit prefixes, fragments, reports). Read in full. The other sections are reference for resolving a conflict at an interface.
4. The roster of the phase, `build-plan/rosters/phase-{k}.json`: the stage's `agents` in order and each agent's `owns`. This is how you tell which side of a conflict owns a file.
5. `SPEC.md` 7.7 (lines 1872 to 1887): the table (golden and property tests required for every merge; the run without JavaScript for every merge that touches a lesson or a tool; sizes at every merge; build failures on unknown `<Cite>` keys and unresolved `<G>` paths at every merge) and the paragraph of commands. Read in full.
6. `SPEC.md` 9.3 (lines 2002 to 2013): defaults of section 10 recorded in `DECISIONS.md` with date and reason; every site dependency recorded with version, licence and shipped size; never set an unverified item to `closed`; never change a convention. Read in full.
7. `SPEC.md` 7.3 (lines 1774 to 1824), the `<Unverified>` bullet: `content/unverified.json` lists every item with a status, `open` or `closed`; only the owner closes one. And Appendix E, its first paragraph and item 17 (line 2375): a new item takes the next free number (`E18`, `E19`, ...), quoting the statement and saying where it can be checked; an item no gate names is due at G6.
8. `build-plan/agents/P0-A4-content-components.md` 5.7 (the shape of an item in `site/src/content/unverified.json`: `{ "id", "status", "statement", "whereToCheck", "gate" }`) and 5.8 (`unverifiedRegistry.ts` and `Unverified.astro`: an item id that is not in the file is treated as open).
9. `build-plan/agents/GATE.md` 5.9 (how `GATE` checks that you folded every fragment) and 3 (it starts from the commit your last merge report names).
10. The report of every agent you merge, as the prompt gives it, and its decisions fragment on its branch.
11. At stage 0.2 only: `decisions/P0-A1.md` on `main` and `build-plan/agents/P0-A1-repo-scaffold.md` 5.1 (the `reports/discrepancies/` proposal), 5.8 ("`MERGE` copies yours in at the end of stage 0.1 (or `GATE` at G0)") and 10 (what its `deviations` and `requests` hold) (5.16).
12. On a red-team round: `build-plan/red-team/RT-FIX.md` 5.5 (the edits a fixer leaves to you as requests), 5.9 (the fragment `decisions/RT-FIX-P{k}-<cluster slug>.md`, written only when a choice was made or a request written) and 10 (the report fields) (5.13).

There is no oracle function and no golden key for you. You open `reference/` only to confirm that nothing changed it.

## 3. Inputs you depend on

- The primary checkout at `ROOT` is a git repository whose current branch is `main` and whose tracked tree is clean. The previous `MERGE` (or `P0-A1` before stage 0.2) left `main` green; its commit is your **start commit**.
- Every branch the prompt names exists locally (`git -C ROOT rev-parse --verify <branch>`) and has at least one commit not on `main`.
- Node 22.12 or later, npm, and the Playwright browsers installed once per machine (README 3.4).
- The root scripts of `CONTRACTS.md` 1. Before `P0-A6` is merged in stage 0.2, `e2e` and `size` are stubs that print `not yet implemented: P0-A6` and exit 2; that is recorded as "not yet available", not as a failure. From the moment `P0-A6`'s branch is merged, a stub or a missing script is a failure.
- At stage 0.2: `decisions/P0-A1.md` committed on `main` by `P0-A1`'s root commit. Stage 0.1 has no `mergeAfter`, so the build workflow passes `P0-A1`'s JSON report to no `MERGE` prompt and nothing writes it to disk (plan: `build-phase.js` keeps it in the run's results only). Its deviations and requests reach you through the fragment (`COMMON.md` 5.1 records "every deviation" there; `P0-A1` 5.13 writes its debts there) and through the report only if the orchestrator adds it to your prompt (5.16).
- On a red-team round: each fix branch's fragment, when its report names one; the round prompt carries no `requests`, so the fragment is where a fixer's requests to you are written (`RT-FIX.md` 5.5, 5.9).

If `main` is not checked out, the tree is not clean, or a named branch is missing, see 5.1.

## 4. Deliverables

| File or object | Contents |
|---|---|
| One merge commit per merged branch on `main` | `git merge --no-ff`, subject `MERGE: {agent} ({branch}) into main, P{k} stage {s}` (on a red-team round, `... P{k} red-team round {r}`) (5.2; plan: `CONTRACTS.md` 10 fixes only that "Commit messages begin with the agent id", the rest of the subject is this file's) |
| `DECISIONS.md` | Every fragment of the stage appended in roster order under one stage heading (5.5) |
| `site/src/content/unverified.json` | One new `open` item per accepted proposal, numbered from the next free `E<n>`, or the number reserved in `DECISIONS.md` while a test pins the count (5.6) |
| Root `package.json` and `package-lock.json` | Only through the lockfile protocol (5.4) or a request you carry out (5.7) |
| Integration fixes | Only of the kinds 5.9 allows, each in its own commit `MERGE: integration fix after {agents}: <what>`, which also appends its line to `decisions/MERGE.md` and `DECISIONS.md` (5.12) |
| `decisions/MERGE.md` | One dated entry per run, appended (5.12); every addition to it is copied into `DECISIONS.md` in the same commit |
| `reports/merge-P{k}-{s}.md` (or `reports/merge-P{k}-redteam-round{r}.md`) | The merge report of 5.11; on disk, not committed (`reports/*` is ignored except `gate-*.md`) |
| `reports/merge-P{k}-{s}/NN-<command>.log` (or `reports/merge-P{k}-redteam-round{r}/NN-<command>.log`) | The full output of each check, last line `exit=<status>`; on disk, not committed (plan: the directory and the `NN-<command>.log` naming are this file's) |
| Removed worktrees | `git worktree remove` for every merged branch's worktree once `main` is green; branches kept (5.10) |
| The JSON report | Section 10 |

## 5. Requirements

### 5.1 Preconditions

Run each command on its own and record it with its output in the precondition section of the merge report:

- `git -C ROOT rev-parse --show-toplevel` prints `ROOT`; `git -C ROOT branch --show-current` prints `main`.
- `git -C ROOT status --porcelain` prints nothing. Worktree directories that `git -C ROOT worktree list` names, and paths ignored by `.gitignore`, do not count. Anything else (a modified tracked file, an untracked file outside a worktree) means stop: report `blocked` with the output, change nothing, merge nothing. Never stash, clean or reset to make the tree clean.
- `git -C ROOT rev-parse HEAD`: the start commit. Record it; every reset this file allows returns to it, with one exception: undoing the merge you just made of a branch that changed `reference/` (5.2), which returns to the commit before that merge.
- `node --version` (22.12 or later, else stop, `COMMON.md` 3).
- `shasum -a 256 ROOT/reference/golden_data.json ROOT/reference/lie_games.py ROOT/reference/verify.py` equals `CONTRACTS.md` 9. A difference before you merge anything is a blocker you report; you do not repair `reference/`.
- For each branch in the prompt: `git -C ROOT rev-parse --verify <branch>`, `git -C ROOT log --oneline main..<branch>` (its commits, all with subjects beginning with the agent id), and `git -C ROOT diff --name-only main...<branch>` (the files it changed). Compare that list with the agent's `owns` in the roster and with its `filesChanged`. Every file outside `owns` plus `decisions/<id>.md` and the tests the instruction names is recorded in the merge report under "Files outside ownership" and judged in 5.3.

A branch that is missing, has no commits, or whose agent is listed as not finished is not merged; it goes into `notMerged` with the reason.

### 5.2 Merging, in roster order

- Merge the branches one at a time in the order the prompt gives (the roster order, README 3.2), never in another order and never several at once (no octopus merge):
  `git -C ROOT merge --no-ff --no-edit -m "MERGE: P1-A2 (agent/P1-A2) into main, P1 stage 1.1" agent/P1-A2`
  The subject names the agent and the branch; the body may carry the trailer your harness asks for. On a red-team fix round the subject is `MERGE: {agent} ({branch}) into main, P{k} red-team round {r}` (5.13).
- Use the branch name the agent reported, which may differ from `agent/P{k}-A{m}` when the harness named the worktree's branch. Never rebase, amend or commit on an agent's branch, and never merge `main` into it.
- A clean merge still gets three checks before the next branch: `git -C ROOT diff --stat HEAD^1 HEAD -- reference/` is empty (a branch that changes `reference/` is undone with `git -C ROOT reset --hard HEAD^1`, listed in `notMerged`, and reported; nothing of it reaches `main`); `DECISIONS.md` and `site/src/content/unverified.json` are unchanged by the branch, a red-team fix branch included (`RT-FIX.md` 6 requires that its diff "contains none of: ... `DECISIONS.md`, ... `content/unverified.json`" and its section 7 lists both under "must not touch") (if a branch edited them, restore them with `git -C ROOT checkout HEAD^1 -- <path>`, amend the merge commit with `git -C ROOT commit --amend --no-edit`, and record it under `deviations`; the content reaches `DECISIONS.md` only through its fragment); and no file outside the agent's ownership was changed in a way 5.3 forbids.
- A partial agent (`status: partial`) is merged like a finished one; its gaps go into the merge report and the handoff.

### 5.3 Conflicts

- List conflicted paths with `git -C ROOT diff --name-only --diff-filter=U`. Resolve each one by the authority, in this order: `SPEC.md`; `CONTRACTS.md`; the owner of the file in the roster and README 6. Never resolve in favour of a branch because it came first, last, or is larger.
- For a file one side owns and the other touched outside its ownership: take the owner's side, and record the other side's change under `requests` to the orchestrator if it was needed.
- For a file two agents edit additively under a protocol (`ToolFrame.svelte` buttons, `index.ts` exports, `T01GameBoard.svelte` panels, `tokens.css`, `.gitignore`, `ci.yml`, the root Vitest configuration): keep both additions, in roster order, with no rewording of either. An `index.ts` export conflict keeps every export of both sides, once each, in the order of `CONTRACTS.md` 2 where it gives one.
- For `decisions/*.md`: there is one fragment per agent id, so a conflict there means an agent wrote someone else's fragment; keep the owner's file.
- A conflict that needs a design decision is reported, not guessed: two incompatible signatures for one interface that `CONTRACTS.md` does not settle; two different behaviours each defensible from `SPEC.md`; a change to a convention, a cap, a label or a test assertion on one side. Then run `git -C ROOT merge --abort`, put the branch in `notMerged` with the two sides quoted, continue with the next branch only if it does not depend on this one (its report's handoff and the roster's `dependsOn` say), and end with `status: blocked` if the stage cannot stand without the branch. Ending `blocked` this way means what section 10 and the build workflow's prompt mean by it ("you stopped with main at the last green commit"): stop merging, fold nothing, run no checks, and move `main` back to the start commit with `git -C ROOT reset --hard <start>`, exactly as 5.9 does, so that the merges made earlier in this run leave `main` too (they were never checked green, and a stage is never left half-merged, section 1). The agents' branches keep their work and every worktree is kept (5.10). If the stage can stand without the branch, the earlier and later merges stay, and the run ends `partial` (section 10).
- Record every resolution in `conflictsResolved`: agent, file, the hunk in one line, which side or both, and the authority (`SPEC 7.5`, `CONTRACTS 2.4`, `README 6 owner P1-A2`).
- Conclude the merge with `git -C ROOT add <paths>` naming each resolved path (never `git add -A` or `git add .`) and `git -C ROOT commit --no-edit`.

### 5.4 The lockfile protocol

`package-lock.json` is never resolved by hand.

1. For each conflicted `package.json` (root, `site/`, `packages/engine/`): accept both sides. Keep every dependency and every script of both, each once, with the exact version as pinned (no `^`, no `~`; `COMMON.md` 3). The same package pinned at two different versions is a conflict that needs a decision unless `SPEC.md` 7.1 or a `DECISIONS.md` entry fixes the version, in which case take that version and record the authority. The same script name with two bodies follows 5.3: the owner of the script body (`P0-A6` for the root scripts, `P3-A7` for `lab`) wins. `packages/engine/package.json` never gains a dependency (`COMMON.md` 3); a branch that adds one there is not merged.
2. Delete the conflicted lockfile: `rm ROOT/package-lock.json`.
3. Run `npm --prefix ROOT install` exactly once to regenerate it. This is the only kind of `npm install` you ever run: one regeneration per merge whose lockfile conflicts, and one per dependency request you carry out (5.7), never a second one for the same merge or request (plan: the count per event is this file's).
4. Confirm `npm --prefix ROOT ci --prefer-offline` succeeds on the regenerated lockfile.
5. `git -C ROOT add` the `package.json` files you resolved and `package-lock.json`, and conclude the merge. Record the protocol under `conflictsResolved` with the file `package-lock.json` and the resolution `regenerated`.

If only the lockfile conflicts and no `package.json` does, apply steps 2 to 5.

Several branches of one stage may each change a `package.json` (for example at stage 0.2, `P0-A3` adds KaTeX to `site/package.json` while `P0-A6` writes the root script bodies), so a later merge can conflict on a lockfile that an earlier merge of the same run already regenerated. Apply the protocol again to that merge, in full: the regeneration of step 3 belongs to the merge it concludes, and each later merge whose lockfile conflicts gets its own (plan: this file's procedure; README 6 lets `MERGE` edit the lockfile and `COMMON.md` 3 requires exact pins, neither says how often). Never defer a regeneration to the end of the run and never conclude a merge with a conflicted or hand-edited lockfile. Record each regeneration under `conflictsResolved` with its agent. A merge whose `package.json` side cannot be resolved under step 1 (the same package at two versions with no authority) is a conflict needing a decision: `git -C ROOT merge --abort` and 5.3 applies.

A branch that changed a `package.json` it does not own (README 6: root by `P0-A6`, `P1-A2`, `P3-A7`, `MERGE`, `GATE`; `site/package.json` only where the instruction names the dependency) keeps its change out of `main` and gets a line under `requests` to the orchestrator.

### 5.5 Decisions fragments into DECISIONS.md

- After every branch of the stage is merged (and before the checks), append to `DECISIONS.md` one stage heading, `## <date> MERGE: P{k} stage {s}` (on a red-team round, `## <date> MERGE: P{k} red-team round {r}`), with `<date>` from `date +%F`.
- Under it, for each merged agent in roster order, the contents of `decisions/<id>.md` verbatim: headings, wording and order unchanged. Do not summarise, correct, merge or reword an entry. If a fragment existed before this stage (a rerun agent, `decisions/GATE.md`, a red-team fix of an earlier cluster), append only the entries whose headings are not already in `DECISIONS.md` (`git -C ROOT diff <start>..HEAD -- decisions/<id>.md` shows them).
- Also fold any fragment that `git -C ROOT diff --name-only <start>..HEAD -- decisions/` shows changed and is not yet in `DECISIONS.md` (for example a fragment of an agent whose report did not name it), and say so in the merge report.
- A merged build agent without a fragment is recorded under `deviations` against that agent (`COMMON.md` 5.1 requires one); you write nothing in its name. A red-team fixer is the exception: `RT-FIX.md` 5.9 says "If you made no decision and wrote no request, write no fragment and omit `decisionsFragment` from the report", so a fix branch whose report omits `decisionsFragment` and whose diff adds no file under `decisions/` is recorded as "no fragment (none needed, RT-FIX 5.9)" and is not a deviation (5.13).
- At stage 0.2, fold `decisions/P0-A1.md` first, before the fragments of the stage, as 5.16 says. It was added by the root commit, which is at or below your start commit, so the diff of the bullet above never shows it.
- A fragment entry that claims a default of `SPEC.md` 10 different from the default the specification states, or records a dependency without version and licence (`SPEC.md` 9.3), is still copied verbatim; you add the discrepancy to `openQuestions`.
- List every fragment folded in `fragmentsAppended`, in order.

### 5.6 New unverified items

- New items enter `site/src/content/unverified.json` only through you (README 3.2; Appendix E item 17). For each entry of each merged report's `proposedUnverifiedItems`, in roster order and then in report order:
  - If an existing item already covers the same statement (compare the claim, not the wording), do not add one; map the proposal to that id and say so.
  - Otherwise take the next free number: one more than the largest `E<n>` in the file and in any reservation recorded in `DECISIONS.md` (see below), starting from `E18`.
  - Append `{ "id": "E<n>", "status": "open", "statement": <the proposal's statement verbatim>, "whereToCheck": <its whereToCheck verbatim>, "gate": "G6" }`. The gate is `G6` because no gate of `SPEC.md` 9.1 names a new item (Appendix E, first paragraph). Add no other field; the proposer, the fallback and the page go into your fragment entry, since the shape of P0-A4 5.7 is fixed.
  - The status is always `open`. You never write `closed`, `closedOn` or `closedBy`, and never change an existing item.
  - A proposal without a `statement` or without a `whereToCheck` is not added; it goes under `requests` to the proposing agent's area via the orchestrator.
- If a lesson already wraps the sentence in `<Unverified item="...">` with a provisional id (an id the agent's report names in `unverifiedUsed`, or one that `grep -n 'item="' <lesson>` shows and the file lacks), rewrite that attribute in the lesson to the assigned number. That is an integration fix of an identifier (5.9), recorded in `unverifiedItemsAssigned` with the file and line.
- Commit the additions together with the `DECISIONS.md` fold: `MERGE: P{k} stage {s} decisions and unverified items` (on a red-team round, `MERGE: P{k} red-team round {r} decisions`).
- If adding an item makes an existing test fail only because that test pins the number of items (P0-A4's seed test asserts exactly seventeen), do not edit the test (plan: the reservation that follows is this file's mechanism; `SPEC.md` and Appendix E say nothing about a reserved number). Restore `unverified.json` to its state before your addition, record each number in `DECISIONS.md` under your stage heading as reserved (`E18 reserved for "<statement>" proposed by P2-A9, not yet in unverified.json because <test> pins the count`), list the items in `unverifiedItemsAssigned` with `"inFile": false`, and add a request to the orchestrator to amend that test. The lesson's provisional or assigned id still renders as open (P0-A4 5.8), so nothing is stated as fact.

### 5.7 Requests

Every entry of every merged report's `requests`, every request written in a fragment you fold (a fix branch's requests reach you only this way, 5.13; `P0-A1`'s at stage 0.2, 5.16), and every request a not-merged agent's handoff or `openQuestions` names, is routed exactly once (a request found both in a report and in its fragment counts once) and listed in `requestsRouted` as `{ from, to, what, routedTo, action }`. These are the incoming requests. The requests you raise yourself (the other side's change in 5.3, a `package.json` outside ownership in 5.4, an incomplete proposal or a reserved number in 5.6, a responsible agent in 5.9) go into your own `requests` field, not into `requestsRouted`.

- **To `MERGE`, or to a file you may edit** (root `package.json` scripts or dependencies, the lockfile, `.gitignore`, `playwright.config.ts`, the root Vitest configuration, `ci.yml`, per README 6): carry it out when it is additive, consistent with `SPEC.md` and `CONTRACTS.md`, and needs no design decision (for example the `.gitignore` line for `site/public/katex/` or for `packages/engine/test/golden/coverage.json`). Commit it as `MERGE: request of {from}: <what>`, and in that same commit append a line recording it to your `decisions/MERGE.md` entry and the same line to `DECISIONS.md` under your stage heading (5.12); `action` names the commit. A dependency request is carried out in root `package.json` only, and only when the requesting agent's instruction names the dependency or `SPEC.md` 7.1 lists it; otherwise route it to the orchestrator (plan: this limit is this file's, drawn from README 6, which lets `MERGE` edit root `package.json`, and from 5.14, which forbids adding "a dependency nobody's instruction names"). A pin correction requested by a red-team fixer (`RT-FIX.md` 5.5: an exact edit to a version already in root `package.json`) is carried out when the new version is the one `SPEC.md` 7.1 or a `DECISIONS.md` entry fixes; otherwise route it to the orchestrator. Carry out every dependency request and every pin correction the same way: add the exact pin to root `package.json`, then apply steps 2 to 4 of 5.4 (delete `package-lock.json`, run `npm --prefix ROOT install` once, confirm `npm --prefix ROOT ci --prefer-offline`), and stage both root `package.json` and the regenerated `package-lock.json` in the request's commit; that regeneration is the request's own (5.4 step 3). A dependency added without regenerating the lockfile is never committed, since check 1 of 5.8 (`npm ci`) fails on a lockfile out of step with `package.json`. If the regeneration or the `npm ci` of step 4 fails, restore both files with `git -C ROOT checkout HEAD -- package.json package-lock.json` and route the request to the orchestrator with the output. A request to change `site/package.json` is not yours (README 6 gives you no edit right there outside a conflict, 5.3 and 5.4): route it to the orchestrator.
- **A dependency you add** is recorded as `SPEC.md` 9.3 requires ("any added dependency, whether shipped to the reader or used only by the build, is recorded in `DECISIONS.md` with its version and licence, and with its size if it is shipped"): in the same commit, append a line to your `decisions/MERGE.md` entry and the same line to `DECISIONS.md` under your stage heading, giving the package, the exact version, the licence (from its `package.json` `license` field under `node_modules/`), and either the shipped size (the change in the `npm run size` table, filled in after 5.8 by a further appended line) or "not shipped, build only". The later line goes in a commit that touches only `decisions/MERGE.md` and `DECISIONS.md`, so the checks need no rerun.
- **To an agent of a later stage or phase** (by its id, or by the area the README 6 table gives it): `routedTo` is that agent id and its stage; `action` is "carried in the merge report for the orchestrator to pass on". You do not edit that area.
- **To an agent whose stage is over**, to the owner, to a red-team lens, or anything that changes a contract, a convention or a test: `routedTo` is `orchestrator`, with the reason.
- **To an agent of this stage** (two agents of one stage asking each other): `orchestrator`, since both have finished.

Requests are never silently dropped and never carried out by editing another agent's source or tests.

### 5.8 The checks

Run from `ROOT` through `npm --prefix ROOT`, one command per Bash call, each output saved to `reports/merge-P{k}-{s}/NN-<command>.log` (on a red-team round, `reports/merge-P{k}-redteam-round{r}/NN-<command>.log`) with a last line `exit=<status>`:

1. `npm --prefix ROOT ci --prefer-offline`
2. `npm --prefix ROOT run typecheck`
3. `npm --prefix ROOT test` (the engine suite with its golden and property tests, and `site/tests/unit`)
4. `npm --prefix ROOT run build`, then `npm --prefix ROOT run e2e`, then `npm --prefix ROOT run size`.

Step 4 runs at every merge, whatever the diff: `SPEC.md` 7.7 makes the build failures ("the build fails on an unknown `<Cite>` key or an unresolved `<G>` or `<Tex>` path") a requirement at "every merge" and the Performance row asks for "sizes: every merge". The browser suite includes the run without JavaScript, which 7.7 requires "for every merge that touches a lesson or a tool"; running it at every merge satisfies that. The workflow prompt may say the stage "did not touch site code"; that hint never removes a check. The only exception is the stub of section 3: before `P0-A6`'s branch is on `main`, `e2e` and `size` print `not yet implemented: P0-A6` and exit 2, recorded as "not yet available".

Rules for the checks:

- One Playwright run at a time (README 3.4, `COMMON.md` 4.5): before `npm run e2e`, `pgrep -fl playwright` prints nothing that belongs to another run; if it does, wait for it with Monitor rather than start a second one. After the suite, stop any `astro preview` you started (`pkill -f "astro preview"` only if `pgrep` shows one of yours).
- A test that fails, then passes on one rerun of the same command, is flaky: record both runs and the test name in the merge report and in `openQuestions` as a lead for the red team. Never rerun a second time. A flaky test counts as a failure: the check is not green, and the stage is not green, so 5.9 applies to it (a flaky test is not one of the integration-level kinds, so `main` goes back to the start commit and you report `blocked`). The rerun is diagnostic only and never turns the failure into a pass. The same holds for a test that Playwright itself retried and reports as flaky, even when the command exited 0. Authority: `SPEC.md` 7.7, "100 percent pass; required for every merge" for the golden tests and "required for every merge" for the properties; `GATE.md` 5.8 reads it the same way ("A test that fails fails its item, at its first failure. There is no retry that turns a failure into a pass"), and a `main` that `MERGE` called green must not fail `GATE` on the same test.
- If Playwright reports a missing browser, run `npx --prefix ROOT playwright install chromium webkit` once; that is an installation, not a retry.
- Record the summary line of each command (tests passed and failed, the sizes table of `npm run size`) in `commandsRun`. Never report a check you did not run.
- After the checks, recompute the three hashes of 5.1; they must still equal `CONTRACTS.md` 9.

### 5.9 When a check fails

You may fix integration-level breakage only, the kind that exists because two correct branches met:

- an import path or alias that moved (`@engine`, `@components/*`, `@lib/*`);
- a missing or duplicated export in a barrel file (`packages/engine/src/index.ts`, `site/src/components/content/index.ts`);
- the tool registry wiring (`site/src/tools/index.ts` collecting `site/src/tools/registry/T{nn}.ts`), a route that lists a tool, a page that imports a component by an old path;
- a file path or name that `CONTRACTS.md` fixes and one side spelled differently, fixed toward `CONTRACTS.md`;
- a provisional unverified id (5.6), a `.gitignore` line, a root script name that `CONTRACTS.md` 1 fixes.

Each fix is the smallest edit that restores the contract, made in its own commit `MERGE: integration fix after {agents}: <what>`, recorded under `deviations` with spec `README 3.2` and the file. The same commit appends a line naming the fix to your `decisions/MERGE.md` entry and the same line to `DECISIONS.md` under your stage heading (5.12). Then rerun the failed check and every check after it.

Everything else is not yours to fix: a failing golden or property test, a wrong value, a failing acceptance test of a tool or lesson, a type error inside one agent's own code, an axe violation, a size over budget. Then:

- Find the branch responsible (the failing file's owner in the roster; `git -C ROOT log --oneline <start>..HEAD -- <path>`).
- Move `main` back to the start commit, which is the last green commit: `git -C ROOT reset --hard <start>`. You never reset to an intermediate commit of this run (the checks run once, after every merge, so no intermediate commit was verified green, and a reset there would leave merges on `main` without their decisions fold), never below the start commit, and never touch another branch. The reset also removes the fold commit and every number of 5.6 assigned in this run; none of them was green on `main`, so a rerun assigns them again from the file. Record the numbers you had assigned in the merge report, marked "withdrawn by the reset". The agents' branches keep their work.
- Report `status: blocked`, with the failing command, its exit status and the relevant output lines (quoted, not paraphrased) in the merge report and the handoff, and the responsible agent under `requests` to the orchestrator.
- Keep every worktree (5.10), so a rerun can continue.

### 5.10 Worktrees

- Only when `main` is green after the run: for each merged agent, `git -C ROOT worktree remove <path>` with the path the agent reported. If git refuses because the worktree has uncommitted or untracked changes, do not pass `--force`: run `git -C <path> status --porcelain`, list what is there in the merge report, keep the worktree, and add a line to `openQuestions` (the agent left work uncommitted).
- Keep every branch (`git branch -d` is never run), and keep the worktrees of agents not merged.
- Run `git -C ROOT worktree prune` once at the end and record `git -C ROOT worktree list`.

### 5.11 The merge report `reports/merge-P{k}-{s}.md`

Sections, in this order:

1. Header: phase, stage (or round), date, start commit, final commit of `main` (`git -C ROOT rev-parse HEAD` after your last commit), status, and the sentence "main is green at <sha>" or "main left at <sha>, the last green commit".
2. Preconditions (5.1), with the commands and their output.
3. Branches merged, in order: agent, branch, worktree, the agent's status, the merge commit, the files changed, the files outside ownership and what you did with them.
4. Branches not merged, with the reason.
5. Conflicts resolved, one line each with the authority (5.3, 5.4); conflicts reported as needing a decision, with both sides quoted.
6. Fragments folded into `DECISIONS.md` (5.5), and agents without a fragment.
7. Unverified items assigned or reserved (5.6).
8. Requests routed (5.7).
9. Checks (5.8): each command, exit status, summary line, log path; the sizes table; flaky reruns.
10. Integration fixes (5.9).
11. Worktrees removed and kept (5.10).
12. Deviations reported by the merged agents (and at stage 0.2 by `P0-A1`), copied from their reports and fragments, each with your verdict of 5.15 and its authority: accepted, carried out as a request, or passed to the orchestrator as a design question.

The file is not committed (`CONTRACTS.md` 1: `reports/` is ignored except `gate-*.md`); `GATE` reads it from disk in the same checkout. Never `git add -f` it.

### 5.12 Your own fragment

`decisions/MERGE.md`, appended, one entry per run headed `## <date> MERGE: P{k} stage {s}` (or red-team round {r}), in the form of `COMMON.md` 5.1. Record each conflict resolved and its authority, each integration fix, each request carried out (with version, licence and shipped size for a dependency, as 5.7 and `SPEC.md` 9.3 say), each unverified item assigned or reserved with its proposer and proposed fallback, each deviation verdict of 5.15, each branch not merged, and, if nothing of the kind happened, the sentence "No choice was needed." The entry is written in two parts:

- At step 4 of section 8, the items known by then (conflicts, deviation verdicts, branches not merged, unverified items) go into the entry and are copied into `DECISIONS.md` under your stage heading in the same commit as the fold.
- Each later commit of the run that carries out a request (5.7) or an integration fix (5.9) appends its own line to the entry and the same line to `DECISIONS.md`, in that same commit. If "No choice was needed." was written at step 4 and a later item follows, leave that sentence and append the item after it.

So after every commit of yours, `decisions/MERGE.md` and `DECISIONS.md` agree, and `GATE` has nothing of yours to fold.

### 5.13 A red-team fix round

The red-team workflow launches you with fix branches `fix/P{k}-<cluster>` from `RT-FIX` agents. Treat each as a build branch: everything above applies, with these differences. The ownership of a fix branch, for the "Files outside ownership" check of 5.1, cannot be read from findings or a handoff, because the round prompt (`workflows/redteam-phase.js`, `mergePrompt`) carries only `agent`, `branch`, `worktree`, `filesChanged`, `decisionsFragment` and `deviations`, and the roster has no entry for a fixer. Use instead (plan: README 6 does not list `RT-FIX`): the cluster's area, read from the branch name `fix/P{k}-<cluster>` (the cluster name is a path such as `packages/engine/src`); the test files and fixtures `RT-FIX.md` 7 gives a fixer; and its fragment `decisions/RT-FIX-P{k}-<cluster slug>.md`. A changed file outside the area must appear in the branch's `deviations` (`RT-FIX.md` 10: `deviations` holds "every file outside the cluster area"); such a file is a cause fix, which `RT-FIX.md` 5.4 item 1 allows wherever the cause lies and the last paragraph of `RT-FIX.md` 5.5 grants explicitly for the source files of `packages/engine/src/`, `site/src/` and `scripts/`; record it in the merge report, give the deviation its verdict under 5.15, and look for a conflict with another fixer of the round that touched the same file. A file outside the area with no `deviations` entry, or a file that `RT-FIX.md` 5.5 says a fixer never changes (including `.gitignore`, `playwright.config.ts`, the root Vitest configuration, `ci.yml`, root `package.json` and the lockfile, which it reserves for `MERGE` and `GATE`), is recorded under `deviations` against the fixer and judged under 5.3. A flagged cause fix in a file outside those three directories that is not on the 5.5 list (for example `site/astro.config.mjs`) is neither granted nor forbidden by `RT-FIX.md` (plan): judge it under 5.15 on its diff like any other deviation, and never as a breach for its location alone. Tests on a fix branch follow `RT-FIX.md` 7 and 5.3: the branch adds its adopted regression tests (one permanent test per `fixed` finding, `RT-FIX.md` 4, with `// regression: <finding id>` above it; a tool's test joins its file in a `describe('regressions')` block), and it may edit existing tests of any area in the direction of strength only, when a finding says a test is weak. Both are normal and need no finding that the test "was wrong". An edit in the direction of weakness (a removed assertion, a loosened tolerance, a `skip` or `.only`, a changed expected value, a looser comparison helper; `RT-FIX.md` 5.5, `COMMON.md` 4.4) is a conflict needing a decision under 5.3: the branch is not merged. Record every edited existing test file in the merge report with the direction you read in its diff. The fragments are `decisions/RT-FIX-P{k}-<cluster slug>.md`, where `<cluster slug>` is the cluster name with every `/` replaced by `-` (for example `packages-engine-src`; `RT-FIX.md` 4, plan: a file name cannot hold the slashes), and the fixer's agent id is `RT-FIX-P{k}-<cluster slug>`; the branch keeps the cluster name, `fix/P{k}-<cluster>` (`CONTRACTS.md` 10). Take the path from the report's `decisionsFragment` when it is given. A fragment is optional for a fixer: one that made no decision and wrote no request writes none (`RT-FIX.md` 5.9), and 5.5 records that as "no fragment (none needed, RT-FIX 5.9)", not as a deviation. The merge commits use the subject of 5.2 for a round, the fold commit is `MERGE: P{k} red-team round {r} decisions`, and the `DECISIONS.md` heading is the round heading of 5.5. Run every check of 5.8, as at every merge. The report file is `reports/merge-P{k}-redteam-round{r}.md` and the logs go to `reports/merge-P{k}-redteam-round{r}/`. The red-team workflow passes each fix branch with `agent`, `branch`, `worktree`, `filesChanged`, `decisionsFragment` and `deviations` only, with no `requests` and no `proposedUnverifiedItems` and no list of agents that did not finish: 5.6 then has nothing to number; write "none in the prompt" in section 7 of the merge report. 5.7 still has work: `RT-FIX.md` 5.5 leaves you edits as `needs-decision` findings "with the exact edit written out under `requests`, for `MERGE` to make" (root `package.json` or the lockfile; `.gitignore`, `playwright.config.ts`, the root Vitest configuration and `ci.yml`; the include pattern of its section 9, trap 16), and 5.9 has the fixer write the same request into its fragment. Since the prompt omits `requests`, read every fragment you fold for requests (an entry that names a file, an old text and a new text, or asks `MERGE` or `GATE` for an edit) and route each one under 5.7: carry it out when it is yours and meets 5.7, route an edit to `CLAUDE.md`, the licences, `deploy.yml` or `links.yml` to the orchestrator for `GATE` on the owner's instruction, and anything else to the orchestrator. Section 8 of the merge report lists them with "from the fragment" as their source. An edit you make here does not commit the fixer's reproducer, which stays on the lens branch; say in the `handoff` which finding the edit serves, so that the lens rerun of README 5.3 step 5 tests it. Deviations in the prompt get your verdict under 5.15. Sections 5.3, 5.4 and 5.9 still apply; a request you raise yourself goes into the merge report and the `handoff`, since the round JSON has no `requests` field. The prompt asks for a shorter final JSON, `{agent, status, commit, handoff}`; give exactly that shape, with `agent` `MERGE` and `commit` the green commit of `main`.

### 5.14 What MERGE never does

- Edit anything under `reference/`, or `golden_data.json` in any form, or a hash in `CONTRACTS.md` 9.
- Change a convention of `COMMON.md` 2, a label, the sign of the legal move, a cap of `SPEC.md` 5.6, a comparison rule of the golden harness (`CONTRACTS.md` 3), or an interface of `CONTRACTS.md`.
- Edit a test so that it passes: no changed assertion, no loosened tolerance, no `.skip` or `.only`, no deleted test, no golden value typed into a source file. This holds for P0-A4's seed test of `unverified.json` too (5.6).
- Implement, complete or correct an agent's feature, tool, lesson or engine function, or rewrite its prose.
- Guess a design decision in a conflict.
- Set an item of `content/unverified.json` to `closed`, change an existing item, or remove one. Closing is the owner's act (`SPEC.md` 9.3).
- Reword, shorten or correct a decisions fragment while folding it.
- Push, pull, fetch, create or move a tag, delete a branch, rebase, amend a commit of an agent, merge `main` into a branch, or `git reset` below the start commit.
- Run `npm install` other than a regeneration of 5.4 (one per merge whose lockfile conflicts, one per dependency request carried out under 5.7), raise a cap, add a dependency nobody's instruction names, or edit `CLAUDE.md`, the licences, `deploy.yml` or `links.yml` (README 6: `GATE` on the owner's instruction).
- Edit anything under `build-plan/` (the orchestrator's).

### 5.15 Deviations the agents report

`COMMON.md` 4.4: "A deviation you believe necessary goes in your report under `deviations`, with the reason; `MERGE` decides." You give every reported deviation exactly one verdict, record it in `deviationsDecided` (section 10), in section 12 of the merge report and in your `decisions/MERGE.md` entry (copied into `DECISIONS.md`, 5.12), with its authority. The three verdicts (plan: `COMMON.md` 4.4 says that `MERGE` decides but not how; README 3.2 bounds it, since "a conflict that needs a design decision is reported, not guessed"):

- **Accepted.** The branch did what it reports, and a sentence of `SPEC.md`, `CONTRACTS.md` or the agent's own instruction allows the alternative, or the deviation stays inside the agent's ownership and touches nothing on the list below. Quote the sentence. Examples: the root Vitest configuration written as `vitest.config.ts` instead of the roster's `vitest.workspace.ts` (`CONTRACTS.md` 1 allows either name; read the roster's owns list with the substitution); a Pages publisher other than the official Astro action, recorded with its reason as `P0-A1` 5.10 asks; an export added to `packages/engine/src/index.ts` that `CONTRACTS.md` 2.4 already lists (`RT-FIX.md` 5.5). The branch is merged as usual.
- **Carried out as a request.** The deviation is a proposal the branch did not make, and the change lies in a file you may edit (5.7, section 7), is additive, is consistent with `SPEC.md` and `CONTRACTS.md` and needs no design decision. Treat it as a request under 5.7, with `from` the agent.
- **Passed to the orchestrator.** The deviation changes, or proposes to change, something on the list of `COMMON.md` 4.4 and 5.14: a convention of `COMMON.md` 2, a label, the sign of the legal move, a cap of `SPEC.md` 5.6, a comparison rule of the golden harness, an interface or a fixed path of `CONTRACTS.md`, or anything under `reference/` or `build-plan/`; or two readings of `SPEC.md` are each defensible. That is a design question, which you never decide (5.14). If the branch already made the change, it is a conflict needing a decision: do not merge it, as 5.3 says for such a conflict (`notMerged` with the deviation quoted, `status` by 5.3's rule); if the branch only proposed it, merge the branch and route the proposal under 5.7 to the orchestrator with the reason.

A deviation you cannot place under one of the three is passed to the orchestrator, never guessed.

### 5.16 Stage 0.2: taking up `P0-A1`

Stage 0.1 has no `mergeAfter` (`build-plan/rosters/phase-0.json`), so the `MERGE` of stage 0.2 does for `P0-A1` what a `MERGE` after stage 0.1 would have done. `P0-A1` 5.8 says of `DECISIONS.md`: "No entries: `MERGE` copies yours in at the end of stage 0.1 (or `GATE` at G0)". Neither 5.5's diff from your start commit nor `GATE.md` 5.9's diff from the root commit shows `decisions/P0-A1.md`, because the root commit added it; so this step is the one that folds it.

- Check the root commit once: `git -C ROOT rev-list --max-parents=0 HEAD` prints one SHA, and `git -C ROOT log -1 --format=%s <that sha>` prints `P0-A1: scaffold` (`P0-A1` 6: "`MERGE` checks it at the end of stage 0.1 (plan)"). Record both outputs in the precondition section of the merge report; a different subject goes into `openQuestions`, and you merge on.
- Fold `decisions/P0-A1.md` verbatim under your stage 0.2 heading, before the fragments of the stage, in the fold commit of 5.6, and list it first in `fragmentsAppended`. Skip only the entries whose headings `DECISIONS.md` already has. This is the entry `SPEC.md` 9.3 needs for the defaults `P0-A1` relied on ("When an open decision of section 10 blocks work, take the default, and add a line to `DECISIONS.md` with the date and the reason", its fragment holds D1, D3, D4 and D18 and the registry table of its 5.2, `P0-A1` 5.8) and for the dependencies it added ("any added dependency, whether shipped to the reader or used only by the build, is recorded in `DECISIONS.md` with its version and licence, and with its size if it is shipped"; `P0-A1` adds `@astrojs/check` and `svelte-check` beyond 7.1). If the file is missing, record it under `deviations` against `P0-A1` and in `openQuestions`.
- Read `P0-A1`'s deviations and requests from that fragment, and from its JSON report too if the orchestrator's prompt gives it. Decide each deviation under 5.15 and route each request under 5.7, with `from` `P0-A1`. Expect at least: the Vitest file name if it differs from the roster's, the Pages publisher if it is not the official Astro action, the proposal on `reports/discrepancies/`, and requests to `P0-A6` (`P0-A1` 10). A request to `P0-A6` falls under the rule "to an agent of this stage" of 5.7, since `P0-A6` ran in stage 0.2 and has finished: first record whether `P0-A6`'s merged branch already did it (then `action` says so and names the commit); if not, carry it out when it is yours under 5.7, else `routedTo` is `orchestrator`.
- The proposal to add `!reports/discrepancies/` to `.gitignore` is passed to the orchestrator under 5.15 and not written: `CONTRACTS.md` 1 describes `reports/` as "gate reports, discrepancy scripts, release archives (plan; .gitignore'd except gate-*.md)", so the line would change a contracted interface, which you never do (5.14), and `CONTRACTS.md` is under `build-plan/`. Quote `P0-A1`'s reason and `COMMON.md` 2's path `reports/discrepancies/<your-id>-<n>.py` in the request.
- If you could not read `P0-A1`'s report, say so in the merge report: its `deviations` and `requests` were taken from the fragment only.

## 6. Acceptance

The template asks each line for the gate it belongs to. MERGE belongs to no phase gate of `SPEC.md` 9.1: every line below is required at every merge (the "every merge" column of `SPEC.md` 7.7 and README 3.2), so each line ends with its gate, "Gate: every merge" (or, for a line that holds only in some runs, the runs it holds in), and its proof is a named command or a field of your report rather than a test file, since MERGE writes no tests.

- [ ] Preconditions recorded: top level, branch `main`, clean status, start commit, Node version, the three hashes equal `CONTRACTS.md` 9. README 3.2; `CONTRACTS.md` 9. Proof: merge report section 2. Gate: every merge.
- [ ] Every finished branch merged once, in roster order, with `--no-ff` and a subject naming the agent. README 3.2; `CONTRACTS.md` 10. Proof: `git -C ROOT log --merges --format='%h %s' <start>..HEAD`. Gate: every merge.
- [ ] No merged change under `reference/`, and the hashes unchanged after the checks. `CONTRACTS.md` 9. Proof: `git -C ROOT diff --stat <start>..HEAD -- reference/` empty; `shasum` output. Gate: every merge.
- [ ] Every conflict resolved toward `SPEC.md` and `CONTRACTS.md`, or reported. README 3.2. Proof: `conflictsResolved`, merge report section 5. Gate: every merge.
- [ ] When a `package.json` or `package-lock.json` conflicted, or a dependency request was carried out: the lockfile regenerated by the protocol of 5.4, once for each such merge or request, never resolved by hand, and `npm ci` succeeds on it. 5.4 and 5.7 (plan: the protocol is this file's); `COMMON.md` 3 (exact pins); README 6 (`MERGE` may edit the root `package.json` and the lockfile). Proof: one `conflictsResolved` entry with file `package-lock.json` and resolution `regenerated` per such merge, the request commits of `requestsRouted`, and the `npm ci --prefer-offline` line of `commandsRun` (check 1 of 5.8, exit 0). When neither happened, the line reads "not applicable" and only the `npm ci` proof stands. Gate: every merge where a `package.json` or the lockfile conflicted or a dependency request was carried out.
- [ ] Every fragment of the stage folded verbatim under the stage heading. README 3.2, 6; `SPEC.md` 9.3. Proof: `git -C ROOT diff <start>..HEAD -- DECISIONS.md`; `fragmentsAppended`. Gate: every merge.
- [ ] Every proposed unverified item numbered from the next free `E<n>`, `open`, gate `G6`, or reserved under 5.6. Appendix E item 17; `SPEC.md` 7.3, 9.3. Proof: `git -C ROOT diff <start>..HEAD -- site/src/content/unverified.json`; `unverifiedItemsAssigned`. Gate: every merge.
- [ ] At stage 0.2: `decisions/P0-A1.md` folded first under the stage heading, the root commit's subject checked, and `P0-A1`'s deviations and requests taken from its fragment (5.16). `P0-A1` 5.8; `SPEC.md` 9.3. Proof: `git -C ROOT diff <start>..HEAD -- DECISIONS.md`; `fragmentsAppended` starting with `decisions/P0-A1.md`. Gate: the merge of stage 0.2.
- [ ] Every reported deviation has one verdict of 5.15 with its authority. `COMMON.md` 4.4 ("`MERGE` decides"); README 3.2. Proof: `deviationsDecided`; merge report section 12. Gate: every merge.
- [ ] Every request routed. README 6. Proof: `requestsRouted` has one entry for each entry of the merged reports' `requests`, plus one for each request written in a folded fragment and not already in a report (5.7, 5.13, 5.16), plus one for each request named in a not-merged agent's handoff or `openQuestions` (5.7); the requests you raised yourself (5.3, 5.4, 5.6, 5.9) are each in your `requests`. Gate: every merge.
- [ ] Golden and property tests pass, and the type-check passes; a flaky test counts as a failure (5.8). `SPEC.md` 7.7 ("100 percent pass; required for every merge"). Proof: `npm test`, `npm run typecheck` in `commandsRun`. Gate: every merge.
- [ ] At every merge: the build succeeds (no unknown `<Cite>`, no unresolved `<G>` or `<Tex>` path), the browser suite passes including the run without JavaScript and the axe scans, and the sizes are within `SPEC.md` 7.6. `SPEC.md` 7.7 (build failures, sizes: every merge; without JavaScript: every merge that touches a lesson or a tool). Proof: `npm run build`, `npm run e2e`, `npm run size` in `commandsRun`. Gate: every merge.
- [ ] `main` green at the final commit, or reset to the start commit with `status: blocked`. README 3.6. Proof: header of the merge report; `git -C ROOT rev-parse HEAD`. Gate: every merge.
- [ ] Merged worktrees removed when `main` is green, kept after a reset, branches kept. 5.10 (plan: no passage of README or `CONTRACTS.md` names worktree removal; README 3.2 gives each agent its worktree and branch). Proof: `git -C ROOT worktree list`, `git -C ROOT branch --list`. Gate: every merge.
- [ ] `reports/merge-P{k}-{s}.md` written with the sections of 5.11; `decisions/MERGE.md` entry written, and every line of it copied into `DECISIONS.md` in the commit that added it (5.12). Proof: the files; `git -C ROOT diff <start>..HEAD -- decisions/MERGE.md DECISIONS.md`. Gate: every merge.
- [ ] Every dependency you added recorded with version, licence and shipped size or "not shipped, build only". `SPEC.md` 9.3. Proof: the lines of 5.7 in `DECISIONS.md`. Gate: every merge that added a dependency.

## 7. Files

- **You own**: the merge commits on `main`; `decisions/MERGE.md`; `reports/merge-P{k}-*.md` and their log directories.
- **You may edit with the stated protocol**: `DECISIONS.md` (5.5, 5.12: append only); `site/src/content/unverified.json` (5.6: append `open` items only); root `package.json` and `package-lock.json` (5.4, 5.7; README 6 "Root files"); `site/package.json` and `packages/engine/package.json` only while resolving a conflict in them (5.3, 5.4), never on request; `.gitignore`, `playwright.config.ts`, the root Vitest configuration and `.github/workflows/ci.yml` (5.7: additive, on request); the files a conflict touches, while resolving it (5.3); the files of 5.9, for integration fixes only; the `item` attribute of `<Unverified>` in a lesson (5.6).
- **You must not touch**: everything else; in particular `reference/`, `build-plan/`, `CLAUDE.md`, the licences, `deploy.yml`, `links.yml`, any test assertion, the golden harness, any agent's branch, any worktree's files.

## 8. Order of work

1. Read section 2's list; read the prompt; note the start commit.
2. Preconditions (5.1). Stop here if one fails.
3. For each branch in order: inspect (5.1), give each deviation its report names its verdict (5.15; a deviation the branch made that is a design question keeps the branch out), merge (5.2), resolve conflicts (5.3, 5.4), check `reference/` and the shared files.
4. Fold the fragments (5.5; at stage 0.2 `decisions/P0-A1.md` first, 5.16), assign the unverified items (5.6), write your own fragment (5.12); commit once.
5. Route the requests of the reports and of the folded fragments (5.7, 5.13, 5.16); carry out the ones that are yours, one commit each, each appending its line to `decisions/MERGE.md` and `DECISIONS.md` (5.12).
6. Run the checks (5.8). On failure, 5.9: an integration fix is one commit that also appends its line (5.12); anything else resets `main` to the start commit.
7. When green: remove the merged worktrees (5.10).
8. Write the merge report (5.11) and return the JSON (section 10).

If the run is cut short, the order guarantees that what is on `main` is either the start commit or merges followed by their decisions commit; a stage is never left with merges and no fold. If you cannot reach step 6, reset to the start commit and report `blocked`.

## 9. Traps

- **Worktrees inside the checkout.** If the harness places worktrees under `ROOT` (for example `ROOT/.claude/worktrees/`), `git status --porcelain` may list them as untracked. They are not dirt; check them against `git worktree list` before you stop. Never add them to a commit, and never edit `.gitignore` for them unless a request asks.
- **`git add -A`.** It would pick up build output that a missing `.gitignore` line leaves visible (`coverage.json`, `site/src/generated/`, `site/public/katex/`). Name every path you stage.
- **A clean merge can still be wrong.** Two additive edits to `index.ts` or `ToolFrame.svelte` can merge without a conflict and still produce a duplicate export or two buttons with one `data-` hook. The type-check and the browser suite find these; the fix is integration-level (5.9).
- **Positions against labels, transposition, roads in against out.** A conflict inside engine or drawing code may look like a cosmetic difference and be a convention difference (`COMMON.md` 2). If the two sides differ in an index, a transpose or a sign, it is a design question: report it.
- **The lockfile.** Never pick `--ours` or `--theirs` for `package-lock.json`, and never run `npm install` twice for one merge or one request, or `npm update`. A second branch of the stage that conflicts on the lockfile after an earlier merge regenerated it gets its own regeneration (5.4); resolving it by keeping the earlier regenerated file is picking a side. After the regeneration, a `^` or `~` that appears in a `package.json` was not there before; remove nothing and add nothing to fix it, report it.
- **Fragments are history, not prose.** Fold them even when they look wrong; correcting them in `DECISIONS.md` would hide what the agent decided.
- **Next free number.** Count from the file and from reservations in `DECISIONS.md`, not from the proposals of this stage alone; two lesson agents in one stage both expect `E18`.
- **Phase 0 stubs.** Before `P0-A6`'s branch is merged in stage 0.2, `e2e` and `size` are stubs exiting 2; after it, they are real. Merge `P0-A6` in its roster place (third in 0.2) and run the checks after all three branches.
- **Memory.** 8 GB on this machine: one Playwright run, one `astro preview`, no parallel builds. Run the checks once, after every merge and the commits of steps 4 and 5, not after each merge. Locate a failure from the failing file's owner and `git log` (5.9), not by checking out or resetting to an intermediate commit.
- **Shell rules** (`COMMON.md` 4.6): no `cd`, no multi-line inline scripts, absolute paths, `git -C ROOT` and `npm --prefix ROOT` everywhere.
- **Git identity.** Use the identity the repository is configured with. If git refuses to commit for lack of one, pass the identity `P0-A1` recorded in `DECISIONS.md` with `git -c user.name=... -c user.email=...` on that command only; never write git configuration.

## 10. Report

The JSON of `COMMON.md` 5.2, with `agent` `"MERGE"`, `branch` `"main"`, `worktree` `ROOT`, `decisionsFragment` `"decisions/MERGE.md"` and `proposedUnverifiedItems` `[]`, extended with these fields:

```json
{
  "agent": "MERGE",
  "status": "done | partial | blocked",
  "branch": "main",
  "worktree": "/Users/john/Claude/MutationGame",
  "startCommit": "<sha>",
  "commit": "<sha of main when you finished: green, or the start commit after a reset>",
  "reportFile": "reports/merge-P1-1.1.md",
  "commits": ["<sha> MERGE: P1-A1 (agent/P1-A1) into main, P1 stage 1.1", "..."],
  "filesChanged": ["DECISIONS.md", "decisions/MERGE.md", "site/src/content/unverified.json", "..."],
  "commandsRun": [{"cmd": "npm --prefix /Users/john/Claude/MutationGame test", "exit": 0, "summary": "612 passed"}],
  "acceptance": [{"item": "README 3.2: every finished branch merged in roster order", "status": "pass", "test": "git log --merges <start>..HEAD"}],
  "deviations": [{"spec": "README 3.2", "what": "integration fix: export of resolveBoard added to site/src/lib/index.ts", "why": "P1-A2 and P1-A5 merged cleanly but the barrel lacked the export"}],
  "requests": [{"to": "orchestrator", "what": "..."}],
  "proposedUnverifiedItems": [],
  "decisionsFragment": "decisions/MERGE.md",
  "openQuestions": ["..."],
  "handoff": "two or three sentences: the commit main is at, whether it is green, what is not merged and why",
  "mergedBranches": [{"agent": "P1-A1", "branch": "agent/P1-A1", "worktree": "/path", "agentStatus": "done", "mergeCommit": "<sha>", "worktreeRemoved": true}],
  "notMerged": [{"agent": "P1-A4", "branch": "agent/P1-A4", "reason": "blocked report; or conflict needing a decision, both sides quoted in the merge report"}],
  "conflictsResolved": [{"agent": "P1-A3", "file": "site/src/components/board/Roads.svelte", "resolution": "owner's side (P1-A3)", "authority": "README 6"}],
  "fragmentsAppended": ["decisions/P1-A1.md", "decisions/P1-A2.md", "decisions/MERGE.md"],
  "unverifiedItemsAssigned": [{"id": "E18", "proposedBy": "P1-A9", "statement": "...", "inFile": true, "usedIn": "site/src/content/modules/m1-mutation.mdx:42"}],
  "requestsRouted": [{"from": "P0-A3", "to": "P0-A6 or MERGE", "what": "ignore site/public/katex/", "routedTo": "MERGE", "action": "<sha> MERGE: request of P0-A3: .gitignore line"}],
  "deviationsDecided": [{"agent": "P0-A1", "what": "propose !reports/discrepancies/ in .gitignore", "verdict": "accepted | carried out as a request | passed to the orchestrator", "authority": "CONTRACTS 1: reports/ .gitignore'd except gate-*.md; MERGE 5.14"}]
}
```

`status` is `done` when every finished branch is merged and `main` is green at `commit`; `partial` when `main` is green but a branch was left out for a reason that does not stop the stage (an agent that changed `reference/`, a conflict on a branch nothing later depends on); `blocked` when `main` was reset to the start commit, the last green commit. A check with a failed or flaky test is not green (5.8), so `done` and `partial` both require every check of 5.8 to pass with no failure in any run. `acceptance` has one line per checklist line of section 6. On a red-team round, return only `{agent, status, commit, handoff}` (5.13).
