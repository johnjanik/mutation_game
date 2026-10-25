# Phase 5 red-team round: tally (gate commit 006f50d)
- Lenses running (2026-10-25 05:35): RT-07. Done: the other 12.
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
- RT-09 reproduce: 01, 02, 04, 05 reproduced (oracle checks agree). Refute pending.
- RT-10 refute: none refuted; 03 raised to major (a stated default of a field is wrong; 6.6 ambiguity for the owner). 01's severity named by the rubric at blocker or minor, not major. Reproduce pending.
- RT-09 verdicts: 01 CONFIRMED blocker; 02 CONFIRMED major (two senses of 'dimension' in T12, owner); 04 CONFIRMED, raised to major ('Credit accurately'); 05 REFUTED (SPEC 2.7 defines finite type as the connected boards of 2.8; glossary row copies Appendix C; requireFinite's acceptance of pieces is a guard decision).
## RT-13: 3 findings (3 major). Retests hold: 13-01, 13-02, 13-03. 9 sandbox links open the first board; 90 links, 0 failures; answer sheet 0 outside steps.
- P5-RT-13-01 major: M8's two prediction answers (b1: (0,-2) and 1 position; b5: 8) are stated only in their reveals (8.1 P2).
- P5-RT-13-02 major: DUPLICATE of P5-RT-08-01 (T12 writes omega_i, the site's term is e_i; first met in b1's explanation): merged, not verified again.
- P5-RT-13-03 major: DUPLICATE of P5-RT-09-02 (T12 'Dimension' is the orbit size off minuscule nodes; E8 node 8 240 vs 248): merged, not verified again.
- Notes: SPEC 2.18 and M8 beat 4 count 18 representations, B2 node 2 and C2 node 1 are one (17; owner); SPEC 1.4 statement 6 (M0 beat 5) against M8 beat 6 on E8's smallest representation (owner); orbit-graph edge colours 3 and 4 are the view accents (6.3, owner); held classes P3-RT-13-01 and P4-RT-13-04 have new instances in M8 (not reported); history counter '50 of 50' at 51 positions.
- RT-13 refute: 01 not refuted (P2 'Results are stated in the prose'; P3-RT-13-01 is about answers visible before commitment, a different rule). Reproduce pending.
- RT-13 verdicts: 01 CONFIRMED major (reproduced: FAIL 2 of 2 on the release build without JavaScript; not refuted). 02 and 03 merged into P5-RT-08-01 and P5-RT-09-02.
## RT-05: 4 findings (3 major, 1 minor). Retests hold: 05-01, 05-02, 05-03, 05-05, 05-06, 05-07. Axe 0 violations on all release routes; reflow 0 at 320.
- P5-RT-05-01 major: T12 string viewer hit areas below 6.1 at 320 (E8 39 vs 43, A8/B8 34 vs 38) and on 8-column boards at 360: the .panel is the inline-size container.
- P5-RT-05-02 major: a T12 island's hydration replaces the server's matrix and relation scroll boxes, so focus on one goes to body (M8 b4 first tab stop, b3 E1).
- P5-RT-05-03 major: a relation verdict computed in the worker is drawn but never announced ('checked in the background' only).
- P5-RT-05-04 minor: T12's relation and pick announcements read the visual formula (U+2212, caret) instead of relationSpoken and speak.
- Notes: T12.spec 320 test asserts only >= 24; lesson-reflow.spec lists M0-M5 only; .table-wrap focus ring does not reach MDX tables (default ring visible); long values of the string line only in title.
## RT-03: 1 finding (major). Retests hold: 03-01, 03-02 (hash bench moved to bench/). Error matrix of the phase 5 functions on 12 boards matches 5.6; 163 nodes route as the oracle's orbit sizes say.
- P5-RT-03-01 major: T12's string viewer prints the line's length and the count of positions not listed in full beyond 12 digits (4.0 'Long numbers').
- Notes: stringThrough has no bound on its length (E-6, logged in P5-A1; owner); minusculeMatrices cap 0 throws RangeError (logged); 7 unit timeouts at load 16.7 (no finding).
- RT-10 verdicts: 01 CONFIRMED major (as claimed; reproducer keeps major, refuter's rubric reading noted); 02 CONFIRMED minor; 03 CONFIRMED major (refuter raised; 6.6 against 4.0 'the tool's defaults' noted for the owner).
- RT-03 refute: 01 not refuted (4.0 'Long numbers' has no qualifier; precedent RT-FIX-P3-export-long read a count as a value). Reproduce pending.
- RT-03 verdicts: 01 CONFIRMED major (reproduced; not refuted).
- RT-05 refute: 01, 02, 03 not refuted (6.1 W is the viewport width below 400; A-1/2.4.3; 4.0 'announces each result'); 04 REFUTED (A-4's 'spoken as minus' governs move templates; the explanation wording is logged in P5-A2; the formula is MathML named in words). Reproduce pending.
- RT-05 verdicts: 01 CONFIRMED major; 02 CONFIRMED major (3 of 3 runs); 03 CONFIRMED major (2 of 2 runs); 04 REFUTED (reproduced, but A-4's minus rule governs moves; wording logged in P5-A2).
## RT-04: 1 finding (major). Retests hold: 04-01, 04-02, 04-03 (on load), 04-04. 13 of 13 validation clauses on T12; 120 random round trips; corpora 220 + 160 + 80 links unchanged.
- P5-RT-04-01 major: after one popstate (skip link or Back), Copy link on T12, T10 and T11 encodes the plain codec's reading of the bar, not the state shown (history.ts onPopState_ overwrites entry.current; tools with own link readers return early).
- Notes: q=ef:01,1 kept as written (leading zeros; 6.6 silent); codec accepts serre with equal nodes (P5-A2 request to P1-A2); T12 drops other tools' keys and refuses c=p (plan); c without s keeps omega_k (decisions/P5-A2.md; see P5-RT-10-03).
- RT-04 refute: 01 not refuted (7.4 'Copy link always encodes the current state'; P1-A2 popstate note is a plan mechanism). Reproduce pending.
## RT-02: 0 findings. No phase 4 RT-02 finding to retest; phase 4 guards rerun (29 + 11 + 14 pass). Every phase 5 value agrees with the oracle on B2, C2, B3, C3, G2, renumbered and transposed boards; every convention mutant of rep.ts and T12 is killed except two identical-value controls. Build-time default equals the hydrated state on 24 routes (7375 values).
- Notes: T12 labels two selects 'Node i' (the node picker and the relation checker's node i); M8 b5 says 'Choose node 3 in the Node i list' (ambiguous; same answer on D4); phase 4 reproducer redteam-RT-02-p4-sweep has 18 tsc errors (for a fixer adopting it).
## RT-06: 1 finding (minor). Retests hold: 06-01, 06-02, 06-03. 35 routes, 123 roots: server equals hydrated; no worker before interaction; 163 T12 links match fundamental_orbit_sizes; base path and release builds clean.
- P5-RT-06-01 minor: no run without JavaScript reads T12's orbit drawing or matrix cells on M8 (nojs.spec.ts accepts T12 roots through the string viewer's board; sibling of P4-RT-06-02).
- Notes: T12 posts chevalleySerre to the worker on 103 of 163 links by the logged ruling (RELATIONS_MAIN_WORK; worker.ts header says E-9 three cases only; owner); default start omega_i against 6.6 (see P5-RT-10-03); Download data writes relations: null above the bound on configured states; stale wording in M8 MDX header, DECISIONS P5-A3 and an M8.spec comment (main-thread relation list).
- RT-04 verdicts: 01 CONFIRMED major (unit 4 failed; browser 5 + 5 failed in two runs; not refuted).
- RT-06 refute: 01 not refuted (7.4 every default figure of every lesson; M8's figure table makes the matrices the figure of beats 3 to 5); the server-against-hydrated comparison may catch lost matrix cells, not a lost orbit drawing. Reproduce pending.
- RT-06 verdicts: 01 CONFIRMED minor (12 of 12 roots accepted blank; not refuted).
- Fix clusters (05:55): history fixed (confirm running); lessons fixed (confirm running); running t12-content (P5-RT-08-05, 09-01, 09-02+13-03, 08-01+13-02, 03-01, 10-03), toolchain (12-01), t12-a11y-tests (05-01, 05-02, 05-03, 10-01, 10-02, 06-01, 11-01, 11-02, 11-03). To come: RT-07 findings.
## RT-12: 1 finding (minor). Retests hold: 12-02 (CI base), 12-03 (Node 22.12.0), 12-04 for its own case. Pins 20 of 20 exact; KaTeX one copy, fonts byte-equal; base path crawl 0 outside; verify byte for byte.
- P5-RT-12-01 minor: a release build that fails in the prebuild leaves the earlier release report marked complete, and npm run report exits 0 with it (edge of the P4-RT-12-04 fix).
- Notes: T12.test.ts:303 costs about 2.5 s CPU under a 5000 ms default timeout (flake risk on a busy runner); T05.spec Symbol(filename) intermittent with a fresh SSR cache; a malformed $...$ formula builds with exit 0 (P0-A3 open question; 7.7 silent); Node 22.12-22.18 EBADENGINE warnings (undici, wasm-runtime; owner); e2e:ci-base root script not added (RT-FIX-P4-toolchain request); M8 beat 7 released={false} renders (RT-10 note).
## RT-11: 3 findings (3 minor). Retests hold: 11-01, 11-03 (11-02 owner-held). Reference hashes equal; verify shim 0,1,1,1,1; coverage through phase 5 complete; every rep.ts stub caught.
- P5-RT-11-01 minor: chevalleySerre's hh, he and hf verdicts never tested where they fail (five mutants pass the suite).
- P5-RT-11-02 minor: T12's announcement of a failing picked relation is never heard by a test (mutant 'always equal' passes).
- P5-RT-11-03 minor: T12.test.ts and T12.spec.ts type golden orbit sizes and dimensions.
- Notes: S2 digest mutant equivalent on shipped pages (every configured state is minuscule); T15.spec:542 reads the live region at the first entry (race under load); T12.test.ts:303 F11 agreement only up to 600 positions (by instruction).
- RT-12 reproduce: 01 reproduced (step 4 exit 0 with the step 1 report). Refute pending.
- RT-12 verdicts: 01 CONFIRMED minor (reproduced; not refuted: P4 decision counts the prebuild as part of the release build).
- RT-11 refute: 01, 02, 03 not refuted (5.4 takes any E, F, H, the oracle gives False with the finding's sides; 4.0 each result announced; COMMON 4.4 and the files' own headers). Reproduce pending.
- RT-11 verdicts: 01, 02, 03 CONFIRMED minor (reproduced; not refuted).
- MERGED cfbdbc5: lessons (5 of 5 confirmed). Confirmer's note: the cut 'Taking one for the other gives wrong answers;' leaves 'the table sets them side by side' (M8 'what mutation is not' sidebar) with a loose antecedent (caption resolves it). MERGE to note at folding: the P5-A3 entry's 'the 26 of F4' is superseded by P5-RT-08-02.
