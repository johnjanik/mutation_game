// Shared types of the board family (CONTRACTS.md 5.1). Owner P0-A5; P1-A3 and P1-A5 extend.
import type { AnyBoard } from '@engine';

export type NodeKind = 'node' | 'city';
export type Sign = -1 | 0 | 1;
export type BoardGame = 'mutation' | 'firing';
export type RoadStyle = 'dynkin' | 'roads';

/**
 * Where the nodes sit, in grid units with y growing upwards (SPEC.md 6.1), indexed by position.
 * `kind` tells the keyboard resolver a row with branches from a polygon or a custom layout (A-1).
 * `columns` is k of the size rule of 6.1; `rows` the height of the drawing in grid units.
 */
export interface GridLayout {
  xy: readonly (readonly [number, number])[];
  columns: number;
  rows: number;
  kind: 'row' | 'polygon' | 'custom';
}

export type ArrowKey = 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/** Kept open for T13's black nodes and arrows (phase 6); Board does not read it yet. */
export type BoardDecoration = Record<string, unknown>;

/** The props of Board.svelte, exactly as CONTRACTS.md 5.1. */
export interface BoardProps {
  board: AnyBoard;
  values: (number | string)[];
  game: BoardGame;
  canAct: boolean[];
  labels?: boolean;
  roadStyle?: RoadStyle;
  decoration?: BoardDecoration;
  onAct: (position: number) => void;
  hintFor?: (position: number) => string | null;
  name: string;
}

export interface NodeProps {
  label: number;
  value: number | string;
  kind: NodeKind;
  canAct: boolean;
  stateText: string;
  x: number;
  y: number;
  unit: number;
  showLabel?: boolean;
}

export interface RoadsProps {
  board: AnyBoard;
  /** Node centres in the drawing's own coordinates (y already flipped), indexed by position. */
  xy: readonly (readonly [number, number])[];
  /** One grid unit in the drawing's coordinates. */
  unit: number;
  roadStyle?: RoadStyle;
}

export interface HistoryProps {
  /** Moves in the list (applied or not). */
  total: number;
  /** Moves applied. */
  cursor: number;
  /** One short description per position 0..total, for the strip's buttons. */
  positionNames: string[];
  hydrated: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onScrub: (cursor: number) => void;
}
