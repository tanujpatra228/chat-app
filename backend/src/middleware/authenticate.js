const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/auth");
const ApiError = require("../utils/ApiError");

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
}

module.exports = authenticate;
