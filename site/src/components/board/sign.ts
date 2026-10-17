// The sign of a value and its numeral on screen (SPEC.md 6.3, 4.0 Signs). Pure; no engine call.
// Three spellings of one sign, never mixed: "minus" is spoken (lib/a11y.ts), U+2212 is written on
// screen (displayValue), and data-value keeps the engine's decimal text with an ASCII hyphen.
import type { Sign } from './types';

export const TRUE_MINUS = '−';

const DECIMAL = /^[+\-−]?\d+$/;
const FRACTION = /^[+\-−]?\d+\/\d+$/;

function normalisedText(value: string): string {
  const t = value.trim();
  if (!DECIMAL.test(t) && !FRACTION.test(t)) throw new RangeError(`not a decimal value: ${JSON.stringify(value)}`);
  return t;
}

/** -1, 0 or 1 for a number, a bigint, or decimal text ("-12", "−12", "+3", "2/3"). */
export function signOf(value: number | bigint | string): Sign {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`not a finite number: ${String(value)}`);
    return value > 0 ? 1 : value < 0 ? -1 : 0;
  }
  if (typeof value === 'bigint') return value > 0n ? 1 : value < 0n ? -1 : 0;
  const t = normalisedText(value);
  const negative = t.startsWith('-') || t.startsWith(TRUE_MINUS);
  const digits = t.replace(/^[+\-−]/, '').split('/')[0]!;
  if (/^0+$/.test(digits)) return 0;
  return negative ? -1 : 1;
}

/** The numeral shown on a node: a true minus sign (U+2212), no plus sign, no digit grouping. */
export function displayValue(value: number | bigint | string): string {
  let body: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`not a finite number: ${String(value)}`);
    if (!Number.isInteger(value)) throw new RangeError(`not an integer: ${String(value)}`);
    body = BigInt(value).toString();
  } else if (typeof value === 'bigint') {
    body = value.toString();
  } else {
    body = normalisedText(value);
  }
  const negative = body.startsWith('-') || body.startsWith(TRUE_MINUS);
  const magnitude = body.replace(/^[+\-−]/, '');
  if (!negative || signOf(body) === 0) return magnitude.replace(/^0+(?=\d)/, '');
  return TRUE_MINUS + magnitude;
}
