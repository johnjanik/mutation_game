// The `roads` drawing of SPEC.md 6.2 draws one arrow per road, and on a board with a one-way road it
// is always used. 5.6 caps the road count only in the editor ("editor only; the engine accepts any
// count"), so a board that reaches the drawing by another route (a link, an import) can carry up to
// 2^53 - 1 roads. The number of glyphs must stay bounded whatever the road count.
// Adopted from the red team's reproducer of P3-RT-03-01 (RT-03 attacks 15 and 30).
import { describe, expect, it } from 'vitest';
import { CAPS } from '@two-games/engine';
import { effectiveRoadStyle, roadElements, roadGlyphs } from '../../src/components/draw/roads';
import { resolveBoard } from '../../src/lib/state';

describe('roads drawn one by one have a bound', () => {
  // regression: P3-RT-03-01
  it('a one-way board with 100000 roads gives a bounded number of glyphs (2^53 - 1 roads would never finish)', () => {
    const board = resolveBoard({ cartan: [[2, -100000], [0, 2]] });
    expect(board.kind).toBe('one-way');
    expect(effectiveRoadStyle(board, 'dynkin')).toBe('roads');
    const glyphs = roadGlyphs(board, 'roads');
    // Expected: a bounded drawing (or a refusal before the board reaches it); observed: one glyph per road.
    expect(glyphs.length).toBeLessThanOrEqual(2 * CAPS.roadsEachWay);
  });

  // regression: P3-RT-03-01
  it('up to the editor cap every road is its own arrow; above it one arrow carries the count as text', () => {
    // Four roads each way (the editor's cap, 5.6): eight arrows, as 6.2 says.
    const four = resolveBoard({ cartan: [[2, -4], [-4, 2]] });
    const g4 = roadGlyphs(four, 'roads');
    expect(g4).toHaveLength(2 * CAPS.roadsEachWay);
    for (const g of g4) expect(g.kind).toBe('arrow');
    // One road more in one direction: that direction is one counted arrow, the other keeps its arrows.
    const five = resolveBoard({ cartan: [[2, -1], [-(CAPS.roadsEachWay + 1), 2]] });
    const g5 = roadGlyphs(five, 'roads');
    expect(g5).toEqual([
      { kind: 'counted', from: 0, to: 1, count: CAPS.roadsEachWay + 1 },
      { kind: 'arrow', from: 1, to: 0, index: 0, of: 1 },
    ]);
    const els = roadElements(g5, [[0.5, 0.5], [1.5, 0.5]], 1);
    expect(els.filter((e) => e.tag === 'path')).toHaveLength(2);
    expect(els.filter((e) => e.tag === 'polygon')).toHaveLength(2);
    const texts = els.filter((e) => e.tag === 'text');
    expect(texts.map((e) => e.text)).toEqual([String(CAPS.roadsEachWay + 1)]);
    expect(texts[0]!.attrs.fill).toBe('var(--text)');
    // The largest safe road count is one arrow and one numeral, both ways at once.
    const huge = resolveBoard({ cartan: [[2, -9007199254740991], [-9007199254740991, 2]] });
    const gh = roadGlyphs(huge, 'roads');
    expect(gh).toEqual([
      { kind: 'counted', from: 0, to: 1, count: 9007199254740991 },
      { kind: 'counted', from: 1, to: 0, count: 9007199254740991 },
    ]);
    expect(roadElements(gh, [[0.5, 0.5], [1.5, 0.5]], 1).filter((e) => e.tag === 'text').map((e) => e.text)).toEqual(['9007199254740991', '9007199254740991']);
  });
});
