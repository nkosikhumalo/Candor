const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authenticate = require("../middleware/auth");
const verifyTurnstile = require("../middleware/turnstile");
const loginAttemptLimiter = require("../middleware/loginAttemptLimiter");

router.post("/register", verifyTurnstile, authController.register);
router.post("/login", loginAttemptLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.get("/session", authenticate, authController.session);
router.post("/logout", authController.logout);

module.exports = router;
