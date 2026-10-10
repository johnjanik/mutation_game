/// <reference types="astro/client" />

// Environment variables the site reads.
// At configuration time (site/astro.config.mjs, in Node, through process.env):
//   SITE_URL   the public address of the site (SPEC.md 7.2 item 10)
//   BASE_PATH  the base path, for example /mutation_game/ (SPEC.md 7.2 item 10)
//   OUT_DIR    an alternative output directory (CONTRACTS.md 1)
// At build time (components, through process.env or import.meta.env):
//   RELEASE    set to 1 for a release build; read by <Unverified> (SPEC.md 7.3)
// Pages build every link from import.meta.env.BASE_URL, never from BASE_PATH.
