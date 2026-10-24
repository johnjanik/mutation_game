#!/usr/bin/env node
// The report of numbers typed into lesson prose (SPEC.md 7.7, Content row): lists every number in
// lesson prose that is not written with <G>, for a person to review. Advisory: always exits 0.
// Writes reports/numbers-in-prose.md at the repository root (ignored by git).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MODULES_DIR = join(ROOT, 'site', 'src', 'content', 'modules');
export const REPORT = join(ROOT, 'reports', 'numbers-in-prose.md');
export const NO_FILES = 'No lesson files found under site/src/content/modules/.';

/**
 * A number: a maximal run of digits with the grouping characters inside it (comma, U+202F,
 * U+2009 or a space, each followed by a group of three digits), an optional decimal part, and an
 * optional leading - or U+2212 when that sign does not follow a letter or digit.
 */
const NUMBER = /(?:(?<![\p{L}\p{N}_])[-−])?\d+(?:[,   ]\d{3}(?!\d))*(?:\.\d+)?/gu;

/**
 * @typedef {{ file: string; line: number; number: string; context: string; kind: 'prose' | 'formula' | 'fallback' }} Finding
 */

/** Replaces the characters of [start, end) by spaces, keeping line breaks. */
function blank(chars, start, end) {
  for (let i = start; i < end && i < chars.length; i++) if (chars[i] !== '\n') chars[i] = ' ';
}

/**
 * Inside a brace expression (JavaScript), the index just after a comment that opens at `i`
 * (slash-star to star-slash, or slash-slash to the end of the line), or -1 when none opens there.
 * A quote inside a comment, such as the apostrophe of "the site's own words" in an MDX comment,
 * opens no string.
 */
function commentEnd(text, i) {
  if (text[i] !== '/') return -1;
  if (text[i + 1] === '*') {
    const close = text.indexOf('*/', i + 2);
    return close < 0 ? text.length : close + 2;
  }
  if (text[i + 1] === '/') {
    const eol = text.indexOf('\n', i + 2);
    return eol < 0 ? text.length : eol;
  }
  return -1;
}

/** Index just after the tag that opens at `start` (a '<'), respecting quotes and braces. */
function tagEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (depth > 0) {
      const comment = commentEnd(text, i);
      if (comment >= 0) { i = comment - 1; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '"' || c === "'" || c === '`') quote = c;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '>') return i + 1;
  }
  return text.length;
}

/** Index just after the brace expression that opens at `start` (a '{'). */
function braceEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
    const comment = commentEnd(text, i);
    if (comment >= 0) { i = comment - 1; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return text.length;
}

/**
 * The literal text inside a JavaScript expression between `start` and `end`: the insides of its
 * string literals, and the text parts of its template literals without their ${...} interpolations.
 * Comments are skipped. Returns [from, to) index pairs.
 * @returns {[number, number][]}
 */
function literalParts(text, start, end) {
  /** @type {[number, number][]} */
  const parts = [];
  for (let i = start; i < end; i++) {
    const comment = commentEnd(text, i);
    if (comment >= 0) { i = comment - 1; continue; }
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < end && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
      parts.push([i + 1, Math.min(j, end)]);
      i = j;
    } else if (c === '`') {
      let j = i + 1;
      let from = j;
      while (j < end && text[j] !== '`') {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '$' && text[j + 1] === '{') {
          parts.push([from, j]);
          let depth = 0;
          for (; j < end; j++) {
            if (text[j] === '{') depth++;
            else if (text[j] === '}' && --depth === 0) break;
          }
          from = j + 1;
        }
        j++;
      }
      parts.push([from, Math.min(j, end)]);
      i = j;
    }
  }
  return parts;
}

/**
 * The literal text of the prop `prop` of the tag that occupies [start, end) of `text`: the inside of
 * a quoted value, or the literal parts (literalParts) of a brace value. Empty when the tag has no
 * such prop. A release build prints the fallback of <Unverified> as prose (SPEC.md 7.3), so its
 * numbers are reported like the numbers of prose.
 * @returns {[number, number][]}
 */
function propLiterals(text, start, end, prop) {
  let i = start + 1;
  while (i < end && /[\w.:-]/.test(text[i])) i++;
  while (i < end) {
    while (i < end && /\s/.test(text[i])) i++;
    if (i >= end || text[i] === '/' || text[i] === '>') break;
    if (text[i] === '{') { i = braceEnd(text, i); continue; }
    const nameStart = i;
    while (i < end && /[^\s=/>{"']/.test(text[i])) i++;
    const name = text.slice(nameStart, i);
    if (name === '') { i++; continue; }
    while (i < end && /\s/.test(text[i])) i++;
    if (text[i] !== '=') continue;
    i++;
    while (i < end && /\s/.test(text[i])) i++;
    /** @type {[number, number][]} */
    let ranges = [];
    let valueEnd = i;
    if (text[i] === '"' || text[i] === "'") {
      const close = text.indexOf(text[i], i + 1);
      valueEnd = close < 0 ? end : close + 1;
      ranges = [[i + 1, Math.max(i + 1, valueEnd - 1)]];
    } else if (text[i] === '{') {
      valueEnd = braceEnd(text, i);
      ranges = literalParts(text, i + 1, valueEnd - 1);
    } else {
      while (valueEnd < end && /[^\s/>]/.test(text[valueEnd])) valueEnd++;
    }
    if (name === prop) return ranges;
    i = Math.max(valueEnd, i + 1);
  }
  return [];
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

function lineOf(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** The line's text trimmed to about eighty characters around the match. */
function contextOf(lineText, col, len) {
  const t = lineText;
  if (t.trim().length <= 80) return t.trim();
  const from = Math.max(0, col - 38);
  const to = Math.min(t.length, col + len + 38);
  return (from > 0 ? '...' : '') + t.slice(from, to).trim() + (to < t.length ? '...' : '');
}

/**
 * Finds the numbers of an MDX source: in prose (outside frontmatter, import and export lines,
 * fenced code, code spans, tags and their props, <G> and <Tex> elements, brace expressions,
 * heading ids and link destinations), separately inside $...$ and $$...$$ formulas, and separately
 * in the fallback prop of <Unverified>, which a release build prints in place of the sentence.
 * @param {string} text
 * @param {string} fileName
 * @returns {Finding[]}
 */
export function scanSource(text, fileName) {
  const chars = text.split(''); // UTF-16 units, so indices agree with the string's
  const lines = text.split('\n');
  const starts = lineStarts(text);

  // 1. Frontmatter: the first --- block at the top of the file.
  const frontmatter = /^---\r?\n[\s\S]*?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (frontmatter) blank(chars, 0, frontmatter[0].length);

  // 2. Fenced code blocks and import or export statements, line by line.
  {
    let fence = null;
    let inStatement = false;
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const s = starts[l];
      const e = s + line.length;
      const trimmed = line.trimStart();
      if (fence) {
        blank(chars, s, e);
        if (trimmed.startsWith(fence)) fence = null;
        continue;
      }
      const m = /^(`{3,}|~{3,})/.exec(trimmed);
      if (m) { fence = m[1]; blank(chars, s, e); continue; }
      if (inStatement || /^(import|export)\s/.test(line)) {
        blank(chars, s, e);
        inStatement = !(line.trim() === '' || /;\s*$/.test(line) || /^(import|export)\s.*\bfrom\s+['"][^'"]+['"]\s*$/.test(line));
        continue;
      }
    }
  }

  let masked = chars.join('');

  // 3. Code spans.
  for (const m of masked.matchAll(/(`+)[^`]*?\1/g)) blank(chars, m.index, m.index + m[0].length);
  masked = chars.join('');

  // 4. Tags with their props; <G> and <Tex> elements with their contents. The fallback prop of
  //    <Unverified> is read first, from the source text (its literal parts; listed apart).
  /** @type {[number, number][]} */
  const fallbacks = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '<' || !/[A-Za-z/!]/.test(masked[i + 1] ?? '')) continue;
    const end = tagEnd(masked, i);
    const name = /^<\/?([A-Za-z][\w.:-]*)/.exec(masked.slice(i, end))?.[1];
    if (name === 'Unverified' && masked[i + 1] !== '/') fallbacks.push(...propLiterals(text, i, end, 'fallback'));
    let stop = end;
    if ((name === 'G' || name === 'Tex') && masked[i + 1] !== '/' && !/\/>$/.test(masked.slice(i, end))) {
      const close = masked.indexOf(`</${name}>`, end);
      stop = close >= 0 ? close + name.length + 3 : end;
    }
    blank(chars, i, stop);
    i = stop - 1;
  }
  masked = chars.join('');

  // 5. Formulas: $$...$$ (may span lines), then $...$ within a line. Not prose; listed apart.
  /** @type {[number, number][]} */
  const formulas = [];
  for (const m of masked.matchAll(/\$\$[\s\S]+?\$\$/g)) {
    formulas.push([m.index, m.index + m[0].length]);
    blank(chars, m.index, m.index + m[0].length);
  }
  masked = chars.join('');
  for (const m of masked.matchAll(/(?<!\\)\$(?!\s)[^$\n]+?(?<![\s\\])\$/g)) {
    formulas.push([m.index, m.index + m[0].length]);
    blank(chars, m.index, m.index + m[0].length);
  }
  masked = chars.join('');

  // 6. Brace expressions (standalone JSX expressions, heading ids).
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '{') continue;
    const end = braceEnd(masked, i);
    blank(chars, i, end);
    i = end - 1;
  }
  masked = chars.join('');

  // 7. Link and image destinations, and reference definitions.
  for (const m of masked.matchAll(/\]\([^)\n]*\)/g)) blank(chars, m.index + 1, m.index + m[0].length);
  for (const m of masked.matchAll(/^\s*\[[^\]\n]+\]:\s*\S.*$/gm)) blank(chars, m.index, m.index + m[0].length);
  masked = chars.join('');

  /** @type {Finding[]} */
  const findings = [];
  const add = (index, number, kind) => {
    const l = lineOf(starts, index);
    findings.push({ file: fileName, line: l + 1, number, context: contextOf(lines[l], index - starts[l], number.length), kind });
  };
  for (const m of masked.matchAll(NUMBER)) add(m.index, m[0], 'prose');
  for (const [s, e] of formulas.sort((a, b) => a[0] - b[0])) {
    for (const m of text.slice(s, e).matchAll(NUMBER)) add(s + m.index, m[0], 'formula');
  }
  for (const [s, e] of fallbacks) {
    for (const m of text.slice(s, e).matchAll(NUMBER)) add(s + m.index, m[0], 'fallback');
  }
  return findings;
}

/** The lesson files, sorted; an empty list when the directory is missing. */
export function lessonFiles(dir = MODULES_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.mdx')).sort().map((n) => join(dir, n));
}

const cell = (s) => String(s).replace(/\|/g, '\\|');

/**
 * The Markdown report.
 * @param {Finding[]} findings
 * @param {number} fileCount
 * @param {string} date
 */
export function renderReport(findings, fileCount, date) {
  const out = ['# Numbers in lesson prose', '', `Generated ${date} by scripts/numbers-in-prose.mjs (SPEC.md 7.7). For a person to review: every number in lesson prose that is not written with <G>.`, ''];
  if (fileCount === 0) {
    out.push(NO_FILES, '');
    return out.join('\n');
  }
  const prose = findings.filter((f) => f.kind === 'prose');
  const formulas = findings.filter((f) => f.kind === 'formula');
  const fallbacks = findings.filter((f) => f.kind === 'fallback');
  const files = new Set(prose.map((f) => f.file));
  out.push(`${prose.length} numbers in prose in ${files.size} of ${fileCount} lesson files; ${formulas.length} numbers inside formulas; ${fallbacks.length} numbers in the fallbacks of <Unverified>.`, '');
  const section = (title, list) => {
    out.push(`## ${title}`, '');
    if (list.length === 0) { out.push('None.', ''); return; }
    const byFile = new Map();
    for (const f of list) { if (!byFile.has(f.file)) byFile.set(f.file, []); byFile.get(f.file).push(f); }
    for (const [file, items] of byFile) {
      out.push(`### ${file}`, '', '| line | number | text |', '|---|---|---|');
      for (const f of items) out.push(`| ${f.line} | ${cell(f.number)} | ${cell(f.context)} |`);
      out.push('');
    }
  };
  section('Numbers in prose not written with <G>', prose);
  section('Numbers inside formulas not written with <Tex>', formulas);
  section('Numbers in the fallbacks of <Unverified> (printed as prose by a release build)', fallbacks);
  return out.join('\n');
}

/**
 * Scans every lesson and writes the report. Returns the counts.
 * @param {{ dir?: string; report?: string; root?: string }} [opts]
 */
export function writeNumbersReport(opts = {}) {
  const dir = opts.dir ?? MODULES_DIR;
  const report = opts.report ?? REPORT;
  const root = opts.root ?? ROOT;
  const files = lessonFiles(dir);
  const findings = files.flatMap((f) => scanSource(readFileSync(f, 'utf8'), relative(root, f).split(sep).join('/')));
  mkdirSync(dirname(report), { recursive: true });
  writeFileSync(report, renderReport(findings, files.length, new Date().toISOString().slice(0, 10)));
  const prose = findings.filter((f) => f.kind === 'prose');
  const fallbacks = findings.filter((f) => f.kind === 'fallback').length;
  return { numbers: prose.length, files: new Set(prose.map((f) => f.file)).size, fallbacks, lessonFiles: files.length, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = writeNumbersReport();
    if (r.lessonFiles === 0) console.log(`numbers-in-prose: ${NO_FILES}`);
    console.log(`numbers-in-prose: ${r.numbers} numbers in ${r.files} files, ${r.fallbacks} in fallbacks; report written to ${relative(ROOT, r.report).split(sep).join('/')}`);
  } catch (err) {
    // A report for a person: a failure is printed, never turned into a failing exit status.
    console.error(`numbers-in-prose: ${err instanceof Error ? err.message : err}`);
  }
  process.exit(0);
}
