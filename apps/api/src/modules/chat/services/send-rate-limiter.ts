import { Injectable } from '@nestjs/common';

export const SEND_LIMIT = 5;
const WINDOW_MS = 10_000;

export type AcquireResult =
  { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Sliding window per participant, in memory: the api runs as one instance
 * (RATE-01). The clock comes in as a parameter to keep tests deterministic.
 */
@Injectable()
export class SendRateLimiter {
  /** Accepted send instants per participant, oldest first. */
  private readonly windows = new Map<string, number[]>();

  tryAcquire(participantId: string, nowMs: number): AcquireResult {
    this.evictExpired(nowMs);
    const window = this.windows.get(participantId) ?? [];
    if (window.length >= SEND_LIMIT) {
      return {
        ok: false,
        retryAfterSeconds: Math.ceil((window[0] + WINDOW_MS - nowMs) / 1000),
      };
    }
    window.push(nowMs);
    this.windows.set(participantId, window);
    return { ok: true };
  }

  /** Drops expired instants and the keys left empty, so the map stays small. */
  private evictExpired(nowMs: number): void {
    const threshold = nowMs - WINDOW_MS;
    for (const [participantId, window] of this.windows) {
      while (window.length > 0 && window[0] <= threshold) window.shift();
      if (window.length === 0) this.windows.delete(participantId);
    }
  }
}
