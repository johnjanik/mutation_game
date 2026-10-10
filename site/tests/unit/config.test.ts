// SPEC.md 7.2 item 10 and CONTRACTS.md 1: site and base from the environment; OUT_DIR honoured.
import { describe, expect, it, vi } from 'vitest';
import { siteAndBase, normaliseBase, outDirFrom } from '../../astro.config.mjs';

describe('site and base from the environment', () => {
  it('derives the Pages address from GITHUB_REPOSITORY', () => {
    expect(siteAndBase({ GITHUB_REPOSITORY: 'owner/repo' })).toEqual({ site: 'https://owner.github.io', base: '/repo/' });
  });

  it('falls back to localhost and the root', () => {
    expect(siteAndBase({})).toEqual({ site: 'http://localhost', base: '/' });
  });

  it('takes SITE_URL and BASE_PATH as given', () => {
    expect(siteAndBase({ SITE_URL: 'https://example.org', BASE_PATH: '/sub/path/' })).toEqual({ site: 'https://example.org', base: '/sub/path/' });
  });

  it('treats the two variables independently', () => {
    expect(siteAndBase({ BASE_PATH: '/sub/path/' })).toEqual({ site: 'http://localhost', base: '/sub/path/' });
    expect(siteAndBase({ BASE_PATH: '/sub/path/', GITHUB_REPOSITORY: 'owner/repo' })).toEqual({ site: 'https://owner.github.io', base: '/sub/path/' });
    expect(siteAndBase({ SITE_URL: 'https://example.org', GITHUB_REPOSITORY: 'owner/repo' })).toEqual({ site: 'https://example.org', base: '/repo/' });
  });

  it('counts an empty string as unset', () => {
    expect(siteAndBase({ SITE_URL: '', BASE_PATH: '', GITHUB_REPOSITORY: '' })).toEqual({ site: 'http://localhost', base: '/' });
    expect(siteAndBase({ SITE_URL: '', BASE_PATH: '', GITHUB_REPOSITORY: 'owner/repo' })).toEqual({ site: 'https://owner.github.io', base: '/repo/' });
  });

  it('normalises the base to begin and end with a slash', () => {
    expect(normaliseBase('repo')).toBe('/repo/');
    expect(normaliseBase('/repo')).toBe('/repo/');
    expect(normaliseBase('repo/')).toBe('/repo/');
    expect(normaliseBase('/')).toBe('/');
    expect(siteAndBase({ BASE_PATH: 'sub/path' }).base).toBe('/sub/path/');
  });
});

describe('OUT_DIR honoured', () => {
  it('uses OUT_DIR when set and the default dist otherwise', async () => {
    expect(outDirFrom({ OUT_DIR: '/tmp/somewhere' })).toBe('/tmp/somewhere');
    expect(outDirFrom({ OUT_DIR: '' })).toBe('./dist');
    expect(outDirFrom({})).toBe('./dist');

    const previous = process.env.OUT_DIR;
    try {
      process.env.OUT_DIR = '/tmp/out-dir-test';
      vi.resetModules();
      const withOutDir = (await import('../../astro.config.mjs')).default;
      expect(withOutDir.outDir).toBe('/tmp/out-dir-test');

      delete process.env.OUT_DIR;
      vi.resetModules();
      const withoutOutDir = (await import('../../astro.config.mjs')).default;
      expect(withoutOutDir.outDir).toBe('./dist');
    } finally {
      if (previous === undefined) delete process.env.OUT_DIR;
      else process.env.OUT_DIR = previous;
      vi.resetModules();
    }
  });
});
