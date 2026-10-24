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
