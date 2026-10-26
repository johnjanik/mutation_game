# Phase 6 red-team round: tally (gate commit f07eec6)
- 13 lenses launched 2026-10-26 after gate G6 run 1 (RED: T12.spec.ts:1242 C8 hydration 53 ms; the lab, 20 of 89 routes over TBT). Ports 5510 to 5633.
## RT-09: 4 findings (2 blocker, 2 minor). Retests hold: 09-01, 09-02, 09-04. 4665 claims read on 38 phase 6 routes; Atlas 1357 values against golden, 0 mismatches; 167 satake records against the M9 and glossary sentences, 0 failures; T13's sentences true.
- P6-RT-09-01 blocker: glossary rows 35 and 36 define 'highest root' and 'root poset' by facts of simply laced boards (on B, C, F, G two populations are raised by no mutation; the raising-edge picture is not the root poset).
- P6-RT-09-02 blocker: /history/ states [DE08]'s finite-type theorem without 'roads both ways'; the one-way board [[2,0],[-1,2]] ends from (1,0) and is not of finite type.
- P6-RT-09-03 minor: glossary row 64 says the 'shape' of a Wythoff polytope depends only on the ringed nodes (SPEC 2.14: its combinatorics).
- P6-RT-09-04 minor: M10's Atlas item says the switch prints the matrix as Kac writes it on every board (the Atlas legend was repaired away from this).
- Notes: SPEC 6.4 'one record per real form' against 167 records for 166 classes, repeated in M9 beat 7 (owner); glossary rows 57 and 67 scoped only by context; glossary.test.ts checks Appendix C rows only.
