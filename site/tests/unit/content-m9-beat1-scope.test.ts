// M9 beat 1 (site/src/content/modules/m9-real-forms.mdx, read as source): which real form a sentence is about, and
// how far the computation behind "A node is black exactly when theta fixes its root" goes. RT-FIX P6-MERGE-C-05, a
// MERGE follow-up of the phase 6 round (rtconfirm-p6-m9).
// As found at d8102c0 the sentence "On the real form, theta fixes a part k and changes the sign of a part p." came
// right after "a real form whose theta fixes every root is compact", so it could be read as said of the compact form
// only; and "for every real form, verified by computation" did not say how far the computation goes, where beats 3
// to 5 do ("in the catalogue", "on every board of rank at most eight", "all 167 records"). The computation is the
// one of content-m9-black-provenance.test.ts: theta on every simple root of every record of the catalogue, which
// holds one record per real form of each board of finite type of rank at most eight.
// Run: npx vitest run --project site-unit site/tests/unit/content-m9-beat1-scope.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveGoldenPath } from '../../src/lib/golden';

const src = readFileSync(fileURLToPath(new URL('../../src/content/modules/m9-real-forms.mdx', import.meta.url)), 'utf8');
const beat1 = src.slice(src.indexOf('<Beat n={1}>'), src.indexOf('<Beat n={2}>')).replace(/<\/?Term[^>]*>/g, '');

describe('M9 beat 1 says which real forms its statements are about', () => {
  // regression: P6-MERGE-C-05
  it('the sentence on the parts k and p is said of each real form', () => {
    const sentence = beat1.split(/(?<=\.)\s+/).find((s) => s.includes('fixes a part')) ?? '';
    // Observed at d8102c0: "On the real form, $\theta$ fixes a part <Tex src="\mathfrak k"/> and changes the sign of
    // a part <Tex src="\mathfrak p"/>.", after "a real form whose $\theta$ fixes every root is **compact**."
    expect(sentence, 'M9 beat 1: the sentence that names the parts k and p').toMatch(/^On each real form, \$\\theta\$ fixes a part/);
  });

  // regression: P6-MERGE-C-05
  it('"A node is black exactly when theta fixes its root" names the range of its computation, and the catalogue covers it', () => {
    const from = beat1.indexOf('A node is black exactly when');
    expect(from).toBeGreaterThan(0);
    const clause = beat1.slice(from, from + beat1.slice(from).search(/[;.]/));
    // Observed at d8102c0: "A node is black exactly when $\theta$ fixes its root, for every real form, verified by
    // computation".
    expect(clause, 'the provenance says how far the computation goes, as beats 3 to 5 do').toMatch(/verified by computation on every board of rank at most eight$/);
    // The range is true of the computation: the catalogue holds a record for each board of finite type of rank at
    // most eight (the 32 types of the golden file), every one of the real forms the beat speaks of.
    const types = Object.keys(resolveGoldenPath('types') as Record<string, unknown>).sort();
    const records = resolveGoldenPath('satake') as { dynkin_type: string }[];
    expect(types.length).toBe(32);
    expect([...new Set(records.map((r) => r.dynkin_type))].sort()).toEqual(types);
  });
});
