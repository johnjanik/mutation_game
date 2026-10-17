// P0-A4: the barrel index.ts re-exports .astro components from TypeScript. `astro check` types
// those imports from the components themselves; svelte-check (the second half of `npm run check`)
// type-checks .ts files with plain TypeScript, which has no declaration for *.astro modules in
// Astro 7.3.8. This fallback declaration lets it do so; a module that resolves to a real .astro
// file under astro check keeps its own, more precise type.
declare module '*.astro' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
  const component: AstroComponentFactory;
  export default component;
}
