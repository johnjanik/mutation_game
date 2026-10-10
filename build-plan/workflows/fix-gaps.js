// Close the residual verifier gaps of instruction files (build-plan/reports/verify-gaps-all.json).
// Launch: Workflow({ scriptPath: 'build-plan/workflows/fix-gaps.js', args: { ids: [...], gapsFile: '<absolute path to a JSON {id: [gaps]} file>', files: { "<id>": "<repo-relative path>" } } })
export const meta = {
  name: 'mg-fix-gaps',
  description: 'Revise each instruction file to close the specific gaps its verifier left, then re-verify once',
  phases: [{ title: 'Revise', detail: 'one reviser per file with its gap list' }, { title: 'Verify', detail: 'one re-check per file' }],
}
const ROOT = '/Users/john/Claude/MutationGame'
const PLAN = `${ROOT}/build-plan`
const OPUS = { model: 'opus' }
const common = `Working directory: ${ROOT}. The specification is ${ROOT}/SPEC.md (locate sections with grep -n '^## \\|^### ' ${ROOT}/SPEC.md, read ranges with sed -n 'A,Bp'). The plan is in ${PLAN}/. Write plain sentences; never use an em-dash. Shell rule: absolute paths only, no cd chains, no inline multi-line scripts (write a script file in your scratch directory and run it). Do not modify any file other than the one named.`
const OUT = { type: 'object', properties: { id: { type: 'string' }, closed: { type: 'number' }, left: { type: 'array', items: { type: 'string' } } }, required: ['id', 'closed', 'left'] }
const VER = { type: 'object', properties: { id: { type: 'string' }, complete: { type: 'boolean' }, score: { type: 'number' }, gaps: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, what: { type: 'string' }, where: { type: 'string' } }, required: ['kind', 'what', 'where'] } } }, required: ['id', 'complete', 'score', 'gaps'] }
const items = args.ids.map(id => ({ id, file: args.files[id] }))
const GAPS = args.gapsFile
log(`${items.length} files to revise`)
const results = await pipeline(items,
  it => agent(`${common}

You are closing the residual gaps an independent verifier found in ${ROOT}/${it.file}. Read the file, then for each gap below read the SPEC.md or plan passage it cites (CONTRACTS.md, README.md, COMMON.md, RED-TEAM-COMMON.md, the rosters, or another instruction file in ${PLAN}/agents or ${PLAN}/red-team), and fix the gap in place: resolve self-contradictions by choosing the form that matches SPEC.md or CONTRACTS.md and testing that form; correct misquoted strings by copying from SPEC.md; mark plan additions "(plan)" or remove them; add missing acceptance lines with a named test; add missing coverage from the cited passage; fix wrong citations. Do not remove correct content and do not change what is not a gap. Keep the template structure and headings.

The gap list is the entry "${it.id}" of the JSON file ${GAPS} (an array of {kind, what, where}); read it first with python3 or jq.

Return JSON {"id": "${it.id}", "closed": <number of gaps closed>, "left": ["any gap you could not close, with the reason"]}`, { label: `fix:${it.id}`, phase: 'Revise', schema: OUT, ...OPUS }),
  (fix, it) => agent(`${common}

Re-verify ${ROOT}/${it.file} against this list of previously reported gaps only (each should now be closed), and against the plan files it cites. For each listed gap say whether it is closed. Report any new contradiction the revision introduced. Do not edit the file.

The previously reported gaps are the entry "${it.id}" of the JSON file ${GAPS}; read it first.

Return JSON {"id": "${it.id}", "complete": <true if every listed gap is closed and nothing new is wrong>, "score": <1 to 5>, "gaps": [remaining or new gaps, each {kind, what, where}]}`, { label: `recheck:${it.id}`, phase: 'Verify', schema: VER, ...OPUS }).then(v => ({ id: it.id, fix, verdict: v })))
const done = results.filter(Boolean)
log(`${done.filter(r => r.verdict && r.verdict.complete).length}/${items.length} complete after the fix pass`)
return { results: done }
