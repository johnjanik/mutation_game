// The three downloads of an Atlas page (SPEC.md 4 T14 "Downloads: JSON, CSV, LaTeX"; 4.0 "Share and
// export", "Long numbers": every export keeps the exact digits; 6.6 "Data export"; 6.7). Owner P6-A4.
// Pure text from the sheet of atlasData; build time only (the page offers each file as a data URI, so
// that the downloads work without JavaScript).
//
// JSON: exportJSON (P1-A2) of the Atlas state { schema: 1, tool: 'atlas', board } with the sheet's values
// as `derived` (labels; integers as JSON numbers when safe, else decimal strings; engine version and
// commit added by exportJSON).
// CSV (format plan, recorded in decisions/P6-A4.md): UTF-8, the header `item,label,value`, then one row
// per scalar item (empty label) and one row per entry of each vector or matrix row. The label is the node
// label for a vector indexed by nodes (0 first on the affine board), the row's node for a matrix, and the
// 1-based index for a list (positive roots, exponents, minuscule nodes, rings, real forms). A value that
// holds a comma or a quote is quoted, quotes doubled; a list is written with commas. Integers in full.
// LaTeX (content plan): latexFile (P6-A5) with the page's link, then the \dynkin line that exportLaTeX
// returns for the board (no black node, the identity tau), then one line per real form, its \dynkin line
// followed by a comment with Cartan's label and the plain-text name, as in the examples of SPEC 6.7.
import type { Rational } from '@two-games/engine';
import { exportJSON, exportLaTeX, latexFile } from '../../lib/export';
import { defaultState } from '../../lib/state';
import type { AtlasSheet } from './atlasData';

/** The number of comment lines latexFile writes before the body. */
export const LATEX_HEADER = 2;

/** An integer for JSON: a number when safe, its decimal digits otherwise (6.6). */
function jsonInteger(x: number | bigint): number | string {
  const big = BigInt(x);
  const n = Number(big);
  return Number.isSafeInteger(n) && BigInt(n) === big ? n : big.toString();
}

/** A rational as JSON: the integer when the denominator is 1, else "p/q" (rule 4's text). */
function jsonRational(r: Rational): number | string {
  return r.den === 1n ? jsonInteger(r.num) : `${r.num.toString()}/${r.den.toString()}`;
}

/**
 * The values of the sheet for the JSON export, keyed by the names of the golden file where one exists
 * (Appendix G), every node a label, every integer as exportJSON writes it. Null marks an item the page
 * does not show as a value (no highest short root, the count above the cap, no Coxeter plane).
 */
export function atlasDerived(s: AtlasSheet): Record<string, unknown> {
  return {
    board: s.name,
    labels: [...s.labels],
    cartan: s.cartan.map((r) => [...r]),
    cartan_transposed: s.cartanTransposed.map((r) => [...r]),
    adjacency: s.adjacency.map((r) => [...r]),
    symmetrizer: s.symmetrizer.map(jsonRational),
    n_roots: s.nRoots,
    n_positive_roots: s.nPositiveRoots,
    positive_roots: s.positiveRoots.map((r) => [...r]),
    highest_root: [...s.highestRoot],
    numbers_of_highest_root: [...s.numbersOfHighestRoot],
    highest_short_root: s.highestShortRoot === null ? null : [...s.highestShortRoot],
    numbers_of_highest_short_root: s.numbersOfHighestShortRoot === null ? null : [...s.numbersOfHighestShortRoot],
    exponents: [...s.exponents],
    coxeter_number: s.coxeterNumber,
    weyl_order: s.weylOrder,
    det_cartan: jsonRational(s.detCartan),
    minuscule_nodes: [...s.minusculeNodes],
    minus_w0: [...s.minusW0],
    fundamental_orbit_sizes: [...s.fundamentalOrbitSizes],
    n_reduced_words_w0: s.completeGames === null ? null : jsonInteger(s.completeGames),
    coxeter_plane_rings: s.coxeterPlaneRings === null ? null : s.coxeterPlaneRings.map(([r, k]) => [r, k]),
    affine: {
      name: s.affine.name,
      constructor_name: s.affine.constructorName,
      labels: [...s.affine.labels],
      marks: [...s.affine.marks],
      comarks: [...s.affine.comarks],
    },
    real_forms: s.realForms.map((f) => ({
      cartan_label: f.cartanLabel,
      real_form: f.realForm,
      black_nodes: [...f.black],
      tau: [...f.tau],
      restricted_type_display: f.restrictedTypeDisplay,
    })),
  };
}

/** The text of the JSON download: exportJSON of the Atlas state and the sheet's values. */
export function atlasJson(s: AtlasSheet): string {
  return exportJSON(defaultState('atlas', s.name), atlasDerived(s));
}

/** A CSV field, quoted when it holds a comma, a quote or a line break. */
function field(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The text of the CSV download (format above). Ends with a line break. */
export function atlasCsv(s: AtlasSheet): string {
  const rows: string[] = ['item,label,value'];
  const row = (item: string, label: string | number, value: string | number | bigint): void => {
    rows.push(`${item},${String(label)},${field(String(value))}`);
  };
  const list = (v: readonly (number | bigint | string)[]): string => v.map(String).join(',');
  const byNode = (item: string, labels: readonly number[], v: readonly (number | bigint | string)[]): void => v.forEach((x, k) => row(item, labels[k]!, x));
  const byIndex = (item: string, v: readonly (number | bigint | string)[]): void => v.forEach((x, k) => row(item, k + 1, x));
  const rat = (r: Rational): string => String(jsonRational(r));

  row('board', '', s.name);
  s.cartan.forEach((r, k) => row('cartan', s.labels[k]!, list(r)));
  s.cartanTransposed.forEach((r, k) => row('cartan_transposed', s.labels[k]!, list(r)));
  s.adjacency.forEach((r, k) => row('adjacency', s.labels[k]!, list(r)));
  byNode('symmetrizer', s.labels, s.symmetrizer.map(rat));
  row('n_roots', '', s.nRoots);
  row('n_positive_roots', '', s.nPositiveRoots);
  s.positiveRoots.forEach((r, k) => row('positive_root', k + 1, list(r)));
  byNode('highest_root', s.labels, s.highestRoot);
  byNode('numbers_of_highest_root', s.labels, s.numbersOfHighestRoot);
  if (s.highestShortRoot !== null) byNode('highest_short_root', s.labels, s.highestShortRoot);
  if (s.numbersOfHighestShortRoot !== null) byNode('numbers_of_highest_short_root', s.labels, s.numbersOfHighestShortRoot);
  byIndex('exponent', s.exponents);
  row('coxeter_number', '', s.coxeterNumber);
  row('weyl_order', '', s.weylOrder);
  row('det_cartan', '', rat(s.detCartan));
  if (s.minusculeNodes.length === 0) row('minuscule_node', '', 'none');
  else byIndex('minuscule_node', s.minusculeNodes);
  byNode('minus_w0', s.labels, s.minusW0);
  byNode('fundamental_orbit_size', s.labels, s.fundamentalOrbitSizes);
  row('complete_games', '', s.completeGames === null ? 'not offered for a group of more than 60000 elements' : s.completeGames.toString());
  if (s.coxeterPlaneRings !== null) s.coxeterPlaneRings.forEach(([r, k], i) => row('coxeter_plane_ring', i + 1, `${r},${k}`));
  row('affine_name', '', s.affine.name);
  row('affine_constructor_name', '', s.affine.constructorName);
  byNode('affine_mark', s.affine.labels, s.affine.marks);
  byNode('affine_comark', s.affine.labels, s.affine.comarks);
  s.realForms.forEach((f, k) => {
    row('real_form', k + 1, f.realForm);
    row('real_form_cartan_label', k + 1, f.cartanLabel);
    row('real_form_black_nodes', k + 1, list(f.black));
    row('real_form_tau', k + 1, list(f.tau));
    row('real_form_restricted_type', k + 1, f.restrictedTypeDisplay ?? 'none');
  });
  return `${rows.join('\n')}\n`;
}

/** The text of the LaTeX download: the board's diagram, then one Satake diagram per real form. */
export function atlasLatex(s: AtlasSheet, pageLink: string): string {
  const identity = s.labels.map((l) => l);
  const lines = [exportLaTeX('dynkin', { type: s.name, black: [], tau: identity })];
  for (const f of s.realForms) lines.push(`${exportLaTeX('dynkin', { type: s.name, black: f.black, tau: f.tau })}   % ${f.cartanLabel}, ${f.realForm}`);
  return latexFile('dynkin', lines.join('\n'), pageLink);
}
