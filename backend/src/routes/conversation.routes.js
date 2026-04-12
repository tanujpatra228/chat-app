const { Router } = require("express");
const conversationService = require("../services/conversation.service");
const messageService = require("../services/message.service");
const validate = require("../middleware/validate");
const { createConversationSchema } = require("../validators/message.validator");
const { parsePaginationParams } = require("../utils/pagination");

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

module.exports = router;
