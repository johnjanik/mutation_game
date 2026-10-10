// P1-A2: the extensions of a11y.ts (SPEC.md 7.5 A-4; CONTRACTS.md 5.3): the populations noun of
// playedToEnd, and the coalescing that announces only the last state of a burst, with its count of
// moves. P0-A5's a11y.test.ts stays as it is.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COALESCE_MS, announceTemplates, createAnnouncer, moveAnnouncement } from '../../src/lib/a11y';

describe('playedToEnd', () => {
  it('without the noun is exactly the A-4 template', () => {
    expect(announceTemplates.playedToEnd(14, [0, 0, 0, 0, -1])).toBe('Played 14 moves to the end. Numbers now 0, 0, 0, 0, minus 1.');
    expect(announceTemplates.playedToEnd(14, [0, 0, 0, 0, -1], 'numbers')).toBe('Played 14 moves to the end. Numbers now 0, 0, 0, 0, minus 1.');
  });

  it('with the populations noun (a raising play, T9)', () => {
    expect(announceTemplates.playedToEnd(5, [1, 1, 1], 'populations')).toBe('Played 5 moves to the end. Populations now 1, 1, 1.');
    expect(announceTemplates.playedToEnd(1, ['-2', 3n], 'populations')).toBe('Played 1 move to the end. Populations now minus 2, 3.');
  });
});

describe('coalescing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a burst announces only the last text, with its move number', () => {
    const region = { textContent: '' } as unknown as HTMLElement;
    const announce = createAnnouncer(region);
    // Scrubbing through five moves on A2, 100 ms apart.
    const positions = [[1, 1], [-1, 2], [1, -2], [-1, -1], [1, -1], [-1, 1]];
    for (let k = 1; k <= 5; k++) {
      announce(moveAnnouncement('Fired', [1, 2], k % 2 === 1 ? 1 : 2, positions[k - 1]!, positions[k]!, k));
      vi.advanceTimersByTime(100);
      expect(region.textContent).toBe(''); // nothing within the burst
    }
    vi.advanceTimersByTime(COALESCE_MS - 100);
    expect(region.textContent).toBe('Fired node 1. Numbers now minus 1, 1. Move 5.');
  });

  it('a play to the end is one announcement', () => {
    const region = { textContent: '' } as unknown as HTMLElement;
    const announce = createAnnouncer(region);
    announce(announceTemplates.playedToEnd(14, [0, 0, 0, 0, -1]));
    vi.advanceTimersByTime(COALESCE_MS);
    expect(region.textContent).toBe('Played 14 moves to the end. Numbers now 0, 0, 0, 0, minus 1.');
    // A later single move is announced on its own.
    announce(announceTemplates.fired(3, [-1, 2, -3], 15));
    vi.advanceTimersByTime(COALESCE_MS);
    expect(region.textContent).toBe('Fired node 3. Numbers now minus 1, 2, minus 3. Move 15.');
  });
});
