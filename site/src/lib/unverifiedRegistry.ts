// The registry behind <Unverified> (SPEC.md 7.3, 7.7 Content row, 9.1 G3 and G6): the items of
// Appendix E with their status, the rule that decides what a usage renders, and the report of open
// items and the pages that use them, which a release build writes for the owner.
// Build time only (Node); never imported by a .svelte file or anything that reaches the browser.
// It never writes into reference/, content/unverified.json or DECISIONS.md. The report's files (where
// they are, the Markdown form, the hold of the postbuild link check) are in ./openItemsReport.mjs,
// plain JavaScript that scripts/links.mjs shares (RT-FIX P4-RT-12-04).
import { existsSync, readFileSync } from 'node:fs';
import type { AstroIntegration } from 'astro';
import seed from '../content/unverified.json' with { type: 'json' };
import { isReleaseBuild, readReleaseReport, reportPath, writeReportFiles } from './openItemsReport.mjs';

export { isReleaseBuild, reportPath };

export type UnverifiedStatus = 'open' | 'closed';

export interface UnverifiedItem {
  id: string;
  status: UnverifiedStatus;
  statement: string;
  whereToCheck: string;
  gate: string;
  /** Set by the owner when the item is closed: the date, YYYY-MM-DD. */
  closedOn?: string;
  /** Set by the owner when the item is closed: the source that settled it. */
  closedBy?: string;
}

export interface OpenItemsReport {
  mode: 'release';
  generatedAt: string;
  /** The build that wrote the file (set by the build-start hook); absent outside a build. */
  buildId?: string;
  /**
   * True only when the release build that wrote the file finished (written by the build-done hook).
   * A build that stops part way leaves false, and npm run report refuses such a report (and one
   * without the field, written before the field existed). The postbuild link check sets it false
   * while it runs and true again only when it passes; a build process that exits with a failure
   * after the build-done hook sets it false.
   */
  complete?: boolean;
  /** The postbuild link check of the release build (scripts/links.mjs): absent until it starts. */
  linkCheck?: 'running' | 'passed' | 'failed';
  items: { id: string; status: UnverifiedStatus; gate: string; pages: string[]; fallbackShown: boolean }[];
  unknownItems: { item: string; pages: string[] }[];
}

const ITEMS: readonly UnverifiedItem[] = seed as UnverifiedItem[];
const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

/** The item of unverified.json with this id, or undefined (an unknown item counts as open). */
export function itemById(id: string): UnverifiedItem | undefined {
  return /^E\d+$/.test(id) ? BY_ID.get(id) : undefined;
}

/**
 * What one usage of <Unverified> renders (SPEC.md 7.3). Preview: the sentence with its mark, for
 * every item, open, closed or unknown. Release: a closed item's sentence unmarked; for an open or
 * unknown item the fallback, or nothing when there is none.
 */
export function decide(item: string, release: boolean, hasFallback: boolean): 'marked' | 'plain' | 'fallback' | 'nothing' {
  if (!release) return 'marked';
  if (itemById(item)?.status === 'closed') return 'plain';
  return hasFallback ? 'fallback' : 'nothing';
}

interface Usage { pages: Set<string>; fallbackShown: boolean }

/** Item id to the pages that use it, in this module instance. */
const usage = new Map<string, Usage>();

/** Forgets every registration (for tests). */
export function clearUsage(): void {
  usage.clear();
}

function buildReport(map: ReadonlyMap<string, Usage>, complete = false): OpenItemsReport {
  const buildId = process.env.OPEN_ITEMS_BUILD_ID;
  const report: OpenItemsReport = {
    mode: 'release',
    generatedAt: new Date().toISOString(),
    ...(buildId ? { buildId } : {}),
    complete,
    items: ITEMS.map((item) => {
      const u = map.get(item.id);
      return { id: item.id, status: item.status, gate: item.gate, pages: u ? [...u.pages].sort() : [], fallbackShown: u ? u.fallbackShown : false };
    }),
    unknownItems: [...map.entries()]
      .filter(([id]) => itemById(id) === undefined)
      .map(([item, u]) => ({ item, pages: [...u.pages].sort() }))
      .sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0)),
  };
  return report;
}

/** The report from this instance's registrations: every item of unverified.json, used or not. */
export function currentReport(): OpenItemsReport {
  return buildReport(usage);
}

/**
 * Adds the pages of a report already written by the same build (same buildId), so that
 * registrations made in another module instance of that build are kept, never overwritten.
 */
function mergedWithFile(): Map<string, Usage> {
  const merged = new Map<string, Usage>();
  for (const [id, u] of usage) merged.set(id, { pages: new Set(u.pages), fallbackShown: u.fallbackShown });
  const buildId = process.env.OPEN_ITEMS_BUILD_ID;
  if (!buildId || !existsSync(reportPath())) return merged;
  let previous: OpenItemsReport;
  try {
    previous = JSON.parse(readFileSync(reportPath(), 'utf8')) as OpenItemsReport;
  } catch {
    return merged;
  }
  if (previous.buildId !== buildId) return merged;
  const add = (id: string, pages: string[], fallbackShown: boolean): void => {
    const u = merged.get(id) ?? { pages: new Set<string>(), fallbackShown: false };
    for (const p of pages) u.pages.add(p);
    u.fallbackShown ||= fallbackShown;
    if (u.pages.size > 0) merged.set(id, u);
  };
  for (const it of previous.items ?? []) add(it.id, it.pages ?? [], Boolean(it.fallbackShown));
  for (const it of previous.unknownItems ?? []) add(it.item, it.pages ?? [], false);
  return merged;
}

/**
 * Writes reports/open-items-report.json and .md from the registrations (merged with the file the
 * same build wrote before). A no-op in a preview build, which leaves any existing report untouched.
 */
export function writeReport(): void {
  if (!isReleaseBuild()) return;
  writeReportFiles(buildReport(mergedWithFile()));
}

/**
 * Records that a page uses an item. In a release build it prints one line per new (item, page)
 * pair and rewrites the report; in a preview build it prints and writes nothing.
 */
export function registerUsage(item: string, page: string, hasFallback = false): void {
  const release = isReleaseBuild();
  const u = usage.get(item) ?? { pages: new Set<string>(), fallbackShown: false };
  const isNew = !u.pages.has(page);
  u.pages.add(page);
  const shown = decide(item, release, hasFallback);
  if (shown === 'fallback') u.fallbackShown = true;
  usage.set(item, u);
  if (!release) return;
  if (isNew && shown !== 'plain') {
    // The release report of SPEC.md 7.3 on standard error. This runs only in Node at build time
    // and is never shipped to the reader.
    console.warn(`open item ${item} used on ${page} (${shown === 'fallback' ? 'fallback shown' : 'nothing shown'})`);
  }
  writeReport();
}

/**
 * After the build-done hook has marked the report complete, a build process that exits with a
 * failure (an exit code other than 0) marks the report of its build incomplete again, so that a
 * release build that fails after the hook never leaves a report that npm run report presents
 * (RT-FIX P4-RT-12-04). The postbuild link check holds the report on its own (openItemsReport.mjs).
 */
function demoteOnFailedExit(buildId: string | undefined): void {
  process.once('exit', (code: number) => {
    if (code === 0) return;
    const r = readReleaseReport();
    if (r && r.complete === true && r.buildId === buildId) writeReportFiles({ ...r, complete: false });
  });
}

/**
 * The build-start hook (plan): in a release build it writes the report with no page listed, so
 * that both files exist and list every item even when no page uses <Unverified>. It also sets the
 * build id under which later registrations of the same build merge their pages into the file.
 * The build-done hook rewrites the report, with the pages of the same build, marked complete; a
 * build that fails never reaches it, so its report stays marked incomplete (RT-FIX P3-RT-12-06).
 * The postbuild link check, and a failure of the build process after the hook, mark it incomplete
 * again (RT-FIX P4-RT-12-04).
 */
export function openItemsReportIntegration(): AstroIntegration {
  return {
    name: 'open-items-report',
    hooks: {
      'astro:build:start': () => {
        if (!isReleaseBuild()) return;
        process.env.OPEN_ITEMS_BUILD_ID = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}`;
        writeReportFiles(buildReport(new Map()));
      },
      'astro:build:done': () => {
        if (!isReleaseBuild()) return;
        writeReportFiles(buildReport(mergedWithFile(), true));
        demoteOnFailedExit(process.env.OPEN_ITEMS_BUILD_ID);
      },
    },
  };
}
