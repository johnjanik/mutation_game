// Types of the tool registry and of predictions (CONTRACTS.md 5.2). Owner P1-A2.
import type { ToolId, ToolState } from '../lib/state';

/** SPEC 4.0 "Predict"; exactly CONTRACTS 5.2. */
export interface Prediction {
  question: string;
  answer: { type: 'number'; value: number } | { type: 'position'; value: number[] } | { type: 'choice'; options: string[]; correct: number };
  reveal: string;
}

/**
 * A preset (SPEC 4.0 Configuration): the state fields it fixes, which the reader could have set by
 * hand, so every preset is a state object and a link, plus the caption stating the result it shows.
 */
export type PresetFields = Partial<Omit<ToolState, 'schema' | 'tool'>> & { caption: string };

/**
 * One registry entry, `site/src/tools/registry/T{nn}.ts` (plan, inferred from the example of
 * CONTRACTS 5.2). Every entry has a `default` preset: SPEC 4.0 says "`default` is the state described
 * in this section", and the tool route renders it with its caption.
 */
export interface ToolRegistryEntry {
  number: number;
  id: ToolId;
  title: string;
  phase: number;
  boards: 'all' | string[];
  presets: { default: PresetFields } & Record<string, PresetFields>;
  outs: string[];
  component: () => Promise<unknown>;
}
