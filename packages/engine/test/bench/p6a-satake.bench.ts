// The E7 and E8 timing of the phase-6 roster (P6-A1 instruction, acceptance: "E7 and E8 satake records compute
// within the worker budget (report the time)"). SPEC.md E-9 item 3 sends Satake data for E7 and E8 to the
// worker and sets no number for a worker call, so nothing is asserted on the time (plan): the median of five
// runs per record is written out for the report. It reads a clock, so it runs alone through
// `npm run bench -w packages/engine` (test/bench/vitest.config.ts, one file at a time), out of the parallel
// suite of `npm test` (site/tests/unit/scripts.test.ts "timing checks run alone"). Each run's result is checked
// against its record, so the time is that of a correct computation; the full comparison of every record is in
// test/golden/p6a-satake-computed.test.ts.
import { describe, expect, it } from 'vitest';
import { toPositions } from '../../src/board';
import { restrictedBoard, satake } from '../../src/satake';
import { boardOf, golden, intEq } from '../golden/_harness';

interface SatakeRecord {
  dynkin_type: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
  dim_k: number;
  real_rank: number;
}

const RUNS = 5;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

describe('E7 and E8 satake records', () => {
  it('timing of E7 and E8 records (median of five runs each, written out, not asserted)', { timeout: 120000 }, () => {
    const records = (golden.satake as SatakeRecord[]).filter((r) => r.dynkin_type === 'E7' || r.dynkin_type === 'E8');
    expect(records.length).toBeGreaterThan(0);
    const lines: string[] = [];
    for (const rec of records) {
      const board = boardOf(rec.dynkin_type);
      const d = { board, black: toPositions(board, rec.black_nodes), tau: toPositions(board, rec.tau) };
      const times: number[] = [];
      const boardTimes: number[] = [];
      for (let k = 0; k < RUNS; k++) {
        const t0 = performance.now();
        const s = satake(d);
        times.push(performance.now() - t0);
        intEq(s.dim_k, rec.dim_k, rec.real_form);
        intEq(s.real_rank, rec.real_rank, rec.real_form);
        const t1 = performance.now();
        const rb = restrictedBoard(d);
        boardTimes.push(performance.now() - t1);
        expect(rb.orbits.length).toBe(rec.real_rank);
      }
      lines.push(`${rec.dynkin_type} ${rec.real_form}: satake median ${median(times).toFixed(2)} ms, restrictedBoard median ${median(boardTimes).toFixed(2)} ms`);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  });
});
