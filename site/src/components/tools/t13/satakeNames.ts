// T13: the typeset real-form names of site/src/generated/satake-names.json (SPEC.md 7.3: names with a fixed
// spelling are typeset once at build time by scripts/names.mjs; 6.5). Owner P6-A3. Only the section the Studio
// shows is imported (realForms; decisions/P6-A2.md, the repair entries). The file is written at the start of
// every build and is not committed; import.meta.glob gives an empty object where it is absent (unit tests and
// the type check run before any build). Imported in-process during server rendering only; the browser loads the
// names of one board at a time from satake-names/<board>.json (t13/names.ts), so that the route's first scripts
// stay within SPEC 7.6's 90 kB.

/** A real form's name as names.mjs writes it: the plain text, KaTeX's markup with MathML, and for su*(2m) its second name. */
export interface NameEntry {
  text: string;
  html: string;
  alt?: { text: string; html: string };
}

const files = import.meta.glob<Record<string, NameEntry>>('../../../generated/satake-names.json', {
  eager: true,
  import: 'realForms',
});

/** real form (data spelling) -> its typeset name; empty when satake-names.json does not exist. */
export const REAL_FORMS: Readonly<Record<string, NameEntry>> = Object.values(files)[0] ?? {};
