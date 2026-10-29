import { Module } from '@nestjs/common';
import { WebhooksModule } from '@/modules/webhooks/webhooks.module.js';
import { MessagesController } from './controllers/messages.controller.js';
import { ParticipantsController } from './controllers/participants.controller.js';
import { TypingController } from './controllers/typing.controller.js';
import { ParticipantTokenGuard } from './guards/participant-token.guard.js';
import { IMessageRepository } from './repositories/message.repository.interface.js';
import { MessageRepository } from './repositories/message.repository.js';
import { IParticipantRepository } from './repositories/participant.repository.interface.js';
import { ParticipantRepository } from './repositories/participant.repository.js';
import { MessagesService } from './services/messages.service.js';
import { ParticipantsService } from './services/participants.service.js';
import { SendRateLimiter } from './services/send-rate-limiter.js';
import { TypingService } from './services/typing.service.js';

@Module({
  imports: [WebhooksModule],
  controllers: [ParticipantsController, MessagesController, TypingController],
  providers: [
    ParticipantsService,
    MessagesService,
    SendRateLimiter,
    TypingService,
    ParticipantTokenGuard,
    { provide: IParticipantRepository, useClass: ParticipantRepository },
    { provide: IMessageRepository, useClass: MessageRepository },
  ],
  exports: [ParticipantsService],
})
export class ChatModule {}
