// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-08.
// A-4: "On boards with more than four nodes only the changed nodes are read". When a move changes
// nothing (firing a node whose number is 0, mutating a city whose number is 0), lib/a11y.ts
// changedOnly joins an empty list and the region reads "Fired node 3. . Move 1." (and "Mutated city 3.
// . Move 1."), a sentence with an empty clause; T1's own linked view handles the same case and reads
// "Mutated city 3 and fired node 3. Move 1." (t01/announce.ts). Seen in the browser on
// /tools/board/?z=1&g=A5&v=n&m=f&c=n&s=1,1,0,1,1, Enter on node 3, and on
// /tools/board/?z=1&g=A5&v=p&m=f&c=p&s=0,0,0,0,0, Enter on city 3.
// Run: npx vitest run --project site-unit site/tests/unit/redteam-RT-05-changed-only.test.ts
import { describe, expect, it } from 'vitest';
import { announceTemplates, moveAnnouncement } from '../../src/lib/a11y';

describe('changed-only sentence when nothing changed (A-4, five nodes)', () => {
  it('firing node 3 of A5 at (1, 1, 0, 1, 1) reads no empty clause', () => {
    const v = ['1', '1', '0', '1', '1'];
    const s = moveAnnouncement('Fired', [1, 2, 3, 4, 5], 3, v, v, 1);
    expect(s, `moveAnnouncement gave ${JSON.stringify(s)}`).not.toMatch(/\.\s+\./);
  });
  it('mutating city 3 of A5 at (0, 0, 0, 0, 0) reads no empty clause', () => {
    const v = ['0', '0', '0', '0', '0'];
    const s = moveAnnouncement('Mutated', [1, 2, 3, 4, 5], 3, v, v, 1);
    expect(s, `moveAnnouncement gave ${JSON.stringify(s)}`).not.toMatch(/\.\s+\./);
  });
  it('changedOnly with no change', () => {
    const s = announceTemplates.changedOnly('Fired', 3, [], 1);
    expect(s, `changedOnly gave ${JSON.stringify(s)}`).not.toMatch(/\.\s+\./);
  });
});
