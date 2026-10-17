// P4-A2: the T10 preset data files under site/public/presets/T10/ (SPEC.md 4 T10 "Presets": each at most
// 30 kB after compression [D], so that no default needs the worker; gate G4). Size, completeness,
// determinism (the committed files are the pipeline's output byte for byte) and labels (E-7). The
// mathematical content of the files is tested in presets.test.ts.
//
// These tests need the phase 4 engine functions of P4-A1 and the files written by scripts/presets.mjs;
// until both exist they fail (they are not skipped: COMMON.md 4.4).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { boardFromName } from '@engine';
import { KB, gzipSize } from '../../../scripts/size.mjs';
import {
  MANIFEST_FILE,
  PRESET_CONFIGS,
  PRESET_FIELDS,
  buildManifest,
  computePreset,
  presetFile,
  presetKey,
  presetRings,
  serializeManifest,
  serializePreset,
  type PresetData,
  type PresetManifest,
} from '../../src/components/draw/presetsT10';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = resolve(ROOT, 'site/public/presets/T10');
const read = (file: string): string => readFileSync(resolve(DIR, file), 'utf8');
/** SPEC 4 T10: 30 kB [D], in the unit of scripts/size.mjs (1 kB = 1000 bytes). */
const LIMIT = 30 * KB;

const manifest = (): PresetManifest => JSON.parse(read(MANIFEST_FILE)) as PresetManifest;
const fileOf = (key: string): PresetData => JSON.parse(read(presetFile(key))) as PresetData;

describe('T10 preset files: size, completeness, determinism, labels', () => {
  it('every preset file and the manifest gzip to at most 30 kB', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
    expect(files).toContain(MANIFEST_FILE);
    expect(files).toHaveLength(PRESET_CONFIGS.length + 1);
    for (const f of files) {
      const gz = gzipSize(readFileSync(resolve(DIR, f)));
      expect(gz, f).toBeGreaterThan(0);
      expect(gz, f).toBeLessThanOrEqual(LIMIT);
    }
  });

  it('the manifest lists exactly the files on disk with their counts', () => {
    const m = manifest();
    expect(Object.keys(m)).toEqual(['schema', 'tool', 'files']);
    expect(m.schema).toBe(1);
    expect(m.tool).toBe('geometry');
    // In the order of PRESET_CONFIGS, one entry per configuration, bare file names (BASE_URL is prefixed by T10).
    expect(m.files.map((f) => f.key)).toEqual(PRESET_CONFIGS.map(presetKey));
    const onDisk = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== MANIFEST_FILE).sort();
    expect(m.files.map((f) => f.file).sort()).toEqual(onDisk);
    for (const entry of m.files) {
      expect(Object.keys(entry)).toEqual(['key', 'board', 'rings', 'presets', 'file', 'counts']);
      expect(entry.file).toBe(presetFile(entry.key));
      expect(entry.file).not.toMatch(/^\/|\//);
      const data = fileOf(entry.key);
      expect(entry.counts).toEqual(data.counts);
      expect(entry.board).toBe(data.board);
      expect(entry.rings).toEqual(data.rings);
      expect(entry.presets).toEqual(data.presets);
    }
    // Every preset id of CONTRACTS.md 6 for T10 is served by exactly one file.
    const ids = m.files.flatMap((f) => f.presets);
    expect(new Set(ids)).toEqual(new Set(['root-polytope', 'rings', 'face-table', 'two-graphs', 'make-uniform', 'showpiece', 'coxeter-plane']));
    for (const id of ['rings', 'face-table', 'two-graphs', 'make-uniform', 'showpiece', 'coxeter-plane']) {
      expect(ids.filter((x) => x === id), id).toHaveLength(1);
    }
  });

  it('every file has the schema keys in order and nothing else', () => {
    for (const config of PRESET_CONFIGS) {
      const key = presetKey(config);
      const data = fileOf(key);
      expect(Object.keys(data), key).toEqual([...PRESET_FIELDS]);
      expect(data.schema).toBe(1);
      expect(data.tool).toBe('geometry');
      expect(data.key).toBe(key);
      expect(data.edgesEnumerated).toBe(true);
      expect(Object.keys(data.counts)).toEqual(['vertices', 'edges', 'moveEdges']);
      expect(Object.keys(data.tree)).toEqual(['parent', 'node']);
      expect(data.vertices).toHaveLength(data.counts.vertices);
      expect(data.adjacency).toHaveLength(data.counts.vertices);
      expect(data.moveAdjacency).toHaveLength(data.counts.vertices);
      expect(data.tree.parent).toHaveLength(data.counts.vertices);
      expect(data.tree.node).toHaveLength(data.counts.vertices);
      expect(data.adjacency.reduce((s, l) => s + l.length, 0)).toBe(data.counts.edges);
      expect(data.moveAdjacency.reduce((s, l) => s + l.length, 0)).toBe(data.counts.moveEdges);
      for (const lists of [data.adjacency, data.moveAdjacency]) {
        lists.forEach((l, i) => {
          for (let k = 0; k < l.length; k++) {
            expect(l[k]!).toBeGreaterThan(i);
            expect(l[k]!).toBeLessThan(data.counts.vertices);
            if (k > 0) expect(l[k]!).toBeGreaterThan(l[k - 1]!);
          }
        });
      }
      for (const x of data.fVector) expect(typeof x === 'number' ? Number.isSafeInteger(x) : /^\d+$/.test(x)).toBe(true);
      // The start comes first: the rings themselves.
      expect(data.vertices[0]).toEqual(data.rings);
      // Numbers only: the strings of a file are its identifiers and decimal digits, no polytope name, no sentence.
      const strings: string[] = [];
      const walk = (x: unknown): void => {
        if (typeof x === 'string') strings.push(x);
        else if (Array.isArray(x)) x.forEach(walk);
        else if (x !== null && typeof x === 'object') Object.values(x).forEach(walk);
      };
      walk(data);
      const allowed = new Set<string>(['geometry', key, config.board, ...config.presets]);
      for (const s of strings) expect(allowed.has(s) || /^\d+$/.test(s), `${key}: ${s}`).toBe(true);
    }
  });

  it('committed files equal the pipeline output byte for byte', () => {
    const computed = PRESET_CONFIGS.map((c) => computePreset(c));
    computed.forEach((data, k) => {
      const text = serializePreset(data);
      expect(text.endsWith('}\n')).toBe(true);
      expect(text).not.toMatch(/\s(?!$)/);
      expect(read(presetFile(presetKey(PRESET_CONFIGS[k]!))), data.key).toBe(text);
    });
    expect(read(MANIFEST_FILE)).toBe(serializeManifest(buildManifest(computed)));
  });

  it('node lists in the files are labels', () => {
    const m = manifest();
    for (const config of PRESET_CONFIGS) {
      const key = presetKey(config);
      const data = fileOf(key);
      const board = boardFromName(config.board);
      expect(data.tree.parent[0]).toBeNull();
      expect(data.tree.node[0]).toBeNull();
      for (let i = 1; i < data.tree.node.length; i++) {
        const label = data.tree.node[i]!;
        expect(board.labels, `${key} node ${i}`).toContain(label);
        expect(data.tree.parent[i]!).toBeLessThan(i);
      }
      expect(data.rings).toEqual(presetRings(config));
      expect(m.files.find((f) => f.key === key)!.rings).toEqual(data.rings);
    }
    // E8 from the highest root: the first move fires the only ringed node, whose label is 8 (position 7).
    const e8 = PRESET_CONFIGS.find((c) => c.board === 'E8')!;
    const data = fileOf(presetKey(e8));
    const ringed = data.rings.flatMap((r, p) => (r > 0 ? [boardFromName('E8').labels[p]!] : []));
    expect(ringed).toEqual([8]);
    expect(data.tree.node[1]).toBe(8);
    expect(data.tree.parent[1]).toBe(0);
  });
});
