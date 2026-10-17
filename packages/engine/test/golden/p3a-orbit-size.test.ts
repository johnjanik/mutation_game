// Orbit sizes without enumeration (SPEC.md 2.7 F10, 5.4 orbitSize, 5.7 phase 3; P3-A1 instruction 5.6,
// 5.11): orbitSize of every fundamental weight of every type against fundamental_orbit_sizes, the
// enumerated orbit wherever its size is at most 20000 (verify.py lines 226 to 243), and the rule for any
// position (play to the end, then |W| / |W_J|) against enumeration on 150 random positions (verify.py
// lines 1677 to 1684), with a fixed seed recorded below.
import { describe, expect, it } from 'vitest';
import { CAPS } from '../../src/caps';
import { orbit } from '../../src/search';
import { orbitSize } from '../../src/weyl';
import { unitVectors } from '../helpers/p1';
import { TYPE_NAMES, boardOf, covers, golden, intEq } from './_harness';

covers('types[*].fundamental_orbit_sizes');

const ENUMERATION_LIMIT = 20000; // SPEC.md 5.7: "only where it is at most 20000"

describe('orbitSize of every fundamental weight', () => {
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;
    it(`fundamental orbit sizes of ${T}`, () => {
      const b = boardOf(T);
      const sizes = unitVectors(b).map((e) => orbitSize(b, e));
      for (const s of sizes) expect(typeof s).toBe('number');
      intEq(sizes, rec.fundamental_orbit_sizes, 'fundamental_orbit_sizes');
    });
  }
  it('E8: 2160, 17280, 69120, 483840, 241920, 60480, 6720, 240, without enumerating anything', () => {
    const b = boardOf('E8');
    const sizes = unitVectors(b).map((e) => orbitSize(b, e));
    expect(sizes).toEqual([2160, 17280, 69120, 483840, 241920, 60480, 6720, 240]);
  });
});

describe('enumerated orbits up to 20000', () => {
  let enumerated = 0;
  for (const T of TYPE_NAMES) {
    const rec = golden.types[T]!;
    it(`orbits of the fundamental weights of ${T} by breadth-first search`, { timeout: 60000 }, () => {
      const b = boardOf(T);
      const es = unitVectors(b);
      for (let i = 0; i < b.n; i++) {
        const stored = rec.fundamental_orbit_sizes[i]!;
        if (stored > ENUMERATION_LIMIT) continue;
        const o = orbit(b, [es[i]!], 'firing', CAPS.workerPositions);
        expect(o.truncated).toBe(false);
        intEq(o.items.length, stored, `orbit of omega_${i + 1} on ${T}`);
        expect(orbitSize(b, es[i]!)).toBe(o.items.length);
        enumerated += 1;
      }
    });
  }
  it('the enumeration was not vacuous: every node except E8 nodes 3 to 6 was enumerated', () => {
    const total = TYPE_NAMES.reduce((s, T) => s + golden.types[T]!.cartan.length, 0);
    expect(enumerated).toBe(total - 4);
  });
});

/** mulberry32, seeded once; floating point is allowed in tests (helpers/p1). */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20261010;

describe('orbitSize of any position', () => {
  it('150 random positions with entries in [-3, 3] on A3, B3, D4, G2, F4 agree with the enumerated orbit', { timeout: 60000 }, () => {
    const next = rng(SEED);
    let checked = 0;
    let nonDominant = 0;
    for (const T of ['A3', 'B3', 'D4', 'G2', 'F4']) {
      const b = boardOf(T);
      for (let k = 0; k < 30; k++) {
        const a: number[] = [];
        for (let i = 0; i < b.n; i++) a.push(Math.floor(next() * 7) - 3);
        const frozen = Object.freeze([...a]);
        const o = orbit(b, [frozen], 'firing', CAPS.workerPositions);
        expect(o.truncated).toBe(false);
        expect(orbitSize(b, frozen)).toBe(o.items.length);
        expect(frozen).toEqual(a);
        if (a.some((x) => x < 0)) nonDominant += 1;
        checked += 1;
      }
    }
    expect(checked).toBe(150);
    expect(nonDominant).toBeGreaterThan(100); // the rule is exercised on non-dominant positions
  });
  it('hand cases of the instruction', () => {
    const A2 = boardOf('A2');
    expect(orbitSize(A2, [1, 0])).toBe(3);
    expect(orbitSize(A2, [-1, 1])).toBe(3); // the end is [0, -1]
    expect(orbitSize(A2, [0, 0])).toBe(1);
    expect(orbitSize(boardOf('A3'), [0, 0, 0])).toBe(1);
    expect(orbitSize(A2, [1, 1])).toBe(6);
    expect(orbitSize(boardOf('D4'), [0, 1, 0, 0])).toBe(24);
    expect(orbitSize(boardOf('B3'), [-2, 1, 3])).toBe(48);
    expect(orbitSize(boardOf('B3'), [3, 3, -3])).toBe(24);
    expect(orbitSize(boardOf('G2'), [0, 3])).toBe(6);
  });
  it('a dominant position with zeros on a disconnected J: D4 omega_2 has |W| / |W_J| with J the three outer nodes', () => {
    expect(orbitSize(boardOf('D4'), [0, 1, 0, 0])).toBe(192 / 8);
  });
});
