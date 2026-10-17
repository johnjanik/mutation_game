// The golden-test harness of CONTRACTS.md section 3 (owner P0-A2).
//
// The seven comparison rules of SPEC.md 5.7 are implemented once here and never re-implemented in a
// test. Rules without a helper:
//   Rule 6: identifiers (board and type names, class, kind, real_form, ...) compare exactly with toBe;
//           other text fields (name of a polytope, label, note, rule, reason, reasons) are documentation
//           and are not compared.
//   Rule 7: a field that Appendix G describes as present only in some records is not tested for a record
//           in which it is absent or null; a null that carries meaning compares as null (toBeNull).
// Later engine agents add helpers in their own files; the exports below are never changed, only appended.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SafeInt } from '../../src/arith';
import { boardFromName, toLabels } from '../../src/board';
import type { AnyBoard, Board } from '../../src/board';
import type { Word } from '../../src/moves';

// ---------------------------------------------------------------------------------------------
// The golden file: loaded once, hash-checked, never mutated
// ---------------------------------------------------------------------------------------------

/** SHA-256 of reference/golden_data.json at the start of the build (CONTRACTS.md 9). */
export const GOLDEN_SHA256 = 'c45474636fc9a7990c97c3664d2603f090b5b654a39352a87fc992f744e95a2f';

/** The golden file, by a path relative to this file so that it works from any worktree. */
export const GOLDEN_FILE = new URL('../../../../reference/golden_data.json', import.meta.url);

/**
 * The hash guard (plan). Throws unless the file's bytes have the recorded SHA-256; a difference is a
 * blocker (CONTRACTS.md 9): stop and report, do not fall back to parsing.
 */
export function verifyGoldenHash(file: string | URL = GOLDEN_FILE): void {
  const path = typeof file === 'string' ? file : fileURLToPath(file);
  const bytes = readFileSync(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== GOLDEN_SHA256) {
    throw new Error(
      `${path} has SHA-256 ${digest}, not the recorded ${GOLDEN_SHA256} of CONTRACTS.md 9. ` +
        'The reference file has changed: stop and report; no golden test runs against it.',
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

function loadGolden(): GoldenData {
  verifyGoldenHash(GOLDEN_FILE);
  // Big integers in the file are decimal strings (bigint_test); JSON.parse keeps them as strings.
  const parsed: unknown = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'));
  return deepFreeze(parsed as GoldenData);
}

// ---------------------------------------------------------------------------------------------
// Types, from SPEC.md Appendix G. The keys this harness uses are typed precisely; every other
// top-level key is declared loosely and narrowed by later agents in their own files.
// ---------------------------------------------------------------------------------------------

export interface GoldenCoxeterPlane {
  rings: [number, number][];
  distinct_points: number;
  h_points_on_every_ring: boolean;
}

export interface GoldenTypeRecord {
  cartan: number[][];
  adjacency: number[][];
  symmetrizer: number[];
  n_roots: number;
  n_positive_roots: number;
  highest_root: number[];
  numbers_of_highest_root: number[];
  coxeter_number: number;
  det_cartan: number;
  simply_laced: boolean;
  exponents: number[];
  weyl_order: number;
  longest_word: number[];
  fired_values: number[];
  fired_tally: Record<string, number>;
  minus_w0: number[];
  bipartite_colouring: number[];
  fundamental_orbit_sizes: number[];
  minuscule_nodes: number[];
  highest_root_of_reversed_board: number[];
  // rule 7: present only in some records
  positive_roots?: number[][];
  highest_short_root?: number[] | null;
  numbers_of_highest_short_root?: number[] | null;
  n_short_positive?: number;
  n_long_positive?: number;
  long_to_short_ratio?: number;
  n_reduced_words_w0?: number;
  length_distribution?: number[];
  coxeter_plane?: GoldenCoxeterPlane;
}

export interface GoldenClassifyRecord {
  nodes: number[];
  kind: 'gcm' | 'one-way';
  balanced: boolean;
  class: 'finite' | 'affine' | 'indefinite' | null;
  name: string | null;
  bourbaki_order?: number[];
  marks?: number[];
  comarks?: number[];
}

export interface GoldenClassificationTest {
  label: string;
  cartan: number[][];
  components: GoldenClassifyRecord[];
  smallest_nonfinite_subboard: { nodes: number[]; class: 'affine' | 'indefinite' } | null;
  spectral_radius_4_decimals: string | null;
}

export interface GoldenOneWayCounterexample {
  cartan: number[][];
  start: number[];
  moves: number[]; // labels of mutations
  result: number[];
}

export interface GoldenBigintTest {
  cartan: number[][];
  population_start: number[];
  mutation_nodes: number[]; // labels
  population_end: string[]; // decimal strings
  numbers_start: number[];
  firing_nodes: number[]; // labels
  firing_mode: string;
  numbers_end: string[]; // decimal strings
  first_move_after_which_an_entry_exceeds_2_to_53: number;
}

export interface GoldenData {
  about: unknown;
  conventions: Record<string, string>;
  types: Record<string, GoldenTypeRecord>;
  classification_tests: GoldenClassificationTest[];
  one_way_counterexample: GoldenOneWayCounterexample;
  bigint_test: GoldenBigintTest;
  // declared loosely; later phases narrow in their own files
  satake: unknown;
  folding: unknown;
  weyl_dimension: unknown;
  affine: unknown;
  twisted_affine: unknown;
  admissible_counts: unknown;
  wildberger_lists: unknown;
  affine_names: unknown;
  pentagon_example: unknown;
  admissible_pairs: unknown;
  satake_examples: unknown;
  generalized_satake_example: unknown;
  kostant: unknown;
  layer_growth_examples: unknown;
  wythoff: unknown;
  wythoff_hull_checks: unknown;
  wythoff_note: unknown;
  coxeter_plane_types_with_coincident_points: unknown;
  minuscule_representations: unknown;
  orbit_plus_zero_representations: unknown;
  e8: unknown;
  golden_boards: unknown;
  golden_folds: unknown;
  heaps: unknown;
}

/** Parsed once from reference/golden_data.json; frozen, never mutated. */
export const golden: GoldenData = loadGolden();

/** The 32 keys of golden.types in file order. */
export const TYPE_NAMES: readonly string[] = Object.freeze(Object.keys(golden.types));

/** boardFromName for the 32 type names; throws for any other name. */
export function boardOf(typeName: string): Board<number> {
  if (!TYPE_NAMES.includes(typeName)) {
    throw new Error(`boardOf: ${JSON.stringify(typeName)} is not one of the 32 golden types`);
  }
  const board = boardFromName(typeName);
  if (board.arith !== SafeInt) {
    throw new Error(`boardOf: boardFromName(${typeName}) is not a SafeInt board`);
  }
  return board as Board<number>;
}

// ---------------------------------------------------------------------------------------------
// The table of SPEC.md 5.7, machine-readable. One grammar (plan): a top-level key as it stands
// ('satake'); a field of every record of a list or keyed object as '<key>[*].<field>'; a field of a
// single record as '<key>.<field>'. Where the table says "without X", the plain key covers everything
// but X, and X is its own key in its own phase.
// The row "none" of the table (wildberger_lists, wythoff_hull_checks, wythoff_note, about, conventions)
// is documentation of what the oracle checked and is not in this record.
// ---------------------------------------------------------------------------------------------

export const GOLDEN_KEYS_BY_PHASE: Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7, string[]> = {
  0: ['types[*].cartan', 'types[*].adjacency'],
  1: ['types[*].n_roots', 'types[*].n_positive_roots', 'types[*].positive_roots', 'types[*].highest_root',
      'types[*].highest_short_root', 'types[*].numbers_of_highest_root', 'types[*].numbers_of_highest_short_root',
      'types[*].highest_root_of_reversed_board', 'types[*].coxeter_number', 'types[*].longest_word',
      'types[*].fired_values', 'types[*].fired_tally', 'types[*].minus_w0', 'types[*].minuscule_nodes',
      'kostant[*].end_from_node', 'kostant[*].moves_from_node', 'kostant[*].final_numbers_from_node',
      'one_way_counterexample', 'layer_growth_examples', 'bigint_test'],
  2: ['types[*].symmetrizer', 'types[*].simply_laced', 'types[*].n_short_positive', 'types[*].n_long_positive',
      'types[*].long_to_short_ratio', 'types[*].det_cartan',
      'affine', 'twisted_affine', 'affine_names', 'classification_tests', 'pentagon_example',
      'kostant[*].affine_board_from_node'],
  3: ['types[*].exponents', 'types[*].weyl_order', 'types[*].bipartite_colouring', 'types[*].fundamental_orbit_sizes',
      'types[*].n_reduced_words_w0', 'types[*].length_distribution',
      'weyl_dimension', 'heaps', 'pentagon_example.complete_games', 'e8'],
  4: ['folding', 'wythoff', 'types[*].coxeter_plane', 'coxeter_plane_types_with_coincident_points', 'e8.h4_projection'],
  5: ['minuscule_representations'],
  6: ['satake', 'admissible_pairs', 'admissible_counts', 'satake_examples', 'folding[*].quasi_split_real_form'],
  7: ['golden_boards', 'golden_folds', 'orbit_plus_zero_representations', 'generalized_satake_example'],
};

// ---------------------------------------------------------------------------------------------
// The coverage registry. Vitest runs test files in isolated workers, so each covers() call persists
// its keys to disk (one small JSON file per registration under test/golden/.coverage/); the global
// setup of vitest.config.ts clears that directory at the start of a run and, in its teardown, merges
// the registrations into test/golden/coverage.json with the shape
//   { "keys": [sorted unique spellings], "missingByPhase": { "0": [...], ..., "7": [...] } }.
// Both are build outputs and are not committed.
// ---------------------------------------------------------------------------------------------

export const COVERAGE_DIR = new URL('./.coverage/', import.meta.url);
export const COVERAGE_FILE = new URL('./coverage.json', import.meta.url);

/** Registers the golden keys a test file covers. A key is tested in exactly one file. */
export function covers(...keys: string[]): void {
  if (keys.length === 0) throw new Error('covers() needs at least one golden key');
  const dir = fileURLToPath(COVERAGE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sorted = [...keys].sort();
  const id = createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 16);
  writeFileSync(`${dir}/${id}.json`, JSON.stringify({ keys: sorted }, null, 2) + '\n');
}

// ---------------------------------------------------------------------------------------------
// Rule 2: nodes in the golden file are labels; tests convert with toLabels.
// ---------------------------------------------------------------------------------------------

export function labels(board: AnyBoard, positions: readonly number[]): number[] {
  return toLabels(board, positions);
}

export function wordLabels(board: AnyBoard, word: Word): number[] {
  return toLabels(board, word);
}

// ---------------------------------------------------------------------------------------------
// Rule 1: integers compare exactly; integers beyond 2^53 are decimal strings in the file and compare
// with bigint values by their decimal text. Recursive over arrays (vectors, matrices, lists of lists).
// ---------------------------------------------------------------------------------------------

function fail(message: string | undefined, path: string, detail: string): never {
  const where = path === '' ? 'at the root' : `at ${path}`;
  throw new Error(`${message ? message + ': ' : ''}intEq failed ${where}: ${detail}`);
}

function showLeaf(v: unknown): string {
  if (typeof v === 'bigint') return `${v.toString()}n`;
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

function intEqAt(actual: unknown, expected: unknown, message: string | undefined, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) fail(message, path, `expected an array, got ${showLeaf(actual)}`);
    if (actual.length !== expected.length) {
      fail(message, path, `length ${actual.length}, expected ${expected.length}`);
    }
    for (let k = 0; k < expected.length; k++) intEqAt(actual[k], expected[k], message, `${path}[${k}]`);
    return;
  }
  if (Array.isArray(actual)) fail(message, path, `got an array, expected ${showLeaf(expected)}`);
  if (typeof actual === 'number') {
    if (!Number.isSafeInteger(actual)) fail(message, path, `${showLeaf(actual)} is not a safe integer`);
    if (typeof expected === 'number') {
      if (actual === expected) return;
      fail(message, path, `${showLeaf(actual)} !== ${showLeaf(expected)}`);
    }
    if (typeof expected === 'string') {
      if (String(actual) === expected) return;
      fail(message, path, `${showLeaf(actual)} does not print as ${showLeaf(expected)}`);
    }
    fail(message, path, `cannot compare a number with ${showLeaf(expected)}`);
  }
  if (typeof actual === 'bigint') {
    if (typeof expected === 'number' || typeof expected === 'string' || typeof expected === 'bigint') {
      if (actual.toString() === String(expected)) return;
      fail(message, path, `${showLeaf(actual)} does not print as ${showLeaf(expected)}`);
    }
    fail(message, path, `cannot compare a bigint with ${showLeaf(expected)}`);
  }
  fail(message, path, `cannot compare ${showLeaf(actual)} with ${showLeaf(expected)}`);
}

export function intEq(actual: unknown, expected: unknown, message?: string): void {
  intEqAt(actual, expected, message, '');
}

// ---------------------------------------------------------------------------------------------
// Rule 3: ring lists, each ring [radius, count]; counts exactly, radii within 1e-5, innermost first.
// ---------------------------------------------------------------------------------------------

export function ringsEq(actual: [number, number][], expected: [number, number][]): void {
  if (actual.length !== expected.length) {
    throw new Error(`ringsEq: ${actual.length} rings, expected ${expected.length}`);
  }
  for (let k = 0; k < expected.length; k++) {
    const [ra, ca] = actual[k]!;
    const [re, ce] = expected[k]!;
    if (ca !== ce) throw new Error(`ringsEq: ring ${k} has ${ca} points, expected ${ce}`);
    if (!(Math.abs(ra - re) <= 1e-5)) throw new Error(`ringsEq: ring ${k} has radius ${ra}, expected ${re}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Rule 4: rationals as text, "p/q" in lowest terms or "p" when the denominator is 1. The caller
// passes lowest terms with den > 0 (the Rational type arrives in phase 1; structural here, plan).
// ---------------------------------------------------------------------------------------------

export function ratText(r: { num: bigint; den: bigint }): string {
  return r.den === 1n ? r.num.toString() : `${r.num.toString()}/${r.den.toString()}`;
}

// ---------------------------------------------------------------------------------------------
// Rule 5: a list of records is matched by its identifying fields, never by index; arrays compare by
// their JSON text. Lists whose order has a meaning compare in order; positive_roots are sorted by
// total, then lexicographically.
// ---------------------------------------------------------------------------------------------

function fieldEq(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

export function matchRecord<T extends object>(list: T[], where: Partial<T>): T {
  const keys = Object.keys(where) as (keyof T)[];
  const hits = list.filter((rec) => keys.every((k) => fieldEq(rec[k], where[k])));
  if (hits.length !== 1) {
    throw new Error(`matchRecord: ${hits.length} records match ${JSON.stringify(where)}, expected exactly one`);
  }
  return hits[0]!;
}

export function sortedPositiveRoots(list: number[][]): number[][] {
  const total = (v: number[]) => v.reduce((s, x) => s + x, 0);
  return list
    .map((v) => [...v])
    .sort((a, b) => {
      const d = total(a) - total(b);
      if (d !== 0) return d;
      for (let k = 0; k < Math.min(a.length, b.length); k++) {
        if (a[k] !== b[k]) return a[k]! - b[k]!;
      }
      return a.length - b.length;
    });
}
