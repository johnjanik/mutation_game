// P0-A4: the seed of open items, the <Unverified> registry, and the fixture builds that prove the
// content components fail or succeed at build time as SPEC.md 7.3 and 7.7 (Content row) require.
// No golden value is typed here (COMMON.md 4.4); expected strings are computed from the imported JSON.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import golden from '../../../reference/golden_data.json';
import { formatGoldenValue } from '../../src/lib/golden';
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
      expect(item.statement + item.whereToCheck).not.toContain(String.fromCharCode(0x2014));
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

// ---------------------------------------------------------------------------------------------
// Fixture builds (plan, P0-A4 instruction 5.12): each case under site/tests/fixtures/content/ is
// built by a child Node process running build-fixture.mjs, which calls Astro's build() with the
// site's own configuration, srcDir set to the case and outDir to a temporary directory, and the
// open-items integration passed inline. One build at a time; each output is removed in a finally.
// ---------------------------------------------------------------------------------------------
const SITE_DIR = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures/content/', import.meta.url));
const RUNNER = join(FIXTURES, 'build-fixture.mjs');
const BUILD_TIMEOUT_MS = 240_000;
const TEST_TIMEOUT_MS = 300_000;

interface FixtureBuild { status: number | null; output: string; stderr: string; html: string | null; jsWithGolden: string[]; ms: number }

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((f) => join(dir, f))
    .filter((f) => statSync(f).isFile());
}

/** Builds one fixture; the output directory is temporary and removed in the finally block. */
function buildFixture(name: string, env: Record<string, string>, reportDir: string): FixtureBuild {
  const outDir = mkdtempSync(join(tmpdir(), `p0a4-out-${name}-`));
  try {
    const childEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) childEnv[k] = v;
    // Variables of the site's configuration are set only by the case; those that Vitest puts into
    // process.env (VITEST*, and BASE_URL, MODE, DEV, PROD, SSR from import.meta.env) would leak
    // into the child's Vite and override the base path, so they are removed too.
    for (const k of Object.keys(childEnv)) if (k.startsWith('VITEST')) delete childEnv[k];
    for (const k of ['RELEASE', 'BASE_PATH', 'SITE_URL', 'OUT_DIR', 'OPEN_ITEMS_BUILD_ID', 'GITHUB_REPOSITORY', 'NODE_ENV', 'TEST', 'BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']) delete childEnv[k];
    Object.assign(childEnv, env, { OPEN_ITEMS_REPORT_DIR: reportDir });
    const t0 = Date.now();
    const child = spawnSync(process.execPath, [RUNNER, SITE_DIR, join(FIXTURES, name), outDir], {
      cwd: SITE_DIR,
      env: childEnv,
      encoding: 'utf8',
      timeout: BUILD_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    const ms = Date.now() - t0;
    const htmlPath = join(outDir, 'index.html');
    const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : null;
    const jsWithGolden = listFiles(outDir)
      .filter((f) => /\.m?js$/.test(f))
      .filter((f) => /weyl_order|golden_data/.test(readFileSync(f, 'utf8')));
    return { status: child.status, output: `${child.stdout ?? ''}${child.stderr ?? ''}`, stderr: child.stderr ?? '', html, jsWithGolden, ms };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function withReportDir<T>(f: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'p0a4-report-'));
  try {
    return f(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const gold = golden as unknown as { types: Record<string, { weyl_order: number; longest_word: number[] }> };

/** The digit groups that <Tex> substituted, read from the TeX annotation of the first <math> element. */
function mathDigitGroups(html: string): string[] {
  const math = /<math[\s\S]*?<\/math>/.exec(html);
  expect(math, 'a <math> element').not.toBeNull();
  const annotation = /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/.exec(math![0]);
  expect(annotation).not.toBeNull();
  const m = /=\s*([0-9\\,]+)/.exec(annotation![1]!);
  expect(m).not.toBeNull();
  // The same groups appear as consecutive <mn> elements of the MathML.
  const groups = m![1]!.split('\\,');
  expect(math![0]).toContain(groups.map((g) => `<mn>${g}</mn>`).join('<mtext> </mtext>'));
  return groups;
}

describe('fixture builds', () => {
  it('bad fixture G fails the build', () => {
    const r = withReportDir((dir) => buildFixture('bad-g', {}, dir));
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('types.E9.weyl_order');
    expect(r.output).toContain('resolves to 0 values');
  }, TEST_TIMEOUT_MS);

  it('bad fixture Cite fails the build', () => {
    const r = withReportDir((dir) => buildFixture('bad-cite', {}, dir));
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('Nope99');
    expect(r.output).toContain('SourcesKeyError');
  }, TEST_TIMEOUT_MS);

  it('bad fixture Tex fails the build', () => {
    const r = withReportDir((dir) => buildFixture('bad-tex', {}, dir));
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('types.E9.x');
    expect(r.output).toContain('resolves to 0 values');
  }, TEST_TIMEOUT_MS);

  it('good fixture preview marks E4 (imports from the barrel; renders Tex with MathML and Cite; preview build leaves the release report untouched; nothing of golden.ts in client JavaScript)', () => {
    withReportDir((dir) => {
      // A release report already in place must be byte for byte unchanged after a preview build.
      const placed = '{"mode":"release","generatedAt":"placed before the preview build","items":[],"unknownItems":[]}\n';
      writeFileSync(join(dir, 'open-items-report.json'), placed);
      const r = buildFixture('good', { BASE_PATH: '/sub/path/' }, dir);
      expect(r.status, r.output).toBe(0);
      expect(r.html).not.toBeNull();
      const html = r.html!;

      // <G>, imported through the barrel of @components/content.
      expect(html).toContain(`<span class="g" data-golden="types.E8.weyl_order">${formatGoldenValue(gold.types.E8!.weyl_order)}</span>`);
      expect(html).toContain(`data-golden="types.A2.longest_word">${formatGoldenValue(gold.types.A2!.longest_word, 'word')}</span>`);

      // <Tex>: MathML whose digit groups, joined, equal the golden value; \frac reached KaTeX intact.
      const groups = mathDigitGroups(html);
      expect(groups.join('')).toBe(String(gold.types.E8!.weyl_order));
      expect(groups.length).toBeGreaterThan(1);
      for (const g of groups.slice(1)) expect(g).toHaveLength(3);
      expect(html).toContain('<mfrac>');
      expect(html).toContain('\\frac{1}{2}');

      // <Cite> under BASE_PATH=/sub/path/.
      for (const key of ['Don08', 'W20']) {
        const a = new RegExp(`<a class="cite" data-cite="${key}" href="/sub/path/sources#${key}" title="([^"]+)">\\[${key}\\]</a>`).exec(html);
        expect(a, /<a class="cite"[^>]*>[^<]*<\/a>/.exec(html)?.[0]).not.toBeNull();
        expect(a![1]!.trim().length).toBeGreaterThan(0);
      }

      // <Unverified> in a preview: marked and linked to open-items; E99 marked as unknown.
      expect(html).toContain('data-unverified="E4"');
      expect(html).toContain('Kac proves it.');
      expect(html).toContain('Dropped in release.');
      expect(html).toContain('href="/sub/path/open-items#E4"');
      expect(html).toContain('[unverified E4]');
      expect(html).toContain('data-unverified="E99"');
      expect(html).toContain('[unverified E99, not in unverified.json]');

      // A preview writes no report and prints no open-item line.
      expect(readdirSync(dir)).toEqual(['open-items-report.json']);
      expect(readFileSync(join(dir, 'open-items-report.json'), 'utf8')).toBe(placed);
      expect(r.stderr).not.toContain('open item E4 used on');

      // Nothing of golden.ts in client JavaScript (SPEC.md 7.6).
      expect(r.jsWithGolden).toEqual([]);
    });
  }, TEST_TIMEOUT_MS);

  it('good fixture release shows fallbacks (release build exits 0 and writes reports/open-items-report.json and .md)', () => {
    withReportDir((dir) => {
      const r = buildFixture('good', { RELEASE: '1' }, dir);
      expect(r.status, r.output).toBe(0);
      const html = r.html!;
      expect(html).toContain('computed for every board of rank at most 8');
      expect(html).toContain('class="unverified-fallback" data-unverified="E4"');
      expect(html).not.toContain('Kac proves it.');
      expect(html).not.toContain('Dropped in release.');
      expect(html).not.toContain('Unknown item.');
      expect(html).not.toContain('open-items#');
      expect(html).not.toContain('[unverified');
      expect(html).toContain('href="/sources#Don08"');
      expect(r.jsWithGolden).toEqual([]);

      const report = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
      expect(report.mode).toBe('release');
      expect(report.items.map((i) => i.id)).toEqual(Array.from({ length: 17 }, (_, i) => `E${i + 1}`));
      expect(report.items.find((i) => i.id === 'E4')).toMatchObject({ pages: ['/'], fallbackShown: true });
      expect(report.unknownItems).toEqual([{ item: 'E99', pages: ['/'] }]);
      const md = readFileSync(join(dir, 'open-items-report.md'), 'utf8');
      expect(md).toContain('| E4 | open | G6 | / | yes |');
      expect(md).toContain('| E99 | / |');
      expect(r.stderr).toContain('open item E4 used on / (fallback shown)');
      expect(r.stderr).toContain('open item E99 used on / (nothing shown)');
    });
  }, TEST_TIMEOUT_MS);

  it('empty fixture release build writes the seventeen-item report', () => {
    withReportDir((dir) => {
      const r = buildFixture('empty', { RELEASE: '1' }, dir);
      expect(r.status, r.output).toBe(0);
      const report = JSON.parse(readFileSync(join(dir, 'open-items-report.json'), 'utf8')) as OpenItemsReport;
      expect(report.mode).toBe('release');
      expect(report.items).toHaveLength(17);
      for (const it of report.items) expect(it.pages).toEqual([]);
      expect(report.unknownItems).toEqual([]);
      expect(existsSync(join(dir, 'open-items-report.md'))).toBe(true);
    });
  }, TEST_TIMEOUT_MS);
});
