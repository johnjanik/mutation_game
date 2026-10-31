// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-10.
// SPEC 8.3: "Icons: a small city for Populations, a small numbered disc for Numbers, used wherever the
// view is named"; 6.3: the two views have "distinct, fixed accent colours and icons used consistently"
// (P8). T7's right board ("Letters") is a board of the numbers game played with letters: its node
// buttons carry data-board="numbers" and the tool's name says "Symbolic board ... following the
// numbers board". Its panel title nevertheless carries the city icon of the Populations view and its
// panel border the Populations accent (T07SymbolicGame.svelte: icon(POPULATIONS_ICON) " Letters";
// .panel.symbolic { box-shadow: ... var(--accent-populations) }), so the Populations mark names a
// board that is not the Populations view.
// Run: npx playwright test -c redteam/redteam-RT-05-playwright.config.ts redteam-RT-05-view-icons
import { expect, test } from '@playwright/test';

test('the Populations icon and accent mark only the Populations view (T7 /tools/symbolic/)', async ({ page }) => {
  await page.goto('tools/symbolic/');
  await page.locator('[data-tool][data-hydrated="true"]').waitFor();
  const r = await page.evaluate(() => {
    const iconOf = (sel: string) => document.querySelector(`${sel} .panel-title svg path`)?.getAttribute('d') ?? null;
    const popIcon = 'M1.5 14.5V8.5h3.5v6M5 14.5V3.5h5v11M10 14.5V6.5h4.5v8M0.5 14.5h15M7 6h1M7 9h1M12 9h1';
    const panel = document.querySelector('[data-out="symbolicBoard"]') as HTMLElement;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-populations').trim();
    return {
      title: panel.querySelector('.panel-title')?.textContent?.trim(),
      boards: [...panel.querySelectorAll('button[data-node]')].map((b) => (b as HTMLElement).dataset.board),
      usesPopulationsIcon: iconOf('[data-out="symbolicBoard"]') === popIcon,
      border: getComputedStyle(panel).boxShadow,
      accent,
    };
  });
  expect(r.boards.every((b) => b === 'numbers'), 'the Letters board is a numbers board by its hooks').toBe(true);
  expect(r.usesPopulationsIcon, `/tools/symbolic/: panel "${r.title}" (data-board=${r.boards[0]}) carries the Populations city icon`).toBe(false);
  expect(r.border.includes('rgb(0, 158, 115)'), `/tools/symbolic/: panel "${r.title}" bordered in the Populations accent ${r.accent} (${r.border})`).toBe(false);
});
