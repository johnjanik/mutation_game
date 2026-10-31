// "node i" and "city i" in one sentence on /confusions/ (site/src/content/pages/confusions.mdx, read as source).
// Adopted from the RT-08 reproducer of the phase 6 round, attack 39. SPEC 8.1 P8: "Node i is always called "node i"
// or "city i", never both in one sentence." The only exemptions are the bridge sentence of 2.4(a) and the
// linked-view announcement of A-4. The section "The two games differ even on simply laced boards" said: "The first
// relation says: translate a population p into the position a=Cp, and a mutation at city i becomes the firing of
// node i."
// Run: npx vitest run --project site-unit site/tests/unit/content-confusions-node-city.test.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(fileURLToPath(new URL('../../src/content/pages/confusions.mdx', import.meta.url)), 'utf8');
const BRIDGE = 'The number on node $i$ is the amount by which a mutation would lower city $i$.';

describe('/confusions/ names city i and node i in one sentence', () => {
  // regression: P6-RT-08-07
  it('no sentence of the page other than the bridge sentence names both node i and city i', () => {
    const prose = src.replace(/^---[\s\S]*?---/, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split(BRIDGE).join(' ');
    const sentences = prose
      .replace(/<[^>]*>/g, '')
      .split(/(?<=[.?!])\s+/)
      .filter((s) => /\bnodes? \$?[0-9a-z]\$?(?![\w])/.test(s) && /\bcit(?:y|ies) \$?[0-9a-z]\$?(?![\w])/.test(s));
    // Observed at f07eec6: "The first relation says: translate a population $p$ into the position $a=Cp$, and a
    // mutation at city $i$ becomes the firing of node $i$."
    expect(sentences, 'SPEC 8.1 P8').toEqual([]);
  });
});
