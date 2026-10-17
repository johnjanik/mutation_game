// Client entry of the ToolFrame hydration fixture (toolframe-hydration.spec.ts): hydrates the server
// HTML of FixtureTool inside #app with the props written on it, as an Astro island would.
import { hydrate } from 'svelte';
import FixtureTool from './FixtureTool.svelte';

const target = document.getElementById('app');
if (target) {
  const props = JSON.parse(target.dataset.props ?? '{}') as Record<string, unknown>;
  hydrate(FixtureTool, { target, props: props as never });
}
