export type WebhookEventType = 'message.created' | 'presence.changed';

/** Body of every webhook; serialized once and signed as is. */
export interface WebhookEnvelope<T> {
  type: WebhookEventType;
  /** ISO 8601. */
  occurredAt: string;
  data: T;
}
