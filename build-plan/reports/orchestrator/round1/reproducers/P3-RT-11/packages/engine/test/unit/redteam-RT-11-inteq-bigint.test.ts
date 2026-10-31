// RT-11 attack 23, mutant M12 (SPEC.md 5.7 rule 1: "Integers beyond 2^53 are stored as decimal strings
// (bigint_test) and compare with bigint values by their decimal text"). The harness's intEq must reject a
// bigint and a decimal string that differ only beyond the precision of a double. Proposed permanent test
// for the finding on M12: it passes on the gate commit and fails with redteam/mutants/M12.patch applied
// (intEq comparing Number(actual) with Number(expected)), under which every bigint_test comparison of
// population_end and numbers_end would accept a value wrong in its last digits.
import { describe, expect, it } from 'vitest';
import { golden, intEq } from '../golden/_harness';

describe('RT-11: intEq compares big integers by their decimal text (rule 1)', () => {
  it('two values beyond 2^53 that differ in the last digit are rejected', () => {
    const big = 2n ** 60n;
    expect(() => intEq(big + 1n, big.toString())).toThrow(/does not print as/);
    expect(() => intEq(big, (big + 1n).toString())).toThrow(/does not print as/);
    expect(() => intEq(big, big.toString())).not.toThrow();
  });

  it('every stored entry of bigint_test is rejected when the engine value is off by one', () => {
    const ends = [...golden.bigint_test.population_end, ...golden.bigint_test.numbers_end];
    let beyond = 0;
    for (const text of ends) {
      const v = BigInt(text);
      if (v > 2n ** 53n || v < -(2n ** 53n)) beyond += 1;
      expect(() => intEq(v, text)).not.toThrow();
      expect(() => intEq(v + 1n, text), text).toThrow(/does not print as/);
    }
    expect(beyond).toBeGreaterThan(0);
  });
});
