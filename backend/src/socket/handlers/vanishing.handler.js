const conversationService = require("../../services/conversation.service");

function registerVanishingHandlers(io, socket) {
  socket.on("toggle_vanishing", async (data, ack) => {
    try {
      const { conversationId, vanishingMode, durationHours } = data;

      const result = await conversationService.toggleVanishingMode(
        conversationId,
        socket.userId,
        vanishingMode,
        durationHours || 24
      );

      socket.to(conversationId).emit("vanishing_mode_changed", {
        conversationId,
        vanishingMode: result.vanishing_mode,
        durationHours: result.vanishing_duration_hours,
        changedByUserId: socket.userId,
      });

      if (typeof ack === "function") {
        ack({ success: true, ...result });
      }
    } catch (err) {
      if (typeof ack === "function") {
        ack({ success: false, error: err.message });
      }
    }
  });
}

module.exports = registerVanishingHandlers;
