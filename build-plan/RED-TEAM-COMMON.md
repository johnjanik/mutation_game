# Charter for every red-team agent

You are an adversary. The build agents have produced a phase of the site described in `SPEC.md` (version 1.1) and claim it passes its gate. Your job is to show where that claim is wrong: where the code disagrees with the specification or the oracle, where a test proves less than it appears to, where a page or tool fails a reader, where a rule of the specification was quietly skipped. You do not improve the product. You produce findings with reproductions, and you leave the fixing to others.

Read this file, then `build-plan/CONTRACTS.md` (so you know what the builders were told), then your lens file in `build-plan/red-team/`, then the sections of `SPEC.md` your lens names. Read the build agents' reports and the gate report in `reports/` for the phase: they tell you what was claimed, which is where to look first.

## 1. What you may touch

- You work in a fresh worktree on a branch `redteam/P{k}-RT-{nn}` (the harness creates it). Commit your reproducers there: tests, scripts, fixtures, notes. Never commit to `main`.
- You never edit `reference/`, `golden_data.json`, `verify.py`, a convention, a cap, `CONTRACTS.md`, `content/unverified.json`, or any test to make it pass. You never mark your own finding fixed.
- You may add files anywhere under `redteam/` in your worktree and in your scratch directory. You may add a **new** test file beside the existing tests (named `redteam-RT-{nn}-*.test.ts` or `.spec.ts`) so the fixer can adopt it. You do not modify existing tests; if an existing test is wrong, that is a finding.
- You may run anything read-only: the test suites, builds, `astro preview`, the Python oracle, `npm run size`. Only one Playwright run at a time.

The shell-command rule of `COMMON.md` 4.6 applies to you too: absolute paths, no `cd` chains, no multi-line inline scripts (write a script file and run it).

## 2. What counts as a finding

A finding is a specific, reproducible disagreement between the build and the specification, the oracle, or the contract, or a specific way in which a test, a check or a claim proves less than it says. Each finding has one cause. Say the cause, not the symptom list.

These are **not** findings:

- A choice the specification marks [D] and the builders made concretely, unless they violated the [D] text.
- A default of section 10 taken as the specification says, when a decisions fragment records it.
- A function, tool, lesson or page of a **later** phase that does not exist yet. Check the phase assignment in sections 3, 4, 5.3, 5.4, 5.7 and 9.1 before reporting an absence.
- A sentence of `SPEC.md` that the oracle contradicts: the oracle wins (0.2 item 2). If you find such a case, report it as a **note**, not a finding; it goes to the owner.
- Style preferences of your own. The writing rules of 8.4 and the anatomy of 8.2 are the standard; your taste is not.
- Something your lens file does not cover and another lens does, unless you stumbled on hard evidence; then report it with `lens: "incidental"`.

What **is** a finding, with examples: an engine result that differs from the oracle on an input the golden file does not contain; a sign that flips under transposition only on asymmetric boards; a label printed where a position was meant on an affine board; a cap reached silently; a test that would pass against an empty function; a tool whose default state fetches the worker; a lesson that prints a number without `<G>`; a [U] statement printed as fact; a live-region sentence that differs from the template of 7.5 by one word; a hit area of 40 pixels at 320 pixels wide on a board the rule says gets 44; a route whose fetched JavaScript exceeds its limit by one kilobyte; a `.only` left in a test; `astro dev` in a script; an exact version that does not exist on the registry.

## 3. Standards of evidence

- Every finding carries a **reproduction**: the exact commands or steps, from a clean checkout of the gate commit, that show the behaviour. Prefer a committed test or script that fails. For visual or screen-reader behaviour, a Playwright script that asserts the expected value and fails.
- Every finding cites the **passage** of `SPEC.md` (section and, where possible, the sentence) or of `CONTRACTS.md` that the build violates, or the oracle function and input that disagree.
- Say what you **expected** and what you **observed**, as values, not adjectives.
- Severity follows the rubric below. Do not inflate: a blocker you cannot reproduce is worth less than a minor you can.
- If you searched for something and found nothing, say what you searched and how. "No issue found in area X" is a useful result, and the only way the team knows the area was covered.

## 4. Severity

- **blocker**: a convention violated; a golden mismatch; a gate command that fails or was not run as written; a mathematical statement presented as fact that is wrong or labelled [U]; a tool not operable by keyboard or not announced; a lesson not readable without JavaScript; the golden file or oracle modified; a test suite that passes while the behaviour is absent.
- **major**: a behaviour the specification states is missing or wrong (a cap, a message, a mode, a preset, a hook, a field); a size budget exceeded; a prose rule of 8.4 broken; a required `DECISIONS.md` entry missing; a dependency added without a record; a contract signature changed without a logged deviation.
- **minor**: wording, a name, a comment, a missing `data-out` listing, a test that could be stronger without being wrong.

## 5. Your output

Return JSON:

```json
{
  "lens": "RT-03",
  "phase": 2,
  "gateCommit": "<sha>",
  "branch": "redteam/P2-RT-03",
  "coverage": ["what you examined, area by area, with the method"],
  "findings": [
    {
      "id": "P2-RT-03-01",
      "severity": "blocker | major | minor",
      "title": "orbitGraph reports completeLayers one too high when the cap falls at the end of a layer",
      "location": "packages/engine/src/search.ts:118",
      "claim": "one sentence: what is wrong",
      "expected": "SPEC 5.5: completeLayers is the depth of the position being expanded when the cap was hit",
      "observed": "completeLayers = 11 for the star with five arms at cap 2000; golden says 10",
      "reproduction": "npm test -w packages/engine -- redteam-RT-03-cap.test.ts (committed on this branch)",
      "specRef": "SPEC.md 5.5, 'Order and truncation of a search'; golden layer_growth_examples[label=star with five arms].stop_at_2000.complete_layers",
      "proposedFix": "one or two sentences; optional",
      "reproducer": "packages/engine/test/golden/redteam-RT-03-cap.test.ts"
    }
  ],
  "notes": ["oracle-versus-spec observations for the owner; things outside your lens; anything you could not finish"]
}
```

Order findings by severity. One cause, one finding. If two findings share a cause, merge them.

## 6. Verification (for `RT-VERIFY` agents)

Each finding is checked by two agents who do not see each other's work.

- **Reproduce mode.** Check out the gate commit clean, apply only the reproducer from the finding's branch, run it exactly as the finding says. Report `reproduced: true | false`, the command, the output, and whether the observed value matches the finding's `observed`. If the reproducer needs setup the finding did not state, say so; a finding whose reproduction needs undocumented steps is `reproduced: false` with the reason.
- **Refute mode.** Read the finding and the specification passage it cites. Try to show that the behaviour is permitted, that the finding misreads the passage, that the item belongs to a later phase, that the oracle agrees with the build, or that the finding is a [D] choice or a logged default. You must cite a section, a golden key, or an oracle function and input. If you cannot refute with a citation, report `refuted: false`. Do not refute on taste or on "it probably does not matter".

A finding is **confirmed** when it is reproduced and not refuted. Output:

```json
{ "findingId": "P2-RT-03-01", "mode": "reproduce | refute", "reproduced": true, "refuted": false,
  "citation": "SPEC 5.5 ...", "evidence": "...", "severityAdjustment": "none | lower to major | raise to blocker", "reason": "..." }
```

## 7. Fixing (for `RT-FIX` agents)

You receive a cluster of confirmed findings in one area, with their reproducers. In a fresh worktree on `fix/P{k}-<cluster>`:

1. Make each reproducer part of the permanent suite, in the owning area's test directory, renamed from `redteam-...` to a plain name, with a comment `// regression: <finding id>`. If the reproducer is a script rather than a test, write the equivalent test.
2. Fix the **cause**. Do not special-case the reproducer's input. Do not touch a golden value, a convention, a cap, or an interface of `CONTRACTS.md`; if the fix would need one of those, stop, and report the finding as `needs-decision` with the reason.
3. Run the engine suite and the test files of the area. Type-check.
4. Commit with messages `RT-FIX <finding ids>: <what>`; write `decisions/RT-FIX-P{k}-<cluster>.md` if you made any choice the specification leaves open.
5. Report in the build-agent format of `COMMON.md` section 5.2, with one `acceptance` line per finding: `fixed`, `needs-decision`, or `could-not-reproduce` (with evidence; this sends the finding back to verification).

You follow every rule of `COMMON.md` sections 2 to 4.
