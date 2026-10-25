const { normalizeEmail, redis, keyFor } = require("../services/emailOtpService");

module.exports = async function requireVerifiedEmail(req, res, next) {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ message: "Enter and verify your email address before creating an account." });

  // Temporary presentation-only bypass. It is disabled unless explicitly set
  // in the Node server environment; Turnstile and all other signup checks remain.
  if (process.env.DEMO_EMAIL_VERIFICATION_BYPASS === "true") {
    console.warn("[auth] Presentation demo: email verification bypass is enabled.");
    return next();
  }

  try {
    const store = await redis();
    const verified = await store.get(keyFor("verified", email));
    if (verified !== "1") {
      return res.status(400).json({ message: "Verify your email address before creating your account." });
    }
    return next();
  } catch (error) {
    console.error("Signup email verification check failed:", error.message);
    return res.status(503).json({ message: "Email verification is temporarily unavailable. Please try again." });
  }
};
