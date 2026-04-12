function registerTypingHandlers(io, socket) {
  socket.on("typing_start", ({ conversationId }) => {
    socket.to(conversationId).emit("user_typing", {
      conversationId,
      userId: socket.userId,
      username: socket.username,
    });
  });

  socket.on("typing_stop", ({ conversationId }) => {
    socket.to(conversationId).emit("user_stopped_typing", {
      conversationId,
      userId: socket.userId,
    });
  });
}

module.exports = registerTypingHandlers;
