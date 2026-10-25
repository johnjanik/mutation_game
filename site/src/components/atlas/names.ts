// The typeset names of the Atlas pages (SPEC.md 7.3: "Names with a fixed spelling (boards, real forms,
// Cartan's labels) are typeset once at build time: scripts/names.mjs writes the KaTeX markup ... and the
// tools that show names (T13, T14, the board pickers) look them up there"; 6.5 display names). Owner
// P6-A4. The two files are written by scripts/names.mjs (P6-A2) at the start of every build and are not
// committed; import.meta.glob gives an empty object where they are absent (the type check and the unit
// tests run before any build), and a lookup of a missing name then throws, so a build never shows a name
// that names.mjs did not typeset. Build time only: the Atlas pages are static HTML, and the picker of
// /tools/atlas shows the plain names, as the other board pickers do.

interface Typeset {
  text: string;
  tex: string;
  html: string;
  alt?: Typeset;
}

const typeNames = import.meta.glob<{ names: Record<string, Typeset> }>('../../generated/names.json', { eager: true, import: 'default' });
const satakeNames = import.meta.glob<{ realForms: Record<string, Typeset>; cartanLabels: Record<string, Typeset>; restrictedTypes: Record<string, Typeset> }>(
  '../../generated/satake-names.json',
  { eager: true, import: 'default' },
);

const TYPES: Record<string, Typeset> = Object.values(typeNames)[0]?.names ?? {};
const REAL_FORMS: Record<string, Typeset> = Object.values(satakeNames)[0]?.realForms ?? {};
const CARTAN_LABELS: Record<string, Typeset> = Object.values(satakeNames)[0]?.cartanLabels ?? {};
const RESTRICTED_TYPES: Record<string, Typeset> = Object.values(satakeNames)[0]?.restrictedTypes ?? {};

function lookup(table: Record<string, Typeset>, key: string, file: string): Typeset {
  const t = table[key];
  if (t === undefined) throw new Error(`Atlas: ${file} has no typeset name for ${JSON.stringify(key)} (run scripts/names.mjs; request a missing name from P6-A2)`);
  return t;
}

/** KaTeX markup (with MathML) of one of the 32 type names. */
export function typeName(name: string): string {
  return lookup(TYPES, name, 'names.json').html;
}

/** KaTeX markup of a real form's display name (6.5), and of its other name where 6.5 gives one (su*(2m), also sl(m,H)). */
export function realFormName(text: string): { html: string; alt: string | null } {
  const t = lookup(REAL_FORMS, text, 'satake-names.json');
  return { html: t.html, alt: t.alt?.html ?? null };
}

/** KaTeX markup of one of Cartan's labels (A I, ..., G, compact). */
export function cartanLabelName(label: string): string {
  return lookup(CARTAN_LABELS, label, 'satake-names.json').html;
}

/** KaTeX markup of a restricted type as the catalogue displays it (6.4 restricted_type_display: C2, BC1, ...). */
export function restrictedTypeName(text: string): string {
  return lookup(RESTRICTED_TYPES, text, 'satake-names.json').html;
}
