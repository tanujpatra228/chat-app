const messageRepo = require("../repositories/message.repository");
const { deleteMultipleImages } = require("../services/upload.service");

const CLEANUP_INTERVAL_MS = 60000; // every 1 minute

function startCleanupJob() {
  async function cleanup() {
    try {
      // Delete Cloudinary images before removing DB rows
      const publicIds = await messageRepo.getExpiredImagePublicIds();
      if (publicIds.length > 0) {
        await deleteMultipleImages(publicIds);
      }

      const count = await messageRepo.deleteExpiredMessages();
      if (count > 0) {
        console.log(`Cleaned up ${count} expired messages`);
      }
    } catch (err) {
      console.error("Expired message cleanup failed:", err.message);
    }
  }

  cleanup();
  const interval = setInterval(cleanup, CLEANUP_INTERVAL_MS);

  return () => clearInterval(interval);
}

module.exports = startCleanupJob;
