import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  /** Server-to-server only; never exposed to the browser. */
  API_URL: z.url(),
  /** Shared with the api; same format the api validates (whsec_ + base64). */
  WEBHOOK_SECRET: z
    .string()
    .regex(/^whsec_[A-Za-z0-9+/]+={0,2}$/, 'deve ser whsec_ seguido de base64'),
});

export type Env = z.infer<typeof envSchema>;

/** Read lazily so `next build` doesn't require API_URL. */
export function getEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
