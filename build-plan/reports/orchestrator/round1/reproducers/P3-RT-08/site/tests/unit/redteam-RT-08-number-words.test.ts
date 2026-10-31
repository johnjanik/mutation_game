// RT-08 (content rules), attack 12: golden numbers typed as words, where the numbers-in-prose scanner
// (digits only) cannot see them. SPEC.md 7.3: "Every number in a lesson that has a golden value is
// written this way [<G>], so prose cannot drift from the data"; 8.4 "Numbers that have a golden value are
// written with <G>, never typed"; CONTRACTS 7. Each case: the phrase as it stands in the MDX source, the
// golden path of the quantity it states (same board, same quantity), and the value of the word.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveGoldenPath } from '../../src/lib/golden';

const read = (f: string) => readFileSync(fileURLToPath(new URL(`../../src/content/modules/${f}`, import.meta.url)), 'utf8');

const CASES = [
  // M5 beat 5, prose: the number of moves of a complete game on A3 = the number of positive roots.
  { file: 'm5-weyl.mdx', phrase: 'The six moves fire', path: 'types.A3.n_positive_roots', value: 6 },
  // M5 beat 6, prose: "the value 1 <G k="types.A3.fired_tally.1"/> times, 2 twice, 3 once".
  { file: 'm5-weyl.mdx', phrase: '<Tex src="2"/> twice', path: 'types.A3.fired_tally.2', value: 2 },
  { file: 'm5-weyl.mdx', phrase: '<Tex src="3"/> once', path: 'types.A3.fired_tally.3', value: 1 },
  // M2 beat 4, caption prop of the Kaleidoscope b4: "the picture of A2 with its six roots".
  { file: 'm2-form.mdx', phrase: 'A2 with its six roots', path: 'types.A2.n_roots', value: 6 },
  // M3 beat 3, prose: the frozen population of the star with four arms, each arm one.
  { file: 'm3-classification.mdx', phrase: 'and each arm one', path: 'affine.D4.marks[0]', value: 1 },
];

describe('RT-08: number words with a golden value', () => {
  for (const c of CASES) {
    it(`${c.file}: "${c.phrase}" states ${c.path} as a typed word`, () => {
      expect(resolveGoldenPath(c.path), `${c.path} is the quantity the phrase states`).toBe(c.value);
      // Observed at 69546f0: the phrase is in the source, typed.
      expect(read(c.file).includes(c.phrase), `${c.file} types ${c.path} as a word`).toBe(false);
    });
  }
});
