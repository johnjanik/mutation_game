// Per-board cache of T8 (SPEC.md 7.6 "No engine call on the main thread may become a long task"):
// the graph, its layout, the game count and the path count are computed once per board and kept, so
// a hover, a focus or a move never runs the search again.
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
    v = { model, layout: layoutGraph(model), games: gameCount(model),paths: countPaths(model) };
    views.set(name, v);
  }
  return v;
}
