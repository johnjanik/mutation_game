// The drawing of a named board for the Atlas pages and the Atlas picker (SPEC.md 6.1 node positions, 6.2
// road style `dynkin`, A-10 text alternative). Owner P6-A4. The site's one drawing code does the work:
// nodePositions (draw/layouts.ts) places the nodes by the table of 6.1, toPixels (draw/geometry.ts) maps
// them to pixels at a fixed grid unit, and roadGlyphs and roadElements (draw/roads.ts) draw the roads from
// the engine's adjacency. No node buttons and no values: a drawing of the board, nothing to act on. The
// text alternative names every road with its counts in each direction (2.1: "two roads from n-1 to n and
// one back"), from the engine's adjacency. Pure; the same output in Node and in the browser.
import { adjacency, boardFromName } from '@two-games/engine';
import { toPixels } from '../draw/geometry';
import { nodePositions } from '../draw/layouts';
import { roadElements, roadGlyphs, type RoadElement } from '../draw/roads';

export interface DiagramNode {
  label: number;
  x: number;
  y: number;
}

export interface BoardDiagram {
  name: string;
  width: number;
  height: number;
  /** The grid unit in pixels. */
  unit: number;
  nodes: DiagramNode[];
  roads: RoadElement[];
}

/** The drawing of the named board with a grid unit of `unit` pixels (at most 64, the rule of 6.1). */
export function boardDiagram(name: string, unit: number): BoardDiagram {
  const board = boardFromName(name);
  const layout = nodePositions(board);
  // toPixels takes the unit min(64, floor((W - 16) / columns)); this W gives exactly `unit`.
  const px = toPixels(layout, layout.columns * unit + 16);
  const u = px.unit ?? unit;
  return {
    name,
    width: px.width,
    height: px.height,
    unit: u,
    nodes: board.labels.map((label, k) => ({ label, x: px.centres[k]![0], y: px.centres[k]![1] })),
    roads: roadElements(roadGlyphs(board, 'dynkin'), px.centres, u),
  };
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four'];
const roadsWord = (k: number): string => `${k < COUNT_WORDS.length ? COUNT_WORDS[k] : String(k)} ${k === 1 ? 'road' : 'roads'}`;

/**
 * The text alternative of the drawing (A-10): the board, its nodes, and every pair of joined nodes with
 * the roads each way, in increasing order of labels. For example "The board B3, with nodes 1 to 3. One
 * road each way between nodes 1 and 2. Two roads from node 2 to node 3 and one back."
 */
export function describeBoard(name: string): string {
  const board = boardFromName(name);
  const A = adjacency(board);
  const order = board.labels.map((label, position) => ({ label, position })).sort((a, b) => a.label - b.label);
  const first = order[0]!.label;
  const last = order[order.length - 1]!.label;
  const sentences = [`The board ${name}, with ${order.length === 1 ? `one node, node ${first}` : `nodes ${first} to ${last}`}.`];
  for (let a = 0; a < order.length; a++) {
    for (let b = a + 1; b < order.length; b++) {
      const i = order[a]!;
      const j = order[b]!;
      const there = A[i.position]![j.position]!;
      const back = A[j.position]![i.position]!;
      if (there === 0 && back === 0) continue;
      const s =
        there === back
          ? `${roadsWord(there)} each way between nodes ${i.label} and ${j.label}.`
          : there > back
            ? `${roadsWord(there)} from node ${i.label} to node ${j.label} and ${COUNT_WORDS[back] ?? String(back)} back.`
            : `${roadsWord(back)} from node ${j.label} to node ${i.label} and ${COUNT_WORDS[there] ?? String(there)} back.`;
      sentences.push(s.charAt(0).toUpperCase() + s.slice(1));
    }
  }
  return sentences.join(' ');
}
