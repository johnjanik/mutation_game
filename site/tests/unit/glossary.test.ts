// P1-A4: the glossary against SPEC.md Appendix C (SPEC.md 7.3: "glossary, seeded from Appendix C").
// The table is parsed from SPEC.md at test time; no row is typed here. Every row must appear in the
// order of the appendix, with its four columns in order and each cell as written (empty cells stay
// empty), and every term of the first column must carry its own anchor, built by the slug rule of
// decisions/P1-A4.md and unique on the page.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SPEC = readFileSync(join(ROOT, 'SPEC.md'), 'utf8');
const MDX = readFileSync(join(ROOT, 'site', 'src', 'content', 'pages', 'glossary.mdx'), 'utf8');

/** The rows of Appendix C, as four trimmed cells each. */
function appendixC(): string[][] {
  const lines = SPEC.split('\n');
  const start = lines.indexOf('## Appendix C. Dictionary');
  expect(start, 'Appendix C heading').toBeGreaterThan(0);
  const rows: string[][] = [];
  let header: string[] | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^-+$/.test(c))) continue;
    if (header === null) header = cells;
    else rows.push(cells);
  }
  expect(header).toEqual(['This site', 'Wildberger ([W20], [W-MS])', 'Numbers-game literature', 'Lie theory']);
  return rows;
}

/** Splits the first column into terms at commas and semicolons outside $...$. */
function splitTerms(cell: string): string[] {
  const out: string[] = [];
  let cur = '';
  let math = false;
  for (const ch of cell) {
    if (ch === '$') math = !math;
    if (!math && (ch === ',' || ch === ';')) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** The slug rule: lower case; drop $...$ and parenthesised parts; spaces to hyphens; ASCII letters, digits, hyphens. */
function slug(term: string): string {
  return term
    .replace(/\$[^$]*\$/g, '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface Entry {
  row: number;
  dt: string;
  ids: string[];
  terms: string[];
  cols: Record<string, string>;
}

/** The entries of glossary.mdx, in file order. */
function entries(): Entry[] {
  const out: Entry[] = [];
  const re = /<div class="entry" data-row="(\d+)">\n([\s\S]*?)\n<\/div>/g;
  for (const m of MDX.matchAll(re)) {
    const body = m[2]!;
    const dt = /<dt>([\s\S]*?)<\/dt>/.exec(body)![1]!;
    const ids = [...dt.matchAll(/<dfn id="([^"]+)">/g)].map((x) => x[1]!);
    const terms = [...dt.matchAll(/<dfn id="[^"]+">([\s\S]*?)<\/dfn>/g)].map((x) => x[1]!);
    const cols: Record<string, string> = {};
    for (const d of body.matchAll(/<dd data-col="([^"]+)"><span class="col">([^<]*)<\/span>([\s\S]*?)<\/dd>/g)) {
      cols[d[1]!] = d[3]!.trim();
      cols[`${d[1]!}:label`] = d[2]!;
    }
    out.push({ row: Number(m[1]), dt: dt.replace(/<\/?dfn[^>]*>/g, ''), ids, terms, cols });
  }
  return out;
}

describe('glossary', () => {
  it('every Appendix C row is in the glossary', () => {
    const rows = appendixC();
    expect(rows.length).toBeGreaterThan(20);
    const list = entries();
    // Every row, in the order of the appendix; later agents may add entries after them.
    expect(list.length).toBeGreaterThanOrEqual(rows.length);
    rows.forEach((cells, i) => {
      const e = list[i]!;
      expect(e.row, `row ${i + 1}`).toBe(i + 1);
      expect(e.dt, `row ${i + 1}, This site`).toBe(cells[0]);
      expect(e.cols['wildberger'], `row ${i + 1}, Wildberger`).toBe(cells[1]);
      expect(e.cols['numbers-game'], `row ${i + 1}, Numbers-game literature`).toBe(cells[2]);
      expect(e.cols['lie-theory'], `row ${i + 1}, Lie theory`).toBe(cells[3]);
      // The four columns in order, with their headings as labels.
      expect(e.cols['wildberger:label']).toBe('Wildberger:');
      expect(e.cols['numbers-game:label']).toBe('Numbers-game literature:');
      expect(e.cols['lie-theory:label']).toBe('Lie theory:');
      const body = MDX.slice(MDX.indexOf(`data-row="${i + 1}"`));
      const order = ['<dt>', 'data-col="wildberger"', 'data-col="numbers-game"', 'data-col="lie-theory"'].map((s) => body.indexOf(s));
      expect(order, `row ${i + 1}: columns in order`).toEqual([...order].sort((a, b) => a - b));
    });
    // The column heading of the appendix cites both of Wildberger's texts.
    expect(MDX).toContain('<Cite k="W20"/>');
    expect(MDX).toContain('<Cite k="W-MS"/>');
    expect(MDX).toMatch(/^title: "Glossary"$/m);
    expect(MDX).toMatch(/^released: true$/m);
  });

  it('one anchor per term, unique', () => {
    const rows = appendixC();
    const list = entries();
    const all: string[] = [];
    rows.forEach((cells, i) => {
      const terms = splitTerms(cells[0]!);
      expect(list[i]!.terms, `row ${i + 1}: one dfn per term`).toEqual(terms);
      expect(list[i]!.ids, `row ${i + 1}: anchors by the slug rule`).toEqual(terms.map(slug));
      all.push(...list[i]!.ids);
    });
    for (const id of all) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(all).size).toBe(all.length);
    // Rows with several terms have several anchors (node, city; bidirected board; one-way board; ...).
    expect(all).toEqual(expect.arrayContaining(['node', 'city', 'bidirected-board', 'one-way-board', 'kostants-game', 'the-translator']));
  });

  it('writes no em-dash', () => {
    expect(MDX).not.toContain('—');
  });
});
