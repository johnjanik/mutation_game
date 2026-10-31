export const meta = {
  name: 'mg-redteam-find-verify',
  description: 'Red-team lenses attack the integration branch at one commit; every finding is reproduced and independently refuted; returns confirmed and dropped findings (no fixing)',
  whenToUse: 'Red-team round of the Two Games build; args name the lenses, the commit, the phases in scope and the round',
  phases: [
    { title: 'Find', detail: 'lenses in worktrees, read-only against the commit' },
    { title: 'Verify', detail: 'reproduce and refute every finding' },
  ],
}

const ROOT = '/home/user/mutation_game'
const PLAN = `${ROOT}/build-plan`
const SCRATCH = '/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad'
const A = args
if (!A || !A.commit || !Array.isArray(A.lenses)) throw new Error('args: { commit, round, phaseLabel, lenses: [{ id, slug, index }], focus? }')
const PHASE = A.phaseNumber || 3

const env = (who, port, setup) => `Environment (the plan was written for the owner's Mac; these notes override it):
- Repository root: ${ROOT}. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and ${ROOT} for files you only read). Wherever it says main, read the integration branch claude/session-6a181f60-hzzoud, which moves while you work (phase 4 is being built on other branches and merged there): you attack the commit ${A.commit} only. Never check out the integration branch, never commit to it, never push.
- FIRST, in your fresh worktree: ${setup}; then npm ci --prefer-offline once. Never npm install.
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13 (reference/verify.py runs from reference/; Python scripts that import lie_games run without -I). Other agents work at the same time: use only your own scratch directory ${SCRATCH}/${who}/ and only your own ports ${port} to ${port + 3}.
- Browsers: only Chromium is installed. Every Playwright or Lighthouse run needs PLAYWRIGHT_BROWSERS_PATH=${SCRATCH}/pw-browsers in its environment. Never run playwright install. Never set TMPDIR for Playwright (Chromium crashes under the scratch path). WebKit and Firefox cannot be installed here (network policy).
- Preview servers: never use port 4321 and never pkill broadly. For browser runs copy playwright.config.ts to your scratch directory with the webServer command \`node node_modules/astro/bin/astro.mjs preview --port ${port} --ignore-lock\` run in site/ and baseURL on that port, and run npx playwright test -c <your copy> <spec>; stop your server with pkill -f "port ${port}". npm run size takes -- --port ${port + 1}; npm run lab takes -- --port ${port + 2}.
- The machine is shared, so timing measurements are noisy: check uptime, measure when the load is low, and repeat a timing result before reporting it.
- Last step before your final message: commit what you must commit, then delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree to free disk.`

const KNOWN = `Known and decided, so not findings by themselves (cite them if you think one breaks SPEC.md anyway):
- The integration branch claude/session-6a181f60-hzzoud stands in for main (DECISIONS.md, P0-A1 entry). The red teams of phases 0, 1 and 2 never ran, so every attack your lens file lists for phases 0 to ${PHASE} is in scope now.
- Gate G3's lab timings: Total Blocking Time 242 to 332 ms on the lessons M0 to M5 at four times slowdown on this container, which the owner accepted as machine-bound on 17 October 2026 (DECISIONS.md, "OWNER: gate G3's lab item"); the render hint in Lesson.astro is the recorded trade. A lab number in that range on this container is not a finding; a regression, a wrong measurement method or another budget is.
- WebKit and Firefox are not installable here; site/tests/e2e/mathml.spec.ts skips them with the install command (MERGE stage 3.2 entry).
- The build agents' JSON reports were not committed; what they claimed is summarised in decisions/<agent>.md and in the "MERGE: P{k} stage" entries of DECISIONS.md, with every accepted deviation listed there. The gate reports are reports/gate-G0.md to gate-G3.md.`

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
    coverage: { type: 'array', items: { type: 'string' } }, findings: { type: 'array', items: FINDING }, notes: { type: 'array', items: { type: 'string' } },
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

function lensPrompt(l) {
  const port = 5000 + 20 * l.index
  return `Working directory (repository root): ${ROOT}. You are red-team lens ${l.id} (${l.slug}) attacking the Two Games build at commit ${A.commit}, round ${A.round}, phase scope: ${A.phaseLabel}. You are in a fresh git worktree on your own branch; confirm with git branch --show-current and put the branch name in your output.

${env(l.id.toLowerCase(), port, `git merge --ff-only ${A.commit} (if that fails because your branch is not behind it, run git reset --hard ${A.commit}; your branch must start exactly at ${A.commit})`)}

${KNOWN}

Read ${PLAN}/RED-TEAM-COMMON.md, ${PLAN}/CONTRACTS.md and ${PLAN}/red-team/${l.id}-${l.slug}.md, and follow the lens file completely for every attack that applies to phase ${PHASE} (its "Scope by phase": earlier items stay in scope). Read the gate reports and the decisions entries to see what was claimed.${A.focus && A.focus[l.id] ? `\n\nThis is a RETEST round after fixes. Attack these areas first, where your earlier findings were fixed: ${A.focus[l.id]}. Then run the rest of your attack list as time allows.` : ''}

Commit every reproducer on your branch (new files only, named redteam-${l.id}-*; never modify an existing test). Each finding must be reproducible from a clean checkout of ${A.commit} plus your reproducer file, by the exact command you give. Your final message is the JSON of RED-TEAM-COMMON.md section 5 and nothing else: lens, phase (${PHASE}), gateCommit (${A.commit}), branch, coverage, findings (ids P${PHASE}-${l.id}-NN), notes.`
}

function verifyPrompt(f, mode, port) {
  const setup = mode === 'reproduce'
    ? `git checkout --detach ${A.commit}, then bring in only the reproducer named in the finding with git checkout ${f.branch} -- <its path> (several paths if the reproduction names several)`
    : `git checkout --detach ${A.commit} (you read; you may run commands, but you add nothing)`
  return `Working directory (repository root): ${ROOT}. You are an RT-VERIFY agent in ${mode} mode for one red-team finding against commit ${A.commit} (phase scope: ${A.phaseLabel}). You are in a fresh worktree.

${env(`verify-${f.id.toLowerCase()}-${mode}`, port, setup)}

${KNOWN}

Read ${PLAN}/RED-TEAM-COMMON.md section 6 and ${PLAN}/red-team/RT-VERIFY.md and follow them exactly for the ${mode} mode.${mode === 'refute' ? ' A refutation must cite a section of SPEC.md, a golden key, an oracle function and input, a phase assignment, or a recorded decision; taste is not a refutation.' : ''}

The finding (from lens ${f.lens}, branch ${f.branch}):
${JSON.stringify(f, null, 2)}

Your final message is the JSON of RED-TEAM-COMMON.md section 6 and nothing else: findingId, mode (${mode}), reproduced, refuted, citation, evidence, severityAdjustment, reason.`
}

const results = await pipeline(
  A.lenses,
  (l) => agent(lensPrompt(l), { label: `${l.id} r${A.round}`, phase: 'Find', schema: LENS_OUT, isolation: 'worktree' }),
  async (o, l) => {
    if (!o) { log(`${l.id}: no output`); return { lens: l.id, output: null, verified: [] } }
    log(`${l.id}: ${o.findings.length} findings (${o.findings.filter(f => f.severity === 'blocker').length} blocker, ${o.findings.filter(f => f.severity === 'major').length} major) on ${o.branch}`)
    const base = 6000 + 200 * l.index
    const verified = await parallel(o.findings.map((f0, i) => () => {
      const f = { ...f0, lens: o.lens || l.id, branch: o.branch }
      return parallel([
        () => agent(verifyPrompt(f, 'reproduce', base + 8 * i), { label: `repro ${f.id}`, phase: 'Verify', schema: VERDICT, isolation: 'worktree' }),
        () => agent(verifyPrompt(f, 'refute', base + 8 * i + 4), { label: `refute ${f.id}`, phase: 'Verify', schema: VERDICT, isolation: 'worktree' }),
      ]).then(([rep, ref]) => ({ f, rep, ref, confirmed: !!(rep && rep.reproduced) && !(ref && ref.refuted) }))
    }))
    const c = verified.filter(v => v.confirmed).length
    log(`${l.id}: ${c} confirmed, ${verified.length - c} dropped`)
    return { lens: l.id, output: o, verified }
  },
)

const confirmed = results.flatMap(r => r.verified.filter(v => v.confirmed).map(v => ({ ...v.f, verification: { reproduce: v.rep, refute: v.ref } })))
const dropped = results.flatMap(r => r.verified.filter(v => !v.confirmed).map(v => ({ id: v.f.id, lens: v.f.lens, severity: v.f.severity, title: v.f.title,
  reason: !v.rep ? 'no reproduce verdict' : !v.rep.reproduced ? `not reproduced: ${v.rep.reason}` : `refuted: ${v.ref ? (v.ref.citation || '') + ' ' + v.ref.reason : 'no refute verdict'}` })))
return {
  commit: A.commit, round: A.round,
  lenses: results.map(r => ({ lens: r.lens, branch: r.output ? r.output.branch : null, found: r.output ? r.output.findings.length : null, coverage: r.output ? r.output.coverage : null, notes: r.output ? r.output.notes : null })),
  confirmed, dropped,
}
