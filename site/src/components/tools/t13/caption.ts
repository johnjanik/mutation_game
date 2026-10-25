// T13: the caption of a preset, computed from the engine when the registry entry loads (SPEC.md 4.0 "Starts
// meaningful"; COMMON 4.4: no golden value typed). Owner P6-A3. Server and tests only: it computes the
// Satake data at once (computeNow), which in the browser would break E-9 on E7 and E8, so the component
// never imports this module; it calls captionText with the data it has.
import { admissibility } from '@two-games/engine';
import type { T13Preset } from './config';
import { computeNow } from './load';
import { assembleData, captionText, defaultRoot, diagramOf, fromLabelOrder } from './model';

/** The caption of a preset's state and panel, every number from the engine. */
export function captionFor(p: T13Preset): string {
  const d = diagramOf(p.board, p.black, p.tau);
  const adm = admissibility(d);
  const now = computeNow(d, adm);
  const data = now === null ? null : assembleData(now.sat, now.rb, now.records, d);
  const root = p.root === undefined ? defaultRoot(d) : fromLabelOrder(d.board, p.root);
  return captionText({ d, panel: p.panel, toggle: p.toggle, adm, data, root });
}
