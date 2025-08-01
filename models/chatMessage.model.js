const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ChatMessageSchema = new Schema({
  session: {
    type: Schema.Types.ObjectId,
    ref: "chat_session",
    required: true
  },
  role: {
    type: String, // 'user' or 'assistant'
    required: true
  },
  content: {
    type: String,
    required: true
  },
  model: {
    type: String, // 'rag' or 'llm'
    default: 'llm'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ChatMessageModel = mongoose.model("chat_message", ChatMessageSchema);
module.exports = ChatMessageModel;
