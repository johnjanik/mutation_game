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
  /**
   * `fallbackPages`, present when not empty: the pages on which at least one use of the item shows
   * its fallback (RT-FIX P4-RT-08-10); `fallbackShown` says whether there is one.
   */
  items: { id: string; status: UnverifiedStatus; gate: string; pages: string[]; fallbackShown: boolean; fallbackPages?: string[] }[];
  unknownItems: { item: string; pages: string[]; fallbackPages?: string[] }[];
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

/** The pages that use an item, and those on which at least one use shows its fallback. */
interface Usage { pages: Set<string>; fallbackPages: Set<string> }

/** Item id to the pages that use it, in this module instance. */
const usage = new Map<string, Usage>();

/** Forgets every registration (for tests). */
export function clearUsage(): void {
  usage.clear();
}

/** `{ fallbackPages }` when the fallback is shown on a page, else nothing. */
function fallbackPagesOf(u: Usage | undefined): { fallbackPages?: string[] } {
  return u && u.fallbackPages.size > 0 ? { fallbackPages: [...u.fallbackPages].sort() } : {};
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
      return { id: item.id, status: item.status, gate: item.gate, pages: u ? [...u.pages].sort() : [], fallbackShown: u ? u.fallbackPages.size > 0 : false, ...fallbackPagesOf(u) };
    }),
    unknownItems: [...map.entries()]
      .filter(([id]) => itemById(id) === undefined)
      .map(([item, u]) => ({ item, pages: [...u.pages].sort(), ...fallbackPagesOf(u) }))
      .sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0)),
  };
  return report;
}

/**
 * The release report of SPEC.md 7.3 on standard error: one line per (item, page), for every item
 * that is not closed, saying "fallback shown" when at least one use of the item on the page shows
 * its fallback and "nothing shown" otherwise (RT-FIX P4-RT-08-10). Items in the order of
 * unverified.json, then the unknown items; pages sorted.
 */
function reportLines(map: ReadonlyMap<string, Usage>): string[] {
  const unknown = [...map.keys()].filter((id) => itemById(id) === undefined).sort();
  const lines: string[] = [];
  for (const id of [...ITEMS.map((item) => item.id), ...unknown]) {
    const u = map.get(id);
    if (!u || itemById(id)?.status === 'closed') continue;
    for (const page of [...u.pages].sort()) {
      lines.push(`open item ${id} used on ${page} (${u.fallbackPages.has(page) ? 'fallback shown' : 'nothing shown'})`);
    }
  }
  return lines;
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
  for (const [id, u] of usage) merged.set(id, { pages: new Set(u.pages), fallbackPages: new Set(u.fallbackPages) });
  const buildId = process.env.OPEN_ITEMS_BUILD_ID;
  if (!buildId || !existsSync(reportPath())) return merged;
  let previous: OpenItemsReport;
  try {
    previous = JSON.parse(readFileSync(reportPath(), 'utf8')) as OpenItemsReport;
  } catch {
    return merged;
  }
  if (previous.buildId !== buildId) return merged;
  const add = (id: string, pages: string[], fallbackPages: string[]): void => {
    const u = merged.get(id) ?? { pages: new Set<string>(), fallbackPages: new Set<string>() };
    for (const p of pages) u.pages.add(p);
    for (const p of fallbackPages) u.fallbackPages.add(p);
    if (u.pages.size > 0) merged.set(id, u);
  };
  for (const it of previous.items ?? []) add(it.id, it.pages ?? [], it.fallbackPages ?? []);
  for (const it of previous.unknownItems ?? []) add(it.item, it.pages ?? [], it.fallbackPages ?? []);
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
 * Records that a page uses an item, and whether this use shows the fallback. In a release build it
 * rewrites the report; in a preview build it writes nothing. The lines on standard error are
 * printed by the build-done hook, once every use of every page is known (RT-FIX P4-RT-08-10).
 */
export function registerUsage(item: string, page: string, hasFallback = false): void {
  const release = isReleaseBuild();
  const u = usage.get(item) ?? { pages: new Set<string>(), fallbackPages: new Set<string>() };
  u.pages.add(page);
  if (decide(item, release, hasFallback) === 'fallback') u.fallbackPages.add(page);
  usage.set(item, u);
  if (!release) return;
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
        const merged = mergedWithFile();
        writeReportFiles(buildReport(merged, true));
        demoteOnFailedExit(process.env.OPEN_ITEMS_BUILD_ID);
        // The release report of SPEC.md 7.3 on standard error. This runs only in Node at build
        // time and is never shipped to the reader.
        for (const line of reportLines(merged)) console.warn(line);
      },
    },
  };
}
