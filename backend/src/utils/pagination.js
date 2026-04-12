const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePaginationParams(query) {
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const cursor = query.cursor || null;

  return { limit, cursor };
}

module.exports = { parsePaginationParams };
