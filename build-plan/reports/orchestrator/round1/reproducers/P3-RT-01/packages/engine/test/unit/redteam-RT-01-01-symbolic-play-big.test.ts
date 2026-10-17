// Finding P3-RT-01-01 (RT-01 round 1, phase 3). symbolicPlay throws EngineOverflow on Board<bigint> boards that are not
// of finite type, where SPEC.md 5.6 (second table, first row) says symbolicPlay "work[s] as defined" on a one-way board
// and "work[s]" on a gcm board that is not of finite type, and E-2 gives such boards Big arithmetic "because off the
// finite types the entries grow without bound".
// Oracle: symbolic_play(C, [0, 1] * 20) with C = [[2, -3], [-3, 2]] (gcm, indefinite) and with the one-way board
// C = [[2, -3, 0], [-3, 2, -1], [0, 0, 2]]; values typed from reference/lie_games.py (python3, this commit).
// Run: npx vitest run --root packages/engine packages/engine/test/unit/redteam-RT-01-01-symbolic-play-big.test.ts
import { expect, it } from 'vitest';
import { boardKind, symbolicPlay } from '../../src/index';
import { bigBoard } from '../helpers/p1';

const word = Array.from({ length: 40 }, (_, k) => k % 2);

it('symbolicPlay on the gcm board [[2,-3],[-3,2]] plays 40 moves and returns the oracle forms', () => {
  const C = [[2, -3], [-3, 2]];
  expect(boardKind(C)).toBe('gcm');
  const forms = symbolicPlay(bigBoard(C), word); // observed: throws EngineOverflow
  expect(forms.length).toBe(40);
  expect(forms[0]!.map(String)).toEqual(['1', '0']);
  expect(forms[1]!.map(String)).toEqual(['3', '1']);
  expect(forms[37]!.map(String)).toEqual(['3416454622906707', '1304969544928657']);
  expect(forms[38]!.map(String)).toEqual(['8944394323791464', '3416454622906707']);
  expect(forms[39]!.map(String)).toEqual(['23416728348467685', '8944394323791464']);
});

it('symbolicPlay on the one-way board [[2,-3,0],[-3,2,-1],[0,0,2]] plays 40 moves and returns the oracle forms', () => {
  const C = [[2, -3, 0], [-3, 2, -1], [0, 0, 2]];
  expect(boardKind(C)).toBe('one-way');
  const forms = symbolicPlay(bigBoard(C), word); // observed: throws EngineOverflow
  expect(forms.length).toBe(40);
  expect(forms[39]!.map(String)).toEqual(['23416728348467685', '8944394323791464', '0']);
});
