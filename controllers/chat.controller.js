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

    // console.log("LLM Health Check Response:", response.data);

    if (response.status !== 200) {
      return res.status(500).json({
        message: "LLM health check failed",
        isSuccess: false,
        content: null,
      });
    }
    // console.log("LLM API is healthy");
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
    const userId = req.user._id;
    const sessions = await ChatSession.find({ user: userId }).sort({
      createdAt: -1,
    });
    // console.log("sessions :", sessions);
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
const sendMessageToLLM = async (req, res) => {
  try {
    let { session_id, message } = req.body;
    const userId = req.user._id;
    const model = "llm";
    let isNewSession = false;

    // 1. If session_id is not provided, create a new session
    if (!session_id) {
      const newSession = await ChatSession.create({ user: userId });
      session_id = newSession._id;
      isNewSession = true;
    } else {
      // Validate session_id
      const session = await ChatSession.findById(session_id);
      if (!session) {
        return res.status(404).json({
          error: "Session not found",
          detail: "The provided session_id does not exist.",
        });
      }
    }

    // 2. Save user's message
    const userMessage = await ChatMessage.create({
      session: session_id,
      role: "user",
      content: message,
      model: model,
    });

    // 3. If this is a new session, update the title
    if (isNewSession) {
      const maxTitleLength = 20;
      const trimmedTitle = message.trim().substring(0, maxTitleLength);
      await ChatSession.findByIdAndUpdate(session_id, {
        title: trimmedTitle || "New Chat",
      });
    }

    // 4. Get all messages in this session
    const messageDocs = await ChatMessage.find({ session: session_id }).sort({
      timestamp: 1,
    });

    const formattedMessages = messageDocs.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // console.log('formatted messages :', formattedMessages);

    // 5. Send to FastAPI
    const fastApiResponse = await axios.post(
      `${llmBaseUrl}${API_CONFIG.LLM_API.ENDPOINTS.CHAT}`,
      {
        message,
        session_id: session_id,
        max_tokens: 1000,
        temperature: 0.7,
      }
    );

    const assistantReply = fastApiResponse.data.response;

    // 6. Save assistant's reply
    const assistantMessage = await ChatMessage.create({
      session: session_id,
      role: "assistant",
      content: assistantReply,
    });

    // 7. Send response back
    res.status(200).json({
      message_count: messageDocs.length + 1, // +1 for the assistant's message
      response: assistantMessage.content,
      session_id: session_id,
    });
  } catch (err) {
    console.error("Send Message Error:", err.message);
    res
      .status(500)
      .json({ error: "Error processing message", detail: err.message });
  }
};

// Delete chat session and its messages
const deleteChatSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        isSuccess: false,
        message: "Session not found",
        content: null,
      });
    }

    // const pre_messages = await ChatMessage.find({ session: sessionId });
    // console.log("Pre Messages length:", pre_messages.length);

    // Delete session and messages concurrently
    await Promise.all([
      ChatSession.findByIdAndDelete(sessionId),
      ChatMessage.deleteMany({ session: sessionId }),
    ]);

    // const post_messages = await ChatMessage.find({ session: sessionId });
    // console.log("Post Messages length:", post_messages.length);``

    res.status(200).json({
      isSuccess: true,
      message: "Chat session deleted successfully",
      content: null,
    });
  } catch (err) {
    console.error("Delete Session Error:", err.message);
    res.status(500).json({
      error: "Error deleting session",
      detail: err.message,
    });
  }
};

module.exports = {
  createChatSession,
  getSessionsByUser,
  getSessionMessages,
  sendMessageToLLM,
  llmHealthCheck,
  ragHealthCheck,
  deleteChatSession,
};
