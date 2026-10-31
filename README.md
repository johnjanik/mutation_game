# Two Games on a Dynkin Diagram

An explorable website about two elementary games played on a Dynkin diagram, and the Lie theory that grows out of them: Wildberger's mutation game, Mozes' numbers game, root systems, Weyl groups, root polytopes, minuscule representations, and real forms through Satake diagrams.

The games need only integer addition. A reader plays them on a board, sees that they are one reflection written in two coordinate systems (the Cartan matrix translates one into the other), and follows the play to the structure theory that usually takes a graduate course to reach. "Two Games on a Dynkin Diagram" is a working title.

When it is published, the site is served by GitHub Pages at https://johnjanik.github.io/mutation_game/.

## What the site contains

- **Eleven lessons**, M0 to M10: start here; the mutation game; the form behind the game; finite, affine, wild; the numbers game and the duality; the Weyl group inside the games; multiple edges and folding; geometry and the E8 picture; from games to Lie algebras; real forms and Satake diagrams; atlas, sandbox, history and sources.
- **Sixteen interactive tools**, each on its own page under `/tools/` and embeddable from `/embed/`:

  | Tool | Route | Tool | Route |
  |---|---|---|---|
  | T1 Game Board | `board` | T9 Kostant's Game | `kostant` |
  | T2 Orbit Garden | `garden` | T10 Geometry Studio | `geometry` |
  | T3 Form Finder | `form` | T11 Folding Bench | `fold` |
  | T4 Classification Lab | `lab` | T12 Representation Builder | `rep` |
  | T5 Numbers Game Lab | `numbers` | T13 Satake Studio | `satake` |
  | T6 Kaleidoscope | `mirror` | T14 Atlas | `atlas` |
  | T7 Symbolic Game | `symbolic` | T15 Affine Playground | `affine` |
  | T8 Weyl Explorer | `weyl` | T16 Sandbox | `sandbox` |

- **An atlas** with one data sheet for each finite type of rank at most 8 (32 sheets), and supporting pages: a glossary, the open problem (the Mutation Conjecture), history, common confusions, the difference from quiver mutation, sources and credits.

Every page reads in full without JavaScript: each tool ships its default state as HTML. Every tool can be played from the keyboard, announces its moves to screen readers, and has a table view, a link to its current state and an export (data, and LaTeX for the figures that have one).

## How the repository is organised

| Path | What it holds |
|---|---|
| `SPEC.md` | The specification: the mathematics with its fixed conventions, the curriculum, every tool, the engine, the architecture, the build plan with its gates, and the open decisions. `SPEC.pdf` is a typeset copy. |
| `SOURCES.md` | The annotated bibliography. Every citation key used in the specification and on the site resolves here. |
| `reference/` | The Python oracle (`lie_games.py`), the script that checks it and writes the golden data (`verify.py`), and `golden_data.json`, the data the engine must reproduce. Standard library only. |
| `packages/engine/` | The mathematics: a TypeScript package with no dependencies (no DOM, no npm packages), with golden tests and property tests. |
| `site/` | The Astro site: lessons and pages in MDX under `src/content/`, tools as Svelte 5 components under `src/components/`, unit tests under `tests/unit/` and browser tests under `tests/e2e/`. |
| `scripts/` | Build and check scripts: sizes, lab timings, link checks, typeset names, the content reports, the oracle check. |
| `DECISIONS.md`, `decisions/` | The log of every decision taken during the build, and the fragments it is folded from. |
| `build-plan/` | The plan by which several Claude Code agents built the site, and their reports. |
| `reports/` | The gate reports `gate-G0.md` to `gate-G6.md`. Logs, archives and content reports written there are not committed. |
| `CLAUDE.md` | The rules every agent working in this repository follows. |

## Conventions

The conventions are fixed in `SPEC.md` section 2 and are not changed in code:

- Cartan matrix: `C[i][j] = <alpha_i^vee, alpha_j>`, as in Kac and SageMath (Bourbaki prints the transpose).
- Mutation (Populations, roots): only the chosen entry changes, `p[i] <- p[i] - sum_j C[i][j] p[j]`.
- Firing (Numbers, weights): `a[j] <- a[j] - C[j][i] a[i]` for every `j`, so `a[i] <- -a[i]`. A firing is legal when the number is positive; the game ends when none is.
- The translator: `a = C p`. The board never changes in either game.
- Nodes carry Bourbaki labels on the site, with 0 first on affine boards.

## Building and testing

Requirements: Node 22.12 or later with npm, and Python 3 for the oracle check (standard library only). Browser tests use Chromium through Playwright (`npx playwright install chromium`).

```sh
npm ci                   # install the exact versions of the lockfile
npm test                 # Vitest: the engine (golden and property tests) and the site's unit tests
npm run typecheck        # tsc for the engine, astro check for the site
npm run build            # a preview build into site/dist
RELEASE=1 npm run build  # a release build: open items of Appendix E are replaced by their fallbacks
npm run preview          # serve site/dist with astro preview
npm run e2e              # Playwright against the built site: tools, lessons, no-JavaScript run, axe scans
npm run e2e:basepath     # the site built and tested under BASE_PATH=/sub/path/
npm run size             # JavaScript per route against the budget of SPEC.md 7.6
npm run lab              # Lighthouse lab timings (LCP, TBT, CLS) at 4x CPU slowdown
npm run bench            # the engine benchmark and the timing tests
npm run verify           # rerun the Python oracle and compare with reference/golden_data.json
npm run report           # the open-items report and the numbers-in-prose report, into reports/
```

The site's address and base path come from the environment: `SITE_URL` and `BASE_PATH` when set, otherwise the values that follow from `GITHUB_REPOSITORY` in CI, otherwise `http://localhost` and `/`. Every internal link is built from the base, so the same source serves from a domain root or a subdirectory.

## Ground truth

`reference/golden_data.json` is the contract for the engine. It is regenerated with `python3 reference/verify.py reference/golden_data.json`, which runs 6649 checks and must report none failed; `npm run verify` reruns it and compares the result byte for byte with the committed file. The golden file is never edited by hand.

## Releases and deployment

- `ci.yml` runs the tests, the builds, the browser suite, the sizes and the oracle check on every pull request and every push to `main`, and uploads the built site as an artifact.
- `deploy.yml` publishes a release build to GitHub Pages when a version tag (`v*`) is pushed or when the owner runs it by hand, and only when the repository variable `DEPLOY_PAGES` is `true`. The public site changes only at a release.
- `links.yml` checks external links weekly and opens an issue on a failure.
- Each release is also archived as two copies of the built site: one for the Pages address, and one built with `BASE_PATH=/` that can be served as plain files from the root of any domain.

## Status

Version 1 (phases 0 to 6 of `SPEC.md` section 9) is built. Each phase ended with a gate and a red-team round; the reports are in `reports/`. Release 0.5 was prepared at gate G3, and release 1.0 at gate G6. Sentences that rest on an item of `SPEC.md` Appendix E not yet checked by a person are marked in preview builds and replaced by a weaker, safe sentence in release builds. The project owner settles those items and tags releases.

## Licence and credit

- Code: GNU Affero General Public License version 3 (`LICENSE`, SPDX `AGPL-3.0-only`).
- Text and figures of the site: Creative Commons Attribution-ShareAlike 4.0 (`LICENSE-content`, SPDX `CC-BY-SA-4.0`). Code samples shown in the text fall under the code licence.

The mutation game, its story of Martians and anti-Martians and its terminology are N. J. Wildberger's; the numbers game is S. Mozes'. The site restates ideas and results from the literature in its own words with citations; `SOURCES.md` and the site's credits page list the sources and every third-party asset.

Project owner: John Janik, Ph.D.
