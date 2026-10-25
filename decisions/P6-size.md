# Decisions of P6-size (size repair of phase 6: a route ships only the engine modules its own code uses)

## 2026-10-25 P6-size: environment and starting point
Decision: none; record. Worktree branch `worktree-agent-a80a7ec144cad9518`, reset with `git reset --hard f2177d7` (the integration head with P6-A1, P6-A2, P6-A5 and P6-A6 merged) before any change; `npm ci --prefer-offline` once; Node v22.22.0, Vite 8.3.4 with Rolldown 1.2.13. Browser runs used a scratch copy of `playwright.config.ts` whose web server is `astro preview --port 7170 --ignore-lock` in `site/`; `npm run size -- --port 7171`. No file of `packages/engine` changed; no dependency added; no data-out name, prop, preset, link key or exact string changed.

## 2026-10-25 P6-size: three causes put every engine module into one chunk that every route fetched
Decision: all three are removed. (1) `site/src/lib/worker.ts` spread the engine namespace into its main-thread table (`export const engineApi = { ...engine, positionsOf, firstForbiddenMove }`), which made every export of the engine live. (2) `site/src/components/lesson/Challenge.svelte` imported the whole engine dynamically (`await import('@engine')`) for the two functions of its input check; a dynamic import of the engine's index.ts made Rolldown put every engine module into that dynamic entry's chunk (`_astro/src.<hash>.js`), which every static importer then shared. (3) The bundler assumed the engine's modules have side effects, so an import of one name through index.ts reached every module the index re-exports, and all engine modules had the same importers. What the specification left open: 7.6 [D] says what a route carries ("the tool's own code with the engine functions only it uses"), not how. Reason: each cause alone kept the whole engine in the shared chunk, which is why RT-FIX-P3-perf-b measured no change on `/` when it removed (1) and (3) but not (2). Measured on this build (Vite 8.3.4): with (2) left in place, removing (1) and (3) leaves `_astro/src.<hash>.js` at 72 kB raw with every module; with all three removed the engine splits into chunks by the routes that use its modules (`board`, holding the core every tool uses, then `weyl`, `geometry`, `fold`, `wythoff`, `heaps`, `rep`), `rep.ts` lands only in T12's closure, and satake.ts and satakeCatalogue.ts only in `engineAll` (no route uses them before T13).

## 2026-10-25 P6-size: engineCall's main-thread table is filled by its callers through provide()
Decision: worker.ts imports no engine function at run time; `EngineApi` is computed from `import type * as Engine from '@two-games/engine'` plus positionsOf and firstForbiddenMove, so `engineCall<F extends keyof EngineApi>(fn, args, hint)` keeps its signature and its E-9 routing exactly. A new export `provide(fns: Partial<EngineApi>): void` adds functions to the main-thread table, which starts with positionsOf and firstForbiddenMove. Every caller provides, in its own script, the engine functions it calls by name, imported by name: T1 `play` (imported as `enginePlay`, since T1 has a `play` state) and `raisingPlay`; T4 `orbitGraph`; t09/playOn.ts `raisingPlay`; T10 `orbitGraph` and `wythoffEdges`; T12 `chevalleySerre`; T15 `applyWord`; T11 calls only positionsOf. playFate is not provided anywhere: E-9 runs it in the worker by name (ALWAYS_IN_WORKER), so the main-thread table never runs it in a browser (in Node it runs from the whole engine, unreported), and a provide would only tie a route to its module. A name not provided still runs: in Node, or when E-9 says 'main', engineCall loads the whole engine on demand (`import('./engineAll')`, a module that is `export * from '@two-games/engine'`, emitted as `_astro/engineAll.<hash>.js`) and calls it there; the error for a name the engine lacks stays a TypeError. When E-9 keeps such a call on the main thread it is recorded (`__testing.fallbacks()`) and, in a development build, warned in the console (the warning is removed from the production build). A call that E-9 sends to the worker and that runs in-process in Node (tests, build time) is not reported, since it stands in for the worker. What the specification left open: CONTRACTS 4 fixes engineCall's signature and nothing about how its main-thread table is filled; the orchestrator's brief offered an exported provide or an optional extra argument. Default used: the exported provide, because an added optional argument changes a signature of CONTRACTS 4 (RT-FIX 5.5). Reason: the table holds only what the route's code already imports, and a forgotten provide is caught by site/tests/unit/worker-provide.test.ts (a scan of every engineCall by name) and, for a default state, by site/tests/e2e/engine-fallback.spec.ts, instead of failing the reader.

## 2026-10-25 P6-size: the engine's modules are free of side effects for the bundler
Decision: site/astro.config.mjs exports `moduleSideEffects(id)`, false for a file of `packages/engine/src/` and true for every other module (the default), and passes it as `vite.build.rolldownOptions.treeshake.moduleSideEffects`. What the specification left open: nothing on bundler options. Reason: the engine's modules only declare at the top level (pure functions, E-5) and none registers anything in another when it loads, so the bundler may link an import through index.ts to the module that defines the name. The standard place for this statement is `"sideEffects": false` in packages/engine/package.json, which would also serve any other bundle of the engine; that file is the engine's and outside this brief, so the rule sits in the site's build configuration. Option for the owner or MERGE: move it to packages/engine/package.json and drop the function (site/tests/unit/worker-provide.test.ts > "the build treats the engine modules as free of side effects" then checks the field instead).

## 2026-10-25 P6-size: Challenge.svelte imports boardFromName and mutate by name
Decision: the input check of a challenge takes `{ boardFromName, mutate }` from a static import of '@engine' instead of `await import('@engine')`. What the specification left open: nothing; P1-A4's comment said the dynamic import kept the engine away from other challenges. Reason: the dynamic import of the engine's index was cause (2) above. The two functions sit in the engine chunk that the tool the challenge reads has already loaded (every tool imports them through lib/state.ts), so a challenge fetches nothing more; a lazy import of a small module re-exporting the two names was measured too and cost every tool route about 0.6 kB, because Vite's preload helper then became a chunk of its own. site/tests/unit/worker-provide.test.ts fails if a module of site/src imports the whole engine at run time again (namespace import, dynamic import or `export *`), except engine.worker.ts and engineAll.ts.

## 2026-10-25 P6-size: the fallback costs 0.2 to 3 kB on some routes, kept
Decision: the fallback to the whole engine stays in production. What the specification left open: nothing; the orchestrator's design keeps it ("correct, only slower"). Reason and cost: the fallback chunk's `export *` keeps every export of every engine module alive, and a bundler places a module whole in one chunk, so a route that uses part of a module carries all of it. Measured with npm run size on two builds that differ only in the fallback: / 40.7 against 41.4 kB, /tools/board/ 69.3 against 69.5, /tools/rep/ 84.0 against 84.8, /tools/mirror/ 66.3 against 69.3, /dev/draw-time/ 36.3 against 39.2, /tools/fold/ 66.9 against 68.1, /tools/geometry/ 78.6 against 79.6. Option: a production build without the fallback (a missing provide would then reject); not taken, since every route is within its limit and a missing provide would break a tool for the reader.

## 2026-10-25 P6-size: sizes before and after
Decision: none; record. npm run size -- --port 7171 on f2177d7 and on this branch (kB, 1 kB = 1000 bytes; every route measured; the pages without a tool fetch 0 before and after; 4 routes over before, none after):

| route | limit | before | after |
|---|---|---|---|
| / | 60 | 52.7 | 41.4 |
| /about/ | 15 | 0.0 | 0.0 |
| /confusions/ | 15 | 0.0 | 0.0 |
| /credits/ | 15 | 0.0 | 0.0 |
| /dev/draw-time/ | 90 | 47.1 | 39.2 |
| /dev/lesson-check/ | 90 | 0.0 | 0.0 |
| /dev/math-check/ | 15 | 0.0 | 0.0 |
| /embed/affine/ | 90 | 77.9 | 66.8 |
| /embed/board/ | 90 | 78.9 | 69.5 |
| /embed/fold/ | 90 | 77.1 | 68.1 |
| /embed/form/ | 90 | 79.0 | 67.9 |
| /embed/garden/ | 90 | 75.0 | 65.5 |
| /embed/geometry/ | 90 | 86.3 | 79.6 |
| /embed/kostant/ | 90 | 77.8 | 66.7 |
| /embed/lab/ | 90 | 74.7 | 63.5 |
| /embed/mirror/ | 90 | 77.2 | 69.3 |
| /embed/numbers/ | 90 | 81.6 | 72.2 |
| /embed/rep/ | 90 | 92.2 | 84.8 |
| /embed/sandbox/ | 90 | 90.2 | 79.1 |
| /embed/symbolic/ | 90 | 78.2 | 68.2 |
| /embed/weyl/ | 90 | 84.8 | 76.5 |
| /glossary/ | 15 | 0.0 | 0.0 |
| /history/ | 15 | 0.0 | 0.0 |
| /modules/ | 15 | 0.0 | 0.0 |
| /modules/m0-start/ | 120 | 78.9 | 69.5 |
| /modules/m1-mutation/ | 120 | 78.9 | 69.5 |
| /modules/m2-form/ | 120 | 78.9 | 69.5 |
| /modules/m3-classification/ | 120 | 74.7 | 63.5 |
| /modules/m4-numbers/ | 120 | 78.9 | 69.5 |
| /modules/m5-weyl/ | 120 | 78.9 | 69.5 |
| /modules/m6-multiple-edges/ | 120 | 78.9 | 69.5 |
| /modules/m7-geometry/ | 120 | 86.3 | 79.6 |
| /modules/m8-lie-algebras/ | 120 | 92.2 | 84.8 |
| /not-quiver-mutation/ | 15 | 0.0 | 0.0 |
| /open-items/ | 15 | 0.0 | 0.0 |
| /open-problem/ | 15 | 0.0 | 0.0 |
| /sources/ | 15 | 0.0 | 0.0 |
| /tools/affine/ | 90 | 77.9 | 66.8 |
| /tools/board/ | 90 | 78.9 | 69.5 |
| /tools/fold/ | 90 | 77.1 | 68.1 |
| /tools/form/ | 90 | 79.0 | 67.9 |
| /tools/garden/ | 90 | 75.0 | 65.5 |
| /tools/geometry/ | 90 | 86.3 | 79.6 |
| /tools/kostant/ | 90 | 77.8 | 66.7 |
| /tools/lab/ | 90 | 74.7 | 63.5 |
| /tools/mirror/ | 90 | 77.2 | 69.3 |
| /tools/numbers/ | 90 | 81.6 | 72.2 |
| /tools/rep/ | 90 | 92.2 | 84.8 |
| /tools/sandbox/ | 90 | 90.2 | 79.1 |
| /tools/symbolic/ | 90 | 78.2 | 68.2 |
| /tools/weyl/ | 90 | 84.8 | 76.5 |

## 2026-10-25 P6-size: two browser specs find the engine's chunks by content
Decision: site/tests/e2e/engineChunks.ts names the built chunks that hold engine code (a chunk holds a string literal of an engine module, 24 characters or more, that no file of site/src holds). T12.spec.ts > "T12 classifies the same board once on a pick" sets its counting breakpoint in the script of `_astro/` whose source holds classify's message, instead of the script named `src.*.js`; board-load.spec.ts sums the profile samples of every engine chunk, and gains two checks: the measure is above 0, and the engine chunks include the one that holds classify. What the specification left open: nothing; both specs (RT-FIX P5-RT-07-02, RT-FIX P3-RT-07-02) read the engine as the one chunk `_astro/src.*.js`, which this change removes. Reason: the T12 test never found its chunk and timed out (180 s), and board-load would have measured 0 ms and passed on nothing; no assertion was removed or loosened. Measured (engine self time, median of 5 loads of the 12-cycle, shared machine): lab 25.1 ms on the base build, 32.7 and 34.8 ms on this branch; sandbox 13.6 ms on the base, 18.0 and 9.7 ms here; the bound is 50 ms.

## 2026-10-25 P6-size: what T13, T14 and later tools do to call the engine by name
Decision: none; a rule for later agents. Import every engine function by name from '@two-games/engine' (or '@engine'); never `import * as`, `import('@engine')` or `export *` of the engine in site/src (worker-provide.test.ts fails). A module that calls `engineCall('<name>', ...)` calls `provide({ <name> })` in its own script with the function imported by name, unless the name is playFate, positionsOf or firstForbiddenMove; a call by a computed name provides every name it can take. This holds for calls the hint sends to the worker too, so that Node runs them in-process from the provided function (only playFate is exempt). A satake call with kind 'satake' runs on the main thread except on E7 and E8 or with `expectedItems`, so T13 provides satake, satakeRecord and whatever else it calls by name. engine-weight.spec.ts lets only a route that shows T13 (`data-tool="satake"`) or T14 (`data-tool="atlas"`) carry satake.ts and satakeCatalogue.ts; engine-fallback.spec.ts fails if a default state loads `_astro/engineAll.<hash>.js`. A new engine module keeps its top level free of side effects (astro.config.mjs moduleSideEffects).

## 2026-10-25 P6-size: request to MERGE, CONTRACTS.md 4
Decision: request only (build-plan/ is not mine to edit). In CONTRACTS.md 4, under `// worker.ts  (E-9)`, after the line of `engineCall`, add: `export function provide(fns: Partial<EngineApi>): void;   // (plan, P6-size) the main-thread table: every module that calls engineCall provides the engine functions it calls by name (playFate excepted); a name not provided runs from the whole engine loaded on demand`. Reason: later tools (T13, T14) call engineCall and must know to provide.
