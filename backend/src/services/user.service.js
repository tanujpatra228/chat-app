const userRepo = require("../repositories/user.repository");
const ApiError = require("../utils/ApiError");

async function getProfile(userId) {
  const user = await userRepo.findByIdWithEmail(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    isOnline: user.is_online,
    lastSeen: user.last_seen,
    createdAt: user.created_at,
  };
}

async function getPublicProfile(userId) {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    isOnline: user.is_online,
    lastSeen: user.last_seen,
  };
}

async function searchUsers(query, currentUserId) {
  if (!query || query.trim().length < 1) {
    return [];
  }
  return userRepo.searchByUsername(query.trim(), currentUserId);
}

module.exports = { getProfile, getPublicProfile, searchUsers };
