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
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

/**
 * A status label of SOURCES.md 11.0 (the labels of SPEC.md 0.3) in raw Markdown: the token S, S2,
 * V, U or D directly after `[` and directly before `]`, `,`, `;`, `:` or a space, the token rule the
 * sources page uses when it spells the labels out.
 */
const STATUS_LABEL = /\[(?:S2|S|V|U|D)(?=[\],;: ])/;
/** A Markdown autolink, <https://...>: in an entry it says where a copy can be read. */
const AUTOLINK = /<https?:\/\/[^>\s]*>/;
/**
 * A sentence after the first that still belongs to the citation: an identifier of the work (its
 * DOI, MSC classes, arXiv number or ISBN). Any other sentence after the first is research record.
 */
const IDENTIFIER = /^(?:DOI|MSC|ISBN|arXiv)\b/;
/** Lower-case words with nothing else, such as "free at" or "also at": the lead-in of a link. */
const LEAD_IN = /^\s*\p{Ll}[\p{Ll}\s]*$/u;

/**
 * The indexes at which the sentences of a line begin. A full stop followed by spaces and a capital,
 * `[`, `*`, a backtick or an autolink ends a sentence, unless the word before it is a single letter
 * (an initial, "N. J. Wildberger") or a capitalised word of letters (an abbreviation, "Amer. Math.
 * Soc.").
 */
function sentenceStarts(line: string): number[] {
  const starts = [0];
  for (const m of line.matchAll(/\.\s+(?=[\p{Lu}[*`]|<https?:)/gu)) {
    const word = /(\S*)$/.exec(line.slice(0, m.index))![1]!.replace(/^[("'*_]+|[*_]+$/g, '');
    if (/^\p{L}$/u.test(word) || /^\p{Lu}\p{Ll}+$/u.test(word)) continue;
    starts.push(m.index + m[0].length);
  }
  return starts;
}

/**
 * Walks `s` up to index `to` and reports the first and last semicolon and the last comma that stand
 * outside parentheses, double quotes and $...$ mathematics, and the parenthesis still open at `to`
 * (-1 when none is).
 */
function topLevel(s: string, to: number): { firstSemicolon: number; lastSemicolon: number; lastComma: number; open: number } {
  let depth = 0;
  let open = -1;
  let quoted = false;
  let math = false;
  let firstSemicolon = -1;
  let lastSemicolon = -1;
  let lastComma = -1;
  for (let i = 0; i < to; i++) {
    const c = s[i];
    if (c === '$') math = !math;
    if (math || c === '$') continue;
    if (c === '"') quoted = !quoted;
    if (quoted || c === '"') continue;
    if (c === '(') {
      if (depth === 0) open = i;
      depth++;
    } else if (c === ')' && depth > 0) depth--;
    else if (depth === 0 && c === ';') {
      if (firstSemicolon < 0) firstSemicolon = i;
      lastSemicolon = i;
    } else if (depth === 0 && c === ',') lastComma = i;
  }
  return { firstSemicolon, lastSemicolon, lastComma, open: depth > 0 ? open : -1 };
}

/**
 * Where the citation stops inside a sentence that belongs to it, or -1 when it runs to the end.
 * Three things end it, whichever comes first:
 * - a status label: before the bracket the cut would leave unclosed, or else before the clause,
 *   after the last semicolon, that holds the label, or else before the label;
 * - an autolink (where a copy can be read): before the bracket it stands in, or the clause after a
 *   semicolon that holds it, or else before its lead-in (": <url>", ", <url>", ", free at <url>"),
 *   so that no label or colon is left with nothing after it;
 * - a semicolon outside brackets and quotes: what follows it is a note on the work ("the three
 *   figures ... are cited to ...", "free digital edition ..."), not the citation.
 */
function cutInSentence(sentence: string): number {
  const cuts: number[] = [];
  const label = STATUS_LABEL.exec(sentence);
  if (label) {
    const t = topLevel(sentence, label.index);
    cuts.push(t.open >= 0 ? t.open : t.lastSemicolon >= 0 ? t.lastSemicolon : label.index);
  }
  const link = AUTOLINK.exec(sentence);
  if (link) {
    const t = topLevel(sentence, link.index);
    const before = sentence.slice(0, link.index).trimEnd();
    if (t.open >= 0) cuts.push(t.open);
    else if (t.lastSemicolon >= 0) cuts.push(t.lastSemicolon);
    else if (before.endsWith(':') || before.endsWith(',')) cuts.push(before.length - 1);
    else if (t.lastComma >= 0 && LEAD_IN.test(before.slice(t.lastComma + 1))) cuts.push(t.lastComma);
    else cuts.push(link.index);
  }
  const semicolon = topLevel(sentence, sentence.length).firstSemicolon;
  if (semicolon >= 0) cuts.push(semicolon);
  return cuts.length > 0 ? Math.min(...cuts) : -1;
}

/**
 * The citation part of an entry's first line (SOURCES.md 11.0: "Each entry gives the citation, where
 * a copy can be read, a status, and its role on the site"): the first sentence, followed by the
 * sentences that give an identifier of the work (DOI, MSC, arXiv, ISBN), up to the first other
 * sentence or the first cut inside a kept sentence (cutInSentence). What is left out (where a copy can
 * be read, the labels, the notes on what was read, the role) stays on the sources page.
 */
function citationPart(line: string): string {
  const starts = sentenceStarts(line);
  let cut = line.length;
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s]!;
    const sentence = line.slice(from, starts[s + 1] ?? line.length);
    if (s > 0 && !IDENTIFIER.test(sentence)) {
      cut = from;
      break;
    }
    const inner = cutInSentence(sentence);
    if (inner >= 0) {
      cut = from + inner;
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
