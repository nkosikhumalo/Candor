/**
 * RAG / Policy Q&A Routes
 *
 * Members and beneficiaries use the regular RAG endpoints. Registered
 * pre-members use /pre-member-chat for general policy guidance.
 * Deceased flag does NOT block read-only Q&A — claims guidance is still
 * available in Claims Support mode.
 */

const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const { memberChat, preMemberChat } = require("../middleware/ragAccess");
const { proxyToJava } = require("../services/proxyService");

router.post("/query", authenticate, memberChat, (req, res) =>
    proxyToJava(req, res, "/api/rag/query")
);

router.post("/chat", authenticate, memberChat, (req, res) =>
    proxyToJava(req, res, "/api/rag/chat")
);

router.post("/pre-member-chat", authenticate, preMemberChat, (req, res) =>
    proxyToJava(req, res, "/api/rag/chat")
);

module.exports = router;
