import { KeystrokeEventPayload } from '@codebattle/shared';

export type KeystrokeHandler = (event: KeystrokeEventPayload) => void;

export function captureKeystrokes(matchId: string, userId: string, onEvent: KeystrokeHandler): () => void {
  const handler = (event: KeyboardEvent): void => {
    const payload: KeystrokeEventPayload = {
      matchId,
      userId,
      key: event.key,
      timestamp: Date.now(),
      type: 'keydown'
    };
    onEvent(payload);
  };

  window.addEventListener('keydown', handler);

  return () => window.removeEventListener('keydown', handler);
}
