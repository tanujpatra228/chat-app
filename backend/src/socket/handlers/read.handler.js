const conversationRepo = require("../../repositories/conversation.repository");

function registerReadHandlers(io, socket) {
  socket.on("mark_read", async ({ conversationId, messageId }) => {
    try {
      await conversationRepo.updateLastReadMessage(
        conversationId,
        socket.userId,
        messageId
      );

      socket.to(conversationId).emit("messages_read", {
        conversationId,
        userId: socket.userId,
        lastReadMessageId: messageId,
      });
    } catch (err) {
      console.error("Error marking messages as read:", err.message);
    }
  });
}

module.exports = registerReadHandlers;
