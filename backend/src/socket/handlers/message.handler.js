const messageService = require("../../services/message.service");

function registerMessageHandlers(io, socket) {
  socket.on("send_message", async (data, ack) => {
    try {
      const { conversationId, content, replyToId } = data;

      const message = await messageService.sendMessage({
        conversationId,
        senderId: socket.userId,
        content,
        replyToId,
      });

      // Broadcast to other participants in the room
      socket.to(conversationId).emit("new_message", {
        conversationId,
        message: {
          ...message,
          sender_username: socket.username,
        },
      });

      // Acknowledge to sender with saved message
      if (typeof ack === "function") {
        ack({ success: true, message });
      }
    } catch (err) {
      if (typeof ack === "function") {
        ack({ success: false, error: err.message });
      }
    }
  });

  socket.on("delete_message", async (data, ack) => {
    try {
      const { messageId, conversationId } = data;

      const deleted = await messageService.deleteMessage(
        messageId,
        socket.userId
      );

      socket.to(conversationId).emit("message_deleted", {
        conversationId,
        messageId,
      });

      if (typeof ack === "function") {
        ack({ success: true, message: deleted });
      }
    } catch (err) {
      if (typeof ack === "function") {
        ack({ success: false, error: err.message });
      }
    }
  });
}

module.exports = registerMessageHandlers;
