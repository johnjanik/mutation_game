// The registry behind <Unverified> (SPEC.md 7.3, 7.7 Content row, 9.1 G3 and G6): the items of
// Appendix E with their status, the rule that decides what a usage renders, and the report of open
// items and the pages that use them, which a release build writes for the owner.
// Build time only (Node); never imported by a .svelte file or anything that reaches the browser.
// It never writes into reference/, content/unverified.json or DECISIONS.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { AstroIntegration } from 'astro';
import seed from '../content/unverified.json' with { type: 'json' };

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
   * without the field, written before the field existed).
   */
  complete?: boolean;
  items: { id: string; status: UnverifiedStatus; gate: string; pages: string[]; fallbackShown: boolean }[];
  unknownItems: { item: string; pages: string[] }[];
}

const ITEMS: readonly UnverifiedItem[] = seed as UnverifiedItem[];
const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

/**
 * A release build is `RELEASE=1 npm run build` (SPEC.md 7.3, 7.7). Any non-empty value of RELEASE
 * counts, 0 included. Read at call time, never cached, so that a test can set and unset it.
 */
export function isReleaseBuild(): boolean {
  return process.env.RELEASE !== undefined && process.env.RELEASE !== '';
}

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

/** The directory of the report: OPEN_ITEMS_REPORT_DIR when set, else reports/ at the repository root. */
function reportsDir(): string {
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

/** <reports dir>/open-items-report.json; the Markdown report sits beside it. */
export function reportPath(): string {
  return join(reportsDir(), 'open-items-report.json');
}

function markdownPath(): string {
  return join(reportsDir(), 'open-items-report.md');
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

function cell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function toMarkdown(r: OpenItemsReport): string {
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

function writeFiles(r: OpenItemsReport): void {
  mkdirSync(reportsDir(), { recursive: true });
  writeFileSync(reportPath(), JSON.stringify(r, null, 2) + '\n');
  writeFileSync(markdownPath(), toMarkdown(r));
}

/**
 * Writes reports/open-items-report.json and .md from the registrations (merged with the file the
 * same build wrote before). A no-op in a preview build, which leaves any existing report untouched.
 */
export function writeReport(): void {
  if (!isReleaseBuild()) return;
  writeFiles(buildReport(mergedWithFile()));
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
 * The build-start hook (plan): in a release build it writes the report with no page listed, so
 * that both files exist and list every item even when no page uses <Unverified>. It also sets the
 * build id under which later registrations of the same build merge their pages into the file.
 * The build-done hook rewrites the report, with the pages of the same build, marked complete; a
 * build that fails never reaches it, so its report stays marked incomplete (RT-FIX P3-RT-12-06).
 */
export function openItemsReportIntegration(): AstroIntegration {
  return {
    name: 'open-items-report',
    hooks: {
      'astro:build:start': () => {
        if (!isReleaseBuild()) return;
        process.env.OPEN_ITEMS_BUILD_ID = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}`;
        writeFiles(buildReport(new Map()));
      },
      'astro:build:done': () => {
        if (!isReleaseBuild()) return;
        writeFiles(buildReport(mergedWithFile(), true));
      },
    },
  };
}
