// RT-FIX P3-RT-07-04: the browser never loads the registry entries (their presets compute captions
// with the engine when loaded, and an eager glob put every tool's presets on every page). The URL codec
// reads the boards a tool offers (6.6 rule 8) from the small table of site/src/tools/offered.ts
// instead, so that table must equal the registry: every registry file is listed there with its own
// `boards`, and nothing else is. The browser check of what each page fetches is
// site/tests/e2e/registry-weight.spec.ts.
import { describe, expect, it } from 'vitest';
import { boardsOffered, registry } from '../../src/tools/index';
import { BOARDS_OFFERED } from '../../src/tools/offered';

describe('regressions', () => {
  // regression: P3-RT-07-04
  it('the table of offered boards equals the boards of every registry entry', () => {
    expect(registry.length).toBeGreaterThanOrEqual(13);
    for (const e of registry) {
      const listed = BOARDS_OFFERED[e.id];
      expect(listed, `${e.id} is registered but site/src/tools/offered.ts does not list its boards`).toBeDefined();
      expect(listed === 'all' ? 'all' : [...listed!], e.id).toEqual(e.boards === 'all' ? 'all' : [...e.boards]);
      expect(boardsOffered(e.id), e.id).toEqual(e.boards === 'all' ? 'all' : [...e.boards]);
    }
    expect(Object.keys(BOARDS_OFFERED).sort()).toEqual(registry.map((e) => e.id).sort());
  });

  // regression: P3-RT-07-04
  it('a tool without a registry entry offers every board, and an entries argument still decides', () => {
    expect(boardsOffered('rep')).toBe('all');
    expect(boardsOffered('weyl', [])).toBe('all');
    const weyl = registry.find((e) => e.id === 'weyl')!;
    expect(boardsOffered('weyl', [weyl])).toEqual(weyl.boards);
  });
});
