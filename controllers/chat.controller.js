const ChatSession = require("../models/chatSession.model");
const ChatMessage = require("../models/chatMessage.model");
const DemoSession = require("../models/DemoSession.model");
const axios = require("axios");
const API_CONFIG = require("../config/api.config");
const mongoose = require("mongoose");

const llmBaseUrl = API_CONFIG.LLM_API.BASE_URL;
const ragBaseUrl = API_CONFIG.RAG_API.BASE_URL;

async function getConversationHistory(sessionId) {
  const existing = await ChatMessage.find({ session: sessionId }).sort({ timestamp: 1 });
  return existing.map(m => ({ role: m.role, content: m.content }));
}

// Configure axios defaults with better timeout and retry logic
const createAxiosInstance = (baseURL, timeout = 30000) => {
  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });

  // Add response interceptor for better error handling
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        console.error('Request timeout:', error.message);
        error.message = 'Request timed out. Please try again.';
      } else if (error.code === 'ECONNREFUSED') {
        console.error('Connection refused:', error.message);
        error.message = 'Unable to connect to the service. Please check if the service is running.';
      } else if (error.code === 'ENOTFOUND') {
        console.error('DNS lookup failed:', error.message);
        error.message = 'Service not found. Please check the service URL.';
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

const llmAxios = createAxiosInstance(llmBaseUrl, 60000); // 60 second timeout for LLM
const ragAxios = createAxiosInstance(ragBaseUrl, 60000); // 30 second timeout for RAG

// Health check for LLM API
const llmHealthCheck = async (req, res) => {
  try {
    console.log(`Checking LLM health at: ${llmBaseUrl}${API_CONFIG.LLM_API.ENDPOINTS.HEALTH}`);
    
    const response = await llmAxios.get(API_CONFIG.LLM_API.ENDPOINTS.HEALTH);

    if (response.status !== 200) {
      return res.status(500).json({
        message: "LLM health check failed",
        isSuccess: false,
        content: null,
      });
    }

    res.status(200).json({
      message: "LLM API is healthy",
      isSuccess: true,
      content: response.data,
    });
  } catch (error) {
    console.error("LLM Health Check Error:", error.message || error);
    res.status(500).json({
      message: "Failed to connect to LLM API",
      isSuccess: false,
      content: null,
      error: error.message
    });
  }
};

// Health check for RAG API
const ragHealthCheck = async (req, res) => {
  try {
    console.log(`Checking RAG health at: ${ragBaseUrl}${API_CONFIG.RAG_API.ENDPOINTS.HEALTH}`);
    
    const response = await ragAxios.get(API_CONFIG.RAG_API.ENDPOINTS.HEALTH);

    if (response.status !== 200) {
      return res.status(500).json({
        message: "RAG health check failed",
        isSuccess: false,
        content: null,
      });
    }

    res.status(200).json({
      message: "RAG API is healthy",
      isSuccess: true,
      content: response.data,
    });
  } catch (error) {
    console.error("RAG Health Check Error:", error.message || error);
    res.status(500).json({
      message: "Failed to connect to RAG API",
      isSuccess: false,
      content: null,
      error: error.message
    });
  }
};

const ragQuery = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("RAG Query by user:", userId);
    let { question, k, relevance_threshold, code_focused, session_id } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Ensure session (RAG) exists or create with generated title
    if (!session_id) {
      const title = await generateChatTitle(question).catch(() => createFallbackTitle(question));
      const newSession = await ChatSession.create({ user: userId, title, model: "rag" });
      session_id = newSession._id.toString();
    } else {
      const s = await ChatSession.findById(session_id);
      if (!s) return res.status(404).json({ error: "Session not found" });
    }

    // Get chat history
    const messages = await getConversationHistory(session_id);

    // Save user message immediately
    const userMsg = await ChatMessage.create({
      session: session_id,
      role: "user",
      content: question,
      model: "rag",
    });

    // Call RAG FastAPI with history
    const payload = {
      question,
      k,
      relevance_threshold,
      code_focused,
      session_id,
      messages, // send prior messages for context
    };

    const upstream = await ragAxios.post(API_CONFIG.RAG_API.ENDPOINTS.QUERY, payload);
    const { response, sources } = upstream.data || {};

    // Save assistant message
    const assistMsg = await ChatMessage.create({
      session: session_id,
      role: "assistant",
      content: response || "",
      model: "rag",
      sources: Array.isArray(sources) ? sources : undefined, // optional if schema allows
    });

    // Update chat count
    const total = await ChatMessage.countDocuments({ session: session_id });
    await ChatSession.findByIdAndUpdate(session_id, { chat_count: total });

    // Return aligned shape with LLM (so frontend can reuse)
    return res.status(200).json({
      response: response || "",
      sources: sources || [],
      session_id,
      message_count: total,
      message_id: assistMsg._id,
    });
  } catch (e) {
    console.error("RAG Query Error:", e.message);
    const status = e.response?.status || 500;
    return res.status(status).json({
      error: "RAG query failed",
      detail: e.response?.data || e.message,
    });
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
    console.error("Create Session Error:", err.message);
    res.status(500).json({ 
      error: "Error creating session", 
      detail: err.message 
    });
  }
};

// Get all sessions for a user
const getSessionsByUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const sessions = await ChatSession.find({ user: userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(sessions);
  } catch (err) {
    console.error("Get Sessions Error:", err.message);
    res.status(500).json({ 
      error: "Error fetching sessions",
      detail: err.message 
    });
  }
};

// Get messages of a session
const getSessionMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Chat Session not found" });
    }

    const messages = await ChatMessage.find({ session: sessionId }).sort({
      timestamp: 1,
    });
    
    res.status(200).json({
      session_messages: messages,
      totalMessages: session.chat_count || messages.length, 
    });
  } catch (err) {
    console.error("Get Messages Error:", err.message);
    res.status(500).json({ 
      error: "Error fetching messages",
      detail: err.message 
    });
  }
};

const getDemoMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await DemoSession.findOne({ demoSessionID: sessionId });
    if (!session) {
      return res.status(404).json({ error: "Demo Session not found" });
    }

    const messages = await ChatMessage.find({ session: sessionId }).sort({
      timestamp: 1,
    });

    res.status(200).json({
      session_messages: messages,
      totalMessages: session.chat_count || messages.length, 
    });
  } catch (err) {
    console.error("Get Demo Messages Error:", err.message);
    res.status(500).json({ 
      error: "Error fetching messages in demo session",
      detail: err.message 
    });
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

    // Delete session and messages concurrently
    await Promise.all([
      ChatSession.findByIdAndDelete(sessionId),
      ChatMessage.deleteMany({ session: sessionId }),
    ]);

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

const generateChatTitle = async (message) => {
  try {
    console.log("Generating title for message:", message.substring(0, 50));
    
    const response = await llmAxios.post(
      "/chat/generate-title",
      {
        message: message,
        temperature: 0.3
      },
      {
        timeout: 10000 // 10 second timeout for title generation
      }
    );
    
    const title = response.data?.response || createFallbackTitle(message);
    console.log("Generated title:", title);
    return title;
  } catch (error) {
    console.warn("Title generation failed, using fallback:", error.message);
    return createFallbackTitle(message);
  }
};

const createFallbackTitle = (message) => {
  let title = message.trim();
  title = title.replace(/^(how|what|why|when|where|can|could|would|should|is|are|do|does)\s+/i, '');
  title = title.charAt(0).toUpperCase() + title.slice(1);
  
  if (title.length > 50) {
    title = title.substring(0, 47) + "...";
  }
  
  return title || "New Chat";
};

// Updated sendMessageToLLM function with better error handling
const sendMessageToLLM = async (req, res) => {
  try {
    let {
      session_id,
      message,
      temperature = 0.7,
    } = req.body;

    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: "Message is required",
        detail: "Please provide a valid message."
      });
    }

    const userId = req.user._id;
    const model = "llm";
    let isNewSession = false;

    console.log("Processing message for session:", session_id || "new session");

    // 1. Handle session creation/validation
    if (!session_id) {
      console.log("Creating new session...");
      try {
        const intelligentTitle = await generateChatTitle(message);
        const newSession = await ChatSession.create({ 
          user: userId, 
          title: intelligentTitle 
        });
        session_id = newSession._id;
        isNewSession = true;
        console.log("New session created:", session_id);
      } catch (titleError) {
        console.warn("Title generation failed during session creation:", titleError.message);
        const newSession = await ChatSession.create({ 
          user: userId, 
          title: createFallbackTitle(message)
        });
        session_id = newSession._id;
        isNewSession = true;
      }
    } else {
      // Validate existing session
      const session = await ChatSession.findById(session_id);
      if (!session) {
        return res.status(404).json({
          error: "Session not found",
          detail: "The provided session_id does not exist.",
        });
      }
    }

    const userMessage = await ChatMessage.create({
        session: session_id,
        role: "user",
        content: message,
        model: model,
      });

    // 2. Get existing conversation history
    const existingMessages = await ChatMessage.find({
      session: session_id,
    }).sort({
      timestamp: 1,
    });

    const conversationHistory = existingMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    console.log(`Sending request to LLM API with ${conversationHistory.length} previous messages`);

    // 3. Send to FastAPI with better error handling and logging
    let fastApiResponse;
    try {
      const requestPayload = {
        message,
        session_id: session_id,
        messages: conversationHistory,
        temperature,
      };

      console.log("LLM API Request URL:", `${llmBaseUrl}${API_CONFIG.LLM_API.ENDPOINTS.CHAT}`);
      console.log("LLM API Request payload keys:", Object.keys(requestPayload));

      fastApiResponse = await llmAxios.post(
        API_CONFIG.LLM_API.ENDPOINTS.CHAT,
        requestPayload
      );

      console.log("LLM API Response received, status:", fastApiResponse.status);
    } catch (apiError) {
      console.error("FastAPI request failed:", {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: apiError.response?.data
      });

      // Return more specific error messages
      if (apiError.code === 'ECONNABORTED') {
        return res.status(408).json({
          error: "Request timeout",
          detail: "The AI service is taking too long to respond. Please try again."
        });
      } else if (apiError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: "Service unavailable",
          detail: "The AI service is currently unavailable. Please try again later."
        });
      } else if (apiError.response?.status >= 400) {
        return res.status(apiError.response.status).json({
          error: "AI service error",
          detail: apiError.response.data?.detail || apiError.message
        });
      } else {
        return res.status(500).json({
          error: "Network error",
          detail: "Failed to connect to AI service. Please check your connection and try again."
        });
      }
    }

    const assistantReply = fastApiResponse.data.response;

    if (!assistantReply) {
      console.error("Empty response from FastAPI");
      return res.status(500).json({
        error: "Empty response",
        detail: "The AI service returned an empty response."
      });
    }

    // 4. Save messages to database
    try {
      

      const assistantMessage = await ChatMessage.create({
        session: session_id,
        role: "assistant",
        content: assistantReply,
        model: model,
      });

      // 5. Update message count
      const totalMessages = await ChatMessage.countDocuments({
        session: session_id,
      });

      await ChatSession.findOneAndUpdate(
        { _id: session_id },
        { chat_count: totalMessages }
      );

      console.log("Messages saved successfully. Total messages:", totalMessages);

      // 6. Send successful response
      res.status(200).json({
        message_count: totalMessages,
        response: assistantMessage.content,
        session_id: session_id,
        message_id: assistantMessage._id,
      });

    } catch (dbError) {
      console.error("Database save error:", dbError.message);
      return res.status(500).json({
        error: "Database error",
        detail: "Failed to save messages to database."
      });
    }

  } catch (err) {
    console.error("Send Message Error:", {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    
    res.status(500).json({ 
      error: "Error processing message", 
      detail: err.message || "An unexpected error occurred"
    });
  }
};

// Updated streaming function with better error handling
const sendMessageToLLMStream = async (req, res) => {
  try {
    let {
      session_id,
      message,
      temperature = 0.7,
    } = req.body;

    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: "Message is required",
        detail: "Please provide a valid message."
      });
    }

    const userId = req.user._id;

    // Handle session creation/validation
    if (!session_id) {
      try {
        const intelligentTitle = await generateChatTitle(message);
        const newSession = await ChatSession.create({ 
          user: userId, 
          title: intelligentTitle 
        });
        session_id = newSession._id.toString();
        console.log("New session created for streaming:", session_id);
      } catch (titleError) {
        console.warn("Title generation failed during streaming session creation");
        const title = createFallbackTitle(message);
        const newSession = await ChatSession.create({ 
          user: userId, 
          title 
        });
        session_id = newSession._id.toString();
      }
    } else {
      const session = await ChatSession.findById(session_id);
      if (!session) {
        return res.status(404).json({
          error: "Session not found",
          detail: "The provided session_id does not exist.",
        });
      }
    }

    // Get conversation history
    const existingMessages = await ChatMessage.find({
      session: session_id,
    }).sort({
      timestamp: 1,
    });

    const conversationHistory = existingMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // Save user message immediately
    await ChatMessage.create({
      session: session_id,
      role: "user",
      content: message,
      model: "llm",
    });

    // Prepare streaming request
    const fastapiUrl = `${llmBaseUrl}${
      API_CONFIG.LLM_API.ENDPOINTS.CHAT_STREAM || "/chat/stream"
    }`;

    console.log("Starting streaming request to:", fastapiUrl);

    const response = await llmAxios.post(
      API_CONFIG.LLM_API.ENDPOINTS.CHAT_STREAM || "/chat/stream",
      { 
        session_id, 
        message, 
        messages: conversationHistory,
        temperature 
      },
      { 
        responseType: "stream",
        timeout: 0 // No timeout for streaming
      }
    );

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    let assistantBuffer = "";

    // Stream handler
    response.data.on("data", (chunk) => {
      const str = chunk.toString();
      str.split("\n\n").forEach((evt) => {
        if (!evt.trim()) return;

        if (evt.startsWith("event: token")) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) assistantBuffer += payload.token;
            } catch (parseError) {
              console.warn("Failed to parse token event:", parseError.message);
            }
          }
        } else if (evt.startsWith("event: meta")) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            try {
              const meta = JSON.parse(line.slice(6));
              res.write(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`);
            } catch (parseError) {
              console.warn("Failed to parse meta event:", parseError.message);
            }
          }
        }
      });

      res.write(str);
    });

    // End of stream
    response.data.on("end", async () => {
      try {
        if (assistantBuffer.trim()) {
          await ChatMessage.create({
            session: session_id,
            role: "assistant",
            content: assistantBuffer,
            model: "llm",
          });

          const totalMessages = await ChatMessage.countDocuments({
            session: session_id,
          });

          await ChatSession.findOneAndUpdate(
            { _id: session_id },
            { chat_count: totalMessages }
          );

          console.log("Streaming completed, messages saved");
        }

        res.write(`event: meta\ndata: ${JSON.stringify({ session_id })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (saveError) {
        console.error("Error saving streamed message:", saveError.message);
        res.write(
          `event: error\ndata: ${JSON.stringify({ detail: "Failed to save message" })}\n\n`
        );
        res.end();
      }
    });

    response.data.on("error", (e) => {
      console.error("Streaming error:", e.message);
      res.write(
        `event: error\ndata: ${JSON.stringify({ detail: e.message })}\n\n`
      );
      res.end();
    });

  } catch (err) {
    console.error("Stream proxy error:", {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Streaming failed", 
        detail: err.message 
      });
    } else {
      res.write(
        `event: error\ndata: ${JSON.stringify({ detail: err.message })}\n\n`
      );
      res.end();
    }
  }
};

const regenerateChatTitle = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        isSuccess: false,
        message: "Session not found"
      });
    }

    const firstMessage = await ChatMessage.findOne({
      session: sessionId,
      role: "user"
    }).sort({ timestamp: 1 });

    if (!firstMessage) {
      return res.status(400).json({
        isSuccess: false,
        message: "No user messages found in session"
      });
    }

    const newTitle = await generateChatTitle(firstMessage.content);
    await ChatSession.findByIdAndUpdate(sessionId, { title: newTitle });

    res.status(200).json({
      isSuccess: true,
      message: "Title regenerated successfully",
      title: newTitle
    });
    
  } catch (error) {
    console.error("Title regeneration error:", error);
    res.status(500).json({
      isSuccess: false,
      message: "Failed to regenerate title",
      error: error.message
    });
  }
};

const sendMessageToLLMForDemo = async (req, res) => {
  try {
    let { message, session_id, temperature = 0.7 } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: "Message is required",
        detail: "Please provide a valid message."
      });
    }

    if (!session_id) {
      const newSession = new DemoSession({ 
        demoSessionID: new mongoose.Types.ObjectId().toString() 
      });
      await newSession.save();
      session_id = newSession.demoSessionID;
      console.log("Created new demo session:", session_id);
    } else {
      const session = await DemoSession.findOne({ demoSessionID: session_id });
      if (!session) {
        return res.status(404).json({
          error: "Demo Session not found",
          detail: "The provided session_id does not exist.",
        });
      }
    }
     
    const existingMessages = await ChatMessage.find({
      session: session_id,
    }).sort({
      timestamp: 1,
    });

    const conversationHistory = existingMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    console.log("Sending demo message to LLM API");

    const fastApiResponse = await llmAxios.post(
      API_CONFIG.LLM_API.ENDPOINTS.CHAT,
      {
        message,
        session_id: session_id,
        messages: conversationHistory,
        temperature,
      }
    );

    const assistantReply = fastApiResponse.data.response;

    const userMessage = await ChatMessage.create({
      session: session_id,
      role: "user",
      content: message,
      model: "llm_demo",
    });

    const assistantMessage = await ChatMessage.create({
      session: session_id,
      role: "assistant",
      content: assistantReply,
      model: "llm_demo",
    });

    const totalMessages = await ChatMessage.countDocuments({
      session: session_id,
    });

    await DemoSession.findOneAndUpdate(
      { demoSessionID: session_id },
      { chat_count: totalMessages }
    );

    res.status(200).json({
      message_count: totalMessages,
      response: assistantMessage.content,
      session_id: session_id,
      message_id: assistantMessage._id,
    });

  } catch (err) {
    console.error("Send Message Error in Demo session:", {
      message: err.message,
      code: err.code,
      response: err.response?.data
    });
    
    res.status(500).json({ 
      error: "Error processing message(Demo Mode)", 
      detail: err.message 
    });
  }
};

// Add feedback for messages
const updateMessageFeedback = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { feedback } = req.body;

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!["like", "dislike", null].includes(feedback)) {
      return res.status(400).json({ error: "Invalid feedback value" });
    }

    await ChatMessage.findByIdAndUpdate(
      messageId,
      { feedback },
      { new: true }
    );

    res.status(200).json({ message: "Feedback updated successfully" });

  } catch (error) {
    console.error("Update Feedback Error:", error.message);
    res.status(500).json({ 
      error: "Error updating feedback", 
      detail: error.message 
    });
  }
};

// APIs for streaming responses
const ragQueryStream = async (req, res) => {
  try {
    const userId = req.user._id;
    let { question, k, relevance_threshold, code_focused, session_id } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Ensure session
    if (!session_id) {
      const title = await generateChatTitle(question).catch(() => createFallbackTitle(question));
      const newSession = await ChatSession.create({ user: userId, title, model: "rag" });
      session_id = newSession._id.toString();
    } else {
      const s = await ChatSession.findById(session_id);
      if (!s) return res.status(404).json({ error: "Session not found" });
    }

    // Load prior history
    const messages = await getConversationHistory(session_id);

    // Save user message immediately
    await ChatMessage.create({
      session: session_id,
      role: "user",
      content: question,
      model: "rag",
    });

    // Prepare upstream payload
    const payload = { question, k, relevance_threshold, code_focused, session_id, messages };

    // Fire upstream stream
    const upstream = await ragAxios.post(API_CONFIG.RAG_API.ENDPOINTS.QUERY_STREAM, payload, {
      responseType: "stream",
      timeout: 0,
    });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let assistantBuffer = "";

    upstream.data.on("data", (chunk) => {
      const str = chunk.toString();

      // collect tokens for persistence
      str.split("\n\n").forEach((evt) => {
        if (!evt.trim()) return;
        if (evt.startsWith("event: token")) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) assistantBuffer += payload.token;
            } catch {}
          }
        }
      });

      // proxy through
      res.write(str);
    });

    upstream.data.on("end", async () => {
      try {
        if (assistantBuffer.trim()) {
          await ChatMessage.create({
            session: session_id,
            role: "assistant",
            content: assistantBuffer,
            model: "rag",
          });
          const total = await ChatMessage.countDocuments({ session: session_id });
          await ChatSession.findByIdAndUpdate(session_id, { chat_count: total });

          // let client know session meta
          res.write(`event: meta\ndata: ${JSON.stringify({ session_id, message_count: total })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ detail: "Failed to save RAG message" })}\n\n`);
        res.end();
      }
    });

    upstream.data.on("error", (err) => {
      res.write(`event: error\ndata: ${JSON.stringify({ detail: err.message })}\n\n`);
      res.end();
    });

  } catch (e) {
    console.error("RAG Stream Error:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "RAG stream failed", detail: e.message });
    } else {
      res.end();
    }
  }
};

const sendMessageToDemoLLMStream = async (req, res) => {
  try {
    let {
      session_id,
      message,
      temperature = 0.7,
      messages,
    } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: "Message is required",
        detail: "Please provide a valid message."
      });
    }

    const fastapiUrl = `${llmBaseUrl}${
      API_CONFIG.LLM_API.ENDPOINTS.CHAT_STREAM || "/chat/stream"
    }`;

    console.log("Starting demo streaming request");

    const response = await llmAxios.post(
      API_CONFIG.LLM_API.ENDPOINTS.CHAT_STREAM || "/chat/stream",
      { message, messages, temperature },
      { responseType: "stream", timeout: 0 }
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let assistantBuffer = "";

    response.data.on("data", (chunk) => {
      const str = chunk.toString();
      str.split("\n\n").forEach((evt) => {
        if (!evt.trim()) return;
        if (evt.startsWith("event: token")) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) assistantBuffer += payload.token;
            } catch (parseError) {
              console.warn("Failed to parse demo token event:", parseError.message);
            }
          }
        }
      });
      res.write(str);
    });

    response.data.on("end", () => {
      console.log("Demo streaming completed");
      res.write("data: [DONE]\n\n");
      res.end();
    });

    response.data.on("error", (e) => {
      console.error("Demo streaming error:", e.message);
      res.write(
        `event: error\ndata: ${JSON.stringify({ detail: e.message })}\n\n`
      );
      res.end();
    });
  } catch (err) {
    console.error("Demo stream proxy error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Demo streaming failed", 
        detail: err.message 
      });
    } else {
      res.end();
    }
  }
};

module.exports = {
  createChatSession,
  getSessionsByUser,
  getSessionMessages,
  sendMessageToLLM,
  sendMessageToLLMStream,
  llmHealthCheck,
  ragHealthCheck,
  deleteChatSession,
  sendMessageToDemoLLMStream,
  ragQuery,
  ragQueryStream,
  sendMessageToLLMForDemo,
  getDemoMessages,
  updateMessageFeedback,
  regenerateChatTitle,
};