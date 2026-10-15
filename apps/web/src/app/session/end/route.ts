import { endInvalidSession } from '@/features/chat';

// Server Components can't delete cookies, so the room redirects here (AD-002).
export const GET = () => endInvalidSession();
