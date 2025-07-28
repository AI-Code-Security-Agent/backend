const express =  require('express');
const router = express.Router();
const {authenticateToken} = require('../auth/authToken')
const chatController = require('../controllers/chat.controller');

// Create a new session
router.post('/sessions', authenticateToken, chatController.createChatSession);

// Get all sessions of a user
router.get('/sessions/:userId', authenticateToken, chatController.getChatSessions);

// Get messages of a session
router.get('/sessions/:sessionId/messages', authenticateToken, chatController.getChatMessages);

// Send message in a session
router.post('/messages', authenticateToken, chatController.sendMessage);

module.exports = router;
