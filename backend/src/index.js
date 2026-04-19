require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { pool, singleton } = require("./config/db");
const authenticate = require("./middleware/authenticate");
const errorHandler = require("./middleware/errorHandler");
const initializeSocket = require("./socket");
const startCleanupJob = require("./jobs/cleanupExpiredMessages");

// Routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const conversationRoutes = require("./routes/conversation.routes");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", timestamp: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticate, userRoutes);
app.use("/api/conversations", authenticate, conversationRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Initialize Socket.IO
const io = initializeSocket(server);
app.set("io", io);

// Start background jobs
startCleanupJob();

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}, starting graceful shutdown...`);
  
  server.close(async () => {
    console.log("HTTP server closed");
    
    try {
      // Close database connection
      await singleton.closePool();
      console.log("Database connection closed");
    } catch (err) {
      console.error("Error closing database connection:", err);
    }
    
    console.log("Server shutdown complete");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

// Handle graceful shutdown on signals
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  await gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  await gracefulShutdown("unhandledRejection");
});

// Test database connection and start server
const startServer = async () => {
  try {
    // Test database connection
    const result = await pool.query("SELECT NOW()");
    console.log("Database connected successfully:", result.rows[0].now);

    // Use server.listen instead of app.listen for Socket.IO compatibility
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    process.exit(1);
  }
};

startServer();
