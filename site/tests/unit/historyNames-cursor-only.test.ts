// RT-FIX P3-RT-07-01: the history strip's names cost the same however long the play (SPEC 7.4 "Single
// source of truth", 7.6 "Main-thread work", 4.0 History). History.svelte reads every position's name
// only while it shows one button per position (at most 50); above that it is a slider that reads the
// cursor's name alone. Every tool that renders History derives its names through historyNames, so a
// move names at most 50 positions. The browser regression on T1 is in site/tests/e2e/T01.spec.ts.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRIP_BUTTONS_MAX, historyNames } from '../../src/components/board/historyNames';

const COMPONENTS = fileURLToPath(new URL('../../src/components/', import.meta.url));

function svelteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...svelteFiles(path));
    else if (name.endsWith('.svelte')) out.push(path);
  }
  return out;
}

describe('regressions', () => {
  // regression: P3-RT-07-01
  it('names only the cursor above 50 positions, whatever the length of the play', () => {
    for (const [total, cursor] of [
      [50, 50],
      [1999, 1999],
      [20000, 20000],
      [20000, 0],
      [20000, 12345],
    ] as const) {
      const asked: number[] = [];
      const names = historyNames(total, cursor, (k) => {
        asked.push(k);
        return `name ${k}`;
      });
      expect(asked).toEqual([cursor]);
      expect(names).toHaveLength(total + 1);
      expect(names[cursor]).toBe(`name ${cursor}`);
    }
  });

  // regression: P3-RT-07-01
  it('names every position while the strip shows a button per position', () => {
    expect(STRIP_BUTTONS_MAX).toBe(50);
    for (const total of [0, 1, 12, 49]) {
      const asked: number[] = [];
      const names = historyNames(total, Math.min(total, 3), (k) => {
        asked.push(k);
        return `name ${k}`;
      });
      expect(asked).toEqual(Array.from({ length: total + 1 }, (_, k) => k));
      expect(names).toEqual(Array.from({ length: total + 1 }, (_, k) => `name ${k}`));
    }
  });

  // regression: P3-RT-07-01
  it('every component that renders History derives its positionNames through historyNames', () => {
    const users = svelteFiles(COMPONENTS).filter((f) => /<History\b/.test(readFileSync(f, 'utf8')));
    // T1, T3, T5, T6, T7, T8, T9, T11, T15, T16 and the phase-0 BoardSeed at least.
    expect(users.length).toBeGreaterThanOrEqual(11);
    for (const file of users) {
      const src = readFileSync(file, 'utf8');
      const at = src.indexOf('const positionNames = $derived');
      expect(at, relative(COMPONENTS, file)).toBeGreaterThanOrEqual(0);
      // the derivation, up to its closing line (`  });` for $derived.by, `  );` for $derived)
      const ends = ['\n  });', '\n  );'].map((s) => src.indexOf(s, at)).filter((i) => i > at);
      const body = src.slice(at, Math.min(...ends));
      expect(body, relative(COMPONENTS, file)).toContain('historyNames(');
      expect(body, relative(COMPONENTS, file)).not.toMatch(/for \(let k = 0; k <=|Array\.from\(\{ length:|positions\.map\(/);
    }
  });
});
