// P0-A5: the sign of a value and its numeral on screen (SPEC.md 6.3, 4.0 Signs).
import { describe, expect, it } from 'vitest';
import { displayValue, signOf } from '../../src/components/board/sign';

describe('signOf', () => {
  it('signOf classifies number, bigint and decimal string', () => {
    expect(signOf(1)).toBe(1);
    expect(signOf(0)).toBe(0);
    expect(signOf(-0)).toBe(0);
    expect(signOf(-7)).toBe(-1);
    expect(signOf(Number.MAX_SAFE_INTEGER)).toBe(1);
    expect(signOf(12345678901234567890123n)).toBe(1);
    expect(signOf(-12345678901234567890123n)).toBe(-1);
    expect(signOf(0n)).toBe(0);
    expect(signOf('-12345678901234567890123')).toBe(-1);
    expect(signOf('−3')).toBe(-1);
    expect(signOf('+3')).toBe(1);
    expect(signOf('0')).toBe(0);
    expect(signOf('-0')).toBe(0);
    expect(signOf('000')).toBe(0);
    expect(signOf('2/3')).toBe(1);
    expect(signOf('-2/3')).toBe(-1);
    expect(() => signOf('1.5')).toThrow(RangeError);
    expect(() => signOf('abc')).toThrow(RangeError);
    expect(() => signOf(Number.NaN)).toThrow(RangeError);
  });
});

describe('displayValue', () => {
  it('displayValue uses U+2212 and never a hyphen', () => {
    expect(displayValue(-1)).toBe('−1');
    expect(displayValue('-1')).toBe('−1');
    expect(displayValue(-1n)).toBe('−1');
    expect(displayValue('−1')).toBe('−1');
    expect(displayValue(2)).toBe('2');
    expect(displayValue('+2')).toBe('2');
    expect(displayValue(0)).toBe('0');
    expect(displayValue(-0)).toBe('0');
    expect(displayValue('-0')).toBe('0');
    expect(displayValue(-9007199254740991)).toBe('−9007199254740991');
    expect(displayValue(-123456789012345678901234567890n)).toBe('−123456789012345678901234567890');
    expect(displayValue(1234567)).toBe('1234567'); // no grouping
    for (const v of [-1, -17, '-5', -99n, '-12345678901234567890']) {
      expect(displayValue(v)).not.toContain('-');
      expect(displayValue(v).startsWith('−')).toBe(true);
    }
    expect(() => displayValue(1.5)).toThrow(RangeError);
  });
});
