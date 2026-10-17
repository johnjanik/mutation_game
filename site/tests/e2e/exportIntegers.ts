// Helpers of the export regression tests in T03, T04 and T06.spec.ts, adopted from RT-04's reproducer
// (attack 33). SPEC 6.6 Data export: "JSON with the state, the engine version, the site's git commit,
// and the derived tables shown on screen ..., all integers as JSON numbers when safe and as decimal
// strings otherwise". They read only data-* hooks and the downloaded file.
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Opens a tool route with a clipboard that records what "Copy link" writes, and waits for hydration. */
export async function openForExport(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { w.__copied.push(t); } } });
  });
  await page.goto(path);
  const t = page.locator('[data-tool]').first();
  await expect(t).toHaveAttribute('data-hydrated', 'true', { timeout: 60000 });
  await page.waitForTimeout(300);
}

/** Presses "Download data" and returns the raw text and the parsed document. */
export async function downloadData(page: Page): Promise<{ raw: string; doc: Record<string, any> }> { // any: a parsed JSON file read field by field
  const t = page.locator('[data-tool]').first();
  const [dl] = await Promise.all([page.waitForEvent('download'), t.locator('[data-control="downloadData"]').click()]);
  const raw = readFileSync((await dl.path())!, 'utf8');
  return { raw, doc: JSON.parse(raw) };
}

/** Presses "Copy link" and returns the query of the link written to the clipboard. */
export async function copiedLink(page: Page): Promise<URLSearchParams> {
  await page.locator('[data-tool]').first().locator('[data-control="copyLink"]').click();
  const text = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1) ?? '');
  return new URL(text).searchParams;
}

/** Unsafe integers written as JSON numbers (a run of 16 or more digits outside quotes). */
export function unsafeNumbers(raw: string): string[] {
  const noStrings = raw.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return (noStrings.match(/-?\d{16,}/g) ?? []).filter((t) => !Number.isSafeInteger(Number(t)));
}

/** Safe integers written as strings, anywhere in the export except the commit and the version. */
export function safeAsStrings(doc: unknown, path = ''): string[] {
  const out: string[] = [];
  if (typeof doc === 'string') {
    if (/^-?\d+$/.test(doc) && Number.isSafeInteger(Number(doc)) && !/commit|engineVersion/.test(path)) out.push(`${path}=${doc}`);
  } else if (Array.isArray(doc)) doc.forEach((v, k) => out.push(...safeAsStrings(v, `${path}[${k}]`)));
  else if (doc && typeof doc === 'object') for (const [k, v] of Object.entries(doc)) out.push(...safeAsStrings(v, `${path}.${k}`));
  return out;
}
