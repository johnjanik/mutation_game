// RT-08 (content rules, phase 6 round), attack 26: a theorem-like statement without provenance in M9.
// SPEC 8.4 "Every theorem-like statement carries its provenance"; 9.2 "every statement has a provenance".
// M9 beat 1 says "A node is black exactly when θ fixes its root". That is not a definition: black nodes are the
// set X the reader paints, θ = -w_X∘τ, and θ fixes the root of every black node only because of condition 2
// (on an admissible pair; the oracle finds decorations that break condition 2 where it fails, for example A3
// with nodes 1 and 2 black and τ the identity, a row of the table of SPEC 2.15: θ(α1) = α2;
// redteam/redteam-RT-08-p6-black-fixed.py). Neither the sentence, nor its paragraph, nor the Seen box (four
// statements: admissible pairs, shadows and composite moves, the character, τ on black nodes) carries a
// citation or "verified by computation" for it.
// Adopted by RT-FIX-P6-m9 from the lens branch (finding P6-RT-08-02; the first two tests are the reproducer).
// Added beside them: the sentence itself names the real forms it is said of and its provenance, and the
// computation that the provenance names, on every record of the catalogue (the engine's theta on each simple
// root), with the decoration of the finding where the statement fails without condition 2.
// Run: npx vitest run --project site-unit site/tests/unit/content-m9-black-provenance.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { admissibility, theta } from '@two-games/engine';
import { resolveGoldenPath } from '../../src/lib/golden';
import { diagramOf, inLabelOrder } from '../../src/components/tools/t13/model';

const src = readFileSync(fileURLToPath(new URL('../../src/content/modules/m9-real-forms.mdx', import.meta.url)), 'utf8');
const PROVENANCE = /<Cite k=|verified by computation|\{SEEN\}/;

describe('RT-08 P6: M9 beat 1, "A node is black exactly when θ fixes its root"', () => {
  // the line of the source, with the glossary links (<Term a="...">) taken out for the search only
  const paragraph = src.split('\n').find((l) => l.replace(/<\/?Term[^>]*>/g, '').includes('A node is black exactly when')) ?? '';
  it('the sentence is in M9 beat 1', () => {
    expect(paragraph).not.toBe('');
  });
  // regression: P6-RT-08-02
  it('its paragraph, or the Seen box that restates it, carries a provenance', () => {
    const seen = src.slice(src.indexOf('<Seen'), src.indexOf('</Seen>'));
    const inParagraph = PROVENANCE.test(paragraph);
    const inSeen = /black[^<]*fix/.test(seen);
    // Observed at f07eec6: the paragraph of beat 1 ("The board <Tex src="A_1"/> has one node. ...") holds no
    // <Cite> and no "verified by computation", and no statement of the Seen box restates it.
    expect(inParagraph || inSeen, 'm9-real-forms.mdx beat 1: a general statement with no provenance').toBe(true);
  });
  // regression: P6-RT-08-02
  it('the sentence itself says which pairs it is true of, and carries its provenance', () => {
    const plain = paragraph.replace(/<\/?Term[^>]*>/g, '');
    const from = plain.indexOf('A node is black exactly when');
    // The clause of the statement: up to the next semicolon or full stop.
    const clause = plain.slice(from, from + plain.slice(from).search(/[;.]/));
    expect(clause, 'the statement holds on real forms (admissible pairs), not on every decoration').toMatch(/real forms?|admissible/);
    expect(clause, 'the provenance in the sentence').toMatch(PROVENANCE);
  });
  // regression: P6-RT-08-02
  it('verified by computation: on every record of the catalogue, a node is black exactly when theta fixes its root', () => {
    const records = resolveGoldenPath('satake') as { dynkin_type: string; real_form: string; black_nodes: number[]; tau: number[] }[];
    expect(records.length).toBeGreaterThan(160);
    const failures: string[] = [];
    let nodes = 0;
    for (const r of records) {
      const d = diagramOf(r.dynkin_type, r.black_nodes, r.tau);
      expect(admissibility(d).admissible, `${r.dynkin_type} ${r.real_form}`).toBe(true);
      const black = new Set(d.black);
      for (let i = 0; i < d.board.n; i++) {
        const root = Array.from({ length: d.board.n }, (_, k) => (k === i ? 1 : 0));
        const fixed = theta(d, root).every((x, k) => x === root[k]);
        if (fixed !== black.has(i)) failures.push(`${r.dynkin_type} ${r.real_form}: position ${i}`);
        nodes += 1;
      }
    }
    expect(failures).toEqual([]);
    expect(nodes).toBeGreaterThan(700);
    // Without condition 2 it fails: A3 with nodes 1 and 2 black and tau the identity (SPEC 2.15's table;
    // golden satake_examples[type=A3;black_nodes=1,2;tau=1,2,3] has condition_2 false) sends alpha_1 to alpha_2.
    // oracle: python3 -c "import sys; sys.path.insert(0, 'reference'); import lie_games as L; print(L.theta(L.cartan('A', 3), [0, 1], [0, 1, 2], [1, 0, 0]))"
    const bad = diagramOf('A3', [1, 2], [1, 2, 3]);
    expect(admissibility(bad).condition_2).toBe(false);
    expect(inLabelOrder(bad.board, theta(bad, [1, 0, 0]))).toEqual([0, 1, 0]);
  });
});
