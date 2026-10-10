// P2-A3: the shared board editor's model, presets and edit history (SPEC 4 T4 Editor and Presets, 2.1,
// 5.6, 6.1, 9.2). Pure functions, no browser. Golden values (the test boards, the affine names) are read
// from reference/golden_data.json, never typed. No covers() call: P2-A1's golden tests own these keys.
import { describe, expect, it } from 'vitest';
import { CAPS, boardFromName, boardKind, cartanNumbers, fromAdjacency } from '@two-games/engine';
import golden from '../../../reference/golden_data.json';
import { resolveBoard } from '../../src/lib/state';
import { nodePositions } from '../../src/components/draw/layouts';
import {
  RESETS_PLAY,
  addNode,
  emptyBoard,
  fromSpec,
  gridOf,
  kindOf,
  moveNode,
  removeNode,
  roadsBetween,
  setRoads,
  toSpec,
  validGrid,
  type EditorBoard,
} from '../../src/components/board/editor/model';
import { AFFINE_NAMES, FINITE_NAMES, TWISTED_NAMES, namedPresets } from '../../src/components/board/editor/namedPresets';
import { editorPresets, testBoard, testBoardPresets } from '../../src/components/board/editor/presets';
import { EditHistory } from '../../src/components/board/editor/history';

const G = golden as unknown as {
  types: Record<string, { cartan: number[][] }>;
  affine: Record<string, { name: string; constructor_name: string; cartan_node0_first: number[][] }>;
  twisted_affine: { name: string; cartan: number[][] }[];
  classification_tests: { label: string; cartan: number[][] }[];
};

function boardOf(b: EditorBoard) {
  return resolveBoard(toSpec(b));
}

function nodes(n: number): EditorBoard {
  let b = emptyBoard(1);
  for (let k = 1; k < n; k++) b = addNode(b)!;
  return b;
}

describe('the editor model', () => {
  it('the editor refuses a 13th node', () => {
    let b = emptyBoard(1);
    for (let k = 2; k <= CAPS.customNodes; k++) {
      const next = addNode(b);
      expect(next, `node ${k}`).not.toBeNull();
      b = next!;
      expect(b.cartan.length).toBe(k);
      expect(validGrid(b.xy, k)).toBe(true);
    }
    expect(b.cartan.length).toBe(12);
    expect(addNode(b)).toBeNull();
    // A host cannot raise the cap through the prop either.
    expect(addNode(b, 20)).toBeNull();
    expect(addNode(nodes(5), 5)).toBeNull();
    // The minimum is one node.
    expect(removeNode(emptyBoard(1), 0)).toBeNull();
  });

  it('the editor refuses a fifth road in either direction and allows (4, 1) and (m, 0)', () => {
    const b = nodes(2);
    expect(setRoads(b, 0, 1, 5, 0)).toBeNull();
    expect(setRoads(b, 0, 1, 0, 5)).toBeNull();
    expect(setRoads(b, 1, 0, 5, 1)).toBeNull();
    expect(setRoads(b, 0, 1, -1, 0)).toBeNull();
    expect(setRoads(b, 0, 1, 1.5, 0)).toBeNull();
    expect(setRoads(b, 0, 0, 1, 1)).toBeNull();
    expect(setRoads(b, 0, 1, 4, 4, 9)).not.toBeNull();
    expect(setRoads(b, 0, 1, 5, 4, 9)).toBeNull();
    // A2^(2): four roads from node 2 to node 1 and one back, C = [[2, -4], [-1, 2]] (golden twisted_affine).
    const a22 = setRoads(b, 1, 0, 4, 1)!;
    const twisted = G.twisted_affine.find((t) => t.name === 'A2^(2)')!;
    expect(a22.cartan).toEqual(twisted.cartan);
    expect(kindOf(a22)).toBe('gcm');
    // (m, 0) for every m from 1 to 4 is a one-way board.
    for (let m = 1; m <= 4; m++) {
      const oneWay = setRoads(b, 0, 1, m, 0)!;
      expect(kindOf(oneWay)).toBe('one-way');
      expect(boardKind(oneWay.cartan)).toBe('one-way');
      expect(roadsBetween(oneWay, 0, 1)).toEqual({ out: m, back: 0 });
      expect(roadsBetween(oneWay, 1, 0)).toEqual({ out: 0, back: m });
    }
    // The golden one-way road is one road from city 1 to city 2.
    expect(setRoads(b, 0, 1, 1, 0)!.cartan).toEqual(G.classification_tests.find((t) => t.label === 'one-way road')!.cartan);
  });

  it('setRoads(i, j, out, back) writes C[j][i] = -out and C[i][j] = -back', () => {
    let b = nodes(3);
    b = setRoads(b, 0, 2, 3, 1)!; // 3 roads from 1 to 3, 1 back
    b = setRoads(b, 1, 2, 2, 0)!; // 2 roads from 2 to 3, none back
    expect(b.cartan[2]![0]).toBe(-3);
    expect(b.cartan[0]![2]).toBe(-1);
    expect(b.cartan[2]![1]).toBe(-2);
    expect(b.cartan[1]![2]).toBe(0);
    // The engine's fromAdjacency on A (A[i][j] roads from i to j) gives the same matrix: C = 2I - A^T.
    const A = [
      [0, 0, 3],
      [0, 0, 2],
      [1, 0, 0],
    ];
    expect(cartanNumbers(fromAdjacency(A))).toEqual(b.cartan);
    expect(roadsBetween(b, 0, 2)).toEqual({ out: 3, back: 1 });
    expect(roadsBetween(b, 2, 0)).toEqual({ out: 1, back: 3 });
  });

  it('moveNode snaps to whole grid points, refuses a taken point and clamps to 0..11', () => {
    const b = nodes(3); // (0,0), (1,0), (2,0)
    expect(b.xy).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(moveNode(b, 0, 4.4, 2.6)!.xy[0]).toEqual([4, 3]);
    expect(moveNode(b, 0, 1.2, 0.3)).toBeNull(); // node 2 is at (1, 0)
    expect(moveNode(b, 2, 40, -3)!.xy[2]).toEqual([11, 0]);
    expect(moveNode(b, 2, -1, 99)!.xy[2]).toEqual([0, 11]);
    expect(moveNode(b, 1, 1, 0)!.xy).toEqual(b.xy); // its own point
    expect(moveNode(b, 3, 5, 5)).toBeNull();
    for (const p of [moveNode(b, 0, 7.5, 7.5)!, moveNode(b, 1, 11.4, 11.4)!]) expect(validGrid(p.xy, 3)).toBe(true);
  });

  it('removing a node renumbers the labels 1..n in old order and asks the host to reset start and moves', () => {
    let b = nodes(4);
    b = setRoads(b, 0, 1, 1, 1)!;
    b = setRoads(b, 1, 2, 2, 1)!;
    b = setRoads(b, 2, 3, 1, 3)!;
    const before = b;
    const after = removeNode(b, 1)!; // remove node 2
    expect(after.cartan).toEqual([
      [before.cartan[0]![0], before.cartan[0]![2], before.cartan[0]![3]],
      [before.cartan[2]![0], before.cartan[2]![2], before.cartan[2]![3]],
      [before.cartan[3]![0], before.cartan[3]![2], before.cartan[3]![3]],
    ]);
    expect(after.xy).toEqual([before.xy[0], before.xy[2], before.xy[3]]);
    const board = boardOf(after);
    expect(board.labels).toEqual([1, 2, 3]);
    // Old node 4 (3 roads back to node 3) is now node 3, still with those roads to the old node 3.
    expect(roadsBetween(after, 1, 2)).toEqual({ out: 1, back: 3 });
    expect(RESETS_PLAY['remove-node']).toBe(true);
    expect(RESETS_PLAY['add-node']).toBe(true);
    expect(RESETS_PLAY.preset).toBe(true);
    expect(RESETS_PLAY.roads).toBe(false);
    expect(RESETS_PLAY.move).toBe(false);
    expect(removeNode(b, 4)).toBeNull();
  });

  it('a named or circle layout becomes whole grid points that obey 6.1', () => {
    const names = [...FINITE_NAMES, ...AFFINE_NAMES, ...TWISTED_NAMES, 'pentagon', 'square'];
    for (const name of names) {
      const board = resolveBoard(name);
      const e = fromSpec(name, board);
      expect(validGrid(e.xy, board.n), name).toBe(true);
      expect(e.cartan, name).toEqual(cartanNumbers(board));
    }
    // A row stays a row; the D4 fork keeps node 2 between its three neighbours.
    expect(fromSpec('A3', resolveBoard('A3')).xy).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(fromSpec('D4', resolveBoard('D4')).xy).toEqual([
      [0, 1],
      [1, 1],
      [2, 2],
      [2, 0],
    ]);
    for (const t of G.classification_tests) {
      const board = resolveBoard({ cartan: t.cartan });
      const e = fromSpec({ cartan: t.cartan }, board);
      expect(validGrid(e.xy, board.n), t.label).toBe(true);
      expect(nodePositions(board).circle).toBe(true);
    }
    // A spec whose coordinates obey 6.1 keeps them; one that breaks it is laid out again.
    const kept = fromSpec({ cartan: [[2, -1], [-1, 2]], xy: [[3, 4], [9, 9]] }, resolveBoard({ cartan: [[2, -1], [-1, 2]] }));
    expect(kept.xy).toEqual([
      [3, 4],
      [9, 9],
    ]);
    const redone = fromSpec({ cartan: [[2, -1], [-1, 2]], xy: [[3, 4], [3, 4]] }, resolveBoard({ cartan: [[2, -1], [-1, 2]] }));
    expect(validGrid(redone.xy, 2)).toBe(true);
    expect(gridOf([[0.5, 0.5], [0.4, 0.6]], false).length).toBe(2);
  });
});

describe('the editor presets', () => {
  it('editorPresets lists the 32 types, the 42 affine boards and the 13 test boards, and every entry resolves to the matrix of boardFromName or of the golden record', () => {
    const all = editorPresets();
    const by = (g: string) => all.filter((p) => p.group === g);
    expect(by('finite').map((p) => p.board)).toEqual(Object.keys(G.types));
    expect(by('affine').map((p) => p.board)).toEqual(Object.values(G.affine).map((a) => a.constructor_name));
    expect(by('twisted').map((p) => p.board)).toEqual(G.twisted_affine.map((t) => t.name));
    expect(by('test').map((p) => p.label)).toEqual(G.classification_tests.map((t) => t.label));
    expect(all.length).toBe(32 + 32 + 10 + 13);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const p of all) {
      const board = resolveBoard(p.board);
      if (typeof p.board === 'string') {
        expect(cartanNumbers(board), p.id).toEqual(cartanNumbers(boardFromName(p.board)));
      } else {
        const rec = G.classification_tests.find((t) => t.label === p.label)!;
        expect(cartanNumbers(board), p.id).toEqual(rec.cartan);
        expect(board.labels).toEqual(rec.cartan.map((_, k) => k + 1));
      }
    }
    // The untwisted boards match the golden matrices, node 0 first (labels start at 0, E-7).
    for (const [type, a] of Object.entries(G.affine)) {
      const board = resolveBoard(a.constructor_name);
      expect(cartanNumbers(board), type).toEqual(a.cartan_node0_first);
      expect(Math.min(...board.labels)).toBe(0);
    }
    for (const t of G.twisted_affine) expect(cartanNumbers(resolveBoard(t.name)), t.name).toEqual(t.cartan);
    // namedPresets is the client-safe part; the triangle and the four-armed star say what M3 calls them.
    expect(namedPresets().length).toBe(74);
    expect(namedPresets().find((p) => p.id === 'A2~')!.label).toContain('triangle');
    expect(namedPresets().find((p) => p.id === 'D4~')!.label).toContain('four arms');
    expect(testBoardPresets().length).toBe(13);
    expect(testBoard('one-way road')).toEqual({ cartan: G.classification_tests.find((t) => t.label === 'one-way road')!.cartan });
    expect(() => testBoard('no such board')).toThrow();
  });
});

describe('the edit history', () => {
  it('undo after removeNode restores the old matrix, coordinates and labels', () => {
    let b = nodes(4);
    b = setRoads(b, 0, 1, 1, 1)!;
    b = setRoads(b, 2, 3, 2, 1)!;
    const h = new EditHistory('A3');
    h.push(toSpec(b));
    const removed = removeNode(b, 0)!;
    h.push(toSpec(removed));
    expect(resolveBoard(h.current).labels).toEqual([1, 2, 3]);
    const back = h.undo()!;
    expect(back).toEqual(toSpec(b));
    expect(resolveBoard(back).labels).toEqual([1, 2, 3, 4]);
    expect(cartanNumbers(resolveBoard(back))).toEqual(b.cartan);
    expect(h.redo()).toEqual(toSpec(removed));
    expect(h.redo()).toBeNull();
    expect(h.reset()).toBe('A3');
    expect(h.canUndo).toBe(false);
    expect(h.reset()).toBeNull();
    // An edit after an undo discards the redo.
    h.push(toSpec(b));
    h.undo();
    h.push(toSpec(removed));
    expect(h.canRedo).toBe(false);
    expect(h.edits).toBe(1);
  });
});
