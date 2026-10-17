// The golden key e8.h4_projection (SPEC.md 2.17: "Seen in Euclidean coordinates this is the projection of
// the 240 roots of E8 onto the 4-dimensional space belonging to the exponents 1, 11, 19, 29, where they form
// two 600-cells whose radii are in the ratio phi [V]"; 5.7 "e8.h4_projection is tested as in the oracle: the
// roots projected to the rows of E belonging to the exponents 1, 11, 19, 29 lie on two shells of 120 points
// whose radii are in the ratio phi to five decimals"; verify.py lines 1305 to 1323; P4-A1 instruction 5.14).
// The exponent of row k of E is recovered from its eigenvalue; radius_ratio is text and is not compared
// (rule 6). Plan addition, the oracle's own extra check: each shell is a 600-cell (12 nearest neighbours
// each, edge = radius / phi).
import { describe, expect, it } from 'vitest';
import { euclideanBasis } from '../../src/geometry';
import { coxeterNumber } from '../../src/guards';
import { roots } from '../../src/search';
import { boardOf, covers, golden, intEq } from './_harness';

covers('e8.h4_projection');

interface H4Projection {
  exponents_kept: number[];
  shell_sizes: number[];
  radius_ratio: string;
}

const H4 = (golden.e8 as { h4_projection: H4Projection }).h4_projection;
const PHI = (1 + Math.sqrt(5)) / 2;

function round6(x: number): number {
  const r = Math.round(x * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

/** The projection of the 240 roots to the rows of E whose exponents are kept. */
function projection() {
  const board = boardOf('E8');
  const { E, eigenvalues } = euclideanBasis(board);
  const h = coxeterNumber(board);
  // the exponent attached to each eigenvalue, the argument of acos clamped against rounding noise (trap 16)
  const exponentOf = eigenvalues.map((w) => Math.round((h / Math.PI) * Math.acos(Math.min(1, Math.max(-1, 1 - w / 2)))));
  const keep = exponentOf.map((_, k) => k).filter((k) => H4.exponents_kept.includes(exponentOf[k]!));
  const R = roots(board, 1000).items;
  const points = R.map((r) => keep.map((k) => E[k]!.reduce((s, x, j) => s + x * r[j]!, 0)));
  const radii = points.map((p) => round6(Math.hypot(...p)));
  return { h, exponentOf, keep, R, points, radii };
}

describe('E8 to H4', () => {
  it('keeps exactly the four rows of the exponents 1, 11, 19, 29', () => {
    const { h, exponentOf, keep, R } = projection();
    expect(h).toBe(30);
    expect(R.length).toBe(240);
    expect(keep.length).toBe(4);
    intEq(keep.map((k) => exponentOf[k]!), H4.exponents_kept);
  });

  it('two shells of 120 in the golden ratio', () => {
    const { radii } = projection();
    const shells = new Map<number, number>();
    for (const r of radii) shells.set(r, (shells.get(r) ?? 0) + 1);
    const rs = [...shells.keys()].sort((a, b) => a - b);
    intEq(rs.map((r) => shells.get(r)!), H4.shell_sizes);
    expect(Math.abs(rs[1]! / rs[0]! - PHI)).toBeLessThan(1e-5);
  });

  it('each shell is a 600-cell: 12 nearest neighbours each, edge = radius / phi', () => {
    const { points, radii } = projection();
    const rs = [...new Set(radii)].sort((a, b) => a - b);
    for (const r of rs) {
      const shell = points.filter((_, k) => radii[k] === r);
      const dist = shell.map((a) => shell.map((b) => (a === b ? 1e9 : Math.hypot(...a.map((x, i) => x - b[i]!)))));
      const dmin = Math.min(...dist.map((row) => Math.min(...row)));
      for (const row of dist) expect(row.filter((x) => Math.abs(x - dmin) < 1e-6).length).toBe(12);
      expect(Math.abs(dmin / r - 1 / PHI)).toBeLessThan(1e-5);
    }
  });
});
