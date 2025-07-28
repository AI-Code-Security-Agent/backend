const express =  require('express');
const router = express.Router();
const {authenticateToken} = require('../auth/authToken')
const chatController = require("../controllers/chat.controller");

router.post("/sessions", authenticateToken,  chatController.createChatSession);
router.get("/sessions/:userId",authenticateToken, chatController.getSessionsByUser);
router.get("/sessions/:sessionId/messages",authenticateToken, chatController.getSessionMessages);
router.post("/messages", authenticateToken, chatController.sendMessage);

module.exports = router;


