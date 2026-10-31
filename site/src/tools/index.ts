// The tool registry collector (CONTRACTS.md 5.2). A tool appears by adding its registry file
// `site/src/tools/registry/T{nn}.ts` (and its boards to offered.ts, which registry-offered.test.ts
// demands); nobody edits this file or the tool pages for that. Each entry's `component` stays a lazy
// import.
//
// The browser loads this module on every page with a tool, because the URL codec reads boardsOffered
// (6.6 rule 8). The registry entries import their tools' presets, several of which compute captions
// with the engine when loaded, so the entries are loaded only on the server (the pages at build time,
// and the tests), never in the browser; there boardsOffered reads the small table of offered.ts
// (RT-FIX P3-RT-07-04).
import type { ToolId } from '../lib/state';
import { TOOL_IDS } from '../lib/state';
import type { ToolRegistryEntry } from './types';
import { BOARDS_OFFERED } from './offered';

export type { ToolRegistryEntry, Prediction, PresetFields } from './types';

/**
 * Checks and orders registry entries: sorted by number; a duplicate id or number, an id that is not a
 * ToolId, or an entry without a `default` preset with a caption throws (at build time).
 */
export function collectRegistry(entries: readonly ToolRegistryEntry[]): ToolRegistryEntry[] {
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const e of entries) {
    if (!TOOL_IDS.includes(e.id)) throw new Error(`registry: ${String(e.id)} is not a tool id of SPEC section 4`);
    if (ids.has(e.id)) throw new Error(`registry: duplicate tool id ${e.id}`);
    if (numbers.has(e.number)) throw new Error(`registry: duplicate tool number ${e.number}`);
    const preset = e.presets?.default;
    if (!preset || typeof preset.caption !== 'string' || preset.caption === '') {
      throw new Error(`registry: tool ${e.id} has no default preset with a caption`);
    }
    ids.add(e.id);
    numbers.add(e.number);
  }
  return [...entries].sort((a, b) => a.number - b.number);
}

/** Loads and checks every registry file (server only: see the head of this file). */
async function loadRegistry(): Promise<ToolRegistryEntry[]> {
  const modules = import.meta.glob<{ default: ToolRegistryEntry }>('./registry/T*.ts');
  const loaded = await Promise.all(Object.values(modules).map((load) => load()));
  return collectRegistry(loaded.map((m) => m.default));
}

/** Every registered tool, sorted by number; empty in the browser, which never loads the entries. */
export const registry: readonly ToolRegistryEntry[] = import.meta.env.SSR ? await loadRegistry() : [];

export function toolById(id: ToolId | string, entries: readonly ToolRegistryEntry[] = registry): ToolRegistryEntry | undefined {
  return entries.find((e) => e.id === id);
}

/**
 * The boards a tool offers (SPEC section 4; 6.6 rule 8): from `entries` when given, otherwise from the
 * table of offered.ts, which equals the registry. A tool with no registry entry offers 'all' (plan: the
 * codec stays usable before a tool is registered).
 */
export function boardsOffered(id: ToolId | string, entries?: readonly ToolRegistryEntry[]): 'all' | string[] {
  if (entries !== undefined) return toolById(id, entries)?.boards ?? 'all';
  const offered = BOARDS_OFFERED[id as ToolId];
  return offered === undefined || offered === 'all' ? 'all' : [...offered];
}

export interface ToolRoute {
  params: { tool: ToolId };
  props: { entry: ToolRegistryEntry; caption: string };
}

/** What `getStaticPaths` of pages/tools/[tool].astro returns: one route per registered tool. */
export function toolRoutes(entries: readonly ToolRegistryEntry[] = registry): ToolRoute[] {
  return entries.map((entry) => ({ params: { tool: entry.id }, props: { entry, caption: entry.presets.default.caption } }));
}
