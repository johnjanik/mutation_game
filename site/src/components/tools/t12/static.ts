// T12: the server's markup of a panel as a string, and the island data of the configured state (SPEC 7.4,
// 7.6; decisions/P5-A2.md). Owner P5-A2.
//
// A panel of T12 that the reader has not acted on needs no hydration: its server markup is inserted with
// {@html} on the server, and in the browser the first value of that block is a placeholder, so that Svelte
// adopts the server's nodes as they are (svelte/src/internal/client/dom/blocks/html.js: "We're deliberately
// not trying to repair mismatches between server and client"), as T10 keeps its server snapshot. The panel
// is drawn by the component, from the state, in a task after hydration (or when its state changes), never
// in the hydration task. svelte/server is imported behind import.meta.env.SSR, which the browser build
// replaces by false, so that it is never part of the route's scripts (7.6: 90 kB), as t10/snapshot.ts does.
import type { Snippet } from 'svelte';
import StaticHost from './StaticHost.svelte';
import type { RelationDigest } from './rep';

const server = import.meta.env.SSR ? await import('svelte/server') : null;

/**
 * What the browser's first render puts in place of a panel kept from the server: any text that is not
 * empty, so that the {@html} block adopts the server's nodes. It is never inserted: the block is replaced by
 * the live panel when the panel is drawn.
 */
export const KEPT = '<!--kept-->';

/** Hydration comments: a copy that is never hydrated needs none, and an empty one would end the block early. */
const COMMENT = /<!--[^]*?-->/g;

/**
 * The server markup of `content(arg)` as a string, without hydration comments (server rendering only); in
 * the browser, KEPT. `idPrefix` keeps the ids of the copy apart from the page's ($props.id()).
 */
export function staticMarkup<T>(content: Snippet<[T]>, arg: T, idPrefix: string): string {
  if (server === null) return KEPT;
  const { body } = server.render(StaticHost as never, { props: { content, arg } as never, idPrefix });
  return body.replace(COMMENT, '');
}

/** The attribute that marks the island data of an instance (its value is the instance's id, or "rep"). */
export const DIGEST_ATTRIBUTE = 'data-t12-digest';

/** The island data as a JSON script element (server rendering only; KEPT in the browser). */
export function digestMarkup(digest: RelationDigest | null, uid: string): string {
  if (server === null) return KEPT;
  // "<" written as <, so that no text of the data can close the script element.
  const json = JSON.stringify(digest).replace(/</g, '\\u003c');
  return `<script type="application/json" ${DIGEST_ATTRIBUTE}="${uid.replace(/[^\w-]/g, '')}">${json}</script>`;
}

/** Reads the island data of an instance from the page before it hydrates (browser only; null when absent or unreadable). */
export function readDigest(uid: string): RelationDigest | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`script[${DIGEST_ATTRIBUTE}="${uid.replace(/[^\w-]/g, '')}"]`);
  if (el === null) return null;
  try {
    const d = JSON.parse(el.textContent ?? 'null') as RelationDigest | null;
    return d !== null && typeof d === 'object' && typeof d.code === 'string' ? d : null;
  } catch {
    return null;
  }
}
