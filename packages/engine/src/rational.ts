// The rational type of SPEC.md E-3 and 5.2: a numerator and a positive denominator on bigint, in lowest
// terms, with no library. Every function returns a normalised value: the sign is on the numerator,
// gcd(|num|, den) = 1n, den > 0n, and zero is { num: 0n, den: 1n }. Parameter types are the plan's
// (P1-A1 instruction 5.2); the eight names are those of CONTRACTS.md 2.4, plus ratNeg (recorded).

export interface Rational {
  num: bigint;
  den: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  // a, b >= 0n
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function normalise(num: bigint, den: bigint): Rational {
  if (den === 0n) throw new RangeError('a rational cannot have a zero denominator');
  if (num === 0n) return { num: 0n, den: 1n };
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num < 0n ? -num : num, den);
  return g === 1n ? { num, den } : { num: num / g, den: den / g };
}

function toBigInt(x: bigint | number, what: string): bigint {
  if (typeof x === 'bigint') return x;
  if (!Number.isSafeInteger(x)) throw new RangeError(`${what} ${String(x)} is not a safe integer`);
  return BigInt(x);
}

/** num/den in lowest terms; den defaults to 1. A number argument must be a safe integer (RangeError otherwise). */
export function rat(num: bigint | number, den: bigint | number = 1n): Rational {
  return normalise(toBigInt(num, 'the numerator'), toBigInt(den, 'the denominator'));
}

export function ratAdd(a: Rational, b: Rational): Rational {
  return normalise(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function ratSub(a: Rational, b: Rational): Rational {
  return normalise(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function ratMul(a: Rational, b: Rational): Rational {
  return normalise(a.num * b.num, a.den * b.den);
}

/** a / b; RangeError when b is zero. */
export function ratDiv(a: Rational, b: Rational): Rational {
  if (b.num === 0n) throw new RangeError('division of a rational by zero');
  return normalise(a.num * b.den, a.den * b.num);
}

/** -a (plan addition, recorded in decisions/P1-A1.md). */
export function ratNeg(a: Rational): Rational {
  return normalise(-a.num, a.den);
}

export function ratEq(a: Rational, b: Rational): boolean {
  // both normalised, so equality is entry by entry; the cross product also covers unnormalised input
  return a.num * b.den === b.num * a.den;
}

export function ratSign(a: Rational): -1 | 0 | 1 {
  return a.num > 0n ? 1 : a.num < 0n ? -1 : 0;
}

/** "p/q" in lowest terms, or "p" when the denominator is 1 (comparison rule 4 of SPEC.md 5.7). */
export function ratToString(a: Rational): string {
  const r = normalise(a.num, a.den);
  return r.den === 1n ? r.num.toString() : `${r.num.toString()}/${r.den.toString()}`;
}
