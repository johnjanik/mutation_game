// The whole engine, for the fallback of engineCall (worker.ts, P6-size): a name that no caller has
// provided runs from here. Imported only by a dynamic import, so it is a chunk of its own
// (_astro/engineAll.<hash>.js) that no route fetches unless a call falls back
// (engine-fallback.spec.ts checks that no default state does).
export * from '@two-games/engine';
