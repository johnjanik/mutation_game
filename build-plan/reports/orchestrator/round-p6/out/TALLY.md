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
