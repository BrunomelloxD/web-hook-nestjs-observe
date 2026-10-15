import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfigService } from '@/common/config/app-config.service.js';
import { createLoggerOptions } from './logger.options.js';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: createLoggerOptions,
    }),
  ],
})
export class LoggerModule {}
