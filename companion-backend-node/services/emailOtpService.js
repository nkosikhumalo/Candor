const crypto = require("crypto");
const { Redis } = require("@upstash/redis");

let redisClient;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Email verification storage is not configured");
  if (!redisClient) redisClient = new Redis({ url, token });
  return redisClient;
}

function keyFor(kind, email) {
  const emailHash = crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
  return `signup-email:${kind}:${emailHash}`;
}

function otpHash(email, code) {
  const secret = process.env.JWT_SECRET || process.env.MOCK_JWT_SIGNING_SECRET;
  if (!secret) throw new Error("OTP signing secret is not configured");
  return crypto.createHmac("sha256", secret).update(`${normalizeEmail(email)}:${code}`).digest("hex");
}

function isOtpMatch(email, code, storedHash) {
  if (typeof storedHash !== "string") return false;
  const expected = Buffer.from(otpHash(email, code), "hex");
  const actual = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { normalizeEmail, redis, keyFor, otpHash, isOtpMatch };
