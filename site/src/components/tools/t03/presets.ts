// The presets of T3 (CONTRACTS.md 6: meter, builder, small-values; SPEC.md 4.0 Configuration: "A preset
// fixes only things the reader could have set by hand, so every preset is also a state object and a
// link"). Each is a ToolState of the tool plus the part it brings to the front, which is an option
// outside the schema-1 link (6.6 lists "the weights typed into T3" among such options; plan). No engine
// import: the registry entry reads this module and is loaded on every tool page.
import type { ToolState } from '../../../lib/state';

export type Part = 'meter' | 'builder' | 'small-values';
export type FormPresetId = 'default' | Part;

/** The order of the parts when `front` comes first (plan: all three are always rendered and open). */
export const PART_ORDER: readonly Part[] = ['meter', 'builder', 'small-values'];

/** The parts in the order shown: `front` first, the others in PART_ORDER. */
export function partsInOrder(front: Part): Part[] {
  return [front, ...PART_ORDER.filter((p) => p !== front)];
}

export interface FormPreset {
  state: ToolState;
  front: Part;
  caption: string;
}

const a3: ToolState = { schema: 1, tool: 'form', board: 'A3', coords: 'populations', start: [1, 0, 0], moves: [] };

export const FORM_PRESETS: Readonly<Record<FormPresetId, FormPreset>> = {
  default: {
    state: a3,
    front: 'meter',
    caption:
      'One Martian in city 1 of A3. Mutate any city: the meter, the form value of the population, does not move. Below, the builder tests a form of your own and small values judges populations you type.',
  },
  meter: {
    state: a3,
    front: 'meter',
    caption: 'One Martian in city 1 of A3. However the cities mutate, the form value on the meter stays where it is.',
  },
  builder: {
    state: { schema: 1, tool: 'form', board: 'A2', coords: 'populations', start: [1, 0], moves: [] },
    front: 'builder',
    caption: 'On A2 the test passes exactly when the two city weights and the road weight are equal.',
  },
  'small-values': {
    state: a3,
    front: 'small-values',
    caption: 'Type a population of A3: the tool gives its form value and says whether it is a root population.',
  },
};

export function isPresetId(id: string | undefined): id is FormPresetId {
  return id !== undefined && Object.prototype.hasOwnProperty.call(FORM_PRESETS, id);
}
