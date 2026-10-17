// RT-13 (red team, reader-playtest), attack 7: the answer of a prediction is readable before the
// reader commits. SPEC 4.0 Predict ("The board is frozen until the reader has answered or pressed
// "show me""), 8.1 P5 ("Ask for a prediction before a reveal"), SPEC 3 M0 beat 2 ("The answer
// -1+1+0=0 is revealed after the reader commits"). For each prediction, at 360 by 800, before any
// answer: (a) no prose paragraph rendered above the question states the answer, (b) the figure's
// visible caption does not state it, (c) no visible output of the frozen tool states it.
// Each entry names the exact phrase that carries the answer on the built page.
import { expect, test, type Page } from '@playwright/test';

interface Leak { route: string; id: string; answer: string; prose?: string; caption?: string; out?: [string, string] }

const LEAKS: Leak[] = [
  { route: 'm0-start', id: 'b2', answer: '0', prose: 'So it holds', caption: 'city 2 is left empty' },
  { route: 'm0-start', id: 'b4', answer: '-1', prose: 'So mutating city', caption: 'from 1 to −1' },
  { route: 'm1-mutation', id: 'b1', answer: '6', prose: 'There are exactly 6' },
  { route: 'm1-mutation', id: 'b5', answer: 'No, every start ends at the same population.', prose: 'It does not depend on it.', caption: 'every start ends at the highest root' },
  { route: 'm2-form', id: 'b1', answer: '2', prose: 'the meter never moves', caption: 'its form value stays at 2' },
  { route: 'm3-classification', id: 'b4', answer: '1', prose: 'In both figures every city is happy.', caption: 'a mutation anywhere changes nothing', out: ['moods', 'a mutation anywhere would change nothing'] },
  { route: 'm3-classification', id: 'b8', answer: 'city 2', prose: 'the centre, would drop', caption: 'a new city joined to the centre' },
  { route: 'm4-numbers', id: 'b2', answer: 'Nothing: the same end after the same number of moves', prose: 'Every order lasts 6 moves', caption: 'every legal play lasts 6 moves' },
  { route: 'm4-numbers', id: 'b6', answer: '3', prose: 'the garden counts 3 positions' },
  { route: 'm4-numbers', id: 'b8', answer: 'Yes', prose: 'Every order of play ends after 14 moves', caption: 'every order of play ends after 14 moves', out: ['fateSentence', 'every legal play ends'] },
  { route: 'm5-weyl', id: 'b9', answer: '4', prose: '4 rounds and 6 moves', caption: '4 rounds to the end' },
];

const norm = (s: string): string => s.replace(/\s+/g, ' ').replace(/[−]/g, '−').trim();

async function visibleTextAbove(page: Page, id: string, phrase: string): Promise<string[]> {
  return page.evaluate(({ id, phrase }) => {
    const tool = document.querySelector(`[data-tool][data-instance="${id}"]`)!;
    const q = tool.querySelector('[data-prediction] .question')!;
    const qTop = q.getBoundingClientRect().top;
    const text = (el: Element): string => {
      const c = el.cloneNode(true) as Element;
      c.querySelectorAll('.katex-mathml, annotation').forEach((x) => x.remove());
      return (c.textContent ?? '').replace(/\s+/g, ' ');
    };
    return [...document.querySelectorAll('article p, article li')]
      .filter((p) => !p.closest('[data-tool]') && !p.closest('details') && p.getBoundingClientRect().top < qTop && p.getBoundingClientRect().height > 0)
      .map(text)
      .filter((t) => t.includes(phrase));
  }, { id, phrase });
}

for (const l of LEAKS) {
  test(`${l.route} ${l.id}: the answer "${l.answer}" is not readable before the reader commits`, async ({ page }) => {
    await page.goto(`modules/${l.route}/`);
    const tool = page.locator(`[data-tool][data-instance="${l.id}"]`);
    await tool.scrollIntoViewIfNeeded();
    await expect(tool).toHaveAttribute('data-hydrated', 'true', { timeout: 30000 });
    await expect(tool.locator('[data-out="predictResult"]')).toHaveText('');
    const problems: string[] = [];
    if (l.prose) {
      const above = await visibleTextAbove(page, l.id, l.prose);
      if (above.length) problems.push(`prose above the question states the answer: "${norm(above[0]).slice(0, 200)}"`);
    }
    if (l.caption) {
      const cap = tool.locator('figcaption[data-out="caption"]');
      if ((await cap.isVisible()) && norm(await cap.innerText()).includes(l.caption)) problems.push(`visible caption states the answer: "${norm(await cap.innerText())}"`);
    }
    if (l.out) {
      const o = tool.locator(`[data-out="${l.out[0]}"]`);
      if ((await o.count()) && (await o.first().isVisible()) && norm(await o.first().innerText()).includes(l.out[1])) problems.push(`visible output ${l.out[0]} states the answer: "${norm(await o.first().innerText())}"`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
