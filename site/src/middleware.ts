// Astro middleware. The site is static, so this runs once per page while the build generates it, and
// never in the reader's browser. It adds, to the head of a page with KaTeX markup, the preloads of the
// KaTeX fonts that markup uses (lib/katex.ts withKatexFontPreloads; SPEC.md 7.6 lab timings; RT-FIX
// P4-RT-07-03), with the base path from import.meta.env.BASE_URL (SPEC.md 7.2 item 10). A page learns
// which mathematics it holds only after its head is written, so the preloads are added to the page as
// generated; a page without KaTeX markup is returned as it is.
import { defineMiddleware } from 'astro:middleware';
import { withKatexFontPreloads } from './lib/katex';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!(response.headers.get('content-type') ?? '').startsWith('text/html')) return response;
  const html = await response.text();
  return new Response(withKatexFontPreloads(html, import.meta.env.BASE_URL), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});
