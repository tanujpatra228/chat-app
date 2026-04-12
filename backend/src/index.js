require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const pool = require("./config/db");
const authenticate = require("./middleware/authenticate");
const errorHandler = require("./middleware/errorHandler");
const initializeSocket = require("./socket");

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

// Use server.listen instead of app.listen for Socket.IO compatibility
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
