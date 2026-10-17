// Adopted from the red team's reproducer for P3-RT-05-08 (RT-05 attack 15).
// A-4: "On boards with more than four nodes only the changed nodes are read". When a move changes
// nothing (firing a node whose number is 0, mutating a city whose number is 0), lib/a11y.ts
// changedOnly joined an empty list and the region read "Fired node 3. . Move 1." (and "Mutated city 3.
// . Move 1."), a sentence with an empty clause; T1's own linked view handles the same case and reads
// "Mutated city 3 and fired node 3. Move 1." (t01/announce.ts). Seen in the browser on
// /tools/board/?z=1&g=A5&v=n&m=f&c=n&s=1,1,0,1,1, Enter on node 3, and on
// /tools/board/?z=1&g=A5&v=p&m=f&c=p&s=0,0,0,0,0, Enter on city 3.
// Run: npx vitest run --project site-unit site/tests/unit/a11y-changed-only.test.ts
import { describe, expect, it } from 'vitest';
import { announceTemplates, moveAnnouncement } from '../../src/lib/a11y';

describe('changed-only sentence when nothing changed (A-4, five nodes)', () => {
  // regression: P3-RT-05-08
  it('firing node 3 of A5 at (1, 1, 0, 1, 1) reads no empty clause', () => {
    const v = ['1', '1', '0', '1', '1'];
    const s = moveAnnouncement('Fired', [1, 2, 3, 4, 5], 3, v, v, 1);
    expect(s, `moveAnnouncement gave ${JSON.stringify(s)}`).not.toMatch(/\.\s+\./);
  });
  // regression: P3-RT-05-08
  it('mutating city 3 of A5 at (0, 0, 0, 0, 0) reads no empty clause', () => {
    const v = ['0', '0', '0', '0', '0'];
    const s = moveAnnouncement('Mutated', [1, 2, 3, 4, 5], 3, v, v, 1);
    expect(s, `moveAnnouncement gave ${JSON.stringify(s)}`).not.toMatch(/\.\s+\./);
  });
  // regression: P3-RT-05-08
  it('changedOnly with no change', () => {
    const s = announceTemplates.changedOnly('Fired', 3, [], 1);
    expect(s, `changedOnly gave ${JSON.stringify(s)}`).not.toMatch(/\.\s+\./);
  });
  // The reading taken (decisions/RT-FIX-P3-small-fixes.md): with nothing changed the clause is omitted,
  // and the rest of the A-4 sentence is unchanged, as in T1's linked view above four nodes.
  // regression: P3-RT-05-08
  it('a move that changes nothing reads the move and its number only', () => {
    expect(announceTemplates.changedOnly('Fired', 3, [], 1)).toBe('Fired node 3. Move 1.');
    expect(announceTemplates.changedOnly('Mutated', 3, [], 1)).toBe('Mutated city 3. Move 1.');
    const v = ['1', '1', '0', '1', '1'];
    expect(moveAnnouncement('Fired', [1, 2, 3, 4, 5], 3, v, v, 7)).toBe('Fired node 3. Move 7.');
    expect(announceTemplates.changedOnly('Fired', 4, [[3, 3], [4, -2], [5, 1]], 7)).toBe(
      'Fired node 4. Node 3 now 3, node 4 now minus 2, node 5 now 1. Move 7.',
    );
  });
});
