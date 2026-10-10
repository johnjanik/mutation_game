// P0-A4: builds one fixture of site/tests/fixtures/content/ with Astro's JavaScript API, through the
// site's own astro.config.mjs (markdown route, aliases, site and base from the environment), with
// srcDir set to the fixture and outDir to a temporary directory, and with the open-items integration
// passed inline (site/astro.config.mjs is not P0-A4's to edit). Run by content-components.test.ts:
//   node build-fixture.mjs <site dir> <fixture dir> <out dir>
// The registry is TypeScript that imports JSON, so it is loaded through Vite's runnerImport.
import { join } from 'node:path';
import { build } from 'astro';
import { runnerImport } from 'vite';

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
  await build({
    root: siteDir,
    srcDir: caseDir,
    outDir,
    logLevel: 'error',
    integrations: [registry.openItemsReportIntegration()],
  });
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(`fixture build failed: ${message}`);
  process.exit(1);
}
process.exit(0);
