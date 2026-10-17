// RT-04 finding P3-RT-04-01: a board NAME with more than 12 nodes passes the codec.
// SPEC 6.6 Validation: "a board that is not-a-board or has more than 12 nodes" makes the instance load
// its default state with the notice; SPEC 5.6 "Nodes of a custom board | 12"; CONTRACTS 4 resolveBoard
// "throws on not-a-board or > 12 nodes". boardOf() in urlCodec.ts checks the 12-node cap only for a
// `c:` matrix; a name goes to resolveBoard -> boardFromName, which builds A13, A12~ or A1000. On the
// tools whose registry says boards: 'all' (board, garden, form, lab, sandbox) the link is accepted.
// Run: npx vitest run --project site-unit site/tests/unit/redteam-RT-04-nodecap.test.ts
import { describe, expect, it } from 'vitest';
import { decodeState, LINK_NOTICE } from '../../src/lib/urlCodec';
import { resolveBoard, type ToolId, type ToolState } from '../../src/lib/state';
import { registry } from '../../src/tools/index';

function defaultsOf(tool: ToolId): ToolState {
  const entry = registry.find((e) => e.id === tool)!;
  const { caption: _c, ...fields } = entry.presets.default;
  return { schema: 1, tool, ...fields } as ToolState;
}

describe('P3-RT-04-01: more than 12 nodes through a board name', () => {
  for (const tool of ['board', 'garden', 'form', 'lab', 'sandbox'] as ToolId[]) {
    for (const g of ['A13', 'A12~', 'D13', 'B20']) {
      it(`/tools/${tool}?g=${g} gives the defaults and the notice`, () => {
        const D = defaultsOf(tool);
        const r = decodeState(`g=${g}`, tool, D);
        expect(r.notice).toBe(LINK_NOTICE);
        expect(r.state).toEqual(D);
      });
    }
  }
  it('the 12-node boundary through names: A12 and A11~ (12 nodes) are not refused for their size', () => {
    expect(resolveBoard('A11~').n).toBe(12);
    expect(resolveBoard('A12').n).toBe(12);
  });
  it('resolveBoard throws on a name with more than 12 nodes (CONTRACTS 4)', () => {
    expect(() => resolveBoard('A13')).toThrow();
  });
});
