// RT-09 finding P3-RT-09-07 (attack 29): M1 and M3 state the range of the Kostant's game checks without its
// rank bound. M1 beat 3: "this is verified by computation for every such board and every starting city" (every
// board of finite type with single roads); M1 and M3 provenance constants SEEN_STARTS and SEEN_KOSTANT:
// "verified by computation for every board of finite type and every starting city". There are infinitely many
// boards of finite type (A_n, D_n for every n); the checks of SPEC 2.7 (F13) cover "all types of rank at most 8",
// and the golden key `kostant` holds exactly the 32 types of rank at most 8. SPEC 0.3: "the range of boards
// checked is stated with the claim or is "every type of rank at most 8""; SPEC 8.4 accepts "Verified by
// computation for all boards of rank at most 8". M1 and M3 print the range of the other claims of the same
// Seen boxes with the bound ("of rank at most eight"), so the omission is in these strings only.
// Run: npx vitest run --project site-unit site/tests/unit/redteam-RT-09-07-kostant-range.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (f: string): string => readFileSync(fileURLToPath(new URL(`../../src/content/modules/${f}`, import.meta.url)), 'utf8');
const GOLDEN = JSON.parse(readFileSync(fileURLToPath(new URL('../../../reference/golden_data.json', import.meta.url)), 'utf8')) as {
  kostant: Record<string, unknown>;
  types: Record<string, { cartan: number[][] }>;
};

describe('P3-RT-09-07: Kostant ranges printed without the rank bound', () => {
  it('the golden data checks Kostant\'s game on the 32 types of rank at most 8 only', () => {
    const ranks = Object.keys(GOLDEN.kostant).map((t) => GOLDEN.types[t]!.cartan.length);
    expect(Object.keys(GOLDEN.kostant).length).toBe(32);
    expect(Math.max(...ranks)).toBe(8);
  });

  for (const [file, constant] of [
    ['m1-mutation.mdx', 'SEEN_STARTS'],
    ['m3-classification.mdx', 'SEEN_KOSTANT'],
  ] as const) {
    it(`${file}: ${constant} states the range as checked`, () => {
      const value = new RegExp(`export const ${constant} = '([^']*)'`).exec(read(file))?.[1] ?? '';
      expect(value).toBe('verified by computation for every board of finite type and every starting city');
      expect(value, `${file} prints "${value}"; the checks cover the types of rank at most 8 (SPEC 2.7, golden kostant).`).toMatch(/rank at most/);
    });
  }

  it('m1-mutation.mdx beat 3 states the range as checked', () => {
    const m1 = read('m1-mutation.mdx');
    const sentence = 'this is verified by computation for every such board and every starting city';
    expect(m1).toContain(sentence);
    expect(m1.includes(`${sentence} of rank at most`), `M1 beat 3 prints "${sentence}" (every board of finite type with single roads); the checks cover rank at most 8.`).toBe(true);
  });
});
