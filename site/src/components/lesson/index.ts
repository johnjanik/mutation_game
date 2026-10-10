// The lesson components of CONTRACTS.md 7 (P1-A4), imported by lessons as
// `import { Beat, Seen, LieTheory, Challenge, ModuleLinks, Sources, DraftMark } from '@components/lesson'`.
// Challenge is a Svelte island (the lesson adds client:visible); the others are build-time Astro
// components. The `*.astro` module declaration of components/content/astro-modules.d.ts lets
// svelte-check type these re-exports. Never import this barrel from a .svelte file.
export { default as Beat } from './Beat.astro';
export { default as Seen } from './Seen.astro';
export { default as LieTheory } from './LieTheory.astro';
export { default as Challenge } from './Challenge.svelte';
export { default as ModuleLinks } from './ModuleLinks.astro';
export { default as Sources } from './Sources.astro';
export { default as DraftMark } from './DraftMark.astro';
