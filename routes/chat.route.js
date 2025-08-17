const express =  require('express');
const router = express.Router();
const {authenticateToken} = require('../auth/authToken')
const chatController = require("../controllers/chat.controller");

// Health
router.get("/health_rag", authenticateToken, chatController.ragHealthCheck);
router.get("/health_llm", authenticateToken, chatController.llmHealthCheck);

// Sessions (LLM persistence)
router.post("/sessions", authenticateToken, chatController.createChatSession);
router.get("/sessions", authenticateToken, chatController.getSessionsByUser);
router.get("/sessions/:sessionId/messages", authenticateToken, chatController.getSessionMessages);
router.post("/delete_session/:sessionId", authenticateToken, chatController.deleteChatSession);

// LLM
router.post("/messages_llm", authenticateToken, chatController.sendMessageToLLM);
router.post("/stream", authenticateToken, chatController.sendMessageToLLMStream);
router.post("/demo/stream", chatController.sendMessageToDemoLLMStream);

// RAG
router.post("/query", authenticateToken, chatController.ragQuery);
router.post("/query/stream", authenticateToken, chatController.ragQueryStream);

module.exports = router;


    