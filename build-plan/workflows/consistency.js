// Cross-file consistency check of the plan's instruction files (build-plan/README.md section 2).
// Launch: Workflow({ scriptPath: 'build-plan/workflows/consistency.js' })
// Run after the instruction files are drafted, and again after any hand edit to the plan.

export const meta = {
  name: 'mg-plan-consistency',
  description: 'Check every agent and lens instruction file against the rosters, README and CONTRACTS for ids, ownership, dependencies and lens phases; fix unambiguous slips in place; report the rest',
  phases: [{ title: 'Consistency', detail: 'one agent reads all instruction files and the plan' }],
}

const ROOT = '/Users/john/Claude/MutationGame'
const PLAN = `${ROOT}/build-plan`

const CONS = {
  type: 'object',
  properties: {
    filesChecked: { type: 'number' },
    missingFiles: { type: 'array', items: { type: 'string' } },
    fixedInPlace: { type: 'array', items: { type: 'string' } },
    needsOrchestrator: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, issue: { type: 'string' } }, required: ['file', 'issue'] } },
    summary: { type: 'string' },
  },
  required: ['filesChecked', 'missingFiles', 'fixedInPlace', 'needsOrchestrator', 'summary'],
}

phase('Consistency')
const cons = await agent(`Working directory: ${ROOT}. Write plain sentences; never use an em-dash anywhere in what you write. Shell rule: never use a cd chain (cd X; ... or cd X && ...) and never run a multi-line python3 -c or heredoc inline; use absolute paths in every command and write any script to a file under your scratch directory first, then run it. Commands of those shapes stop and wait for the owner's approval, which is not available.

You are checking the whole set of instruction files in ${PLAN}/agents/ and ${PLAN}/red-team/ for cross-file consistency with ${PLAN}/README.md, ${PLAN}/CONTRACTS.md and ${PLAN}/rosters/phase-0.json to phase-7.json. Read all of them (the agent files are long; read each at least for its header, section 3 Inputs, section 7 Files, and the ids, file paths, function names, preset ids, data-out names and CSS custom properties it names).

Check:
1. Every agent id in the rosters for phases 0 to 6 has a file agents/<id>-<slug>.md; agents/MERGE.md, agents/GATE.md, agents/P7-overview.md exist; every lens RT-01 to RT-13 has a file red-team/<id>-<slug>.md; red-team/RT-VERIFY.md and red-team/RT-FIX.md exist. List missing files.
2. Each file's header line (id, phase, stage, size, where it runs) agrees with the roster.
3. Each file's section 7 "You own" agrees with the roster's "owns" and with README section 6; no two agents in the same stage own the same file; where a later agent extends an earlier agent's file, a protocol word (additive, extensions only, protocol) is present.
4. Each file's section 3 "Inputs you depend on" names only agents of earlier stages or earlier phases (per the rosters' stages and dependsOn) and names them by the correct id.
5. Every reference from one file to another (an id, a file path, a function name, a preset id, a data-out name, a CSS custom property, a golden key spelling) exists in the referenced file, in CONTRACTS.md or in the golden file with the same spelling.
6. Each lens file's phase applicability agrees with the rosters' redTeam.lenses lists.
7. No em-dash anywhere in the two directories (grep for the character U+2014).
8. Every build-agent file has the ten sections of TEMPLATE-build-agent.md in order; every lens file has the seven sections of TEMPLATE-red-team-lens.md.

9. Resolve every item in ${PLAN}/reports/cross-file-items.json (each names a file, a kind and a description of a contradiction between two instruction files or a stale description of another agent's work). For each, read both files involved, decide the correct state from SPEC.md, CONTRACTS.md and the roster, make the two files agree (edit the instruction files only), and list what you did under fixedInPlace with the item's file name.

Fix in place every inconsistency whose correct value is unambiguous from the rosters, README section 6 or CONTRACTS.md (a misspelled id, a wrong stage number, a missing protocol word, an em-dash, a wrong file path, a misspelled golden key). Report everything else for the orchestrator with the file and the issue. Do not touch README.md, CONTRACTS.md, COMMON.md, RED-TEAM-COMMON.md or the rosters: inconsistencies there are reported, not fixed.

Return JSON: {"filesChecked": <n>, "missingFiles": [...], "fixedInPlace": ["<file>: <what>"], "needsOrchestrator": [{"file": "...", "issue": "..."}], "summary": "<five sentences at most>"}`, { label: 'consistency', schema: CONS, model: 'opus' })

return cons
