// P0-A3: the one KaTeX of the site (SPEC.md 7.2 items 2 and 3, 7.3, 7.5 A-12, 7.6; CONTRACTS.md 4).
// The HTML, the stylesheet and the fonts must come from one installed KaTeX version.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTex, KATEX_VERSION, katexStylesheetHref } from '../../src/lib/katex';
import { copyKatexAssets } from '../../../scripts/katex-assets.mjs';
import { texOfName, writeNames } from '../../../scripts/names.mjs';

const siteDir = fileURLToPath(new URL('../../', import.meta.url));
const repoDir = fileURLToPath(new URL('../../../', import.meta.url));
const requireFromSite = createRequire(join(siteDir, 'package.json'));
const katexPackageJsonPath = requireFromSite.resolve('katex/package.json');
const installedVersion: string = JSON.parse(readFileSync(katexPackageJsonPath, 'utf8')).version;
const installedDist = dirname(requireFromSite.resolve('katex/dist/katex.min.css'));

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'p0a3-'));
}

describe('renderTex', () => {
  it('renderTex renders inline mathematics with MathML and KaTeX markup', () => {
    const html = renderTex('\\alpha_1', false);
    expect(html).toContain('<math');
    expect(html).toMatch(/<span class="[^"]*katex[^"]*"/);
    expect(html).not.toContain('display="block"');
  });

  it('renderTex display mode emits a block math element', () => {
    const html = renderTex('\\alpha_1', true);
    expect(html).toMatch(/<math[^>]*display="block"/);
  });

  it('renderTex throws on a malformed formula', () => {
    let caught: unknown = null;
    try {
      renderTex('\\frac{', false);
    } catch (error) {
      caught = error;
    }
    expect(caught).not.toBeNull();
    expect((caught as Error).name).toBe('ParseError');
  });

  it('renderTex keeps a backslash sequence intact', () => {
    const html = renderTex('\\frac{1}{2}', false);
    expect(html).toContain('<mfrac>');
    expect(html).toContain('<annotation encoding="application/x-tex">\\frac{1}{2}</annotation>');
  });

  it('renderTex renders the SOURCES.md formula shapes', () => {
    const shapes = [
      'C = M^{\\mathsf T}',
      '\\mathfrak{so}^*(10)',
      '2\\pi/h',
      'e^{2\\pi i m_j/h}',
      '\\tilde A_4',
      '-w_0',
      '\\tilde s_i = w_{X\\cup\\{i,\\tau(i)\\}}\\,w_X^{-1}',
      '\\exp(\\operatorname{ad}x)\\exp(\\operatorname{ad}(-y))\\exp(\\operatorname{ad}x)',
      '\\langle h_i, \\mathrm{wt}(b)\\rangle',
      'U_q(\\mathfrak g)',
    ];
    const sources = readFileSync(join(repoDir, 'SOURCES.md'), 'utf8');
    for (const tex of shapes) {
      expect(sources, `SOURCES.md contains ${tex}`).toContain(tex);
      expect(renderTex(tex, false), tex).toContain('<math');
    }
  });

  it('KATEX_VERSION equals the installed package version and the stylesheet path carries it', () => {
    expect(KATEX_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(KATEX_VERSION).toBe(installedVersion);
    expect(katexStylesheetHref('/')).toBe(`/katex/${installedVersion}/katex.min.css`);
    expect(katexStylesheetHref('/sub/path')).toBe(`/sub/path/katex/${installedVersion}/katex.min.css`);
    expect(katexStylesheetHref('/sub/path/')).toBe(`/sub/path/katex/${installedVersion}/katex.min.css`);
  });

  it('the KaTeX that renders reports the same version', async () => {
    const katex = (await import('katex')).default;
    expect(katex.version).toBe(KATEX_VERSION);
  });
});

describe('one KaTeX', () => {
  it('only one KaTeX is installed', () => {
    const fromSite = realpathSync(katexPackageJsonPath);
    // rehype-katex and remark-math export only their entry, so resolve the entry and require from there.
    let rehypeKatexEntry: string | null = null;
    try {
      rehypeKatexEntry = requireFromSite.resolve('rehype-katex');
    } catch {
      rehypeKatexEntry = null;
    }
    const sitePackage = JSON.parse(readFileSync(join(siteDir, 'package.json'), 'utf8'));
    if (sitePackage.dependencies['rehype-katex'] !== undefined) {
      // Route (a): the KaTeX that rehype-katex resolves is the one the site resolves.
      expect(rehypeKatexEntry).not.toBeNull();
      const requireFromRehype = createRequire(rehypeKatexEntry as string);
      expect(realpathSync(requireFromRehype.resolve('katex/package.json'))).toBe(fromSite);
      // remark-math reaches KaTeX through micromark-extension-math; that copy must be the same too.
      const requireFromRemark = createRequire(requireFromSite.resolve('remark-math'));
      const micromarkMath = requireFromRemark.resolve('micromark-extension-math');
      expect(realpathSync(createRequire(micromarkMath).resolve('katex/package.json'))).toBe(fromSite);
    } else {
      // Route (b): rehype-katex must not be installed at all.
      expect(rehypeKatexEntry).toBeNull();
    }
    expect(sitePackage.dependencies.katex).toBe(installedVersion);
  });

  it('no client code imports KaTeX', () => {
    const srcDir = join(siteDir, 'src');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== 'generated') walk(path);
        } else if (/\.(ts|js|mjs|astro|svelte|mdx|md)$/.test(entry)) {
          files.push(path);
        }
      }
    };
    walk(srcDir);
    expect(files.length).toBeGreaterThan(0);
    const importsKatexPackage = /(from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]katex(\/[^'"]*)?['"]/;
    const importsLibKatex = /['"](@lib\/katex|[./]*lib\/katex)(\.ts)?['"]/;
    const offenders = files.filter((f) => importsKatexPackage.test(readFileSync(f, 'utf8'))).map((f) => relative(siteDir, f));
    expect(offenders).toEqual(['src/lib/katex.ts']);
    const svelteOffenders = files
      .filter((f) => f.endsWith('.svelte') && importsLibKatex.test(readFileSync(f, 'utf8')))
      .map((f) => relative(siteDir, f));
    expect(svelteOffenders).toEqual([]);
  });
});

describe('scripts/katex-assets.mjs', () => {
  it('copyKatexAssets copies the stylesheet and fonts of the installed version', () => {
    const dir = tempDir();
    try {
      const destRoot = join(dir, 'public', 'katex');
      const generatedDir = join(dir, 'generated');
      // A stale version directory must be removed, and a second run gives the same result.
      const staleDir = join(destRoot, '0.0.1');
      mkdirSync(staleDir, { recursive: true });
      writeFileSync(join(staleDir, 'katex.min.css'), 'stale');
      copyKatexAssets(destRoot, generatedDir);
      copyKatexAssets(destRoot, generatedDir);

      expect(readdirSync(destRoot)).toEqual([KATEX_VERSION]);
      const versionDir = join(destRoot, KATEX_VERSION);
      expect(readFileSync(join(versionDir, 'katex.min.css')).equals(readFileSync(join(installedDist, 'katex.min.css')))).toBe(true);
      const installedFonts = readdirSync(join(installedDist, 'fonts')).sort();
      expect(installedFonts.length).toBeGreaterThan(0);
      expect(readdirSync(join(versionDir, 'fonts')).sort()).toEqual(installedFonts);
      for (const font of installedFonts) {
        expect(readFileSync(join(versionDir, 'fonts', font)).equals(readFileSync(join(installedDist, 'fonts', font))), font).toBe(true);
      }
      const assets = JSON.parse(readFileSync(join(generatedDir, 'katex-assets.json'), 'utf8'));
      expect(assets).toEqual({ version: KATEX_VERSION, stylesheet: `katex/${KATEX_VERSION}/katex.min.css` });
      expect(assets.version).toBe(installedVersion);
      expect(assets.stylesheet).toBe(katexStylesheetHref('/').slice(1));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('scripts/names.mjs', () => {
  it('names.mjs writes the 32 names typeset by the same call', () => {
    const golden = JSON.parse(readFileSync(join(repoDir, 'reference', 'golden_data.json'), 'utf8'));
    const typeNames = Object.keys(golden.types);
    expect(typeNames.length).toBe(32);
    const dir = tempDir();
    try {
      const outFile = join(dir, 'nested', 'names.json');
      writeNames(outFile);
      expect(existsSync(outFile)).toBe(true);
      const written = JSON.parse(readFileSync(outFile, 'utf8'));
      expect(written.katex).toBe(KATEX_VERSION);
      expect(Object.keys(written.names)).toEqual(typeNames);
      for (const name of typeNames) {
        const entry = written.names[name];
        expect(entry.text).toBe(name);
        expect(entry.tex).toBe(texOfName(name));
        expect(entry.html).toBe(renderTex(entry.tex, false));
        expect(entry.html).toContain('<math');
      }
      expect(written.names.B2.html).not.toBe(written.names.C2.html);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(texOfName('A1')).toBe('A_{1}');
    expect(texOfName('B2')).toBe('B_{2}');
    expect(texOfName('E8')).toBe('E_{8}');
    expect(() => texOfName('Z9')).toThrow(/Z9/);
  });
});

describe('records', () => {
  it('the decisions fragment records both routes', () => {
    const path = join(repoDir, 'decisions', 'P0-A3.md');
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('Spike A');
    expect(text).toContain('Spike B');
    expect(text).toContain('Decision:');
  });
});
