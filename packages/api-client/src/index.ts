import createClient, { type Client, type ClientOptions } from 'openapi-fetch';
import type { components, paths } from './schema.js';

export type { components, paths };

/** e.g. Schemas['MessageResponseDto'] */
export type Schemas = components['schemas'];

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** Without /api/v1: it's already part of the paths. */
  baseUrl: string;
  /** Sent as `Authorization: Bearer <token>`. */
  token?: string;
  fetch?: ClientOptions['fetch'];
}

export function createApiClient({
  baseUrl,
  token,
  fetch,
}: ApiClientOptions): ApiClient {
  return createClient<paths>({
    baseUrl,
    fetch,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
