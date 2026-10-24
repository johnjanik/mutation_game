// RT-08 (content rules, phase 4 round), attacks 15 and 19, adopted by RT-FIX-P4 lesson M7 from the script
// redteam/redteam-RT-08-p4-e7-wrap.mjs of the lens branch: M7's wraps of Appendix E item 7. SPEC.md 7.3: a
// release build "renders a closed item's sentence unmarked, and for an open item renders the fallback text in
// its place"; "A fallback is a weaker sentence that stays true however the item turns out". Appendix E item 7:
// the attribution of the face-counting rule, and the face counts of 1_22, 2_31, 2_41, 1_42, which "were typed
// from memory; look them up before the site calls them published values".
// At b9b8504 the wrap of the Seen box read
//   wrapped:  "The rule is of the kind described in [CKPS95]; it has not yet been compared with that paper."
//   fallback: "The rule was checked by computation against exact convex hulls and against the face counts of
//              the known polytopes; its attribution is being checked."
// (1) The wrapped sentence states that the item is open, so the day the owner closes E7 a release build prints
//     it unmarked as settled, and it is then false.
// (2) The fallback drops the hedge of beat 3 ("as the checking script records them") and calls the counts the
//     script compared with "the face counts of the known polytopes", the open half of E7.
// Run: npx vitest run --project site-unit site/tests/unit/content-m7-e7-wrap.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const M7 = readFileSync(fileURLToPath(new URL('../../src/content/modules/m7-geometry.mdx', import.meta.url)), 'utf8');

/** Every wrap of item E7 in the lesson source: the wrapped sentence and its fallback (null when none). */
function e7Wraps(): { line: number; wrapped: string; fallback: string | null }[] {
  const out: { line: number; wrapped: string; fallback: string | null }[] = [];
  M7.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/<Unverified item="E7"( fallback="([^"]*)")?>(.*?)<\/Unverified>/g)) {
      out.push({ line: i + 1, wrapped: m[3]!, fallback: m[2] ?? null });
    }
  });
  return out;
}

describe('P4-RT-08-09: the wraps of item E7 in M7', () => {
  // regression: P4-RT-08-09
  it('in the Seen box the E7 wrap states the claim that closing the item settles, and its fallback keeps the hedge on the face counts', () => {
    const wraps = e7Wraps();
    expect(wraps.length, 'two wraps of E7: beat 3 and the Seen box').toBe(2);
    for (const w of wraps) {
      // The wrapped sentence is printed unmarked once the owner closes E7, so it may not say that the item is open.
      expect(w.wrapped, `m7-geometry.mdx:${w.line}: the wrapped sentence states the open status of E7`).not.toMatch(
        /not yet|has not been|have not been|being checked|unchecked|to be compared/i,
      );
    }
    const seen = wraps.find((w) => w.fallback !== null);
    expect(seen, 'the E7 wrap of the Seen box has a fallback').toBeDefined();
    // The fallback stays true however E7 turns out: the counts the script compared with are recorded counts, not
    // the published face counts of the polytopes.
    expect(seen!.fallback, 'the fallback calls the recorded counts the face counts of the known polytopes').not.toMatch(/face counts of the known polytopes/i);
    if (/face counts/i.test(seen!.fallback!)) expect(seen!.fallback).toMatch(/record/i);
    expect(seen!.fallback).not.toMatch(/published/i);
  });
});
