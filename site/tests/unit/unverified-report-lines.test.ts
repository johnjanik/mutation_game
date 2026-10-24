// The report of open items that a release build prints (SPEC.md 7.3: a release build "prints a
// report of the open items and the pages that use them, which the owner reads at each release"),
// adopted from the red team (RT-08, phase 4 round, attack 3 (e), redteam-RT-08-p4-release-report.mjs:
// each "open item E.. used on <page> (nothing shown | fallback shown)" line of the release build's
// standard error, checked against the release page). The registry printed one line per (item, page)
// when the pair was first used, so on /modules/m7-geometry/, whose first E7 wrap (beat 3) has no
// fallback and whose second (the Seen box) has one, it printed "(nothing shown)" while the page shows
// the E7 fallback. The line is now decided by every use of the item on the page, and printed once
// per (item, page) when the build is done.
// Run: npx vitest run --project site-unit site/tests/unit/unverified-report-lines.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearUsage, openItemsReportIntegration, registerUsage, type OpenItemsReport } from '../../src/lib/unverifiedRegistry';

const M7 = '/modules/m7-geometry/';

describe('the lines of the release report on standard error', () => {
  const saved = new Map(['RELEASE', 'OPEN_ITEMS_REPORT_DIR', 'OPEN_ITEMS_BUILD_ID'].map((n) => [n, process.env[n]]));
  const hooks = openItemsReportIntegration().hooks as unknown as Record<string, () => Promise<void> | void>;
  let dir: string;
  let exitListeners: Set<(code: number) => void>;
  let warn: ReturnType<typeof vi.spyOn>;
  /** Every line printed so far, from the start of the build. */
  const printed = (): string[] => warn.mock.calls.map((c: unknown[]) => String(c[0]));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'unverified-lines-'));
    process.env.RELEASE = '1';
    process.env.OPEN_ITEMS_REPORT_DIR = dir;
    delete process.env.OPEN_ITEMS_BUILD_ID;
    clearUsage();
    exitListeners = new Set(process.listeners('exit'));
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    for (const l of process.listeners('exit')) if (!exitListeners.has(l)) process.removeListener('exit', l);
    clearUsage();
    for (const [n, v] of saved) {
      if (v === undefined) delete process.env[n];
      else process.env[n] = v;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  // regression: P4-RT-08-10
  it('a page whose later use of an item shows the fallback is reported as fallback shown', async () => {
    await hooks['astro:build:start']!();
    // The page of M7, rendered by the pages' module instance: E7 in beat 3 without a fallback, E7 in
    // the Seen box with one, E9 in the shell table with one.
    registerUsage('E7', M7, false);
    registerUsage('E7', M7, true);
    registerUsage('E9', M7, true);
    // The build-done hook runs in the configuration's instance, which registered nothing.
    clearUsage();
    await hooks['astro:build:done']!();
    const lines = printed().filter((l) => l.startsWith('open item '));
    expect(lines, lines.join('\n')).toContain(`open item E7 used on ${M7} (fallback shown)`);
    expect(lines).not.toContain(`open item E7 used on ${M7} (nothing shown)`);
    expect(lines.filter((l) => l.startsWith(`open item E7 used on ${M7} `))).toHaveLength(1);
    expect(lines).toContain(`open item E9 used on ${M7} (fallback shown)`);
    const report = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
    expect(report.items.find((i) => i.id === 'E7')).toMatchObject({ pages: [M7], fallbackShown: true });
  });

  // regression: P4-RT-08-10
  it('the line is decided per page: one page shows the fallback, another nothing', async () => {
    await hooks['astro:build:start']!();
    registerUsage('E4', '/b/', false);
    registerUsage('E4', '/a/', true);
    registerUsage('E4', '/b/', false);
    registerUsage('E99', '/a/', false);
    registerUsage('E99', '/a/', true);
    clearUsage();
    await hooks['astro:build:done']!();
    expect(printed().filter((l) => l.startsWith('open item '))).toEqual([
      'open item E4 used on /a/ (fallback shown)',
      'open item E4 used on /b/ (nothing shown)',
      'open item E99 used on /a/ (fallback shown)',
    ]);
  });

  it('a preview build prints no line', async () => {
    delete process.env.RELEASE;
    await hooks['astro:build:start']!();
    registerUsage('E7', M7, true);
    await hooks['astro:build:done']!();
    expect(printed()).toEqual([]);
  });
});
