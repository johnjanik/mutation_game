// RT-12 attack 21: ci.yml uploads `playwright-report` when a step fails, but under CI the
// configuration's only reporter is 'github', which writes no files; Playwright's html reporter is the
// one that writes playwright-report/. Run with Node 22 (type stripping) from anywhere:
//   CI=1 node redteam/rt12/ci-reporter.mjs <repoDir>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.argv[2];
process.env.CI ??= '1';
const config = (await import(pathToFileURL(join(repo, 'playwright.config.ts')).href)).default;
const reporters = (Array.isArray(config.reporter) ? config.reporter : [config.reporter]).map((r) => (Array.isArray(r) ? r[0] : r));
const ci = readFileSync(join(repo, '.github', 'workflows', 'ci.yml'), 'utf8');
const uploadsReport = /path:\s*playwright-report/.test(ci);
console.log(`reporters under CI: ${JSON.stringify(reporters)}; ci.yml uploads playwright-report: ${uploadsReport}`);
if (uploadsReport && !reporters.includes('html')) {
  console.log('FAIL: no reporter writes playwright-report/ under CI, so the upload step of ci.yml uploads nothing');
  process.exitCode = 1;
}
