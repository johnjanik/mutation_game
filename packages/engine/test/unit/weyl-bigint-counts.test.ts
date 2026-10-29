// RT-11 attack 23 (SPEC.md 5.1 E-4: "Counts that can be large are bigint: the products in weylDimension,
// countCompleteGames, commutationClassSize"). Every golden value of weyl_dimension is at most 3875 and every
// n_reduced_words_w0 is below 2^53, so an implementation that counts in `number` and wraps the result in
// BigInt passes every golden test. These cases are beyond 2^53; the expected values were printed by the
// oracle (reference/lie_games.py weyl_dimension, count_reduced_words_w0, commutation_class_size; the calls
// are in the comment above each literal) and are not golden keys.
// Adopted from the red team (P3-RT-11-02): it passes with the engine as it stands and fails when
// weylDimension forms its products in doubles (mutant M28) or countCompleteGames counts in doubles (M28b).
import { describe, expect, it } from 'vitest';
import { commutationClassSize } from '../../src/heaps';
import { play } from '../../src/play';
import { countCompleteGames, weylDimension } from '../../src/weyl';
import { boardOf } from '../golden/_harness';

describe('bigint counts beyond 2^53 (E-4)', () => {
  // regression: P3-RT-11-02
  it('weylDimension on E8 with lambda = rho and lambda = 10 rho equals the oracle', () => {
    const b = boardOf('E8');
    const d1 = weylDimension(b, [1, 1, 1, 1, 1, 1, 1, 1]);
    expect(typeof d1).toBe('bigint');
    // oracle: python3 -c "import sys; sys.path.insert(0, 'reference'); import lie_games as L; print(L.weyl_dimension(L.cartan('E', 8), [1]*8))"
    expect(d1).toBe(1329227995784915872903807060280344576n); // 2^120
    expect(d1 > 2n ** 53n).toBe(true);
    const d10 = weylDimension(b, [10, 10, 10, 10, 10, 10, 10, 10]);
    // oracle: python3 -c "import sys; sys.path.insert(0, 'reference'); import lie_games as L; print(L.weyl_dimension(L.cartan('E', 8), [10]*8))"
    expect(d10).toBe(
      92709068817830061978520606494193845859707401497097037749844778027824097442147966967457359038488841338006006032592594389655201n,
    );
  });

  // regression: P3-RT-11-02
  it('countCompleteGames on D7 with a cap of |W| = 322560 equals the oracle', { timeout: 120000 }, () => {
    // A8 (|W| = 362880) is not used: its count, 29258366996258488320, happens to come out exact in doubles;
    // the D7 count does not (in doubles it is 178970187289470992384).
    const c = countCompleteGames(boardOf('D7'), 322560);
    expect(typeof c).toBe('bigint');
    // oracle: python3 -c "import sys; sys.path.insert(0, 'reference'); import lie_games as L; print(L.count_reduced_words_w0(L.cartan('D', 7), limit=400000))"
    // prints (178970187289470966912, 322560)
    expect(c).toBe(178970187289470966912n);
    expect(c! > 2n ** 53n).toBe(true);
  });

  // regression: P3-RT-11-02
  it('commutationClassSize of the longest word of E8 equals the oracle', { timeout: 120000 }, () => {
    const b = boardOf('E8');
    const word = play(b, [1, 1, 1, 1, 1, 1, 1, 1]).word;
    expect(word.length).toBe(120);
    const s = commutationClassSize(b, word);
    expect(typeof s).toBe('bigint');
    // oracle: python3 -c "import sys; sys.path.insert(0, 'reference'); import lie_games as L; E = L.cartan('E', 8); print(L.commutation_class_size(E, L.play(E, [1]*8)[1]))"
    expect(s).toBe(111561641190593193600n);
  });
});
