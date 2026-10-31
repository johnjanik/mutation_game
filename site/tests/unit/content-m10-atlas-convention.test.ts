// Module M10, the Atlas item of the hub: the convention switch names a convention, not a matrix as Kac prints it.
// Adopted from site/tests/unit/redteam-RT-09-p6-glossary-history.test.ts, describe P6-RT-09-04 (lens RT-09, phase 6
// round, branch worktree-agent-a59a82db3a362f1d9). As found at f07eec6 the item said that the switch "prints the
// Cartan matrix as this site, Kac and SageMath write it"; SPEC 2.9 says that Kac numbers the nodes of E6
// differently [S2] (E7, E8, G2 [U]; Appendix E item 4), and the Atlas legend was repaired for this to "Show the
// Cartan matrix in the convention of" (DECISIONS.md, "P6-A4: the convention switch says nothing of Kac's numbering
// outside E4 (repair after review)"). The hub now follows the legend; nothing it says of Kac rests on E4.
// Run: npx vitest run --project site-unit site/tests/unit/content-m10-atlas-convention.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('M10 hub: the Atlas item and the convention switch', () => {
  // regression: P6-RT-09-04
  it('SPEC 2.9: Kac numbers the nodes of E6 differently [S2]; the Atlas legend was repaired for this, and the hub follows it', () => {
    const M10 = read('../../src/content/modules/m10-atlas.mdx');
    const SPEC = read('../../../SPEC.md');
    const SWITCH = read('../../src/components/atlas/ConventionSwitch.astro');
    expect(SPEC).toContain('Kac numbers the nodes of $E_6$, $E_7$, $E_8$ and $G_2$ differently ([S2] for $E_6$, [U] for the rest)');
    // The Atlas itself, after the P6-A4 repair: a convention, not a printed matrix; Kac's numbering only inside E4.
    expect(SWITCH).toContain('<legend>Show the Cartan matrix in the convention of</legend>');
    expect(SWITCH).toContain('<Unverified item="E4"');
    const hub = /<li data-hub-item="atlas">([^]*?)<\/li>/.exec(M10)![1]!;
    const text = hub.replace(/<[^>]+>/g, '');
    expect(
      hub.includes('prints the Cartan matrix as this site, Kac and SageMath write it'),
      `M10 hub, atlas item: "${text}". On E6 (and, [U], E7, E8, G2) Kac writes the Cartan matrix with another numbering of the nodes (SPEC 2.9 [S2]), so the switch does not print it "as Kac writes it"; the Atlas legend says "in the convention of" for this reason (DECISIONS.md, "P6-A4: the convention switch says nothing of Kac's numbering outside E4").`,
    ).toBe(false);
    // The item names the convention as the legend does, and says nothing of Kac's numbering outside an E4 wrapper.
    expect(text).toContain('a switch that shows the Cartan matrix in the convention of this site, Kac and SageMath or in that of Bourbaki and Humphreys, who print its transpose');
    const outside = hub.replace(/<Unverified item="E4"[^>]*>[^]*?<\/Unverified>/g, '').replace(/<[^>]+>/g, '');
    expect(/\bKac\b[^.]*\bnumber|\bnumber[^.]*\bKac\b/i.test(outside), `M10 hub, atlas item: "${outside}" speaks of Kac and numbering outside E4`).toBe(false);
  });
});
