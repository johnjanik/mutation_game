// Copies the stylesheet and fonts of the installed KaTeX into site/public/katex/<version>/ and
// writes site/src/generated/katex-assets.json (P0-A3; SPEC.md 7.2 item 2, 7.8; CONTRACTS.md 4).
// The KaTeX is resolved from site/, so the copy comes from the same package that renders the HTML.
// Run from any directory: node scripts/katex-assets.mjs
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { holdForReleaseBuild } from '../site/src/lib/openItemsReport.mjs';

const siteDir = fileURLToPath(new URL('../site/', import.meta.url));

/** The installed KaTeX, resolved exactly as the site resolves it. */
export function installedKatex() {
  const requireFromSite = createRequire(join(siteDir, 'package.json'));
  const css = requireFromSite.resolve('katex/dist/katex.min.css');
  const distDir = dirname(css);
  const packageJson = join(dirname(distDir), 'package.json');
  const version = JSON.parse(readFileSync(packageJson, 'utf8')).version;
  return { version, css, fontsDir: join(distDir, 'fonts') };
}

/**
 * Copy katex.min.css and the whole fonts/ directory into <destRoot>/<version>/, remove every
 * other version directory under destRoot, and write <generatedDir>/katex-assets.json.
 * @param {string} destRoot
 * @param {string} generatedDir
 * @returns {{ version: string; files: number; dir: string }}
 */
export function copyKatexAssets(destRoot, generatedDir) {
  const { version, css, fontsDir } = installedKatex();
  mkdirSync(destRoot, { recursive: true });
  for (const entry of readdirSync(destRoot)) {
    if (entry !== version) rmSync(join(destRoot, entry), { recursive: true, force: true });
  }
  const versionDir = join(destRoot, version);
  rmSync(versionDir, { recursive: true, force: true });
  mkdirSync(join(versionDir, 'fonts'), { recursive: true });
  copyFileSync(css, join(versionDir, 'katex.min.css'));
  let files = 1;
  for (const font of readdirSync(fontsDir)) {
    copyFileSync(join(fontsDir, font), join(versionDir, 'fonts', font));
    files += 1;
  }
  mkdirSync(generatedDir, { recursive: true });
  const assets = { version, stylesheet: `katex/${version}/katex.min.css` };
  writeFileSync(join(generatedDir, 'katex-assets.json'), JSON.stringify(assets, null, 2) + '\n');
  return { version, files, dir: versionDir };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    // The first command of the root prebuild, so the first step of every npm run build: in a release
    // build, the report of an earlier release build is marked incomplete before anything of this
    // build can fail (site/src/lib/openItemsReport.mjs; RT-FIX P5-RT-12-01).
    holdForReleaseBuild();
    const { version, files } = copyKatexAssets(join(siteDir, 'public', 'katex'), join(siteDir, 'src', 'generated'));
    process.stdout.write(`katex ${version}: ${files} files copied to site/public/katex/${version}/\n`);
  } catch (error) {
    process.stderr.write(`katex-assets: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}\n`);
    process.exit(1);
  }
}
