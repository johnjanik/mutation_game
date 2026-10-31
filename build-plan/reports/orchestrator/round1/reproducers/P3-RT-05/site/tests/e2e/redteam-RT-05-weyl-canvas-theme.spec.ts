// RT-05 (red team, phase 3, round 1): reproducer for P3-RT-05-03.
// T8 above 192 elements draws on a Canvas 2D with the colour tokens read when it draws
// (t08/WeylGraph.svelte, t08/canvasScene.ts readColours); nothing draws again when the theme
// changes. After the theme switch of the site bar (light to dark) the dots and the edge labels stay
// in the light theme's text colour #1A1A1A on the dark page #121212 (contrast 1.1 to 1, A-6 asks at
// least 3 to 1 for graphics and 4.5 to 1 for the label text).
// Run: npx playwright test -c redteam/redteam-RT-05-playwright.config.ts redteam-RT-05-weyl-canvas-theme
import { expect, test } from '@playwright/test';

test('T8 canvas follows the theme switch (F4, 1152 elements)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('tools/weyl/');
  await page.locator('[data-tool][data-hydrated="true"]').waitFor();
  await page.locator('[data-control="picker"]').selectOption('F4');
  await page.locator('[data-out="canvas"][data-scale]').waitFor();
  await page.waitForTimeout(800);
  // The theme switch of the site bar, by keyboard.
  await page.locator('[data-theme-switch]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const c = document.querySelector('[data-out="canvas"] canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let lightThemeInk = 0;
    let darkThemeInk = 0;
    const near = (i: number, v: number) => Math.abs(d[i]! - v) < 6 && Math.abs(d[i + 1]! - v) < 6 && Math.abs(d[i + 2]! - v) < 6;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! < 250) continue;
      if (near(i, 0x1a)) lightThemeInk++;
      if (near(i, 0xe8)) darkThemeInk++;
    }
    return { page: getComputedStyle(document.documentElement).getPropertyValue('--page').trim(), text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(), lightThemeInk, darkThemeInk };
  });
  expect(r.page, 'page colour after the switch').toBe('#121212');
  expect(r.lightThemeInk, `/tools/weyl/ F4, light to dark by the theme switch: opaque canvas pixels still in #1A1A1A (the light --text) on the ${r.page} page`).toBe(0);
  expect(r.darkThemeInk, 'opaque canvas pixels in the dark --text #E8E8E8').toBeGreaterThan(0);
});
