const crypto = require("crypto");
const { createClient } = require("redis");

let redisClient;
let connectPromise;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function redis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Email verification storage is not configured");

  if (!redisClient) {
    redisClient = createClient({ url });
    redisClient.on("error", error => {
      console.error("Redis client error:", error.message);
    });
  }

  if (connectPromise) {
    await connectPromise;
  } else if (!redisClient.isOpen) {
    connectPromise = redisClient.connect();
    try {
      await connectPromise;
    } catch (error) {
      redisClient = undefined;
      throw error;
    } finally {
      connectPromise = undefined;
    }
  }

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
