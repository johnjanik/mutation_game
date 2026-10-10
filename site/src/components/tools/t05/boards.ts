// The boards T5 offers (SPEC.md 4.0 Board pickers: "A tool whose description names no particular
// boards offers the 32 named types, grouped by letter"). No import: the registry, which every tool
// page loads, reads this list. Names are the reader's choice (D19): C2 stays C2.

/** The 32 named finite types, grouped by letter, by rank within a letter (the order of golden_data.json). */
export const T05_GROUPS: readonly { letter: string; names: readonly string[] }[] = [
  { letter: 'A', names: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'] },
  { letter: 'B', names: ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'] },
  { letter: 'C', names: ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'] },
  { letter: 'D', names: ['D4', 'D5', 'D6', 'D7', 'D8'] },
  { letter: 'E', names: ['E6', 'E7', 'E8'] },
  { letter: 'F', names: ['F4'] },
  { letter: 'G', names: ['G2'] },
];

/** The 32 names in picker order. */
export const T05_BOARDS: readonly string[] = T05_GROUPS.flatMap((g) => g.names);

/** The groups limited to `choices` (the boardChoices property of a lesson page), empty groups dropped. */
export function pickerGroups(choices?: readonly string[]): { letter: string; names: string[] }[] {
  return T05_GROUPS.map((g) => ({ letter: g.letter, names: g.names.filter((n) => choices === undefined || choices.includes(n)) })).filter(
    (g) => g.names.length > 0,
  );
}
