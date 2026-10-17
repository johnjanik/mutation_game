// The internal-link check of the build (SPEC.md 7.7, Links row: "internal links checked by the
// build"; 7.3: "A link to a page that has not been released yet is left out by the build"), adopted
// from the red team (RT-12 attack 37). Before scripts/links.mjs, a dead internal link written in an
// .astro page (m1), a dead Markdown link (m2) and a Markdown link to the released: false page
// dev/math-check (m3) each built with exit 0, preview and release, and the built page kept the link.
// The check now runs after every npm run build (the root postbuild script) and fails the build.
// The three mutations of the red team's run-mutations.sh appear here as the built HTML they produced.
// Run: npx vitest run --project site-unit site/tests/unit/links-internal.test.ts
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { checkLinks, linksOf, releasedFlag, unreleasedRoutes } from '../../../scripts/links.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'links-test-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function write(dir: string, rel: string, text: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}
const page = (body: string, head = ''): string => `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;

/** A built site under `base` with the three mutations of the red team and links that are fine. */
function mutatedBuild(base: string): string {
  const dist = tempDir();
  const css = `${base}katex/0.16.47/katex.min.css`;
  write(dist, 'katex/0.16.47/katex.min.css', 'x{}');
  write(dist, '_astro/island.js', 'export {};');
  write(dist, 'index.html', page(`<a href="${base}about/">About</a> <a href="${base}sources#Don08">[Don08]</a> <a href="#main">skip</a> <a href="https://example.org/x">out</a> <a href="mailto:a@b.c">mail</a><astro-island component-url="${base}_astro/island.js" renderer-url="${base}_astro/island.js"></astro-island><script>import "/not-checked.js"</script>`, `<link rel="stylesheet" href="${css}">`));
  write(dist, 'sources/index.html', page('<p id="Don08">Don08</p>'));
  write(dist, 'dev/math-check/index.html', page('<p>Math check</p>'));
  write(dist, '404.html', page(`<a href="${base}">home</a>`));
  // m1: an .astro page with <a href={`${import.meta.env.BASE_URL}redteam-rt12-missing`}>.
  write(dist, 'rt12-mut/index.html', page(`<p><a href="${base}redteam-rt12-missing">x</a></p>`));
  // m2 and m3: [x](../no-such-page/) and [x](../dev/math-check/) appended to about.mdx.
  write(dist, 'about/index.html', page('<p>About.</p><p><a href="../no-such-page/">x</a></p><p><a href="../dev/math-check/">x</a></p>'));
  return dist;
}

const UNRELEASED = new Map([['/dev/math-check/', 'src/pages/dev/math-check.mdx']]);

describe('the internal-link check of the build', () => {
  // regression: P3-RT-12-01
  it('a dead internal link, a dead Markdown link and a link to an unreleased page are each reported', () => {
    for (const base of ['/', '/sub/path/']) {
      const result = checkLinks({ distDir: mutatedBuild(base), base, site: 'http://localhost', unreleased: UNRELEASED });
      expect(result.pages).toBe(6);
      expect(result.problems.map((p) => [p.route, p.url])).toEqual([
        ['/about/', '../no-such-page/'],
        ['/about/', '../dev/math-check/'],
        ['/rt12-mut/', `${base}redteam-rt12-missing`],
      ]);
      expect(result.problems[0]!.reason).toContain('dead internal link');
      expect(result.problems[1]!.reason).toContain('has not been released');
      expect(result.problems[2]!.reason).toContain('dead internal link');
    }
  });

  // regression: P3-RT-12-01
  it('npm run build runs the check after every build, and the check fails on a problem', () => {
    const scripts: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;
    expect(scripts.postbuild).toBe('node scripts/links.mjs');
    expect(scripts['build:release']).toBe('RELEASE=1 npm run build');
    expect(scripts['e2e:basepath']).toContain('npm run build');
    const run = (dist: string, base: string) => {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
      for (const k of ['SITE_URL', 'GITHUB_REPOSITORY', 'BASE_URL']) delete env[k];
      Object.assign(env, { OUT_DIR: dist, BASE_PATH: base });
      return spawnSync(process.execPath, [join(ROOT, 'scripts', 'links.mjs')], { encoding: 'utf8', env, cwd: ROOT });
    };
    const bad = run(mutatedBuild('/sub/path/'), '/sub/path/');
    expect(bad.status, bad.stdout + bad.stderr).toBe(1);
    expect(bad.stderr).toContain('/rt12-mut/: /sub/path/redteam-rt12-missing: no such page or file in the build');
    expect(bad.stderr).toMatch(/links: \d+ internal links on 6 pages of .* checked, 3 problems/);
    const good = tempDir();
    write(good, 'index.html', page('<a href="/sub/path/about/">About</a>'));
    write(good, 'about/index.html', page('<a href="../">home</a>'));
    const ok = run(good, '/sub/path/');
    expect(ok.status, ok.stdout + ok.stderr).toBe(0);
    expect(ok.stdout).toContain('2 internal links on 2 pages');
  });

  it('a link typed with a leading slash lies outside the base', () => {
    const dist = tempDir();
    write(dist, 'index.html', page('<a href="/about/">About</a><img src="/sub/path/missing.png" alt="">'));
    write(dist, 'about/index.html', page('<p>About</p>'));
    const r = checkLinks({ distDir: dist, base: '/sub/path/' });
    expect(r.problems.map((p) => [p.url, p.reason.split(',')[0]])).toEqual([
      ['/about/', 'resolves to /about/'],
      ['/sub/path/missing.png', 'no such page or file in the build (a dead internal link)'],
    ]);
  });

  it('URL attributes are read from markup only, entities decoded, srcset split', () => {
    const html = page('<!-- <a href="/c/"> --><a href="/a/?x=1&amp;y=2">a</a><img srcset="/i1.png 1x, /i2.png 2x" alt=""><style>a{background:url(/s.png)}</style><object data="/o.svg"></object><div data="/no/"></div>');
    expect(linksOf(html).map((l) => [l.tag, l.attribute, l.value])).toEqual([
      ['a', 'href', '/a/?x=1&y=2'],
      ['img', 'srcset', '/i1.png'],
      ['img', 'srcset', '/i2.png'],
      ['object', 'data', '/o.svg'],
    ]);
  });

  it('unreleased routes follow the released flags of the sources', () => {
    const site = tempDir();
    write(site, 'src/content/modules/m0-a.mdx', '---\ntitle: A\nreleased: true\n---\nText.\n');
    write(site, 'src/content/modules/m9-b.mdx', '---\ntitle: B\nreleased: false\n---\nText.\n');
    write(site, 'src/content/modules/m8-c.mdx', '---\ntitle: C\n---\nText.\n');
    write(site, 'src/content/pages/history.mdx', '---\ntitle: H\nreleased: false\n---\n');
    write(site, 'src/content/pages/about.mdx', '---\ntitle: About\nreleased: true\n---\n');
    write(site, 'src/tools/registry/T12.ts', "export const entry = {\n  number: 12,\n  id: 'rep',\n  released: false,\n};\n");
    write(site, 'src/tools/registry/T01.ts', "export const entry = {\n  number: 1,\n  id: 'board',\n};\n");
    write(site, 'src/pages/dev/check.mdx', '---\ntitle: Check\nreleased: false\n---\n');
    write(site, 'src/pages/dev/index.md', '---\nreleased: false\n---\n');
    write(site, 'src/pages/kept.mdx', '---\ntitle: Kept\n---\n');
    expect([...unreleasedRoutes(site).keys()].sort()).toEqual(['/dev/', '/dev/check/', '/embed/rep/', '/history/', '/modules/m8-c/', '/modules/m9-b/', '/tools/rep/']);
    expect(releasedFlag('---\nreleased: true # comment\n---\n')).toBe(true);
    expect(releasedFlag('No front matter.\nreleased: false\n')).toBeUndefined();
  });
});
