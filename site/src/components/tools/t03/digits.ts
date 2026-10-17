// The digit rule of small values (SPEC.md 5.6: "Digits of an entry typed into T3 | 6 | the field refuses
// more"; P2-A2 instruction 5.5). Pure. A field holds an optional leading minus sign and at most
// CAPS.formFinderDigits decimal digits; the sign is not a digit (plan reading). Anything else (a letter,
// a seventh digit, a sign elsewhere) is refused, whether typed or pasted: the field keeps its last
// accepted text. A true minus sign (U+2212) is read as a minus sign.
import { CAPS } from '@two-games/engine';

/** The cap, from the engine's table of caps (never a literal here). */
export const MAX_DIGITS: number = CAPS.formFinderDigits;

/** The result of offering a new text to a field: the text the field keeps and whether the offer was refused. */
export interface EntryResult {
  text: string;
  refused: boolean;
}

/** Normalises the minus sign; nothing else is changed. */
function normalise(text: string): string {
  return text.replace(/^−/, '-');
}

/** True when `text` is a text the field may hold: empty, a lone minus, or a minus and up to MAX_DIGITS digits. */
export function entryAllowed(text: string): boolean {
  const m = /^-?(\d*)$/.exec(normalise(text));
  return m !== null && m[1]!.length <= MAX_DIGITS;
}

/**
 * Offers `next` (what the field holds after a keystroke or a paste) to a field whose last accepted text
 * is `previous`: accepted as it stands, or refused with `previous` kept.
 */
export function offerEntry(previous: string, next: string): EntryResult {
  if (entryAllowed(next)) return { text: normalise(next), refused: false };
  return { text: previous, refused: true };
}

/** The integer a field holds, or null while it holds no whole number (empty, or a lone minus). */
export function entryValue(text: string): number | null {
  const t = normalise(text.trim());
  if (!/^-?\d+$/.test(t)) return null;
  const v = Number(t);
  return Object.is(v, -0) ? 0 : v;
}

/** The notice beside the fields after a refusal (plan wording). */
export function digitNotice(city: number, row: number, kept: string): string {
  const keptText = kept === '' ? 'stays empty' : `keeps ${kept.replace(/^-/, '−')}`;
  return `An entry takes at most ${MAX_DIGITS} digits and an optional minus sign: city ${city} in row ${row} ${keptText}.`;
}
