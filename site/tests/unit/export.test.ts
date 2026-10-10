// P1-A2: JSON data export (SPEC.md 6.6 "Data export", 4.0 "Share and export"; CONTRACTS.md 4).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { downloadData, exportJSON } from '../../src/lib/export';
import { positionsOf, type ToolState } from '../../src/lib/state';

const enginePkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../../packages/engine/package.json', import.meta.url)), 'utf8')) as { version: string };

const STATE: ToolState = { schema: 1, tool: 'board', board: 'A2', view: 'numbers', mode: 'legal', coords: 'numbers', start: [1, 1], moves: [1, 2, 1] };

describe('exportJSON', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('fields', () => {
    const derived = { positions: positionsOf(STATE), gameOver: true };
    const text = exportJSON(STATE, derived);
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "state": {'); // two spaces
    const doc = JSON.parse(text);
    expect(Object.keys(doc)).toEqual(['schema', 'tool', 'state', 'engineVersion', 'commit', 'derived']);
    expect(doc.schema).toBe(1);
    expect(doc.tool).toBe('board');
    expect(doc.state).toEqual(STATE);
    expect(doc.engineVersion).toBe(enginePkg.version);
    expect(typeof doc.commit).toBe('string');
    expect(doc.commit.length).toBeGreaterThan(0);
    expect(doc.derived).toEqual({ positions: [[1, 1], [-1, 2], [1, -2], [-1, -1]], gameOver: true });
    // Only the fields of the state are exported, never positions or options carried along.
    const extra = JSON.parse(exportJSON({ ...STATE, positions: [[1]] } as unknown as ToolState, {}));
    expect(extra.state).toEqual(STATE);
  });

  it('the commit comes from the build', async () => {
    vi.stubEnv('PUBLIC_GIT_COMMIT', 'abc1234');
    vi.resetModules();
    const fresh = await import('../../src/lib/export');
    expect(JSON.parse(fresh.exportJSON(STATE, {})).commit).toBe('abc1234');
    vi.stubEnv('PUBLIC_GIT_COMMIT', '');
    vi.resetModules();
    const unset = await import('../../src/lib/export');
    expect(JSON.parse(unset.exportJSON(STATE, {})).commit).toBe('unknown');
  });

  it('integers above 2^53 are strings', () => {
    const derived = {
      safe: [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 0, 3n, -7n],
      unsafe: [9007199254740993n, -(2n ** 80n), 2 ** 60],
      floats: [0.5, -1.25],
      roots: new Map<string, bigint>([['1,0', 2n ** 64n]]),
      rationals: [{ num: 2n, den: 3n }, { num: -4n, den: 1n }],
      nested: { matrix: [[2n, -1n], [-1n, 2n]] },
    };
    const doc = JSON.parse(exportJSON({ ...STATE, start: ['9007199254740993', 1] }, derived));
    expect(doc.derived.safe).toEqual([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 0, 3, -7]);
    expect(doc.derived.unsafe).toEqual(['9007199254740993', '-1208925819614629174706176', '1152921504606846976']);
    expect(doc.derived.floats).toEqual([0.5, -1.25]);
    expect(doc.derived.roots).toEqual([['1,0', '18446744073709551616']]);
    expect(doc.derived.rationals).toEqual(['2/3', '-4']);
    expect(doc.derived.nested.matrix).toEqual([[2, -1], [-1, 2]]);
    expect(doc.state.start).toEqual(['9007199254740993', 1]);
  });
});

describe('downloadData', () => {
  it('download data', () => {
    const derived = { positions: positionsOf(STATE) };
    const d = downloadData('board', 'b2', STATE, derived);
    expect(d.filename).toBe('board-b2.json');
    expect(d.text).toBe(exportJSON(STATE, derived));
    expect(downloadData('board', '', STATE, derived).filename).toBe('board-board.json');
    expect(downloadData('garden', 'b3', { ...STATE, tool: 'garden' }, {}).filename).toBe('garden-b3.json');
  });
});
