# {ID}: {title}

Phase {k}, stage {s}. Size {S | M | L}. Runs in: a worktree on branch `agent/{ID}` (MERGE and GATE: the primary checkout on `main`).

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

## 1. Objective

Two to four sentences: what exists when you are done, and what it is for in the site.

## 2. Read first, in this order

A numbered list of `SPEC.md` sections (with the reason each matters for this task), `SOURCES.md` sections if any, oracle functions in `reference/lie_games.py` with line numbers, golden keys in `reference/golden_data.json`, and the `CONTRACTS.md` sections that bind you. Say which sections must be read in full and which are reference.

## 3. Inputs you depend on

What must already be on `main` when you start (functions, components, libraries, pages), named precisely. If something you need is missing when you start, stop and report `blocked` rather than re-implementing it.

## 4. Deliverables

A table or list of every file you will create or change, with one line on its contents. Include tests, the decisions fragment and any data files. Nothing outside this list is yours to touch (see section 7).

## 5. Requirements

The operative rules for this task, restated precisely with section references: the behaviour, the names, the exact strings, the caps, the orders, the error cases, the positions-versus-labels rule at your boundary. Point to the specification rather than paraphrasing where a paraphrase could drift; quote exactly where a sentence must appear verbatim on the site. Group by sub-feature. This is the longest section.

## 6. Acceptance

A checklist. Every line is a condition from `SPEC.md` (section 4 criteria, 5.7 golden keys, 7.5 requirements, 9.1 gate items) or from `CONTRACTS.md`, followed by the automated test that proves it (file and test name) and the gate it belongs to. A line without an automated test is allowed only when `SPEC.md` says the check is manual.

## 7. Files

- **You own**: ...
- **You may edit with the stated protocol**: ...
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, root `package.json` and the lockfile (unless listed above), other agents' components and tests, `content/unverified.json`.

## 8. Order of work

The sequence to follow so that a partial result is still usable: what to build first, what tests to write before which code, when to commit. For an L task, the point at which to commit a first usable increment.

## 9. Traps

Specific pitfalls for this task: convention confusions it invites (transposition, roads in against out, positions against labels, node 0 first), off-by-ones at caps and depths, toolchain surprises (Svelte 5 runes, Astro 7 processor, KaTeX versions), performance rules (E-9), accessibility rules it is easy to miss, and anything the oracle does that is not obvious from the specification text.

## 10. Report

The JSON of `COMMON.md` 5.2. Any additional fields this task must include (for example: the branch names and worktree paths of merged agents for MERGE; the gate table for GATE; the list of presets computed at build time for T10).
