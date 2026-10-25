const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attemptsByAccount = new Map();

// In-memory lockout for this single-instance school project. A successful login
// clears the counter; after five failures, that account identifier is paused for 15 minutes.
module.exports = function loginAttemptLimiter(req, res, next) {
  const identifier = typeof (req.body?.identifier || req.body?.email) === "string"
    ? (req.body.identifier || req.body.email).trim().toLowerCase()
    : "";
  const key = identifier || "__missing_identifier__";
  const now = Date.now();
  let record = attemptsByAccount.get(key);

  if (record?.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({ message: "Too many failed login attempts. Please try again in 15 minutes." });
  }

  if (record && now - record.windowStartedAt >= WINDOW_MS) {
    attemptsByAccount.delete(key);
    record = undefined;
  }

  res.once("finish", () => {
    if (res.statusCode === 401) {
      const current = attemptsByAccount.get(key) || { failures: 0, windowStartedAt: Date.now() };
      current.failures += 1;
      if (current.failures >= MAX_FAILED_ATTEMPTS) {
        current.lockedUntil = Date.now() + WINDOW_MS;
      }
      attemptsByAccount.set(key, current);

      // Keep the temporary in-memory store bounded if many arbitrary emails are tried.
      if (attemptsByAccount.size > 5000) {
        const oldestKey = attemptsByAccount.keys().next().value;
        attemptsByAccount.delete(oldestKey);
      }
    } else if (res.statusCode < 400) {
      attemptsByAccount.delete(key);
    }
  });

  return next();
};
