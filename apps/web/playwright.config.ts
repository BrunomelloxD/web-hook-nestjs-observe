import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env['CI']);

// Runs against the full stack (docker compose up).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // SPEC_DEVIATION: one worker (the default runs spec files in parallel).
  // Reason: chat.spec and chat-realtime.spec assert exact online counts, and
  // joins from another file would change them midway.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
