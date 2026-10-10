// P0-A6: the scripts of scripts/ other than size.mjs (SPEC.md 5.7, 7.6, 7.7), the root package.json
// command bodies, and the decisions fragment.
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  assertOutsideReference,
  compareBytes,
  compareParsed,
  failureLines,
  parseSummary,
  REFERENCE_DIR,
} from '../../../scripts/verify.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'scripts-test-'));
  temps.push(d);
  return d;
}
afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe('verify.mjs', () => {
  it('verify: summary line is parsed', () => {
    const out = 'progress\n  ok\n\n6649 checks passed, 0 failed, 134.6s; wrote /tmp/x.json\n';
    expect(parseSummary(out)).toEqual({ line: '6649 checks passed, 0 failed, 134.6s; wrote /tmp/x.json', passed: 6649, failed: 0, seconds: 134.6 });
    expect(parseSummary('=== 1. boards ===\n  ok\nTraceback (most recent call last):\n')).toBeNull();
    expect(parseSummary('')).toBeNull();
    const failed = '  FAIL: some check detail\n\n6648 checks passed, 1 failed, 130.0s; wrote /tmp/y.json\nFAILED:\n  - some check\n';
    expect(parseSummary(failed)?.failed).toBe(1);
    expect(failureLines(failed)).toEqual(['  FAIL: some check detail', 'FAILED:', '  - some check']);
  });

  it('verify: equal files compare equal as bytes', () => {
    const d = tempDir();
    writeFileSync(join(d, 'a.json'), '{"a": [1, 2], "b": "9007199254740993"}');
    writeFileSync(join(d, 'b.json'), '{"a": [1, 2], "b": "9007199254740993"}');
    expect(compareBytes(join(d, 'a.json'), join(d, 'b.json'))).toEqual({ equal: true, sizeA: 38, sizeB: 38 });
  });

  it('verify: byte-different but parsed-equal files are reported as such', () => {
    const d = tempDir();
    writeFileSync(join(d, 'a.json'), '{\n "a": [1, 2]\n}');
    writeFileSync(join(d, 'b.json'), '{\n "a": [1, 2]\n}\n');
    const bytes = compareBytes(join(d, 'a.json'), join(d, 'b.json'));
    expect(bytes.equal).toBe(false);
    expect(bytes.sizeB).toBe(bytes.sizeA + 1);
    expect(compareParsed(join(d, 'a.json'), join(d, 'b.json'))).toEqual({ equal: true, paths: [] });
  });

  it('verify: parsed-different files name the differing paths, with exact integers', () => {
    const d = tempDir();
    // 2^53 + 1 and 2^53 are equal after JSON.parse in Node but not in Python
    writeFileSync(join(d, 'a.json'), '{"x": {"n": 9007199254740993, "l": [1, 2, 3]}, "y": 1}');
    writeFileSync(join(d, 'b.json'), '{"x": {"n": 9007199254740992, "l": [1, 2]}, "z": 1}');
    const r = compareParsed(join(d, 'a.json'), join(d, 'b.json'));
    expect(r.equal).toBe(false);
    expect(r.paths).toEqual(['.x.n', '.x.l (length 3 against 2)', '.y', '.z']);
  });

  it('verify: an output path under reference/ is refused', () => {
    expect(REFERENCE_DIR).toBe(join(ROOT, 'reference'));
    expect(() => assertOutsideReference(join(ROOT, 'reference', 'golden_data.json'))).toThrow(/read-only/);
    expect(() => assertOutsideReference(join(ROOT, 'reference', 'sub', '..', 'x.json'))).toThrow(/read-only/);
    expect(() => assertOutsideReference(join(ROOT, 'reference'))).toThrow(/read-only/);
    expect(() => assertOutsideReference(join(tmpdir(), 'golden-verify-x', 'golden_regen.json'))).not.toThrow();
    expect(() => assertOutsideReference(join(ROOT, 'reference-copy', 'x.json'))).not.toThrow();
  });
});
