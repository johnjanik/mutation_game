// T10, the Geometry Studio: the two graphs on the vertices of an orbit (SPEC.md 2.14 "Two graphs on the
// same vertices"; 4 T10 Switch; 5.4: "The edges of a move graph are not stored by orbitGraph ... A tool
// that draws all of them applies every move to every position of items once more"; 6.3; A-5). Owner P4-A3.
//
// The polytope graph is wythoffEdges (scene.ts). The move graph joins mu to R_i mu for every node i (ringed
// or not) with mu_i != 0 (when mu_i = 0, R_i mu = mu and there is no edge): every vertex is fired at every
// node through the engine's `fire`, and the pairs are deduplicated as sorted index pairs. A pair belongs
// to exactly one node, since R_i mu - mu is a multiple of alpha_i; the edge carries that node's label, its
// colour (palette of eight, by label) and the label as text.
import { CAPS } from '@two-games/engine';
import { edgeColour } from '../../draw/palette';

/** A move-graph edge: vertex indices i < j and the label of the node fired. */
export type MoveEdge = [number, number, number];

/** The bound n |V| / 2 on the number of move edges, known before the derivation (plan, 5.6). */
export function moveEdgeBound(n: number, vertices: number): number {
  return Math.floor((n * vertices) / 2);
}

/** True when the derivation fits one main-thread task: at most CAPS.mainThreadItems moves (E-9, plan). */
export function moveGraphFitsOneTask(n: number, vertices: number): boolean {
  return n * vertices <= CAPS.mainThreadItems;
}

/** The number of pairs that are edges of both graphs. */
export function sharedEdgeCount(polytope: readonly (readonly [number, number])[], moves: readonly MoveEdge[]): number {
  const keys = new Set(polytope.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`));
  let shared = 0;
  for (const [a, b] of moves) if (keys.has(`${a},${b}`)) shared++;
  return shared;
}

/** The colour token of a move edge, by the label of its node (6.3; palette.ts edgeColour). */
export function moveEdgeColour(label: number): string {
  return edgeColour(label);
}

/** The custom property behind moveEdgeColour (for getComputedStyle on the canvas): '--edge-k'. */
export function moveEdgeToken(label: number): string {
  return edgeColour(label).replace(/^var\((--edge-\d+)\)$/, '$1');
}

/** The labels that occur on a move graph, increasing (the legend lists colour and label for each). */
export function labelsOf(edges: readonly MoveEdge[]): number[] {
  return [...new Set(edges.map((e) => e[2]))].sort((a, b) => a - b);
}
