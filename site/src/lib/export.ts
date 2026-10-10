// Data export from any tool (SPEC.md 6.6 "Data export", 4.0 "Share and export"; CONTRACTS.md 4).
// JSON with the state, the engine version, the site's git commit and the derived tables shown on
// screen, every integer as a JSON number when safe and as decimal text otherwise. SVG and PNG export
// arrive in phase 2 (P2-A6) and LaTeX in phase 6 (P6-A5); they extend this file.
// ToolFrame imports this module with a dynamic import() on the first click of "Download data".
import { version as engineVersion } from '../../../packages/engine/package.json';
import { cloneState, type ToolId, type ToolState } from './state';

/** The site's git commit, set at build time (PUBLIC_GIT_COMMIT); "unknown" when the build did not set it. */
export const GIT_COMMIT: string = (import.meta.env.PUBLIC_GIT_COMMIT as string | undefined) || 'unknown';

export const ENGINE_VERSION: string = engineVersion;

function isRational(x: object): x is { num: bigint; den: bigint } {
  const o = x as Record<string, unknown>;
  return Object.keys(o).length === 2 && typeof o.num === 'bigint' && typeof o.den === 'bigint';
}

/** The integer rule of 6.6 applied through a value: bigint and unsafe integers to decimal text. */
function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isSafeInteger(n) && BigInt(n) === value ? n : value.toString();
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) return BigInt(value).toString();
    return Object.is(value, -0) ? 0 : value; // floats (geometry) stay numbers
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Map) return [...value.entries()].map(([k, v]) => [jsonSafe(k), jsonSafe(v)]);
  if (isRational(value)) return value.den === 1n ? value.num.toString() : `${value.num}/${value.den}`;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = jsonSafe(v);
  return out;
}

/**
 * The JSON of "Download data", pretty-printed with two spaces:
 * { schema: 1, tool, state, engineVersion, commit, derived }.
 */
export function exportJSON(state: ToolState, derived: Record<string, unknown>): string {
  const doc = {
    schema: 1,
    tool: state.tool,
    state: jsonSafe(cloneState(state)),
    engineVersion: ENGINE_VERSION,
    commit: GIT_COMMIT,
    derived: jsonSafe(derived),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** What "Download data" saves: `<toolId>-<instanceId or toolId>.json` holding exportJSON (plan). */
export function downloadData(
  toolId: ToolId,
  instanceId: string,
  state: ToolState,
  derived: Record<string, unknown>,
): { filename: string; text: string } {
  return { filename: `${toolId}-${instanceId || toolId}.json`, text: exportJSON(state, derived) };
}
