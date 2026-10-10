// The transformation behind the sources page (P1-A4; SPEC.md 7.3 "The sources page"): SOURCES.md is
// rendered as Markdown (not MDX, which rejects its angle-bracket links), sections 11.1 to 11.6 only,
// with the status labels spelled out in words, an anchor id="<key>" on every citation key, and every
// $...$ formula typeset at build time by renderTex, the call <Tex> uses. The formulas are replaced by
// opaque placeholders before Markdown rendering (so no remark-math plugin of the configured
// processor sees them) and typeset afterwards. Pure string functions plus one async driver that is
// handed its Markdown renderer and its TeX renderer, so the whole pipeline is unit-tested.
// Build time only; never imported by anything that reaches the browser.

/** The display words of the status labels of SPEC.md 0.3 and SOURCES.md 11.0 (plan wording). */
export const STATUS_WORDS = {
  S: 'read in the source',
  S2: 'reported by a later source',
  V: 'checked by computation',
  U: 'unverified',
  D: 'design decision',
} as const;
type Label = keyof typeof STATUS_WORDS;

/** The sections published on the page; 11.0 and 11.7 to 11.9 are the research record. */
export const PUBLISHED_SECTIONS = ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6'] as const;

/** From the line `### 11.1 ` up to, not including, the line `### 11.7 `. */
export function publishedSlice(text: string): string {
  const lines = text.split('\n');
  const from = lines.findIndex((l) => l.startsWith('### 11.1 '));
  const to = lines.findIndex((l) => l.startsWith('### 11.7 '));
  if (from < 0 || to < 0 || to <= from) throw new Error('sources page: SOURCES.md has no "### 11.1 " heading followed by a "### 11.7 " heading');
  return lines.slice(from, to).join('\n').trimEnd() + '\n';
}

const PLACEHOLDER = (n: number): string => `MATHPLACEHOLDER${n}END`;
const PLACEHOLDER_RE = /MATHPLACEHOLDER(\d+)END/g;

/** Replaces every inline $...$ span by an opaque alphanumeric placeholder. */
export function protectMath(md: string): { text: string; formulas: string[] } {
  const formulas: string[] = [];
  const text = md.replace(/\$([^$\n]+)\$/g, (_m, tex: string) => {
    formulas.push(tex);
    return PLACEHOLDER(formulas.length - 1);
  });
  if (text.includes('$')) throw new Error('sources page: an unpaired $ remains after the formulas were taken out');
  return { text, formulas };
}

/** Puts the typeset formulas back in place of the placeholders. */
export function restoreMath(html: string, formulas: readonly string[], render: (tex: string) => string): string {
  return html.replace(PLACEHOLDER_RE, (_m, n: string) => {
    const tex = formulas[Number(n)];
    if (tex === undefined) throw new Error(`sources page: placeholder ${n} has no formula`);
    return render(tex);
  });
}

const LABEL_AT = /^\[(S2|S|V|U|D)(?=[\],;: ])/;
const INNER_LABEL = /([,;] )(S2|S|V|U|D)(?=[\],;: ]|$)/g;

/**
 * Spells out every status label. A label is the exact token S, S2, V, U or D directly after `[` and
 * directly before `]`, `,`, `;`, `:` or a space; the whole bracket becomes round brackets around
 * the words and the rest of the bracket (`[V: every printed list ...]` gives
 * "(checked by computation: every printed list ...)", `[S, page image]` gives
 * "(read in the source, page image)"). A further token after a comma or semicolon inside the same
 * bracket is spelled out too (`[S for the lemma, S2 for Bourbaki]`). Markdown links inside the
 * bracket are kept; a bracket followed by `(` (a link) and bold citation keys are never touched.
 */
export function spellOutLabels(md: string): string {
  let out = '';
  let i = 0;
  while (i < md.length) {
    const ch = md[i]!;
    const m = ch === '[' ? LABEL_AT.exec(md.slice(i, i + 4)) : null;
    if (!m) {
      out += ch;
      i++;
      continue;
    }
    // Find the matching close bracket, counting nested brackets (Markdown links inside).
    let depth = 0;
    let end = -1;
    for (let j = i; j < md.length; j++) {
      if (md[j] === '\n' && md[j + 1] === '\n') break;
      if (md[j] === '[') depth++;
      else if (md[j] === ']') {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0 || md[end + 1] === '(') {
      out += ch;
      i++;
      continue;
    }
    const label = m[1] as Label;
    const rest = md.slice(i + 1 + label.length, end).replace(INNER_LABEL, (_x, sep: string, t: string) => sep + STATUS_WORDS[t as Label]);
    out += `(${STATUS_WORDS[label]}${rest})`;
    i = end + 1;
  }
  return out;
}

const KEY_MARKER = /\*\*\[([A-Za-z][A-Za-z0-9+-]*)\]\*\*/g;

/** Gives every bold key marker **[KEY]** an element with id="KEY" (the anchor of <Cite>). */
export function anchorKeys(md: string, keys: ReadonlySet<string>): string {
  return md.replace(KEY_MARKER, (whole, key: string) =>
    keys.has(key) ? `<strong class="source-key" id="${key}">&#91;${key}&#93;</strong>` : whole,
  );
}

/** Links a plain mention [KEY] of a defined key to its anchor (not a link text, not a label). */
export function linkKeyMentions(md: string, keys: ReadonlySet<string>): string {
  return md.replace(/(^|[^\\*[])\[([A-Za-z][A-Za-z0-9+-]*)\](?![(\]*])/g, (whole, before: string, key: string) =>
    keys.has(key) ? `${before}[\\[${key}\\]](#${key})` : whole,
  );
}

/** `### 11.k` headings become `##`, so that under the page's <h1> the heading order is valid. */
export function demoteHeadings(md: string): string {
  return md.replace(/^### /gm, '## ');
}

export interface KeyEntry {
  key: string;
  section: string;
}

/** Fails when a key is defined outside 11.1 to 11.6, naming the key and its section. */
export function checkKeysPublished(entries: readonly KeyEntry[]): void {
  const published = new Set<string>(PUBLISHED_SECTIONS);
  const outside = entries.filter((e) => !published.has(e.section));
  if (outside.length > 0) {
    const list = outside.map((e) => `${e.key} (section ${e.section || 'before 11.0'})`).join(', ');
    throw new Error(`sources page: citation keys defined outside sections 11.1 to 11.6 would have no anchor on the page: ${list}`);
  }
}

/** The Markdown of the page before rendering, and the formulas taken out of it. */
export function prepareSources(text: string, keys: readonly string[]): { markdown: string; formulas: string[] } {
  const { text: protectedText, formulas } = protectMath(publishedSlice(text));
  const keySet = new Set(keys);
  const markdown = demoteHeadings(linkKeyMentions(anchorKeys(spellOutLabels(protectedText), keySet), keySet));
  return { markdown, formulas };
}

/** The HTML of the published sections: prepared, rendered as Markdown, formulas typeset. */
export async function renderSources(
  text: string,
  entries: readonly KeyEntry[],
  renderMarkdown: (md: string) => Promise<string>,
  renderTex: (tex: string) => string,
): Promise<string> {
  checkKeysPublished(entries);
  const { markdown, formulas } = prepareSources(text, entries.map((e) => e.key));
  return restoreMath(await renderMarkdown(markdown), formulas, renderTex);
}
