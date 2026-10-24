// The engine work of one load of T4 on the 12-cycle (affine A11~), adopted from the RT-07 lens (attack
// 24: engine calls that E-9 keeps on the main thread, timed in Node through the public API, median of
// seven runs). SPEC.md 7.6: "No engine call on the main thread may become a long task (50 ms) on that
// phone"; SPEC.md 5.6 and E-11: classify once when the board is loaded. The lens wrote the load as the
// tool made it at the gate commit: four classify computations of fresh board objects, the T4 panels
// (smallestNonfiniteSubboard, spectralRadius, symmetrizer) and the bounded root counter (cap 2000, 40
// layers). It runs alone through `npm run bench -w packages/engine` (test/bench/vitest.config.ts), out of
// the parallel suite of `npm test`, where a duration measures the load of the suite rather than the engine.
import { describe, expect, it } from 'vitest';
import { classify, fromAdjacency, orbitGraph, smallestNonfiniteSubboard, spectralRadius, symmetrizer } from '../../src/index';

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
function ring12(): number[][] {
  const A = zeros(12);
  for (let k = 0; k < 12; k++) { A[k]![(k + 1) % 12] = 1; A[(k + 1) % 12]![k] = 1; }
  return A;
}
const B = (A: number[][]): never => fromAdjacency(A) as never;

describe('the engine calls of one load of T4 on the 12-cycle, as the tool made them', () => {
  // T4 resolved the spec it loads four times (urlCodec's decode, T04ClassificationLab.svelte, BoardEditor.svelte),
  // and site/src/lib/state.ts resolveBoard classified every new board object (verdictOf); the verdict panel adds
  // smallestNonfiniteSubboard, spectralRadius and symmetrizer, and the root counter one bounded orbitGraph (cap
  // 2000, 40 layers) on the main thread.
  // regression: P3-RT-07-02
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
