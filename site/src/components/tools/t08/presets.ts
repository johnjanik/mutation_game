// The presets of T8 (SPEC.md 4.0 Configuration; CONTRACTS.md 6: default, counter, heap; SPEC 3 M5 rows
// 1 to 4). Each preset is a state object (the link part: board, coords, start, moves) plus options that
// a schema-1 link never carries (the panel in front, the boards of the picker, the plays offered as
// buttons) and a caption. Numbers in captions are computed by the engine when the module loads, on A3
// only, so that the registry stays cheap on every page (COMMON 4.4: never typed).
import { boardFromName, commutationClassSize, countCompleteGames, legalLayers, toPositions, weylOrder } from '@two-games/engine';
import type { Board } from '@two-games/engine';
import type { ToolState } from '../../../lib/state';

export type WeylPanel = 'graph' | 'counter' | 'heap';
export const PANELS: readonly WeylPanel[] = ['graph', 'counter', 'heap'];

export interface WeylOptions {
  /** The panel shown first (the others follow; none is hidden). */
  panel: WeylPanel;
  /** Limits the picker (M5 row 3); undefined: every board T8 offers. */
  boardChoices?: string[];
  /** Plays offered as buttons that load them (M5 row 4), each a list of labels. */
  plays?: number[][];
}

export type WeylPresetId = 'default' | 'counter' | 'heap';

export interface WeylPreset {
  state: ToolState;
  options: WeylOptions;
  caption: string;
}

/** The state of T8 on a board with a list of moves: numbers from all ones, legal play (plan, 5.2). */
export function weylState(board: string, n: number, moves: number[] = []): ToolState {
  return {
    schema: 1,
    tool: 'weyl',
    board,
    view: 'numbers',
    mode: 'legal',
    coords: 'numbers',
    start: Array.from({ length: n }, () => 1),
    moves,
  };
}

const A3 = boardFromName('A3') as Board<number>;
const A3_ORDER = weylOrder(A3);
const A3_LAYERS = legalLayers(A3)?.length ?? 0;
const A3_GAMES = countCompleteGames(A3);
const HEAP_PLAYS: number[][] = [
  [1, 3, 2],
  [3, 1, 2],
];
const HEAP_COUNT = commutationClassSize(A3, toPositions(A3, HEAP_PLAYS[0]!));

export const PRESETS: Record<WeylPresetId, WeylPreset> = {
  default: {
    state: weylState('A3', 3),
    options: { panel: 'graph' },
    caption: `From all ones on A3, legal play reaches ${A3_ORDER} positions in ${A3_LAYERS} layers, one for each element of the group; every complete game is a path from top to bottom.`,
  },
  counter: {
    state: weylState('A3', 3),
    options: { panel: 'counter', boardChoices: ['A2', 'A3', 'B3', 'D4'] },
    caption: `The counter gives the number of complete games from all ones, which is the number of paths from top to bottom: ${String(A3_GAMES)} on A3. Pick another board to compare.`,
  },
  heap: {
    state: weylState('A3', 3, [...HEAP_PLAYS[0]!]),
    options: { panel: 'heap', plays: HEAP_PLAYS.map((p) => [...p]) },
    caption: `The plays 1, 3, 2 and 3, 1, 2 differ by exchanging two moves at unjoined nodes, and they make the same stack of bricks: ${String(HEAP_COUNT)} plays have this stack.`,
  },
};

/** The preset of an id; an unknown id is an authoring error. */
export function presetOf(id: string | undefined): WeylPreset {
  const key = (id ?? 'default') as WeylPresetId;
  const p = PRESETS[key];
  if (p === undefined) throw new Error(`T8: unknown preset ${String(id)} (presets: ${Object.keys(PRESETS).join(', ')})`);
  return p;
}

/** The picker's groups by letter (4.0 Board pickers; T8 lists its own boards), limited by boardChoices. */
export function pickerGroups(offered: readonly string[], choices?: readonly string[]): { letter: string; names: string[] }[] {
  const names = choices === undefined ? [...offered] : offered.filter((n) => choices.includes(n));
  const groups: { letter: string; names: string[] }[] = [];
  for (const name of names) {
    const letter = name.charAt(0);
    let g = groups.find((x) => x.letter === letter);
    if (g === undefined) {
      g = { letter, names: [] };
      groups.push(g);
    }
    g.names.push(name);
  }
  return groups;
}
