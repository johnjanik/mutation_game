// RT-11 attack 23, mutant M12 (SPEC.md 5.7 rule 1: "Integers beyond 2^53 are stored as decimal strings
// (bigint_test) and compare with bigint values by their decimal text"). The harness's intEq must reject a
// bigint and a decimal string, or a bigint and a JSON number, that differ only beyond the precision of a
// double. Adopted from the red team (P3-RT-11-01): it passes with intEq as it stands and fails when intEq
// compares Number(actual) with Number(expected) (mutant M12), under which every bigint_test comparison of
// population_end and numbers_end would accept a value wrong in its last digits.
import { describe, expect, it } from 'vitest';
import { golden, intEq } from '../golden/_harness';

describe('intEq compares big integers by their decimal text (rule 1)', () => {
  // regression: P3-RT-11-01
  it('two values beyond 2^53 that differ in the last digit are rejected', () => {
    const big = 2n ** 60n;
    expect(() => intEq(big + 1n, big.toString())).toThrow(/does not print as/);
    expect(() => intEq(big, (big + 1n).toString())).toThrow(/does not print as/);
    expect(() => intEq(big, big.toString())).not.toThrow();
  });

  // regression: P3-RT-11-01
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

  // regression: P3-RT-11-01
  it('a bigint against a JSON number compares exactly, and a JSON number beyond 2^53 is refused', () => {
    const maxSafe = 2 ** 53 - 1;
    expect(() => intEq(2n ** 53n - 1n, maxSafe)).not.toThrow();
    expect(() => intEq(2n ** 53n, maxSafe)).toThrow(/does not print as/);
    expect(() => intEq(-(2n ** 53n) + 1n, -maxSafe)).not.toThrow();
    // 2^53 + 1 and 2^53 are the same double, and String(2 ** 60) is "1152921504606847000": a number
    // beyond 2^53 cannot stand for an exact integer, so the comparison refuses it whatever the bigint.
    expect(() => intEq(2n ** 53n + 1n, 2 ** 53)).toThrow(/is not a safe integer/);
    expect(() => intEq(2n ** 53n, 2 ** 53)).toThrow(/is not a safe integer/);
    expect(() => intEq(1152921504606847000n, 2 ** 60)).toThrow(/is not a safe integer/);
    expect(() => intEq(2n ** 60n, 2 ** 60)).toThrow(/is not a safe integer/);
    // the decimal string is the exact form beyond 2^53
    expect(() => intEq([5n, 2n ** 53n + 1n], [5, '9007199254740993'])).not.toThrow();
    expect(() => intEq([5n, 2n ** 53n + 1n], [5, '9007199254740992'])).toThrow(/at \[1\]: 9007199254740993n does not print as/);
  });
});
