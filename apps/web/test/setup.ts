import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { server, TEST_API_URL } from './msw/server';
import { TEST_WEBHOOK_SECRET } from './webhooks';

process.env['API_URL'] = TEST_API_URL;
process.env['WEBHOOK_SECRET'] = TEST_WEBHOOK_SECRET;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
