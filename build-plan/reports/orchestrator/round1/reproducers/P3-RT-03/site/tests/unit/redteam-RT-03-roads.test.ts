// RT-03 (attacks 15 and 30): the `roads` drawing of SPEC.md 6.2 draws one arrow per road, and on a board
// with a one-way road it is always used. 5.6 caps the road count only in the editor ("editor only; the
// engine accepts any count"), and the sandbox's JSON import (T16BoardIO.svelte customSpec) checks only
// that every entry is a safe integer, so an imported one-way board can carry up to 2^53 - 1 roads.
// This test shows the mechanism: the number of glyphs grows with the road count, without a bound.
import { describe, expect, it } from 'vitest';
import { CAPS } from '@two-games/engine';
import { effectiveRoadStyle, roadGlyphs } from '../../src/components/draw/roads';
import { resolveBoard } from '../../src/lib/state';

describe('RT-03: roads drawn one by one have no bound', () => {
  it('a one-way board with 100000 roads gives 100000 glyphs (2^53 - 1 roads would never finish)', () => {
    const board = resolveBoard({ cartan: [[2, -100000], [0, 2]] });
    expect(board.kind).toBe('one-way');
    expect(effectiveRoadStyle(board, 'dynkin')).toBe('roads');
    const glyphs = roadGlyphs(board, 'roads');
    // Expected: a bounded drawing (or a refusal before the board reaches it); observed: one glyph per road.
    expect(glyphs.length).toBeLessThanOrEqual(2 * CAPS.roadsEachWay);
  });
});
