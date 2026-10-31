// RT-12 workflows.mjs <repoDir>
// Attacks 19 to 22 and 36: parses the three workflows with the yaml package already installed in the
// checkout and prints triggers, job conditions, Node versions, steps, and the checks of SPEC.md 7.8.
// Exit 1 when a check fails.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const repo = process.argv[2];
const require = createRequire(join(repo, 'package.json'));
const YAML = require('yaml');
const load = (f) => YAML.parse(readFileSync(join(repo, '.github', 'workflows', f), 'utf8'));
const failures = [];
const runs = (wf) => Object.values(wf.jobs).flatMap((j) => j.steps ?? []).filter((s) => s.run).map((s) => s.run);
const uses = (wf) => Object.values(wf.jobs).flatMap((j) => j.steps ?? []).filter((s) => s.uses).map((s) => s.uses);

for (const f of ['ci.yml', 'deploy.yml', 'links.yml']) {
  const wf = load(f);
  console.log(`== ${f}`);
  console.log('  on:', JSON.stringify(wf.on));
  for (const [id, job] of Object.entries(wf.jobs)) {
    console.log(`  job ${id}: if=${JSON.stringify(job.if ?? null)} needs=${JSON.stringify(job.needs ?? null)} runs-on=${job['runs-on']}`);
    for (const s of job.steps ?? []) {
      const node = s.with?.['node-version'] ?? s.with?.['node-version-file'];
      console.log(`    - ${s.name ?? ''}: ${s.uses ?? s.run}${node ? ` (node ${node})` : ''}${s.env ? ` env=${JSON.stringify(s.env)}` : ''}${s['continue-on-error'] ? ' continue-on-error' : ''}${s.if ? ` if=${s.if}` : ''}`);
    }
  }
  for (const r of runs(wf)) {
    if (/astro\s+dev|npm run dev/.test(r)) failures.push(`${f}: astro dev in "${r}"`);
    if (/npm install\b/.test(r)) failures.push(`${f}: npm install in "${r}"`);
    if (/--legacy-peer-deps|--force/.test(r)) failures.push(`${f}: peer flag in "${r}"`);
  }
}
const ci = load('ci.yml');
const ciRuns = runs(ci).join('\n');
const install = runs(ci).find((r) => /playwright install/.test(r)) ?? '';
console.log(`ci.yml browser install step: ${install}`);
// SPEC 7.3 [U] (MathML in the three engines, check in phase 3); mathml.spec.ts skips an engine that is not installed.
for (const engine of ['webkit', 'firefox']) if (!new RegExp(`\\b${engine}\\b`).test(install)) failures.push(`ci.yml installs no ${engine}: mathml.spec.ts skips its ${engine} test in CI`);
if (!/npm run (check|test)/.test(ciRuns)) failures.push('ci.yml: no tests');
if (!uses(ci).some((u) => u.startsWith('actions/upload-artifact')) ) failures.push('ci.yml: no artifact upload');
const deploy = load('deploy.yml');
for (const [id, job] of Object.entries(deploy.jobs)) {
  if (!/vars\.DEPLOY_PAGES\s*==\s*'true'/.test(String(job.if ?? ''))) failures.push(`deploy.yml job ${id}: no job-level vars.DEPLOY_PAGES == 'true'`);
}
const links = load('links.yml');
if (links.on.push || links.on.pull_request) failures.push('links.yml: push or pull_request trigger');
for (const fl of failures) console.log('FAIL ' + fl);
process.exitCode = failures.length ? 1 : 0;
