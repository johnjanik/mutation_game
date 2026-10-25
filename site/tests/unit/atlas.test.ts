// P6-A4: the data of T14, the Atlas (SPEC.md 4 T14 and its acceptance; 2.8, 2.9, 2.10, 2.12, 6.4 to 6.7;
// 5.7 comparison rules 1 to 7). "Every displayed value that has a golden value equals it (all of the items
// above have one, except the lists of roots for types where positive_roots is absent, for which the count
// is compared); the transposed matrix equals the transpose." The pages show what atlasData returns (the
// browser test T14.spec.ts reads the same values back from the built pages through data-exact), so the
// golden comparison is made here, for all 32 types, on the data.
//
// The golden file is the test oracle only: it is read through the harness of P0-A2, imported by a
// relative path (plan, as P4-A4 and P6-A3 do), and every comparison goes through its helpers (intEq,
// ringsEq, ratText, matchRecord, sortedPositiveRoots). This file does not call covers(): the coverage of
// each types[*], affine and satake key stays with its one engine file (CONTRACTS 3; trap 16 of the
// instruction, reported as a deviation for MERGE to confirm). Importing the harness registers nothing.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CAPS } from '@two-games/engine';
import { TYPE_NAMES, golden, intEq, matchRecord, ratText, ringsEq, sortedPositiveRoots } from '../../../packages/engine/test/golden/_harness';
import { ATLAS_BOARDS, ATLAS_GROUPS, ROOT_LIST_CAP, atlasData, type AtlasSheet, type ToolLink } from '../../src/components/atlas/atlasData';
import { atlasCsv, atlasDerived, atlasJson, atlasLatex, LATEX_HEADER } from '../../src/components/atlas/downloads';
import { exportLaTeX } from '../../src/lib/export';
import { defaultState, type ToolId, type ToolState } from '../../src/lib/state';
import { decodeState } from '../../src/lib/urlCodec';
import { registry } from '../../src/tools/index';

interface GoldenSatake {
  dynkin_type: string;
  cartan_label: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  restricted_type_display: string | null;
}
interface GoldenAffine {
  name: string;
  constructor_name: string;
  marks: number[];
  comarks: number[];
}

const SATAKE = golden.satake as GoldenSatake[];
const AFFINE = golden.affine as Record<string, GoldenAffine>;

/** Every sheet once (atlasData is pure; the slow types are computed once per run). */
const sheets = new Map<string, AtlasSheet>();
const times = new Map<string, number>();
function sheetOf(T: string): AtlasSheet {
  let s = sheets.get(T);
  if (s === undefined) {
    const t0 = performance.now();
    s = atlasData(T);
    times.set(T, performance.now() - t0);
    sheets.set(T, s);
  }
  return s;
}

/** The default state of a tool route: its registry `default` preset over defaultState (as the tools build it). */
function routeDefaults(tool: ToolId): ToolState {
  const entry = registry.find((e) => e.id === tool);
  if (entry === undefined) return defaultState(tool, 'A2'); // T13 before P6-A3's branch is merged
  const { caption, ...fields } = entry.presets.default;
  void caption;
  const board = fields.board ?? 'A2';
  return { ...defaultState(tool, board), ...fields, board } as ToolState;
}

function allLinks(s: AtlasSheet): ToolLink[] {
  return [...Object.values(s.links).filter((l): l is ToolLink => l !== null), ...s.realForms.map((r) => r.link)];
}

const identity = (n: number): number[] => Array.from({ length: n }, (_, k) => k + 1);

describe('boards', () => {
  it('ATLAS_BOARDS equals the 32 type names of the golden file, in file order', () => {
    expect([...ATLAS_BOARDS]).toEqual([...TYPE_NAMES]);
    expect(ATLAS_BOARDS).toHaveLength(32);
    expect(ATLAS_GROUPS.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(ATLAS_GROUPS.flatMap((g) => g.names)).toEqual([...ATLAS_BOARDS]);
    for (const g of ATLAS_GROUPS) for (const n of g.names) expect(n.startsWith(g.letter)).toBe(true);
  });

  it('the registry entry offers the 32 boards and has no preset beyond default', async () => {
    const T14 = (await import('../../src/tools/registry/T14')).default;
    expect(T14.id).toBe('atlas');
    expect(T14.number).toBe(14);
    expect(T14.phase).toBe(6);
    expect(T14.boards).toEqual([...ATLAS_BOARDS]);
    expect(Object.keys(T14.presets)).toEqual(['default']);
    expect(Object.keys(T14.presets.default)).toEqual(['caption']);
    for (const name of ['cartan', 'cartan-transposed', 'complete-games', 'real-forms', 'caption', 'noscript', 'citeText']) expect(T14.outs).toContain(name);
  });
});

describe('golden values', () => {
  for (const T of TYPE_NAMES) {
    it(`golden values, ${T}`, () => {
      const rec = golden.types[T]!;
      const s = sheetOf(T);
      expect(s.name).toBe(T);
      expect(s.labels).toEqual(identity(rec.cartan.length));
      intEq(s.cartan, rec.cartan, 'cartan');
      intEq(s.adjacency, rec.adjacency, 'adjacency');
      // Rationals (the weights d_i, det C): every one an integer on the 32 types (rule 4 through ratText).
      expect(s.symmetrizer.map(ratText)).toEqual(rec.symmetrizer.map(String));
      intEq(s.symmetrizer.map((r) => r.num), rec.symmetrizer, 'symmetrizer');
      expect(ratText(s.detCartan)).toBe(String(rec.det_cartan));
      intEq(s.nRoots, rec.n_roots, 'n_roots');
      intEq(s.nPositiveRoots, rec.n_positive_roots, 'n_positive_roots');
      if (rec.positive_roots !== undefined) {
        // Rule 5: in order, sorted by total, then lexicographically.
        intEq(s.positiveRoots, sortedPositiveRoots(rec.positive_roots), 'positive_roots');
      } else {
        // Rule 7 and the T14 acceptance: where the list is absent, the count is compared.
        intEq(s.positiveRoots.length, rec.n_positive_roots, 'number of positive roots listed');
      }
      intEq(s.highestRoot, rec.highest_root, 'highest_root');
      intEq(s.numbersOfHighestRoot, rec.numbers_of_highest_root, 'numbers_of_highest_root');
      if (rec.highest_short_root !== undefined && rec.highest_short_root !== null) {
        intEq(s.highestShortRoot, rec.highest_short_root, 'highest_short_root');
        intEq(s.numbersOfHighestShortRoot, rec.numbers_of_highest_short_root, 'numbers_of_highest_short_root');
        expect(s.simplyLaced).toBe(false);
      } else {
        expect(s.highestShortRoot).toBeNull();
        expect(s.numbersOfHighestShortRoot).toBeNull();
      }
      expect(s.simplyLaced).toBe(rec.simply_laced);
      intEq(s.exponents, rec.exponents, 'exponents');
      intEq(s.coxeterNumber, rec.coxeter_number, 'coxeter_number');
      intEq(s.weylOrder, rec.weyl_order, 'weyl_order');
      intEq(s.minusculeNodes, rec.minuscule_nodes, 'minuscule_nodes');
      intEq(s.minusW0, rec.minus_w0, 'minus_w0');
      expect(s.minusW0Identity).toBe(rec.minus_w0.every((v, k) => v === k + 1));
      intEq(s.fundamentalOrbitSizes, rec.fundamental_orbit_sizes, 'fundamental_orbit_sizes');
      if (rec.n_reduced_words_w0 !== undefined) {
        expect(typeof s.completeGames).toBe('bigint');
        intEq(s.completeGames, rec.n_reduced_words_w0, 'n_reduced_words_w0');
      } else {
        expect(s.completeGames).toBeNull();
      }
      if (rec.coxeter_plane !== undefined) {
        ringsEq(s.coxeterPlaneRings!, rec.coxeter_plane.rings);
        intEq(
          s.coxeterPlaneRings!.map((r) => r[1]),
          rec.coxeter_plane.rings.map((r) => r[1]),
          'ring sizes',
        );
      } else {
        expect(s.coxeterPlaneRings).toBeNull();
      }
      // The affine board, node 0 first (labels 0..n).
      const aff = AFFINE[T]!;
      expect(s.affine.name).toBe(aff.name);
      expect(s.affine.constructorName).toBe(aff.constructor_name);
      expect(s.affine.labels).toEqual([0, ...identity(rec.cartan.length)]);
      intEq(s.affine.marks, aff.marks, 'affine marks');
      intEq(s.affine.comarks, aff.comarks, 'affine comarks');
      // The real forms: the set of (cartan_label, real_form) of the satake records of this type, matched
      // record by record by real_form (rule 5), with their black nodes and tau as labels.
      const records = SATAKE.filter((r) => r.dynkin_type === T);
      expect(s.realForms.map((r) => `${r.cartanLabel} | ${r.realForm}`).sort()).toEqual(records.map((r) => `${r.cartan_label} | ${r.real_form}`).sort());
      for (const line of s.realForms) {
        const g = matchRecord(records, { real_form: line.realForm });
        expect(line.cartanLabel).toBe(g.cartan_label);
        intEq(line.black, g.black_nodes, `black nodes of ${line.realForm}`);
        intEq(line.tau, g.tau, `tau of ${line.realForm}`);
        expect(line.restrictedTypeDisplay).toBe(g.restricted_type_display);
      }
    });
  }

  it('the examples of the instruction (B3, D4, the affine boards of rank 2)', () => {
    const b3 = sheetOf('B3');
    expect(b3.realForms.map((r) => [r.cartanLabel, r.realForm])).toEqual(
      expect.arrayContaining([['B II', 'so(1,6)'], ['B I', 'so(2,5)'], ['B I', 'so(3,4)'], ['compact', 'so(7)']]),
    );
    expect(b3.realForms).toHaveLength(4);
    const d4 = sheetOf('D4').realForms.map((r) => r.realForm);
    expect(d4).toHaveLength(6);
    expect(d4).toEqual(expect.arrayContaining(['so(2,6)', 'so*(8)']));
    // Trap 3: both rank-2 pages show C2~, with their own numbering of the marks.
    expect(sheetOf('B2').affine).toMatchObject({ name: 'C2~', constructorName: 'B2~' });
    expect(sheetOf('C2').affine).toMatchObject({ name: 'C2~', constructorName: 'C2~' });
    expect(SATAKE).toHaveLength(167);
    expect(TYPE_NAMES.reduce((sum, T) => sum + sheetOf(T).realForms.length, 0)).toBe(167);
  });

  it(`the list of positive roots is capped at ${ROOT_LIST_CAP} and no type reaches beyond it`, () => {
    expect(ROOT_LIST_CAP).toBe(120);
    for (const T of TYPE_NAMES) {
      const s = sheetOf(T);
      expect(s.positiveRoots.length).toBe(Math.min(ROOT_LIST_CAP, s.nPositiveRoots));
      expect(s.nPositiveRoots).toBeLessThanOrEqual(ROOT_LIST_CAP);
    }
    expect(sheetOf('E8').positiveRoots).toHaveLength(120);
  });
});

describe('transposed matrix equals the transpose', () => {
  for (const T of TYPE_NAMES) {
    it(`transposed matrix equals the transpose, ${T}`, () => {
      const C = golden.types[T]!.cartan;
      const s = sheetOf(T);
      intEq(
        s.cartanTransposed,
        C.map((row, i) => row.map((_, j) => C[j]![i]!)),
        'transpose',
      );
      // Not the same matrix on the multiply laced boards (the switch shows something).
      const symmetric = C.every((row, i) => row.every((v, j) => v === C[j]![i]));
      expect(JSON.stringify(s.cartanTransposed) === JSON.stringify(s.cartan)).toBe(symmetric);
    });
  }
});

describe('absent fields', () => {
  it('no short-root lines on simply laced types, no ring sizes on A1, no count above 60000', () => {
    const above: string[] = [];
    for (const T of TYPE_NAMES) {
      const rec = golden.types[T]!;
      const s = sheetOf(T);
      if (rec.simply_laced) expect(s.highestShortRoot, T).toBeNull();
      if (s.weylOrder > CAPS.countGamesGroup) {
        above.push(T);
        expect(s.completeGames, T).toBeNull();
        expect(rec.n_reduced_words_w0, T).toBeUndefined();
      } else {
        expect(s.completeGames, T).not.toBeNull();
      }
    }
    expect(above).toEqual(['A8', 'B7', 'B8', 'C7', 'C8', 'D7', 'D8', 'E7', 'E8']);
    expect(sheetOf('A1').coxeterPlaneRings).toBeNull();
    expect(sheetOf('A1').links['coxeter-plane']).toBeNull();
    expect(CAPS.countGamesGroup).toBe(60000);
  });

  it('a sheet holds no undefined value and no null outside the fields that may be absent', () => {
    const mayBeNull = new Set(['highestShortRoot', 'numbersOfHighestShortRoot', 'completeGames', 'coxeterPlaneRings', 'hisName', 'restrictedTypeDisplay']);
    const walk = (v: unknown, path: string, key: string): void => {
      expect(v, path).not.toBeUndefined();
      if (v === null) {
        expect(mayBeNull.has(key) || path.includes('links'), `${path} is null`).toBe(true);
        return;
      }
      if (typeof v === 'object' && typeof v !== 'bigint') for (const [k, x] of Object.entries(v as object)) walk(x, `${path}.${k}`, Array.isArray(v) ? key : k);
    };
    for (const T of TYPE_NAMES) walk(sheetOf(T), T, '');
  });
});

describe('tool links', () => {
  for (const T of TYPE_NAMES) {
    it(`tool links decode, ${T}`, () => {
      const s = sheetOf(T);
      const links = allLinks(s);
      expect(links.length).toBeGreaterThanOrEqual(14);
      for (const l of links) {
        // Bare keys (6.6: a tool's own route); every link names its board.
        expect(l.query.startsWith('z=1&g=')).toBe(true);
        expect(l.text.trim()).not.toBe('');
        expect(/click here/i.test(l.text)).toBe(false);
        const { state, notice } = decodeState(l.query, l.tool, routeDefaults(l.tool));
        expect(notice, `${T} ${l.tool} ?${l.query}`).toBeNull();
        expect(state.board).toBe(l.tool === 'affine' ? s.affine.constructorName : T);
      }
      // T8 only on its 14 boards (6.6 rule 8), T5 elsewhere; T6 never.
      const weylBoards = registry.find((e) => e.id === 'weyl')!.boards as string[];
      const uses = links.map((l) => l.tool);
      expect(uses.includes('weyl')).toBe(weylBoards.includes(T));
      expect(uses.includes('mirror')).toBe(false);
      expect(s.links['weyl-order']!.tool).toBe(weylBoards.includes(T) ? 'weyl' : 'numbers');
      expect(s.links['complete-games']!.tool).toBe(weylBoards.includes(T) ? 'weyl' : 'board');
    });
  }

  it('each link carries what its item needs (B3, E8, E6, A1)', () => {
    const decoded = (l: ToolLink | null): ToolState => {
      const r = decodeState(l!.query, l!.tool, routeDefaults(l!.tool));
      expect(r.notice).toBeNull();
      return r.state;
    };
    const b3 = sheetOf('B3');
    expect(b3.links.cartan!.tool).toBe('board');
    expect(b3.links.roads!.tool).toBe('board');
    expect(b3.links.weights!.tool).toBe('form');
    expect(b3.links.roots!.tool).toBe('garden');
    expect(b3.links['highest-roots']!.tool).toBe('kostant');
    expect(b3.links.exponents!.tool).toBe('numbers');
    expect(b3.links['coxeter-number']!.tool).toBe('numbers');
    expect(decoded(b3.links['det-cartan'])).toMatchObject({ board: 'B3', view: 'linked' });
    expect(decoded(b3.links['minus-w0'])).toMatchObject({ board: 'B3', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 0, 0] });
    expect(decoded(b3.links['orbit-sizes'])).toMatchObject({ board: 'B3', coords: 'numbers', start: [1, 0, 0] });
    expect(b3.links['orbit-sizes']!.tool).toBe('garden');
    expect(decoded(b3.links['minuscule-nodes'])).toMatchObject({ board: 'B3', node: 3 });
    expect(b3.links['minuscule-nodes']!.tool).toBe('rep');
    expect(decoded(b3.links['coxeter-plane'])).toMatchObject({ board: 'B3', rings: [0, 1, 0], projection: 'coxeter' });
    expect(b3.links['coxeter-plane']!.tool).toBe('geometry');
    expect(decoded(b3.links.affine)).toMatchObject({ board: 'B3~' });
    expect(b3.links.affine!.tool).toBe('affine');
    expect(b3.links['complete-games']!.tool).toBe('weyl');
    // 6.6: x = black labels joined by dots (empty for none), t = the full tau in label order.
    for (const line of b3.realForms) {
      expect(line.link.tool).toBe('satake');
      const st = decoded(line.link);
      expect(st.black).toEqual(line.black);
      expect(st.tau).toEqual(line.tau);
      expect(line.link.query).toContain(`&x=${line.black.join('.')}`);
      expect(line.link.query).toContain(`&t=${line.tau.join('.')}`);
    }
    expect(b3.realForms.find((r) => r.realForm === 'so(3,4)')!.link.query).toBe('z=1&g=B3&x=&t=1.2.3');
    // E8: no minuscule node, so T12 opens with no k; the count is not offered, so T1 from all ones.
    const e8 = sheetOf('E8');
    expect(decoded(e8.links['minuscule-nodes']).node).toBeUndefined();
    expect(e8.links['minuscule-nodes']!.query).not.toContain('&k=');
    expect(decoded(e8.links['complete-games'])).toMatchObject({ board: 'E8', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1, 1, 1, 1, 1, 1, 1] });
    expect(e8.links['weyl-order']!.tool).toBe('numbers');
    // E6: the flip appears in tau of the forms that need it.
    const e6 = sheetOf('E6');
    expect(e6.realForms.some((r) => r.link.query.endsWith('&t=6.2.5.4.3.1'))).toBe(true);
    // B2 and C2: T15 is opened under the constructor's name.
    expect(sheetOf('B2').links.affine!.query).toBe('z=1&g=B2~');
    expect(sheetOf('C2').links.affine!.query).toBe('z=1&g=C2~');
    expect(sheetOf('A1').links['coxeter-plane']).toBeNull();
  });

  it('every link text says where it goes, and the texts of links that cannot carry an option say what to do there', () => {
    const b3 = sheetOf('B3');
    expect(b3.links.exponents!.text).toMatch(/tally/i);
    expect(b3.links['coxeter-number']!.text).toMatch(/wave/i);
    expect(b3.links['orbit-sizes']!.text).toMatch(/orbit/i);
    expect(b3.links['complete-games']!.text).toMatch(/counter/i);
    for (const T of TYPE_NAMES) for (const l of allLinks(sheetOf(T))) expect(l.text.includes('—')).toBe(false);
  });
});

// The source files of the Atlas build path (plan: components/atlas and pages/atlas).
const SITE = fileURLToPath(new URL('../../', import.meta.url));
const BUILD_PATH = ['src/components/atlas', 'src/pages/atlas'].map((d) => join(SITE, d));
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : [p];
  });
}

describe('no golden data in the build path', () => {
  it('no golden import, no <G>, no {{path}}, no golden resolver in components/atlas and pages/atlas', () => {
    const files = BUILD_PATH.flatMap(sourceFiles);
    expect(files.length).toBeGreaterThanOrEqual(6);
    const forbidden: [RegExp, string][] = [
      [/golden_data/, 'the golden file'],
      [/_harness/, 'the golden-test harness'],
      [/resolveGoldenPath|substituteGoldenInTex|lib\/golden/, 'the golden resolver'],
      [/<G[\s/>]/, 'the <G> component'],
      [/\{\{/, 'a {{path}}'],
      [/['"]@components\/content['"]|content\/index|content\/G\.astro|math\/Tex\.astro/, 'the content barrel, G or Tex (which import the golden file)'],
    ];
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const [re, what] of forbidden) if (re.test(text)) hits.push(`${f}: ${what}`);
    }
    expect(hits).toEqual([]);
  });
});

describe('no misprinted Wildberger list', () => {
  it('the note data holds no list of roots, and the misprinted form of Example 8.6 is absent from the sources', () => {
    for (const T of TYPE_NAMES) {
      const w = sheetOf(T).wildberger;
      // A root list would be a list of lists; the note holds a row kind and a name only.
      expect(Object.values(w).some((v) => Array.isArray(v))).toBe(false);
      expect(JSON.stringify(w)).not.toMatch(/\[\s*\[/);
    }
    const files = BUILD_PATH.flatMap(sourceFiles);
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(/beta_\{?41\}?|β_?\{?41|60\s*p_?\{?4\}?\s*p_?\{?1/.test(text), f).toBe(false);
      // The misprinted lists of 2.10 (1211 for "C4", 12 for "G2") are never typed as lists either.
      expect(/\b1211\b/.test(text), f).toBe(false);
    }
  });

  it('the note names the row of 2.10 that applies, B and C the right way round', () => {
    const w = (T: string) => sheetOf(T).wildberger;
    expect(w('B2')).toMatchObject({ row: 'same', hisName: 'B2', lettersExchanged: true });
    expect(w('C2')).toMatchObject({ row: 'same', hisName: 'C2', lettersExchanged: true });
    for (const n of [3, 4, 5, 6, 7, 8]) {
      expect(w(`B${n}`)).toMatchObject({ row: 'reversed', hisName: `C${n}`, lettersExchanged: true });
      expect(w(`C${n}`)).toMatchObject({ row: 'reversed', hisName: `B${n}`, lettersExchanged: true });
    }
    expect(w('F4')).toMatchObject({ row: 'reversed', hisName: 'F4', lettersExchanged: false });
    expect(w('G2')).toMatchObject({ row: 'same', hisName: 'G2', lettersExchanged: false });
    for (const T of ['D4', 'D5', 'D8']) expect(w(T)).toMatchObject({ row: 'D', hisName: T });
    for (const T of ['E6', 'E7']) expect(w(T)).toMatchObject({ row: 'E', hisName: T });
    for (const T of ['A1', 'A5', 'A8', 'E8']) expect(w(T)).toMatchObject({ row: 'none', hisName: null, lettersExchanged: false });
  });

  it("Kac's numbering is noted on E6, E7, E8 and G2 only", () => {
    expect(TYPE_NAMES.filter((T) => sheetOf(T).kacNumbering)).toEqual(['E6', 'E7', 'E8', 'G2']);
  });
});

describe('downloads', () => {
  for (const T of ['B3', 'E6', 'E8', 'A1', 'C2']) {
    it(`JSON, CSV and LaTeX hold the values, ${T}`, () => {
      const s = sheetOf(T);
      const json = JSON.parse(atlasJson(s)) as { tool: string; state: ToolState; derived: Record<string, unknown> };
      expect(json.tool).toBe('atlas');
      expect(json.state).toEqual({ schema: 1, tool: 'atlas', board: T });
      const d = json.derived;
      expect(d).toEqual(atlasDerived(s));
      intEq(d.cartan, golden.types[T]!.cartan);
      intEq(d.n_positive_roots, golden.types[T]!.n_positive_roots);
      if (golden.types[T]!.n_reduced_words_w0 !== undefined) intEq(d.n_reduced_words_w0, golden.types[T]!.n_reduced_words_w0);
      else expect(d.n_reduced_words_w0).toBeNull();

      const csv = atlasCsv(s).split('\n');
      expect(csv[0]).toBe('item,label,value');
      expect(csv.at(-1)).toBe('');
      const rows = csv.slice(1, -1);
      expect(rows.filter((r) => r.startsWith('positive_root,'))).toHaveLength(s.positiveRoots.length);
      expect(rows.filter((r) => r.startsWith('cartan,'))).toHaveLength(s.rank);
      expect(rows).toContain(`coxeter_number,,${s.coxeterNumber}`);
      expect(rows).toContain(`weyl_order,,${s.weylOrder}`);
      if (s.completeGames !== null) expect(rows).toContain(`complete_games,,${s.completeGames.toString()}`);
      // Every row has three fields; a field with a comma is quoted.
      for (const r of rows) expect(r).toMatch(/^[a-z0-9_]+,[0-9]*,("[^"]*"|[^,"]*)$/);

      const tex = atlasLatex(s, 'https://example.org/atlas/X/').split('\n');
      expect(tex.slice(0, LATEX_HEADER)).toEqual(['% https://example.org/atlas/X/', '% needs \\usepackage{dynkin-diagrams}']);
      const body = tex.slice(LATEX_HEADER, -1);
      // The string exportLaTeX actually returns for the board (no black node, the identity tau) comes first.
      expect(body[0]).toBe(exportLaTeX('dynkin', { type: T, black: [], tau: identity(s.rank) }));
      expect(body.slice(1)).toEqual(s.realForms.map((r) => `${exportLaTeX('dynkin', { type: T, black: r.black, tau: r.tau })}   % ${r.cartanLabel}, ${r.realForm}`));
      expect(tex.at(-1)).toBe('');
    });
  }

  it('the LaTeX line of B3 with no black node is the \\dynkin form of SPEC 6.7', () => {
    const line = exportLaTeX('dynkin', { type: 'B3', black: [], tau: [1, 2, 3] });
    expect(atlasLatex(sheetOf('B3'), 'x').split('\n')[LATEX_HEADER]).toBe(line);
    // SPEC 6.7 gives the form \dynkin B{ooo}; the assertion above reads the string exportLaTeX returns.
    expect(line).toBe('\\dynkin B{ooo}');
  });

  it('long counts keep every digit in the downloads', () => {
    const e6 = sheetOf('E6');
    expect(e6.completeGames!.toString().length).toBeGreaterThan(12);
    expect(atlasCsv(e6)).toContain(`complete_games,,${e6.completeGames!.toString()}`);
    expect(atlasJson(e6)).toContain(e6.completeGames!.toString());
  });
});

describe('build time', () => {
  it('atlasData for every type (timings for the report)', () => {
    sheets.clear();
    times.clear();
    const t0 = performance.now();
    for (const T of TYPE_NAMES) sheetOf(T);
    const total = performance.now() - t0;
    console.info(`atlasData timings (ms): ${TYPE_NAMES.map((T) => `${T} ${times.get(T)!.toFixed(1)}`).join(', ')}; all 32: ${total.toFixed(0)}`);
    console.info(`B3 tool links: ${JSON.stringify(allLinks(sheetOf('B3')).map((l) => `${l.tool}?${l.query}`))}`);
    expect(total).toBeGreaterThan(0);
  });
});
