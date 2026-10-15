import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema.js';

/** Typed env access. Use this instead of process.env. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get webhookTargetUrl(): string {
    return this.get('WEBHOOK_TARGET_URL');
  }

  get webhookSecret(): string {
    return this.get('WEBHOOK_SECRET');
  }
}
