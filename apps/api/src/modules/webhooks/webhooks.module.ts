import { Module } from '@nestjs/common';
import { WebhookHttpClient } from './http/webhook-http-client.js';
import { IWebhookDeliveryRepository } from './repositories/webhook-delivery.repository.interface.js';
import { WebhookDeliveryRepository } from './repositories/webhook-delivery.repository.js';
import { WebhookDispatcher } from './services/webhook-dispatcher.service.js';

/** Other modules only see dispatch(type, data); target and secret stay here. */
@Module({
  providers: [
    WebhookDispatcher,
    WebhookHttpClient,
    {
      provide: IWebhookDeliveryRepository,
      useClass: WebhookDeliveryRepository,
    },
  ],
  exports: [WebhookDispatcher],
})
export class WebhooksModule {}
