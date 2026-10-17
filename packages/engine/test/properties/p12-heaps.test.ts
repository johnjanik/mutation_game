// SPEC.md 5.7, property 12: heap is unchanged by exchanging adjacent moves at unjoined nodes, and
// commutationClassSize is the same for both words. The board is drawn at random from the type list; a
// random word of positions of length 0 to 16 (plan: so that the bit-mask count stays small) and an index
// k. "Unchanged" means the multiset of (node, level), which is heapKey; the list of levels is permuted:
// the two swapped bricks exchange levels and every other brick keeps its level. Guards against vacuity
// (plan): the number of runs in which a swap happened is positive, and one fixed counter-example on A3
// where a swap of joined moves changes the key. Registers no golden key.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cartanNumbers } from '../../src/board';
import { commutationClassSize, heap, heapKey } from '../../src/heaps';
import { TYPE_NAMES, boardOf } from '../golden/_harness';

// fixed seed and run count, recorded in decisions/P3-A2.md (CONTRACTS.md 3)
const SEED = 20261010;
const NUM_RUNS = 600;

const caseArb = fc.constantFrom(...TYPE_NAMES).chain((T) => {
  const n = boardOf(T).n;
  return fc.tuple(
    fc.constant(T),
    fc.array(fc.integer({ min: 0, max: n - 1 }), { minLength: 0, maxLength: 16 }),
    fc.nat(15),
  );
});

describe('property 12', () => {
  it('heap and class size unchanged by exchanging unjoined adjacent moves', () => {
    let swaps = 0;
    fc.assert(
      fc.property(caseArb, ([T, word, k]) => {
        const b = boardOf(T);
        const C = cartanNumbers(b);
        if (k + 1 >= word.length) return;
        const x = word[k]!;
        const y = word[k + 1]!;
        if (x === y || C[x]![y] !== 0 || C[y]![x] !== 0) return;
        const swapped = [...word];
        swapped[k] = y;
        swapped[k + 1] = x;
        const frozen = Object.freeze([...word]);
        expect(heapKey(b, swapped)).toBe(heapKey(b, frozen));
        expect(commutationClassSize(b, swapped)).toBe(commutationClassSize(b, frozen));
        const h1 = heap(b, frozen);
        const h2 = heap(b, swapped);
        const permuted = [...h1];
        permuted[k] = h1[k + 1]!;
        permuted[k + 1] = h1[k]!;
        expect(h2).toEqual(permuted);
        expect(frozen).toEqual(word);
        swaps += 1;
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
    expect(swaps).toBeGreaterThan(0);
  });

  it('a swap of joined moves changes the key, so the property is not vacuous', () => {
    const b = boardOf('A3');
    expect(heapKey(b, [0, 1, 0])).not.toBe(heapKey(b, [1, 0, 1]));
    expect(heap(b, [0, 1, 0])).toEqual([1, 2, 3]);
    expect(commutationClassSize(b, [0, 1, 0])).toBe(1n);
    // the unjoined pair on A3: nodes 1 and 3
    expect(heapKey(b, [0, 2, 1])).toBe(heapKey(b, [2, 0, 1]));
    expect(commutationClassSize(b, [0, 2, 1])).toBe(2n);
  });
});
