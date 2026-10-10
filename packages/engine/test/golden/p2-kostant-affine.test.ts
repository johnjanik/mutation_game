// The golden key kostant[*].affine_board_from_node (SPEC.md 2.12 "Building affine boards from finite
// ones", 5.7 phase 2; P2-A1 instruction 5.7 and 5.16): for each type and each starting position i, the
// recipe board of verify.py lines 899 to 913 from kostantPlay(b, i).position, toNumbers and coroot;
// identifyAffine of it equals the golden name at index i; it equals affineExtension(b, short) with short
// true exactly when d_i is not the largest weight.
import { describe, expect, it } from 'vitest';
import { cartanNumbers } from '../../src/board';
import { affineExtension } from '../../src/affine';
import { cartanClass, identifyAffine, symmetrizer } from '../../src/classify';
import { coroot } from '../../src/form';
import { toNumbers } from '../../src/moves';
import { kostantPlay } from '../../src/play';
import { ratSign, ratSub } from '../../src/rational';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';
import { boardFromCartan } from '../helpers/p2';

covers('kostant[*].affine_board_from_node');

interface KostantRecord {
  affine_board_from_node: string[];
}
const kostant = golden.kostant as Record<string, KostantRecord>;

describe('Kostant recipe names the affine board', () => {
  for (const T of TYPE_NAMES) {
    const rec = kostant[T]!;
    const n = boardOf(T).n;
    for (let i = 0; i < n; i++) {
      it(`${T} from node ${i + 1}: ${rec.affine_board_from_node[i]}`, () => {
        const b = boardOf(T);
        const C = cartanNumbers(b);
        const k = kostantPlay(b, i);
        expect(k.status).toBe('ended');
        const e = k.position;
        const a = toNumbers(b, e);
        const ev = coroot(b, e);
        const back: number[] = [];
        for (let j = 0; j < n; j++) {
          let s = 0;
          for (let t = 0; t < n; t++) s += ev[t]! * C[t]![j]!;
          back.push(s);
        }
        expect(a.every((x) => x >= 0)).toBe(true);
        expect(back.every((x) => x >= 0)).toBe(true);
        const Cx: number[][] = [[2, ...back.map((x) => -x)]];
        for (let j = 0; j < n; j++) Cx.push([-a[j]!, ...C[j]!]);
        const bx = boardFromCartan(Cx);
        expect(cartanClass(bx)).toBe('affine');
        expect(identifyAffine(bx)).toBe(rec.affine_board_from_node[i]);
        // the long node is the one of largest weight; from it the untwisted board, else the twisted one
        const d = symmetrizer(b)!;
        let longest = d[0]!;
        for (const x of d) if (ratSign(ratSub(x, longest)) > 0) longest = x;
        const short = ratSign(ratSub(d[i]!, longest)) !== 0;
        intEq(Cx, cartanNumbers(affineExtension(b, short).board), 'the recipe board is the affine extension');
        if (golden.types[T]!.simply_laced) {
          expect(back).toEqual(a);
          expect(short).toBe(false);
        }
        if (short) expect(rec.affine_board_from_node[i]).toContain('^(');
        else expect(rec.affine_board_from_node[i]).toMatch(/~$/);
      });
    }
  }
});
