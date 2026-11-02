import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConnectionDropped, isServerDrop } from './ConnectionDropped';

describe('ConnectionDropped', () => {
  it('only a server-side disconnect counts as dropped', () => {
    expect(isServerDrop('io server disconnect')).toBe(true);
    // these socket.io reconnects by itself, so the room just shows the player offline
    for (const reason of ['transport close', 'transport error', 'ping timeout', 'io client disconnect']) {
      expect(isServerDrop(reason)).toBe(false);
    }
  });

  it('explains the drop and offers a reconnect button instead of a page reload', () => {
    const html = renderToStaticMarkup(<ConnectionDropped onReconnect={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('too many requests');
    expect(html).toMatch(/<button type="button"[^>]*>Reconnect<\/button>/);
    expect(html).not.toMatch(/reload/i);
  });

  it('the button calls onReconnect', () => {
    const onReconnect = vi.fn();
    const root = ConnectionDropped({ onReconnect }) as ReactElement<{ children: ReactElement[] }>;
    const button = root.props.children.find(child => child.type === 'button') as ReactElement<{ onClick: () => void }>;
    button.props.onClick();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});
