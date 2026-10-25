// How the Atlas pages write numbers (SPEC.md 6.3: "a true minus sign"; 4.0 "Long numbers"; 4.0 Test
// hooks, with the plan's data-exact). Owner P6-A4. Pure; build time only.
import type { Rational } from '@two-games/engine';
import { isLong, shortValue } from '../tools/t01/longNumber';

/** The true minus sign of SPEC 6.3 (A-5: never a sign by colour alone). */
export const MINUS = '−';

/** An integer as shown: decimal digits with a true minus sign. */
export function signed(x: number | bigint | string): string {
  const t = String(x);
  return t.startsWith('-') ? `${MINUS}${t.slice(1)}` : t;
}

/** A vector as shown: its entries in round brackets, separated by a comma and a space. */
export function tuple(v: readonly (number | bigint | string)[]): string {
  return `(${v.map(signed).join(', ')})`;
}

/** A list as shown in a sentence: its entries separated by a comma and a space. */
export function list(v: readonly (number | bigint | string)[]): string {
  return v.map(signed).join(', ');
}

/** A rational as shown: the integer when the denominator is 1, else p/q (all integers on the 32 types). */
export function rational(r: Rational): string {
  return r.den === 1n ? signed(r.num) : `${signed(r.num)}/${r.den.toString()}`;
}

/** An integer for data-exact: a JSON number when safe, its decimal digits otherwise (plan; 6.6). */
function exactInteger(x: bigint): number | string {
  const n = Number(x);
  return Number.isSafeInteger(n) && BigInt(n) === x ? n : x.toString();
}

/** The value of data-exact (plan): JSON in label order, integers beyond 2^53 as decimal strings. */
export function exact(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === 'bigint') return exactInteger(v);
    if (typeof v === 'object' && v !== null && 'num' in v && 'den' in v && typeof (v as Rational).num === 'bigint') {
      const r = v as Rational;
      return r.den === 1n ? exactInteger(r.num) : `${r.num.toString()}/${r.den.toString()}`;
    }
    return v;
  });
}

/**
 * A count for the page (4.0 "Long numbers"): up to 12 digits as it stands; above, the shortened form of T1
 * ("1.2666... x 10^15 (16 digits)"), with the exact digits kept for the tooltip, the disclosure and the
 * downloads.
 */
export function longNumber(x: bigint | number): { long: boolean; shown: string; exact: string; digits: number } {
  const digits = BigInt(x).toString();
  const long = isLong(digits);
  return { long, shown: long ? shortValue(digits) : signed(digits), exact: digits, digits: digits.replace(/^-/, '').length };
}
