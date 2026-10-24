// RT-01 phase 4 round, finding P4-RT-01-01. wythoffEdges is "exact" (SPEC 5.4, table "Geometry"; E-1), but on a
// Big board it converts each vertex entry with Number(arith.toBig(x)) (wythoff.ts:175) without a check, so an
// entry beyond 2^53 comes back rounded. On a SafeInt board the same input throws EngineOverflow (E-2), which is
// the documented answer when a value does not fit; the Big board returns wrong integers instead.
// Board: G2 with its two nodes swapped, C = [[2, -1], [-3, 2]] (fromAdjacency gives a Big board: the matrix is not
// the standard one), rings (2^52 + 1, 0), a dominant position with safe entries.
// Oracle (python3, reference/lie_games.py): sorted(wythoff_edges([[2, -1], [-3, 2]], [2**52 + 1, 0])) is the six edges
//   (-9007199254740994, 13510798882111491) - (-4503599627370497, 0)
//   (-9007199254740994, 13510798882111491) - (-4503599627370497, 13510798882111491)
//   (-4503599627370497, 0) - (4503599627370497, -13510798882111491)
//   (-4503599627370497, 13510798882111491) - (4503599627370497, 0)
//   (4503599627370497, -13510798882111491) - (9007199254740994, -13510798882111491)
//   (4503599627370497, 0) - (9007199254740994, -13510798882111491)
// The engine returns 13510798882111492 (the nearest double) in place of 13510798882111491 in every edge.
// Passing: either the exact edges (which number[] cannot hold here) or a throw of EngineOverflow, as on SafeInt.
// Run: npm test -w packages/engine -- test/unit/wythoff-edges-beyond-2-53.test.ts
import { expect, it } from 'vitest';
import { Big, boardFromName, EngineOverflow, fromAdjacency, SafeInt, wythoffEdges } from '../../src/index';

const ORACLE = [
  [['-9007199254740994', '13510798882111491'], ['-4503599627370497', '0']],
  [['-9007199254740994', '13510798882111491'], ['-4503599627370497', '13510798882111491']],
  [['-4503599627370497', '0'], ['4503599627370497', '-13510798882111491']],
  [['-4503599627370497', '13510798882111491'], ['4503599627370497', '0']],
  [['4503599627370497', '-13510798882111491'], ['9007199254740994', '-13510798882111491']],
  [['4503599627370497', '0'], ['9007199254740994', '-13510798882111491']],
];

// regression: P4-RT-01-01
it('wythoffEdges on a Big board never returns a rounded vertex entry (P4-RT-01-01)', () => {
  const C = [[2, -1], [-3, 2]];
  const board = fromAdjacency(C.map((row, i) => row.map((_, j) => (i === j ? 0 : -C[j]![i]!))));
  expect(board.arith).toBe(Big);
  let result: ReturnType<typeof wythoffEdges> | null = null;
  try {
    result = wythoffEdges(board, [2 ** 52 + 1, 0], 1000);
  } catch (e) {
    expect(e).toBeInstanceOf(EngineOverflow); // the SafeInt answer is acceptable
    return;
  }
  const got = result.items.map(([u, v]) => [u.map((x) => BigInt(x).toString()), v.map((x) => BigInt(x).toString())]);
  const key = (e: unknown) => JSON.stringify(e);
  expect(got.map(key).sort()).toEqual(ORACLE.map(key).sort());
});

// The edge of the safe range (RT-FIX P4). With the ring r on the long node of G2 the largest entry is 3r:
// on Big, r = 3002399751580330 gives 9007199254740990, a safe integer, and every edge comes back exact;
// r + 1 gives 9007199254740993, which no number holds, so EngineOverflow. SafeInt throws EngineOverflow on
// both, since it checks every product, and 3 times 6004799503160660 is formed on the way (E-2).
// oracle: sorted(L.wythoff_edges([[2, -1], [-3, 2]], [3002399751580330, 0]))
const R_SAFE = 3002399751580330;
const AT_EDGE = [
  [[-6004799503160660, 9007199254740990], [-3002399751580330, 0]],
  [[-6004799503160660, 9007199254740990], [-3002399751580330, 9007199254740990]],
  [[-3002399751580330, 0], [3002399751580330, -9007199254740990]],
  [[-3002399751580330, 9007199254740990], [3002399751580330, 0]],
  [[3002399751580330, -9007199254740990], [6004799503160660, -9007199254740990]],
  [[3002399751580330, 0], [6004799503160660, -9007199254740990]],
];

// regression: P4-RT-01-01
it('wythoffEdges at the edge of the safe range: exact up to 2^53 - 1 on Big, EngineOverflow past it, as on SafeInt', () => {
  const C = [[2, -1], [-3, 2]];
  const big = fromAdjacency(C.map((row, i) => row.map((_, j) => (i === j ? 0 : -C[j]![i]!))));
  expect(big.arith).toBe(Big);
  const g2 = boardFromName('G2');
  expect(g2.arith).toBe(SafeInt);
  const key = (e: unknown) => JSON.stringify(e);
  const onBig = wythoffEdges(big, [R_SAFE, 0], 1000);
  expect(onBig.truncated).toBe(false);
  expect(onBig.items.map(key).sort()).toEqual(AT_EDGE.map(key).sort());
  expect(() => wythoffEdges(big, [R_SAFE + 1, 0], 1000)).toThrow(EngineOverflow);
  expect(() => wythoffEdges(g2, [0, R_SAFE + 1], 1000)).toThrow(EngineOverflow);
  expect(() => wythoffEdges(g2, [0, 2 ** 52 + 1], 1000)).toThrow(EngineOverflow);
});
