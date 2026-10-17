// P1-A4: the released flag of SPEC.md 7.3 ("A link to a page that has not been released yet is left
// out by the build, driven by a released flag in each page's front matter"), the route collision
// rule, and two fixture builds of the lesson layout (SPEC.md 8.2, 9.2, D17) and of the provenance
// rules of <Seen> (8.2 item 4, 8.4). Fixture builds use P0-A4's runner, which calls Astro's build()
// with the site's configuration and srcDir set to the fixture; outputs go to temporary directories.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RESERVED_SLUGS,
  isReleased,
  joinBase,
  linkFor,
  modulesFromFiles,
  nextModule,
  pagesFromFiles,
  releasedModules,
  routeOf,
  slugCollisions,
  toolsFromFiles,
  type Inventory,
} from '../../src/lib/pages/released';
import { routeOfContentFile, usagesFromFiles } from '../../src/lib/pages/openItems';

const SITE_DIR = join(import.meta.dirname, '..', '..');

function inv(over: Partial<Inventory> = {}): Inventory {
  return {
    modules: [
      { slug: 'm0-start', module: 0, released: true, title: 'Start here' },
      { slug: 'm1-mutation', module: 1, released: false, title: 'The mutation game' },
      { slug: 'm3-finite', module: 3, released: true, title: 'Finite, affine, wild' },
    ],
    pages: [
      { slug: 'glossary', released: true },
      { slug: 'history', released: false },
    ],
    tools: [],
    atlas: false,
    release: false,
    ...over,
  };
}

describe('released flag', () => {
  it('joins the base with exactly one slash', () => {
    expect(joinBase('/', 'about/')).toBe('/about/');
    expect(joinBase('/sub/path/', 'about/')).toBe('/sub/path/about/');
    expect(joinBase('/sub/path', '/about/')).toBe('/sub/path/about/');
    expect(joinBase('/sub/path/', '')).toBe('/sub/path/');
  });

  it('unreleased module omitted from links and index', () => {
    const i = inv();
    // The route exists (the page is built) but no link is rendered.
    expect(routeOf({ kind: 'module', slug: 'm1-mutation' }, i)).toBe('modules/m1-mutation/');
    expect(isReleased({ kind: 'module', slug: 'm1-mutation' }, i)).toBe(false);
    expect(linkFor({ kind: 'module', slug: 'm1-mutation' }, i, '/sub/')).toBeNull();
    expect(linkFor({ kind: 'module', number: 1 }, i, '/')).toBeNull();
    expect(linkFor({ kind: 'module', slug: 'm0-start' }, i, '/sub/')).toBe('/sub/modules/m0-start/');
    expect(linkFor({ kind: 'module', number: 3 }, i, '/')).toBe('/modules/m3-finite/');
    expect(linkFor({ kind: 'module', slug: 'm9-absent' }, i, '/')).toBeNull();
    expect(releasedModules(i).map((m) => m.slug)).toEqual(['m0-start', 'm3-finite']);
    // Order is by module number, whatever the order of the files.
    const shuffled = inv({ modules: [...inv().modules].reverse() });
    expect(releasedModules(shuffled).map((m) => m.module)).toEqual([0, 3]);
  });

  it('unreleased page omitted', () => {
    const i = inv();
    expect(routeOf({ kind: 'page', slug: 'history' }, i)).toBe('history/');
    expect(linkFor({ kind: 'page', slug: 'history' }, i, '/')).toBeNull();
    expect(linkFor({ kind: 'page', slug: 'glossary' }, i, '/')).toBe('/glossary/');
    expect(linkFor({ kind: 'page', slug: 'confusions' }, i, '/')).toBeNull();
    // open-items is a preview page: released in a preview build only.
    expect(linkFor({ kind: 'static', name: 'open-items' }, i, '/')).toBe('/open-items/');
    expect(linkFor({ kind: 'static', name: 'open-items' }, inv({ release: true }), '/')).toBeNull();
    expect(linkFor({ kind: 'static', name: 'sources' }, inv({ release: true }), '/')).toBe('/sources/');
    expect(linkFor({ kind: 'static', name: 'index' }, i, '/sub/path/')).toBe('/sub/path/');
  });

  it('next module omitted when absent or unreleased', () => {
    const i = inv();
    expect(nextModule(0, i)).toBeNull(); // module 1 is not released
    expect(nextModule(1, i)).toBeNull(); // module 2 does not exist; module 3 is never offered in its place
    expect(nextModule(2, i)?.slug).toBe('m3-finite');
    expect(nextModule(3, i)).toBeNull();
    const all = inv({ modules: inv().modules.map((m) => ({ ...m, released: true })) });
    expect(nextModule(0, all)?.slug).toBe('m1-mutation');
  });

  it('tool without registry entry omitted', () => {
    expect(linkFor({ kind: 'tool', id: 'sandbox', query: 'g=A3' }, inv(), '/')).toBeNull();
    const tools = toolsFromFiles({
      '../../tools/registry/T16.ts': "export default { number: 16, id: 'sandbox', phase: 2 };",
      '../../tools/registry/T01.ts': "export default { number: 1, id: 'board', released: false };",
      '../../tools/registry/README.ts': 'not a registry entry',
    });
    expect(tools).toEqual([{ id: 'sandbox' }, { id: 'board', released: false }]);
    const i = inv({ tools });
    expect(linkFor({ kind: 'tool', id: 'sandbox', query: 'g=A3' }, i, '/sub/')).toBe('/sub/tools/sandbox/?g=A3');
    expect(linkFor({ kind: 'tool', id: 'board' }, i, '/')).toBeNull();
    expect(linkFor({ kind: 'tool', id: 'garden' }, i, '/')).toBeNull();
    expect(linkFor({ kind: 'atlas', board: 'A3' }, i, '/')).toBeNull();
    expect(linkFor({ kind: 'atlas', board: 'A3' }, inv({ atlas: true }), '/')).toBe('/atlas/A3/');
  });

  it('reads the released flag from frontmatter', () => {
    const modules = modulesFromFiles({
      '../../content/modules/m0-start.mdx': '---\ntitle: "Start: here"\nmodule: 0\nquestion: "What?"\nreleased: true\n---\nBody\n',
      '../../content/modules/m1-mutation.mdx': '---\ntitle: The mutation game\nmodule: 1\nreleased: false\n---\n',
      '../../content/modules/m2-form.mdx': '---\ntitle: No flag\nmodule: 2\n---\n',
    });
    expect(modules).toEqual([
      { slug: 'm0-start', module: 0, released: true, title: 'Start: here', question: 'What?' },
      { slug: 'm1-mutation', module: 1, released: false, title: 'The mutation game' },
      { slug: 'm2-form', module: 2, released: false, title: 'No flag' },
    ]);
    const pages = pagesFromFiles({ '../../content/pages/glossary.mdx': '---\ntitle: Glossary\nreleased: true\n---\n' });
    expect(pages).toEqual([{ slug: 'glossary', released: true }]);
  });

  it('no slug collides with a static route', () => {
    const pageSlugs = readdirSync(join(SITE_DIR, 'src', 'content', 'pages')).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
    const modulesDir = join(SITE_DIR, 'src', 'content', 'modules');
    const moduleSlugs = existsSync(modulesDir) ? readdirSync(modulesDir).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, '')) : [];
    expect(pageSlugs).toEqual(expect.arrayContaining(['about', 'credits', 'glossary']));
    expect(slugCollisions(pageSlugs, moduleSlugs)).toEqual([]);
    // Every static page or route directory of src/pages is reserved, so a page can never shadow one.
    const staticNames = readdirSync(join(SITE_DIR, 'src', 'pages'))
      .map((f) => f.replace(/\.(astro|mdx|md|ts)$/, ''))
      .filter((f) => !f.startsWith('[') && !f.startsWith('_'));
    for (const name of staticNames) expect(RESERVED_SLUGS as readonly string[]).toContain(name);
    for (const name of staticNames) expect(pageSlugs).not.toContain(name);
    // The rule itself.
    expect(slugCollisions(['sources'], [])).toHaveLength(1);
    expect(slugCollisions(['glossary', 'open-items'], [])).toHaveLength(1);
    expect(slugCollisions(['about', 'about'], ['m0', 'm0'])).toHaveLength(2);
  });
});

describe('open-items usages', () => {
  it('finds the pages that use an item by scanning the MDX sources', () => {
    const map = usagesFromFiles({
      '../../content/modules/m0-start.mdx': 'Text <Unverified item="E4" fallback="x">A</Unverified> and <Unverified item=\'E13\'>B</Unverified>.',
      '../../content/pages/history.mdx': '<Unverified fallback="y" item="E4">C</Unverified> <Unverified item={"E18"}>D</Unverified>',
      '../../content/pages/plain.mdx': 'no marks',
      '../../other/file.mdx': '<Unverified item="E1">ignored</Unverified>',
    });
    expect(Object.fromEntries(map)).toEqual({ E4: ['history/', 'modules/m0-start/'], E13: ['modules/m0-start/'], E18: ['history/'] });
    expect(routeOfContentFile('/x/src/content/modules/m1.mdx')).toBe('modules/m1/');
    expect(routeOfContentFile('/x/src/content/pages/glossary.mdx')).toBe('glossary/');
  });
});

// ---------------------------------------------------------------------------------------------
// Fixture builds (one at a time; each output removed in a finally).
// ---------------------------------------------------------------------------------------------

const RUNNER = join(SITE_DIR, 'tests', 'fixtures', 'content', 'build-fixture.mjs');
const FIXTURES = join(SITE_DIR, 'tests', 'fixtures', 'lesson');
const TEST_TIMEOUT_MS = 300_000;

interface Built { status: number | null; output: string; pages: Record<string, string> }

function buildFixture(name: string): Built {
  const outDir = mkdtempSync(join(tmpdir(), `p1a4-lesson-${name}-`));
  const reportDir = mkdtempSync(join(tmpdir(), 'p1a4-report-'));
  try {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
    for (const k of ['RELEASE', 'BASE_PATH', 'SITE_URL', 'OUT_DIR', 'OPEN_ITEMS_BUILD_ID', 'GITHUB_REPOSITORY', 'NODE_ENV', 'TEST', 'BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']) delete env[k];
    env.OPEN_ITEMS_REPORT_DIR = reportDir;
    const child = spawnSync(process.execPath, [RUNNER, SITE_DIR, join(FIXTURES, name), outDir], {
      cwd: SITE_DIR,
      env,
      encoding: 'utf8',
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const pages: Record<string, string> = {};
    for (const [route, file] of [['/', 'index.html'], ['/final/', join('final', 'index.html')]] as const) {
      const p = join(outDir, file);
      if (existsSync(p)) pages[route] = readFileSync(p, 'utf8');
    }
    return { status: child.status, output: `${child.stdout ?? ''}${child.stderr ?? ''}`, pages };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
    rmSync(reportDir, { recursive: true, force: true });
  }
}

/** The position of the first element carrying an attribute, -1 when absent. */
const at = (html: string, needle: string): number => html.indexOf(needle);

let goodBuild: Built | null = null;
/** The good fixture is built once and read by two tests. */
function good(): Built {
  goodBuild ??= buildFixture('good');
  return goodBuild;
}

describe('lesson fixtures', () => {
  it('lesson anatomy fixture', () => {
    const b = good();
    expect(b.status, b.output).toBe(0);
    const html = b.pages['/']!;
    expect(html, 'the fixture page was built').toBeDefined();
    const order = [
      'data-anatomy="title"',
      'data-anatomy="question"',
      'data-anatomy="draft"',
      'data-anatomy="beat" data-beat="1"',
      'data-anatomy="figure"',
      'data-anatomy="beat" data-beat="2"',
      'data-anatomy="seen"',
      'data-anatomy="lie-theory"',
      'data-challenge',
      'data-anatomy="links"',
      'data-anatomy="sources"',
    ].map((n) => [n, at(html, n)] as const);
    for (const [n, i] of order) expect(i, `${n} present`).toBeGreaterThan(-1);
    const positions = order.map(([, i]) => i);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).toMatch(/<h1 data-anatomy="title"[^>]*>Fixture lesson<\/h1>/);
    expect(html).toMatch(/<p class="question" data-anatomy="question"[^>]*>Does the layout place every part of a lesson in order\?<\/p>/);
    expect(html).toContain('id="beat-1"');
    expect(html).toMatch(/<h2[^>]*>What we have seen<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>For readers who know Lie theory<\/h2>/);
    // The challenge is an island; without JavaScript its goal and <details> explanation are there,
    // and the result element is absent until the check is met.
    expect(html).toMatch(/<astro-island[^>]*component-export="Challenge"[^>]*client="visible"/);
    expect(html).toContain('<details>');
    expect(html).not.toContain('data-challenge-result');
    // MERGE, P1 stage 1.3: the fixture is module 0, so once M1 is released the links hold the next module;
    // the wrapper then carries data-count="1" and a link to it. Before M1 existed the count was 0.
    expect(html).toMatch(/<(div|nav)[^>]*data-anatomy="links" data-count="[0-2]"/); // sandbox and next module, once released (P2-A5)
    expect(html).toMatch(/data-source="W20"/);
    // The draft mark is in words, not colour alone.
    expect(html).toMatch(/data-anatomy="draft"[^>]*>\s*<strong[^>]*>Draft\.<\/strong>/);
    // draft: false gives no draft mark.
    const final = b.pages['/final/']!;
    expect(final, 'the approved fixture page was built').toBeDefined();
    expect(final).toContain('data-anatomy="title"');
    expect(final).not.toContain('data-anatomy="draft"');
  }, TEST_TIMEOUT_MS);

  it('Seen provenance rules', () => {
    const b = good();
    expect(b.status, b.output).toBe(0);
    // A key renders through <Cite>; the lower-case phrase of 8.2 renders as plain words.
    const html = b.pages['/']!;
    expect(html).toMatch(/<span data-provenance="W20"[^>]*><a class="cite" data-cite="W20"/);
    expect(html).toMatch(/<span data-provenance="verified by computation"[^>]*>verified by computation<\/span>/);
    // The capitalised phrase of 8.4 is accepted and never dressed up as a citation.
    const final = b.pages['/final/']!;
    const phrase = 'Verified by computation for all boards of rank at most 8';
    expect(final).toContain(`data-provenance="${phrase}"`);
    expect(final).not.toContain(`[${phrase}]`);
    const seen = final.slice(final.indexOf('data-anatomy="seen"'));
    expect(seen.slice(0, seen.indexOf('</section>'))).not.toContain('class="cite"');

    const badKey = buildFixture('bad-key');
    expect(badKey.status).not.toBe(0);
    expect(badKey.output).toContain('"W99"');
    expect(badKey.output).toContain('neither a key defined in SOURCES.md');

    const badPhrase = buildFixture('bad-phrase');
    expect(badPhrase.status).not.toBe(0);
    expect(badPhrase.output).toContain('"checked by hand"');
  }, TEST_TIMEOUT_MS);
});
