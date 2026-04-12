const messageRepo = require("../repositories/message.repository");
const conversationRepo = require("../repositories/conversation.repository");
const ApiError = require("../utils/ApiError");

async function sendMessage({ conversationId, senderId, content, replyToId }) {
  const isParticipant = await conversationRepo.isParticipant(
    conversationId,
    senderId
  );
  if (!isParticipant) {
    throw new ApiError(403, "Not a participant of this conversation");
  }

  if (replyToId) {
    const replyTarget = await messageRepo.findById(replyToId);
    if (!replyTarget || replyTarget.conversation_id !== conversationId) {
      throw new ApiError(400, "Invalid reply target");
    }
  }

  return messageRepo.createMessage({
    conversationId,
    senderId,
    content,
    replyToId,
  });
}

async function getMessages(conversationId, userId, paginationParams) {
  const isParticipant = await conversationRepo.isParticipant(
    conversationId,
    userId
  );
  if (!isParticipant) {
    throw new ApiError(403, "Not a participant of this conversation");
  }

  const messages = await messageRepo.getMessages(
    conversationId,
    paginationParams
  );

  const hasMore = messages.length === paginationParams.limit;
  const nextCursor = hasMore
    ? messages[messages.length - 1].created_at.toISOString()
    : null;

  return { messages, hasMore, nextCursor };
}

async function deleteMessage(messageId, userId) {
  const message = await messageRepo.findById(messageId);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }
  if (message.sender_id !== userId) {
    throw new ApiError(403, "Can only delete your own messages");
  }

  return messageRepo.softDelete(messageId);
}

module.exports = { sendMessage, getMessages, deleteMessage };
