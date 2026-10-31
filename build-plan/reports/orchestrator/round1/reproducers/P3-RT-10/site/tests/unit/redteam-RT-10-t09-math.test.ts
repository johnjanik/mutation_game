// RT-10 (spec-compliance), phase 3 round 1, attack 43(c): "Components contain no mathematics beyond calling
// the engine" (SPEC 7.3; CLAUDE.md "Mathematics lives only in packages/engine"). T9's end panel shows the
// road counts back to the new city, b_j = <beta^vee, alpha_j> = (C^T beta^vee)_j (SPEC 2.12), in
// data-out="returnCounts". The engine gives this vector (toNumbers(transposeBoard(board), beta^vee), or the
// row of node 0 of affineExtension, or coroot from phase 2); t09/kostant.ts multiplies the Cartan matrix by
// the coroot itself. The test fails while the component holds a Cartan matrix-vector product.
// Run: npx vitest run site/tests/unit/redteam-RT-10-t09-math.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = fileURLToPath(new URL('../../src/components/tools/t09/kostant.ts', import.meta.url));

describe('RT-10: T9 computes no Cartan product itself', () => {
  it('t09/kostant.ts does not multiply entries of board.cartan', () => {
    const lines = readFileSync(SOURCE, 'utf8').split('\n');
    const products = lines
      .map((l, k) => ({ line: k + 1, text: l.trim() }))
      .filter(({ text }) => !text.startsWith('//') && !text.startsWith('*') && /\*\s*BigInt\(String\(C\[k\]!\[j\]\)\)/.test(text));
    expect(products, JSON.stringify(products)).toEqual([]);
  });
});
