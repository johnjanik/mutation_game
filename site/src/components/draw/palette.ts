// The colours of SPEC.md 6.3 and 8.3 as plain data, the WCAG contrast ratio, the edge-colour rule,
// the two view icons and the theme helpers. This is the one TypeScript file that holds hex
// literals: components use the custom properties of site/src/styles/tokens.css, which carry the
// same values (a unit test keeps the two equal). The values for --focus-ring, --road and --arrow
// are P0-A1's choice (decisions/P0-A1.md); the rest are the tables of 6.3 and 8.3.
// Nothing here touches the DOM; ThemeSwitch.svelte passes the root element and the storage in.

/** The custom properties of CONTRACTS.md 8 that hold one colour per theme (edges and accents apart). */
export type ThemeProperty =
  | '--page'
  | '--text'
  | '--sign-pos-fill'
  | '--sign-pos-numeral'
  | '--sign-neg-outline'
  | '--sign-zero-outline'
  | '--focus-ring'
  | '--road'
  | '--arrow';

export type Theme = 'light' | 'dark';

/** Light theme: the sign table of 6.3 with page and text, plus P0-A1's focus ring, road and arrow. */
export const LIGHT: Readonly<Record<ThemeProperty, string>> = {
  '--page': '#FFFFFF',
  '--text': '#1A1A1A',
  '--sign-pos-fill': '#0072B2',
  '--sign-pos-numeral': '#FFFFFF',
  '--sign-neg-outline': '#D55E00',
  '--sign-zero-outline': '#767676',
  '--focus-ring': '#0072B2',
  '--road': '#1A1A1A',
  '--arrow': '#1A1A1A',
};

/** Dark theme, as LIGHT. */
export const DARK: Readonly<Record<ThemeProperty, string>> = {
  '--page': '#121212',
  '--text': '#E8E8E8',
  '--sign-pos-fill': '#56B4E9',
  '--sign-pos-numeral': '#121212',
  '--sign-neg-outline': '#E69F00',
  '--sign-zero-outline': '#8A8A8A',
  '--focus-ring': '#56B4E9',
  '--road': '#E8E8E8',
  '--arrow': '#E8E8E8',
};

/** The edge palette of eight, light theme (6.3): Okabe-Ito with orange, sky blue and yellow darkened. */
export const EDGES_LIGHT: readonly string[] = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#B26F00', '#3A8FCB', '#807500', '#1A1A1A'];

/** The edge palette of eight, dark theme (6.3). */
export const EDGES_DARK: readonly string[] = ['#56B4E9', '#FF8A4C', '#2DBE95', '#CC79A7', '#E69F00', '#6FA8FF', '#F0E442', '#E8E8E8'];

/** The two view accents (8.3), the same in both themes. Borders, icons and underlines only. */
export const ACCENTS: Readonly<Record<Theme, { populations: string; numbers: string }>> = {
  light: { populations: '#009E73', numbers: '#CC79A7' },
  dark: { populations: '#009E73', numbers: '#CC79A7' },
};

/** Every custom property of CONTRACTS.md 8 with its value in one theme, as tokens.css declares them. */
export function tokenValues(theme: Theme): Record<string, string> {
  const base = theme === 'light' ? LIGHT : DARK;
  const edges = theme === 'light' ? EDGES_LIGHT : EDGES_DARK;
  const out: Record<string, string> = { ...base };
  edges.forEach((c, k) => {
    out[`--edge-${k + 1}`] = c;
  });
  out['--accent-populations'] = ACCENTS[theme].populations;
  out['--accent-numbers'] = ACCENTS[theme].numbers;
  return out;
}

/** Relative luminance exactly as reference/verify.py `_lum` (WCAG 2, threshold 0.03928). */
export function luminance(hex: string): number {
  const h = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new RangeError(`not a colour: ${hex}`);
  const lin = [0, 2, 4].map((k) => {
    const c = parseInt(h.slice(k, k + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

/** The WCAG contrast ratio of two colours, as reference/verify.py `contrast`. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The colour of an orbit-graph edge made by the node with this label (6.3): label k takes colour k
 * for k = 1..8, label 0 takes colour 8, labels 9 to 12 take colours 1 to 4. Keyed by label, never
 * by position. Colour is never the only cue (A-5): the tool that draws the edge also writes the
 * node label beside it as text (T2, T8); this function supplies the colour only.
 */
export function edgeColour(label: number): string {
  if (!Number.isInteger(label) || label < 0) throw new RangeError(`not a label: ${label}`);
  const c = label === 0 ? 8 : ((label - 1) % 8) + 1;
  return `var(--edge-${c})`;
}

/** A view icon (8.3): SVG path data in a viewBox, stroked in the view's accent; decorative. */
export interface ViewIcon {
  viewBox: string;
  d: string;
  stroke: string;
  fill: string;
}

/** "A small city" for Populations: three buildings on a ground line. */
export const POPULATIONS_ICON: ViewIcon = {
  viewBox: '0 0 16 16',
  d: 'M1.5 14.5V8.5h3.5v6M5 14.5V3.5h5v11M10 14.5V6.5h4.5v8M0.5 14.5h15M7 6h1M7 9h1M12 9h1',
  stroke: 'var(--accent-populations)',
  fill: 'none',
};

/** "A small numbered disc" for Numbers: a circle with the numeral 1 in it. */
export const NUMBERS_ICON: ViewIcon = {
  viewBox: '0 0 16 16',
  d: 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13ZM6.5 5.75L8.25 4.5v7M6.5 11.5h3.5',
  stroke: 'var(--accent-numbers)',
  fill: 'none',
};

/** The localStorage key of the manual theme choice (plan). */
export const THEME_STORAGE_KEY = 'theme';

function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark';
}

/** The theme in force: the stored choice when it is one of the two, else the system's preference. */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? 'dark' : 'light';
}

/** The other theme. */
export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

/** The stored choice, or null when nothing is stored or storage is unavailable or throws. */
export function readStoredTheme(storage: Pick<Storage, 'getItem'> | null): string | null {
  if (storage === null) return null;
  try {
    return storage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Sets data-theme on the root and stores the choice; a storage that throws is ignored. */
export function applyTheme(
  theme: Theme,
  root: { setAttribute(name: string, value: string): void },
  storage: Pick<Storage, 'setItem'> | null,
): void {
  root.setAttribute('data-theme', theme);
  if (storage === null) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private modes may refuse storage; the page keeps the theme until it is reloaded.
  }
}
