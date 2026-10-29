import { Injectable } from '@nestjs/common';
import type { Participant } from '@/generated/prisma/client.js';
import { WebhookDispatcher } from '@/modules/webhooks/services/webhook-dispatcher.service.js';

export const TYPING_MIN_INTERVAL_MS = 2_000;

/**
 * Sends typing.started at most once per 2 s per participant, in memory: the
 * api runs as one instance and the notice only lasts 5 s on the web.
 */
@Injectable()
export class TypingService {
  /** Instant of the last accepted call per participant. */
  private readonly lastAccepted = new Map<string, number>();

  constructor(private readonly webhooks: WebhookDispatcher) {}

  notify(actor: Participant, nowMs = Date.now()): void {
    this.evictExpired(nowMs);
    if (this.lastAccepted.has(actor.id)) return;

    this.lastAccepted.set(actor.id, nowMs);
    // A typing notice delivered late has no value: one attempt only.
    this.webhooks.dispatch(
      'typing.started',
      { participant: { id: actor.id, name: actor.name } },
      { maxAttempts: 1 },
    );
  }

  /**
   * Clears the participant's 2 s window: after a sent message the notice is
   * gone on the web (TYPE-02 AC9), so the next keystroke must notify at once.
   */
  reset(participantId: string): void {
    this.lastAccepted.delete(participantId);
  }

  /** Drops entries 2 s old or more, so the map stays small. */
  private evictExpired(nowMs: number): void {
    for (const [participantId, acceptedAt] of this.lastAccepted) {
      if (nowMs - acceptedAt >= TYPING_MIN_INTERVAL_MS) {
        this.lastAccepted.delete(participantId);
      }
    }
  }
}
