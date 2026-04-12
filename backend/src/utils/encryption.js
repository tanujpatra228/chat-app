const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY = process.env.MESSAGE_ENCRYPTION_KEY
  ? Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY, "hex")
  : null;

function isEnabled() {
  return KEY !== null && KEY.length === 32;
}

function encrypt(plaintext) {
  if (!isEnabled()) return { content: plaintext, iv: null, authTag: null };

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return {
    content: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decrypt(encryptedContent, ivHex, authTagHex) {
  if (!isEnabled() || !ivHex || !authTagHex) return encryptedContent;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedContent, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = { encrypt, decrypt, isEnabled };
