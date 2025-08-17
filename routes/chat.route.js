const express =  require('express');
const router = express.Router();
const {authenticateToken} = require('../auth/authToken')
const chatController = require("../controllers/chat.controller");

router.get("/health_rag",authenticateToken, chatController.ragHealthCheck);
router.get("/health_llm",authenticateToken,  chatController.llmHealthCheck);
router.post("/sessions",authenticateToken,  chatController.createChatSession);
router.get("/sessions",authenticateToken, chatController.getSessionsByUser);
router.get("/sessions/:sessionId/messages",authenticateToken, chatController.getSessionMessages);
router.post("/messages_llm",authenticateToken, chatController.sendMessageToLLM);
router.post("/delete_session/:sessionId",authenticateToken, chatController.deleteChatSession);
router.post("/stream", authenticateToken, chatController.sendMessageToLLMStream);

module.exports = router;


    