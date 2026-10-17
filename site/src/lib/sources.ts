// The SOURCES.md key parser (SPEC.md 7.3): used by <Cite> now and by the sources page in phase 1.
// Plain string processing on the raw file; no Markdown or MDX library, because the sources page
// renders SOURCES.md as Markdown (not MDX) and the site adds no dependency for this.
// Build time only; never imported by a .svelte file or anything that reaches the browser.
import sourcesText from '../../../SOURCES.md?raw';

export interface SourceEntry {
  key: string;
  /** The `### 11.k` heading under which the key is defined, as `11.k` ('' before any heading). */
  section: string;
  /** 1-based line of SOURCES.md on which the key marker stands. */
  line: number;
  /** `text` up to its first line break. */
  firstLine: string;
  /** The Markdown from the key marker to the next key marker or the next heading, trimmed. */
  text: string;
}

export class SourcesKeyError extends Error {
  constructor(key: string) {
    super(`unknown citation key "${key}": it is not defined in SOURCES.md as **[${key}]**`);
    this.name = 'SourcesKeyError';
  }
}

/**
 * A key is defined wherever SOURCES.md prints it in bold brackets, **[KEY]**: at the start of a
 * paragraph, at the start of a list item, or in the middle of a line after an earlier entry.
 */
const KEY_MARKER = /\*\*\[([A-Za-z][A-Za-z0-9+-]*)\]\*\*/g;
const HEADING = /^#{1,6} /;
const SECTION = /^### (\d+\.\d+)\b/;
/** The status labels of SOURCES.md 11.0 and the design label [D] of SPEC.md 0.3 are never keys. */
const LABELS = new Set(['S', 'S2', 'V', 'U', 'D']);

function parse(text: string): Map<string, SourceEntry> {
  const lines = text.split('\n');
  interface Marker { key: string; line: number; col: number; end: number; section: string }
  const markers: Marker[] = [];
  /** For each line index, true when it is a heading (an entry stops there). */
  const headingAt: boolean[] = [];
  let section = '';
  lines.forEach((lineText, i) => {
    headingAt[i] = HEADING.test(lineText);
    const s = SECTION.exec(lineText);
    if (s) section = s[1]!;
    if (headingAt[i]) return;
    for (const m of lineText.matchAll(KEY_MARKER)) {
      const key = m[1]!;
      if (LABELS.has(key)) continue;
      markers.push({ key, line: i, col: m.index, end: m.index + m[0].length, section });
    }
  });

  const entries = new Map<string, SourceEntry>();
  markers.forEach((mk, n) => {
    const next = markers[n + 1];
    const parts: string[] = [];
    for (let i = mk.line; i < lines.length; i++) {
      if (i > mk.line && headingAt[i]) break;
      const from = i === mk.line ? mk.col : 0;
      if (next && next.line === i) {
        parts.push(lines[i]!.slice(from, next.col));
        break;
      }
      parts.push(lines[i]!.slice(from));
    }
    const body = parts.join('\n').trim();
    const firstBreak = body.indexOf('\n');
    // The first definition wins should a key ever be printed in bold twice.
    if (!entries.has(mk.key)) {
      entries.set(mk.key, {
        key: mk.key,
        section: mk.section,
        line: mk.line + 1,
        firstLine: (firstBreak < 0 ? body : body.slice(0, firstBreak)).trim(),
        text: body,
      });
    }
  });
  return entries;
}

const ENTRIES = parse(sourcesText);

/** Every defined key, in file order. */
export function keys(): string[] {
  return [...ENTRIES.keys()];
}

export function hasKey(k: string): boolean {
  return ENTRIES.has(k);
}

/** The entry of a key; throws SourcesKeyError on an unknown key. */
export function entry(k: string): SourceEntry {
  const e = ENTRIES.get(k);
  if (!e) throw new SourcesKeyError(k);
  return e;
}

/** Removes Markdown from a stretch of text that holds no `$...$` mathematics. */
function stripMarkdown(s: string): string {
  return s
    .replace(/<https?:\/\/[^>\s]*>/g, '')
    .replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

/**
 * A status label of SOURCES.md 11.0 (the labels of SPEC.md 0.3) in raw Markdown: the token S, S2,
 * V, U or D directly after `[` and directly before `]`, `,`, `;`, `:` or a space, the token rule the
 * sources page uses when it spells the labels out.
 */
const STATUS_LABEL = /\[(?:S2|S|V|U|D)(?=[\],;: ])/;
/** A sentence that gives the reading status in words, without a label ("Not read.", "Not opened ..."). */
const READING_STATUS = /^Not (?:read|opened)\b/;

/**
 * The indexes at which the sentences of a line begin. A full stop followed by spaces and a capital,
 * `[`, `*` or a backtick ends a sentence, unless the word before it is a single letter (an initial,
 * "N. J. Wildberger") or a capitalised word of letters (an abbreviation, "Amer. Math. Soc.").
 */
function sentenceStarts(line: string): number[] {
  const starts = [0];
  for (const m of line.matchAll(/\.\s+(?=[\p{Lu}[*`])/gu)) {
    const word = /(\S*)$/.exec(line.slice(0, m.index))![1]!.replace(/^[("'*_]+|[*_]+$/g, '');
    if (/^\p{L}$/u.test(word) || /^\p{Lu}\p{Ll}+$/u.test(word)) continue;
    starts.push(m.index + m[0].length);
  }
  return starts;
}

/**
 * The citation part of an entry's first line (SOURCES.md 11.0: "Each entry gives the citation, where
 * a copy can be read, a status, and its role on the site"): the line up to the first sentence that
 * carries a status label or states the reading status, so that the research record after it (the
 * labels, the notes on what was read, the role) is left to the sources page. When the label stands
 * in the first sentence, the cut falls before the bracket the cut would leave unclosed, or else
 * before the clause, after the last semicolon, that holds the label.
 */
function citationPart(line: string): string {
  const starts = sentenceStarts(line);
  let cut = line.length;
  for (let s = 0; s < starts.length; s++) {
    const sentence = line.slice(starts[s], starts[s + 1] ?? line.length);
    const label = STATUS_LABEL.exec(sentence);
    if (s > 0 && (label || READING_STATUS.test(sentence))) {
      cut = starts[s]!;
      break;
    }
    if (s === 0 && label) {
      cut = label.index;
      let depth = 0;
      let open = -1;
      let semicolon = -1;
      for (let i = 0; i < cut; i++) {
        if (line[i] === '(') {
          if (depth === 0) open = i;
          depth++;
        } else if (line[i] === ')' && depth > 0) depth--;
        else if (line[i] === ';' && depth === 0) semicolon = i;
      }
      if (depth > 0) cut = open;
      else if (semicolon >= 0) cut = semicolon;
      break;
    }
  }
  const part = line.slice(0, cut).replace(/[\s,;:]+$/, '');
  return part === '' ? line : part;
}

/**
 * The link title of <Cite>, and the text the Sources list of a lesson prints after the key: the
 * citation part of the entry's first line (citationPart) without its key marker, with **bold** and
 * *italic* emphasis removed, [text](url) links reduced to text, <url> autolinks removed, and
 * $...$ mathematics left as it stands.
 */
export function citeTitle(k: string): string {
  const e = entry(k);
  const line = citationPart(e.firstLine.replace(/^\*\*\[[^\]]*\]\*\*\s*/, ''));
  // Odd-numbered pieces lie between dollar signs and are mathematics: left untouched.
  const pieces = line.split('$').map((piece, i) => (i % 2 === 1 ? piece : stripMarkdown(piece)));
  return pieces.join('$').replace(/\s+/g, ' ').trim();
}
