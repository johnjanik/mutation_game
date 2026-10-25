# Phase 5 red-team round: tally (gate commit 006f50d)
- Lenses running: RT-09, RT-01, RT-05, RT-10 (ports 5390, 5310, 5350, 5400). To come: RT-02, RT-03, RT-04, RT-06, RT-07, RT-08, RT-11, RT-12, RT-13.
## RT-01: 1 finding (minor). Retests hold: 01-01, 01-02 (one sibling missed, below). rep.ts and T12 against the oracle: 12,624 + tool-boundary comparisons, 0 disagreements.
- P5-RT-01-01 minor: formIsInvariant throws RangeError 'is not an integer' on an integer form entry beyond 2^53 (form.ts:104 isSafeInteger), so gram(C) of a board with such road counts cannot be tested.
- Notes: T12 prints 'Dimension: N' on non-minuscule nodes where N is the orbit size, not dim V(omega_i) (D4 node 2: 24 vs 28; F4 node 4: 24 vs 26; E8 node 8: 240 vs 248); SafeInt checks intermediate products (E-2, documented); P3-RT-01-01 still reproduces (held).
## RT-08: 5 findings (1 blocker, 4 major). Retests hold: 08-01 to 08-05, 08-08 to 08-10.
- P5-RT-08-05 blocker (incidental): T12 says on G2 (and F4, E8) 'its representations need more than the game'; SPEC 2.18 'One zero weight' builds the 7 of G2 from the game.
- P5-RT-08-01 major: T12 writes the Lie symbol omega_i (65 places on M8, /tools/rep/) where the site's term is e_i (omega only in the Lie theory paragraph).
- P5-RT-08-02 major: M8 types the 26 of F4 (golden weyl_dimension[F4;0,0,0,1]) in a brace string.
- P5-RT-08-03 major: two M8 <G> paths print the right digits from the wrong record (string (0,1) from the node-2 representation; det of E8, F4, G2 from E8 alone).
- P5-RT-08-04 major: M8 (and M5, M6, M7) use fire, population, mutate without glossary links.
- Notes: T12 'Dimension' shows the orbit size on non-minuscule nodes (also RT-01); Gab72 priority claim (owner); Kostant 'every move' verified by one random play per node (RT-09/owner); E10 fallback 'found in the standard texts'; glossary lacks string, single step, Chevalley-Serre, signed move, quiver (P1-A4 request); M1 at 1800, M3 1797, M8 1795.
- RT-01 reproduce: 01 reproduced (oracle: True, False with witness (0,(0,1)), True). Note: decisions/P2-A1.md line 34 says M must be safe integers, RangeError otherwise (for the refuter). Refute pending.
- RT-01 verdicts: 01 REFUTED (decisions/P2-A1.md requires M of safe integers, RangeError otherwise; the finding quoted the general clause). Incidental: the RangeError text calls -2^53 'not an integer' (wording, minor; for the owner).
- RT-08 reproduce: all 5 reproduced. Refute pending.
- RT-08 verdicts: all 5 CONFIRMED (05 blocker; 01, 02, 03, 04 major). Owner note: whether 8.4 governs text built inside a tool is not stated outright (T5 itself names 'a fundamental weight').
## RT-09: 5 findings (1 blocker, 3 major, 1 minor). Retests hold: 09-01 to 09-07 (09-01's range still wider than verify.py: see 05).
- P5-RT-09-01 blocker: T12's signed-move panel states the minuscule identities on every built node (false on D4 node 2 and 450 of 509 non-minuscule states; its failure sentence false on B_n node 1 and C_n node n).
- P5-RT-09-02 major: T12 'Dimension:' shows the orbit size on non-minuscule nodes (D4 node 2: 24 vs 28; E8 default node 1: 2160 vs 3875).
- P5-RT-09-03 DUPLICATE of P5-RT-08-05 (G2 'needs more than the game'): merged, not verified again.
- P5-RT-09-05 major: connected-type facts (h, the wave, Kostant's end, the affine recipe, the Coxeter plane) stated and 'verified' for every board of finite type in M1, M3, M5, M7; false on boards in pieces such as A2 + A1.
- P5-RT-09-04 minor: M8's Lie theory paragraph credits [W03a] with every minuscule representation (simply laced only).
- Notes: SPEC 2.16 'the diagram always changes' false at an isolated vertex (owner); SPEC 2.7 defines finite type as the boards of 2.8, the site does not tell the reader (owner, refuter may cite); repCaption '1 of the 48 relations fail' (singular).
## RT-10: 3 findings (1 major, 2 minor). Retests hold: 10-01, 10-02, 10-03. Inventory 133 names, 5.6 phase-5 rows, ownership, pins, release vs preview: no finding.
- P5-RT-10-01 major: T12's relation checker never has its two sides tested where they differ (a mutant drawing the same matrix in both panels passes every T12 and M8 test).
- P5-RT-10-02 minor: edge colours and the move/signed matrices of a picked node tested only on A2 node 1 (two mutants survive).
- P5-RT-10-03 minor: T12's default start is omega_i, not 6.6's 'all ones for numbers'.
- Notes: T03 '1000 random free moves' has no own timeout (load); P5-A2 relation-in-MathML entry misstates SPEC 7.3 (owner); M8 beat 7 released={false} renders in release (Beat has no released prop); beat 6 reads a phase-6 golden key (satake rank); stringThrough loops without a bound in the engine (E-6), guarded by T12; M6.spec does not assert its next link.
