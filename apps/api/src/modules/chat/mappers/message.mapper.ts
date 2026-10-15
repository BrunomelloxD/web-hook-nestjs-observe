import type { MessageResponseDto } from '../dtos/response/message-response.dto.js';
import type { MessageWithAuthor } from '../repositories/message.repository.interface.js';

export class MessageMapper {
  static toResponse(message: MessageWithAuthor): MessageResponseDto {
    return {
      id: message.id,
      // Safe: seq stays far below Number.MAX_SAFE_INTEGER (ROOM-02 AC12).
      seq: Number(message.seq),
      type: message.type,
      content: message.content,
      clientId: message.clientId,
      author: { id: message.participant.id, name: message.participant.name },
      createdAt: message.createdAt.toISOString(),
    };
  }
}
