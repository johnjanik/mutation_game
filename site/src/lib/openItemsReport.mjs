// The files of the open-items report of a release build (SPEC.md 7.3, 7.7): where they are, their
// Markdown form, and the hold that the build's last step puts on them. The registry,
// site/src/lib/unverifiedRegistry.ts, builds the report and writes it through this module;
// scripts/links.mjs, the postbuild of every npm run build, holds and settles it. Plain JavaScript
// with no import outside Node, so that plain Node of every admitted version loads it.
//
// A release build is RELEASE=1 npm run build: prebuild, the Astro build, then the postbuild link
// check. The Astro build marks the report complete when it is done; the postbuild marks it
// incomplete while it runs and complete again only when the check passes, so that a release build
// that fails anywhere, postbuild included, leaves a report that npm run report refuses
// (RT-FIX P4-RT-12-04).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** @typedef {import('./unverifiedRegistry').OpenItemsReport} OpenItemsReport */

/**
 * A release build is `RELEASE=1 npm run build` (SPEC.md 7.3, 7.7). Any non-empty value of RELEASE
 * counts, 0 included. Read at call time, never cached, so that a test can set and unset it.
 * @returns {boolean}
 */
export function isReleaseBuild() {
  return process.env.RELEASE !== undefined && process.env.RELEASE !== '';
}

/**
 * The directory of the report: OPEN_ITEMS_REPORT_DIR when set, else reports/ at the repository root.
 * @returns {string}
 */
function reportsDir() {
  const override = process.env.OPEN_ITEMS_REPORT_DIR;
  if (override !== undefined && override !== '') return resolve(override);
  let dir = resolve(process.cwd());
  for (;;) {
    if (existsSync(join(dir, 'reference', 'golden_data.json'))) return join(dir, 'reports');
    const up = dirname(dir);
    if (up === dir) return join(resolve(process.cwd()), 'reports');
    dir = up;
  }
}

/**
 * <reports dir>/open-items-report.json; the Markdown report sits beside it.
 * @returns {string}
 */
export function reportPath() {
  return join(reportsDir(), 'open-items-report.json');
}

function markdownPath() {
  return join(reportsDir(), 'open-items-report.md');
}

/** @param {string} s */
function cell(s) {
  return s.replace(/\|/g, '\\|');
}

/**
 * @param {OpenItemsReport} r
 * @returns {string}
 */
function toMarkdown(r) {
  const lines = [
    '# Open items report',
    '',
    `Release build of ${r.generatedAt}. Every item of \`site/src/content/unverified.json\` (SPEC.md Appendix E), with the pages that wrap a sentence resting on it in \`<Unverified>\`. In this release an open item shows its fallback, or nothing where none is given.`,
    '',
    ...(r.complete ? [] : ['**Incomplete:** the release build that wrote this report has not finished (or failed), so pages may be missing. Rerun `RELEASE=1 npm run build`.', '']),
    '| Item | Status | Gate | Pages | Fallback shown |',
    '|---|---|---|---|---|',
    ...r.items.map((it) => `| ${it.id} | ${it.status} | ${it.gate} | ${it.pages.length ? it.pages.map(cell).join(', ') : 'none'} | ${it.fallbackShown ? 'yes' : 'no'} |`),
    '',
    '## Items not in unverified.json',
    '',
  ];
  if (r.unknownItems.length === 0) lines.push('None.');
  else {
    lines.push('Treated as open. Add them to `unverified.json` (MERGE) or correct the `item` attribute.', '', '| Item | Pages |', '|---|---|');
    for (const u of r.unknownItems) lines.push(`| ${cell(u.item)} | ${u.pages.map(cell).join(', ')} |`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Writes the report as JSON and as Markdown.
 * @param {OpenItemsReport} r
 */
export function writeReportFiles(r) {
  mkdirSync(reportsDir(), { recursive: true });
  writeFileSync(reportPath(), JSON.stringify(r, null, 2) + '\n');
  writeFileSync(markdownPath(), toMarkdown(r));
}

/**
 * The release report on disk, or undefined when there is none, it is not JSON, or it is not a
 * release report.
 * @returns {OpenItemsReport | undefined}
 */
export function readReleaseReport() {
  if (!existsSync(reportPath())) return undefined;
  try {
    const r = JSON.parse(readFileSync(reportPath(), 'utf8'));
    return r && r.mode === 'release' ? r : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The start of the postbuild link check of a release build: the report that the Astro build marked
 * complete (or one whose check did not finish) is marked incomplete, with linkCheck 'running'.
 * Returns whether it holds a report. Outside a release build it touches nothing.
 * @returns {boolean}
 */
export function holdForLinkCheck() {
  if (!isReleaseBuild()) return false;
  const r = readReleaseReport();
  if (!r || (r.complete !== true && r.linkCheck !== 'running')) return false;
  writeReportFiles({ ...r, complete: false, linkCheck: 'running' });
  return true;
}

/**
 * The end of the postbuild link check: the held report is marked complete when the check passed,
 * and stays incomplete, with linkCheck 'failed', when it did not.
 * @param {boolean} passed
 */
export function settleLinkCheck(passed) {
  if (!isReleaseBuild()) return;
  const r = readReleaseReport();
  if (!r || r.linkCheck !== 'running') return;
  writeReportFiles({ ...r, complete: passed, linkCheck: passed ? 'passed' : 'failed' });
}
