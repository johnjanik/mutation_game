// The golden key `satake_examples` (SPEC.md 2.15 "Which pairs are real forms" and its twelve-row table, 5.4
// admissibility, 5.7 phase 6 and rules 2, 5, 6, Appendix G; P6-A1 instruction 5.5, 5.10): for each of the twelve
// records, matched by type, black_nodes and tau (rule 5), admissibility gives exactly the recorded verdicts of
// the three conditions and of `admissible`, and `symmetry` is true (verify.py asserts it). The `reasons` are
// sentences in the file and are not compared (rule 6); the codes are asserted instead. The names in
// `real_forms` need matchCatalogue and are checked by P6-A2, which reads this key without registering it again
// (plan, P6-A1 instruction 5.10).
import { describe, expect, it } from 'vitest';
import { toPositions } from '../../src/board';
import { NotAdmissible } from '../../src/errors';
import { admissibility, restrictedBoard, satake } from '../../src/satake';
import { boardOf, covers, golden, labels, matchRecord } from './_harness';

covers('satake_examples');

interface ExampleRecord {
  type: string;
  black_nodes: number[];
  tau: number[];
  condition_1: boolean;
  condition_2: boolean;
  condition_3: boolean;
  admissible: boolean;
  real_forms: string[];
  reasons: Record<string, string>;
}

const EXAMPLES = golden.satake_examples as ExampleRecord[];

function judged(rec: ExampleRecord) {
  const board = boardOf(rec.type);
  const black = toPositions(board, rec.black_nodes);
  const tau = toPositions(board, rec.tau);
  return { board, black, tau, a: admissibility({ board, black, tau }) };
}

describe('satake_examples', () => {
  it('there are twelve records, each identified by type, black_nodes and tau', () => {
    expect(EXAMPLES.length).toBe(12);
    for (const rec of EXAMPLES) {
      expect(matchRecord(EXAMPLES, { type: rec.type, black_nodes: rec.black_nodes, tau: rec.tau })).toBe(rec);
    }
  });

  it('verdicts of the twelve examples', () => {
    for (const rec of EXAMPLES) {
      const { a } = judged(rec);
      const where = `${rec.type} black ${JSON.stringify(rec.black_nodes)} tau ${JSON.stringify(rec.tau)}`;
      expect(a.symmetry, where).toBe(true);
      expect(a.condition_1, where).toBe(rec.condition_1);
      expect(a.condition_2, where).toBe(rec.condition_2);
      expect(a.condition_3, where).toBe(rec.condition_3);
      expect(a.admissible, where).toBe(rec.admissible);
      expect(a.admissible, where).toBe(rec.condition_1 && rec.condition_2 && rec.condition_3);
      // the golden reasons are keyed by the failed conditions: the same keys, in the same order
      expect(Object.keys(a.reasons), where).toEqual(Object.keys(rec.reasons));
    }
  });

  it('reason codes of the failed conditions', () => {
    for (const rec of EXAMPLES) {
      const { a, board } = judged(rec);
      const where = `${rec.type} black ${JSON.stringify(rec.black_nodes)}`;
      if (!rec.condition_3) {
        expect(a.reasons.condition_3?.code, where).toBe('not-an-integer');
        expect(a.reasons.condition_3?.value, where).toMatch(/^-?\d+\/\d+(; -?\d+\/\d+)*$/);
      }
      if (!rec.condition_2) {
        expect(a.reasons.condition_2?.code, where).toBe('differs-from-minus-wX');
        // the oracle's sentence names the failing black nodes as labels, "on the black nodes [4, 5], ..."
        const named = /\[([\d, ]*)\]/.exec(rec.reasons.condition_2!)![1]!.split(',').map((s) => Number(s.trim()));
        expect(labels(board, a.reasons.condition_2!.nodes), where).toEqual(named);
      }
      if (!rec.condition_1) expect(a.reasons.condition_1?.code, where).toBe('moves-black-set');
    }
    const flip = matchRecord(EXAMPLES, { type: 'A3', black_nodes: [1], tau: [3, 2, 1] });
    expect(judged(flip).a.reasons.condition_1).toEqual({ code: 'moves-black-set', nodes: [0] });
  });

  it('the fraction of each failed condition 3 is the one the oracle states', () => {
    for (const rec of EXAMPLES) {
      if (rec.condition_3) continue;
      const { a, board } = judged(rec);
      // "<alpha_2, rho_X^vee> = -1/2 is not an integer": the label and the fraction, for each failing node
      const stated = [...rec.reasons.condition_3!.matchAll(/<alpha_(\d+), rho_X\^vee> = (-?\d+\/\d+)/g)];
      expect(labels(board, a.reasons.condition_3!.nodes)).toEqual(stated.map((m) => Number(m[1])));
      expect(a.reasons.condition_3!.value).toBe(stated.map((m) => m[2]).join('; '));
    }
  });

  it('satake and restrictedBoard refuse every non-admissible example with NotAdmissible', () => {
    for (const rec of EXAMPLES) {
      const { board, black, tau, a } = judged(rec);
      if (rec.admissible) {
        expect(() => satake({ board, black, tau })).not.toThrow();
        continue;
      }
      for (const f of [satake, restrictedBoard]) {
        let err: unknown = null;
        try {
          f({ board, black, tau });
        } catch (e) {
          err = e;
        }
        expect(err).toBeInstanceOf(NotAdmissible);
        expect((err as NotAdmissible).data).toEqual(a);
      }
    }
  });
});
