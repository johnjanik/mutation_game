// Kostant's game (SPEC.md 2.7 F13, 2.12, 4 T9; 5.7 phase 1; P1-A1 instruction 5.10): the three phase-1
// lists of kostant[*] on every type and every starting node, through kostantPlay and toNumbers. The fourth
// list, affine_board_from_node, is phase 2 (P2-A1) and is not read here.
import { describe, expect, it } from 'vitest';
import { toNumbers } from '../../src/moves';
import { kostantPlay } from '../../src/play';
import { seededChoose } from '../helpers/p1';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';

covers('kostant[*].end_from_node', 'kostant[*].moves_from_node', 'kostant[*].final_numbers_from_node');

interface KostantRecord {
  end_from_node: number[][];
  moves_from_node: number[];
  final_numbers_from_node: number[][];
}

const kostant = golden.kostant as Record<string, KostantRecord>;

// three fixed seeds for the random orders of play (verify.py plays four random orders per start)
const SEEDS = [11, 22, 33];

describe("Kostant's game", () => {
  for (const T of TYPE_NAMES) {
    const rec = kostant[T]!;
    const n = boardOf(T).n;
    for (let i = 0; i < n; i++) {
      it(`Kostant game on ${T} from node ${i + 1}`, () => {
        const b = boardOf(T);
        const k = kostantPlay(b, i);
        expect(k.status).toBe('ended');
        intEq(k.position, rec.end_from_node[i], 'end_from_node');
        intEq(k.moves, rec.moves_from_node[i], 'moves_from_node');
        intEq(toNumbers(b, k.position), rec.final_numbers_from_node[i], 'final_numbers_from_node');
        for (const s of SEEDS) {
          const r = kostantPlay(b, i, seededChoose(s));
          expect(r.status).toBe('ended');
          intEq(r.position, rec.end_from_node[i], `end with seed ${s}`);
          intEq(r.moves, rec.moves_from_node[i], `moves with seed ${s}`);
        }
      });
    }
  }
});
