// P6-A5: LaTeX export (SPEC.md 6.7; 2.15 "The decorated board", "What the diagram does not show";
// 6.4 fields of a catalogue record; 4.0 "Share and export", "Long numbers"; 7.4 "Citing"; CONTRACTS.md 4).
// The inputs of the Satake sweeps are the stored fields `black_nodes` and `tau` of the 167 records of
// the golden key `satake`, read as data; the expected strings of the three forms are typed from SPEC
// 6.7 (they are text of the specification, not golden values). No covers() call: `satake` is covered by
// P6-A1 and P6-A2's golden tests; this file only reads it as input.
import { describe, expect, it } from 'vitest';
import golden from '../../../reference/golden_data.json';
import * as ex from '@lib/export';
import { citationTitle, citeText, defaultLatexExport, exportLaTeX, latexFile, localIsoDate, NOTHING_TO_EXPORT_LATEX, SITE_NAME } from '@lib/export';
import type { ToolState } from '@lib/state';

interface SatakeRow {
  dynkin_type: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  arrows: [number, number][];
  rank: number;
  tau_moves_black_nodes: boolean;
}

const RECORDS = (golden as unknown as { satake: SatakeRow[] }).satake;
const TYPES = golden.types as unknown as Record<string, { cartan: number[][] }>;
const TYPE_NAMES = Object.keys(TYPES);

function record(type: string, form: string): SatakeRow {
  const found = RECORDS.filter((r) => r.dynkin_type === type && r.real_form === form);
  expect(found, `${type} ${form}`).toHaveLength(1);
  return found[0]!;
}

const dynkinOf = (r: SatakeRow): string => exportLaTeX('dynkin', { type: r.dynkin_type, black: r.black_nodes, tau: r.tau });

/** The parts of a \dynkin line: the involutions option (null when absent), the family letter, the marks. */
function parse(line: string): { option: string | null; letter: string; marks: string } {
  const m = /^\\dynkin(?:\[involutions=\{([0-9;]+)\}\])? ([A-G])\{([o*]+)\}$/.exec(line);
  expect(m, line).not.toBeNull();
  return { option: m![1] ?? null, letter: m![2]!, marks: m![3]! };
}

describe('exportLaTeX dynkin (SPEC 6.7)', () => {
  it('the three forms of SPEC 6.7 byte for byte', () => {
    expect(dynkinOf(record('E6', 'e6(-14)'))).toBe('\\dynkin[involutions={16}] E{oo***o}');
    expect(dynkinOf(record('E7', 'e7(-5)'))).toBe('\\dynkin E{o*oo*o*}');
    expect(dynkinOf(record('A5', 'su(2,4)'))).toBe('\\dynkin[involutions={15;24}] A{oo*oo}');
    // The same inputs written out, as P6-A3 and P6-A4 will pass them.
    expect(exportLaTeX('dynkin', { type: 'E6', black: [3, 4, 5], tau: [6, 2, 5, 4, 3, 1] })).toBe('\\dynkin[involutions={16}] E{oo***o}');
    // No trailing newline: latexFile adds the line ends.
    expect(exportLaTeX('dynkin', { type: 'E7', black: [2, 5, 7] }).endsWith('}')).toBe(true);
  });

  it('one mark per node in Bourbaki order for every satake record', () => {
    expect(RECORDS).toHaveLength(167);
    for (const r of RECORDS) {
      const { letter, marks } = parse(dynkinOf(r));
      const where = `${r.dynkin_type} ${r.real_form}`;
      expect(letter, where).toBe(r.dynkin_type[0]);
      expect(marks.length, where).toBe(r.rank);
      expect(marks.length, where).toBe(TYPES[r.dynkin_type]!.cartan.length);
      const black = [...marks].flatMap((c, k) => (c === '*' ? [k + 1] : []));
      expect(black, where).toEqual([...r.black_nodes].sort((a, b) => a - b));
    }
  });

  it('the involutions option equals the golden arrows for every satake record', () => {
    let withArrows = 0;
    for (const r of RECORDS) {
      const { option } = parse(dynkinOf(r));
      const where = `${r.dynkin_type} ${r.real_form}`;
      if (r.arrows.length === 0) {
        expect(option, where).toBeNull();
        expect(dynkinOf(r), where).not.toContain('involutions');
      } else {
        withArrows++;
        expect(option, where).toBe(r.arrows.map(([a, b]) => `${a}${b}`).join(';'));
      }
    }
    expect(withArrows).toBeGreaterThan(0);
    expect(withArrows).toBeLessThan(RECORDS.length);
  });

  it('tau on black nodes is never exported', () => {
    // e6(-14): tau swaps 3 and 5, both black; only 1 and 6 are joined (the classic mistake is {16;35}).
    expect(dynkinOf(record('E6', 'e6(-14)'))).not.toContain('35');
    // so(1,7) on D4: tau swaps 3 and 4, both black: no arrow at all.
    expect(dynkinOf(record('D4', 'so(1,7)'))).toBe('\\dynkin D{o***}');
    // The compact form su(4): tau is the flip, every node black.
    expect(dynkinOf(record('A3', 'su(4)'))).toBe('\\dynkin A{***}');
    // Every pair written joins two white nodes, also on every record where tau moves black nodes.
    let moved = 0;
    for (const r of RECORDS) {
      const { option, marks } = parse(dynkinOf(r));
      if (r.tau_moves_black_nodes) moved++;
      for (const pair of option === null ? [] : option.split(';')) {
        expect(pair, `${r.dynkin_type} ${r.real_form}`).toMatch(/^[1-9][1-9]$/);
        for (const label of pair) expect(marks[Number(label) - 1], `${r.dynkin_type} ${r.real_form} ${pair}`).toBe('o');
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('no named diagram syntax', () => {
    const outputs = [...RECORDS.map(dynkinOf), ...TYPE_NAMES.map((t) => exportLaTeX('dynkin', { type: t }))];
    for (const line of outputs) {
      expect(line).not.toMatch(/\{[IVX]+\}/);
      expect(line).not.toContain('fold');
      expect(line).not.toMatch(/\\dynkin(\[[^\]]*\])? [A-G][0-9]/); // never the rank after the letter (\dynkin E6)
      expect(parse(line).marks).toMatch(/^[o*]+$/); // no ellipsis marks
    }
  });

  it('undecorated diagram for each of the 32 types', () => {
    expect(TYPE_NAMES).toHaveLength(32);
    for (const t of TYPE_NAMES) {
      const n = TYPES[t]!.cartan.length;
      expect(exportLaTeX('dynkin', { type: t }), t).toBe(`\\dynkin ${t[0]}{${'o'.repeat(n)}}`);
      // An empty black set and the identity give the same.
      const identity = Array.from({ length: n }, (_, k) => k + 1);
      expect(exportLaTeX('dynkin', { type: t, black: [], tau: identity }), t).toBe(`\\dynkin ${t[0]}{${'o'.repeat(n)}}`);
    }
    expect(exportLaTeX('dynkin', { type: 'E8' })).toBe('\\dynkin E{oooooooo}');
    expect(exportLaTeX('dynkin', { type: 'G2' })).toBe('\\dynkin G{oo}');
    // B2 and C2: the letter of the name given (D19), never normalised.
    expect(exportLaTeX('dynkin', { type: 'C2' })).toBe('\\dynkin C{oo}');
    expect(exportLaTeX('dynkin', { type: 'B2' })).toBe('\\dynkin B{oo}');
    expect(dynkinOf(record('C2', 'sp(1,1)'))).toBe('\\dynkin C{*o}');
  });

  it('invalid dynkin data throws RangeError', () => {
    const bad: unknown[] = [
      null,
      undefined,
      'E6',
      {},
      { type: 6 },
      // not a finite type the package draws with marks: affine, twisted, presets, custom, out of range
      { type: 'A4~' },
      { type: 'C2~' },
      { type: 'B2~' },
      { type: 'D4^(3)' },
      { type: 'A2^(2)' },
      { type: 'pentagon' },
      { type: 'square' },
      { type: 'H3' },
      { type: 'A0' },
      { type: 'A9' },
      { type: 'B1' },
      { type: 'C9' },
      { type: 'D3' },
      { type: 'E5' },
      { type: 'E9' },
      { type: 'F3' },
      { type: 'G3' },
      { type: 'e6' },
      { type: ' E6' },
      { type: 'E06' },
      { type: { cartan: [[2, -1], [-1, 2]] } },
      // labels out of range or repeated
      { type: 'E6', black: [0] },
      { type: 'E6', black: [7] },
      { type: 'E6', black: [3, 3] },
      { type: 'E6', black: [1.5] },
      { type: 'E6', black: '3' },
      // tau: wrong length, not a permutation, out of range, not an involution
      { type: 'A3', tau: [1, 2] },
      { type: 'A3', tau: [1, 1, 3] },
      { type: 'A3', tau: [1, 2, 4] },
      { type: 'A3', tau: [2, 3, 1] },
      { type: 'A3', tau: [3, 2, '1'] },
      { type: 'A3', tau: 'identity' },
    ];
    for (const data of bad) expect(() => exportLaTeX('dynkin', data), JSON.stringify(data) ?? String(data)).toThrow(RangeError);
    // An unknown kind is refused too.
    expect(() => exportLaTeX('dot' as 'dynkin', { type: 'A2' })).toThrow(RangeError);
    // The message names the fault.
    expect(() => exportLaTeX('dynkin', { type: 'A4~' })).toThrow(/A4~/);
    expect(() => exportLaTeX('dynkin', { type: 'A3', tau: [2, 3, 1] })).toThrow(/tau/);
    expect(() => exportLaTeX('dynkin', { type: 'E6', black: [7] })).toThrow(/7/);
  });
});

describe('exportLaTeX TikZ (SPEC 6.7 "plain TikZ coordinates")', () => {
  it('tikz-graph writes one node per vertex and one draw per edge', () => {
    const graph = { nodes: [{ x: 0, y: 0, label: '1' }, { x: 1.5, y: -1 }], edges: [[0, 1]] as [number, number][] };
    expect(exportLaTeX('tikz-graph', graph)).toBe(
      [
        '\\begin{tikzpicture}',
        '  \\node[circle,draw,inner sep=1pt] (n0) at (0,0) {$1$};',
        '  \\node[circle,draw,inner sep=1pt] (n1) at (1.5,-1) {};',
        '  \\draw (n0) -- (n1);',
        '\\end{tikzpicture}',
      ].join('\n'),
    );
    // Directed: an arrow tip on the same straight segment.
    expect(exportLaTeX('tikz-graph', { ...graph, directed: true })).toContain('  \\draw[->] (n0) -- (n1);');
    // Counts, order, no library.
    const nodes = Array.from({ length: 5 }, (_, k) => ({ x: k, y: k % 2, label: String(k + 1) }));
    const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2]];
    const text = exportLaTeX('tikz-graph', { nodes, edges });
    expect(text.match(/\\node\[/g)).toHaveLength(5);
    expect(text.match(/\\draw /g)).toHaveLength(6);
    expect([...text.matchAll(/\\draw \(n(\d+)\) -- \(n(\d+)\);/g)].map((m) => [Number(m[1]), Number(m[2])])).toEqual(edges);
    expect([...text.matchAll(/\(n(\d+)\) at/g)].map((m) => Number(m[1]))).toEqual([0, 1, 2, 3, 4]);
    expect(text).not.toContain('usetikzlibrary');
    expect(text.endsWith('\\end{tikzpicture}')).toBe(true);
    // An empty graph is still a picture.
    expect(exportLaTeX('tikz-graph', { nodes: [], edges: [] })).toBe('\\begin{tikzpicture}\n\\end{tikzpicture}');
    // Refusals: an edge to a node that does not exist, a coordinate that is not a number.
    for (const data of [null, {}, { nodes: [{ x: 0, y: 0 }], edges: [[0, 1]] }, { nodes: [{ x: 0, y: 0 }], edges: [[0, 0.5]] }, { nodes: [{ x: '0', y: 0 }], edges: [] }, { nodes: [], edges: 'none' }]) {
      expect(() => exportLaTeX('tikz-graph', data), JSON.stringify(data)).toThrow(RangeError);
    }
  });

  it('tikz-points writes plain coordinates', () => {
    const data = { points: [[0, 0], [1, 2.5], [-1.25, 0.5]] as [number, number][], edges: [[0, 1], [1, 2]] as [number, number][] };
    expect(exportLaTeX('tikz-points', data)).toBe(
      [
        '\\begin{tikzpicture}',
        '  \\fill (0,0) circle (1pt);',
        '  \\fill (1,2.5) circle (1pt);',
        '  \\fill (-1.25,0.5) circle (1pt);',
        '  \\draw (0,0) -- (1,2.5);',
        '  \\draw (1,2.5) -- (-1.25,0.5);',
        '\\end{tikzpicture}',
      ].join('\n'),
    );
    // Without edges: points only.
    expect(exportLaTeX('tikz-points', { points: [[3, 4]] })).toBe('\\begin{tikzpicture}\n  \\fill (3,4) circle (1pt);\n\\end{tikzpicture}');
    // A label is written beside its point, after the point; null means none.
    const labelled = exportLaTeX('tikz-points', { points: [[0, 0], [1, 1]], labels: ['a_1', null] });
    expect(labelled).toBe(
      ['\\begin{tikzpicture}', '  \\fill (0,0) circle (1pt);', '  \\node[anchor=south west,inner sep=1pt] at (0,0) {$a\\_1$};', '  \\fill (1,1) circle (1pt);', '\\end{tikzpicture}'].join('\n'),
    );
    for (const bad of [null, { points: 'x' }, { points: [[0]] }, { points: [[0, 0]], edges: [[0, 1]] }, { points: [[0, 0]], labels: [1] }, { points: [[0, 0]], labels: ['a', 'b'] }]) {
      expect(() => exportLaTeX('tikz-points', bad), JSON.stringify(bad)).toThrow(RangeError);
    }
  });

  it('coordinates have at most four decimals and no minus zero', () => {
    const at = (x: number, y: number): string => exportLaTeX('tikz-points', { points: [[x, y]] }).split('\n')[1]!;
    expect(at(1.23456789, -9.87654321)).toBe('  \\fill (1.2346,-9.8765) circle (1pt);');
    expect(at(2.5, 3)).toBe('  \\fill (2.5,3) circle (1pt);');
    expect(at(2.50001, 0.1)).toBe('  \\fill (2.5,0.1) circle (1pt);');
    expect(at(-0, -0.00001)).toBe('  \\fill (0,0) circle (1pt);');
    expect(at(-0.00004, 0.00005)).toBe('  \\fill (0,0.0001) circle (1pt);');
    expect(at(1e-7, 123456.000049)).toBe('  \\fill (0,123456) circle (1pt);');
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => exportLaTeX('tikz-points', { points: [[v, 0]] })).toThrow(RangeError);
      expect(() => exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: v }], edges: [] })).toThrow(RangeError);
    }
    // Every coordinate written by the sweep matches the number rule.
    const pts = Array.from({ length: 200 }, (_, k) => [Math.sin(k) * 7.123456, Math.cos(k * 1.7) * -3.000049] as [number, number]);
    const text = exportLaTeX('tikz-points', { points: pts });
    for (const m of text.matchAll(/\(([^,()]+),([^,()]+)\)/g)) {
      for (const n of [m[1]!, m[2]!]) {
        expect(n).toMatch(/^-?(0|[1-9]\d*)(\.\d{0,3}[1-9])?$/);
        expect(n).not.toBe('-0');
      }
    }
  });

  it('labels keep every digit', () => {
    const long = '123456789012345678901234567890';
    expect(long).toHaveLength(30);
    const graph = exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0, label: `-${long}` }], edges: [] });
    expect(graph).toContain(`{$-${long}$}`);
    const points = exportLaTeX('tikz-points', { points: [[0, 0]], labels: [long] });
    expect(points).toContain(`{$${long}$}`);
    // TeX special characters are escaped, in forms valid in math mode with no package beyond TikZ.
    const special = exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0, label: '\\ # $ % & _ { } ~ ^' }], edges: [] });
    expect(special).toContain('{$\\mbox{\\textbackslash} \\# \\$ \\% \\& \\_ \\{ \\} \\mbox{\\textasciitilde} \\mbox{\\textasciicircum}$}');
  });
});

describe('the downloaded file and the citation', () => {
  it('the downloaded file names its package and link', () => {
    const link = 'http://localhost/tools/board?z=1&g=E6';
    const body = exportLaTeX('dynkin', { type: 'E6' });
    expect(latexFile('dynkin', body, link)).toBe(`% ${link}\n% needs \\usepackage{dynkin-diagrams}\n\\dynkin E{oooooo}\n`);
    const graph = exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0 }], edges: [] });
    expect(latexFile('tikz-graph', graph, link)).toBe(`% ${link}\n% needs \\usepackage{tikz}\n${graph}\n`);
    const pts = exportLaTeX('tikz-points', { points: [[0, 0]] });
    expect(latexFile('tikz-points', pts, link)).toBe(`% ${link}\n% needs \\usepackage{tikz}\n${pts}\n`);
    // A snippet to \input, not a document.
    expect(latexFile('dynkin', body, link)).not.toContain('\\documentclass');
    // A link with a line break would end the comment early: it is refused.
    expect(() => latexFile('dynkin', body, 'http://x/\n\\bad')).toThrow(RangeError);
  });

  it('citeText holds title, site name, version, date and link', () => {
    const parts = { title: 'Game Board', siteName: 'Two Games on a Dynkin Diagram', commit: '3f2a9c1', date: '2026-11-02', link: 'https://owner.github.io/repo/tools/board?z=1&g=A2&w=1.2' };
    expect(citeText(parts)).toBe('Game Board. Two Games on a Dynkin Diagram, site version 3f2a9c1, 2026-11-02. https://owner.github.io/repo/tools/board?z=1&g=A2&w=1.2');
    // A title that ends a sentence itself gets no second stop.
    expect(citeText({ ...parts, title: 'Which boards are finite?' })).toBe(
      'Which boards are finite? Two Games on a Dynkin Diagram, site version 3f2a9c1, 2026-11-02. https://owner.github.io/repo/tools/board?z=1&g=A2&w=1.2',
    );
    expect(SITE_NAME).toBe('Two Games on a Dynkin Diagram');
    // The page title without the layout's suffix; a title without the suffix stays as it is.
    expect(citationTitle('The mutation game: Two Games on a Dynkin Diagram')).toBe('The mutation game');
    expect(citationTitle('Game Board')).toBe('Game Board');
    expect(citationTitle('Two Games on a Dynkin Diagram')).toBe('Two Games on a Dynkin Diagram');
    expect(citationTitle('  Orbit Garden  ')).toBe('Orbit Garden');
    // The reader's local date, ISO 8601.
    expect(localIsoDate(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
    expect(localIsoDate(new Date(2027, 0, 9, 0, 0))).toBe('2027-01-09');
  });

  it('the default export of a tool is the diagram of its named finite board', () => {
    const state = (board: ToolState['board'], extra: Partial<ToolState> = {}): ToolState => ({ schema: 1, tool: 'board', board, ...extra });
    expect(defaultLatexExport(state('E6'))).toEqual({ kind: 'dynkin', data: { type: 'E6', black: [], tau: [1, 2, 3, 4, 5, 6] } });
    expect(defaultLatexExport(state('A3', { black: [2], tau: [3, 2, 1] }))).toEqual({ kind: 'dynkin', data: { type: 'A3', black: [2], tau: [3, 2, 1] } });
    const d = defaultLatexExport(state('A3', { black: [2], tau: [3, 2, 1] }))!;
    expect(exportLaTeX(d.kind, d.data)).toBe('\\dynkin[involutions={13}] A{o*o}');
    for (const board of ['A4~', 'C2~', 'D4^(3)', 'pentagon', 'square', 'H3'] as const) expect(defaultLatexExport(state(board)), board).toBeNull();
    expect(defaultLatexExport(state({ cartan: [[2, -1], [-1, 2]] }))).toBeNull();
    expect(NOTHING_TO_EXPORT_LATEX).toBe('nothing to export as LaTeX');
  });
});

describe('export module without a DOM', () => {
  it('the export module loads in Node without a DOM', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    expect(typeof ex.exportLaTeX).toBe('function');
    expect(typeof ex.latexFile).toBe('function');
    expect(typeof ex.citeText).toBe('function');
    expect(ex.exportLaTeX('dynkin', { type: 'A2' })).toBe('\\dynkin A{oo}');
  });
});
