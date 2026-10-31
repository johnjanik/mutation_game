// RT-09, phase 4 round (attacks 1 and 29), adopted by RT-FIX-P4 lesson M7: M7 stated the geometry of SPEC 2.14,
// which is a theory of the boards of finite type ("Euclidean coordinates (finite type)"; "[V for every type of
// rank 2 to 8]"), and its verification, for every board.
//   Beat 2 said: "Free play from the position reaches finitely many positions, its **orbit**, whose convex hull
//   is a polytope; its shape depends only on which nodes are ringed."
//   Seen 2 said: "The orbit of a position with no negative number is the vertex set of a polytope whose shape
//   depends only on the ringed nodes"
//   Beat 6 said: "No root lands on the centre, and the roots lie on circles each holding a multiple of $h$ of
//   them, verified by computation on every board of rank two to eight."
//   Seen 1 said: "... make the form the dot product: verified by computation, every board of rank two to eight."
//   Seen 4 said: "... its circles hold multiples of $h$ roots, none at the centre: verified by computation, every
//   board of rank two to eight."
// Counterexample: the triangle A2~ (rank 3, roads both ways, the affine board of M1 and M3).
//   oracle: orbit(cartan of the triangle, [(1,0,0)], fire, cap=5000) -> OverflowError (the orbit is infinite);
//   cartan_class(triangle) -> 'affine'; the eigenvalues of D^1/2 C D^-1/2 are 0, 3, 3: the form is singular,
//   (1,1,1) has form value 0, there is no Coxeter number and no Coxeter plane; the engine's euclideanBasis
//   refuses the board (NotFiniteType). SPEC 2.14 checked the coordinates and the rings on the 32 finite types of
//   rank 2 to 8 only (golden types[T].coxeter_plane, 31 types of rank >= 2).
// Adoption: the reproducer held each sentence of the page against the triangle. The tests below keep its
// assertions for as long as a sentence covers the triangle (no "finite type" in it); once the sentence names the
// boards of finite type, the triangle lies outside it and the counterexample is asserted to stand.
// Run: npx vitest run --project site-unit site/tests/unit/content-m7-finite-type.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, classify, euclideanBasis, formValue, orbit } from '@engine';
import type { Board } from '@engine';

const M7 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m7-geometry.mdx', import.meta.url)), 'utf8');

/** The sentence of the lesson source that holds `stem` (case ignored), read within its line. */
function sentenceWith(stem: string): string {
  const line = M7.split('\n').find((l) => l.toLowerCase().includes(stem.toLowerCase()));
  expect(line, `the lesson still states "${stem}"`).toBeDefined();
  const s = line!.split(/(?<=\.)\s+(?=[A-Z<])/).find((x) => x.toLowerCase().includes(stem.toLowerCase()));
  return s ?? '';
}

// The five claims of 2.14 on the page, by a stem that survives a rewording of their scope.
const BEAT2 = 'free play from the position reaches finitely many positions';
// The stem of Seen 2 since RT-FIX P6-MERGE-C-01 ("whose shape depends" became "whose faces depend": SPEC 2.14).
const SEEN2 = 'is the vertex set of a polytope whose faces depend only on the ringed nodes';
const BEAT6 = 'No root lands on the centre';
const SEEN1 = 'make the form the dot product';
const SEEN4 = 'none at the centre: verified by computation';
const FINITE = /\bboards? of finite type\b/;
const RANGE = /every board of finite type of rank two to eight/;

describe('P4-RT-09: M7 drops the finite-type hypothesis of SPEC 2.14', () => {
  // regression: P4-RT-09-01
  it('the sentences that state the geometry of 2.14 name the boards of finite type', () => {
    const beat2 = M7.slice(M7.indexOf('<Beat n={2}>'), M7.indexOf('<Beat n={3}>'));
    expect(FINITE.test(beat2), 'beat 2 says "finite type"').toBe(true);
    for (const stem of [BEAT2, SEEN2]) expect(sentenceWith(stem), stem).toMatch(FINITE);
    // The verification is stated with the range that verify.py checked: every type of rank 2 to 8 (0.3).
    for (const stem of [BEAT6, SEEN1, SEEN4]) expect(sentenceWith(stem), stem).toMatch(RANGE);
  });

  // regression: P4-RT-09-01
  it('on the triangle (rank 3, roads both ways) free play from a position with no negative number never stops', () => {
    const tri = boardFromName('A2~') as Board<unknown>;
    expect(classify(tri)[0]!.class).toBe('affine');
    const start = [1, 0, 0].map((x) => tri.arith.fromInt(x));
    const o = orbit(tri, [start], 'firing', 5000);
    const beat2 = sentenceWith(BEAT2);
    const seen2 = sentenceWith(SEEN2);
    if (!FINITE.test(beat2) || !FINITE.test(seen2)) {
      expect(
        o.truncated,
        `"${beat2}" (M7 beat 2) and "${seen2}" (Seen): on the triangle the orbit of (1, 0, 0) has more than 5000 positions (it is infinite), so it is not the vertex set of a polytope`,
      ).toBe(false);
    } else {
      // The two sentences are about the boards of finite type; the triangle is not one, and its orbit is infinite.
      expect(o.truncated, 'the counterexample stands: the orbit of (1, 0, 0) on the triangle passes 5000 positions').toBe(true);
    }
  });

  // regression: P4-RT-09-01
  it('on the triangle there is no Euclidean picture, no h and no Coxeter plane, so nothing was verified there', () => {
    const tri = boardFromName('A2~') as Board<unknown>;
    const ones = [1, 1, 1].map((x) => tri.arith.fromInt(x));
    const v = formValue(tri, ones)!;
    expect(Number(v.num)).toBe(0); // the form is singular: (1,1,1) has form value 0
    let refused = '';
    try {
      euclideanBasis(tri);
    } catch (e) {
      refused = e instanceof Error ? e.constructor.name : String(e);
    }
    const claims = [BEAT6, SEEN1, SEEN4].map(sentenceWith);
    if (claims.some((s) => !FINITE.test(s))) {
      expect(
        refused,
        `M7 says the coordinates and the Coxeter-plane rings are "verified by computation on every board of rank two to eight"; the triangle is a board of rank 3 and the engine refuses it (${refused}); SPEC 2.14 checked "every type of rank 2 to 8"`,
      ).toBe('');
    } else {
      // Every such claim names the boards of finite type; the triangle is outside them and the engine refuses it.
      expect(refused, 'the counterexample stands: euclideanBasis refuses the triangle').toBe('NotFiniteType');
    }
  });
});
