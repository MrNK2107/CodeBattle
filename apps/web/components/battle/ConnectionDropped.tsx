/** socket.io's reason when the server ended the connection; the client will not reconnect by itself. */
export const SERVER_DROP = 'io server disconnect';

export function isServerDrop(reason: string): boolean {
  return reason === SERVER_DROP;
}

/** Shown in the battle room after the server closed the socket (e.g. too many requests in a row). */
export function ConnectionDropped({ onReconnect }: { onReconnect: () => void }): JSX.Element {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-fail/40 bg-fail/10 px-4 py-2 text-sm text-fail">
      <span>The server closed your connection after too many requests in a short time. Your code stays in the editor.</span>
      <button type="button" className="rounded-md border border-fail/40 px-3 py-1 font-medium hover:bg-fail/20" onClick={onReconnect}>
        Reconnect
      </button>
    </div>
  );
}
