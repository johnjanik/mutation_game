// RT-08 (content rules), attack 39: SPEC.md 8.1 P8, "Node i is always called "node i" or "city i", never
// both in one sentence." The bridge sentence of 2.4(a) and the linked announcement of A-4 are exempt.
// Every sentence of every lesson source (prose and the caption, goal, question, reveal and explanation
// strings) is read; JSX tags and comments are dropped first.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = fileURLToPath(new URL('../../src/content/modules/', import.meta.url));
const BRIDGE = /The number on node <i>i<\/i> is the amount by which a mutation would lower city <i>i<\/i>\./g;

describe('RT-08: "node i" and "city i" in one sentence', () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.mdx')).sort()) {
    it(file, () => {
      const src = readFileSync(DIR + file, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(BRIDGE, ' ');
      // Prose with inline <Tex src="2"/> written back as its digits, then split into sentences.
      // Component tags are kept, so that their caption and other string properties are read too.
      const text = src.replace(/<Tex src="([^"]*)"\s*\/>/g, '$1').replace(/<\/?(i|strong|em|p|li|ul|span|G|Cite)\b[^>]*>/g, ' ');
      const hits = text
        .split(/(?<=[.?!])\s+|\n\s*\n|['"`]\s*[,}]/)
        .filter((s) => /\bnodes? (\d+|i|j)\b/.test(s) && /\bcit(y|ies) (\d+|i|j)\b/.test(s))
        .map((s) => s.replace(/\s+/g, ' ').trim());
      // Observed at 69546f0 in m0-start.mdx, the caption of b4:
      // "One Martian in city 2 has the numbers ${oneMartianNumbers}; mutating city 2 lowers it by 2, from 1 to −1, and fires node 2 on the Numbers board."
      expect(hits, `${file}: sentences naming a node and a city`).toEqual([]);
    });
  }
});
