// Lesson M6, the Seen box: the root lengths 2, 4 and 6 are those of the boards of finite type.
// Adopted from site/tests/unit/redteam-RT-09-p4-m6-lengths.test.ts (lens RT-09, phase 4 round, attack 1).
//   Seen 2, as found: "Exactly the balanced boards have a form with positive city weights that no mutation
//   changes ([W20], Theorems 8.4, 8.7); short roots have form value 2, long ones 4 or 6, verified by
//   computation."
// SPEC 2.5 states the lengths for the finite types only: "short roots have (beta,beta)=2 and long roots have 4
// (types B, C, F) or 6 (type G)". Off the finite types a balanced board has other lengths, and can have three:
//   oracle: board_from_name('A2^(2)') -> [[2,-4],[-1,2]], symmetrizer (1, 4): the simple root population e_1
//   (label 1) has form value 2 d = 8; board_from_name('A4^(2)'): symmetrizer (1, 2, 4), form values 2, 4, 8
//   (SPEC 2.12, twisted boards table, column "weights d"; golden twisted_affine). Both boards are balanced
//   and offered by the site (T15, T16). T1's own lengths panel says "More than two lengths" on A4^(2).
// The reproducer asserted that these counterexamples do not exist, which can never pass; as in the round 1
// adoption of P3-RT-09-02 (decisions/RT-FIX-P3-lesson-m5.md), the test keeps both computations with the values
// the reproducer observed and asserts the finding's expected instead: the lengths are stated for the boards of
// finite type.
// Run: npx vitest run --project site-unit site/tests/unit/content-m6-root-lengths.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, formValue, ratToString, symmetrizer, toPositions } from '@engine';
import type { Board } from '@engine';
import { lengthSentence, lengthsReport } from '../../src/components/tools/t01/phase2';

const M6 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m6-multiple-edges.mdx', import.meta.url)), 'utf8');
const LENGTHS = 'short roots have form value <Tex src="2"/>, long ones <Tex src="4"/> or <Tex src="6"/>';
const LEAD = 'Exactly the balanced boards have a form with positive city weights that no mutation changes';

/** The form values of the simple root populations e_i (roots by definition), in label order. */
function simpleLengths(name: string): string[] {
  const board = boardFromName(name);
  const b = board as Board<unknown>;
  const order = [...b.labels].sort((x, y) => x - y);
  return toPositions(board, order).map((p) => {
    const e = b.labels.map((_, k) => b.arith.fromInt(k === p ? 1 : 0));
    return ratToString(formValue(b, e)!);
  });
}

describe('M6 Seen box: the root lengths of the finite types', () => {
  // regression: P4-RT-09-02
  it("M6's Seen box gives the root lengths of the finite types B, C, F, G for every balanced board", () => {
    // The balanced boards of the finding have other lengths, and A4^(2) has three; T1 says so.
    expect(symmetrizer(boardFromName('A2^(2)'))).not.toBeNull();
    expect(simpleLengths('A2^(2)')).toEqual(['2', '8']);
    expect(symmetrizer(boardFromName('A4^(2)'))).not.toBeNull();
    expect(simpleLengths('A4^(2)')).toEqual(['2', '4', '8']);
    const report = lengthsReport(boardFromName('A4^(2)'));
    const said = report.kind === 'parts' ? report.parts.map((p) => lengthSentence(p, false)).join(' ') : '';
    expect(said).toContain('More than two lengths');
    // So the Seen statement on balanced boards gives the lengths 2, 4, 6 for the boards of finite type only,
    // and so does every other sentence of the lesson that states them.
    const li = M6.split('<li data-seen-statement>').slice(1).find((x) => x.includes(LEAD)) ?? '';
    expect(li, 'the Seen statement on balanced boards').not.toBe('');
    expect(li, 'the Seen statement still gives the lengths').toContain(LENGTHS);
    const stated = M6.split('\n').filter((l) => l.includes(LENGTHS));
    expect(stated.length).toBeGreaterThan(0);
    for (const line of stated) {
      const before = line.slice(0, line.indexOf(LENGTHS));
      expect(
        /on a board of finite type,?\s*$/.test(before),
        `M6: "${LENGTHS.replace(/<Tex src="(\d)"\/>/g, '$1')}" is stated with no restriction to the finite types; on the balanced board A2^(2) the simple root populations have form values ${simpleLengths('A2^(2)').join(', ')}, on A4^(2) ${simpleLengths('A4^(2)').join(', ')}`,
      ).toBe(true);
    }
  });
});
