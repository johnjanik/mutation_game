// The benchmark of SPEC.md 7.6 (CONTRACTS.md 3), run alone by `npm run bench -w packages/engine`
// (MERGE, stage 3.1, on the request of P3-A2): a plain object, so that nothing is resolved from
// this directory; the file is kept out of `npm test` because timing under the parallel suite is noisy.
export default { test: { name: 'engine-bench', include: ['test/bench/**/*.bench.ts'], fileParallelism: false } };
