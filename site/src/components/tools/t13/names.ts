// T13: the names of real forms on screen (SPEC.md 6.5, 7.3, 7.5 A-12). Owner P6-A3. The typeset name (KaTeX's
// markup with MathML) comes from satake-names.json through satakeNames.ts: in-process during server rendering,
// and in the browser only after the reader's first change (loadNames), because the section weighs about 5 kB
// gzipped and SPEC 7.6 counts every script a route fetches before the first interaction (decisions/P6-A3.md).
// Until it has loaded, or where the file is absent (unit tests), a name is written in plain markup: the letters
// of the algebra in Unicode's mathematical fraktur, R and H as double-struck capitals, the subscript of an
// exceptional algebra with <sub>. Hydration keeps the server's markup ({@html} adopts it), so the first view is
// always the typeset one. KaTeX itself is never sent to the reader.
import type { NameEntry } from './satakeNames';

let realForms: Readonly<Record<string, NameEntry>> | null = import.meta.env.SSR ? (await import('./satakeNames')).REAL_FORMS : null;
let loading: Promise<void> | null = null;

/** Loads the typeset names once (the browser, after the reader's first change); resolves when they are there. */
export function loadNames(): Promise<void> {
  if (realForms !== null) return Promise.resolve();
  loading ??= import('./satakeNames').then((m) => {
    realForms = m.REAL_FORMS;
  });
  return loading;
}

/** Whether the typeset names are available. */
export function namesLoaded(): boolean {
  return realForms !== null;
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
  return realForms?.[name]?.html ?? fallbackHtml(name);
}

/** The second name of su*(2m), sl(m,H) (SPEC 6.5), as markup, or null. */
export function realFormAltHtml(name: string): string | null {
  const alt = realForms?.[name]?.alt;
  if (alt !== undefined) return alt.html;
  const m = /^su\*\((\d+)\)$/.exec(name);
  return m === null ? null : fallbackHtml(`sl(${Number(m[1]) / 2},H)`);
}
