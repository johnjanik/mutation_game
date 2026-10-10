// P1-A4: the check evaluator behind the lesson component Challenge (SPEC.md 8.2 item 6, 8.5, 9.2).
// Each kind is met exactly when its condition holds and not before; values are compared after the
// U+2212 mapping. The input predicate runs the real engine (phase 0 mutate). No golden value is
// typed here: the vectors are small examples of the rules, not data of golden_data.json.
import { describe, expect, it } from 'vitest';
import { boardFromName, fromAdjacency, mutate } from '../../../packages/engine/src/index';
import {
  acceptsInput,
  evaluate,
  normaliseValue,
  parsePopulation,
  signOf,
  validateCheck,
  valuesOf,
  vectorKey,
  type ChallengeCheck,
  type NodeReading,
  type Observation,
} from '../../src/lib/pages/challengeCheck';

const MINUS = '−';

function obs(over: Partial<Observation> = {}): Observation {
  return { outs: {}, nodes: [], moves: 0, seen: { populations: 1, numbers: 1 }, inputAccepted: false, ...over };
}

/** Node readings for one board, given in an order other than the label order on purpose. */
function nodes(board: string, values: string[]): NodeReading[] {
  const list = values.map((value, i) => ({ label: i + 1, board, value }));
  return list.reverse();
}

describe('values', () => {
  it('maps U+2212 to a hyphen and sorts by label', () => {
    expect(normaliseValue(`${MINUS}2`)).toBe('-2');
    expect(normaliseValue(' 3 ')).toBe('3');
    expect(valuesOf(nodes('numbers', ['1', `${MINUS}1`, '0']), 'numbers')).toEqual(['1', '-1', '0']);
    expect(valuesOf(nodes('numbers', ['1']), 'populations')).toEqual([]);
    expect(vectorKey(['1', '-1'])).toBe('1,-1');
    expect(signOf('-3/2')).toBe(-1);
    expect(signOf('0')).toBe(0);
    expect(signOf('-0')).toBe(0);
    expect(signOf('5')).toBe(1);
  });
});

describe('Challenge checks', () => {
  it('out', () => {
    const any: ChallengeCheck = { kind: 'out', name: 'goalMet' };
    expect(evaluate(any, obs())).toBe(false);
    expect(evaluate(any, obs({ outs: { goalMet: '   ' } }))).toBe(false);
    expect(evaluate(any, obs({ outs: { other: 'yes' } }))).toBe(false);
    expect(evaluate(any, obs({ outs: { goalMet: 'yes' } }))).toBe(true);
    const eq: ChallengeCheck = { kind: 'out', name: 'verdict', equals: `${MINUS}1` };
    expect(evaluate(eq, obs({ outs: { verdict: '1' } }))).toBe(false);
    expect(evaluate(eq, obs({ outs: { verdict: '-1' } }))).toBe(true);
    expect(evaluate(eq, obs({ outs: { verdict: `${MINUS}1` } }))).toBe(true);
  });

  it('reach', () => {
    const check: ChallengeCheck = { kind: 'reach', board: 'populations', values: [1, 1, 0] };
    expect(evaluate(check, obs({ nodes: nodes('populations', ['0', '1', '0']) }))).toBe(false);
    expect(evaluate(check, obs({ nodes: nodes('numbers', ['1', '1', '0']) }))).toBe(false);
    expect(evaluate(check, obs({ nodes: nodes('populations', ['1', '1']) }))).toBe(false);
    expect(evaluate(check, obs({ nodes: nodes('populations', ['1', '1', '0']) }))).toBe(true);
    // Values written with the true minus on one side and a hyphen on the other compare equal.
    const neg: ChallengeCheck = { kind: 'reach', board: 'numbers', values: [`${MINUS}1`, 2, -1] };
    expect(evaluate(neg, obs({ nodes: nodes('numbers', ['-1', '2', `${MINUS}1`]) }))).toBe(true);
    expect(evaluate(neg, obs({ nodes: nodes('numbers', ['1', '2', '-1']) }))).toBe(false);
    // In the linked view only the named board counts.
    const linked = [...nodes('numbers', ['-1', '2', '-1']), ...nodes('populations', ['0', '1', '0'])];
    expect(evaluate({ kind: 'reach', board: 'populations', values: [0, 1, 0] }, obs({ nodes: linked }))).toBe(true);
    expect(evaluate({ kind: 'reach', board: 'populations', values: [-1, 2, -1] }, obs({ nodes: linked }))).toBe(false);
  });

  it('reach with maxMoves', () => {
    const check: ChallengeCheck = { kind: 'reach', board: 'numbers', values: [0, 0], maxMoves: 3 };
    const at = nodes('numbers', ['0', '0']);
    expect(evaluate(check, obs({ nodes: at, moves: 4 }))).toBe(false);
    expect(evaluate(check, obs({ nodes: at, moves: null }))).toBe(false);
    expect(evaluate(check, obs({ nodes: at, moves: 3 }))).toBe(true);
    expect(evaluate(check, obs({ nodes: at, moves: 2 }))).toBe(true);
    expect(evaluate(check, obs({ nodes: nodes('numbers', ['0', '1']), moves: 1 }))).toBe(false);
  });

  it('distinct', () => {
    const check: ChallengeCheck = { kind: 'distinct', board: 'populations', count: 12 };
    expect(evaluate(check, obs({ seen: { populations: 11, numbers: 40 } }))).toBe(false);
    expect(evaluate(check, obs({ seen: { populations: 12, numbers: 0 } }))).toBe(true);
    expect(evaluate(check, obs({ seen: { populations: 13, numbers: 0 } }))).toBe(true);
  });

  it('input fixed-by-every-mutation', () => {
    const engine = { boardFromName, mutate };
    // On a finite board the Cartan matrix is invertible: nothing nonzero is fixed.
    expect(acceptsInput('fixed-by-every-mutation', 'A2', '1, 1', engine)).toBe(false);
    expect(acceptsInput('fixed-by-every-mutation', 'A2', '0, 0', engine)).toBe(false);
    expect(acceptsInput('fixed-by-every-mutation', 'A2', '1, 1, 1', engine)).toBe(false);
    expect(acceptsInput('fixed-by-every-mutation', 'A2', 'one, two', engine)).toBe(false);
    // The triangle (three cities joined in a cycle): every mutation fixes (1, 1, 1) and its multiples.
    const triangle = { boardFromName: () => fromAdjacency([[0, 1, 1], [1, 0, 1], [1, 1, 0]]), mutate };
    expect(acceptsInput('fixed-by-every-mutation', 'triangle', '1, 1, 1', triangle)).toBe(true);
    expect(acceptsInput('fixed-by-every-mutation', 'triangle', `${MINUS}2 ${MINUS}2 ${MINUS}2`, triangle)).toBe(true);
    expect(acceptsInput('fixed-by-every-mutation', 'triangle', '1, 1, 0', triangle)).toBe(false);
    expect(acceptsInput('fixed-by-every-mutation', 'triangle', '0, 0, 0', triangle)).toBe(false);
    // The component reports what the predicate said; evaluate follows it.
    const check: ChallengeCheck = { kind: 'input', predicate: 'fixed-by-every-mutation', board: 'A2' };
    expect(evaluate(check, obs({ inputAccepted: false }))).toBe(false);
    expect(evaluate(check, obs({ inputAccepted: true }))).toBe(true);
    expect(parsePopulation('(1, -2, 3)')).toEqual([1n, -2n, 3n]);
    expect(parsePopulation('')).toBeNull();
    expect(parsePopulation('1.5')).toBeNull();
  });

  it('mixed-signs', () => {
    const check: ChallengeCheck = { kind: 'mixed-signs', board: 'populations' };
    expect(evaluate(check, obs({ nodes: nodes('populations', ['1', '0', '2']) }))).toBe(false);
    expect(evaluate(check, obs({ nodes: nodes('populations', ['-1', '0', '-2']) }))).toBe(false);
    expect(evaluate(check, obs({ nodes: nodes('numbers', ['1', '-1']) }))).toBe(false);
    expect(evaluate(check, obs({ nodes: nodes('populations', ['1', `${MINUS}1`, '0']) }))).toBe(true);
  });

  it('explain never reports success', () => {
    const check: ChallengeCheck = { kind: 'explain' };
    const everything = obs({
      outs: { goalMet: 'yes' },
      nodes: nodes('populations', ['1', '-1']),
      moves: 1,
      seen: { populations: 1000, numbers: 1000 },
      inputAccepted: true,
    });
    expect(evaluate(check, everything)).toBe(false);
  });

  it('validates the shape of a check', () => {
    expect(validateCheck({ kind: 'explain' })).toEqual({ kind: 'explain' });
    expect(validateCheck({ kind: 'reach', board: 'numbers', values: [1] }).kind).toBe('reach');
    expect(() => validateCheck({ kind: 'reach', board: 'roads', values: [1] })).toThrow(/not one of the kinds/);
    expect(() => validateCheck({ kind: 'input', predicate: 'is-a-root', board: 'A2' })).toThrow();
    expect(() => validateCheck({ kind: 'distinct', board: 'numbers', count: 0 })).toThrow();
    expect(() => validateCheck(null)).toThrow();
  });
});
