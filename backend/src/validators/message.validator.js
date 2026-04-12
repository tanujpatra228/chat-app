const Joi = require("joi");

const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required(),
  replyToId: Joi.string().uuid().optional(),
});

const createConversationSchema = Joi.object({
  participantId: Joi.string().uuid().required(),
});

module.exports = { sendMessageSchema, createConversationSchema };
