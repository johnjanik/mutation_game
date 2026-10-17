// P4-A2: the projector of SPEC.md 7.1 for T10 (Geometry Studio). Euclidean coordinates (2.14 step 4),
// rotations in coordinate planes, frames and the three turning angles, the j value of 6.6, the depth
// cue, scenes, the caps of 5.6 and the two renderers (Canvas 2D and the SVG snapshot of 7.4).
// Golden values are read from reference/golden_data.json with node:fs as data; no coverage is
// registered here (CONTRACTS.md 3). Random inputs come from a fixed linear congruential sequence.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CAPS, boardFromName, choleskyBasis, euclideanBasis, formValue, gram, roots } from '@engine';
import type { AnyBoard, Board } from '@engine';
import {
  ALPHA_FLOOR,
  apply,
  buildScene,
  compose,
  countDistinct,
  defaultProjection,
  depthStyle,
  formatProjection,
  frameFor,
  frameOf,
  parseProjection,
  project,
  ringsOf,
  rotationInPlane,
  roundTo,
  toEuclidean,
  toEuclideanPopulation,
  turnFrame,
  type Frame,
  type Projection,
  type Scene,
  type View,
} from '../../src/components/draw/projector';
import {
  DEPTH_LEVELS,
  LIMITS,
  drawScene,
  levelStyles,
  selectSegments,
  type Context2DLike,
} from '../../src/components/draw/canvasScene';
import { renderSvg } from '../../src/components/draw/svgScene';
import { PRESET_CONFIGS, presetFile, presetKey, type PresetData } from '../../src/components/draw/presetsT10';
import { DARK, LIGHT, contrastRatio } from '../../src/components/draw/palette';

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

/** The bases E a test uses: Cholesky (P3-A2) and euclideanBasis (P4-A1), two factorisations of B. */
function bases(board: AnyBoard): { name: string; E: number[][] }[] {
  return [
    { name: 'choleskyBasis', E: choleskyBasis(board) },
    { name: 'euclideanBasis', E: euclideanBasis(board).E },
  ];
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

// ---------------------------------------------------------------------------------------------
// Scenes, the depth cue, the counting helpers, the caps and the two renderers
// ---------------------------------------------------------------------------------------------

/** A recording stand-in for a canvas context: every call in order, with the style in force at stroke and fill. */
class FakeContext implements Context2DLike {
  calls: { op: string; args: number[] }[] = [];
  lineWidth = 1;
  strokeStyle: unknown = '';
  fillStyle: unknown = '';
  globalAlpha = 1;
  lineCap = 'butt';
  styles: { op: 'stroke' | 'fill'; colour: unknown; lineWidth: number; alpha: number }[] = [];
  save(): void {
    this.calls.push({ op: 'save', args: [] });
  }
  restore(): void {
    this.calls.push({ op: 'restore', args: [] });
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.calls.push({ op: 'setTransform', args: [a, b, c, d, e, f] });
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ op: 'clearRect', args: [x, y, w, h] });
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ op: 'fillRect', args: [x, y, w, h] });
  }
  beginPath(): void {
    this.calls.push({ op: 'beginPath', args: [] });
  }
  moveTo(x: number, y: number): void {
    this.calls.push({ op: 'moveTo', args: [x, y] });
  }
  lineTo(x: number, y: number): void {
    this.calls.push({ op: 'lineTo', args: [x, y] });
  }
  arc(x: number, y: number, r: number, start: number, end: number): void {
    this.calls.push({ op: 'arc', args: [x, y, r, start, end] });
  }
  fill(): void {
    this.calls.push({ op: 'fill', args: [] });
    this.styles.push({ op: 'fill', colour: this.fillStyle, lineWidth: this.lineWidth, alpha: this.globalAlpha });
  }
  stroke(): void {
    this.calls.push({ op: 'stroke', args: [] });
    this.styles.push({ op: 'stroke', colour: this.strokeStyle, lineWidth: this.lineWidth, alpha: this.globalAlpha });
  }
  count(op: string): number {
    return this.calls.filter((c) => c.op === op).length;
  }
  /** The paths in order: for each beginPath, its moveTo/lineTo/arc calls and whether it ended in stroke or fill. */
  paths(): { end: 'stroke' | 'fill'; calls: { op: string; args: number[] }[] }[] {
    const out: { end: 'stroke' | 'fill'; calls: { op: string; args: number[] }[] }[] = [];
    let cur: { op: string; args: number[] }[] | null = null;
    for (const c of this.calls) {
      if (c.op === 'beginPath') cur = [];
      else if ((c.op === 'stroke' || c.op === 'fill') && cur !== null) {
        out.push({ end: c.op, calls: cur });
        cur = null;
      } else if (cur !== null) cur.push(c);
    }
    return out;
  }
}

const COLOURS = { point: 'P', segment: 'S', page: 'G' };

/** A scene with m segments and k points, built by hand (no projection), for the cap tests. */
function fakeScene(points: number, segments: number, hasDepth = false): Scene {
  return {
    width: 320,
    height: 320,
    scale: 1,
    hasDepth,
    points: Array.from({ length: points }, (_, i) => ({ x: i % 300, y: (i * 7) % 300, z: 0, depth: 0.5 })),
    segments: Array.from({ length: segments }, (_, i) => ({ a: i % Math.max(points, 1), b: (i + 1) % Math.max(points, 1), depth: 0.5 })),
  };
}

/** The root populations of a named finite board, their y = E p, and the pairs at inner product 1 (from formValue). */
function rootPicture(name: string, E?: number[][]): { board: Board<number>; ys: number[][]; edges: [number, number][] } {
  const board = boardFromName(name) as Board<number>;
  const F = E ?? choleskyBasis(board);
  const ps = roots(board, CAPS.mainThreadItems).items;
  const B = gram(board)!.map((row) => row.map(ratToFloat));
  const edges: [number, number][] = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      // B is integral on simply laced boards; the exact check with formValue is made on a sample below.
      let s = 0;
      for (let a = 0; a < board.n; a++) for (let b = 0; b < board.n; b++) s += ps[i]![a]! * B[a]![b]! * ps[j]![b]!;
      if (s === 1) edges.push([i, j]);
    }
  }
  for (const [i, j] of edges.slice(0, 20)) expect(ratToFloat(formValue(board, ps[i]!, ps[j]!)!)).toBe(1);
  return { board, ys: ps.map((p) => toEuclideanPopulation(F, p)), edges };
}

function sceneOf(ys: number[][], edges: [number, number][], projection: Projection, box = { width: 360, height: 360 }, depthCue = true): Scene {
  const f = frameOf(ys[0]!.length, projection);
  return buildScene(
    ys.map((y) => project(f, y)),
    edges,
    box,
    { depthCue },
  );
}

/** Blends a colour over the page at an opacity, channel by channel in sRGB (as a canvas does). */
function blend(fg: string, bg: string, alpha: number): string {
  const ch = (h: string, k: number): number => parseInt(h.slice(1 + 2 * k, 3 + 2 * k), 16);
  const out = [0, 1, 2].map((k) => Math.round(alpha * ch(fg, k) + (1 - alpha) * ch(bg, k)));
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}

describe('scenes and the depth cue', () => {
  it('depthStyle is monotone and constant without a depth axis', () => {
    let prev = depthStyle(0);
    for (let k = 1; k <= 100; k++) {
      const s = depthStyle(k / 100);
      expect(s.width).toBeGreaterThanOrEqual(prev.width);
      expect(s.radius).toBeGreaterThanOrEqual(prev.radius);
      expect(s.alpha).toBeGreaterThanOrEqual(prev.alpha);
      // Continuous: a step of 0.01 moves no field by more than a few hundredths.
      expect(Math.abs(s.width - prev.width)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(s.radius - prev.radius)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(s.alpha - prev.alpha)).toBeLessThanOrEqual(0.05);
      prev = s;
    }
    // The cue acts: near marks are wider and larger than far ones.
    expect(depthStyle(1).width).toBeGreaterThan(depthStyle(0).width);
    expect(depthStyle(1).radius).toBeGreaterThan(depthStyle(0).radius);
    // No depth axis: the middle values.
    expect(depthStyle(null)).toEqual(depthStyle(0.5));
    // The alpha floor keeps a faded road at 3 to 1 against the page in both themes (A-6).
    expect(depthStyle(0).alpha).toBeGreaterThanOrEqual(ALPHA_FLOOR);
    for (const theme of [LIGHT, DARK]) {
      expect(contrastRatio(blend(theme['--road'], theme['--page'], ALPHA_FLOOR), theme['--page'])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(blend(theme['--text'], theme['--page'], ALPHA_FLOOR), theme['--page'])).toBeGreaterThanOrEqual(3);
    }
    // A flat scene (rank 2) and a scene with the cue switched off have no depth: one style for everything.
    const flat = buildScene([{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: -1, y: -1, z: 0 }], [[0, 1], [1, 2]], { width: 320, height: 320 });
    expect(flat.hasDepth).toBe(false);
    for (const p of flat.points) expect(p.depth).toBe(0.5);
    const off = buildScene([{ x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: -1 }], [[0, 1]], { width: 320, height: 320 }, { depthCue: false });
    expect(off.hasDepth).toBe(false);
    const styles = levelStyles(off, { lineWidth: 1, pointRadius: 2.5 });
    expect(styles).toHaveLength(DEPTH_LEVELS);
    for (const s of styles) expect(s).toEqual(styles[0]);
    const deep = buildScene([{ x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: -1 }], [[0, 1]], { width: 320, height: 320 });
    expect(deep.hasDepth).toBe(true);
    expect(deep.points.map((p) => p.depth)).toEqual([1, 0]);
    const deepStyles = levelStyles(deep, { lineWidth: 1, pointRadius: 2.5 });
    expect(deepStyles[DEPTH_LEVELS - 1]!.width).toBeGreaterThan(deepStyles[0]!.width);
  });

  it('buildScene centres the picture, keeps the aspect ratio and a rotation-invariant scale', () => {
    const rnd = lcg(5);
    const n = 6;
    const half = Array.from({ length: 30 }, () => randomVector(rnd, n));
    const ys = [...half, ...half.map((y) => y.map((x) => -x))];
    const proj: Projection = { view: { kind: 'coxeter' }, turn: [0, 0, 0] };
    for (const box of [{ width: 320, height: 320 }, { width: 360, height: 360 }, { width: 320, height: 200 }]) {
      const scene = sceneOf(ys, [], proj, box);
      expect(scene.width).toBe(box.width);
      expect(scene.height).toBe(box.height);
      const cx = box.width / 2;
      const cy = box.height / 2;
      // Centred: y and -y land symmetrically about the centre of the box.
      for (let i = 0; i < half.length; i++) {
        const a = scene.points[i]!;
        const b = scene.points[i + half.length]!;
        expect(Math.abs((a.x + b.x) / 2 - cx)).toBeLessThanOrEqual(1e-9);
        expect(Math.abs((a.y + b.y) / 2 - cy)).toBeLessThanOrEqual(1e-9);
      }
      // Aspect ratio: one scale in both directions, y flipped (y grows downwards on the screen).
      const f = frameOf(n, proj);
      for (let i = 0; i < ys.length; i++) {
        const q = project(f, ys[i]!);
        expect(Math.abs(scene.points[i]!.x - (cx + scene.scale * q.x))).toBeLessThanOrEqual(1e-9);
        expect(Math.abs(scene.points[i]!.y - (cy - scene.scale * q.y))).toBeLessThanOrEqual(1e-9);
      }
      // Inside the box with the margin.
      const margin = depthStyle(1).radius + 2;
      for (const p of scene.points) {
        expect(p.x).toBeGreaterThanOrEqual(margin - 1e-9);
        expect(p.x).toBeLessThanOrEqual(box.width - margin + 1e-9);
        expect(p.y).toBeGreaterThanOrEqual(margin - 1e-9);
        expect(p.y).toBeLessThanOrEqual(box.height - margin + 1e-9);
      }
      // The same points turned and rotated: same box, same scale.
      const R = compose(rotationInPlane(n, 0, 3, 1.1), rotationInPlane(n, 2, 5, -0.4));
      const turned = sceneOf(ys.map((y) => apply(R, y)), [], { view: { kind: 'xyz', axes: [1, 4, 2] }, turn: [30, 50, 70] }, box);
      expect(turned.width).toBe(scene.width);
      expect(turned.height).toBe(scene.height);
      expect(Math.abs(turned.scale - scene.scale)).toBeLessThanOrEqual(1e-9 * scene.scale);
    }
    // A given radius sets the scale.
    const fixed = buildScene([{ x: 1, y: 0, z: 0 }], [], { width: 320, height: 320, margin: 10, radius: 2 });
    expect(fixed.scale).toBe((160 - 10) / 2);
  });

  it('segments carry the mean depth of their ends and are sorted far to near', () => {
    const rnd = lcg(9);
    const ys = Array.from({ length: 40 }, () => randomVector(rnd, 4));
    const edges: [number, number][] = [];
    for (let k = 0; k < 120; k++) edges.push([Math.floor(rnd() * 40), Math.floor(rnd() * 40)]);
    const scene = sceneOf(ys, edges, { view: { kind: 'coxeter' }, turn: [10, 20, 30] });
    expect(scene.hasDepth).toBe(true);
    expect(scene.segments).toHaveLength(120);
    for (let k = 1; k < scene.segments.length; k++) expect(scene.segments[k]!.depth).toBeGreaterThanOrEqual(scene.segments[k - 1]!.depth);
    for (const s of scene.segments) {
      expect(Math.abs(s.depth - (scene.points[s.a]!.depth + scene.points[s.b]!.depth) / 2)).toBeLessThanOrEqual(1e-15);
    }
    // Every input edge appears once, as an unordered pair of the same indices.
    const key = (a: number, b: number): string => `${a},${b}`;
    expect(scene.segments.map((s) => key(s.a, s.b)).sort()).toEqual(edges.map(([a, b]) => key(a, b)).sort());
    expect(Math.min(...scene.points.map((p) => p.depth))).toBe(0);
    expect(Math.max(...scene.points.map((p) => p.depth))).toBe(1);
    expect(() => buildScene([{ x: 0, y: 0, z: 0 }], [[0, 1]], { width: 320, height: 320 })).toThrow(RangeError);
  });
});

describe('distinct dots and rings (SPEC 5.4: 6 decimals, minus zero counted as zero)', () => {
  it('roundTo rounds to the digits and never returns minus zero', () => {
    expect(roundTo(0.1234565, 6)).toBe(0.123457);
    expect(roundTo(-0.1234564, 6)).toBe(-0.123456);
    expect(Object.is(roundTo(-1e-9, 6), 0)).toBe(true);
    expect(Object.is(roundTo(-0, 6), 0)).toBe(true);
    expect(roundTo(12.34, 1)).toBe(12.3);
  });

  it('countDistinct keys on the coordinates rounded to 6 decimals', () => {
    expect(countDistinct([{ x: -1e-9, y: 0 }, { x: 0, y: 0 }, { x: 1e-9, y: -1e-9 }])).toBe(1);
    expect(countDistinct([{ x: 0.3, y: 0.4 }, { x: 0.3000004, y: 0.3999996 }, { x: 0.300001, y: 0.4 }])).toBe(2);
    expect(countDistinct([{ x: 1, y: 2 }, { x: 2, y: 1 }])).toBe(2);
    expect(countDistinct([])).toBe(0);
    expect(countDistinct([{ x: 0.12, y: 0 }, { x: 0.14, y: 0 }], 1)).toBe(1);
  });

  it('ringsOf keys on the rounded radius of the unrounded coordinates, innermost first', () => {
    // hypot(0.3000004, 0.4000004) = 0.50000064, which rounds to 0.500001; rounding the coordinates first would give 0.5.
    expect(ringsOf([{ x: 0.3000004, y: 0.4000004 }])).toEqual([[0.500001, 1]]);
    expect(
      ringsOf([
        { x: 2, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 0, y: 2.0000000001 },
        { x: -0.6, y: 0.8 },
      ]),
    ).toEqual([
      [1, 3],
      [2, 2],
    ]);
    expect(ringsOf([])).toEqual([]);
  });
});

describe('the caps of SPEC 5.6 (T10 "Limits")', () => {
  it('the caps come from CAPS', () => {
    expect(LIMITS).toEqual({ edgesAtRest: CAPS.edgesAtRest, edgesTurning: CAPS.edgesTurning, verticesDrawn: CAPS.verticesDrawn });
    for (const file of ['canvasScene.ts', 'svgScene.ts', 'projector.ts']) {
      const src = readFileSync(resolve(ROOT, 'site/src/components/draw', file), 'utf8');
      // No cap typed again, and no colour literal (SPEC 6.3: colours come from the tokens).
      for (const v of [CAPS.edgesAtRest, CAPS.edgesTurning, CAPS.verticesDrawn]) {
        expect(src, `${file} retypes ${v}`).not.toMatch(new RegExp(`\\b${String(v).replace(/(\d)(?=(\d{3})+$)/g, '$1_?')}\\b`));
      }
      expect(src, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    }
    const canvas = readFileSync(resolve(ROOT, 'site/src/components/draw/canvasScene.ts'), 'utf8');
    expect(canvas).toMatch(/import \{[^}]*\bCAPS\b[^}]*\} from '@engine'/);
    for (const name of ['edgesAtRest', 'edgesTurning', 'verticesDrawn']) expect(canvas).toContain(`CAPS.${name}`);
  });

  it('selectSegments draws all 70000 at rest and none above 70000', () => {
    const at = selectSegments(fakeScene(10, CAPS.edgesAtRest), false);
    expect(at.indices).toHaveLength(CAPS.edgesAtRest);
    expect(at.indices[CAPS.edgesAtRest - 1]).toBe(CAPS.edgesAtRest - 1);
    expect(at.verticesOnly).toBe(false);
    expect(at.sampled).toBe(false);
    const over = selectSegments(fakeScene(10, CAPS.edgesAtRest + 1), false);
    expect(over.indices).toHaveLength(0);
    expect(over.verticesOnly).toBe(true);
    // Above 70000 there is nothing to sample while turning either: vertices only.
    const overTurning = selectSegments(fakeScene(10, CAPS.edgesAtRest + 1), true);
    expect(overTurning.indices).toHaveLength(0);
    expect(overTurning.verticesOnly).toBe(true);
    // And drawScene draws no segment then.
    const ctx = new FakeContext();
    const r = drawScene(ctx, fakeScene(10, CAPS.edgesAtRest + 1), COLOURS, { turning: false, dpr: 1 });
    expect(r).toMatchObject({ segmentsDrawn: 0, segmentsTotal: CAPS.edgesAtRest + 1, verticesOnly: true, pointsDrawn: 10 });
    expect(ctx.count('lineTo')).toBe(0);
  });

  it('selectSegments draws 8000 while turning and samples deterministically', () => {
    const at = selectSegments(fakeScene(10, CAPS.edgesTurning), true);
    expect(at.indices).toEqual(Array.from({ length: CAPS.edgesTurning }, (_, i) => i));
    expect(at.sampled).toBe(false);
    for (const m of [CAPS.edgesTurning + 1, 3 * CAPS.edgesTurning + 17, CAPS.edgesAtRest]) {
      const s = selectSegments(fakeScene(10, m), true);
      expect(s.sampled).toBe(true);
      expect(s.verticesOnly).toBe(false);
      expect(s.indices).toHaveLength(CAPS.edgesTurning);
      expect(s.indices[0]).toBe(0);
      // Strictly increasing (far to near order kept), inside the range, and spread by a fixed stride.
      const stride = m / CAPS.edgesTurning;
      for (let k = 1; k < s.indices.length; k++) {
        expect(s.indices[k]).toBeGreaterThan(s.indices[k - 1]!);
        expect(s.indices[k]! - s.indices[k - 1]!).toBeLessThanOrEqual(Math.ceil(stride));
      }
      expect(s.indices[s.indices.length - 1]).toBeLessThan(m);
      expect(s.indices[s.indices.length - 1]).toBeGreaterThanOrEqual(m - Math.ceil(stride));
      // The same 8000 every frame.
      expect(selectSegments(fakeScene(10, m), true)).toEqual(s);
    }
    // At rest the same scene draws everything.
    expect(selectSegments(fakeScene(10, CAPS.edgesTurning + 1), false).indices).toHaveLength(CAPS.edgesTurning + 1);
    const ctx = new FakeContext();
    const r = drawScene(ctx, fakeScene(10, CAPS.edgesTurning + 1), COLOURS, { turning: true, dpr: 1 });
    expect(r).toMatchObject({ segmentsDrawn: CAPS.edgesTurning, segmentsTotal: CAPS.edgesTurning + 1, sampled: true, verticesOnly: false });
    expect(ctx.count('lineTo')).toBe(CAPS.edgesTurning);
  });

  it('drawScene draws at most 20000 points', () => {
    const ctx = new FakeContext();
    const r = drawScene(ctx, fakeScene(CAPS.verticesDrawn + 1, 0), COLOURS, { turning: false, dpr: 1 });
    expect(r.pointsDrawn).toBe(CAPS.verticesDrawn);
    expect(ctx.count('arc')).toBe(CAPS.verticesDrawn);
    const small = new FakeContext();
    expect(drawScene(small, fakeScene(CAPS.verticesDrawn, 0), COLOURS, { turning: false, dpr: 1 }).pointsDrawn).toBe(CAPS.verticesDrawn);
    expect(small.count('arc')).toBe(CAPS.verticesDrawn);
  });
});

describe('canvasScene: batching, the painter order and the device pixel ratio', () => {
  it('one stroke per depth level, far levels first, dpr applied once, colours as given', () => {
    const { ys, edges } = rootPicture('E8');
    const scene = sceneOf(ys, edges, { view: { kind: 'coxeter' }, turn: [0, 0, 0] });
    expect(scene.hasDepth).toBe(true);
    const ctx = new FakeContext();
    const r = drawScene(ctx, scene, COLOURS, { turning: false, dpr: 3 });
    expect(r).toEqual({ pointsDrawn: ys.length, segmentsDrawn: edges.length, segmentsTotal: edges.length, verticesOnly: false, sampled: false });
    expect(ctx.count('setTransform')).toBe(1);
    expect(ctx.calls.find((c) => c.op === 'setTransform')!.args).toEqual([3, 0, 0, 3, 0, 0]);
    expect(ctx.count('save')).toBe(1);
    expect(ctx.count('restore')).toBe(1);
    expect(ctx.count('stroke')).toBeLessThanOrEqual(DEPTH_LEVELS);
    expect(ctx.count('stroke')).toBeGreaterThan(1);
    expect(ctx.count('fill')).toBeLessThanOrEqual(DEPTH_LEVELS);
    expect(ctx.count('lineTo')).toBe(edges.length);
    expect(ctx.count('arc')).toBe(ys.length);
    // Far to near: widths grow from stroke to stroke; all segments before all points.
    const strokes = ctx.styles.filter((s) => s.op === 'stroke');
    for (let k = 1; k < strokes.length; k++) expect(strokes[k]!.lineWidth).toBeGreaterThan(strokes[k - 1]!.lineWidth);
    for (const s of strokes) expect(s.colour).toBe('S');
    for (const s of ctx.styles.filter((x) => x.op === 'fill')) expect(s.colour).toBe('P');
    const lastStroke = ctx.calls.map((c) => c.op).lastIndexOf('stroke');
    const firstArc = ctx.calls.map((c) => c.op).indexOf('arc');
    expect(lastStroke).toBeLessThan(firstArc);
    // The page colour fills the box in CSS pixels (the transform carries the dpr).
    expect(ctx.calls.find((c) => c.op === 'fillRect')!.args).toEqual([0, 0, scene.width, scene.height]);
  });
});

/** The tags of an XML text balance, and there is exactly one root element. */
function expectWellFormed(xml: string): void {
  const stack: string[] = [];
  let roots = 0;
  for (const m of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (close) {
      expect(stack.pop(), `closing ${name}`).toBe(name);
    } else {
      if (stack.length === 0) roots++;
      if (!self) stack.push(name!);
    }
  }
  expect(stack).toEqual([]);
  expect(roots).toBe(1);
  // Nothing outside tags but text without markup characters.
  expect(xml.replace(/<[^>]*>/g, '')).not.toMatch(/[<>]/);
}

describe('svgScene: the same picture as the canvas, as markup (SPEC 7.4)', () => {
  it('the SVG and the canvas receive the same coordinates', () => {
    const { ys, edges } = rootPicture('A3');
    for (const decimals of [1, 2]) {
      const scene = sceneOf(ys, edges, { view: { kind: 'xyz', axes: [0, 1, 2] }, turn: [20, 30, 10] });
      expect(scene.hasDepth).toBe(true);
      const ctx = new FakeContext();
      const drawn = drawScene(ctx, scene, COLOURS, { turning: false, dpr: 2, lineWidth: 1.5, pointRadius: 3 });
      const svg = renderSvg(scene, { decimals, lineWidth: 1.5, pointRadius: 3 });
      const r = (x: number): number => roundTo(x, decimals);
      // Segments: one canvas path per SVG path, the same style, the same rounded end points in the same order.
      const canvasPaths = ctx.paths().filter((p) => p.end === 'stroke');
      const strokes = ctx.styles.filter((s) => s.op === 'stroke');
      const svgPaths = [...svg.matchAll(/<path stroke-width="([\d.]+)" stroke-opacity="([\d.]+)" d="([^"]*)"\/>/g)];
      expect(svgPaths.length).toBe(canvasPaths.length);
      let segments = 0;
      svgPaths.forEach((m, k) => {
        expect(Number(m[1])).toBe(strokes[k]!.lineWidth);
        expect(Number(m[2])).toBe(strokes[k]!.alpha);
        const nums = m[3]!.match(/-?[\d.]+/g)!.map(Number);
        const ops = m[3]!.match(/[ML]/g)!;
        const fromCanvas = canvasPaths[k]!.calls.flatMap((c) => c.args.map(r));
        expect(nums).toEqual(fromCanvas);
        expect(ops).toEqual(canvasPaths[k]!.calls.map((c) => (c.op === 'moveTo' ? 'M' : 'L')));
        segments += ops.length / 2;
      });
      expect(segments).toBe(drawn.segmentsDrawn);
      expect(segments).toBe(edges.length);
      // Points: the circles in order equal the arcs, with the same radius and opacity.
      const arcs = ctx.calls.filter((c) => c.op === 'arc');
      const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)];
      expect(circles.length).toBe(arcs.length);
      expect(circles.length).toBe(ys.length);
      circles.forEach((m, k) => {
        const [x, y, rad] = arcs[k]!.args;
        expect([Number(m[1]), Number(m[2]), Number(m[3])]).toEqual([r(x!), r(y!), rad]);
      });
      const fills = ctx.styles.filter((s) => s.op === 'fill');
      const groups = [...svg.matchAll(/<g fill-opacity="([\d.]+)">/g)].map((m) => Number(m[1]));
      expect(groups).toEqual(fills.map((s) => s.alpha));
    }
  });

  it('renderSvg is one well-formed svg element with token colours by default', () => {
    const { ys, edges } = rootPicture('A3');
    const scene = sceneOf(ys, edges, { view: { kind: 'xyz', axes: [0, 1, 2] }, turn: [0, 0, 0] }, { width: 320, height: 300 });
    const svg = renderSvg(scene);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg.match(/<svg\b/g)).toHaveLength(1);
    expect(svg).toContain('viewBox="0 0 320 300"');
    expectWellFormed(svg);
    expect(svg).toContain('var(--road)');
    expect(svg).toContain('var(--text)');
    expect(svg).not.toContain('#');
    // Concrete colours for a file or an export, where variables do not resolve.
    const concrete = renderSvg(scene, { colours: { point: 'red', segment: 'blue', page: 'white' } });
    expect(concrete).not.toContain('var(--');
    expect(concrete).toContain('stroke="blue"');
    expect(concrete).toContain('fill="red"');
    expect(concrete).toContain('fill="white"');
    expectWellFormed(concrete);
    // Title and desc first, escaped, named by the svg; ids prefixed.
    const titled = renderSvg(scene, { title: 'Roots of A3 & more', desc: 'Twelve <points>', id: 'b2' });
    expectWellFormed(titled);
    expect(titled).toMatch(/^<svg [^>]*><title id="b2-title">Roots of A3 &amp; more<\/title><desc id="b2-desc">Twelve &lt;points&gt;<\/desc>/);
    expect(titled).toContain('aria-labelledby="b2-title b2-desc"');
    expect(titled).toContain('role="img"');
    const ids = [...titled.matchAll(/\bid="([^"]*)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    for (const id of ids) expect(id.startsWith('b2-')).toBe(true);
    const other = renderSvg(scene, { title: 't', id: 'b3' });
    const otherIds = [...other.matchAll(/\bid="([^"]*)"/g)].map((m) => m[1]!);
    for (const id of otherIds) expect(ids).not.toContain(id);
    // Same selection rule as the canvas: above 70000 segments, vertices only.
    const many = renderSvg(fakeScene(10, CAPS.edgesAtRest + 1));
    expect(many).not.toContain('<path');
    expect(many.match(/<circle /g)).toHaveLength(10);
  });

  it('the E8 snapshot stays under 200 kB', () => {
    // The scene of the committed E8 file (the showpiece), drawn at y = E C^-1 a with E from the
    // engine's euclideanBasis and projected to the true Coxeter plane at zero turn, in a 360 by 360 box.
    const config = PRESET_CONFIGS.find((c) => c.presets.includes('showpiece'))!;
    const data = JSON.parse(readFileSync(resolve(ROOT, 'site/public/presets/T10', presetFile(presetKey(config))), 'utf8')) as PresetData;
    expect(data.board).toBe('E8');
    const E8 = boardFromName('E8');
    const { E } = euclideanBasis(E8);
    const ys = data.vertices.map((a) => toEuclidean(E8, E, a));
    const edges: [number, number][] = data.adjacency.flatMap((l, i) => l.map((j): [number, number] => [i, j]));
    const record = golden.wythoff.find((w) => w.type === 'E8' && w.rings.join(',') === data.rings.join(','))!;
    expect(record.edges_enumerated).toBe(true);
    const sizes: string[] = [];
    for (const depthCue of [false, true]) {
      const scene = sceneOf(ys, edges, { view: { kind: 'coxeter' }, turn: [0, 0, 0] }, { width: 360, height: 360 }, depthCue);
      expect(scene.hasDepth).toBe(depthCue);
      const svg = renderSvg(scene, { title: 'The 240 roots of E8 in the Coxeter plane', id: 'e8' });
      const bytes = Buffer.byteLength(svg, 'utf8');
      expect(bytes).toBeLessThan(200000);
      const segments = [...svg.matchAll(/<path [^>]*d="([^"]*)"/g)].reduce((s, m) => s + m[1]!.match(/M/g)!.length, 0);
      expect(segments).toBe(record.f_vector[1]);
      expect(svg.match(/<circle /g)).toHaveLength(record.f_vector[0]!);
      sizes.push(`${bytes} bytes with the depth cue ${depthCue ? 'on' : 'off'}`);
    }
    // Each root has 56 neighbours at inner product 1 (golden e8), so the edge set is the one of 2.14.
    const degree = new Array<number>(ys.length).fill(0);
    for (const [a, b] of edges) {
      degree[a]!++;
      degree[b]!++;
    }
    for (const d of degree) expect(d).toBe(golden.e8.neighbours_at_inner_product_1);
    process.stdout.write(`P4-A2 E8 snapshot in the Coxeter plane (euclideanBasis), one decimal: ${sizes.join('; ')}\n`);
  });
});
