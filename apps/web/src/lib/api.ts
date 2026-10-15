import 'server-only';
import { createApiClient, type ApiClient } from '@repo/api-client';
import { getEnv } from './env';

/** The only entry point to the API. Server-only. */
export function getApi(): ApiClient {
  return createApiClient({ baseUrl: getEnv().API_URL });
}
