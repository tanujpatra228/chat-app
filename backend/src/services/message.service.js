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

  // Check if conversation has vanishing mode
  const conversation = await conversationRepo.findById(conversationId);
  let expiresAt = null;
  if (conversation?.vanishing_mode && conversation.vanishing_duration_hours) {
    expiresAt = new Date(
      Date.now() + conversation.vanishing_duration_hours * 3600000
    ).toISOString();
  }

  return messageRepo.createMessage({
    conversationId,
    senderId,
    content,
    replyToId,
    expiresAt,
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

async function searchMessages(query, userId) {
  if (!query || query.trim().length < 2) {
    return [];
  }
  return messageRepo.searchMessages(query.trim(), userId);
}

module.exports = { sendMessage, getMessages, deleteMessage, searchMessages };
