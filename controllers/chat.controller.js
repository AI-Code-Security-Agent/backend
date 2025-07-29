const ChatSession = require("../models/chatSession.model");
const ChatMessage = require("../models/chatMessage.model");
const axios = require("axios");
const API_CONFIG = require("../config/api.config");

const llmBaseUrl = API_CONFIG.LLM_API.BASE_URL;
const ragBaseUrl = API_CONFIG.RAG_API.BASE_URL;

// Health check for LLM API
const llmHealthCheck = async (req, res) => {
  try {
    const response = await axios.get(
      `${llmBaseUrl}${API_CONFIG.LLM_API.ENDPOINTS.HEALTH}`
    );

    if (response.status !== 200) {
      return res.status(500).json({
        message: "LLM health check failed",
        isSuccess: false,
        content: null,
      });
    }
    console.log("LLM API is healthy");
    res.status(200).json({
      message: "LLM API is healthy",
      isSuccess: true,
      content: response.data,
    });
  } catch (error) {
    console.error("LLM Health Check Error:", error.message || error);
    throw new Error("Failed to connect to LLM API");
  }
};

// Health check for RAG API
const ragHealthCheck = async () => {
  try {
    const response = await axios.get(
      `${ragBaseUrl}${API_CONFIG.RAG_API.ENDPOINTS.HEALTH}`
    );

    if (response.status !== 200) {
      return res.status(500).json({
        message: "RAG health check failed",
        isSuccess: false,
        content: null,
      });
    }
    console.log("RAG API is healthy");
    res.status(200).json({
      message: "RAG API is healthy",
      isSuccess: true,
      content: response.data,
    });
  } catch (error) {
    // console.error("RAG Health Check Error:", error.message || error);
    throw new Error("Failed to connect to RAG API");
  }
};

// Create new chat session
const createChatSession = async (req, res) => {
  try {
    const { userId, title, model } = req.body;

    const session = new ChatSession({
      user: userId,
      title: title || "New Chat",
      model: model || "llm",
    });

    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Error creating session", detail: err.message });
  }
};

// Get all sessions for a user
const getSessionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await ChatSession.find({ user: userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Error fetching sessions" });
  }
};

// Get messages of a session
const getSessionMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await ChatMessage.find({ session: sessionId }).sort({
      timestamp: 1,
    });
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: "Error fetching messages" });
  }
};

// Send message and get response from FastAPI
const sendMessage = async (req, res) => {
  try {
    let { userId, sessionId, message } = req.body;

    // 1. If sessionId is not provided, create a new session
    if (!sessionId) {
      const newSession = await ChatSession.create({ user: userId });
      sessionId = newSession._id;
    }

    // 2. Save user's message
    const userMessage = await ChatMessage.create({
      session: sessionId,
      role: "user",
      content: message,
    });

    // 3. Get all messages in this session
    const messageDocs = await ChatMessage.find({ session: sessionId }).sort({
      timestamp: 1,
    });
    const formattedMessages = messageDocs.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // 4. Send to FastAPI
    const fastApiResponse = await axios.post(
      `${llmBaseUrl}${API_CONFIG.LLM_API.ENDPOINTS.CHAT}`,
      {
        message,
        session_id: sessionId,
        max_tokens: 1000,
        temperature: 0.7,
      }
    );

    const assistantReply = fastApiResponse.data.response;

    // 5. Save assistant's reply
    const assistantMessage = await ChatMessage.create({
      session: sessionId,
      role: "assistant",
      content: assistantReply,
    });

    // 6. Send response back
    res.status(200).json({
      user: userMessage,
      assistant: assistantMessage,
      session_id: sessionId,
    });
  } catch (err) {
    console.error("Send Message Error:", err.message);
    res
      .status(500)
      .json({ error: "Error processing message", detail: err.message });
  }
};

module.exports = {
  createChatSession,
  getSessionsByUser,
  getSessionMessages,
  sendMessage,
  llmHealthCheck,
  ragHealthCheck,
};
