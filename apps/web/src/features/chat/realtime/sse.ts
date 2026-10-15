import 'server-only';

/** Comment line that keeps proxies and the browser from closing an idle stream (SSE-01 AC5). */
export const SSE_HEARTBEAT = ': heartbeat\n\n';

export const HEARTBEAT_MS = 25_000;

// no-transform and x-accel-buffering stop proxies from compressing or batching events.
export const SSE_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache, no-transform',
  'x-accel-buffering': 'no',
  connection: 'keep-alive',
} as const;

/** One SSE event: optional `id:`, then `event:` and a JSON `data:` line, ending with a blank line. */
export function formatSseEvent({
  event,
  data,
  id,
}: {
  event: string;
  data: unknown;
  id?: string | number;
}): string {
  const idLine = id === undefined ? '' : `id: ${id}\n`;
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
