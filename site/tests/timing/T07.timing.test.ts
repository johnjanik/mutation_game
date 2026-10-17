// P3-A5's main-thread timing test of tool T7, the Symbolic Game (SPEC.md 4 T7; 7.6), moved by P4-X2 (for MERGE,
// P4 wave 4.4) from site/tests/unit/tools/T07.test.ts without a change to what it measures or to its bound: like
// T10's, its median of seven runs is checked against 25 ms, which the parallel site unit suite cannot hold on
// a busy machine. It runs alone through `npm run bench` (site/tests/timing/vitest.config.ts). The module
// exports of T07SymbolicGame.svelte and state.ts are loaded as in T07.test.ts, through the helper
// site/tests/unit/_svelteSsr.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AnyBoard } from '@engine';
import { ssrLoader, type SsrLoader } from '../unit/_svelteSsr';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  types: Record<string, { longest_word: number[]; n_positive_roots: number }>;
};

/** The module exports of T07SymbolicGame.svelte that the measurement calls. */
interface T07Module {
  symbolicView(board: AnyBoard, moves: readonly number[], roots?: readonly (readonly number[])[]): { word: number[]; fired: number[][]; entries: number[][]; rows: { root: number[]; move: number | null }[] };
}
interface StateModule {
  resolveBoard(spec: string | { cartan: number[][] }): AnyBoard;
}

let loader: SsrLoader;
let T7: T07Module;
let ST: StateModule;

beforeAll(async () => {
  loader = await ssrLoader();
  T7 = await loader.load<T07Module>('/src/components/tools/T07SymbolicGame.svelte');
  ST = await loader.load<StateModule>('/src/lib/state.ts');
}, 120000);

afterAll(async () => {
  await loader?.close();
});

describe('T7 state, links and Big', () => {
  it('recomputation after a move stays under the long-task budget', () => {
    const E8 = ST.resolveBoard('E8');
    const moves = golden.types.E8!.longest_word;
    expect(moves).toHaveLength(golden.types.E8!.n_positive_roots);
    const times: number[] = [];
    for (let run = 0; run < 7; run++) {
      const t0 = performance.now();
      const view = T7.symbolicView(E8, moves);
      times.push(performance.now() - t0);
      expect(view.rows.every((r) => r.move !== null)).toBe(true);
    }
    times.sort((a, b) => a - b);
    const median = times[3]!;
    process.stdout.write(`T7 recomputation on E8 along longest_word: median ${median.toFixed(2)} ms of [${times.map((t) => t.toFixed(2)).join(', ')}]\n`);
    expect(median).toBeLessThan(25);
  });
});
