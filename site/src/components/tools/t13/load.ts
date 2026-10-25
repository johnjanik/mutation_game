// T13: where the Satake data of a pair are computed (SPEC.md 5.1 E-9 item 3; 7.6). Owner P6-A3.
// satake, restrictedBoard and matchCatalogue (which builds the records with satakeRecord) go through
// engineCall with the hint { board, kind: 'satake' }, so that whereToRun decides: on E7 and E8 the worker,
// on every other board the main thread. The functions are provided by name for the main-thread table
// (P6-size; site/tests/unit/worker-provide.test.ts). admissibility, theta, shadow2, satakeCatalogue and the
// rest stay on the main thread and are called directly by the model.
//
// computeNow is the same data computed at once, for the server render (Node, where E-9 does not apply) and
// for the first render in the browser on a board where whereToRun says 'main', so that hydration finds the
// markup the server wrote; on E7 and E8 the browser always asks the worker.
import { NotAdmissible, matchCatalogue, restrictedBoard, satake } from '@two-games/engine';
import type { Admissibility, AnyBoard, SatakeComputed, SatakeDiagram, SatakeRecord } from '@two-games/engine';
import { engineCall, provide, whereToRun, type CallHint, type EngineApi } from '../../../lib/worker';
import { EMPTY_RESTRICTED, type RestrictedLike } from './model';

provide({ satake, restrictedBoard, matchCatalogue });

/** The data of one admissible pair, as the engine returns them. */
export interface PairData {
  sat: SatakeComputed;
  rb: RestrictedLike;
  records: SatakeRecord[];
}

type DataFn = 'satake' | 'restrictedBoard' | 'matchCatalogue';

/** engineCall's shape for the three data functions (a stub in the unit test). */
export type Caller = <F extends DataFn>(fn: F, args: Parameters<EngineApi[F]>, hint: CallHint) => Promise<Awaited<ReturnType<EngineApi[F]>>>;

/** The hint of every Satake data call (E-9 item 3: the worker on E7 and E8). */
export function satakeHint(board: AnyBoard): CallHint {
  return { board, kind: 'satake' };
}

/** Whether the data of this board are computed on the main thread in the browser (E-9). */
export function dataOnMainThread(board: AnyBoard): boolean {
  return whereToRun(satakeHint(board)) === 'main';
}

/** A pair with no white node has the empty restricted board, without asking the engine (MERGE ruling (4) on P6-A1). */
function noWhiteNode(d: SatakeDiagram): boolean {
  return new Set(d.black).size === d.board.n;
}

/**
 * The data of the pair, computed where E-9 says; null for a pair that is not admissible, for which satake,
 * restrictedBoard and matchCatalogue are never called (SPEC 4 T13 "When not admissible"). A NotAdmissible
 * that comes back anyway (a race with the worker) also gives null; any other error surfaces.
 */
export async function fetchData(d: SatakeDiagram, adm: Admissibility, caller: Caller = engineCall as Caller): Promise<PairData | null> {
  if (!adm.admissible) return null;
  const hint = satakeHint(d.board);
  try {
    if (!dataOnMainThread(d.board)) {
      // the worker (E7, E8): the three calls are posted at once and answered in turn
      const [sat, rb, records] = await Promise.all([
        caller('satake', [d], hint),
        noWhiteNode(d) ? Promise.resolve(EMPTY_RESTRICTED) : caller('restrictedBoard', [d], hint),
        caller('matchCatalogue', [d], hint),
      ]);
      return { sat, rb, records };
    }
    // the main thread: each call in a task of its own, after the task that drew the decoration and the
    // lights, so that a pick or a paint is never one long task with all three (SPEC 7.6 "Main-thread work")
    await nextTask();
    const sat = await caller('satake', [d], hint);
    await nextTask();
    const rb = noWhiteNode(d) ? EMPTY_RESTRICTED : await caller('restrictedBoard', [d], hint);
    await nextTask();
    const records = await caller('matchCatalogue', [d], hint);
    return { sat, rb, records };
  } catch (e) {
    if (e instanceof NotAdmissible) return null;
    throw e;
  }
}

/** Resolves in a new task of the event loop (a macrotask), so that the browser may paint in between. */
function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The three engine functions computeNow calls (spied on in the unit test). */
export interface DataFns {
  satake: typeof satake;
  restrictedBoard: typeof restrictedBoard;
  matchCatalogue: typeof matchCatalogue;
}

const ENGINE: DataFns = { satake, restrictedBoard, matchCatalogue };

/** The same data at once (the server render, and the first render on a main-thread board); null when not admissible. */
export function computeNow(d: SatakeDiagram, adm: Admissibility, fns: DataFns = ENGINE): PairData | null {
  if (!adm.admissible) return null;
  return { sat: fns.satake(d), rb: noWhiteNode(d) ? EMPTY_RESTRICTED : fns.restrictedBoard(d), records: fns.matchCatalogue(d) };
}

// ---------------------------------------------------------------------------------------------
// The data of an instance configured on E7 or E8, written into the island (E-9, 7.6)
// ---------------------------------------------------------------------------------------------
//
// No default state may need the worker (E-9). On E7 and E8 the server render therefore writes the data of
// the configured pair into the island as JSON (<script type="application/json" data-t13-pair="...">), and
// hydration reads them back when the instance and the pair match, so the worker is asked only after the
// reader's first change. The attribute holds the instance id and the pair, so two instances on one page
// never read each other's data (instance ids are unique on a page, 6.6).

/** The value of data-t13-pair: the instance id and the pair's key. */
export function islandKey(instanceId: string, pairKey: string): string {
  return `${instanceId}|${pairKey}`;
}

/** The data as JSON safe inside a <script> element (no <, >, & or line separators left as such). */
export function pairJson(p: PairData): string {
  const rb: RestrictedLike = { orbits: p.rb.orbits, simpleRestrictedRoots2: p.rb.simpleRestrictedRoots2, cartan: p.rb.cartan, compositeWords: p.rb.compositeWords };
  return JSON.stringify({ sat: p.sat, rb, records: p.records })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** The data read back from pairJson's text; null when the text is not such data. */
export function pairFromJson(text: string): PairData | null {
  try {
    const v = JSON.parse(text) as Partial<PairData> | null;
    if (v === null || typeof v !== 'object' || typeof v.sat?.rank !== 'number' || !Array.isArray(v.rb?.orbits) || !Array.isArray(v.rb?.compositeWords) || !Array.isArray(v.records)) return null;
    return v as PairData;
  } catch {
    return null;
  }
}

/** The element the server render writes into the island (markup, through {@html}). */
export function islandScript(instanceId: string, pairKey: string, json: string): string {
  const key = islandKey(instanceId, pairKey).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<script type="application/json" data-t13-pair="${key}">${json}</script>`;
}

/** What hydration read, kept so that a second run of the component (Svelte's recovery from a mismatch) finds it too. */
const fromIslands = new Map<string, { json: string; data: PairData }>();

/** The data the server wrote into the page for this instance and pair, or null (no document, no element, not data). */
export function readIsland(instanceId: string, pairKey: string): { json: string; data: PairData } | null {
  const key = islandKey(instanceId, pairKey);
  const kept = fromIslands.get(key);
  if (kept !== undefined) return kept;
  if (typeof document === 'undefined') return null;
  for (const el of document.querySelectorAll('script[type="application/json"][data-t13-pair]')) {
    if (el.getAttribute('data-t13-pair') !== key) continue;
    const json = el.textContent ?? '';
    const data = pairFromJson(json);
    if (data === null) return null;
    const found = { json, data };
    fromIslands.set(key, found);
    return found;
  }
  return null;
}
