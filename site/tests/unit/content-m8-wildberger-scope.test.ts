// RT-09, phase 5 round, finding P5-RT-09-04 (attacks 21 and 1): M8's Lie theory paragraph says
//   "A minuscule node gives a minuscule weight: its Weyl group orbit carries a representation in which each weight
//    occurs once. ... Wildberger builds these representations on the ideals of a minuscule heap [W03a], with proofs
//    in [Gre13]"
// with no hypothesis, so for every minuscule weight, among them the 18 of beat 4 that include the spin
// representations of B2, B3, B4 and the vector representations of C2, C3 (boards that are not simply laced).
// [W03a] is "A combinatorial construction for simply-laced Lie algebras" (SOURCES.md), and SPEC 2.18 limits it:
// "This is the content of Wildberger's construction for simply laced algebras". M8's own Seen statement 1 has the
// limit ("At every minuscule node of a simply laced board this is Wildberger's construction"), and the stage 5.3
// review (finding 12 (2)) asked for it there; the Lie theory paragraph was not changed with it.
//   oracle: minuscule_nodes(cartan('B',3)) = [2] (label 3); cartan('B',3) is not symmetric.
// Adopted by RT-FIX-P5 lessons from the lens branch (finding P5-RT-09-04).
// Run: npx vitest run --project site-unit site/tests/unit/content-m8-wildberger-scope.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, cartanNumbers, minusculeNodes, toLabels } from '@engine';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const M8 = read('../../src/content/modules/m8-lie-algebras.mdx');
const SPEC = read('../../../SPEC.md');
const SOURCES = read('../../../SOURCES.md');

describe('P5-RT-09-04: M8 Lie theory paragraph credits [W03a] with every minuscule representation', () => {
  // regression: P5-RT-09-04
  it('the paragraph and the limits it drops', () => {
    const lie = M8.slice(M8.indexOf('<LieTheory>'), M8.indexOf('</LieTheory>'));
    const sentence = 'Wildberger builds these representations on the ideals of a minuscule <Term a="heap">heap</Term> <Cite k="W03a"/>';
    expect(lie).toContain('A <Term a="minuscule-node">minuscule node</Term> gives a minuscule weight: its Weyl group orbit carries a representation in which each weight occurs once.');
    expect(lie).toContain(sentence);
    expect(SPEC).toContain("This is the content of Wildberger's construction for simply laced algebras");
    expect(SOURCES).toMatch(/W03a[^\n]*simply-laced/);
    expect(M8).toContain('At every minuscule node of a simply laced board this is Wildberger\'s construction');
    const B3 = boardFromName('B3');
    expect(toLabels(B3, minusculeNodes(B3))).toEqual([3]);
    const Cn = cartanNumbers(B3);
    const symmetric = Cn.every((row, i) => row.every((x, j) => x === Cn[j]![i]));
    expect(symmetric).toBe(false);
    const scoped = /simply laced|simply-laced/.test(lie.slice(lie.indexOf('Wildberger builds') - 120, lie.indexOf('Wildberger builds') + sentence.length + 40));
    expect(scoped, `M8 Lie theory: "${sentence}" is stated for every minuscule weight (B3 node 3, a board that is not simply laced, is one), while SPEC 2.18 and SOURCES.md give [W03a] for simply laced algebras only`).toBe(true);
  });
});
