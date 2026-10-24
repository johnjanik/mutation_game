// RT-FIX P4-RT-08-04: the credits page lists every third-party package whose code ships to the reader,
// not only the packages the three package.json files name (SPEC.md 7.9: "the licences of bundled
// libraries"). The Svelte runtime imports clsx (MIT, Luke Edwards), and the bundler adds Vite's preload
// helper (MIT); neither is named in a package.json. lib/pages/shippedPackages.ts records, from the client
// build's own chunks, the package of every module with code in them; lib/pages/dependencies.ts adds a
// row for each. The check against a real build is site/tests/e2e/credits-bundled.spec.ts.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bundledPackages, dependencyRows } from '../../src/lib/pages/dependencies';
import { packageOfModule, shippedPackagesFile, shippedPackagesOfThisBuild, type ShippedPackage } from '../../src/lib/pages/shippedPackages';

const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');

describe('the packages a bundled module belongs to', () => {
  it('a module under node_modules belongs to the package of the last node_modules segment', () => {
    expect(packageOfModule('/r/node_modules/clsx/dist/clsx.mjs')).toEqual({ name: 'clsx', dir: '/r/node_modules/clsx' });
    expect(packageOfModule('/r/node_modules/@astrojs/svelte/client.svelte.js')).toEqual({ name: '@astrojs/svelte', dir: '/r/node_modules/@astrojs/svelte' });
    expect(packageOfModule('/r/node_modules/a/node_modules/b/index.js?v=3')).toEqual({ name: 'b', dir: '/r/node_modules/a/node_modules/b' });
    expect(packageOfModule('C:\\r\\node_modules\\nanostores\\atom\\index.js')).toEqual({ name: 'nanostores', dir: 'C:/r/node_modules/nanostores' });
  });

  it("the bundler's own modules belong to the bundler", () => {
    expect(packageOfModule('\0vite/preload-helper.js')).toEqual({ name: 'vite', dir: null });
    expect(packageOfModule('\0rolldown/runtime.js')).toEqual({ name: 'rolldown', dir: null });
  });

  it("the site's own code and the engine belong to no package", () => {
    expect(packageOfModule('/r/site/src/lib/state.ts')).toBeNull();
    expect(packageOfModule('/r/packages/engine/src/index.ts')).toBeNull();
    expect(packageOfModule('/r/site/src/components/board/ToolFrame.svelte?svelte&type=style&lang.css')).toBeNull();
  });
});

describe('credits rows for bundled packages', () => {
  const bundled: ShippedPackage[] = [
    { name: 'clsx', dir: join(root, 'node_modules', 'clsx'), chunks: ['_astro/client.x.js'], importedBy: ['svelte'], bytes: 300 },
    { name: 'vite', dir: null, chunks: ['_astro/preload-helper.x.js'], importedBy: ['the site'], bytes: 900 },
    { name: 'svelte', dir: join(root, 'node_modules', 'svelte'), chunks: ['_astro/client.x.js'], importedBy: ['@astrojs/svelte', 'the site'], bytes: 30000 },
  ];

  // regression: P4-RT-08-04
  it('a bundled package that no package.json names gets a row with its licence', () => {
    const rows = dependencyRows(root, bundled);
    const clsx = rows.find((r) => r.name === 'clsx');
    expect(clsx, 'clsx row').toBeDefined();
    expect(clsx!.licence).toBe('MIT');
    expect(clsx!.author).toMatch(/Luke Edwards/);
    expect(clsx!.shipped).toBe('its code is bundled into the scripts of the pages (imported by svelte)');
    expect(clsx!.usedIn).toEqual(['a dependency of svelte']);
    const vite = rows.find((r) => r.name === 'vite');
    expect(vite?.licence).toBe('MIT');
    expect(vite?.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(vite?.usedIn).toEqual(['added by the bundler']);
  });

  it('a package that a package.json names keeps its row and its description', () => {
    const svelte = dependencyRows(root, bundled).find((r) => r.name === 'svelte');
    expect(svelte?.shipped).toBe('the runtime of the islands');
    expect(svelte?.usedIn).toEqual(['site (dependency)']);
  });

  it('a production build without the list of bundled packages fails', () => {
    // No client build has run in this process.
    expect(shippedPackagesOfThisBuild()).toBeNull();
    expect(() => bundledPackages(true)).toThrow(/the client build recorded no list of bundled packages/);
    expect(bundledPackages(false)).toEqual([]);
  });

  it('the file of a build is kept per output directory', () => {
    const site = join(root, 'site');
    expect(shippedPackagesFile(site, join(site, 'dist'))).toBe(shippedPackagesFile(site, `${join(site, 'dist')}/`));
    expect(shippedPackagesFile(site, join(site, 'dist'))).not.toBe(shippedPackagesFile(site, join(site, 'dist-basepath')));
    expect(shippedPackagesFile(site, join(site, 'dist'))).toMatch(/\/site\/src\/generated\/shipped-packages-[0-9a-f]{12}\.json$/);
  });
});
