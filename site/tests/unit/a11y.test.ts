// P0-A5: names, announcements, the arrow-key model and the size rule (SPEC.md 7.5 A-1, A-3, A-4,
// A-7; 6.1; CONTRACTS.md 4 and 5.3). The expected strings are the specification's own examples.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  announceTemplates,
  createAnnouncer,
  moveAnnouncement,
  nodeName,
  speak,
} from '../../src/lib/a11y';
import { arrowTarget, shortcutOf } from '../../src/components/board/keyboard';
import { gridUnit, hitSide, layoutFrom, rowLayout, drawingCentres } from '../../src/components/board/layout';
import type { GridLayout } from '../../src/components/board/types';

describe('speak', () => {
  it('speak reads minus', () => {
    expect(speak(-2)).toBe('minus 2');
    expect(speak(2)).toBe('2');
    expect(speak(0)).toBe('0');
    expect(speak(-0)).toBe('0');
    expect(speak(-123456789012345678901234567890n)).toBe('minus 123456789012345678901234567890');
    expect(speak(7n)).toBe('7');
    expect(speak('-17')).toBe('minus 17');
    expect(speak('−17')).toBe('minus 17');
    expect(speak('42')).toBe('42');
    expect(speak('-0')).toBe('0');
    expect(speak('-2/3')).toBe('minus 2/3');
  });
});

describe('nodeName', () => {
  it('nodeName matches the three A-3 templates', () => {
    expect(nodeName('node', 3, 2, 'can be fired')).toBe('Node 3, value 2, can be fired');
    expect(nodeName('node', 5, 0, 'cannot be fired')).toBe('Node 5, value 0, cannot be fired');
    expect(nodeName('city', 2, 1, 'mutation would raise it')).toBe('City 2, population 1, mutation would raise it');
    expect(nodeName('city', 1, -1, 'mutation would raise it')).toBe('City 1, population minus 1, mutation would raise it');
    expect(nodeName('city', 1, '1', 'mutation would lower it')).toBe('City 1, population 1, mutation would lower it');
    expect(nodeName('city', 4, 0n, 'mutation would change nothing')).toBe('City 4, population 0, mutation would change nothing');
  });
});

describe('announceTemplates', () => {
  it('announceTemplates match the A-4 templates character for character', () => {
    expect(announceTemplates.fired(3, [-1, 2, -3], 4)).toBe('Fired node 3. Numbers now minus 1, 2, minus 3. Move 4.');
    expect(announceTemplates.mutated(2, [1, 1, 0], 1)).toBe('Mutated city 2. Populations now 1, 1, 0. Move 1.');
    expect(announceTemplates.linked(1, [0, 1], [-1, 2], 2)).toBe(
      'Mutated city 1 and fired node 1. Populations now 0, 1; numbers now minus 1, 2. Move 2.',
    );
    expect(announceTemplates.cannotFire(3, -2)).toBe('Node 3 cannot be fired: its number is minus 2.');
    expect(announceTemplates.gameOver(6)).toBe('Game over after 6 moves.');
    expect(announceTemplates.playedToEnd(14, [0, 0, 0, 0, -1])).toBe(
      'Played 14 moves to the end. Numbers now 0, 0, 0, 0, minus 1.',
    );
    expect(announceTemplates.undid(4, [1, -2, 0])).toBe('Undid move 4. Numbers now 1, minus 2, 0.');
    expect(announceTemplates.undid(1, [1, 0], 'populations')).toBe('Undid move 1. Populations now 1, 0.');
    expect(announceTemplates.changedOnly('Fired', 4, [[3, 3], [4, -2], [5, 1]], 7)).toBe(
      'Fired node 4. Node 3 now 3, node 4 now minus 2, node 5 now 1. Move 7.',
    );
    // The two phase-0 strings of the index page (A2 from (1, 0); computed by the engine).
    expect(announceTemplates.mutated(1, [-1, 0], 1)).toBe('Mutated city 1. Populations now minus 1, 0. Move 1.');
    expect(announceTemplates.mutated(2, [1, 1], 1)).toBe('Mutated city 2. Populations now 1, 1. Move 1.');
  });

  it('pluralises one move (plan)', () => {
    expect(announceTemplates.gameOver(1)).toBe('Game over after 1 move.');
    expect(announceTemplates.playedToEnd(1, [-1])).toBe('Played 1 move to the end. Numbers now minus 1.');
  });

  it('changedOnly names only the changed nodes above four nodes', () => {
    const labels = [1, 2, 3, 4, 5];
    const before = [0, 1, 2, 2, -1];
    const after = [0, 1, 3, -2, 1];
    expect(moveAnnouncement('Fired', labels, 4, before, after, 7)).toBe(
      'Fired node 4. Node 3 now 3, node 4 now minus 2, node 5 now 1. Move 7.',
    );
    // A mutation changes one entry, so its sentence names one city.
    expect(moveAnnouncement('Mutated', labels, 2, [1, 0, 0, 0, 0], [1, 1, 0, 0, 0], 1)).toBe(
      'Mutated city 2. City 2 now 1. Move 1.',
    );
    // At four nodes or fewer every value is read.
    expect(moveAnnouncement('Mutated', [1, 2, 3, 4], 2, [1, 0, 0, 0], [1, 1, 0, 0], 1)).toBe(
      'Mutated city 2. Populations now 1, 1, 0, 0. Move 1.',
    );
    expect(moveAnnouncement('Fired', [1, 2], 2, [1, 1], [2, -1], 1)).toBe('Fired node 2. Numbers now 2, minus 1. Move 1.');
  });
});

describe('createAnnouncer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeRegion(): { region: HTMLElement; writes: string[] } {
    const writes: string[] = [];
    let text = '';
    const region = {
      get textContent(): string {
        return text;
      },
      set textContent(value: string) {
        text = value;
        writes.push(value);
      },
    } as unknown as HTMLElement;
    return { region, writes };
  }

  it('createAnnouncer coalesces calls within 500 ms to the last text', () => {
    vi.useFakeTimers();
    const { region, writes } = fakeRegion();
    const announce = createAnnouncer(region);

    announce('Mutated city 1. Populations now minus 1, 0. Move 1.');
    vi.advanceTimersByTime(200);
    announce('Mutated city 1. Populations now 1, 0. Move 2.');
    vi.advanceTimersByTime(499);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(writes).toEqual(['Mutated city 1. Populations now 1, 0. Move 2.']);
    expect(region.textContent).toBe('Mutated city 1. Populations now 1, 0. Move 2.');

    // One move alone: exactly one announcement, equal to the template.
    announce('Undid move 2. Populations now minus 1, 0.');
    vi.advanceTimersByTime(600);
    expect(writes.slice(1)).toEqual(['Undid move 2. Populations now minus 1, 0.']);
  });

  it('announces the same text twice by clearing the region first', () => {
    vi.useFakeTimers();
    const { region, writes } = fakeRegion();
    const announce = createAnnouncer(region);
    const text = 'Mutated city 2. Populations now 1, 1. Move 1.';
    announce(text);
    vi.advanceTimersByTime(500);
    announce(text);
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([text, '', text]);
    expect(region.textContent).toBe(text);
  });
});

// Coordinates of SPEC.md 6.1, typed here: (label, x, y) with y growing upwards.
function layout(entries: [number, number, number][], kind: GridLayout['kind'] = 'row'): { layout: GridLayout; labels: number[] } {
  return {
    layout: layoutFrom(
      entries.map(([, x, y]) => [x, y] as const),
      kind,
    ),
    labels: entries.map(([l]) => l),
  };
}

describe('arrowTarget', () => {
  it('arrowTarget follows the 45-degree rule with ties to the smaller label and falls back by label', () => {
    const a2 = layout([
      [1, 1, 0],
      [2, 2, 0],
    ]);
    const A2 = (from: number, key: Parameters<typeof arrowTarget>[3]): number => arrowTarget(a2.layout, a2.labels, from, key);
    expect(A2(1, 'ArrowRight')).toBe(2);
    expect(A2(2, 'ArrowRight')).toBe(2);
    expect(A2(2, 'ArrowLeft')).toBe(1);
    expect(A2(1, 'ArrowLeft')).toBe(1);
    expect(A2(1, 'ArrowDown')).toBe(2);
    expect(A2(2, 'ArrowUp')).toBe(1);
    expect(A2(1, 'ArrowUp')).toBe(1);
    expect(A2(2, 'ArrowDown')).toBe(2);
    expect(A2(2, 'Home')).toBe(1);
    expect(A2(1, 'End')).toBe(2);

    // D4: node 3 at (3, 0.6), node 4 at (3, -0.6).
    const d4 = layout([
      [1, 1, 0],
      [2, 2, 0],
      [3, 3, 0.6],
      [4, 3, -0.6],
    ]);
    const D4 = (from: number, key: Parameters<typeof arrowTarget>[3]): number => arrowTarget(d4.layout, d4.labels, from, key);
    expect(D4(2, 'ArrowRight')).toBe(3);
    expect(D4(3, 'ArrowDown')).toBe(4);
    expect(D4(4, 'ArrowUp')).toBe(3);
    expect(D4(3, 'ArrowRight')).toBe(4);
    expect(D4(3, 'ArrowLeft')).toBe(2);
    expect(D4(1, 'ArrowUp')).toBe(1);
    expect(D4(4, 'ArrowRight')).toBe(4);
    expect(D4(1, 'End')).toBe(4);

    // E8: nodes 1,3,4,5,6,7,8 at x = 1..7 on y = 0; node 2 at (3, 1), above node 4.
    const e8 = layout([
      [1, 1, 0],
      [2, 3, 1],
      [3, 2, 0],
      [4, 3, 0],
      [5, 4, 0],
      [6, 5, 0],
      [7, 6, 0],
      [8, 7, 0],
    ]);
    const E8 = (from: number, key: Parameters<typeof arrowTarget>[3]): number => arrowTarget(e8.layout, e8.labels, from, key);
    expect(E8(2, 'ArrowRight')).toBe(5); // exactly 45 degrees, nearer than node 6
    expect(E8(2, 'ArrowLeft')).toBe(3); // exactly 45 degrees
    expect(E8(2, 'ArrowDown')).toBe(4);
    expect(E8(4, 'ArrowUp')).toBe(2);
    expect(E8(3, 'ArrowRight')).toBe(4);
    expect(E8(4, 'ArrowRight')).toBe(5);
    expect(E8(5, 'ArrowUp')).toBe(2); // (-1, 1): exactly 45 degrees
    expect(E8(1, 'ArrowUp')).toBe(1); // nothing within 45 degrees, no previous label
    expect(E8(8, 'ArrowRight')).toBe(8);
    expect(E8(8, 'ArrowDown')).toBe(8);
    expect(E8(1, 'ArrowDown')).toBe(2); // fallback: next label
    expect(E8(5, 'Home')).toBe(1);
    expect(E8(5, 'End')).toBe(8);
  });

  it('arrowTarget wraps on polygon and custom layouts', () => {
    const pentagon = layout(
      [
        [1, 0, 1],
        [2, 0.95, 0.31],
        [3, 0.59, -0.81],
        [4, -0.59, -0.81],
        [5, -0.95, 0.31],
      ],
      'polygon',
    );
    const P = (from: number, key: Parameters<typeof arrowTarget>[3]): number => arrowTarget(pentagon.layout, pentagon.labels, from, key);
    expect(P(1, 'ArrowRight')).toBe(2);
    expect(P(5, 'ArrowRight')).toBe(1);
    expect(P(5, 'ArrowDown')).toBe(1);
    expect(P(1, 'ArrowLeft')).toBe(5);
    expect(P(1, 'ArrowUp')).toBe(5);
    expect(P(3, 'ArrowUp')).toBe(2);
    expect(P(3, 'Home')).toBe(1);
    expect(P(3, 'End')).toBe(5);

    // A custom board whose positions are not in label order.
    const custom = layout(
      [
        [3, 0, 0],
        [1, 5, 5],
        [2, 2, 9],
      ],
      'custom',
    );
    const C = (from: number, key: Parameters<typeof arrowTarget>[3]): number => arrowTarget(custom.layout, custom.labels, from, key);
    expect(C(1, 'ArrowRight')).toBe(2);
    expect(C(2, 'ArrowRight')).toBe(3);
    expect(C(3, 'ArrowRight')).toBe(1);
    expect(C(1, 'ArrowLeft')).toBe(3);
    expect(C(3, 'Home')).toBe(1);
    expect(C(1, 'End')).toBe(3);
  });
});

describe('shortcutOf', () => {
  const inside = { closest: (s: string) => (s === '[data-board-group]' ? {} : null) } as unknown as EventTarget;
  const outside = { closest: () => null } as unknown as EventTarget;
  const ev = (key: string, target: EventTarget, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
    key,
    target,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...mods,
  });
  it('u and r act only inside a board group and never with a modifier', () => {
    expect(shortcutOf(ev('u', inside))).toBe('undo');
    expect(shortcutOf(ev('r', inside))).toBe('redo');
    expect(shortcutOf(ev('u', outside))).toBeNull();
    expect(shortcutOf(ev('r', inside, { ctrlKey: true }))).toBeNull();
    expect(shortcutOf(ev('u', inside, { metaKey: true }))).toBeNull();
    expect(shortcutOf(ev('x', inside))).toBeNull();
  });
});

describe('size rule', () => {
  it('gridUnit and hitSide give 64 and 44 on A2 at 360, and 43, 38, 33, 25 at 320 for 7, 8, 9, 12 columns', () => {
    expect(gridUnit(360, 2)).toBe(64);
    expect(hitSide(gridUnit(360, 2))).toBe(44);
    expect(gridUnit(320, 2)).toBe(64);
    expect(hitSide(gridUnit(320, 6))).toBe(44);
    expect(gridUnit(320, 7)).toBe(43);
    expect(gridUnit(320, 8)).toBe(38);
    expect(gridUnit(320, 9)).toBe(33);
    expect(gridUnit(320, 12)).toBe(25);
    expect(hitSide(43)).toBe(43);
    expect(hitSide(25)).toBe(25);
  });

  it('rowLayout puts label l at (l, 0) and the drawing flips y once', () => {
    const row = rowLayout({ n: 3, labels: [1, 2, 3] });
    expect(row.xy).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(row.columns).toBe(3);
    expect(row.kind).toBe('row');
    const e = layoutFrom(
      [
        [1, 0],
        [3, 1],
      ],
      'row',
    );
    // Node 2 above (grid y = 1) is drawn higher (smaller SVG y).
    expect(drawingCentres(e)).toEqual([
      [0.5, 1.5],
      [2.5, 0.5],
    ]);
  });
});
