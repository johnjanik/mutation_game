// RT-FIX P4-RT-08-04, adopted from the RT-08 lens reproducer (phase 4 round, attack 28):
// the credits page omitted libraries whose code ships to the reader. SPEC.md 7.9: "A credits page lists
// every third-party asset with title, author, source and licence, and the licences of bundled libraries
// and fonts". The page listed only "every package named in the three package.json files"; the Svelte
// runtime imports clsx (MIT, Luke Edwards), a dependency of svelte that no package.json of the
// repository names, and its code is bundled into the client chunk of the islands; Vite's preload helper
// (MIT) ships the same way. The list of bundled packages is now read from the build's own chunks
// (site/src/lib/pages/shippedPackages.ts; the build writes it to shippedPackagesFile(site, dist)).
// Reads the built site (npm run build); the rows are read through the data-package and data-licence hooks.
import { expect, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readShippedPackages, shippedPackagesFile } from '../../src/lib/pages/shippedPackages';

const at =(p: string) => fileURLToPath(new URL(p, import.meta.url));
const dist = at('../../dist');
// clsx's toVal, minified: string or number appended; an array walked recursively; an object's truthy keys.
const CLSX = /function (\w+)\((\w)\)\{var \w,\w,(\w)=``;if\(typeof \2==`string`\|\|typeof \2==`number`\)\3\+=\2;else if\(typeof \2==`object`\)\{if\(Array\.isArray\(\2\)\)/;

test.describe('bundled libraries on the credits page', () => {
  // regression: P4-RT-08-04
  test('the built site exists', () => {
    expect(existsSync(`${dist}/credits/index.html`), 'run npm run build first').toBe(true);
  });

  // regression: P4-RT-08-04
  test('svelte imports clsx and no package.json of the repository names it', () => {
    const attrs = readFileSync(at('../../../node_modules/svelte/src/internal/shared/attributes.js'), 'utf8');
    expect(attrs).toMatch(/import \{ clsx as _clsx \} from 'clsx'/);
    for (const p of ['../../../package.json', '../../package.json', '../../../packages/engine/package.json']) {
      expect(readFileSync(at(p), 'utf8')).not.toMatch(/"clsx"/);
    }
  });

  // regression: P4-RT-08-04
  test('clsx code is in a client chunk, so the credits page must list clsx and its licence', () => {
    const chunks = readdirSync(`${dist}/_astro`).filter((f) => f.endsWith('.js'));
    const withClsx = chunks.filter((f) => CLSX.test(readFileSync(`${dist}/_astro/${f}`, 'utf8')));
    // Observed at b9b8504: client.<hash>.js (the islands' Svelte runtime chunk).
    expect(withClsx.length, 'chunks carrying clsx').toBeGreaterThan(0);
    const credits = readFileSync(`${dist}/credits/index.html`, 'utf8');
    // Observed at b9b8504: the credits page never names clsx (nor Luke Edwards).
    expect(credits, `credits page lists clsx, shipped in ${withClsx.join(', ')}`).toMatch(/clsx/);
  });

  // regression: P4-RT-08-04
  test('every package whose code the build ships has a row on the credits page, with its licence', async ({ page }) => {
    const list = readShippedPackages(shippedPackagesFile(at('../..'), dist));
    expect(list, 'the build writes the list of bundled packages').not.toBeNull();
    // The list is this build's: every chunk it names is in the built directory.
    for (const p of list!) for (const c of p.chunks) expect(existsSync(`${dist}/${c}`), `${p.name}: ${c}`).toBe(true);
    // Two packages found independently of the list: clsx by its code (above) and Vite's preload helper by its file.
    const names = list!.map((p) => p.name);
    expect(names).toContain('clsx');
    if (readdirSync(`${dist}/_astro`).some((f) => /^preload-helper\.[\w-]+\.js$/.test(f))) expect(names).toContain('vite');
    await page.goto('credits/');
    for (const name of names) {
      const row = page.locator(`tr[data-package="${name}"]`);
      await expect(row, name).toHaveCount(1);
      await expect(row.locator('[data-licence]'), name).toHaveText(/\S/);
      await expect(row.locator('[data-licence]'), name).not.toHaveText('licence not stated in the package');
      await expect(row, name).toContainText('shipped to the reader');
    }
    await expect(page.locator('tr[data-package="clsx"] [data-licence]')).toHaveText('MIT');
  });
});
