const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/auth");
const conversationRepo = require("../repositories/conversation.repository");
const userRepo = require("../repositories/user.repository");
const registerMessageHandlers = require("./handlers/message.handler");
const registerTypingHandlers = require("./handlers/typing.handler");
const registerReadHandlers = require("./handlers/read.handler");
const registerVanishingHandlers = require("./handlers/vanishing.handler");

function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Set user online
    await userRepo.setOnlineStatus(socket.userId, true);

    // Join all user's conversation rooms
    const conversations = await conversationRepo.getUserConversations(
      socket.userId
    );
    for (const conv of conversations) {
      socket.join(conv.id);
    }

    // Broadcast online status to all conversation rooms
    for (const conv of conversations) {
      socket.to(conv.id).emit("user_online", { userId: socket.userId });
    }

    // Register event handlers
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerReadHandlers(io, socket);
    registerVanishingHandlers(io, socket);

    // Handle joining a new conversation room (when a new conversation is created via REST)
    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.username}`);

      await userRepo.setOnlineStatus(socket.userId, false);

      for (const conv of conversations) {
        socket.to(conv.id).emit("user_offline", {
          userId: socket.userId,
          lastSeen: new Date().toISOString(),
        });
      }
    });
  });

  return io;
}

module.exports = initializeSocket;
