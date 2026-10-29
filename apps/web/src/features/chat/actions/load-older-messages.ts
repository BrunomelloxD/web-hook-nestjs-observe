'use server';

import { z } from 'zod';
import type { LoadOlderMessagesResult } from '../chat.types';
import { getMessages } from '../queries/get-messages';
import { getValidSession } from '../session/get-valid-session';

/** Page size of the initial load and of each older page (HIST-01). */
const PAGE_SIZE = 50;

const beforeSchema = z.number().int().positive();

/**
 * Reads the page before `before` (HIST-01 AC2). A read through a Server Action
 * because the browser never calls the api; any failure becomes `{ ok: false }`
 * and the list keeps the button (AC6).
 */
export async function loadOlderMessages(
  before: number,
): Promise<LoadOlderMessagesResult> {
  if (!beforeSchema.safeParse(before).success) return { ok: false };

  try {
    if (!(await getValidSession())) return { ok: false };
    const items = await getMessages({ before, limit: PAGE_SIZE });
    return { ok: true, items };
  } catch {
    return { ok: false };
  }
}
