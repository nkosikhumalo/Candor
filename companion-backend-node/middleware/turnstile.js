module.exports = async function verifyTurnstile(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("Turnstile is not configured: TURNSTILE_SECRET_KEY is missing");
    return res.status(503).json({ message: "Account verification is temporarily unavailable. Please try again later." });
  }

  const token = req.body?.turnstileToken;
  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ message: "Please complete the security check and try again." });
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Siteverify returned HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success) {
      return res.status(400).json({ message: "Security verification expired or failed. Please try again." });
    }
    return next();
  } catch (error) {
    console.error("Turnstile Siteverify request failed:", error.message);
    return res.status(503).json({ message: "Could not verify the security check. Please try again." });
  }
};
