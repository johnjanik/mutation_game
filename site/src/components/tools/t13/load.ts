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

/** The same data at once (the server render, and the first render on a main-thread board); null when not admissible. */
export function computeNow(d: SatakeDiagram, adm: Admissibility): PairData | null {
  if (!adm.admissible) return null;
  return { sat: satake(d), rb: noWhiteNode(d) ? EMPTY_RESTRICTED : restrictedBoard(d), records: matchCatalogue(d) };
}
