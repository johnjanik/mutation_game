// P1-A3: the palette of SPEC.md 6.3 and 8.3, the contrast ratios quoted there (computed as
// reference/verify.py section 20 does), the edge-colour rule, the shipped tokens in both themes,
// the view icons and the theme helpers. The hex literals below are the only ones copied from the
// specification, written by hand from SPEC 6.3 and 8.3 and verify.py.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACCENTS,
  DARK,
  EDGES_DARK,
  EDGES_LIGHT,
  LIGHT,
  NUMBERS_ICON,
  POPULATIONS_ICON,
  THEME_STORAGE_KEY,
  applyTheme,
  contrastRatio,
  edgeColour,
  nextTheme,
  readStoredTheme,
  resolveTheme,
  tokenValues,
  type ThemeProperty,
} from '../../src/components/draw/palette';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8');

/** The `--name: value;` declarations of a CSS fragment. */
function declarations(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

/** The three token blocks of a stylesheet: light :root, the dark media block, the manual dark switch. */
function tokenBlocks(withComments: string): { light: string; media: string; manual: string } {
  const css = withComments.replace(/\/\*[\s\S]*?\*\//g, '');
  const lightStart = css.indexOf(':root {');
  const mediaStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const manualStart = css.indexOf(':root[data-theme="dark"]');
  const manualEnd = css.indexOf('}', manualStart);
  return { light: css.slice(lightStart, mediaStart), media: css.slice(mediaStart, manualStart), manual: css.slice(manualStart, manualEnd) };
}

describe('palette of SPEC 6.3 and 8.3', () => {
  it('palette values equal the tables of 6.3 and 8.3', () => {
    expect(EDGES_LIGHT).toEqual(['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#B26F00', '#3A8FCB', '#807500', '#1A1A1A']);
    expect(EDGES_DARK).toEqual(['#56B4E9', '#FF8A4C', '#2DBE95', '#CC79A7', '#E69F00', '#6FA8FF', '#F0E442', '#E8E8E8']);
    const signLight: Partial<Record<ThemeProperty, string>> = {
      '--page': '#FFFFFF',
      '--text': '#1A1A1A',
      '--sign-pos-fill': '#0072B2',
      '--sign-pos-numeral': '#FFFFFF',
      '--sign-neg-outline': '#D55E00',
      '--sign-zero-outline': '#767676',
    };
    const signDark: Partial<Record<ThemeProperty, string>> = {
      '--page': '#121212',
      '--text': '#E8E8E8',
      '--sign-pos-fill': '#56B4E9',
      '--sign-pos-numeral': '#121212',
      '--sign-neg-outline': '#E69F00',
      '--sign-zero-outline': '#8A8A8A',
    };
    expect(LIGHT).toMatchObject(signLight);
    expect(DARK).toMatchObject(signDark);
    for (const k of Object.keys(signLight) as ThemeProperty[]) {
      expect(LIGHT[k], k).toBe(signLight[k]);
      expect(DARK[k], k).toBe(signDark[k]);
    }
    expect(ACCENTS.light).toEqual({ populations: '#009E73', numbers: '#CC79A7' });
    expect(ACCENTS.dark).toEqual({ populations: '#009E73', numbers: '#CC79A7' });
  });

  it('the quoted ratios of 6.3 and 8.3 are the WCAG values to one decimal', () => {
    // [foreground, background, quoted text, threshold], in the order of verify.py's QUOTED.
    const quoted: [string, string, string, number][] = [
      [LIGHT['--sign-pos-fill'], LIGHT['--sign-pos-numeral'], '5.2', 4.5],
      [LIGHT['--sign-neg-outline'], LIGHT['--page'], '3.9', 3],
      [LIGHT['--sign-zero-outline'], LIGHT['--page'], '4.5', 3],
      [DARK['--sign-pos-fill'], DARK['--sign-pos-numeral'], '8.1', 4.5],
      [DARK['--sign-neg-outline'], DARK['--page'], '8.3', 3],
      [DARK['--sign-zero-outline'], DARK['--page'], '5.4', 3],
      [ACCENTS.light.populations, LIGHT['--page'], '3.4', 3],
      [ACCENTS.light.numbers, LIGHT['--page'], '3.1', 3],
      [ACCENTS.dark.populations, DARK['--page'], '5.5', 3],
      [ACCENTS.dark.numbers, DARK['--page'], '6.1', 3],
    ];
    for (const [a, b, text, need] of quoted) {
      const r = contrastRatio(a, b);
      expect(r.toFixed(1), `${a} on ${b}`).toBe(text);
      expect(r, `${a} on ${b}`).toBeGreaterThanOrEqual(need);
      expect(contrastRatio(b, a)).toBe(r);
    }
  });

  it('text colours give 17.4 and 15.3', () => {
    expect(contrastRatio(LIGHT['--text'], LIGHT['--page']).toFixed(1)).toBe('17.4');
    expect(contrastRatio(DARK['--text'], DARK['--page']).toFixed(1)).toBe('15.3');
  });

  it('the eight edge colours of each theme give at least 3 to 1 and are distinct', () => {
    for (const [edges, page] of [[EDGES_LIGHT, LIGHT['--page']], [EDGES_DARK, DARK['--page']]] as const) {
      expect(edges).toHaveLength(8);
      expect(new Set(edges.map((c) => c.toUpperCase())).size).toBe(8);
      for (const c of edges) expect(contrastRatio(c, page), c).toBeGreaterThanOrEqual(3);
    }
    // The textbook Okabe-Ito orange as light colour 5 would fail the table (it is below 3 to 1).
    expect(contrastRatio('#E69F00', '#FFFFFF')).toBeLessThan(3);
  });

  it('tokens.css equals palette.ts in both themes', () => {
    const css = read('site/src/styles/tokens.css');
    const blocks = tokenBlocks(css);
    expect(css).toContain(':root:not([data-theme="light"])');
    expect(declarations(blocks.light)).toEqual(tokenValues('light'));
    expect(declarations(blocks.media)).toEqual(tokenValues('dark'));
    expect(declarations(blocks.manual)).toEqual(tokenValues('dark'));
    const names = ['--page', '--text', '--sign-pos-fill', '--sign-pos-numeral', '--sign-neg-outline', '--sign-zero-outline', ...Array.from({ length: 8 }, (_, k) => `--edge-${k + 1}`), '--accent-populations', '--accent-numbers', '--focus-ring', '--road', '--arrow'];
    expect(Object.keys(tokenValues('light')).sort()).toEqual([...names].sort());
    // base.css imports tokens.css first, and every token value it still repeats is the same.
    const base = read('site/src/styles/base.css');
    expect(base.replace(/\/\*[\s\S]*?\*\//g, '').trimStart().startsWith("@import './tokens.css';")).toBe(true);
    const baseBlocks = tokenBlocks(base);
    for (const [name, value] of Object.entries(declarations(baseBlocks.light))) {
      if (name.startsWith('--font')) continue;
      expect(value, `base.css light ${name}`).toBe(tokenValues('light')[name]);
    }
    for (const block of [baseBlocks.media, baseBlocks.manual]) {
      for (const [name, value] of Object.entries(declarations(block))) expect(value, `base.css dark ${name}`).toBe(tokenValues('dark')[name]);
    }
    // The two font stacks and the reduced-motion rule stay in base.css.
    expect(base).toContain('--font-prose:');
    expect(base).toContain('--font-numerals:');
    expect(base).toContain('tabular-nums');
    expect(base).toContain('prefers-reduced-motion: reduce');
  });

  it('focus ring, roads and arrows give at least 3 to 1 and numerals at least 4.5 in both themes', () => {
    for (const theme of [LIGHT, DARK]) {
      for (const k of ['--focus-ring', '--road', '--arrow', '--sign-neg-outline', '--sign-zero-outline'] as const) {
        expect(contrastRatio(theme[k], theme['--page']), k).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(theme['--sign-pos-fill'], theme['--page'])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme['--text'], theme['--page'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme['--sign-pos-numeral'], theme['--sign-pos-fill'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('edge colour for label k', () => {
    for (let k = 1; k <= 8; k++) expect(edgeColour(k)).toBe(`var(--edge-${k})`);
    expect(edgeColour(0)).toBe('var(--edge-8)');
    expect([9, 10, 11, 12].map(edgeColour)).toEqual(['var(--edge-1)', 'var(--edge-2)', 'var(--edge-3)', 'var(--edge-4)']);
    expect(() => edgeColour(-1)).toThrow(RangeError);
    expect(() => edgeColour(1.5)).toThrow(RangeError);
  });

  it('the two accents are distinct and differ from every sign colour', () => {
    expect(ACCENTS.light.populations.toUpperCase()).not.toBe(ACCENTS.light.numbers.toUpperCase());
    expect(ACCENTS.dark).toEqual(ACCENTS.light);
    const signs = (['--sign-pos-fill', '--sign-pos-numeral', '--sign-neg-outline', '--sign-zero-outline'] as const).flatMap((k) => [LIGHT[k], DARK[k]]).map((c) => c.toUpperCase());
    for (const a of [ACCENTS.light.populations, ACCENTS.light.numbers]) expect(signs).not.toContain(a.toUpperCase());
  });

  it('the two view icons are exported with a viewBox in their accent', () => {
    for (const [icon, accent] of [[POPULATIONS_ICON, 'var(--accent-populations)'], [NUMBERS_ICON, 'var(--accent-numbers)']] as const) {
      expect(icon.viewBox).toMatch(/^\d+ \d+ \d+ \d+$/);
      expect(icon.d).toMatch(/^M/);
      expect(icon.d.length).toBeGreaterThan(10);
      expect(icon.stroke).toBe(accent);
      expect(JSON.stringify(icon)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
    expect(POPULATIONS_ICON.d).not.toBe(NUMBERS_ICON.d);
  });

  it('theme helpers follow the stored choice, else the system', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('sepia', true)).toBe('dark');
    expect(resolveTheme('sepia', false)).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });

  it('applyTheme sets data-theme and stores the choice, and survives a throwing storage', () => {
    const attrs: Record<string, string> = {};
    const root = { setAttribute: (n: string, v: string) => void (attrs[n] = v) };
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readStoredTheme(storage)).toBeNull();
    applyTheme('dark', root, storage);
    expect(attrs['data-theme']).toBe('dark');
    expect(store.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(THEME_STORAGE_KEY).toBe('theme');
    expect(readStoredTheme(storage)).toBe('dark');
    applyTheme('light', root, storage);
    expect(attrs['data-theme']).toBe('light');
    expect(readStoredTheme(storage)).toBe('light');

    const throwing = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
      setItem: (): void => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(readStoredTheme(throwing)).toBeNull();
    expect(() => applyTheme('dark', root, throwing)).not.toThrow();
    expect(attrs['data-theme']).toBe('dark');
    expect(readStoredTheme(null)).toBeNull();
    expect(() => applyTheme('light', root, null)).not.toThrow();
    expect(attrs['data-theme']).toBe('light');
  });

  it('ThemeSwitch calls the helpers with the document root and localStorage, disabled until hydration', () => {
    // The root Vitest configuration does not compile .svelte files (no Svelte plugin in the
    // site-unit project), so the server render cannot be run here; this reads the source instead.
    const src = read('site/src/components/ThemeSwitch.svelte');
    expect(src).toContain('readStoredTheme(storage())');
    expect(src).toContain('applyTheme(theme, document.documentElement, storage())');
    expect(src).toMatch(/disabled=\{!hydrated\}/);
    expect(src).toMatch(/aria-pressed=\{theme === 'dark'\}/);
    expect(src).toMatch(/min-width: 44px;[\s\S]*min-height: 44px;/);
    expect(src).not.toMatch(/@engine|@two-games\/engine/);
    expect(src).not.toMatch(/export let|on:click|\$:/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
