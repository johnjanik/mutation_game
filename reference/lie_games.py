#!/usr/bin/env python3
"""lie_games.py -- reference oracle for the mutation game, the numbers game and Satake diagrams.

Standard library only; tested with Python 3.11, 3.12 and 3.13.  This file is NOT the website; it is the small, exact
reference implementation that the numbers in the specification were checked against, and it
generates the golden data that the site's TypeScript engine must reproduce.  Every function is
exact (integers and fractions) except the last section, "Euclidean coordinates and the Coxeter
plane", which is the only floating-point code.  Inside this file nodes are numbered from 0;
verify.py converts to the 1-based labels of the specification when it writes the golden data.

Conventions (identical to the specification, section 2)
-------------------------------------------------------
* Nodes are numbered 1..n as in Bourbaki (plates I-IX).  Internally they are 0..n-1.
* Cartan matrix in the Kac / SageMath convention:   C[i][j] = <alpha_i^vee, alpha_j>.
* Game board = directed multigraph with adjacency   A[i][j] = number of edges i -> j = -C[j][i].
  More edges point from a long root to a short root (the Dynkin arrow direction).
* Mutation game (Wildberger): a population p in Z^n is a root-lattice vector in simple-root
  coordinates.  Mutating node i changes ONLY entry i:
        p_i  <-  p_i - sum_j C[i][j] p_j   =  -p_i + sum_{j != i} A[j][i] p_j
* Numbers game (Mozes): a position a in Z^n is a weight in fundamental-weight coordinates
  (Dynkin labels).  Firing node i negates entry i and feeds the neighbours:
        a_j  <-  a_j - C[j][i] a_i   =  a_j + A[i][j] a_i   (j != i),      a_i <- -a_i
* The two games are intertwined by C:   C . S_i = R_i . C    (S_i mutation, R_i firing).
"""
from fractions import Fraction as Fr
from collections import Counter, deque

# --------------------------------------------------------------------------------------
# Cartan matrices, Bourbaki labelling
# --------------------------------------------------------------------------------------

def cartan(letter, n):
    """Cartan matrix of finite type X_n, Bourbaki labelling, C[i][j] = <alpha_i^vee, alpha_j>."""
    C = [[2 if i == j else 0 for j in range(n)] for i in range(n)]

    def link(i, j, cij=-1, cji=-1):          # 1-based node numbers
        C[i - 1][j - 1] = cij
        C[j - 1][i - 1] = cji

    if letter == 'A':
        for i in range(1, n):
            link(i, i + 1)
    elif letter == 'B':                      # alpha_n short
        for i in range(1, n - 1):
            link(i, i + 1)
        link(n - 1, n, -1, -2)
    elif letter == 'C':                      # alpha_n long
        for i in range(1, n - 1):
            link(i, i + 1)
        link(n - 1, n, -2, -1)
    elif letter == 'D':                      # nodes n-1 and n both attached to n-2
        for i in range(1, n - 1):
            link(i, i + 1)
        link(n - 2, n)
    elif letter == 'E':                      # 1-3-4-5-6(-7-8), node 2 attached to 4
        link(1, 3); link(3, 4); link(4, 5); link(5, 6); link(2, 4)
        if n >= 7:
            link(6, 7)
        if n >= 8:
            link(7, 8)
    elif letter == 'F':                      # alpha_1, alpha_2 long; alpha_3, alpha_4 short
        link(1, 2); link(2, 3, -1, -2); link(3, 4)
    elif letter == 'G':                      # alpha_1 short, alpha_2 long
        link(1, 2, -3, -1)
    else:
        raise ValueError(letter)
    return C


def direct_sum(C1, C2):
    n1, n2 = len(C1), len(C2)
    C = [[0] * (n1 + n2) for _ in range(n1 + n2)]
    for i in range(n1):
        for j in range(n1):
            C[i][j] = C1[i][j]
    for i in range(n2):
        for j in range(n2):
            C[n1 + i][n1 + j] = C2[i][j]
    return C


def transpose(M):
    return [list(r) for r in zip(*M)]


def adjacency(C):
    """A[i][j] = number of directed edges i -> j on the game board."""
    n = len(C)
    return [[0 if i == j else -C[j][i] for j in range(n)] for i in range(n)]


def components(C):
    n = len(C); seen = [False] * n; out = []
    for s in range(n):
        if not seen[s]:
            comp = []; st = [s]; seen[s] = True
            while st:
                i = st.pop(); comp.append(i)
                for j in range(n):
                    if not seen[j] and i != j and (C[i][j] != 0 or C[j][i] != 0):
                        seen[j] = True; st.append(j)
            out.append(sorted(comp))
    return out


def symmetrizer(C):
    """Positive rationals d_i with d_i C[i][j] = d_j C[j][i]; scaled so min d = 1 per component.
    (alpha_i, alpha_i) = 2 d_i, so short roots have squared length 2."""
    n = len(C); d = [None] * n
    for comp in components(C):
        s = comp[0]; d[s] = Fr(1); st = [s]
        while st:
            i = st.pop()
            for j in comp:
                if j != i and C[i][j] != 0 and d[j] is None:
                    d[j] = d[i] * C[i][j] / C[j][i]; st.append(j)
        m = min(d[i] for i in comp)
        for i in comp:
            d[i] = d[i] / m
    return d


def gram(C):
    """Symmetric Gram matrix of the simple roots: B[i][j] = (alpha_i, alpha_j) = d_i C[i][j]."""
    d = symmetrizer(C); n = len(C)
    return [[d[i] * C[i][j] for j in range(n)] for i in range(n)]


def bil(B, x, y):
    n = len(B)
    return sum(x[i] * B[i][j] * y[j] for i in range(n) for j in range(n) if x[i] and y[j])


# --------------------------------------------------------------------------------------
# The two moves
# --------------------------------------------------------------------------------------

def mutate(C, p, i):
    """Mutation game move at node i (simple reflection on root coordinates)."""
    q = list(p)
    q[i] = p[i] - sum(C[i][j] * p[j] for j in range(len(p)))
    return tuple(q)


def fire(C, a, i):
    """Numbers game move at node i (simple reflection on Dynkin labels)."""
    ai = a[i]
    return tuple(a[j] - C[j][i] * ai for j in range(len(a)))


def mutation_matrix(C, i):
    n = len(C)
    return [[(1 if r == c else 0) - (C[i][c] if r == i else 0) for c in range(n)] for r in range(n)]


def firing_matrix(C, i):
    n = len(C)
    return [[(1 if r == c else 0) - (C[r][i] if c == i else 0) for c in range(n)] for r in range(n)]


def matmul(X, Y):
    return [[sum(X[i][k] * Y[k][j] for k in range(len(Y))) for j in range(len(Y[0]))] for i in range(len(X))]


def orbit(C, seeds, move, cap=3_000_000, max_depth=None):
    """Everything reachable from the seeds by the moves (breadth-first), as a set.
    max_depth, if given, stops after that many layers (the bound to use off the finite types)."""
    if max_depth is not None:
        return set(orbit_graph(C, seeds, move, cap=cap, max_depth=max_depth))
    seen = set(seeds); dq = deque(seeds); n = len(C)
    while dq:
        v = dq.popleft()
        for i in range(n):
            w = move(C, v, i)
            if w not in seen:
                seen.add(w); dq.append(w)
                if len(seen) > cap:
                    raise OverflowError('orbit exceeds cap (infinite type?)')
    return seen


def unit(n, i):
    return tuple(1 if j == i else 0 for j in range(n))


def roots(C, cap=100_000, max_depth=None):
    """All root populations: everything reachable from the singletons by mutations.
    With max_depth: those reachable in at most that many mutations."""
    n = len(C)
    return orbit(C, [unit(n, i) for i in range(n)], mutate, cap, max_depth)


def positive_roots(R):
    return sorted((r for r in R if all(x >= 0 for x in r)), key=lambda r: (sum(r), r))


def root_norm(B, r):
    return bil(B, r, r)


def coroot_coords(C, r):
    """Coordinates of the coroot r^vee in the simple-coroot basis (integers)."""
    d = symmetrizer(C); B = gram(C)
    dr = bil(B, r, r) / 2
    v = tuple(Fr(r[i]) * d[i] / dr for i in range(len(r)))
    assert all(x.denominator == 1 for x in v)
    return tuple(int(x) for x in v)


def dynkin_labels(C, p):
    """a = C p : the numbers-game position of the root-lattice vector p."""
    n = len(C)
    return tuple(sum(C[i][j] * p[j] for j in range(n)) for i in range(n))


# --------------------------------------------------------------------------------------
# Playing the numbers game
# --------------------------------------------------------------------------------------

def play(C, a, choose=None, cap=1_000_000):
    """Fire positive nodes until none is left.  Returns (final position, word, fired values).
    `choose(list_of_positive_nodes)` picks the node; default: smallest index."""
    a = tuple(a); word = []; fired = []
    while True:
        pos = [i for i in range(len(a)) if a[i] > 0]
        if not pos:
            return a, word, fired
        i = choose(pos) if choose else pos[0]
        fired.append(a[i]); word.append(i)
        a = fire(C, a, i)
        if len(word) > cap:
            raise OverflowError('game does not terminate within cap')


def longest_word(C, nodes=None):
    """A reduced word (list of node indices) for the longest element of the parabolic subgroup
    generated by `nodes`, obtained by playing the numbers game from the all-ones position."""
    nodes = list(range(len(C))) if nodes is None else sorted(nodes)
    if not nodes:
        return []
    sub = [[C[i][j] for j in nodes] for i in nodes]
    _, word, _ = play(sub, [1] * len(nodes))
    return [nodes[k] for k in word]


def act_on_roots(C, word, p):
    for i in word:
        p = mutate(C, p, i)
    return p


def act_on_weights(C, word, a):
    for i in word:
        a = fire(C, a, i)
    return a


def bipartition(C):
    """Two colour classes (0 or 1 per node) such that joined nodes differ; ValueError if the board has an odd cycle.
    Two nodes are joined when a road runs between them in either direction."""
    n = len(C); col = [None] * n
    for comp in components(C):
        col[comp[0]] = 0; st = [comp[0]]
        while st:
            i = st.pop()
            for j in comp:
                if j != i and (C[i][j] != 0 or C[j][i] != 0):
                    if col[j] is None:
                        col[j] = 1 - col[i]; st.append(j)
                    elif col[j] == col[i]:
                        raise ValueError('not bipartite')
    return col


def wave_play(C, a, first=0, cap=10_000):
    """Alternately fire ALL nodes of one colour class, then all of the other.
    Returns (number of rounds, True if every node fired was positive)."""
    col = bipartition(C); a = tuple(a); rounds = 0; legal = True; c = first
    while any(x > 0 for x in a):
        for i in [k for k in range(len(a)) if col[k] == c]:
            if a[i] <= 0:
                legal = False
            a = fire(C, a, i)
        rounds += 1; c = 1 - c
        if rounds > cap:
            raise OverflowError
    return rounds, legal


def exponents_from_fired(fired, n):
    """Dual partition of the tally of fired values in the all-ones game = exponents."""
    tally = Counter(fired)
    return sorted(sum(1 for k in tally if tally[k] >= i) for i in range(1, n + 1))


def weyl_order(C):
    n = len(C)
    if n == 0:
        return 1
    _, _, fired = play(C, [1] * n)
    out = 1
    for m in exponents_from_fired(fired, n):
        out *= m + 1
    return out


def weyl_dimension(C, lam):
    """dim V(lam) by Weyl's formula, read off the numbers game: play the SAME firing word from
    lam+rho and from rho; the dimension is the ratio of the products of the fired values."""
    n = len(C)
    _, word, fired_rho = play(C, [1] * n)
    a = tuple(l + 1 for l in lam); num = 1
    for i in word:
        assert a[i] > 0
        num *= a[i]; a = fire(C, a, i)
    den = 1
    for f in fired_rho:
        den *= f
    assert num % den == 0
    return num // den


def count_reduced_words_w0(C, limit=70_000):
    """Number of complete legal games from the all-ones position = number of reduced words of w0."""
    n = len(C); start = tuple([1] * n)
    count = {start: 1}; layer = [start]; seen = 1
    while True:
        nxt = {}
        for a in layer:
            for i in range(n):
                if a[i] > 0:
                    b = fire(C, a, i)
                    nxt[b] = nxt.get(b, 0) + count[a]
        if not nxt:
            assert len(layer) == 1
            return count[layer[0]], seen
        seen += len(nxt)
        if seen > limit:
            return None, seen
        count = nxt; layer = list(nxt)


# --------------------------------------------------------------------------------------
# Diagram automorphisms and folding
# --------------------------------------------------------------------------------------

def relabellings(C1, C2, first_only=False):
    """All tuples p with C1[p[i]][p[j]] == C2[i][j] for all i, j: node i of C2 is node p[i] of C1.
    Backtracking search that places each node next to nodes already placed, so it is fast on sparse boards of any
    rank used here (it replaces a search over all n! permutations).  Returned in lexicographic order."""
    n = len(C1)
    if len(C2) != n:
        return []

    def sig(C, i):
        return (C[i][i], tuple(sorted(C[i][j] for j in range(n) if j != i)), tuple(sorted(C[j][i] for j in range(n) if j != i)))
    s1 = [sig(C1, i) for i in range(n)]; s2 = [sig(C2, i) for i in range(n)]
    if sorted(s1) != sorted(s2):
        return []
    order = []; seen = set()
    for comp in components(C2):
        dq = deque([comp[0]]); seen.add(comp[0])
        while dq:
            i = dq.popleft(); order.append(i)
            for j in comp:
                if j not in seen and (C2[i][j] != 0 or C2[j][i] != 0):
                    seen.add(j); dq.append(j)
    out = []; p = [None] * n; used = [False] * n

    def go(k):
        if k == n:
            out.append(tuple(p))
            return first_only
        i = order[k]
        for c in range(n):
            if used[c] or s1[c] != s2[i]:
                continue
            if all(C1[c][p[j]] == C2[i][j] and C1[p[j]][c] == C2[j][i] for j in order[:k]):
                p[i] = c; used[c] = True
                if go(k + 1):
                    return True
                used[c] = False; p[i] = None
        return False
    go(0)
    return sorted(out)


def automorphisms(C):
    """All symmetries of the board: permutations t (as tuples) with C[t[i]][t[j]] == C[i][j]."""
    return relabellings(C, C)


def tau_orbits(tau, nodes=None):
    nodes = range(len(tau)) if nodes is None else nodes
    seen = set(); out = []
    for i in nodes:
        if i not in seen:
            o = [i]; j = tau[i]
            while j != i:
                o.append(j); j = tau[j]
            seen.update(o); out.append(sorted(o))
    return out


def fold(C, tau):
    """Fold the board by a diagram automorphism whose orbits contain no edges.
    Folded adjacency: A_f[O'][O] = number of edges from O' into ONE fixed node of O.
    Returns (folded Cartan matrix, orbits) or (None, orbits) if some orbit has an internal edge."""
    orbs = tau_orbits(tau); A = adjacency(C)
    for o in orbs:
        if any(A[i][j] for i in o for j in o):
            return None, orbs
    m = len(orbs)
    Af = [[0] * m for _ in range(m)]
    for s, Os in enumerate(orbs):
        for t, Ot in enumerate(orbs):
            if s != t:
                i = Ot[0]
                Af[s][t] = sum(A[j][i] for j in Os)
    Cf = [[2 if s == t else -Af[t][s] for t in range(m)] for s in range(m)]
    return Cf, orbs


def same_up_to_relabel(C1, C2):
    return bool(relabellings(C1, C2, first_only=True))


def finite_candidates(n):
    """The finite types of rank n, in the order in which they are tried (so the rank 2 board B2 = C2 is named B2)."""
    cands = [('A', n)]
    if n >= 2:
        cands += [('B', n), ('C', n)]
    if n >= 4:
        cands.append(('D', n))
    if n in (6, 7, 8):
        cands.append(('E', n))
    if n == 4:
        cands.append(('F', 4))
    if n == 2:
        cands.append(('G', 2))
    return cands


def identify_labelled(C):
    """(name, order) for a connected finite-type board given with ANY numbering of its nodes: order[k] is the node
    of C (0-based) that plays the part of Bourbaki node k + 1.  When the board has symmetries the lexicographically
    smallest order is returned.  (None, None) if the board is not of finite type."""
    for L, k in finite_candidates(len(C)):
        ps = relabellings(C, cartan(L, k))
        if ps:
            return f'{L}{k}', list(ps[0])
    return None, None


def identify(C):
    """Name of a connected finite-type Cartan matrix (up to relabelling), or None."""
    return identify_labelled(C)[0]


# --------------------------------------------------------------------------------------
# Satake diagrams: (C, X, tau) with X the black nodes and tau the arrow involution
# --------------------------------------------------------------------------------------

def theta(C, X, tau, p, wx=None):
    """theta = - w_X o tau on root coordinates."""
    n = len(C); q = [0] * n
    for i in range(n):
        q[tau[i]] = p[i]
    wx = longest_word(C, X) if wx is None else wx
    q = act_on_roots(C, wx, tuple(q))
    return tuple(-x for x in q)


def sub_positive_roots(C, X):
    """Positive roots of the subsystem spanned by the nodes in X, in full coordinates."""
    X = sorted(X); n = len(C)
    if not X:
        return []
    sub = [[C[i][j] for j in X] for i in X]
    out = []
    for r in positive_roots(roots(sub)):
        v = [0] * n
        for k, i in enumerate(X):
            v[i] = r[k]
        out.append(tuple(v))
    return out


def admissibility(C, X, tau):
    """The three conditions of Kolb's Definition 2.3 for a pair (X, tau), each judged on its own, with reasons.
    tau must be a permutation of the nodes (a tuple, 0-based); whether it is a symmetry of the board is reported
    separately as 'symmetry'.  Returns a dict:
      symmetry     tau preserves the Cartan matrix
      condition_1  tau o tau = identity and tau(X) = X
      condition_2  on the black nodes tau agrees with -w_X:  w_X(alpha_i) = -alpha_tau(i) for i in X
      condition_3  for every white node j fixed by tau, <alpha_j, rho_X^vee> is an integer
      admissible   all four hold
      reasons      one sentence per failed item (node numbers 1-based)"""
    n = len(C); X = sorted(X); Xs = set(X); reasons = {}
    sym = all(C[tau[i]][tau[j]] == C[i][j] for i in range(n) for j in range(n))
    if not sym:
        reasons['symmetry'] = 'tau is not a symmetry of the board'
    invol = all(tau[tau[i]] == i for i in range(n)); keeps = {tau[i] for i in X} == Xs
    c1 = invol and keeps
    if not invol:
        reasons['condition_1'] = 'tau applied twice is not the identity'
    elif not keeps:
        reasons['condition_1'] = 'tau does not send the black set to itself'
    wx = longest_word(C, X)
    bad2 = [i + 1 for i in X if act_on_roots(C, wx, unit(n, i)) != tuple(-x for x in unit(n, tau[i]))]
    if bad2:
        reasons['condition_2'] = f'on the black nodes {bad2}, tau differs from -w_X'
    B = gram(C); pos = sub_positive_roots(C, X); bad3 = []
    for i in range(n):
        if i not in Xs and tau[i] == i:
            e = unit(n, i)
            val = sum((Fr(bil(B, e, b)) / bil(B, b, b) for b in pos), Fr(0))   # <alpha_i, rho_X^vee>
            if val.denominator != 1:
                bad3.append((i + 1, val))
    if bad3:
        reasons['condition_3'] = '; '.join(f'<alpha_{i}, rho_X^vee> = {v} is not an integer' for i, v in bad3)
    return {'symmetry': sym, 'condition_1': c1, 'condition_2': not bad2, 'condition_3': not bad3,
            'admissible': sym and c1 and not bad2 and not bad3, 'reasons': reasons}


def admissible(C, X, tau):
    """Kolb's admissibility conditions for a pair (X, tau).  Returns (bool, reason for the first failure)."""
    rep = admissibility(C, X, tau)
    if rep['admissible']:
        return True, 'admissible'
    for key in ('symmetry', 'condition_1', 'condition_2', 'condition_3'):
        if key in rep['reasons']:
            return False, rep['reasons'][key]


def shadow2(C, X, tau, a, wx=None):
    """Twice the shadow of the population a: the integer vector a - theta(a)."""
    t = theta(C, X, tau, a, wx)
    return tuple(a[i] - t[i] for i in range(len(a)))


def classify_restricted(S, B, r):
    """Name the restricted root system from its vectors S (a set), the Gram matrix B and its rank r.
    Returns (name, classes) where classes lists (label, number of roots, squared length)."""
    norms = {v: bil(B, v, v) for v in S}
    vals = sorted(set(norms.values()))
    N = len(S)
    nonreduced = any(tuple(2 * x for x in v) in S for v in S)
    count = {nv: sum(1 for v in S if norms[v] == nv) for nv in vals}
    if nonreduced:
        assert N == 2 * r * r + 2 * r, (N, r)
        name = f'BC{r}'
        labels = ['short', 'long'] if r == 1 else ['short', 'medium', 'long']
    elif len(vals) == 1:
        labels = ['all']
        if N == r * (r + 1):
            name = f'A{r}'
        elif r >= 4 and N == 2 * r * (r - 1):
            name = f'D{r}'
        elif (r, N) in ((6, 72), (7, 126), (8, 240)):
            name = f'E{r}'
        else:
            raise ValueError(('unrecognised simply-laced system', r, N))
    else:
        assert len(vals) == 2, vals
        labels = ['short', 'long']
        ns, nl = count[vals[0]], count[vals[1]]
        ratio = vals[1] / vals[0]
        if ratio == 3:
            assert r == 2 and N == 12
            name = 'G2'
        elif r == 2:
            assert N == 8
            name = 'B2'           # = C2
        elif r == 4 and N == 48:
            name = 'F4'
        elif ns == 2 * r and nl == 2 * r * (r - 1):
            name = f'B{r}'
        elif nl == 2 * r and ns == 2 * r * (r - 1):
            name = f'C{r}'
        else:
            raise ValueError(('unrecognised system', r, N, ns, nl))
    assert len(labels) == len(vals), (labels, vals)
    return name, [(labels[k], count[vals[k]], vals[k]) for k in range(len(vals))]


def satake(C, X, tau):
    """Everything the site shows for a Satake diagram (X = black nodes, tau = the full involution, 0-based).
    Raises ValueError when the pair is not admissible: on such input the quantities below are not defined
    (the formulas would still return numbers, and they would be wrong)."""
    ok, why = admissible(C, X, tau)
    if not ok:
        raise ValueError('not admissible: ' + why)
    n = len(C); X = sorted(X); Xs = set(X)
    R = roots(C); B = gram(C); wx = longest_word(C, X)
    th = {a: theta(C, X, tau, a, wx) for a in R}
    assert all(t in R for t in th.values()), 'theta does not preserve the roots'
    assert all(th[th[a]] == a for a in R), 'theta is not an involution'
    restr = Counter(); n_compact = n_real = n_complex = 0
    for a in R:
        t = th[a]
        if t == a:
            n_compact += 1                                   # compact imaginary: restricts to 0
            continue
        if t == tuple(-x for x in a):
            n_real += 1
        else:
            n_complex += 1
        restr[tuple(Fr(a[i] - t[i], 2) for i in range(n))] += 1
    phiX = 2 * len(sub_positive_roots(C, X))
    assert n_compact == phiX, (n_compact, phiX)
    for a in positive_roots(R):                              # theta-adapted positive system
        if th[a] != a:
            assert all(x <= 0 for x in th[a]), 'theta(positive non-compact root) must be negative'
    white = [i for i in range(n) if i not in Xs]
    r = len(tau_orbits(tau, white))
    S = set(restr)
    if r == 0:
        name, classes, mult = None, [], []                   # compact form: no restricted roots
    else:
        name, classes = classify_restricted(S, B, r)
        mult = []
        for label, cnt, nv in classes:
            ms = {restr[v] for v in S if bil(B, v, v) == nv}
            assert len(ms) == 1, ('multiplicity not constant on a length class', ms)
            mult.append((label, cnt, ms.pop()))
    nphi = len(R)
    dim_k = (n - r) + (nphi + phiX) // 2
    dim_p = r + (nphi - phiX) // 2
    # the restricted board: one node per tau-orbit of white nodes
    orbs, simple, Cbar, words = restricted_board(C, X, tau)
    simple_mult = [[restr[s], restr.get(tuple(2 * x for x in s), 0)] for s in simple]      # (m_lambda, m_2lambda)
    for s, (m1, m2) in zip(simple, simple_mult):
        assert m1 > 0 and restr.get(tuple(x / 2 for x in s), 0) == 0, 'a simple restricted root is never twice a restricted root'
    board_name, board_order = identify_labelled(Cbar) if orbs and len(components(Cbar)) == 1 else (None, None)
    return {
        'rank': n, 'real_rank': r, 'restricted_type': name,
        'multiplicities': [{'class': l, 'roots': c, 'mult': m} for (l, c, m) in mult],
        'n_restricted_roots': len(S), 'dim_g': n + nphi, 'dim_k': dim_k, 'dim_p': dim_p,
        'character': dim_p - dim_k,
        'roots_compact_imaginary': n_compact, 'roots_real': n_real, 'roots_complex': n_complex,
        'w_X_word': [i + 1 for i in wx],
        'restricted_simple_orbits': [[i + 1 for i in o] for o in orbs],
        'restricted_simple_multiplicities': simple_mult,
        'restricted_cartan': Cbar,
        'restricted_board': board_name,
        'restricted_orbits_in_bourbaki_order': None if board_order is None else [[i + 1 for i in orbs[k]] for k in board_order],
        'restricted_reflection_word_lengths': [len(w) - 2 * len(wx) for w in words],
    }


# --------------------------------------------------------------------------------------
# Small exact linear algebra (for weights in root coordinates and Euclidean lengths)
# --------------------------------------------------------------------------------------

def solve(M, b):
    """Solve M x = b exactly over the rationals (M square, invertible)."""
    n = len(M)
    A = [[Fr(M[i][j]) for j in range(n)] + [Fr(b[i])] for i in range(n)]
    for c in range(n):
        piv = next(r for r in range(c, n) if A[r][c] != 0)
        A[c], A[piv] = A[piv], A[c]
        pv = A[c][c]
        A[c] = [x / pv for x in A[c]]
        for r in range(n):
            if r != c and A[r][c] != 0:
                f = A[r][c]
                A[r] = [A[r][k] - f * A[c][k] for k in range(n + 1)]
    return [A[i][n] for i in range(n)]


def inverse(M):
    n = len(M)
    cols = [solve(M, [1 if i == j else 0 for i in range(n)]) for j in range(n)]
    return [[cols[j][i] for j in range(n)] for i in range(n)]


def weight_to_root_coords(C, a):
    """p = C^{-1} a : the population (possibly fractional) of the weight with Dynkin labels a.
    None when the matrix is singular (an affine board, for instance)."""
    if determinant(C) == 0:
        return None
    return tuple(solve(C, a))


def weight_inner(C, a, b):
    """Invariant inner product of two weights given by Dynkin labels (short roots have norm 2)."""
    B = gram(C)
    return bil(B, weight_to_root_coords(C, a), weight_to_root_coords(C, b))


# --------------------------------------------------------------------------------------
# Kostant's game: the mutation game from one Martian, raising moves only
# --------------------------------------------------------------------------------------

def kostant_play(C, start, choose=None, cap=100_000):
    """Kostant's game: `raising_play` from one Martian in city `start`."""
    return raising_play(C, unit(len(C), start), choose, cap)


def raising_play(C, p, choose=None, cap=100_000):
    """From any population, mutate only where the mutation raises the population ((C p)_i < 0, an 'unhappy'
    city), until no city is unhappy.  Returns (final population, list of moves)."""
    n = len(C); p = tuple(p); moves = []
    while True:
        lab = dynkin_labels(C, p)
        unhappy = [i for i in range(n) if lab[i] < 0]
        if not unhappy:
            return p, moves
        i = choose(unhappy) if choose else unhappy[0]
        p = mutate(C, p, i); moves.append(i)
        if len(moves) > cap:
            raise OverflowError('Kostant game does not terminate within cap')


# --------------------------------------------------------------------------------------
# Wythoff / orbit polytopes: vertices, edges and face counts straight from the diagram
# --------------------------------------------------------------------------------------

def induced_components(C, K):
    K = sorted(K); seen = set(); out = []
    for s in K:
        if s not in seen:
            comp = [s]; seen.add(s); st = [s]
            while st:
                i = st.pop()
                for j in K:
                    if j not in seen and (C[i][j] != 0 or C[j][i] != 0):
                        seen.add(j); comp.append(j); st.append(j)
            out.append(sorted(comp))
    return out


def sub_matrix(C, K):
    K = sorted(K)
    return [[C[i][j] for j in K] for i in K]


def wythoff_face_types(C, rings):
    """Face types of the orbit polytope of the weight with Dynkin labels `rings` (>= 0).
    A face type is a node set K every component of which contains a ringed node; its faces are
    the translates of conv(W_K . lambda), of dimension |K|, and there are
    |W| / (|W_K| |W_K'|) of them, K' = unringed nodes neither in K nor adjacent to K.
    Returns a list of (K as 1-based list, dimension, count)."""
    n = len(C); J = {i for i in range(n) if rings[i] != 0}
    W = weyl_order(C); out = []
    for mask in range(1 << n):
        K = [i for i in range(n) if mask >> i & 1]
        if any(not (set(comp) & J) for comp in induced_components(C, K)):
            continue
        Kp = [j for j in range(n) if j not in K and j not in J and all(C[j][k] == 0 and C[k][j] == 0 for k in K)]
        count = W // (weyl_order(sub_matrix(C, K)) * weyl_order(sub_matrix(C, Kp)))
        out.append(([i + 1 for i in K], len(K), count))
    return out


def wythoff_f_vector(C, rings):
    n = len(C); f = [0] * (n + 1)
    for K, dim, count in wythoff_face_types(C, rings):
        f[dim] += count
    return f                                   # f[0] vertices, f[1] edges, ..., f[n] = 1


def wythoff_edges(C, rings, cap=200_000):
    """Explicit edges (pairs of vertices in Dynkin-label coordinates): the images under the
    group of the base edges {lambda, s_i lambda}, i ringed."""
    n = len(C); lam = tuple(rings)
    seeds = set()
    for i in range(n):
        if lam[i] != 0:
            seeds.add(tuple(sorted((lam, fire(C, lam, i)))))
    seen = set(seeds); dq = deque(seeds)
    while dq:
        u, v = dq.popleft()
        for i in range(n):
            e = tuple(sorted((fire(C, u, i), fire(C, v, i))))
            if e not in seen:
                seen.add(e); dq.append(e)
                if len(seen) > cap:
                    raise OverflowError
    return seen


# --------------------------------------------------------------------------------------
# Restricted (relative) game of a Satake diagram
# --------------------------------------------------------------------------------------

def restricted_board(C, X, tau):
    """Simple restricted roots, their Cartan matrix, and for each a word of big-board moves
    realising the restricted reflection:  s~_O = w_{X u O} . w_X  (Lusztig; Dobson-Kolb)."""
    n = len(C); X = sorted(X); Xs = set(X); B = gram(C); wx = longest_word(C, X)
    white = [i for i in range(n) if i not in Xs]
    orbs = tau_orbits(tau, white)
    simple = []
    for o in orbs:
        a = unit(n, o[0]); t = theta(C, X, tau, a, wx)
        simple.append(tuple(Fr(a[k] - t[k], 2) for k in range(n)))
    Cbar = [[2 * bil(B, simple[s], simple[t]) / bil(B, simple[s], simple[s]) for t in range(len(orbs))]
            for s in range(len(orbs))]
    assert all(x.denominator == 1 for row in Cbar for x in row), Cbar
    Cbar = [[int(x) for x in row] for row in Cbar]
    words = [wx + longest_word(C, sorted(Xs | set(o))) for o in orbs]   # apply w_X first, then w_{X u O}
    return orbs, simple, Cbar, words


# --------------------------------------------------------------------------------------
# Representations read off the numbers game
# --------------------------------------------------------------------------------------
# Matrices are sparse dictionaries {(row, column): value}; (X Y)[r][c] = sum_k X[r][k] Y[k][c].

def sp_mul(Xm, Ym):
    by_row = {}
    for (k, c), v in Ym.items():
        by_row.setdefault(k, []).append((c, v))
    out = {}
    for (r, k), v in Xm.items():
        for (c, w) in by_row.get(k, ()):
            out[(r, c)] = out.get((r, c), 0) + v * w
    return {k: v for k, v in out.items() if v != 0}


def sp_add(Xm, Ym, cy=1):
    out = dict(Xm)
    for k, v in Ym.items():
        out[k] = out.get(k, 0) + cy * v
    return {k: v for k, v in out.items() if v != 0}


def sp_comm(Xm, Ym):
    return sp_add(sp_mul(Xm, Ym), sp_mul(Ym, Xm), -1)


def sp_scale(Xm, c):
    return {k: c * v for k, v in Xm.items() if c * v != 0}


def chevalley_serre_ok(C, E, F, H):
    """True if E_i, F_i, H_i satisfy the Chevalley-Serre relations for the Cartan matrix C:
    [H_i,H_j] = 0, [H_i,E_j] = C[i][j] E_j, [H_i,F_j] = -C[i][j] F_j, [E_i,F_j] = delta_ij H_i,
    ad(E_i)^(1-C[i][j]) E_j = 0 and ad(F_i)^(1-C[i][j]) F_j = 0 for i != j."""
    n = len(C); ok = True
    for i in range(n):
        for j in range(n):
            ok &= sp_comm(H[i], H[j]) == {}
            ok &= sp_comm(H[i], E[j]) == sp_scale(E[j], C[i][j])
            ok &= sp_comm(H[i], F[j]) == sp_scale(F[j], -C[i][j])
            ok &= sp_comm(E[i], F[j]) == (H[i] if i == j else {})
            if i != j:
                x = E[j]; y = F[j]
                for _ in range(1 - C[i][j]):
                    x = sp_comm(E[i], x); y = sp_comm(F[i], y)
                ok &= (x == {} and y == {})
    return ok


def minuscule_matrices(C, i):
    """Operators on the orbit of the fundamental weight omega_i (i is 0-based), read off the numbers game.
    Basis: the positions of the orbit, sorted in decreasing order.  For a position a and a node k:
      F_k sends a to its fired position fire(a, k) when a_k = +1,
      E_k sends a to fire(a, k) when a_k = -1,
      H_k multiplies a by a_k,
      S_k is the firing move itself as a permutation matrix.
    When omega_i is minuscule these satisfy the Chevalley-Serre relations.
    Returns (basis, E, F, H, S)."""
    n = len(C); orb = sorted(orbit(C, [unit(n, i)], fire), reverse=True); idx = {a: k for k, a in enumerate(orb)}
    E = [dict() for _ in range(n)]; F = [dict() for _ in range(n)]; H = [dict() for _ in range(n)]; S = [dict() for _ in range(n)]
    for a in orb:
        for k in range(n):
            b = fire(C, a, k)
            S[k][(idx[b], idx[a])] = 1
            if a[k] == 1:
                F[k][(idx[b], idx[a])] = 1
            elif a[k] == -1:
                E[k][(idx[b], idx[a])] = 1
            if a[k] != 0:
                H[k][(idx[a], idx[a])] = a[k]
    return orb, E, F, H, S


def orbit_plus_zero_matrices(C, lam):
    """Operators on (orbit of lam) + (one zero weight), for the representations whose weights are exactly that:
    the vector representation of B_n (lam = omega_1), the 7-dimensional representation of G2 (lam = omega_1),
    the adjoint of A1 (lam = 2 omega_1).  E_k and F_k move ONE step (add or subtract alpha_k, which in Dynkin
    labels is column k of C); every entry is 1 except the two steps that leave the zero weight, which are 2.
    Returns (basis, E, F, H)."""
    n = len(C); zero = tuple([0] * n)
    orb = sorted(orbit(C, [tuple(lam)], fire), reverse=True) + [zero]; idx = {a: k for k, a in enumerate(orb)}
    E = [dict() for _ in range(n)]; F = [dict() for _ in range(n)]; H = [dict() for _ in range(n)]
    for a in orb:
        for k in range(n):
            if a[k] != 0:
                H[k][(idx[a], idx[a])] = a[k]
            lower = tuple(a[j] - C[j][k] for j in range(n)); upper = tuple(a[j] + C[j][k] for j in range(n))
            if lower in idx:
                F[k][(idx[lower], idx[a])] = 2 if a == zero else 1
            if upper in idx:
                E[k][(idx[upper], idx[a])] = 2 if a == zero else 1
    return orb, E, F, H


# --------------------------------------------------------------------------------------
# Non-crystallographic boards: H2 = I2(5), H3, H4, with exact arithmetic in Z[phi]
# --------------------------------------------------------------------------------------

class Phi:
    """The number a + b*phi, phi = (1 + sqrt 5)/2, phi^2 = phi + 1, with integers a and b.
    Exact arithmetic and exact ordering, so `mutate`, `fire`, `play` and `orbit` work unchanged."""
    __slots__ = ('a', 'b')

    def __init__(self, a, b=0):
        self.a = a; self.b = b

    @staticmethod
    def of(x):
        return x if isinstance(x, Phi) else Phi(x, 0)

    def __add__(self, o):
        o = Phi.of(o); return Phi(self.a + o.a, self.b + o.b)
    __radd__ = __add__

    def __neg__(self):
        return Phi(-self.a, -self.b)

    def __sub__(self, o):
        o = Phi.of(o); return Phi(self.a - o.a, self.b - o.b)

    def __rsub__(self, o):
        return Phi.of(o) - self

    def __mul__(self, o):
        o = Phi.of(o)              # (a + b phi)(c + d phi) = (ac + bd) + (ad + bc + bd) phi
        return Phi(self.a * o.a + self.b * o.b, self.a * o.b + self.b * o.a + self.b * o.b)
    __rmul__ = __mul__

    def sign(self):
        """Exact sign of a + b phi = ((2a + b) + b sqrt 5) / 2."""
        u = 2 * self.a + self.b; v = self.b
        if u >= 0 and v >= 0:
            return 0 if (u == 0 and v == 0) else 1
        if u <= 0 and v <= 0:
            return -1
        s = u * u - 5 * v * v      # u and v have opposite signs: compare |u| with |v| sqrt 5
        return (1 if s > 0 else -1) if u > 0 else (1 if s < 0 else -1)

    def __eq__(self, o):
        o = Phi.of(o); return self.a == o.a and self.b == o.b

    def __hash__(self):
        return hash((self.a, self.b))

    def __lt__(self, o): return (self - o).sign() < 0
    def __gt__(self, o): return (self - o).sign() > 0
    def __le__(self, o): return (self - o).sign() <= 0
    def __ge__(self, o): return (self - o).sign() >= 0

    def __float__(self):
        return self.a + self.b * (1 + 5 ** 0.5) / 2

    def __repr__(self):
        return str(self.a) if self.b == 0 else f'({self.a} + {self.b} phi)'


PHI = Phi(0, 1)


def coxeter_H(n):
    """Symmetric board of H_n (n = 2, 3, 4): a path 1 - 2 - ... - n whose LAST edge carries the Coxeter label 5.
    Entries 2 on the diagonal, -1 on ordinary edges, -phi on the 5-edge (so k_ij k_ji = phi^2 = 4 cos^2(pi/5))."""
    C = [[Phi(2) if i == j else Phi(0) for j in range(n)] for i in range(n)]
    for i in range(n - 1):
        w = PHI if i == n - 2 else Phi(1)
        C[i][i + 1] = -w; C[i + 1][i] = -w
    return C


# Golden foldings: pairs (plain node, golden node), 1-based Bourbaki labels, listed in the order of the H_n nodes.
# The H_n value at a node is  (value at the plain node) + phi * (value at the golden node),  for BOTH games,
# and acting on both nodes of a pair (they are never neighbours) is one move of the H_n game.
GOLDEN_FOLDS = {
    'A4': ('H2', [(1, 3), (4, 2)]),
    'D6': ('H3', [(1, 5), (2, 4), (6, 3)]),
    'E8': ('H4', [(8, 1), (7, 3), (6, 4), (2, 5)]),
}


def golden_fold(name, v):
    """Fold an integer vector on the big board to a Z[phi] vector on the H board."""
    return tuple(Phi(v[a - 1], v[b - 1]) for (a, b) in GOLDEN_FOLDS[name][1])


# --------------------------------------------------------------------------------------
# Classifying an arbitrary board: finite, affine, or neither
# --------------------------------------------------------------------------------------

def determinant(M):
    """Exact determinant (Fraction) by Gaussian elimination."""
    M = [[Fr(x) for x in row] for row in M]; n = len(M); d = Fr(1)
    for c in range(n):
        piv = next((r for r in range(c, n) if M[r][c] != 0), None)
        if piv is None:
            return Fr(0)
        if piv != c:
            M[c], M[piv] = M[piv], M[c]; d = -d
        d *= M[c][c]
        for r in range(c + 1, n):
            f = M[r][c] / M[c][c]
            if f:
                M[r] = [M[r][k] - f * M[c][k] for k in range(n)]
    return d


def board_kind(C):
    """What kind of matrix this is, before any game is played on it:
      'not-a-board'  some diagonal entry is not 2, or some off-diagonal entry is positive or not an integer;
      'one-way'      for some pair of nodes there are roads in one direction only (C[i][j] = 0 but C[j][i] != 0);
      'gcm'          a generalized Cartan matrix: every road has at least one road back."""
    n = len(C)
    for i in range(n):
        if C[i][i] != 2:
            return 'not-a-board'
        for j in range(n):
            if i != j and (C[i][j] != int(C[i][j]) or C[i][j] > 0):
                return 'not-a-board'
    if any((C[i][j] == 0) != (C[j][i] == 0) for i in range(n) for j in range(i)):
        return 'one-way'
    return 'gcm'


def is_generalized_cartan(C):
    return board_kind(C) == 'gcm'


def is_symmetrizable(C):
    """True when the board is balanced: positive d_i exist with d_i C[i][j] = d_j C[j][i].  A board with a
    one-way road is never balanced."""
    if board_kind(C) != 'gcm':
        return False
    d = symmetrizer(C); n = len(C)
    return all(d[i] * C[i][j] == d[j] * C[j][i] for i in range(n) for j in range(n))


def cartan_class_by_minors(C):
    """The definition, used only to cross-check `cartan_class`: for a CONNECTED generalized Cartan matrix,
    finite  <=> every principal minor is positive;
    affine  <=> det C = 0 and every proper principal minor is positive;
    indefinite otherwise.  Exponential in the number of nodes."""
    n = len(C)
    assert is_generalized_cartan(C) and len(components(C)) == 1
    full = determinant(C); proper_ok = True
    for mask in range(1, (1 << n) - 1):
        K = [i for i in range(n) if mask >> i & 1]
        if determinant([[C[i][j] for j in K] for i in K]) <= 0:
            proper_ok = False; break
    if proper_ok and full > 0:
        return 'finite'
    if proper_ok and full == 0:
        return 'affine'
    return 'indefinite'


def cartan_class(C):
    """'finite', 'affine' or 'indefinite' for a CONNECTED generalized Cartan matrix, in polynomial time.
    A board that is not balanced is indefinite.  For a balanced board let B = DC be the symmetric matrix of the
    invariant form and m_1, ..., m_n its leading principal minors (in the given node order):
      finite      <=>  every m_k > 0                      (B is positive definite);
      affine      <=>  m_1, ..., m_(n-1) > 0 and m_n = 0  (B is positive semidefinite with a line of null vectors);
      indefinite  otherwise."""
    assert is_generalized_cartan(C) and len(components(C)) == 1
    if not is_symmetrizable(C):
        return 'indefinite'
    B = gram(C); n = len(C)
    minors = [determinant([row[:k] for row in B[:k]]) for k in range(1, n + 1)]
    if all(m > 0 for m in minors):
        return 'finite'
    if all(m > 0 for m in minors[:-1]) and minors[-1] == 0:
        return 'affine'
    return 'indefinite'


def null_vector(M):
    """The primitive integer vector v with M v = 0 and positive entries, for a matrix of corank 1 (None otherwise)."""
    from math import gcd
    n = len(M); A = [[Fr(x) for x in row] for row in M]; piv_cols = []; r = 0
    for c in range(n):
        p = next((k for k in range(r, n) if A[k][c] != 0), None)
        if p is None:
            continue
        A[r], A[p] = A[p], A[r]
        A[r] = [x / A[r][c] for x in A[r]]
        for k in range(n):
            if k != r and A[k][c] != 0:
                f = A[k][c]; A[k] = [A[k][t] - f * A[r][t] for t in range(n)]
        piv_cols.append(c); r += 1
    free = [c for c in range(n) if c not in piv_cols]
    if len(free) != 1:
        return None
    f = free[0]; v = [Fr(0)] * n; v[f] = Fr(1)
    for row, c in enumerate(piv_cols):
        v[c] = -A[row][f]
    den = 1
    for x in v:
        den = den * x.denominator // gcd(den, x.denominator)
    w = [int(x * den) for x in v]
    g = 0
    for x in w:
        g = gcd(g, abs(x))
    w = [x // g for x in w]
    if all(x < 0 for x in w):
        w = [-x for x in w]
    return tuple(w) if all(x > 0 for x in w) else None


def marks(C):
    """Affine board: the frozen population delta, C.delta = 0."""
    return null_vector(C)


def comarks(C):
    """Affine board: the weights c of the conserved level, c^T C = 0."""
    return null_vector(transpose(C))


# --------------------------------------------------------------------------------------
# Affine extension of a finite board; heaps of plays
# --------------------------------------------------------------------------------------

def affine_extension(C, short=False):
    """Affine board of a finite-type board: a new node 0, placed first, with alpha_0 = delta - theta.
    short=False: theta is the highest root; the result is the untwisted affine board.
    short=True:  theta is the highest SHORT root; on B, C, F, G boards the result is a twisted affine board
                 (on simply laced boards the two choices coincide).
    Returns (affine Cartan matrix, marks, comarks), all with node 0 first."""
    n = len(C); R = roots(C)
    if short:
        B = gram(C); m = min(bil(B, r, r) for r in R)
        th = max((r for r in positive_roots(R) if bil(B, r, r) == m), key=sum)
    else:
        th = max(positive_roots(R), key=sum)
    thv = coroot_coords(C, th)
    Ca = [[0] * (n + 1) for _ in range(n + 1)]
    Ca[0][0] = 2
    for j in range(n):
        Ca[0][j + 1] = -sum(thv[i] * C[i][j] for i in range(n))      # <alpha_0^vee, alpha_j> = -<theta^vee, alpha_j>
        Ca[j + 1][0] = -sum(C[j][i] * th[i] for i in range(n))       # <alpha_j^vee, alpha_0> = -<alpha_j^vee, theta>
        for k in range(n):
            Ca[j + 1][k + 1] = C[j][k]
    return Ca, (1,) + tuple(th), (1,) + tuple(thv)


def heap(C, word):
    """The heap (Wildberger: frame) of a play, as 'falling bricks'.  Brick k carries the node word[k] and rests on
    the earlier bricks whose node is the same or joined to it.  Returns the list of levels (1 = on the floor).
    Two plays that differ by exchanging adjacent moves at unjoined nodes have the same multiset of (node, level)."""
    levels = []
    for k, i in enumerate(word):
        below = [levels[j] for j in range(k) if word[j] == i or C[i][word[j]] != 0 or C[word[j]][i] != 0]
        levels.append(1 + max(below, default=0))
    return levels


def heap_key(C, word):
    return tuple(sorted(zip(word, heap(C, word))))


def all_complete_games(C, start=None, limit=100_000):
    """Every complete legal play of the numbers game from `start` (default all ones), as lists of node indices."""
    n = len(C); start = tuple([1] * n) if start is None else tuple(start); out = []

    def go(a, word):
        pos = [i for i in range(n) if a[i] > 0]
        if not pos:
            out.append(list(word))
            if len(out) > limit:
                raise OverflowError
            return
        for i in pos:
            word.append(i); go(fire(C, a, i), word); word.pop()
    go(start, [])
    return out


# --------------------------------------------------------------------------------------
# Naming affine boards; the full verdict on an arbitrary board
# --------------------------------------------------------------------------------------

def twisted_a_even(n):
    """The affine board A_(2n)^(2), n >= 1, nodes 0..n in a path, marks (2, ..., 2, 1).
    n = 1 is the board with four roads one way and one back."""
    if n == 1:
        return [[2, -4], [-1, 2]]
    C = [[2 if i == j else 0 for j in range(n + 1)] for i in range(n + 1)]
    for i in range(n):
        C[i][i + 1] = -1; C[i + 1][i] = -1
    C[0][1] = -2; C[n - 1][n] = -2
    return C


def affine_candidates(m):
    """(name, Cartan matrix) for every affine board with m nodes, in Kac's naming.  Untwisted boards are written
    'A4~' (Kac: A_4^(1)); twisted ones 'A2^(2)', 'A4^(2)', 'A5^(2)', 'D4^(2)', 'E6^(2)', 'D4^(3)'.
    The twisted boards other than A_(2n)^(2) are the reversed (transposed) untwisted boards of B, C, F, G."""
    n = m - 1; out = []
    if n < 1:
        return out
    for L, k in finite_candidates(n):
        if (L, k) in (('B', 2),):
            continue                                      # B2~ and C2~ are the same board; it is named C2~
        out.append((f'{L}{k}~', affine_extension(cartan(L, k))[0]))
    out.append((f'A{2 * n}^(2)', twisted_a_even(n)))
    if n >= 3:
        out.append((f'A{2 * n - 1}^(2)', transpose(affine_extension(cartan('B', n))[0])))
    if n >= 2:
        out.append((f'D{n + 1}^(2)', transpose(affine_extension(cartan('C', n))[0])))
    if n == 4:
        out.append(('E6^(2)', transpose(affine_extension(cartan('F', 4))[0])))
    if n == 2:
        out.append(('D4^(3)', transpose(affine_extension(cartan('G', 2))[0])))
    return out


def identify_affine(C):
    """Name of a connected affine board given with any numbering of its nodes, or None."""
    for name, M in affine_candidates(len(C)):
        if relabellings(C, M, first_only=True):
            return name
    return None


def classify(C):
    """The verdict on an arbitrary board, one record per connected component (two nodes are connected when a road
    runs between them in either direction).  Node numbers in the records are 1-based positions in C.
      kind      'gcm' or 'one-way'                     (a matrix that is 'not-a-board' raises ValueError)
      balanced  True / False                           (always False for 'one-way')
      class     'finite' | 'affine' | 'indefinite'     (None for 'one-way': the theory does not apply)
      name      'E6', 'B3', 'A4~', 'D4^(3)', ... or None
      bourbaki_order   finite boards: the component's nodes listed in Bourbaki order of the named type
      marks, comarks   affine boards: the frozen population and the weights of the level, in the order of 'nodes'"""
    if board_kind(C) == 'not-a-board':
        raise ValueError('not a board: the diagonal must be 2 and the other entries must be integers <= 0')
    out = []
    for comp in components(C):
        sub = [[C[i][j] for j in comp] for i in comp]
        rec = {'nodes': [i + 1 for i in comp], 'kind': board_kind(sub), 'balanced': False, 'class': None, 'name': None}
        if rec['kind'] == 'gcm':
            rec['balanced'] = is_symmetrizable(sub); rec['class'] = cartan_class(sub)
            if rec['class'] == 'finite':
                name, order = identify_labelled(sub)
                rec['name'] = name; rec['bourbaki_order'] = [comp[k] + 1 for k in order]
            elif rec['class'] == 'affine':
                rec['name'] = identify_affine(sub)
                rec['marks'] = list(null_vector(sub)); rec['comarks'] = list(null_vector(transpose(sub)))
        out.append(rec)
    return out


def smallest_nonfinite_subboard(C):
    """For a board with two-way roads only: a smallest set of nodes (1-based, first in lexicographic order among
    the smallest) whose induced board is connected and already affine or indefinite, with its class.
    None if every component is of finite type, and None for a board with a one-way road."""
    from itertools import combinations
    n = len(C)
    if board_kind(C) != 'gcm':
        return None                                          # the notion needs two-way roads
    for size in range(1, n + 1):
        for K in combinations(range(n), size):
            sub = [[C[i][j] for j in K] for i in K]
            if len(components(sub)) == 1:
                cls = cartan_class(sub)
                if cls != 'finite':
                    return [i + 1 for i in K], cls
    return None


def is_root_population(C, v):
    """Exact test, on a board with two-way roads only, whether the integer population v is a root population.
    A positive root population other than a simple one is lowered by every mutation at a node whose number is
    positive, and stays a positive root population; so lower greedily and see whether a single Martian is reached."""
    assert board_kind(C) == 'gcm'
    v = tuple(v); n = len(C)
    if any(x < 0 for x in v):
        v = tuple(-x for x in v)
    if any(x < 0 for x in v) or not any(v):
        return False
    while sum(v) > 1:
        a = dynkin_labels(C, v)
        i = next((k for k in range(n) if a[k] > 0), None)
        if i is None:
            return False
        v = mutate(C, v, i)
        if v[i] < 0:
            return False
    return True


def form_is_invariant(C, M):
    """True when the symmetric matrix M defines a form p^T M q that every mutation of the board preserves."""
    n = len(C)
    for i in range(n):
        S = mutation_matrix(C, i)
        if matmul(matmul(transpose(S), M), S) != [list(r) for r in M]:
            return False
    return True


# --------------------------------------------------------------------------------------
# Playing with a record: fates, orbit graphs, separating mirrors, classes of plays
# --------------------------------------------------------------------------------------

def play_fate(C, a, choose=None, cap=20_000):
    """Legal play of the numbers game with loop detection.  Returns a dict with
      status    'ended' (no positive number is left), 'looped' (a position came back) or 'cap' (still going);
      moves     number of moves made;  word, fired, position: the play so far and where it stands;
      first_visit  for 'looped': the move count at which the repeated position was first seen."""
    a = tuple(a); seen = {a: 0}; word = []; fired = []
    while True:
        pos = [i for i in range(len(a)) if a[i] > 0]
        if not pos:
            return {'status': 'ended', 'moves': len(word), 'word': word, 'fired': fired, 'position': a}
        i = choose(pos) if choose else pos[0]
        fired.append(a[i]); word.append(i); a = fire(C, a, i)
        if a in seen:
            return {'status': 'looped', 'moves': len(word), 'word': word, 'fired': fired, 'position': a, 'first_visit': seen[a]}
        seen[a] = len(word)
        if len(word) >= cap:
            return {'status': 'cap', 'moves': len(word), 'word': word, 'fired': fired, 'position': a}


def orbit_graph(C, seeds, move, cap=100_000, legal_only=False, max_depth=None):
    """Breadth-first search that remembers how each position was first reached.
    Returns {position: (depth, parent position or None, node moved or None)}; nodes are tried in increasing order.
    legal_only=True follows only legal firings (a node with a positive number).
    max_depth stops the search after that many layers; this is the first bound to use on boards that are not of
    finite type.  In the examples of verify.py (section 10) the number of new positions per layer stays bounded
    on the affine boards and on the two-node board while the entries grow, and on the indefinite star with five
    arms the number of positions grows geometrically, so that the cap matters as well (see orbit_graph_capped)."""
    graph = {tuple(s): (0, None, None) for s in seeds}; dq = deque(graph); n = len(C)
    while dq:
        v = dq.popleft(); d = graph[v][0]
        if max_depth is not None and d >= max_depth:
            continue
        for i in range(n):
            if legal_only and not v[i] > 0:
                continue
            w = move(C, v, i)
            if w not in graph:
                graph[w] = (d + 1, v, i); dq.append(w)
                if len(graph) > cap:
                    raise OverflowError('orbit exceeds cap (infinite type?)')
    return graph


def orbit_graph_capped(C, seeds, move, cap, max_depth=None):
    """orbit_graph that stops instead of raising: the search ends when it is about to add position number cap + 1.
    Returns (graph, truncated, complete_layers).  The graph holds at most cap positions, in the order found
    (seeds in the order given; then, for each position in the order found, the nodes in increasing order).
    complete_layers is the largest L such that every position of depth at most L is in the graph: the depth of
    the position being expanded when the cap was hit, or the largest depth present when the search was not cut."""
    graph = {tuple(s): (0, None, None) for s in seeds}; dq = deque(graph); n = len(C)
    assert len(graph) <= cap
    while dq:
        v = dq.popleft(); d = graph[v][0]
        if max_depth is not None and d >= max_depth:
            continue
        for i in range(n):
            w = move(C, v, i)
            if w not in graph:
                if len(graph) == cap:
                    return graph, True, d
                graph[w] = (d + 1, v, i); dq.append(w)
    return graph, False, max(d for (d, _, _) in graph.values())


def word_to(graph, v):
    """A shortest word (list of nodes, in the order played) from a seed of `graph` to the position v."""
    word = []
    while graph[v][1] is not None:
        word.append(graph[v][2]); v = graph[v][1]
    return word[::-1]


def legal_layers(C, start=None):
    """Numbers of positions first reached after 0, 1, 2, ... legal moves from `start` (default all ones).
    From all ones this is the number of group elements of each length."""
    n = len(C); start = tuple([1] * n) if start is None else tuple(start)
    g = orbit_graph(C, [start], fire, legal_only=True)
    sizes = Counter(d for (d, _, _) in g.values())
    return [sizes[k] for k in range(max(sizes) + 1)]


def separating_roots(C, a, pos=None):
    """The positive roots beta with <a, beta^vee> < 0: the mirrors between the position a and the dominant
    chamber.  For a position reached from all ones their number is the number of moves of a shortest play."""
    pos = positive_roots(roots(C)) if pos is None else pos
    return [b for b in pos if sum(x * y for x, y in zip(a, coroot_coords(C, b))) < 0]


def commutation_class_size(C, word):
    """Number of plays that differ from `word` only by exchanging adjacent moves at unjoined nodes: the number of
    ways to lay the bricks of its heap one at a time."""
    from functools import lru_cache
    m = len(word)
    below = [sum(1 << j for j in range(k) if word[j] == word[k] or C[word[k]][word[j]] != 0 or C[word[j]][word[k]] != 0)
             for k in range(m)]
    full = (1 << m) - 1

    @lru_cache(maxsize=None)
    def count(mask):
        if mask == full:
            return 1
        return sum(count(mask | 1 << k) for k in range(m) if not mask >> k & 1 and below[k] & mask == below[k])
    return count(0)


def symbolic_play(C, word):
    """Play `word` in the numbers game with the indeterminates x_1, ..., x_n as the start.  Returns the list of
    linear forms fired, each as its tuple of coefficients."""
    n = len(C); M = [list(unit(n, i)) for i in range(n)]; fired = []
    for i in word:
        fired.append(tuple(M[i]))
        Mi = M[i][:]
        M = [[M[j][k] - C[j][i] * Mi[k] for k in range(n)] for j in range(n)]
    return fired


def orbit_size(C, a):
    """Size of the orbit of a dominant position a (all numbers >= 0) without enumerating it: |W| / |W_J|,
    J = the nodes where a is zero."""
    assert all(x >= 0 for x in a)
    J = [i for i in range(len(C)) if a[i] == 0]
    return weyl_order(C) // weyl_order(sub_matrix(C, J))


# --------------------------------------------------------------------------------------
# Folding by averaging
# --------------------------------------------------------------------------------------

def averaged_roots_type(C, tau):
    """Type of the set of averages of the roots over the cyclic group generated by the symmetry tau (any order),
    with its length classes.  For an involution this is the restricted root system of the quasi-split real form
    whose Satake diagram has no black nodes and arrows tau."""
    n = len(C); R = roots(C); B = gram(C); S = set()

    def push(p):
        q = [0] * n
        for i in range(n):
            q[tau[i]] = p[i]
        return tuple(q)
    for a in R:
        orb = [a]; b = push(a)
        while b != a:
            orb.append(b); b = push(b)
        S.add(tuple(Fr(sum(v[i] for v in orb), len(orb)) for i in range(n)))
    return classify_restricted(S, B, len(tau_orbits(tau)))


# --------------------------------------------------------------------------------------
# The catalogue of Satake diagrams (real forms), rank by rank
# --------------------------------------------------------------------------------------

def _ident(n):
    return tuple(range(n))


def _flip_a(n):
    return tuple(n - 1 - i for i in range(n))


def _swap_d(n):
    t = list(range(n)); t[n - 2], t[n - 1] = n - 1, n - 2
    return tuple(t)


FLIP_E6 = (5, 1, 4, 3, 2, 0)


def satake_catalogue(L, n):
    """The real forms of the complex simple Lie algebra of type L_n as Satake diagrams.  Each record has
      name      Cartan's label ('A III', 'E VI', 'compact', ...)
      algebra   the real form ('su(2,4)', 'e7(-5)', ...)
      X, tau    black nodes and the full involution, 0-based
      et        the type of the restricted roots as the tables print it (None for the compact form).  In rank 2
                the tables write C2 in the families whose general member is C_p; C2 and B2 are the same system
      em        expected multiplicities by length class
      dk        expected dimension of the maximal compact subalgebra
    The expectations are compared with the computed values by verify.py."""
    out = []

    def add(name, algebra, X, tau, et, em, dk):
        out.append(dict(name=name, algebra=algebra, X=sorted(X), tau=tuple(tau), et=et, em=em, dk=dk))

    if L == 'A':
        add('A I', f'sl({n + 1},R)', [], _ident(n), f'A{n}', [('all', 1)], n * (n + 1) // 2)
        if n % 2 == 1 and n >= 3:
            m = (n + 1) // 2
            add('A II', f'su*({n + 1})', range(0, n, 2), _ident(n), f'A{m - 1}', [('all', 4)], m * (2 * m + 1))
        if n >= 2:
            for p in range(1, (n + 1) // 2 + 1):
                q = n + 1 - p
                if p == q:
                    et = f'C{p}'
                    em = [('short', 2), ('long', 1)]
                else:
                    et = f'BC{p}'
                    em = [('short', 2 * (q - p)), ('long', 1)] if p == 1 else [('short', 2 * (q - p)), ('medium', 2), ('long', 1)]
                add('A IV' if p == 1 else 'A III', f'su({p},{q})', range(p, n - p), _flip_a(n), et, em, p * p + q * q - 1)
        add('compact', f'su({n + 1})', range(n), _flip_a(n), None, None, n * (n + 2))
    elif L == 'B':
        for p in range(1, n + 1):
            q = 2 * n + 1 - p
            if p == 1:
                et, em = 'A1', [('all', q - p)]
            else:
                et, em = f'B{p}', [('short', q - p), ('long', 1)]
            add('B II' if p == 1 else 'B I', f'so({p},{q})', range(p, n), _ident(n), et, em, p * (p - 1) // 2 + q * (q - 1) // 2)
        add('compact', f'so({2 * n + 1})', range(n), _ident(n), None, None, n * (2 * n + 1))
    elif L == 'C':
        add('C I', f'sp({2 * n},R)', [], _ident(n), f'C{n}', [('short', 1), ('long', 1)], n * n)
        for p in range(1, n // 2 + 1):
            q = n - p
            X = [2 * k for k in range(p)] + list(range(2 * p, n))
            if p < q:
                et = f'BC{p}'
                em = [('short', 4 * (q - p)), ('long', 3)] if p == 1 else [('short', 4 * (q - p)), ('medium', 4), ('long', 3)]
            elif p == 1:
                et, em = 'A1', [('all', 3)]
            else:
                et, em = f'C{p}', [('short', 4), ('long', 3)]
            add('C II', f'sp({p},{q})', X, _ident(n), et, em, p * (2 * p + 1) + q * (2 * q + 1))
        add('compact', f'sp({n})', range(n), _ident(n), None, None, n * (2 * n + 1))
    elif L == 'D':
        for p in range(1, n + 1):
            q = 2 * n - p
            if p == n:
                X, tau, et, em = [], _ident(n), f'D{n}', [('all', 1)]
            else:
                X = list(range(p, n)) if n - p >= 2 else []
                tau = _ident(n) if (n - p) % 2 == 0 else _swap_d(n)
                if p == 1:
                    et, em = 'A1', [('all', q - p)]
                else:
                    et, em = f'B{p}', [('short', q - p), ('long', 1)]
            add('D II' if p == 1 else 'D I', f'so({p},{q})', X, tau, et, em, p * (p - 1) // 2 + q * (q - 1) // 2)
        if n % 2 == 0:
            m = n // 2
            add('D III', f'so*({2 * n})', range(0, n - 1, 2), _ident(n), f'C{m}', [('short', 4), ('long', 1)], n * n)
        else:
            m = (n - 1) // 2
            add('D III', f'so*({2 * n})', range(0, n - 2, 2), _swap_d(n), f'BC{m}',
                [('short', 4), ('long', 1)] if m == 1 else [('short', 4), ('medium', 4), ('long', 1)], n * n)
        add('compact', f'so({2 * n})', range(n), _ident(n) if n % 2 == 0 else _swap_d(n), None, None, n * (2 * n - 1))
    elif (L, n) == ('E', 6):
        add('E I', 'e6(6)', [], _ident(6), 'E6', [('all', 1)], 36)
        add('E II', 'e6(2)', [], FLIP_E6, 'F4', [('short', 2), ('long', 1)], 38)
        add('E III', 'e6(-14)', [2, 3, 4], FLIP_E6, 'BC2', [('short', 8), ('medium', 6), ('long', 1)], 46)
        add('E IV', 'e6(-26)', [1, 2, 3, 4], _ident(6), 'A2', [('all', 8)], 52)
        add('compact', 'e6(-78)', range(6), FLIP_E6, None, None, 78)
    elif (L, n) == ('E', 7):
        add('E V', 'e7(7)', [], _ident(7), 'E7', [('all', 1)], 63)
        add('E VI', 'e7(-5)', [1, 4, 6], _ident(7), 'F4', [('short', 4), ('long', 1)], 69)
        add('E VII', 'e7(-25)', [1, 2, 3, 4], _ident(7), 'C3', [('short', 8), ('long', 1)], 79)
        add('compact', 'e7(-133)', range(7), _ident(7), None, None, 133)
    elif (L, n) == ('E', 8):
        add('E VIII', 'e8(8)', [], _ident(8), 'E8', [('all', 1)], 120)
        add('E IX', 'e8(-24)', [1, 2, 3, 4], _ident(8), 'F4', [('short', 8), ('long', 1)], 136)
        add('compact', 'e8(-248)', range(8), _ident(8), None, None, 248)
    elif (L, n) == ('F', 4):
        add('F I', 'f4(4)', [], _ident(4), 'F4', [('short', 1), ('long', 1)], 24)
        add('F II', 'f4(-20)', [0, 1, 2], _ident(4), 'BC1', [('short', 8), ('long', 7)], 36)
        add('compact', 'f4(-52)', range(4), _ident(4), None, None, 52)
    elif (L, n) == ('G', 2):
        add('G', 'g2(2)', [], _ident(2), 'G2', [('short', 1), ('long', 1)], 6)
        add('compact', 'g2(-14)', range(2), _ident(2), None, None, 14)
    return out


def canonical_pair(C, X, tau, auts=None):
    """A canonical representative of the pair (X, tau) under the symmetries of the board: two pairs describe the
    same real form exactly when their canonical representatives are equal."""
    auts = automorphisms(C) if auts is None else auts
    best = None
    for g in auts:
        Xg = tuple(sorted(g[i] for i in X))
        tg = [0] * len(tau)
        for i in range(len(tau)):
            tg[g[i]] = g[tau[i]]
        key = (Xg, tuple(tg))
        if best is None or key < best:
            best = key
    return best


def match_catalogue(L, n, X, tau):
    """Every catalogue record of type L_n that is the pair (X, tau) up to a symmetry of the board.  The list has
    one element, except on D4 where so(2,6) and so*(8) are the same real form seen through triality (two elements)
    and for pairs that are not admissible (no element)."""
    C = cartan(L, n); auts = automorphisms(C); key = canonical_pair(C, X, tau, auts)
    return [e for e in satake_catalogue(L, n) if canonical_pair(C, e['X'], e['tau'], auts) == key]


# --------------------------------------------------------------------------------------
# Euclidean coordinates and the Coxeter plane (the only floating-point code in this file)
# --------------------------------------------------------------------------------------

def sym_eig(M, sweeps=60, tol=1e-22):
    """Eigenvalues (ascending) and eigenvectors (as rows, orthonormal) of a real symmetric matrix by the cyclic
    Jacobi method.  No dependencies; ample for the sizes used here (at most 12)."""
    import math
    n = len(M); A = [[float(x) for x in row] for row in M]
    V = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for _ in range(sweeps):
        off = sum(A[i][j] ** 2 for i in range(n) for j in range(n) if i != j)
        if off < tol:
            break
        for p in range(n - 1):
            for q in range(p + 1, n):
                if abs(A[p][q]) < 1e-300:
                    continue
                th = (A[q][q] - A[p][p]) / (2 * A[p][q])
                t = (1.0 if th >= 0 else -1.0) / (abs(th) + math.sqrt(th * th + 1.0))
                c = 1.0 / math.sqrt(t * t + 1.0); s = t * c
                for k in range(n):
                    akp, akq = A[k][p], A[k][q]
                    A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq
                for k in range(n):
                    apk, aqk = A[p][k], A[q][k]
                    A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk
                for k in range(n):
                    vkp, vkq = V[k][p], V[k][q]
                    V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq
    order = sorted(range(n), key=lambda i: A[i][i])
    return [A[i][i] for i in order], [[V[k][i] for k in range(n)] for i in order]


def euclidean_basis(C):
    """(E, eigenvalues) for a finite-type board: E is an n x n matrix of floats (list of rows) with
    E^T E = B = DC, so y = E p are coordinates in which the invariant form is the dot product.
    E = Lambda^(1/2) V^T D^(1/2), where D^(1/2) C D^(-1/2) = V Lambda V^T, eigenvalues ascending.
    Row 0 and row n-1 span the Coxeter plane."""
    import math
    d = [float(x) for x in symmetrizer(C)]; n = len(C)
    G = [[math.sqrt(d[i]) * C[i][j] / math.sqrt(d[j]) for j in range(n)] for i in range(n)]
    vals, vecs = sym_eig(G)
    E = [[math.sqrt(max(vals[k], 0.0)) * vecs[k][j] * math.sqrt(d[j]) for j in range(n)] for k in range(n)]
    return E, vals


def coxeter_plane_points(C):
    """The roots (sorted) and their projections to the Coxeter plane, as (list of roots, list of (x, y))."""
    E, _ = euclidean_basis(C); n = len(C); R = sorted(roots(C))
    return R, [(sum(E[0][j] * r[j] for j in range(n)), sum(E[n - 1][j] * r[j] for j in range(n))) for r in R]


def coxeter_plane_rings(C, digits=6):
    """(rings, distinct): rings is the list of [radius, number of roots at that radius], radii ascending and
    rounded; distinct is the number of different points among the projected roots."""
    import math
    _, pts = coxeter_plane_points(C)
    rings = Counter(round(math.hypot(x, y), digits) for x, y in pts)
    distinct = len({(round(x, digits) + 0.0, round(y, digits) + 0.0) for x, y in pts})
    return [[r, c] for r, c in sorted(rings.items())], distinct


def coxeter_word(C):
    """The bipartite Coxeter element as a word: all nodes of colour 0 in increasing order, then all of colour 1."""
    col = bipartition(C); n = len(C)
    return [i for i in range(n) if col[i] == 0] + [i for i in range(n) if col[i] == 1]


def cholesky_basis(C):
    """A second Euclidean basis that needs no eigenvalues: the upper triangular matrix U (floats, list of rows)
    with U^T U = B = DC and a positive diagonal.  Column j is the picture of the simple root alpha_j: alpha_1 lies
    along the first axis, alpha_2 in the plane of the first two axes above it, and so on."""
    import math
    Bm = [[float(x) for x in row] for row in gram(C)]; n = len(C)
    U = [[0.0] * n for _ in range(n)]
    for j in range(n):
        s = Bm[j][j] - sum(U[k][j] ** 2 for k in range(j))
        U[j][j] = math.sqrt(s)
        for i in range(j + 1, n):
            U[j][i] = (Bm[j][i] - sum(U[k][j] * U[k][i] for k in range(j))) / U[j][j]
    return U


# --------------------------------------------------------------------------------------
# Small derived quantities of a finite-type board (each is checked against textbook values by verify.py)
# --------------------------------------------------------------------------------------

def highest_root(C):
    """The root population of largest total."""
    return max(positive_roots(roots(C)), key=sum)


def highest_short_root(C):
    """On a board with two root lengths: the highest short root.  None on a simply laced board.
    Computed without the form: a board of finite type has one positive root with no negative number when it is
    simply laced and two otherwise; the one of smaller total is the highest short root."""
    dom = [r for r in positive_roots(roots(C)) if all(x >= 0 for x in dynkin_labels(C, r))]
    assert len(dom) in (1, 2)
    return min(dom, key=sum) if len(dom) == 2 else None


def coxeter_number(C):
    """h = 2N / n."""
    return 2 * len(positive_roots(roots(C))) // len(C)


def minus_w0(C):
    """The symmetry -w0 of the board, as the list of images of the nodes (0-based)."""
    word = longest_word(C); n = len(C)
    return [[-x for x in act_on_roots(C, word, unit(n, i))].index(1) for i in range(n)]


def minuscule_nodes(C):
    """Nodes i (0-based) for which every position in the orbit of the fundamental weight omega_i has all its
    numbers in {-1, 0, 1}: the nodes where the highest root of the reversed board has entry 1."""
    top = highest_root(transpose(C))
    return [i for i in range(len(C)) if top[i] == 1]


def averaged_simple_cartan(C, tau):
    """Cartan matrix of the averaged simple roots, one per orbit of the symmetry tau (orbits in the order of
    their smallest node).  When the board folds by tau this is the transpose of the folded Cartan matrix."""
    n = len(C); B = gram(C); orbs = tau_orbits(tau)
    av = [tuple(Fr(1 if i in o else 0, len(o)) for i in range(n)) for o in orbs]
    M = [[2 * bil(B, av[s], av[t]) / bil(B, av[s], av[s]) for t in range(len(orbs))] for s in range(len(orbs))]
    assert all(x.denominator == 1 for row in M for x in row)
    return [[int(x) for x in row] for row in M]


def form_invariance_witness(C, M):
    """None when every mutation preserves the quadratic form p -> p^T M p (M symmetric); otherwise a pair
    (node, population) such that mutating that node changes the value on that population.  The population is a
    single Martian or two Martians in different cities, which is enough to detect any failure."""
    n = len(C)
    q = lambda p: sum(p[i] * M[i][j] * p[j] for i in range(n) for j in range(n))
    tests = [unit(n, a) for a in range(n)] + [tuple(int(k in (a, b)) for k in range(n)) for a in range(n) for b in range(a + 1, n)]
    for i in range(n):
        for p in tests:
            if q(mutate(C, p, i)) != q(p):
                return i, p
    return None


def string_through(C, mu, i):
    """The positions mu, mu - alpha_i, ..., mu - mu_i alpha_i (mu_i >= 0 required): the string that firing node i
    turns end over end.  In numbers, subtracting alpha_i subtracts column i of C."""
    assert mu[i] >= 0
    return [tuple(mu[j] - k * C[j][i] for j in range(len(C))) for k in range(mu[i] + 1)]


def signed_moves(orb, E, F):
    """For the matrices of `minuscule_matrices`: the list of E_k - F_k + P0_k, where P0_k projects onto the
    positions whose number at node k is zero.  This is exp(E_k) exp(-F_k) exp(E_k), the game move with signs."""
    out = []
    for k in range(len(E)):
        P0 = {(r, r): 1 for r in range(len(orb)) if orb[r][k] == 0}
        out.append(sp_add(sp_add(E[k], F[k], -1), P0))
    return out


def spectral_radius(C, steps=5000, tol=1e-13):
    """Largest eigenvalue of the adjacency matrix A of a board with two-way roads (float; for display).
    Power iteration on M = A + I, which converges also on bipartite boards where iteration on A oscillates:
    start from all ones, x <- M x scaled to length 1, estimate (x . M x) / (x . x); stop when two successive
    estimates differ by less than tol or after `steps` steps; subtract 1.  None for a board with a one-way road."""
    import math
    if board_kind(C) != 'gcm':
        return None
    n = len(C); A = adjacency(C)
    M = [[float(A[i][j]) + (1.0 if i == j else 0.0) for j in range(n)] for i in range(n)]
    x = [1.0 / math.sqrt(n)] * n; last = None
    for _ in range(steps):
        y = [sum(M[i][j] * x[j] for j in range(n)) for i in range(n)]
        est = sum(x[i] * y[i] for i in range(n))
        norm = math.sqrt(sum(v * v for v in y)); x = [v / norm for v in y]
        if last is not None and abs(est - last) < tol:
            break
        last = est
    return est - 1.0


# --------------------------------------------------------------------------------------
# Boards by name; complete catalogue records
# --------------------------------------------------------------------------------------

def board_from_name(name):
    """(Cartan matrix, labels) for every name the site uses:
      'E8', 'B3', ...            finite types, labels 1..n
      'A4~', 'B3~', ...          untwisted affine boards, node 0 first, labels 0..n  ('B2~' is accepted for 'C2~')
      'A2^(2)', 'D4^(3)', ...    twisted affine boards as listed by `affine_candidates`, labels 0..n
      'pentagon', 'square'       the 5-cycle and the 4-cycle, labels 1..n round the cycle"""
    import re
    if name in ('pentagon', 'square'):
        m = 5 if name == 'pentagon' else 4
        return [[2 if i == j else (-1 if (i - j) % m in (1, m - 1) else 0) for j in range(m)] for i in range(m)], list(range(1, m + 1))
    mt = re.fullmatch(r'([A-G])(\d+)(~?)', name)
    if mt:
        C = cartan(mt.group(1), int(mt.group(2)))
        if mt.group(3):
            return affine_extension(C)[0], list(range(len(C) + 1))
        return C, list(range(1, len(C) + 1))
    mt = re.fullmatch(r'[A-E]\d+\^\((2|3)\)', name)
    if mt:
        for m in range(2, 14):
            for nm, M in affine_candidates(m):
                if nm == name:
                    return M, list(range(m))
    raise ValueError('unknown board name: ' + name)


def satake_record(L, n, e):
    """The complete record of one catalogue entry e of `satake_catalogue(L, n)`, with 1-based node labels: the
    catalogue fields, then everything `satake` computes.  This is the record stored in the golden data.
    One adjustment for display: where the tables name the restricted roots C2, the restricted board is named C2
    and its two orbits are listed in the Bourbaki order of C2 (short node first); `satake` alone would say B2."""
    C = cartan(L, n)
    rec = {'dynkin_type': f'{L}{n}', 'cartan_label': e['name'], 'real_form': e['algebra'],
           'black_nodes': [i + 1 for i in e['X']], 'tau': [t + 1 for t in e['tau']],
           'arrows': sorted({tuple(sorted((i + 1, e['tau'][i] + 1))) for i in range(n) if e['tau'][i] != i and i not in e['X']}),
           'tau_moves_black_nodes': any(e['tau'][i] != i for i in e['X']),
           'restricted_type_display': e['et']}
    rec.update(satake(C, e['X'], e['tau']))
    if e['et'] == 'C2':
        assert rec['restricted_board'] == 'B2'
        rec['restricted_board'] = 'C2'
        rec['restricted_orbits_in_bourbaki_order'] = rec['restricted_orbits_in_bourbaki_order'][::-1]
    return rec
