// The type of a restricted or averaged root system (SPEC.md 5.5 "Type of the restricted or averaged roots":
// "the decision table is the function classify_restricted of the oracle and must be ported as it stands.
// It writes the rank 2 system as B2"). Port of the oracle's classify_restricted (reference/lie_games.py
// lines 540 to 584) with its helper bil (lines 129 to 131), test by test in the oracle's order: the
// non-reduced test first, then one norm (A, D, E), then two norms with the ratio 3 test for G2 before
// the rank 2 rule (so B2 is never mistaken for G2) and F4 before the B and C counts. The oracle's assert
// and raise ValueError become a thrown EngineError with the oracle's message text; they fire only on a
// set that is not a root system, never with a guessed name. Exact rationals throughout (E-1, E-3).
// Owner P4-A1 (plan file, CONTRACTS.md 2.1); P6-A1 re-exports classifyRestricted from satake.ts.
// No guard: the argument is a set of vectors and a Gram matrix, not a board (plan reading of 5.6).
import { EngineError } from './errors';
import type { Rational } from './rational';
import { rat, ratAdd, ratDiv, ratEq, ratMul, ratSign, ratSub, ratToString } from './rational';

/** One entry of a vector given to classifyRestricted: an integer (Satake) or a rational (averages). */
export type RestrictedEntry = number | bigint | Rational;

/** The name of the system and its length classes in ascending squared length. */
export interface RestrictedType {
  name: string;
  classes: { class: string; roots: number; form_value: string }[];
}

function toRational(x: RestrictedEntry): Rational {
  if (typeof x === 'number' || typeof x === 'bigint') return rat(x);
  return rat(x.num, x.den);
}

function keyOf(v: readonly Rational[]): string {
  return v.map(ratToString).join(',');
}

/** bil(B, x, y) = sum of x_i B_ij y_j over the pairs with x_i and y_j nonzero (oracle lines 129 to 131). */
function bil(B: readonly (readonly Rational[])[], x: readonly Rational[], y: readonly Rational[]): Rational {
  let s = rat(0);
  for (let i = 0; i < x.length; i++) {
    if (x[i]!.num === 0n) continue;
    for (let j = 0; j < y.length; j++) {
      if (y[j]!.num === 0n) continue;
      s = ratAdd(s, ratMul(ratMul(x[i]!, B[i]![j]!), y[j]!));
    }
  }
  return s;
}

function fail(message: string): never {
  throw new EngineError(`classifyRestricted: ${message}`);
}

/**
 * The oracle's classify_restricted(S, B, r): the name of the root system S of rank r with Gram matrix B,
 * and its classes (label, number of vectors, squared length as text under rule 4 of SPEC.md 5.7), in
 * ascending squared length. S is a set: a vector given twice counts once (the oracle's S is a Python set).
 * Entries may be integers or rationals (plan: a supertype of CONTRACTS.md 2.4's number[][], so that the
 * averaged roots of averagedRootsType and the integer vectors of satake both type-check). Throws
 * EngineError when S is not a root system the table recognises.
 */
export function classifyRestricted(
  S: readonly (readonly RestrictedEntry[])[],
  B: readonly (readonly Rational[])[],
  r: number,
): RestrictedType {
  // the set S, keyed by the rational text of its entries in lowest terms
  const vectors = new Map<string, Rational[]>();
  for (const v of S) {
    const q = v.map(toRational);
    const key = keyOf(q);
    if (!vectors.has(key)) vectors.set(key, q);
  }
  const all = [...vectors.values()];
  // norms = {v: bil(B, v, v) for v in S}; vals = sorted(set(norms.values()))
  const norms = all.map((v) => bil(B, v, v));
  const vals: Rational[] = [];
  for (const nv of norms) if (!vals.some((x) => ratEq(x, nv))) vals.push(nv);
  vals.sort((a, b) => ratSign(ratSub(a, b)));
  const N = all.length;
  // nonreduced = any(tuple(2 * x for x in v) in S for v in S)
  const nonreduced = all.some((v) => vectors.has(keyOf(v.map((x) => ratMul(rat(2), x)))));
  // count = {nv: number of v with norms[v] == nv}
  const count = vals.map((nv) => norms.filter((x) => ratEq(x, nv)).length);
  let name: string;
  let classLabels: string[];
  if (nonreduced) {
    if (N !== 2 * r * r + 2 * r) fail(`not a root system: a non-reduced set of rank ${r} has ${N} vectors (N, r) = (${N}, ${r})`);
    name = `BC${r}`;
    classLabels = r === 1 ? ['short', 'long'] : ['short', 'medium', 'long'];
  } else if (vals.length === 1) {
    classLabels = ['all'];
    if (N === r * (r + 1)) name = `A${r}`;
    else if (r >= 4 && N === 2 * r * (r - 1)) name = `D${r}`;
    else if ((r === 6 && N === 72) || (r === 7 && N === 126) || (r === 8 && N === 240)) name = `E${r}`;
    else fail(`unrecognised simply-laced system (r, N) = (${r}, ${N})`);
  } else {
    if (vals.length !== 2) fail(`not a root system: ${vals.length} squared lengths ${vals.map(ratToString).join(', ')}`);
    classLabels = ['short', 'long'];
    const ns = count[0]!;
    const nl = count[1]!;
    const ratio = ratDiv(vals[1]!, vals[0]!);
    if (ratEq(ratio, rat(3))) {
      if (!(r === 2 && N === 12)) fail(`not a root system: squared lengths in the ratio 3 with (r, N) = (${r}, ${N})`);
      name = 'G2';
    } else if (r === 2) {
      if (N !== 8) fail(`not a root system: two squared lengths in rank 2 with N = ${N}`);
      name = 'B2'; // = C2
    } else if (r === 4 && N === 48) {
      name = 'F4';
    } else if (ns === 2 * r && nl === 2 * r * (r - 1)) {
      name = `B${r}`;
    } else if (nl === 2 * r && ns === 2 * r * (r - 1)) {
      name = `C${r}`;
    } else {
      fail(`unrecognised system (r, N, ns, nl) = (${r}, ${N}, ${ns}, ${nl})`);
    }
  }
  if (classLabels.length !== vals.length) {
    fail(`not a root system: ${classLabels.length} class labels for ${vals.length} squared lengths`);
  }
  return {
    name,
    classes: vals.map((nv, k) => ({ class: classLabels[k]!, roots: count[k]!, form_value: ratToString(nv) })),
  };
}
