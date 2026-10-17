// Per-board cache of T8 (SPEC.md 7.6 "No engine call on the main thread may become a long task"):
// the graph, its layout, the game count and the path count are computed once per board and kept, so
// a hover, a focus or a move never runs the search again. `prepareBoard` computes the same in four
// tasks (the board and its verdict, the graph, the layout, the counts), each well under 50 ms on F4, so
// that picking a board never makes one long task; `boardView` computes it at once (build time, tests,
// and a board already prepared).
import { resolveBoard } from '../../../lib/state';
import { buildGraph, countPaths, gameCount, type WeylModel } from './graph';
import { layoutGraph, type GraphLayout } from './layout';

export interface BoardView {
  model: WeylModel;
  layout: GraphLayout;
  /** countCompleteGames (null above CAPS.countGamesGroup). */
  games: bigint | null;
  /** Paths from top to bottom over the tool's own edges (null when the search was cut). */
  paths: bigint | null;
}

const views = new Map<string, BoardView>();

export function boardView(name: string): BoardView {
  let v = views.get(name);
  if (v === undefined) {
    const model = buildGraph(resolveBoard(name), undefined, name);
    v = { model, layout: layoutGraph(model), games: gameCount(model), paths: countPaths(model) };
    views.set(name, v);
  }
  return v;
}

export function isPrepared(name: string): boolean {
  return views.has(name);
}

const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** boardView in several tasks (browser); resolves when the board is cached. */
export async function prepareBoard(name: string): Promise<BoardView> {
  const known = views.get(name);
  if (known !== undefined) return known;
  const board = resolveBoard(name);
  await nextTask();
  const model = buildGraph(board, undefined, name);
  await nextTask();
  const layout = layoutGraph(model);
  await nextTask();
  const v: BoardView = { model, layout, games: gameCount(model), paths: countPaths(model) };
  await nextTask();
  const again = views.get(name);
  if (again !== undefined) return again;
  views.set(name, v);
  return v;
}
