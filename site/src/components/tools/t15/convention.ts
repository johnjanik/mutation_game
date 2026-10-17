// The Olympiad's form of the pentagon puzzle (SPEC.md 2.3, 2.9 row "Olympiad 1986, Problem 3", 2.12,
// D8). A display only: the state, links and exports stay in the site's convention (D7, a = Cp, fire
// positive); the reader sees x_i = -a_i on every node. The Olympiad fires a negative x_i, which is the
// site's positive a_i, so the legal nodes are the same set in both forms. Display arithmetic on bigint
// values; nothing here calls the engine.

export type Convention = 'olympiad' | 'site';

/** The values shown: x = -a in the Olympiad's form, a itself in the site's convention. */
export function shownValues(a: readonly bigint[], convention: Convention): bigint[] {
  return convention === 'olympiad' ? a.map((x) => -x) : [...a];
}

/** One value as text in a convention (decimal text with an ASCII hyphen, as data-value carries it). */
export function shownText(a: bigint, convention: Convention): string {
  return (convention === 'olympiad' ? -a : a).toString();
}

/** The Olympiad's sum of the numbers shown in its form, sum of x_i (on the pentagon, minus the level). */
export function olympiadSum(a: readonly bigint[]): bigint {
  return a.reduce((s, x) => s - x, 0n);
}

/** The legal nodes (positions) in the site's convention: a positive number may be fired. */
export function legalInSite(a: readonly bigint[]): number[] {
  return a.flatMap((x, k) => (x > 0n ? [k] : []));
}

/** The legal nodes (positions) in the Olympiad's form: a negative number may be flipped. */
export function legalInOlympiad(x: readonly bigint[]): number[] {
  return x.flatMap((v, k) => (v < 0n ? [k] : []));
}

/** What the switch says the form in force is (data-out="convention"). */
export const CONVENTION_TEXT: Readonly<Record<Convention, string>> = {
  olympiad: "Olympiad form: a negative number is flipped and added to both neighbours.",
  site: "This site's convention: a positive number is fired; it is added to both neighbours and changes sign.",
};
