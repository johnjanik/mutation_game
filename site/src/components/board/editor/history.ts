// Undo, redo and reset of edits (P2-A3; SPEC 9.2 "undo, reset", 4.0 History read for a tool with no
// move list; plan semantics). The history holds board specs, never positions. `load` starts a new
// history at a loaded board (a preset, a link, the back button); `push` records an edit and discards
// any redo; `undo` steps back one edit; `redo` forward; `reset` returns to the loaded board and
// empties the history.
import type { BoardSpec } from '../../../lib/state';

function clone(spec: BoardSpec): BoardSpec {
  return typeof spec === 'string' ? spec : (JSON.parse(JSON.stringify(spec)) as BoardSpec);
}

export class EditHistory {
  private entries: BoardSpec[];
  private cursor = 0;

  constructor(loaded: BoardSpec) {
    this.entries = [clone(loaded)];
  }

  /** The board shown now. */
  get current(): BoardSpec {
    return clone(this.entries[this.cursor]!);
  }

  /** The board that was loaded, which reset restores. */
  get loaded(): BoardSpec {
    return clone(this.entries[0]!);
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.entries.length - 1;
  }

  /** The number of edits applied since the board was loaded. */
  get edits(): number {
    return this.cursor;
  }

  load(spec: BoardSpec): void {
    this.entries = [clone(spec)];
    this.cursor = 0;
  }

  push(spec: BoardSpec): void {
    this.entries = this.entries.slice(0, this.cursor + 1);
    this.entries.push(clone(spec));
    this.cursor = this.entries.length - 1;
  }

  undo(): BoardSpec | null {
    if (!this.canUndo) return null;
    this.cursor -= 1;
    return this.current;
  }

  redo(): BoardSpec | null {
    if (!this.canRedo) return null;
    this.cursor += 1;
    return this.current;
  }

  /** Back to the loaded board; null when nothing was edited. */
  reset(): BoardSpec | null {
    if (this.entries.length === 1 && this.cursor === 0) return null;
    this.entries = [this.entries[0]!];
    this.cursor = 0;
    return this.current;
  }
}
