# Phase 4 red-team round: tally
## RT-10: 3 findings, 3 confirmed (retests of 10-01, 10-02, 10-04, 10-05, 10-06 hold)
- P4-RT-10-01 major: T10 turning cap (8000) unguarded by any tool test. CONFIRMED.
- P4-RT-10-02 minor: make uniform drawing untested (component does not call drawnOf). CONFIRMED.
- P4-RT-10-03 minor: lost DECISIONS heading of RT-FIX-P3-board-a11y. CONFIRMED; fixed by MERGE 6568ed7.
- Notes: T11 'average' tab not in a link (recorded P4-A4); ci.yml stale comment about lab; scripts.test.ts rewrites reports/numbers-in-prose.md on every npm test.
## RT-13: 4 findings (all major), verifying. Retests hold: 13-03, 13-04, 13-06, 13-07, 13-09, 13-10; 13-05 and 13-08 hold with siblings in M7 (01, 02); 13-01 held class recurs in M6 b1, b4, b7 and M7 b4.
- P4-RT-13-01 major: M7 sandbox link opens B3, not A2.
- P4-RT-13-02 major: M7 'Numbers view' prose unmarked (View helper local to M0/M4; make it shared).
- P4-RT-13-03 major: M6 never tells the primary reader how to read a double/triple line with an arrow (LO6).
- P4-RT-13-04 major: tool pages reached by a link keep the default caption describing another state ([tool].astro).
- Notes: leading '+' and '24.0' answers ignored; T10 link-loaded orbit above 2000 shows empty 'drawn from .' and ring sizes; glossary entries are dictionary rows without definitions; T11 history counter '50 of 50' at 51 positions.
## RT-07: 5 findings (3 major, 2 minor), verifying. Retests hold: 07-01, 07-02, 07-04, 07-05; 07-03 held (engine chunk now 16425 B on /).
- P4-RT-07-01 major: T10 hydrates into 'pending' and empties lines the server rendered (B3 instances shrink 24 px and grow back; CLS 0.30 on b5 at a restored position).
- P4-RT-07-02 major: T10 prediction block grows 150 px (226 at 320) when Predict.svelte arrives after hydration.
- P4-RT-07-03 major: KaTeX fonts (font-display block, not preloaded) arrive after first paint: CLS 0.30 to 0.33 at restored positions; relayout adds ~40% of M7 TBT. Preloading 3 fonts: M7 TBT 319 -> 199 ms (observer, alternated).
- P4-RT-07-04 minor: T2 and T8 preset modules run engine searches at import (captions of all presets).
- P4-RT-07-05 minor: offered.ts pulls t10/config and t11/config (presets, captions) into ToolFrame on every tool route (1100 B).
- Lab notes: M7 b1 hydration task 186-239 ms (Svelte 51-57%, engine 12%); with fonts fixed M7 may still need b1's hydration shortened (owner); T10 draws points twice in vertices-only cases; benchmark 'Big' case now times the safe-number fast path.
- RT-13 verdicts: 01, 02, 03 CONFIRMED (reproduced, not refuted). 04 REFUTED (SPEC 4.0, 7.4, 9.2 and 8.1 P1 attach the caption to the default state; 6.6 a link changes only the keys it names; T11's state caption is P4-A4's own choice): dropped, for the owner as a possible new requirement. Owner note on 01: 'this module's board' is undefined for a module with several boards; the plan told P4-A6 'B3 or E8'.
## RT-05: 7 findings (5 major, 2 minor), verifying. Retests hold: 05-01, 02, 03, 04, 07, 08, 09 (Predict), 10, 11; 05-06 held.
- P4-RT-05-01 major: eight own-press controls still drop focus to body (T10 No rotation, Draw the orbit; T2 Show total, Grow; T7 table fire; T5 Play B; editor Add/Remove node; Challenge input).
- P4-RT-05-02 major: table view on T1, T8, T9 widens the tool frame at 320 (grid min-content).
- P4-RT-05-03 major: T10 ring board ignores u and r.
- P4-RT-05-04 major: long values' exact digits only in a title tooltip, not shown on keyboard focus.
- P4-RT-05-05 major: Predict Check with a non-integer answer says nothing (no error, no aria-invalid).
- P4-RT-05-06 minor: frozen T10 nodes keep data-can-act=true and the may-act ring.
- P4-RT-05-07 minor: T10 ring/turn and T6 point buttons' aria-labels miss the visible text (WCAG 2.5.3).
- Notes: Chromium refuses ports 5060, 5061 (and 6000, 6665-6669, 6697): avoid. M6 dynkin vs roads (owner); T11 average-tab table buttons act while board nodes are aria-disabled; disabled controls look the same as enabled (RT-06); T11 names as <sub>.
- RT-07 refute: 01, 02, 05 not refuted; 03 not refuted for the TBT half (late fonts' relayout over M7's 200 ms; P3-X1's no-preload record predates M7), refuted for the CLS half (7.6's CLS is the lab navigation at the top: 0.0003 and 0.0000); 04 REFUTED (own presets on own pages, no call near 50 ms, P1-A6 records captions from the engine at module load). Reproduce pending.
- RT-05 refute: 01, 02, 03, 05, 07 not refuted; 06 not refuted and raised to major (a 4.0 hook wrong); 04 REFUTED (4.0 Long numbers asks 'in the tooltip' with no trigger; SPEC says 'on focus or hover' where it wants both; table view gives keyboard readers the digits; P1-A5, P2-A6 record the title tooltip). Reproduce pending.
## RT-01: 2 findings (1 major, 1 minor), verifying. Retest 01-02 holds (306/306 vs oracle); 01-01 held. Residual P3-RT-07-02 engine fix: no disagreement on any safe input (thousands of boards, values crossing 2^53, SafeInt vs Big).
- P4-RT-01-01 major: wythoffEdges rounds vertex entries beyond 2^53 on Big boards (no EngineOverflow).
- P4-RT-01-02 minor: symmetrizer/gram/cartanClass/classify/smallestNonfiniteSubboard throw RangeError on road counts beyond 2^53 (rat from number); T16 import's refusal shows the RangeError text.
- Notes: cap below distinct seeds throws RangeError (SPEC undefined); oracle docstring of averaged_simple_cartan false for the identity on non-simply-laced (owner); geometry floats not bit-identical but within 1e-9.
- RT-01 reproduce: 01 and 02 reproduced (02 suggested raise to major: coxeterNumber throws RangeError where 5.6 says NotFiniteType). Refute pending.
- RT-01 verdicts: 01 CONFIRMED (major); 02 CONFIRMED, raised to major by both verifiers.
- RT-05 verdicts: 01, 02, 03, 05 CONFIRMED (major); 06 CONFIRMED (refuter: major; reproducer: minor; fixed in the T10 cluster either way); 07 CONFIRMED (minor); 04 DROPPED (refuted).
- RT-07 verdicts: 01, 02, 05 CONFIRMED; 03 CONFIRMED for the TBT half (reproduced: M7 TBT medians 423/427 as built against 196/207 with the three font preloads; the CLS half is not a 7.6 violation); 04 DROPPED (refuted).
## RT-09: 7 findings (3 blocker, 3 major, 1 minor), verifying. Retests hold: 09-01, 02, 03, 04, 06, 07.
- P4-RT-09-01 blocker: M7 states the finite-type geometry (orbit polytope, Coxeter plane) for every board; 'verified ... every board of rank two to eight'.
- P4-RT-09-02 blocker: M6 Seen 2 gives the root lengths 2/4/6 for every balanced board (A2^(2): 2, 8).
- P4-RT-09-03 blocker: M7 b12 challenge rejects (2,1,0) and other rings with 24 vertices and 36 edges (check reads polytopeName).
- P4-RT-09-04 major: M7 says make uniform replays from (0,1,sqrt2); T10 uses (0,1/sqrt2,1).
- P4-RT-09-05 major: M6 says Wildberger's B/C translation verified for every rank >= 3; compared for 3 and 4 only.
- P4-RT-09-06 major: M6 quotes [Don08] without the transpose convention (M5 states it). Merge with RT-08 attack 31 if reported.
- P4-RT-09-07 minor: M6 beat 1 'every road had a road back' contrast misstates B2.
- Notes: M6 beat 2 'finite cases ... up to rank eight' ambiguous; 'shape' vs 'combinatorics' in M7; T11 picker lists D4's two rotations with the same text.
- RT-09 reproduce: all 7 reproduced (03 suggested lower to major: a missing success message, no false sentence). Refute pending.
- RT-09 verdicts: all 7 CONFIRMED. 01, 02 blocker; 03 lowered to major by both verifiers (missing success message); 04, 05, 06 major; 07 minor.
## RT-08: 12 findings (1 blocker, 7 major, 4 minor). Retests hold: 08-01 to 08-11 (siblings below).
- P4-RT-08-01 DUPLICATE of P4-RT-09-01 (M7 'every board of rank two to eight'; same location and claim): merged, not verified again.
- P4-RT-08-03 DUPLICATE of P4-RT-09-05 (M6 Wildberger range): merged.
- To verify: 02 major (M6 typed round/move counts = coxeter_number), 04 major (credits omit clsx, vite preload helper), 05 major (M6 b11, b13 captions state no result), 06 major (M7 'circles of 30' path is coxeter_number, not rings), 07 major (M3 E4 fallback 'ten'), 08 major (M7 beat 5 edge-length rule without provenance), 09 minor (M7 Seen E7 wrap/fallback), 10 minor (release report says E7 'nothing shown' on M7; gate-G4 sect. 11 repeats it), 11 minor (Cite title raw TeX $G_2$), 12 minor incidental (T10 empty 'Ring sizes ... : .' outside the Coxeter plane).
- Notes: M1, M3, M5 at 1796/1789/1791 words (no room); gate-G4 section 9 miscounts the fallback numbers (also M7 line 137 '7'); /dev pages ship in release; M7 b4/b7 answers in the table (held 13-01).
## RT-04: 4 findings (1 major, 3 minor), verifying. Retests hold: 04-01 to 04-05 (siblings in T10/T11).
- P4-RT-04-01 minor: j turning angles unbounded: rounded beyond 2^53, NaN at 400 digits, written back into the bar and Copy link.
- P4-RT-04-02 minor: T11 form_value and T10 squared edge lengths exported as text.
- P4-RT-04-03 minor: link applied after registerInstance: replaceState on load before the reader acts (T10, T11, T1, T4, T5, T6, T15, T16).
- P4-RT-04-04 major (incidental): T10 squared edge lengths from floats: wrong from rings of 4 digits, equal lengths listed as several.
- Notes: foreign keys on T1 can withdraw an open prediction (code reading); T10 ring cap 999999 not in 6.6 (owner); T10 g-only link keeps the configured projection (owner reading).
## RT-03: 4 findings. Retests hold: 03-01, 02, 03, 05, 06. Residual engine fix checked against the oracle at the 2^53 hand-over, caps and Bareiss fallback: equal.
- P4-RT-03-01 DUPLICATE of P4-RT-01-01 (wythoffEdges toNumber): merged.
- To verify: 02 minor (orbitGraph fast path hash linear mod 2^30: quadratic on 2^30 Z^n orbits, 85-103 s at cap 100000), 03 minor (symmetries/relabellings at the limit not the lexicographically first; P2-A1 decision chose it), 04 minor (averagedRootsType on a finite board in pieces throws bare EngineError).
- Notes: T15 Play on fate from the cursor misses a repeat before the cursor (owner); fold gives SafeInt to unnamed folded boards; wythoffFVector/orbitSize/weylOrder throw EngineOverflow from A18 (|W| as number).
- RT-04 refute: none refuted; 01 and 02 raised to major; 03 and 04 as stated. Reproduce pending.
## RT-06: 3 findings (1 major, 2 minor), verifying. Retests hold: 06-01, 02, 03. 0 workers before interaction on 32 routes; 14 T10 snapshots match golden.
- P4-RT-06-01 major: disabled and aria-disabled controls look identical to enabled ones (all :disabled rules change only the cursor).
- P4-RT-06-02 minor: nojs.spec.ts figure predicate accepts T10's ring board or hidden canvas box, so a blank snapshot passes.
- P4-RT-06-03 minor: without JS T10 shows 'Drawn: 12 points, 24 edges, in  ms' (the words outside data-measured).
- Notes: release build ships /dev pages (also RT-08); data-measured not in CONTRACTS 5.1/5.2 (MERGE to record); T11 codec rejects v=p&s without c=p.
- RT-08 reproduce: all 10 reproduced. Refute pending.
- RT-08 refute: 06, 07, 11, 12 refuted (06: E8 rings hold h by golden h_points_on_every_ring; 07: the M3 'ten' is recorded and carried to polish; 11: citeTitle keeps $...$ by P0-A4 decision; 12: no SPEC rule on the xyz view). 09 raised to major.
- RT-08 verdicts: CONFIRMED 02, 04, 05, 08 major; 09 major (raised); 10 minor. REFUTED 06, 07, 11, 12 (to the owner as notes: 12 a blemish).
- RT-03 refute: 02 not refuted; 03 refuted (P2-A1 limit semantics, oracle's first_only agrees); 04 refuted (E-10 has no class for this case; P4-A1 ported raises as EngineError). Reproduce of 02 pending.
- RT-06 refute: none refuted (01 on SPEC 7.4 'a control never looks usable before it is'; 02 the nojs predicate never reads T10's snapshot, though T10.spec and M7.spec count b3, b8, b9; 03 the words outside data-measured). Reproduce pending.
- RT-06 verdicts: all 3 CONFIRMED (01 major, 02 minor, 03 minor).
- RT-04 verdicts: all 4 CONFIRMED. 01, 02 major (raised by the refuter); 03 minor; 04 major (oracle: one exact value 2 d_i a_i^2).
- RT-03 verdicts: 02 CONFIRMED (minor; 40000 positions in one bucket, 930x the chain steps); 03, 04 REFUTED (recorded decisions).
## RT-12: 5 findings (3 major, 2 minor), verifying. Retests hold: 12-01 to 12-07 (siblings below).
- P4-RT-12-01 major: links.yml fails every weekly run (lychee without root dir on local files; report too long for an issue body); real run 39258486524 failed, no issue opened.
- P4-RT-12-02 major: npm run e2e fails in CI: registry-weight.spec.ts keeps the /<repo>/ base in the file path.
- P4-RT-12-03 major: on Node 22.12 to 22.17 npm run build (postbuild links.mjs), size and lab exit 1: plain node imports astro.config.mjs, which imports a .ts file.
- P4-RT-12-04 minor: npm run report accepts the report of a release build that failed in postbuild (complete marked at build:done).
- P4-RT-12-05 minor: scripts/presets.mjs declares its own '@engine' alias.
- Notes: shared /tmp Vite caches not keyed by checkout (P2 2.1 rule); load-sensitive e2e (board-load long task, T10 ring click, T15 capped play); github-pages environment may refuse tag deploys (owner to check when DEPLOY_PAGES is set); reuseExistingServer outside CI.
