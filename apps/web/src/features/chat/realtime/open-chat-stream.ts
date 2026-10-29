import 'server-only';
import { getMessages } from '../queries/get-messages';
import { getValidSession } from '../session/get-valid-session';
import { getChatHub } from './chat-hub';
import {
  formatSseEvent,
  HEARTBEAT_MS,
  SSE_HEADERS,
  SSE_HEARTBEAT,
} from './sse';

// Explicit reconnect delay instead of the browser default.
const SSE_RETRY = 'retry: 3000\n\n';

const RECOVERY_PAGE = 100;

/** A `Last-Event-ID` or `after` value: a positive integer `seq`, or null (no recovery, RECON-01 AC3). */
export function parseLastEventId(header: string | null): number | null {
  if (header === null || !/^[1-9]\d*$/.test(header)) return null;
  const seq = Number(header);
  return Number.isSafeInteger(seq) ? seq : null;
}

/** Writes every message after `after`, page by page, and returns the last `seq` written (RECON-01 AC1). */
async function recoverMissed(
  after: number,
  write: (chunk: string) => void,
): Promise<number> {
  let last = after;
  for (;;) {
    const page = await getMessages({ after: last, limit: RECOVERY_PAGE });
    for (const message of page) {
      write(
        formatSseEvent({ event: 'message', id: message.seq, data: message }),
      );
      last = message.seq;
    }
    if (page.length < RECOVERY_PAGE) return last;
  }
}

/** GET /chat/stream: one SSE connection registered in the hub (SSE-01), replaying what the page missed (RECON-01). */
export async function openChatStream(request: Request): Promise<Response> {
  // Reads cookies(), which also keeps the route dynamic under Cache Components.
  const valid = await getValidSession();
  if (!valid) return new Response(null, { status: 401 });

  // EventSource reconnects with the same URL, so once a `message` arrived its
  // Last-Event-ID must win over the `after` the page opened with (RECON-01 AC7).
  const recoverAfter =
    parseLastEventId(request.headers.get('last-event-id')) ??
    parseLastEventId(new URL(request.url).searchParams.get('after'));
  const encoder = new TextEncoder();
  let cleanup: () => void;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      write(SSE_RETRY);
      // Subscribe before fetching, so events published during the fetch are buffered, not lost.
      const subscription = getChatHub().subscribe(
        {
          participantId: valid.session.participantId,
          token: valid.session.token,
          write,
        },
        { recovering: recoverAfter !== null },
      );
      const heartbeat = setInterval(() => write(SSE_HEARTBEAT), HEARTBEAT_MS);

      const onAbort = () => {
        cleanup();
        controller.close();
      };
      cleanup = () => {
        closed = true;
        subscription.unsubscribe();
        clearInterval(heartbeat);
        // After cancel() a late abort must not close the stream again (close() would throw).
        request.signal.removeEventListener('abort', onAbort);
      };

      // The browser may have left while the session was being checked.
      if (request.signal.aborted) onAbort();
      else request.signal.addEventListener('abort', onAbort);

      if (recoverAfter !== null && !closed) {
        recoverMissed(recoverAfter, write).then(
          (lastSeq) => subscription.flush(lastSeq),
          (error: unknown) => {
            // The browser already left: nothing to report.
            if (closed) return;
            // EventSource reconnects with the same Last-Event-ID or URL (RECON-01 AC4).
            cleanup();
            controller.error(error);
          },
        );
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
