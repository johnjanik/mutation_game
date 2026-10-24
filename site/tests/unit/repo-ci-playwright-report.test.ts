// ci.yml's "Upload the Playwright report" step and the reporters of playwright.config.ts under CI,
// adopted from the red team (RT-12 attack 21, redteam/rt12/ci-reporter.mjs). Only Playwright's html
// reporter writes playwright-report/; under CI the configuration's only reporter was 'github', which
// writes no file, so the upload step of a failing CI run could never upload anything.
// The configuration reads process.env.CI when it is loaded, so it is loaded in a child Node process
// (Node 22 strips the types of playwright.config.ts) with CI set, as the reproducer did.
// Run: npx vitest run --project site-unit site/tests/unit/repo-ci-playwright-report.test.ts
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../../..');

type Reporter = [string, Record<string, unknown> | undefined];

/** The reporters of playwright.config.ts as loaded with the given CI value, each as [name, options]. */
function reportersUnder(ci: string | undefined): Reporter[] {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('VITEST')) env[k] = v;
  delete env.CI;
  if (ci !== undefined) env.CI = ci;
  const config = pathToFileURL(join(ROOT, 'playwright.config.ts')).href;
  const code = `const c = (await import(${JSON.stringify(config)})).default; console.log(JSON.stringify(c.reporter ?? null));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env, cwd: ROOT });
  expect(r.status, r.stderr).toBe(0);
  const raw = JSON.parse(r.stdout.trim().split('\n').at(-1)!) as string | (string | [string, Record<string, unknown>?])[] | null;
  const list = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
  return list.map((x) => (Array.isArray(x) ? [x[0], x[1]] : [x, undefined]));
}

describe('the Playwright report of a CI run', () => {
  // regression: P3-RT-12-07
  it('under CI a reporter writes the playwright-report folder that ci.yml uploads', () => {
    const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
    const upload = /- name: Upload the Playwright report[\s\S]*?\n\s+path:\s*(\S+)/.exec(ci);
    expect(upload, 'ci.yml has an upload step for the Playwright report').not.toBeNull();
    const reporters = reportersUnder('true');
    expect(reporters.map(([name]) => name)).toContain('github');
    const html = reporters.find(([name]) => name === 'html');
    expect(html, `reporters under CI: ${JSON.stringify(reporters)}`).toBeDefined();
    // The html reporter writes playwright-report/ beside the configuration unless told otherwise.
    expect(html![1]?.outputFolder ?? 'playwright-report').toBe(upload![1]);
    expect(html![1]?.open).toBe('never');
  });
});
