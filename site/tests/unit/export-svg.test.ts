// P2-A6: the pure parts of SVG and PNG export (SPEC.md 4.0 "Share and export", 8.3 footer line,
// 6.1 labels in exports only; CONTRACTS.md 4). Runs under environment 'node': no DOM, so the module
// must load without touching one, and the DOM functions must refuse with a clear error.
import { describe, expect, it } from 'vitest';
import * as ex from '@lib/export';
import { exportFileName, footerLines, footerText, pngSize } from '@lib/export';

describe('export module without a DOM', () => {
  it('the export module loads in Node without a DOM', async () => {
    expect(typeof ex.exportSVG).toBe('function');
    expect(typeof ex.exportPNG).toBe('function');
    expect(typeof ex.exportJSON).toBe('function');
    expect(typeof document).toBe('undefined');
    expect(() => ex.exportSVG({} as SVGSVGElement, null)).toThrow('exportSVG needs a browser');
    expect(() => ex.exportSVG({} as SVGSVGElement, { boardName: 'A2', link: 'http://localhost/' })).toThrow('exportSVG needs a browser');
    const png = ex.exportPNG({} as SVGSVGElement, null);
    expect(png).toBeInstanceOf(Promise);
    await expect(png).rejects.toThrow('exportSVG needs a browser');
  });
});

describe('footer', () => {
  it('footerText composes board name and link', () => {
    expect(footerText({ boardName: 'A2', link: 'http://localhost/tools/board?z=1&g=A2&v=p&c=p&s=1,0&w=1' })).toBe(
      'A2 · http://localhost/tools/board?z=1&g=A2&v=p&c=p&s=1,0&w=1',
    );
    expect(footerText({ boardName: 'custom board', link: 'x' })).toBe('custom board · x');
  });

  it('footerLines wraps at the limit and drops no character', () => {
    const short = 'A2 · http://localhost/tools/board?z=1&g=A2&w=1';
    expect(short.length).toBeLessThan(96);
    expect(footerLines(short, 96)).toEqual([short]);

    // A 200-character link whose only break characters past the host are '&': every break falls at an '&'.
    const keys = ['z=1', 'g=A2', 'v=p', 'c=p', `s=${'1'.repeat(30)}`, `x=${'2'.repeat(30)}`, `t=${'3'.repeat(30)}`, `r=${'4'.repeat(30)}`];
    let link = `http://localhost/tools/board?${keys.join('&')}`;
    link = link + '&q='.padEnd(200 - link.length, '5');
    expect(link.length).toBe(200);
    const lines = footerLines(link, 96);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join('')).toBe(link);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(96);
    for (const line of lines.slice(1)) expect(line.startsWith('&')).toBe(true);

    // A 5000-character link (a long play): no cap, nothing dropped, no ellipsis.
    const moves = Array.from({ length: 2500 }, (_, k) => String((k % 3) + 1)).join(',');
    const long = `A2 · http://localhost/tools/board?z=1&g=A2&w=${moves}`.slice(0, 5000);
    expect(long.length).toBe(5000);
    const many = footerLines(long, 96);
    expect(many.length).toBeGreaterThanOrEqual(53);
    for (const line of many) {
      expect(line.length).toBeLessThanOrEqual(96);
      expect(line.length).toBeGreaterThan(0);
    }
    expect(many.join('')).toBe(long);
    expect(many.some((l) => l.includes('…'))).toBe(false);

    // No break character at all: hard breaks, still nothing lost.
    const hard = 'x'.repeat(250);
    expect(footerLines(hard, 96)).toEqual(['x'.repeat(96), 'x'.repeat(96), 'x'.repeat(58)]);
    expect(footerLines('', 96)).toEqual(['']);
  });
});

describe('file names and sizes', () => {
  it('exportFileName replaces unsafe characters', () => {
    expect(exportFileName('board', 'A2', 'svg')).toBe('board-A2.svg');
    expect(exportFileName('board', 'B3~', 'svg')).toBe('board-B3-.svg');
    expect(exportFileName('board', 'D4^(3)', 'png')).toBe('board-D4--3-.png');
    expect(exportFileName('garden', 'custom board', 'svg')).toBe('garden-custom-board.svg');
  });

  it('pngSize scales and caps the larger side at 8192', () => {
    expect(pngSize(400, 300, 2)).toEqual([800, 600]);
    expect(pngSize(5000, 1000, 2)).toEqual([8192, 1638]);
    expect(pngSize(10, 10, 1)).toEqual([10, 10]);
    expect(pngSize(400, 300)).toEqual([800, 600]);
    expect(pngSize(1000, 9000, 1)).toEqual([910, 8192]);
  });
});
