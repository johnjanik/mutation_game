// P0-A4: the golden path resolver, the value formatter and the TeX substitution (SPEC.md 7.3;
// CONTRACTS.md 4). No golden value is typed here (COMMON.md 4.4): every expected value is read
// from the imported golden file by direct access, written without the resolver. The selector
// strings inside the paths (E6, e6(-14), D4, 3, 1,0,0,0) are inputs of the path grammar quoted
// from SPEC.md 7.3, not expected results.
import { describe, expect, it } from 'vitest';
import golden from '../../../reference/golden_data.json';
import {
  formatGoldenValue,
  goldenProse,
  GoldenPathError,
  resolveGoldenPath,
  substituteGoldenInTex,
} from '../../src/lib/golden';

const MINUS = '−';
const NNBSP = ' ';
const THIN = ' ';
const NBSP = ' ';

// The golden file as plain data, for direct access in the expectations.
const g = golden as unknown as {
  types: Record<string, Record<string, unknown> & { weyl_order: number; positive_roots: number[][]; n_positive_roots: number; longest_word: number[]; fired_tally: Record<string, number> }>;
  satake: { dynkin_type: string; real_form: string; dim_k: number }[];
  folding: { type: string; order: number; folds_to: string | null }[];
  wythoff: { type: string; rings: number[]; f_vector: number[] }[];
  heaps: Record<string, { moves: number }>;
  affine_names: Record<string, string[]>;
};

function thrown(f: () => unknown): GoldenPathError {
  try {
    f();
  } catch (error) {
    expect(error).toBeInstanceOf(GoldenPathError);
    return error as GoldenPathError;
  }
  throw new Error('expected a GoldenPathError, nothing was thrown');
}

/** No hyphen-minus directly before a digit (U+2212 is required there) and no U+00A0. */
function assertProseCharacters(s: string): void {
  expect(s).not.toMatch(/-\d/);
  expect(s).not.toContain(NBSP);
}

describe('resolveGoldenPath', () => {
  it('resolves every path shape of 7.3', () => {
    expect(resolveGoldenPath('types.E8.weyl_order')).toBe(g.types.E8.weyl_order);
    expect(resolveGoldenPath('types.E8')).toBe(g.types.E8);

    const satake = g.satake.filter((r) => r.dynkin_type === 'E6' && r.real_form === 'e6(-14)');
    expect(satake).toHaveLength(1);
    expect(resolveGoldenPath('satake[dynkin_type=E6;real_form=e6(-14)].dim_k')).toBe(satake[0]!.dim_k);

    const folding = g.folding.filter((r) => r.type === 'D4' && r.order === 3);
    expect(folding).toHaveLength(1);
    expect(resolveGoldenPath('folding[type=D4;order=3].folds_to')).toEqual(folding[0]!.folds_to);

    const wythoff = g.wythoff.filter((r) => r.type === 'F4' && r.rings.join(',') === '1,0,0,0');
    expect(wythoff).toHaveLength(1);
    expect(resolveGoldenPath('wythoff[type=F4;rings=1,0,0,0].f_vector')).toEqual(wythoff[0]!.f_vector);

    expect(resolveGoldenPath('types.A2.positive_roots[0]')).toEqual(g.types.A2.positive_roots[0]);
    expect(resolveGoldenPath('heaps.A4 omega_2.moves')).toBe(g.heaps['A4 omega_2']!.moves);
    expect(resolveGoldenPath('affine_names.2')).toEqual(g.affine_names['2']);
    expect(resolveGoldenPath('types.E8.fired_tally.1')).toBe(g.types.E8.fired_tally['1']);
  });

  it('trims surrounding whitespace of the whole path', () => {
    expect(resolveGoldenPath('  types.E8.weyl_order \n')).toBe(g.types.E8.weyl_order);
  });

  it('throws naming the path and the count', () => {
    const d4 = g.folding.filter((r) => r.type === 'D4').length;
    expect(d4).toBeGreaterThan(1);
    const several = thrown(() => resolveGoldenPath('folding[type=D4]'));
    expect(several.message).toContain(`path folding[type=D4] resolves to ${d4} values`);
    expect(several.message.startsWith('path folding[type=D4] resolves to')).toBe(true);
    expect(several.count).toBe(d4);
    expect(several.path).toBe('folding[type=D4]');
    expect(several.name).toBe('GoldenPathError');

    const f4 = g.wythoff.filter((r) => r.type === 'F4').length;
    expect(thrown(() => resolveGoldenPath('wythoff[type=F4]')).message).toContain(`resolves to ${f4} values`);

    for (const path of ['types.E9.weyl_order', 'types.A2.positive_roots[99]', 'affine_names[2]', 'types.E8.weyl_order.x', 'types[0]', 'types.E8.weyl_order[type=A]', 'satake[dynkin_type=Z9]']) {
      const e = thrown(() => resolveGoldenPath(path));
      expect(e.message).toContain(`path ${path} resolves to 0 values`);
      expect(e.count).toBe(0);
    }
  });

  it('rejects malformed paths', () => {
    for (const path of ['cartan[0][1]', 'types..E8', '[type=D4]', 'types.A2.positive_roots[-1]', 'types.A2.positive_roots[1.5]', 'types.A2.positive_roots[0', 'types.', '', '   ', 'satake[=E6]', 'types.A2.positive_roots]']) {
      const e = thrown(() => resolveGoldenPath(path));
      expect(e.message).not.toContain('resolves to');
    }
  });

  it('compares selection values as text', () => {
    // An integer field compares as its decimal digits.
    const order3 = g.folding.filter((r) => r.type === 'D4' && r.order === 3);
    expect(resolveGoldenPath('folding[type=D4;order=3]')).toBe(order3[0]);
    // A list of integers compares as its entries joined by commas with no spaces.
    expect(() => resolveGoldenPath('wythoff[type=F4;rings=1, 0, 0, 0]')).toThrow(GoldenPathError);
    expect(() => resolveGoldenPath('wythoff[type=F4;rings=[1,0,0,0]]')).toThrow(GoldenPathError);
    const other = g.wythoff.filter((r) => r.type === 'F4' && r.rings.join(',') === '0,0,0,1');
    expect(other).toHaveLength(1);
    expect(resolveGoldenPath('wythoff[type=F4;rings=0,0,0,1].f_vector')).toEqual(other[0]!.f_vector);
    // A string compares as it stands, hyphen and brackets included.
    expect(() => resolveGoldenPath('satake[dynkin_type=E6;real_form=e6(−14)].dim_k')).toThrow(GoldenPathError);
    // A field the record lacks never matches.
    expect(thrown(() => resolveGoldenPath('folding[type=D4;nonexistent=3]')).count).toBe(0);
  });
});

describe('formatGoldenValue', () => {
  it('formats integers', () => {
    expect(formatGoldenValue(123456789)).toBe(`123${NNBSP}456${NNBSP}789`);
    expect(formatGoldenValue(-1)).toBe(`${MINUS}1`);
    expect(formatGoldenValue(-14)).toBe(`${MINUS}14`);
    expect(formatGoldenValue(9999)).toBe('9999');
    expect(formatGoldenValue(10000)).toBe(`10${NNBSP}000`);
    expect(formatGoldenValue(-12345)).toBe(`${MINUS}12${NNBSP}345`);
    expect(formatGoldenValue(0)).toBe('0');

    const w = g.types.E8.weyl_order;
    const printed = formatGoldenValue(w);
    expect(printed.split(NNBSP).join('')).toBe(String(w));
    const groups = printed.split(NNBSP);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0]!.length).toBeGreaterThanOrEqual(1);
    expect(groups[0]!.length).toBeLessThanOrEqual(3);
    for (const group of groups.slice(1)) expect(group).toHaveLength(3);
    for (const s of [printed, formatGoldenValue(-1), formatGoldenValue(123456789)]) assertProseCharacters(s);
  });

  it('formats lists, strings and the as attribute', () => {
    expect(formatGoldenValue([3, 5, 7, 11])).toBe('(3, 5, 7, 11)');
    expect(formatGoldenValue([-1, 1])).toBe(`(${MINUS}1, 1)`);
    expect(formatGoldenValue([12345, 2])).toBe(`(12${NNBSP}345, 2)`);
    expect(formatGoldenValue(['X1~', 'Y2^(2)'])).toBe('(X1~, Y2^(2))');
    expect(formatGoldenValue([3, 1, 2], 'word')).toBe(`3${THIN}1${THIN}2`);
    expect(formatGoldenValue(resolveGoldenPath('types.A2.longest_word'), 'word')).toBe(g.types.A2.longest_word.join(THIN));
    expect(formatGoldenValue(resolveGoldenPath('types.E8.positive_roots'), 'count')).toBe(formatGoldenValue(g.types.E8.positive_roots.length));
    expect(formatGoldenValue(resolveGoldenPath('types.E8.positive_roots'), 'count')).toBe(formatGoldenValue(g.types.E8.n_positive_roots));
    expect(formatGoldenValue(123456789, 'plain')).toBe('123456789');
    expect(formatGoldenValue([3, 5, 7, 11], 'plain')).toBe('3, 5, 7, 11');
    expect(formatGoldenValue(-3, 'plain')).toBe(`${MINUS}3`);
    expect(formatGoldenValue('X1')).toBe('X1');
    // A string keeps its hyphen-minus: it is printed as it stands.
    expect(formatGoldenValue('x6(-14)')).toBe('x6(-14)');
    expect(formatGoldenValue([-1, 1])).not.toContain(NBSP);
    assertProseCharacters(formatGoldenValue([-1, 1]));
    assertProseCharacters(formatGoldenValue([-1, 1], 'plain'));
    assertProseCharacters(formatGoldenValue([-2, 3], 'word'));
  });

  it('refuses values that are not for prose', () => {
    for (const v of [true, null, 0.5, [[2, -1], [-1, 2]], { a: 1 }, [1, 'a'], undefined]) {
      const e = thrown(() => formatGoldenValue(v));
      expect(e.message).toMatch(/<Tex>|table/);
    }
    thrown(() => formatGoldenValue(5, 'count'));
    thrown(() => formatGoldenValue(5, 'word'));
    thrown(() => formatGoldenValue([1, 2], 'bogus' as never));
  });

  it('goldenProse names the path when the value is not for prose', () => {
    const e = thrown(() => goldenProse('types.E8.cartan'));
    expect(e.message).toContain('types.E8.cartan');
    expect(goldenProse('types.E8.weyl_order')).toBe(formatGoldenValue(g.types.E8.weyl_order));
  });
});

describe('substituteGoldenInTex', () => {
  it('substituteGoldenInTex groups digits with \\, and passes TeX through', () => {
    const prefix = '|W(E_8)| = ';
    const out = substituteGoldenInTex(`${prefix}{{types.E8.weyl_order}}`);
    expect(out.startsWith(prefix)).toBe(true);
    const rest = out.slice(prefix.length);
    expect(rest.split('\\,').join('')).toBe(String(g.types.E8.weyl_order));
    const groups = rest.split('\\,');
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0]!.length).toBeLessThanOrEqual(3);
    for (const group of groups.slice(1)) expect(group).toHaveLength(3);

    expect(substituteGoldenInTex('{{types.F4.weyl_order}}')).toBe(String(g.types.F4!.weyl_order));
    expect(String(g.types.F4!.weyl_order)).toHaveLength(4);
    expect(substituteGoldenInTex('\\frac{1}{2}')).toBe('\\frac{1}{2}');
    expect(substituteGoldenInTex('{{ types.E8.weyl_order }}')).toBe(substituteGoldenInTex('{{types.E8.weyl_order}}'));
    expect(substituteGoldenInTex('a = {{types.A2.positive_roots[0]}}')).toBe(`a = (${g.types.A2.positive_roots[0]!.join(', ')})`);
    expect(substituteGoldenInTex('{{folding[type=D4;order=3].folds_to}}')).toBe(String(g.folding.filter((r) => r.type === 'D4' && r.order === 3)[0]!.folds_to));
    // Two substitutions in one source.
    expect(substituteGoldenInTex('{{types.F4.weyl_order}} + {{types.F4.weyl_order}}')).toBe(`${g.types.F4!.weyl_order} + ${g.types.F4!.weyl_order}`);
  });

  it('substituteGoldenInTex fails on a path that does not resolve or an unclosed brace', () => {
    expect(thrown(() => substituteGoldenInTex('{{types.E9.x}}')).message).toContain('types.E9.x');
    expect(thrown(() => substituteGoldenInTex('a {{types.E8.weyl_order')).message).toContain('a {{types.E8.weyl_order');
    thrown(() => substituteGoldenInTex('{{types.E8.cartan}}'));
    thrown(() => substituteGoldenInTex('\\frac{{a}}{b}'));
  });

  it('writes the ASCII hyphen-minus for a negative number in TeX', () => {
    // types.A2.cartan[0] is a row of the Cartan matrix of A2; its off-diagonal entry is negative.
    const row = (g.types.A2!.cartan as number[][])[0]!;
    expect(row.some((x) => x < 0)).toBe(true);
    expect(substituteGoldenInTex('{{types.A2.cartan[0]}}')).toBe(`(${row.map(String).join(', ')})`);
  });
});
