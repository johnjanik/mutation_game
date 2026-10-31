// RT-09 finding P3-RT-09-06 (attacks 1 and 2): M2 beat 3 prints, after deriving S_i p = p - (p,e_i) e_i on
// boards with single roads: "On any board the formula reads S_ip = p - 2(p,e_i)/(e_i,e_i) e_i". The pairing
// (p,q) = p^T B q with B = DC exists only on a balanced board (SPEC 2.5: "A one-way board has no invariant form
// with all d_i > 0 and is never balanced"; a bidirected board whose cycles are unbalanced has none either).
// On the one-way road of SPEC 2.11 no symmetric matrix B with positive diagonal makes the formula equal the
// mutation: row 1 of B would be d_1 (2, 0) and row 2 would be d_2 (-1, 2), so B_12 = 0 = -d_2, and (e_2,e_2) = 0.
// Formula probe (redteam/RT-09/formulas.py): 3481 comparisons on nine probe boards, the only disagreement is
// this formula on the one-way road, where it has no form to evaluate.
// Run: npx vitest run --project site-unit site/tests/unit/redteam-RT-09-06-m2-any-board-reflection.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fromAdjacency, symmetrizer } from '@engine';
import type { Board } from '@engine';

const M2 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m2-form.mdx', import.meta.url)), 'utf8');
const SENTENCE = 'On any board the formula reads <Tex src="S_ip=p-\\frac{ 2(p,e_i) }{ (e_i,e_i) }\\,e_i"/>';

describe('P3-RT-09-06: M2 states the reflection formula of the invariant form on any board', () => {
  it('the sentence is on the page as quoted', () => {
    expect(M2).toContain(SENTENCE);
  });

  it('the one-way road has no invariant form, so the formula has nothing to read', () => {
    const oneWay = fromAdjacency([
      [0, 1],
      [0, 0],
    ]) as Board<unknown>; // C = [[2,0],[-1,2]] (SPEC 2.11)
    expect(
      symmetrizer(oneWay),
      'M2 beat 3 says "On any board the formula reads S_i p = p - 2(p,e_i)/(e_i,e_i) e_i", but the one-way road has no weights d (symmetrizer null), so no form (,) exists on it (SPEC 2.5).',
    ).not.toBeNull();
  });

  it('an unbalanced two-way board has no invariant form either', () => {
    // a triangle with two roads from 1 to 2 and one back, single roads elsewhere: the cycle 1-2-3 is unbalanced
    const unbalanced = fromAdjacency([
      [0, 2, 1],
      [1, 0, 1],
      [1, 1, 0],
    ]) as Board<unknown>;
    expect(symmetrizer(unbalanced), 'M2 beat 3, "On any board": this two-way board is not balanced (SPEC 2.5).').not.toBeNull();
  });
});
