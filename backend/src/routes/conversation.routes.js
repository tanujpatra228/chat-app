const { Router } = require("express");
const multer = require("multer");
const conversationService = require("../services/conversation.service");
const conversationRepo = require("../repositories/conversation.repository");
const messageService = require("../services/message.service");
const { uploadBackground, deleteImage } = require("../services/upload.service");
const validate = require("../middleware/validate");
const { createConversationSchema } = require("../validators/message.validator");
const { parsePaginationParams } = require("../utils/pagination");
const ApiError = require("../utils/ApiError");

// Image-only upload (10 MB) — used by legacy /images route
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

// Media upload (50 MB) — image, video, audio
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype.startsWith("audio/");
    if (allowed) {
      cb(null, true);
    } else {
      cb(new ApiError(400, "Only image, video, and audio files are allowed"));
    }
  },
});

// Rejects non-participants before any body parsing runs.
async function requireParticipant(req, res, next) {
  try {
    await conversationService.verifyParticipant(req.params.id, req.user.userId);
    next();
  } catch (err) {
    next(err);
  }
}

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

// requireParticipant runs before upload.single — rejects non-participants before body is read.
router.post("/:id/background", requireParticipant, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "No image provided");

    const existing = await conversationRepo.findById(req.params.id);
    if (existing?.background_image_public_id) {
      await deleteImage(existing.background_image_public_id);
    }

    const { url, publicId } = await uploadBackground(req.file.buffer, req.params.id);
    const result = await conversationRepo.updateBackground(req.params.id, url, publicId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/background", requireParticipant, async (req, res, next) => {
  try {
    const row = await conversationRepo.clearBackground(req.params.id);
    if (row?.background_image_public_id) {
      await deleteImage(row.background_image_public_id);
    }
    res.json({ background_image_url: null });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/saved-link", requireParticipant, async (req, res, next) => {
  try {
    const result = await conversationRepo.updateSavedLink(
      req.params.id,
      req.body.url || null
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

// Unified media endpoint — accepts image, video, audio
router.post("/:id/media", requireParticipant, mediaUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "No file provided");

    const message = await messageService.sendMediaMessage({
      conversationId: req.params.id,
      senderId: req.user.userId,
      fileBuffer: req.file.buffer,
      mimetype: req.file.mimetype,
    });

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

// Legacy alias — kept for backwards compatibility
router.post("/:id/images", requireParticipant, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "No image provided");

    const message = await messageService.sendImageMessage({
      conversationId: req.params.id,
      senderId: req.user.userId,
      fileBuffer: req.file.buffer,
    });

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
