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
