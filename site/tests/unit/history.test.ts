// P1-A2: the History API rules of SPEC.md 7.4 and 4.0 "History", with fake timers and a stub
// window (location, history, addEventListener). Instance ids are unique on the page (6.6).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REPLACE_DELAY_MS,
  copyLink,
  exampleLoaded,
  linkFor,
  registerInstance,
  resetHistoryForTests,
  stateChanged,
} from '../../src/lib/history';
import { defaultState, type ToolState } from '../../src/lib/state';
import { ssrLoader, type SsrLoader } from './_svelteSsr';

interface Call {
  how: 'replace' | 'push';
  url: string;
}

const g = globalThis as unknown as Record<string, unknown>;
let calls: Call[];
let refuse: boolean;
let listeners: Map<string, (() => void)[]>;
const loc = { origin: 'https://example.org', pathname: '/base/modules/m0-start/', search: '', hash: '#beat-3' };

function applyUrl(url: string): void {
  const u = new URL(url, loc.origin);
  loc.pathname = u.pathname;
  loc.search = u.search;
  loc.hash = u.hash;
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  refuse = false;
  listeners = new Map();
  loc.pathname = '/base/modules/m0-start/';
  loc.search = '?utm_source=mail&b9.g=A2';
  loc.hash = '#beat-3';
  g.location = loc;
  g.history = {
    state: null,
    replaceState: (_d: unknown, _u: string, url: string) => {
      if (refuse) throw new Error('SecurityError: too many calls');
      calls.push({ how: 'replace', url });
      applyUrl(url);
    },
    pushState: (_d: unknown, _u: string, url: string) => {
      if (refuse) throw new Error('SecurityError: too many calls');
      calls.push({ how: 'push', url });
      applyUrl(url);
    },
  };
  g.addEventListener = (type: string, fn: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]);
});

afterEach(() => {
  resetHistoryForTests();
  vi.useRealTimers();
  delete g.location;
  delete g.history;
  delete g.addEventListener;
});

const A2 = defaultState('board', 'A2'); // populations, start (1,0), no moves
const withMoves = (moves: number[]): ToolState => ({ ...A2, moves });

describe('history', () => {
  it('duplicate instance id', () => {
    registerInstance('b1', A2);
    registerInstance('b2', A2);
    expect(() => registerInstance('b2', A2)).toThrow(new Error('duplicate instance id b2'));
  });

  it('replaceState after a burst', () => {
    registerInstance('b1', A2);
    registerInstance('b2', A2);
    for (let k = 1; k <= 5; k++) {
      stateChanged('b2', withMoves(Array.from({ length: k }, () => 1)));
      vi.advanceTimersByTime(100);
    }
    expect(calls).toEqual([]); // 100 ms after the last move: still in the burst
    vi.advanceTimersByTime(REPLACE_DELAY_MS - 101);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(1);
    // Only the changed instance is written, with its prefix; foreign keys, path and hash are kept.
    expect(calls[0]).toEqual({ how: 'replace', url: '/base/modules/m0-start/?utm_source=mail&b9.g=A2&b2.z=1&b2.g=A2&b2.c=p&b2.s=1,0&b2.w=1.1.1.1.1#beat-3' });
    // Back to the defaults: the instance writes nothing.
    stateChanged('b2', A2);
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls[1]!.url).toBe('/base/modules/m0-start/?utm_source=mail&b9.g=A2#beat-3');
    expect(calls.every((c) => c.how === 'replace')).toBe(true);
  });

  it('bare keys on a tool route', () => {
    loc.pathname = '/base/tools/board/';
    loc.search = '';
    loc.hash = '';
    registerInstance('', A2);
    stateChanged('', withMoves([2]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls).toEqual([{ how: 'replace', url: '/base/tools/board/?z=1&g=A2&c=p&s=1,0&w=2' }]);
  });

  it('a refused replaceState is swallowed', () => {
    registerInstance('b2', A2);
    refuse = true;
    const errors = vi.spyOn(console, 'error');
    stateChanged('b2', withMoves([1]));
    expect(() => vi.advanceTimersByTime(REPLACE_DELAY_MS)).not.toThrow();
    expect(calls).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    expect(() => exampleLoaded('b2', withMoves([2]))).not.toThrow();
    errors.mockRestore();
  });

  it('pushState on an example or a catalogue entry only', () => {
    registerInstance('b2', A2);
    for (let k = 1; k <= 30; k++) stateChanged('b2', withMoves(Array.from({ length: k }, () => 2)));
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 3);
    expect(calls.filter((c) => c.how === 'push')).toHaveLength(0);
    const example: ToolState = { ...A2, board: 'G2', coords: 'numbers', start: [1, 1], moves: [1, 2] };
    exampleLoaded('b2', example);
    expect(calls.filter((c) => c.how === 'push')).toHaveLength(1);
    const catalogueEntry: ToolState = { schema: 1, tool: 'board', board: 'E6', coords: 'numbers', start: [1, 1, 1, 1, 1, 1] };
    exampleLoaded('b2', catalogueEntry);
    const pushes = calls.filter((c) => c.how === 'push');
    expect(pushes).toHaveLength(2);
    expect(pushes[1]!.url).toContain('b2.g=E6');
    // A pending burst is not written after the push.
    stateChanged('b2', withMoves([1]));
    exampleLoaded('b2', example);
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 2);
    expect(calls.at(-1)!.how).toBe('push');
  });

  it('linkFor ignores location', () => {
    registerInstance('b2', A2);
    loc.search = '?b2.z=1&b2.g=A2&b2.w=2.2.2&keep=1';
    stateChanged('b2', withMoves([1]));
    // The bar still holds the old link; the link is built from the current state now.
    expect(linkFor('b2')).toBe('https://example.org/base/modules/m0-start/?keep=1&b2.z=1&b2.g=A2&b2.c=p&b2.s=1,0&b2.w=1#beat-3');
  });

  it('copy link writes the current state', async () => {
    registerInstance('b2', A2);
    stateChanged('b2', withMoves([1, 2]));
    expect(calls).toEqual([]); // replaceState has not fired yet
    const written: string[] = [];
    const ok = await copyLink('b2', { writeText: async (t: string) => void written.push(t) });
    expect(ok).toBe(true);
    expect(written).toEqual([linkFor('b2')]);
    expect(written[0]).toContain('b2.w=1.2');
    const refused = await copyLink('b2', { writeText: () => Promise.reject(new Error('NotAllowedError')) });
    expect(refused).toBe(false);
    expect(await copyLink('b2', undefined)).toBe(false);
  });

  it('popstate re-reads the URL', () => {
    const seen: [ToolState, string | null][] = [];
    registerInstance('b2', A2, (s, n) => seen.push([s, n]));
    exampleLoaded('b2', withMoves([2]));
    loc.search = '?b2.g=A2&b2.w=1.2.1';
    for (const fn of listeners.get('popstate') ?? []) fn();
    expect(seen).toEqual([[withMoves([1, 2, 1]), null]]);
    loc.search = '?b2.z=7';
    for (const fn of listeners.get('popstate') ?? []) fn();
    expect(seen[1]![1]).not.toBeNull();
    expect(seen[1]![0]).toEqual(A2);
  });
});

/** A press inside the frame of `instanceId` (ToolFrame's root carries data-frame and data-instance). */
function readerPresses(instanceId: string): void {
  const frame = { getAttribute: (name: string) => (name === 'data-instance' ? instanceId : null), parentElement: null };
  const target = { closest: (selectors: string) => (selectors === '[data-frame]' ? frame : null) };
  for (const fn of listeners.get('pointerdown') ?? []) (fn as (event: unknown) => void)({ target });
}

describe('a link applied after registration', () => {
  // regression: P4-RT-04-03
  it('nothing is written on load when a tool applies its link after registering', () => {
    // The page opens with a link for b2; ToolFrame registers b1 and b2 with their configured states,
    // then b2's tool applies the link (its state holds every key, so it encodes differently from the
    // bar), as T10 does a task after hydration.
    loc.search = '?utm_source=mail&b2.g=A2&b2.w=1';
    registerInstance('b1', A2);
    registerInstance('b2', A2);
    stateChanged('b2', withMoves([1]));
    // b3 follows b2 (linkTo): its change comes from the link too, not from the reader.
    registerInstance('b3', A2);
    stateChanged('b3', withMoves([1]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls).toEqual([]);
    expect(loc.search).toBe('?utm_source=mail&b2.g=A2&b2.w=1');
    // Copy link still encodes the current state of the instance asked for.
    expect(linkFor('b2')).toBe('https://example.org/base/modules/m0-start/?utm_source=mail&b2.z=1&b2.g=A2&b2.c=p&b2.s=1,0&b2.w=1#beat-3');
  });

  // regression: P4-RT-04-03
  it('after the reader acts, only the instances the reader has changed are written', () => {
    loc.search = '?utm_source=mail&b2.g=A2&b2.w=1';
    registerInstance('b1', A2);
    registerInstance('b2', A2);
    stateChanged('b2', withMoves([1])); // the link, applied
    // The reader plays on b1: b1 is written; b2 keeps the keys of its link as the bar holds them.
    readerPresses('b1');
    stateChanged('b1', withMoves([2]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls).toEqual([{ how: 'replace', url: '/base/modules/m0-start/?utm_source=mail&b2.g=A2&b2.w=1&b1.z=1&b1.g=A2&b1.c=p&b1.s=1,0&b1.w=2#beat-3' }]);
    // The reader plays on b2: from now on b2 is written from its state.
    readerPresses('b2');
    stateChanged('b2', withMoves([1, 2]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls[1]).toEqual({ how: 'replace', url: '/base/modules/m0-start/?utm_source=mail&b1.z=1&b1.g=A2&b1.c=p&b1.s=1,0&b1.w=2&b2.z=1&b2.g=A2&b2.c=p&b2.s=1,0&b2.w=1.2#beat-3' });
  });

  it('on a tool route the bare link is kept until the reader acts', () => {
    loc.pathname = '/base/tools/board/';
    loc.search = '?g=A2&w=1';
    loc.hash = '';
    registerInstance('', A2);
    stateChanged('', withMoves([1]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls).toEqual([]);
    readerPresses('');
    stateChanged('', withMoves([1, 2]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls).toEqual([{ how: 'replace', url: '/base/tools/board/?z=1&g=A2&c=p&s=1,0&w=1.2' }]);
  });

  it('loading an example is the reader acting', () => {
    loc.search = '?b2.g=A2&b2.w=1';
    registerInstance('b2', A2);
    stateChanged('b2', withMoves([1]));
    exampleLoaded('b2', withMoves([2, 1]));
    expect(calls).toEqual([{ how: 'push', url: '/base/modules/m0-start/?b2.z=1&b2.g=A2&b2.c=p&b2.s=1,0&b2.w=2.1#beat-3' }]);
    stateChanged('b2', withMoves([2]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls[1]!.url).toContain('b2.w=2#');
  });
});

// These guard the fix of P4-RT-04-03 against its own regression (the confirmer of the phase 4 round):
// once the reader acts anywhere in a tool, every instance's change is the reader's, whichever frame
// the press was in, so leaders and followers are both written (SPEC.md 7.4, 6.6).
describe('after the reader acts on a page opened from a link', () => {
  /** The keys written for an instance on A2 with these moves. */
  const keys = (id: string, moves: number[]) => `${id}.z=1&${id}.g=A2&${id}.c=p&${id}.s=1,0&${id}.w=${moves.join('.')}`;

  // regression: P4-RT-04-03
  it('a follower that drives its leader from its own frame writes both', () => {
    loc.search = '?b1.g=A2&b1.w=1';
    registerInstance('b1', A2);
    registerInstance('b2', A2); // follows b1 (linkTo)
    stateChanged('b1', withMoves([1])); // the link, applied
    stateChanged('b2', withMoves([1])); // and followed
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls).toEqual([]);
    // A jump in b2's table: b2 publishes, and b1 follows it.
    readerPresses('b2');
    stateChanged('b2', withMoves([1, 2, 1]));
    stateChanged('b1', withMoves([1, 2, 1]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    const url = `/base/modules/m0-start/?${keys('b1', [1, 2, 1])}&${keys('b2', [1, 2, 1])}#beat-3`;
    expect(calls).toEqual([{ how: 'replace', url }]);
    expect(linkFor('b2')).toBe(`https://example.org${url}`);
    expect(linkFor('b1')).toBe(`https://example.org${url}`);
  });

  // regression: P4-RT-04-03
  it('a follower that came with its own link keys is written from the state it shows', () => {
    loc.search = '?b1.g=A2&b1.w=2&b2.g=A2&b2.w=2';
    registerInstance('b1', A2);
    registerInstance('b2', A2); // follows b1
    stateChanged('b1', withMoves([2]));
    stateChanged('b2', withMoves([2]));
    readerPresses('b1');
    stateChanged('b1', withMoves([2, 1]));
    stateChanged('b2', withMoves([2, 1]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls).toEqual([{ how: 'replace', url: `/base/modules/m0-start/?${keys('b1', [2, 1])}&${keys('b2', [2, 1])}#beat-3` }]);
  });

  // regression: P4-RT-04-03
  it('a follower is written while another instance keeps the link the reader has not touched', () => {
    loc.search = '?b1.g=A2&b1.w=2&b3.g=A2&b3.w=1';
    registerInstance('b1', A2);
    registerInstance('b2', A2); // follows b1
    registerInstance('b3', A2);
    stateChanged('b1', withMoves([2]));
    stateChanged('b2', withMoves([2]));
    stateChanged('b3', withMoves([1]));
    readerPresses('b1');
    stateChanged('b1', withMoves([2, 1]));
    stateChanged('b2', withMoves([2, 1]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls).toEqual([{ how: 'replace', url: `/base/modules/m0-start/?b3.g=A2&b3.w=1&${keys('b1', [2, 1])}&${keys('b2', [2, 1])}#beat-3` }]);
    // Later moves are written too: nothing stays held for the untouched link.
    stateChanged('b1', withMoves([2, 1, 2]));
    stateChanged('b2', withMoves([2, 1, 2]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls[1]!.url).toBe(`/base/modules/m0-start/?b3.g=A2&b3.w=1&${keys('b1', [2, 1, 2])}&${keys('b2', [2, 1, 2])}#beat-3`);
  });

  // regression: P4-RT-04-03
  it('an instance that hydrates after the reader acted writes nothing for its link until the reader acts again', () => {
    loc.search = '?b1.g=A2&b1.w=2&b9.g=A2&b9.w=1';
    registerInstance('b1', A2);
    stateChanged('b1', withMoves([2]));
    readerPresses('b1');
    stateChanged('b1', withMoves([2, 1]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls).toEqual([{ how: 'replace', url: `/base/modules/m0-start/?b9.g=A2&b9.w=1&${keys('b1', [2, 1])}#beat-3` }]);
    // b9 hydrates as the reader scrolls to it and applies its link; b10, hydrating too, follows b1.
    registerInstance('b9', A2);
    registerInstance('b10', A2);
    stateChanged('b9', withMoves([1]));
    stateChanged('b10', withMoves([2, 1]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls).toHaveLength(1);
    // The reader plays on b9: b9 is written from its state.
    readerPresses('b9');
    stateChanged('b9', withMoves([1, 2]));
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls[1]!.url).toBe(`/base/modules/m0-start/?${keys('b1', [2, 1])}&${keys('b9', [1, 2])}#beat-3`);
  });
});

describe('load and hydration', () => {
  let loader: SsrLoader;
  beforeAll(async () => {
    loader = await ssrLoader();
  }, 60000);
  afterAll(async () => {
    await loader?.close();
  });

  it('nothing is written on load or hydration', async () => {
    const { default: Fixture } = await loader.load<{ default: unknown }>('/tests/fixtures/toolframe/FixtureTool.svelte');
    // Registering instances, also one shown in a state a link gave it, writes nothing.
    registerInstance('b1', A2);
    registerInstance('b2', A2, undefined, withMoves([1]));
    stateChanged('b1', A2); // a tool reporting its unchanged state on hydration
    stateChanged('b2', withMoves([1]));
    // A ToolFrame rendered in its default state (the server render a page ships) writes nothing.
    const html = loader.render(Fixture, { initial: A2, instanceId: 'b3' });
    expect(html).toContain('data-frame');
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls).toEqual([]);
  });
});
