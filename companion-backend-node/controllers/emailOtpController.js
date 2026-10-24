const crypto = require("crypto");
const db = require("../database/db");

function normalizedEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashOtp(email, code) {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || process.env.MOCK_JWT_SIGNING_SECRET;
  if (!secret) throw new Error("OTP_HASH_SECRET or JWT secret must be configured");
  return crypto.createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

exports.send = async (req, res) => {
  const email = normalizedEmail(req.body?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("Registration email OTP is not configured: RESEND_API_KEY is missing");
    return res.status(503).json({ message: "Email verification is temporarily unavailable." });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    const saved = await db.saveRegistrationOtp(email, hashOtp(email, code));
    if (!saved.rowCount) {
      return res.status(429).json({ message: "Please wait a minute before requesting another code." });
    }

    const from = process.env.RESEND_FROM_EMAIL || "MediCare <onboarding@resend.dev>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your MediCare verification code",
        text: `Your MediCare verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
        html: `<p>Your MediCare verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const providerError = await response.text().catch(() => "");
      console.error("Resend rejected registration OTP email:", response.status, providerError.slice(0, 1000));
      return res.status(502).json({ message: "We couldn't send the verification email. Please try again shortly." });
    }
    return res.json({ message: "If this address can be verified, a code has been sent." });
  } catch (error) {
    console.error("Registration OTP send failed:", error.message);
    return res.status(503).json({ message: "We couldn't send the verification email. Please try again." });
  }
};

exports.verify = async (req, res) => {
  const email = normalizedEmail(req.body?.email);
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter the email address and 6-digit code." });
  }
  try {
    const valid = await db.verifyRegistrationOtp(email, hashOtp(email, code));
    if (!valid) return res.status(400).json({ message: "The code is invalid or expired. Request a new code and try again." });
    return res.json({ message: "Email verified. You can continue." });
  } catch (error) {
    console.error("Registration OTP verification failed:", error.message);
    return res.status(500).json({ message: "We couldn't verify the code. Please try again." });
  }
};
