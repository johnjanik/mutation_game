// The purpose-built layered layout of SPEC.md 7.1 ("every graph the site draws is ranked ... a
// purpose-built layered layout is simpler and deterministic"): orbit graphs by number of moves
// (T2), root posets by height, Weyl group elements by length (T8, whose SVG snapshot is rendered
// with this code in Node, 7.4). No library, no random source, no locale: the result depends only
// on the set of (key, rank) pairs and the edge set, so the server and the browser agree.

export interface LayeredInput {
  /** One distinct key per vertex; vertices are indices into this list. */
  keys: readonly string[];
  /** The rank of each vertex, a non-negative integer chosen by the caller. */
  rank: readonly number[];
  /** Edges between vertex indices, in either direction, joining any two ranks. */
  edges: readonly (readonly [number, number])[];
}

export interface LayeredLayout {
  /** Integer column of each vertex, centred: index in its rank + floor((widestRank - size) / 2). */
  x: number[];
  /** The rank of each vertex, kept exactly. */
  y: number[];
  /** order[r]: the vertices of rank r from left to right (empty for a rank nobody occupies). */
  order: number[][];
  /** The size of the largest rank, so a tool can scroll inside its box (A-11). */
  widestRank: number;
  /** Highest rank plus one (0 for an empty graph). */
  rankCount: number;
}

/** Plain code-unit string order, never localeCompare (Node's ICU and a browser's may differ). */
function byKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Lays out a ranked graph. The lowest rank is sorted by key; each higher rank by the barycenter
 * (mean x) of each vertex's neighbours in lower ranks, compared exactly as integer fractions, ties
 * broken by key; vertices with no lower neighbour go after the others, by key. Throws RangeError on
 * a duplicate key, a bad rank, a length mismatch or an edge to a vertex that does not exist.
 * Cost: one sort per rank plus one pass over the edges.
 */
export function layeredLayout(input: LayeredInput): LayeredLayout {
  const { keys, rank, edges } = input;
  const n = keys.length;
  if (rank.length !== n) throw new RangeError(`${n} keys but ${rank.length} ranks`);
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) throw new RangeError(`duplicate key ${JSON.stringify(k)}`);
    seen.add(k);
  }
  let maxRank = -1;
  for (const r of rank) {
    if (!Number.isSafeInteger(r) || r < 0) throw new RangeError(`rank ${r} is not a non-negative integer`);
    if (r > maxRank) maxRank = r;
  }
  const rankCount = maxRank + 1;

  // Lower neighbours of each vertex, each edge counted once whatever its direction or repetition.
  const lower: number[][] = Array.from({ length: n }, () => []);
  const edgeSeen = new Set<string>();
  for (const [a, b] of edges) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= n || b >= n) {
      throw new RangeError(`edge [${a}, ${b}] joins a vertex that does not exist`);
    }
    if (rank[a] === rank[b]) continue;
    const id = a < b ? `${a},${b}` : `${b},${a}`;
    if (edgeSeen.has(id)) continue;
    edgeSeen.add(id);
    if (rank[a]! < rank[b]!) lower[b]!.push(a);
    else lower[a]!.push(b);
  }

  const order: number[][] = Array.from({ length: rankCount }, () => []);
  for (let v = 0; v < n; v++) order[rank[v]!]!.push(v);
  const widestRank = order.reduce((w, r) => Math.max(w, r.length), 0);
  const x: number[] = new Array<number>(n).fill(0);

  for (let r = 0; r < rankCount; r++) {
    const members = order[r]!;
    // Barycenter as an exact fraction sum / count of already placed x (all lower ranks are placed).
    const sum = new Map<number, number>();
    for (const v of members) {
      let s = 0;
      for (const w of lower[v]!) s += x[w]!;
      sum.set(v, s);
    }
    members.sort((a, b) => {
      const ca = lower[a]!.length;
      const cb = lower[b]!.length;
      if (ca === 0 || cb === 0) {
        if (ca !== cb) return ca === 0 ? 1 : -1;
        return byKey(keys[a]!, keys[b]!);
      }
      const diff = sum.get(a)! * cb - sum.get(b)! * ca;
      return diff !== 0 ? diff : byKey(keys[a]!, keys[b]!);
    });
    const shift = Math.floor((widestRank - members.length) / 2);
    members.forEach((v, k) => {
      x[v] = k + shift;
    });
  }

  return { x, y: rank.slice(), order, widestRank, rankCount };
}
