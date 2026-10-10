// Pre-flight for the build of Two Games on a Dynkin Diagram (build-plan/README.md section 8).
// Launch: Workflow({ scriptPath: 'build-plan/workflows/preflight.js' })
// One agent runs the checks and returns a structured verdict. Nothing is built.

export const meta = {
  name: 'mg-preflight',
  description: 'Check the toolchain, the oracle and the registry before launching phase 0 of the Two Games build',
  phases: [{ title: 'Preflight', detail: 'node, npm, python oracle byte-for-byte, registry versions, playwright, git' }],
}

const ROOT = '/Users/john/Claude/MutationGame'

const VERDICT = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    node: { type: 'string' }, npm: { type: 'string' }, python: { type: 'string' },
    oracle: { type: 'object', properties: { exit: { type: 'number' }, checksPassed: { type: 'number' }, checksFailed: { type: 'number' }, seconds: { type: 'number' }, byteIdentical: { type: 'boolean' }, parsedEqual: { type: 'boolean' } }, required: ['exit', 'byteIdentical'] },
    registry: { type: 'array', items: { type: 'object', properties: { pkg: { type: 'string' }, pinned: { type: 'string' }, exists: { type: 'boolean' }, note: { type: 'string' } }, required: ['pkg', 'pinned', 'exists'] } },
    playwright: { type: 'string' },
    git: { type: 'string' },
    hashes: { type: 'object', properties: { golden: { type: 'string' }, oracle: { type: 'string' }, verify: { type: 'string' } }, required: ['golden', 'oracle', 'verify'] },
    blockers: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'node', 'npm', 'python', 'oracle', 'registry', 'git', 'hashes', 'blockers', 'warnings'],
}

phase('Preflight')
const v = await agent(`Working directory: ${ROOT}. You are running the pre-flight checks of build-plan/README.md section 8 before phase 0 of the build. Do not build anything and do not modify any file under ${ROOT} except the scratch directory. Run each check, record the exact output, and decide.

1. node --version (must be 22.12 or later), npm --version. If node is missing from PATH also look in /opt/homebrew/bin and ~/.nvm, ~/.volta, ~/.fnm and report where it is, if anywhere.
2. python3 --version; then run the oracle: python3 reference/verify.py <scratch>/golden_regen.json (from ${ROOT}/reference as the working directory so that lie_games imports; about two to three minutes). Record exit status, the summary line (checks passed, failed, seconds), whether the output is byte for byte reference/golden_data.json (cmp), and if not whether the two parse as equal JSON.
3. For every pinned version of SPEC.md section 7.1 (astro 7.3.8, @astrojs/mdx 8.0.3, svelte 5.57.2, @astrojs/svelte 9.0.1, typescript 6.0.3, nanostores 1.5.5, vitest 5.0.3, fast-check 4.10.2, @playwright/test 1.64.0, @axe-core/playwright 4.13.0, @astrojs/markdown-remark 7.3.2, remark-math 6.0.0, rehype-katex 7.0.1) run npm view <pkg>@<version> version and record whether it exists (if npm is unavailable, record that every registry check is skipped). Also record the latest versions of katex, @astrojs/check and svelte-check, and whether their peer ranges admit typescript 6.0.x (npm view <pkg> peerDependencies).
4. If npx exists: npx --yes playwright --version; otherwise record that browsers will be installed in phase 0.
5. git --version; whether ${ROOT} is a git repository (git -C ${ROOT} rev-parse --is-inside-work-tree) and, if so, whether the tree is clean.
6. SHA-256 of reference/golden_data.json, reference/lie_games.py, reference/verify.py (shasum -a 256) and whether they equal build-plan/CONTRACTS.md section 9.

Blockers: node missing or below 22.12; npm missing; oracle exit non-zero or not byte-identical; reference hashes different; a pinned version that does not exist on the registry (report the nearest existing version as a note; this is a blocker only for astro, svelte, typescript). Warnings: everything else worth knowing. ok is true only with zero blockers.`, { label: 'preflight', schema: VERDICT })

return v
