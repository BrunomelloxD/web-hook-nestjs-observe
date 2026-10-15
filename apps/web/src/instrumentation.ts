/** Runs once when the Next server starts: refuse to boot with an invalid env. */
export async function register() {
  // The build has no .env (Docker, CI); the edge runtime never reads these vars.
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }

  const { getEnv } = await import('./lib/env');
  getEnv();
}
