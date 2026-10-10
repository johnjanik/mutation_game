// The stated limits of a growing search (SPEC.md 4.0 "Stated limits" and "Growth off the finite types
// has two bounds"; 5.5 "Order and truncation of a search"; 5.6). Pure; shared with T4 (P2-A3), which
// reports the same two bounds in the same words. The words "not of finite type" never appear here:
// only `classify` may say that (4.0), and a cap is no evidence of it.
import type { OrbitGraph } from '@two-games/engine';

/**
 * The message for a bounded search, exactly as SPEC 5.5 words it, or null when no bound acted:
 * - "stopped after N positions; layers 0 to L are complete" when the cap cut the search (`truncated`;
 *   N is the number of items, which is then exactly `cap`; L is the engine's `completeLayers`);
 * - "stopped after L layers" when the search was not cut, every position of depth `maxDepth` was left
 *   unexpanded (`depthReached` equals `maxDepth`) and `maxDepth` is the layers bound;
 * - null when the search completed (`depthReached` below `maxDepth`, or no `maxDepth`), and also when
 *   the reader paused below the layers bound in `explore` (no bound acted then).
 * `cap` is the cap the search was called with; a truncated graph whose size differs from it is a
 * programming error (RangeError).
 */
export function stopMessage(graph: OrbitGraph<unknown>, maxDepth: number | undefined, layersBound: number | undefined, cap: number): string | null {
  if (graph.truncated) {
    if (graph.items.length !== cap) throw new RangeError(`a truncated search holds ${graph.items.length} items, not the cap ${cap}`);
    return `stopped after ${graph.items.length} positions; layers 0 to ${graph.completeLayers} are complete`;
  }
  if (maxDepth === undefined || layersBound === undefined) return null;
  if (maxDepth !== layersBound || graph.depthReached !== maxDepth) return null;
  return `stopped after ${layersBound} layers`;
}

/**
 * The message of `follow` at the bound: the words of 5.6 and SPEC 4 T2 without the layers clause,
 * since `follow` does not grow by layers (plan). Null below the cap.
 */
export function followStopMessage(found: number, cap: number): string | null {
  return found >= cap ? `stopped after ${cap} positions` : null;
}

/** What the tool shows instead of a message while the reader grows layer by layer (plan). */
export function layersGrownText(layers: number): string {
  return layers === 1 ? '1 layer grown' : `${layers} layers grown`;
}
