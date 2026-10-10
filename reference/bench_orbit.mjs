// bench_orbit.mjs -- the timing measurement behind the main-thread rule of the specification
// (SPEC.md section 5.1, E-9, and section 5.5).  Node 22 or later, no dependencies:
//
//     node reference/bench_orbit.mjs
//
// It is NOT part of the contract and NOT a port of the engine.  It is a direct implementation of
// one thing, the breadth-first search of section 5.5 (positions as arrays, arithmetic through an
// object as in section 5.2, a hash map keyed by the entries joined as decimal text), written only
// to learn how long such a search takes for a given number of positions.  The specification quotes
// its medians, measured on one server processor; a phone is several times slower.

const SafeInt = {
  zero: 0, fromInt: (n) => n,
  add: (a, b) => { const c = a + b; if (!Number.isSafeInteger(c)) throw new Error('overflow'); return c; },
  sub: (a, b) => { const c = a - b; if (!Number.isSafeInteger(c)) throw new Error('overflow'); return c; },
  mul: (a, b) => { const c = a * b; if (!Number.isSafeInteger(c)) throw new Error('overflow'); return c; },
};
const Big = { zero: 0n, fromInt: (n) => BigInt(n), add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b };

// mutation at position i:  p_i <- p_i - sum_j C[i][j] p_j
function mutate(A, C, p, i) {
  let s = A.zero; const row = C[i];
  for (let j = 0; j < p.length; j++) if (row[j] !== 0) s = A.add(s, A.mul(A.fromInt(row[j]), p[j]));
  const q = p.slice(); q[i] = A.sub(p[i], s); return q;
}

// breadth-first search with a cap on positions and a bound on layers; stops when it is about to
// add position number cap + 1 (the rule of section 5.5)
function orbitGraph(A, C, seeds, cap, maxDepth) {
  const n = C.length; const seen = new Map(); const items = []; const depth = [];
  for (const s of seeds) { const k = s.join(','); if (!seen.has(k)) { seen.set(k, items.length); items.push(s); depth.push(0); } }
  let truncated = false, completeLayers = 0;
  for (let head = 0; head < items.length && !truncated; head++) {
    const v = items[head], d = depth[head];
    if (maxDepth !== undefined && d >= maxDepth) continue;
    for (let i = 0; i < n; i++) {
      const w = mutate(A, C, v, i); const k = w.join(',');
      if (!seen.has(k)) {
        if (items.length === cap) { truncated = true; completeLayers = d; break; }
        seen.set(k, items.length); items.push(w); depth.push(d + 1);
      }
    }
  }
  if (!truncated) completeLayers = depth[depth.length - 1];
  return { items, truncated, completeLayers };
}

const zeros = (n) => Array.from({ length: n }, () => Array(n).fill(0));
function board(n, edges) {            // simply laced board from a list of joined pairs (1-based)
  const C = zeros(n); for (let i = 0; i < n; i++) C[i][i] = 2;
  for (const [a, b] of edges) { C[a - 1][b - 1] = -1; C[b - 1][a - 1] = -1; }
  return C;
}
const E8 = board(8, [[1, 3], [3, 4], [2, 4], [4, 5], [5, 6], [6, 7], [7, 8]]);                    // Bourbaki labels
const STAR5 = board(6, [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6]]);                                  // indefinite, 6 nodes
const RING12 = board(12, [...Array.from({ length: 12 }, (_, k) => [k + 1, ((k + 1) % 12) + 1]), [1, 7]]);  // 12-cycle with a chord
const units = (A, n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => A.fromInt(i === j ? 1 : 0)));

function median(f, reps) {
  const ts = []; let out;
  for (let r = 0; r < reps; r++) { const t = performance.now(); out = f(); ts.push(performance.now() - t); }
  ts.sort((a, b) => a - b); return [ts[reps >> 1], out];
}
const CASES = [
  ['roots of E8 (rank 8)', E8, 100000, undefined, 7],
  ['star with five arms, cap 2000 (rank 6)', STAR5, 2000, 40, 7],
  ['12-cycle with a chord, cap 2000 (rank 12)', RING12, 2000, 40, 7],
  ['12-cycle with a chord, cap 5000 (rank 12)', RING12, 5000, 40, 7],
  ['star with five arms, cap 100000 (rank 6)', STAR5, 100000, 40, 3],
  ['12-cycle with a chord, cap 100000 (rank 12)', RING12, 100000, 40, 3],
];
console.log(`node ${process.version}`);
console.log('case'.padEnd(46), 'positions'.padStart(9), 'complete layers'.padStart(16), 'SafeInt ms'.padStart(11), 'Big ms'.padStart(9));
for (const [label, C, cap, maxDepth, reps] of CASES) {
  const [tS, out] = median(() => orbitGraph(SafeInt, C, units(SafeInt, C.length), cap, maxDepth), reps);
  const [tB, outB] = median(() => orbitGraph(Big, C, units(Big, C.length), cap, maxDepth), reps);
  if (out.items.length !== outB.items.length || out.completeLayers !== outB.completeLayers) throw new Error('SafeInt and Big disagree');
  console.log(label.padEnd(46), String(out.items.length).padStart(9), String(out.completeLayers).padStart(16),
              tS.toFixed(1).padStart(11), tB.toFixed(1).padStart(9));
}
