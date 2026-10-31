// Lesson M6, beat 1: B2 is set against one road each way, not against "every road had a road back".
// Adopted from site/tests/unit/redteam-RT-09-p4-m6-road-back.test.ts (lens RT-09, phase 4 round, attack 13,
// wording). As found, M6 beat 1 opened "Until now every road had a road back, as on A_2. Here the one-way counts
// of two cities, the numbers of roads each way, differ". Read against SPEC 2.1, where a board is bidirected when
// "every road has at least one road back" and a one-way board is one "on which some road has no road back", the
// contrast says that B_2 has a road with no road back. B_2 is bidirected (C = [[2,-1],[-2,2]]: two roads from 1
// to 2 and one back; boardKind 'gcm'), and the site has already shown a road with no road back (M3 beat 6, the
// one-way road of golden one_way_counterexample), so "until now every road had a road back" is not so either.
// The reproducer asserted that B2 has a one-way road and that M3 has none, which can never pass; as in the round 1
// adoption of P3-RT-09-02 (decisions/RT-FIX-P3-lesson-m5.md), the test keeps both checks with the values the
// reproducer observed and asserts the finding's expected instead: the opening contrast is with exactly one road
// back, as on A_2, and makes no claim about every earlier road.
// Run: npx vitest run --project site-unit site/tests/unit/content-m6-road-back.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adjacency, boardFromName, boardKind, cartanNumbers } from '@engine';

const read = (f: string): string => readFileSync(fileURLToPath(new URL(`../../src/content/modules/${f}`, import.meta.url)), 'utf8');
const M6 = read('m6-multiple-edges.mdx');
const M3 = read('m3-classification.mdx');
const SENTENCE = 'Until now every <Term a="roads">road</Term> had a road back, as on <Tex src="A_2"/>. Here the **one-way counts** of two cities';

describe('M6 beat 1: what B2 is set against', () => {
  // regression: P4-RT-09-07
  it("M6 beat 1 sets B2 against one road each way, since B2 is bidirected and M3 already showed a one-way road", () => {
    // B2 has no road without a road back (bidirected, SPEC 2.1): two roads from 1 to 2 and one back.
    const b2 = boardFromName('B2');
    const A = adjacency(b2);
    expect(boardKind(cartanNumbers(b2))).toBe('gcm');
    const oneWay = A.some((row, i) => row.some((x, j) => x > 0 && A[j]![i]! === 0));
    expect(oneWay, 'B2 has a road with no road back').toBe(false);
    // M3 beat 6, before M6, plays on a single road with none back.
    expect(M3.includes('Take a single road from city <Tex src="1"/> to city <Tex src="2"/> and none back.')).toBe(true);
    // So beat 1 does not open on "every road had a road back", and sets B2 against exactly one road back, as on A2.
    expect(M6, 'M6 beat 1: "Until now every road had a road back ... Here the one-way counts ... differ"').not.toContain(SENTENCE);
    const beat1 = M6.slice(M6.indexOf('<Beat n={1}>'), M6.indexOf('<Beat n={2}>'));
    const first = beat1.slice(0, beat1.indexOf('**one-way counts**'));
    expect(first, 'the opening contrast').toMatch(/On <Tex src="A_2"\/> every <Term a="roads">road<\/Term> has exactly one road back\.\s*Here the $/);
    expect(first).not.toMatch(/until now|so far|every earlier/i);
  });
});
