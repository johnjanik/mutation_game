import { boardFromName } from '@engine';
import { renderTex } from '@lib/katex';
import { it, expect } from 'vitest';
it('aliases resolve', () => { expect(boardFromName('A2').n).toBe(2); expect(renderTex('x', false)).toContain('<math'); });
