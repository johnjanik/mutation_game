// The value of client:idle for the tool islands of /tools/<id> and /embed/<id> (SPEC.md 7.6: a tool is
// hydrated when the browser is idle). Astro 7.3.8's client:idle calls requestIdleCallback with no
// timeout, so an island waits for as long as the page has no idle period; on a page that never has
// one it never hydrates and nothing is logged (FIX-ci-e2e: reproduced with a page kept busy by a
// message loop, the signature of the CI failures, where the browser console of the failed test held
// no line at all). With a timeout the browser still hydrates at its first idle period, and at the
// latest after IDLE_TIMEOUT_MS when none comes.
export const IDLE_TIMEOUT_MS = 1000;

/** The options of client:idle for a tool island: `client:idle={IDLE_HYDRATION}`. */
export const IDLE_HYDRATION = { timeout: IDLE_TIMEOUT_MS } as const;
