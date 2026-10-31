export const meta = {
  name: 'mg-phase4-wave',
  description: 'One wave of the phase 4 build: build agents in worktrees, an adversarial review of each branch, a repair agent where the review finds blocker or major gaps',
  whenToUse: 'Phase 4 of the Two Games build, one wave at a time; args name the agents, the base commit and per-agent notes',
  phases: [
    { title: 'Build', detail: 'build agents in worktrees' },
    { title: 'Review', detail: 'adversarial review of each branch against its instruction' },
    { title: 'Repair', detail: 'fix blocker and major gaps on a repair branch' },
  ],
}

const ROOT = '/home/user/mutation_game'
const PLAN = `${ROOT}/build-plan`
const SCRATCH = '/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad'
const A = args
if (!A || !A.base || !Array.isArray(A.agents)) throw new Error('args: { wave, base, agents: [{ id, brief, port, extra, model? }] }')

const env = (who, port, base, setup) => `Environment (the plan was written for the owner's Mac; these notes override it):
- Repository root: ${ROOT}. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and ${ROOT} for files you only read). Wherever it says main, read the integration branch claude/session-6a181f60-hzzoud: never check it out, never commit to it, never push anything.
- FIRST, in your worktree: ${setup || `git merge --ff-only ${base} (the harness creates worktrees behind the integration head)`}, then npm ci --prefer-offline once. Never npm install.
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13 (reference/verify.py runs from reference/; Python scripts that import lie_games run without -I). Other agents work at the same time: use only your own scratch directory ${SCRATCH}/${who}/ and only your own ports ${port} to ${port + 9}.
- Browsers: only Chromium is installed. Every Playwright or Lighthouse run needs PLAYWRIGHT_BROWSERS_PATH=${SCRATCH}/pw-browsers in its environment. Never run playwright install. Never set TMPDIR for Playwright (Chromium crashes under the scratch path). WebKit and Firefox cannot be installed here (network policy).
- Preview servers: never use port 4321 and never pkill broadly. For browser tests copy playwright.config.ts to your scratch directory with the webServer command \`node node_modules/astro/bin/astro.mjs preview --port ${port} --ignore-lock\` run in site/ and baseURL on that port, and run npx playwright test -c <your copy> <spec>; stop your server with pkill -f "port ${port}". npm run size takes -- --port ${port + 1}; npm run lab takes -- --port ${port + 2}.
- Timing tests (T05 long task, T15 random firings, the 25 ms benchmark, draw-time) can fail when the machine is busy: rerun once alone before reporting a failure, and say so.
- Last step before your final message: commit everything, then delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree to free disk (they are ignored by git), and confirm git status --porcelain is empty.`

const REPORT = {
  type: 'object',
  properties: {
    agent: { type: 'string' }, status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    branch: { type: 'string' }, worktree: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } }, filesChanged: { type: 'array', items: { type: 'string' } },
    commandsRun: { type: 'array', items: { type: 'object', properties: { cmd: { type: 'string' }, exit: { type: 'number' }, summary: { type: 'string' } }, required: ['cmd', 'exit', 'summary'] } },
    acceptance: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, status: { type: 'string' }, test: { type: 'string' } }, required: ['item', 'status'] } },
    deviations: { type: 'array', items: { type: 'object', properties: { spec: { type: 'string' }, what: { type: 'string' }, why: { type: 'string' } }, required: ['what'] } },
    requests: { type: 'array', items: { type: 'object', properties: { to: { type: 'string' }, what: { type: 'string' } }, required: ['to', 'what'] } },
    proposedUnverifiedItems: { type: 'array', items: { type: 'object', properties: { statement: { type: 'string' }, whereToCheck: { type: 'string' }, fallback: { type: 'string' } }, required: ['statement'] } },
    decisionsFragment: { type: 'string' }, openQuestions: { type: 'array', items: { type: 'string' } }, handoff: { type: 'string' },
  },
  required: ['agent', 'status', 'branch', 'commits', 'filesChanged', 'commandsRun', 'acceptance', 'deviations', 'handoff'],
}
const REVIEW = {
  type: 'object',
  properties: {
    agent: { type: 'string' }, branch: { type: 'string' }, verdict: { type: 'string', enum: ['clean', 'gaps'] },
    checked: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, item: { type: 'string' },
      evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'item', 'evidence'] } },
  },
  required: ['agent', 'branch', 'verdict', 'checked', 'gaps'],
}

function buildPrompt(a) {
  return `Working directory (repository root): ${ROOT}. You are build agent ${a.id} of phase 4 ("Multiple edges and geometry"), wave ${A.wave}, of the project Two Games on a Dynkin Diagram. You are in a fresh git worktree on your own branch; confirm with git rev-parse --show-toplevel and git branch --show-current and put both in your report.

${env(a.id.toLowerCase(), a.port, A.base, a.setup)}

${a.extra || ''}

Read, in this order, and follow completely: ${PLAN}/COMMON.md; ${PLAN}/CONTRACTS.md; ${PLAN}/agents/${a.brief} (your instruction; it names the SPEC.md sections you must read in full before writing anything). For what earlier agents actually built, read their fragments decisions/<id>.md and the MERGE stage entries of DECISIONS.md; they override the plan's names where they differ.

Carry out your instruction to completion: every deliverable, every test it names (tests first; each must fail when the behaviour it guards is removed), type-checks, commits on your branch with messages prefixed "${a.id}:", your decisions fragment decisions/${a.id}.md, and the report. If you are blocked, finish everything that does not depend on the blocker and report honestly. Do not edit files outside your ownership except where these notes allow it; a change you need elsewhere goes under requests. No em-dash anywhere (code comments included).

Your final message is the JSON report of COMMON.md section 5.2 and nothing else.`
}

function reviewPrompt(a, r) {
  return `Working directory (repository root): ${ROOT}. You are the adversarial reviewer of build agent ${a.id} (phase 4, wave ${A.wave}). Its branch is ${r.branch}; its report is below. Find where its claims are wrong or incomplete. You fix nothing and commit nothing.

${env(a.id.toLowerCase() + '-review', a.port + 100, A.base)}
(Here, instead of the merge in the first note: in your fresh worktree run git checkout --detach ${r.branch}, then npm ci --prefer-offline.)

Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md and the instruction ${PLAN}/agents/${a.brief}. ${a.extra ? 'The build agent was also told: ' + a.extra : ''}
Then check, each with a command and its output as evidence:
1. Every deliverable of section 4 exists, and every acceptance line of section 6 is met by a test that exists, runs and passes on this branch: run npm test -w packages/engine, the site unit test files the branch added or changed (npx vitest run <file>), and its browser specs against a build (npm run build, then your own preview port). Lines the instruction or these notes leave for a later wave are not gaps if the report says so.
2. Tests prove what they say: for the three most important acceptance lines, break the guarded code once, run the test, see it fail, restore with git checkout. A test that passes against a broken or empty implementation is a blocker.
3. The repository rules: positions inside the engine and labels everywhere else, converted only by toLabels and toPositions; no golden value typed into source or tests (read from the golden file); no em-dash; nothing marked [U] in SPEC.md stated as fact; git diff --stat ${A.base}..HEAD touches only files the instruction gives the agent (plus edits these notes allow); no dependency added; no test skipped, weakened or left with .only; the decisions fragment exists.
4. The report's claims (acceptance statuses, deviations, requests) against what you observe.
Severity: blocker (a convention broken, a golden mismatch, a test that proves nothing, a deliverable missing that the wave needed), major (a stated behaviour missing or wrong, a budget exceeded, a required test missing), minor (wording, a weaker test than it could be).

The build agent's report:
${JSON.stringify(r, null, 2)}

Your final message is the JSON {agent, branch, verdict, checked, gaps} and nothing else.`
}

function repairPrompt(a, r, v) {
  const gaps = v.gaps.filter(g => g.severity !== 'minor' || /cheap|trivial|one line/i.test(g.fix || ''))
  return `Working directory (repository root): ${ROOT}. You repair the gaps an adversarial reviewer found in build agent ${a.id}'s branch ${r.branch} (phase 4, wave ${A.wave}). You act as ${a.id}, with its instruction and its ownership.

${env(a.id.toLowerCase() + '-repair', a.port + 200, A.base)}
(Here, instead of the merge in the first note: in your fresh worktree run git checkout -b repair/${a.id}-w${A.wave} ${r.branch}, then npm ci --prefer-offline. Report that repair branch as your branch.)

Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md and ${PLAN}/agents/${a.brief}. ${a.extra ? 'The build agent was also told: ' + a.extra : ''}
Fix every gap below that you can confirm (each fix with a test that fails before it and passes after; never weaken or skip a test to pass). If you find a gap is not real, say why with evidence. Re-run the affected tests, the engine suite and the type checks. Commit with messages prefixed "${a.id}:" and append a dated entry to decisions/${a.id}.md for any choice you make.

The gaps:
${JSON.stringify(gaps, null, 2)}

The build agent's report, for context:
${JSON.stringify({ status: r.status, acceptance: r.acceptance, deviations: r.deviations, requests: r.requests, handoff: r.handoff }, null, 2)}

Your final message is the JSON report of COMMON.md section 5.2 (acceptance: one line per gap, status fixed, not-a-gap or open) and nothing else.`
}

const results = await pipeline(
  A.agents,
  (a) => agent(buildPrompt(a), { label: a.id, phase: 'Build', schema: REPORT, isolation: 'worktree', ...(a.model ? { model: a.model } : {}) }),
  async (r, a) => {
    if (!r) { log(`${a.id}: no report`); return { a, r: null } }
    log(`${a.id}: ${r.status} on ${r.branch}`)
    const v = await agent(reviewPrompt(a, r), { label: `review ${a.id}`, phase: 'Review', schema: REVIEW, isolation: 'worktree' })
    if (v) log(`review ${a.id}: ${v.verdict}, ${v.gaps.filter(g => g.severity === 'blocker').length} blocker, ${v.gaps.filter(g => g.severity === 'major').length} major, ${v.gaps.filter(g => g.severity === 'minor').length} minor`)
    return { a, r, v }
  },
  async ({ a, r, v }) => {
    if (!r) return { id: a.id, build: null }
    const serious = v ? v.gaps.filter(g => g.severity === 'blocker' || g.severity === 'major') : []
    if (!serious.length) return { id: a.id, build: r, review: v, repair: null, mergeBranch: r.branch }
    const f = await agent(repairPrompt(a, r, v), { label: `repair ${a.id}`, phase: 'Repair', schema: REPORT, isolation: 'worktree', ...(a.model ? { model: a.model } : {}) })
    if (f) log(`repair ${a.id}: ${f.status} on ${f.branch}`)
    return { id: a.id, build: r, review: v, repair: f, mergeBranch: f && f.status !== 'blocked' ? f.branch : r.branch }
  },
)
return { wave: A.wave, base: A.base, results }
