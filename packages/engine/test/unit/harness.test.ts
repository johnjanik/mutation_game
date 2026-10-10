// Self-checks of the golden harness (CONTRACTS.md 3), and the three phase-0 deliverables no other
// test exercises: CAPS (CONTRACTS.md 2.3), the error classes (E-10) and the public API of index.ts.
// This file registers no golden key.
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as api from '@two-games/engine';
import type {
  Admissibility,
  AnyBoard,
  Arith,
  Board,
  Choose,
  Game,
  Matrix,
  Reason,
  Vec,
  Word,
} from '@two-games/engine';
import {
  GOLDEN_FILE,
  GOLDEN_KEYS_BY_PHASE,
  TYPE_NAMES,
  golden,
  intEq,
  matchRecord,
  ratText,
  ringsEq,
  sortedPositiveRoots,
  verifyGoldenHash,
} from '../golden/_harness';

// the em-dash (U+2014), forbidden by COMMON.md 4.4 in everything the team writes
const EM_DASH = new RegExp(String.fromCharCode(0x2014));

describe('comparison helpers', () => {
  it('intEq accepts equal integers, bigint against decimal strings and bigint against numbers', () => {
    expect(() => intEq([1n, 2n], ['1', '2'])).not.toThrow();
    expect(() => intEq([[2, -1], [-1, 2]], [[2, -1], [-1, 2]])).not.toThrow();
    expect(() => intEq(5n, 5)).not.toThrow();
    expect(() => intEq(-7, '-7')).not.toThrow();
  });

  it('intEq rejects a length mismatch, unequal numbers, a wrong decimal text and a non-integer', () => {
    expect(() => intEq([1], [1, 2])).toThrow(/length/);
    expect(() => intEq(2, 3)).toThrow(/2 !== 3/);
    expect(() => intEq(1n, '2')).toThrow(/1n/);
    expect(() => intEq(0.5, 0.5)).toThrow(/safe integer/);
    expect(() => intEq(2, [2])).toThrow(/expected an array/);
    expect(() => intEq([2], 2)).toThrow(/got an array/);
    expect(() => intEq([[1, 2]], [[1, 3]], 'matrix')).toThrow(/matrix: intEq failed at \[0\]\[1\]/);
  });

  it('ratText prints p/q or p', () => {
    expect(ratText({ num: 3n, den: 1n })).toBe('3');
    expect(ratText({ num: -1n, den: 2n })).toBe('-1/2');
  });

  it('ringsEq accepts radii within 1e-5 and rejects a different count or order', () => {
    expect(() => ringsEq([[1.414214, 4], [2.0, 4]], [[1.414215, 4], [2.000001, 4]])).not.toThrow();
    expect(() => ringsEq([[1.414214, 4], [2.0, 4]], [[1.414214, 3], [2.0, 4]])).toThrow(/points/);
    expect(() => ringsEq([[2.0, 4], [1.414214, 4]], [[1.414214, 4], [2.0, 4]])).toThrow(/radius/);
    expect(() => ringsEq([[1.0, 4]], [[1.0, 4], [2.0, 4]])).toThrow(/rings/);
    expect(() => ringsEq([[1.0, 4]], [[1.0001, 4]])).toThrow(/radius/);
  });

  it('matchRecord returns the one match and throws on zero or two', () => {
    const list = [
      { type: 'A2', rings: [1, 0], v: 1 },
      { type: 'A2', rings: [0, 1], v: 2 },
      { type: 'B2', rings: [1, 0], v: 3 },
    ];
    expect(matchRecord(list, { type: 'A2', rings: [0, 1] }).v).toBe(2);
    expect(() => matchRecord(list, { type: 'G2' })).toThrow(/0 records/);
    expect(() => matchRecord(list, { type: 'A2' })).toThrow(/2 records/);
  });

  it('sortedPositiveRoots sorts by total, then lexicographically, and copies', () => {
    const input = [[1, 1], [0, 1], [1, 0]];
    expect(sortedPositiveRoots(input)).toEqual([[0, 1], [1, 0], [1, 1]]);
    expect(input).toEqual([[1, 1], [0, 1], [1, 0]]);
    expect(sortedPositiveRoots([[2, 0, 0], [0, 1, 1], [1, 0, 1]])).toEqual([[0, 1, 1], [1, 0, 1], [2, 0, 0]]);
  });
});

describe('TYPE_NAMES', () => {
  it('is the 32 keys of golden.types in file order', () => {
    expect(TYPE_NAMES.length).toBe(32);
    expect(TYPE_NAMES[0]).toBe('A1');
    expect(TYPE_NAMES[31]).toBe('G2');
    expect([...TYPE_NAMES]).toEqual(Object.keys(golden.types));
  });
});

describe('GOLDEN_KEYS_BY_PHASE spellings resolve', () => {
  const asRecords = (v: unknown): object[] => {
    if (Array.isArray(v)) return v.filter((x) => x !== null && typeof x === 'object') as object[];
    if (v !== null && typeof v === 'object') {
      return Object.values(v as Record<string, unknown>).filter((x) => x !== null && typeof x === 'object') as object[];
    }
    return [];
  };
  const top = golden as unknown as Record<string, unknown>;
  const phases = Object.keys(GOLDEN_KEYS_BY_PHASE);

  it('names eight phases, 0 to 7, and phase 0 is exactly the two type fields', () => {
    expect(phases).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect(GOLDEN_KEYS_BY_PHASE[0]).toEqual(['types[*].cartan', 'types[*].adjacency']);
  });

  for (const phase of phases) {
    for (const key of GOLDEN_KEYS_BY_PHASE[Number(phase) as keyof typeof GOLDEN_KEYS_BY_PHASE]) {
      it(`phase ${phase}: ${key}`, () => {
        const star = key.match(/^([a-z_0-9]+)\[\*\]\.([a-z_0-9]+)$/);
        const dot = key.match(/^([a-z_0-9]+)\.([a-z_0-9]+)$/);
        const plain = key.match(/^([a-z_0-9]+)$/);
        if (star) {
          const [, topKey, field] = star;
          expect(top).toHaveProperty(topKey!);
          const records = asRecords(top[topKey!]);
          expect(records.length).toBeGreaterThan(0);
          expect(records.some((r) => field! in r)).toBe(true);
        } else if (dot) {
          const [, topKey, field] = dot;
          expect(top).toHaveProperty(topKey!);
          expect(top[topKey!]).toHaveProperty(field!);
        } else {
          expect(plain).not.toBeNull();
          expect(top).toHaveProperty(key);
        }
      });
    }
  }

  it('assigns each key to one phase only', () => {
    const all = phases.flatMap((p) => GOLDEN_KEYS_BY_PHASE[Number(p) as keyof typeof GOLDEN_KEYS_BY_PHASE]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('hash guard', () => {
  it('accepts the reference file', () => {
    expect(() => verifyGoldenHash()).not.toThrow();
    expect(() => verifyGoldenHash(fileURLToPath(GOLDEN_FILE))).not.toThrow();
  });

  it('rejects a changed file', () => {
    const bytes = readFileSync(GOLDEN_FILE);
    const changed = Buffer.from(bytes);
    // flip one byte inside the file, keeping the length
    const at = Math.floor(changed.length / 2);
    changed[at] = changed[at]! === 0x20 ? 0x21 : 0x20;
    const dir = mkdtempSync(join(tmpdir(), 'golden-hash-'));
    const copy = join(dir, 'golden_data.json');
    writeFileSync(copy, changed);
    expect(() => verifyGoldenHash(copy)).toThrow(/golden_data\.json has SHA-256 .* not the recorded/);
  });
});

describe('no runtime dependency', () => {
  it('packages/engine/package.json has dependencies equal to {}', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      dependencies?: unknown;
    };
    expect(pkg.dependencies).toEqual({});
  });
});

describe('src imports only src', () => {
  const srcDir = fileURLToPath(new URL('../../src/', import.meta.url));
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
  it('has the phase-0 modules', () => {
    for (const f of ['arith.ts', 'errors.ts', 'caps.ts', 'board.ts', 'moves.ts', 'index.ts']) {
      expect(files).toContain(f);
    }
  });
  for (const f of files) {
    it(`${f} imports only ./ modules that exist in src`, () => {
      const text = readFileSync(join(srcDir, f), 'utf8');
      const specifiers = [...text.matchAll(/\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
      const bare = [...text.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]!);
      for (const s of [...specifiers, ...bare]) {
        expect(s.startsWith('./')).toBe(true);
        const target = s.replace(/\.js$/, '') + '.ts';
        expect(files).toContain(target.slice(2));
      }
      expect(text).not.toMatch(/\bconsole\.log\b/);
      expect(text).not.toMatch(/\bMath\.random\b/);
      expect(text).not.toMatch(/\bnew Date\b/);
      expect(text).not.toMatch(EM_DASH);
    });
  }
});

describe('CAPS equals CONTRACTS 2.3', () => {
  it('holds exactly the 20 numbers', () => {
    // the literal of CONTRACTS.md 2.3 (a plan contract, not a golden value)
    const expected = {
      customNodes: 12, roadsEachWay: 4, layersOffFinite: 40, mainThreadItems: 2000, gardenPositions: 2000,
      gardenDrawEverything: 300, workerPositions: 100000, playMoves: 20000, linkMoves: 20000,
      verticesDrawn: 20000, edgesAtRest: 70000, edgesTurning: 8000, weylExplorerGroup: 1152,
      countGamesGroup: 60000, rootTestSteps: 20000, formFinderDigits: 6, repOrbit: 2000, matrixGridDim: 27,
      relabellingsDefault: 10000, legalLayersDefault: 100000,
    };
    expect(api.CAPS).toEqual(expected);
    expect(Object.keys(api.CAPS).length).toBe(20);
    expect(api.CAPS.edgesAtRest).toBe(70000);
    expect(api.CAPS.countGamesGroup).toBe(60000);
    expect(api.CAPS.customNodes).toBe(12);
    expect(api.CAPS.matrixGridDim).toBe(27);
    expect(api.CAPS.legalLayersDefault).toBe(100000);
  });
});

describe('error classes', () => {
  const admissibility: Admissibility = {
    symmetry: true,
    condition_1: false,
    condition_2: true,
    condition_3: true,
    admissible: false,
    reasons: { condition_1: { code: 'moves-black-set', nodes: [0, 2] } },
  };
  const instances: [string, api.EngineError][] = [
    ['NotABoard', new api.NotABoard()],
    ['NeedsTwoWayRoads', new api.NeedsTwoWayRoads()],
    ['NeedsConnectedBoard', new api.NeedsConnectedBoard()],
    ['NotFiniteType', new api.NotFiniteType()],
    ['NotAffine', new api.NotAffine('finite')],
    ['NotAdmissible', new api.NotAdmissible(admissibility)],
    ['EngineOverflow', new api.EngineOverflow()],
  ];
  const classes = {
    NotABoard: api.NotABoard,
    NeedsTwoWayRoads: api.NeedsTwoWayRoads,
    NeedsConnectedBoard: api.NeedsConnectedBoard,
    NotFiniteType: api.NotFiniteType,
    NotAffine: api.NotAffine,
    NotAdmissible: api.NotAdmissible,
    EngineOverflow: api.EngineOverflow,
  };

  for (const [name, e] of instances) {
    it(`${name} extends EngineError and Error and is named after its class`, () => {
      expect(e).toBeInstanceOf(classes[name as keyof typeof classes]);
      expect(e).toBeInstanceOf(api.EngineError);
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe(name);
      expect(typeof e.message).toBe('string');
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.message).not.toMatch(EM_DASH);
    });
  }

  it('the classes are distinct', () => {
    expect(new api.NotABoard()).not.toBeInstanceOf(api.EngineOverflow);
    expect(new api.EngineError('x').name).toBe('EngineError');
  });

  it('NotAffine carries the class in its message and in data', () => {
    const e = new api.NotAffine('finite');
    expect(e.message).toContain('finite');
    expect(e.data).toEqual({ class: 'finite' });
    expect(new api.NotAffine('indefinite').message).toContain('indefinite');
    expect(new api.NotAffine('indefinite').data).toEqual({ class: 'indefinite' });
  });

  it('NotAdmissible carries the Admissibility record as data', () => {
    const e = new api.NotAdmissible(admissibility);
    expect(e.data).toBe(admissibility);
    const reason: Reason = e.data.reasons['condition_1']!;
    expect(reason.code).toBe('moves-black-set');
  });
});

describe('public API from the package root', () => {
  it('has every runtime name of the instruction, section 5.7', () => {
    const names = [
      'SafeInt', 'Big',
      'EngineError', 'NotABoard', 'NeedsTwoWayRoads', 'NeedsConnectedBoard', 'NotFiniteType', 'NotAffine',
      'NotAdmissible', 'EngineOverflow',
      'CAPS',
      'cartan', 'boardFromName', 'fromAdjacency', 'adjacency', 'boardKind', 'toLabels', 'toPositions', 'cartanNumbers',
      'mutate', 'fire',
    ] as const;
    for (const n of names) {
      expect(api, n).toHaveProperty(n);
      expect((api as Record<string, unknown>)[n]).toBeDefined();
    }
    expect(Object.keys(api).sort()).toEqual([...names].sort());
  });

  it('exports the type-only names (checked by tsc on this file)', () => {
    // The imports of Arith, Vec, Matrix, Admissibility, Reason, Board, AnyBoard, Word, Game, Choose above
    // fail `tsc --noEmit` if any is missing; here they are used so that the imports are not unused.
    const arith: Arith<number> = api.SafeInt;
    const v: Vec<number> = [1, 2];
    const m: Matrix<number> = [[2]];
    const word: Word = [0];
    const game: Game = 'mutation';
    const choose: Choose<number> = (allowed) => allowed[0]!;
    const board: Board<number> = { n: 1, cartan: m, labels: [1], kind: 'gcm', arith };
    const any: AnyBoard = board;
    expect(arith.add(v[0]!, v[1]!)).toBe(3);
    expect(choose(word, v)).toBe(0);
    expect(game).toBe('mutation');
    expect(any.n).toBe(1);
  });
});
