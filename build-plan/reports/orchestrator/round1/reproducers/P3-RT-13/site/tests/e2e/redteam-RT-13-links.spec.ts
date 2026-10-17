// RT-13 (red team, reader-playtest), attack 17: the links a reader follows. Every internal link of
// the core path answers 200 and its fragment exists; no link reaches an unreleased page or
// open-items in a release build; the sandbox link opens T16 with "this module's board loaded"
// (SPEC 8.2 item 7; P6), read against the board of the module's first figure (SPEC 3 tables:
// M0 A3, M1 A2, M2 A3, M3 A3 in T4, M4 A2, M5 A3; each lesson's first figure keeps that board).
// Release build: RT13_BASE_URL=http://localhost:5241/ with redteam/redteam-RT-13-serve.mjs serving
// OUT_DIR=<dir> RELEASE=1 npm run build:release.
import { expect, test } from '@playwright/test';

if (process.env.RT13_BASE_URL) test.use({ baseURL: process.env.RT13_BASE_URL });

const FIRST_BOARD: Record<string, [string, number]> = {
  'm0-start': ['A3', 3], 'm1-mutation': ['A2', 2], 'm2-form': ['A3', 3], 'm3-classification': ['A3', 3], 'm4-numbers': ['A2', 2], 'm5-weyl': ['A3', 3],
};

for (const [m, [boardName, n]] of Object.entries(FIRST_BOARD)) {
  test(`/modules/${m}/: links answer, fragments exist, the sandbox opens ${boardName}`, async ({ page, baseURL }) => {
    test.setTimeout(120000);
    await page.goto(`modules/${m}/`);
    const firstFigure = page.locator('[data-tool]').first();
    const firstLabel = (await firstFigure.locator('figure').first().getAttribute('aria-label')) ?? (await firstFigure.innerText());
    expect(firstLabel, 'the first figure is on the module board').toContain(boardName);
    const hrefs = [...new Set(await page.locator('article a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '')))]
      .filter((h) => h.startsWith('/') || h.startsWith('#'));
    const problems: string[] = [];
    for (const h of hrefs) {
      const url = new URL(h, new URL(`modules/${m}/`, baseURL)).href;
      const [path, frag] = url.split('#');
      const res = await page.request.get(path);
      if (res.status() !== 200) { problems.push(`${h}: status ${res.status()}`); continue; }
      if (frag && !(await res.text()).includes(`id="${frag}"`)) problems.push(`${h}: no element with id ${frag}`);
      if (process.env.RT13_BASE_URL && /open-items/.test(h)) problems.push(`${h}: link to open-items in a release build`);
    }
    const sandbox = page.locator('[data-link="sandbox"]');
    await expect(sandbox).toHaveCount(1);
    await sandbox.click();
    const r = page.locator('[data-tool="sandbox"]').first();
    await expect(r).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    const label = `${await r.locator('figure').first().getAttribute('aria-label')}`;
    const nodes = await r.locator('button[data-node][data-board="populations"], button[data-node][data-board="numbers"]').evaluateAll((els) => new Set(els.map((e) => (e as HTMLElement).dataset.node)).size);
    if (!label.includes(` ${boardName}`) || nodes !== n) problems.push(`sandbox opens "${label.slice(0, 80)}" with ${nodes} nodes; the module's board is ${boardName} with ${n}`);
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
