// Build one phase of Two Games on a Dynkin Diagram from its roster (build-plan/README.md section 3).
// Launch: Workflow({ scriptPath: 'build-plan/workflows/build-phase.js', args: <the parsed JSON of build-plan/rosters/phase-k.json> })
// Stages run in order. Within a stage, agents run in parallel in worktrees (at most CHUNK at once), then MERGE
// integrates the stage into main. The last stage is GATE. The script stops at the first MERGE or GATE that is not green.

export const meta = {
  name: 'mg-build-phase',
  description: 'Build one phase of the Two Games site from its roster: parallel build agents in worktrees, MERGE after each stage, GATE at the end',
  phases: [
    { title: 'Build', detail: 'the stage\'s agents, in worktrees' },
    { title: 'Merge', detail: 'MERGE integrates the stage into main and runs the fast checks' },
    { title: 'Gate', detail: 'GATE runs the automatic part of the gate and writes the report' },
  ],
}

const ROOT = '/Users/john/Claude/MutationGame'
const PLAN = `${ROOT}/build-plan`
const CHUNK = 4            // build agents at once (README 3.4: memory, not processors, is the limit)
const R = args             // the roster of the phase
if (!R || typeof R.phase !== 'number' || !Array.isArray(R.stages)) throw new Error('args must be the parsed roster JSON of one phase')

// Model policy (README 3.6, decided by the owner on 10 October 2026): build agents run on Opus by default;
// engine ports run on the session model (Fable), as do MERGE and GATE. A roster entry may set "model" to override.
// Omitting `model` inherits the session model.
function modelFor(id) {
  const a = R.agents[id]
  if (a && a.model) return a.model === 'inherit' ? undefined : a.model
  if (a && /^engine-/.test(a.slug)) return undefined
  return 'opus'
}
const modelOpt = (m) => (m ? { model: m } : {})

const REPORT = {
  type: 'object',
  properties: {
    agent: { type: 'string' },
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    branch: { type: 'string' }, worktree: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    filesChanged: { type: 'array', items: { type: 'string' } },
    commandsRun: { type: 'array', items: { type: 'object', properties: { cmd: { type: 'string' }, exit: { type: 'number' }, summary: { type: 'string' } }, required: ['cmd', 'exit', 'summary'] } },
    acceptance: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, status: { type: 'string' }, test: { type: 'string' } }, required: ['item', 'status'] } },
    deviations: { type: 'array', items: { type: 'object', properties: { spec: { type: 'string' }, what: { type: 'string' }, why: { type: 'string' } }, required: ['what'] } },
    requests: { type: 'array', items: { type: 'object', properties: { to: { type: 'string' }, what: { type: 'string' } }, required: ['to', 'what'] } },
    proposedUnverifiedItems: { type: 'array', items: { type: 'object', properties: { statement: { type: 'string' }, whereToCheck: { type: 'string' }, fallback: { type: 'string' } }, required: ['statement'] } },
    decisionsFragment: { type: 'string' },
    openQuestions: { type: 'array', items: { type: 'string' } },
    handoff: { type: 'string' },
  },
  required: ['agent', 'status', 'branch', 'commits', 'filesChanged', 'commandsRun', 'acceptance', 'deviations', 'handoff'],
}

const GATE_REPORT = {
  type: 'object',
  properties: {
    agent: { type: 'string' }, status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    gate: { type: 'string' }, green: { type: 'boolean' }, commit: { type: 'string' }, reportFile: { type: 'string' },
    gateTable: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, status: { type: 'string' }, evidence: { type: 'string' } }, required: ['item', 'status'] } },
    ownerPart: { type: 'array', items: { type: 'string' } },
    commandsRun: { type: 'array', items: { type: 'object', properties: { cmd: { type: 'string' }, exit: { type: 'number' }, summary: { type: 'string' } }, required: ['cmd', 'exit', 'summary'] } },
    handoff: { type: 'string' },
  },
  required: ['agent', 'status', 'gate', 'green', 'commit', 'gateTable', 'ownerPart', 'commandsRun', 'handoff'],
}

const chunks = (xs, n) => xs.reduce((acc, x, i) => (i % n ? acc[acc.length - 1].push(x) : acc.push([x]), acc), [])

function buildPrompt(id, stage) {
  const a = R.agents[id]
  const file = `${PLAN}/agents/${id}-${a.slug}.md`
  const where = stage.isolation === 'worktree'
    ? 'You are in a fresh git worktree on your own branch; confirm with git rev-parse --show-toplevel and git branch --show-current, and never touch main.'
    : `You run in the primary checkout ${ROOT} with no worktree (this stage creates the repository); you may commit to main as your instruction says.`
  return `Working directory: ${ROOT}. You are build agent ${id} of phase ${R.phase} ("${R.title}"), stage ${stage.name}. ${where}

Read, in this order, and follow completely: ${PLAN}/COMMON.md; ${PLAN}/CONTRACTS.md; ${file} (your instruction; it names the SPEC.md sections you must read in full before writing anything). SPEC.md, SOURCES.md and reference/ are at ${ROOT}. The repository's CLAUDE.md applies once it exists.

Carry out your instruction to completion: every deliverable, every test it names, type-checks, commits on your branch with messages prefixed "${id}:", your decisions fragment decisions/${id}.md, and the report. If you are blocked, finish everything that does not depend on the blocker and report honestly. Run only your own tests and the engine suite; do not run the whole browser suite, npm run size or npm run lab unless your instruction says so. Do not run npm install (npm ci --prefer-offline only). Do not edit reference/, DECISIONS.md, root package.json or the lockfile unless your instruction lists them under "You own".

Your final message is the JSON report of COMMON.md section 5.2 and nothing else.`
}

function mergePrompt(stage, reports) {
  const good = reports.filter(r => r && r.status !== 'blocked')
  const bad = reports.filter(r => !r || r.status === 'blocked')
  return `Working directory: ${ROOT}. You are the MERGE agent for phase ${R.phase} ("${R.title}"), stage ${stage.name}. You run in the primary checkout on main (no worktree). Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md and ${PLAN}/agents/MERGE.md and follow MERGE.md completely.

Merge these branches into main IN THIS ORDER (roster order), each with its report:
${JSON.stringify(good.map(r => ({ agent: r.agent, branch: r.branch, worktree: r.worktree, status: r.status, filesChanged: r.filesChanged, requests: r.requests || [], proposedUnverifiedItems: r.proposedUnverifiedItems || [], decisionsFragment: r.decisionsFragment, deviations: r.deviations })), null, 2)}

Agents that did not finish (do not merge; record in your report):
${JSON.stringify(bad.map(r => r ? { agent: r.agent, status: r.status, handoff: r.handoff, openQuestions: r.openQuestions } : { agent: 'unknown', status: 'no report' }), null, 2)}

After merging run the checks MERGE.md requires for a stage that ${stage.touchesSite === false ? 'did not touch site code' : 'may have touched site code'}. Write reports/merge-P${R.phase}-${stage.name}.md. Your final message is the JSON report of COMMON.md section 5.2 extended as MERGE.md says, and nothing else. status "done" means main is green after the merge; "blocked" means you stopped with main at the last green commit.`
}

function gatePrompt(stage) {
  return `Working directory: ${ROOT}. You are the GATE agent for phase ${R.phase} ("${R.title}"), gate ${R.gate}. You run in the primary checkout on main (no worktree). Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md and ${PLAN}/agents/GATE.md and follow GATE.md completely.

The gate's automatic items, from the roster (SPEC.md 9.1 is the authority; the roster restates it):
${JSON.stringify(R.gateItems, null, 2)}
Release named by this gate: ${R.release ? R.release : 'none'}.
The owner's part, to be listed in the report as due (never run by you): ${JSON.stringify(R.ownerPart)}

Run every command as written, never soften an item, write reports/gate-${R.gate}.md, tag gate-${R.gate}-candidate locally. Your final message is the JSON gate report (agent, status, gate, green, commit, reportFile, gateTable, ownerPart, commandsRun, handoff) and nothing else.`
}

const stageResults = []
for (const stage of R.stages) {
  if (stage.gate) {
    phase('Gate')
    log(`Phase ${R.phase}: gate ${R.gate}`)
    const g = await agent(gatePrompt(stage), { label: `GATE ${R.gate}`, phase: 'Gate', schema: GATE_REPORT })
    stageResults.push({ stage: stage.name, gate: g })
    if (!g || !g.green) { log(`Gate ${R.gate} is NOT green`); return { phase: R.phase, stoppedAt: stage.name, stages: stageResults } }
    log(`Gate ${R.gate} green at ${g.commit}`)
    continue
  }

  phase('Build')
  log(`Phase ${R.phase}, stage ${stage.name}: ${stage.agents.join(', ')}`)
  const reports = []
  for (const group of chunks(stage.agents, CHUNK)) {
    const rs = await parallel(group.map(id => () => agent(buildPrompt(id, stage), {
      label: id, phase: 'Build', schema: REPORT,
      ...(stage.isolation === 'worktree' ? { isolation: 'worktree' } : {}),
      ...modelOpt(modelFor(id)),
    })))
    rs.forEach((r, i) => { if (!r) log(`${group[i]}: no report (skipped or failed)`); else log(`${group[i]}: ${r.status} on ${r.branch}`) })
    reports.push(...rs)
  }

  if (stage.mergeAfter) {
    phase('Merge')
    const m = await agent(mergePrompt(stage, reports), { label: `MERGE ${stage.name}`, phase: 'Merge', schema: REPORT })
    stageResults.push({ stage: stage.name, reports, merge: m })
    if (!m || m.status === 'blocked') { log(`MERGE ${stage.name} blocked; stopping phase ${R.phase}`); return { phase: R.phase, stoppedAt: stage.name, stages: stageResults } }
  } else {
    stageResults.push({ stage: stage.name, reports })
    const blocked = reports.filter(r => !r || r.status === 'blocked')
    if (blocked.length) { log(`Stage ${stage.name} has a blocked agent and no merge step; stopping`); return { phase: R.phase, stoppedAt: stage.name, stages: stageResults } }
  }
}

return { phase: R.phase, gate: R.gate, completed: true, stages: stageResults }
