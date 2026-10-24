// Test helper (RT-FIX follow-predict, not a spec): counts the engine's moves made while an action runs
// on the built site. SPEC 7.4: "while a tool runs it keeps the list of positions of the current play in
// memory and extends it by one position per move, so a move costs one engine call however long the play
// is". Every mutate and fire of packages/engine/src/moves.ts calls checkMove once, the one function of
// the engine that checks a position ("position ... is outside 0..") and then a vector ("the vector has
// ... entries"); Chromium's precise coverage counts its calls, and the count is found by those two
// messages, which minification keeps. A follower that replays the play from the start on every move of
// its leader makes a number of moves that grows with the play; one that extends it does not. The count
// says nothing about the hooks of SPEC 4.0, which the specs that use it read as usual.
import type { Page } from '@playwright/test';

/** The number of calls of the engine's move check (one per mutate or fire) made while `action` runs. */
export async function engineMoves(page: Page, action: () => Promise<void>): Promise<number> {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  let entries: Awaited<ReturnType<Page['coverage']['stopJSCoverage']>>;
  try {
    await action();
  } finally {
    entries = await page.coverage.stopJSCoverage();
  }
  let found = 0;
  let calls = 0;
  for (const entry of entries) {
    const source = entry.source ?? '';
    for (const f of entry.functions) {
      const range = f.ranges[0];
      if (range === undefined) continue;
      const body = source.slice(range.startOffset, range.endOffset);
      const outside = body.indexOf('is outside 0..');
      const vector = body.indexOf('the vector has');
      if (body.length > 400 || outside < 0 || vector < outside) continue;
      found++;
      calls += range.count;
    }
  }
  if (found === 0) throw new Error("engineMoves: the engine's move check was not found in the page's scripts");
  return calls;
}
