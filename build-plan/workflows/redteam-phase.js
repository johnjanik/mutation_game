// Red-team one phase of Two Games on a Dynkin Diagram (build-plan/README.md section 5).
// Launch: Workflow({ scriptPath: 'build-plan/workflows/redteam-phase.js', args: { roster: <parsed roster JSON>, gateCommit: '<sha>' } })
// Round: lenses find → dedupe → verify (reproduce + refute) → cluster → fix in worktrees → MERGE → rerun the lenses that
// confirmed findings → GATE. Repeat until a round confirms nothing, or maxRounds.

export const meta = {
  name: 'mg-redteam-phase',
  description: 'Red-team one built phase: parallel lenses, two-stage verification of every finding, fixes, retest, gate rerun; loop until dry',
  phases: [
    { title: 'Find', detail: 'the lenses that apply to the phase, in parallel, read-only' },
    { title: 'Verify', detail: 'reproduce and refute every finding' },
    { title: 'Fix', detail: 'one fixer per cluster of confirmed findings, in worktrees; MERGE' },
    { title: 'Retest', detail: 'rerun the lenses that confirmed findings; rerun the gate' },
  ],
}

const ROOT = '/Users/john/Claude/MutationGame'
const PLAN = `${ROOT}/build-plan`
const R = args && args.roster
let gateCommit = args && args.gateCommit
if (!R || !gateCommit) throw new Error('args must be { roster: <phase roster JSON>, gateCommit: <sha> }')
const MAX_ROUNDS = (R.redTeam && R.redTeam.maxRounds) || 3
const LENSES = R.redTeam.lenses
const LENS_SLUG = {
  'RT-01': 'differential-oracle', 'RT-02': 'convention-drift', 'RT-03': 'bounds-and-errors', 'RT-04': 'codec-attacker',
  'RT-05': 'a11y-and-layout', 'RT-06': 'no-js-and-no-worker', 'RT-07': 'perf-budget', 'RT-08': 'content-rules',
  'RT-09': 'math-claims', 'RT-10': 'spec-compliance', 'RT-11': 'test-integrity', 'RT-12': 'toolchain-reality', 'RT-13': 'reader-playtest',
}
const LENS_CHUNK = 6, FIX_CHUNK = 4

// Model policy (README 3.6, decided by the owner on 10 October 2026): lenses and fixers run on Opus;
// RT-VERIFY (both modes), MERGE and GATE run on the session model (Fable). Omitting `model` inherits the session model.
const OPUS = { model: 'opus' }

const FINDING = {
  type: 'object',
  properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, title: { type: 'string' },
    location: { type: 'string' }, claim: { type: 'string' }, expected: { type: 'string' }, observed: { type: 'string' },
    reproduction: { type: 'string' }, specRef: { type: 'string' }, proposedFix: { type: 'string' }, reproducer: { type: 'string' },
  },
  required: ['id', 'severity', 'title', 'location', 'claim', 'expected', 'observed', 'reproduction', 'specRef'],
}
const LENS_OUT = {
  type: 'object',
  properties: {
    lens: { type: 'string' }, phase: { type: 'number' }, gateCommit: { type: 'string' }, branch: { type: 'string' },
    coverage: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: FINDING },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['lens', 'phase', 'gateCommit', 'branch', 'coverage', 'findings', 'notes'],
}
const VERDICT = {
  type: 'object',
  properties: {
    findingId: { type: 'string' }, mode: { type: 'string', enum: ['reproduce', 'refute'] },
    reproduced: { type: 'boolean' }, refuted: { type: 'boolean' }, citation: { type: 'string' }, evidence: { type: 'string' },
    severityAdjustment: { type: 'string' }, reason: { type: 'string' },
  },
  required: ['findingId', 'mode', 'reproduced', 'refuted', 'evidence', 'reason'],
}
const FIX_REPORT = {
  type: 'object',
  properties: {
    agent: { type: 'string' }, status: { type: 'string', enum: ['done', 'partial', 'blocked'] }, branch: { type: 'string' }, worktree: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } }, filesChanged: { type: 'array', items: { type: 'string' } },
    commandsRun: { type: 'array', items: { type: 'object', properties: { cmd: { type: 'string' }, exit: { type: 'number' }, summary: { type: 'string' } }, required: ['cmd', 'exit', 'summary'] } },
    acceptance: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, status: { type: 'string', enum: ['fixed', 'needs-decision', 'could-not-reproduce'] }, test: { type: 'string' } }, required: ['item', 'status'] } },
    deviations: { type: 'array', items: { type: 'object', properties: { spec: { type: 'string' }, what: { type: 'string' }, why: { type: 'string' } }, required: ['what'] } },
    decisionsFragment: { type: 'string' }, handoff: { type: 'string' },
  },
  required: ['agent', 'status', 'branch', 'commits', 'filesChanged', 'commandsRun', 'acceptance', 'deviations', 'handoff'],
}
const MERGE_REPORT = { type: 'object', properties: { agent: { type: 'string' }, status: { type: 'string', enum: ['done', 'partial', 'blocked'] }, handoff: { type: 'string' }, commit: { type: 'string' } }, required: ['agent', 'status', 'handoff'] }
const GATE_REPORT = { type: 'object', properties: { agent: { type: 'string' }, status: { type: 'string' }, gate: { type: 'string' }, green: { type: 'boolean' }, commit: { type: 'string' }, gateTable: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, status: { type: 'string' }, evidence: { type: 'string' } }, required: ['item', 'status'] } }, handoff: { type: 'string' } }, required: ['agent', 'status', 'gate', 'green', 'commit', 'gateTable', 'handoff'] }

const chunks = (xs, n) => xs.reduce((acc, x, i) => (i % n ? acc[acc.length - 1].push(x) : acc.push([x]), acc), [])
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const key = (f) => `${norm(f.location).split(' ').slice(0, 4).join(' ')}|${norm(f.claim).split(' ').slice(0, 10).join(' ')}`

function lensPrompt(lens, round, focus) {
  return `Working directory: ${ROOT}. You are red-team lens ${lens} (${LENS_SLUG[lens]}) attacking phase ${R.phase} ("${R.title}") at gate commit ${gateCommit}, round ${round}. You are in a fresh worktree on your own branch; confirm with git branch --show-current and never touch main.

Read ${PLAN}/RED-TEAM-COMMON.md, ${PLAN}/CONTRACTS.md and ${PLAN}/red-team/${lens}-${LENS_SLUG[lens]}.md and follow the lens file completely for the attacks that apply to phase ${R.phase}. Read reports/gate-${R.gate}.md and the build agents' reports referenced there to see what was claimed.${focus ? `\n\nThis is a RETEST round after fixes. Focus first on these areas, where your earlier findings were fixed: ${focus}. Then run the rest of your attack list as time allows.` : ''}

Commit every reproducer on your branch. Your final message is the JSON of RED-TEAM-COMMON.md section 5 and nothing else: lens, phase, gateCommit, branch, coverage, findings (ids ${`P${R.phase}-${lens}-NN`}), notes.`
}

function verifyPrompt(f, mode) {
  return `Working directory: ${ROOT}. You are an RT-VERIFY agent in ${mode} mode for one red-team finding on phase ${R.phase} at gate commit ${gateCommit}. Read ${PLAN}/RED-TEAM-COMMON.md section 6 and ${PLAN}/red-team/RT-VERIFY.md and follow them exactly for the ${mode} mode. You are in a fresh worktree; do not touch main.

The finding:
${JSON.stringify(f, null, 2)}

Your final message is the JSON of RED-TEAM-COMMON.md section 6 and nothing else.`
}

function fixPrompt(cluster, findings) {
  return `Working directory: ${ROOT}. You are an RT-FIX agent for phase ${R.phase}, cluster "${cluster}". You are in a fresh worktree on your own branch; never touch main. Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md, ${PLAN}/RED-TEAM-COMMON.md section 7 and ${PLAN}/red-team/RT-FIX.md and follow them exactly.

Confirmed findings to fix (each reproducer is on the lens branch named in its id's lens; fetch it with git checkout <branch> -- <path>):
${JSON.stringify(findings, null, 2)}

Your final message is the JSON report of COMMON.md section 5.2 with one acceptance line per finding (status fixed, needs-decision or could-not-reproduce), and nothing else.`
}

function mergePrompt(round, fixReports) {
  const good = fixReports.filter(r => r && r.status !== 'blocked')
  return `Working directory: ${ROOT}. You are the MERGE agent for the red-team fixes of phase ${R.phase}, round ${round}. You run in the primary checkout on main (no worktree). Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md and ${PLAN}/agents/MERGE.md and follow MERGE.md completely, treating each fix branch as a build branch.

Branches to merge in this order:
${JSON.stringify(good.map(r => ({ agent: r.agent, branch: r.branch, worktree: r.worktree, filesChanged: r.filesChanged, decisionsFragment: r.decisionsFragment, deviations: r.deviations })), null, 2)}

After merging run the full checks (engine and unit tests, build, e2e, size). Write reports/merge-P${R.phase}-redteam-round${round}.md. Your final message is JSON {agent, status, commit, handoff} and nothing else; status "done" means main is green at "commit".`
}

function gatePrompt(round) {
  return `Working directory: ${ROOT}. You are the GATE agent rerunning gate ${R.gate} for phase ${R.phase} after red-team round ${round}. You run in the primary checkout on main (no worktree). Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md and ${PLAN}/agents/GATE.md and follow GATE.md completely. Gate items (SPEC.md 9.1 is the authority): ${JSON.stringify(R.gateItems)}. Release: ${R.release || 'none'}. Write reports/gate-${R.gate}.md (overwrite; note the round). Your final message is the JSON gate report and nothing else.`
}

const rounds = []
const seen = new Set()
let focusAreas = null

for (let round = 1; round <= MAX_ROUNDS; round++) {
  phase('Find')
  const lensesThisRound = round === 1 ? LENSES : (rounds[rounds.length - 1].lensesToRerun)
  log(`Round ${round}: ${lensesThisRound.length} lenses on ${gateCommit}`)
  const lensOut = []
  for (const group of chunks(lensesThisRound, LENS_CHUNK)) {
    const rs = await parallel(group.map(l => () => agent(lensPrompt(l, round, focusAreas), { label: `${l} r${round}`, phase: 'Find', schema: LENS_OUT, isolation: 'worktree', ...OPUS })))
    lensOut.push(...rs.filter(Boolean))
  }
  const raw = lensOut.flatMap(o => o.findings.map(f => ({ ...f, lens: o.lens, branch: o.branch })))
  const fresh = []
  for (const f of raw) { const k = key(f); if (!seen.has(k)) { seen.add(k); fresh.push(f) } }
  log(`Round ${round}: ${raw.length} findings, ${fresh.length} new after dedupe (${raw.filter(f => f.severity === 'blocker').length} blockers claimed)`)

  if (!fresh.length) { rounds.push({ round, lenses: lensOut, findings: [], confirmed: [], dropped: [], lensesToRerun: [] }); log(`Round ${round}: dry`); break }

  phase('Verify')
  const verified = await parallel(fresh.map(f => () =>
    parallel([() => agent(verifyPrompt(f, 'reproduce'), { label: `repro ${f.id}`, phase: 'Verify', schema: VERDICT, isolation: 'worktree' }),
              () => agent(verifyPrompt(f, 'refute'), { label: `refute ${f.id}`, phase: 'Verify', schema: VERDICT })])
      .then(([rep, ref]) => ({ f, rep, ref, confirmed: !!(rep && rep.reproduced) && !(ref && ref.refuted) }))))
  const confirmed = verified.filter(v => v.confirmed).map(v => ({ ...v.f, verification: { reproduce: v.rep, refute: v.ref } }))
  const dropped = verified.filter(v => !v.confirmed).map(v => ({ id: v.f.id, title: v.f.title, reason: !v.rep || !v.rep.reproduced ? `not reproduced: ${v.rep ? v.rep.reason : 'no verdict'}` : `refuted: ${v.ref.citation} ${v.ref.reason}` }))
  log(`Round ${round}: ${confirmed.length} confirmed (${confirmed.filter(f => f.severity === 'blocker').length} blockers), ${dropped.length} dropped`)

  if (!confirmed.length) { rounds.push({ round, lenses: lensOut, findings: fresh, confirmed, dropped, lensesToRerun: [] }); log(`Round ${round}: nothing confirmed; dry`); break }

  phase('Fix')
  const byCluster = {}
  for (const f of confirmed) { const c = String(f.location).split(/[:#]/)[0].split('/').slice(0, 3).join('/') || 'misc'; (byCluster[c] = byCluster[c] || []).push(f) }
  const clusters = Object.entries(byCluster)
  log(`Round ${round}: ${clusters.length} fix clusters: ${clusters.map(([c, fs]) => `${c} (${fs.length})`).join('; ')}`)
  const fixReports = []
  for (const group of chunks(clusters, FIX_CHUNK)) {
    const rs = await parallel(group.map(([c, fs]) => () => agent(fixPrompt(c, fs), { label: `fix ${c}`, phase: 'Fix', schema: FIX_REPORT, isolation: 'worktree', ...OPUS })))
    fixReports.push(...rs)
  }
  const merge = await agent(mergePrompt(round, fixReports), { label: `MERGE fixes r${round}`, phase: 'Fix', schema: MERGE_REPORT })
  if (!merge || merge.status === 'blocked') { rounds.push({ round, lenses: lensOut, findings: fresh, confirmed, dropped, fixReports, merge, stopped: 'merge blocked' }); log('Fix merge blocked; stopping'); break }
  if (merge.commit) gateCommit = merge.commit

  phase('Retest')
  const gate = await agent(gatePrompt(round), { label: `GATE ${R.gate} r${round}`, phase: 'Retest', schema: GATE_REPORT })
  const lensesToRerun = [...new Set(confirmed.map(f => f.lens))]
  focusAreas = clusters.map(([c]) => c).join(', ')
  rounds.push({ round, lenses: lensOut, findings: fresh, confirmed, dropped, fixReports, merge, gate, lensesToRerun })
  log(`Round ${round}: gate ${gate && gate.green ? 'green' : 'NOT green'} at ${gateCommit}; rerunning ${lensesToRerun.join(', ')} next`)
  if (round === MAX_ROUNDS) log(`Reached ${MAX_ROUNDS} rounds with findings still confirmed in the last round; the orchestrator decides`)
}

const last = rounds[rounds.length - 1]
return {
  phase: R.phase, gate: R.gate, finalGateCommit: gateCommit,
  dry: !!last && last.confirmed.length === 0,
  rounds: rounds.map(r => ({ round: r.round, found: r.findings.length, confirmed: r.confirmed.length, dropped: r.dropped.length,
    blockersConfirmed: r.confirmed.filter(f => f.severity === 'blocker').length, gateGreen: r.gate ? r.gate.green : null, stopped: r.stopped || null })),
  confirmedAll: rounds.flatMap(r => r.confirmed.map(f => ({ id: f.id, severity: f.severity, title: f.title, location: f.location, lens: f.lens }))),
  droppedAll: rounds.flatMap(r => r.dropped),
  fixOutcomes: rounds.flatMap(r => (r.fixReports || []).filter(Boolean).flatMap(x => x.acceptance.map(a => ({ fixer: x.agent, ...a })))),
  notes: rounds.flatMap(r => r.lenses.flatMap(o => o.notes.map(n => `${o.lens}: ${n}`))),
  coverage: rounds.flatMap(r => r.lenses.map(o => ({ lens: o.lens, round: r.round, coverage: o.coverage }))),
}
