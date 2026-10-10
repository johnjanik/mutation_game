// Long numbers (SPEC.md 4.0): "A value of more than 12 digits is shown shortened ("1.2345... x 10^83",
// with the number of digits), with the exact digits in the table view, in the tooltip and in every
// export." Pure. Digits are counted without the sign (plan). A fraction is shortened part by part.
// The hooks (data-value) and exports keep the exact text; only what is drawn on a node is shortened.

/** More than this many digits is a long number. */
export const LONG_DIGITS = 12;

const INTEGER = /^([-−]?)(\d+)$/;

/** The number of digits of an integer text, without its sign. */
export function digitCount(text: string): number {
  const m = INTEGER.exec(text.trim());
  if (m === null) throw new RangeError(`not an integer: ${JSON.stringify(text)}`);
  return m[2]!.replace(/^0+(?=\d)/, '').length;
}

/** True when an integer or a fraction has a part of more than 12 digits. */
export function isLong(text: string): boolean {
  return text.split('/').some((part) => digitCount(part) > LONG_DIGITS);
}

function shortenInteger(text: string): string {
  const m = INTEGER.exec(text.trim())!;
  const sign = m[1] ? '−' : '';
  const digits = m[2]!.replace(/^0+(?=\d)/, '');
  if (digits.length <= LONG_DIGITS) return sign + digits;
  return `${sign}${digits[0]}.${digits.slice(1, 5)}... x 10^${digits.length - 1} (${digits.length} digits)`;
}

/**
 * The text drawn for a value: unchanged up to 12 digits (with a true minus sign, as displayValue);
 * above, "1.2345... x 10^83 (84 digits)". A fraction is shortened part by part.
 */
export function shortValue(text: string): string {
  return text
    .split('/')
    .map((part) => shortenInteger(part))
    .join('/');
}
