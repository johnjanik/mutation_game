// P1-A4: the sources page pipeline (SPEC.md 7.3 "The sources page"; 7.2 item 3; A-12). Runs the
// real pipeline of sources.astro on the real SOURCES.md: the Markdown renderer of
// @astrojs/markdown-remark with no plugin, and renderTex from lib/katex.ts.
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { entry, keys } from '../../src/lib/sources';
import { renderTex } from '../../src/lib/katex';
import {
  STATUS_WORDS,
  anchorKeys,
  checkKeysPublished,
  linkKeyMentions,
  prepareSources,
  protectMath,
  publishedSlice,
  renderSources,
  spellOutLabels,
} from '../../src/lib/pages/sourcesMarkdown';

const TEXT = readFileSync(join(import.meta.dirname, '..', '..', '..', 'SOURCES.md'), 'utf8');
const ENTRIES = keys().map((k) => ({ key: k, section: entry(k).section }));
let html = '';

beforeAll(async () => {
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, smartypants: false });
  html = await renderSources(TEXT, ENTRIES, async (md) => (await processor.render(md)).code, (tex) => renderTex(tex, false));
});

describe('sources page', () => {
  it('every key gets an anchor', () => {
    expect(keys().length).toBeGreaterThan(80);
    for (const k of keys()) {
      const n = html.split(`id="${k}"`).length - 1;
      expect(n, `anchor for ${k}`).toBe(1);
      expect(html).toContain(`<strong class="source-key" id="${k}">[${k}]</strong>`);
    }
    // Keys that stand mid-line after another entry get theirs too.
    for (const k of ['Car26', 'Gre08', 'Gre13', 'Don07b', 'Don08b', 'BL92', 'Oni04', 'Bum13', 'RV16', 'RV21', 'Mac72', 'Cox73']) expect(html).toContain(`id="${k}"`);
    // A plain mention of a key links to its anchor.
    expect(html).toContain('<a href="#W03a">[W03a]</a>');
  });

  it('publishes 11.1 to 11.6 only', () => {
    for (const h of ['11.1 The mutation game', '11.2 The numbers game', '11.3 Related games', '11.4 Real forms', '11.5 Standard Lie theory', '11.6 Explorable explanations']) {
      expect(html).toMatch(new RegExp(`<h2[^>]*>${h.replace(/\./g, '\\.')}`));
    }
    for (const absent of ['How to read this section', 'Related interactive work surveyed', 'Technology and standards', 'Corrections to citations', 'Limits of the research', 'Two Games on a Dynkin Diagram: sources']) {
      expect(html).not.toContain(absent);
    }
    expect(html).not.toMatch(/<h[13][\s>]/);
    const slice = publishedSlice(TEXT);
    expect(slice.startsWith('### 11.1 ')).toBe(true);
    expect(slice).not.toContain('### 11.7 ');
    // A key defined outside the published sections fails the build, naming the key and its section.
    expect(() => checkKeysPublished([{ key: 'X1', section: '11.8' }])).toThrow(/X1 \(section 11\.8\)/);
    expect(() => checkKeysPublished(ENTRIES)).not.toThrow();
  });

  it('status labels spelled out', () => {
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).not.toMatch(/\[(S2|S|V|U|D)[\],;: ]/);
    for (const w of Object.values(STATUS_WORDS).slice(0, 4)) expect(text).toContain(`(${w}`);
    expect(spellOutLabels('a [V: every list; section 2.10] b')).toBe('a (checked by computation: every list; section 2.10) b');
    expect(spellOutLabels('[S, page image]')).toBe('(read in the source, page image)');
    expect(spellOutLabels('[S]; content [S2]')).toBe('(read in the source); content (reported by a later source)');
    expect(spellOutLabels('[S for the lemma, S2 for Bourbaki]')).toBe('(read in the source for the lemma, reported by a later source for Bourbaki)');
    expect(spellOutLabels('[U unless marked]')).toBe('(unverified unless marked)');
    expect(spellOutLabels('[S2, via X, arXiv:[1304.8033](https://arxiv.org/abs/1304.8033)]')).toBe('(reported by a later source, via X, arXiv:[1304.8033](https://arxiv.org/abs/1304.8033))');
    // Links, keys and citation mentions are never touched.
    expect(spellOutLabels('[10.1142/S1](https://doi.org/x) **[Sat60]** [Ste59] [DE08]')).toBe('[10.1142/S1](https://doi.org/x) **[Sat60]** [Ste59] [DE08]');
    const set = new Set(['W20']);
    expect(anchorKeys('**[W20]** text **[Zz9]**', set)).toBe('<strong class="source-key" id="W20">&#91;W20&#93;</strong> text **[Zz9]**');
    expect(linkKeyMentions('see [W20] and [W20](x) and [Other]', set)).toBe('see [\\[W20\\]](#W20) and [W20](x) and [Other]');
  });

  it('formulas typeset with renderTex', () => {
    const { formulas } = protectMath(publishedSlice(TEXT));
    expect(formulas.length).toBeGreaterThan(150);
    expect(html.split('<math').length - 1).toBe(formulas.length);
    // Each formula is exactly what renderTex gives, MathML included (A-12).
    for (const tex of formulas.slice(0, 20)) expect(html).toContain(renderTex(tex, false));
    expect(html).not.toContain('$');
    expect(html).not.toContain('MATHPLACEHOLDER');
    expect(html).not.toMatch(/<script/);
    expect(prepareSources(TEXT, keys()).markdown).not.toContain('$');
  });

  it('autolinks render as links', () => {
    expect(html).toContain('<a href="https://pypi.org/project/mutation-game/">');
  });
});
