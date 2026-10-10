// The per-page highlight store (SPEC.md 7.4 "Tools on one page"; CONTRACTS.md 4). One small Nano
// Store holds the node, root or position the reader is pointing at, so that every board and
// projection of the page that shows it can highlight it. Components read it as `$highlight`
// (SPEC.md 7.2 item 5). It belongs to the shell of 7.6, so it imports nothing but `atom`.
import { atom } from 'nanostores';

/** What is highlighted: nodes in `value` are labels (E-7); `board` names the board it belongs to. */
export interface Highlight {
  kind: 'node' | 'root' | 'position';
  board: string;
  value: number | number[];
}

export const highlight = atom<Highlight | null>(null);
