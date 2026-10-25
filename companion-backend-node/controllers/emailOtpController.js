const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const { normalizeEmail, redis, keyFor, otpHash, isOtpMatch } = require("../services/emailOtpService");

const OTP_TTL_SECONDS = 5 * 60;
const VERIFIED_TTL_SECONDS = 10 * 60;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS?.replace(/\s+/g, "");
  if (!user || !pass) throw new Error("Gmail SMTP is not configured");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

exports.send = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ message: "Enter a valid email address." });

  try {
    if (await User.findUserByEmail(email)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const store = redis();
    const cooldownKey = keyFor("send-cooldown", email);
    const cooldown = await store.set(cooldownKey, "1", { nx: true, ex: 60 });
    if (!cooldown) {
      return res.status(429).json({ message: "Please wait a minute before requesting another code." });
    }

    const sendsKey = keyFor("sends-hour", email);
    const sendCount = await store.incr(sendsKey);
    if (sendCount === 1) await store.expire(sendsKey, 60 * 60);
    if (sendCount > MAX_SENDS_PER_HOUR) {
      await store.del(cooldownKey);
      return res.status(429).json({ message: "Too many codes requested. Please try again in an hour." });
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await store.set(keyFor("code", email), otpHash(email, code), { ex: OTP_TTL_SECONDS });
    await store.del(keyFor("verify-attempts", email));

    try {
      await createTransporter().sendMail({
        from: `MediCare <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Your MediCare verification code",
        text: `Your MediCare signup verification code is ${code}. It expires in 5 minutes. If you did not request it, you can ignore this email.`,
      });
    } catch (error) {
      await store.del(keyFor("code", email), cooldownKey);
      console.error("Signup OTP email delivery failed:", error.message);
      return res.status(503).json({ message: "We could not send the verification email. Please try again shortly." });
    }

    return res.json({ message: "Verification code sent. It expires in 5 minutes." });
  } catch (error) {
    console.error("Signup OTP request failed:", error.message);
    return res.status(503).json({ message: "Email verification is temporarily unavailable. Please try again." });
  }
};

exports.verify = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter a valid email address and 6-digit code." });
  }

  try {
    const store = redis();
    const codeKey = keyFor("code", email);
    const storedHash = await store.get(codeKey);
    if (!storedHash) {
      return res.status(400).json({ message: "That code has expired. Request a new one." });
    }

    const attemptsKey = keyFor("verify-attempts", email);
    const attempts = await store.incr(attemptsKey);
    if (attempts === 1) await store.expire(attemptsKey, OTP_TTL_SECONDS);

    if (!isOtpMatch(email, code, storedHash)) {
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        await store.del(codeKey, attemptsKey);
        return res.status(400).json({ message: "Too many incorrect attempts. Request a new code." });
      }
      return res.status(400).json({ message: "That code is incorrect. Please check it and try again." });
    }

    await store.del(codeKey, attemptsKey);
    await store.set(keyFor("verified", email), "1", { ex: VERIFIED_TTL_SECONDS });
    return res.json({ message: "Email verified. You can continue creating your account." });
  } catch (error) {
    console.error("Signup OTP verification failed:", error.message);
    return res.status(503).json({ message: "Email verification is temporarily unavailable. Please try again." });
  }
};
