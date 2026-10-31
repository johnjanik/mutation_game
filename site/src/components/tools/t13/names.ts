// T13: the names of real forms on screen (SPEC.md 6.5, 7.3, 7.5 A-12). Owner P6-A3. The typeset name (KaTeX's
// markup with MathML) comes from satake-names.json through satakeNames.ts in-process during server rendering, and
// in the browser from the file of one board, site/src/generated/satake-names/<board>.json (scripts/names.mjs),
// loaded by loadNames(board) when the Studio shows a pair the server did not render: a link state while the
// island hydrates, or the reader's change. One board's names weigh under 1 kB gzipped, so that a link state
// stays within SPEC 7.6's 90 kB (RT-FIX P6-MERGE-T13-01; the whole section, about 5 kB, did not fit).
// Until they have loaded, or where the files are absent (unit tests), a name is written in plain markup: the
// letters of the algebra in Unicode's mathematical fraktur, R and H as double-struck capitals, the subscript of
// an exceptional algebra with <sub>. Hydration keeps the server's markup ({@html} adopts it), so the default
// state's first view is the typeset one. KaTeX itself is never sent to the reader.
import type { NameEntry } from './satakeNames';

/** The typeset names known here: all of them during server rendering; in the browser, those of the boards loaded. */
const realForms: Record<string, NameEntry> = import.meta.env.SSR ? { ...(await import('./satakeNames')).REAL_FORMS } : {};
/** One lazily loaded chunk per board in the browser; empty where the files do not exist. */
const byBoard = import.meta.env.SSR
  ? {}
  : import.meta.glob<Record<string, NameEntry>>('../../../generated/satake-names/*.json', { import: 'realForms' });
const loading = new Map<string, Promise<void>>();

/** Loads the typeset names of one board once; resolves when they are there (at once during server rendering). */
export function loadNames(board: string): Promise<void> {
  let p = loading.get(board);
  if (p === undefined) {
    const load = byBoard[`../../../generated/satake-names/${board}.json`];
    p = load === undefined ? Promise.resolve() : load().then((forms) => void Object.assign(realForms, forms));
    loading.set(board, p);
  }
  return p;
}

const FRAKTUR_A = 0x1d51e;

function fraktur(letters: string): string {
  return [...letters].map((c) => (c >= 'a' && c <= 'z' ? String.fromCodePoint(FRAKTUR_A + c.charCodeAt(0) - 97) : c)).join('');
}

/** The plain markup of a real form's data spelling: su(1,3), su*(4), sl(4,R), e6(-14). */
export function fallbackHtml(name: string): string {
  const m = /^([a-z]+)(\d?)(\*?)\(([-0-9,RH]*)\)$/.exec(name);
  if (m === null) return name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const [, letters, digit, star, args] = m as unknown as [string, string, string, string, string];
  const inner = args.replace(/-/g, '−').replace(/R/g, 'ℝ').replace(/H/g, 'ℍ').replace(/,/g, ', ');
  if (digit !== '') return `<span class="name-plain">${fraktur(letters)}<sub>${digit}(${inner})</sub></span>`;
  return `<span class="name-plain">${fraktur(letters)}${star ? '<sup>*</sup>' : ''}(${inner})</span>`;
}

/** The markup of a real form's name: KaTeX's when loaded, the plain markup otherwise. */
export function realFormHtml(name: string): string {
  return realForms[name]?.html ?? fallbackHtml(name);
}

/** The second name of su*(2m), sl(m,H) (SPEC 6.5), as markup, or null. */
export function realFormAltHtml(name: string): string | null {
  const alt = realForms[name]?.alt;
  if (alt !== undefined) return alt.html;
  const m = /^su\*\((\d+)\)$/.exec(name);
  return m === null ? null : fallbackHtml(`sl(${Number(m[1]) / 2},H)`);
}
