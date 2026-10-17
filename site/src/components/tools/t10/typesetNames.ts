// T10, the Geometry Studio: the typeset board names of site/src/generated/names.json (SPEC.md 7.3: "Names with
// a fixed spelling ... are typeset once at build time: scripts/names.mjs writes the KaTeX markup of every
// name ... and the tools that show names ... look them up there"). Owner P4-A3. The file is written at the
// start of every build and is not committed; import.meta.glob gives an empty object where it is absent (the
// unit tests and the type check run before any build in CI). Imported in-process during server rendering
// (snapshot.ts) and lazily in the browser (names.ts says when).
import type { NameLookup } from './names';

const files = import.meta.glob<{ names: Record<string, { text: string; tex: string; html: string }> }>('../../../generated/names.json', {
  eager: true,
  import: 'default',
});

/** name -> { html }: KaTeX's markup with MathML; empty when names.json does not exist. */
export const KATEX_NAMES: NonNullable<NameLookup> = Object.values(files)[0]?.names ?? {};
