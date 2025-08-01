const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ChatSessionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
  title: {
    type: String,
    default: "New Chat"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ChatSessionModel = mongoose.model("chat_session", ChatSessionSchema);
module.exports = ChatSessionModel;
