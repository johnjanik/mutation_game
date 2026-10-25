// RT-08 (content rules, phase 5 round), attack 12: a golden number typed where the numbers-in-prose
// scanner cannot see it. SPEC.md 7.3: "Every number in a lesson that has a golden value is written this
// way, so prose cannot drift from the data"; 8.4 "Numbers that have a golden value are written with <G>,
// never typed". M8 beat 6 types the dimension of the 26 of F4 in a brace string ({'26'}), and
// decisions/P5-A3.md lists it among the "numbers typed without a golden value" ("the 26 of F4"; M8.spec.ts
// allowlist reason "the 26 of F4, the subject of [vE]"). The golden file holds exactly that number: the
// Weyl dimension of the representation of F4 with highest weight omega_4 (verify.py section on Weyl's
// dimension formula), weyl_dimension[type=F4;highest_weight=0,0,0,1].dimension = 26.
// Adopted by RT-FIX-P5 lessons from the lens branch (finding P5-RT-08-02); the third test is added.
// Run: npx vitest run --project site-unit site/tests/unit/content-m8-typed-26.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatGoldenValue, resolveGoldenPath } from '../../src/lib/golden';

const M8 = fileURLToPath(new URL('../../src/content/modules/m8-lie-algebras.mdx', import.meta.url));
const PATH = 'weyl_dimension[type=F4;highest_weight=0,0,0,1].dimension';

describe('RT-08 P5: the dimension of the 26 of F4 in M8', () => {
  it('the golden file has the dimension of that representation, and <G> can print it', () => {
    expect(resolveGoldenPath(PATH)).toBe(26);
    expect(formatGoldenValue(resolveGoldenPath(PATH))).toBe('26');
  });
  // regression: P5-RT-08-02
  it('m8-lie-algebras.mdx does not type it', () => {
    const lines = readFileSync(M8, 'utf8').split('\n');
    const hits = lines
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => /\{'26'\}-dimensional representation/.test(l))
      .map(([n, l]) => `m8-lie-algebras.mdx:${n}: ...${(l.match(/Out of their reach[^:]*/) ?? [''])[0]}`);
    // Observed at 006f50d, line 113 (beat 6): "Out of their reach are the {'26'}-dimensional representation of
    // <Tex src="F_4"/>, studied in <Cite k="vE"/>, ..." (built text: "the 26-dimensional representation of F4").
    expect(hits, `M8 types a golden value; expected <G k="${PATH}"/>`).toEqual([]);
  });
  // regression: P5-RT-08-02
  it('m8-lie-algebras.mdx prints the dimension of that representation of F4 with <G>', () => {
    const source = readFileSync(M8, 'utf8');
    expect(source).toContain(`the <G k="${PATH}"/>-dimensional representation of <Tex src="F_4"/>, studied in <Cite k="vE"/>`);
  });
});
