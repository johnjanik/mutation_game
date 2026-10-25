// RT-08 (content rules, phase 5 round), attack 13: a <G> path that resolves but to the wrong quantity.
// SPEC.md 7.3: <G> exists "so prose cannot drift from the data"; a path whose record or field differs from
// what the sentence names prints the right digits today and drifts the day either changes.
// (1) M8 beat 1 and the caption of b1 print the middle position of the string through (2, 0) at node 1 of
//     A2 with <G k="minuscule_representations[type=A2;node=2].weights_dynkin_labels[1]"/> (and fmt of the same
//     path): a weight of another representation (the orbit of the fundamental position of node 2), not a
//     position of that string. The golden file has no record of that string; the lesson already computes
//     it with the engine (export const STRING_TWO = stringThrough(A2, [2, 0], 0), never used).
// (2) M8 beat 6: "E8, F4 and G2 have no minuscule node: their Cartan matrices have determinant
//     <G k="types.E8.det_cartan"/>": the path names E8 only, the sentence three boards.
// Adopted by RT-FIX-P5 lessons from the lens branch (finding P5-RT-08-03); the last test is added for the
// sibling of (2) in the same sentence, the count of minuscule nodes of the three boards.
// Run: npx vitest run --project site-unit site/tests/unit/content-m8-golden-paths.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName, stringThrough } from '@two-games/engine';
import { resolveGoldenPath } from '../../src/lib/golden';

const src = readFileSync(fileURLToPath(new URL('../../src/content/modules/m8-lie-algebras.mdx', import.meta.url)), 'utf8');
const lines = src.split('\n');
const at = (re: RegExp) => lines.map((l, i) => [i + 1, l] as const).filter(([, l]) => re.test(l)).map(([n]) => `m8-lie-algebras.mdx:${n}`);

describe('RT-08 P5: <G> paths of M8 that name another quantity than their sentence', () => {
  it('the middle of the string through (2, 0) equals a weight of the node-2 representation only by coincidence', () => {
    const line = stringThrough(boardFromName('A2'), [2, 0], 0).map((p) => [...p].map(Number));
    expect(line).toEqual([[2, 0], [0, 1], [-2, 2]]);
    const node2 = resolveGoldenPath('minuscule_representations[type=A2;node=2].weights_dynkin_labels') as number[][];
    expect(node2[1]).toEqual(line[1]);
    // the representation of node 2 is a different orbit from the string's start (2, 0)
    expect(node2).not.toContainEqual([2, 0]);
  });
  // regression: P5-RT-08-03
  it('M8 does not print a position of the string through (2, 0) from the weights of the node-2 representation', () => {
    const hits = at(/minuscule_representations\[type=A2;node=2\]\.weights_dynkin_labels\[1\]|wt\('A2', 2, 1\)/);
    // Observed at 006f50d: line 61 (beat 1 prose) and line 65 (caption of b1).
    expect(hits, 'the string through (2, 0) printed through a path to another representation').toEqual([]);
  });
  // regression: P5-RT-08-03
  it('the determinant of the three boards of beat 6 is not printed from E8 alone', () => {
    const hits = at(/E_8"\/>, <Tex src="F_4"\/> and <Tex src="G_2"\/> have no minuscule node: their Cartan matrices have determinant <G k="types\.E8\.det_cartan"\/>/);
    // Observed at 006f50d: line 113 (beat 6).
    expect(hits, 'three boards named, one board in the path').toEqual([]);
  });
  // regression: P5-RT-08-03
  it('the sentence of beat 6 on the boards with no minuscule node prints each golden field from every board it names', () => {
    const at6 = src.indexOf('have no minuscule node');
    expect(at6, 'beat 6 names the boards with no minuscule node').toBeGreaterThan(0);
    const start = Math.max(src.lastIndexOf('\n', at6), src.lastIndexOf('. ', at6)) + 1;
    const sentence = src.slice(start, src.indexOf('. ', at6));
    const named = [...sentence.matchAll(/<Tex src="([A-H])_(\d)"\/>/g)].map((m) => `${m[1]}${m[2]}`);
    expect(named).toEqual(['E8', 'F4', 'G2']);
    const byField = new Map<string, string[]>();
    for (const m of sentence.matchAll(/<G k="types\.([A-H]\d)\.(\w+)"/g)) byField.set(m[2]!, [...(byField.get(m[2]!) ?? []), m[1]!]);
    expect(byField.get('det_cartan'), 'the determinant of every board named').toEqual(named);
    for (const [field, boards] of byField) expect(boards, `${field} in: ${sentence}`).toEqual(named);
  });
});
