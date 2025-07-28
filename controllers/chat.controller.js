// controllers/chatController.js

const ChatSession = require('../models/chatSession.model');
const ChatMessage = require('../models/chatMessage.model');
const User = require('../models/user.model');
const axios = require('axios'); 

// Create new chat session
const createChatSession = async (req, res) => {
  try {
    const { userId, title, model = 'llm' } = req.body;

    const session = new ChatSession({
      user: userId,
      title,
      model
    });

    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
};

// Get all sessions for a user
const getChatSessions = async (req, res) => {
  try {
    const { userId } = req.params;

    const sessions = await ChatSession.find({ user: userId })
      .sort({ createdAt: -1 });

    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get chat sessions' });
  }
};

// Get messages for a session
const getChatMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const messages = await ChatMessage.find({ session: sessionId }).sort({ timestamp: 1 });

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

// Send message and get assistant reply
const sendMessage = async (req, res) => {
  try {
    const { sessionId, userId, message } = req.body;

    // 1. Save user message
    const userMsg = new ChatMessage({
      session: sessionId,
      role: 'user',
      content: message
    });
    await userMsg.save();

    // 2. Prepare messages history (optional: use context)
    const messages = await ChatMessage.find({ session: sessionId })
      .sort({ timestamp: 1 });

    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 3. Call LLM endpoint (replace this with your actual API URL/token)
    const response = await axios.post('https://api.your-llm-provider.com/chat', {
      messages: formattedMessages
    });

    const assistantReply = response.data.reply; // adapt this to your API's structure

    // 4. Save assistant message
    const assistantMsg = new ChatMessage({
      session: sessionId,
      role: 'assistant',
      content: assistantReply
    });
    await assistantMsg.save();

    // 5. Return updated messages
    res.status(200).json([userMsg, assistantMsg]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

module.exports = {
  createChatSession,
  getChatSessions,
  getChatMessages,
  sendMessage
};