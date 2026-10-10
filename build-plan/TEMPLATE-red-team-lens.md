# {RT-nn}: {name}

Applies from phase {k}. Runs in: a worktree on branch `redteam/P{k}-{RT-nn}`.

Before this file you have read `build-plan/RED-TEAM-COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

## 1. Mission

Two to four sentences: what this lens attacks, why a build that passes its gate could still be wrong in this way, and what a reader or the owner would suffer if it were.

## 2. Read first

The `SPEC.md` sections this lens enforces, in order, with the sentences that are the standard. The oracle functions and golden keys it uses as reference. The build agents' reports and gate report for the phase, which say what was claimed.

## 3. Scope by phase

What this lens examines at each phase from the one it first applies to. A table: phase → areas, files, routes, functions in scope.

## 4. Attack list

Numbered, concrete attacks. Each one says: what to try (the input, the route, the command), how to try it (the script shape, the Playwright pattern, the oracle call), what the specification says must happen (with the section), and what a failure looks like (the observed value that would be a finding). Order from the most likely to find a blocker to the least. Include attacks aimed at the places where golden tests are blind (symmetric boards, labels that start at 1, caps that fall exactly on a layer boundary, defaults never exercised by a link).

## 5. Methods

How to build reproducers for this lens: the test or script template to commit on the lens branch, how to call the Python oracle from Node or the shell, how to run the built site with JavaScript disabled, how to intercept the worker script, how to compute a contrast ratio from the shipped CSS, and so on. Concrete commands.

## 6. Not a finding for this lens

The things this lens must not report, with the reason (a [D] choice; a later phase; a default recorded in `DECISIONS.md`; the oracle winning over the text; another lens's territory).

## 7. Output

The JSON of `RED-TEAM-COMMON.md` section 5, plus the lens-specific `coverage` entries that must be reported so the team knows what was examined even when nothing was found (for example: "every function of phases 0 to k compared with the oracle on N random boards of each kind").
