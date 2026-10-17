// The row of the table of SPEC.md 7.6 that scripts/size.mjs applies to each route (adopted from the
// red team, RT-07 attack 17). The module index /modules/ is a page with no tool (the built page has no
// data-tool element and fetches no script), so the 7.6 row "a page with no tool (about) | 15 kB"
// applies; lab.mjs itself says "/modules/ is not a lesson" (DECISIONS.md, P3-A7 route lists).
// classifyRoute gave it the lesson row (120 kB) because every path under /modules/ was taken for a
// lesson, whatever the page holds.
// Run: npx vitest run --project site-unit site/tests/unit/size-classify-module-index.test.ts
import { describe, expect, it } from 'vitest';
import { classifyRoute } from '../../../scripts/size.mjs';

const page = (body: string): string => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;

describe('route classification of the module index', () => {
  // regression: P3-RT-07-05
  it('the module index with no tool is held to the no-tool row (15 kB), not the lesson row', () => {
    const modulesIndex = page('<main><h1>Modules</h1><ul><li><a href="/modules/m0-start/">M0</a></li></ul></main>');
    expect(classifyRoute('/modules/', modulesIndex)).toEqual({ label: 'no-tool', limitKb: 15 });
  });
  it('a lesson keeps the lesson row', () => {
    expect(classifyRoute('/modules/m0-start/', page('<div data-tool="board"></div>'))).toEqual({ label: 'lesson', limitKb: 120 });
  });
});
