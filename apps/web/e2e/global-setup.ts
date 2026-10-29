import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import pg from 'pg';

/** Every participant the web E2E creates has a name with this prefix. */
const PREFIX = 'e2e-web-';

/** The host-side DATABASE_URL the api uses outside Docker (make env creates the file). */
function databaseUrl() {
  const fromEnv = process.env['E2E_DATABASE_URL'];
  if (fromEnv) return fromEnv;
  const apiEnv = resolve(import.meta.dirname, '../../api/.env');
  const url = parseEnv(readFileSync(apiEnv, 'utf8'))['DATABASE_URL'];
  if (!url) throw new Error(`DATABASE_URL is not set in ${apiEnv}`);
  return url;
}

/**
 * Deletes what earlier web E2E runs left in the shared room, so specs that
 * page through it stay bounded (the api has no delete endpoint). Only rows
 * tied to `e2e-web-` participants go: their messages (USER, JOINED, LEFT) and
 * the webhook deliveries naming them; attempts go by cascade. Same cleanup
 * as apps/api/test/typing.e2e-spec.ts.
 */
export default async function globalSetup() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string }>(
      'SELECT id FROM participants WHERE starts_with(name, $1)',
      [PREFIX],
    );
    const ids = rows.map((row) => row.id);
    await client.query(
      `DELETE FROM webhook_deliveries
        WHERE payload #>> '{data,author,id}' = ANY($1)
           OR payload #>> '{data,participant,id}' = ANY($1)`,
      [ids],
    );
    await client.query('DELETE FROM messages WHERE participant_id = ANY($1)', [
      ids,
    ]);
    await client.query('DELETE FROM participants WHERE id = ANY($1)', [ids]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
