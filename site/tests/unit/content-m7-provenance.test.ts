// RT-08 (content rules, phase 4 round), attack 26, adopted by RT-FIX-P4 lesson M7 from the script
// redteam/redteam-RT-08-p4-provenance.mjs of the lens branch: a theorem-like statement without provenance.
// SPEC.md 8.4 "Every theorem-like statement carries its provenance"; 9.2 "every statement has a provenance";
// SPEC 2.14 labels the edge-length rule "[V]" ("the edge from lambda to R_i lambda has squared length
// a_i^2(alpha_i,alpha_i)=2d_ia_i^2 [V]"). At b9b8504 M7 beat 5 stated the rule, and the condition for a uniform
// polytope that follows from it, with no citation and no "verified by computation" in the sentence, its
// paragraph, or the Seen box (whose five statements are the coordinates, Wythoff's construction, the face
// rule, the Coxeter plane and E8). The script printed "provenance in the paragraph: none" and "a Seen statement
// on edge lengths or uniform polytopes: none".
// Run: npx vitest run --project site-unit site/tests/unit/content-m7-provenance.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const lines = readFileSync(fileURLToPath(new URL('../../src/content/modules/m7-geometry.mdx', import.meta.url)), 'utf8').split('\n');

describe('P4-RT-08-08: the provenance of the edge-length rule in M7', () => {
  // regression: P4-RT-08-08
  it('M7 beat 5 states the edge-length rule and the condition for a uniform polytope with their provenance', () => {
    // The paragraph of beat 5 that states the rule (the script found it by the same words).
    const i = lines.findIndex((l) => l.includes('to the position after firing node $i$ has squared length'));
    expect(i, 'beat 5 states the edge-length rule').toBeGreaterThanOrEqual(0);
    const para = lines[i]!;
    expect(para, 'the paragraph states the condition for a uniform polytope').toMatch(/\*\*uniform\*\*/);
    const inParagraph = /<Cite |verified by computation/i.test(para);
    const seen = lines.filter((l) => l.includes('data-seen-statement'));
    const inSeen = seen.some((s) => /edge|uniform|squared length/i.test(s));
    expect(
      { inParagraph, inSeen },
      `m7-geometry.mdx:${i + 1} (beat 5): ${para}\nprovenance in the paragraph: ${inParagraph ? 'yes' : 'none'}; a Seen statement on edge lengths or uniform polytopes: ${inSeen ? 'yes' : 'none'}`,
    ).not.toEqual({ inParagraph: false, inSeen: false });
  });
});
