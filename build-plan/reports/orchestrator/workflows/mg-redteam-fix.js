export const meta = {
  name: 'mg-redteam-fix',
  description: 'Fix clusters of confirmed red-team findings in worktrees (RT-FIX), then rerun each finding\'s reproducer against the fix branch to confirm it is fixed',
  whenToUse: 'After a red-team round of the Two Games build; args name the clusters, the base commit and the findings file',
  phases: [
    { title: 'Fix', detail: 'one RT-FIX agent per cluster, in worktrees' },
    { title: 'Confirm', detail: 'rerun the reproducers against each fix branch' },
  ],
}

const ROOT = '/home/user/mutation_game'
const PLAN = `${ROOT}/build-plan`
const SCRATCH = '/tmp/claude-0/-home-user-mutation-game/03d88ee7-3b55-5f84-9822-84f78aad9733/scratchpad'
const A = args
if (!A || !A.base || !A.findingsFile || !Array.isArray(A.clusters)) throw new Error('args: { base, round, findingsFile, phaseLabel, clusters: [{ name, ids, notes, index }] }')

const env = (who, port, setup) => `Environment (the plan was written for the owner's Mac; these notes override it):
- Repository root: ${ROOT}. Wherever the plan writes /Users/john/Claude/MutationGame, read the root of your worktree (and ${ROOT} for files you only read). Wherever it says main, read the integration branch claude/session-6a181f60-hzzoud: never check it out, never commit to it, never push.
- FIRST, in your fresh worktree: ${setup}; then npm ci --prefer-offline once. Never npm install.
- Cloud container: 4 processors, 15 GB, Node 22.22.0, Python 3.13 (reference/verify.py runs from reference/; Python scripts that import lie_games run without -I). Other agents work at the same time: use only your own scratch directory ${SCRATCH}/${who}/ and only your own ports ${port} to ${port + 3}.
- Browsers: only Chromium is installed. Every Playwright run needs PLAYWRIGHT_BROWSERS_PATH=${SCRATCH}/pw-browsers in its environment. Never run playwright install. Never set TMPDIR for Playwright (Chromium crashes under the scratch path). WebKit and Firefox cannot be installed here.
- Preview servers: never use port 4321 and never pkill broadly. For browser runs copy playwright.config.ts to your scratch directory with the webServer command \`node node_modules/astro/bin/astro.mjs preview --port ${port} --ignore-lock\` run in site/ and baseURL on that port, and run npx playwright test -c <your copy> <spec>; stop your server with pkill -f "port ${port}". npm run size takes -- --port ${port + 1}.
- The machine is shared, so timing results are noisy: repeat a timing failure once alone before calling it real.
- Last step before your final message: commit what you must commit, then delete node_modules, site/node_modules, packages/engine/node_modules and site/dist inside your worktree to free disk, and confirm git status --porcelain is empty.`

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
const CONFIRM = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    results: { type: 'array', items: { type: 'object', properties: {
      findingId: { type: 'string' }, fixed: { type: 'boolean' }, regressionTestPresent: { type: 'boolean' },
      evidence: { type: 'string' } }, required: ['findingId', 'fixed', 'regressionTestPresent', 'evidence'] } },
    sideEffects: { type: 'array', items: { type: 'string' } },
  },
  required: ['branch', 'results', 'sideEffects'],
}

function fixPrompt(c) {
  const port = 7000 + 20 * c.index
  return `Working directory (repository root): ${ROOT}. You are an RT-FIX agent for the red-team round ${A.round} of the Two Games build (${A.phaseLabel}), cluster "${c.name}". You are in a fresh git worktree on your own branch; report its name.

${env(`rtfix-${c.name}`, port, `git merge --ff-only ${A.base} (if your branch is not behind it, git reset --hard ${A.base}); the base is the integration head, which already carries phase 4 work merged since the red team's commit`)}

Read ${PLAN}/COMMON.md, ${PLAN}/CONTRACTS.md, ${PLAN}/RED-TEAM-COMMON.md section 7 and ${PLAN}/red-team/RT-FIX.md, and follow them exactly.

Your findings are the entries with these ids in the JSON array of ${A.findingsFile}: ${c.ids.join(', ')}. Read each whole: claim, expected, observed, reproduction, specRef, proposedFix, reproducer, and the two verifiers' evidence. Each reproducer is on the lens branch named in the entry's branch field (the text before any space): bring it in with git checkout <branch> -- <path>, run it to see it fail on your base, make it part of the permanent suite in the owning area's test directory with a plain name and the comment // regression: <finding id>, then fix the cause (never special-case the reproducer's input, never weaken another test). Findings that name the same cause are one fix with one regression test.
${c.notes ? '\nOrchestrator notes for this cluster: ' + c.notes : ''}

Run the owning area's tests, the engine suite (npm test -w packages/engine), npx vitest run on every site unit file you touched, the browser specs of every route you changed (against npm run build and your own preview port), and npm run check -w site. Commit with messages "RT-FIX <finding ids>: <what>"; write decisions/RT-FIX-P3-${c.name}.md for any choice the specification leaves open. If a fix would need a golden value, a convention, a cap or a CONTRACTS.md interface changed, stop on that finding and report it needs-decision with the options and your recommendation. No em-dash anywhere.

Your final message is the JSON report of COMMON.md section 5.2 with one acceptance line per finding (status fixed, needs-decision or could-not-reproduce, and the regression test), and nothing else.`
}

function confirmPrompt(c, r) {
  const port = 7400 + 20 * c.index
  return `Working directory (repository root): ${ROOT}. You confirm the fixes of red-team cluster "${c.name}" on branch ${r.branch}. You fix nothing and commit nothing.

${env(`rtconfirm-${c.name}`, port, `git checkout --detach ${r.branch}`)}

The findings are the entries with ids ${c.ids.join(', ')} in ${A.findingsFile}; the fixer's report is below. For each finding: (1) run the ORIGINAL reproducer from the lens branch (git checkout <lens branch> -- <path> into a scratch copy outside the suite if the fixer renamed it, or run the fixer's regression test, and also re-run the reproduction steps of the finding by hand) and decide whether the behaviour the finding describes is gone; (2) check that a regression test exists in the permanent suite and fails when the fix is reverted (git stash or a scratch revert of the fix's source lines, run, restore); (3) note any side effect you see: another test that now fails, a behaviour of SPEC.md that the fix broke, a golden value or a convention touched. A finding the fixer marked needs-decision is fixed: false with the fixer's reason as evidence.

The fixer's report:
${JSON.stringify(r, null, 2)}

Your final message is the JSON {branch, results: [{findingId, fixed, regressionTestPresent, evidence}], sideEffects} and nothing else.`
}

const out = await pipeline(
  A.clusters,
  (c) => agent(fixPrompt(c), { label: `fix ${c.name}`, phase: 'Fix', schema: FIX_REPORT, isolation: 'worktree' }),
  async (r, c) => {
    if (!r) { log(`fix ${c.name}: no report`); return { cluster: c.name, ids: c.ids, fix: null, confirm: null } }
    log(`fix ${c.name}: ${r.status} on ${r.branch}; ${r.acceptance.map(a => a.status).join(', ')}`)
    const v = await agent(confirmPrompt(c, r), { label: `confirm ${c.name}`, phase: 'Confirm', schema: CONFIRM, isolation: 'worktree' })
    if (v) log(`confirm ${c.name}: ${v.results.filter(x => x.fixed).length}/${v.results.length} fixed, ${v.sideEffects.length} side effects`)
    return { cluster: c.name, ids: c.ids, fix: r, confirm: v }
  },
)
return { round: A.round, base: A.base, clusters: out }
