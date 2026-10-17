// The History API rules of SPEC.md 7.4 and 4.0 "History". After a move the address bar is updated
// with replaceState, half a second after the last move of a burst, inside a try block. pushState is
// used only when the reader loads an example or a catalogue entry. "Copy link" always encodes the
// current state, whatever the address bar holds. Nothing is written on load or hydration.
//
// One registry of instances per page. The query written holds, for each registered instance whose
// state differs from its defaults, that instance's keys with its prefix (bare on a tool route, where
// the instance id is empty). Keys the codec does not know are kept as they are; the pathname and the
// hash are kept, so the base path is never re-typed.
import { decodeState, encodeState, normalisePrefix } from './urlCodec';
import { cloneState, type ToolState } from './state';

/** The burst window of 7.4: one replaceState half a second after the last change. */
export const REPLACE_DELAY_MS = 500;

const KEY_LETTERS = 'zgvmcswxtrjeykqd';

interface Instance {
  defaults: ToolState;
  current: ToolState;
  onPopState?: (state: ToolState, notice: string | null) => void;
}

const instances = new Map<string, Instance>();
let timer: ReturnType<typeof setTimeout> | null = null;
let popListening = false;

interface BrowserLike {
  location: { pathname: string; search: string; hash: string; origin: string };
  history: { state: unknown; replaceState(data: unknown, unused: string, url?: string): void; pushState(data: unknown, unused: string, url?: string): void };
  addEventListener?: (type: string, listener: () => void) => void;
}

function browser(): BrowserLike | null {
  const g = globalThis as unknown as Partial<BrowserLike>;
  return g.location && g.history ? (g as BrowserLike) : null;
}

/**
 * Registers an instance with the defaults its author configured (6.6: an instance id is unique on
 * the page; a second registration of the same id throws). `initial` is the state it shows now, when
 * a link changed it (default: the defaults). `onPopState` receives the state re-read from the URL
 * after the back button (plan). Registering writes nothing.
 */
export function registerInstance(
  instanceId: string,
  defaults: ToolState,
  onPopState?: (state: ToolState, notice: string | null) => void,
  initial?: ToolState,
): void {
  if (instances.has(instanceId)) throw new Error(`duplicate instance id ${instanceId}`);
  const entry: Instance = { defaults: cloneState(defaults), current: cloneState(initial ?? defaults) };
  if (onPopState) entry.onPopState = onPopState;
  instances.set(instanceId, entry);
  const b = browser();
  if (!popListening && b?.addEventListener) {
    popListening = true;
    b.addEventListener('popstate', onPopState_);
  }
}

/** Forgets an instance (a tool that is destroyed). */
export function unregisterInstance(instanceId: string): void {
  instances.delete(instanceId);
}

/** Records the state of an instance after a change and schedules one replaceState for the burst. */
export function stateChanged(instanceId: string, state: ToolState): void {
  const entry = instances.get(instanceId);
  if (!entry) return;
  if (encodeState(state) === encodeState(entry.current)) return;
  entry.current = cloneState(state);
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
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  write('push');
}

function isCodecKey(name: string): boolean {
  for (const id of instances.keys()) {
    const prefix = normalisePrefix(id);
    if (name.length === prefix.length + 1 && name.startsWith(prefix) && KEY_LETTERS.includes(name.slice(prefix.length))) return true;
  }
  return false;
}

/** The query of the page from the recorded states, keeping keys the codec does not know. */
function queryOfPage(search: string): string {
  const kept: string[] = [];
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
    if (!isCodecKey(name)) kept.push(part);
  }
  const ids = [...instances.keys()].sort();
  for (const id of ids) {
    const entry = instances.get(id)!;
    const encoded = encodeState(entry.current, { prefix: id });
    if (encoded !== encodeState(entry.defaults, { prefix: id })) kept.push(encoded);
  }
  return kept.join('&');
}

function urlOfPage(b: BrowserLike): string {
  const query = queryOfPage(b.location.search);
  return `${b.location.pathname}${query ? `?${query}` : ''}${b.location.hash}`;
}

function write(how: 'replace' | 'push'): void {
  const b = browser();
  if (!b) return;
  try {
    const url = urlOfPage(b);
    if (how === 'replace') b.history.replaceState(b.history.state, '', url);
    else b.history.pushState(null, '', url);
  } catch {
    // A browser may refuse (Safari's limit, 7.4); the bar then keeps its old link. No notice.
  }
}

/** The full URL for "Copy link", built from the recorded states now, never read back from the bar. */
export function linkFor(instanceId: string): string {
  const b = browser();
  if (!instances.has(instanceId)) throw new Error(`unknown instance id ${instanceId}`);
  if (!b) {
    const entry = instances.get(instanceId)!;
    return `?${encodeState(entry.current, { prefix: instanceId })}`;
  }
  return `${b.location.origin}${urlOfPage(b)}`;
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

/** Test seam: forget every instance and timer. */
export function resetHistoryForTests(): void {
  instances.clear();
  if (timer !== null) clearTimeout(timer);
  timer = null;
  popListening = false;
}
