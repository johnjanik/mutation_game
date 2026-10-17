// T10, the Geometry Studio: names shown with mathematics (SPEC.md 7.5 A-12; 7.3 "Mathematics produced while
// a tool runs"; Appendix E items 7 and 9; 5.7 rule 6). Owner P4-A3.
//
// Board names have a fixed spelling: their KaTeX markup (which carries MathML) comes from
// site/src/generated/names.json, written by scripts/names.mjs at the start of every build (7.3). The file
// is not committed and does not exist before a build (the unit tests and the type check run first in CI),
// so it is read through import.meta.glob, which gives an empty object when the file is absent; then the
// name is written as plain MathML (<msub>), the way T4 and T16 write theirs. KaTeX itself is never
// imported here (7.6; RT-07).
//
// Polytope names are shown only for the 26 records of the golden key `wythoff`, taken from their `name`
// fields (documentation, rule 6) into the table below, keyed by type and rings; every other configuration
// gets no name, and the name "rectified 4_21" of Appendix E item 9 never appears (it is not in the table).
// A name such as 4_21 is never shown as raw text: it becomes MathML (<msub><mn>4</mn><mn>21</mn></msub>).
// Text that cannot hold markup (an aria-label, the live region, the canvas, the export footer) uses plain
// words and digits: "E8", "polytope 4 21".

const namesFiles = import.meta.glob<{ names: Record<string, { text: string; tex: string; html: string }> }>('../../../generated/names.json', {
  eager: true,
  import: 'default',
});
const NAMES: Record<string, { html: string }> = Object.values(namesFiles)[0]?.names ?? {};

/** The 26 polytope names of golden `wythoff`, keyed `<type>:<rings joined by '.'>` (unit test: equal to the file). */
export const POLYTOPE_NAMES: Readonly<Record<string, string>> = {
  'A3:1.0.0': 'tetrahedron',
  'A3:0.1.0': 'octahedron',
  'A3:1.0.1': 'cuboctahedron',
  'A3:1.1.0': 'truncated tetrahedron',
  'A3:1.1.1': 'truncated octahedron (permutohedron)',
  'B3:1.0.0': 'octahedron',
  'B3:0.0.1': 'cube',
  'B3:0.1.0': 'cuboctahedron',
  'B3:1.1.0': 'truncated octahedron',
  'B3:0.1.1': 'truncated cube',
  'B3:1.0.1': 'rhombicuboctahedron',
  'B3:1.1.1': 'truncated cuboctahedron',
  'A4:1.0.0.0': '5-cell',
  'B4:0.0.0.1': 'tesseract',
  'B4:1.0.0.0': '16-cell',
  'D4:1.0.0.0': '16-cell',
  'D4:0.1.0.0': '24-cell (D4 root polytope)',
  'F4:1.0.0.0': '24-cell',
  'F4:0.0.0.1': '24-cell',
  'E6:1.0.0.0.0.0': '2_21',
  'E6:0.1.0.0.0.0': '1_22 (E6 root polytope)',
  'E7:0.0.0.0.0.0.1': '3_21',
  'E7:1.0.0.0.0.0.0': '2_31 (E7 root polytope)',
  'E8:0.0.0.0.0.0.0.1': '4_21 (E8 root polytope)',
  'E8:1.0.0.0.0.0.0.0': '2_41',
  'E8:0.1.0.0.0.0.0.0': '1_42',
};

/** The golden name of a configuration (rings in label order), or null. */
export function polytopeName(board: string, rings: readonly number[]): string | null {
  return POLYTOPE_NAMES[`${board}:${rings.join('.')}`] ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const FINITE = /^([A-G])([1-9][0-9]*)$/;

/** Plain MathML of a finite board name: E8 as E with subscript 8. */
export function boardMathML(name: string): string {
  const m = FINITE.exec(name);
  if (m === null) return escapeHtml(name);
  return `<math display="inline"><msub><mi>${m[1]}</mi><mn>${m[2]}</mn></msub></math>`;
}

/** The markup of a board name: KaTeX's (with MathML) from names.json, else plain MathML. */
export function boardNameHtml(name: string): string {
  return NAMES[name]?.html ?? boardMathML(name);
}

/** True when the KaTeX markup of names.json was found (build time and the built site). */
export function namesJsonLoaded(): boolean {
  return Object.keys(NAMES).length > 0;
}

/**
 * The markup of a polytope name: each symbol p_qr becomes MathML with a subscript, each board name a
 * board name (names.json or MathML), the rest is escaped text.
 */
export function polytopeNameHtml(name: string): string {
  return name
    .split(/(\b\d_\d+\b|\b[A-G][1-9]\b)/)
    .map((part) => {
      const sym = /^(\d)_(\d+)$/.exec(part);
      if (sym !== null) return `<math display="inline"><msub><mn>${sym[1]}</mn><mn>${sym[2]}</mn></msub></math>`;
      if (FINITE.test(part)) return boardNameHtml(part);
      return escapeHtml(part);
    })
    .join('');
}

/** A polytope name in plain words for text without markup: "4_21 (E8 root polytope)" reads "polytope 4 21 (E8 root polytope)". */
export function polytopeNamePlain(name: string): string {
  const spaced = name.replace(/\b(\d)_(\d+)\b/g, '$1 $2');
  return /^\d \d+/.test(spaced) ? `polytope ${spaced}` : spaced;
}
