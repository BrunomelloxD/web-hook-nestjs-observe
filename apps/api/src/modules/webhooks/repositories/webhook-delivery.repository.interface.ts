import type { Prisma, WebhookDelivery } from '@/generated/prisma/client.js';
import type { WebhookEventType } from '../webhook.types.js';

export interface CreateWebhookDeliveryData {
  eventId: string;
  eventType: WebhookEventType;
  /** The whole envelope that is signed and sent. */
  payload: Prisma.InputJsonValue;
}

export interface WebhookAttemptData {
  /** 1-based. */
  number: number;
  statusCode: number | null;
  durationMs: number;
  error: string | null;
}

/** Insert-and-update domain: no IBaseRepository (see ARCHITECTURE §14). */
export abstract class IWebhookDeliveryRepository {
  abstract create(data: CreateWebhookDeliveryData): Promise<WebhookDelivery>;
  /** Inserts the attempt and updates attempts/lastStatus/lastError in one transaction. */
  abstract recordAttempt(
    deliveryId: string,
    attempt: WebhookAttemptData,
  ): Promise<void>;
  abstract markStatus(
    deliveryId: string,
    status: 'SUCCEEDED' | 'FAILED',
  ): Promise<void>;
}
