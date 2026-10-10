// P0-A4: the seed of open items, the <Unverified> registry, and the fixture builds that prove the
// content components fail or succeed at build time as SPEC.md 7.3 and 7.7 (Content row) require.
// No golden value is typed here (COMMON.md 4.4); expected strings are computed from the imported JSON.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import seed from '../../src/content/unverified.json';
import {
  clearUsage,
  currentReport,
  decide,
  isReleaseBuild,
  itemById,
  openItemsReportIntegration,
  registerUsage,
  reportPath,
  writeReport,
  type OpenItemsReport,
} from '../../src/lib/unverifiedRegistry';

const TITLES = [
  'Satake multiplicities against Helgason.',
  "Mozes' paper.",
  'Björner and Brenti, section 4.3.',
  "Kac's book.",
  "Wildberger's lectures.",
  'The affine fate table for non-simply-laced and twisted boards',
  'The face-counting rule',
  'Is the link between Satake diagrams and node-firing games new?',
  'Attribution of the golden folding',
  'Section and theorem numbers quoted from memory',
  'The proposer of the 1986 Olympiad problem',
  'Whether route (a) for mathematics works with MDX under Astro 7',
  "Kostant's game",
  "Wildberger's List A against Kac's affine tables",
  'The last sentence on a failed condition 3',
  'Attributions of the tableau counts',
  'Everything else labelled [U].',
];

// SPEC.md 9.1: E6 at G2; E2 and E3 at G3; E7 and E9 at G4; every other item at G6 (Appendix E).
const GATES: Record<string, string> = {
  E1: 'G6', E2: 'G3', E3: 'G3', E4: 'G6', E5: 'G6', E6: 'G2', E7: 'G4', E8: 'G6', E9: 'G4',
  E10: 'G6', E11: 'G6', E12: 'G6', E13: 'G6', E14: 'G6', E15: 'G6', E16: 'G6', E17: 'G6',
};

/** Saves and restores the environment variables a test changes. */
function envGuard(names: string[]): () => void {
  const saved = new Map(names.map((n) => [n, process.env[n]]));
  return () => {
    for (const [n, v] of saved) {
      if (v === undefined) delete process.env[n];
      else process.env[n] = v;
    }
  };
}

describe('unverified.json', () => {
  it('unverified.json seed', () => {
    const items = seed as { id: string; status: string; statement: string; whereToCheck: string; gate: string }[];
    expect(items).toHaveLength(17);
    items.forEach((item, i) => {
      expect(item.id).toBe(`E${i + 1}`);
      expect(item.status).toBe('open');
      expect(item.statement.length).toBeGreaterThan(0);
      expect(item.whereToCheck.length).toBeGreaterThan(0);
      expect(item.statement.startsWith(TITLES[i]!), item.id).toBe(true);
      expect(item.statement + item.whereToCheck).not.toContain('—');
      expect(item.statement + item.whereToCheck).not.toContain('**');
    });
    expect(Object.fromEntries(items.map((it) => [it.id, it.gate]))).toEqual(GATES);
  });
});

describe('unverifiedRegistry', () => {
  let restore: () => void;
  let dir: string;
  beforeEach(() => {
    restore = envGuard(['RELEASE', 'OPEN_ITEMS_REPORT_DIR', 'OPEN_ITEMS_BUILD_ID']);
    dir = mkdtempSync(join(tmpdir(), 'p0a4-reg-'));
    process.env.OPEN_ITEMS_REPORT_DIR = dir;
    delete process.env.OPEN_ITEMS_BUILD_ID;
    clearUsage();
  });
  afterEach(() => {
    clearUsage();
    restore();
    rmSync(dir, { recursive: true, force: true });
  });

  it('decide in preview', () => {
    for (const fallback of [true, false]) {
      expect(decide('E4', false, fallback)).toBe('marked');
      expect(decide('E99', false, fallback)).toBe('marked');
      expect(decide('not-an-item', false, fallback)).toBe('marked');
    }
  });

  it('decide in release', () => {
    expect(decide('E4', true, true)).toBe('fallback');
    expect(decide('E4', true, false)).toBe('nothing');
    expect(decide('E99', true, true)).toBe('fallback');
    expect(decide('E99', true, false)).toBe('nothing');
    expect(decide('e4', true, false)).toBe('nothing');
  });

  it('a closed item is marked in a preview and plain in a release', () => {
    // The seed has no closed item (only the owner closes one), so a closed item is simulated on a
    // copy of the record held by the registry for this test only.
    const item = itemById('E12')!;
    expect(item.status).toBe('open');
    const mutable = item as { status: 'open' | 'closed' };
    mutable.status = 'closed';
    try {
      expect(decide('E12', false, true)).toBe('marked');
      expect(decide('E12', false, false)).toBe('marked');
      expect(decide('E12', true, true)).toBe('plain');
      expect(decide('E12', true, false)).toBe('plain');
    } finally {
      mutable.status = 'open';
    }
  });

  it('isReleaseBuild reads RELEASE at call time', () => {
    delete process.env.RELEASE;
    expect(isReleaseBuild()).toBe(false);
    process.env.RELEASE = '1';
    expect(isReleaseBuild()).toBe(true);
    process.env.RELEASE = '';
    expect(isReleaseBuild()).toBe(false);
    process.env.RELEASE = '0';
    expect(isReleaseBuild()).toBe(true);
  });

  it('registerUsage records each pair once and the report lists every item', () => {
    delete process.env.RELEASE;
    registerUsage('E4', '/modules/m1-mutation/');
    registerUsage('E4', '/modules/m1-mutation/');
    registerUsage('E4', '/modules/m2-form/');
    registerUsage('E99', '/modules/m1-mutation/');
    const r = currentReport();
    expect(r.mode).toBe('release');
    expect(r.items.map((i) => i.id)).toEqual(Array.from({ length: 17 }, (_, i) => `E${i + 1}`));
    expect(r.items.find((i) => i.id === 'E4')!.pages).toEqual(['/modules/m1-mutation/', '/modules/m2-form/']);
    expect(r.items.find((i) => i.id === 'E5')!.pages).toEqual([]);
    expect(r.unknownItems).toEqual([{ item: 'E99', pages: ['/modules/m1-mutation/'] }]);
    // A preview writes nothing.
    expect(readdirSync(dir)).toEqual([]);
  });

  it('writeReport and the build-start hook write the baseline only in a release build', async () => {
    delete process.env.RELEASE;
    writeReport();
    expect(readdirSync(dir)).toEqual([]);

    process.env.RELEASE = '1';
    writeReport();
    expect(reportPath()).toBe(join(dir, 'open-items-report.json'));
    const r = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
    expect(r.mode).toBe('release');
    expect(r.items).toHaveLength(17);
    for (const it of r.items) expect(it.pages).toEqual([]);
    expect(r.unknownItems).toEqual([]);
    expect(readFileSync(join(dir, 'open-items-report.md'), 'utf8')).toContain('| E17 |');

    rmSync(join(dir, 'open-items-report.json'));
    rmSync(join(dir, 'open-items-report.md'));
    const hook = openItemsReportIntegration().hooks['astro:build:start'] as unknown as () => Promise<void> | void;
    registerUsage('E4', '/x/', true); // the hook writes the baseline whatever this instance holds
    rmSync(join(dir, 'open-items-report.json'));
    rmSync(join(dir, 'open-items-report.md'));
    await hook();
    const baseline = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
    expect(baseline.items).toHaveLength(17);
    for (const it of baseline.items) expect(it.pages).toEqual([]);
    expect(baseline.buildId).toBe(process.env.OPEN_ITEMS_BUILD_ID);
    expect(existsSync(join(dir, 'open-items-report.md'))).toBe(true);

    // With RELEASE deleted the hook writes nothing and leaves an existing file unchanged.
    delete process.env.RELEASE;
    const before = readFileSync(join(dir, 'open-items-report.json'));
    const mtime = statSync(join(dir, 'open-items-report.json')).mtimeMs;
    await hook();
    writeReport();
    registerUsage('E7', '/y/');
    expect(readFileSync(join(dir, 'open-items-report.json')).equals(before)).toBe(true);
    expect(statSync(join(dir, 'open-items-report.json')).mtimeMs).toBe(mtime);
  });

  it('release registrations rewrite the report and merge with the same build', () => {
    process.env.RELEASE = '1';
    process.env.OPEN_ITEMS_BUILD_ID = 'build-a';
    // A report written by another module instance of the same build.
    const other: OpenItemsReport = {
      mode: 'release', generatedAt: 'x', buildId: 'build-a',
      items: (seed as { id: string; status: 'open'; gate: string }[]).map((s) => ({ id: s.id, status: s.status, gate: s.gate, pages: s.id === 'E2' ? ['/other/'] : [], fallbackShown: false })),
      unknownItems: [{ item: 'E77', pages: ['/other/'] }],
    };
    writeFileSync(join(dir, 'open-items-report.json'), JSON.stringify(other));
    registerUsage('E4', '/here/', true);
    const r = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
    expect(r.items.find((i) => i.id === 'E4')).toMatchObject({ pages: ['/here/'], fallbackShown: true });
    expect(r.items.find((i) => i.id === 'E2')!.pages).toEqual(['/other/']);
    expect(r.unknownItems).toEqual([{ item: 'E77', pages: ['/other/'] }]);

    // A file from another build is replaced, not merged.
    process.env.OPEN_ITEMS_BUILD_ID = 'build-b';
    registerUsage('E5', '/b/');
    const r2 = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
    expect(r2.items.find((i) => i.id === 'E2')!.pages).toEqual([]);
    expect(r2.items.find((i) => i.id === 'E5')!.pages).toEqual(['/b/']);
    expect(r2.unknownItems).toEqual([]);
  });
});
