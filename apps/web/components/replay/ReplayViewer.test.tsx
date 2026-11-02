import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { replayFramesFor } from '@/lib/battleAccess';

import { ReplayViewer } from './ReplayViewer';

const raw = [{ t: 0, code: 'def solve():\n    return 42', language: 'python', submitted: true }];
const track = (name: string, includeCode: boolean) => ({
  name,
  frames: replayFramesFor(raw, includeCode),
  verdict: 'Accepted 3/3',
  submitAt: 0,
  accepted: true,
});

describe('ReplayViewer', () => {
  it('shows both players\u2019 code to a participant', () => {
    const html = renderToStaticMarkup(<ReplayViewer tracks={[track('ada', true), track('linus', true)]} durationMs={10_000} codeVisible />);
    expect(html).toContain('return 42');
  });

  it('shows a spectator the verdict timeline but no code', () => {
    const html = renderToStaticMarkup(<ReplayViewer tracks={[track('ada', false), track('linus', false)]} durationMs={10_000} codeVisible={false} />);
    expect(html).toContain('Accepted 3/3');
    expect(html).not.toContain('return 42');
    expect(html).toContain('only to the two players');
  });
});
