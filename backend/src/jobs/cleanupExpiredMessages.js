const cron = require("node-cron");
const messageRepo = require("../repositories/message.repository");
const { deleteMultipleMedia } = require("../services/upload.service");

const CLEANUP_CRON = "*/1 * * * *"; // every 1 minute
const BATCH_SIZE = 50;
let isRunning = false;
let ioInstance = null;

async function cleanupExpiredMessages() {
  if (isRunning) {
    console.log("Cleanup job already running, skipping...");
    return;
  }

  isRunning = true;
  let totalImagesDeleted = 0;
  let totalMessagesDeleted = 0;

  try {
    // Phase 1: delete expired media from Cloudinary (before DB rows go away)
    while (true) {
      const items = await messageRepo.getExpiredMediaItems(BATCH_SIZE);
      if (items.length === 0) break;

      try {
        await deleteMultipleMedia(items);
        totalImagesDeleted += items.length;
        console.log(`Deleted ${items.length} expired media items from Cloudinary`);
      } catch (err) {
        console.error("Cloudinary cleanup failed (continuing with DB delete):", err.message);
      }

      if (items.length < BATCH_SIZE) break;
    }

    // Phase 2: delete expired rows (text + image) from DB; emit per conversation
    while (true) {
      const rows = await messageRepo.deleteExpiredMessages(BATCH_SIZE);
      if (rows.length === 0) break;

      totalMessagesDeleted += rows.length;

      const idsByConversation = new Map();
      for (const row of rows) {
        const list = idsByConversation.get(row.conversation_id) || [];
        list.push(row.id);
        idsByConversation.set(row.conversation_id, list);
      }

      if (ioInstance) {
        for (const [conversationId, ids] of idsByConversation) {
          ioInstance.to(conversationId).emit("messages_expired", {
            conversationId,
            ids,
          });
        }
      }

      if (rows.length < BATCH_SIZE) break;
    }

    if (totalMessagesDeleted > 0 || totalImagesDeleted > 0) {
      console.log(
        `Cleanup complete: ${totalMessagesDeleted} messages, ${totalImagesDeleted} images`
      );
    }
  } catch (err) {
    console.error("Expired message cleanup failed:", err.message);
  } finally {
    isRunning = false;
  }
}

function startCleanupJob(io) {
  ioInstance = io || null;

  cleanupExpiredMessages();

  const job = cron.schedule(CLEANUP_CRON, cleanupExpiredMessages, {
    scheduled: false,
  });

  job.start();
  console.log("Expired message cleanup job scheduled (every 1 minute)");

  return () => {
    job.stop();
    job.destroy();
  };
}

module.exports = startCleanupJob;
