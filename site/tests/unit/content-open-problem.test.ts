// The open-problem page (site/src/content/pages/open-problem.mdx), read as source. Adopted from the
// RT-08 reproducers of red-team round 1 for the part of each finding that lies on this page; the
// parts of the same findings that lie in lesson files are checked beside those lessons.
//
// RT-08 (content rules), attack 16: "verified by computation" with a range wider than the check.
// SPEC.md 0.3, [V]: "checked by reference/verify.py ... the range of boards checked is stated with the
// claim or is "every type of rank at most 8"". The check behind the sign statement is run on the
// named types of rank at most 8 (SPEC 2.11: "Checked by the script for every finite type ..."; the
// finite types of the script: rank at most 8).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('open-problem page', () => {
  // regression: P3-RT-08-01
  it('open-problem: the computed check is not stated for every board of finite type', () => {
    const op = readFileSync(fileURLToPath(new URL('../../src/content/pages/open-problem.mdx', import.meta.url)), 'utf8');
    // SPEC 2.11: "Checked by the script for every finite type, for the first 2500 or so root populations of
    // every untwisted affine board of rank at most 8 ..." (the finite types of the script: rank at most 8).
    expect(op, 'open-problem.mdx').not.toMatch(/checked the statement by computation: on every board of finite type;/);
  });
});
