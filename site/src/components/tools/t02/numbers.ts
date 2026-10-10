// Long numbers and signs on screen (SPEC.md 4.0 "Long numbers"; 6.3: a true minus sign). Pure.
// P0-A5 assigned the shortening helper to T1 (P1-A5, built in the same stage); this copy follows the
// example of 4.0 character for character, and MERGE is asked to keep one copy.

/** The true minus sign of 6.3. */
export const MINUS = '−';

/** Decimal text with a true minus sign. */
export function withTrueMinus(text: string): string {
  return text.startsWith('-') ? MINUS + text.slice(1) : text;
}

/** Values of more than this many digits are shortened (4.0). */
export const LONG_DIGITS = 12;

/**
 * A value of more than 12 digits shortened as 4.0 shows it ("1.2345... x 10^83", with the number of
 * digits): the leading digit, a point, the next four digits, three dots, a space, x, a space, 10^ and
 * the number of digits minus 1, a true minus sign in front of a negative value, and the number of
 * digits beside it: "1.2345... x 10^16 (17 digits)". Shorter values come back with a true minus sign.
 */
export function shortNumber(text: string): string {
  const negative = text.startsWith('-');
  const digits = negative ? text.slice(1) : text;
  if (digits.length <= LONG_DIGITS) return withTrueMinus(text);
  const head = `${digits[0]}.${digits.slice(1, 5)}... x 10^${digits.length - 1}`;
  return `${negative ? MINUS : ''}${head} (${digits.length} digits)`;
}

/** Whether a value is shortened on screen. */
export function isLong(text: string): boolean {
  return text.replace(/^-/, '').length > LONG_DIGITS;
}

/** The label of a vertex: entries in label order, each shortened, joined by commas. */
export function vertexText(entries: readonly string[]): string {
  return entries.map(shortNumber).join(', ');
}

/** The exact text of a position (table, tooltip): entries with true minus signs. */
export function exactText(entries: readonly string[]): string {
  return entries.map(withTrueMinus).join(', ');
}
