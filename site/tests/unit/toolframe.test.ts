// P1-A2: the server render of ToolFrame (CONTRACTS.md 5.1; SPEC.md 4.0, 7.4, 7.5 A-4 and A-10),
// through a minimal fixture tool. Hydration (disabled removed, data-hydrated set) is checked in a real
// browser by site/tests/e2e/toolframe-hydration.spec.ts, since this project has no DOM environment.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ssrLoader, type SsrLoader } from './_svelteSsr';
import { defaultState } from '../../src/lib/state';

let loader: SsrLoader;
let Fixture: unknown;

beforeAll(async () => {
  loader = await ssrLoader();
  Fixture = (await loader.load<{ default: unknown }>('/tests/fixtures/toolframe/FixtureTool.svelte')).default;
}, 60000);

afterAll(async () => {
  await loader?.close();
});

function html(props: Record<string, unknown>): string {
  return loader.render(Fixture, props);
}

/** Opening tags of an element name, with their attribute text. */
function tags(source: string, name: string): string[] {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>/])`).exec(tag);
  return m === null ? null : (m[1] ?? '');
}

/** Ranges of the source inside a <fieldset disabled> ... </fieldset> (fieldsets are not nested here). */
function disabledFieldsetRanges(source: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /<fieldset\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (attr(m[0], 'disabled') === null) continue;
    const end = source.indexOf('</fieldset>', m.index);
    out.push([m.index, end]);
  }
  return out;
}

describe('ToolFrame', () => {
  it('server render', () => {
    const body = html({ initial: defaultState('board', 'A2') });
    const root = tags(body, 'section')[0]!;
    expect(attr(root, 'data-frame')).not.toBeNull();
    expect(attr(root, 'data-tool')).toBe('board');
    expect(attr(root, 'data-moves')).toBe('0');
    expect(attr(root, 'data-hydrated')).toBeNull();

    // Caption and the figure with its text alternative (A-10).
    expect(body).toMatch(/<figcaption id="([^"]+)" data-out="caption"[^>]*>A fixture board in its default state\.<\/figcaption>/);
    const captionId = /<figcaption id="([^"]+)"/.exec(body)![1];
    const fig = tags(body, 'figure')[0]!;
    expect(attr(fig, 'aria-labelledby')).toBe(captionId);
    expect(body.indexOf('<svg')).toBeGreaterThan(body.indexOf('<figure'));
    expect(body.indexOf('<svg')).toBeLessThan(body.indexOf('</figure>'));
    const labelled = html({ initial: defaultState('board', 'A2'), figureLabel: 'Board A2, populations 1 and 0' });
    const fig2 = tags(labelled, 'figure')[0]!;
    expect(attr(fig2, 'aria-label')).toBe('Board A2, populations 1 and 0');
    expect(attr(fig2, 'aria-labelledby')).toBeNull();

    // Every control is disabled: by its own attribute or inside a disabled fieldset.
    const ranges = disabledFieldsetRanges(body);
    expect(ranges).toHaveLength(2); // the controls row and the table
    const buttons = [...body.matchAll(/<button\b[^>]*>/g)];
    expect(buttons.length).toBe(2 + 3 + 1 + 2 + 2 + 2); // nodes, undo/redo/reset, step, copy/download, export svg/png (P2-A6), table
    for (const b of buttons) {
      const inside = ranges.some(([s, e]) => b.index! > s && b.index! < e);
      expect(attr(b[0], 'disabled') !== null || inside, b[0]).toBe(true);
    }
    for (const control of ['undo', 'redo', 'reset', 'copyLink', 'downloadData']) {
      const t = tags(body, 'button').find((x) => attr(x, 'data-control') === control);
      expect(t, control).toBeDefined();
      expect(attr(t!, 'disabled'), control).not.toBeNull();
    }
    expect(body).toContain('>Copy link</button>');
    expect(body).toContain('>Download data</button>');
    // Undo, redo and reset come after the figure (A-1); the step control sits in the controls row.
    expect(body.indexOf('data-control="undo"')).toBeGreaterThan(body.indexOf('</figure>'));
    const controls = tags(body, 'fieldset').find((x) => attr(x, 'data-controls') !== null)!;
    expect(attr(controls, 'disabled')).not.toBeNull();

    // The live region: present, polite, empty.
    expect(body).toMatch(/<div class="[^"]*visually-hidden[^"]*" role="status" aria-live="polite" aria-atomic="true" data-live=""[^>]*><\/div>/);
    // The noscript line.
    expect(body).toMatch(/<noscript><span data-out="noscript">Interactive when scripts are allowed\.<\/span><\/noscript>/);
    // The table of A-10 inside <details>, one button per node.
    const details = body.slice(body.indexOf('<details'), body.indexOf('</details>'));
    expect(details).toMatch(/<summary[^>]*>Show as table<\/summary>/);
    expect(details).toContain('<table>');
    expect([...details.matchAll(/data-table-node="(\d+)"/g)].map((m) => m[1])).toEqual(['1', '2']);
    // No notice without one.
    expect(body).not.toContain('data-out="notice"');
  });

  it('data-moves, the notice and the optional history row', () => {
    const body = html({ initial: { ...defaultState('board', 'A3'), moves: [1, 2] }, withHistoryRow: false, instanceId: 'b2', notice: 'The link could not be read, so the tool shows its default state.' });
    expect(body).toMatch(/<p class="notice[^"]*" data-out="notice" role="note">The link could not be read, so the tool shows its default state\.<\/p>/);
    expect(attr(tags(body, 'section')[0]!, 'data-moves')).toBe('2');
    expect(body).not.toContain('data-control="undo"');
    expect([...body.matchAll(/data-table-node="(\d+)"/g)]).toHaveLength(3);
  });
});
