// P0-A4: the SOURCES.md key parser behind <Cite> and, from phase 1, the sources page (SPEC.md 7.3).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { citeTitle, entry, hasKey, keys, SourcesKeyError } from '../../src/lib/sources';

const specText = readFileSync(fileURLToPath(new URL('../../../SPEC.md', import.meta.url)), 'utf8');
const sourcesText = readFileSync(fileURLToPath(new URL('../../../SOURCES.md', import.meta.url)), 'utf8');

describe('sources.ts', () => {
  it('keys in all three positions', () => {
    const all = keys();
    // Paragraph start, list item, mid-line after an earlier entry, and mid-line inside a list item.
    for (const k of ['W20', 'W-MS', 'Don08', 'Moz90', 'Hel01', 'EGH+11', 'Car26', 'Ele16', 'Cox73', 'W-sl3', 'Gre08', 'Gre13', 'Don07b', 'Don08b', 'BL92', 'Oni04', 'Bum13', 'RV16', 'RV21', 'Mac72']) {
      expect(all, k).toContain(k);
      expect(hasKey(k)).toBe(true);
    }
    expect(new Set(all).size).toBe(all.length);
    // Every bold bracketed key of the file is found, in file order.
    const bold = [...sourcesText.matchAll(/\*\*\[([A-Za-z][A-Za-z0-9+-]*)\]\*\*/g)].map((m) => m[1]);
    expect(all).toEqual(bold);
  });

  it('no label is a key', () => {
    const all = keys();
    for (const label of ['S', 'S2', 'V', 'U', 'D']) {
      expect(all).not.toContain(label);
      expect(hasKey(label)).toBe(false);
    }
  });

  it('entry and citeTitle', () => {
    const don = entry('Don08');
    expect(don.key).toBe('Don08');
    expect(don.section).toBe('11.2');
    expect(don.firstLine.replace(/^\*\*\[Don08\]\*\*\s*/, '')).toMatch(/^R\. G\. Donnelly, "Eriksson's numbers game and finite Coxeter groups"/);
    expect(don.firstLine).not.toContain('\n');
    expect(don.text.startsWith(don.firstLine)).toBe(true);
    expect(sourcesText.split('\n')[don.line - 1]).toContain('**[Don08]**');

    const w20 = entry('W20');
    expect(w20.section).toBe('11.1');
    const title = citeTitle('W20');
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toContain('**');
    expect(title).not.toContain('](');
    expect(title).not.toContain('<http');
    expect(title).not.toContain('[W20]');
    expect(title).toMatch(/^N\. J\. Wildberger/);
    expect(citeTitle('Don08')).not.toMatch(/\*\w/);
  });

  it('a mid-line entry ends at the next key marker', () => {
    const car14 = entry('Car14');
    expect(car14.text).not.toContain('[Car26]');
    expect(entry('Car26').firstLine.startsWith('**[Car26]**')).toBe(true);
    expect(entry('Car26').section).toBe('11.4');
    // The last entry of a section stops at the next heading.
    expect(entry('Hec84').text).not.toContain('###');
  });

  it('throws SourcesKeyError on an unknown key', () => {
    expect(() => entry('Nope99')).toThrow(SourcesKeyError);
    try {
      entry('Nope99');
    } catch (error) {
      expect((error as Error).name).toBe('SourcesKeyError');
      expect((error as Error).message).toContain('Nope99');
    }
    expect(() => citeTitle('Nope99')).toThrow(SourcesKeyError);
    expect(hasKey('Nope99')).toBe(false);
  });

  it('every key cited in SPEC.md is defined', () => {
    const cited = new Set(
      [...specText.matchAll(/\[([A-Za-z][A-Za-z0-9+-]*)\]/g)]
        .map((m) => m[1]!)
        .filter((inside) => /[0-9-]/.test(inside) && inside !== 'S2'),
    );
    expect(cited.size).toBeGreaterThanOrEqual(40);
    expect(cited.has('W-MS')).toBe(true);
    for (const k of cited) expect(hasKey(k), k).toBe(true);
  });
});
