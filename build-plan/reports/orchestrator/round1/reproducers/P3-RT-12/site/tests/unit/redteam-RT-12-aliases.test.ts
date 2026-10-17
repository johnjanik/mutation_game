// RT-12 attack 44 (iii): each path alias of CONTRACTS.md 1 resolves, under `npm test`, to the same
// module instance as a relative import of the source file (one copy, not a stale second one), and
// the workspace package name resolves to the same engine.
import { describe, it, expect } from 'vitest';
import * as viaEngineAlias from '@engine';
import * as viaEnginePackage from '@two-games/engine';
import * as engineRelative from '../../../packages/engine/src/index.ts';
import * as viaLibAlias from '@lib/katex';
import * as libRelative from '../../src/lib/katex.ts';
import * as viaComponentsAlias from '@components/board/keyboard';
import * as componentsRelative from '../../src/components/board/keyboard.ts';

describe('RT-12 path aliases resolve to one module instance', () => {
  it('@engine and @two-games/engine are the engine source', () => {
    expect(viaEngineAlias.boardFromName).toBe(engineRelative.boardFromName);
    expect(viaEnginePackage.boardFromName).toBe(engineRelative.boardFromName);
  });
  it('@lib/* is site/src/lib/*', () => {
    expect(viaLibAlias.renderTex).toBe(libRelative.renderTex);
  });
  it('@components/* is site/src/components/*', () => {
    expect(viaComponentsAlias.arrowTarget).toBe(componentsRelative.arrowTarget);
  });
});
