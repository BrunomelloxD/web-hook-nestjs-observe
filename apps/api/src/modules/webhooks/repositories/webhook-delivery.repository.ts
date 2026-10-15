import { Injectable } from '@nestjs/common';
import type { WebhookDelivery } from '@/generated/prisma/client.js';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import {
  IWebhookDeliveryRepository,
  type CreateWebhookDeliveryData,
  type WebhookAttemptData,
} from './webhook-delivery.repository.interface.js';

@Injectable()
export class WebhookDeliveryRepository extends IWebhookDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  create(data: CreateWebhookDeliveryData): Promise<WebhookDelivery> {
    return this.prisma.webhookDelivery.create({ data });
  }

  async recordAttempt(
    deliveryId: string,
    { number, statusCode, durationMs, error }: WebhookAttemptData,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.webhookDeliveryAttempt.create({
        data: { deliveryId, attempt: number, statusCode, durationMs, error },
      });
      await tx.webhookDelivery.update({
        where: { id: deliveryId },
        data: { attempts: number, lastStatus: statusCode, lastError: error },
      });
    });
  }

  async markStatus(
    deliveryId: string,
    status: 'SUCCEEDED' | 'FAILED',
  ): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status },
    });
  }
}
