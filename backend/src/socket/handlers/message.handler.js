const messageService = require("../../services/message.service");
const messageRepo = require("../../repositories/message.repository");
const { extractFirstUrl, fetchPreview } = require("../../services/link-preview.service");

async function processLinkPreview(io, message) {
  if (message.message_type !== "text" || !message.content) return;

  const url = extractFirstUrl(message.content);
  if (!url) return;

  const preview = await fetchPreview(url);
  if (!preview || (!preview.title && !preview.image)) return;

  const updated = await messageRepo.updateLinkPreview(message.id, preview);
  if (!updated) return;

  io.to(updated.conversation_id).emit("message_updated", {
    conversationId: updated.conversation_id,
    messageId: updated.id,
    linkUrl: updated.link_url,
    linkTitle: updated.link_title,
    linkDescription: updated.link_description,
    linkImage: updated.link_image,
  });
}

function registerMessageHandlers(io, socket) {
  socket.on("send_message", async (data, ack) => {
    try {
      const { conversationId, content, replyToId, nudgeType } = data;

      const message = await messageService.sendMessage({
        conversationId,
        senderId: socket.userId,
        content,
        replyToId,
        nudgeType,
      });

      const messageWithUsername = {
        ...message,
        sender_username: socket.username,
      };

      // Broadcast to other participants in the room
      socket.to(conversationId).emit("new_message", {
        conversationId,
        message: messageWithUsername,
      });

      // Acknowledge to sender with saved message
      if (typeof ack === "function") {
        ack({ success: true, message: messageWithUsername });
      }

      // Fire-and-forget link preview fetch
      processLinkPreview(io, message).catch((err) =>
        console.error("Link preview failed:", err.message)
      );
    } catch (err) {
      if (typeof ack === "function") {
        ack({ success: false, error: err.message });
      }
    }
  });

  socket.on("edit_message", async (data, ack) => {
    try {
      const { messageId, conversationId, content } = data;

      const edited = await messageService.editMessage(
        messageId,
        socket.userId,
        content
      );

      socket.to(conversationId).emit("message_edited", {
        conversationId,
        messageId,
        content: edited.content,
      });

      if (typeof ack === "function") {
        ack({ success: true, message: edited });
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
