// The benchmark of SPEC.md 7.6 "Main-thread work" (CONTRACTS.md 3; P3-A2 instruction 5.15): the worst
// case of the rule of E-9, 2000 positions on a board with 12 nodes in Big arithmetic, repeated as in
// reference/bench_orbit.mjs (the 12-cycle with one chord joining nodes 1 and 7, cap 2000, maxDepth 40,
// the median of seven runs), and failing above 25 ms. Written with describe, it and expect so that it
// fails; Vitest's bench() API reports timings without a threshold. The default include pattern of
// `vitest run` does not collect *.bench.ts, and the engine's vitest.config.ts includes only test/golden,
// test/properties and test/unit, so this file runs alone through the command recorded in
// decisions/P3-A2.md. No warm-up, no retry; the threshold is fixed by SPEC.md 7.6.
import { describe, expect, it } from 'vitest';
import { Big } from '../../src/arith';
import { fromAdjacency } from '../../src/board';
import { orbitGraph } from '../../src/search';

const NODES = 12;
const CAP = 2000;
const MAX_DEPTH = 40;
const RUNS = 7;
const THRESHOLD_MS = 25;

/** The symmetric 0/1 adjacency of the 12-cycle (k joined to k + 1, 12 to 1) with the chord 1 to 7. */
function ring12WithChord(): number[][] {
  const A: number[][] = [];
  for (let i = 0; i < NODES; i++) {
    const row: number[] = [];
    for (let j = 0; j < NODES; j++) row.push(0);
    A.push(row);
  }
  const join = (a: number, b: number): void => {
    A[a - 1]![b - 1] = 1;
    A[b - 1]![a - 1] = 1;
  };
  for (let k = 1; k <= NODES; k++) join(k, (k % NODES) + 1);
  join(1, 7);
  return A;
}

describe('orbit benchmark of SPEC.md 7.6', () => {
  it('12-cycle with a chord: 2000 positions in Big within 25 ms', () => {
    const board = fromAdjacency(ring12WithChord());
    expect(board.arith).toBe(Big);
    expect(board.n).toBe(NODES);
    const seeds: bigint[][] = [];
    for (let i = 0; i < NODES; i++) {
      const e: bigint[] = [];
      for (let j = 0; j < NODES; j++) e.push(j === i ? 1n : 0n);
      seeds.push(e);
    }
    const times: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      const g = orbitGraph(board as Parameters<typeof orbitGraph<bigint>>[0], seeds, 'mutation', CAP, MAX_DEPTH);
      times.push(performance.now() - t0);
      expect(g.items.length).toBe(CAP);
      expect(g.truncated).toBe(true);
    }
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[RUNS >> 1]!;
    // process.stdout.write rather than console.info: the default reporter of the installed Vitest 5.0.3
    // did not relay console.info or console.log from a passing test to the terminal in this environment,
    // while a direct write to stdout reaches it, and GATE needs this line to quote the median.
    process.stdout.write(
      `orbit benchmark: median ${median.toFixed(2)} ms of ${RUNS} runs [${times.map((t) => t.toFixed(2)).join(', ')}] ms, threshold ${THRESHOLD_MS} ms, ${CAP} positions, truncated true\n`,
    );
    expect(median).toBeLessThanOrEqual(THRESHOLD_MS);
  });
});
