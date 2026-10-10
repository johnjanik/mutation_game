// T4's tool presets (P2-A3; CONTRACTS 6: default, verdict, hunter; SPEC 3 M3 beats 1, 2 and 6; 4.0
// Configuration). No imports: the registry entry (loaded on every tool page through the codec) reads
// this module, so it must stay tiny. Each preset's board is a state field and a link; the panel order
// and the hunter switch are view options outside schema 1 (6.6), carried as properties.

export type LabPresetId = 'default' | 'verdict' | 'hunter';

/**
 * The one-way road of SPEC 2.11, built from its definition: one road from city 1 to city 2 and none
 * back, so A = [[0, 1], [0, 0]] and C = 2I - A^T (SPEC 2.1); two nodes side by side.
 */
export function oneWayRoad(): { cartan: number[][]; xy: [number, number][] } {
  const A = [
    [0, 1],
    [0, 0],
  ];
  const cartan = A.map((row, i) => row.map((_, j) => (i === j ? 2 : A[j]![i]! === 0 ? 0 : -A[j]![i]!)));
  return { cartan, xy: [[0, 0], [1, 0]] };
}

export interface LabPreset {
  board: string | { cartan: number[][]; xy?: [number, number][] };
  /** The verdict panel comes before the editor in reading order (M3 beat 2). */
  verdictFirst: boolean;
  /** The conjecture hunter is switched on (M3 beat 6). */
  hunter: boolean;
  caption: string;
}

export const LAB_PRESETS: Record<LabPresetId, LabPreset> = {
  default: {
    board: 'A3',
    verdictFirst: false,
    hunter: false,
    caption:
      'The path A3 in the editor: the lab calls it finite and names it, matches its nodes to the Bourbaki labels, finds it balanced, and counts all its root populations layer by layer. Change a road and the verdict follows.',
  },
  verdict: {
    board: 'A3',
    verdictFirst: true,
    hunter: false,
    caption:
      'The verdict panel for the path A3: class, name, balance, weights and the spectral radius of the board. Load the triangle, the stars or your own board and compare.',
  },
  hunter: {
    board: oneWayRoad(),
    verdictFirst: false,
    hunter: true,
    caption:
      'One road from city 1 to city 2 and none back: the theory does not apply, and the hunter finds a root population with both signs a few moves from a single Martian.',
  },
};

export function isLabPreset(id: string | undefined): id is LabPresetId {
  return id === 'default' || id === 'verdict' || id === 'hunter';
}
