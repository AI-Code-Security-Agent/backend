const express =  require('express');
const router = express.Router();
const {authenticateToken} = require('../auth/authToken')
const chatController = require("../controllers/chat.controller");

router.get("/health_rag", chatController.ragHealthCheck);
router.get("/health_llm",  chatController.llmHealthCheck);
router.post("/sessions",  chatController.createChatSession);
router.get("/sessions/:userId", chatController.getSessionsByUser);
router.get("/sessions/:sessionId/messages", chatController.getSessionMessages);
router.post("/messages_llm",authenticateToken, chatController.sendMessageToLLM);

module.exports = router;


    