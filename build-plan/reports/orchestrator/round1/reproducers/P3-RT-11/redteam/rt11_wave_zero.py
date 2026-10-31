#!/usr/bin/env python3
"""RT-11: the oracle's wave_play on starts whose wave fires a node holding 0 (legality is then False).

Usage: python3 redteam/rt11_wave_zero.py <worktree>
Prints (rounds, legal) for A3 from (1, 0, 0) and (0, 1, 0) with both first colours, and for B3 and G2 cases.
The values are typed into packages/engine/test/unit/redteam-RT-11-wave-zero.test.ts.
"""
import pathlib, sys
WT = pathlib.Path(sys.argv[1])
sys.path.insert(0, str(WT / 'reference'))
from lie_games import cartan, wave_play  # noqa: E402

for letter, n, start in (('A', 3, (1, 0, 0)), ('A', 3, (0, 1, 0)), ('B', 3, (1, 0, 0)), ('G', 2, (1, 0)), ('A', 3, (1, 1, 1))):
    C = cartan(letter, n)
    for first in (0, 1):
        print(f'{letter}{n} start {start} first {first}: rounds, legal =', wave_play(C, start, first))
