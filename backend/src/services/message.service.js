const messageRepo = require("../repositories/message.repository");
const conversationRepo = require("../repositories/conversation.repository");
const uploadService = require("./upload.service");
const ApiError = require("../utils/ApiError");

async function sendMessage({ conversationId, senderId, content, replyToId, nudgeType }) {
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
    messageType: nudgeType ? "nudge" : "text",
    nudgeType,
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

async function editMessage(messageId, userId, newContent) {
  const message = await messageRepo.findById(messageId);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }
  if (message.sender_id !== userId) {
    throw new ApiError(403, "Can only edit your own messages");
  }
  if (message.is_edited) {
    throw new ApiError(400, "Message can only be edited once");
  }
  if (message.is_deleted) {
    throw new ApiError(400, "Cannot edit a deleted message");
  }
  if (message.message_type !== "text") {
    throw new ApiError(400, "Only text messages can be edited");
  }

  return messageRepo.editMessage(messageId, newContent);
}

async function deleteMessage(messageId, userId) {
  const message = await messageRepo.findById(messageId);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }
  if (message.sender_id !== userId) {
    throw new ApiError(403, "Can only delete your own messages");
  }

  if (message.image_public_id) {
    await uploadService.deleteMedia(
      message.image_public_id,
      message.media_resource_type || "image"
    );
  }

  return messageRepo.softDelete(messageId);
}

function resolveMediaType(mimetype) {
  if (mimetype.startsWith("video/")) return { messageType: "video", resourceType: "video" };
  if (mimetype.startsWith("audio/")) return { messageType: "audio", resourceType: "video" };
  return { messageType: "image", resourceType: "image" };
}

async function sendMediaMessage({ conversationId, senderId, fileBuffer, mimetype }) {
  const isParticipant = await conversationRepo.isParticipant(conversationId, senderId);
  if (!isParticipant) {
    throw new ApiError(403, "Not a participant of this conversation");
  }

  const { messageType, resourceType } = resolveMediaType(mimetype);

  const { url, publicId, duration } = await uploadService.uploadMedia(
    fileBuffer,
    conversationId,
    resourceType
  );

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
    content: "",
    replyToId: null,
    expiresAt,
    messageType,
    imageUrl: url,
    imagePublicId: publicId,
    mediaResourceType: resourceType,
    mediaDurationSeconds: duration ? Math.round(duration) : null,
  });
}

async function sendImageMessage({ conversationId, senderId, fileBuffer }) {
  const isParticipant = await conversationRepo.isParticipant(
    conversationId,
    senderId
  );
  if (!isParticipant) {
    throw new ApiError(403, "Not a participant of this conversation");
  }

  const { url, publicId } = await uploadService.uploadImage(
    fileBuffer,
    conversationId
  );

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
    content: "",
    replyToId: null,
    expiresAt,
    messageType: "image",
    imageUrl: url,
    imagePublicId: publicId,
  });
}

async function searchMessages(query, userId) {
  if (!query || query.trim().length < 2) {
    return [];
  }
  return messageRepo.searchMessages(query.trim(), userId);
}

module.exports = { sendMessage, sendMediaMessage, sendImageMessage, getMessages, editMessage, deleteMessage, searchMessages };
