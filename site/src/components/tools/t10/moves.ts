// T10, the Geometry Studio: the move graph, derived and drawn (SPEC.md 2.14 "Two graphs on the same
// vertices"; 5.4; 6.3; A-5; 7.6). Owner P4-A3. A module of its own, fetched by the browser when the move graph
// is first needed (after the reader's switch, or for a configuration that is not precomputed), so that the
// route's first scripts stay within 7.6's 90 kB; the build-time snapshot and the unit tests import it
// statically. The derivation fires every vertex at every node through the engine's `fire` (graphs.ts says
// which pairs count); the renderer draws every edge in its node's colour with its label as text.
import { CAPS, fire } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import type { TaskSteps } from './studio';
import { levelOf, levelStyles, pointPlan, selectSegments, type Context2DLike } from '../../draw/canvasScene';
import { DEFAULT_LINE_WIDTH, DEFAULT_POINT_RADIUS } from '../../draw/projector';
import { HALO, LABEL_SIZE, edgeStroke, vertexScene, type CanvasTextLike, type Picture, type PictureColours, type PictureDrawResult } from './drawing';
import type { MoveEdge } from './graphs';
import { keyOf, labelOf, vertexIndex } from './scene';

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

/**
 * The move graph in slices: `step(budget)` applies at most about `budget` moves and answers true when the
 * graph is complete (MoveGraphBuilder.step). Every slice, the first included, runs in a task of its own,
 * after the task that asked for it, with at most CAPS.mainThreadItems moves (E-9, 7.6). False when the work
 * stopped. Here rather than in studio.ts, so that the route's first scripts do not carry it (7.6: 90 kB).
 */
export async function deriveInTasks(step: (budget: number) => boolean, steps: TaskSteps): Promise<boolean> {
  for (;;) {
    await steps.nextTask();
    if (!steps.live()) return false;
    const done = step(CAPS.mainThreadItems);
    steps.mark?.('moves');
    if (done) return true;
  }
}

/** Draws the move graph: edges coloured by label, far to near, then the points, then a label on every drawn edge. */
export function drawMoves(ctx: Context2DLike & CanvasTextLike, p: Picture, colours: PictureColours, options: { turning: boolean; dpr: number }): PictureDrawResult {
  const scene = vertexScene(p);
  const labels = p.segmentLabels ?? [];
  const selection = selectSegments(scene, options.turning);
  const styles = levelStyles(scene, { lineWidth: DEFAULT_LINE_WIDTH * 1.5, pointRadius: DEFAULT_POINT_RADIUS });
  const { points, segments } = scene;
  const idx = selection.indices;
  ctx.save();
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colours.page;
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.lineCap = 'round';
  // Edges: far to near (the scene's order); the depth cue acts on the width only (alpha 1).
  for (const k of idx) {
    const s = segments[k]!;
    const a = points[s.a]!;
    const b = points[s.b]!;
    ctx.strokeStyle = edgeStroke(colours, labels[k]!);
    ctx.lineWidth = styles[levelOf(s.depth)]!.width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Points, one fill per level, far first.
  ctx.fillStyle = colours.text;
  const plan = pointPlan(scene, points.length);
  for (const run of plan.runs) {
    const st = styles[run.level]!;
    ctx.globalAlpha = st.alpha;
    ctx.beginPath();
    for (let k = run.start; k < run.end; k++) {
      const q = points[plan.order[k]!]!;
      ctx.moveTo(q.x + st.radius, q.y);
      ctx.arc(q.x, q.y, st.radius, 0, 2 * Math.PI);
    }
    ctx.fill();
  }
  // Labels on every drawn edge, last, so that no edge covers a numeral.
  ctx.globalAlpha = 1;
  ctx.font = `${LABEL_SIZE}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = HALO;
  ctx.strokeStyle = colours.page;
  ctx.fillStyle = colours.text;
  for (const k of idx) {
    const s = segments[k]!;
    const a = points[s.a]!;
    const b = points[s.b]!;
    const text = String(labels[k]!);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }
  ctx.restore();
  return {
    pointsDrawn: points.length,
    segmentsDrawn: idx.length,
    segmentsTotal: segments.length,
    verticesOnly: selection.verticesOnly,
    sampled: selection.sampled,
    labelsDrawn: idx.length,
    shortRootsDrawn: 0,
  };
}
