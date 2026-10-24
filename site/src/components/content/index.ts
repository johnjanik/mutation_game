// The content components of SPEC.md 7.3, imported by lessons as
// `import { G, Tex, Unverified, Cite } from '@components/content'` (CONTRACTS.md 7).
// Build-time Astro components only; never import this barrel from a .svelte file.
export { default as G } from './G.astro';
export { default as Unverified } from './Unverified.astro';
export { default as Cite } from './Cite.astro';
export { default as Tex } from '../math/Tex.astro';
// The name of a view in prose, with its icon and accent underline (SPEC.md 8.3; RT-FIX-P4 lesson M7).
export { default as View } from './View.astro';
