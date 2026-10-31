// The site, base and output directory of SPEC.md 7.2 item 10 (CONTRACTS.md 1), read from the
// environment. site/astro.config.mjs uses and re-exports these functions; scripts/links.mjs,
// scripts/size.mjs and scripts/lab.mjs import this module directly. It is plain JavaScript with no
// import, so that plain Node of every admitted version (22.12 and later) loads it: Node strips
// TypeScript types by default only from 22.18, and astro.config.mjs imports a .ts module
// (RT-FIX P4-RT-12-03).

/**
 * An environment value counts as set only when it is a non-empty string.
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
export function given(value) {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Normalise a base path so that it begins and ends with exactly one `/`.
 * @param {string} base
 * @returns {string}
 */
export function normaliseBase(base) {
  let b = base.trim();
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b = b + '/';
  return b.replace(/\/{2,}/g, '/');
}

/**
 * The rule of SPEC.md 7.2 item 10, with SITE_URL and BASE_PATH treated independently:
 * each variable when it is set; otherwise the values that follow from GITHUB_REPOSITORY
 * (`owner/repo` gives `https://owner.github.io` and `/repo/`); otherwise `http://localhost` and `/`.
 * @param {Record<string, string | undefined>} env
 * @returns {{ site: string; base: string }}
 */
export function siteAndBase(env) {
  const siteUrl = given(env.SITE_URL);
  const basePath = given(env.BASE_PATH);
  const repository = given(env.GITHUB_REPOSITORY);
  const parts = repository && repository.includes('/') ? repository.split('/') : null;
  const owner = parts && parts[0] ? parts[0] : undefined;
  const repo = parts && parts[1] ? parts[1] : undefined;

  const site = siteUrl ?? (owner ? `https://${owner}.github.io` : 'http://localhost');
  const base = normaliseBase(basePath ?? (repo ? `/${repo}/` : '/'));
  return { site, base };
}

/**
 * The output directory: OUT_DIR when set (absolute, or relative to the site directory),
 * otherwise Astro's default `./dist`.
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function outDirFrom(env) {
  return given(env.OUT_DIR) ?? './dist';
}
