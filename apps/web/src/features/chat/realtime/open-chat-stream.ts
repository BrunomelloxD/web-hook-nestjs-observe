import 'server-only';
import { getValidSession } from '../session/get-valid-session';
import { getChatHub } from './chat-hub';
import { HEARTBEAT_MS, SSE_HEADERS, SSE_HEARTBEAT } from './sse';

// Explicit reconnect delay instead of the browser default.
const SSE_RETRY = 'retry: 3000\n\n';

/** GET /chat/stream: one SSE connection registered in the hub (SSE-01). */
export async function openChatStream(request: Request): Promise<Response> {
  // Reads cookies(), which also keeps the route dynamic under Cache Components.
  const valid = await getValidSession();
  if (!valid) return new Response(null, { status: 401 });

  const encoder = new TextEncoder();
  let cleanup: () => void;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      write(SSE_RETRY);
      const unsubscribe = getChatHub().subscribe({
        participantId: valid.session.participantId,
        token: valid.session.token,
        write,
      });
      const heartbeat = setInterval(() => write(SSE_HEARTBEAT), HEARTBEAT_MS);

      const onAbort = () => {
        cleanup();
        controller.close();
      };
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        // After cancel() a late abort must not close the stream again (close() would throw).
        request.signal.removeEventListener('abort', onAbort);
      };

      // The browser may have left while the session was being checked.
      if (request.signal.aborted) onAbort();
      else request.signal.addEventListener('abort', onAbort);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
