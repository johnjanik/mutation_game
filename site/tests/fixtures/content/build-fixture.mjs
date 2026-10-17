// P0-A4: builds one fixture of site/tests/fixtures/content/ with Astro's JavaScript API, through the
// site's own astro.config.mjs (markdown route, aliases, site and base from the environment), with
// srcDir set to the fixture and outDir to a temporary directory, and with the open-items integration
// passed inline (site/astro.config.mjs is not P0-A4's to edit). Run by content-components.test.ts:
//   node build-fixture.mjs <site dir> <fixture dir> <out dir>
// The registry is TypeScript that imports JSON, so it is loaded through Vite's runnerImport.
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'astro';
import { runnerImport } from 'vite';

// One fixture build at a time per checkout (MERGE, P4 wave 4.2): every build shares the site's
// .astro/.prerender directory, and two test files (content-components and released) build fixtures
// in parallel Vitest workers, which made one build read chunks the other had just replaced
// (ERR_MODULE_NOT_FOUND). A directory created with mkdir is the lock; a lock older than ten
// minutes is taken as left behind by a killed run.
async function withBuildLock(siteDir, fn) {
  const lock = join(tmpdir(), `two-games-fixture-build-${createHash('sha256').update(siteDir).digest('hex').slice(0, 12)}`);
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (!(error && error.code === 'EEXIST')) throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 10 * 60 * 1000) rmSync(lock, { recursive: true, force: true });
      } catch {
        // the other build released the lock between the two calls
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

const [siteDir, caseDir, outDir] = process.argv.slice(2);
if (!siteDir || !caseDir || !outDir) {
  console.error('usage: node build-fixture.mjs <site dir> <fixture dir> <out dir>');
  process.exit(2);
}

try {
  const { module: registry } = await runnerImport(join(siteDir, 'src/lib/unverifiedRegistry.ts'), {
    root: siteDir,
    configFile: false,
    logLevel: 'error',
  });
  await withBuildLock(siteDir, () =>
    build({
      root: siteDir,
      srcDir: caseDir,
      outDir,
      logLevel: 'error',
      integrations: [registry.openItemsReportIntegration()],
    }),
  );
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(`fixture build failed: ${message}`);
  process.exit(1);
}
process.exit(0);
