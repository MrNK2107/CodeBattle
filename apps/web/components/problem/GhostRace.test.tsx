import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Ghost } from '@/lib/ghost';

import { GhostOffer, GhostRace } from './GhostRace';

const ghost = (over: Partial<Ghost> = {}): Ghost => ({
  id: 'g1',
  username: 'ada',
  rating: 1342,
  frames: [
    { t: 5_000, code: 'def f():\n', language: 'python' },
    { t: 60_000, code: 'def f():\n    return 1\n', language: 'python', submitted: true },
  ],
  submitAtMs: 61_000,
  verdict: 'ACCEPTED',
  passed: 12,
  total: 12,
  language: 'python',
  recordedAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

const noop = () => undefined;

describe('GhostRace', () => {
  it('before the start: offers Start and shows when the ghost finished, not its code', () => {
    const html = renderToStaticMarkup(
      <GhostRace slug="two-sum" ghost={ghost()} others={[ghost()]} startedAt={null} solvedAtMs={null} onStart={noop} onReset={noop} />,
    );
    expect(html).toContain('Start race');
    expect(html).toContain('Accepted at 1:01');
    expect(html).not.toContain('return 1');
  });

  it('a win reports the margin, and the ghost code stays hidden until asked for', () => {
    const now = Date.now();
    const html = renderToStaticMarkup(
      <GhostRace slug="two-sum" ghost={ghost()} others={[]} startedAt={now - 40_000} solvedAtMs={40_000} onStart={noop} onReset={noop} />,
    );
    expect(html).toContain('You beat ada&#x27;s ghost by 0:21');
    expect(html).toContain('Show ghost code');
    expect(html).not.toContain('return 1');
  });

  it('says so when the ghost never got it accepted', () => {
    const html = renderToStaticMarkup(
      <GhostRace
        slug="two-sum"
        ghost={ghost({ verdict: 'WRONG_ANSWER', passed: 3 })}
        others={[]}
        startedAt={Date.now() - 90_000}
        solvedAtMs={90_000}
        onStart={noop}
        onReset={noop}
      />,
    );
    expect(html).toContain('never got this one accepted');
  });

  it('lists other ghosts as links before the race', () => {
    const html = renderToStaticMarkup(
      <GhostRace
        slug="two-sum"
        ghost={ghost()}
        others={[ghost(), ghost({ id: 'g2', username: 'linus', submitAtMs: 120_000 })]}
        startedAt={null}
        solvedAtMs={null}
        onStart={noop}
        onReset={noop}
      />,
    );
    expect(html).toContain('href="/practice/two-sum?ghost=g2"');
    expect(html).not.toContain('href="/practice/two-sum?ghost=g1"');
  });
});

describe('GhostOffer', () => {
  it('renders nothing without recorded battles', () => {
    expect(GhostOffer({ slug: 'two-sum', ghosts: [] })).toBeNull();
  });

  it('suggests the best ghost', () => {
    const html = renderToStaticMarkup(<GhostOffer slug="two-sum" ghosts={[ghost(), ghost({ id: 'g2' })]} />);
    expect(html).toContain('2 recorded battles');
    expect(html).toContain('href="/practice/two-sum?ghost=g1"');
  });
});
