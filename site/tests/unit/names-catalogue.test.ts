// P6-A2: the names of the Satake catalogue in site/src/generated/satake-names.json (SPEC.md 7.3 "Mathematics
// produced while a tool runs": scripts/names.mjs writes the KaTeX markup of every name of the catalogue, and the tools
// that show names (T13, T14, the board pickers) look them up there; 6.5 the display names and the plain-text data
// spellings; 6.4 the restricted types, displays and boards). The sets are checked against the engine
// (satakeCatalogue and satakeRecord over the 32 types) and against the golden file, so a drift between the engine and
// the golden file that the script reads fails here. Since the repair after review (DECISIONS.md 'MERGE: P6-A2
// reviewed; rulings' (3)) the catalogue has a file of its own: names.json holds again only P0-A3's content (the KaTeX
// version and the 32 type names), because T10 imports the whole of names.json into a chunk of the browser.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { satakeCatalogue, satakeRecord } from '@engine';
import type { SatakeRecord } from '@engine';
import { KATEX_VERSION, renderTex } from '../../src/lib/katex';
import {
  altOfRealForm,
  texOfCartanLabel,
  texOfName,
  texOfRealForm,
  writeGenerated,
  writeNames,
  writeSatakeNames,
} from '../../../scripts/names.mjs';

interface Typeset {
  text: string;
  tex: string;
  html: string;
}
interface NamesFile {
  katex: string;
  names: Record<string, Typeset>;
}
interface SatakeNamesFile {
  katex: string;
  realForms: Record<string, Typeset & { alt?: Typeset }>;
  cartanLabels: Record<string, Typeset>;
  restrictedTypes: Record<string, Typeset>;
}
interface GoldenSatake {
  real_form: string;
  cartan_label: string;
  restricted_type_display: string | null;
  restricted_type: string | null;
  restricted_board: string | null;
}

const repoDir = fileURLToPath(new URL('../../../', import.meta.url));
const GOLDEN = JSON.parse(readFileSync(join(repoDir, 'reference', 'golden_data.json'), 'utf8')) as {
  types: Record<string, unknown>;
  satake: GoldenSatake[];
};
const TYPES: string[] = Object.keys(GOLDEN.types);

/** First-appearance order without repeats. */
const distinct = (xs: readonly string[]): string[] => [...new Set(xs)];
/** The non-null restricted_type_display, restricted_type and restricted_board of a record, in that order. */
const restrictedOf = (r: GoldenSatake | SatakeRecord): string[] =>
  [r.restricted_type_display, r.restricted_type, r.restricted_board].filter((x): x is string => x !== null);

let dir = '';
let namesBytes = '';
let satakeBytes = '';
let namesFile: NamesFile;
let written: SatakeNamesFile;
let records: SatakeRecord[] = [];
// The records of the engine (all types), computed once (in Node; the browser runs E7 and E8 in the worker, E-9). The hook's
// limit is raised from Vitest's default of 10 s to 60 s for the parallel suite (a limit of the runner, not a timing check).
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'p6a2-names-'));
  writeGenerated(dir);
  namesBytes = readFileSync(join(dir, 'names.json'), 'utf8');
  satakeBytes = readFileSync(join(dir, 'satake-names.json'), 'utf8');
  namesFile = JSON.parse(namesBytes) as NamesFile;
  written = JSON.parse(satakeBytes) as SatakeNamesFile;
  records = TYPES.flatMap((type) => satakeCatalogue(type).map((e) => satakeRecord(type, e)));
}, 60000);
afterAll(() => {
  if (dir !== '') rmSync(dir, { recursive: true, force: true });
});

/** Every entry is the same KaTeX call as renderTex(tex, false), with its MathML. */
function expectTypeset(entry: Typeset, text: string, tex: string): void {
  expect(entry.text).toBe(text);
  expect(entry.tex).toBe(tex);
  expect(entry.html).toBe(renderTex(tex, false));
  expect(entry.html).toContain('<math');
}

describe('the generated files of names.mjs (repair after review)', () => {
  it('two files: names.json with only the KaTeX version and the 32 type names, satake-names.json with the catalogue', () => {
    expect(readdirSync(dir).sort()).toEqual(['names.json', 'satake-names.json']);
    // names.json is P0-A3's file again: T10's typesetNames.ts imports all of it into a lazily loaded chunk
    expect(Object.keys(namesFile)).toEqual(['katex', 'names']);
    expect(namesFile.katex).toBe(KATEX_VERSION);
    expect(Object.keys(namesFile.names)).toEqual(TYPES);
    expect(Object.keys(written)).toEqual(['katex', 'realForms', 'cartanLabels', 'restrictedTypes']);
    expect(written.katex).toBe(KATEX_VERSION);
  });

  it('each writer alone writes the same bytes as writeGenerated, and a second run writes the same bytes', () => {
    const again = mkdtempSync(join(tmpdir(), 'p6a2-names-again-'));
    try {
      expect(writeNames(join(again, 'names.json'))).toEqual({ count: TYPES.length, version: KATEX_VERSION });
      expect(readFileSync(join(again, 'names.json'), 'utf8')).toBe(namesBytes);
      const counts = writeSatakeNames(join(again, 'satake-names.json'));
      expect(counts).toEqual({
        version: KATEX_VERSION,
        realForms: Object.keys(written.realForms).length,
        cartanLabels: Object.keys(written.cartanLabels).length,
        restrictedTypes: Object.keys(written.restrictedTypes).length,
      });
      expect(readFileSync(join(again, 'satake-names.json'), 'utf8')).toBe(satakeBytes);
    } finally {
      rmSync(again, { recursive: true, force: true });
    }
  });
});

describe('satake-names.json: the Satake catalogue', () => {
  it('real forms', () => {
    const forms = TYPES.flatMap((type) => satakeCatalogue(type).map((e) => e.real_form));
    // exactly the real forms of the catalogue over the 32 types, in catalogue order, which is the golden order
    expect(Object.keys(written.realForms)).toEqual(distinct(forms));
    expect(Object.keys(written.realForms)).toEqual(distinct(GOLDEN.satake.map((r) => r.real_form)));
    for (const [text, entry] of Object.entries(written.realForms)) {
      expectTypeset(entry, text, texOfRealForm(text));
      const alt = altOfRealForm(text);
      if (alt === null) {
        expect(entry.alt, text).toBeUndefined();
      } else {
        expectTypeset(entry.alt!, alt.text, alt.tex);
      }
    }
    // SPEC.md 6.5: su*(2m), also shown as sl(m,H)
    const alts = Object.entries(written.realForms).filter(([, e]) => e.alt !== undefined).map(([t, e]) => [t, e.alt!.text]);
    expect(alts).toEqual([['su*(4)', 'sl(2,H)'], ['su*(6)', 'sl(3,H)'], ['su*(8)', 'sl(4,H)']]);
    expect(written.realForms['su*(4)']!.alt!.tex).toBe('\\mathfrak{sl}(2,\\mathbb{H})');
    // the TeX source spellings (plan), which render as the display names of SPEC.md 6.5
    const tex: [string, string][] = [
      ['e6(-14)', '\\mathfrak{e}_{6(-14)}'],
      ['sp(4,R)', '\\mathfrak{sp}(4,\\mathbb{R})'],
      ['sl(4,R)', '\\mathfrak{sl}(4,\\mathbb{R})'],
      ['su*(4)', '\\mathfrak{su}^*(4)'],
      ['su(1,3)', '\\mathfrak{su}(1,3)'],
      ['so(3,5)', '\\mathfrak{so}(3,5)'],
      ['sp(1,2)', '\\mathfrak{sp}(1,2)'],
      ['so*(8)', '\\mathfrak{so}^*(8)'],
      ['su(4)', '\\mathfrak{su}(4)'],
      ['so(7)', '\\mathfrak{so}(7)'],
      ['sp(3)', '\\mathfrak{sp}(3)'],
      ['e6(-78)', '\\mathfrak{e}_{6(-78)}'],
      ['e7(7)', '\\mathfrak{e}_{7(7)}'],
      ['e8(-24)', '\\mathfrak{e}_{8(-24)}'],
      ['f4(-20)', '\\mathfrak{f}_{4(-20)}'],
      ['g2(2)', '\\mathfrak{g}_{2(2)}'],
      ['so(1,16)', '\\mathfrak{so}(1,16)'],
      ['sp(16,R)', '\\mathfrak{sp}(16,\\mathbb{R})'],
    ];
    for (const [text, t] of tex) expect(texOfRealForm(text), text).toBe(t);
    // any other spelling throws, naming it
    for (const bad of ['sl(4,C)', 'su(1,3', 'E6', 'h4(1)', 'sp(2p,2q)', 'so(0,8)', 'e6(+2)', 'su*(4)x', '']) {
      expect(() => texOfRealForm(bad), bad).toThrow(`"${bad}"`);
    }
  });

  it('Cartan labels', () => {
    const labels = distinct(TYPES.flatMap((type) => satakeCatalogue(type).map((e) => e.cartan_label)));
    expect(Object.keys(written.cartanLabels)).toEqual(labels);
    expect(labels).toEqual(distinct(GOLDEN.satake.map((r) => r.cartan_label)));
    for (const [text, entry] of Object.entries(written.cartanLabels)) {
      expectTypeset(entry, text, `\\text{${text}}`);
      expect(texOfCartanLabel(text)).toBe(`\\text{${text}}`);
    }
    expect(written.cartanLabels['A III']!.tex).toBe('\\text{A III}');
    expect(written.cartanLabels.compact!.tex).toBe('\\text{compact}');
    for (const bad of ['A X', 'H I', 'compact form', 'E', 'AIII', '']) expect(() => texOfCartanLabel(bad), bad).toThrow();
  });

  it('restricted types', () => {
    // every non-null value of restricted_type_display, restricted_type and restricted_board, in that order per record
    const values = distinct(records.flatMap(restrictedOf));
    expect(records.length).toBe(GOLDEN.satake.length);
    expect(Object.keys(written.restrictedTypes)).toEqual(values);
    expect(values).toEqual(distinct(GOLDEN.satake.flatMap(restrictedOf)));
    for (const [text, entry] of Object.entries(written.restrictedTypes)) {
      const m = /^(BC|[A-G])([1-9][0-9]*)$/.exec(text)!;
      expect(m, text).not.toBeNull();
      expectTypeset(entry, text, `${m[1]}_{${m[2]}}`);
      expect(texOfName(text)).toBe(entry.tex);
    }
    expect(written.restrictedTypes.BC2!.tex).toBe('BC_{2}');
    expect(written.restrictedTypes.C2!.tex).toBe('C_{2}');
    expect(values).toContain('BC1');
    expect(values).toContain('BC4');
  });
});

describe('names.json', () => {
  it('the 32 type names are unchanged', () => {
    expect(Object.keys(namesFile.names)).toEqual(TYPES);
    for (const name of TYPES) {
      const m = /^([A-G])([1-9][0-9]*)$/.exec(name)!;
      expectTypeset(namesFile.names[name]!, name, `${m[1]}_{${m[2]}}`);
    }
    // affine and twisted names are still refused, and BC is accepted only before a rank
    for (const bad of ['A4~', 'C2~', 'D4^(3)', 'BC', 'BC0', 'BCD2', 'Z9', 'bc2']) expect(() => texOfName(bad), bad).toThrow();
  });
});
