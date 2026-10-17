// P4-A2: the projector of SPEC.md 7.1 for T10 (Geometry Studio). Euclidean coordinates (2.14 step 4),
// rotations in coordinate planes, frames and the three turning angles, the j value of 6.6, the depth
// cue, scenes, the caps of 5.6 and the two renderers (Canvas 2D and the SVG snapshot of 7.4).
// Golden values are read from reference/golden_data.json with node:fs as data; no coverage is
// registered here (CONTRACTS.md 3). Random inputs come from a fixed linear congruential sequence.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as engine from '@engine';
import { boardFromName, choleskyBasis, formValue } from '@engine';
import type { AnyBoard } from '@engine';
import {
  apply,
  compose,
  defaultProjection,
  formatProjection,
  frameFor,
  parseProjection,
  project,
  rotationInPlane,
  toEuclidean,
  toEuclideanPopulation,
  turnFrame,
  type Frame,
  type View,
} from '../../src/components/draw/projector';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

interface GoldenType {
  highest_root: number[];
  numbers_of_highest_root: number[];
}
interface GoldenWythoff {
  type: string;
  rings: number[];
  f_vector: number[];
  edges_enumerated: boolean;
}
interface Golden {
  types: Record<string, GoldenType>;
  wythoff: GoldenWythoff[];
  e8: { neighbours_at_inner_product_1: number };
}
const golden = JSON.parse(readFileSync(resolve(ROOT, 'reference/golden_data.json'), 'utf8')) as Golden;

/** A fixed linear congruential sequence of floats in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, i) => s + x * b[i]!, 0);
const maxDiff = (a: readonly number[], b: readonly number[]): number => {
  expect(a.length).toBe(b.length);
  return a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i]!)), 0);
};
const randomVector = (rnd: () => number, n: number, scale = 2): number[] =>
  Array.from({ length: n }, () => (2 * rnd() - 1) * scale);
const randomInts = (rnd: () => number, n: number): number[] =>
  Array.from({ length: n }, () => Math.floor(rnd() * 19) - 9);
const ratToFloat = (r: { num: bigint; den: bigint }): number => Number(r.num) / Number(r.den);

/** Every pair of the frame's vectors (w only when present) is orthonormal within tol. */
function expectOrthonormal(f: Frame, tol: number): void {
  const vs = f.w === null ? [f.u, f.v] : [f.u, f.v, f.w];
  for (let i = 0; i < vs.length; i++) {
    for (let j = 0; j < vs.length; j++) {
      expect(Math.abs(dot(vs[i]!, vs[j]!) - (i === j ? 1 : 0))).toBeLessThanOrEqual(tol);
    }
  }
}
const frameDiff = (a: Frame, b: Frame): number =>
  Math.max(maxDiff(a.u, b.u), maxDiff(a.v, b.v), a.w === null || b.w === null ? 0 : maxDiff(a.w, b.w));

/** The bases E a test may use: Cholesky always, and euclideanBasis once P4-A1 has merged it. */
function bases(board: AnyBoard): { name: string; E: number[][] }[] {
  const out = [{ name: 'choleskyBasis', E: choleskyBasis(board) }];
  const eb = (engine as Record<string, unknown>)['euclideanBasis'];
  if (typeof eb === 'function') out.push({ name: 'euclideanBasis', E: (eb as (b: AnyBoard) => { E: number[][] })(board).E });
  return out;
}

describe('projector core: rotations', () => {
  it('rotationInPlane is the Givens rotation of the chosen coordinate plane', () => {
    const R = rotationInPlane(4, 1, 3, Math.PI / 6);
    const e1 = apply(R, [0, 1, 0, 0]);
    expect(maxDiff(e1, [0, Math.cos(Math.PI / 6), 0, Math.sin(Math.PI / 6)])).toBeLessThanOrEqual(1e-15);
    const e3 = apply(R, [0, 0, 0, 1]);
    expect(maxDiff(e3, [0, -Math.sin(Math.PI / 6), 0, Math.cos(Math.PI / 6)])).toBeLessThanOrEqual(1e-15);
    expect(apply(R, [1, 0, 0, 0])).toEqual([1, 0, 0, 0]);
    expect(apply(R, [0, 0, 1, 0])).toEqual([0, 0, 1, 0]);
    expect(() => rotationInPlane(3, 1, 1, 0.5)).toThrow(RangeError);
    expect(() => rotationInPlane(3, 0, 3, 0.5)).toThrow(RangeError);
  });

  it('compose multiplies in order: apply(compose(A, B), y) is A(B y)', () => {
    const rnd = lcg(11);
    for (let n = 2; n <= 8; n++) {
      const A = rotationInPlane(n, 0, n - 1, 0.7);
      const B = rotationInPlane(n, 0, 1, -1.3);
      const y = randomVector(rnd, n);
      expect(maxDiff(apply(compose(A, B), y), apply(A, apply(B, y)))).toBeLessThanOrEqual(1e-14);
      expect(maxDiff(apply(compose(A, B, A), y), apply(A, apply(B, apply(A, y))))).toBeLessThanOrEqual(1e-14);
    }
    // The two orders differ, so a test of the order can fail.
    const y = [1, 0, 0];
    const A = rotationInPlane(3, 0, 1, 1);
    const B = rotationInPlane(3, 1, 2, 1);
    expect(maxDiff(apply(compose(A, B), y), apply(compose(B, A), y))).toBeGreaterThan(0.1);
  });

  it('rotating by theta then minus theta is the identity to 1e-12', () => {
    const rnd = lcg(20261017);
    for (let n = 2; n <= 8; n++) {
      for (let k = 0; k < 20; k++) {
        const a = Math.floor(rnd() * n);
        let b = Math.floor(rnd() * (n - 1));
        if (b >= a) b += 1;
        const theta = (2 * rnd() - 1) * 4 * Math.PI;
        const y = randomVector(rnd, n, 5);
        const there = rotationInPlane(n, a, b, theta);
        const back = rotationInPlane(n, a, b, -theta);
        expect(maxDiff(apply(compose(there, back), y), y)).toBeLessThanOrEqual(1e-12);
        expect(maxDiff(apply(compose(back, there), y), y)).toBeLessThanOrEqual(1e-12);
        expect(maxDiff(apply(back, apply(there, y)), y)).toBeLessThanOrEqual(1e-12);
      }
    }
    // The turning angles: a turn, then its negation in reverse order (viewing, vertical, horizontal axis).
    for (let n = 2; n <= 8; n++) {
      const views: View[] = [{ kind: 'coxeter' }];
      if (n >= 3) views.push({ kind: 'xyz', axes: [n - 1, 0, 1] });
      for (const view of views) {
        for (let k = 0; k < 20; k++) {
          const t: [number, number, number] = [
            Math.floor(rnd() * 720) - 360,
            Math.floor(rnd() * 720) - 360,
            Math.floor(rnd() * 720) - 360,
          ];
          const f = frameFor(n, view);
          const turned = turnFrame(f, t);
          const back = turnFrame(turnFrame(turnFrame(turned, [0, 0, -t[2]]), [0, -t[1], 0]), [-t[0], 0, 0]);
          expect(frameDiff(back, f)).toBeLessThanOrEqual(1e-12);
        }
      }
    }
  });

  it('rotations and turns leave the dot product unchanged', () => {
    const rnd = lcg(7);
    for (let n = 2; n <= 8; n++) {
      for (let k = 0; k < 20; k++) {
        const R = compose(
          rotationInPlane(n, 0, n - 1, rnd() * 7),
          rotationInPlane(n, Math.floor(rnd() * (n - 1)), n - 1, rnd() * 7),
          rotationInPlane(n, 0, 1, rnd() * 7),
        );
        const y = randomVector(rnd, n);
        const z = randomVector(rnd, n);
        expect(Math.abs(dot(apply(R, y), apply(R, z)) - dot(y, z))).toBeLessThanOrEqual(1e-12);
      }
    }
    // On rank 3 the turned frame spans the whole space, so the three coordinates keep the dot product.
    for (let k = 0; k < 20; k++) {
      const f = turnFrame(frameFor(3, { kind: 'xyz', axes: [0, 1, 2] }), [
        Math.floor(rnd() * 360),
        Math.floor(rnd() * 360),
        Math.floor(rnd() * 360),
      ]);
      const y = randomVector(rnd, 3);
      const z = randomVector(rnd, 3);
      const py = project(f, y);
      const pz = project(f, z);
      expect(Math.abs(py.x * pz.x + py.y * pz.y + py.z * pz.z - dot(y, z))).toBeLessThanOrEqual(1e-12);
    }
  });
});

describe('projector core: frames', () => {
  it('frames are orthonormal and a vector in the chosen plane keeps its length', () => {
    const rnd = lcg(3);
    for (let n = 3; n <= 8; n++) {
      const views: View[] = [{ kind: 'coxeter' }, { kind: 'xyz', axes: [0, 1, 2] }, { kind: 'xyz', axes: [n - 1, 1, 0] }];
      for (const view of views) {
        const f = frameFor(n, view);
        expect(f.w).not.toBeNull();
        expectOrthonormal(f, 1e-12);
        for (let k = 0; k < 10; k++) {
          const t: [number, number, number] = [Math.floor(rnd() * 360), Math.floor(rnd() * 360), Math.floor(rnd() * 360)];
          const g = turnFrame(f, t);
          expectOrthonormal(g, 1e-12);
          // y = s u + t v projects to (s, t) with no depth.
          const s = 2 * rnd() - 1;
          const r = 2 * rnd() - 1;
          const y = g.u.map((x, i) => s * x + r * g.v[i]!);
          const p = project(g, y);
          expect(Math.abs(p.x - s)).toBeLessThanOrEqual(1e-12);
          expect(Math.abs(p.y - r)).toBeLessThanOrEqual(1e-12);
          expect(Math.abs(p.z)).toBeLessThanOrEqual(1e-12);
          expect(Math.abs(p.x * p.x + p.y * p.y - dot(y, y))).toBeLessThanOrEqual(1e-12);
        }
      }
    }
    // The Coxeter view is coordinates 0 and n - 1 of y, depth coordinate 1 (plan).
    const c = frameFor(5, { kind: 'coxeter' });
    expect(c.u).toEqual([1, 0, 0, 0, 0]);
    expect(c.v).toEqual([0, 0, 0, 0, 1]);
    expect(c.w).toEqual([0, 1, 0, 0, 0]);
    const xyz = frameFor(5, { kind: 'xyz', axes: [3, 0, 4] });
    expect(xyz.u).toEqual([0, 0, 0, 1, 0]);
    expect(xyz.v).toEqual([1, 0, 0, 0, 0]);
    expect(xyz.w).toEqual([0, 0, 0, 0, 1]);
    // Rank 2: no depth axis; only the turn about the viewing axis acts.
    const flat = frameFor(2, { kind: 'coxeter' });
    expect(flat.w).toBeNull();
    expectOrthonormal(flat, 1e-12);
    expect(turnFrame(flat, [37, 291, 0])).toEqual(flat);
    const spun = turnFrame(flat, [37, 291, 90]);
    expectOrthonormal(spun, 1e-12);
    expect(spun.w).toBeNull();
    expect(frameDiff(spun, flat)).toBeGreaterThan(0.5);
    const p = project(flat, [0.3, -0.4]);
    expect(p).toMatchObject({ x: 0.3, y: -0.4, z: 0 });
    expect(() => frameFor(2, { kind: 'xyz', axes: [0, 1, 1] })).toThrow(RangeError);
    // Rank 3 with xyz:1,2,3: the three coordinates hold the whole length.
    for (let k = 0; k < 10; k++) {
      const f = turnFrame(frameFor(3, { kind: 'xyz', axes: [0, 1, 2] }), [Math.floor(rnd() * 360), Math.floor(rnd() * 360), Math.floor(rnd() * 360)]);
      const y = randomVector(rnd, 3);
      const q = project(f, y);
      expect(Math.abs(q.x * q.x + q.y * q.y + q.z * q.z - dot(y, y))).toBeLessThanOrEqual(1e-12);
    }
  });

  it('the three turns act about the horizontal, vertical and viewing axes in that order', () => {
    const f = frameFor(3, { kind: 'xyz', axes: [0, 1, 2] });
    // About the viewing axis: the picture turns counterclockwise (y up), u and v move, w stays.
    const a = turnFrame(f, [0, 0, 90]);
    expect(maxDiff(a.w!, f.w!)).toBeLessThanOrEqual(1e-15);
    expect(maxDiff([project(a, [1, 0, 0]).x, project(a, [1, 0, 0]).y], [0, 1])).toBeLessThanOrEqual(1e-15);
    // About the horizontal axis: u stays, the top comes toward the viewer.
    const b = turnFrame(f, [90, 0, 0]);
    expect(maxDiff(b.u, f.u)).toBeLessThanOrEqual(1e-15);
    expect(project(b, [0, 1, 0]).z).toBeCloseTo(1, 14);
    // About the vertical axis: v stays, what faced the viewer goes to the right.
    const c = turnFrame(f, [0, 90, 0]);
    expect(maxDiff(c.v, f.v)).toBeLessThanOrEqual(1e-15);
    expect(project(c, [0, 0, 1]).x).toBeCloseTo(1, 14);
    // The order matters and is horizontal, then vertical, then viewing.
    const both = turnFrame(f, [90, 90, 0]);
    const stepwise = turnFrame(turnFrame(f, [90, 0, 0]), [0, 90, 0]);
    const reversed = turnFrame(turnFrame(f, [0, 90, 0]), [90, 0, 0]);
    expect(frameDiff(both, stepwise)).toBeLessThanOrEqual(1e-15);
    expect(frameDiff(both, reversed)).toBeGreaterThan(0.5);
  });
});

describe('projector core: Euclidean coordinates (SPEC 2.14)', () => {
  it('the Euclidean dot product is the invariant form', () => {
    const rnd = lcg(42);
    for (const name of ['A3', 'B3', 'G2', 'E8']) {
      const board = boardFromName(name);
      for (const { name: basis, E } of bases(board)) {
        for (let k = 0; k < 50; k++) {
          const p = randomInts(rnd, board.n);
          const q = randomInts(rnd, board.n);
          const form = formValue(board, p, q);
          expect(form, `${name} ${basis}`).not.toBeNull();
          const yp = toEuclideanPopulation(E, p);
          const yq = toEuclideanPopulation(E, q);
          expect(Math.abs(dot(yp, yq) - ratToFloat(form!)), `${name} ${basis} ${p} ${q}`).toBeLessThanOrEqual(1e-9);
        }
      }
    }
  });

  it('a position of the numbers game is drawn at E C^-1 a', () => {
    const A2 = boardFromName('A2');
    const E = choleskyBasis(A2);
    // C^-1 (1, 0) = (2/3, 1/3): a fractional population, so drawing E a instead would be caught.
    expect(maxDiff(toEuclidean(A2, E, [1, 0]), toEuclideanPopulation(E, [2 / 3, 1 / 3]))).toBeLessThanOrEqual(1e-12);
    expect(maxDiff(toEuclidean(A2, E, [1, 0]), toEuclideanPopulation(E, [1, 0]))).toBeGreaterThan(0.1);
    // E8 has det C = 1: the numbers of the highest root are drawn at E times the highest root.
    const E8 = boardFromName('E8');
    const g = golden.types['E8']!;
    for (const { name, E: F } of bases(E8)) {
      expect(maxDiff(toEuclidean(E8, F, g.numbers_of_highest_root), toEuclideanPopulation(F, g.highest_root)), name).toBeLessThanOrEqual(1e-12);
    }
    // A board with det C = 0 has no population for a position: a plain Error naming the board.
    const affine = boardFromName('A2~');
    expect(() => toEuclidean(affine, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [1n, 0n, 0n])).toThrow(/A2~/);
  });

  it('toEuclideanPopulation is y = E p', () => {
    const E = [
      [1, 2, 3],
      [0, 1, 4],
      [0, 0, 2],
    ];
    expect(toEuclideanPopulation(E, [1, -1, 2])).toEqual([5, 7, 4]);
  });
});

describe('projector core: the j value of SPEC 6.6', () => {
  it('parseProjection accepts the grammar of 6.6 and rejects the rest', () => {
    const n = boardFromName('E8').n;
    expect(parseProjection('coxeter', n)).toEqual({ view: { kind: 'coxeter' }, turn: [0, 0, 0] });
    expect(parseProjection('xyz:1,2,3', n)).toEqual({ view: { kind: 'xyz', axes: [0, 1, 2] }, turn: [0, 0, 0] });
    expect(parseProjection('xyz:1,2,3@30,20,0', n)).toEqual({ view: { kind: 'xyz', axes: [0, 1, 2] }, turn: [30, 20, 0] });
    expect(parseProjection('coxeter@0,0,90', n)).toEqual({ view: { kind: 'coxeter' }, turn: [0, 0, 90] });
    expect(parseProjection('xyz:8,1,4@-30,400,0', n)).toEqual({ view: { kind: 'xyz', axes: [7, 0, 3] }, turn: [-30, 400, 0] });
    for (const bad of ['xyz:1,2', 'xyz:0,1,2', 'xyz:1,1,2', 'xyz:1,2,9', 'coxeter@1,2', 'coxeter@a,b,c', 'polar', '', 'Coxeter', 'coxeter ', 'xyz:1,2,3@', 'xyz:1.5,2,3', 'coxeter@1.5,0,0']) {
      expect(parseProjection(bad, n), bad).toBeNull();
    }
    expect(parseProjection('xyz:1,2,3', boardFromName('A2').n)).toBeNull();
    expect(parseProjection('coxeter', boardFromName('A2').n)).toEqual({ view: { kind: 'coxeter' }, turn: [0, 0, 0] });
  });

  it('parseProjection on rank 3 accepts coxeter and every order of 1,2,3', () => {
    for (const name of ['A3', 'B3']) {
      const n = boardFromName(name).n;
      expect(parseProjection('coxeter', n)).not.toBeNull();
      for (const s of ['xyz:1,2,3', 'xyz:1,3,2', 'xyz:2,1,3', 'xyz:2,3,1', 'xyz:3,1,2', 'xyz:3,2,1', 'xyz:3,1,2@0,30,0']) {
        expect(parseProjection(s, n), `${name} ${s}`).not.toBeNull();
      }
      expect(parseProjection('xyz:2,1,3', n)!.view).toEqual({ kind: 'xyz', axes: [1, 0, 2] });
      expect(parseProjection('xyz:1,2,4', n)).toBeNull();
      expect(parseProjection('xyz:1,1,3', n)).toBeNull();
    }
  });

  it('formatProjection round-trips normalised values and reduces angles to 0..359', () => {
    for (const s of ['coxeter', 'xyz:1,2,3', 'xyz:1,2,3@30,20,0', 'coxeter@0,0,90', 'xyz:8,1,4@359,0,1', 'xyz:3,2,1@0,0,5']) {
      const p = parseProjection(s, 8);
      expect(p, s).not.toBeNull();
      expect(formatProjection(p!)).toBe(s);
    }
    expect(formatProjection(parseProjection('coxeter@0,0,0', 8)!)).toBe('coxeter');
    expect(formatProjection(parseProjection('coxeter@360,720,-360', 8)!)).toBe('coxeter');
    expect(formatProjection(parseProjection('xyz:1,2,3@-30,400,-1', 8)!)).toBe('xyz:1,2,3@330,40,359');
    expect(formatProjection({ view: { kind: 'xyz', axes: [2, 0, 1] }, turn: [0, -90, 0] })).toBe('xyz:3,1,2@0,270,0');
  });

  it('defaultProjection is coxeter for rank 2 and 4 and above and xyz:1,2,3 for rank 3', () => {
    expect(defaultProjection(2)).toEqual({ view: { kind: 'coxeter' }, turn: [0, 0, 0] });
    expect(defaultProjection(3)).toEqual({ view: { kind: 'xyz', axes: [0, 1, 2] }, turn: [0, 0, 0] });
    for (let n = 4; n <= 8; n++) expect(defaultProjection(n)).toEqual({ view: { kind: 'coxeter' }, turn: [0, 0, 0] });
    expect(formatProjection(defaultProjection(3))).toBe('xyz:1,2,3');
    expect(formatProjection(defaultProjection(8))).toBe('coxeter');
  });

  it('rank 1 is a line: coxeter only, and no turn moves it', () => {
    expect(parseProjection('coxeter', 1)).toEqual({ view: { kind: 'coxeter' }, turn: [0, 0, 0] });
    expect(parseProjection('xyz:1,1,1', 1)).toBeNull();
    expect(defaultProjection(1)).toEqual({ view: { kind: 'coxeter' }, turn: [0, 0, 0] });
    const f = frameFor(1, { kind: 'coxeter' });
    expect(f.w).toBeNull();
    expect(turnFrame(f, [10, 20, 30])).toEqual(f);
    expect(project(f, [-2])).toMatchObject({ x: -2, y: 0, z: 0 });
  });
});
