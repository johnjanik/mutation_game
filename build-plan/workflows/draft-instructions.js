// Draft, verify and revise the per-agent and per-lens instruction files of the plan (build-plan/README.md section 2).
// Launch: Workflow({ scriptPath: 'build-plan/workflows/draft-instructions.js',
//                    args: { ids: [...item ids...], existing: [...ids whose file is already on disk and only needs verify/revise...] } })
// Omit args.ids to run every item. Drafters, verifiers and revisers run on Opus (README 3.5). Run consistency.js afterwards.

export const meta = {
  name: 'mg-draft-instructions',
  description: 'Draft every per-agent and per-lens instruction file of the build plan from the rosters and SPEC.md, verify each for coverage and fidelity against the spec, and revise',
  phases: [
    { title: 'Draft', detail: 'one drafter per instruction file (skipped when the file already exists)' },
    { title: 'Verify', detail: 'independent coverage and fidelity check against SPEC.md' },
    { title: 'Revise', detail: 'fix the gaps the verifier found, then re-verify (at most twice)' },
  ],
}

const ROOT = '/Users/john/Claude/MutationGame'
const PLAN = `${ROOT}/build-plan`
const OPUS = { model: 'opus' }

const BUILD = [
  [0, 'P0-A1', 'repo-scaffold'], [0, 'P0-A2', 'engine-core'], [0, 'P0-A3', 'math-spike'], [0, 'P0-A4', 'content-components'], [0, 'P0-A5', 'board-seed'], [0, 'P0-A6', 'scripts-and-ci'],
  [1, 'P1-A1', 'engine-phase-1'], [1, 'P1-A2', 'site-infra'], [1, 'P1-A3', 'draw-layout'], [1, 'P1-A4', 'pages-and-lesson-layout'], [1, 'P1-A5', 't01-game-board'], [1, 'P1-A6', 't02-orbit-garden'], [1, 'P1-A7', 't09-kostant'], [1, 'P1-A8', 'lesson-m0'], [1, 'P1-A9', 'lesson-m1'],
  [2, 'P2-A1', 'engine-phase-2'], [2, 'P2-A6', 'svg-png-export'], [2, 'P2-A2', 't03-form-finder'], [2, 'P2-A3', 't04-classification-lab'], [2, 'P2-A4', 't15-affine-playground'], [2, 'P2-A5', 't16-sandbox'], [2, 'P2-A7', 'phase-2-additions'], [2, 'P2-A8', 'lesson-m2'], [2, 'P2-A9', 'lesson-m3'],
  [3, 'P3-A1', 'engine-phase-3a'], [3, 'P3-A2', 'engine-phase-3b'], [3, 'P3-A7', 'lab-timings'], [3, 'P3-A3', 't05-numbers-game-lab'], [3, 'P3-A4', 't06-kaleidoscope'], [3, 'P3-A5', 't07-symbolic-game'], [3, 'P3-A6', 't08-weyl-explorer'], [3, 'P3-A8', 'lesson-m4'], [3, 'P3-A9', 'lesson-m5'],
  [4, 'P4-A1', 'engine-phase-4'], [4, 'P4-A2', 'projector'], [4, 'P4-A3', 't10-geometry-studio'], [4, 'P4-A4', 't11-folding-bench'], [4, 'P4-A5', 'lesson-m6'], [4, 'P4-A6', 'lesson-m7'],
  [5, 'P5-A1', 'engine-phase-5'], [5, 'P5-A2', 't12-representation-builder'], [5, 'P5-A3', 'lesson-m8-and-not-quiver-page'],
  [6, 'P6-A1', 'engine-phase-6a'], [6, 'P6-A5', 'latex-export-and-embed'], [6, 'P6-A6', 'pages-phase-6'], [6, 'P6-A2', 'engine-phase-6b'], [6, 'P6-A3', 't13-satake-studio'], [6, 'P6-A4', 't14-atlas'], [6, 'P6-A7', 'lesson-m9'], [6, 'P6-A8', 'lesson-m10'],
].map(([phase, id, slug]) => ({ kind: 'build', phase, id, slug, file: `build-plan/agents/${id}-${slug}.md` }))

const LENSES = [
  ['RT-01', 'differential-oracle', 0, 'SPEC 2.1 to 2.18 (definitions and [V] facts), 5.3, 5.4, 5.5, 5.6, 5.7, Appendix A, Appendix G; reference/lie_games.py in full (it is the reference implementation to compare against); reference/verify.py sections 1, 2, 5, 9, 10, 17 for how the oracle is exercised'],
  ['RT-02', 'convention-drift', 0, 'SPEC 2.1 to 2.5, 2.8, 2.9, 2.10, 2.12 (node 0 first), 2.13, 5.1 (E-5, E-7), 5.5 (Naming; Matching two boards), 6.4 (the C2 adjustment), 6.6 (labels in links), Appendix D, Appendix H conventions block; CONTRACTS 2.2 to 2.5'],
  ['RT-03', 'bounds-and-errors', 0, 'SPEC 4.0 (Stated limits; Growth off the finite types has two bounds; Long numbers), 5.1 (E-2, E-6, E-8, E-10, E-11), 5.5 (Order and truncation of a search; Root test; Fates), 5.6 both tables in full, 6.6 (Validation caps), Appendix G (bigint_test, layer_growth_examples); CONTRACTS 2.3, 2.5'],
  ['RT-04', 'codec-attacker', 1, 'SPEC 6.6 in full, 7.4 in full, 4.0 (Share and export; Configuration), 5.6 (moves in a link), 1.6 (Durability: old schema versions stay readable); CONTRACTS 4 (state.ts, urlCodec.ts), 5.2'],
  ['RT-05', 'a11y-and-layout', 0, 'SPEC 7.5 in full (A-1 to A-13), 6.1 in full, 6.2, 6.3 in full, 4.0 (Keyboard and screen reader; Signs; Small screens; Test hooks; Predict), 8.1 P8, P10, P11, 8.3, 7.7 (Accessibility row); CONTRACTS 5.1, 5.3, 8'],
  ['RT-06', 'no-js-and-no-worker', 0, 'SPEC 7.4 in full, 4.0 (Works before and without JavaScript; Predict; Step and play to the end; Configuration), 5.1 E-9 in full, 7.6 (the worker never counts; no tool may need it for its default state), 4 T2 (grown at build time), T4 (keep counting), T8 and T10 (SVG snapshots; presets as data files), T12 (orbit cap), T13 (E7 and E8 data in the worker), 8.1 P1, P2; CONTRACTS 4 (worker.ts)'],
  ['RT-07', 'perf-budget', 0, 'SPEC 7.6 in full, 7.1 (what is not used and why; KaTeX at build time), 7.3 (Mathematics produced while a tool runs: no KaTeX to the client), 5.5 (timings and the 2000 rule), 4 T10 (limits), 4.0 (Growth off the finite types), 9.1 (gates with sizes and lab timings); CONTRACTS 1, 3 (the benchmark)'],
  ['RT-08', 'content-rules', 1, 'SPEC 1.7, 2.4(a) (the bridge sentence), 2.15 (the paragraph What a failed condition 3 means and its wording rule), 4.0 (Stated limits wording; the words not of finite type), 7.3 (the four content components; the release report), 8.1, 8.2, 8.4, 8.5, 9.2, 9.3, 10 (D5, D14, D16, D17), Appendix C, Appendix E, Appendix F (the statements the site must not repeat); SOURCES 11.0 and 11.9'],
  ['RT-09', 'math-claims', 1, 'SPEC 2 in full (the standard against which every claim is checked), 3 in full (every figure table row is a checkable configuration with an expected result), Appendix A, Appendix B, Appendix G; 8.4 (conventions stated when quoting another convention); reference/golden_data.json for every number'],
  ['RT-10', 'spec-compliance', 0, 'SPEC 4 in full (every tool entry and 4.0), 5.3 and 5.4 (phase columns), 5.6, 5.7, 6.6, 7.3, 7.7, 9.1, 9.2, 9.3, 10 (defaults that must be logged), Appendix H; CONTRACTS in full; README 6 (file ownership)'],
  ['RT-11', 'test-integrity', 0, 'SPEC 5.7 in full (golden keys by phase; comparison rules; property tests; regenerating the golden data), 7.7, 9.3, 0.2 item 2; CONTRACTS 3 (harness, covers(), coverage.json, GOLDEN_KEYS_BY_PHASE) and 9 (reference hashes); the test directories of the repository'],
  ['RT-12', 'toolchain-reality', 0, 'SPEC 7.1 in full, 7.2 in full (all ten items), 7.3, 7.7, 7.8, 9.3, 10 D3, D18; SOURCES 11.8; CONTRACTS 1; the registry (npm view) as the source of truth for versions'],
  ['RT-13', 'reader-playtest', 1, 'SPEC 1.2, 1.3, 1.4, 1.6 (Comprehension), 3 in full, 8.1 in full, 8.2, 8.5, 9.4 in full, 9.2; SOURCES 11.6'],
].map(([id, slug, from, sections]) => ({ kind: 'lens', id, slug, from, sections, file: `build-plan/red-team/${id}-${slug}.md` }))

const ROLES = [
  { kind: 'role', id: 'MERGE', file: 'build-plan/agents/MERGE.md' },
  { kind: 'role', id: 'GATE', file: 'build-plan/agents/GATE.md' },
  { kind: 'role', id: 'P7-overview', file: 'build-plan/agents/P7-overview.md' },
  { kind: 'role', id: 'RT-VERIFY', file: 'build-plan/red-team/RT-VERIFY.md' },
  { kind: 'role', id: 'RT-FIX', file: 'build-plan/red-team/RT-FIX.md' },
]

const DRAFT = {
  type: 'object',
  properties: {
    id: { type: 'string' }, file: { type: 'string' }, lines: { type: 'number' },
    sections: { type: 'array', items: { type: 'string' } },
    specSectionsRead: { type: 'array', items: { type: 'string' } },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'file', 'lines', 'sections', 'specSectionsRead', 'uncertainties'],
}
const VERIFY = {
  type: 'object',
  properties: {
    id: { type: 'string' }, complete: { type: 'boolean' }, score: { type: 'number' },
    gaps: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, what: { type: 'string' }, where: { type: 'string' } }, required: ['kind', 'what', 'where'] } },
    strengths: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'complete', 'gaps', 'score'],
}

const common = `Working directory: ${ROOT}. The specification is ${ROOT}/SPEC.md (2548 lines; locate sections with: grep -n '^## \\|^### ' SPEC.md, then read ranges with sed -n 'A,Bp' SPEC.md or the Read tool). The plan is in ${PLAN}/. Write plain sentences; never use an em-dash anywhere in what you write. Do not modify any file other than the one you are asked to write or revise. Shell rule: never use a cd chain (cd X; ... or cd X && ...) and never run a multi-line python3 -c or heredoc inline; use absolute paths in every command and write any script to a file under your scratch directory first, then run it. Commands of those shapes stop and wait for the owner's approval, which is not available.

If the file you are asked to write already exists, it is a prior draft whose author was interrupted before verification: read it first, keep what is correct and complete, and fix or add what is missing against the requirements below instead of starting over; if it is truncated or malformed, rewrite it. The rosters, README.md and CONTRACTS.md on disk are the current truth (build-plan/rosters/phase-0.json, README.md section 6 and CONTRACTS.md section 1 were amended after the first drafts: P0-A5 gained the phase-0 about and credits pages; P0-A6 gained ci.yml, .gitignore, playwright.config.ts and the root Vitest configuration after stage 0.1).`

function draftBuild(it) {
  return `${common}

You are drafting the instruction file for build agent ${it.id} (phase ${it.phase}) of a multi-agent build. Read, in this order:
1. ${PLAN}/README.md: sections 3 (orchestration), 4 (the roster table for phase ${it.phase}), 6 (file ownership), 7 (gates).
2. ${PLAN}/COMMON.md in full (the rules the build agent will follow).
3. ${PLAN}/CONTRACTS.md in full (the interfaces the build agent must honour).
4. ${PLAN}/TEMPLATE-build-agent.md in full (the exact structure of the file you write).
5. ${PLAN}/rosters/phase-${it.phase}.json: the whole file, and in particular the entry "${it.id}" (its spec, oracle, golden, contracts, dependsOn, owns, deliverables, acceptance, traps), the stages, gateItems and ownerPart.
6. Every SPEC.md section the roster entry lists under "spec", IN FULL. Sections marked "in full" are the standard; read the others at least enough to extract every rule that applies to this piece.
7. Every oracle function the entry lists (reference/lie_games.py at the given lines; read the whole function and the helpers it calls).
8. The shape of every golden key the entry lists (python3 -c "import json; d=json.load(open('reference/golden_data.json')); ..." and print a sample).
9. The CONTRACTS.md sections the entry lists, again, now that you know the task.

Then write ${ROOT}/${it.file} following TEMPLATE-build-agent.md exactly: all ten sections, the template's headings, in order, with the header line filled in (id, title, phase, stage, size, where it runs). The reader is the agent that will BUILD this piece; it has CLAUDE.md, COMMON.md, CONTRACTS.md and SPEC.md on disk, so point to sections precisely rather than pasting them, but QUOTE EXACTLY every string that must appear verbatim: announcement templates, stop messages, the bridge sentence of SPEC 2.4(a), LaTeX forms, error class names, data-* hook names, preset ids, golden key spellings, function signatures, matrices and numbers.

Quality bar, which a verifier will check line by line against SPEC.md:
- Section 5 (Requirements) covers EVERY rule in the listed spec sections that applies to this piece. For a tool: every sentence of its SPEC section 4 entry and every rule of 4.0 that applies. For an engine phase: every function in the roster with its CONTRACTS signature, its oracle counterpart, its behaviour on one-way and non-finite boards per SPEC 5.6, its caps and errors, the oracle's choices (lowest position first; orders of candidates and search). For a lesson: every beat and every row of its figure table with the exact configuration (tool, board, view, mode, coords, start, expected result), the anatomy of 8.2, the writing rules of 8.4, the patterns of 8.5, the definition of done of 9.2, and which statements must be wrapped in <Unverified> with which item number. For infrastructure: every deliverable of the roster, with exact file paths and the behaviour of each.
- Section 6 (Acceptance) lists every acceptance criterion from the spec (every bullet under "Acceptance" in the tool's section 4 entry; every golden key of 5.7 for the phase; 9.2 for a lesson; the roster's acceptance list) as a checklist line, each mapped to a named test file and test and to its gate.
- Section 7 (Files) reproduces the roster's "owns" list exactly and names what must not be touched.
- Section 9 (Traps) includes every trap in the roster entry and any others you find by reading the oracle code: places where the oracle's choice is not obvious from the spec text.
- Do not invent requirements. Anything that is the plan's addition rather than the specification's is marked (plan). Where the specification marks something [D], say so. Where it marks something [U], say the builder must wrap it.
- Length: as long as completeness needs, usually 250 to 600 lines.

Return JSON: {"id": "${it.id}", "file": "${it.file}", "lines": <line count of the file you wrote>, "sections": [the ten section headings as written], "specSectionsRead": [...], "uncertainties": ["anything you could not resolve from SPEC.md, for the orchestrator; empty if none"]}`
}

function draftLens(it) {
  return `${common}

You are drafting the instruction file for red-team lens ${it.id} (${it.slug}), which applies from phase ${it.from}. Read, in this order:
1. ${PLAN}/README.md: section 5 in full (the red team; your lens's row in the table of 5.2 is the brief), section 3, section 4 (what each phase builds, so you know what exists at each phase), section 6.
2. ${PLAN}/RED-TEAM-COMMON.md in full.
3. ${PLAN}/CONTRACTS.md in full (what the builders were told; every contract is something you can check).
4. ${PLAN}/TEMPLATE-red-team-lens.md in full.
5. ${PLAN}/rosters/phase-0.json to phase-6.json: the "redTeam.lenses" lists (which phases your lens runs in) and the agents of each phase (what is in scope when).
6. These SPEC.md passages in full, which are the standard your lens enforces: ${it.sections}
7. For a lens that compares with the oracle or the golden data: reference/lie_games.py and reference/golden_data.json as named above.

Then write ${ROOT}/${it.file} following TEMPLATE-red-team-lens.md exactly: all seven sections with the template's headings in order. The reader is an adversary agent with SPEC.md, the plan and the built repository on disk. Make section 4 (Attack list) the heart of the file: between 15 and 40 numbered attacks, each stating what to try (the input, route, command), how (the script shape, Playwright pattern, oracle call), what the specification says must happen (with the section), and what a failure looks like (the observed value that would be a finding). Order from most likely to find a blocker to least. Aim attacks at the places where golden tests are blind: symmetric boards that hide a transposition, labels starting at 1 that hide a +1, caps that fall exactly on a layer boundary, defaults never exercised by a link, strings compared loosely, behaviour off the finite boards, release against preview builds. Mark each attack with the phases in which it applies. Section 5 (Methods) gives concrete commands and reproducer templates (for RT-01: a small Python bridge script that imports lie_games and answers JSON requests on stdin, and a Node driver; for browser lenses: Playwright patterns including JavaScript disabled, request interception, computed styles, the live region; for RT-07: how to measure gzip sizes and draw times; for RT-11: how to hash the reference files and cross-reference coverage.json with GOLDEN_KEYS_BY_PHASE). Section 6 lists what this lens must not report.

Quote exactly every string the lens checks verbatim (templates of 7.5, stop messages of 4.0, the bridge sentence of 2.4(a), the C2 rule, the error class names, the budgets and caps). Do not invent standards: every attack cites a SPEC.md or CONTRACTS.md passage. Length: usually 250 to 600 lines.

Return JSON: {"id": "${it.id}", "file": "${it.file}", "lines": <n>, "sections": [...], "specSectionsRead": [...], "uncertainties": [...]}`
}

function draftRole(it) {
  const briefs = {
    MERGE: `You are drafting ${ROOT}/${it.file}, the instruction for the recurring MERGE role. Read ${PLAN}/README.md sections 3.2, 3.4, 3.5, 3.6, 6 and 7; ${PLAN}/COMMON.md in full; ${PLAN}/CONTRACTS.md sections 1, 3, 9, 10; ${PLAN}/rosters/phase-0.json to phase-6.json (the stages with mergeAfter and the agents' "owns"); SPEC.md 7.7, 9.3 and 7.3 (DECISIONS.md, content/unverified.json). Write the file following ${PLAN}/TEMPLATE-build-agent.md adapted to a role that runs in the PRIMARY checkout (${ROOT}) on main with no worktree, as the only agent besides GATE allowed to change main. The MERGE agent receives: the phase and stage, an ordered list of agent ids with their branch names, worktree paths and JSON reports. It must: confirm main is checked out and clean; for each branch in roster order run git merge --no-ff with a message naming the agent; resolve conflicts in favour of SPEC.md and CONTRACTS.md, never of a branch (a conflict needing a design decision is reported, not guessed); apply the lockfile protocol (accept both package.json sides, delete the conflicted lockfile, run npm install once to regenerate, confirm npm ci works); append every decisions/<id>.md fragment to DECISIONS.md in order under a stage heading; assign the next free E-number to each proposedUnverifiedItems entry and add it to content/unverified.json as open; route each report's "requests" to the owning agent's area or to the orchestrator; run npm ci --prefer-offline, npm run typecheck, npm test; if the stage touched site code run npm run build, npm run e2e and npm run size (one Playwright run at a time); on failure fix integration-level breakage only (imports, paths, registry wiring) and never weaken a test or change a convention, else report blocked with the failing output; remove merged worktrees with git worktree remove but keep branches; write reports/merge-P{k}-{stage}.md; return the report JSON of COMMON.md 5.2 extended with mergedBranches, conflictsResolved, fragmentsAppended, unverifiedItemsAssigned, requestsRouted. Include a section on what MERGE never does (edit reference/, golden, conventions, tests to pass; close an unverified item; push).`,
    GATE: `You are drafting ${ROOT}/${it.file}, the instruction for the recurring GATE role. Read ${PLAN}/README.md sections 3.1, 3.5, 7 and 8; ${PLAN}/COMMON.md in full; ${PLAN}/CONTRACTS.md sections 1, 3 and 9; ${PLAN}/rosters/phase-0.json to phase-6.json (the gateItems and ownerPart of every phase); SPEC.md 9.1 in full (every gate row), 7.7 in full, 7.8 in full, 7.6, 5.7 (the table of golden keys by phase; Regenerating the golden data), 7.3 (the release report of open items), 7.2 item 10. Write the file following ${PLAN}/TEMPLATE-build-agent.md adapted to a role that runs in the PRIMARY checkout (${ROOT}) on main with no worktree after the phase's last MERGE. The GATE agent must: confirm main is clean at the expected commit; run a fresh npm ci; recompute SHA-256 of the three reference files and compare with CONTRACTS.md section 9 (a difference is a blocker); run exactly the commands that the phase's row of SPEC 9.1 and the table of 7.7 require, as written (npm test, npm run build, RELEASE=1 npm run build where the gate names a release build, npm run e2e including the run without JavaScript and axe, npm run size, npm run lab where the gate names lab timings, npm run verify, npm run report); read packages/engine/test/golden/coverage.json and fail if any key of GOLDEN_KEYS_BY_PHASE for phases 0 to k is missing; for G3 and G6 make the release build, keep its two reports (open items, numbers in prose) and, for G6, build the two archives of SPEC 7.8 (one for the Pages address, one with BASE_PATH=/) into reports/; write reports/gate-G{k}.md with one row per gate item (command, exit status, the relevant output lines, pass or fail), the hashes, the installed versions of the pinned packages, the sizes table, the fragments merged during the phase, and the owner's part of the gate from the roster as a checklist; tag the commit gate-G{k}-candidate locally; never soften an item, never retry a flaky test more than once without saying so, never mark pass without the command's output. Return the report JSON of COMMON.md 5.2 extended with a gate table (item, status, evidence) and ownerPart.`,
    'P7-overview': `You are drafting ${ROOT}/${it.file}, the overview of phase 7 (extensions after release 1.0). Read ${PLAN}/README.md section 4 (Phase 7), ${PLAN}/rosters/phase-7.json in full, SPEC.md 1.5 (Planned extensions), 9.1 (phase 7 row), 10 D9, 5.7 (phase 7 row), 5.4 (Golden boards paragraph; orbitPlusZeroMatrices), 2.17 in full, 2.18 (One zero weight), 2.15 (Generalized Satake diagrams; Other encodings), 7.4 (Embedding), and reference/lie_games.py class Phi, coxeter_H, golden_fold, orbit_plus_zero_matrices. Write a file with: the order of the items per D9 and why; for each of the five items a brief of one to two screens following the headings of ${PLAN}/TEMPLATE-build-agent.md in compressed form (objective, read first, inputs, deliverables, requirements, acceptance with the golden keys, files, traps); the rule that a full instruction file is drafted from this roster entry with the same template when the item is scheduled; and the red-team lenses that apply (from the roster). Quote the facts of SPEC 2.17 exactly (roots 10, 30, 120; orders 10, 120, 14400; game lengths 5, 15, 60; the pairs of the golden foldings; the arithmetic and sign rule of Z[phi]).`,
    'RT-VERIFY': `You are drafting ${ROOT}/${it.file}, the instruction for the RT-VERIFY role of the red team. Read ${PLAN}/README.md section 5 in full, ${PLAN}/RED-TEAM-COMMON.md in full (section 6 is the brief), ${PLAN}/CONTRACTS.md, and SPEC.md 0.2 (item 2: the oracle wins), 0.3 (provenance labels), 9.1 (phase assignments), 10 (defaults). Write the file following ${PLAN}/TEMPLATE-red-team-lens.md adapted to a verifier that receives ONE finding (its JSON, including the branch holding the reproducer) and a mode, reproduce or refute. For reproduce mode: check out the gate commit in a fresh worktree, apply only the reproducer file(s) from the finding's branch (git checkout <branch> -- <path>), install with npm ci --prefer-offline, run the reproduction exactly as stated, compare the observed value with the finding's observed, and report reproduced true or false with the command and output; a reproduction that needs steps the finding did not state is false with the reason. For refute mode: do not run the reproducer; read the cited passage and the surrounding section; try the listed refutations (the behaviour is permitted by the text; the finding misreads the passage; the item belongs to a later phase per 3, 4, 5.3, 5.4, 5.7, 9.1; the oracle agrees with the build; it is a [D] choice or a logged default of section 10; it is another lens's territory and already reported); a refutation must cite a section, golden key or oracle function and input; otherwise refuted is false. Give a decision table for severity adjustment. Give the exact output JSON of RED-TEAM-COMMON.md section 6. List what the verifier never does (fix anything; edit the finding; soften on taste).`,
    'RT-FIX': `You are drafting ${ROOT}/${it.file}, the instruction for the RT-FIX role of the red team. Read ${PLAN}/README.md section 5 in full, ${PLAN}/RED-TEAM-COMMON.md in full (section 7 is the brief), ${PLAN}/COMMON.md in full (every rule applies to the fixer), ${PLAN}/CONTRACTS.md section 10, and SPEC.md 9.3. Write the file following ${PLAN}/TEMPLATE-build-agent.md adapted to a fixer that receives a cluster of confirmed findings (their JSON and reproducer paths and branches) in one area and works in a fresh worktree on fix/P{k}-<cluster>. Steps: adopt each reproducer into the owning area's permanent test directory under a plain name with the comment "// regression: <finding id>" (write the equivalent test when the reproducer is a script); fix the cause, never the symptom, never special-casing the reproducer's input; never touch a golden value, a convention, a cap, a comparison rule, or a CONTRACTS interface (report needs-decision instead); run the engine suite, the area's tests and type-checks; commit with "RT-FIX <ids>: <what>"; write decisions/RT-FIX-P{k}-<cluster>.md when a choice the specification leaves open was made; report per finding fixed, needs-decision or could-not-reproduce with evidence. Include a traps section: fixes that hide a bug behind a cap; fixes that change behaviour on one-way or non-finite boards; fixes that break another tool's contract; the temptation to edit the reproducer.`,
  }
  return `${common}

${briefs[it.id]}

Return JSON: {"id": "${it.id}", "file": "${it.file}", "lines": <n>, "sections": [...], "specSectionsRead": [...], "uncertainties": [...]}`
}

function draftPrompt(it) { return it.kind === 'build' ? draftBuild(it) : it.kind === 'lens' ? draftLens(it) : draftRole(it) }

function verifyPrompt(it) {
  const scope = it.kind === 'build'
    ? `the roster entry "${it.id}" in ${PLAN}/rosters/phase-${it.phase}.json, ${PLAN}/TEMPLATE-build-agent.md, ${PLAN}/CONTRACTS.md, ${PLAN}/README.md section 6, and then IN FULL every SPEC.md section the roster entry lists under "spec" (and the oracle functions it lists, read in reference/lie_games.py)`
    : it.kind === 'lens'
      ? `${PLAN}/README.md section 5 (your lens's row and the protocol), ${PLAN}/RED-TEAM-COMMON.md, ${PLAN}/TEMPLATE-red-team-lens.md, ${PLAN}/CONTRACTS.md, and then IN FULL these SPEC.md passages: ${it.sections}`
      : `${PLAN}/README.md sections 3, 5, 7, 8, ${PLAN}/COMMON.md, ${PLAN}/RED-TEAM-COMMON.md, ${PLAN}/CONTRACTS.md, the rosters, and SPEC.md 9.1, 7.7, 7.8, 5.7, 7.3, 2.17, 2.18, 1.5, 10 as relevant to the role`
  const coverage = it.kind === 'build'
    ? `For a tool: every bullet under "Acceptance" in the tool's SPEC section 4 entry appears in section 6 mapped to a test, and every behaviour sentence of the entry and every applicable rule of 4.0 appears in section 5. For an engine phase: every function in the roster appears with its CONTRACTS signature, oracle name, golden key, cap and error behaviour (SPEC 5.6), and every golden key of the roster appears in section 6. For a lesson: every beat and every figure-table row of SPEC section 3 appears with its exact configuration and expected result; the 9.2 definition of done is in section 6; the [U] statements to wrap are named with their E-numbers. For infrastructure: every deliverable and acceptance item of the roster appears. Section 7 reproduces the roster's "owns" exactly. Section 9 contains every trap of the roster.`
    : it.kind === 'lens'
      ? `Section 4 has at least 15 concrete attacks, each with what, how, the SPEC or CONTRACTS passage, and the failure signature, marked with the phases in which it applies; the attacks cover every requirement in the listed SPEC passages that this lens is responsible for (list each requirement you found in the passages and check that an attack targets it); section 5 gives runnable commands; section 6 lists non-findings; section 7 gives the output schema and coverage items. Every quoted string (templates, messages, names, caps) matches SPEC.md exactly.`
      : `Every step the brief for this role requires appears (for MERGE: merge order, conflict policy, lockfile protocol, fragments to DECISIONS.md, unverified items, requests routing, the commands, worktree removal, the report; for GATE: hashes, the exact commands per gate row, coverage.json check, release builds and archives, the gate report table, tagging, the owner's part; for RT-VERIFY: both modes with exact procedures and the output JSON; for RT-FIX: adoption of reproducers, cause not symptom, the forbidden changes, the report; for P7-overview: all five items with golden keys and the D9 order).`
  return `${common}

You are verifying the instruction file ${ROOT}/${it.file} for completeness and fidelity. Do not edit it. Read the file first, then ${scope}.

Check and list every gap as a specific item:
1. Template: all sections of the template present, with the template's headings, in order, and the header line filled in.
2. Coverage: ${coverage}
3. Fidelity: every exact string quoted in the file matches SPEC.md character for character (announcement templates of 7.5, stop messages of 4.0, the bridge sentence of 2.4(a), matrices, numbers, names, LaTeX forms, golden key spellings); every number has the specification's value; signatures match CONTRACTS.md; file ownership matches README section 6 and the roster.
4. Invented or contradicting content: anything stated as a requirement that is in neither SPEC.md nor the plan files, or not marked (plan); anything contradicting COMMON.md, RED-TEAM-COMMON.md or CONTRACTS.md; a phase assignment that disagrees with SPEC 5.3, 5.4, 5.7, 9.1.
5. Style: em-dashes present; vague lines ("and so on", "etc.") where the spec is specific.

Return JSON: {"id": "${it.id}", "complete": <true only if there is no gap of kind 1, 2, 3 or 4>, "score": <1 to 5>, "gaps": [{"kind": "template|coverage|fidelity|invented|style", "what": "<specific: what is missing or wrong, with the spec passage>", "where": "<file section>"}], "strengths": ["..."]}. Be exacting: a missing acceptance bullet is a gap; a template string misquoted by one word is a gap; "most criteria present" is not complete.`
}

function revisePrompt(it, verdict) {
  const template = (it.kind === 'lens' || it.id === 'RT-VERIFY') ? `${PLAN}/TEMPLATE-red-team-lens.md` : `${PLAN}/TEMPLATE-build-agent.md`
  return `${common}

You are revising the instruction file ${ROOT}/${it.file} to close the gaps an independent verifier found. Read the file, then the verifier's report below, then the SPEC.md passages the gaps cite (and the plan files ${PLAN}/CONTRACTS.md, ${PLAN}/README.md section 6, the roster entry, and the template ${template}). Fix every gap in place: add the missing coverage from SPEC.md, correct every misquoted string by copying it from SPEC.md, remove or mark (plan) invented content, restore template structure, remove em-dashes. Do not remove correct content. Do not change what is not a gap.

Verifier report:
${JSON.stringify(verdict, null, 2)}

Return JSON: {"id": "${it.id}", "file": "${it.file}", "lines": <n>, "sections": [...], "specSectionsRead": [...], "uncertainties": ["gaps you could not close from SPEC.md, with the reason"]}`
}

const ALL = [...BUILD, ...ROLES, ...LENSES]
const ONLY = (args && Array.isArray(args.ids)) ? new Set(args.ids) : null
const EXISTING = new Set((args && Array.isArray(args.existing)) ? args.existing : [])
const ITEMS = ONLY ? ALL.filter(it => ONLY.has(it.id)) : ALL
log(`${ITEMS.length} items: ${ITEMS.filter(it => EXISTING.has(it.id)).length} already drafted (verify and revise only), ${ITEMS.filter(it => !EXISTING.has(it.id)).length} to draft`)

const results = await pipeline(
  ITEMS,
  (it) => EXISTING.has(it.id)
    ? Promise.resolve({ id: it.id, file: it.file, lines: 0, sections: [], specSectionsRead: [], uncertainties: [], skippedDraft: true })
    : agent(draftPrompt(it), { label: `draft:${it.id}`, phase: 'Draft', schema: DRAFT, ...OPUS }),
  async (draft, it) => {
    if (!draft) return { id: it.id, file: it.file, status: 'draft-failed' }
    let verdict = await agent(verifyPrompt(it), { label: `verify:${it.id}`, phase: 'Verify', schema: VERIFY, ...OPUS })
    let rounds = 0
    while (verdict && !verdict.complete && rounds < 2) {
      rounds++
      log(`${it.id}: ${verdict.gaps.length} gaps (score ${verdict.score}); revision ${rounds}`)
      const rev = await agent(revisePrompt(it, verdict), { label: `revise:${it.id}#${rounds}`, phase: 'Revise', schema: DRAFT, ...OPUS })
      if (!rev) break
      verdict = await agent(verifyPrompt(it), { label: `verify:${it.id}#${rounds}`, phase: 'Revise', schema: VERIFY, ...OPUS })
    }
    return { id: it.id, file: it.file, status: verdict ? (verdict.complete ? 'complete' : 'gaps-remain') : 'verify-failed',
             rounds, finalScore: verdict ? verdict.score : null, remainingGaps: verdict ? verdict.gaps : [],
             draftUncertainties: draft.uncertainties, skippedDraft: !!draft.skippedDraft }
  },
)

const done = results.filter(Boolean)
log(`Done: ${done.filter(r => r.status === 'complete').length}/${ITEMS.length} verified complete; ${done.filter(r => r.status === 'gaps-remain').length} with remaining gaps; ${results.filter(r => !r).length} dropped`)
return { results: done }
