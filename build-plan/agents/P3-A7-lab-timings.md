# P3-A7: npm run lab: Lighthouse CI or the Playwright fallback of SPEC 7.6

Phase 3, stage 3.1. Size S. Runs in: a worktree on branch `agent/P3-A7`.

Before this file you have read `build-plan/COMMON.md` and `build-plan/CONTRACTS.md`. Everything there applies.

## 1. Objective

When you are done, `npm run lab` (root `package.json` body `node scripts/lab.mjs`, unchanged) measures the lab timings of `SPEC.md` 7.6 on the built site: for each route of a route list it opens the page with the mobile profile of 7.6 (360 by 800 pixels, processor slowed four times), takes Largest Contentful Paint, Total Blocking Time and Cumulative Layout Shift, prints the three numbers per route against the thresholds 2.5 s, 200 ms and 0.1, and exits non-zero when a route fails. Its default route list is the core path (the index and the lessons M0 to M5) that gate G3 measures; G4 passes the lessons M6 and M7 as arguments, and G6 asks for every page. You first try Lighthouse CI, the tool 7.6 intends, for at most one hour, and build the Playwright fallback that 7.6 describes if it cannot be made to run; either way the command behaves the same, and your decisions fragment records which tool, why, the versions and the time spent. The script replaces `P0-A6`'s stub; `GATE` runs it at G3, G4 and G6; nothing in the site changes.

## 2. Read first, in this order

Read in full:

1. `SPEC.md` 7.6 (lines 1855 to 1871), marked [D]. The bullet "Lab timings" (line 1868) is the standard for this task and is quoted in 5.1. The first paragraph (line 1857) says which islands hydrate without an interaction (`client:idle` for the first tool, `client:visible` for the others), which decides what your measurement window contains. The bullet on Interaction to Next Paint (line 1869) says what you do not measure. The size bullets and "Main-thread work" belong to `P0-A6` (sizes), `P3-A2` (the benchmark) and phase 4 (the drawing-time test).
2. `SPEC.md` 7.7 (lines 1872 to 1887): the Performance row ("`npm run size` against the table of section 7.6; the lab timings of section 7.6", required "sizes: every merge; lab timings: gates G3, G4 and G6") and the paragraph "Commands, from the repository root" ("`npm run size` and `npm run lab` (the sizes and the lab timings of section 7.6)").
3. `SPEC.md` 9.1 (lines 1977 to 1995): the rows of phases 3, 4 and 6 (G3 "sizes and lab timings of section 7.6 on the core path M0 to M5"; G4 "lab timings on M6 and M7"; G6 "sizes and lab timings of section 7.6 on every page") and the owner's parts of G3 and G6 ("Interaction to Next Paint on one phone").
4. `SPEC.md` 7.1 (lines 1732 to 1756), marked [D]: the row "Performance checks" (line 1750), "a size script of our own (Playwright and Node's `zlib`); Lighthouse CI for lab timings", with "Lighthouse CI: the version current when phase 3 starts [U: not read from the registry]; section 7.6 gives a fallback that needs only Playwright".

Reference, read for the rules that apply:

5. `SPEC.md` 7.2 item 9 ("For automated checks prefer `astro build` followed by `astro preview`"), item 10 (`site` and `base` from the environment, `BASE_PATH`) and the closing rule (exact pins, committed lockfile), lines 1769 to 1772.
6. `SPEC.md` 9.3 (lines 2002 to 2013): "any added dependency, whether shipped to the reader or used only by the build, is recorded in `DECISIONS.md` with its version and licence, and with its size if it is shipped"; "For automated checks use `astro build` and `astro preview`, not `astro dev`".
7. `SPEC.md` 0.3 (the labels [U] and [D]) and Appendix E item 17, its last sentence (line 2375): "The [U] labels of section 7 concern tools, and the builder settles each one when the tool is first used."
8. `SPEC.md` 7.4, the bullet "Without JavaScript" (every island is rendered at build time and hydrates afterwards), and 7.8, "No third-party script at runtime".
9. `SOURCES.md` 11.8, line 327: "Performance thresholds: <https://github.com/GoogleChrome/web-vitals>", the reference the specification gives for the thresholds; the metric definitions of 5.6 follow that project and Lighthouse.
10. `CONTRACTS.md` 1 in full (the tree with `scripts/ ... lab.mjs (plan name for npm run lab)`, the root scripts including `lab`, `siteAndBase`, `BASE_PATH`, `OUT_DIR`, "the root Vitest configuration") and 10 (branch, commits, fragment, report).
11. Plan files that bind you: `build-plan/agents/P0-A6-scripts-and-ci.md` 5.1 (how `size.mjs` serves the built site with `astro preview` on its own port 4323, kills it, enumerates routes, applies `base` and exports its pure functions; your script follows the same conventions), 5.4 (the stub you replace), 5.6 (the body `node scripts/lab.mjs`), 5.8 (the order of `ci.yml`: `npm run check` runs before the Playwright install), 5.10 (`site/tests/unit/scripts.test.ts`, whose test `lab stub exits 2 with the phase-3 message` your change makes obsolete); `build-plan/agents/GATE.md` 5.5, 5.6 (paragraph "Lab timings") and 5.7 (how `GATE` invokes you, on which build, with `BASE_PATH=/`); `build-plan/README.md` 3.4 (resources) and 6 (the rows for root files and `scripts/`).

No oracle function and no golden key concern you (the roster's `oracle` and `golden` lists are empty). This instruction tells you to run `npm run lab`, which `COMMON.md` 4.3 otherwise reserves for `MERGE` and `GATE`.

## 3. Inputs you depend on

On `main` at G2, used as they are:

- `scripts/lab.mjs`, `P0-A6`'s stub, which prints `lab timings arrive in phase 3 (P3-A7)` and exits 2; the root `package.json` script `"lab": "node scripts/lab.mjs"`.
- `site/tests/unit/scripts.test.ts` (`P0-A6`) with the tests `lab stub exits 2 with the phase-3 message` and `root package.json has every command of 7.7 and no stub`.
- `scripts/size.mjs` (`P0-A6`): how it starts and kills `astro preview`, its route enumeration (`routesOf` in `P0-A6`'s plan names) and its `base` rule; `site/tests/unit/size-classify.test.ts`, which shows how a Vitest file imports a script's pure functions. Read both; reuse exported pure functions by import if they import cleanly; never edit them.
- `@playwright/test` 1.64.0 at the root (`SPEC.md` 7.1) and Chromium installed once per machine (`README.md` 3.4); `playwright.config.ts`, whose `webServer` uses port 4321.
- `site/astro.config.mjs` exporting `siteAndBase(env)` and honouring `OUT_DIR` (`CONTRACTS.md` 1); `npm run build` (the `prebuild` hook, then `astro build` into `site/dist`); `npm run preview -w site`.
- The root Vitest configuration (its file name is in `P0-A1`'s fragment) with the project `site-unit`, which includes `site/tests/unit/**/*.test.ts` in the `node` environment.
- `.gitignore` with `reports/*` ignored (except `gate-*.md`).
- The built pages of phases 0 to 2: the index with one Game Board (`P0-A5`), `/modules/m0-start/` and `/modules/m1-mutation/` (phase 1), `/modules/m2-form/` and `/modules/m3-classification/` (phase 2), the tool routes and the pages.
- Access to the npm registry for `npm view` (the pre-flight used it). If the registry is unreachable, Lighthouse CI cannot be tried: record that and take the fallback.

Not on `main` when you start: the lessons `/modules/m4-numbers/` and `/modules/m5-weyl/` (stage 3.3, `P3-A8` and `P3-A9`) and the tools T5 to T8 (stage 3.2). Your default run therefore reports M4 and M5 as missing; `GATE` measures the whole core path at G3. `P3-A1` and `P3-A2` work beside you in stage 3.1, and `P3-A2` runs a timing benchmark (section 9).

If the stub, the `lab` script, Playwright or Chromium is missing or cannot launch, stop and report `blocked` for what needs it; do not install a browser library of your own.

## 4. Deliverables

| File | Contents |
|---|---|
| `scripts/lab.mjs` | replaces the stub: the command of 5.3 to 5.10; a header comment giving the usage (read by `GATE`); the pure functions exported for the unit test; main-module guard |
| `site/tests/unit/lab-thresholds.test.ts` | the pure tests of 5.11; no browser |
| `decisions/P3-A7.md` | the fragment of 5.13 |
| root `package.json` (or `site/package.json`) and `package-lock.json` | Branch A only: the single devDependency of 5.10; untouched on Branch B |

Nothing else is yours (section 7). Files written by `--json` under `reports/` are run-time output and are never committed.

## 5. Requirements

### 5.1 The rule of the specification

`SPEC.md` 7.6 [D], verbatim: "**Lab timings**, on the built site with a mobile profile (360 by 800 pixels, processor slowed four times): Largest Contentful Paint at most 2.5 s, Total Blocking Time at most 200 ms, Cumulative Layout Shift at most 0.1. Tools reserve their box size in the HTML so that hydration does not shift the page. The intended tool is Lighthouse CI, whose current version and behaviour under Node 22 were not checked for this specification [U]. If it cannot be made to run within an hour, take the same three numbers in Playwright on Chromium (a `PerformanceObserver` for `largest-contentful-paint`, `layout-shift` and `longtask` entries, the processor slowed through a DevTools Protocol session) and record the choice in `DECISIONS.md`."

What each clause requires of you:

- "on the built site": you measure the build in `site/dist` (or the directory `OUT_DIR` names) served by `astro preview` (5.4). The script never builds and never runs `astro dev` (7.2 item 9; 9.3; roster trap 1).
- "a mobile profile (360 by 800 pixels, processor slowed four times)": a viewport of 360 by 800 CSS pixels and a fourfold processor slowdown. The specification names nothing else. The plan reads the parenthesis as the whole profile, so the network is not throttled (plan; record it, and see 5.10 for Lighthouse CI, whose default mobile profile differs).
- "at most": a value equal to its threshold passes (LCP 2.5 s, TBT 200 ms, CLS 0.1).
- "Tools reserve their box size in the HTML so that hydration does not shift the page": a rule for the tool owners, which your CLS measures. Your measurement window therefore includes the hydration of every island that hydrates without an interaction (5.6). You never edit a tool or a page to make a route pass.
- "The intended tool is Lighthouse CI ... [U]. If it cannot be made to run within an hour, take the same three numbers in Playwright on Chromium": the trial of 5.2 decides between Branch A (Lighthouse CI) and Branch B (the fallback); both give the same command, output and exit codes (5.3 to 5.9).
- "record the choice in `DECISIONS.md`": in your fragment (5.13). `COMMON.md` 4.2 forbids editing `DECISIONS.md`; `MERGE` folds the fragment in.

From the other sections:

- 7.1 [D], row "Performance checks": "section 7.6 gives a fallback that needs only Playwright". Branch B adds no dependency at all and imports only Node built-ins and `@playwright/test`; Branch A adds exactly one (5.10).
- 7.7: the command is `npm run lab`; the lab timings are required at "gates G3, G4 and G6", not at every merge, so `ci.yml` does not run the lab and you add no CI step.
- 9.1: G3 measures "the core path M0 to M5", G4 "M6 and M7", G6 "every page"; 5.3 gives each a form. Interaction to Next Paint is the owner's part of G3 and G6 ("checked by hand at each release on one mid-range phone, with a target of 200 ms", 7.6). The script does not measure it, and its header says so.
- 7.6 first paragraph: "the first tool of a page hydrates when the browser is idle (`client:idle`) and the others when scrolled into view (`client:visible`)". You never scroll, so islands below the fold stay as a reader who has not scrolled sees them; islands in view at 360 by 800 hydrate and count.
- 7.6 and 7.1 are [D]: design decisions open to revision by the owner. You implement the thresholds and the profile exactly and change neither (`COMMON.md` 4.4).

### 5.2 The one-hour trial of Lighthouse CI (7.6 [U], 7.1 [U]; the procedure is plan)

1. Read the registry and paste the output: `npm view @lhci/cli version`, `npm view @lhci/cli engines`, `npm view @lhci/cli license`, `npm view @lhci/cli dependencies`. This settles the [U] of 7.1 ("the version current when phase 3 starts"). `@lhci/cli` is where the plan believes Lighthouse CI is published [U: the plan's memory]; if the registry says otherwise, follow the registry and record what you found.
2. Start the clock at the first install command and write the time in your fragment. The hour is wall-clock time spent making Lighthouse CI run, from that command to the first good measurement; reading, and writing the shared core of 5.3 to 5.9 with its tests, do not count.
3. Install in a scratch directory outside the repository, so that the worktree changes only after the choice. Run each command as its own Bash call, with the directory passed as an argument and never through `cd` (`COMMON.md` 4.6: "pass the directory as an argument (`npm --prefix`, `git -C <dir>`, `npx --prefix`)"): `mktemp -d` (note the printed path, here `<tmp>`), then `npm --prefix <tmp> init -y`, then `npm --prefix <tmp> install --save-exact @lhci/cli@<version>`, and run the tool as `npx --prefix <tmp> lhci ...` or by the absolute path `<tmp>/node_modules/.bin/lhci`. This scratch install is the second exception to `COMMON.md` 4.1 ("Do not run `npm install`, which would change the lockfile") (plan): it runs outside the repository, writes only `<tmp>/package.json` and `<tmp>/package-lock.json`, and never touches the repository's `package.json` or `package-lock.json`. Before deleting `<tmp>`, confirm with `git -C <worktree> status --porcelain package.json package-lock.json` that it printed nothing.
4. Build the site once (`npm run build`) and serve it as in 5.4. Point Lighthouse CI at Playwright's Chromium through `CHROME_PATH` (the path printed by `node -p "require('@playwright/test').chromium.executablePath()"` at the repository root).
5. Configure the profile of 5.1 and 5.5 (screen 360 by 800, mobile, processor slowed four times through Lighthouse's DevTools throttling, `throttlingMethod: 'devtools'` with `cpuSlowdownMultiplier: 4`, which applies `Emulation.setCPUThrottlingRate` with rate 4, network not throttled; see 5.10) and collect `/` and `/modules/m0-start/`, with the run files written outside the repository.
6. Lighthouse CI is chosen (Branch A) when, inside the hour, all of these hold: it installs and runs under this machine's Node (22.12 or later) without error; it launches the Chromium; it accepts the DevTools throttling method, so that each run's report shows `configSettings.throttlingMethod` equal to `'devtools'` and `configSettings.throttling.cpuSlowdownMultiplier` equal to 4 together with the configured screen (a run under simulated throttling, `'simulate'`, does not count even when its multiplier reads 4, because it never sends `Emulation.setCPUThrottlingRate`: roster trap 2); and each run yields numeric LCP, TBT and CLS for both routes. If the DevTools throttling method cannot be used, the trial has failed. Otherwise take Branch B, and write in the fragment the minutes spent, what you tried and the last error verbatim. A Lighthouse CI that works is chosen even if the fallback looks simpler: 7.6 names it as the intended tool.
7. Delete the scratch directory by its absolute path (`rm -rf <tmp>`, one Bash call, no `cd`); nothing of the trial is committed. The fragment records the outcome as the settlement of the [U] of 7.6 ("behaviour under Node 22"), per Appendix E item 17.

### 5.3 The command line (plan, binding for `GATE`)

The script keeps `P0-A6`'s body (`node scripts/lab.mjs`) and takes its arguments after `--`. The header comment of `lab.mjs` and `--help` document every form below, because `GATE` reads the header to invoke it (`GATE.md` 5.6). `GATE` adds no flag beyond the route list, so the defaults below are what the gates measure.

- `npm run lab`: the default route list, the core path. The route `/` and, for each k from 0 to 5 in order, the one route `/modules/<slug>/` of the built directory whose slug begins with `m<k>-` (today, from the rosters: `m0-start`, `m1-mutation`, `m2-form`, `m3-classification`, `m4-numbers`, `m5-weyl`). The index is the roster's addition to the "core path M0 to M5" of 9.1 (plan). No match for a k gives a `missing` row; two matches give an `error` row. Finding the slugs by prefix keeps the default right if a lesson file is renamed; the prefix `m1-` must not match `m10-atlas`, and the module index `/modules/` is not a lesson.
- `npm run lab -- <route> [<route> ...]`: exactly those routes, in the order given. A route is a path from the site root without the base, beginning with `/` (for G4: `npm run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/`, the slugs read from `site/dist/modules/`). Normalise a missing trailing slash to the form the build uses; a route with no HTML file in the built directory is `missing`.
- `npm run lab -- --all`: every route of the built directory, the same list `size.mjs` measures (`index.html` at the root is `/`, `x/index.html` is `/x/`, `name.html` is `/name`; read Astro's `build.format` in the merged configuration, as `P0-A6` did). This is the form for G6, "every page".
- Options: `--url <base url>` measures a running server at that URL, which already includes the base, and starts none (the built directory is still read for the route list); `--dist <dir>` names the built directory; `--port <n>` (default 4324); `--runs <n>` (default 3, 5.7); `--json <file>` writes the results (5.8); `--help`. `--all` together with routes, an unknown option or a bad value prints the usage and exits 2. No option skips the canary of 5.9, changes a threshold or changes the profile.

### 5.4 Serving the built site (plan, following `size.mjs`)

- By default start `astro preview` of the built site on port 4324 (`size.mjs` uses 4323 and `playwright.config.ts` 4321, so the three never collide), with the environment passed through unchanged, so that `BASE_PATH` and `OUT_DIR` give the server the base and the directory of the build. Wait until the base URL answers 200 (at most 60 s, then exit 1 with the server's output). Confirm the port the server actually bound.
- Kill the server in a `finally` block and on `SIGINT` and `SIGTERM`, including npm's process group if you spawn through npm (`detached: true` and `process.kill(-pid)`), or spawn Astro's own binary from `site/` as `size.mjs` does (`COMMON.md` 4.5: "Kill `astro preview` when you are done").
- Take `base` from `siteAndBase(process.env).base`, imported from `site/astro.config.mjs` (`CONTRACTS.md` 1), the same source `size.mjs` uses (`P0-A6` 5.1) and that `playwright.config.ts`'s `baseURL` uses after `P0-A6`'s correction (`P0-A6` 5.7). Do not reimplement the rule and do not read `BASE_PATH` alone: `SPEC.md` 7.2 item 10 says that when `BASE_PATH` is unset, "in CI, the values that follow from `GITHUB_REPOSITORY` (`owner/repo` gives `https://owner.github.io` and `/repo/`)" apply, so a build made with `GITHUB_REPOSITORY` set and no `BASE_PATH` lives under `/<repo>/`, not under `/`. If `size.mjs` exports a route-URL function (`routeUrl(origin, base, routePath)` in `P0-A6`'s plan names), import it; otherwise a route's URL is the origin, then `base` (which begins and ends with `/`), then the route without its leading slash. If importing the config fails in Node outside Astro, stop and write a request to `MERGE` rather than copy the rule (as `P0-A6` 5.1 does). With `--url`, the URL given already carries the base and `siteAndBase` is not consulted. The script measures whatever build the directory holds, preview or release: at G3 and G6 `GATE` measures the release build built with `BASE_PATH=/`, at G4 the preview build (`GATE.md` 5.6 and 5.7).
- The built directory is `--dist`, else the directory `OUT_DIR` names when it is set (resolved as `astro.config.mjs` resolves it), else `site/dist`. When it holds no `index.html`, print `lab: no build found at <dir>; run npm run build first` and exit 1.
- A navigation whose response status is not 200 (304 counts as 200) makes the route `error`. The one exception (plan, the same as `P0-A6` 5.1) is the route `/404` built from `404.html`, which the preview server may answer with 404 by design: accept 200 or 404 for that route only, measure it like any other route, and record the exception in your fragment. Without it, `npm run lab -- --all` at G6 would always report an `error` row for `/404` and exit 1.

### 5.5 One measured run (Branch B; Branch A must match its profile)

- One headless Chromium for the whole command, from `@playwright/test` (imported lazily inside the measuring code, 5.11). Its version goes on the first output line.
- A new browser context for every run of every route (plan), so that each run is a first visit with an empty cache: `viewport: { width: 360, height: 800 }` (7.6), and (plan) `isMobile: true`, `hasTouch: true`, `deviceScaleFactor: 1`; JavaScript on; no emulated reduced motion or colour scheme.
- Before navigating, open a DevTools Protocol session on the page and slow the processor four times: `const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });` (roster trap 2; 7.6, "the processor slowed through a DevTools Protocol session"). The network is not throttled (5.1).
- Before navigating, install the observers with `page.addInitScript`, so that they exist before any script of the page: one `PerformanceObserver` per entry type, each with `{ type, buffered: true }`, for `largest-contentful-paint`, `layout-shift` and `longtask` (the three types 7.6 names) and, for the window of TBT, `paint` (plan). Keep the raw entries (`name`, `startTime`, `duration`, `value`, `hadRecentInput`) in a page global.
- `page.goto(url, { waitUntil: 'load' })`, then wait for the end of the measurement (5.6), then read the global with `page.evaluate`, then close the context.
- Never touch the page: no click, hover, focus, key, mouse movement or scroll, and no `page.evaluate` that dispatches an event. An input ends the reporting of LCP; a scroll hydrates `client:visible` islands that 7.6 keeps out of the first view. Reading the recorded entries is not touching.

### 5.6 The three numbers (plan definitions, after web-vitals and Lighthouse)

- **End of the measurement**: after `load`, wait until five seconds have passed with no request in flight, no request started and no long task (the quiet window of Time to Interactive), checked every 250 ms, with a ceiling of 30 s from navigation. Reaching the ceiling makes the run an `error` ("did not settle"), never a pass. Track requests with `page.on('request')`, `requestfinished` and `requestfailed`. `networkidle` alone is not enough: a `client:idle` island fetches its code once the browser is idle, and its hydration is where a tool that does not reserve its box shows as CLS.
- **Largest Contentful Paint**: the `startTime` of the last `largest-contentful-paint` entry, in milliseconds (printed in seconds). No entry makes the run an `error` ("no LCP entry"), never zero.
- **Total Blocking Time**: let FCP be the `startTime` of the `paint` entry named `first-contentful-paint` (none: `error`). The blocking part of a `longtask` entry runs from 50 ms after its start to its end; TBT is the total length of the blocking parts that lies between FCP and the end of the measurement. This is Lighthouse's definition with Time to Interactive replaced by the end of the quiet window; since that window begins after the last long task, it counts every blocking part Lighthouse would count and never less. No long task gives 0.
- **Cumulative Layout Shift**: the `layout-shift` entries with `hadRecentInput` false, grouped into session windows: an entry joins the current window when it starts less than 1000 ms after the previous entry and less than 5000 ms after the window's first entry, and otherwise opens a new window; CLS is the largest window's sum. No shift gives 0.
- Zero is a legitimate TBT and CLS, so a broken observer would read as a perfect page. The canary of 5.9 must therefore show both far above their thresholds in every command.

### 5.7 Runs, thresholds, statuses, exit codes (plan, except the thresholds and the profile)

- Each route is measured `--runs` times (default 3, as Lighthouse CI practises); its value for each metric is the median of its runs, taken per metric (for an even count, the mean of the two middle values). A run in error makes the route `error`; a run is never dropped silently.
- Thresholds, an exported constant: `THRESHOLDS = { lcpMs: 2500, tbtMs: 200, cls: 0.1 }`. Profile, an exported constant: `PROFILE = { width: 360, height: 800, cpuSlowdown: 4 }`. A metric passes when its median is at most its threshold, compared unrounded.
- A route is `ok`, `OVER` (naming each failing metric), `missing` or `error` (with the reason).
- Exit 0 when every route is `ok`, the canary failed all three thresholds and the processor check passed. Exit 1 for any `OVER`, `missing` or `error` row, a server that does not start, an empty route list, a canary that passes a threshold or a failed processor check. Exit 2 for usage errors (the codes of `size.mjs`).

### 5.8 Output (plan)

- First line: the tool and its versions (Branch A: `@lhci/cli` and Lighthouse; Branch B: Playwright and Chromium), the profile (`360x800`, `CPU slowdown 4x`, network not throttled), the number of runs and the median, the built directory, the base, and the processor check of 5.9.
- Then the table on standard output, one line per route: the route; LCP in seconds to three decimals; TBT in milliseconds to one decimal; CLS to four decimals; the status. The header names the thresholds: `LCP (<= 2.5 s)`, `TBT (<= 200 ms)`, `CLS (<= 0.1)`. Then the canary line, labelled as the canary and not counted as a route. Then the summary `lab: N routes measured, M over threshold, E missing or in error`.
- Progress (the route and run being measured) goes to standard error, so that `GATE`'s log shows a long run moving and the table stays clean. Plain ASCII; no em-dash.
- `--json <file>`: the profile, the tool and versions, every run's raw numbers, the medians, the statuses, the canary and the processor check. Create the parent directory; files under `reports/` are ignored by git and never committed.

### 5.9 The deliberately slow fixture, and the processor check (plan)

Roster acceptance: "a deliberately slow fixture route fails the thresholds (test)". A browser cannot be launched from `site/tests/unit` (5.11), so the browser-level proof is a canary inside every run, beside the pure test of 5.11:

- `lab.mjs` holds a fixture page as an exported string (`CANARY_HTML`), served by a throwaway server of Node's `http` module on a free port (or by Playwright request interception), and measured once, first in every command, with the same profile and the same code (on Branch A, through Lighthouse CI). It fails each threshold independently and by a wide margin: a short first paint; a large block of text shown about 3.5 s after load (LCP well above 2.5 s); then one task that loops for 600 ms of wall-clock time (TBT about 550 ms, whatever the slowdown); then a block of at least 300 pixels inserted above the large text (CLS well above 0.1). It fetches nothing.
- If the canary passes any threshold, print `lab: measurement check failed: the slow fixture passed <metric>` and exit 1 before measuring a route.
- Processor check, Branch B: in a blank page, time a fixed amount of work (calibrated to take at least 100 ms without slowdown) at rate 1 and at rate 4, and print the ratio on the first line; below 2.5, print `lab: the processor slowdown did not take effect (ratio <r>)` and exit 1. A throttle that silently failed would make every page pass. Branch A: check instead, for every run including the canary's, that the report's `configSettings.throttlingMethod` is `'devtools'` (the method that applies `Emulation.setCPUThrottlingRate`, roster trap 2), that `configSettings.throttling.cpuSlowdownMultiplier` is 4 and that the screen is 360 by 800; otherwise print `lab: the processor slowdown did not take effect (<setting found>)` and exit 1. Print the method and multiplier on the first line in place of the ratio.

### 5.10 Branch A: Lighthouse CI (only if the trial succeeded)

- One devDependency, `@lhci/cli` at the exact version of 5.2, in the root `package.json` (plan: the root, because `scripts/lab.mjs` resolves packages from the root `node_modules`; the roster allows `site/package.json` too), installed with the single command `npm install --save-dev --save-exact @lhci/cli@<version>` at the repository root. That command is the one exception inside the repository to `COMMON.md` 4.1 ("Do not run `npm install`"; the scratch-directory trial install of 5.2 step 3 is the other, outside the repository), allowed because this instruction names the dependency (`COMMON.md` 3; `README.md` 3.2); its changes to `package.json` and `package-lock.json` are the only ones you make there (roster protocol: "this dependency only"). The `lab` body stays `node scripts/lab.mjs`. Record the version and the licence (read from the installed package's `package.json`); it is not shipped to the reader, so no size (9.3).
- `lab.mjs` runs Lighthouse CI's collect step against the routes served as in 5.4, with the runs of 5.7 and Playwright's Chromium, reads LCP, TBT and CLS from each run's report, and applies 5.7 to 5.9 itself, so that the table, the canary and the exit codes are those of Branch B. The plan remembers [U] that Lighthouse's default mobile screen is not 360 by 800, that its default throttling simulates a slower processor and network rather than slowing the processor, that run files go to `.lighthouseci/` under the working directory, and that the three audits are `largest-contentful-paint`, `total-blocking-time` and `cumulative-layout-shift`, each with a `numericValue`. Read the installed version; set the screen, the slowdown and the network explicitly; record every setting. The slowdown must go through `Emulation.setCPUThrottlingRate` with rate 4 (roster trap 2; 7.6, "the processor slowed through a DevTools Protocol session"): use Lighthouse's DevTools throttling, `throttlingMethod: 'devtools'` with `throttling.cpuSlowdownMultiplier: 4` and no network throttling (the option names are [U: the plan's memory of Lighthouse]; confirm them in the installed version). Never use the simulated method (`'simulate'`, Lighthouse's default), which estimates a slower processor without slowing it and never sends that call. If the installed version cannot apply DevTools throttling, the trial of 5.2 has failed and Branch B is taken.
- Keep the configuration inside `lab.mjs` or in a temporary file outside the repository (no `lighthouserc` file at the root: it is not in your files), and run the collect step with its working directory in a temporary directory, so that no run file appears in the worktree.
- Never run an upload step, to a server or to public storage: the measurement needs no service, and the reports contain page content.

### 5.11 Unit tests, `site/tests/unit/lab-thresholds.test.ts` (the test names are plan)

No browser. `ci.yml` runs `npm run check` (which includes `npm test`) before it installs Chromium (`P0-A6` 5.8), so a test under `site/tests/unit` that launches a browser fails in CI. Export the pure parts of `lab.mjs` and import them as `size-classify.test.ts` imports `size.mjs`; load Playwright only inside the measuring function; guard the main-module behaviour by comparing `import.meta.url` with `process.argv[1]`. Plan names: `THRESHOLDS`, `PROFILE`, `CANARY_HTML`, `parseArgs`, `usage`, `defaultRoutes`, `allRoutes`, `lcpFrom`, `tbtFrom`, `clsFrom`, `settled`, `median`, `evaluate`, `canaryVerdict`, `processorVerdict`, `exitCode`, `formatTable`. The tests, by name:

- `thresholds are exactly 2.5 s, 200 ms and 0.1` and `the profile is 360 by 800 with a fourfold processor slowdown` (a loosened constant fails them).
- `a value equal to its threshold passes and one just above fails`, for each metric on its own (2500 and 2501 ms; 200 and 200.1 ms; 0.1 and 0.1001).
- `a deliberately slow route fails all three thresholds`: recorded raw entries of a slow page (FCP at 300 ms, a 600 ms long task after it, a shift of 0.3, a last LCP entry at 3500 ms) give `OVER` naming LCP, TBT and CLS. `a fast route passes`: recorded entries of a light page give `ok`.
- `TBT sums the blocking parts of long tasks inside the window`: tasks of 40, 50, 80 and 250 ms after FCP add 0, 0, 30 and 200, total 230; a task that ends before FCP adds nothing; a task that straddles FCP adds only its blocking part after FCP.
- `CLS is the largest session window of shifts without recent input`: a gap of 1000 ms or more opens a window; a window reaching 5000 ms closes; entries with `hadRecentInput` are ignored.
- `LCP is the last entry; no entry is an error, never zero`.
- `the run ends only after five seconds without a request or a long task` and `a run that never settles is an error`, on simulated timelines.
- `the median of three runs is taken per metric`.
- `the default route list is the index and M0 to M5`: a fixture directory under `os.tmpdir()` with `index.html`, `modules/index.html`, `modules/m0-start/` to `modules/m5-weyl/`, `modules/m10-atlas/` and `about/` gives `/` and the six lessons in order, without `m10-atlas`. `a missing core-path lesson is reported and fails the run`: the same without M4 and M5.
- `--all lists every built route`, the same list as `size.mjs` gives for the fixture, which includes a `404.html` giving `/404`.
- `a route that did not answer 200 is an error, except /404 answering 404` (plan): `evaluate` on a row for `/about/` with HTTP status 404 marks it `error` and `exitCode` gives 1; the same row with status 200 and values within the thresholds passes; a row for `/404` with status 404 and values within the thresholds passes.
- `route URLs carry the base from siteAndBase` (plan): given `siteAndBase({ GITHUB_REPOSITORY: 'owner/repo' }).base`, the route `/about/` on origin `http://localhost:4324` gives `http://localhost:4324/repo/about/`; with `{ BASE_PATH: '/sub/path/' }` it gives `http://localhost:4324/sub/path/about/`; with `{ BASE_PATH: '/' }` it gives `http://localhost:4324/about/`.
- `parseArgs understands routes, --all, --url, --dist, --port, --runs, --json and rejects the rest` (code 2 for an unknown option and for `--all` with routes), and `the usage text documents the default list, explicit routes and --all`.
- `a canary that passes any threshold fails the run` and `the processor check fails below a ratio of 2.5`.
- `exit code is 1 when a route is over, missing or in error, and 0 otherwise`.
- `the table prints LCP, TBT and CLS for every route with the thresholds and a summary line`.

Each test must fail when the behaviour it guards is removed (`COMMON.md` 4.3); break one on purpose once and restore it. No `it.only`, no skip, no `--passWithNoTests`.

### 5.12 What is not yours

- Making a page pass. If a route of your run is `OVER`, report the route, the metric, the medians and your best reading of the cause (for CLS, which element moved; for TBT, the long tasks and when they ran) under `requests` to `MERGE`, for the owner of that page or tool. Never edit `site/src/`, a `client:` directive, a threshold or the profile.
- Interaction to Next Paint (owner's part, 7.6 and 9.1), the main-thread benchmark (`P3-A2`), the drawing-time test (phase 4), the size budget (`size.mjs`, `P0-A6`).
- `ci.yml` (lab timings are a gate item, 7.7), `playwright.config.ts`, the root Vitest configuration, `.gitignore`, `DECISIONS.md`, and `CLAUDE.md`, whose command list is `GATE`'s to change on the owner's instruction (`README.md` 6).
- `site/tests/unit/scripts.test.ts`: its test `lab stub exits 2 with the phase-3 message` fails once the stub is gone. That is by design. You do not edit the file; you ask `MERGE`, under `requests`, to delete that one test when merging your branch, since `lab-thresholds.test.ts` covers `lab.mjs` from now on.

### 5.13 Your decisions fragment, `decisions/P3-A7.md`

One dated entry per decision in the form of `COMMON.md` 5.1, covering at least: the tool chosen and why; the trial (start and end time, minutes, what was tried, and the last error verbatim if Lighthouse CI was abandoned: roster deliverable 2, "the hour spent if Lighthouse CI was abandoned"); the [U] items settled per Appendix E item 17 (7.1: the version of `@lhci/cli` read from the registry on that day; 7.6: its behaviour under this machine's Node); the versions (Node, Playwright, Chromium, and on Branch A `@lhci/cli` and Lighthouse); the dependency added with version and licence, or "no dependency added" on Branch B (7.1: "a fallback that needs only Playwright"); the profile as implemented (viewport, `isMobile`, `hasTouch`, `deviceScaleFactor`, the DevTools Protocol call, no network throttling and why); the definitions of 5.6 and the end of the measurement; runs and median; the route forms and the rule that a missing core-path lesson fails; the base taken from `siteAndBase(process.env)` as in `size.mjs`; the non-200 rule and its `/404` exception; port 4324; the canary and the processor check; the output and the exit codes; the request about `scripts.test.ts`. No default of `SPEC.md` 10 is involved; say so.

### 5.14 Positions against labels; [U] and [D]

- No engine call and no node numbers: nothing to convert.
- [U]: the items of 7.1 and 7.6 are tool items, settled by you and recorded (Appendix E item 17). No lesson prose is yours, so nothing is wrapped in `<Unverified>` and nothing is added to `content/unverified.json`.
- [D]: 7.1 and 7.6 are design decisions open to the owner; implement them exactly. Every rule above marked (plan) is the plan's concretion; your fragment records each, so that `MERGE` and the owner can see it.

## 6. Acceptance

Every line names its proof and its gate. "Command" means the command and its summary line go in `commandsRun`; "live" means your own run, pasted under `labRuns`. Your runs in stage 3.1 are functional evidence on the index and M0 to M3; the gate measurement is `GATE`'s.

- [ ] `npm run lab` runs on the built site and prints the three numbers per route (roster acceptance 1; `SPEC.md` 7.6; 7.7 "`npm run lab` (the sizes and the lab timings of section 7.6)"). Live: `npm run build`, then `npm run lab -- / /modules/m0-start/ /modules/m1-mutation/ /modules/m2-form/ /modules/m3-classification/`, table pasted (exit 0, or exit 1 with each `OVER` row reported as 5.12 says); `lab-thresholds.test.ts > the table prints LCP, TBT and CLS for every route with the thresholds and a summary line`. G3; `GATE` runs the default list there.
- [ ] A deliberately slow fixture route fails the thresholds (roster acceptance 2). `lab-thresholds.test.ts > a deliberately slow route fails all three thresholds`, `> a fast route passes`, `> a canary that passes any threshold fails the run`; live: the canary line of every run reads over on LCP, TBT and CLS. G3.
- [ ] The thresholds are those of 7.6, and "at most" includes equality: `> thresholds are exactly 2.5 s, 200 ms and 0.1`, `> a value equal to its threshold passes and one just above fails`. G3, G4, G6.
- [ ] The mobile profile is 360 by 800 with the processor slowed four times through a DevTools Protocol session (7.6; roster trap 2): `> the profile is 360 by 800 with a fourfold processor slowdown`, `> the processor check fails below a ratio of 2.5`; live: the first line of every run shows the profile and a ratio near 4 (Branch B) or the settings read from the reports (Branch A); command `grep -n "setCPUThrottlingRate" scripts/lab.mjs` (Branch B); Branch A, the JSON of a live run (`--json`) or a kept report shows, for every run including the canary's, `configSettings.throttlingMethod` equal to `"devtools"` and `configSettings.throttling.cpuSlowdownMultiplier` equal to 4 (5.9, 5.10), and command `grep -n "'devtools'" scripts/lab.mjs` finds the setting. G3.
- [ ] Measured on the built site through `astro preview`, never `astro dev` (roster trap 1; 7.2 item 9; 9.3): command `grep -n "astro dev" scripts/lab.mjs` prints nothing; after a run, command `lsof -nP -iTCP:4324 -sTCP:LISTEN` prints nothing (the server was killed). G3; `RT-12` repeats it.
- [ ] The three numbers are those 7.6 names, taken as 5.6 defines them: `> TBT sums the blocking parts of long tasks inside the window`, `> CLS is the largest session window of shifts without recent input`, `> LCP is the last entry; no entry is an error, never zero`, `> the run ends only after five seconds without a request or a long task`, `> a run that never settles is an error`, `> the median of three runs is taken per metric`. G3.
- [ ] Route lists: the core path by default (G3), explicit routes (G4), every page (G6) (roster deliverable 1; 9.1): `> the default route list is the index and M0 to M5`, `> a missing core-path lesson is reported and fails the run`, `> --all lists every built route`, `> parseArgs understands routes, --all, --url, --dist, --port, --runs, --json and rejects the rest`, `> the usage text documents the default list, explicit routes and --all`; live: `npm run lab` with no arguments lists M4 and M5 as `missing` and exits 1, as expected before stage 3.3. G3, G4, G6.
- [ ] Exit non-zero on failure (roster deliverable 1): `> exit code is 1 when a route is over, missing or in error, and 0 otherwise`; live: the exit status of the default run. G3.
- [ ] Routes are opened under the base the build used, and an error page cannot pass (plan; `SPEC.md` 7.2 item 10; 5.4): `> route URLs carry the base from siteAndBase`, `> a route that did not answer 200 is an error, except /404 answering 404`; command `grep -n "siteAndBase" scripts/lab.mjs` finds the import. G3, G4, G6.
- [ ] The tool choice of 7.6 and the version of 7.1 are settled and recorded (7.6 [U], 7.1 [U]; Appendix E item 17; roster deliverable 2): `decisions/P3-A7.md` names the tool, why, the versions and the minutes of the trial; command `npm view @lhci/cli version` and the other three of 5.2. Read by `MERGE`, which folds the fragment into `DECISIONS.md` ("record the choice in `DECISIONS.md`"). Every merge; `GATE` records the lab dependency's version from G3 on Branch A.
- [ ] Dependencies (7.1, "a fallback that needs only Playwright"; 9.3; roster protocol "this dependency only"): Branch B, command `git diff --stat main -- package.json package-lock.json site/package.json packages/engine/package.json` prints nothing; Branch A, the same command lists `package-lock.json` and the one `package.json` that received the dependency, `git diff main -- package.json site/package.json` adds exactly the line `"@lhci/cli": "<exact version>"`, and the fragment gives version and licence. Every merge; `RT-10`.
- [ ] The `lab` command keeps its body and every command of 7.7 exists: `P0-A6`'s `scripts.test.ts > root package.json has every command of 7.7 and no stub` passes; `> lab stub exits 2 with the phase-3 message` is the only failing test of that file, by design, with the request to `MERGE` (5.12). Command `npx vitest run site/tests/unit/scripts.test.ts`. Every merge.
- [ ] The unit tests need no browser (CI runs `npm test` before installing Chromium): command `grep -n "launch\|newCDPSession\|chromium" site/tests/unit/lab-thresholds.test.ts` prints nothing; command `npx vitest run site/tests/unit/lab-thresholds.test.ts` passes. Every merge.
- [ ] Type checks and the engine suite pass: commands `npm run typecheck` and `npm test -w packages/engine`. Every merge.
- [ ] Interaction to Next Paint on one phone: `not-automated`, the owner's part of G3 and G6 (`SPEC.md` 7.6, "checked by hand at each release on one mid-range phone, with a target of 200 ms"; 9.1). `lab.mjs` does not measure it, and its header says so. G3, G6 (owner).

## 7. Files

- **You own** (the roster's list, exactly):
  - `scripts/lab.mjs`
  - `site/package.json or root package.json (the lab dependency if Lighthouse CI is chosen; protocol: this dependency only)`
  - `site/tests/unit/lab-thresholds.test.ts`
  - `decisions/P3-A7.md`
- **Also yours, marked (plan)**: `package-lock.json`, only through the one install of 5.10 on Branch A (`README.md` 6 lists `P3-A7` among the editors of the root `package.json` and the lockfile); `scripts/lab.d.mts`, only if the type-check of your test cannot do without a declaration for `lab.mjs` (prefer JSDoc in the script, and do what `size-classify.test.ts` does for `size.mjs`); run-time output under `reports/`, never committed.
- **You may edit with the stated protocol**: the root (or site) `package.json`, one entry under `devDependencies` with an exact version, on Branch A only; never `scripts`, never another field. Nothing else.
- **You must not touch**: everything else; in particular `reference/`, `DECISIONS.md`, `content/unverified.json`, `scripts/size.mjs`, `verify.mjs`, `numbers-in-prose.mjs` and `report.mjs` (`P0-A6`), `scripts/names.mjs` and `katex-assets.mjs` (`P0-A3`, `P6-A2`), `site/tests/unit/scripts.test.ts` and `size-classify.test.ts` (`P0-A6`; your request goes to `MERGE`), `playwright.config.ts`, the root Vitest configuration, `.gitignore`, `.github/workflows/*`, `site/astro.config.mjs`, everything under `site/src/` and `site/public/`, every other test under `site/tests/`, `packages/engine/*`, `CLAUDE.md`, the licences, other agents' `decisions/` fragments, `build-plan/`.

## 8. Order of work

1. Confirm the worktree and branch (`git rev-parse --show-toplevel`, `git branch --show-current`); `node --version` (22.12 or later, else stop); `npm ci --prefer-offline` if `node_modules` is absent; `npx playwright --version`; check that Chromium launches. Read `scripts/lab.mjs`, `scripts/size.mjs`, `site/tests/unit/size-classify.test.ts`, `site/tests/unit/scripts.test.ts`, `playwright.config.ts`, `site/astro.config.mjs`, the `scripts` of the root `package.json`, and `ls site/src/content/modules/`.
2. `npm run build`; `ls site/dist/modules/` (M0 to M3 expected).
3. The trial of 5.2, time-boxed. Write the decision entry at once. Commit `P3-A7: lab tool decision`.
4. The pure core of `lab.mjs` (5.3, the pure parts of 5.6 to 5.9) together with `lab-thresholds.test.ts`; `npx vitest run site/tests/unit/lab-thresholds.test.ts`. Commit `P3-A7: lab.mjs core and threshold tests`.
5. Branch A only: the install of 5.10. Commit `P3-A7: @lhci/cli <version>`.
6. The server, the measurement, the canary and the processor check. Measure `/` once with `--runs 1` to see the canary and the ratio; then the two live runs of section 6 (explicit core routes; the default list); optionally `npm run lab -- --all`, noting its duration for `GATE`. Check that port 4324 is free afterwards. Commit `P3-A7: lab measurement`.
7. `npm run typecheck`; `npx vitest run site/tests/unit/scripts.test.ts` (only the stub test fails); `npm test -w packages/engine`; break one assertion of your test on purpose and restore it.
8. Complete the fragment (5.13). Commit `P3-A7: decisions fragment`.
9. The report (section 10).

If you must stop early: after step 6 on Branch B (steps 5 and 6 on Branch A), `GATE` can run G3; say exactly which step you reached.

## 9. Traps

- **Roster traps, verbatim**: "Measure against astro preview, never astro dev." and "Processor slowdown must be applied through CDP Emulation.setCPUThrottlingRate (4x)." The call is per page, on that page's own session, before `page.goto`; sent after navigation it misses the parse and the first tasks. CDP sessions exist only in Chromium.
- **A throttle that silently failed makes every page look fast.** The processor check of 5.9 is what catches it; do not remove it to save time.
- **Zero is a legitimate TBT and CLS**, so an observer that never fired reads as a perfect page; the canary is the guard. A missing LCP is an error, never zero.
- **Observers must exist before the page's scripts**: `page.addInitScript`, one observer per type with `{ type, buffered: true }` (the `entryTypes` form cannot be combined with `buffered`). Do not rely on buffered `longtask` entries being kept for late observers.
- **`networkidle` is not the end.** `client:idle` hydration starts once the browser is idle and may fetch after the network was quiet; the quiet window of 5.6 covers it. A `client:visible` island in view at 360 by 800 hydrates without any scroll and counts.
- **Do not touch the page.** An input stops LCP reporting; a scroll hydrates islands below the fold, which the first view excludes.
- **One fresh context per run**, or the second and third runs measure a warm cache.
- **Median per metric**, not the median run; compare unrounded values; a value equal to its threshold passes.
- **Never loosen a threshold, change the profile, skip a route, drop a run or retry until green** (`COMMON.md` 4.4, 4.5), and never edit a tool or a lesson to make a route pass: report it (5.12).
- **The base of the build and of the server must agree.** The environment passes through to `astro preview`; a build with one base served with another loses every asset and reads as a fast blank page. `BASE_PATH` unset does not mean base `/` (`P0-A6` trap): with `GITHUB_REPOSITORY` set the base is `/<repo>/` (`SPEC.md` 7.2 item 10). Take `base` from `siteAndBase(process.env)` (5.4), never from `BASE_PATH ?? '/'`, and fail any route that does not answer 200, except `/404` answering 404.
- **Ports and processes**: `astro preview` may move to another port when 4324 is taken; read its output. Kill the process group. Set `process.exitCode` and return, rather than calling `process.exit` inside an async path, so that the `finally` that kills the server runs.
- **`m1-` against `m10-`**: match the prefix with its hyphen; `/modules/` itself (the module index) is not a lesson.
- **Headless mode**: confirm once, on the canary, that all four entry types arrive in the headless Chromium that Playwright 1.64.0 launches by default (print their counts); if one is missing, use the mode the installed Playwright documents for full Chromium, and record it. Read the installed Playwright's types for `newCDPSession` and `addInitScript` rather than remembering them (`COMMON.md` 3).
- **The unit test imports `lab.mjs`**: load Playwright lazily inside the measuring code, so that the import loads no browser library under Vitest; for the typing of an `.mjs` import, do what `size-classify.test.ts` does.
- **`scripts.test.ts` breaks by design** when the stub goes; request, do not edit (5.12).
- **What the plan says about Lighthouse CI is memory [U]**: its package name, default screen, default throttling, run-file directory and audit names. Read the installed version. Use `CHROME_PATH` for Playwright's Chromium; never upload; no `lighthouserc` at the root; no `.lighthouseci/` left in the worktree.
- **`npm install`**: the workflow prompt and `COMMON.md` 4.1 forbid it in the repository. There are two exceptions, both named by this instruction: the trial install of 5.2 step 3, which runs with `npm --prefix <tmp>` in a scratch directory outside the repository and never touches the repository's lockfile (plan), and the single command of 5.10 on Branch A. Any other `npm install`, and any trial install run inside the worktree, is forbidden. Put it in `commandsRun` and in `handoff`, so that `MERGE` runs `npm ci` after merging.
- **Noise in stage 3.1**: `P3-A2` runs the 25 ms benchmark of 7.6 beside you, and a throttled Chromium competes for the processor. Your numbers are functional evidence, not the gate's; rerun a failing route once when the machine is quieter before you report it, and say that you did.
- **Duration**: three runs of about ten seconds per route; `--all` at G6 covers every page and may run for an hour. Progress goes to standard error; `GATE` backgrounds the command (`GATE.md` 5.5). Do not lower the default number of runs to save time.
- **`console` output is the script's purpose**: the `console.log` rule of `COMMON.md` 4.4 concerns shipped site code, which `lab.mjs` is not. No em-dash in the script, its messages, the test or the fragment.
- **Nothing under `reports/` is committed**, and nothing is ever written into `reference/`.

## 10. Report

The JSON of `COMMON.md` 5.2, with `"agent": "P3-A7"`, `"branch": "agent/P3-A7"`, the worktree path git printed, `commits` in order, and `acceptance` holding every line of section 6 in order with its test or command. Add these fields:

```json
{
  "labTool": {"chosen": "lighthouse-ci | playwright-fallback", "trial": {"start": "...", "end": "...", "minutes": 0, "outcome": "...", "lastError": "..."}, "registry": {"@lhci/cli": "<version>", "engines": "...", "license": "..."}},
  "versions": {"node": "...", "playwright": "1.64.0", "chromium": "...", "lhci": null, "lighthouse": null},
  "profile": {"width": 360, "height": 800, "cpuSlowdown": 4, "isMobile": true, "hasTouch": true, "deviceScaleFactor": 1, "network": "not throttled", "runs": 3, "aggregate": "median per metric", "quietWindowMs": 5000, "ceilingMs": 30000, "port": 4324},
  "processorCheckRatio": 0,
  "labRuns": [{"cmd": "npm run lab -- / /modules/m0-start/ ...", "exit": 0, "seconds": 0, "rows": [{"route": "/", "lcpS": 0, "tbtMs": 0, "cls": 0, "status": "ok"}], "canary": {"lcpS": 0, "tbtMs": 0, "cls": 0, "status": "over on LCP, TBT, CLS"}}],
  "dependencyAdded": null,
  "failingRoutes": [],
  "invocationForms": {"G3": "npm run lab", "G4": "npm run lab -- /modules/m6-multiple-edges/ /modules/m7-geometry/", "G6": "npm run lab -- --all"}
}
```

`requests` must contain at least: to `MERGE`, delete `site/tests/unit/scripts.test.ts > lab stub exits 2 with the phase-3 message` when merging `agent/P3-A7` (and, on Branch A, run `npm ci` after the merge); to `GATE`, the three invocation forms, the measured duration per route, and that the lab runs alone; for every `OVER` route of your runs, its owner, the metric and the evidence. `deviations` lists the (plan) concretions with their reasons, so that `MERGE` or the orchestrator can strike one: the index in the default list, a missing core-path lesson failing the run, port 4324, three runs and the median, the quiet window and its ceiling, the TBT window, the CLS session windows, no network throttling, `isMobile`, `hasTouch` and `deviceScaleFactor`, the canary, the processor check, the output and the exit codes. `openQuestions` carries at least: whether the owner wants the network throttled as Lighthouse's own mobile preset does (7.6 names only the viewport and the processor); whether three runs over every page at G6 is acceptable in time. `handoff`: two or three sentences for `MERGE` and `GATE`: which tool was chosen, the three invocation forms, that the stub test must go, and on Branch A that `npm ci` installs the new dependency.
