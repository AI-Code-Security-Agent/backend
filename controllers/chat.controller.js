const ChatSession = require("../models/chatSession.model");
const ChatMessage = require("../models/chatMessage.model");
const axios = require("axios");

// Create new chat session
const createChatSession = async (req, res) => {
  try {
    const { userId, title, model } = req.body;

    const session = new ChatSession({
      user: userId,
      title: title || "New Chat",
      model: model || "llm"
    });

    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: "Error creating session", detail: err.message });
  }
};

// Get all sessions for a user
const getSessionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await ChatSession.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Error fetching sessions" });
  }
};

// Get messages of a session
const getSessionMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await ChatMessage.find({ session: sessionId }).sort({ timestamp: 1 });
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: "Error fetching messages" });
  }
};

// Send message and get response from FastAPI
const sendMessage = async (req, res) => {
  try {
    let { userId, sessionId, message } = req.body;

    // If sessionId is not provided, create a new session
    let newSessionCreated = false;
    if (!sessionId) {
      const newSession = new ChatSession({
        user: userId,
        title: "New Chat",
        model: "llm"
      });
      await newSession.save();
      sessionId = newSession._id.toString();
      newSessionCreated = true;
    }

    // Save user message
    const userMessage = await ChatMessage.create({
      session: sessionId,
      role: "user",
      content: message
    });

    // Fetch full message history for the session
    const messageDocs = await ChatMessage.find({ session: sessionId }).sort({ timestamp: 1 });

    const formattedMessages = messageDocs.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));

    // Call FastAPI LLM backend
    const fastApiResponse = await axios.post("http://localhost:8001/chat", {
      message,
      session_id: sessionId,
      max_tokens: 1000,
      temperature: 0.7
    });

    const assistantReply = fastApiResponse.data.response;

    // Save assistant message
    const assistantMessage = await ChatMessage.create({
      session: sessionId,
      role: "assistant",
      content: assistantReply
    });

    res.status(200).json({
      user: userMessage,
      assistant: assistantMessage,
      session_id: sessionId,
      new_session: newSessionCreated
    });

  } catch (err) {
    console.error("Send Message Error:", err.message);
    res.status(500).json({ error: "Error processing message", detail: err.message });
  }
};

module.exports = {
  createChatSession,
  getSessionsByUser,
  getSessionMessages,
  sendMessage
};
