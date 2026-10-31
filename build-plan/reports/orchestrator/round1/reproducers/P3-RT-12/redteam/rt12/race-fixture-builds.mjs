// RT-12 race-fixture-builds.mjs <repoDir> [count] [rounds]
// Runs `count` fixture builds at the same time with the runner the unit tests use
// (site/tests/fixtures/content/build-fixture.mjs, root = site/, srcDir = a fixture, outDir = a temporary
// directory), as Vitest does when content-components.test.ts and released.test.ts run in parallel
// workers. Every build shares <site>/.astro/.prerender. Prints each exit code and the first error line;
// exits 1 when any build fails.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [repo, countArg = '3', roundsArg = '3'] = process.argv.slice(2);
const site = join(repo, 'site');
const runner = join(site, 'tests', 'fixtures', 'content', 'build-fixture.mjs');
const fixture = join(site, 'tests', 'fixtures', 'content', 'good');
const count = Number(countArg);
const rounds = Number(roundsArg);

function one(i) {
  return new Promise((done) => {
    const out = mkdtempSync(join(tmpdir(), `rt12-race-${i}-`));
    const report = mkdtempSync(join(tmpdir(), `rt12-race-report-${i}-`));
    const env = { ...process.env, OPEN_ITEMS_REPORT_DIR: report };
    for (const k of ['RELEASE', 'BASE_PATH', 'SITE_URL', 'OUT_DIR', 'GITHUB_REPOSITORY']) delete env[k];
    const child = spawn(process.execPath, [runner, site, fixture, out], { cwd: site, env });
    let text = '';
    child.stdout.on('data', (d) => (text += d));
    child.stderr.on('data', (d) => (text += d));
    child.on('close', (code) => {
      rmSync(out, { recursive: true, force: true });
      rmSync(report, { recursive: true, force: true });
      const err = text.split('\n').find((l) => /ERR_|Error|error/.test(l)) ?? '';
      done({ i, code, err: err.slice(0, 220) });
    });
  });
}

let failed = 0;
for (let r = 1; r <= rounds; r++) {
  const results = await Promise.all(Array.from({ length: count }, (_, i) => one(i)));
  for (const res of results) {
    console.log(`round ${r} build ${res.i}: exit ${res.code}${res.code ? ` ${res.err}` : ''}`);
    if (res.code !== 0) failed++;
  }
}
console.log(`${failed} of ${count * rounds} concurrent fixture builds failed`);
process.exitCode = failed ? 1 : 0;
