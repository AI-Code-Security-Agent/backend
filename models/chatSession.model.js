const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ChatSessionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
  title: {
    type: String,
    default: "New Chat",
  },
  chat_count: {
    type: Number,
    default: 0,
  },
  model: {
    type: String,
    enum: ["rag", "llm", "llm_demo"],
    default: "llm",
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ChatSessionModel = mongoose.model("chat_session", ChatSessionSchema);
module.exports = ChatSessionModel;
