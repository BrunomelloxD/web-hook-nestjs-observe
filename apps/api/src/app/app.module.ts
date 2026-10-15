import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from '@/common/config/config.module.js';
import { AppConfigService } from '@/common/config/app-config.service.js';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter.js';
import { LoggerModule } from '@/common/logger/logger.module.js';
import { PrismaModule } from '@/common/prisma/prisma.module.js';
import { ChatModule } from '@/modules/chat/chat.module.js';
import { HealthModule } from '@/modules/health/health.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL'),
          limit: config.get('THROTTLE_LIMIT'),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
