// RT-03, phase 4 round, attack 1 on wythoffEdges: on a board in Big arithmetic (every board that is not
// entry for entry a named type's, E-2: here A3 in another numbering, which classify calls finite), the
// edges are computed in bigint but returned through Number(), so an entry past 2^53 comes back rounded.
// E-2: off SafeInt the arithmetic is exact; on SafeInt a value past the safe range throws EngineOverflow.
// The oracle's wythoff_edges is exact. Rings of 2^52 + 1 and 2^52 + 2 are safe integers (checkRings
// accepts them); their sum after one firing, 2^53 + 3, is not representable as a number.
// Adopted from the lens branch (RT-FIX P4): the oracle bridge is replaced by the literal edges below, and
// the file's other block (attack 28, wythoffEdges at its cap on E8, not part of this finding) stays on
// the lens branch.
import { describe, expect, it } from 'vitest';
import * as E from '../../src/index';

// A3 numbered with its middle node first: C = 2I - A^T for the path 1 - 0 - 2.
const A = [[0, 1, 1], [1, 0, 0], [1, 0, 0]];
const RINGS = [4503599627370497, 4503599627370498, 0];

// oracle: python3 script with sys.path.insert(0, 'reference'); import lie_games as L;
//   e = sorted(L.wythoff_edges([[2, -1, -1], [-1, 2, 0], [-1, 0, 2]], [4503599627370497, 4503599627370498, 0]))
//   print(len(e)); for u, v in e: print(','.join(map(str, u)) + '|' + ','.join(map(str, v)))
const ORACLE_COUNT = 18;
const ORACLE_EDGES = [
  '-9007199254740995,0,4503599627370498|-9007199254740995,4503599627370497,9007199254740995',
  '-9007199254740995,0,4503599627370498|-4503599627370498,-4503599627370497,9007199254740995',
  '-9007199254740995,0,4503599627370498|-4503599627370497,0,-4503599627370498',
  '-9007199254740995,4503599627370497,9007199254740995|-4503599627370498,-4503599627370497,9007199254740995',
  '-9007199254740995,4503599627370497,9007199254740995|-4503599627370497,9007199254740995,4503599627370497',
  '-4503599627370498,-4503599627370497,9007199254740995|4503599627370498,-9007199254740995,4503599627370497',
  '-4503599627370497,0,-4503599627370498|0,4503599627370497,-9007199254740995',
  '-4503599627370497,0,-4503599627370498|4503599627370497,-4503599627370497,-9007199254740995',
  '-4503599627370497,9007199254740995,4503599627370497|0,9007199254740995,-4503599627370497',
  '-4503599627370497,9007199254740995,4503599627370497|4503599627370497,4503599627370498,0',
  '0,4503599627370497,-9007199254740995|0,9007199254740995,-4503599627370497',
  '0,4503599627370497,-9007199254740995|4503599627370497,-4503599627370497,-9007199254740995',
  '0,9007199254740995,-4503599627370497|4503599627370497,4503599627370498,0',
  '4503599627370497,-4503599627370497,-9007199254740995|9007199254740995,-9007199254740995,-4503599627370497',
  '4503599627370497,4503599627370498,0|9007199254740995,-4503599627370498,0',
  '4503599627370498,-9007199254740995,4503599627370497|9007199254740995,-9007199254740995,-4503599627370497',
  '4503599627370498,-9007199254740995,4503599627370497|9007199254740995,-4503599627370498,0',
  '9007199254740995,-9007199254740995,-4503599627370497|9007199254740995,-4503599627370498,0',
];

describe('RT-03 P4: wythoffEdges past 2^53 on a Big finite board', () => {
  it('the board is Big and finite, the rings are accepted', () => {
    const b = E.fromAdjacency(A);
    expect(b.arith).toBe(E.Big);
    expect(E.classify(b)[0]!.class).toBe('finite');
    expect(RINGS.every((x) => Number.isSafeInteger(x))).toBe(true);
  });

  // regression: P4-RT-03-01
  it('every edge equals the oracle, digit for digit (or the call throws EngineOverflow)', () => {
    const b = E.fromAdjacency(A);
    let got: string[];
    try {
      const r = E.wythoffEdges(b, RINGS, 1000);
      expect(r.truncated).toBe(false);
      got = r.items.map(([u, v]) => `${u.map((x) => BigInt(x).toString()).join(',')}|${v.map((x) => BigInt(x).toString()).join(',')}`).sort();
    } catch (e) {
      expect((e as Error).name).toBe('EngineOverflow');
      return;
    }
    const want = [...ORACLE_EDGES].sort();
    expect(got.length).toBe(ORACLE_COUNT);
    // The first firing at position 0 gives (-(2^52+1), 2^53+3, 2^52+1): the engine's number is 2^53+4.
    const exact = E.fire(b as E.Board<bigint>, RINGS.map((x) => BigInt(x)), 0).map(String);
    expect(exact).toEqual(['-4503599627370497', '9007199254740995', '4503599627370497']);
    expect(got).toEqual(want);
  });
});
