// RT-04 finding P3-RT-04-03: on T5 (/tools/numbers and every T5 instance), a link whose `d` parses but
// is not a lambda the calculator takes (a negative entry, or more than 6 digits) is applied in part:
// the link's board, start and moves are shown, lambda goes back to a default, and the notice "The link
// could not be read, so the tool shows its default state." is shown although the tool does not show its
// default state. SPEC 6.6 Validation: a failure "makes the instance load its default state and show a
// notice"; a value that is not a failure is applied with no notice. t05/link.ts admitLink().
// Run: npx vitest run --project site-unit site/tests/unit/redteam-RT-04-t05-lambda.test.ts
import { describe, expect, it } from 'vitest';
import { decodeState, LINK_NOTICE } from '../../src/lib/urlCodec';
import { type ToolState } from '../../src/lib/state';
import { admitLink } from '../../src/components/tools/t05/link';
import T05 from '../../src/tools/registry/T05';

const { caption: _c, ...fields } = T05.presets.default;
const D = { schema: 1, tool: 'numbers', ...fields } as ToolState;

describe('P3-RT-04-03: T5 shows the notice of a default state over a link it applied', () => {
  for (const q of ['g=E8&c=n&s=1,1,1,1,1,1,1,1&w=1&d=1000000,0,0,0,0,0,0,0', 'g=E8&c=n&s=1,1,1,1,1,1,1,1&w=1&d=-1,0,0,0,0,0,0,0']) {
    it(q, () => {
      const decoded = decodeState(q, 'numbers', D);
      expect(decoded.notice).toBeNull(); // the codec accepts d (6.6: "one integer per node")
      const r = admitLink(decoded.state, decoded.notice, D);
      // Either the whole link is applied with no notice, or the notice comes with the default state.
      if (r.notice !== null) {
        expect(r.notice).toBe(LINK_NOTICE);
        expect(r.state).toEqual(D);
      }
    });
  }
});
