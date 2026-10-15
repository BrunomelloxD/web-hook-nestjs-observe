import { Injectable } from '@nestjs/common';

export const WEBHOOK_TIMEOUT_MS = 5000;

export interface WebhookPostResult {
  /** HTTP status, or null when there was no response. */
  status: number | null;
  durationMs: number;
  /** 'timeout' or the network error; null when the target responded. */
  error: string | null;
}

/** Wraps fetch so the dispatcher is tested without a network. Never throws. */
@Injectable()
export class WebhookHttpClient {
  async post(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<WebhookPostResult> {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        body,
        headers,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      // Drain the body so the connection goes back to the pool.
      await response.arrayBuffer();
      return {
        status: response.status,
        durationMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      const { name, message } = error as Error;
      return {
        status: null,
        durationMs: Date.now() - startedAt,
        error: name === 'TimeoutError' ? 'timeout' : message,
      };
    }
  }
}
