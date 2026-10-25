const User = require("../models/userModel");
const { normalizeEmail } = require("../services/emailOtpService");
const { proxyToJava } = require("../services/proxyService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.send = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  try {
    if (await User.findUserByEmail(email)) {
      return res.status(409).json({ message: "An account already exists with this email." });
    }
    req.body.email = email;
    return proxyToJava(req, res, "/api/email-otp/send");
  } catch (error) {
    console.error("Could not check signup email before sending OTP:", error.message);
    return res.status(503).json({ message: "Email verification is temporarily unavailable. Please try again." });
  }
};

exports.verify = (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter a valid email address and the 6-digit code." });
  }

  req.body = { email, code };
  return proxyToJava(req, res, "/api/email-otp/verify");
};
