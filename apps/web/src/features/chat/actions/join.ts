'use server';

import { redirect } from 'next/navigation';
import { getApi } from '@/lib/api';
import { chatDictionary as t } from '../chat.dictionary';
import {
  joinFormSchema,
  readJoinForm,
  type JoinFormState,
} from '../schemas/join-form.schema';
import { writeSession } from '../session/session-cookie';

// Public POST endpoint: validate here even though the api validates too.
export async function join(
  _state: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const values = readJoinForm(formData);
  const parsed = joinFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]!.message,
      values,
    };
  }

  const { data, response } = await getApi().POST('/api/v1/chat/participants', {
    body: parsed.data,
  });

  if (response.status === 409) {
    return { status: 'error', message: t.errors.nameTaken, values };
  }

  if (!data) {
    return { status: 'error', message: t.errors.joinFailed, values };
  }

  await writeSession({ participantId: data.id, token: data.token });
  redirect('/chat');
}
