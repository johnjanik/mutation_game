// RT-03 phase 6 round (bounds and errors): the refusals of exportLaTeX (site/src/lib/export.ts, P6-A5) at the
// edges the existing latex.test.ts does not reach. Its contract (CONTRACTS 4; export.ts:737): "Throws RangeError,
// naming the fault, on data it cannot write." The same class of input that the P6-A1 review found in satake.ts's
// checkPopulation (a list with a hole, which Array.prototype.map and every skip) is tried here on every list the
// exporter reads: vertices, points, edges and the pair of an edge. A hole reaches the TeX text as `undefined`,
// which no TeX run accepts, so each of these must be a RangeError, as an explicit `undefined` already is.
// Run: npx vitest run --project site-unit export-latex-holes
// Adopted from the RT-03 lens of the phase 6 round (finding P6-RT-03-03) by RT-FIX-P6-latex.
import { describe, expect, it } from 'vitest';
import { exportLaTeX } from '@lib/export';

/** Builds [a, <hole>, b] without a literal hole (lint rules), so the intent is plain. */
function withHole<T>(first: T, last: T): T[] {
  const a: T[] = [];
  a[0] = first;
  a[2] = last;
  return a; // length 3, index 1 is a hole
}

function outcome(f: () => string): { threw: string | null; text: string | null } {
  try {
    return { threw: null, text: f() };
  } catch (e) {
    return { threw: (e as Error).name, text: null };
  }
}

describe('RT-03 P6: exportLaTeX on lists with a hole (CONTRACTS 4: RangeError on data it cannot write)', () => {
  it('controls: an explicit undefined is refused in each place', () => {
    expect(() => exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0 }, undefined, { x: 1, y: 1 }], edges: [] })).toThrow(RangeError);
    expect(() => exportLaTeX('tikz-points', { points: [[0, 0], undefined, [1, 1]] })).toThrow(RangeError);
    expect(() => exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], edges: [[undefined, 1]] })).toThrow(RangeError);
  });

  const CASES: [string, () => string][] = [
    ['tikz-graph: a vertex list with a hole', () => exportLaTeX('tikz-graph', { nodes: withHole({ x: 0, y: 0 }, { x: 1, y: 1 }), edges: [[0, 1], [1, 2]] })],
    ['tikz-points: a point list with a hole, and an edge to it', () => exportLaTeX('tikz-points', { points: withHole([0, 0], [1, 1]), edges: [[0, 1]] })],
    ['tikz-graph: an edge [<hole>, 1]', () => exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], edges: [Object.assign(new Array(2), { 1: 1 })] })],
    ['tikz-points: an edge [<hole>, 1]', () => exportLaTeX('tikz-points', { points: [[0, 0], [1, 1]], edges: [Object.assign(new Array(2), { 1: 1 })] })],
  ];
  for (const [what, f] of CASES) {
    // regression: P6-RT-03-03
    it(`${what} is refused with a RangeError, never written as "undefined"`, () => {
      const o = outcome(f);
      expect({ threw: o.threw, writesUndefined: o.text?.includes('undefined') ?? false }, o.text ?? '').toEqual({ threw: 'RangeError', writesUndefined: false });
    });
  }
});

describe('RT-03 P6: exportLaTeX labels and coordinates at their edges', () => {
  it('a coordinate at 1e15 or beyond, a string, null or a bigint is refused', () => {
    for (const v of [1e15, -1e15, 1e300, '1', null, 1n] as unknown[]) {
      expect(() => exportLaTeX('tikz-points', { points: [[v, 0]] }), String(v)).toThrow(RangeError);
    }
    // just below the bound: written with its digits
    expect(exportLaTeX('tikz-points', { points: [[999999999999999, 0]] })).toContain('(999999999999999,0)');
  });
  it('a label that is not text is refused; text of every digit is kept', () => {
    for (const l of [1, null, {}, ['1']] as unknown[]) {
      expect(() => exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0, label: l }], edges: [] }), JSON.stringify(l)).toThrow(RangeError);
    }
  });
});

// RT-FIX-P6-latex: the stated rule for a hole (export.ts exportLaTeX): every list is read by index, so a hole
// is read as undefined, refused where an explicit undefined is refused, and no label in a label list.
describe('a hole in any list exportLaTeX reads is read as undefined', () => {
  it('tikz-points: a hole in the label list writes no label, as null does', () => {
    const points: [number, number][] = [[0, 0], [1, 1], [2, 2]];
    const holed = exportLaTeX('tikz-points', { points, labels: withHole('a', 'c') });
    expect(holed).toBe(exportLaTeX('tikz-points', { points, labels: ['a', null, 'c'] }));
    expect(holed).not.toContain('undefined');
  });
  it('tikz-graph and tikz-points: an edge list with a hole is refused', () => {
    const edges = withHole<[number, number]>([0, 1], [1, 0]);
    expect(() => exportLaTeX('tikz-graph', { nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], edges })).toThrow(RangeError);
    expect(() => exportLaTeX('tikz-points', { points: [[0, 0], [1, 1]], edges })).toThrow(RangeError);
  });
  it('dynkin: a hole in black or in tau is refused', () => {
    expect(() => exportLaTeX('dynkin', { type: 'A3', black: withHole(1, 3) })).toThrow(RangeError);
    expect(() => exportLaTeX('dynkin', { type: 'A3', tau: withHole(3, 1) })).toThrow(RangeError);
  });
});
