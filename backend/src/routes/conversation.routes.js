const { Router } = require("express");
const multer = require("multer");
const conversationService = require("../services/conversation.service");
const messageService = require("../services/message.service");
const validate = require("../middleware/validate");
const { createConversationSchema } = require("../validators/message.validator");
const { parsePaginationParams } = require("../utils/pagination");
const ApiError = require("../utils/ApiError");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/png", "image/jpeg", "image/jpg", "image/gif",
      "image/webp", "image/heic", "image/heif",
    ];
    if (file.mimetype.startsWith("image/") || allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, "Only image files are allowed"));
    }
  },
});

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const conversations = await conversationService.getUserConversations(
      req.user.userId
    );
    res.json(conversations);
  } catch (err) {
    next(err);
  }
});

router.post("/", validate(createConversationSchema), async (req, res, next) => {
  try {
    const result = await conversationService.getOrCreateConversation(
      req.user.userId,
      req.body.participantId
    );
    res.status(result.isNew ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/messages", async (req, res, next) => {
  try {
    const pagination = parsePaginationParams(req.query);
    const result = await messageService.getMessages(
      req.params.id,
      req.user.userId,
      pagination
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/vanishing", async (req, res, next) => {
  try {
    const { vanishingMode, durationHours } = req.body;
    const result = await conversationService.toggleVanishingMode(
      req.params.id,
      req.user.userId,
      vanishingMode,
      durationHours || 24
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/search/messages", async (req, res, next) => {
  try {
    const results = await messageService.searchMessages(
      req.query.q,
      req.user.userId
    );
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/images", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, "No image provided");
    }

    const message = await messageService.sendImageMessage({
      conversationId: req.params.id,
      senderId: req.user.userId,
      fileBuffer: req.file.buffer,
    });

    // Broadcast via Socket.IO if available
    const io = req.app.get("io");
    if (io) {
      io.to(req.params.id).emit("new_message", {
        conversationId: req.params.id,
        message: { ...message, sender_username: req.user.username },
      });
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
