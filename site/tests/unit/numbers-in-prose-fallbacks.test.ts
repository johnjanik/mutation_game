// scripts/numbers-in-prose.mjs reads the fallback prop of <Unverified> (SPEC.md 7.3: a release build
// prints the fallback in place of the sentence, so it is prose; 8.4: numbers with a golden value are
// never typed). Before this, a tag and all its props were blanked, so a number typed into a fallback
// ("up to rank 7" in the E16 fallback of M5) was never reported.
// Run: npx vitest run --project site-unit site/tests/unit/numbers-in-prose-fallbacks.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderReport, scanSource } from '../../../scripts/numbers-in-prose.mjs';

const M5 = fileURLToPath(new URL('../../src/content/modules/m5-weyl.mdx', import.meta.url));
const of = (text: string, kind: string) => scanSource(text, 'x.mdx').filter((f) => f.kind === kind).map((f) => [f.line, f.number]);

describe('numbers-in-prose.mjs and the fallbacks of <Unverified>', () => {
  // regression: RT-FIX residual (round 1 confirmer of lesson-m5)
  it('a number typed in a quoted fallback is reported, apart from prose', () => {
    const text = ['Intro.', '', 'A claim <Unverified item="E16" fallback="Checked up to rank 7.">resting on a book</Unverified>.'].join('\n');
    expect(of(text, 'fallback')).toEqual([[3, '7']]);
    expect(of(text, 'prose')).toEqual([]);
    // Single quotes, the prop after another prop, and a tag over several lines.
    expect(of("<Unverified fallback='rank 8' item=\"E4\">x</Unverified>", 'fallback')).toEqual([[1, '8']]);
    expect(of(['<Unverified', '  item="E4"', '  fallback="the first 2500 or so"', '>x</Unverified>'].join('\n'), 'fallback')).toEqual([[3, '2500']]);
  });

  // regression: RT-FIX residual (round 1 confirmer of lesson-m5)
  it('in a brace fallback the literal text is read and the interpolations are not', () => {
    const tpl = '<Unverified item="E16" fallback={`up to rank ${RANK} of 12 boards`}>x</Unverified>';
    expect(of(tpl, 'fallback')).toEqual([[1, '12']]);
    expect(of('<Unverified item="E16" fallback={`up to rank ${N + 1}`}>x</Unverified>', 'fallback')).toEqual([]);
    expect(of('<Unverified item="E16" fallback={"rank 6"}>x</Unverified>', 'fallback')).toEqual([[1, '6']]);
    expect(of('<Unverified item="E16" fallback={FALLBACK_E16}>x</Unverified>', 'fallback')).toEqual([]);
    // Other props of the tag, and other tags, stay out of the report.
    expect(of('<Unverified item="E16" note="3">x</Unverified> <Beat n={4} caption="5 moves" />', 'fallback')).toEqual([]);
  });

  // regression: RT-FIX residual (round 1 confirmer of lesson-m5)
  it('M5 types no number in its fallbacks, and a scratch typed number there is reported', () => {
    const source = readFileSync(M5, 'utf8');
    expect(scanSource(source, 'm5-weyl.mdx').filter((f) => f.kind === 'fallback')).toEqual([]);
    // The scratch typed number of the instruction: the E16 fallback as it stood at 51a7e26.
    const typed = source.replace(/<Unverified item="E16" fallback=\{`[^`]*`\}>/, '<Unverified item="E16" fallback="The script that checks this site confirms that each count on these boards equals the number of standard Young tableaux of a staircase shape, up to rank 7.">');
    expect(typed).not.toBe(source);
    const found = scanSource(typed, 'm5-weyl.mdx').filter((f) => f.kind === 'fallback');
    expect(found.map((f) => f.number)).toEqual(['7']);
    expect(found[0]!.context).toContain('up to rank 7');
  });

  it('the report lists fallback numbers in a section of their own', () => {
    const findings = scanSource('<Unverified item="E4" fallback="rank at most 8">x</Unverified>', 'site/src/content/modules/m3-x.mdx');
    const md = renderReport(findings, 1, '2026-10-24');
    const at = md.indexOf('## Numbers in the fallbacks of <Unverified>');
    expect(at).toBeGreaterThan(md.indexOf('## Numbers inside formulas not written with <Tex>'));
    expect(md.slice(at)).toContain('| 1 | 8 |');
    expect(md).toContain('1 numbers in the fallbacks of <Unverified>.');
  });
});
