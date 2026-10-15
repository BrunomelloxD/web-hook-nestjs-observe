import { setupServer } from 'msw/node';

export const TEST_API_URL = 'http://api.test';

/** No default handlers: each test declares its own. */
export const server = setupServer();
