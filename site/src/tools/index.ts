// The tool registry collector (CONTRACTS.md 5.2). A tool appears by adding its registry file
// `site/src/tools/registry/T{nn}.ts`; nobody edits this file or the tool pages for that. The
// metadata is collected eagerly (it is small); each entry's `component` stays a lazy import.
import type { ToolId } from '../lib/state';
import { TOOL_IDS } from '../lib/state';
import type { ToolRegistryEntry } from './types';

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

const modules = import.meta.glob<{ default: ToolRegistryEntry }>('./registry/T*.ts', { eager: true });

/** Every registered tool, sorted by number. */
export const registry: readonly ToolRegistryEntry[] = collectRegistry(Object.values(modules).map((m) => m.default));

export function toolById(id: ToolId | string, entries: readonly ToolRegistryEntry[] = registry): ToolRegistryEntry | undefined {
  return entries.find((e) => e.id === id);
}

/**
 * The boards a tool offers (SPEC section 4; 6.6 rule 8). A tool with no registry entry offers 'all'
 * (plan: the codec stays usable before a tool is registered).
 */
export function boardsOffered(id: ToolId | string, entries: readonly ToolRegistryEntry[] = registry): 'all' | string[] {
  return toolById(id, entries)?.boards ?? 'all';
}

export interface ToolRoute {
  params: { tool: ToolId };
  props: { entry: ToolRegistryEntry; caption: string };
}

/** What `getStaticPaths` of pages/tools/[tool].astro returns: one route per registered tool. */
export function toolRoutes(entries: readonly ToolRegistryEntry[] = registry): ToolRoute[] {
  return entries.map((entry) => ({ params: { tool: entry.id }, props: { entry, caption: entry.presets.default.caption } }));
}
