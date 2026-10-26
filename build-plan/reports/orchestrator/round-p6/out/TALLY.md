# Phase 6 red-team round: tally (gate commit f07eec6)
- 13 lenses launched 2026-10-26 after gate G6 run 1 (RED: T12.spec.ts:1242 C8 hydration 53 ms; the lab, 20 of 89 routes over TBT). Ports 5510 to 5633.
## RT-09: 4 findings (2 blocker, 2 minor). Retests hold: 09-01, 09-02, 09-04. 4665 claims read on 38 phase 6 routes; Atlas 1357 values against golden, 0 mismatches; 167 satake records against the M9 and glossary sentences, 0 failures; T13's sentences true.
- P6-RT-09-01 blocker: glossary rows 35 and 36 define 'highest root' and 'root poset' by facts of simply laced boards (on B, C, F, G two populations are raised by no mutation; the raising-edge picture is not the root poset).
- P6-RT-09-02 blocker: /history/ states [DE08]'s finite-type theorem without 'roads both ways'; the one-way board [[2,0],[-1,2]] ends from (1,0) and is not of finite type.
- P6-RT-09-03 minor: glossary row 64 says the 'shape' of a Wythoff polytope depends only on the ringed nodes (SPEC 2.14: its combinatorics).
- P6-RT-09-04 minor: M10's Atlas item says the switch prints the matrix as Kac writes it on every board (the Atlas legend was repaired away from this).
- Notes: SPEC 6.4 'one record per real form' against 167 records for 166 classes, repeated in M9 beat 7 (owner); glossary rows 57 and 67 scoped only by context; glossary.test.ts checks Appendix C rows only.
## RT-03: 4 findings (1 major, 3 minor). Retest holds: 03-01 (T12's string viewer shortens). Satake error matrix on 7 boards and 11 names, 98 tests; 43 browser limit tests; Atlas caps and long numbers hold; LaTeX and TikZ at the caps.
- P6-RT-03-01 major: T5 writes long numbers in full in the tape, the sorted tapes and the end positions of 'Two games compared' (4.0 Long numbers; siblings of the T5 dimension and T12 fixes).
- P6-RT-03-02 minor: restrictedBoard of E7 and E8 does not survive the worker wire (a 0-node board leaves the promise pending; a named board in orbit order comes back as the standard board); no reader reaches it today.
- P6-RT-03-03 minor: exportLaTeX's TikZ writers let a hole in a list through ('undefined', missing nodes); no reader reaches it today.
- P6-RT-03-04 minor: the Atlas writes the counting cap as the literal 60000 in its sentence and CSV.
- Notes: confusions.mdx line 75 types '60000' and 'eight' in prose (for RT-08); t13/load.ts fetchData returns null on a NotAdmissible from the worker for a pair judged admissible (unreachable).
- RT-09 verdicts: all 4 CONFIRMED (01, 02 blocker; 03, 04 minor; reproduced 4 of 4, refuted 0 of 4). Refuter note: the P6-A4 review graded the Kac wording on the Atlas legend as major (04, owner).
## RT-10: 5 findings (4 major, 1 minor). Retests hold: 10-01, 10-02, 10-03. Inventory 10 phase 6 names, 0 missing; signatures 0 mismatches; 5.6 rows 24, 0 mismatches; T13 and T14 acceptance 7 of 7 with a test; 8 presets; ownership of every changed file recorded.
- P6-RT-10-01 major: Export LaTeX on T8 and T12 writes the board's \dynkin line, not their orbit graphs (6.7 'orbit graphs ... as plain TikZ'); T6 too, T15 and T16 'nothing to export'.
- P6-RT-10-02 major: the 32 Atlas pages show a population with its numbers and a = Cp without the bridge sentence of 2.4(a).
- P6-RT-10-03 major: M10 links no later use of a glossary term; glossary-later-uses.spec.ts leaves M10 out.
- P6-RT-10-04 major: DECISIONS.md records neither D12 (English) nor D10 (separate from MutationGraph).
- P6-RT-10-05 minor: T13's data-board 'decoration' and 'restricted' and data-value 'black'/'white' outside 4.0's hooks (logged by P6-A3).
- Notes: owner's parts of G3, G4, G6 have no outcome lines (not yet due); numbers-in-prose sees little of the lessons' typed numbers (P0-A6 design); M10 has no Sources block and 575 words (plan reading); M8's word count rule changed by MERGE (4 words over by the old rule); the release archives contain the unreleased /dev/ pages; T13 presets fixing a panel or the toggle are not fully links (SPEC tension).
- RT-03 refute: 01, 02, 03 not refuted; 04 REFUTED (CONTRACTS 2.3 holds no 'used once' rule; the stated 60000 equals SPEC 5.6 in the wording P6-A4's plan prescribes). Reproduce pending.
## RT-08: 10 findings (2 major, 8 minor). Retests hold: 08-01 to 08-05. 90 routes read in both builds; release leaks 0; typed golden numbers 0; <G> formats 0 violations; citations 777 links on 56 keys, all resolve; no em-dash; 13 confusions sections.
- P6-RT-08-01 major: /open-problem/ says [W20] states the Mutation Conjecture 'near its end' (page 57; sibling of the P6-A6 repair on /history/).
- P6-RT-08-02 major: M9 beat 1 'A node is black exactly when theta fixes its root' has no provenance and depends on condition 2.
- P6-RT-08-03 minor: the preview open-items page omits the four Atlas pages that use E4 (its scan reads MDX only).
- P6-RT-08-04 minor: the Atlas writes 'the fundamental weight omega_i' in sentences and link texts (sibling of P5-RT-08-01).
- P6-RT-08-05 minor: M9's Lie theory paragraph states Helgason's and Araki's table pages as fact (unread texts; sibling of the P6-A6 repair).
- P6-RT-08-06 minor: M9 beat 7 '167 records, one per real form' (sibling of the P6-A4 D4 count repair).
- P6-RT-08-07 minor: /confusions/ names city i and node i in one sentence (P8).
- P6-RT-08-08 minor: /confusions/ 'lattices' section has no source though the page and M10 promise one for every correction.
- P6-RT-08-09 minor: the Atlas index and picker say '32 boards' (B2 and C2 are one board).
- P6-RT-08-10 minor: M9 prints the letters of a longest word of D5 from types.D5.n_positive_roots.
- Notes: Kostant attribution wrapped E13 on /history/ but unwrapped in M1 (owner); embed routes carry no licence footer (plan, owner); credits says the content licence 'may change before the first release' (stale?).
## RT-01: 0 findings. Phase 5 reproducers rerun (no confirmed RT-01 finding then); 10 reseeded harnesses, about 666000 comparisons, 0 disagreements; the Satake functions against the oracle: 39396 admissibility verdicts and Reason records, 351 pairs in every numbering, 323 catalogue records to rank 12, 11280 theta, shadow2 and restrictedCoordinates, 0 disagreements; T13's data path on all 174 offered pairs, 0; every Atlas value and download on the 32 pages, 0; LaTeX marks for the 167 records agree; the 167 records against classical values, agree.
- Notes: on boards in pieces the oracle raises AssertionError (not ValueError as decisions/P6-A1.md says), the engine NeedsConnectedBoard; P3-RT-01-01 held, P5-RT-01-01 refuted, both unchanged.
- RT-10 refute: none refuted; 05 raised to major (a wrong hook; the restricted board's values are populations of a mutation game, 2.15); 04's D10 half arguable under 9.3 'blocks work' (owner). Reproduce pending.
- RT-03 verdicts: 01 CONFIRMED major; 02 CONFIRMED minor; 03 CONFIRMED minor; 04 REFUTED (reproduced, but no contract rule; the stated 60000 equals SPEC 5.6).
## RT-02: 2 findings (2 minor). Phase 5 guards rerun, all pass; hand mutants killed (controls equivalent); 117 renumbered catalogue pairs and 300 admissibility pairs against the oracle in positions; 31 routes build-time equal hydrated (M9 96 values); LaTeX forms byte for byte; the switch and the Wildberger notes on 32 pages.
- P6-RT-02-01 minor: T13 applies the C2 adjustment of 6.4 in site code (model.ts:445-447) instead of taking it from satakeRecord (Appendix H rule); values right.
- P6-RT-02-02 minor: T13 converts restricted-board labels with l - 1, k - 1, k + 1 in 12 places (E-7: only toLabels and toPositions convert); values right.
- Notes: the B2 Atlas page names the affine board 'B2~' in its link text (golden constructor_name, D19 reading, owner); the CSV item 'real_form_restricted_type' holds the display field; M9 beat 6 pairs Bourbaki order with orbit order indices, right on e6(-26) only by coincidence (fragile).
