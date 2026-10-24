// The History API rules of SPEC.md 7.4 and 4.0 "History". After a move the address bar is updated
// with replaceState, half a second after the last move of a burst, inside a try block. pushState is
// used only when the reader loads an example or a catalogue entry. "Copy link" always encodes the
// current state, whatever the address bar holds. Nothing is written on load or hydration.
//
// One registry of instances per page. The query written holds, for each instance the reader has
// changed whose state differs from its defaults, that instance's keys with its prefix (bare on a tool
// route, where the instance id is empty); every other instance keeps its keys as the bar holds them
// (6.6: "only instances the reader has changed are written"). Keys the codec does not know are kept
// as they are; the pathname and the hash are kept, so the base path is never re-typed.
//
// A link is applied by its tool after ToolFrame has registered the instance (a task after hydration
// for some tools), and a follower (linkTo) takes the linked state when it registers, so on a page
// opened from a link (some instance's keys are in the bar when it registers) the link's state arrives
// through stateChanged like a move. There a change of an instance is the reader's only when the reader
// has acted since that instance registered: a press, a key or an input anywhere inside a tool frame
// ([data-frame], ToolFrame's root), or an example loaded. Until then it is the instance's load,
// recorded and not written. The reader's action counts for every instance, whichever frame it was in,
// so a leader moved from its follower's table and a follower moved by its leader are both written. A
// page opened without a link has nothing to apply: every change is written, as a move. RT-FIX
// P4-RT-04-03.
import { decodeState, encodeState, normalisePrefix } from './urlCodec';
import { cloneState, type ToolState } from './state';

/** The burst window of 7.4: one replaceState half a second after the last change. */
export const REPLACE_DELAY_MS = 500;

const KEY_LETTERS = 'zgvmcswxtrjeykqd';

/** The events by which the reader acts on a tool (pointer, keyboard, and assistive technology's click). */
const READER_EVENTS = ['pointerdown', 'keydown', 'click', 'input', 'change'] as const;

interface Instance {
  defaults: ToolState;
  current: ToolState;
  onPopState?: (state: ToolState, notice: string | null) => void;
  /** The number of the reader's actions on the page when the instance registered. */
  registeredAt: number;
  /** The reader has changed the instance: only such instances are written (6.6). */
  changed: boolean;
}

const instances = new Map<string, Instance>();
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
/** The reader's actions on the page so far: presses, keys and inputs inside a tool frame, examples loaded. */
let actions = 0;
/** Some instance registered while the bar held its keys: the page was opened from a link. */
let openedFromLink = false;

interface BrowserLike {
  location: { pathname: string; search: string; hash: string; origin: string };
  history: { state: unknown; replaceState(data: unknown, unused: string, url?: string): void; pushState(data: unknown, unused: string, url?: string): void };
  addEventListener?: (type: string, listener: (event: Event) => void, capture?: boolean) => void;
}

function browser(): BrowserLike | null {
  const g = globalThis as unknown as Partial<BrowserLike>;
  return g.location && g.history ? (g as BrowserLike) : null;
}

/**
 * Registers an instance with the defaults its author configured (6.6: an instance id is unique on
 * the page; a second registration of the same id throws). `initial` is the state it shows now, when
 * a link changed it (default: the defaults). `onPopState` receives the state re-read from the URL
 * after the back button (plan). Registering writes nothing, and on a page opened from a link neither
 * does a change that reaches stateChanged before the reader acts (see the head of this file).
 */
export function registerInstance(
  instanceId: string,
  defaults: ToolState,
  onPopState?: (state: ToolState, notice: string | null) => void,
  initial?: ToolState,
): void {
  if (instances.has(instanceId)) throw new Error(`duplicate instance id ${instanceId}`);
  const b = browser();
  if (b !== null && hasKeysOf(b.location.search, instanceId)) openedFromLink = true;
  const entry: Instance = { defaults: cloneState(defaults), current: cloneState(initial ?? defaults), registeredAt: actions, changed: false };
  if (onPopState) entry.onPopState = onPopState;
  instances.set(instanceId, entry);
  if (!listening && b?.addEventListener) {
    listening = true;
    b.addEventListener('popstate', onPopState_);
    for (const type of READER_EVENTS) b.addEventListener(type, onReaderInput, true);
  }
}

/** Forgets an instance (a tool that is destroyed). */
export function unregisterInstance(instanceId: string): void {
  instances.delete(instanceId);
}

/**
 * Records the state of an instance after a change and schedules one replaceState for the burst. A
 * change that may be a link being applied (see the head of this file) is recorded and not written.
 */
export function stateChanged(instanceId: string, state: ToolState): void {
  const entry = instances.get(instanceId);
  if (!entry) return;
  if (encodeState(state) === encodeState(entry.current)) return;
  entry.current = cloneState(state);
  if (openedFromLink && entry.registeredAt === actions) return;
  entry.changed = true;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    write('replace');
  }, REPLACE_DELAY_MS);
}

/** Records the state of an example or a catalogue entry the reader loaded, and pushes it at once. */
export function exampleLoaded(instanceId: string, state: ToolState): void {
  const entry = instances.get(instanceId);
  if (!entry) return;
  entry.current = cloneState(state);
  actions += 1;
  entry.changed = true;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  write('push');
}

/** A query parameter name that is one of the codec's keys under the prefix of `instanceId`. */
function isKeyOf(name: string, instanceId: string): boolean {
  const prefix = normalisePrefix(instanceId);
  return name.length === prefix.length + 1 && name.startsWith(prefix) && KEY_LETTERS.includes(name.slice(prefix.length));
}

/** The parameter names of a query string, decoded, each with its raw part. */
function partsOf(search: string): { part: string; name: string }[] {
  const out: { part: string; name: string }[] = [];
  const raw = search.startsWith('?') ? search.slice(1) : search;
  for (const part of raw === '' ? [] : raw.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    let name = eq < 0 ? part : part.slice(0, eq);
    try {
      name = decodeURIComponent(name.replace(/\+/g, ' '));
    } catch {
      // keep the raw name
    }
    out.push({ part, name });
  }
  return out;
}

/** Whether the query holds a key of this instance, that is, a link for it. */
function hasKeysOf(search: string, instanceId: string): boolean {
  return partsOf(search).some(({ name }) => isKeyOf(name, instanceId));
}

/**
 * The query of the page: the parameters of `search` that are not keys of an instance written here,
 * then the keys of each such instance whose recorded state differs from its defaults. `written` names
 * the instances the query encodes; every other instance keeps its keys as `search` holds them.
 */
function queryOfPage(search: string, written: (id: string) => boolean): string {
  const ids = [...instances.keys()].filter(written).sort();
  const kept = partsOf(search)
    .filter(({ name }) => !ids.some((id) => isKeyOf(name, id)))
    .map(({ part }) => part);
  for (const id of ids) {
    const entry = instances.get(id)!;
    const encoded = encodeState(entry.current, { prefix: id });
    if (encoded !== encodeState(entry.defaults, { prefix: id })) kept.push(encoded);
  }
  return kept.join('&');
}

function urlOfPage(b: BrowserLike, written: (id: string) => boolean): string {
  const query = queryOfPage(b.location.search, written);
  return `${b.location.pathname}${query ? `?${query}` : ''}${b.location.hash}`;
}

/** The instances the reader has changed: the ones a write encodes. */
const changedByReader = (id: string): boolean => instances.get(id)?.changed === true;

function write(how: 'replace' | 'push'): void {
  const b = browser();
  if (!b) return;
  try {
    const url = urlOfPage(b, changedByReader);
    if (how === 'replace') b.history.replaceState(b.history.state, '', url);
    else b.history.pushState(null, '', url);
  } catch {
    // A browser may refuse (Safari's limit, 7.4); the bar then keeps its old link. No notice.
  }
}

/**
 * The full URL for "Copy link", built from the recorded states now, never read back from the bar: the
 * instance asked for and every instance the reader has changed are encoded; any other instance keeps
 * the keys of its link, which give the state it shows.
 */
export function linkFor(instanceId: string): string {
  const b = browser();
  if (!instances.has(instanceId)) throw new Error(`unknown instance id ${instanceId}`);
  if (!b) {
    const entry = instances.get(instanceId)!;
    return `?${encodeState(entry.current, { prefix: instanceId })}`;
  }
  return `${b.location.origin}${urlOfPage(b, (id) => id === instanceId || changedByReader(id))}`;
}

/** Writes linkFor(instanceId) to the clipboard; answers whether it succeeded. Never throws. */
export async function copyLink(instanceId: string, clipboard: { writeText(text: string): Promise<void> } | undefined | null): Promise<boolean> {
  try {
    if (!clipboard) return false;
    await clipboard.writeText(linkFor(instanceId));
    return true;
  } catch {
    return false;
  }
}

function onPopState_(): void {
  const b = browser();
  if (!b) return;
  for (const [id, entry] of instances) {
    const { state, notice } = decodeState(b.location.search, entry.defaults.tool, entry.defaults, { prefix: id });
    entry.current = cloneState(state);
    entry.onPopState?.(state, notice);
  }
}

/** A press, key or input inside a tool frame (ToolFrame's root, [data-frame]): the reader acts. */
function onReaderInput(event: Event): void {
  const target = event.target as { closest?: unknown } | null;
  if (target === null || typeof target !== 'object' || typeof target.closest !== 'function') return;
  if ((target as { closest(selectors: string): unknown }).closest('[data-frame]') !== null) actions += 1;
}

/** Test seam: forget every instance and timer. */
export function resetHistoryForTests(): void {
  instances.clear();
  if (timer !== null) clearTimeout(timer);
  timer = null;
  listening = false;
  actions = 0;
  openedFromLink = false;
}
