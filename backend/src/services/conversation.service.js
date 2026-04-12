const conversationRepo = require("../repositories/conversation.repository");
const userRepo = require("../repositories/user.repository");
const ApiError = require("../utils/ApiError");

async function getOrCreateConversation(currentUserId, participantId) {
  if (currentUserId === participantId) {
    throw new ApiError(400, "Cannot create conversation with yourself");
  }

  const participant = await userRepo.findById(participantId);
  if (!participant) {
    throw new ApiError(404, "User not found");
  }

  const existingId = await conversationRepo.findConversationBetween(
    currentUserId,
    participantId
  );

  if (existingId) {
    return { id: existingId, isNew: false };
  }

  const conversation = await conversationRepo.createConversation(
    currentUserId,
    participantId
  );

  return { id: conversation.id, isNew: true };
}

async function getUserConversations(userId) {
  return conversationRepo.getUserConversations(userId);
}

async function verifyParticipant(conversationId, userId) {
  const isParticipant = await conversationRepo.isParticipant(
    conversationId,
    userId
  );
  if (!isParticipant) {
    throw new ApiError(403, "Not a participant of this conversation");
  }
}

const VALID_DURATIONS = [1, 6, 24, 168];

async function toggleVanishingMode(conversationId, userId, vanishingMode, durationHours) {
  await verifyParticipant(conversationId, userId);

  if (vanishingMode && !VALID_DURATIONS.includes(durationHours)) {
    throw new ApiError(400, `Duration must be one of: ${VALID_DURATIONS.join(", ")} hours`);
  }

  return conversationRepo.updateVanishingMode(
    conversationId,
    vanishingMode,
    vanishingMode ? durationHours : null
  );
}

module.exports = { getOrCreateConversation, getUserConversations, verifyParticipant, toggleVanishingMode };
