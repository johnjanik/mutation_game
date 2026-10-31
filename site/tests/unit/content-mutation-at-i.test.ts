// Where a mutation happens, and what the literature's graph is called, in the site's words. RT-FIX P6-MERGE-C-04,
// a MERGE follow-up of the phase 6 round (rtconfirm-p6-pages, rtconfirm-p6-atlas).
// SPEC 2.2 and 2.4(a) write "a mutation at i" ("A **mutation at $i$** changes only the entry $p_i$"; "a mutation at
// i replaces p_i by p_i - a_i") and "mutating city i"; M0, M4 and the glossary ("To mutate city $i$") follow them,
// and no sentence of SPEC.md puts a mutation at a node. As found at d8102c0, /confusions/ wrote "a mutation at node
// $i$" (twice) and "The mutation at node $i$", and the translator sentence of the Atlas sheet "a mutation at node i
// replaces p_i by p_i - a_i".
// SPEC Appendix C names the literature's graph a board; M3 beat 7 and glossary row 18 (finite) write "a connected board
// with roads both ways". As found at d8102c0, /history/ wrote that Donnelly and Eriksson prove "that a connected
// graph whose roads all run both ways ...", the literature's graph with the site's roads.
// Run: npx vitest run --project site-unit site/tests/unit/content-mutation-at-i.test.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

/** Every page, lesson and component source under site/src, as [path relative to site/src, contents]. */
function sources(rel = ''): [string, string][] {
  return readdirSync(join(SRC, rel), { withFileTypes: true }).flatMap((e): [string, string][] => {
    const path = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) return sources(path);
    return /\.(?:mdx?|astro|svelte)$/.test(e.name) ? [[path, read(path)]] : [];
  });
}

describe('a mutation happens at i, or at a city', () => {
  // regression: P6-MERGE-C-04
  it('no page, lesson or component puts a mutation at a node', () => {
    const AT_NODE = /\bmutations?\s+at\s+nodes?\b/gi;
    const files = sources();
    expect(files.some(([p]) => p === 'components/atlas/AtlasSheet.astro') && files.some(([p]) => p === 'content/pages/confusions.mdx')).toBe(true);
    const found = files.flatMap(([path, text]) => [...text.matchAll(AT_NODE)].map((m) => `${path}: "...${text.slice(Math.max(0, m.index! - 40), m.index! + m[0].length + 20).replace(/\s+/g, ' ')}..."`));
    // Observed at d8102c0: content/pages/confusions.mdx three times (sections on the update rule and on simply
    // laced boards) and components/atlas/AtlasSheet.astro once (the translator sentence).
    expect(found, 'SPEC 2.2 and 2.4(a): "a mutation at i"').toEqual([]);
    // The two sentences now say it as SPEC 2.4(a) does.
    expect(read('content/pages/confusions.mdx')).toContain('and a mutation at $i$ becomes the firing of node $i$.');
    expect(read('components/atlas/AtlasSheet.astro').replace(/\s+/g, ' ')).toContain("and a mutation at <Fragment set:html={tex('i')} /> replaces <Fragment set:html={tex('p_i')} /> by <Fragment set:html={tex('p_i-a_i')} />.");
  });
});

describe("the history page names Donnelly and Eriksson's graph a board", () => {
  // regression: P6-MERGE-C-04
  it('the sentence of [DE08] says "a connected board with roads both ways", as M3 and the glossary do', () => {
    const history = read('content/pages/history.mdx');
    const line = history.split('\n').find((l) => l.includes('Donnelly and Eriksson use the game to prove that')) ?? '';
    const sentence = (line.split(/(?<=\.)\s+(?=[A-Z<])/).find((s) => s.includes('Donnelly and Eriksson use the game to prove that')) ?? '').replace(/<[^>]+>/g, '');
    expect(sentence, 'the history page still states the theorem of [DE08]').not.toBe('');
    // Observed at d8102c0: "... prove that a connected graph whose roads all run both ways, with whole-number road
    // counts, is a Dynkin diagram of finite type exactly when ...".
    expect(/\bgraph\b/.test(sentence), `history (2008): "${sentence}": the site calls the graph a board (SPEC Appendix C)`).toBe(false);
    expect(sentence).toContain('a connected board with roads both ways');
    expect(read('content/modules/m3-classification.mdx')).toContain('a connected board with roads both ways');
  });
});
