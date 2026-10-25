// Copy link after a popstate (the unit form of site/tests/e2e/history-popstate.spec.ts). history.ts
// onPopState_ replaced each instance's recorded state with the plain codec's reading of the bar,
// decodeState(location.search, tool, defaults), before it called the tool's handler. T12 reads its links
// with admitLink (t12/model.ts), whose state differs from the codec's whenever a link names `g` or `k`
// without the other fields; T12's handler re-reads the link, finds the state on screen unchanged and
// reports nothing. linkFor (Copy link, and the export footer) then encoded the codec's reading instead
// of the state shown. SPEC 7.4: '"Copy link" always encodes the current state, whatever the address bar
// holds at that moment.' Adopted from the RT-04 lens of the phase 5 round.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPLACE_DELAY_MS, exampleLoaded, linkFor, registerInstance, resetHistoryForTests, stateChanged } from '../../src/lib/history';
import { encodeState } from '../../src/lib/urlCodec';
import { admitLink, configuredState } from '../../src/components/tools/t12/model';
import { defaultState, type ToolState } from '../../src/lib/state';

const g = globalThis as unknown as Record<string, unknown>;
let listeners: Map<string, ((e?: unknown) => void)[]>;
const loc = { origin: 'https://example.org', pathname: '/tools/rep/', search: '', hash: '' };

beforeEach(() => {
  listeners = new Map();
  g.location = loc;
  g.history = { state: null, replaceState: () => undefined, pushState: () => undefined };
  g.addEventListener = (type: string, fn: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]);
});

afterEach(() => {
  resetHistoryForTests();
  delete g.location;
  delete g.history;
  delete g.addEventListener;
});

describe('Copy link after a popstate on a T12 instance opened from a link', () => {
  for (const [instance, query] of [['', '?g=E7'], ['', '?k=2'], ['', '?g=A3&c=n'], ['b12', '?b12.k=2']] as const) {
    // regression: P5-RT-04-01
    it(`${query}: linkFor encodes the state T12 shows, before and after popstate`, () => {
      loc.pathname = instance === '' ? '/tools/rep/' : '/modules/m8-lie-algebras/';
      loc.search = query;
      loc.hash = '';
      const configured = instance === '' ? configuredState({ preset: 'default' }) : configuredState({ preset: 'default', board: 'A3', node: 1 });
      // ToolFrame registers the instance with the configured state; T12 then reads the link (admitLink)
      // and its new state reaches stateChanged (not written: the reader has not acted).
      registerInstance(instance, configured, () => {
        // T12's handler (readLink): admitLink of the same bar gives the state already shown; nothing changes.
      }, configured);
      const shown: ToolState = admitLink(query, configured, instance).state;
      stateChanged(instance, shown);
      const want = `${loc.origin}${loc.pathname}?${encodeState(shown, { prefix: instance })}`;
      expect(linkFor(instance)).toBe(want);
      // The skip link: a same-document navigation; Chromium fires popstate (the bar's query is unchanged).
      loc.hash = '#main';
      for (const fn of listeners.get('popstate') ?? []) fn();
      expect(admitLink(loc.search, configured, instance).state, 'T12 still shows the same state').toEqual(shown);
      expect(linkFor(instance).replace(/#main$/, '')).toBe(want);
    });
  }
});

// The state a tool loads on popstate is the instance's load, recorded and not written, whether the tool
// reads its links by the codec or by rules of its own (SPEC 7.4: the bar is written after a move; plan:
// nothing is written on load). A press inside a tool frame afterwards makes the next change the reader's.
describe('the state a popstate loads', () => {
  let calls: { how: 'replace' | 'push'; url: string }[];

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    g.history = {
      state: null,
      replaceState: (_d: unknown, _u: string, url: string) => void calls.push({ how: 'replace', url }),
      pushState: (_d: unknown, _u: string, url: string) => void calls.push({ how: 'push', url }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A press inside a tool frame (ToolFrame's root carries data-frame): the reader acts. */
  const readerPresses = (): void => {
    const target = { closest: (selectors: string) => (selectors === '[data-frame]' ? {} : null) };
    for (const fn of listeners.get('pointerdown') ?? []) fn({ target });
  };
  const popstate = (search: string, hash: string): void => {
    loc.search = search;
    loc.hash = hash;
    for (const fn of listeners.get('popstate') ?? []) fn();
  };

  // regression: P5-RT-04-01
  it('T12 back to its link after a move: the state it loads is recorded, not written, and Copy link encodes it', () => {
    loc.pathname = '/tools/rep/';
    loc.search = '?k=2';
    loc.hash = '';
    const configured = configuredState({ preset: 'default' });
    // The tool and its handler, as T12 reads its links (readLink): admitLink of the bar, loaded when it differs.
    let shownNow: ToolState = configured;
    registerInstance('', configured, () => {
      const admitted = admitLink(loc.search, configured, '').state;
      if (encodeState(admitted) !== encodeState(shownNow)) shownNow = admitted;
    }, configured);
    const linked = admitLink(loc.search, configured, '').state;
    shownNow = linked;
    stateChanged('', shownNow);
    // The skip link (a new entry with the same query), then a move on the string viewer.
    popstate('?k=2', '#main');
    const moved = admitLink(`?${encodeState({ ...linked, moves: [2] })}`, configured, '').state;
    expect(moved.moves).toEqual([2]);
    readerPresses();
    shownNow = moved;
    stateChanged('', shownNow);
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls).toEqual([{ how: 'replace', url: `/tools/rep/?${encodeState(moved)}#main` }]);
    // Back to the entry of the link: T12 loads its state again; ToolFrame reports it.
    popstate('?k=2', '');
    expect(shownNow).toEqual(linked);
    stateChanged('', shownNow);
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls, 'the back button writes nothing').toHaveLength(1);
    expect(linkFor('')).toBe(`${loc.origin}/tools/rep/?${encodeState(linked)}`);
    // The reader acts again: the next change is written.
    readerPresses();
    shownNow = moved;
    stateChanged('', shownNow);
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    expect(calls[1]).toEqual({ how: 'replace', url: `/tools/rep/?${encodeState(moved)}` });
  });

  it('a tool that reads its links by the codec, on a page opened without a link: back loads, writes nothing, and Copy link encodes the state shown', () => {
    loc.pathname = '/tools/board/';
    loc.search = '';
    loc.hash = '';
    const A2 = defaultState('board', 'A2');
    let shownNow: ToolState = A2;
    registerInstance('', A2, (s) => {
      shownNow = s;
    });
    readerPresses();
    shownNow = { ...A2, moves: [1] };
    stateChanged('', shownNow);
    vi.advanceTimersByTime(REPLACE_DELAY_MS);
    exampleLoaded('', { ...A2, moves: [1, 2] });
    expect(calls).toEqual([
      { how: 'replace', url: '/tools/board/?z=1&g=A2&c=p&s=1,0&w=1' },
      { how: 'push', url: '/tools/board/?z=1&g=A2&c=p&s=1,0&w=1.2' },
    ]);
    popstate('?z=1&g=A2&c=p&s=1,0&w=1', '');
    stateChanged('', shownNow);
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls).toHaveLength(2);
    expect(linkFor('')).toBe(`${loc.origin}/tools/board/?z=1&g=A2&c=p&s=1,0&w=1`);
    popstate('', '');
    stateChanged('', shownNow);
    vi.advanceTimersByTime(REPLACE_DELAY_MS * 4);
    expect(calls).toHaveLength(2);
    expect(linkFor('')).toBe(`${loc.origin}/tools/board/`);
  });
});
