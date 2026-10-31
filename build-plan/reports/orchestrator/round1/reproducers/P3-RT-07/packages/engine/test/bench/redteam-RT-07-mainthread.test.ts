// RT-07 attacks 22, 23 and 24 (Methods 5.5): engine calls that E-9 keeps on the main thread, timed in
// Node through the public API, median of seven runs each. SPEC.md 7.6: "No engine call on the main
// thread may become a long task (50 ms) on that phone." A desktop median above 50 ms fails here; the
// medians are printed so that values between 25 and 50 ms can be reported as notes.
// Not collected by `npm test`. Run alone, from the repository root:
//   node_modules/.bin/vitest run --root packages/engine --config ../../redteam/redteam-RT-07-vitest.config.mjs test/bench/redteam-RT-07-mainthread.test.ts
import { describe, expect, it } from 'vitest';
import {
  boardFromName,
  classify,
  commutationClassSize,
  countCompleteGames,
  fire,
  fromAdjacency,
  isRootPopulation,
  legalLayers,
  longestWord,
  mutate,
  orbitGraph,
  play,
  playFate,
  smallestNonfiniteSubboard,
  spectralRadius,
  symmetrizer,
  weylOrder,
} from '../../src/index';

const LONG_TASK_MS = 50;

function median7(f: () => unknown): { median: number; runs: number[] } {
  const ts: number[] = [];
  for (let r = 0; r < 7; r++) {
    const t = performance.now();
    f();
    ts.push(performance.now() - t);
  }
  const sorted = [...ts].sort((a, b) => a - b);
  return { median: sorted[3]!, runs: ts };
}
function report(label: string, f: () => unknown): number {
  const { median, runs } = median7(f);
  process.stdout.write(`RT-07 ${label}: median ${median.toFixed(2)} ms [${runs.map((t) => t.toFixed(1)).join(', ')}]\n`);
  return median;
}
const zeros = (n: number): number[][] => Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
const unit = (n: number): bigint[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1n : 0n)));
function ring12WithChord(): number[][] {
  const A = zeros(12);
  const join = (a: number, b: number): void => { A[a - 1]![b - 1] = 1; A[b - 1]![a - 1] = 1; };
  for (let k = 1; k <= 12; k++) join(k, (k % 12) + 1);
  join(1, 7);
  return A;
}
function ring12(): number[][] {
  const A = zeros(12);
  for (let k = 0; k < 12; k++) { A[k]![(k + 1) % 12] = 1; A[(k + 1) % 12]![k] = 1; }
  return A;
}
function starArms(arms: number): number[][] {
  const A = zeros(arms + 1);
  for (let k = 1; k <= arms; k++) { A[0]![k] = 1; A[k]![0] = 1; }
  return A;
}
function path12FourRoads(): number[][] {
  const A = zeros(12);
  for (let k = 0; k < 11; k++) { A[k]![k + 1] = 4; A[k + 1]![k] = 4; }
  return A;
}
const B = (A: number[][]): never => fromAdjacency(A) as never;

describe('RT-07 attack 22: orbits and plays kept on the main thread', () => {
  it('(a) star with five arms, cap 2000, maxDepth 40', () => {
    const b = B(starArms(5));
    const g = orbitGraph(b, unit(6) as never, 'mutation', 2000, 40) as { items: unknown[]; completeLayers: number };
    expect(g.items.length).toBe(2000);
    expect(g.completeLayers).toBe(10);
    expect(report('22a star5 orbitGraph 2000/40', () => orbitGraph(b, unit(6) as never, 'mutation', 2000, 40))).toBeLessThanOrEqual(LONG_TASK_MS);
  });
  it('(b) path of 12 nodes with 4 roads each way, cap 2000, maxDepth 40', () => {
    const b = B(path12FourRoads());
    const g = orbitGraph(b, unit(12) as never, 'mutation', 2000, 40) as { items: unknown[] };
    process.stdout.write(`RT-07 22b positions ${g.items.length}\n`);
    expect(report('22b path12x4 orbitGraph 2000/40', () => orbitGraph(b, unit(12) as never, 'mutation', 2000, 40))).toBeLessThanOrEqual(LONG_TASK_MS);
  });
  it('(c) 12-cycle with chord, one seed of large entries', () => {
    const b = B(ring12WithChord());
    let v: bigint[] = unit(12)[0]!;
    for (let k = 0; k < 240; k++) v = mutate(b, v as never, (k * 5) % 12) as unknown as bigint[];
    const digits = Math.max(...v.map((x) => (x < 0n ? -x : x).toString().length));
    process.stdout.write(`RT-07 22c seed has entries of up to ${digits} digits\n`);
    const g = orbitGraph(b, [v] as never, 'mutation', 2000, 40) as { items: unknown[] };
    process.stdout.write(`RT-07 22c positions ${g.items.length}\n`);
    expect(report('22c ring12chord large seed orbitGraph 2000/40', () => orbitGraph(b, [v] as never, 'mutation', 2000, 40))).toBeLessThanOrEqual(LONG_TASK_MS);
  });
  it('(d) play with cap 2000 on the path with 4 roads each way, from all ones', () => {
    const b = B(path12FourRoads());
    const ones = Array.from({ length: 12 }, () => 1n);
    const r = play(b, ones as never, undefined, 2000) as { word: number[] };
    process.stdout.write(`RT-07 22d moves ${r.word.length}\n`);
    expect(report('22d path12x4 play cap 2000', () => play(b, ones as never, undefined, 2000))).toBeLessThanOrEqual(LONG_TASK_MS);
  });
  it('(e) playFate with cap 2000 on the path with 4 roads (runs in the worker: printed only)', () => {
    const b = B(path12FourRoads());
    const ones = Array.from({ length: 12 }, () => 1n);
    report('22e path12x4 playFate cap 2000 (worker)', () => playFate(b, ones as never, undefined, 2000));
  });
  it('(f) isRootPopulation on the triangle at e1 + 10000 delta, 20000 steps', () => {
    const b = B([[0, 1, 1], [1, 0, 1], [1, 1, 0]]);
    const v = [10001n, 10000n, 10000n];
    process.stdout.write(`RT-07 22f answer ${String(isRootPopulation(b, v as never, 20000))}\n`);
    expect(report('22f triangle isRootPopulation 20000', () => isRootPopulation(b, v as never, 20000))).toBeLessThanOrEqual(LONG_TASK_MS);
  });
});

describe('RT-07 attack 23: T8 counts and graphs at up to 1152 elements', () => {
  for (const name of ['F4', 'B4', 'C4', 'A5', 'D4']) {
    it(`${name}`, () => {
      const b = boardFromName(name) as never;
      const order = weylOrder(b);
      const ones = Array.from({ length: (b as { n: number }).n }, () => 1);
      const w0 = longestWord(b);
      let worst = 0;
      worst = Math.max(worst, report(`23 ${name} (|W| ${order}) weylOrder`, () => weylOrder(boardFromName(name) as never)));
      worst = Math.max(worst, report(`23 ${name} countCompleteGames`, () => countCompleteGames(boardFromName(name) as never)));
      worst = Math.max(worst, report(`23 ${name} commutationClassSize(longest word, ${w0.length} bricks)`, () => commutationClassSize(b, w0)));
      worst = Math.max(worst, report(`23 ${name} legalLayers`, () => legalLayers(boardFromName(name) as never)));
      const graphAndEdges = (): number => {
        const g = orbitGraph(b, [ones] as never, 'firing', 1152, undefined, true) as { items: number[][] };
        const keys = new Map<string, number>();
        g.items.forEach((v, k) => keys.set(v.join(','), k));
        let edges = 0;
        for (const v of g.items) for (let i = 0; i < v.length; i++) if (v[i]! > 0 && keys.has((fire(b, v as never, i) as number[]).join(','))) edges++;
        return edges;
      };
      worst = Math.max(worst, report(`23 ${name} orbitGraph legal 1152 + edges`, graphAndEdges));
      expect(worst).toBeLessThanOrEqual(LONG_TASK_MS);
    });
  }
});

describe('RT-07 attack 24: the engine calls of one load of T4 on the 12-cycle, as the tool makes them', () => {
  // T4 resolves the spec it loads four times (urlCodec's decode, T04ClassificationLab.svelte lines 78
  // and 119, BoardEditor.svelte line 71), and site/src/lib/state.ts resolveBoard classifies every new
  // board object (verdictOf); the verdict panel adds smallestNonfiniteSubboard, spectralRadius and
  // symmetrizer, and the root counter one bounded orbitGraph (cap 2000, 40 layers) on the main thread.
  it('12-cycle: four classify computations, the T4 panels and the bounded counter, in one task', () => {
    const A = ring12();
    const once = (): void => {
      for (let k = 0; k < 4; k++) classify(B(A));
      const b = B(A);
      smallestNonfiniteSubboard(b);
      spectralRadius(b);
      symmetrizer(b);
      orbitGraph(b, unit(12) as never, 'mutation', 2000, 40);
    };
    expect(report('24 T4 load path on the 12-cycle (4 classify + panels + counter)', once)).toBeLessThanOrEqual(LONG_TASK_MS);
  });
});

describe('RT-07 attack 24: classify and the T4 panels on 12 nodes', () => {
  const cases: [string, () => number[][]][] = [
    ['12-cycle (A11~)', ring12],
    ['star with eleven arms', () => starArms(11)],
    ['path12 with 4 roads each way', path12FourRoads],
    ['12-cycle with chord', ring12WithChord],
  ];
  for (const [label, A] of cases) {
    it(label, () => {
      let worst = 0;
      worst = Math.max(worst, report(`24 ${label} classify (fresh board)`, () => classify(B(A()))));
      worst = Math.max(worst, report(`24 ${label} smallestNonfiniteSubboard`, () => smallestNonfiniteSubboard(B(A()))));
      worst = Math.max(worst, report(`24 ${label} spectralRadius`, () => spectralRadius(B(A()))));
      worst = Math.max(worst, report(`24 ${label} symmetrizer`, () => symmetrizer(B(A()))));
      expect(worst).toBeLessThanOrEqual(LONG_TASK_MS);
    });
  }
});
