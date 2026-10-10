// The one golden path resolver and the value formatter (SPEC.md 7.3; CONTRACTS.md 4).
// Build time only: imported by the content components <G> and <Tex> and by tests, never by a
// .svelte file or anything that reaches the browser, because the golden file is 455 kB and the
// page with no tool must stay under 15 kB (SPEC.md 7.6).
//
// The golden file holds node labels already (SPEC.md 5.1 E-7, Appendix G), so nothing here
// converts a node: what the file holds is what is printed.
import goldenData from '../../../reference/golden_data.json';

/** The parsed golden file. Loaded once by the static import above and never mutated. */
const GOLDEN: unknown = goldenData;

/** Thrown when a path does not lead to exactly one value, or a value cannot be printed. */
export class GoldenPathError extends Error {
  /** The path as written by the author ('' when the error concerns a value with no path). */
  readonly path: string;
  /** The number of values the path resolved to (0 for a malformed path or an unprintable value). */
  readonly count: number;

  constructor(message: string, path: string, count: number) {
    super(message);
    this.name = 'GoldenPathError';
    this.path = path;
    this.count = count;
  }
}

type Step =
  | { kind: 'key'; key: string; raw: string }
  | { kind: 'index'; key: string; index: number; raw: string }
  | { kind: 'select'; key: string; where: [string, string][]; raw: string };

function malformed(path: string, step: string, why: string): GoldenPathError {
  return new GoldenPathError(`path ${path} is malformed: step "${step}" ${why}`, path, 0);
}

/** Splits a path at the dots that lie outside brackets; brackets never nest. */
function splitSteps(path: string, trimmed: string): string[] {
  const steps: string[] = [];
  let current = '';
  let inBracket = false;
  for (const ch of trimmed) {
    if (inBracket) {
      if (ch === '[') throw malformed(path, current + ch, 'opens a bracket inside a bracket');
      if (ch === ']') inBracket = false;
      current += ch;
    } else if (ch === '.') {
      steps.push(current);
      current = '';
    } else {
      if (ch === '[') inBracket = true;
      current += ch;
    }
  }
  if (inBracket) throw malformed(path, current, 'has a bracket that does not close');
  steps.push(current);
  return steps;
}

const STEP = /^([^[\]]+)(?:\[([^[\]]*)\])?$/;

function parseStep(path: string, raw: string): Step {
  if (raw === '') throw malformed(path, raw, 'is empty');
  if (raw.startsWith('[')) throw malformed(path, raw, 'starts with a bracket; a bracket follows a key');
  const m = STEP.exec(raw);
  if (!m) {
    throw malformed(path, raw, 'is not a key, a key with an index, or a key with a selection (chained brackets are not allowed)');
  }
  const key = m[1]!;
  const inside = m[2];
  if (inside === undefined) return { kind: 'key', key, raw };
  if (inside.includes('=')) {
    const where: [string, string][] = [];
    for (const part of inside.split(';')) {
      const eq = part.indexOf('=');
      if (eq <= 0) throw malformed(path, raw, `has a selection term "${part}" that is not field=value`);
      where.push([part.slice(0, eq), part.slice(eq + 1)]);
    }
    return { kind: 'select', key, where, raw };
  }
  if (!/^\d+$/.test(inside)) throw malformed(path, raw, 'has an index that is not a non-negative integer');
  return { kind: 'index', key, index: Number(inside), raw };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * The text a field is compared as in a selection: an integer as its decimal digits, a string as it
 * stands, a list as its entries joined by commas with no spaces (each entry by this same rule),
 * a boolean as true or false, null as null. An object has no text and never matches.
 */
function textOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    const parts = v.map(textOf);
    return parts.every((p): p is string => p !== undefined) ? parts.join(',') : undefined;
  }
  return undefined;
}

function none(path: string, count: number, step: string, why: string): GoldenPathError {
  return new GoldenPathError(`path ${path} resolves to ${count} values. The step "${step}" ${why}.`, path, count);
}

/**
 * Resolves a path of the grammar of SPEC.md 7.3 in golden_data.json. Steps are separated by dots;
 * a step is a key (`types.E8`; keys may contain spaces or be digit strings), a key with a zero-based
 * index into a list (`positive_roots[0]`), or a key with a selection from a list of records
 * (`satake[dynkin_type=E6;real_form=e6(-14)]`), each value compared with the field as text.
 * Throws GoldenPathError unless the path leads to exactly one value.
 */
export function resolveGoldenPath(path: string): unknown {
  const trimmed = path.trim();
  if (trimmed === '') throw malformed(path, '', 'is empty');
  const steps = splitSteps(path, trimmed).map((raw) => parseStep(path, raw));
  let here: unknown = GOLDEN;
  for (const step of steps) {
    if (!isRecord(here)) throw none(path, 0, step.raw, 'applies a key to something that is not an object');
    if (!Object.prototype.hasOwnProperty.call(here, step.key)) throw none(path, 0, step.raw, `names the key "${step.key}", which does not exist there`);
    const value = here[step.key];
    if (step.kind === 'key') {
      here = value;
    } else if (step.kind === 'index') {
      if (!Array.isArray(value)) throw none(path, 0, step.raw, 'applies an index to something that is not a list');
      if (step.index >= value.length) throw none(path, 0, step.raw, `has index ${step.index}, but the list has ${value.length} entries`);
      here = value[step.index];
    } else {
      if (!Array.isArray(value)) throw none(path, 0, step.raw, 'applies a selection to something that is not a list');
      const matches = value.filter(
        (record) =>
          isRecord(record) &&
          step.where.every(([field, wanted]) => Object.prototype.hasOwnProperty.call(record, field) && textOf(record[field]) === wanted),
      );
      if (matches.length !== 1) throw none(path, matches.length, step.raw, `matches ${matches.length} records; a selection must match exactly one`);
      here = matches[0];
    }
  }
  return here;
}

export type GoldenFormat = 'word' | 'count' | 'plain';

const MINUS = '−'; // U+2212 MINUS SIGN, the true minus of SPEC.md 6.3 and 7.3
const DIGIT_GROUP = ' '; // U+202F NARROW NO-BREAK SPACE between groups of three digits
const LABEL_SEP = ' '; // U+2009 THIN SPACE between the labels of a word

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

/** Groups the digits in threes from the right with sep, from five digits on; four digits stay. */
function groupDigits(digits: string, sep: string): string {
  if (digits.length < 5) return digits;
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return groups.join(sep);
}

function proseInteger(n: number, grouped: boolean): string {
  const digits = String(Math.abs(n));
  return (n < 0 ? MINUS : '') + (grouped ? groupDigits(digits, DIGIT_GROUP) : digits);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'a list that is not a list of integers or of strings';
  if (typeof v === 'number') return `the number ${v}, which is not an integer`;
  if (typeof v === 'object') return 'an object';
  return `a value of type ${typeof v}`;
}

function notForProse(found: string): GoldenPathError {
  return new GoldenPathError(
    `golden value not printable in prose: found ${found}. Use <Tex> for a formula or a table for structured data, or a path that leads to an integer, a string or a list of them.`,
    '',
    0,
  );
}

/**
 * Formats a golden value for prose (SPEC.md 7.3, "Output"). An integer: decimal digits, U+2212 for
 * the sign, groups of three separated by U+202F from five digits on. A list of integers: the entries
 * so printed, separated by a comma and a space, in round brackets; a list of strings likewise.
 * A string: as it stands, so the decimal strings of bigint_test print with no grouping and keep any
 * hyphen-minus (they are strings). `word`: list entries separated by U+2009. `count`: the length of
 * a list, as an integer. `plain`: no grouping and no brackets. Anything else throws GoldenPathError.
 */
export function formatGoldenValue(v: unknown, as?: GoldenFormat): string {
  if (as !== undefined && as !== 'word' && as !== 'count' && as !== 'plain') {
    throw new GoldenPathError(`unknown format as="${String(as)}"; use word, count or plain`, '', 0);
  }
  if (as === 'count') {
    if (!Array.isArray(v)) throw notForProse(`${describe(v)} where as="count" needs a list`);
    return proseInteger(v.length, true);
  }
  if (as === 'word') {
    if (!Array.isArray(v) || !v.every(isInteger)) throw notForProse(`${describe(v)} where as="word" needs a list of node labels`);
    return v.map((n) => proseInteger(n, false)).join(LABEL_SEP);
  }
  const grouped = as !== 'plain';
  if (isInteger(v)) return proseInteger(v, grouped);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    let entries: string[] | null = null;
    if (v.every(isInteger)) entries = v.map((n) => proseInteger(n, grouped));
    else if (v.every((x) => typeof x === 'string')) entries = v as string[];
    if (entries !== null) return as === 'plain' ? entries.join(', ') : `(${entries.join(', ')})`;
  }
  throw notForProse(describe(v));
}

/** Resolves and formats in one call, naming the path when the value cannot be printed (used by <G>). */
export function goldenProse(path: string, as?: GoldenFormat): string {
  const value = resolveGoldenPath(path);
  try {
    return formatGoldenValue(value, as);
  } catch (error) {
    if (error instanceof GoldenPathError) throw new GoldenPathError(`path ${path}: ${error.message}`, path, 1);
    throw error;
  }
}

function texInteger(n: number): string {
  // ASCII hyphen-minus in TeX: KaTeX sets it as a minus. Digits grouped with \, from five digits.
  return (n < 0 ? '-' : '') + groupDigits(String(Math.abs(n)), '\\,');
}

function texValue(v: unknown, path: string): string {
  if (isInteger(v)) return texInteger(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    if (v.every(isInteger)) return `(${v.map(texInteger).join(', ')})`;
    if (v.every((x) => typeof x === 'string')) return `(${(v as string[]).join(', ')})`;
  }
  throw new GoldenPathError(`path ${path} in <Tex>: found ${describe(v)}; only an integer, a string or a list of them can be substituted`, path, 1);
}

/**
 * Replaces every {{path}} in a TeX source by its golden value in TeX form (SPEC.md 7.3): integers
 * with \, between digit groups from five digits, lists in round brackets, strings as they stand.
 * Whitespace just inside the braces is trimmed. The source is otherwise passed through unchanged.
 * Every {{ is taken as the start of a golden path, even where it would be legal TeX such as
 * \frac{{a}}{b}: write \frac{ {a} }{b} instead. A {{ with no matching }} throws.
 */
export function substituteGoldenInTex(src: string): string {
  let out = '';
  let from = 0;
  for (;;) {
    const open = src.indexOf('{{', from);
    if (open < 0) break;
    const close = src.indexOf('}}', open + 2);
    if (close < 0) {
      throw new GoldenPathError(
        `<Tex src="${src}">: "{{" at offset ${open} has no matching "}}". Every "{{" in <Tex> starts a golden path; for TeX braces write "{ {" instead.`,
        '',
        0,
      );
    }
    const path = src.slice(open + 2, close).trim();
    let value: unknown;
    try {
      value = resolveGoldenPath(path);
    } catch (error) {
      if (!(error instanceof GoldenPathError)) throw error;
      throw new GoldenPathError(
        `${error.message} (In <Tex>, every "{{" starts a golden path; for TeX braces write "{ {" instead.)`,
        error.path,
        error.count,
      );
    }
    out += src.slice(from, open) + texValue(value, path);
    from = close + 2;
  }
  return out + src.slice(from);
}
