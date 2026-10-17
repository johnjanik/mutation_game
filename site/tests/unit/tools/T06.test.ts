// P3-A4: tool T6, the Kaleidoscope (SPEC.md 4 T6, 2.4, 2.5, 2.14). The three acceptance criteria of
// SPEC 4 T6 over all four boards and many random points, through the model of
// site/src/components/tools/t06/model.ts (the component only renders what it returns), the plan tests
// of the instruction (section 5.13), and the server render of T06Kaleidoscope.svelte.
//
// Golden values are read from reference/golden_data.json at test time, never typed. This file calls no
// covers(): the keys it reads (types.T.cartan, symmetrizer, positive_roots, n_roots,
// long_to_short_ratio, absent on A2) belong to the engine's golden files (CONTRACTS 3, "a golden key is tested in
// exactly one file"). Random cases use the PRNG mulberry32 with the fixed seed SEED below.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAPS, boardFromName, fire, ratAdd, ratEq, ratMul, rat, toPositions } from '@engine';
import type { Board, Rational } from '@engine';
import {
  MirrorGame,
  T06_BOARDS,
  admitLink,
  equation,
  exportDerived,
  fmt,
  geometry,
  interactive,
  latticeDots,
  orbitPoints,
  placed,
  readout,
  shownValue,
  snap,
  stepped,
  toScreen,
  type Vec2,
} from '../../../src/components/tools/t06/model';
import { decodeState, encodeState } from '../../../src/lib/urlCodec';
import { whereToRun } from '../../../src/lib/worker';
import type { ToolState } from '../../../src/lib/state';
import T06 from '../../../src/tools/registry/T06';
import { ssrLoader, type SsrLoader } from '../_svelteSsr';

interface TypeRecord {
  cartan: number[][];
  symmetrizer: number[];
  positive_roots: number[][];
  n_roots: number;
  /** Absent on the simply laced types (one root length). */
  long_to_short_ratio?: number | null;
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, TypeRecord>;
};

/** The seed of every random case in this file. */
const SEED = 0x7e06;
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 50 random integer positions with entries in [-9, 9], label order (plan range). */
function randomPoints(board: string): number[][] {
  const rnd = mulberry32(SEED + board.charCodeAt(0));
  return Array.from({ length: 50 }, () => [Math.floor(rnd() * 19) - 9, Math.floor(rnd() * 19) - 9]);
}

const parseRat = (t: string): Rational => {
  const [n, d] = t.split('/');
  return rat(BigInt(n!), BigInt(d ?? '1'));
};
const big = (v: readonly (number | string)[]): bigint[] => v.map((x) => BigInt(x));
const dot = (u: Vec2, v: Vec2): number => u[0] * v[0] + u[1] * v[1];
const near = (x: number, y: number, eps = 1e-9): void => {
  expect(Math.abs(x - y)).toBeLessThan(eps);
};

/** The golden C (labels 1 and 2 are positions 0 and 1 on these boards, checked below). */
const C = (t: string): number[][] => golden.types[t]!.cartan;

describe('SPEC 4 T6 acceptance', () => {
  it('a = Cp holds in exact rational arithmetic for 50 random lattice points on each board', () => {
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      expect(g.cartanByLabel).toEqual(C(t));
      expect(g.labels).toEqual([1, 2]);
      for (const a of randomPoints(t)) {
        const game = new MirrorGame({ board: t, start: a });
        const r = game.readout;
        const p = r.population.map(parseRat);
        expect(r.numbers).toEqual(a.map(String));
        for (let i = 0; i < 2; i++) {
          const lhs = C(t)[i]!.reduce((acc, c, j) => ratAdd(acc, ratMul(rat(c), p[j]!)), rat(0));
          expect(ratEq(lhs, parseRat(r.numbers[i]!))).toBe(true);
        }
        // The line a = Cp shown with the actual numbers holds the same values.
        const e = equation(g, r);
        expect(e.cartan).toEqual(C(t));
        expect(e.numbers).toEqual(r.numbers);
        expect(e.population).toEqual(r.population);
      }
    }
  });

  it('firing node i changes the numbers as fire says and the population by -a_i e_i', () => {
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      const board = boardFromName(t) as Board<number>;
      for (const a of randomPoints(t)) {
        for (const label of [1, 2]) {
          const game = new MirrorGame({ board: t, start: a });
          const before = game.readout;
          game.fire(label);
          const after = game.readout;
          const i = toPositions(board, [label])[0]!;
          expect(after.numbers).toEqual(fire(board, a, i).map(String));
          // Only entry i of the population changes, by -a_i.
          const p0 = before.population.map(parseRat);
          const p1 = after.population.map(parseRat);
          for (let k = 0; k < 2; k++) {
            const expected = k === label - 1 ? ratAdd(p0[k]!, rat(-a[k]!)) : p0[k]!;
            expect(ratEq(p1[k]!, expected)).toBe(true);
          }
          // In the plane: y - a_i alpha_i, the mirror image of y in mirror i.
          const u = g.alpha[i]!;
          near(after.y[0], before.y[0] - a[label - 1]! * u[0]);
          near(after.y[1], before.y[1] - a[label - 1]! * u[1]);
          near(dot(after.y, u), -dot(before.y, u));
          const mid: Vec2 = [(after.y[0] + before.y[0]) / 2, (after.y[1] + before.y[1]) / 2];
          near(dot(mid, u), 0);
        }
      }
    }
  });

  it('the six, eight and twelve roots are drawn at the correct angles and lengths, tested through U^T U = B', () => {
    const m: Record<string, number> = {};
    for (const t of T06_BOARDS) {
      const C12 = C(t)[0]![1]! * C(t)[1]![0]!;
      m[t] = C12 === 1 ? 3 : C12 === 2 ? 4 : 6;
    }
    expect(Object.values(m)).toEqual([3, 4, 4, 6]);
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      const d = golden.types[t]!.symmetrizer;
      const u = g.alpha;
      // u_i . u_j = B_ij = d_i C_ij (rows scaled: B = DC).
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) near(dot(u[i]!, u[j]!), d[i]! * C(t)[i]![j]!);
      // alpha_1 on the positive horizontal axis with length sqrt(2 d_1).
      near(u[0]![0], Math.sqrt(2 * d[0]!));
      expect(u[0]![1]).toBe(0);
      // alpha_2 counterclockwise: positive vertical component in the plane, negative on the screen.
      expect(u[1]![1]).toBeGreaterThan(0);
      expect(toScreen(g, u[1]!)[1]).toBeLessThan(toScreen(g, [0, 0])[1]);
      near((Math.atan2(u[1]![1], u[1]![0]) * 180) / Math.PI, 180 - 180 / m[t]!);
      // The roots: n_roots of them, each at U q, the positive ones the golden list as a set (a drawing
      // has no order; the ordered comparison of SPEC 5.7 rule 5 belongs to the engine's golden file).
      expect(g.roots.length).toBe(golden.types[t]!.n_roots);
      const pos = g.roots.filter((r) => r.positive).map((r) => r.root.join(','));
      const neg = g.roots.filter((r) => !r.positive).map((r) => r.root.map((x) => -x).join(','));
      const goldenPos = golden.types[t]!.positive_roots.map((q) => q.join(','));
      expect(new Set(pos)).toEqual(new Set(goldenPos));
      expect(new Set(neg)).toEqual(new Set(goldenPos));
      for (const r of g.roots) {
        near(r.y[0], r.root[0]! * u[0]![0] + r.root[1]! * u[1]![0]);
        near(r.y[1], r.root[0]! * u[0]![1] + r.root[1]! * u[1]![1]);
      }
      const lens = g.roots.map((r) => Math.hypot(r.y[0], r.y[1]));
      const ratio = golden.types[t]!.long_to_short_ratio;
      if (ratio === undefined || ratio === null) {
        for (const l of lens) near(l, lens[0]!);
      } else {
        near(Math.max(...lens) / Math.min(...lens), Math.sqrt(ratio));
      }
    }
  });
});

describe('T6 plan tests', () => {
  it('the mirrors, the simple roots and the chambers are drawn', () => {
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      const n = golden.types[t]!.n_roots;
      expect(g.mirrors.length).toBe(n / 2);
      const simple = g.mirrors.filter((x) => x.simple !== 0);
      expect(simple.map((x) => x.simple).sort()).toEqual([1, 2]);
      for (const s of simple) {
        const u = g.alpha[s.simple - 1]!;
        const dir: Vec2 = [s.to[0] - s.from[0], s.to[1] - s.from[1]];
        near(dot(dir, u) / Math.hypot(dir[0], dir[1]), 0);
        // Through the origin: the two ends are opposite.
        near(s.from[0] + s.to[0], 0);
        near(s.from[1] + s.to[1], 0);
      }
      for (const mi of g.mirrors) {
        const q = mi.root;
        const normal: Vec2 = [q[0]! * g.alpha[0]![0] + q[1]! * g.alpha[1]![0], q[0]! * g.alpha[0]![1] + q[1]! * g.alpha[1]![1]];
        const dir: Vec2 = [mi.to[0] - mi.from[0], mi.to[1] - mi.from[1]];
        near(dot(dir, normal) / Math.hypot(dir[0], dir[1]), 0);
        expect(golden.types[t]!.positive_roots.map((x) => x.join(','))).toContain(q.join(','));
      }
      expect(g.chambers.length).toBe(n);
      const dom = g.chambers.filter((c) => c.dominant);
      expect(dom.length).toBe(1);
      const y = readout(g, [1n, 1n]).y;
      const ang = Math.atan2(y[1], y[0]);
      const a = ((ang - dom[0]!.from) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      expect(a).toBeGreaterThan(1e-9);
      expect(a).toBeLessThan(dom[0]!.to - dom[0]!.from - 1e-9);
    }
  });

  it('the scaled distances follow 2.4(d)', () => {
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      for (const a of randomPoints(t)) {
        const r = readout(g, big(a));
        for (let k = 0; k < 2; k++) {
          const u = g.alpha[k]!;
          const signed = dot(r.y, u) / Math.hypot(u[0], u[1]);
          near(signed, r.distances[k]!);
          near((2 / Math.hypot(u[0], u[1])) * signed, a[k]!);
          // The foot lies on mirror k, and the perpendicular is parallel to alpha_k.
          near(dot(r.feet[k]!, u), 0);
        }
      }
    }
  });

  it('the point is drawn at U C^{-1} a', () => {
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      for (const a of randomPoints(t)) {
        const r = readout(g, big(a));
        const p = r.population.map(parseRat).map((x) => Number(x.num) / Number(x.den));
        near(r.y[0], g.U[0]![0]! * p[0]! + g.U[0]![1]! * p[1]!);
        near(r.y[1], g.U[1]![0]! * p[0]! + g.U[1]![1]! * p[1]!);
        // Never U a (which differs from U C^{-1} a unless the population equals the numbers).
        if (r.population.join(',') !== r.numbers.join(',')) {
          const ua = [g.U[0]![0]! * a[0]! + g.U[0]![1]! * a[1]!, g.U[1]![0]! * a[0]! + g.U[1]![1]! * a[1]!];
          expect(Math.hypot(ua[0]! - r.y[0], ua[1]! - r.y[1])).toBeGreaterThan(1e-6);
        }
        // The far corner of the parallelogram is the point.
        near(r.parallelogram[2][0], r.y[0]);
        near(r.parallelogram[2][1], r.y[1]);
        expect(r.parallelogram[0]).toEqual([0, 0]);
      }
    }
  });

  it('B2 and C2 are drawn in their own numbering', () => {
    const b = geometry('B2');
    const c = geometry('C2');
    near(b.lengths[0]!, 2);
    near(b.lengths[1]!, Math.SQRT2);
    near(c.lengths[0]!, Math.SQRT2);
    near(c.lengths[1]!, 2);
    expect(b.name).toBe('B2');
    expect(c.name).toBe('C2');
    expect(new MirrorGame({ board: 'C2', start: [1, 1] }).state().board).toBe('C2');
    for (const g of [b, c]) near((Math.atan2(g.alpha[1]![1], g.alpha[1]![0]) * 180) / Math.PI, 135);
  });

  it('the A2 point (1,0) has population 2/3, 1/3 and an orbit of 3 positions', () => {
    const g = geometry('A2');
    const r = readout(g, [1n, 0n]);
    // C^{-1} (1, 0) by Cramer's rule from the golden C (verify.py line 1584: thirds on A2).
    const [[a, b], [c, d]] = C('A2') as [[number, number], [number, number]];
    const det = a * d - b * c;
    const expected = [rat(d, det), rat(-c, det)];
    expect(r.population.map(parseRat).every((x, k) => ratEq(x, expected[k]!))).toBe(true);
    expect(r.population.every((x) => x.endsWith(`/${det}`))).toBe(true);
    // The orbit, against a breadth-first search with the golden C (a_j - C_ji a_i).
    const seen = new Set<string>(['1,0']);
    const queue = [[1, 0]];
    while (queue.length > 0) {
      const v = queue.shift()!;
      for (let i = 0; i < 2; i++) {
        const w = v.map((x, j) => x - C('A2')[j]![i]! * v[i]!);
        if (!seen.has(w.join(','))) {
          seen.add(w.join(','));
          queue.push(w);
        }
      }
    }
    const o = orbitPoints(g, [1n, 0n]);
    expect(new Set(o.map((x) => x.numbers.join(',')))).toEqual(seen);
    expect(o.length).toBe(seen.size);
    expect(orbitPoints(g, [1n, 1n]).length).toBe(golden.types.A2!.n_roots);
  });

  it('G2 populations are always integral', () => {
    const g = geometry('G2');
    for (const a of randomPoints('G2')) for (const p of readout(g, big(a)).population) expect(p).toMatch(/^-?\d+$/);
  });

  it('snapping finds the nearest weight-lattice point', () => {
    const rnd = mulberry32(SEED ^ 0x5a5a);
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      for (let k = 0; k < 200; k++) {
        const y: Vec2 = [(rnd() * 2 - 1) * g.R, (rnd() * 2 - 1) * g.R];
        const s = snap(g, y);
        const at = (v: number[]): Vec2 => readout(g, big(v)).y;
        const ds = Math.hypot(at(s)[0] - y[0], at(s)[1] - y[1]);
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            const v = [s[0]! + i, s[1]! + j];
            const z = at(v);
            expect(ds).toBeLessThanOrEqual(Math.hypot(z[0] - y[0], z[1] - y[1]) + 1e-12);
          }
        }
      }
      for (const v of [
        [0, 0],
        [1, 1],
        [-2, 3],
        [4, -1],
      ]) {
        expect(snap(g, readout(g, big(v)).y)).toEqual(v);
      }
    }
  });

  it('the lattices', () => {
    for (const t of T06_BOARDS) {
      const g = geometry(t);
      const dots = latticeDots(g);
      const rootDots = dots.filter((d) => d.lattice === 'root');
      const weightDots = dots.filter((d) => d.lattice === 'weight');
      for (const d of rootDots) {
        near(d.y[0], d.v[0]! * g.alpha[0]![0] + d.v[1]! * g.alpha[1]![0]);
        near(d.y[1], d.v[0]! * g.alpha[0]![1] + d.v[1]! * g.alpha[1]![1]);
      }
      for (const d of weightDots) {
        const y = readout(g, big(d.v)).y;
        near(d.y[0], y[0]);
        near(d.y[1], y[1]);
      }
      const keys = (ds: typeof dots): Set<string> => new Set(ds.map((d) => `${fmt(d.y[0])},${fmt(d.y[1])}`));
      if (t === 'G2') expect(keys(weightDots)).toEqual(keys(rootDots));
      else expect(keys(weightDots).size).toBeGreaterThan(keys(rootDots).size);
    }
    // On A2 one weight dot in three is a root dot (det C = 3), in a large window.
    const big40 = latticeDots(geometry('A2'), 40);
    const ratio = big40.filter((d) => d.lattice === 'weight').length / big40.filter((d) => d.lattice === 'root').length;
    expect(Math.abs(ratio - 3)).toBeLessThan(0.1);
    const b40 = latticeDots(geometry('B2'), 40);
    expect(Math.abs(b40.filter((d) => d.lattice === 'weight').length / b40.filter((d) => d.lattice === 'root').length - 2)).toBeLessThan(0.1);
  });

  it('placement resets moves and sets start', () => {
    const game = new MirrorGame({ board: 'A2', start: [1, 1], moves: [1, 2] });
    expect(game.state().moves).toEqual([1, 2]);
    const next = new MirrorGame(stepped(game, 0, 1));
    const now = game.readout.numbers.map(Number);
    expect(next.state().start).toEqual([now[0]! + 1, now[1]!]);
    expect(next.state().moves).toEqual([]);
    const p = new MirrorGame(placed('B2', [2, -1]));
    expect(p.state()).toEqual({ schema: 1, tool: 'mirror', board: 'B2', coords: 'numbers', start: [2, -1], moves: [] });
  });

  it('a link with c=p places the point at Cp', () => {
    const defaults: ToolState = { schema: 1, tool: 'mirror', board: 'A2', coords: 'numbers', start: [1, 1], moves: [] };
    for (const t of T06_BOARDS) {
      const { state, notice } = decodeState(`g=${t}&c=p&s=1,1`, 'mirror', defaults);
      expect(notice).toBeNull();
      const cfg = admitLink(state)!;
      const expected = C(t).map((row) => row[0]! + row[1]!);
      expect(cfg.start).toEqual(expected);
      expect(new MirrorGame(cfg).readout.population).toEqual(['1', '1']);
    }
  });

  it('every preset is a valid link', () => {
    for (const [id, preset] of Object.entries(T06.presets)) {
      const { caption: _caption, ...fields } = preset;
      const state = { schema: 1, tool: 'mirror', ...fields } as ToolState;
      const defaults: ToolState = { schema: 1, tool: 'mirror', board: 'A2', coords: 'numbers', start: [1, 1], moves: [] };
      const back = decodeState(encodeState(state), 'mirror', defaults);
      expect(back.notice, id).toBeNull();
      expect(back.state).toEqual(state);
    }
    expect(Object.keys(T06.presets)).toEqual(['default']);
    expect(T06.presets.default.start).toEqual([1, 1]);
  });

  it('the registry offers exactly A2, B2, C2, G2', () => {
    expect(T06.boards).toEqual(['A2', 'B2', 'C2', 'G2']);
    expect(T06.id).toBe('mirror');
    expect(T06.number).toBe(6);
    const defaults: ToolState = { schema: 1, tool: 'mirror', board: 'A2', coords: 'numbers', start: [1, 1], moves: [] };
    expect(decodeState('g=A3', 'mirror', defaults).notice).not.toBeNull();
    expect(decodeState('g=A3', 'mirror', defaults).state).toEqual(defaults);
    expect(decodeState('g=G2', 'mirror', defaults).notice).toBeNull();
  });

  it('the default state is deterministic', () => {
    const draw = (): string[] => {
      const g = geometry('A2');
      const r = new MirrorGame({ board: 'A2', start: [1, 1] }).readout;
      return [
        ...g.mirrors.map((m) => `${fmt(m.from[0])},${fmt(m.from[1])},${fmt(m.to[0])},${fmt(m.to[1])}`),
        ...g.chambers.map((c) => c.polygon.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' ')),
        `${fmt(r.y[0])},${fmt(r.y[1])}`,
        ...r.population,
      ];
    };
    expect(draw()).toEqual(draw());
    expect(fmt(-0.0001)).toBe('0.000');
  });

  it('every call stays on the main thread', () => {
    for (const t of T06_BOARDS) {
      expect(whereToRun({ board: boardFromName(t), kind: 'enumeration', expectedItems: CAPS.mainThreadItems })).toBe('main');
      // The largest set T6 grows: an orbit of at most |W| = n_roots positions in rank 2.
      expect(orbitPoints(geometry(t), [1n, 1n]).length).toBeLessThanOrEqual(golden.types[t]!.n_roots);
    }
  });

  it('long values are shortened above 12 digits', () => {
    const d13 = '1234567890123';
    expect(shownValue(d13)).toContain('(13 digits)');
    expect(shownValue(`-${d13}`)).toMatch(/^−.*\(13 digits\)$/);
    expect(shownValue('123456789012')).toBe('123456789012');
    expect(shownValue('-5')).toBe('−5');
    const game = new MirrorGame({ board: 'A2', start: [d13, '1'] });
    expect(game.readout.numbers[0]).toBe(d13);
    const derived = exportDerived(game, []) as { position: (number | string)[] };
    expect(String(derived.position[0])).toBe(d13);
    const d40 = '9'.repeat(40);
    expect(new MirrorGame({ board: 'A2', start: [d40, '1'] }).readout.offView).toBe(true);
    expect(new MirrorGame({ board: 'A2', start: [1, 1] }).readout.offView).toBe(false);
  });

  it('a 40-digit start is replayed without overflow', () => {
    const d40 = 10n ** 39n + 7n;
    const game = new MirrorGame({ board: 'A2', start: [d40.toString(), 1], moves: [1, 2] });
    // By hand with bigint and the golden C: a_j <- a_j - C_ji a_i.
    let a = [d40, 1n];
    const Cg = C('A2').map((r) => r.map(BigInt));
    for (const i of [0, 1]) a = a.map((x, j) => (j === i ? -x : x - Cg[j]![i]! * a[i]!));
    expect(game.readout.numbers).toEqual(a.map(String));
    const p = game.readout.population.map(parseRat);
    for (let i = 0; i < 2; i++) {
      const lhs = C('A2')[i]!.reduce((acc, c, j) => ratAdd(acc, ratMul(rat(c), p[j]!)), rat(0));
      expect(ratEq(lhs, rat(a[i]!))).toBe(true);
    }
  });

  it('a prediction freezes firing, placement and drag until answered', () => {
    expect(interactive({ hydrated: true, prediction: true, resolved: false })).toBe(false);
    expect(interactive({ hydrated: true, prediction: true, resolved: true })).toBe(true);
    expect(interactive({ hydrated: true, prediction: false, resolved: false })).toBe(true);
    expect(interactive({ hydrated: false, prediction: false, resolved: true })).toBe(false);
  });

  it('the export data holds the derived tables', () => {
    const game = new MirrorGame({ board: 'A2', start: [1, 0], moves: [1] });
    const d = exportDerived(game, ['roots', 'orbit']) as Record<string, unknown>;
    expect(d.position).toEqual(game.readout.numbers.map(Number));
    expect(d.population).toEqual(game.readout.population);
    expect((d.population as string[]).some((x) => x.includes('/'))).toBe(true);
    expect(d.cartan).toEqual(C('A2'));
    expect((d.history as unknown[]).length).toBe(2);
    expect((d.orbit as unknown[]).length).toBe(orbitPoints(geometry('A2'), [1n, 0n]).length);
    expect((d.roots as unknown[]).length).toBe(golden.types.A2!.n_roots);
    const plain = exportDerived(game, []);
    expect(plain.orbit).toBeUndefined();
    expect(plain.roots).toBeUndefined();
  });
});

describe('T6 server render', () => {
  let ssr: SsrLoader;
  let T06c: unknown;
  beforeAll(async () => {
    ssr = await ssrLoader();
    T06c = (await ssr.load<{ default: unknown }>('/src/components/tools/T06Kaleidoscope.svelte')).default;
  }, 120000);
  afterAll(async () => {
    await ssr?.close();
  });

  it('the default renders the A2 figure on the server', () => {
    const html = ssr.render(T06c, { id: '', preset: 'default', caption: T06.presets.default.caption });
    const values = [...html.matchAll(/data-board="numbers"[^>]*data-value="([^"]*)"/g)].map((m) => m[1]);
    expect(values).toEqual(['1', '1']);
    expect(html).toMatch(/data-out="population"[^>]*data-value="1,1"/);
    expect(html).toContain('is the amount by which a mutation would lower city');
    expect((html.match(/data-out="chamber"/g) ?? []).length).toBe(golden.types.A2!.n_roots);
    expect((html.match(/data-dominant="true"/g) ?? []).length).toBe(1);
    expect((html.match(/data-out="simpleRoot"/g) ?? []).length).toBe(2);
    expect(html).toContain('data-out="point"');
    // Controls disabled before hydration.
    for (const name of ['a1-minus', 'a1-plus', 'a2-minus', 'a2-plus']) expect(html).toMatch(new RegExp(`data-control="${name}"[^>]*disabled`));
  });

  it('with a prediction the server HTML holds a details element', () => {
    const html = ssr.render(T06c, {
      id: 'b1',
      preset: 'default',
      prediction: { question: 'Which numbers after firing node 1?', answer: { type: 'position', value: [-1, 2] }, reveal: 'The point is reflected.' },
    });
    expect(html).toMatch(/data-prediction=""[\s\S]*<details/);
    expect(html).toContain('The point is reflected.');
    const buttons = [...html.matchAll(/<button[^>]*data-board="numbers"[^>]*>/g)].map((m) => m[0]);
    expect(buttons.length).toBe(2);
    for (const b of buttons) expect(b).toContain('disabled');
  });
});
