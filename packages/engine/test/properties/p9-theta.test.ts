// SPEC.md 5.7, property 9: "theta(theta(p)) = p for every catalogue record of B, and theta permutes the roots."
// The board B is drawn at random from the type list and p has random integer entries in [-9, 9] (5.7: "vectors
// have random integer entries in [-9, 9]"); each run then checks every record of B in the golden key `satake`
// (plan: satakeCatalogue is P6-A2's and arrives later, P6-A1 instruction trap 19), not one record drawn at
// random (repair after review: one drawn record left 20 and 56 of the 167 records unchecked with this seed).
// After each property a check confirms that the runs reached all 167 records. The record's black_nodes and tau
// are labels and are converted with toPositions (E-7). Plan additions: theta is linear and agrees on a Big
// copy of the board (a finite board built by hand). No covers(): the key `satake` is registered by P6-A2's
// full-record test (reported as a deviation from CONTRACTS.md 3, P6-A1 instruction section 4).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/board';
import { cartanNumbers, toPositions } from '../../src/board';
import type { SatakeDiagram } from '../../src/satake';
import { theta } from '../../src/satake';
import { roots } from '../../src/search';
import { TYPE_NAMES, boardOf, golden } from '../golden/_harness';
import { boardFromCartan } from '../helpers/p2';

// fixed seed and run count, recorded in decisions/P6-A1.md (CONTRACTS.md 3)
const SEED = 20261025;
const NUM_RUNS = 400;
const NUM_RUNS_ROOTS = 200; // each run plays theta on every root of the board

interface SatakeRecord {
  dynkin_type: string;
  real_form: string;
  black_nodes: number[];
  tau: number[];
}

const RECORDS = golden.satake as SatakeRecord[];
const recordsOf = (T: string): SatakeRecord[] => RECORDS.filter((r) => r.dynkin_type === T);

// the board B and two populations; the records of B are all checked inside the property
const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
  const n = boardOf(T).n;
  const vec = fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n });
  return fc.tuple(fc.constant(T), vec, vec);
});

/** Every catalogue record of the board T as a diagram on positions, with the record it comes from. */
function diagramsOf(T: string): [SatakeRecord, SatakeDiagram][] {
  const board = boardOf(T);
  return recordsOf(T).map((rec) => [rec, { board, black: toPositions(board, rec.black_nodes), tau: toPositions(board, rec.tau) }]);
}

const key = (v: readonly number[]): string => v.join(',');

describe('property 9', () => {
  it('every type has catalogue records', () => {
    for (const T of TYPE_NAMES) expect(recordsOf(T).length, T).toBeGreaterThanOrEqual(2);
  });

  it('theta is an involution', { timeout: 60000 }, () => {
    const reached = new Set<SatakeRecord>();
    fc.assert(
      fc.property(caseArb, ([T, p, q]) => {
        const big = boardFromCartan(cartanNumbers(boardOf(T))) as unknown as Board;
        for (const [rec, d] of diagramsOf(T)) {
          const pIn = [...p];
          const t = theta(d, p);
          expect(theta(d, t), rec.real_form).toEqual(p);
          expect(p).toEqual(pIn);
          // linear: theta(p + q) = theta(p) + theta(q)
          const sum = p.map((x, i) => x + q[i]!);
          const tq = theta(d, q);
          expect(theta(d, sum), rec.real_form).toEqual(t.map((x, i) => x + tq[i]!));
          // the same on a Big copy of the board, a finite board built by hand
          expect(theta({ ...d, board: big }, p), rec.real_form).toEqual(t);
          reached.add(rec);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
    // with this seed the runs draw every board, so every record of the catalogue was checked
    expect(reached.size).toBe(RECORDS.length);
  });

  it('theta permutes the roots', { timeout: 60000 }, () => {
    const reached = new Set<SatakeRecord>();
    fc.assert(
      fc.property(caseArb, ([T]) => {
        const R = roots(boardOf(T), 100000).items;
        const all = new Set(R.map(key));
        for (const [rec, d] of diagramsOf(T)) {
          const images = new Set<string>();
          for (const a of R) {
            const t = theta(d, a);
            expect(all.has(key(t)), `${rec.real_form}: theta(${key(a)}) is a root`).toBe(true);
            images.add(key(t));
          }
          expect(images.size, rec.real_form).toBe(R.length);
          reached.add(rec);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS_ROOTS },
    );
    expect(reached.size).toBe(RECORDS.length);
  });
});
