// A control that cannot act looks it (SPEC.md 7.4 "Without JavaScript": "Controls are rendered with the
// `disabled` attribute, which the island removes when it hydrates, so a control never looks usable before
// it is." 4.0: "Controls are present but disabled until the island has hydrated."). Adopted from the RT-06
// phase 4 reproducer (P4-RT-06-01): every `.control:disabled` rule of the site changed only `cursor`, and
// `.control` sets `color`, `background` and `border` explicitly, so the browser's own greying of a disabled
// button was overridden. The first tests read, for the same control, its computed colour, background, border
// colour, opacity and filter, and an element screenshot, once in a context with JavaScript off (disabled) and
// once hydrated (enabled), and fail when nothing differs. The shared rule (site/src/styles/base.css) gives
// every disabled or aria-disabled control a dashed border and toned text; the sweep checks that no component
// rule overrides it on any page, and the last tests check the aria-disabled state of a done control in
// several tools, T10 and T11 among them.
// Hooks read: data-tool, data-instance, data-hydrated, data-control, aria-disabled, data-out predictResult.
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { hydrateEveryIsland } from './hydrate';
import { discoverRoutes } from './routes';

/** Route, tool root (by data-tool and data-instance), and the controls read in it. */
const CASES: [string, string, string, string[]][] = [
  ['tools/geometry/', 'geometry', '', ['rootPolytope', 'viewCoxeter', 'copyLink', 'downloadData']],
  ['tools/fold/', 'fold', '', ['tab', 'reset', 'copyLink']],
  ['modules/m7-geometry/', 'geometry', 'b1', ['rootPolytope', 'copyLink']],
  ['modules/m6-multiple-edges/', 'fold', 'b8', ['tab', 'copyLink']],
  ['tools/board/', 'board', '', ['reset', 'copyLink']],
];

interface Look {
  disabled: boolean;
  ariaDisabled: string | null;
  style: string;
  png: Buffer;
}

async function look(control: Locator): Promise<Look> {
  await control.scrollIntoViewIfNeeded();
  const meta = await control.evaluate((e) => {
    const s = getComputedStyle(e);
    return {
      disabled: e.matches(':disabled'),
      ariaDisabled: e.getAttribute('aria-disabled'),
      style: `color ${s.color}; background ${s.backgroundColor}; border ${s.borderTopColor} ${s.borderTopStyle}; opacity ${s.opacity}; filter ${s.filter}; text ${s.textDecorationLine}`,
    };
  });
  return { ...meta, png: await control.screenshot({ animations: 'disabled', caret: 'hide' }) };
}

async function looks(browser: Browser, js: boolean, route: string, tool: string, instance: string, names: string[]): Promise<Look[]> {
  const context = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 360, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(route);
    if (js) await hydrateEveryIsland(page);
    const root = page.locator(`[data-tool="${tool}"][data-instance="${instance}"]`);
    if (js) await expect(root).toHaveAttribute('data-hydrated', 'true');
    await page.mouse.move(0, 0);
    const out: Look[] = [];
    for (const name of names) out.push(await look(root.locator(`[data-control="${name}"]`).first()));
    return out;
  } finally {
    await context.close();
  }
}

for (const [route, tool, instance, names] of CASES) {
  // regression: P4-RT-06-01
  test(`a disabled control does not look like the enabled one: ${route} ${tool} ${instance || '(tool route)'}`, async ({ browser }) => {
    const server = await looks(browser, false, route, tool, instance, names);
    const hydrated = await looks(browser, true, route, tool, instance, names);
    const same: string[] = [];
    names.forEach((name, i) => {
      const s = server[i]!;
      const h = hydrated[i]!;
      expect(s.disabled, `${name} is disabled without JavaScript`).toBe(true);
      expect(h.disabled || h.ariaDisabled === 'true', `${name} is usable after hydration`).toBe(false);
      if (s.style === h.style && s.png.equals(h.png)) same.push(`${name} (${s.style}; identical screenshots)`);
    });
    expect(same, `${route} ${tool} ${instance}: controls that look usable while disabled, identical to their enabled look`).toEqual([]);
  });
}

/**
 * The controls of the page that cannot act (the disabled attribute, or aria-disabled="true") whose look is
 * not the shared one: text in the toned colour, and a dashed border wherever the control draws a border.
 */
async function offLook(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const probe = document.createElement('span');
    probe.style.color = 'color-mix(in srgb, var(--text) 65%, var(--page))';
    document.body.append(probe);
    const toned = getComputedStyle(probe).color;
    probe.remove();
    const bad: string[] = [];
    for (const el of document.querySelectorAll(sel)) {
      const s = getComputedStyle(el);
      const name = el.getAttribute('data-control') ?? el.getAttribute('data-node') ?? el.getAttribute('data-export') ?? `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      if (s.color !== toned) bad.push(`${name}: color ${s.color}, expected ${toned}`);
      if (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'dashed') bad.push(`${name}: border ${s.borderTopStyle}`);
    }
    return bad;
  }, `${scope} :is(button, input, select, textarea):is(:disabled, [aria-disabled="true"])`);
}

// regression: P4-RT-06-01
test('without JavaScript every disabled control of every page has the shared look, whatever its component sets', async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  try {
    const page = await context.newPage();
    const problems: string[] = [];
    let seen = 0;
    for (const r of discoverRoutes()) {
      await page.goto(r.path);
      seen += await page.locator(':is(button, input, select, textarea):disabled').count();
      for (const p of await offLook(page, 'body')) problems.push(`/${r.path} ${p}`);
    }
    expect(seen, 'disabled controls found without JavaScript').toBeGreaterThan(100);
    expect(problems).toEqual([]);
  } finally {
    await context.close();
  }
});

/** The computed look of a control with the focus and the pointer away from it. */
async function plainLook(page: Page, control: Locator): Promise<string> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(0, 0);
  return control.evaluate((e) => {
    const s = getComputedStyle(e);
    return `color ${s.color}; border ${s.borderTopColor} ${s.borderTopStyle}`;
  });
}

// A done control (aria-disabled after hydration) takes the shared look too, in tools whose components set
// their own control styles: T2, T1, and Predict inside T10 (M7 beat 4) and T11 (M6 beat 7).
const DONE: { what: string; route: string; tool: string; instance: string; control: string; press: string }[] = [
  { what: 'T2 Show total once shown', route: 'tools/garden/', tool: 'garden', instance: '', control: 'showTotal', press: 'showTotal' },
  { what: 'T1 Step at the end of the game', route: 'tools/board/?z=1&g=A2&v=n&m=l&c=n&s=1,1', tool: 'board', instance: '', control: 'step', press: 'playToEnd' },
  { what: 'Predict Check in T10, answered', route: 'modules/m7-geometry/', tool: 'geometry', instance: 'b4', control: 'predictCheck', press: 'predictShow' },
  { what: 'Predict Check in T11, answered', route: 'modules/m6-multiple-edges/', tool: 'fold', instance: 'b7', control: 'predictCheck', press: 'predictShow' },
];

for (const d of DONE) {
  // regression: P4-RT-06-01
  test(`a done control looks it: ${d.what}`, async ({ page }) => {
    await page.goto(d.route);
    const root = page.locator(`[data-tool="${d.tool}"][data-instance="${d.instance}"]`);
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    const control = root.locator(`[data-control="${d.control}"]`).first();
    await expect(control).not.toHaveAttribute('aria-disabled', 'true');
    const usable = await plainLook(page, control);
    await root.locator(`[data-control="${d.press}"]`).first().click();
    await expect(control).toHaveAttribute('aria-disabled', 'true');
    const done = await plainLook(page, control);
    expect(done, `${d.what}: the look of the done control`).not.toBe(usable);
    expect(await offLook(page, `[data-tool="${d.tool}"][data-instance="${d.instance}"]`), `${d.what}: controls that cannot act without the shared look`).toEqual([]);
  });
}
