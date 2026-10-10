# RT-VERIFY: finding verifier

Applies from phase 0, to every lens and every finding. Runs in: reproduce mode in a fresh worktree checked out at the gate commit (the harness creates the worktree; you detach it at the gate commit); refute mode read-only against the gate commit, wherever the harness runs you.

Before this file you have read `build-plan/RED-TEAM-COMMON.md` (section 6 is your brief; sections 1 to 4 bind you as they bind every red-team agent) and `build-plan/CONTRACTS.md`. Everything there applies.

## 1. Mission

Every finding a lens reports is checked by two verifiers who do not see each other's work. One tries to make the behaviour happen again from a clean checkout of the gate commit using only what the finding states. The other tries to show, from the text of `SPEC.md`, `CONTRACTS.md` and the oracle, that the finding is wrong. You are one of the two: you receive one finding and one mode, and you return one verdict. A finding is confirmed only when it reproduces and is not refuted; a confirmed finding sends a fixer into the code and a permanent test into the suite, and a dropped finding is dropped for the phase. A verifier who reproduces loosely sends fixers after ghosts; a verifier who refutes on taste buries a real bug. Your output is a verdict with evidence, never a fix and never an improved finding.

## 2. Read first

In this order. Reproduce mode may read items 4 to 8 lightly; it still needs item 3 to know what value it is looking for.

1. `RED-TEAM-COMMON.md` section 6 (the brief), then section 2 (what is and is not a finding), 3 (standards of evidence), 4 (the severity rubric your adjustment uses), 1 (what a red-team agent may touch; the verifier may touch less, see section 8 here).
2. The finding itself, whole, as the harness prompt gives it (section 3 here says what each field is for).
3. The passage the finding cites in `specRef`, with its whole section (from its heading to the next heading of the same level) and any section the passage sends you to. Note the provenance label of the sentence the finding rests on (`SPEC.md` 0.3: "Statements with no label in section 2 are definitions."; outside section 2 an unlabelled sentence is simply unlabelled; [V] verified by computation; [S] and [S2] sourced; [D] a design decision; [U] unverified).
4. `SPEC.md` 0.2 item 2: when a mathematical statement of the specification and the oracle disagree, the oracle wins and the discrepancy goes to the owner. `RED-TEAM-COMMON.md` section 2 turns that into a rule: such a case is a note, not a finding.
5. `SPEC.md` 9.1 (the phase table: the Builds column of each row and the gate's automatic part), and the phase markers in 3 (each module's figure tables and `phase`), 4 (each tool heading carries its phase, for example "T3. Form Finder (phase 2)"), 5.3 and 5.4 (the Phase column), 5.7 (the golden table's Phase column); `CONTRACTS.md` 2.1 (module files by phase), 2.4 (signatures by phase) and 6 (presets, some with a phase).
6. `SPEC.md` 10 (decisions D1 to D19 with their defaults), and, at the gate commit, `DECISIONS.md` and every `decisions/*.md` fragment.
7. The lens file of the finding's lens, `build-plan/red-team/{lens}-{slug}.md`, in particular its section 6 ("Not a finding for this lens"), and that lens's row in `build-plan/README.md` 5.2. The slugs: RT-01 `differential-oracle`, RT-02 `convention-drift`, RT-03 `bounds-and-errors`, RT-04 `codec-attacker`, RT-05 `a11y-and-layout`, RT-06 `no-js-and-no-worker`, RT-07 `perf-budget`, RT-08 `content-rules`, RT-09 `math-claims`, RT-10 `spec-compliance`, RT-11 `test-integrity`, RT-12 `toolchain-reality`, RT-13 `reader-playtest`.
8. `reports/gate-G{k}.md`, for what the builders and the gate claimed about the area. It is not in the gate commit: GATE commits it in the report commit above the tested commit (`agents/GATE.md` 1 and 4: "the commit above it carries `reports/gate-G{k}.md`"). Read it from the report commit, which is the child of the gate commit on `main`, with `git -C <repo> show main:reports/gate-G{k}.md` (or name the report commit's sha); `git show <gateCommit>:reports/gate-G{k}.md` fails, or after a red-team round returns the previous run's report. The report's line "Gate commit (the tested commit, tagged gate-G{k}-candidate)" must name your gate commit; if it names another, say so in `evidence`. Then `reports/merge-P{k}-redteam-round{n}.md` for earlier rounds of this phase, if any. These merge reports are never committed (`agents/MERGE.md` 4: "on disk, not committed (`reports/*` is ignored except `gate-*.md`)"); MERGE runs in the primary checkout, so read them from disk at `/Users/john/Claude/MutationGame/reports/merge-P{k}-redteam-round{n}.md`, in either mode. No `git show` finds them.
9. The part of `CONTRACTS.md` that governs the finding's area: 2 (engine), 3 (golden harness), 4 (site libraries), 5 (board and tool components; 5.3 "Announcements and names" holds the exact strings of `SPEC.md` 7.5), 6 (presets), 7 (lessons), 8 (CSS tokens), 9 (reference hashes).

## 3. Your input: one finding, one mode

The harness prompt names the phase, the gate commit, your mode (`reproduce` or `refute`) and the finding as JSON. The finding has the fields of `RED-TEAM-COMMON.md` section 5, plus two the harness adds: `lens` (the reporting lens) and `branch` (`redteam/P{k}-RT-{nn}`, where the reproducer is committed). `reproducer` and `proposedFix` are optional; every other field is present. The phase is the number in the finding id `P{k}-RT-{nn}-{mm}` and the gate is `G{k}`.

| Field | Reproduce mode uses it for | Refute mode uses it for |
|---|---|---|
| `id` | `findingId`; the phase and the lens | the same |
| `severity` | the level claimed; input to section 7 | the same |
| `title`, `claim` | what the run must show; one cause | the claim to hold against the text |
| `location` | where the code is; not needed to run | the area, and which phase owns the file (`CONTRACTS.md` 2.1, `README.md` 6) |
| `expected` | the value or behaviour the finding says the text requires | the finding's reading of the passage, the first thing to check |
| `observed` | the value to compare the output with | the build's behaviour, the thing the oracle is asked about |
| `reproduction` | the command or commands to run exactly as written | read, never run |
| `specRef` | copied into `citation` | the passage to open, with its surroundings |
| `proposedFix` | ignored | ignored; you do not judge the fix |
| `reproducer` | the path or paths to apply from `branch` | may be read as text (`git -C <repo> show <branch>:<path>`) to see what it asserts; never run |
| `lens` | which lens file applies | the same, for territory |
| `branch` | the source of the reproducer | not used; never checked out |

What a mode may touch:

| | Reproduce mode | Refute mode |
|---|---|---|
| Working tree | the fresh worktree, detached at the gate commit, plus the applied reproducer files | nothing; read the build with `git -C <repo> show <gateCommit>:<path>`; the only files read from disk are the uncommitted merge reports of section 2 item 8 |
| Commands | `pwd` and `git rev-parse --show-toplevel` (4.1 step 1); `git -C <wt>` with `branch --show-current`, `rev-parse`, `status --porcelain`, `cat-file -e`, `diff --stat`, `show`, `ls-tree` and `log` (reading); `git -C <wt> checkout --detach <gateCommit>`, the one commit checkout (4.1 step 2); `git -C <wt> checkout <branch> -- <path>`, the path checkout that applies the reproducer (4.2); `git -C <wt> restore --staged --worktree <path>`, only to undo a path you applied by mistake (4.2); `npm --prefix <wt> ci --prefer-offline`; the stated reproduction; `node --version`; `grep` and `sed` on absolute paths; `python3 -I` against `<wt>/reference/` (section 6) | `git -C <repo>` with `show`, `ls-tree` and `log` only; `grep` and `sed` on absolute paths; `mkdir -p <scratch>/ref` and the output of `git -C <repo> show` redirected into a file under `<scratch>` (the reference copies `git -C <repo> show <gateCommit>:reference/<file> > <scratch>/ref/<file>`, or a decisions fragment to grep), the only redirection, and only into your scratch directory (section 6); a script file you write under `<scratch>` and run with `python3 -I` or `sh`, when it only reads with these same commands; and `python3 -I` against those copies of `reference/lie_games.py` or `reference/golden_data.json` |
| Writes | none in the repository beyond the applied files; notes in your scratch directory | notes and the extracted reference copies in your scratch directory |
| Commits, branches, `main` | none, never | none, never |

(plan) This table is the plan's reading of `RED-TEAM-COMMON.md` 1 and 6 for the two modes; those charters do not list commands.

**Paths and the shell rule.** `RED-TEAM-COMMON.md` 1 applies the shell rule of `COMMON.md` 4.6 to you: "absolute paths, no `cd` chains, no multi-line inline scripts (write a script file and run it)". Never write `cd X; ...` or `cd X && ...`. Use absolute paths in every command, and give `git`, `npm` and `npx` their directory as an argument (`git -C <dir>`, `npm --prefix <dir>`, `npx --prefix <dir>`). A Python script of more than one line goes into a file under your scratch directory, run as `python3 -I /absolute/path/script.py`. In this file, `<wt>` is the absolute path of your reproduce-mode worktree (4.1 step 1 records it), `<repo>` is the repository you read in refute mode (`/Users/john/Claude/MutationGame`, the primary checkout, which shares its commits and branches with every worktree, or `<wt>` when the harness gave you one), and `<scratch>` is your scratch directory. Commands with a `cd` or a multi-line inline script wait for an approval that nobody is there to give.

## 4. Reproduce mode

The question you answer: does the behaviour happen, from a clean checkout of the gate commit, using only the reproducer the finding names and the commands the finding states? Anything else you had to do is a reason the answer is no.

### 4.1 Where you are

1. `pwd` and `git rev-parse --show-toplevel` (both run in the directory the harness started you in, with no `cd`). The second prints `<wt>`; from here on every command names it. Then `git -C <wt> branch --show-current` and `git -C <wt> rev-parse HEAD`. Record all of these for `evidence`.
2. If `HEAD` is not the gate commit, `git -C <wt> checkout --detach <gateCommit>`. The harness's worktree may sit on a throwaway branch at the head of `main`; detaching at the gate commit changes nothing on `main` and is the only commit checkout you make (the path checkouts of 4.2 apply files; they do not move `HEAD`). Never `git checkout main`, never `git checkout <branch>` to switch to the lens branch, never `git merge`, `git rebase` or `git pull`.
3. `git -C <wt> status --porcelain` must print nothing. If it prints changes you did not make, stop and report as in 4.6.
4. `node --version` must be 22.12 or later (`COMMON.md` 3). If not, 4.6.

### 4.2 Apply only the reproducer

The reproducer is the set of files P:

- every path named in `reproducer` (several may be separated by commas, spaces or newlines);
- (plan) every path that `reproduction` names explicitly and that does not exist at the gate commit;
- (plan) every file under `redteam/` on the same branch that a file already in P imports or reads by a literal path (read each file in P first and list these; a test's imports are part of the test).

(plan) `RED-TEAM-COMMON.md` 6 says only "apply only the reproducer from the finding's branch"; the second and third items are the plan's reading of what that reproducer comprises.

Nothing else. Not the whole branch, not a file under `redteam/` that nothing in P refers to, not a changed existing file, not a changed `package.json` or lockfile.

For each path in P, before applying:

```
git -C <wt> rev-parse --verify --quiet <branch>            # the branch exists
git -C <wt> cat-file -e <branch>:<path>                     # the file is on the branch
git -C <wt> cat-file -e <gateCommit>:<path> && echo EXISTS  # must NOT exist at the gate commit
```

A lens may only add files (`RED-TEAM-COMMON.md` 1): anywhere under `redteam/`, or a new test file named `redteam-RT-{nn}-*.test.ts` or `redteam-RT-{nn}-*.spec.ts` beside the existing tests (plan: in practice `packages/engine/test/**`, `site/tests/unit/**` or `site/tests/e2e/**`; `RED-TEAM-COMMON.md` 1 says only "beside the existing tests", so a `redteam-RT-{nn}-*` test file beside any other existing test directory is also allowed). A path that exists at the gate commit, or that lies under `reference/`, `packages/engine/src/`, `site/src/`, `scripts/`, `.github/`, or among the root configuration files, is not a reproducer. Do not apply it; the verdict is `reproduced: false` with the reason (table in 4.4).

Then, for each path:

```
git -C <wt> checkout <branch> -- <path>
```

After applying, `git -C <wt> status --porcelain` must list exactly the paths of P, each as added. If it lists anything else, restore that path (`git -C <wt> restore --staged --worktree <path>`) and look again at what you did. Record the final `git -C <wt> status --porcelain` output.

It is useful, not required, to see what else the lens changed on its branch: `git -C <wt> diff --stat <gateCommit> <branch>`. If the branch modifies existing files outside P, note it in `evidence`; those changes are not applied, and if the reproduction depends on them it fails for that reason.

### 4.3 Install and run

1. `npm --prefix <wt> ci --prefer-offline`, once, for the repository root. Never `npm install` (it would change the lockfile). If `npm ci` fails on the clean tree, 4.6.
2. What every reproduction may assume without stating it: the clean checkout at the gate commit; `npm ci --prefer-offline` done; the Playwright browsers already installed on the machine (`README.md` 3.4); `python3` on `PATH` with the standard library (`SPEC.md` 5.7 and 7.7; on this machine Python 3.9.6 passes the oracle, `README.md` 10); the working directory is the repository root. Everything else must be in `reproduction`: a build (`npm run build`), a preview server, an environment variable (`RELEASE=1`, `BASE_PATH=/sub/path/`, `OUT_DIR`), a second command, the order of commands, a browser other than Chromium, a port.
3. Run exactly the command or commands of `reproduction`, in the order given, from the repository root, with no flag, path, cap, timeout or environment variable added or removed. Run them in the directory the harness started you in when `pwd` printed `<wt>` (4.1 step 1); never prefix them with `cd`. (plan) If the shell does not start at `<wt>`, the one change allowed is the one the shell rule requires: give `npm`, `npx` or `git` the directory as an argument (`npm --prefix <wt> test ...`, `git -C <wt> ...`) and write a relative path as `<wt>/<path>`; this changes where the command runs, not what it runs, and `evidence` shows the command exactly as you ran it. If a command cannot be run that way (a script that reads paths relative to the working directory), that is 4.6. A parenthetical note such as "(committed on this branch)" is a note, not a command. `RED-TEAM-COMMON.md` 3 asks for "the exact commands or steps" and says "Prefer a committed test or script that fails. For visual or screen-reader behaviour, a Playwright script that asserts the expected value and fails." (plan) If `reproduction` is prose with no command and no script ("open the page and press Tab three times"), you do not perform it: running it would mean writing a script of your own, which is a reproducer the finding did not commit and a step it did not state (section 8). The verdict is `reproduced: false`, reason "no command or script; manual steps only", and `evidence` quotes the steps. This is the plan's reading of the preference in `RED-TEAM-COMMON.md` 3 for this verifier, not a sentence of that charter.
4. Capture stdout, stderr and the exit code of each command. Keep the summary line and the assertion or diff lines that show the value.
5. Run once. (plan) Run a second time only when the first result is timing-dependent (a benchmark, a timeout, a Playwright retry, a "flaky" marker). Report both runs; `reproduced` is true only when both show the claimed behaviour. Neither `RED-TEAM-COMMON.md` 6 nor `README.md` 5.3 asks for a second run; this rule is the plan's, so that a result that holds once by chance does not send a fixer.
6. Before running, read each file of P once: it must assert the finding's claim and nothing contrary to the red team's limits (it must not write into `reference/`, edit a golden value, change a convention or a cap, or modify an existing test). (plan) A script that temporarily edits tracked files for a mutation test is acceptable only if `reproduction` says so and the tree is restored when it ends.
7. After the run, `git -C <wt> status --porcelain` must again list only P. Report anything else the reproducer left behind. A reproducer that changed anything under `reference/` is `reproduced: false` whatever it printed.
8. Resource etiquette (`RED-TEAM-COMMON.md` 1, `COMMON.md` 4.5): one Playwright run at a time; kill `astro preview` when you are done; run the whole browser suite, `npm run size` or `npm run lab` only when `reproduction` itself names that command.

### 4.4 Compare and decide

The observed value is the number, string, boolean, list or message that the finding's `observed` names, as the reproducer's assertion message or the script's output prints it. Find it in the output and compare it with `observed`, and with `expected`.

The harness prints a dropped finding's reason as `not reproduced: <reason>` (section 9), so a `reason` with `reproduced: false` never begins with "not reproduced:" itself.

| What you saw | `reproduced` | What `reason` says |
|---|---|---|
| The reproducer fails, or the script prints the disagreement, and the value equals the finding's `observed` | true | "reproduced as stated; observed matches: <value>" |
| (plan) The reproducer fails, the value differs from `observed`, but it still contradicts `expected` | true | "reproduced with a different observed value: saw <x>, finding says <y>"; the fixer needs the real value, so put both in `evidence`. `RED-TEAM-COMMON.md` 6 asks only that you report "whether the observed value matches the finding's `observed`"; counting a different value that still contradicts `expected` as reproduced is the plan's judgment, since the cause the finding names is shown |
| The reproducer passes, or the value it prints equals `expected` | false | "the reproducer passes at the gate commit" or "the build gives the expected value <v>" |
| The reproducer fails for a reason that is not the claim: import error, module not found, a type error inside the reproducer, a missing fixture, a server not running, a timeout, a wrong path | false | "fails for an unrelated reason: <first error line>"; when the cause is a step the finding did not state, "needs undocumented step: <what>" |
| The reproducer asserts something other than the claim (the test fails on a property the finding does not mention, and the claimed property is not tested) | false | "the reproducer tests <a>, the finding claims <b>" |
| (plan) `reproduction` is prose steps with no command and no script (4.3 step 3) | false | "no command or script; manual steps only" |
| The lens branch does not exist, or the reproducer is not at `<branch>:<path>` | false | "reproducer not found at <branch>:<path>"; the lens did not commit what the finding names, so this is a finding that cannot be reproduced as stated, not an environment failure |
| The reproducer overwrites a file that exists at the gate commit, or lies outside the allowed locations | false | "reproducer overwrites <path>, which exists at the gate commit (RED-TEAM-COMMON 1)" or "reproducer at <path> is outside redteam/ and the redteam-RT-nn-* test names" |
| (plan) A timing-dependent result holds in one run and not in the other (4.3 step 5) | false | "not deterministic: run 1 <...>, run 2 <...>" |
| The reproducer changed `reference/` | false | "the reproducer modified reference/<file>" |
| (plan) Something outside the finding stopped you | false | "VERIFIER ENVIRONMENT FAILURE: <what>" (4.6) |

`refuted` is always `false` in this mode: you did not attempt a refutation, and the field means nothing more than that. The harness takes `reproduced` from your verdict and `refuted` from the other verifier's.

### 4.5 What goes in evidence

In this order, quoted, not paraphrased, and no longer than about forty lines: the sha of `HEAD` after detaching; the branch and every path applied; the `git status --porcelain` lines after applying; each command exactly as run and its exit code; the summary line and the assertion or diff lines of the output; the comparison sentence ("observed matches: completeLayers = 11, golden 10", or "saw 12, finding says 11"); anything the reproducer left behind; anything else the branch changes that you did not apply.

### 4.6 When the environment, not the finding, fails

If something outside the finding stops you before the reproduction can be judged (Node below 22.12, `npm ci --prefer-offline` failing on the clean tree, a Playwright browser missing, a disk or memory failure, a worktree that was not clean), report `reproduced: false` and begin `reason` with `VERIFIER ENVIRONMENT FAILURE:` followed by the command and its first error line. A missing lens branch or reproducer path is not in this list; it is a row of 4.4. Do not repair the environment: no `npm install`, no `npx playwright install`, no edit to any configuration.

(plan) This prefix is the plan's convention, not a rule of `RED-TEAM-COMMON.md` or `README.md` 5.3, which says only "A finding that does not reproduce is dropped". The verdict schema has no abstaining value, and nothing reruns the verification: the harness (`workflows/redteam-phase.js`) drops every finding whose reproduce verdict has `reproduced: false`, prints it as `not reproduced: VERIFIER ENVIRONMENT FAILURE: ...` in the round's summary, and does not verify the same finding again in a later round. The prefix exists so that the summary, and the owner who reads it, can tell a drop caused by the machine from a drop caused by the finding.

## 5. Refute mode

The question you answer: is there a sentence of the specification, a golden key, an oracle result or a record that shows this finding is not a defect? If you cannot cite one, the finding stands. Nothing you believe about the code counts; nothing you suspect about the lens counts.

### 5.1 What you may do

- You do not run the reproducer, the test suites, a build, the site, or any command that executes the build. You read.
- Read the build at the gate commit with `git -C <repo> show <gateCommit>:<path>` and list it with `git -C <repo> ls-tree -r --name-only <gateCommit> <dir>`, so that the state of the working tree does not matter and you change nothing. Whether or not the harness gave you a worktree, you work this way.
- You may read: `SPEC.md`, `SOURCES.md`, `CONTRACTS.md`, `README.md`, the lens files (the plan and specification files by absolute path under `/Users/john/Claude/MutationGame/`), `reference/golden_data.json` (parsed), `reference/lie_games.py` and `reference/verify.py` (as text), `DECISIONS.md` and `decisions/*.md` at the gate commit, the gate report from the report commit above the gate commit (`git -C <repo> show main:reports/gate-G{k}.md`, section 2 item 8), the merge reports of earlier rounds from disk (`/Users/john/Claude/MutationGame/reports/merge-P{k}-redteam-round*.md`, uncommitted, section 2 item 8), the source and the tests at the gate commit, and the reproducer as text (`git -C <repo> show <branch>:<path>`) to understand what it asserts.
- You may compute a value of the oracle: a key of `golden_data.json`, or a function of `reference/lie_games.py` called with `python3 -I` on copies of the two files taken from the gate commit into `<scratch>/ref/` (section 6). That is the only execution allowed, and it executes the oracle, not the build and not the reproducer.
- You write nothing but notes and those reference copies in your scratch directory. No file in the repository, no commit.

### 5.2 Procedure

1. Read the finding whole. Write in one line what it says the text requires (`expected`) and what the build does (`observed`).
2. Open `specRef`: the passage, the whole section around it, and every section the passage sends you to. Read the sentence the finding relies on and its label (0.3).
3. Check the finding's reading. Does the passage say what `expected` says? Does it say it for this input, this kind of board, this phase, this tool, this view, this width? Look for qualifying words such as "may" and "unless", and for qualifying clauses of the kind SPEC.md uses, for example "where the layout allows" (4.0 "Small screens"; 7.5 A-7), "(T10, and T8 on its larger boards)" (4.0), "Before phase 2, when `classify` does not exist yet, both bounds apply to every custom board." (4.0), and "Because `classify` is written in phase 2, the phase 1 tools call the functions of the finite theory only on named finite-type boards, and the guards are added in phase 2." (5.1 E-11). The phase of a signature in `CONTRACTS.md` 2.4 qualifies it too, but that is the plan's text, not SPEC's.
4. Try the refutations of 5.3 in order, R1 to R6. Stop at the first that holds with a citation.
5. If none holds, `refuted: false`. Say in `reason` which refutations you tried and in one clause each why it failed. That sentence is the record that the finding withstood scrutiny; it is not filler.
6. Fill `severityAdjustment` from section 7, on the text alone.

### 5.3 The six refutations, and what each must cite

| # | Refutation | It holds when | The citation must name |
|---|---|---|---|
| R1 | The behaviour is permitted by the text | the passage allows the observed behaviour: it says "may", "where ... allows", or offers alternatives; a qualifying clause excludes the finding's case; the tables of 5.6 name the observed behaviour at the cap or off the finite boards; 4.0 or 7.6 states a bound the build respects; 7.4 or 7.5 names the exception the build used | the section and the sentence or table row, quoted |
| R2 | The finding misreads the passage | `expected` is not what the passage says: the wrong quantity (`completeLayers` against `depthReached`), the wrong direction (roads into against roads out of, 2.1), the wrong coordinates (labels against positions, E-7), a sentence that governs another tool, view or route, a rule of 6.3 cited where 6.1 governs, a template of 7.5 quoted with a word changed | the section and sentence, and the sentence of the finding it contradicts |
| R3 | The item belongs to a later phase | the function, tool, lesson, page, preset, export, route or test carries a phase number above the gate's: 9.1 Builds column; 3 (modules and figure tables); 4 (tool headings); 5.3 and 5.4 Phase column; 5.7 golden table; 4.0 "Share and export" (SVG and PNG in phase 2, LaTeX in phase 6); `CONTRACTS.md` 2.1, 2.4, 6 | the row or heading with its phase number, and the phase of the gate |
| R4 | The oracle agrees with the build | the finding says the build disagrees with a sentence of the specification, or with the lens's own computation, and the oracle (a golden key, or `lie_games.py` on the finding's input) returns the build's `observed` value. By 0.2 item 2 the oracle wins; the finding becomes a note for the owner, and your `reason` says so | the golden key path (`types.A2.highest_root`, `layer_growth_examples[label=star with five arms].stop_at_2000.complete_layers`) or the oracle function and input (`L.orbit_graph_capped(C, seeds, L.mutate, 2000)` with `L` the module `lie_games`, `C` and `seeds` stated; the signature is `orbit_graph_capped(C, seeds, move, cap, max_depth=None)`, `move` is a function called as `move(C, v, i)`, and the result is the triple `(graph, truncated, complete_layers)`), and the value returned |
| R5 | A [D] choice or a logged default | the passage is marked [D] and the build's choice lies within the [D] text. The [D] marks of SPEC.md: the headings 4.0, 7.1, 7.6, 7.9 and 8.3; the cross-checks of 5.7; the layouts and the size rule of 6.1; the styles of 6.2; and [D] sentences inside 1.2 (the "For readers who know Lie theory" paragraph), 1.4, 1.7, 2.4, 2.8, 2.11, 2.14, 2.15, 2.17, 2.18, the opening paragraph of section 3 (before M0), T10 in section 4 (the presets bullet), 5.1 and 6.3. `grep -n '\[D\]' /Users/john/Claude/MutationGame/SPEC.md` lists every one; trust the grep over this list, and read the sentence the mark sits in, since a [D] covers its sentence and not its whole section; or the behaviour is a default of section 10 (D1 to D19), or an owner's recorded answer, and a `decisions/*.md` fragment or `DECISIONS.md` at the gate commit records it | the [D] section and sentence, or the D-number with the fragment path and the entry heading |
| R6 | Another lens's territory, already reported | the same cause is already on record: a known open item in `reports/gate-G{k}.md` (read from the report commit above the gate commit, section 2 item 8); a finding of an earlier round in `/Users/john/Claude/MutationGame/reports/merge-P{k}-redteam-round{n}.md` (on disk, never committed) that is recorded as open (not fixed) and tracked; a `// regression: <finding id>` test at the gate commit that covers the exact case (then a recurrence is a regression, not a duplicate, and R6 fails) | the file and the entry; without a record the refutation fails, because you cannot see the other findings of this round |

### 5.4 Labels, the oracle and the asymmetry

- The oracle wins both ways. If the finding is itself a disagreement with the oracle (a golden key, or `lie_games.py` on an input the golden file does not contain), no sentence of `SPEC.md` refutes it. If your reading of a sentence disagrees with the oracle, that is a note for the owner in `reason`; `refuted` stays false.
- [V] sentences and the unlabelled statements of section 2 (which 0.3 makes definitions: "Statements with no label in section 2 are definitions.") are firm standards. An unlabelled sentence outside section 2 carries no label at all; treat it as a sentence of the specification like any other, not as a definition. A finding that rests on one is refuted by R1 to R3, R5 or R6, or by R4 when the oracle itself (a golden key, or `lie_games.py` run as section 6 describes) contradicts the finding, since the oracle wins (`SPEC.md` 0.2 item 2). Your own computation, or your own reading of the sentence, never refutes it; R4 must cite the oracle output.
- [S] and [S2] sentences are sourced (0.3: [S2] is "Second-hand: reported by a reliable later source that was read; the original was not."). Neither the specification nor the plan treats them as unverified; a finding that rests on one is handled like a finding on any other sentence.
- [U] sentences are "Unverified: from memory or inference. Check before publishing." (0.3). (plan) If `expected` rests only on a [U] sentence and no golden key covers it, the text cannot establish the build wrong, and it cannot establish the build right either: `refuted: false`, say the label in `reason`, and adjust severity per section 7 (it is not a golden mismatch).
- A finding that a page prints a [U] item as fact is a blocker under the rubric, and the label is its evidence. Read the page at the gate commit (`git -C <repo> show <gateCommit>:site/src/content/...`): if `<Unverified>` already wraps the statement, that is R2; otherwise `refuted: false`.
- A section 10 default without a record is not R5. The finding stands; and when its claim is the behaviour rather than the missing record, the real defect is the missing record (major: "a required `DECISIONS.md` entry missing"), which section 7 handles.
- A [D] text is still binding on the builders (`RED-TEAM-COMMON.md` 2: "unless they violated the [D] text"). R5 holds for a choice within the text, never for a departure from it.

### 5.5 Not a refutation

- "It probably does not matter", "no reader would notice", "the fix is trivial", "the reproducer is ugly", "the lens is out of its scope". A finding outside its lens's territory with hard evidence is reportable under `lens: "incidental"` (`RED-TEAM-COMMON.md` 2); territory alone refutes nothing.
- "The severity is wrong." That belongs in `severityAdjustment`, and it leaves `refuted` false.
- "The specification is ambiguous." Ambiguity without a sentence that permits the behaviour is `refuted: false`; name the ambiguity in `reason` so that it reaches the owner.
- Reading the build's source and concluding it looks right. You did not run it; the other verifier did.
- Refuting a part of the finding while the cause stands. One cause, one finding: if the cause stands, `refuted: false`, and note the wrong part in `reason`.
- Citing a sentence of `SPEC.md` against a golden value or an oracle result.
- Citing a section 10 default without a record at the gate commit.
- Citing a later phase for an item the gate's phase lists (check the Builds column of the gate's row in 9.1 and the deliverables in `build-plan/rosters/phase-{k}.json`).
- Citing another lens's territory without a record of the earlier report.
- Citing `proposedFix`, in either direction.

## 6. Methods: read-only tools for both modes

Every command here uses absolute paths and gives `git` its directory with `-C` (section 3, "Paths and the shell rule"). In reproduce mode `<dir>` is `<wt>`; in refute mode it is `<repo>`. The reading commands (`git -C <dir>` with `log`, `show` and `ls-tree`, `grep`, `sed`) and the one-line `python3 -I` calls are allowed in both modes. The `mkdir -p` and the two redirected `git show` lines that copy the reference files into `<scratch>/ref` are for refute mode only; reproduce mode reads the reference files in its worktree. The table in section 3 lists the commands of each mode.

Reading at the gate commit without touching the tree:

```
git -C <dir> log --oneline -1 <gateCommit>
git -C <dir> show <gateCommit>:packages/engine/src/search.ts
git -C <dir> show <gateCommit>:DECISIONS.md
git -C <dir> ls-tree -r --name-only <gateCommit> decisions/
git -C <dir> show main:reports/gate-G2.md                                          # the gate report, from the report commit (section 2 item 8)
git -C <dir> show <branch>:packages/engine/test/golden/redteam-RT-03-cap.test.ts   # the reproducer as text
```

To search every decisions fragment for a D-number, list them with the `ls-tree` line above and run `git -C <dir> show <gateCommit>:decisions/<file>.md` for each, then `grep -n 'D17'` on what you saved under `<scratch>`; or write the loop into a script file under `<scratch>` and run it, never as a multi-line inline command.

The reference files. In reproduce mode the worktree is detached at the gate commit, so read them at `<wt>/reference/`. In refute mode read nothing from a working tree: copy the two files out of the gate commit into your scratch directory first, one command each.

```
mkdir -p <scratch>/ref
git -C <repo> show <gateCommit>:reference/golden_data.json > <scratch>/ref/golden_data.json
git -C <repo> show <gateCommit>:reference/lie_games.py > <scratch>/ref/lie_games.py
```

Below, `<refdir>` is `<wt>/reference` in reproduce mode and `<scratch>/ref` in refute mode. `reference/` never changes after phase 0 (`CONTRACTS.md` 9 records its hashes), so the copies equal the working-tree files, but the rule of section 3 is to read the gate commit.

A golden key by path (`python3 -I` so that nothing in the working directory is imported; one line each):

```
python3 -I -c 'import json; d = json.load(open("<refdir>/golden_data.json")); print(d["types"]["A2"]["highest_root"])'
python3 -I -c 'import json; d = json.load(open("<refdir>/golden_data.json")); x = [e for e in d["layer_growth_examples"] if e["label"] == "star with five arms"][0]; print(x["stop_at_2000"]["complete_layers"])'
```

The top-level keys of the golden file are `about`, `conventions`, `types` (32 records, `A1` to `G2`), `satake`, `folding`, `weyl_dimension`, `affine`, `twisted_affine`, `admissible_counts`, `wildberger_lists`, `affine_names`, `pentagon_example`, `admissible_pairs`, `satake_examples`, `generalized_satake_example`, `kostant`, `one_way_counterexample`, `layer_growth_examples`, `wythoff`, `wythoff_hull_checks`, `wythoff_note`, `coxeter_plane_types_with_coincident_points`, `minuscule_representations`, `orbit_plus_zero_representations`, `e8`, `golden_boards`, `golden_folds`, `bigint_test`, `classification_tests`, `heaps`. Appendix G of `SPEC.md` gives the schema; the comparison rules are 5.7. Nodes in the golden file are labels (rule 2).

The oracle on an input the golden file does not contain:

```
python3 -I -c 'import sys; sys.path.insert(0, "<refdir>"); import lie_games as L; C = L.cartan("A", 2); print(L.mutate(C, [1, 0], 0)); print(L.fire(C, [1, 0], 0))'
python3 -I -c 'import sys; sys.path.insert(0, "<refdir>"); import lie_games as L; C = L.cartan("A", 3); g, t, c = L.orbit_graph_capped(C, [[1, 0, 0]], L.mutate, 2000); print(len(g), t, c)'
```

A longer computation goes into a script file under `<scratch>`, run as `python3 -I <scratch>/oracle.py`, with `<refdir>` inserted into `sys.path` by absolute path. `lie_games.cartan(letter, n)` takes a letter and a rank, unlike the engine's `cartan("A2")`. `orbit_graph_capped(C, seeds, move, cap, max_depth=None)` takes the move as a function (`L.mutate` or `L.fire`), not a name, and returns `(graph, truncated, complete_layers)`. Inside `lie_games.py` nodes are positions `0..n-1`; the golden file and the finding's `observed` may be in labels. Say which numbering you used when you cite a value. The oracle's function names are in the Oracle column of `SPEC.md` 5.3 and 5.4.

Finding the phase of an item:

```
grep -n '^### T[0-9]*\.' /Users/john/Claude/MutationGame/SPEC.md              # tool headings with their phase
grep -n '`classify(board)`' /Users/john/Claude/MutationGame/SPEC.md            # the 5.3 row; read its Phase column
grep -n '^### 9.1' /Users/john/Claude/MutationGame/SPEC.md                     # where the 9.1 table starts
sed -n '1977,1995p' /Users/john/Claude/MutationGame/SPEC.md                    # the 9.1 table (check the start line with the grep above)
grep -n 'phase' /Users/john/Claude/MutationGame/build-plan/CONTRACTS.md        # 2.1, 2.4 and 6
```

Finding whether a default or a [D] choice is recorded: `git -C <dir> show <gateCommit>:DECISIONS.md`, then every fragment under `decisions/` at the gate commit (above). An entry names the decision, what the specification left open, the default used with its D-number, and the reason (`COMMON.md` 5.1).

Finding a lens's territory and its own exclusions: the row in `README.md` 5.2 and section 6 of `build-plan/red-team/{lens}-{slug}.md`.

## 7. Severity adjustment

You never edit the finding's `severity`. You report `severityAdjustment` as `none`, or `lower to <level>`, or `raise to <level>`, where the level is one of the three of `RED-TEAM-COMMON.md` 4. The three spellings of section 6 (`none`, `lower to major`, `raise to blocker`) are the common cases; `lower to minor` and `raise to major` take the same form. Adjust on the rubric's words, never on the effort of the fix or on how many readers would meet the defect.

| What you established | Claimed | Adjustment |
|---|---|---|
| The behaviour is in the blocker list: a convention of section 2 violated; a golden mismatch (a value that differs from a key of `golden_data.json`); a gate command of 9.1 that fails or was not run as written; a mathematical statement presented as fact that is wrong or labelled [U]; a tool not operable by keyboard or not announced; a lesson not readable without JavaScript; the golden file or the oracle modified; a test suite that passes while the behaviour is absent | major or minor | `raise to blocker` |
| The behaviour is in the major list: a stated behaviour (a cap, a message, a mode, a preset, a hook, a field) missing or wrong; a size budget exceeded; a prose rule of 8.4 broken; a required `DECISIONS.md` entry missing; a dependency added without a record; a contract signature changed without a logged deviation | blocker | `lower to major` |
| the same | minor | `raise to major` |
| The behaviour is in the minor list: wording, a name, a comment, a missing `data-out` listing, a test that could be stronger without being wrong | blocker or major | `lower to minor` |
| (plan) `expected` rests only on a [U] sentence with no golden key (so it is not a golden mismatch and not a wrong fact shown) | blocker | `lower to major` |
| The behaviour is a section 10 default taken as the specification says, with no fragment recording it; the defect is the missing record | blocker | `lower to major` |
| In reproduce mode the value you saw differs from the finding's, and the difference moves the case to another rubric item (the cap is honoured but the message is wrong; the test fails but on a weaker property) | any | the level of what you saw |
| The claimed level is the rubric's level for what was shown | any | `none` |
| The rubric does not clearly name the case | any | `none`, and say in `reason` why the rubric is silent |
| (plan) A value that differs from `lie_games.py` on an input the golden file does not contain (not a golden mismatch in the rubric's words; neither `RED-TEAM-COMMON.md` 4 nor `README.md` 5.3 assigns it a level) | any | `none`, as for any case the rubric does not name; say in `reason` that the disagreement is with the oracle off the golden file, so the owner can judge it |

A refuted finding and a non-reproduced finding both get `none`: there is nothing to adjust. In refute mode you adjust on the text alone, by asking which rubric item the claim, if true, would fall under. In reproduce mode you adjust on what the run showed.

## 8. What the verifier never does

- Fix anything: not the code, not a test, not the reproducer, not a comment, not "while I am here".
- Edit the finding: not its text, its id, its `severity`, its `specRef`, its `reproducer` path. A correction of the observed value goes in `evidence` and `reason`; a view on the level goes in `severityAdjustment`.
- Soften on taste. "Probably fine", "minor in practice", "the reader would not notice" are not verdicts, and a refutation without a citation is not a refutation.
- Add a step, a flag, a path, a cap, a timeout or an environment variable to make a reproduction run, or widen the set of applied files beyond section 4.2.
- Run the reproducer, a suite, a build or the site in refute mode. Compute anything but the oracle in refute mode.
- Refute from the build's source alone, or from the other verifier's work (you do not see it, and you do not ask for it).
- Check out, merge, rebase, push or commit to any branch; touch `main`. The verifier commits nothing.
- Edit `reference/`, `golden_data.json`, `lie_games.py`, `verify.py`, a convention, a cap, `CONTRACTS.md`, `content/unverified.json`, or any test; mark a finding fixed; set an item of `content/unverified.json` to `closed` (`RED-TEAM-COMMON.md` 1 and `README.md` 5.4).
- Open a new finding. If you stumble on another defect, add one line at the end of `evidence` beginning `incidental:`; it does not change the verdict and it is not a field of its own.
- Judge `proposedFix`.
- Report a command it did not run, quote output it did not see, or cite a passage it did not read.
- Repair the environment (4.6).
- Output anything but the JSON of section 9.

## 9. Output

Your final message is the JSON of `RED-TEAM-COMMON.md` section 6, all eight fields, and nothing else: no prose before or after it, no code fence.

```json
{ "findingId": "P2-RT-03-01", "mode": "reproduce | refute", "reproduced": true, "refuted": false,
  "citation": "SPEC 5.5 ...", "evidence": "...", "severityAdjustment": "none | lower to major | raise to blocker", "reason": "..." }
```

The harness takes `reproduced` from the reproduce verdict and `refuted` from the refute verdict: a finding is confirmed when `reproduced` is true and `refuted` is false. For a dropped finding it prints `not reproduced: <reason>` or `refuted: <citation> <reason>` in the round's summary (`workflows/redteam-phase.js` adds those prefixes itself, so your `reason` never repeats them); for a confirmed finding it attaches both verdicts to the finding that the fixer receives. Write `reason` and `citation` for those two readers.

### 9.1 Field by field

| Field | Reproduce mode | Refute mode |
|---|---|---|
| `findingId` | the finding's `id` | the same |
| `mode` | `"reproduce"` | `"refute"` |
| `reproduced` | `true` or `false` per 4.4 | `false`: not attempted in this mode, nothing more |
| `refuted` | `false`: not attempted in this mode, nothing more | `true` or `false` per 5.3 |
| `citation` | the finding's `specRef`, copied verbatim and not evaluated | when refuted: the citation of the refutation that held, in the form of the last column of 5.3; when not refuted: the passage you read and what it says about the finding ("SPEC 5.5 'Order and truncation of a search': the sentence supports the finding's expected") |
| `evidence` | 4.5 | the sentence or row quoted, its label, the qualifier if any, the golden key or oracle call with the value where used, the record path where used, and what you read at the gate commit |
| `severityAdjustment` | section 7 | section 7 |
| `reason` | one sentence that reads as a log line. When `reproduced` is true, begin with "reproduced as stated; ..." or "reproduced with a different observed value: ...". When it is false, write the 4.4 wording with no prefix ("needs undocumented step: ...", "VERIFIER ENVIRONMENT FAILURE: ..."), since the harness prints it after "not reproduced: " | when `refuted` is true, one sentence that reads after "refuted: <citation> ", with no prefix of its own, since the harness prints those words; when `refuted` is false, begin "not refuted:" and name the refutations tried, R1 to R6, and why each failed |

### 9.2 Examples

Reproduce mode, confirmed:

```json
{ "findingId": "P2-RT-03-01", "mode": "reproduce", "reproduced": true, "refuted": false,
  "citation": "SPEC.md 5.5, 'Order and truncation of a search'; golden layer_growth_examples[label=star with five arms].stop_at_2000.complete_layers",
  "evidence": "HEAD 3f9c2e1 (gate commit, detached). Applied redteam/P2-RT-03:packages/engine/test/golden/redteam-RT-03-cap.test.ts; git status --porcelain: 'A  packages/engine/test/golden/redteam-RT-03-cap.test.ts'. npm ci --prefer-offline: ok. Ran: npm test -w packages/engine -- redteam-RT-03-cap.test.ts; exit 1. Output: 'FAIL test/golden/redteam-RT-03-cap.test.ts > completeLayers at cap 2000 on the star with five arms' / 'AssertionError: expected 11 to be 10'. Observed matches the finding: completeLayers = 11, golden 10. Tree after the run: only the applied file.",
  "severityAdjustment": "none",
  "reason": "reproduced as stated; observed matches (completeLayers 11 against golden 10); a golden mismatch is a blocker under RED-TEAM-COMMON 4" }
```

Reproduce mode, dropped for an undocumented step:

```json
{ "findingId": "P1-RT-07-02", "mode": "reproduce", "reproduced": false, "refuted": false,
  "citation": "SPEC.md 7.6, route table, 'each tool alone, on /tools/<id>', 90 kB",
  "evidence": "HEAD 3f9c2e1. Applied redteam/P1-RT-07:redteam/RT-07/chunk-size.mjs (the only path the finding names). npm ci --prefer-offline: ok. Ran: node redteam/RT-07/chunk-size.mjs; exit 1. Output: 'Error: ENOENT: no such file or directory, scandir site/dist/_astro'. The script reads the built site; the finding states no build step, and site/dist does not exist at a clean checkout.",
  "severityAdjustment": "none",
  "reason": "needs undocumented step: npm run build before the script; as stated the reproduction fails before measuring anything" }
```

Refute mode, refuted by phase assignment:

```json
{ "findingId": "P1-RT-10-03", "mode": "refute", "reproduced": false, "refuted": true,
  "citation": "SPEC.md 5.3, row classify(board): Phase 2; SPEC.md 9.1, row '2 Form and classification', Builds: 'Engine phase 2, with classify and the guards of E-11'; CONTRACTS.md 2.1, src/classify.ts, phase 2",
  "evidence": "The finding reports classify absent from packages/engine/src at gate G1 and the tool T2 not calling it to decide finiteness. 5.3 assigns classify to phase 2; 9.1 lists it under phase 2; CONTRACTS 2.1 gives src/classify.ts to phase 2. 4.0 says 'Before phase 2, when classify does not exist yet, both bounds apply to every custom board', which is what the finding's observed describes. No section 10 default or decisions fragment is involved.",
  "severityAdjustment": "none",
  "reason": "the item belongs to phase 2 and the gate is G1 (R3); the observed behaviour is the one 4.0 prescribes before phase 2 (R1)" }
```

Refute mode, not refuted:

```json
{ "findingId": "P2-RT-03-01", "mode": "refute", "reproduced": false, "refuted": false,
  "citation": "SPEC.md 5.5 'Order and truncation of a search': completeLayers is the depth of the position being expanded when the cap acts; CONTRACTS.md 2.4 restates it for orbitGraph; golden layer_growth_examples[label=star with five arms].stop_at_2000.complete_layers = 10",
  "evidence": "Read 5.5 whole and the rows of 5.6 for positions on the main thread and in the worker. The sentence is unqualified, with no 'may'. orbitGraph is phase 1 (5.4; CONTRACTS 2.1 src/search.ts), so it exists at gate G2. The golden value is 10 and the finding's observed is 11, so the oracle is against the build. 5.5 carries no [D] mark; no fragment under decisions/ at the gate commit mentions completeLayers or the cap rule. reports/gate-G2.md records no open item on orbitGraph and there is no earlier round.",
  "severityAdjustment": "none",
  "reason": "not refuted: R1 no permitting clause; R2 the finding reads 5.5 correctly; R3 phase 1 function at gate G2; R4 the oracle gives 10 against the build's 11; R5 not [D] and no recorded default; R6 no record" }
```
