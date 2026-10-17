// P2-A6: SVG and PNG export of any tool's figure (SPEC.md 4.0 "Share and export", "Long numbers",
// "Small screens"; 6.1 labels switchable off in exports only; 7.4 Citing and without JavaScript;
// 7.5 A-1, A-7, A-11; 7.8 no third-party request; 8.3 footer line, themes). Runs against the built
// site on /tools/board (T1) and /tools/garden (T2).
//
// Hooks read on the page: data-hydrated (tool root), data-export="svg" | "png" (buttons),
// data-export-option="footer" | "labels" (checkboxes), data-out="exportNotice", data-control="copyLink",
// data-node and data-value (node buttons), data-label (the label <text> Node.svelte draws, P0-A5's
// marker; also the selector withoutLabels removes), data-disc (the disc of a node).
// Hooks read inside the exported file: data-footer (footer group, its <a href>), data-exact (note of
// exact digits), data-frac="p/q" (a fraction redrawn as SVG text), data-label on <text> (labels),
// data-disc (discs), data-road-style (the roads group: a chevron is its <path>, the lines its <line>).
// On A2 in the dynkin style the drawing has no <text> besides numerals and labels (road counts appear
// only for products of 4 or more; hint ghosts are dropped), so <text> counts are 2n with labels and
// n without.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BOARD_A2 = '/tools/board?g=A2&v=p&c=p&s=1,0&w=1';

/** Paths are joined to the configured baseURL (it carries the base path). */
const at = (path: string): string => `.${path}`;

async function ready(page: Page, path: string): Promise<void> {
  await page.goto(at(path));
  await expect(page.locator('[data-tool][data-hydrated="true"]').first()).toBeVisible();
  await expect(page.locator('[data-export="svg"]').first()).toBeEnabled();
}

async function download(page: Page, kind: 'svg' | 'png'): Promise<{ bytes: Buffer; name: string }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-export="${kind}"]`).first().click()]);
  const path = await dl.path();
  return { bytes: readFileSync(path), name: dl.suggestedFilename() };
}

async function setOption(page: Page, option: 'footer' | 'labels', on: boolean): Promise<void> {
  const box = page.locator(`[data-export-option="${option}"]`).first();
  if (on) await box.check();
  else await box.uncheck();
}

interface Summary {
  parseError: boolean;
  rootTag: string;
  xmlns: string | null;
  width: number;
  height: number;
  viewBox: string | null;
  role: string | null;
  title: string | null;
  texts: string[];
  labels: number;
  nested: number;
  drawingBottom: number;
  footerText: string | null;
  footerHref: string | null;
  footerLines: number;
  footerTop: number | null;
  exactText: string | null;
  exactTop: number | null;
  titles: string[];
  varAttrs: number;
  classAttrs: number;
  styleEls: number;
  foreignObjects: number;
  fracs: { value: string; tspans: string[] }[];
  background: string | null;
  discFill: string | null;
  roadPaths: number;
  roadLines: number;
}

/** Parses an exported file in the page with DOMParser and reports what the tests check. */
async function inspect(page: Page, text: string): Promise<Summary> {
  return page.evaluate((t) => {
    const doc = new DOMParser().parseFromString(t, 'image/svg+xml');
    const root = doc.documentElement;
    const all = [...doc.querySelectorAll('*')];
    const fillOf = (el: Element | null): string | null => {
      if (!el) return null;
      const m = /(?:^|;)\s*fill:\s*([^;]+)/.exec(el.getAttribute('style') ?? '');
      return m ? m[1]!.trim() : el.getAttribute('fill');
    };
    const nested = root.querySelector(':scope > svg');
    const footer = root.querySelector('[data-footer]');
    const exact = root.querySelector('[data-exact]');
    const topOf = (g: Element | null): number | null => (g ? Math.min(...[...g.querySelectorAll('text')].map((x) => Number(x.getAttribute('y')))) - 16 : null);
    return {
      parseError: doc.querySelector('parsererror') !== null,
      rootTag: root.localName,
      xmlns: root.getAttribute('xmlns') ?? root.namespaceURI,
      width: Number(root.getAttribute('width')),
      height: Number(root.getAttribute('height')),
      viewBox: root.getAttribute('viewBox'),
      role: root.getAttribute('role'),
      title: root.querySelector(':scope > title')?.textContent ?? null,
      texts: [...doc.querySelectorAll('text')].filter((x) => !x.closest('[data-footer], [data-exact]')).map((x) => x.textContent ?? ''),
      labels: doc.querySelectorAll('text[data-label]').length,
      nested: doc.querySelectorAll('svg svg').length,
      drawingBottom: nested ? Number(nested.getAttribute('y')) + Number(nested.getAttribute('height')) : NaN,
      footerText: footer ? [...footer.querySelectorAll('text')].map((x) => x.textContent ?? '').join('') : null,
      footerHref: footer?.querySelector('a')?.getAttribute('href') ?? null,
      footerLines: footer ? footer.querySelectorAll('text').length : 0,
      footerTop: topOf(footer),
      exactText: exact ? [...exact.querySelectorAll('text')].map((x) => x.textContent ?? '').join('') : null,
      exactTop: topOf(exact),
      titles: [...doc.querySelectorAll('title')].map((x) => x.textContent ?? ''),
      varAttrs: all.filter((el) => [...el.attributes].some((a) => a.value.includes('var('))).length,
      classAttrs: all.filter((el) => el.hasAttribute('class')).length,
      styleEls: doc.querySelectorAll('style').length,
      foreignObjects: doc.getElementsByTagName('foreignObject').length,
      fracs: [...doc.querySelectorAll('g[data-frac]')].map((g) => ({
        value: g.getAttribute('data-frac') ?? '',
        tspans: [...g.querySelectorAll('text > tspan')].map((s) => s.textContent ?? ''),
      })),
      background: root.querySelector(':scope > rect')?.getAttribute('fill') ?? null,
      discFill: fillOf(doc.querySelector('circle[data-disc="1"]')),
      roadPaths: doc.querySelectorAll('g[data-road-style] path').length,
      roadLines: doc.querySelectorAll('g[data-road-style] line').length,
    };
  }, text);
}

async function exportSvg(page: Page): Promise<{ text: string; name: string; s: Summary }> {
  const { bytes, name } = await download(page, 'svg');
  const text = bytes.toString('utf8');
  return { text, name, s: await inspect(page, text) };
}

/** Width and height from the IHDR chunk of a PNG (bytes 16 to 23, big-endian). */
function pngDims(bytes: Buffer): [number, number] {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/** Decodes a PNG in the page and answers whether some pixel differs from the first. */
async function pngNotBlank(page: Page, bytes: Buffer): Promise<boolean> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2] || d[i + 3] !== d[3]) return true;
    return false;
  }, bytes.toString('base64'));
}

const asMinus = (v: string): string => v.replace(/^-/, '−');

test('T1 SVG export is well-formed and carries the footer with the board name and the link', async ({ page }) => {
  await ready(page, BOARD_A2);
  await expect(page.locator('[data-export="svg"]').first()).toHaveText('Export SVG');
  await expect(page.locator('[data-export="png"]').first()).toHaveText('Export PNG');
  const { name, s } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  expect(s.rootTag).toBe('svg');
  expect(s.xmlns).toBe('http://www.w3.org/2000/svg');
  expect(s.width).toBeGreaterThan(0);
  expect(s.height).toBeGreaterThan(0);
  expect(s.role).toBe('img');
  expect(s.title).toBe('A2');
  expect(s.footerText).toContain('A2');
  expect(s.footerText!.startsWith('A2 · ')).toBe(true);
  const link = new URL(s.footerText!.slice('A2 · '.length));
  expect(link.pathname.replace(/\/$/, '').endsWith('/tools/board')).toBe(true);
  expect(link.searchParams.get('g')).toBe('A2');
  expect(link.searchParams.get('w')).toBe('1');
  expect(s.footerHref).toBe(link.href);
  expect(s.varAttrs).toBe(0);
  expect(name).toBe('board-A2.svg');
  await expect(page.locator('[data-out="exportNotice"]').first()).toHaveText('');
});

test('the footer link equals the Copy link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ready(page, BOARD_A2);
  await page.locator('[data-control="copyLink"]').first().click();
  await expect(page.locator('[data-live]').first()).toHaveText('Link copied.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const { s } = await exportSvg(page);
  expect(s.footerHref).toBe(copied);
  expect(s.footerText).toBe(`A2 · ${copied}`);
});

test('the footer is inside the rendered picture', async ({ page }) => {
  await ready(page, BOARD_A2);
  const { text, s } = await exportSvg(page);
  expect(s.viewBox).toBe(`0 0 ${s.width} ${s.height}`);
  expect(s.footerTop).not.toBeNull();
  expect(s.footerTop!).toBeGreaterThanOrEqual(s.drawingBottom);
  const footerHeight = 8 + 16 * s.footerLines + 8;
  expect(s.height).toBe(s.drawingBottom + footerHeight);
  // Drawn as exportPNG draws it: the strip of the footer is not uniform, so its text is drawn, not clipped.
  const strip = await page.evaluate(
    async ({ t, w, h, f }) => {
      const url = URL.createObjectURL(new Blob([t], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const d = ctx.getImageData(0, h - f, w, f).data;
      for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) return true;
      return false;
    },
    { t: text, w: s.width, h: s.height, f: footerHeight },
  );
  expect(strip).toBe(true);
  const withFooter = pngDims((await download(page, 'png')).bytes);
  await setOption(page, 'footer', false);
  const without = pngDims((await download(page, 'png')).bytes);
  expect(Math.abs(withFooter[1] - without[1] - 2 * footerHeight)).toBeLessThanOrEqual(1);
});

test('the footer can be switched off', async ({ page }) => {
  await ready(page, BOARD_A2);
  const on = (await exportSvg(page)).s;
  expect(on.footerText).not.toBeNull();
  await setOption(page, 'footer', false);
  const { text, s } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  expect(s.footerText).toBeNull();
  expect(text).not.toContain('data-footer');
  expect(text.replace(/xmlns(:\w+)?="[^"]*"/g, '')).not.toContain('http');
  expect(s.height).toBe(on.height - (8 + 16 * on.footerLines + 8));
});

test('labels are present by default', async ({ page }) => {
  await ready(page, BOARD_A2);
  await setOption(page, 'footer', false);
  const { s } = await exportSvg(page);
  const n = 2;
  expect(s.texts).toHaveLength(2 * n);
  expect(s.labels).toBe(n);
});

test('labels can be switched off in the export and the SVG has one value text per node', async ({ page }) => {
  await ready(page, BOARD_A2);
  await setOption(page, 'footer', false);
  await setOption(page, 'labels', false);
  const { s } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  const values = await page.locator('[data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-value') ?? ''));
  expect(values).toHaveLength(2);
  expect(s.texts).toEqual(values.map(asMinus));
  expect(s.labels).toBe(0);
  // The page keeps its labels: the option acts on the exported copy only.
  await expect(page.locator('text[data-label]')).toHaveCount(2);
});

test('the linked view exports both boards in one SVG', async ({ page }) => {
  await ready(page, '/tools/board?g=A2&v=l&c=p&s=1,0');
  await setOption(page, 'footer', false);
  await setOption(page, 'labels', false);
  const { s } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  expect(s.texts).toHaveLength(4);
  expect(s.nested).toBeGreaterThanOrEqual(2);
  expect(s.labels).toBe(0);
});

test('the linked view from numbers exports the fractions as SVG text', async ({ page }) => {
  await ready(page, '/tools/board?g=A2&v=l&c=n&s=1,0');
  await setOption(page, 'footer', false);
  await setOption(page, 'labels', false);
  const { s } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  expect(s.foreignObjects).toBe(0);
  expect(s.fracs).toEqual(
    expect.arrayContaining([
      { value: '2/3', tspans: ['2', '3'] },
      { value: '1/3', tspans: ['1', '3'] },
    ]),
  );
  expect(s.texts).toHaveLength(4);
  const [w, h] = pngDims((await download(page, 'png')).bytes);
  expect(w).toBe(Math.round(2 * s.width));
  expect(h).toBe(Math.round(2 * s.height));
  expect(await pngNotBlank(page, (await download(page, 'png')).bytes)).toBe(true);
});

test('long numbers carry their exact digits in the export', async ({ page }) => {
  await ready(page, '/tools/board?g=A2&v=n&c=n&s=1234567890123456,0');
  await setOption(page, 'footer', false);
  const { s } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  expect(s.titles.some((t) => t.includes('1234567890123456'))).toBe(true);
  expect(s.exactText).toContain('1234567890123456');
  expect(s.exactText).toContain('1 = 1234567890123456');
  await setOption(page, 'footer', true);
  const withFooter = (await exportSvg(page)).s;
  expect(withFooter.exactTop!).toBeLessThan(withFooter.footerTop!);
  expect(withFooter.exactTop!).toBeGreaterThanOrEqual(withFooter.drawingBottom);
  // All values short: no note.
  await ready(page, BOARD_A2);
  expect((await exportSvg(page)).s.exactText).toBeNull();
});

test.describe('dark theme', () => {
  test('a dark-theme export carries the dark colours', async ({ page }) => {
    const path = '/tools/board?g=A2&v=n&c=n&s=1,0';
    const check = (s: Summary): void => {
      expect(s.classAttrs).toBe(0);
      expect(s.styleEls).toBe(0);
      expect(s.varAttrs).toBe(0);
    };
    await page.emulateMedia({ colorScheme: 'dark' });
    await ready(page, path);
    const dark = (await exportSvg(page)).s;
    expect(dark.background).toBe('rgb(18, 18, 18)');
    expect(dark.discFill).toBe('rgb(86, 180, 233)');
    check(dark);

    await page.emulateMedia({ colorScheme: 'light' });
    await ready(page, path);
    const light = (await exportSvg(page)).s;
    expect(light.background).toBe('rgb(255, 255, 255)');
    expect(light.discFill).toBe('rgb(0, 114, 178)');
    check(light);

    // The manual switch (CONTRACTS 8): data-theme="dark" on <html> under a light system setting.
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    // The disc's fill has a short transition (Node.svelte); export once the page shows the dark theme.
    await expect
      .poll(() => page.locator('[data-disc="1"]').first().evaluate((el) => getComputedStyle(el).fill))
      .toBe('rgb(86, 180, 233)');
    const manual = (await exportSvg(page)).s;
    expect(manual.background).toBe('rgb(18, 18, 18)');
    expect(manual.discFill).toBe('rgb(86, 180, 233)');
    check(manual);
  });
});

test('a multiply laced board exports well-formed with its road markers', async ({ page }) => {
  await ready(page, '/tools/board?g=B3&v=p');
  const { s } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  // B3 in the dynkin style: one single road, one double road (two lines) and its chevron (a path).
  expect(s.roadLines).toBe(3);
  expect(s.roadPaths).toBe(1);
  expect(s.varAttrs).toBe(0);
});

test('T1 PNG export has the expected dimensions and is not blank', async ({ page }) => {
  await ready(page, BOARD_A2);
  const { s } = await exportSvg(page);
  const { bytes, name } = await download(page, 'png');
  const [w, h] = pngDims(bytes);
  expect(w).toBe(Math.round(2 * s.width));
  expect(h).toBe(Math.round(2 * s.height));
  expect(await pngNotBlank(page, bytes)).toBe(true);
  expect(name.endsWith('.png')).toBe(true);
  expect(name).toBe('board-A2.png');
});

test('T2 SVG and PNG export work on the default garden', async ({ page }) => {
  await ready(page, '/tools/garden');
  const { s, name } = await exportSvg(page);
  expect(s.parseError).toBe(false);
  expect(s.footerText).not.toBeNull();
  const boardName = s.footerText!.split(' · ')[0]!;
  expect(boardName.length).toBeGreaterThan(0);
  expect(s.title).toBe(boardName);
  expect(s.footerText).toContain('/tools/garden');
  expect(name).toBe(`garden-${boardName.replace(/[^A-Za-z0-9._-]/g, '-')}.svg`);
  expect(s.varAttrs).toBe(0);
  const { bytes } = await download(page, 'png');
  const [w, h] = pngDims(bytes);
  expect(w).toBe(Math.round(2 * s.width));
  expect(h).toBe(Math.round(2 * s.height));
  expect(await pngNotBlank(page, bytes)).toBe(true);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('export controls are disabled without JavaScript', async ({ page }) => {
    for (const path of [BOARD_A2, '/tools/garden']) {
      await page.goto(at(path));
      const controls = page.locator('[data-export], [data-export-option]');
      await expect(controls).toHaveCount(4);
      for (const el of await controls.all()) await expect(el).toHaveAttribute('disabled', '');
    }
  });
});

test('export controls are enabled after hydration', async ({ page }) => {
  for (const path of [BOARD_A2, '/tools/garden']) {
    await ready(page, path);
    const controls = page.locator('[data-export], [data-export-option]');
    await expect(controls).toHaveCount(4);
    for (const el of await controls.all()) await expect(el).toBeEnabled();
    await expect(page.locator('[data-export-option="footer"]')).toBeChecked();
    await expect(page.locator('[data-export-option="labels"]')).toBeChecked();
  }
});

test('Export SVG works from the keyboard', async ({ page }) => {
  await ready(page, BOARD_A2);
  await page.locator('[data-control="downloadData"]').first().focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-export="svg"]').first()).toBeFocused();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(dl.suggestedFilename()).toBe('board-A2.svg');
  // Space toggles an option; the next export follows it.
  await page.locator('[data-export-option="footer"]').first().focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-export-option="footer"]').first()).not.toBeChecked();
});

test('export controls fit and wrap at 320 pixels', async ({ page }) => {
  await ready(page, BOARD_A2);
  for (const kind of ['svg', 'png']) {
    const box = (await page.locator(`[data-export="${kind}"]`).first().boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await ready(page, BOARD_A2);
  const boxes = [];
  for (const el of await page.locator('[data-export], [data-export-option]').all()) {
    const b = (await el.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(24);
    expect(b.height).toBeGreaterThanOrEqual(24);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(320);
    boxes.push(b);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `controls ${i} and ${j} overlap`).toBe(false);
    }
  }
  const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test('export makes no external request', async ({ page, baseURL }) => {
  await ready(page, BOARD_A2);
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await download(page, 'svg');
  await download(page, 'png');
  const origin = new URL(baseURL!).origin;
  for (const u of urls) expect(u.startsWith(`${origin}/`) || u.startsWith('blob:') || u.startsWith('data:'), u).toBe(true);
});
