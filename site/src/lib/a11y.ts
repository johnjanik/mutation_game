// Names and announcements of the boards (SPEC.md 7.5 A-3 and A-4; CONTRACTS.md 4 and 5.3).
// Owner P0-A5; P1-A2 extends. Pure string templates plus one small timer-driven announcer;
// nothing here imports the engine, and nothing runs at module load.

/** A value as a tool holds it: a safe integer, a bigint, or decimal text (also "p/q"). */
export type Speakable = number | string | bigint;

export type NodeKind = 'node' | 'city';

export type NodeState =
  | 'can be fired'
  | 'cannot be fired'
  | 'mutation would raise it'
  | 'mutation would lower it'
  | 'mutation would change nothing';

/**
 * A value read aloud: negative numbers are spoken as "minus" (A-4), so -2 reads "minus 2".
 * Accepts number, bigint and decimal text (an ASCII hyphen or a true minus U+2212 as the sign).
 */
export function speak(n: Speakable): string {
  let text: string;
  if (typeof n === 'number') {
    if (!Number.isFinite(n)) throw new RangeError(`cannot speak ${String(n)}`);
    text = Object.is(n, -0) ? '0' : String(n);
  } else if (typeof n === 'bigint') {
    text = n.toString();
  } else {
    text = n.trim().replace(/^−/, '-').replace(/^\+/, '');
  }
  if (text.startsWith('-')) {
    const rest = text.slice(1);
    return /^0+(\/\d+)?$/.test(rest) ? rest.replace(/^0+/, '0') : `minus ${rest}`;
  }
  return text;
}

/** A list of values spoken and joined with ", " (A-4). */
export function speakList(values: readonly Speakable[]): string {
  return values.map(speak).join(', ');
}

/**
 * The accessible name of a node button (A-3):
 * "Node 3, value 2, can be fired"; "City 2, population 1, mutation would raise it".
 */
export const nodeName = (kind: NodeKind, label: number, value: Speakable, state: NodeState): string =>
  kind === 'node'
    ? `Node ${label}, value ${speak(value)}, ${state}`
    : `City ${label}, population ${speak(value)}, ${state}`;

/** "1 move", "6 moves" (plan: SPEC fixes no wording at one move; decisions/P0-A5.md). */
function movesPhrase(moves: number): string {
  return moves === 1 ? '1 move' : `${moves} moves`;
}

export type MoveVerb = 'Fired' | 'Mutated';
export type ValuesNoun = 'numbers' | 'populations';

/** The A-4 templates, exactly; every value is spoken through speak(). */
export const announceTemplates = {
  fired(label: number, numbers: readonly Speakable[], move: number): string {
    return `Fired node ${label}. Numbers now ${speakList(numbers)}. Move ${move}.`;
  },
  mutated(label: number, populations: readonly Speakable[], move: number): string {
    return `Mutated city ${label}. Populations now ${speakList(populations)}. Move ${move}.`;
  },
  linked(label: number, populations: readonly Speakable[], numbers: readonly Speakable[], move: number): string {
    return `Mutated city ${label} and fired node ${label}. Populations now ${speakList(populations)}; numbers now ${speakList(numbers)}. Move ${move}.`;
  },
  cannotFire(label: number, value: Speakable): string {
    return `Node ${label} cannot be fired: its number is ${speak(value)}.`;
  },
  gameOver(moves: number): string {
    return `Game over after ${movesPhrase(moves)}.`;
  },
  playedToEnd(moves: number, numbers: readonly Speakable[]): string {
    return `Played ${movesPhrase(moves)} to the end. Numbers now ${speakList(numbers)}.`;
  },
  /**
   * "Undid move 4. Numbers now ...". The trailing `noun` is a P0-A5 extension (a deviation
   * reported to MERGE): the Populations view says "Populations now ...". Default: numbers.
   */
  undid(move: number, values: readonly Speakable[], noun: ValuesNoun = 'numbers'): string {
    const word = noun === 'numbers' ? 'Numbers' : 'Populations';
    return `Undid move ${move}. ${word} now ${speakList(values)}.`;
  },
  /**
   * Boards with more than four nodes read only the changed nodes (A-4):
   * "Fired node 4. Node 3 now 3, node 4 now minus 2, node 5 now 1. Move 7."
   * The noun follows the verb: Fired with node, Mutated with city.
   */
  changedOnly(verb: MoveVerb, label: number, changes: readonly (readonly [number, Speakable])[], move: number): string {
    const noun = verb === 'Fired' ? 'node' : 'city';
    const parts = changes.map(([l, v], k) => `${k === 0 ? capitalise(noun) : noun} ${l} now ${speak(v)}`);
    return `${verb} ${noun} ${label}. ${parts.join(', ')}. Move ${move}.`;
  },
};

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Above this many nodes a move is read as its changed nodes only (A-4). */
export const CHANGED_ONLY_ABOVE = 4;

/**
 * The announcement of one move, choosing the template by the size of the board (A-4).
 * `labels`, `before` and `after` are indexed by position; values are compared as text.
 */
export function moveAnnouncement(
  verb: MoveVerb,
  labels: readonly number[],
  label: number,
  before: readonly Speakable[],
  after: readonly Speakable[],
  move: number,
): string {
  if (labels.length > CHANGED_ONLY_ABOVE) {
    const changes: [number, Speakable][] = [];
    for (let k = 0; k < labels.length; k++) {
      if (String(before[k]) !== String(after[k])) changes.push([labels[k]!, after[k]!]);
    }
    return announceTemplates.changedOnly(verb, label, changes, move);
  }
  return verb === 'Fired' ? announceTemplates.fired(label, after, move) : announceTemplates.mutated(label, after, move);
}

/** The coalescing window of A-4: moves within half a second are announced once. */
export const COALESCE_MS = 500;

/**
 * An announcer writing into one polite live region (A-4). Calls within 500 ms of each other
 * coalesce: only the last text is written, 500 ms after the last call, and it carries the
 * move number of the last state. Writing the same text twice still announces: the region is
 * cleared first and the text set again a moment later, so the final text equals the template.
 */
export function createAnnouncer(region: HTMLElement): (text: string) => void {
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = (): void => {
    timer = null;
    const text = pending;
    pending = null;
    if (text === null) return;
    if (region.textContent === text) {
      region.textContent = '';
      setTimeout(() => {
        region.textContent = text;
      }, 50);
    } else {
      region.textContent = text;
    }
  };
  return (text: string): void => {
    pending = text;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(write, COALESCE_MS);
  };
}
