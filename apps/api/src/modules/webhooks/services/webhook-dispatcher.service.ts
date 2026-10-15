import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { AppConfigService } from '@/common/config/app-config.service.js';
import type { Prisma } from '@/generated/prisma/client.js';
import { WebhookHttpClient } from '../http/webhook-http-client.js';
import { IWebhookDeliveryRepository } from '../repositories/webhook-delivery.repository.interface.js';
import { decodeSecret, signWebhook } from '../signing/standard-webhooks.js';
import type { WebhookEnvelope, WebhookEventType } from '../webhook.types.js';

/** Wait before retry N (after failed attempt N). */
export const RETRY_DELAYS_MS = [1_000, 5_000, 30_000, 120_000, 600_000];
/** 1 attempt + one retry per delay. */
export const DEFAULT_MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

interface Delivery {
  deliveryId: string;
  eventId: string;
  type: WebhookEventType;
  body: string;
  maxAttempts: number;
}

/**
 * Signs, sends, records and retries chat events (AD-005). Timers live in
 * this process: pending deliveries are not resumed after a restart.
 */
@Injectable()
export class WebhookDispatcher implements OnApplicationShutdown {
  private readonly logger = new Logger(WebhookDispatcher.name);
  private readonly key: Buffer;
  /** Cancels for the pending timers. */
  private readonly pending = new Set<() => void>();
  private closed = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly deliveries: IWebhookDeliveryRepository,
    private readonly http: WebhookHttpClient,
  ) {
    this.key = decodeSecret(config.webhookSecret);
  }

  /** Never awaits the delivery and never throws: callers answer HTTP first. */
  dispatch<T>(
    type: WebhookEventType,
    data: T,
    { maxAttempts = DEFAULT_MAX_ATTEMPTS }: { maxAttempts?: number } = {},
  ): void {
    const eventId = randomUUID();
    const envelope: WebhookEnvelope<T> = {
      type,
      occurredAt: new Date().toISOString(),
      data,
    };
    // Serialized once: every attempt signs and sends the same bytes.
    const body = JSON.stringify(envelope);

    this.schedule(0, eventId, type, async () => {
      const { id } = await this.deliveries.create({
        eventId,
        eventType: type,
        payload: JSON.parse(body) as Prisma.InputJsonValue,
      });
      await this.attempt(
        { deliveryId: id, eventId, type, body, maxAttempts },
        1,
      );
    });
  }

  onApplicationShutdown(): void {
    this.closed = true;
    for (const cancel of this.pending) cancel();
    this.pending.clear();
  }

  private async attempt(delivery: Delivery, number: number): Promise<void> {
    const { deliveryId, eventId, type, body, maxAttempts } = delivery;
    // New timestamp and signature per attempt; same id and body.
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await this.http.post(this.config.webhookTargetUrl, body, {
      'webhook-id': eventId,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': signWebhook({
        key: this.key,
        id: eventId,
        timestamp,
        body,
      }),
      'content-type': 'application/json',
    });

    await this.deliveries.recordAttempt(deliveryId, {
      number,
      statusCode: result.status,
      durationMs: result.durationMs,
      error: result.error,
    });

    const succeeded =
      result.status !== null && result.status >= 200 && result.status < 300;
    const entry = {
      msg: 'webhook attempt',
      eventId,
      type,
      attempt: number,
      status: result.status,
      durationMs: result.durationMs,
      error: result.error,
    };

    if (succeeded) {
      this.logger.log(entry);
      await this.deliveries.markStatus(deliveryId, 'SUCCEEDED');
      return;
    }
    this.logger.warn(entry);
    if (number >= maxAttempts) {
      await this.deliveries.markStatus(deliveryId, 'FAILED');
      return;
    }
    this.schedule(RETRY_DELAYS_MS[number - 1], eventId, type, () =>
      this.attempt(delivery, number + 1),
    );
  }

  private schedule(
    delayMs: number,
    eventId: string,
    type: WebhookEventType,
    work: () => Promise<void>,
  ): void {
    if (this.closed) return;

    let cancel: () => void;
    const run = () => {
      this.pending.delete(cancel);
      work().catch((error: unknown) => {
        this.logger.error({
          msg: 'webhook delivery error',
          eventId,
          type,
          error: (error as Error).message,
        });
      });
    };
    // setImmediate for the first attempt: the HTTP response goes out first.
    if (delayMs === 0) {
      const immediate = setImmediate(run);
      cancel = () => clearImmediate(immediate);
    } else {
      const timeout = setTimeout(run, delayMs);
      cancel = () => clearTimeout(timeout);
    }
    this.pending.add(cancel);
  }
}
