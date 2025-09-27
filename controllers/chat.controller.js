const ChatSession = require("../models/chatSession.model");
const ChatMessage = require("../models/chatMessage.model");
const DemoSession = require("../models/DemoSession.model");
const axios = require("axios");
const API_CONFIG = require("../config/api.config");
const mongoose = require("mongoose");

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
const ragHealthCheck = async (req, res) => {
  // ✅ Added missing parameters
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

    // console.log("RAG API is healthy");
    res.status(200).json({
      message: "RAG API is healthy",
      isSuccess: true,
      content: response.data,
    });
  } catch (error) {
    // console.error("RAG Health Check Error:", error.message || error);  // ✅ Added error logging
    res.status(500).json({
      // ✅ Added proper error response
      message: "Failed to connect to RAG API",
      isSuccess: false,
      content: null,
    });
  }
};

const ragQuery = async (req, res) => {
  try {
    const response = await axios.post(
      `${ragBaseUrl}${API_CONFIG.RAG_API.ENDPOINTS.QUERY}`,
      req.body,
      { timeout: 60000 }
    );
    res.status(200).json(response.data);
  } catch (e) {
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
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Error fetching sessions" });
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

    if (!messages) {
      return res.status(404).json({ error: "No messages found" });
    }
    
    res.status(200).json({
      session_messages: messages,
      totalMessages: session.chat_count, 
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching messages" });
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

    if (!messages) {
      return res.status(404).json({ error: "No messages found" });
    }

    res.status(200).json({
      session_messages: messages,
      totalMessages: session.chat_count, 
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching messages in demo session" });
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

// Updated sendMessageToLLM function with max_tokens removed
const sendMessageToLLM = async (req, res) => {
  try {
    let {
      session_id,
      message,
      temperature = 0.7,
    } = req.body;
    const userId = req.user._id;
    const model = "llm";
    let isNewSession = false;

    console.log("session id :", session_id);

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

    // 2. Get existing conversation history from database
    const existingMessages = await ChatMessage.find({
      session: session_id,
    }).sort({
      timestamp: 1,
    });

    // 3. Format existing messages for FastAPI
    const conversationHistory = existingMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // 4. If this is a new session, update the title based on first message
    if (isNewSession) {
      const maxTitleLength = 50;
      const trimmedTitle = message.trim().substring(0, maxTitleLength);
      await ChatSession.findByIdAndUpdate(session_id, {
        title: trimmedTitle || "New Chat",
      });
    }

    // 5. Send to FastAPI with conversation history (removed max_tokens)
    const fastApiResponse = await axios.post(
      `${llmBaseUrl}${API_CONFIG.LLM_API.ENDPOINTS.CHAT}`,
      {
        message,
        session_id: session_id,
        messages: conversationHistory, // Include conversation history
        temperature,
      }
    );

    const assistantReply = fastApiResponse.data.response;

    // 6. Save user message to database
    const userMessage = await ChatMessage.create({
      session: session_id,
      role: "user",
      content: message,
      model: model,
    });

    // 7. Save assistant's reply to database
    const assistantMessage = await ChatMessage.create({
      session: session_id,
      role: "assistant",
      content: assistantReply,
      model: model,
    });

    // 8. Get updated message count
    const totalMessages = await ChatMessage.countDocuments({
      session: session_id,
    });

    await ChatSession.findOneAndUpdate(
      { _id: session_id },
      { chat_count: totalMessages }
    );

    // 9. Send response back
    res.status(200).json({
      message_count: totalMessages,
      response: assistantMessage.content,
      session_id: session_id,
      message_id: assistantMessage._id,
    });
  } catch (err) {
    console.error("Send Message Error:", err.message);
    if (err.response) {
      console.error("FastAPI Error Response:", err.response.data);
    }
    res
      .status(500)
      .json({ error: "Error processing message", detail: err.message });
  }
};

// Updated streaming function with max_tokens removed
const sendMessageToLLMStream = async (req, res) => {
  try {
    let {
      session_id,
      message,
      temperature = 0.7,
    } = req.body;
    const userId = req.user._id;

    // ---------- Ensure session exists ----------
    if (!session_id) {
      const newSession = await ChatSession.create({ user: userId });
      session_id = newSession._id.toString();
      const title = (message || "New Chat").slice(0, 50) || "New Chat";
      await ChatSession.findByIdAndUpdate(session_id, { title });
    } else {
      const session = await ChatSession.findById(session_id);
      if (!session) {
        return res.status(404).json({
          error: "Session not found",
          detail: "The provided session_id does not exist.",
        });
      }
    }

    // ---------- Get conversation history ----------
    const existingMessages = await ChatMessage.find({
      session: session_id,
    }).sort({
      timestamp: 1,
    });

    // Format conversation history for FastAPI
    const conversationHistory = existingMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // ---------- Save user message immediately ----------
    await ChatMessage.create({
      session: session_id,
      role: "user",
      content: message,
      model: "llm",
    });

    // ---------- Prepare request to FastAPI streaming endpoint (removed max_tokens) ----------
    const fastapiUrl = `${llmBaseUrl}${
      API_CONFIG.LLM_API.ENDPOINTS.CHAT_STREAM || "/chat/stream"
    }`;

    const response = await axios.post(
      fastapiUrl,
      { 
        session_id, 
        message, 
        messages: conversationHistory, // Include conversation history
        temperature 
      },
      { responseType: "stream" }
    );

    // ---------- Set SSE headers ----------
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let assistantBuffer = "";

    // ---------- STREAM HANDLER ----------
    response.data.on("data", (chunk) => {
      const str = chunk.toString();
      // Split into individual SSE events
      str.split("\n\n").forEach((evt) => {
        if (!evt.trim()) return;

        // ---------- Handle token events ----------
        if (evt.startsWith("event: token")) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            const payload = JSON.parse(line.slice(6));
            if (payload.token) assistantBuffer += payload.token;
          }
        }

        // ---------- Handle meta events ----------
        else if (evt.startsWith("event: meta")) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            const meta = JSON.parse(line.slice(6));
            // Send meta to frontend immediately
            res.write(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`);
          }
        }
      });

      // Write raw chunk to frontend
      res.write(str);
    });

    // ---------- End of stream ----------
    response.data.on("end", async () => {
      if (assistantBuffer.trim()) {
        await ChatMessage.create({
          session: session_id,
          role: "assistant",
          content: assistantBuffer,
          model: "llm",
        });

        // Update message count
        const totalMessages = await ChatMessage.countDocuments({
          session: session_id,
        });

        await ChatSession.findOneAndUpdate(
          { _id: session_id },
          { chat_count: totalMessages }
        );
      }

      res.write(`event: meta\ndata: ${JSON.stringify({ session_id })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    response.data.on("error", (e) => {
      res.write(
        `event: error\ndata: ${JSON.stringify({ detail: e.message })}\n\n`
      );
      res.end();
    });
  } catch (err) {
    console.error("Stream proxy error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming failed", detail: err.message });
    } else {
      res.end();
    }
  }
};

const sendMessageToLLMForDemo = async (req, res) => {
  try {
    let { message, session_id, temperature = 0.7 } = req.body;

    // console.log('demo session request body:', req.body);

    if (!session_id) {
      const newSession = new DemoSession({ demoSessionID: new mongoose.Types.ObjectId().toString() });
      await newSession.save();
      session_id = newSession.demoSessionID;
      // console.log("Created new demo session:", session_id);
    }else{
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

     // Helper function to format messages for LLM API
    const formatMessagesForLLM = (messages) => {
      return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));
    };

    const conversationHistory = formatMessagesForLLM(existingMessages);

    // Removed max_tokens from demo function
    const fastApiResponse = await axios.post(
      `${llmBaseUrl}${API_CONFIG.LLM_API.ENDPOINTS.CHAT}`,
      {
        message,
        session_id: session_id,
        // messages: conversationHistory,
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
      session:  session_id,
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
    // console.log("FastAPI response for demo:", assistantReply);

   

  } catch (err) {
    console.error("Send Message Error in Demo session:", err.message);
    if (err.response) {
      console.error("FastAPI Error Response(Demo Mode):", err.response.data);
    }
    res
      .status(500)
      .json({ error: "Error processing message(Demo Mode)", detail: err.message });
  }
};

// Add feedback for messages
const updateMessageFeedback = async (req, res ) => {
  try {
    const { messageId } = req.params;
    const { feedback } = req.body; // 'like' ,'dislike' or null

    const message = await ChatMessage.findById(messageId);

    if(!message){
      return res.status(404).json({ error: "Message not found" });
    }

    if (!["like", "dislike",null].includes(feedback)) {
      return res.status(400).json({ error: "Invalid feedback value" });
    }

    await ChatMessage.findByIdAndUpdate(
      messageId,
      { feedback },
      { new: true }
    );

    res.status(200).json({ message: "Feedback updated successfully" });

  } catch (error) {
    console
    res.status(500).json({ error: "Error updating feedback", detail: error.message });
  }
}

// apis for streaming responses

const ragQueryStream = async (req, res) => {
  try {
    const upstream = await axios.post(
      `${ragBaseUrl}${API_CONFIG.RAG_API.ENDPOINTS.QUERY_STREAM}`,
      req.body,
      { responseType: "stream", timeout: 0 }
    );

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    upstream.data.on("data", (chunk) => {
      res.write(chunk);
    });
    upstream.data.on("end", () => {
      // ensure DONE
      res.write("data: [DONE]\n\n");
      res.end();
    });
    upstream.data.on("error", (err) => {
      res.write(
        `event: error\ndata: ${JSON.stringify({ detail: err.message })}\n\n`
      );
      res.end();
    });
  } catch (e) {
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

    // // Ensure session existence like your JSON path:
    // if (!session_id) {
    //   const newSession = await ChatSession.create();
    //   session_id = newSession._id.toString();
    //   console.log("Created new chat session:", session_id);

    //   // Set a short title based on first message
    //   const title = (message || "New Chat").slice(0, 50) || "New Chat";
    //   await ChatSession.findByIdAndUpdate(session_id, { title });
    // } else {
    //   const session = await ChatSession.findById(session_id);
    //   if (!session) {
    //     return res.status(404).json({ error: "Session not found", detail: "The provided session_id does not exist." });
    //   }
    // }

    // Save user message immediately (so history exists for future requests)

    // Prepare request to FastAPI streaming endpoint (removed max_tokens)
    const fastapiUrl = `${llmBaseUrl}${
      API_CONFIG.LLM_API.ENDPOINTS.CHAT_STREAM || "/chat/stream"
    }`;

    const response = await axios.post(
      fastapiUrl,
      { message, messages, temperature },
      { responseType: "stream" }
    );

    // Set SSE headers and pipe
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let assistantBuffer = "";

    response.data.on("data", (chunk) => {
      const str = chunk.toString();
      // console.log("FastAPI chunk received:", str);
      // Accumulate assistant content for DB once we reach [DONE] or meta
      str.split("\n\n").forEach((evt) => {
        if (!evt.trim()) return;
        if (evt.startsWith("event: token")) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            const payload = JSON.parse(line.slice(6));
            if (payload.token) assistantBuffer += payload.token;
          }
        }
      });
      res.write(str);
    });

    response.data.on("end", async () => {
      // if (assistantBuffer.trim()) {
      //   await ChatMessage.create({
      //     session: session_id,
      //     role: "assistant",
      //     content: assistantBuffer,
      //     model: "llm",
      //   });
      // }
      // Ensure we send a meta event if FastAPI didn't:
      // res.write(`event: meta\ndata: ${JSON.stringify({ session_id })}\n\n`);
      // console.log("FastAPI stream ended. Assistant buffer:", assistantBuffer);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    response.data.on("error", (e) => {
      // console.error("FastAPI stream error:", e);
      res.write(
        `event: error\ndata: ${JSON.stringify({ detail: e.message })}\n\n`
      );
      res.end();
    });
  } catch (err) {
    console.error("Stream proxy error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming failed", detail: err.message });
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
  updateMessageFeedback
};