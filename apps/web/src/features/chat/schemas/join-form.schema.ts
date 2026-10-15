import { z } from 'zod';
import { chatDictionary as t } from '../chat.dictionary';

// Same rule as the api's JoinParticipantDto: letters (any script), combining
// marks, digits, space, ".", "_" and "-", 2 to 20 after trim.
const NAME_PATTERN = /^[\p{L}\p{M}0-9 ._-]{2,20}$/u;

export const joinFormSchema = z.object({
  name: z.string().trim().regex(NAME_PATTERN, t.errors.nameInvalid),
});

export type JoinFormValues = { name: string };

// SPEC_DEVIATION: design returns `fieldErrors.name` for the 409.
// Reason: the F0 JoinForm shows `message` under the name field (aria-invalid,
// aria-describedby), so every error travels as `message`.
export type JoinFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; values: JoinFormValues };

export const initialJoinFormState: JoinFormState = { status: 'idle' };

export type JoinAction = (
  state: JoinFormState,
  formData: FormData,
) => Promise<JoinFormState>;

/** A missing or non-string field becomes ''. */
export function readJoinForm(formData: FormData): JoinFormValues {
  const name = formData.get('name');
  return { name: typeof name === 'string' ? name : '' };
}
