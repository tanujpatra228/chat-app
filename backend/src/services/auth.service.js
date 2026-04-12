const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } = require("../config/auth");
const userRepo = require("../repositories/user.repository");
const ApiError = require("../utils/ApiError");

async function register({ email, username, password, displayName }) {
  const existingEmail = await userRepo.findByEmail(email);
  if (existingEmail) {
    throw new ApiError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await userRepo.createUser({
    email,
    username,
    passwordHash,
    displayName,
  });

  const token = signToken(user);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
  };
}

async function login({ email, password }) {
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signToken(user);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
  };
}

function signToken(user) {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

module.exports = { register, login };
