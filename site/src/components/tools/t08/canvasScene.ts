// The scene of T8 drawn on a Canvas 2D context (SPEC.md 7.1 "Canvas 2D for projections with many
// edges"; 7.4: above 192 elements, after hydration). The same Scene as svgScene.ts, drawn in one pass:
// edges (coloured by node from the resolved tokens, with the node label as text, A-5), then the dots,
// the path markers and the focus mark. Runs only in the browser, from an effect; nothing here is
// called during the server render.
import { DOT_R, PATH_R, RING_R } from './svgScene';
import type { Scene } from './layout';

export interface CanvasColours {
  text: string;
  page: string;
  focus: string;
  /** edge[k - 1] is the colour of token --edge-k. */
  edge: string[];
}

/** Reads the colour tokens from an element's computed style (6.3; never a hex value in the code). */
export function readColours(el: Element): CanvasColours {
  const cs = getComputedStyle(el);
  const v = (name: string): string => cs.getPropertyValue(name).trim();
  const edge: string[] = [];
  for (let k = 1; k <= 8; k++) edge.push(v(`--edge-${k}`));
  return { text: v('--text'), page: v('--page'), focus: v('--focus-ring'), edge };
}

let spriteCache: { key: string; canvas: HTMLCanvasElement } | null = null;

/** A dot of radius DOT_R in the given colour, at the given scale, on a small canvas (cached). */
function dotSprite(ctx: CanvasRenderingContext2D, colour: string, scale: number): HTMLCanvasElement | null {
  const key = `${colour}@${scale}`;
  if (spriteCache?.key === key) return spriteCache.canvas;
  const doc = ctx.canvas.ownerDocument;
  if (!doc) return null;
  const side = Math.ceil((2 * DOT_R + 2) * scale);
  const c = doc.createElement('canvas');
  c.width = side;
  c.height = side;
  const g = c.getContext('2d');
  if (g === null) return null;
  g.fillStyle = colour;
  g.beginPath();
  g.arc(side / 2, side / 2, DOT_R * scale, 0, 2 * Math.PI);
  g.fill();
  spriteCache = { key, canvas: c };
  return c;
}

/** Draws the scene; `scale` is the device pixel ratio the canvas was sized with. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, colours: CanvasColours, scale: number): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.lineCap = 'round';
  for (const e of scene.edges) {
    ctx.strokeStyle = colours.edge[e.token - 1] ?? colours.text;
    ctx.lineWidth = e.onPath ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(e.x1, e.y1);
    ctx.lineTo(e.x2, e.y2);
    ctx.stroke();
  }
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  for (const e of scene.edges) {
    ctx.strokeStyle = colours.page;
    ctx.strokeText(String(e.label), e.lx, e.ly);
    ctx.fillStyle = colours.text;
    ctx.fillText(String(e.label), e.lx, e.ly);
  }
  ctx.fillStyle = colours.text;
  // One dot is drawn once and stamped (drawImage is far cheaper than a thousand arcs in one path).
  const sprite = dotSprite(ctx, colours.text, scale);
  for (const d of scene.dots) {
    if (d.onPath) continue;
    if (sprite === null) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, DOT_R, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.drawImage(sprite, d.x - DOT_R - 1, d.y - DOT_R - 1, 2 * DOT_R + 2, 2 * DOT_R + 2);
    }
  }
  ctx.strokeStyle = colours.text;
  ctx.lineWidth = 2;
  for (const d of scene.dots) {
    if (!d.onPath) continue;
    ctx.beginPath();
    ctx.arc(d.x, d.y, PATH_R, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(d.x, d.y, RING_R, 0, 2 * Math.PI);
    ctx.stroke();
  }
  for (const d of scene.dots) {
    if (!d.focus) continue;
    ctx.strokeStyle = colours.focus;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(d.x - scene.hit / 2, d.y - scene.hit / 2, scene.hit, scene.hit);
    ctx.setLineDash([]);
  }
}
