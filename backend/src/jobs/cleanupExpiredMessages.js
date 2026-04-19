const cron = require("node-cron");
const messageRepo = require("../repositories/message.repository");
const { deleteMultipleImages } = require("../services/upload.service");

const CLEANUP_CRON = "*/1 * * * *"; // every 1 minute
const BATCH_SIZE = 50; // process 50 messages at a time
let isRunning = false; // prevent overlapping executions

async function cleanupExpiredMessages() {
  if (isRunning) {
    console.log("Cleanup job already running, skipping...");
    return;
  }

  isRunning = true;
  let totalCleaned = 0;
  let totalImagesDeleted = 0;

  try {
    while (true) {
      // Get batch of expired image public IDs
      const publicIds = await messageRepo.getExpiredImagePublicIds(BATCH_SIZE);
      if (publicIds.length === 0) break;

      // Delete images from Cloudinary
      if (publicIds.length > 0) {
        await deleteMultipleImages(publicIds);
        totalImagesDeleted += publicIds.length;
        console.log(`Deleted ${publicIds.length} expired images from Cloudinary`);
      }

      // Delete expired messages from database
      const deletedCount = await messageRepo.deleteExpiredMessages(BATCH_SIZE);
      totalCleaned += deletedCount;

      console.log(`Cleaned up ${deletedCount} expired messages from database`);

      // If we got fewer results than batch size, we're done
      if (publicIds.length < BATCH_SIZE) break;
    }

    if (totalCleaned > 0 || totalImagesDeleted > 0) {
      console.log(`Cleanup complete: ${totalCleaned} messages, ${totalImagesDeleted} images`);
    }
  } catch (err) {
    console.error("Expired message cleanup failed:", err.message);
  } finally {
    isRunning = false;
  }
}

function startCleanupJob() {
  // Run cleanup immediately on startup
  cleanupExpiredMessages();

  // Schedule cron job to run every minute
  const job = cron.schedule(CLEANUP_CRON, cleanupExpiredMessages, {
    scheduled: false // don't start automatically
  });

  job.start();
  console.log("Expired message cleanup job scheduled (every 1 minute)");

  // Return function to stop the job
  return () => {
    job.stop();
    job.destroy();
  };
}

module.exports = startCleanupJob;
