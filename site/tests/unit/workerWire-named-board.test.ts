// A board crosses the worker wire as its BoardSpec, rebuilt with resolveBoard (CONTRACTS.md 4), and a type name
// denotes the standard board of that name (SPEC.md 6.6). So a board travels by its name only when it is that
// standard board, position by position (the same matrix and the same labels); a named board in another
// position order, such as a restricted board whose positions follow the tau-orbits, travels by its matrix and
// comes back with the same matrix in the same position order, never as the standard board of its name.
// BoardSpec has no labels, so such a board comes back with labels 1..n and no name (decisions/RT-FIX-P6-worker-wire.md).
// Each call goes through engine.worker.ts's own handler, with the message and the reply cloned as postMessage clones them.
import { describe, expect, it } from 'vitest';
import { boardFromName, cartanNumbers, restrictedBoard, satakeCatalogue } from '@two-games/engine';
import type { AnyBoard, Board, RestrictedBoard, SatakeDiagram } from '@two-games/engine';
import { handleCall } from '../../src/lib/engine.worker';
import { deserialize, serialize, specOf, wireToError, type CallMessage, type ReplyMessage } from '../../src/lib/workerWire';

/** One call through the worker's handler, as worker.ts and engine.worker.ts make it. */
function viaWorker(fn: string, args: unknown[], board: AnyBoard): unknown {
  const message: CallMessage = structuredClone({ id: 1, fn, args: args.map(serialize), board: specOf(board) });
  const reply: ReplyMessage = structuredClone(handleCall(message));
  if (!reply.ok) throw wireToError(reply.error);
  return deserialize(reply.result);
}

/** True when the board that came back is the board that was sent, or that board's matrix without its name. */
function sameBoardOrItsMatrix(back: AnyBoard, sent: AnyBoard): boolean {
  if (back.name === undefined) return true;
  return back.name === sent.name && back.labels.length === sent.labels.length && back.labels.every((l, i) => l === sent.labels[i]);
}

const TYPES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D4', 'D5', 'D6', 'D7', 'D8', 'E6', 'E7', 'E8', 'F4', 'G2'];

describe('a named board crosses the worker wire by its name only when it is the standard board of that name', () => {
  // regression: P6-RT-03-02
  // regression: P6-RT-06-02
  it('E8 e8(-24): the restricted board that comes back from the worker has the matrix of the main thread in position order, not the standard F4', () => {
    const board = boardFromName('E8') as Board;
    const e = satakeCatalogue('E8').find((x) => x.real_form === 'e8(-24)')!;
    const d: SatakeDiagram = { board, black: e.black_nodes, tau: e.tau };
    const direct = restrictedBoard(d);
    expect(direct.board.name).toBe('F4');
    expect([...direct.board.labels]).toEqual([4, 3, 2, 1]);
    const back = viaWorker('restrictedBoard', [d], board) as RestrictedBoard;
    const matrix = [[2, -1, 0, 0], [-1, 2, -2, 0], [0, -1, 2, -1], [0, 0, -1, 2]];
    expect(cartanNumbers(direct.board)).toEqual(matrix);
    expect({ n: back.board.n, cartan: cartanNumbers(back.board) }).toEqual({ n: 4, cartan: matrix });
    expect(cartanNumbers(back.board)).toEqual(back.cartan.map((row) => row.map(Number)));
    expect(sameBoardOrItsMatrix(back.board, direct.board), `name ${back.board.name}, labels ${[...back.board.labels]}`).toBe(true);
  });

  // regression: P6-RT-03-02
  // regression: P6-RT-06-02
  it('every restricted board of the Satake catalogue comes back from the worker with its own matrix in position order; a standard one keeps its name and labels', () => {
    const byMatrix: string[] = [];
    let count = 0;
    for (const t of TYPES) {
      const board = boardFromName(t) as Board;
      for (const e of satakeCatalogue(t)) {
        if (e.black_nodes.length === board.n) continue; // a compact form: the empty board (worker-reply-settles.test.ts)
        const d: SatakeDiagram = { board, black: e.black_nodes, tau: e.tau };
        const direct = restrictedBoard(d).board;
        const back = (viaWorker('restrictedBoard', [d], board) as RestrictedBoard).board;
        const where = `${t} ${e.real_form}`;
        count++;
        expect(cartanNumbers(back), where).toEqual(cartanNumbers(direct));
        expect(sameBoardOrItsMatrix(back, direct), where).toBe(true);
        const std = boardFromName(direct.name!);
        const standard = JSON.stringify(cartanNumbers(std)) === JSON.stringify(cartanNumbers(direct)) && std.labels.every((l, i) => l === direct.labels[i]);
        if (standard) expect({ name: back.name, labels: [...back.labels] }, where).toEqual({ name: direct.name, labels: [...direct.labels] });
        else byMatrix.push(where);
      }
    }
    expect(count).toBe(135);
    // MERGE on P6-A1: 7 of the 135 restricted boards carry a name while their matrix stays in orbit order.
    expect(byMatrix).toEqual(['A3 su(2,2)', 'C2 sp(4,R)', 'C4 sp(2,2)', 'D4 so*(8)', 'E6 e6(2)', 'E6 e6(-14)', 'E8 e8(-24)']);
  });

  // regression: P6-RT-03-02
  it('a named board in another position order sent to the worker as an argument arrives with its own matrix', () => {
    const board = boardFromName('E6') as Board;
    const e = satakeCatalogue('E6').find((x) => x.real_form === 'e6(2)')!;
    const rb = restrictedBoard({ board, black: e.black_nodes, tau: e.tau }).board;
    expect(rb.name).toBe('F4');
    expect(viaWorker('cartanNumbers', [rb], rb)).toEqual(cartanNumbers(rb));
    expect(specOf(rb)).toEqual({ cartan: cartanNumbers(rb) });
    // the standard board of a name, and its Big copy, still travel by the name (worker-routing.test.ts)
    expect(specOf(boardFromName('F4'))).toBe('F4');
  });
});
