const ogs = require("open-graph-scraper");

const URL_REGEX = /https?:\/\/[^\s<>"']+/i;
const FETCH_TIMEOUT_MS = 5000;

function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

async function fetchPreview(url) {
  try {
    const { error, result } = await ogs({
      url,
      timeout: FETCH_TIMEOUT_MS,
      fetchOptions: {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; ChatAppBot/1.0; +https://chat-app)",
        },
      },
    });

    if (error || !result.success) return null;

    const image =
      result.ogImage?.[0]?.url ||
      result.twitterImage?.[0]?.url ||
      null;

    return {
      url,
      title: result.ogTitle || result.twitterTitle || result.dcTitle || null,
      description:
        result.ogDescription ||
        result.twitterDescription ||
        result.dcDescription ||
        null,
      image,
    };
  } catch {
    return null;
  }
}

module.exports = { extractFirstUrl, fetchPreview };
