const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authenticate = require("../middleware/auth");
const verifyTurnstile = require("../middleware/turnstile");
const emailOtpController = require("../controllers/emailOtpController");

router.post("/email-otp/send", emailOtpController.send);
router.post("/email-otp/verify", emailOtpController.verify);
router.post("/register", verifyTurnstile, authController.register);
router.post("/login", verifyTurnstile, authController.login);
router.post("/refresh", authController.refresh);
router.get("/session", authenticate, authController.session);
router.post("/logout", authController.logout);

module.exports = router;
