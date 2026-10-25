# Phase 6 build: status (orchestrator)

- Start: 2026-10-25, after gate G5 green on 6cd2c06 (report commit 3a3d195; the phase 5 red-team round closed in 5d16e79).
- Stage 6.1 (base 5d16e79), running: P6-A1 engine phase 6A (satake.ts), P6-A5 LaTeX export, embed routes and Cite (ports 7100-7103), P6-A6 history, confusions, credits, version footer (ports 7110-7113).
- To come: 6.1b P6-A2 (catalogue, records, names; after P6-A1); 6.2 P6-A3 T13 and P6-A4 T14; 6.3 P6-A7 M9 and P6-A8 M10; 6.4 gate G6 with release 1.0 (the owner tags).
- Size budget to watch: /tools/rep/ 87.9 of 90 kB; ToolFrame changes land on every tool route.
- P6-A1 done and merged (87a2665; records dff494c): 81 engine files, all 167 satake records' computed fields, admissible_pairs, satake_examples, property 9; E7/E8 satake 2 to 8 ms. Review running on dff494c.
- Stage 6.1b started on dff494c: P6-A2 (satakeCatalogue.ts, names).
- P6-A1 reviewed (5 minors; rulings in DECISIONS.md); repair running on 9c47155.
- P6-A5 merged (84960fc with request R1: src/tools/ToolIsland.astro shared by /tools/ and /embed/); P6-A2 merged (da9e368); P6-A6 merged (e947205). Merge checks after P6-A5 running (build 49 pages, 0 link problems).
- Reviews running: P6-A2 (on da9e368), P6-A5 and P6-A6 (on e947205).
- Carried for later stages: T2 and T10 tikz exports for the owner's G6 LaTeX compile; 'citeText' in registry outs; T16's static export import; the M10 hub slugs (history, confusions, credits) for P6-A8.
- Merge check after P6-A5 (84960fc build): 49 pages, 337 e2e passed; npm run size FAILED: /tools/rep/ and /embed/rep/ 90.4 kB. Cause: site/src/lib/worker.ts spreads the whole engine namespace into engineApi, so every route using engineCall ships every engine module; satake.ts added about 2.3 kB to every route ('/' 48.6 to 50.9). Size repair P6-size running on f2177d7 (callers provide their functions; fallback dynamic import).
