// T10, the Geometry Studio: the two graphs on the vertices of an orbit (SPEC.md 2.14 "Two graphs on the
// same vertices"; 4 T10 Switch; 5.4: "The edges of a move graph are not stored by orbitGraph ... A tool
// that draws all of them applies every move to every position of items once more"; 6.3; A-5). Owner P4-A3.
//
// The polytope graph is wythoffEdges (scene.ts). The move graph joins mu to R_i mu for every node i (ringed
// or not) with mu_i != 0 (when mu_i = 0, R_i mu = mu and there is no edge): every vertex is fired at every
// node through the engine's `fire`, and the pairs are deduplicated as sorted index pairs. A pair belongs
// to exactly one node, since R_i mu - mu is a multiple of alpha_i; the edge carries that node's label, its
// colour (palette of eight, by label) and the label as text.
import { CAPS, fire } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import { edgeColour } from '../../draw/palette';
import { keyOf, labelOf, vertexIndex } from './scene';

/** A move-graph edge: vertex indices i < j and the label of the node fired. */
export type MoveEdge = [number, number, number];

/**
 * The move graph built in slices (E-9 and 7.6: the derivation applies at most n |V| moves; each call of
 * step() applies at most `budget` of them, so that a caller can spread a large derivation over tasks).
 */
export class MoveGraphBuilder {
  readonly edges: MoveEdge[] = [];
  private next = 0;
  private readonly index: Map<string, number>;
  private readonly seen = new Set<string>();

  constructor(
    private readonly board: Board<number>,
    private readonly vertices: readonly (readonly number[])[],
  ) {
    this.index = vertexIndex(vertices);
  }

  /** The vertices done so far. */
  get progress(): number {
    return this.next;
  }

  get done(): boolean {
    return this.next >= this.vertices.length;
  }

  /** Fires every node at the next vertices until about `budget` moves are applied; true when the graph is complete. */
  step(budget = Infinity): boolean {
    const { board, vertices, index, seen, edges } = this;
    let moves = 0;
    while (this.next < vertices.length && moves < budget) {
      const i = this.next++;
      const mu = vertices[i]!;
      for (let k = 0; k < board.n; k++) {
        if (mu[k] === 0) continue; // R_k mu = mu: no edge
        moves++;
        const j = index.get(keyOf(fire(board, mu, k)));
        if (j === undefined) throw new Error(`firing node ${labelOf(board, k)} leaves the orbit: the vertex list is incomplete`);
        const a = Math.min(i, j);
        const b = Math.max(i, j);
        const key = `${a},${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([a, b, labelOf(board, k)]);
      }
    }
    return this.done;
  }
}

/** The move graph of a vertex list, in one call (build time, unit tests, and graphs of at most 2000 moves). */
export function moveEdges(board: Board<number>, vertices: readonly (readonly number[])[]): MoveEdge[] {
  const b = new MoveGraphBuilder(board, vertices);
  b.step();
  return b.edges;
}

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
