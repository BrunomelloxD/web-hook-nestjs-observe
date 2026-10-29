import type { Schemas } from '@repo/api-client';

export type ChatParticipant = Schemas['MessageAuthorDto'];

export type ChatMessageType = Schemas['MessageType'];

export type ChatMessage = Schemas['MessageResponseDto'];

export type OnlineParticipant = Schemas['OnlineParticipantDto'];

export type OnlineParticipants = Schemas['OnlineParticipantsResponseDto'];

export type LoadOlderMessagesResult =
  { ok: true; items: ChatMessage[] } | { ok: false };

/** The `loadOlderMessages` Server Action, as client components take it. */
export type LoadOlderMessagesAction = (
  before: number,
) => Promise<LoadOlderMessagesResult>;
