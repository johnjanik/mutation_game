// Where [W20] states the Mutation Conjecture, on /open-problem/ and /history/ (site/src/content/pages/*.mdx, read as
// source). Adopted from the RT-08 reproducer of the phase 6 round (attack 1 around a phase 6 repair: a claim about
// what a source contains that SOURCES.md contradicts). The P6-A6 review (major) found that /history/ said [W20]
// states the Mutation Conjecture "near its end"; SOURCES.md 11.1 puts it in section 2, on p. 57 of a paper that runs
// from p. 55 to p. 78 (SPEC 2.11), so near its start. The repair (518fd2b) fixed /history/ only. The sibling
// sentence on /open-problem/, which P6-terms edited in phase 6 (Term links added to the same paragraph), still said
// "states it near its end (page 57, without a number)".
// Run: npx vitest run --project site-unit site/tests/unit/content-open-problem-w20-section.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const SOURCES = read('../../../SOURCES.md');
const OPEN_PROBLEM = read('../../src/content/pages/open-problem.mdx');
const HISTORY = read('../../src/content/pages/history.mdx');

describe('where [W20] states the Mutation Conjecture', () => {
  // regression: P6-RT-08-01
  it('SOURCES.md 11.1: the paper runs from p. 55 to p. 78 and the conjecture is in section 2, p. 57', () => {
    expect(SOURCES).toMatch(/\*Algebra Colloquium\* 27 \(2020\), no\. 1, 55-78/);
    expect(SOURCES).toMatch(/2 The Mutation Game on a Directed Graph \([^)]*the Mutation Conjecture, unnumbered, p\. 57\)/);
  });
  // regression: P6-RT-08-01
  it('the repaired history page places it in section 2 (the fix of the P6-A6 review)', () => {
    expect(HISTORY).toMatch(/Its section 2 also states the Mutation Conjecture, on page 57/);
    expect(HISTORY).not.toMatch(/near its end/i);
  });
  // regression: P6-RT-08-01
  it('/open-problem/ says [W20] states the Mutation Conjecture near its end: open-problem.mdx does not say that [W20] states it near its end', () => {
    const hits = OPEN_PROBLEM.split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => /near its end/i.test(l))
      .map(([n, l]) => `open-problem.mdx:${n}: ${(l.match(/The paper <Cite k="W20"\/> states it near its end[^:]*/) ?? [l.slice(0, 160)])[0]}`);
    // Observed at f07eec6, line 31: 'The paper <Cite k="W20"/> states it near its end (page {'57'}, without a number)'
    expect(hits, 'p. 57 of pp. 55-78 is near the start of [W20]').toEqual([]);
  });
});
