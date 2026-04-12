const messageRepo = require("../repositories/message.repository");

const CLEANUP_INTERVAL_MS = 60000; // every 1 minute

function startCleanupJob() {
  async function cleanup() {
    try {
      const count = await messageRepo.deleteExpiredMessages();
      if (count > 0) {
        console.log(`Cleaned up ${count} expired messages`);
      }
    } catch (err) {
      console.error("Expired message cleanup failed:", err.message);
    }
  }

  // Run once on startup
  cleanup();

  // Then run on interval
  const interval = setInterval(cleanup, CLEANUP_INTERVAL_MS);

  return () => clearInterval(interval);
}

module.exports = startCleanupJob;
