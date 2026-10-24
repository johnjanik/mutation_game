#!/usr/bin/env node
// npm run report (SPEC.md 7.7): the two content reports, written to reports/.
// 1. reports/numbers-in-prose.md, written here by scripts/numbers-in-prose.mjs.
// 2. The report of open <Unverified> items, written by a release build (RELEASE=1 npm run build)
//    through P0-A4's registry as reports/open-items-report.json and reports/open-items-report.md.
//    This script does not build (a release build would replace the preview build in site/dist);
//    it checks that the release report is there and prints its summary.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeNumbersReport } from './numbers-in-prose.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPORTS_DIR = join(ROOT, 'reports');

/**
 * Checks the release build's open-items report in a reports directory.
 * @param {string} reportsDir
 * @returns {{ exitCode: 0 | 1; message: string }}
 */
export function checkOpenItemsReport(reportsDir) {
  const jsonPath = join(reportsDir, 'open-items-report.json');
  const mdPath = join(reportsDir, 'open-items-report.md');
  const missing = { exitCode: /** @type {1} */ (1), message: 'report: no release build report found at reports/open-items-report.json; run RELEASE=1 npm run build first' };
  if (!existsSync(jsonPath)) return missing;
  let report;
  try {
    report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    return { exitCode: 1, message: `report: reports/open-items-report.json is not valid JSON: ${err instanceof Error ? err.message : err}` };
  }
  if (!report || report.mode !== 'release') return missing;
  if (!existsSync(mdPath)) {
    return { exitCode: 1, message: 'report: reports/open-items-report.json is present but reports/open-items-report.md is missing; rerun RELEASE=1 npm run build' };
  }
  // The build marks the report complete when it finishes (astro:build:done); a release build that
  // failed part way leaves a well-formed report of the pages rendered so far, which is refused.
  if (report.complete !== true) {
    return { exitCode: 1, message: 'report: reports/open-items-report.json comes from a release build that did not finish, so pages may be missing; rerun RELEASE=1 npm run build' };
  }
  const items = Array.isArray(report.items) ? report.items : [];
  const used = items.filter((it) => it && it.status === 'open' && Array.isArray(it.pages) && it.pages.length > 0);
  const pages = new Set(used.flatMap((it) => it.pages));
  const unknown = Array.isArray(report.unknownItems) ? report.unknownItems.length : 0;
  return {
    exitCode: 0,
    message: `report: open items report of ${report.generatedAt}: ${used.length} open items used on ${pages.size} pages, ${unknown} unknown items; see reports/open-items-report.md`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const numbers = writeNumbersReport();
  console.log(`numbers-in-prose: ${numbers.numbers} numbers in ${numbers.files} files; report written to ${relative(ROOT, numbers.report).split(sep).join('/')}`);
  const result = checkOpenItemsReport(REPORTS_DIR);
  console.log(result.message);
  process.exit(result.exitCode);
}
